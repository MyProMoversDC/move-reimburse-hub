import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReimbursementDetails from "./ReimbursementDetails";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";

interface Reimbursement {
  id: string;
  reimbursement_number: number;
  mover_full_name: string;
  job_number: string;
  truck_number: string;
  customer_name: string;
  gas_expenses: number;
  road_expenses: number;
  hotel_expenses: number;
  other_expenses: number;
  total_expenses: number;
  zelle_info: string;
  status: string;
  created_at: string;
  confirmed_at: string | null;
  paid_at: string | null;
}

interface ReimbursementHistoryProps {
  userId?: string;
  refreshKey?: number;
  userRole: "mover" | "admin" | "accountant";
  onUpdate?: () => void;
  language: DashboardLanguage;
}

const ReimbursementHistory = ({ userId, refreshKey, userRole, onUpdate, language }: ReimbursementHistoryProps) => {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
  
  const t = dashboardTranslations[language];

  useEffect(() => {
    fetchReimbursements();
  }, [userId, refreshKey]);

  const fetchReimbursements = async () => {
    try {
      let query = supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });

      if (userId) {
        query = query.eq("mover_id", userId);
      }

      if (userRole === "accountant") {
        query = query.in("status", ["confirmed", "paid"]);
      }

      const { data, error } = await query;

      if (error) throw error;
      setReimbursements(data || []);
    } catch (error: any) {
      console.error("Error fetching reimbursements:", error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      pending: "secondary",
      confirmed: "default",
      paid: "default",
    };
    
    const statusLabels: Record<string, string> = {
      pending: t.pending,
      confirmed: t.statusConfirmed,
      paid: t.paid,
    };

    return (
      <Badge variant={variants[status] || "default"}>
        {statusLabels[status] || status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (loading) {
    return <div>{t.loading}</div>;
  }

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t.reimbursementNumber}</TableHead>
              <TableHead>{t.date}</TableHead>
              {userRole !== "mover" && <TableHead>{t.name}</TableHead>}
              <TableHead>{t.job}</TableHead>
              <TableHead>{t.total}</TableHead>
              <TableHead>{t.status}</TableHead>
              <TableHead>{t.actions}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reimbursements.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  {t.noReimbursements}
                </TableCell>
              </TableRow>
            ) : (
              reimbursements.map((reimbursement) => (
                <TableRow key={reimbursement.id}>
                  <TableCell className="font-medium">
                    #{String(reimbursement.reimbursement_number).padStart(5, "0")}
                  </TableCell>
                  <TableCell>{formatDate(reimbursement.created_at)}</TableCell>
                  {userRole !== "mover" && (
                    <TableCell>{reimbursement.mover_full_name}</TableCell>
                  )}
                  <TableCell>{reimbursement.job_number}</TableCell>
                  <TableCell>${reimbursement.total_expenses.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(reimbursement.status)}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedReimbursement(reimbursement)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!selectedReimbursement} onOpenChange={() => setSelectedReimbursement(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {t.reimbursementNumber} #{selectedReimbursement && String(selectedReimbursement.reimbursement_number).padStart(5, "0")}
            </DialogTitle>
          </DialogHeader>
          {selectedReimbursement && (
            <ReimbursementDetails
              reimbursement={selectedReimbursement}
              userRole={userRole}
              onUpdate={() => {
                fetchReimbursements();
                if (onUpdate) onUpdate();
              }}
              onClose={() => setSelectedReimbursement(null)}
              language={language}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReimbursementHistory;

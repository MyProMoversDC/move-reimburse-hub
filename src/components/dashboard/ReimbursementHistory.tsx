import { useEffect, useState, useMemo } from "react";
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
import { Eye, AlertCircle, Copy } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import ReimbursementDetails from "./ReimbursementDetails";
import AppealForm from "./AppealForm";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";

interface Reimbursement {
  id: string;
  reimbursement_number: number;
  mover_full_name: string;
  mover_id: string;
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
  decline_reason?: string | null;
  appeal_note?: string | null;
  appeal_at?: string | null;
}

interface ReimbursementHistoryProps {
  userId?: string;
  refreshKey?: number;
  userRole: "mover" | "admin" | "accountant";
  onUpdate?: () => void;
  language: DashboardLanguage;
  startDate?: Date;
  endDate?: Date;
  showDuplicates?: boolean;
  searchNumber?: string;
}

const ReimbursementHistory = ({ userId, refreshKey, userRole, onUpdate, language, startDate, endDate, showDuplicates = false, searchNumber = "" }: ReimbursementHistoryProps) => {
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedReimbursement, setSelectedReimbursement] = useState<Reimbursement | null>(null);
  const [appealReimbursement, setAppealReimbursement] = useState<Reimbursement | null>(null);
  
  const t = dashboardTranslations[language];

  // Detect duplicates by job_number + customer_name (case-insensitive)
  const duplicateIds = useMemo(() => {
    if (!showDuplicates) return new Set<string>();
    const groupMap = new Map<string, string[]>();
    for (const r of reimbursements) {
      const key = `${r.job_number.trim().toLowerCase()}|${r.customer_name.trim().toLowerCase()}`;
      const ids = groupMap.get(key) || [];
      ids.push(r.id);
      groupMap.set(key, ids);
    }
    const dupes = new Set<string>();
    for (const ids of groupMap.values()) {
      if (ids.length > 1) {
        ids.forEach(id => dupes.add(id));
      }
    }
    return dupes;
  }, [reimbursements, showDuplicates]);

  const filteredReimbursements = useMemo(() => {
    if (!searchNumber.trim()) return reimbursements;
    const query = searchNumber.trim().replace(/^#/, "");
    return reimbursements.filter(r => 
      String(r.reimbursement_number).padStart(5, "0").includes(query) ||
      String(r.reimbursement_number).includes(query)
    );
  }, [reimbursements, searchNumber]);

  useEffect(() => {
    fetchReimbursements();
  }, [userId, refreshKey, startDate, endDate]);

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

      if (startDate) {
        query = query.gte("created_at", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("created_at", format(endDatePlusOne, "yyyy-MM-dd"));
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
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      confirmed: "default",
      paid: "default",
      declined: "destructive",
      appeal: "outline",
    };
    
    const statusLabels: Record<string, string> = {
      pending: t.pending,
      confirmed: t.statusConfirmed,
      paid: t.paid,
      declined: t.declined,
      appeal: "Under Appeal",
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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.reimbursementNumber}</TableHead>
              <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.date}</TableHead>
              {userRole !== "mover" && <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.name}</TableHead>}
              <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.job}</TableHead>
              <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.total}</TableHead>
              <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.status}</TableHead>
              <TableHead className="whitespace-nowrap text-xs md:text-sm">{t.actions}</TableHead>
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
              reimbursements.map((reimbursement) => {
                const isDuplicate = duplicateIds.has(reimbursement.id);
                return (
                <TableRow key={reimbursement.id} className={isDuplicate ? "bg-destructive/10 hover:bg-destructive/20" : ""}>
                  <TableCell className="font-medium text-xs md:text-sm whitespace-nowrap">
                    <div className="flex items-center gap-1">
                      #{String(reimbursement.reimbursement_number).padStart(5, "0")}
                      {isDuplicate && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Copy className="h-3 w-3 text-destructive" />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p>Potential duplicate (same Job # & Customer)</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs md:text-sm whitespace-nowrap">{formatDate(reimbursement.created_at)}</TableCell>
                  {userRole !== "mover" && (
                    <TableCell className="text-xs md:text-sm">{reimbursement.mover_full_name}</TableCell>
                  )}
                  <TableCell className="text-xs md:text-sm">{reimbursement.job_number}</TableCell>
                  <TableCell className="text-xs md:text-sm whitespace-nowrap">${reimbursement.total_expenses.toFixed(2)}</TableCell>
                  <TableCell>{getStatusBadge(reimbursement.status)}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedReimbursement(reimbursement)}
                        className="h-8 w-8 p-0"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {userRole === "mover" && reimbursement.status === "declined" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAppealReimbursement(reimbursement)}
                          className="text-orange-600 border-orange-600 hover:bg-orange-50 text-xs px-2"
                        >
                          <AlertCircle className="h-3 w-3 md:mr-1" />
                          <span className="hidden md:inline">Appeal</span>
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
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

      <Dialog open={!!appealReimbursement} onOpenChange={() => setAppealReimbursement(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Appeal Reimbursement #{appealReimbursement && String(appealReimbursement.reimbursement_number).padStart(5, "0")}
            </DialogTitle>
          </DialogHeader>
          {appealReimbursement && (
            <AppealForm
              type="reimbursement"
              itemId={appealReimbursement.id}
              itemNumber={String(appealReimbursement.reimbursement_number).padStart(5, "0")}
              declineReason={appealReimbursement.decline_reason || ""}
              onSuccess={() => {
                fetchReimbursements();
                setAppealReimbursement(null);
                if (onUpdate) onUpdate();
              }}
              onClose={() => setAppealReimbursement(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ReimbursementHistory;

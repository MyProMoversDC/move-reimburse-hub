import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { handleError } from "@/lib/errorHandler";
import DateRangeFilter from "./DateRangeFilter";
import ApplyDeductibleDialog from "./ApplyDeductibleDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Deductible {
  id: string;
  report_id: string | null;
  mover_id: string;
  mover_name: string;
  amount: number;
  reason: string | null;
  created_at: string;
  created_by: string;
}

interface Mover {
  id: string;
  first_name: string;
  last_name: string;
}

interface DeductiblesReportProps {
  isAdmin?: boolean;
}

const DeductiblesReport = ({ isAdmin = false }: DeductiblesReportProps) => {
  const [deductibles, setDeductibles] = useState<Deductible[]>([]);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [selectedMoverId, setSelectedMoverId] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [totalAmount, setTotalAmount] = useState(0);

  useEffect(() => {
    fetchMovers();
  }, []);

  useEffect(() => {
    fetchDeductibles();
  }, [startDate, endDate, selectedMoverId]);

  const fetchMovers = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .order("first_name");

      if (error) throw error;
      setMovers(data || []);
    } catch (error) {
      console.error("Error fetching movers:", error);
    }
  };

  const fetchDeductibles = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("deductibles")
        .select("*")
        .order("created_at", { ascending: false });

      if (startDate) {
        query = query.gte("created_at", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("created_at", format(endDatePlusOne, "yyyy-MM-dd"));
      }
      if (selectedMoverId && selectedMoverId !== "all") {
        query = query.eq("mover_id", selectedMoverId);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const deductiblesData = data || [];
      setDeductibles(deductiblesData);
      
      // Calculate total
      const total = deductiblesData.reduce((sum, d) => sum + Number(d.amount), 0);
      setTotalAmount(total);
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("deductibles").delete().eq("id", id);

      if (error) throw error;

      toast.success("Deductible deleted");
      fetchDeductibles();
    } catch (error) {
      toast.error(handleError(error));
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Deductibles Report</CardTitle>
        {isAdmin && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Apply Deductible
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <DateRangeFilter
              startDate={startDate}
              endDate={endDate}
              onStartDateChange={setStartDate}
              onEndDateChange={setEndDate}
              onClear={() => {
                setStartDate(undefined);
                setEndDate(undefined);
              }}
            />
          </div>
          <div className="w-full md:w-64 space-y-2">
            <Label>Filter by Mover</Label>
            <SearchableSelect
              value={selectedMoverId}
              onValueChange={setSelectedMoverId}
              options={[
                { value: "all", label: "All Movers" },
                ...movers.map((mover) => ({
                  value: mover.id,
                  label: `${mover.first_name} ${mover.last_name}`,
                })),
              ]}
              placeholder="All Movers"
              searchPlaceholder="Search movers..."
              emptyMessage="No movers found"
            />
          </div>
        </div>

        <div className="bg-muted p-4 rounded-lg">
          <p className="text-sm text-muted-foreground">Total Deductions</p>
          <p className="text-2xl font-bold text-destructive">
            ${totalAmount.toFixed(2)}
          </p>
          {selectedMoverId !== "all" && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing deductibles for: {movers.find(m => m.id === selectedMoverId)?.first_name} {movers.find(m => m.id === selectedMoverId)?.last_name}
            </p>
          )}
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Mover Name</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Reason</TableHead>
              {isAdmin && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {deductibles.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={isAdmin ? 5 : 4}
                  className="text-center text-muted-foreground"
                >
                  No deductibles found for the selected period.
                </TableCell>
              </TableRow>
            ) : (
              deductibles.map((deductible) => (
                <TableRow key={deductible.id}>
                  <TableCell>
                    {format(new Date(deductible.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {deductible.mover_name}
                  </TableCell>
                  <TableCell className="text-destructive font-medium">
                    ${Number(deductible.amount).toFixed(2)}
                  </TableCell>
                  <TableCell className="max-w-xs truncate">
                    {deductible.reason || "-"}
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Deductible</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this deductible? This
                              action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(deductible.id)}
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <ApplyDeductibleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSuccess={fetchDeductibles}
      />
    </Card>
  );
};

export default DeductiblesReport;

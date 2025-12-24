import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Download, Eye, AlertCircle } from "lucide-react";
import DateRangeFilter from "./DateRangeFilter";
import ColumnSelector from "./ColumnSelector";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface Mover {
  id: string;
  first_name: string;
  last_name: string;
}

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
  decline_reason: string | null;
  created_at: string;
}

interface MoverSummary {
  moverId: string;
  moverName: string;
  totalRequests: number;
  totalAmount: number;
  pendingAmount: number;
  confirmedAmount: number;
  paidAmount: number;
}

const REIMBURSEMENT_COLUMNS = [
  { key: "created_at", label: "Date" },
  { key: "reimbursement_number", label: "Reimbursement #" },
  { key: "mover_full_name", label: "Mover Name" },
  { key: "job_number", label: "Job #" },
  { key: "truck_number", label: "Truck #" },
  { key: "customer_name", label: "Customer Name" },
  { key: "gas_expenses", label: "Gas Expenses" },
  { key: "road_expenses", label: "Road Expenses" },
  { key: "hotel_expenses", label: "Hotel Expenses" },
  { key: "other_expenses", label: "Other Expenses" },
  { key: "total_expenses", label: "Total Expenses" },
  { key: "zelle_info", label: "Zelle Info" },
  { key: "status", label: "Status" },
];

interface ReimbursementReportingDashboardProps {
  language: DashboardLanguage;
}

const ReimbursementReportingDashboard = ({ language }: ReimbursementReportingDashboardProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [selectedMover, setSelectedMover] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(REIMBURSEMENT_COLUMNS.map(c => c.key));
  const [exporting, setExporting] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<MoverSummary | null>(null);

  useEffect(() => {
    fetchMovers();
  }, []);

  useEffect(() => {
    fetchReimbursements();
  }, [selectedMover, startDate, endDate]);

  const fetchMovers = async () => {
    try {
      const { data: moverRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mover");

      if (moverRoles) {
        const moverIds = moverRoles.map((r) => r.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", moverIds)
          .order("first_name");

        setMovers(profiles || []);
      }
    } catch (error) {
      console.error("Error fetching movers:", error);
    }
  };

  const fetchReimbursements = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });

      if (selectedMover !== "all") {
        query = query.eq("mover_id", selectedMover);
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
    } catch (error) {
      console.error("Error fetching reimbursements:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMoverSummaries = (): MoverSummary[] => {
    const summaryMap = new Map<string, MoverSummary>();

    reimbursements.forEach((r) => {
      const existing = summaryMap.get(r.mover_id);
      if (existing) {
        existing.totalRequests++;
        existing.totalAmount += r.total_expenses;
        if (r.status === "pending") existing.pendingAmount += r.total_expenses;
        if (r.status === "confirmed") existing.confirmedAmount += r.total_expenses;
        if (r.status === "paid") existing.paidAmount += r.total_expenses;
      } else {
        summaryMap.set(r.mover_id, {
          moverId: r.mover_id,
          moverName: r.mover_full_name,
          totalRequests: 1,
          totalAmount: r.total_expenses,
          pendingAmount: r.status === "pending" ? r.total_expenses : 0,
          confirmedAmount: r.status === "confirmed" ? r.total_expenses : 0,
          paidAmount: r.status === "paid" ? r.total_expenses : 0,
        });
      }
    });

    return Array.from(summaryMap.values());
  };

  const getBreakdownForMover = (moverId: string) => {
    return reimbursements.filter((r) => r.mover_id === moverId);
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const headers = selectedColumns.map(
        (key) => REIMBURSEMENT_COLUMNS.find((c) => c.key === key)?.label || key
      );

      const rows = reimbursements.map((item) => {
        return selectedColumns.map((key) => {
          switch (key) {
            case "created_at":
              return new Date(item.created_at).toLocaleDateString();
            case "reimbursement_number":
              return String(item.reimbursement_number).padStart(5, "0");
            case "gas_expenses":
            case "road_expenses":
            case "hotel_expenses":
            case "other_expenses":
            case "total_expenses":
              return `$${(item[key as keyof Reimbursement] as number).toFixed(2)}`;
            case "status":
              return item.status.charAt(0).toUpperCase() + item.status.slice(1);
            default:
              return String(item[key as keyof Reimbursement] || "");
          }
        });
      });

      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `reimbursement-report-${new Date().toISOString().split("T")[0]}.csv`;
      link.click();

      toast.success("Export complete!");
      setShowColumnSelector(false);
    } catch (error) {
      toast.error("Export failed");
    } finally {
      setExporting(false);
    }
  };

  const handleExportSummary = () => {
    const summaries = getMoverSummaries();
    const headers = ["Mover Name", "Total Requests", "Total Amount", "Pending", "Confirmed", "Paid"];
    const rows = summaries.map((s) => [
      s.moverName,
      s.totalRequests,
      `$${s.totalAmount.toFixed(2)}`,
      `$${s.pendingAmount.toFixed(2)}`,
      `$${s.confirmedAmount.toFixed(2)}`,
      `$${s.paidAmount.toFixed(2)}`,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `reimbursement-summary-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Summary exported!");
  };

  const handleViewBreakdown = (summary: MoverSummary) => {
    setSelectedSummary(summary);
    setShowBreakdown(true);
  };

  const summaries = getMoverSummaries();
  const totalAmount = summaries.reduce((sum, s) => sum + s.totalAmount, 0);
  const totalPending = summaries.reduce((sum, s) => sum + s.pendingAmount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="w-full md:w-64">
          <label className="text-sm font-medium mb-2 block">Select Mover</label>
          <Select value={selectedMover} onValueChange={setSelectedMover}>
            <SelectTrigger>
              <SelectValue placeholder="All Movers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Movers</SelectItem>
              {movers.map((mover) => (
                <SelectItem key={mover.id} value={mover.id}>
                  {mover.first_name} {mover.last_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
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
        <div className="flex gap-2">
          <Button onClick={() => setShowColumnSelector(true)}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button variant="outline" onClick={handleExportSummary}>
            <Download className="h-4 w-4 mr-2" />
            Export Summary
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Reimbursements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{reimbursements.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalAmount.toFixed(2)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">${totalPending.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Mover Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle>Mover Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-center py-4">Loading...</p>
          ) : summaries.length === 0 ? (
            <p className="text-center py-4 text-muted-foreground">No data found</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mover Name</TableHead>
                  <TableHead className="text-center">Requests</TableHead>
                  <TableHead className="text-right">Total Amount</TableHead>
                  <TableHead className="text-right">Pending</TableHead>
                  <TableHead className="text-right">Confirmed</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-center">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {summaries.map((summary) => (
                  <TableRow key={summary.moverId}>
                    <TableCell className="font-medium">{summary.moverName}</TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="link"
                        className="p-0 h-auto"
                        onClick={() => handleViewBreakdown(summary)}
                      >
                        {summary.totalRequests}
                      </Button>
                    </TableCell>
                    <TableCell className="text-right">${summary.totalAmount.toFixed(2)}</TableCell>
                    <TableCell className="text-right text-yellow-600">
                      ${summary.pendingAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-blue-600">
                      ${summary.confirmedAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      ${summary.paidAmount.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleViewBreakdown(summary)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Column Selector Dialog */}
      <ColumnSelector
        open={showColumnSelector}
        onOpenChange={setShowColumnSelector}
        columns={REIMBURSEMENT_COLUMNS}
        selectedColumns={selectedColumns}
        onSelectedColumnsChange={setSelectedColumns}
        onExport={handleExport}
        exporting={exporting}
      />

      {/* Breakdown Dialog */}
      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Reimbursement Breakdown - {selectedSummary?.moverName}
            </DialogTitle>
          </DialogHeader>
          {selectedSummary && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    const breakdown = getBreakdownForMover(selectedSummary.moverId);
                    const headers = ["Reimbursement #", "Date", "Job #", "Customer", "Total", "Status"];
                    const rows = breakdown.map((r) => [
                      String(r.reimbursement_number).padStart(5, "0"),
                      new Date(r.created_at).toLocaleDateString(),
                      r.job_number,
                      r.customer_name,
                      `$${r.total_expenses.toFixed(2)}`,
                      r.status,
                    ]);
                    const csvContent = [
                      headers.join(","),
                      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
                    ].join("\n");
                    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
                    const link = document.createElement("a");
                    link.href = URL.createObjectURL(blob);
                    link.download = `breakdown-${selectedSummary.moverName.replace(/\s/g, "-")}-${new Date().toISOString().split("T")[0]}.csv`;
                    link.click();
                    toast.success("Breakdown exported!");
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Export Breakdown
                </Button>
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reimbursement #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Job #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getBreakdownForMover(selectedSummary.moverId).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{String(r.reimbursement_number).padStart(5, "0")}</TableCell>
                      <TableCell>{format(new Date(r.created_at), "MM/dd/yyyy")}</TableCell>
                      <TableCell>{r.job_number}</TableCell>
                      <TableCell>{r.customer_name}</TableCell>
                      <TableCell className="text-right">${r.total_expenses.toFixed(2)}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant={
                              r.status === "paid"
                                ? "default"
                                : r.status === "confirmed"
                                ? "secondary"
                                : r.status === "declined"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {r.status}
                          </Badge>
                          {r.status === "declined" && r.decline_reason && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                <strong>Decline Reason:</strong> {r.decline_reason}
                              </AlertDescription>
                            </Alert>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ReimbursementReportingDashboard;

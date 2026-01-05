import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchableSelect } from "@/components/ui/searchable-select";
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

interface MissingPayment {
  id: string;
  mover_id: string;
  mover_full_name: string;
  customer_name: string;
  job_number: string;
  discrepancy_date: string;
  discrepancy_types: string[];
  discrepancy_details: string;
  missing_amount: string;
  status: string;
  decline_reason: string | null;
  created_at: string;
}

interface MoverSummary {
  moverId: string;
  moverName: string;
  totalSubmissions: number;
  pendingCount: number;
  confirmedCount: number;
  declinedCount: number;
}

const MISSING_PAYMENT_COLUMNS = [
  { key: "created_at", label: "Submission Date" },
  { key: "mover_full_name", label: "Mover Name" },
  { key: "customer_name", label: "Customer Name" },
  { key: "job_number", label: "Job/Invoice #" },
  { key: "discrepancy_date", label: "Discrepancy Date" },
  { key: "discrepancy_types", label: "Discrepancy Types" },
  { key: "discrepancy_details", label: "Details" },
  { key: "missing_amount", label: "Missing Amount" },
  { key: "status", label: "Status" },
];

interface MissingPaymentReportingDashboardProps {
  language: DashboardLanguage;
}

const MissingPaymentReportingDashboard = ({ language }: MissingPaymentReportingDashboardProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [selectedMover, setSelectedMover] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [payments, setPayments] = useState<MissingPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(MISSING_PAYMENT_COLUMNS.map(c => c.key));
  const [exporting, setExporting] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<MoverSummary | null>(null);

  useEffect(() => {
    fetchMovers();
  }, []);

  useEffect(() => {
    fetchPayments();
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

  const fetchPayments = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("missing_payments")
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
      setPayments(data || []);
    } catch (error) {
      console.error("Error fetching missing payments:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMoverSummaries = (): MoverSummary[] => {
    const summaryMap = new Map<string, MoverSummary>();

    payments.forEach((p) => {
      const existing = summaryMap.get(p.mover_id);
      if (existing) {
        existing.totalSubmissions++;
        if (p.status === "pending") existing.pendingCount++;
        if (p.status === "confirmed") existing.confirmedCount++;
        if (p.status === "declined") existing.declinedCount++;
      } else {
        summaryMap.set(p.mover_id, {
          moverId: p.mover_id,
          moverName: p.mover_full_name,
          totalSubmissions: 1,
          pendingCount: p.status === "pending" ? 1 : 0,
          confirmedCount: p.status === "confirmed" ? 1 : 0,
          declinedCount: p.status === "declined" ? 1 : 0,
        });
      }
    });

    return Array.from(summaryMap.values());
  };

  const getBreakdownForMover = (moverId: string) => {
    return payments.filter((p) => p.mover_id === moverId);
  };

  const formatDiscrepancyTypes = (types: string[]) => {
    return types.map(t => t.replace(/_/g, ' ')).join(', ');
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const headers = selectedColumns.map(
        (key) => MISSING_PAYMENT_COLUMNS.find((c) => c.key === key)?.label || key
      );

      const rows = payments.map((item) => {
        return selectedColumns.map((key) => {
          switch (key) {
            case "created_at":
              return new Date(item.created_at).toLocaleDateString();
            case "discrepancy_date":
              return new Date(item.discrepancy_date).toLocaleDateString();
            case "discrepancy_types":
              return formatDiscrepancyTypes(item.discrepancy_types);
            case "status":
              return item.status.charAt(0).toUpperCase() + item.status.slice(1);
            default:
              return String(item[key as keyof MissingPayment] || "");
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
      link.download = `missing-payment-report-${new Date().toISOString().split("T")[0]}.csv`;
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
    const headers = ["Mover Name", "Total Submissions", "Pending", "Confirmed", "Declined"];
    const rows = summaries.map((s) => [
      s.moverName,
      s.totalSubmissions,
      s.pendingCount,
      s.confirmedCount,
      s.declinedCount,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `missing-payment-summary-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Summary exported!");
  };

  const handleViewBreakdown = (summary: MoverSummary) => {
    setSelectedSummary(summary);
    setShowBreakdown(true);
  };

  const summaries = getMoverSummaries();
  const totalSubmissions = summaries.reduce((sum, s) => sum + s.totalSubmissions, 0);
  const totalConfirmed = summaries.reduce((sum, s) => sum + s.confirmedCount, 0);
  const totalPending = summaries.reduce((sum, s) => sum + s.pendingCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 items-start md:items-end">
        <div className="w-full md:w-64">
          <label className="text-sm font-medium mb-2 block">Select Mover</label>
          <SearchableSelect
            value={selectedMover}
            onValueChange={setSelectedMover}
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
              Total Submissions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalSubmissions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pending Review
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-yellow-600">{totalPending}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totalConfirmed}</p>
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
                  <TableHead className="text-center">Total Submissions</TableHead>
                  <TableHead className="text-center">Pending</TableHead>
                  <TableHead className="text-center">Confirmed</TableHead>
                  <TableHead className="text-center">Declined</TableHead>
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
                        {summary.totalSubmissions}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center text-yellow-600">
                      {summary.pendingCount}
                    </TableCell>
                    <TableCell className="text-center text-green-600">
                      {summary.confirmedCount}
                    </TableCell>
                    <TableCell className="text-center text-red-600">
                      {summary.declinedCount}
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
        columns={MISSING_PAYMENT_COLUMNS}
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
              Missing Payment Breakdown - {selectedSummary?.moverName}
            </DialogTitle>
          </DialogHeader>
          {selectedSummary && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    const breakdown = getBreakdownForMover(selectedSummary.moverId);
                    const headers = ["Job #", "Customer", "Discrepancy Date", "Amount", "Status"];
                    const rows = breakdown.map((p) => [
                      p.job_number,
                      p.customer_name,
                      new Date(p.discrepancy_date).toLocaleDateString(),
                      p.missing_amount,
                      p.status,
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
                    <TableHead>Job #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Discrepancy Date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getBreakdownForMover(selectedSummary.moverId).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.job_number}</TableCell>
                      <TableCell>{p.customer_name}</TableCell>
                      <TableCell>{format(new Date(p.discrepancy_date), "MM/dd/yyyy")}</TableCell>
                      <TableCell>{p.missing_amount}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant={
                              p.status === "confirmed"
                                ? "default"
                                : p.status === "declined"
                                ? "destructive"
                                : "outline"
                            }
                          >
                            {p.status}
                          </Badge>
                          {p.status === "declined" && p.decline_reason && (
                            <Alert variant="destructive" className="mt-2">
                              <AlertCircle className="h-4 w-4" />
                              <AlertDescription className="text-xs">
                                <strong>Decline Reason:</strong> {p.decline_reason}
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

export default MissingPaymentReportingDashboard;

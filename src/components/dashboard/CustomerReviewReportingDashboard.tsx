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

interface ReviewBonus {
  id: string;
  mover_id: string;
  foreman_name: string;
  job_date: string;
  client_full_name: string;
  invoice_number: string;
  crew_member_1: string;
  crew_member_2: string;
  crew_member_3: string;
  crew_member_4: string | null;
  crew_member_5: string | null;
  crew_member_6: string | null;
  crew_member_7: string | null;
  crew_member_8: string | null;
  review_url: string | null;
  screenshot_url: string;
  status: string;
  decline_reason: string | null;
  submission_date: string;
  review_month: string;
}

interface MoverSummary {
  moverId: string;
  moverName: string;
  totalReviews: number;
  pendingReviews: number;
  confirmedReviews: number;
  declinedReviews: number;
}

const REVIEW_COLUMNS = [
  { key: "submission_date", label: "Submission Date" },
  { key: "foreman_name", label: "Foreman Name" },
  { key: "job_date", label: "Job Date" },
  { key: "client_full_name", label: "Client Full Name" },
  { key: "invoice_number", label: "Invoice Number" },
  { key: "crew_member_1", label: "Crew Member 1" },
  { key: "crew_member_2", label: "Crew Member 2" },
  { key: "crew_member_3", label: "Crew Member 3" },
  { key: "crew_member_4", label: "Crew Member 4" },
  { key: "crew_member_5", label: "Crew Member 5" },
  { key: "crew_member_6", label: "Crew Member 6" },
  { key: "crew_member_7", label: "Crew Member 7" },
  { key: "crew_member_8", label: "Crew Member 8" },
  { key: "review_url", label: "Review URL" },
  { key: "review_month", label: "Review Month" },
  { key: "status", label: "Status" },
];

interface CustomerReviewReportingDashboardProps {
  language: DashboardLanguage;
}

const CustomerReviewReportingDashboard = ({ language }: CustomerReviewReportingDashboardProps) => {
  const [movers, setMovers] = useState<Mover[]>([]);
  const [selectedMover, setSelectedMover] = useState<string>("all");
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [reviews, setReviews] = useState<ReviewBonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showColumnSelector, setShowColumnSelector] = useState(false);
  const [selectedColumns, setSelectedColumns] = useState<string[]>(REVIEW_COLUMNS.map(c => c.key));
  const [exporting, setExporting] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<MoverSummary | null>(null);

  useEffect(() => {
    fetchMovers();
  }, []);

  useEffect(() => {
    fetchReviews();
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

  const fetchReviews = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from("review_bonuses")
        .select("*")
        .order("submission_date", { ascending: false });

      if (selectedMover !== "all") {
        query = query.eq("mover_id", selectedMover);
      }
      if (startDate) {
        query = query.gte("submission_date", format(startDate, "yyyy-MM-dd"));
      }
      if (endDate) {
        const endDatePlusOne = new Date(endDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("submission_date", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;
      if (error) throw error;
      setReviews(data || []);
    } catch (error) {
      console.error("Error fetching reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  const getMoverSummaries = (): MoverSummary[] => {
    const summaryMap = new Map<string, MoverSummary>();

    reviews.forEach((r) => {
      const existing = summaryMap.get(r.mover_id);
      if (existing) {
        existing.totalReviews++;
        if (r.status === "pending") existing.pendingReviews++;
        if (r.status === "confirmed") existing.confirmedReviews++;
        if (r.status === "declined") existing.declinedReviews++;
      } else {
        summaryMap.set(r.mover_id, {
          moverId: r.mover_id,
          moverName: r.foreman_name,
          totalReviews: 1,
          pendingReviews: r.status === "pending" ? 1 : 0,
          confirmedReviews: r.status === "confirmed" ? 1 : 0,
          declinedReviews: r.status === "declined" ? 1 : 0,
        });
      }
    });

    return Array.from(summaryMap.values());
  };

  const getBreakdownForMover = (moverId: string) => {
    return reviews.filter((r) => r.mover_id === moverId);
  };

  const handleExport = () => {
    setExporting(true);
    try {
      const headers = selectedColumns.map(
        (key) => REVIEW_COLUMNS.find((c) => c.key === key)?.label || key
      );

      const rows = reviews.map((item) => {
        return selectedColumns.map((key) => {
          switch (key) {
            case "submission_date":
              return new Date(item.submission_date).toLocaleDateString();
            case "job_date":
              return new Date(item.job_date).toLocaleDateString();
            case "status":
              return item.status.charAt(0).toUpperCase() + item.status.slice(1);
            default:
              return String(item[key as keyof ReviewBonus] || "");
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
      link.download = `review-bonus-report-${new Date().toISOString().split("T")[0]}.csv`;
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
    const headers = ["Foreman Name", "Total Reviews", "Pending", "Confirmed", "Declined"];
    const rows = summaries.map((s) => [
      s.moverName,
      s.totalReviews,
      s.pendingReviews,
      s.confirmedReviews,
      s.declinedReviews,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `review-bonus-summary-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();

    toast.success("Summary exported!");
  };

  const handleViewBreakdown = (summary: MoverSummary) => {
    setSelectedSummary(summary);
    setShowBreakdown(true);
  };

  const summaries = getMoverSummaries();
  const totalReviews = summaries.reduce((sum, s) => sum + s.totalReviews, 0);
  const totalConfirmed = summaries.reduce((sum, s) => sum + s.confirmedReviews, 0);

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
              Total Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalReviews}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Confirmed Reviews
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">{totalConfirmed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Bonus Hours Earned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-blue-600">{totalConfirmed}</p>
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
                  <TableHead>Foreman Name</TableHead>
                  <TableHead className="text-center">Total Reviews</TableHead>
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
                        {summary.totalReviews}
                      </Button>
                    </TableCell>
                    <TableCell className="text-center text-yellow-600">
                      {summary.pendingReviews}
                    </TableCell>
                    <TableCell className="text-center text-green-600">
                      {summary.confirmedReviews}
                    </TableCell>
                    <TableCell className="text-center text-red-600">
                      {summary.declinedReviews}
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
        columns={REVIEW_COLUMNS}
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
              Review Breakdown - {selectedSummary?.moverName}
            </DialogTitle>
          </DialogHeader>
          {selectedSummary && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    const breakdown = getBreakdownForMover(selectedSummary.moverId);
                    const headers = ["Invoice #", "Client Name", "Job Date", "Review Month", "Status"];
                    const rows = breakdown.map((r) => [
                      r.invoice_number,
                      r.client_full_name,
                      new Date(r.job_date).toLocaleDateString(),
                      r.review_month,
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
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Client Name</TableHead>
                    <TableHead>Job Date</TableHead>
                    <TableHead>Review Month</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getBreakdownForMover(selectedSummary.moverId).map((r) => (
                    <TableRow key={r.id}>
                      <TableCell>{r.invoice_number}</TableCell>
                      <TableCell>{r.client_full_name}</TableCell>
                      <TableCell>{format(new Date(r.job_date), "MM/dd/yyyy")}</TableCell>
                      <TableCell>{r.review_month}</TableCell>
                      <TableCell>
                        <div className="space-y-2">
                          <Badge
                            variant={
                              r.status === "confirmed"
                                ? "default"
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

export default CustomerReviewReportingDashboard;

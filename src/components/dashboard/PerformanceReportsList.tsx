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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Mail, DollarSign } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { handleError } from "@/lib/errorHandler";
import PerformanceReportForm from "./PerformanceReportForm";
import PerformanceReportDetails from "./PerformanceReportDetails";
import SendMoverEmailDialog from "./SendMoverEmailDialog";
import ApplyDeductibleDialog from "./ApplyDeductibleDialog";

interface PerformanceReport {
  id: string;
  title: string;
  incident_datetime: string;
  worker_name: string;
  incident_category: string;
  incident_description: string;
  severity_level: string;
  created_at: string;
  created_by: string;
  taken_actions?: string | null;
}

interface PerformanceReportsListProps {
  refreshKey: number;
  onRefresh: () => void;
  userRole?: 'admin' | 'operations_manager';
}

const severityColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const PerformanceReportsList = ({ refreshKey, onRefresh, userRole = 'operations_manager' }: PerformanceReportsListProps) => {
  const [reports, setReports] = useState<PerformanceReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedReport, setSelectedReport] = useState<PerformanceReport | null>(null);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [emailReportTitle, setEmailReportTitle] = useState<string | undefined>();
  const [deductibleDialogOpen, setDeductibleDialogOpen] = useState(false);
  const [deductibleReportId, setDeductibleReportId] = useState<string | undefined>();
  const [deductibleReportTitle, setDeductibleReportTitle] = useState<string | undefined>();

  useEffect(() => {
    fetchReports();
  }, [refreshKey]);

  const fetchReports = async () => {
    try {
      const { data, error } = await supabase
        .from("performance_reports")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const handleFormSuccess = () => {
    setShowForm(false);
    onRefresh();
    toast.success("Report submitted successfully!");
  };

  const handleOpenEmailDialog = (reportTitle: string) => {
    setEmailReportTitle(reportTitle);
    setEmailDialogOpen(true);
  };

  const handleOpenDeductibleDialog = (reportId: string, reportTitle: string) => {
    setDeductibleReportId(reportId);
    setDeductibleReportTitle(reportTitle);
    setDeductibleDialogOpen(true);
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (showForm) {
    return (
      <PerformanceReportForm 
        onSuccess={handleFormSuccess} 
        onCancel={() => setShowForm(false)} 
      />
    );
  }

  if (selectedReport) {
    return (
      <PerformanceReportDetails 
        report={selectedReport} 
        onClose={() => setSelectedReport(null)} 
      />
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Performance / Misconduct Reports</CardTitle>
        {userRole === 'operations_manager' && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Create New Report
          </Button>
        )}
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Submitted At</TableHead>
              <TableHead>Date of Incident</TableHead>
              <TableHead>Worker Name</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Severity</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {reports.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground">
                  No reports found. Click "Create New Report" to add one.
                </TableCell>
              </TableRow>
            ) : (
              reports.map((report) => (
                <TableRow key={report.id}>
                  <TableCell className="font-medium">{report.title}</TableCell>
                  <TableCell>
                    {format(new Date(report.created_at), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>
                    {format(new Date(report.incident_datetime), "MMM d, yyyy HH:mm")}
                  </TableCell>
                  <TableCell>{report.worker_name}</TableCell>
                  <TableCell>{report.incident_category}</TableCell>
                  <TableCell>
                    <Badge className={severityColors[report.severity_level] || ""}>
                      {report.severity_level}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedReport(report)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </Button>
                      {userRole === 'admin' && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEmailDialog(report.title)}
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Email
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenDeductibleDialog(report.id, report.title)}
                          >
                            <DollarSign className="h-4 w-4 mr-2" />
                            Deduct
                          </Button>
                        </>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>

      <SendMoverEmailDialog
        open={emailDialogOpen}
        onOpenChange={setEmailDialogOpen}
        reportTitle={emailReportTitle}
      />

      <ApplyDeductibleDialog
        open={deductibleDialogOpen}
        onOpenChange={setDeductibleDialogOpen}
        reportId={deductibleReportId}
        reportTitle={deductibleReportTitle}
      />
    </Card>
  );
};

export default PerformanceReportsList;

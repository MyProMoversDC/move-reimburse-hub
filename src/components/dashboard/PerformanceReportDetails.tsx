import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { format } from "date-fns";

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

interface PerformanceReportDetailsProps {
  report: PerformanceReport;
  onClose: () => void;
}

const severityColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const PerformanceReportDetails = ({ report, onClose }: PerformanceReportDetailsProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <CardTitle>{report.title}</CardTitle>
        </div>
        <Badge className={severityColors[report.severity_level] || ""}>
          {report.severity_level}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Date of Incident</h4>
            <p className="text-lg">
              {format(new Date(report.incident_datetime), "MMMM d, yyyy 'at' HH:mm")}
            </p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Worker Name</h4>
            <p className="text-lg">{report.worker_name}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Incident Category</h4>
            <p className="text-lg">{report.incident_category}</p>
          </div>
          <div>
            <h4 className="text-sm font-medium text-muted-foreground">Created At</h4>
            <p className="text-lg">
              {format(new Date(report.created_at), "MMMM d, yyyy")}
            </p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Description of Incident</h4>
          <div className="bg-muted/50 rounded-lg p-4">
            <p className="whitespace-pre-wrap">{report.incident_description}</p>
          </div>
        </div>

        {report.taken_actions && (
          <div>
            <h4 className="text-sm font-medium text-muted-foreground mb-2">Taken Actions</h4>
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <p className="whitespace-pre-wrap text-blue-800 dark:text-blue-200">{report.taken_actions}</p>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="outline" onClick={onClose}>
            Back to List
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default PerformanceReportDetails;

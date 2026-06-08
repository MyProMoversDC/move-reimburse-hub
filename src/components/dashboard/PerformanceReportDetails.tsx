import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

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
  onReviewed?: () => void;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
}

const severityColors: Record<string, string> = {
  Low: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  Medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  High: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
  Critical: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
};

const isVideoFile = (fileName: string): boolean => {
  const videoExtensions = ['.mp4', '.mov', '.avi', '.webm', '.mkv', '.m4v'];
  return videoExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
};

const PerformanceReportDetails = ({ report, onClose, onReviewed }: PerformanceReportDetailsProps) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingAttachments, setLoadingAttachments] = useState(true);

  useEffect(() => {
    const fetchAttachments = async () => {
      setLoadingAttachments(true);
      try {
        const { data } = await supabase
          .from("performance_report_attachments")
          .select("id, file_url, file_name")
          .eq("report_id", report.id);

        if (data && data.length > 0) {
          setAttachments(data);
          
          // Get signed URLs for all attachments
          const urls: Record<string, string> = {};
          for (const attachment of data) {
            const { data: signedData } = await supabase.storage
              .from("performance-report-attachments")
              .createSignedUrl(attachment.file_url, 3600);
            if (signedData?.signedUrl) {
              urls[attachment.id] = signedData.signedUrl;
            }
          }
          setSignedUrls(urls);
        }
      } catch (error) {
        console.error("Failed to fetch attachments:", error);
      } finally {
        setLoadingAttachments(false);
      }
    };

    const markAsReviewed = async () => {
      // Mark as reviewed when viewing
      const { error } = await supabase
        .from("performance_reports")
        .update({ reviewed_at: new Date().toISOString() })
        .eq("id", report.id)
        .is("reviewed_at", null);

      if (!error) {
        onReviewed?.();
      }
    };

    fetchAttachments();
    markAsReviewed();
  }, [report.id]);

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

        {/* Attachments Section */}
        <div>
          <h4 className="text-sm font-medium text-muted-foreground mb-2">Attachments</h4>
          {loadingAttachments ? (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Loading attachments...</span>
            </div>
          ) : attachments.length === 0 ? (
            <p className="text-muted-foreground">No attachments</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {attachments.map((attachment) => {
                const url = signedUrls[attachment.id];
                const isVideo = isVideoFile(attachment.file_name);
                
                return (
                  <div key={attachment.id} className="border rounded-lg overflow-hidden bg-muted/50">
                    {isVideo ? (
                      <video
                        src={url}
                        controls
                        className="w-full max-h-[400px]"
                        preload="metadata"
                      >
                        Your browser does not support the video tag.
                      </video>
                    ) : (
                      <a href={url} target="_blank" rel="noopener noreferrer">
                        <img
                          src={url}
                          alt={attachment.file_name}
                          className="w-full h-auto max-h-[400px] object-contain"
                        />
                      </a>
                    )}
                    <div className="p-2 border-t">
                      <p className="text-sm text-muted-foreground truncate">{attachment.file_name}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

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

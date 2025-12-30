import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Upload, X, Info } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";

interface PerformanceReportFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

interface AttachmentFile {
  file: File;
  preview: string;
}

const severityLevels = ["Low", "Medium", "High", "Critical"];

const incidentCategories = [
  "Late for job",
  "No Uniform",
  "Declined a job",
  "Incomplete Uniform",
  "Refused Long-Distance Job",
  "Time-off Request <72 hours",
  "Customer Unhappy / Compliant",
  "Negative feedback from coworkers/staff/contractors",
  "No tools/Missing tools",
  "Refused Skill Learning (TV Mount, W/D install, safe anchoring/bolting, English comms, etc.)",
  "Paperwork Incomplete (BOL, addendum, storage agreement)",
  "Pre-existing Damage Notes/Pictures Missing",
  "Pre-trip Inspection not Submitted",
  "Post-trip Inspection not Submitted",
  "Other",
];

const PerformanceReportForm = ({ onSuccess, onCancel }: PerformanceReportFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    title: "",
    incident_datetime: "",
    worker_name: "",
    incident_category: "",
    incident_description: "",
    severity_level: "",
    taken_actions: "",
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image file`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} is too large (max 10MB)`);
        continue;
      }
      newAttachments.push({
        file,
        preview: URL.createObjectURL(file),
      });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => {
      const newAttachments = [...prev];
      URL.revokeObjectURL(newAttachments[index].preview);
      newAttachments.splice(index, 1);
      return newAttachments;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate all required fields
    if (!formData.title.trim()) {
      toast.error("Title is required");
      return;
    }
    if (!formData.incident_datetime) {
      toast.error("Date of incident is required");
      return;
    }
    if (!formData.worker_name.trim()) {
      toast.error("Worker name is required");
      return;
    }
    if (!formData.incident_category.trim()) {
      toast.error("Incident category is required");
      return;
    }
    if (!formData.incident_description.trim()) {
      toast.error("Description of incident is required");
      return;
    }
    if (!formData.severity_level) {
      toast.error("Severity level is required");
      return;
    }

    setSubmitting(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error("You must be logged in to submit a report");
        return;
      }

      // Get user profile for submitter name
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", user.id)
        .single();

      const submitterName = profile 
        ? `${profile.first_name} ${profile.last_name}`.trim() 
        : user.email || "Unknown";

      const { data: reportData, error } = await supabase
        .from("performance_reports")
        .insert({
          title: formData.title.trim(),
          incident_datetime: formData.incident_datetime,
          worker_name: formData.worker_name.trim(),
          incident_category: formData.incident_category.trim(),
          incident_description: formData.incident_description.trim(),
          severity_level: formData.severity_level,
          taken_actions: formData.taken_actions.trim() || null,
          created_by: user.id,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Upload attachments if any
      if (attachments.length > 0 && reportData) {
        for (const attachment of attachments) {
          const fileExt = attachment.file.name.split(".").pop();
          const fileName = `${reportData.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from("performance-report-attachments")
            .upload(fileName, attachment.file);

          if (uploadError) {
            console.error("Failed to upload attachment:", uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("performance-report-attachments")
            .getPublicUrl(fileName);

          await supabase.from("performance_report_attachments").insert({
            report_id: reportData.id,
            file_url: urlData.publicUrl,
            file_name: attachment.file.name,
          });
        }
      }

      // Send email notification
      try {
        await supabase.functions.invoke("send-performance-report-notification", {
          body: {
            title: formData.title.trim(),
            workerName: formData.worker_name.trim(),
            incidentCategory: formData.incident_category.trim(),
            severityLevel: formData.severity_level,
            incidentDatetime: formData.incident_datetime,
            submittedBy: submitterName,
          },
        });
      } catch (notifyError) {
        console.error("Failed to send notification:", notifyError);
        // Don't fail the submission if notification fails
      }

      // Clean up previews
      attachments.forEach((a) => URL.revokeObjectURL(a.preview));

      onSuccess();
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onCancel}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <CardTitle>Create New Performance / Misconduct Report</CardTitle>
          <CardDescription className="mt-1">
            Use this form to report any performance issues or misconduct incidents involving workers.
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent>
        <Alert className="mb-6 border-blue-200 bg-blue-50 dark:bg-blue-950">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            Document any incidents or performance concerns for proper tracking and follow-up. Include as much detail as possible and attach any relevant images or documentation.
          </AlertDescription>
        </Alert>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Enter report title"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident_datetime">Date of Incident *</Label>
              <Input
                id="incident_datetime"
                type="datetime-local"
                value={formData.incident_datetime}
                onChange={(e) => setFormData({ ...formData, incident_datetime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="worker_name">Worker Name *</Label>
              <Input
                id="worker_name"
                value={formData.worker_name}
                onChange={(e) => setFormData({ ...formData, worker_name: e.target.value })}
                placeholder="Enter worker name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="incident_category">Incident Category *</Label>
              <Select
                value={formData.incident_category}
                onValueChange={(value) => setFormData({ ...formData, incident_category: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select incident category" />
                </SelectTrigger>
                <SelectContent className="bg-popover max-h-[300px]">
                  {incidentCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="severity_level">Severity Level *</Label>
              <Select
                value={formData.severity_level}
                onValueChange={(value) => setFormData({ ...formData, severity_level: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select severity level" />
                </SelectTrigger>
                <SelectContent className="bg-popover">
                  {severityLevels.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="incident_description">Description of Incident *</Label>
            <Textarea
              id="incident_description"
              value={formData.incident_description}
              onChange={(e) => setFormData({ ...formData, incident_description: e.target.value })}
              placeholder="Provide a detailed description of the incident..."
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="taken_actions">Taken Actions (Optional)</Label>
            <Textarea
              id="taken_actions"
              value={formData.taken_actions}
              onChange={(e) => setFormData({ ...formData, taken_actions: e.target.value })}
              placeholder="Describe any actions taken regarding this incident..."
              rows={4}
            />
          </div>

          {/* Attachments Section */}
          <div className="space-y-2">
            <Label>Attachments (Optional)</Label>
            <p className="text-sm text-muted-foreground">
              Upload images related to the incident (max 10MB per image)
            </p>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            
            <Button
              type="button"
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full border-dashed"
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Images
            </Button>

            {attachments.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                {attachments.map((attachment, index) => (
                  <div key={index} className="relative group">
                    <div className="aspect-square rounded-lg overflow-hidden border bg-muted">
                      <img
                        src={attachment.preview}
                        alt={attachment.file.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="destructive"
                      size="icon"
                      className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => removeAttachment(index)}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1 truncate">
                      {attachment.file.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Send"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default PerformanceReportForm;

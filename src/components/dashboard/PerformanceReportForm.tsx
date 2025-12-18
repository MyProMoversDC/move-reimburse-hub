import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { handleError } from "@/lib/errorHandler";

interface PerformanceReportFormProps {
  onSuccess: () => void;
  onCancel: () => void;
}

const severityLevels = ["Low", "Medium", "High", "Critical"];

const PerformanceReportForm = ({ onSuccess, onCancel }: PerformanceReportFormProps) => {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    incident_datetime: "",
    worker_name: "",
    incident_category: "",
    incident_description: "",
    severity_level: "",
  });

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

      const { error } = await supabase.from("performance_reports").insert({
        title: formData.title.trim(),
        incident_datetime: formData.incident_datetime,
        worker_name: formData.worker_name.trim(),
        incident_category: formData.incident_category.trim(),
        incident_description: formData.incident_description.trim(),
        severity_level: formData.severity_level,
        created_by: user.id,
      });

      if (error) throw error;

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
        <CardTitle>Create New Performance / Misconduct Report</CardTitle>
      </CardHeader>
      <CardContent>
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
              <Input
                id="incident_category"
                value={formData.incident_category}
                onChange={(e) => setFormData({ ...formData, incident_category: e.target.value })}
                placeholder="e.g., Safety Violation, Misconduct, Performance Issue"
              />
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

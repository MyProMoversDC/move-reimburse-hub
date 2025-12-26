import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { handleError } from "@/lib/errorHandler";
import { violenceIncidentTranslations, ViolenceIncidentLanguage } from "@/lib/violenceIncidentTranslations";
import ApplyDeductibleDialog from "./ApplyDeductibleDialog";

interface ViolenceIncident {
  id: string;
  mover_id?: string;
  mover_name: string;
  phone_number: string;
  created_at: string;
  incident_date: string;
  incident_time: string;
  job_id: string;
  incident_address: string;
  client_name: string;
  incident_types: string[];
  incident_description: string;
  anyone_injured: boolean;
  injury_description: string | null;
  property_damaged: boolean;
  damage_description: string | null;
  police_contacted: boolean;
  emergency_services_called: boolean;
  severity_level: string;
  admin_actions: string | null;
  operations_manager_actions: string | null;
}

interface Attachment {
  id: string;
  file_url: string;
  file_name: string;
}

interface ViolenceIncidentDetailsProps {
  incident: ViolenceIncident;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: ViolenceIncidentLanguage;
  canEdit?: boolean;
  userRole?: "admin" | "operations_manager";
  onUpdate?: () => void;
}

const ViolenceIncidentDetails = ({
  incident,
  open,
  onOpenChange,
  language,
  canEdit = false,
  userRole,
  onUpdate,
}: ViolenceIncidentDetailsProps) => {
  const [adminActions, setAdminActions] = useState(incident.admin_actions || "");
  const [opsActions, setOpsActions] = useState(incident.operations_manager_actions || "");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [deductibleDialogOpen, setDeductibleDialogOpen] = useState(false);

  const t = violenceIncidentTranslations[language];

  useEffect(() => {
    if (open) {
      fetchAttachments();
    }
  }, [open, incident.id]);

  const fetchAttachments = async () => {
    const { data } = await supabase
      .from("violence_incident_attachments")
      .select("*")
      .eq("incident_id", incident.id);
    setAttachments(data || []);
  };

  const handleSaveActions = async () => {
    setSaving(true);
    try {
      const updates: Record<string, string | null> = {};
      if (userRole === "admin") {
        updates.admin_actions = adminActions.trim() || null;
      }
      if (userRole === "operations_manager" || userRole === "admin") {
        updates.operations_manager_actions = opsActions.trim() || null;
      }

      const { error } = await supabase
        .from("violence_incidents")
        .update(updates)
        .eq("id", incident.id);

      if (error) throw error;

      toast.success(t.actionsSaved);
      onUpdate?.();
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setSaving(false);
    }
  };

  const getIncidentTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      verbal_threat: t.verbalThreat,
      physical_contact: t.physicalContact,
      property_damage: t.propertyDamage,
      harassment: t.harassment,
      weapon_seen: t.weaponSeen,
      other: t.other,
    };
    return labels[type] || type;
  };

  const getSeverityBadge = (severity: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      low: "secondary",
      medium: "default",
      high: "destructive",
      critical: "destructive",
    };
    const labels: Record<string, string> = {
      low: t.low,
      medium: t.medium,
      high: t.high,
      critical: t.critical,
    };
    return <Badge variant={variants[severity] || "default"}>{labels[severity] || severity}</Badge>;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {t.formTitle}
              {getSeverityBadge(incident.severity_level)}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="max-h-[70vh] pr-4">
            <div className="space-y-6">
              {/* Reporter Info */}
              <div>
                <h3 className="font-semibold mb-2">{t.reporterInfo}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t.moverName}:</span>{" "}
                    {incident.mover_name}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.phoneNumber}:</span>{" "}
                    {incident.phone_number}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.dateOfReport}:</span>{" "}
                    {format(new Date(incident.created_at), "PPP")}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Incident Details */}
              <div>
                <h3 className="font-semibold mb-2">{t.incidentDetails}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t.incidentDate}:</span>{" "}
                    {format(new Date(incident.incident_date), "PPP")}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.incidentTime}:</span>{" "}
                    {incident.incident_time}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.jobId}:</span>{" "}
                    {incident.job_id}
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.clientName}:</span>{" "}
                    {incident.client_name}
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">{t.incidentAddress}:</span>{" "}
                    {incident.incident_address}
                  </div>
                </div>
              </div>

              <Separator />

              {/* What Happened */}
              <div>
                <h3 className="font-semibold mb-2">{t.whatHappened}</h3>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-2">
                    {incident.incident_types.map((type) => (
                      <Badge key={type} variant="outline">
                        {getIncidentTypeLabel(type)}
                      </Badge>
                    ))}
                  </div>
                  <div className="p-3 bg-muted rounded-lg text-sm">
                    {incident.incident_description}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Injuries & Damage */}
              <div>
                <h3 className="font-semibold mb-2">{t.injuriesDamage}</h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t.anyoneInjured}:</span>{" "}
                    <Badge variant={incident.anyone_injured ? "destructive" : "secondary"}>
                      {incident.anyone_injured ? t.yes : t.no}
                    </Badge>
                  </div>
                  {incident.anyone_injured && incident.injury_description && (
                    <div className="p-3 bg-destructive/10 rounded-lg">
                      {incident.injury_description}
                    </div>
                  )}
                  <div>
                    <span className="text-muted-foreground">{t.anyPropertyDamage}:</span>{" "}
                    <Badge variant={incident.property_damaged ? "destructive" : "secondary"}>
                      {incident.property_damaged ? t.yes : t.no}
                    </Badge>
                  </div>
                  {incident.property_damaged && incident.damage_description && (
                    <div className="p-3 bg-destructive/10 rounded-lg">
                      {incident.damage_description}
                    </div>
                  )}
                </div>
              </div>

              <Separator />

              {/* Authorities */}
              <div>
                <h3 className="font-semibold mb-2">{t.authoritiesContacted}</h3>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">{t.policeContacted}:</span>{" "}
                    <Badge variant={incident.police_contacted ? "default" : "secondary"}>
                      {incident.police_contacted ? t.yes : t.no}
                    </Badge>
                  </div>
                  <div>
                    <span className="text-muted-foreground">{t.emergencyServicesCalled}:</span>{" "}
                    <Badge variant={incident.emergency_services_called ? "default" : "secondary"}>
                      {incident.emergency_services_called ? t.yes : t.no}
                    </Badge>
                  </div>
                </div>
              </div>

              {/* Attachments */}
              {attachments.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <h3 className="font-semibold mb-2">{t.evidenceUpload}</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {attachments.map((attachment) => (
                        <a
                          key={attachment.id}
                          href={attachment.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 border rounded hover:bg-muted text-sm truncate"
                        >
                          {attachment.file_name}
                        </a>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Actions Taken */}
              {canEdit ? (
                <>
                  <Separator />
                  <div className="space-y-4">
                    {userRole === "admin" && (
                      <div className="space-y-2">
                        <Label>{t.adminActions}</Label>
                        <Textarea
                          value={adminActions}
                          onChange={(e) => setAdminActions(e.target.value)}
                          placeholder={t.actionsPlaceholder}
                          rows={3}
                        />
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>{t.operationsManagerActions}</Label>
                      <Textarea
                        value={opsActions}
                        onChange={(e) => setOpsActions(e.target.value)}
                        placeholder={t.actionsPlaceholder}
                        rows={3}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={handleSaveActions} disabled={saving}>
                        {saving ? "Saving..." : t.saveActions}
                      </Button>
                      {userRole === "admin" && (
                        <Button
                          variant="outline"
                          onClick={() => setDeductibleDialogOpen(true)}
                        >
                          Apply Deductible
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                (incident.admin_actions || incident.operations_manager_actions) && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      {incident.admin_actions && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                          <Label className="text-blue-700 dark:text-blue-300">{t.adminActions}</Label>
                          <p className="text-sm mt-1">{incident.admin_actions}</p>
                        </div>
                      )}
                      {incident.operations_manager_actions && (
                        <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                          <Label className="text-green-700 dark:text-green-300">{t.operationsManagerActions}</Label>
                          <p className="text-sm mt-1">{incident.operations_manager_actions}</p>
                        </div>
                      )}
                    </div>
                  </>
                )
              )}
            </div>
          </ScrollArea>

          <div className="flex justify-end mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <ApplyDeductibleDialog
        open={deductibleDialogOpen}
        onOpenChange={setDeductibleDialogOpen}
        reportId={incident.id}
        reportTitle={`Violence Incident: ${incident.job_id}`}
        onSuccess={onUpdate}
      />
    </>
  );
};

export default ViolenceIncidentDetails;

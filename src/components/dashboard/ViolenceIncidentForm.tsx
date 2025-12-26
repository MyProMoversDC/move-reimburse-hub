import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { handleError } from "@/lib/errorHandler";
import { violenceIncidentTranslations, ViolenceIncidentLanguage } from "@/lib/violenceIncidentTranslations";
import { Upload, X } from "lucide-react";

interface ViolenceIncidentFormProps {
  userId: string;
  onSuccess?: () => void;
  language: ViolenceIncidentLanguage;
}

type IncidentType = "verbal_threat" | "physical_contact" | "property_damage" | "harassment" | "weapon_seen" | "other";
type SeverityLevel = "low" | "medium" | "high" | "critical";

interface FormData {
  phoneNumber: string;
  incidentDate: string;
  incidentTime: string;
  jobId: string;
  incidentAddress: string;
  clientName: string;
  incidentDescription: string;
  injuryDescription?: string;
  damageDescription?: string;
}

const ViolenceIncidentForm = ({ userId, onSuccess, language }: ViolenceIncidentFormProps) => {
  const [loading, setLoading] = useState(false);
  const [moverName, setMoverName] = useState("");
  const [moverPhone, setMoverPhone] = useState("");
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [anyoneInjured, setAnyoneInjured] = useState<boolean>(false);
  const [propertyDamaged, setPropertyDamaged] = useState<boolean>(false);
  const [policeContacted, setPoliceContacted] = useState<boolean>(false);
  const [emergencyServicesCalled, setEmergencyServicesCalled] = useState<boolean>(false);
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>("medium");
  const [files, setFiles] = useState<File[]>([]);

  const t = violenceIncidentTranslations[language];

  const { register, handleSubmit, formState: { errors }, reset } = useForm<FormData>();

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, phone")
      .eq("id", userId)
      .maybeSingle();

    if (data) {
      setMoverName(`${data.first_name} ${data.last_name}`);
      setMoverPhone(data.phone || "");
    }
  };

  const handleIncidentTypeChange = (type: IncidentType, checked: boolean) => {
    if (checked) {
      setIncidentTypes([...incidentTypes, type]);
    } else {
      setIncidentTypes(incidentTypes.filter((t) => t !== type));
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles([...files, ...Array.from(e.target.files)]);
    }
  };

  const removeFile = (index: number) => {
    setFiles(files.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormData) => {
    if (incidentTypes.length === 0) {
      toast.error("Please select at least one incident type");
      return;
    }

    setLoading(true);
    try {
      // Insert the incident
      const { data: incident, error: incidentError } = await supabase
        .from("violence_incidents")
        .insert({
          mover_id: userId,
          mover_name: moverName,
          phone_number: data.phoneNumber || moverPhone,
          incident_date: data.incidentDate,
          incident_time: data.incidentTime,
          job_id: data.jobId,
          incident_address: data.incidentAddress,
          client_name: data.clientName,
          incident_types: incidentTypes,
          incident_description: data.incidentDescription,
          anyone_injured: anyoneInjured,
          injury_description: anyoneInjured ? data.injuryDescription : null,
          property_damaged: propertyDamaged,
          damage_description: propertyDamaged ? data.damageDescription : null,
          police_contacted: policeContacted,
          emergency_services_called: emergencyServicesCalled,
          severity_level: severityLevel,
        })
        .select()
        .single();

      if (incidentError) throw incidentError;

      // Upload files if any
      if (files.length > 0 && incident) {
        for (const file of files) {
          const fileName = `${incident.id}/${Date.now()}_${file.name}`;
          const { error: uploadError } = await supabase.storage
            .from("violence-incident-attachments")
            .upload(fileName, file);

          if (uploadError) {
            console.error("File upload error:", uploadError);
            continue;
          }

          const { data: urlData } = supabase.storage
            .from("violence-incident-attachments")
            .getPublicUrl(fileName);

          await supabase.from("violence_incident_attachments").insert({
            incident_id: incident.id,
            file_url: urlData.publicUrl,
            file_name: file.name,
          });
        }
      }

      toast.success(t.reportSubmitted);
      reset();
      setIncidentTypes([]);
      setAnyoneInjured(false);
      setPropertyDamaged(false);
      setPoliceContacted(false);
      setEmergencyServicesCalled(false);
      setSeverityLevel("medium");
      setFiles([]);
      onSuccess?.();
    } catch (error) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const incidentTypeOptions: { value: IncidentType; label: string }[] = [
    { value: "verbal_threat", label: t.verbalThreat },
    { value: "physical_contact", label: t.physicalContact },
    { value: "property_damage", label: t.propertyDamage },
    { value: "harassment", label: t.harassment },
    { value: "weapon_seen", label: t.weaponSeen },
    { value: "other", label: t.other },
  ];

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Section 1 - Reporter Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.reporterInfo}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>{t.moverName}</Label>
              <Input value={moverName} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">{t.phoneNumber} *</Label>
              <Input
                id="phoneNumber"
                defaultValue={moverPhone}
                {...register("phoneNumber", { required: true })}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t.dateOfReport}</Label>
            <Input value={format(new Date(), "PPP")} disabled className="bg-muted" />
          </div>
        </CardContent>
      </Card>

      {/* Section 2 - Incident Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.incidentDetails}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="incidentDate">{t.incidentDate} *</Label>
              <Input
                id="incidentDate"
                type="date"
                {...register("incidentDate", { required: true })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="incidentTime">{t.incidentTime} *</Label>
              <Input
                id="incidentTime"
                type="time"
                {...register("incidentTime", { required: true })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobId">{t.jobId} *</Label>
            <Input
              id="jobId"
              {...register("jobId", { required: true })}
              placeholder="e.g., JOB-12345"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="incidentAddress">{t.incidentAddress} *</Label>
            <Input
              id="incidentAddress"
              {...register("incidentAddress", { required: true })}
              placeholder="Full address of incident"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="clientName">{t.clientName} *</Label>
            <Input
              id="clientName"
              {...register("clientName", { required: true })}
              placeholder="Client's full name"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 3 - What Happened */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.whatHappened}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.incidentType} *</Label>
            <div className="grid grid-cols-2 gap-3">
              {incidentTypeOptions.map((option) => (
                <div key={option.value} className="flex items-center space-x-2">
                  <Checkbox
                    id={option.value}
                    checked={incidentTypes.includes(option.value)}
                    onCheckedChange={(checked) =>
                      handleIncidentTypeChange(option.value, checked as boolean)
                    }
                  />
                  <Label htmlFor={option.value} className="text-sm font-normal cursor-pointer">
                    {option.label}
                  </Label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="incidentDescription">{t.incidentDescription} *</Label>
            <Textarea
              id="incidentDescription"
              {...register("incidentDescription", { required: true })}
              rows={4}
              placeholder="Describe what happened in detail..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4 - Injuries & Damage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.injuriesDamage}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.anyoneInjured} *</Label>
            <RadioGroup
              value={anyoneInjured ? "yes" : "no"}
              onValueChange={(value) => setAnyoneInjured(value === "yes")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="injured-yes" />
                <Label htmlFor="injured-yes">{t.yes}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="injured-no" />
                <Label htmlFor="injured-no">{t.no}</Label>
              </div>
            </RadioGroup>
          </div>
          {anyoneInjured && (
            <div className="space-y-2">
              <Label htmlFor="injuryDescription">{t.injuryDescription} *</Label>
              <Textarea
                id="injuryDescription"
                {...register("injuryDescription", { required: anyoneInjured })}
                rows={3}
                placeholder="Describe the injuries..."
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>{t.anyPropertyDamage} *</Label>
            <RadioGroup
              value={propertyDamaged ? "yes" : "no"}
              onValueChange={(value) => setPropertyDamaged(value === "yes")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="damage-yes" />
                <Label htmlFor="damage-yes">{t.yes}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="damage-no" />
                <Label htmlFor="damage-no">{t.no}</Label>
              </div>
            </RadioGroup>
          </div>
          {propertyDamaged && (
            <div className="space-y-2">
              <Label htmlFor="damageDescription">{t.damageDescription} *</Label>
              <Textarea
                id="damageDescription"
                {...register("damageDescription", { required: propertyDamaged })}
                rows={3}
                placeholder="Describe the property damage..."
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5 - Authorities Contacted */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.authoritiesContacted}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t.policeContacted} *</Label>
            <RadioGroup
              value={policeContacted ? "yes" : "no"}
              onValueChange={(value) => setPoliceContacted(value === "yes")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="police-yes" />
                <Label htmlFor="police-yes">{t.yes}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="police-no" />
                <Label htmlFor="police-no">{t.no}</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="space-y-2">
            <Label>{t.emergencyServicesCalled} *</Label>
            <RadioGroup
              value={emergencyServicesCalled ? "yes" : "no"}
              onValueChange={(value) => setEmergencyServicesCalled(value === "yes")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="emergency-yes" />
                <Label htmlFor="emergency-yes">{t.yes}</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="emergency-no" />
                <Label htmlFor="emergency-no">{t.no}</Label>
              </div>
            </RadioGroup>
          </div>
        </CardContent>
      </Card>

      {/* Section 6 - Evidence Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.evidenceUpload}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evidence">
              {t.uploadPhotosVideos} {t.uploadOptional}
            </Label>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <div className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg hover:bg-muted transition-colors">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Choose Files</span>
                </div>
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </label>
            </div>
            {files.length > 0 && (
              <div className="space-y-2 mt-2">
                {files.map((file, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                    <span className="text-sm truncate">{file.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeFile(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Section 7 - Severity */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.severitySection}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t.severityLevel} *</Label>
            <Select value={severityLevel} onValueChange={(value: SeverityLevel) => setSeverityLevel(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">{t.low}</SelectItem>
                <SelectItem value="medium">{t.medium}</SelectItem>
                <SelectItem value="high">{t.high}</SelectItem>
                <SelectItem value="critical">{t.critical}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? t.submitting : t.submit}
      </Button>
    </form>
  );
};

export default ViolenceIncidentForm;

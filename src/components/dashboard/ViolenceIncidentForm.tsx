import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { handleError } from "@/lib/errorHandler";
import { violenceIncidentTranslations, ViolenceIncidentLanguage } from "@/lib/violenceIncidentTranslations";
import { Upload, X, AlertTriangle, Info } from "lucide-react";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { useMapboxToken } from "@/hooks/useMapboxToken";

interface ViolenceIncidentFormProps {
  userId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
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
  damageDescription?: string;
  resolutionRequest: string;
}

const ViolenceIncidentForm = ({ userId, onSuccess, onCancel, language }: ViolenceIncidentFormProps) => {
  const { token: mapboxToken } = useMapboxToken();
  const [loading, setLoading] = useState(false);
  const [moverName, setMoverName] = useState("");
  const [moverPhone, setMoverPhone] = useState("");
  const [incidentTypes, setIncidentTypes] = useState<IncidentType[]>([]);
  const [propertyDamaged, setPropertyDamaged] = useState<boolean>(false);
  const [policeContacted, setPoliceContacted] = useState<boolean>(false);
  const [emergencyServicesCalled, setEmergencyServicesCalled] = useState<boolean>(false);
  const [severityLevel, setSeverityLevel] = useState<SeverityLevel>("medium");
  const [files, setFiles] = useState<File[]>([]);
  const [incidentAddress, setIncidentAddress] = useState("");

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

    if (!incidentAddress?.trim()) {
      toast.error("Please enter the incident address");
      return;
    }

    if (!data.resolutionRequest?.trim()) {
      toast.error("Please describe the resolution you are looking for");
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
          job_id: data.jobId || "",
          incident_address: incidentAddress || data.incidentAddress,
          client_name: data.clientName || "",
          incident_types: incidentTypes,
          incident_description: data.incidentDescription,
          anyone_injured: false,
          injury_description: null,
          property_damaged: propertyDamaged,
          damage_description: propertyDamaged ? data.damageDescription : null,
          police_contacted: policeContacted,
          emergency_services_called: emergencyServicesCalled,
          severity_level: severityLevel,
          admin_actions: `Resolution Request: ${data.resolutionRequest}`,
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

          // Store the file path, not the public URL (bucket is private)
          await supabase.from("violence_incident_attachments").insert({
            incident_id: incident.id,
            file_url: fileName,
            file_name: file.name,
          });
        }
      }

      toast.success(t.reportSubmitted);
      reset();
      setIncidentTypes([]);
      setIncidentAddress("");
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
      {/* Form Description */}
      <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 dark:from-red-500/20 dark:to-orange-500/20 p-4 rounded-lg border-2 border-red-400 dark:border-red-500 shadow-md">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <p className="text-sm font-medium text-red-800 dark:text-red-200">
            Use this form to report any workplace violence or incidents that occurred during your work. This includes verbal threats, physical contact, harassment, property damage, or any other safety concerns. Your report will be reviewed by management.
          </p>
        </div>
      </div>

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
          <div className="space-y-2">
            <Label htmlFor="incidentAddress">{t.incidentAddress} *</Label>
            <AddressAutocomplete
              id="incidentAddress"
              value={incidentAddress}
              onChange={setIncidentAddress}
              placeholder="Full address of incident"
              accessToken={mapboxToken}
            />
          </div>
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="jobId">{t.jobId}</Label>
              <Input
                id="jobId"
                {...register("jobId")}
                placeholder="e.g., EST-12345"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="clientName">{t.clientName}</Label>
              <Input
                id="clientName"
                {...register("clientName")}
                placeholder="Client's full name (optional)"
              />
            </div>
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
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t.descriptionDisclaimer}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="incidentDescription">{t.incidentDescription} *</Label>
            <Textarea
              id="incidentDescription"
              {...register("incidentDescription", { required: true })}
              rows={5}
              placeholder="Describe what happened in detail..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 4 - Property Damage */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.injuriesDamage}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
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
              <div className="relative">
                <input
                  type="file"
                  multiple
                  accept="image/*,video/*"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="flex items-center gap-2 px-4 py-2 border border-dashed rounded-lg hover:bg-muted transition-colors pointer-events-none">
                  <Upload className="h-4 w-4" />
                  <span className="text-sm">Choose Files</span>
                </div>
              </div>
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
            <SearchableSelect
              value={severityLevel}
              onValueChange={(value) => setSeverityLevel(value as SeverityLevel)}
              options={[
                { value: "low", label: t.low },
                { value: "medium", label: t.medium },
                { value: "high", label: t.high },
                { value: "critical", label: t.critical },
              ]}
              placeholder={t.severityLevel}
              searchPlaceholder="Search..."
              emptyMessage="No options"
            />
          </div>
        </CardContent>
      </Card>

      {/* Section 8 - Resolution Request */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">{t.resolutionSection}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 dark:text-amber-200">
              {t.resolutionDisclaimer}
            </AlertDescription>
          </Alert>
          <div className="space-y-2">
            <Label htmlFor="resolutionRequest">{t.resolutionQuestion} *</Label>
            <Textarea
              id="resolutionRequest"
              {...register("resolutionRequest", { required: true })}
              rows={4}
              placeholder={t.resolutionPlaceholder}
            />
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={loading} className="w-full">
        {loading ? t.submitting : t.submit}
      </Button>
      
      {onCancel && (
        <Button 
          type="button" 
          variant="outline" 
          className="w-full md:hidden mt-2" 
          onClick={onCancel}
        >
          {language === 'en' ? 'Cancel' : language === 'es' ? 'Cancelar' : 'Отмена'}
        </Button>
      )}
    </form>
  );
};

export default ViolenceIncidentForm;
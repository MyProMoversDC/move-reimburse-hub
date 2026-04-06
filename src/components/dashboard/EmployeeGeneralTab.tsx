import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Save, X, User, Phone, AlertCircle, CalendarIcon } from "lucide-react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { useMapboxToken } from "@/hooks/useMapboxToken";

interface EmployeeGeneralTabProps {
  userId: string;
  employeeId: string;
  employeeName: string;
}

interface ContactInfo {
  name: string;
  title: string;
  hourlyRate: string;
  email: string;
  phone: string;
  phoneType: string;
  address: string;
  birthDate: string | null;
}

interface EmergencyContact {
  name: string;
  relationship: string;
  address: string;
  phone: string;
  phoneType: string;
}

const translations = {
  en: {
    contactInfo: "Contact Information",
    emergencyContact: "Emergency Contact",
    name: "Name",
    title: "Title",
    hourlyRate: "Hourly Rate",
    email: "Email",
    phone: "Phone Number",
    phoneType: "Type",
    address: "Address",
    relationship: "Relationship",
    mobile: "Mobile",
    work: "Work",
    home: "Home",
    save: "Save Changes",
    cancel: "Cancel",
    saving: "Saving...",
    saveSuccess: "Employee information saved successfully",
    saveError: "Failed to save employee information",
    required: "Required",
    invalidEmail: "Invalid email address",
    invalidPhone: "Invalid phone format",
    unsavedChanges: "You have unsaved changes. Are you sure you want to leave?",
  },
  es: {
    contactInfo: "Información de Contacto",
    emergencyContact: "Contacto de Emergencia",
    name: "Nombre",
    title: "Título",
    hourlyRate: "Tarifa por Hora",
    email: "Correo Electrónico",
    phone: "Número de Teléfono",
    phoneType: "Tipo",
    address: "Dirección",
    relationship: "Relación",
    mobile: "Móvil",
    work: "Trabajo",
    home: "Casa",
    save: "Guardar Cambios",
    cancel: "Cancelar",
    saving: "Guardando...",
    saveSuccess: "Información del empleado guardada exitosamente",
    saveError: "Error al guardar la información del empleado",
    required: "Requerido",
    invalidEmail: "Dirección de correo electrónico inválida",
    invalidPhone: "Formato de teléfono inválido",
    unsavedChanges: "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
  },
  ru: {
    contactInfo: "Контактная Информация",
    emergencyContact: "Экстренный Контакт",
    name: "Имя",
    title: "Должность",
    hourlyRate: "Почасовая Ставка",
    email: "Email",
    phone: "Номер Телефона",
    phoneType: "Тип",
    address: "Адрес",
    relationship: "Родство",
    mobile: "Мобильный",
    work: "Рабочий",
    home: "Домашний",
    save: "Сохранить Изменения",
    cancel: "Отмена",
    saving: "Сохранение...",
    saveSuccess: "Информация о сотруднике успешно сохранена",
    saveError: "Не удалось сохранить информацию о сотруднике",
    required: "Обязательно",
    invalidEmail: "Неверный адрес электронной почты",
    invalidPhone: "Неверный формат телефона",
    unsavedChanges: "У вас есть несохраненные изменения. Вы уверены, что хотите уйти?",
  },
};

const phoneSchema = z.string().regex(/^(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/, "Invalid phone format").or(z.literal(""));
const emailSchema = z.string().email("Invalid email").or(z.literal(""));

const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, "");
  if (cleaned.length <= 3) return cleaned;
  if (cleaned.length <= 6) return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3)}`;
  return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
};

const EmployeeGeneralTab = ({ userId, employeeId, employeeName }: EmployeeGeneralTabProps) => {
  const { language } = useLanguage();
  const t = translations[language];
  const { token: mapboxToken } = useMapboxToken();

  const [contactInfo, setContactInfo] = useState<ContactInfo>({
    name: "",
    title: "",
    hourlyRate: "",
    email: "",
    phone: "",
    phoneType: "mobile",
    address: "",
  });

  const [emergencyContact, setEmergencyContact] = useState<EmergencyContact>({
    name: "",
    relationship: "",
    address: "",
    phone: "",
    phoneType: "mobile",
  });

  const [originalData, setOriginalData] = useState<{ contact: ContactInfo; emergency: EmergencyContact } | null>(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  useEffect(() => {
    if (originalData) {
      const contactChanged = JSON.stringify(contactInfo) !== JSON.stringify(originalData.contact);
      const emergencyChanged = JSON.stringify(emergencyContact) !== JSON.stringify(originalData.emergency);
      setHasChanges(contactChanged || emergencyChanged);
    }
  }, [contactInfo, emergencyContact, originalData]);

  // Unsaved changes warning
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = t.unsavedChanges;
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges, t.unsavedChanges]);

  const fetchEmployeeData = async () => {
    try {
      // Fetch profile data
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, phone_type, address, title, hourly_rate")
        .eq("id", employeeId)
        .single();

      if (profileError) throw profileError;

      const contactData: ContactInfo = {
        name: `${profile.first_name || ""} ${profile.last_name || ""}`.trim(),
        title: profile.title || "",
        hourlyRate: profile.hourly_rate?.toString() || "",
        email: profile.email || "",
        phone: profile.phone || "",
        phoneType: profile.phone_type || "mobile",
        address: profile.address || "",
      };

      setContactInfo(contactData);

      // Fetch emergency contact
      const { data: emergency, error: emergencyError } = await supabase
        .from("emergency_contacts")
        .select("*")
        .eq("user_id", employeeId)
        .maybeSingle();

      const emergencyData: EmergencyContact = emergency
        ? {
            name: emergency.name || "",
            relationship: emergency.relationship || "",
            address: emergency.address || "",
            phone: emergency.phone || "",
            phoneType: emergency.phone_type || "mobile",
          }
        : {
            name: "",
            relationship: "",
            address: "",
            phone: "",
            phoneType: "mobile",
          };

      setEmergencyContact(emergencyData);
      setOriginalData({ contact: { ...contactData }, emergency: { ...emergencyData } });
    } catch (error) {
      console.error("Error fetching employee data:", error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    // Required fields
    if (!contactInfo.name.trim()) newErrors.name = t.required;
    if (!contactInfo.email.trim()) newErrors.email = t.required;

    // Email validation
    if (contactInfo.email) {
      const emailResult = emailSchema.safeParse(contactInfo.email);
      if (!emailResult.success) newErrors.email = t.invalidEmail;
    }

    // Phone validation
    if (contactInfo.phone) {
      const phoneResult = phoneSchema.safeParse(contactInfo.phone.replace(/\D/g, "").length >= 10 ? contactInfo.phone : "");
      if (contactInfo.phone && contactInfo.phone.replace(/\D/g, "").length < 10) {
        newErrors.contactPhone = t.invalidPhone;
      }
    }

    if (emergencyContact.phone && emergencyContact.phone.replace(/\D/g, "").length < 10 && emergencyContact.phone.replace(/\D/g, "").length > 0) {
      newErrors.emergencyPhone = t.invalidPhone;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      // Parse name into first and last
      const nameParts = contactInfo.name.trim().split(" ");
      const firstName = nameParts[0] || "";
      const lastName = nameParts.slice(1).join(" ") || "";

      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          first_name: firstName,
          last_name: lastName,
          email: contactInfo.email,
          phone: contactInfo.phone,
          phone_type: contactInfo.phoneType,
          address: contactInfo.address,
          title: contactInfo.title,
          hourly_rate: contactInfo.hourlyRate ? parseFloat(contactInfo.hourlyRate) : null,
        })
        .eq("id", employeeId);

      if (profileError) throw profileError;

      // Upsert emergency contact
      const { error: emergencyError } = await supabase
        .from("emergency_contacts")
        .upsert({
          user_id: employeeId,
          name: emergencyContact.name || null,
          relationship: emergencyContact.relationship || null,
          address: emergencyContact.address || null,
          phone: emergencyContact.phone || null,
          phone_type: emergencyContact.phoneType,
        }, { onConflict: "user_id" });

      if (emergencyError) throw emergencyError;

      toast.success(t.saveSuccess);
      setOriginalData({ contact: { ...contactInfo }, emergency: { ...emergencyContact } });
      setHasChanges(false);
    } catch (error) {
      console.error("Error saving employee data:", error);
      toast.error(t.saveError);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (originalData) {
      setContactInfo({ ...originalData.contact });
      setEmergencyContact({ ...originalData.emergency });
      setErrors({});
      setHasChanges(false);
    }
  };

  const handleContactPhoneChange = (value: string) => {
    setContactInfo({ ...contactInfo, phone: formatPhoneNumber(value) });
  };

  const handleEmergencyPhoneChange = (value: string) => {
    setEmergencyContact({ ...emergencyContact, phone: formatPhoneNumber(value) });
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Contact Information Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <User className="h-5 w-5" />
            {t.contactInfo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">
                {t.name} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={contactInfo.name}
                onChange={(e) => setContactInfo({ ...contactInfo, name: e.target.value })}
                className={errors.name ? "border-destructive" : ""}
              />
              {errors.name && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.name}
                </p>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="title">{t.title}</Label>
              <Input
                id="title"
                value={contactInfo.title}
                onChange={(e) => setContactInfo({ ...contactInfo, title: e.target.value })}
                placeholder="Job title"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">
                {t.email} <span className="text-destructive">*</span>
              </Label>
              <Input
                id="email"
                type="email"
                value={contactInfo.email}
                onChange={(e) => setContactInfo({ ...contactInfo, email: e.target.value })}
                className={errors.email ? "border-destructive" : ""}
              />
              {errors.email && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.email}
                </p>
              )}
            </div>

            {/* Hourly Rate */}
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">{t.hourlyRate}</Label>
              <Input
                id="hourlyRate"
                type="number"
                step="0.01"
                min="0"
                value={contactInfo.hourlyRate}
                onChange={(e) => setContactInfo({ ...contactInfo, hourlyRate: e.target.value })}
                placeholder="0.00"
              />
            </div>

            {/* Phone Number */}
            <div className="space-y-2">
              <Label htmlFor="contactPhone">{t.phone}</Label>
              <Input
                id="contactPhone"
                value={contactInfo.phone}
                onChange={(e) => handleContactPhoneChange(e.target.value)}
                placeholder="(###) ###-####"
                className={errors.contactPhone ? "border-destructive" : ""}
              />
              {errors.contactPhone && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.contactPhone}
                </p>
              )}
            </div>

            {/* Phone Type */}
            <div className="space-y-2">
              <Label htmlFor="contactPhoneType">{t.phoneType}</Label>
              <Select
                value={contactInfo.phoneType}
                onValueChange={(value) => setContactInfo({ ...contactInfo, phoneType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">{t.mobile}</SelectItem>
                  <SelectItem value="work">{t.work}</SelectItem>
                  <SelectItem value="home">{t.home}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="address">{t.address}</Label>
              <AddressAutocomplete
                id="address"
                value={contactInfo.address}
                onChange={(value) => setContactInfo({ ...contactInfo, address: value })}
                placeholder="Full address"
                accessToken={mapboxToken}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Emergency Contact Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Phone className="h-5 w-5" />
            {t.emergencyContact}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="emergencyName">{t.name}</Label>
              <Input
                id="emergencyName"
                value={emergencyContact.name}
                onChange={(e) => setEmergencyContact({ ...emergencyContact, name: e.target.value })}
              />
            </div>

            {/* Relationship */}
            <div className="space-y-2">
              <Label htmlFor="relationship">{t.relationship}</Label>
              <Input
                id="relationship"
                value={emergencyContact.relationship}
                onChange={(e) => setEmergencyContact({ ...emergencyContact, relationship: e.target.value })}
              />
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label htmlFor="emergencyPhone">{t.phone}</Label>
              <Input
                id="emergencyPhone"
                value={emergencyContact.phone}
                onChange={(e) => handleEmergencyPhoneChange(e.target.value)}
                placeholder="(###) ###-####"
                className={errors.emergencyPhone ? "border-destructive" : ""}
              />
              {errors.emergencyPhone && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.emergencyPhone}
                </p>
              )}
            </div>

            {/* Phone Type */}
            <div className="space-y-2">
              <Label htmlFor="emergencyPhoneType">{t.phoneType}</Label>
              <Select
                value={emergencyContact.phoneType}
                onValueChange={(value) => setEmergencyContact({ ...emergencyContact, phoneType: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile">{t.mobile}</SelectItem>
                  <SelectItem value="work">{t.work}</SelectItem>
                  <SelectItem value="home">{t.home}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Address */}
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="emergencyAddress">{t.address}</Label>
              <AddressAutocomplete
                id="emergencyAddress"
                value={emergencyContact.address}
                onChange={(value) => setEmergencyContact({ ...emergencyContact, address: value })}
                accessToken={mapboxToken}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sticky Save Button */}
      {hasChanges && (
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg z-50">
          <div className="max-w-4xl mx-auto flex justify-end gap-3">
            <Button variant="outline" onClick={handleCancel} disabled={saving}>
              <X className="h-4 w-4 mr-2" />
              {t.cancel}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t.saving : t.save}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeGeneralTab;

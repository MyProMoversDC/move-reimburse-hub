import { useState, useEffect } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Save, X, Briefcase, Car, Settings2, Calendar as CalendarIcon, Upload, Trash2, AlertCircle, AlertTriangle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { getSignedUrl } from "@/lib/storageUtils";

interface EmployeeInfoTabProps {
  userId: string;
  employeeId: string;
  employeeName: string;
}

interface EmploymentInfo {
  role: string;
  employeeNumber: string;
  branch: string;
  employmentType: string;
  hireDate: Date | undefined;
  terminationDate: Date | undefined;
  avatarUrl: string;
}

interface DriversLicense {
  number: string;
  licenseClass: string;
  expires: Date | undefined;
  physicalExpires: Date | undefined;
}

interface CustomAttributes {
  a_team: boolean;
  b_team: boolean;
  c_team: boolean;
  available_for_trip_planning: boolean;
  can_drive: boolean;
  can_pack: boolean;
  can_speak: boolean;
  cdl: boolean;
  military_base: boolean;
  hot_tub_spa: boolean;
  piano: boolean;
  safe: boolean;
  tv_mounting: boolean;
  washer_dryer_hookup: boolean;
  other_mounting: boolean;
  special_project: boolean;
}

const translations = {
  en: {
    employmentInfo: "Employment Information",
    driversLicense: "Driver's License Info",
    customAttributes: "Custom Attributes",
    role: "Role",
    employeeNumber: "Employee Number",
    branch: "Branch",
    employmentType: "Employment Type",
    hireDate: "Hire Date",
    terminationDate: "Termination Date",
    profilePhoto: "Profile Photo",
    licenseNumber: "Driver's License Number",
    licenseClass: "License Class",
    licenseExpires: "Driver License Expires",
    physicalExpires: "Physical Expiration Date",
    save: "Save Changes",
    cancel: "Cancel",
    saving: "Saving...",
    saveSuccess: "Employee information saved successfully",
    saveError: "Failed to save employee information",
    required: "Required",
    selectRole: "Select role",
    selectBranch: "Select branch",
    selectType: "Select type",
    pickDate: "Pick a date",
    fullTime: "Full-Time",
    partTime: "Part-Time",
    contract: "Contract",
    seasonal: "Seasonal",
    notSet: "Not Set",
    uploadPhoto: "Upload Photo",
    removePhoto: "Remove",
    aTeam: "A Team",
    bTeam: "B Team",
    cTeam: "C Team",
    availableForTripPlanning: "Available for Trip Planning",
    canDrive: "Can Drive",
    canPack: "Can Pack",
    canSpeak: "Can Speak",
    cdl: "CDL",
    militaryBase: "Military Base",
    hotTubSpa: "Hot Tub / Spa",
    piano: "Piano",
    safe: "Safe",
    tvMounting: "TV Mounting",
    washerDryerHookup: "Washer / Dryer Hook-up",
    otherMounting: "Other Mounting",
    specialProject: "Special Project",
    unsavedChanges: "You have unsaved changes. Are you sure you want to leave?",
    crewForeman: "Crew Foreman",
    driver: "Driver",
    mover: "Mover",
    manager: "Manager",
    helper: "Helper",
    mainOffice: "Main Office",
    branchA: "Branch A",
    branchB: "Branch B",
    branchC: "Branch C",
    licenseExpiringSoon: "Driver's license expires within 90 days!",
    licenseExpired: "Driver's license has expired!",
    physicalExpiringSoon: "Physical exam expires within 90 days!",
    physicalExpired: "Physical exam has expired!",
    expiresOn: "Expires on",
    expiredOn: "Expired on",
  },
  es: {
    employmentInfo: "Información de Empleo",
    driversLicense: "Información de Licencia de Conducir",
    customAttributes: "Atributos Personalizados",
    role: "Rol",
    employeeNumber: "Número de Empleado",
    branch: "Sucursal",
    employmentType: "Tipo de Empleo",
    hireDate: "Fecha de Contratación",
    terminationDate: "Fecha de Terminación",
    profilePhoto: "Foto de Perfil",
    licenseNumber: "Número de Licencia de Conducir",
    licenseClass: "Clase de Licencia",
    licenseExpires: "Vencimiento de Licencia",
    physicalExpires: "Fecha de Expiración Física",
    save: "Guardar Cambios",
    cancel: "Cancelar",
    saving: "Guardando...",
    saveSuccess: "Información del empleado guardada exitosamente",
    saveError: "Error al guardar la información del empleado",
    required: "Requerido",
    selectRole: "Seleccionar rol",
    selectBranch: "Seleccionar sucursal",
    selectType: "Seleccionar tipo",
    pickDate: "Seleccionar fecha",
    fullTime: "Tiempo Completo",
    partTime: "Medio Tiempo",
    contract: "Contrato",
    seasonal: "Temporal",
    notSet: "No Establecido",
    uploadPhoto: "Subir Foto",
    removePhoto: "Eliminar",
    aTeam: "Equipo A",
    bTeam: "Equipo B",
    cTeam: "Equipo C",
    availableForTripPlanning: "Disponible para Planificación de Viajes",
    canDrive: "Puede Conducir",
    canPack: "Puede Empacar",
    canSpeak: "Puede Hablar",
    cdl: "CDL",
    militaryBase: "Base Militar",
    hotTubSpa: "Jacuzzi / Spa",
    piano: "Piano",
    safe: "Caja Fuerte",
    tvMounting: "Montaje de TV",
    washerDryerHookup: "Instalación de Lavadora/Secadora",
    otherMounting: "Otro Montaje",
    specialProject: "Proyecto Especial",
    unsavedChanges: "Tienes cambios sin guardar. ¿Estás seguro de que quieres salir?",
    crewForeman: "Capataz de Equipo",
    driver: "Conductor",
    mover: "Mudador",
    manager: "Gerente",
    helper: "Ayudante",
    mainOffice: "Oficina Principal",
    branchA: "Sucursal A",
    branchB: "Sucursal B",
    branchC: "Sucursal C",
    licenseExpiringSoon: "¡La licencia de conducir vence en 90 días!",
    licenseExpired: "¡La licencia de conducir ha vencido!",
    physicalExpiringSoon: "¡El examen físico vence en 90 días!",
    physicalExpired: "¡El examen físico ha vencido!",
    expiresOn: "Vence el",
    expiredOn: "Venció el",
  },
  ru: {
    employmentInfo: "Информация о Трудоустройстве",
    driversLicense: "Информация о Водительских Правах",
    customAttributes: "Пользовательские Атрибуты",
    role: "Роль",
    employeeNumber: "Табельный Номер",
    branch: "Филиал",
    employmentType: "Тип Занятости",
    hireDate: "Дата Приема",
    terminationDate: "Дата Увольнения",
    profilePhoto: "Фото Профиля",
    licenseNumber: "Номер Водительского Удостоверения",
    licenseClass: "Класс Прав",
    licenseExpires: "Срок Действия Прав",
    physicalExpires: "Дата Истечения Медосмотра",
    save: "Сохранить Изменения",
    cancel: "Отмена",
    saving: "Сохранение...",
    saveSuccess: "Информация о сотруднике успешно сохранена",
    saveError: "Не удалось сохранить информацию о сотруднике",
    required: "Обязательно",
    selectRole: "Выберите роль",
    selectBranch: "Выберите филиал",
    selectType: "Выберите тип",
    pickDate: "Выберите дату",
    fullTime: "Полная Занятость",
    partTime: "Частичная Занятость",
    contract: "Контракт",
    seasonal: "Сезонная",
    notSet: "Не Установлено",
    uploadPhoto: "Загрузить Фото",
    removePhoto: "Удалить",
    aTeam: "Команда A",
    bTeam: "Команда B",
    cTeam: "Команда C",
    availableForTripPlanning: "Доступен для Планирования Поездок",
    canDrive: "Может Водить",
    canPack: "Может Упаковывать",
    canSpeak: "Может Говорить",
    cdl: "CDL",
    militaryBase: "Военная База",
    hotTubSpa: "Джакузи / Спа",
    piano: "Пианино",
    safe: "Сейф",
    tvMounting: "Монтаж ТВ",
    washerDryerHookup: "Подключение Стиралки/Сушилки",
    otherMounting: "Другой Монтаж",
    specialProject: "Специальный Проект",
    unsavedChanges: "У вас есть несохраненные изменения. Вы уверены, что хотите уйти?",
    crewForeman: "Бригадир",
    driver: "Водитель",
    mover: "Грузчик",
    manager: "Менеджер",
    helper: "Помощник",
    mainOffice: "Главный Офис",
    branchA: "Филиал A",
    branchB: "Филиал B",
    branchC: "Филиал C",
    licenseExpiringSoon: "Водительские права истекают в течение 90 дней!",
    licenseExpired: "Срок действия водительских прав истек!",
    physicalExpiringSoon: "Медосмотр истекает в течение 90 дней!",
    physicalExpired: "Срок действия медосмотра истек!",
    expiresOn: "Истекает",
    expiredOn: "Истек",
  },
};

// Helper functions for expiration checks
const isExpiringWithin90Days = (date: Date | undefined): boolean => {
  if (!date) return false;
  const today = new Date();
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(today.getDate() + 90);
  return date <= ninetyDaysFromNow && date >= today;
};

const isExpired = (date: Date | undefined): boolean => {
  if (!date) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date < today;
};

const defaultAttributes: CustomAttributes = {
  a_team: false,
  b_team: false,
  c_team: false,
  available_for_trip_planning: false,
  can_drive: false,
  can_pack: false,
  can_speak: false,
  cdl: false,
  military_base: false,
  hot_tub_spa: false,
  piano: false,
  safe: false,
  tv_mounting: false,
  washer_dryer_hookup: false,
  other_mounting: false,
  special_project: false,
};

const EmployeeInfoTab = ({ userId, employeeId, employeeName }: EmployeeInfoTabProps) => {
  const { language } = useLanguage();
  const t = translations[language];

  const [employmentInfo, setEmploymentInfo] = useState<EmploymentInfo>({
    role: "",
    employeeNumber: "",
    branch: "",
    employmentType: "not_set",
    hireDate: undefined,
    terminationDate: undefined,
    avatarUrl: "",
  });

  const [driversLicense, setDriversLicense] = useState<DriversLicense>({
    number: "",
    licenseClass: "",
    expires: undefined,
    physicalExpires: undefined,
  });

  const [customAttributes, setCustomAttributes] = useState<CustomAttributes>(defaultAttributes);
  const [originalData, setOriginalData] = useState<{
    employment: EmploymentInfo;
    license: DriversLicense;
    attributes: CustomAttributes;
  } | null>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [avatarDisplayUrl, setAvatarDisplayUrl] = useState<string>("");

  useEffect(() => {
    fetchEmployeeData();
  }, [employeeId]);

  useEffect(() => {
    if (originalData) {
      const employmentChanged = JSON.stringify(employmentInfo) !== JSON.stringify(originalData.employment);
      const licenseChanged = JSON.stringify(driversLicense) !== JSON.stringify(originalData.license);
      const attributesChanged = JSON.stringify(customAttributes) !== JSON.stringify(originalData.attributes);
      setHasChanges(employmentChanged || licenseChanged || attributesChanged);
    }
  }, [employmentInfo, driversLicense, customAttributes, originalData]);

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

  useEffect(() => {
    loadAvatarUrl();
  }, [employmentInfo.avatarUrl]);

  const loadAvatarUrl = async () => {
    if (employmentInfo.avatarUrl) {
      const signedUrl = await getSignedUrl("profile-avatars", employmentInfo.avatarUrl);
      setAvatarDisplayUrl(signedUrl || "");
    } else {
      setAvatarDisplayUrl("");
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("job_role, employee_number, branch, employment_type, hire_date, termination_date, avatar_url, license_number, license_class, license_expires, physical_expires, custom_attributes, first_name, last_name")
        .eq("id", employeeId)
        .single();

      if (error) throw error;

      const employmentData: EmploymentInfo = {
        role: profile.job_role || "",
        employeeNumber: profile.employee_number || "",
        branch: profile.branch || "",
        employmentType: profile.employment_type || "not_set",
        hireDate: profile.hire_date ? new Date(profile.hire_date) : undefined,
        terminationDate: profile.termination_date ? new Date(profile.termination_date) : undefined,
        avatarUrl: profile.avatar_url || "",
      };

      const licenseData: DriversLicense = {
        number: profile.license_number || "",
        licenseClass: profile.license_class || "",
        expires: profile.license_expires ? new Date(profile.license_expires) : undefined,
        physicalExpires: profile.physical_expires ? new Date(profile.physical_expires) : undefined,
      };

      const rawAttributes = profile.custom_attributes as Record<string, boolean> | null;
      const attributesData: CustomAttributes = {
        ...defaultAttributes,
        ...(rawAttributes || {}),
      };

      setEmploymentInfo(employmentData);
      setDriversLicense(licenseData);
      setCustomAttributes(attributesData);
      setOriginalData({
        employment: { ...employmentData },
        license: { ...licenseData },
        attributes: { ...attributesData },
      });
    } catch (error) {
      console.error("Error fetching employee data:", error);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    if (!employmentInfo.role) newErrors.role = t.required;
    if (!employmentInfo.branch) newErrors.branch = t.required;
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateForm()) return;

    setSaving(true);
    try {
      const attributesJson = customAttributes as unknown as Record<string, boolean>;
      
      const { error } = await supabase
        .from("profiles")
        .update({
          job_role: employmentInfo.role,
          employee_number: employmentInfo.employeeNumber || null,
          branch: employmentInfo.branch,
          employment_type: employmentInfo.employmentType,
          hire_date: employmentInfo.hireDate ? format(employmentInfo.hireDate, "yyyy-MM-dd") : null,
          termination_date: employmentInfo.terminationDate ? format(employmentInfo.terminationDate, "yyyy-MM-dd") : null,
          avatar_url: employmentInfo.avatarUrl || null,
          license_number: driversLicense.number || null,
          license_class: driversLicense.licenseClass || null,
          license_expires: driversLicense.expires ? format(driversLicense.expires, "yyyy-MM-dd") : null,
          physical_expires: driversLicense.physicalExpires ? format(driversLicense.physicalExpires, "yyyy-MM-dd") : null,
          custom_attributes: attributesJson,
        })
        .eq("id", employeeId);

      if (error) throw error;

      toast.success(t.saveSuccess);
      setOriginalData({
        employment: { ...employmentInfo },
        license: { ...driversLicense },
        attributes: { ...customAttributes },
      });
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
      setEmploymentInfo({ ...originalData.employment });
      setDriversLicense({ ...originalData.license });
      setCustomAttributes({ ...originalData.attributes });
      setErrors({});
      setHasChanges(false);
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      // Remove old photo if exists
      if (employmentInfo.avatarUrl) {
        await supabase.storage.from("profile-avatars").remove([employmentInfo.avatarUrl]);
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${employeeId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("profile-avatars")
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      setEmploymentInfo({ ...employmentInfo, avatarUrl: fileName });
      toast.success("Photo uploaded successfully");
    } catch (error) {
      console.error("Error uploading photo:", error);
      toast.error("Failed to upload photo");
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!employmentInfo.avatarUrl) return;

    try {
      await supabase.storage.from("profile-avatars").remove([employmentInfo.avatarUrl]);
      setEmploymentInfo({ ...employmentInfo, avatarUrl: "" });
      toast.success("Photo removed");
    } catch (error) {
      console.error("Error removing photo:", error);
    }
  };

  const getInitials = () => {
    const parts = employeeName.split(" ");
    return parts.map(p => p[0]).join("").toUpperCase().slice(0, 2);
  };

  const attributeLabels: { key: keyof CustomAttributes; label: string }[] = [
    { key: "a_team", label: t.aTeam },
    { key: "b_team", label: t.bTeam },
    { key: "c_team", label: t.cTeam },
    { key: "available_for_trip_planning", label: t.availableForTripPlanning },
    { key: "can_drive", label: t.canDrive },
    { key: "can_pack", label: t.canPack },
    { key: "can_speak", label: t.canSpeak },
    { key: "cdl", label: t.cdl },
    { key: "military_base", label: t.militaryBase },
    { key: "hot_tub_spa", label: t.hotTubSpa },
    { key: "piano", label: t.piano },
    { key: "safe", label: t.safe },
    { key: "tv_mounting", label: t.tvMounting },
    { key: "washer_dryer_hookup", label: t.washerDryerHookup },
    { key: "other_mounting", label: t.otherMounting },
    { key: "special_project", label: t.specialProject },
  ];

  // Check for license expiration alerts
  const licenseExpiredAlert = isExpired(driversLicense.expires);
  const licenseExpiringSoonAlert = !licenseExpiredAlert && isExpiringWithin90Days(driversLicense.expires);
  const physicalExpiredAlert = isExpired(driversLicense.physicalExpires);
  const physicalExpiringSoonAlert = !physicalExpiredAlert && isExpiringWithin90Days(driversLicense.physicalExpires);

  return (
    <div className="space-y-6 pb-20">
      {/* License Expiration Alerts */}
      {(licenseExpiredAlert || licenseExpiringSoonAlert) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {licenseExpiredAlert ? t.licenseExpired : t.licenseExpiringSoon}
          </AlertTitle>
          <AlertDescription>
            {licenseExpiredAlert ? t.expiredOn : t.expiresOn}: {driversLicense.expires ? format(driversLicense.expires, "MM/dd/yyyy") : ""}
          </AlertDescription>
        </Alert>
      )}

      {(physicalExpiredAlert || physicalExpiringSoonAlert) && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {physicalExpiredAlert ? t.physicalExpired : t.physicalExpiringSoon}
          </AlertTitle>
          <AlertDescription>
            {physicalExpiredAlert ? t.expiredOn : t.expiresOn}: {driversLicense.physicalExpires ? format(driversLicense.physicalExpires, "MM/dd/yyyy") : ""}
          </AlertDescription>
        </Alert>
      )}

      {/* Employment Information Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Briefcase className="h-5 w-5" />
            {t.employmentInfo}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Role */}
            <div className="space-y-2">
              <Label htmlFor="role">
                {t.role} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={employmentInfo.role}
                onValueChange={(value) => setEmploymentInfo({ ...employmentInfo, role: value })}
              >
                <SelectTrigger className={errors.role ? "border-destructive" : ""}>
                  <SelectValue placeholder={t.selectRole} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="crew_foreman">{t.crewForeman}</SelectItem>
                  <SelectItem value="driver">{t.driver}</SelectItem>
                  <SelectItem value="mover">{t.mover}</SelectItem>
                  <SelectItem value="manager">{t.manager}</SelectItem>
                  <SelectItem value="helper">{t.helper}</SelectItem>
                </SelectContent>
              </Select>
              {errors.role && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.role}
                </p>
              )}
            </div>

            {/* Employee Number */}
            <div className="space-y-2">
              <Label htmlFor="employeeNumber">{t.employeeNumber}</Label>
              <Input
                id="employeeNumber"
                value={employmentInfo.employeeNumber}
                onChange={(e) => setEmploymentInfo({ ...employmentInfo, employeeNumber: e.target.value })}
                placeholder="EMP-001"
              />
            </div>

            {/* Branch */}
            <div className="space-y-2">
              <Label htmlFor="branch">
                {t.branch} <span className="text-destructive">*</span>
              </Label>
              <Select
                value={employmentInfo.branch}
                onValueChange={(value) => setEmploymentInfo({ ...employmentInfo, branch: value })}
              >
                <SelectTrigger className={errors.branch ? "border-destructive" : ""}>
                  <SelectValue placeholder={t.selectBranch} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="main_office">{t.mainOffice}</SelectItem>
                  <SelectItem value="branch_a">{t.branchA}</SelectItem>
                  <SelectItem value="branch_b">{t.branchB}</SelectItem>
                  <SelectItem value="branch_c">{t.branchC}</SelectItem>
                </SelectContent>
              </Select>
              {errors.branch && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.branch}
                </p>
              )}
            </div>

            {/* Employment Type */}
            <div className="space-y-2">
              <Label htmlFor="employmentType">{t.employmentType}</Label>
              <Select
                value={employmentInfo.employmentType}
                onValueChange={(value) => setEmploymentInfo({ ...employmentInfo, employmentType: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t.selectType} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full_time">{t.fullTime}</SelectItem>
                  <SelectItem value="part_time">{t.partTime}</SelectItem>
                  <SelectItem value="contract">{t.contract}</SelectItem>
                  <SelectItem value="seasonal">{t.seasonal}</SelectItem>
                  <SelectItem value="not_set">{t.notSet}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Hire Date */}
            <div className="space-y-2">
              <Label>{t.hireDate}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !employmentInfo.hireDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {employmentInfo.hireDate ? format(employmentInfo.hireDate, "PPP") : t.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={employmentInfo.hireDate}
                    onSelect={(date) => setEmploymentInfo({ ...employmentInfo, hireDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Termination Date */}
            <div className="space-y-2">
              <Label>{t.terminationDate}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !employmentInfo.terminationDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {employmentInfo.terminationDate ? format(employmentInfo.terminationDate, "PPP") : t.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={employmentInfo.terminationDate}
                    onSelect={(date) => setEmploymentInfo({ ...employmentInfo, terminationDate: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Profile Photo */}
            <div className="md:col-span-2 space-y-2">
              <Label>{t.profilePhoto}</Label>
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={avatarDisplayUrl} />
                  <AvatarFallback className="text-lg">{getInitials()}</AvatarFallback>
                </Avatar>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={uploading} asChild>
                    <label className="cursor-pointer">
                      <Upload className="h-4 w-4 mr-2" />
                      {uploading ? "..." : t.uploadPhoto}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </Button>
                  {employmentInfo.avatarUrl && (
                    <Button variant="outline" size="sm" onClick={handleRemovePhoto}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      {t.removePhoto}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Driver's License Info Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Car className="h-5 w-5" />
            {t.driversLicense}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* License Number */}
            <div className="space-y-2">
              <Label htmlFor="licenseNumber">{t.licenseNumber}</Label>
              <Input
                id="licenseNumber"
                value={driversLicense.number}
                onChange={(e) => setDriversLicense({ ...driversLicense, number: e.target.value })}
              />
            </div>

            {/* License Class */}
            <div className="space-y-2">
              <Label htmlFor="licenseClass">{t.licenseClass}</Label>
              <Input
                id="licenseClass"
                value={driversLicense.licenseClass}
                onChange={(e) => setDriversLicense({ ...driversLicense, licenseClass: e.target.value })}
                placeholder="C, B, A"
              />
            </div>

            {/* License Expires */}
            <div className="space-y-2">
              <Label>{t.licenseExpires}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !driversLicense.expires && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {driversLicense.expires ? format(driversLicense.expires, "PPP") : t.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={driversLicense.expires}
                    onSelect={(date) => setDriversLicense({ ...driversLicense, expires: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Physical Expires */}
            <div className="space-y-2">
              <Label>{t.physicalExpires}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !driversLicense.physicalExpires && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {driversLicense.physicalExpires ? format(driversLicense.physicalExpires, "PPP") : t.pickDate}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={driversLicense.physicalExpires}
                    onSelect={(date) => setDriversLicense({ ...driversLicense, physicalExpires: date })}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Custom Attributes Section */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5" />
            {t.customAttributes}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {attributeLabels.map(({ key, label }) => (
              <div key={key} className="flex items-center space-x-2">
                <Checkbox
                  id={key}
                  checked={customAttributes[key]}
                  onCheckedChange={(checked) =>
                    setCustomAttributes({ ...customAttributes, [key]: !!checked })
                  }
                />
                <Label htmlFor={key} className="text-sm font-normal cursor-pointer">
                  {label}
                </Label>
              </div>
            ))}
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

export default EmployeeInfoTab;
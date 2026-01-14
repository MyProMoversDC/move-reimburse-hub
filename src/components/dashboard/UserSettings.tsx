import { useState, useEffect, useRef, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { toast } from "sonner";
import { Settings, Save, Camera, X, Car, Calendar as CalendarIcon, Upload, Trash2 } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { useMapboxToken } from "@/hooks/useMapboxToken";

interface UserSettingsProps {
  userId: string;
  language: DashboardLanguage;
  showBalance?: boolean;
  showHourlyRate?: boolean;
  onClose?: () => void;
}

const translations = {
  en: {
    settings: "Settings",
    accountSettings: "Account Settings",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    phone: "Phone",
    address: "Current Physical Address",
    hourlyRate: "Hourly Rate ($)",
    hourlyRateDescription: "Your hourly rate for bonus calculations",
    saveChanges: "Save Changes",
    saving: "Saving...",
    savedSuccessfully: "Settings saved successfully!",
    currentBalance: "Current Balance",
    profilePicture: "Profile Picture",
    uploadPhoto: "Upload Photo",
    removePhoto: "Remove Photo",
    uploading: "Uploading...",
    photoUpdated: "Profile photo updated!",
    photoRemoved: "Profile photo removed!",
    driversLicenseInfo: "Driver's License Information",
    licenseNumber: "Driver's License Number",
    licenseClass: "License Class",
    dateOfIssue: "Date of Issue",
    licenseExpires: "Driver License Expires",
    selectDate: "Select date",
    licenseImages: "Driver's License Images",
    uploadLicenseImage: "Upload License Image",
    frontSide: "Front Side",
    backSide: "Back Side",
    noImageUploaded: "No image uploaded",
    documents: "Documents",
    medicalCard: "Medical Card",
    uploadMedicalCard: "Upload Medical Card",
    noDocumentUploaded: "No document uploaded",
    medicalCardIssueDate: "Issue Date",
    medicalCardExpirationDate: "Expiration Date",
  },
  es: {
    settings: "Configuración",
    accountSettings: "Configuración de Cuenta",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo Electrónico",
    phone: "Teléfono",
    address: "Dirección Física Actual",
    hourlyRate: "Tarifa por Hora ($)",
    hourlyRateDescription: "Tu tarifa por hora para cálculo de bonificaciones",
    saveChanges: "Guardar Cambios",
    saving: "Guardando...",
    savedSuccessfully: "¡Configuración guardada exitosamente!",
    currentBalance: "Balance Actual",
    profilePicture: "Foto de Perfil",
    uploadPhoto: "Subir Foto",
    removePhoto: "Eliminar Foto",
    uploading: "Subiendo...",
    photoUpdated: "¡Foto de perfil actualizada!",
    photoRemoved: "¡Foto de perfil eliminada!",
    driversLicenseInfo: "Información de Licencia de Conducir",
    licenseNumber: "Número de Licencia de Conducir",
    licenseClass: "Clase de Licencia",
    dateOfIssue: "Fecha de Emisión",
    licenseExpires: "Vencimiento de Licencia",
    selectDate: "Seleccionar fecha",
    licenseImages: "Imágenes de Licencia de Conducir",
    uploadLicenseImage: "Subir Imagen de Licencia",
    frontSide: "Lado Frontal",
    backSide: "Lado Trasero",
    noImageUploaded: "Sin imagen subida",
    documents: "Documentos",
    medicalCard: "Tarjeta Médica",
    uploadMedicalCard: "Subir Tarjeta Médica",
    noDocumentUploaded: "Sin documento subido",
    medicalCardIssueDate: "Fecha de Emisión",
    medicalCardExpirationDate: "Fecha de Vencimiento",
  },
  ru: {
    settings: "Настройки",
    accountSettings: "Настройки Аккаунта",
    firstName: "Имя",
    lastName: "Фамилия",
    email: "Электронная Почта",
    phone: "Телефон",
    address: "Текущий Физический Адрес",
    hourlyRate: "Почасовая Ставка ($)",
    hourlyRateDescription: "Ваша почасовая ставка для расчета бонусов",
    saveChanges: "Сохранить Изменения",
    saving: "Сохранение...",
    savedSuccessfully: "Настройки успешно сохранены!",
    currentBalance: "Текущий Баланс",
    profilePicture: "Фото Профиля",
    uploadPhoto: "Загрузить Фото",
    removePhoto: "Удалить Фото",
    uploading: "Загрузка...",
    photoUpdated: "Фото профиля обновлено!",
    photoRemoved: "Фото профиля удалено!",
    driversLicenseInfo: "Информация о Водительских Правах",
    licenseNumber: "Номер Водительского Удостоверения",
    licenseClass: "Класс Прав",
    dateOfIssue: "Дата Выдачи",
    licenseExpires: "Срок Действия Прав",
    selectDate: "Выберите дату",
    licenseImages: "Изображения Водительского Удостоверения",
    uploadLicenseImage: "Загрузить Изображение Удостоверения",
    frontSide: "Лицевая Сторона",
    backSide: "Обратная Сторона",
    noImageUploaded: "Изображение не загружено",
    documents: "Документы",
    medicalCard: "Медицинская Карта",
    uploadMedicalCard: "Загрузить Медицинскую Карту",
    noDocumentUploaded: "Документ не загружен",
    medicalCardIssueDate: "Дата Выдачи",
    medicalCardExpirationDate: "Дата Истечения",
  },
};
interface DriversLicense {
  number: string;
  licenseClass: string;
  dateOfIssue: Date | undefined;
  expires: Date | undefined;
}

const UserSettings = forwardRef<HTMLButtonElement, UserSettingsProps>(
  ({ userId, language, showBalance = false, showHourlyRate = false, onClose }, ref) => {
  const { token: mapboxToken } = useMapboxToken();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [isDriver, setIsDriver] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    hourly_rate: 0,
    avatar_url: "",
  });
  const [driversLicense, setDriversLicense] = useState<DriversLicense>({
    number: "",
    licenseClass: "",
    dateOfIssue: undefined,
    expires: undefined,
  });
  const [medicalCardIssueDate, setMedicalCardIssueDate] = useState<Date | undefined>(undefined);
  const [medicalCardExpirationDate, setMedicalCardExpirationDate] = useState<Date | undefined>(undefined);
  const [licenseImages, setLicenseImages] = useState<{ front: string; back: string }>({ front: "", back: "" });
  const [uploadingLicense, setUploadingLicense] = useState<"front" | "back" | null>(null);
  const [medicalCardUrl, setMedicalCardUrl] = useState<string>("");
  const [uploadingMedicalCard, setUploadingMedicalCard] = useState(false);
  const [balance, setBalance] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const licenseFrontInputRef = useRef<HTMLInputElement>(null);
  const licenseBackInputRef = useRef<HTMLInputElement>(null);
  const medicalCardInputRef = useRef<HTMLInputElement>(null);
  const [dateOfIssueOpen, setDateOfIssueOpen] = useState(false);
  const [licenseExpiresOpen, setLicenseExpiresOpen] = useState(false);
  const [medicalCardIssueDateOpen, setMedicalCardIssueDateOpen] = useState(false);
  const [medicalCardExpirationDateOpen, setMedicalCardExpirationDateOpen] = useState(false);

  const t = translations[language];

  useEffect(() => {
    if (open) {
      fetchProfile();
      if (showBalance) {
        fetchBalance();
      }
      if (showHourlyRate) {
        fetchDriverStatus();
      }
    }
  }, [open, userId]);

  const fetchDriverStatus = async () => {
    try {
      const { data } = await supabase
        .from("user_driver_status")
        .select("is_driver, license_url, medical_card_url, medical_card_issue_date, medical_card_expiration_date")
        .eq("user_id", userId)
        .maybeSingle();
      
      setIsDriver(data?.is_driver === true);
      setMedicalCardUrl(data?.medical_card_url || "");
      setMedicalCardIssueDate(data?.medical_card_issue_date ? new Date(data.medical_card_issue_date) : undefined);
      setMedicalCardExpirationDate(data?.medical_card_expiration_date ? new Date(data.medical_card_expiration_date) : undefined);
      
      // Parse license images if they exist (stored as JSON string)
      if (data?.license_url) {
        try {
          const images = JSON.parse(data.license_url);
          setLicenseImages({ front: images.front || "", back: images.back || "" });
        } catch {
          // If it's not JSON, it might be a single URL (legacy)
          setLicenseImages({ front: data.license_url, back: "" });
        }
      }
    } catch (error) {
      console.error("Error fetching driver status:", error);
    }
  };

  const handleLicenseImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, side: "front" | "back") => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setUploadingLicense(side);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/license_${side}.${fileExt}`;

      // Remove old image if exists
      const oldUrl = side === "front" ? licenseImages.front : licenseImages.back;
      if (oldUrl) {
        const oldPath = oldUrl.split('/driver-licenses/').pop();
        if (oldPath) {
          await supabase.storage.from('driver-licenses').remove([oldPath]);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('driver-licenses')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('driver-licenses')
        .getPublicUrl(fileName);

      // Update local state
      const newImages = { ...licenseImages, [side]: publicUrl };
      setLicenseImages(newImages);

      // Update user_driver_status with both images as JSON
      await supabase
        .from("user_driver_status")
        .update({
          license_url: JSON.stringify(newImages),
          license_uploaded_at: new Date().toISOString(),
        })
        .eq("user_id", userId);

      toast.success(language === 'ru' ? 'Изображение загружено!' : language === 'es' ? '¡Imagen subida!' : 'Image uploaded!');
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setUploadingLicense(null);
      if (side === "front" && licenseFrontInputRef.current) {
        licenseFrontInputRef.current.value = '';
      }
      if (side === "back" && licenseBackInputRef.current) {
        licenseBackInputRef.current.value = '';
      }
    }
  };

  const handleRemoveLicenseImage = async (side: "front" | "back") => {
    const imageUrl = side === "front" ? licenseImages.front : licenseImages.back;
    if (!imageUrl) return;

    try {
      const filePath = imageUrl.split('/driver-licenses/').pop();
      if (filePath) {
        await supabase.storage.from('driver-licenses').remove([filePath]);
      }

      const newImages = { ...licenseImages, [side]: "" };
      setLicenseImages(newImages);

      // Update user_driver_status
      const hasAnyImage = newImages.front || newImages.back;
      await supabase
        .from("user_driver_status")
        .update({
          license_url: hasAnyImage ? JSON.stringify(newImages) : null,
        })
        .eq("user_id", userId);

      toast.success(language === 'ru' ? 'Изображение удалено!' : language === 'es' ? '¡Imagen eliminada!' : 'Image removed!');
    } catch (error: unknown) {
      toast.error(handleError(error));
    }
  };

  const handleMedicalCardUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be less than 10MB");
      return;
    }

    setUploadingMedicalCard(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/medical_card.${fileExt}`;

      // Remove old image if exists
      if (medicalCardUrl) {
        const oldPath = medicalCardUrl.split('/medical-cards/').pop();
        if (oldPath) {
          await supabase.storage.from('medical-cards').remove([oldPath]);
        }
      }

      // Upload new image
      const { error: uploadError } = await supabase.storage
        .from('medical-cards')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('medical-cards')
        .getPublicUrl(fileName);

      setMedicalCardUrl(publicUrl);

      // Ensure user_driver_status record exists and update
      const { data: existingStatus } = await supabase
        .from("user_driver_status")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (existingStatus) {
        await supabase
          .from("user_driver_status")
          .update({ medical_card_url: publicUrl })
          .eq("user_id", userId);
      } else {
        await supabase
          .from("user_driver_status")
          .insert({ user_id: userId, medical_card_url: publicUrl, driver_prompt_answered: false });
      }

      toast.success(language === 'ru' ? 'Медицинская карта загружена!' : language === 'es' ? '¡Tarjeta médica subida!' : 'Medical card uploaded!');
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setUploadingMedicalCard(false);
      if (medicalCardInputRef.current) {
        medicalCardInputRef.current.value = '';
      }
    }
  };

  const handleRemoveMedicalCard = async () => {
    if (!medicalCardUrl) return;

    try {
      const filePath = medicalCardUrl.split('/medical-cards/').pop();
      if (filePath) {
        await supabase.storage.from('medical-cards').remove([filePath]);
      }

      setMedicalCardUrl("");

      await supabase
        .from("user_driver_status")
        .update({ medical_card_url: null })
        .eq("user_id", userId);

      toast.success(language === 'ru' ? 'Медицинская карта удалена!' : language === 'es' ? '¡Tarjeta médica eliminada!' : 'Medical card removed!');
    } catch (error: unknown) {
      toast.error(handleError(error));
    }
  };

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, address, hourly_rate, avatar_url, license_number, license_class, license_expires, physical_expires")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          address: data.address || "",
          hourly_rate: data.hourly_rate || 0,
          avatar_url: data.avatar_url || "",
        });
        setDriversLicense({
          number: data.license_number || "",
          licenseClass: data.license_class || "",
          dateOfIssue: data.physical_expires ? new Date(data.physical_expires) : undefined,
          expires: data.license_expires ? new Date(data.license_expires) : undefined,
        });
      }
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setLoading(false);
    }
  };

  const fetchBalance = async () => {
    try {
      const { data } = await supabase
        .from("mover_balances")
        .select("balance")
        .eq("mover_id", userId)
        .maybeSingle();

      if (data) {
        setBalance(data.balance);
      }
    } catch (error: unknown) {
      console.error("Error fetching balance:", error);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/avatar.${fileExt}`;

      // Delete old avatar if exists
      if (profile.avatar_url) {
        const oldPath = profile.avatar_url.split('/').slice(-2).join('/');
        await supabase.storage.from('profile-avatars').remove([oldPath]);
      }

      // Upload new avatar
      const { error: uploadError } = await supabase.storage
        .from('profile-avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-avatars')
        .getPublicUrl(fileName);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      setProfile({ ...profile, avatar_url: publicUrl });
      toast.success(t.photoUpdated);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleRemovePhoto = async () => {
    if (!profile.avatar_url) return;

    setUploading(true);
    try {
      // Extract file path from URL
      const urlParts = profile.avatar_url.split('/profile-avatars/');
      if (urlParts.length > 1) {
        const filePath = urlParts[1];
        await supabase.storage.from('profile-avatars').remove([filePath]);
      }

      // Update profile to remove avatar URL
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: null })
        .eq('id', userId);

      if (error) throw error;

      setProfile({ ...profile, avatar_url: "" });
      toast.success(t.photoRemoved);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData: Record<string, unknown> = {
        first_name: profile.first_name,
        last_name: profile.last_name,
        phone: profile.phone,
        address: profile.address,
      };

      if (showHourlyRate) {
        updateData.hourly_rate = profile.hourly_rate;
      }

      // Include driver's license info if user is a driver
      if (isDriver && showHourlyRate) {
        updateData.license_number = driversLicense.number || null;
        updateData.license_class = driversLicense.licenseClass || null;
        updateData.physical_expires = driversLicense.dateOfIssue ? format(driversLicense.dateOfIssue, "yyyy-MM-dd") : null;
        updateData.license_expires = driversLicense.expires ? format(driversLicense.expires, "yyyy-MM-dd") : null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      // Save medical card dates to user_driver_status if they have values
      if (showHourlyRate && (medicalCardIssueDate || medicalCardExpirationDate)) {
        const { data: existingStatus } = await supabase
          .from("user_driver_status")
          .select("id")
          .eq("user_id", userId)
          .maybeSingle();

        const medicalCardUpdate = {
          medical_card_issue_date: medicalCardIssueDate ? format(medicalCardIssueDate, "yyyy-MM-dd") : null,
          medical_card_expiration_date: medicalCardExpirationDate ? format(medicalCardExpirationDate, "yyyy-MM-dd") : null,
        };

        if (existingStatus) {
          await supabase
            .from("user_driver_status")
            .update(medicalCardUpdate)
            .eq("user_id", userId);
        } else {
          await supabase
            .from("user_driver_status")
            .insert({ 
              user_id: userId, 
              driver_prompt_answered: false,
              ...medicalCardUpdate 
            });
        }
      }

      toast.success(t.savedSuccessfully);
      setOpen(false);
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setSaving(false);
    }
  };

  const getInitials = () => {
    const first = profile.first_name?.[0] || '';
    const last = profile.last_name?.[0] || '';
    return (first + last).toUpperCase() || '?';
  };

  const handleOpenChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen && onClose) {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" ref={ref}>
          <Settings className="h-4 w-4 mr-2" />
          {t.settings}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t.accountSettings}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Profile Picture */}
            <div className="flex flex-col items-center gap-4">
              <Label>{t.profilePicture}</Label>
              <div className="relative">
                <Avatar className="h-24 w-24">
                  <AvatarImage src={profile.avatar_url} alt="Profile" />
                  <AvatarFallback className="text-2xl">{getInitials()}</AvatarFallback>
                </Avatar>
                {profile.avatar_url && (
                  <Button
                    variant="destructive"
                    size="icon"
                    className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex gap-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  {uploading ? t.uploading : t.uploadPhoto}
                </Button>
              </div>
            </div>

            {/* Balance Display - Only for movers */}
            {showBalance && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{t.currentBalance}</span>
                    <span className={`text-xl font-bold ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${balance.toFixed(2)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="first_name">{t.firstName}</Label>
                <Input
                  id="first_name"
                  value={profile.first_name}
                  onChange={(e) =>
                    setProfile({ ...profile, first_name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="last_name">{t.lastName}</Label>
                <Input
                  id="last_name"
                  value={profile.last_name}
                  onChange={(e) =>
                    setProfile({ ...profile, last_name: e.target.value })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">{t.email}</Label>
              <Input id="email" value={profile.email} disabled className="bg-muted" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t.phone}</Label>
              <Input
                id="phone"
                value={profile.phone}
                onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
              />
            </div>

            {showHourlyRate && (
              <div className="space-y-2">
                <Label htmlFor="address">{t.address}</Label>
                <AddressAutocomplete
                  id="address"
                  value={profile.address}
                  onChange={(value) => setProfile({ ...profile, address: value })}
                  placeholder="Enter your current physical address"
                  accessToken={mapboxToken}
                />
              </div>
            )}

            {showHourlyRate && (
              <div className="space-y-2">
                <Label htmlFor="hourly_rate">{t.hourlyRate}</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={profile.hourly_rate}
                  onChange={(e) =>
                    setProfile({ ...profile, hourly_rate: parseFloat(e.target.value) || 0 })
                  }
                />
                <p className="text-sm text-muted-foreground">{t.hourlyRateDescription}</p>
              </div>
            )}

            {/* Driver's License Section - Only shown for drivers */}
            {showHourlyRate && isDriver && (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Car className="h-4 w-4" />
                    {t.driversLicenseInfo}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="license_number">{t.licenseNumber}</Label>
                    <Input
                      id="license_number"
                      value={driversLicense.number}
                      onChange={(e) => setDriversLicense({ ...driversLicense, number: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="license_class">{t.licenseClass}</Label>
                    <Input
                      id="license_class"
                      value={driversLicense.licenseClass}
                      onChange={(e) => setDriversLicense({ ...driversLicense, licenseClass: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>{t.dateOfIssue}</Label>
                    <Popover open={dateOfIssueOpen} onOpenChange={setDateOfIssueOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !driversLicense.dateOfIssue && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {driversLicense.dateOfIssue ? format(driversLicense.dateOfIssue, "PPP") : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={driversLicense.dateOfIssue}
                          onSelect={(date) => {
                            setDriversLicense({ ...driversLicense, dateOfIssue: date });
                            setDateOfIssueOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-2">
                    <Label>{t.licenseExpires}</Label>
                    <Popover open={licenseExpiresOpen} onOpenChange={setLicenseExpiresOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !driversLicense.expires && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {driversLicense.expires ? format(driversLicense.expires, "PPP") : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={driversLicense.expires}
                          onSelect={(date) => {
                            setDriversLicense({ ...driversLicense, expires: date });
                            setLicenseExpiresOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>


                  {/* License Images Upload Section */}
                  <div className="space-y-3 pt-4 border-t">
                    <Label className="text-sm font-medium">{t.licenseImages}</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Front Side */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t.frontSide}</Label>
                        {licenseImages.front ? (
                          <div className="relative group">
                            <img 
                              src={licenseImages.front} 
                              alt="License Front" 
                              className="w-full h-24 object-cover rounded-md border"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveLicenseImage("front")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                            <span className="text-xs text-muted-foreground">{t.noImageUploaded}</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={licenseFrontInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLicenseImageUpload(e, "front")}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => licenseFrontInputRef.current?.click()}
                          disabled={uploadingLicense === "front"}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {uploadingLicense === "front" ? "..." : t.uploadLicenseImage}
                        </Button>
                      </div>

                      {/* Back Side */}
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">{t.backSide}</Label>
                        {licenseImages.back ? (
                          <div className="relative group">
                            <img 
                              src={licenseImages.back} 
                              alt="License Back" 
                              className="w-full h-24 object-cover rounded-md border"
                            />
                            <Button
                              variant="destructive"
                              size="icon"
                              className="absolute top-1 right-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => handleRemoveLicenseImage("back")}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        ) : (
                          <div className="w-full h-24 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                            <span className="text-xs text-muted-foreground">{t.noImageUploaded}</span>
                          </div>
                        )}
                        <input
                          type="file"
                          ref={licenseBackInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => handleLicenseImageUpload(e, "back")}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full"
                          onClick={() => licenseBackInputRef.current?.click()}
                          disabled={uploadingLicense === "back"}
                        >
                          <Upload className="h-3 w-3 mr-1" />
                          {uploadingLicense === "back" ? "..." : t.uploadLicenseImage}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents Section - Always shown for movers */}
            {showHourlyRate && (
              <Card className="border-primary/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    {t.documents}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Medical Card */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">{t.medicalCard}</Label>
                    {medicalCardUrl ? (
                      <div className="relative group">
                        <img 
                          src={medicalCardUrl} 
                          alt="Medical Card" 
                          className="w-full h-32 object-cover rounded-md border"
                        />
                        <Button
                          variant="destructive"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={handleRemoveMedicalCard}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ) : (
                      <div className="w-full h-32 border-2 border-dashed rounded-md flex items-center justify-center bg-muted/50">
                        <span className="text-sm text-muted-foreground">{t.noDocumentUploaded}</span>
                      </div>
                    )}
                    <input
                      type="file"
                      ref={medicalCardInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleMedicalCardUpload}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full"
                      onClick={() => medicalCardInputRef.current?.click()}
                      disabled={uploadingMedicalCard}
                    >
                      <Upload className="h-3 w-3 mr-2" />
                      {uploadingMedicalCard ? t.uploading : t.uploadMedicalCard}
                    </Button>
                  </div>

                  {/* Medical Card Issue Date */}
                  <div className="space-y-2">
                    <Label>{t.medicalCardIssueDate}</Label>
                    <Popover open={medicalCardIssueDateOpen} onOpenChange={setMedicalCardIssueDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !medicalCardIssueDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {medicalCardIssueDate ? format(medicalCardIssueDate, "PPP") : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={medicalCardIssueDate}
                          onSelect={(date) => {
                            setMedicalCardIssueDate(date);
                            setMedicalCardIssueDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Medical Card Expiration Date */}
                  <div className="space-y-2">
                    <Label>{t.medicalCardExpirationDate}</Label>
                    <Popover open={medicalCardExpirationDateOpen} onOpenChange={setMedicalCardExpirationDateOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            "w-full justify-start text-left font-normal",
                            !medicalCardExpirationDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {medicalCardExpirationDate ? format(medicalCardExpirationDate, "PPP") : t.selectDate}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={medicalCardExpirationDate}
                          onSelect={(date) => {
                            setMedicalCardExpirationDate(date);
                            setMedicalCardExpirationDateOpen(false);
                          }}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? t.saving : t.saveChanges}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
});

UserSettings.displayName = "UserSettings";

export default UserSettings;
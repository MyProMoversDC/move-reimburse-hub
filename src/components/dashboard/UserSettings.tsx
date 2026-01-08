import { useState, useEffect, useRef, forwardRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings, Save, Camera, X } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

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
  },
};

const UserSettings = forwardRef<HTMLButtonElement, UserSettingsProps>(
  ({ userId, language, showBalance = false, showHourlyRate = false, onClose }, ref) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    address: "",
    hourly_rate: 0,
    avatar_url: "",
  });
  const [balance, setBalance] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const t = translations[language];

  useEffect(() => {
    if (open) {
      fetchProfile();
      if (showBalance) {
        fetchBalance();
      }
    }
  }, [open, userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, address, hourly_rate, avatar_url")
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

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;
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
                <Input
                  id="address"
                  value={profile.address}
                  onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                  placeholder="Enter your current physical address"
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
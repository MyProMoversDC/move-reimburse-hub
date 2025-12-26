import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Settings, Save, DollarSign } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface MoverSettingsProps {
  userId: string;
  language: DashboardLanguage;
}

const translations = {
  en: {
    settings: "Settings",
    accountSettings: "Account Settings",
    firstName: "First Name",
    lastName: "Last Name",
    email: "Email",
    phone: "Phone",
    hourlyRate: "Hourly Rate ($)",
    hourlyRateDescription: "Your hourly rate for bonus calculations",
    saveChanges: "Save Changes",
    saving: "Saving...",
    savedSuccessfully: "Settings saved successfully!",
    currentBalance: "Current Balance",
  },
  es: {
    settings: "Configuración",
    accountSettings: "Configuración de Cuenta",
    firstName: "Nombre",
    lastName: "Apellido",
    email: "Correo Electrónico",
    phone: "Teléfono",
    hourlyRate: "Tarifa por Hora ($)",
    hourlyRateDescription: "Tu tarifa por hora para cálculo de bonificaciones",
    saveChanges: "Guardar Cambios",
    saving: "Guardando...",
    savedSuccessfully: "¡Configuración guardada exitosamente!",
    currentBalance: "Balance Actual",
  },
  ru: {
    settings: "Настройки",
    accountSettings: "Настройки Аккаунта",
    firstName: "Имя",
    lastName: "Фамилия",
    email: "Электронная Почта",
    phone: "Телефон",
    hourlyRate: "Почасовая Ставка ($)",
    hourlyRateDescription: "Ваша почасовая ставка для расчета бонусов",
    saveChanges: "Сохранить Изменения",
    saving: "Сохранение...",
    savedSuccessfully: "Настройки успешно сохранены!",
    currentBalance: "Текущий Баланс",
  },
};

const MoverSettings = ({ userId, language }: MoverSettingsProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    hourly_rate: 0,
  });
  const [balance, setBalance] = useState<number>(0);

  const t = translations[language];

  useEffect(() => {
    if (open) {
      fetchProfile();
      fetchBalance();
    }
  }, [open, userId]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("first_name, last_name, email, phone, hourly_rate")
        .eq("id", userId)
        .single();

      if (error) throw error;
      if (data) {
        setProfile({
          first_name: data.first_name || "",
          last_name: data.last_name || "",
          email: data.email || "",
          phone: data.phone || "",
          hourly_rate: data.hourly_rate || 0,
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

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: profile.first_name,
          last_name: profile.last_name,
          phone: profile.phone,
          hourly_rate: profile.hourly_rate,
        })
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="h-4 w-4 mr-2" />
          {t.settings}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.accountSettings}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-6">
            {/* Balance Display */}
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

            <div className="space-y-2">
              <Label htmlFor="hourly_rate" className="flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                {t.hourlyRate}
              </Label>
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

            <Button onClick={handleSave} disabled={saving} className="w-full">
              <Save className="h-4 w-4 mr-2" />
              {saving ? t.saving : t.saveChanges}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default MoverSettings;

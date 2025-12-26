import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Gift, DollarSign } from "lucide-react";
import { handleError } from "@/lib/errorHandler";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface AddBonusDialogProps {
  userId: string;
  language: DashboardLanguage;
  onBonusAdded?: () => void;
}

interface Mover {
  id: string;
  first_name: string;
  last_name: string;
  hourly_rate: number;
}

const translations = {
  en: {
    addBonus: "Add Bonus",
    addBonusTitle: "Add Bonus to Mover",
    selectMover: "Select Mover",
    selectMoverPlaceholder: "Choose a mover...",
    hourlyRate: "Mover's Hourly Rate",
    bonusAmount: "Bonus Amount (1 Hourly Rate)",
    description: "Description (optional)",
    descriptionPlaceholder: "Reason for bonus...",
    confirm: "Add Bonus",
    confirming: "Adding...",
    bonusAdded: "Bonus added successfully!",
    noHourlyRate: "This mover has not set their hourly rate yet",
    currentBalance: "Current Balance",
  },
  es: {
    addBonus: "Agregar Bonificación",
    addBonusTitle: "Agregar Bonificación al Transportista",
    selectMover: "Seleccionar Transportista",
    selectMoverPlaceholder: "Elegir un transportista...",
    hourlyRate: "Tarifa por Hora del Transportista",
    bonusAmount: "Monto de Bonificación (1 Hora)",
    description: "Descripción (opcional)",
    descriptionPlaceholder: "Razón de la bonificación...",
    confirm: "Agregar Bonificación",
    confirming: "Agregando...",
    bonusAdded: "¡Bonificación agregada exitosamente!",
    noHourlyRate: "Este transportista no ha establecido su tarifa por hora",
    currentBalance: "Balance Actual",
  },
  ru: {
    addBonus: "Добавить Бонус",
    addBonusTitle: "Добавить Бонус Перевозчику",
    selectMover: "Выбрать Перевозчика",
    selectMoverPlaceholder: "Выберите перевозчика...",
    hourlyRate: "Почасовая Ставка Перевозчика",
    bonusAmount: "Сумма Бонуса (1 Час)",
    description: "Описание (необязательно)",
    descriptionPlaceholder: "Причина бонуса...",
    confirm: "Добавить Бонус",
    confirming: "Добавление...",
    bonusAdded: "Бонус успешно добавлен!",
    noHourlyRate: "Этот перевозчик еще не установил свою почасовую ставку",
    currentBalance: "Текущий Баланс",
  },
};

const AddBonusDialog = ({ userId, language, onBonusAdded }: AddBonusDialogProps) => {
  const [open, setOpen] = useState(false);
  const [movers, setMovers] = useState<Mover[]>([]);
  const [selectedMoverId, setSelectedMoverId] = useState<string>("");
  const [selectedMover, setSelectedMover] = useState<Mover | null>(null);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentBalance, setCurrentBalance] = useState<number>(0);

  const t = translations[language];

  useEffect(() => {
    if (open) {
      fetchMovers();
    }
  }, [open]);

  useEffect(() => {
    if (selectedMoverId) {
      const mover = movers.find((m) => m.id === selectedMoverId);
      setSelectedMover(mover || null);
      if (mover) {
        fetchMoverBalance(mover.id);
      }
    } else {
      setSelectedMover(null);
      setCurrentBalance(0);
    }
  }, [selectedMoverId, movers]);

  const fetchMovers = async () => {
    try {
      // Get all users with mover role
      const { data: moverRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "mover");

      if (rolesError) throw rolesError;

      const moverIds = moverRoles?.map((r) => r.user_id) || [];

      if (moverIds.length === 0) {
        setMovers([]);
        return;
      }

      // Fetch profiles for all movers
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, hourly_rate")
        .in("id", moverIds)
        .order("first_name");

      if (profilesError) throw profilesError;

      setMovers(profiles || []);
    } catch (error: unknown) {
      toast.error(handleError(error));
    }
  };

  const fetchMoverBalance = async (moverId: string) => {
    try {
      const { data } = await supabase
        .from("mover_balances")
        .select("balance")
        .eq("mover_id", moverId)
        .maybeSingle();

      setCurrentBalance(data?.balance || 0);
    } catch (error: unknown) {
      console.error("Error fetching balance:", error);
    }
  };

  const handleSubmit = async () => {
    if (!selectedMover) return;
    if (!selectedMover.hourly_rate || selectedMover.hourly_rate <= 0) {
      toast.error(t.noHourlyRate);
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase.from("mover_bonus_transactions").insert({
        mover_id: selectedMover.id,
        amount: selectedMover.hourly_rate,
        transaction_type: "bonus",
        description: description || "Customer review bonus",
        created_by: userId,
        reference_type: "review_bonus",
      });

      if (error) throw error;

      toast.success(t.bonusAdded);
      setOpen(false);
      setSelectedMoverId("");
      setDescription("");
      onBonusAdded?.();
    } catch (error: unknown) {
      toast.error(handleError(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Gift className="h-4 w-4 mr-2" />
          {t.addBonus}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t.addBonusTitle}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-2">
            <Label>{t.selectMover}</Label>
            <Select value={selectedMoverId} onValueChange={setSelectedMoverId}>
              <SelectTrigger>
                <SelectValue placeholder={t.selectMoverPlaceholder} />
              </SelectTrigger>
              <SelectContent>
                {movers.map((mover) => (
                  <SelectItem key={mover.id} value={mover.id}>
                    {mover.first_name} {mover.last_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedMover && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4" />
                    {t.hourlyRate}
                  </Label>
                  <Input
                    value={`$${selectedMover.hourly_rate?.toFixed(2) || "0.00"}`}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.currentBalance}</Label>
                  <Input
                    value={`$${currentBalance.toFixed(2)}`}
                    disabled
                    className={`bg-muted ${currentBalance >= 0 ? 'text-green-600' : 'text-red-600'}`}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t.bonusAmount}</Label>
                <Input
                  value={`$${selectedMover.hourly_rate?.toFixed(2) || "0.00"}`}
                  disabled
                  className="bg-primary/5 border-primary/20 font-semibold"
                />
              </div>

              <div className="space-y-2">
                <Label>{t.description}</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t.descriptionPlaceholder}
                  rows={3}
                />
              </div>

              <Button
                onClick={handleSubmit}
                disabled={submitting || !selectedMover.hourly_rate}
                className="w-full"
              >
                <Gift className="h-4 w-4 mr-2" />
                {submitting ? t.confirming : t.confirm}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddBonusDialog;

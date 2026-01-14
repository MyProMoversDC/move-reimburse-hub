import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";
import { useMapboxToken } from "@/hooks/useMapboxToken";

interface AnnualAddressDisclaimerProps {
  userId: string;
  language: 'en' | 'es' | 'ru';
}

const translations = {
  en: {
    title: "Annual Address Verification",
    message: "It's the end of the year! Please confirm your current physical address is still correct, or update it if you've moved.",
    currentAddress: "Current Address",
    confirmSame: "Address is Still Correct",
    updateAddress: "Update Address",
    confirming: "Confirming...",
    noAddress: "No address on file",
    newAddress: "New Address",
  },
  es: {
    title: "Verificación Anual de Dirección",
    message: "¡Es fin de año! Por favor confirme que su dirección física actual sigue siendo correcta, o actualícela si se ha mudado.",
    currentAddress: "Dirección Actual",
    confirmSame: "La Dirección es Correcta",
    updateAddress: "Actualizar Dirección",
    confirming: "Confirmando...",
    noAddress: "Sin dirección registrada",
    newAddress: "Nueva Dirección",
  },
  ru: {
    title: "Ежегодная Проверка Адреса",
    message: "Конец года! Пожалуйста, подтвердите, что ваш текущий физический адрес все еще верен, или обновите его, если вы переехали.",
    currentAddress: "Текущий Адрес",
    confirmSame: "Адрес Верный",
    updateAddress: "Обновить Адрес",
    confirming: "Подтверждение...",
    noAddress: "Адрес не указан",
    newAddress: "Новый Адрес",
  },
};

const AnnualAddressDisclaimer = ({ userId, language }: AnnualAddressDisclaimerProps) => {
  const t = translations[language];
  const { token: mapboxToken } = useMapboxToken();
  
  const [open, setOpen] = useState(false);
  const [currentAddress, setCurrentAddress] = useState<string>("");
  const [newAddress, setNewAddress] = useState<string>("");
  const [showUpdateForm, setShowUpdateForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAnnualConfirmation();
  }, [userId]);

  const checkAnnualConfirmation = async () => {
    const now = new Date();
    const currentYear = now.getFullYear();
    const isDecember31 = now.getMonth() === 11 && now.getDate() === 31;
    
    // Only show on December 31st
    if (!isDecember31) return;

    try {
      // Check if already confirmed this year
      const { data: confirmation } = await supabase
        .from("annual_address_confirmations")
        .select("id")
        .eq("user_id", userId)
        .eq("confirmed_year", currentYear)
        .maybeSingle();

      if (confirmation) return; // Already confirmed

      // Get current address
      const { data: profile } = await supabase
        .from("profiles")
        .select("address")
        .eq("id", userId)
        .maybeSingle();

      setCurrentAddress(profile?.address || "");
      setOpen(true);
    } catch (error) {
      console.error("Error checking annual address confirmation:", error);
    }
  };

  const handleConfirmSame = async () => {
    setSubmitting(true);
    try {
      const currentYear = new Date().getFullYear();
      
      const { error } = await supabase
        .from("annual_address_confirmations")
        .insert({
          user_id: userId,
          confirmed_year: currentYear,
          address_confirmed: currentAddress,
          address_changed: false,
        });

      if (error) throw error;

      toast.success(language === 'en' ? 'Address confirmed!' : 
                    language === 'es' ? '¡Dirección confirmada!' :
                    'Адрес подтвержден!');
      setOpen(false);
    } catch (error) {
      console.error("Error confirming address:", error);
      toast.error("Failed to confirm. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateAddress = async () => {
    if (!newAddress.trim()) {
      toast.error("Please enter a new address");
      return;
    }

    setSubmitting(true);
    try {
      const currentYear = new Date().getFullYear();
      
      // Update profile address
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ address: newAddress })
        .eq("id", userId);

      if (profileError) throw profileError;

      // Record confirmation
      const { error: confirmError } = await supabase
        .from("annual_address_confirmations")
        .insert({
          user_id: userId,
          confirmed_year: currentYear,
          address_confirmed: newAddress,
          address_changed: true,
        });

      if (confirmError) throw confirmError;

      toast.success(language === 'en' ? 'Address updated!' : 
                    language === 'es' ? '¡Dirección actualizada!' :
                    'Адрес обновлен!');
      setOpen(false);
    } catch (error) {
      console.error("Error updating address:", error);
      toast.error("Failed to update. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <AlertDialog open={open} onOpenChange={() => {}}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            {t.title}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {t.message}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground mb-1">{t.currentAddress}</p>
            <p className="p-3 bg-muted rounded-lg">
              {currentAddress || <span className="text-muted-foreground italic">{t.noAddress}</span>}
            </p>
          </div>

          {showUpdateForm && (
            <div>
              <p className="text-sm font-medium text-muted-foreground mb-1">{t.newAddress}</p>
              <AddressAutocomplete
                value={newAddress}
                onChange={setNewAddress}
                placeholder="Enter new address..."
                accessToken={mapboxToken}
              />
            </div>
          )}
        </div>

        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          {!showUpdateForm ? (
            <>
              <Button
                variant="outline"
                onClick={() => setShowUpdateForm(true)}
                disabled={submitting}
              >
                {t.updateAddress}
              </Button>
              <Button
                onClick={handleConfirmSame}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.confirming}
                  </>
                ) : (
                  t.confirmSame
                )}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() => setShowUpdateForm(false)}
                disabled={submitting}
              >
                {language === 'en' ? 'Cancel' : language === 'es' ? 'Cancelar' : 'Отмена'}
              </Button>
              <Button
                onClick={handleUpdateAddress}
                disabled={submitting || !newAddress.trim()}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t.confirming}
                  </>
                ) : (
                  t.updateAddress
                )}
              </Button>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default AnnualAddressDisclaimer;

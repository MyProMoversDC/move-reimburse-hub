import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Car } from "lucide-react";
import { handbookTranslations, HandbookLanguage } from "@/lib/handbookTranslations";

interface DriverPromptProps {
  userId: string;
  language: HandbookLanguage;
  onNavigateToSettings: () => void;
}

const DriverPrompt = ({ userId, language, onNavigateToSettings }: DriverPromptProps) => {
  const t = handbookTranslations[language];
  
  const [open, setOpen] = useState(false);
  const [driverStatus, setDriverStatus] = useState<{
    driver_prompt_answered: boolean;
    is_driver: boolean | null;
    license_url: string | null;
  } | null>(null);

  useEffect(() => {
    checkDriverStatus();
  }, [userId]);

  const checkDriverStatus = async () => {
    try {
      const { data, error } = await supabase
        .from("user_driver_status")
        .select("driver_prompt_answered, is_driver, license_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (error && error.code !== "PGRST116") {
        console.error("Error checking driver status:", error);
        return;
      }

      setDriverStatus(data);

      // Show prompt if:
      // 1. No record exists (first time)
      // 2. Or user said "yes" but hasn't uploaded license
      if (!data) {
        setOpen(true);
      } else if (data.is_driver === true && !data.license_url) {
        setOpen(true);
      }
    } catch (error) {
      console.error("Error checking driver status:", error);
    }
  };

  const handleResponse = async (isDriver: boolean) => {
    try {
      if (driverStatus) {
        // Update existing record
        await supabase
          .from("user_driver_status")
          .update({
            is_driver: isDriver,
            driver_prompt_answered: true,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
      } else {
        // Create new record
        await supabase
          .from("user_driver_status")
          .insert({
            user_id: userId,
            is_driver: isDriver,
            driver_prompt_answered: true,
          });
      }

      setOpen(false);

      if (isDriver) {
        // Navigate to settings to upload license
        onNavigateToSettings();
      }
    } catch (error) {
      console.error("Error saving driver status:", error);
    }
  };

  // Don't show if user already answered "no"
  if (driverStatus?.driver_prompt_answered && driverStatus?.is_driver === false) {
    return null;
  }

  // Don't show if user said "yes" and already uploaded license
  if (driverStatus?.is_driver === true && driverStatus?.license_url) {
    return null;
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Car className="h-5 w-5 text-primary" />
            {t.driverQuestion}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {driverStatus?.is_driver === true && !driverStatus?.license_url
              ? t.uploadDriverLicense
              : t.areYouDriver}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {driverStatus?.is_driver === true && !driverStatus?.license_url ? (
            <AlertDialogAction onClick={() => {
              setOpen(false);
              onNavigateToSettings();
            }}>
              {t.goToSettings}
            </AlertDialogAction>
          ) : (
            <>
              <AlertDialogCancel onClick={() => handleResponse(false)}>
                {t.no}
              </AlertDialogCancel>
              <AlertDialogAction onClick={() => handleResponse(true)}>
                {t.yes}
              </AlertDialogAction>
            </>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DriverPrompt;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Car } from "lucide-react";
import { handbookTranslations, HandbookLanguage } from "@/lib/handbookTranslations";

interface DriverLicenseDisclaimerProps {
  userId: string;
  language: HandbookLanguage;
  onNavigateToSettings: () => void;
  refreshKey?: number;
}

const translations = {
  en: {
    driverLicenseRequired: "Driver's License Required",
    driverLicenseMessage: "You have been assigned as a driver. Please upload your driver's license images in your account settings.",
    goToSettings: "Go to Settings",
  },
  es: {
    driverLicenseRequired: "Se Requiere Licencia de Conducir",
    driverLicenseMessage: "Se le ha asignado como conductor. Por favor, suba las imágenes de su licencia de conducir en la configuración de su cuenta.",
    goToSettings: "Ir a Configuración",
  },
  ru: {
    driverLicenseRequired: "Требуется Водительское Удостоверение",
    driverLicenseMessage: "Вам назначена роль водителя. Пожалуйста, загрузите изображения вашего водительского удостоверения в настройках аккаунта.",
    goToSettings: "Перейти к Настройкам",
  },
};

const DriverLicenseDisclaimer = ({ userId, language, onNavigateToSettings, refreshKey = 0 }: DriverLicenseDisclaimerProps) => {
  const t = translations[language];
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    checkDriverStatus();
  }, [userId, refreshKey]);

  const checkDriverStatus = async () => {
    try {
      // Check if user is assigned as driver in user_driver_status
      const { data: driverStatus, error: driverError } = await supabase
        .from("user_driver_status")
        .select("is_driver, license_url")
        .eq("user_id", userId)
        .maybeSingle();

      if (driverError && driverError.code !== "PGRST116") {
        console.error("Error checking driver status:", driverError);
        return;
      }

      // Show disclaimer if user is a driver but hasn't uploaded license images
      if (driverStatus?.is_driver === true && !driverStatus?.license_url) {
        setShowDisclaimer(true);
      } else {
        setShowDisclaimer(false);
      }
    } catch (error) {
      console.error("Error checking driver status:", error);
    }
  };

  if (!showDisclaimer) {
    return null;
  }

  return (
    <Alert className="mb-4 border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <Car className="h-4 w-4 text-amber-600" />
      <AlertTitle className="text-amber-800 dark:text-amber-200">{t.driverLicenseRequired}</AlertTitle>
      <AlertDescription className="text-amber-700 dark:text-amber-300">
        <p className="mb-3">{t.driverLicenseMessage}</p>
        <Button 
          size="sm" 
          variant="outline" 
          className="border-amber-600 text-amber-700 hover:bg-amber-100"
          onClick={onNavigateToSettings}
        >
          {t.goToSettings}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default DriverLicenseDisclaimer;

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { MapPin, AlertTriangle } from "lucide-react";
import { handbookTranslations, HandbookLanguage } from "@/lib/handbookTranslations";

interface AddressDisclaimerProps {
  userId: string;
  language: HandbookLanguage;
  onNavigateToSettings: () => void;
  refreshKey?: number;
}

const AddressDisclaimer = ({ userId, language, onNavigateToSettings, refreshKey }: AddressDisclaimerProps) => {
  const t = handbookTranslations[language];
  
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  useEffect(() => {
    checkAddress();
  }, [userId, refreshKey]);

  const checkAddress = async () => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("address")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error checking address:", error);
        return;
      }

      // Show disclaimer if address is missing or empty
      setShowDisclaimer(!data?.address || data.address.trim() === "");
    } catch (error) {
      console.error("Error checking address:", error);
    }
  };

  if (!showDisclaimer) return null;

  return (
    <Alert variant="destructive" className="mb-4">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle className="flex items-center gap-2">
        <MapPin className="h-4 w-4" />
        {t.addressRequired}
      </AlertTitle>
      <AlertDescription className="mt-2 space-y-3">
        <p>{t.addressRequiredMessage}</p>
        <Button size="sm" variant="outline" onClick={onNavigateToSettings}>
          {t.goToSettings}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default AddressDisclaimer;

import { forwardRef } from "react";
import UserSettings from "./UserSettings";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface MoverSettingsProps {
  userId: string;
  language: DashboardLanguage;
  onClose?: () => void;
}

const MoverSettings = forwardRef<HTMLButtonElement, MoverSettingsProps>(
  ({ userId, language, onClose }, ref) => {
    return (
      <UserSettings
        userId={userId}
        language={language}
        showBalance={true}
        showHourlyRate={true}
        ref={ref}
        onClose={onClose}
      />
    );
  }
);

MoverSettings.displayName = "MoverSettings";

export default MoverSettings;

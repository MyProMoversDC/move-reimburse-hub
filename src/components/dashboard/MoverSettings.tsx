import { forwardRef } from "react";
import UserSettings from "./UserSettings";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface MoverSettingsProps {
  userId: string;
  language: DashboardLanguage;
}

const MoverSettings = forwardRef<HTMLButtonElement, MoverSettingsProps>(
  ({ userId, language }, ref) => {
    return (
      <UserSettings
        userId={userId}
        language={language}
        showBalance={true}
        showHourlyRate={true}
        ref={ref}
      />
    );
  }
);

MoverSettings.displayName = "MoverSettings";

export default MoverSettings;

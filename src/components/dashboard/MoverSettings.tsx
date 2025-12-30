import UserSettings from "./UserSettings";
import { DashboardLanguage } from "@/lib/dashboardTranslations";

interface MoverSettingsProps {
  userId: string;
  language: DashboardLanguage;
}

const MoverSettings = ({ userId, language }: MoverSettingsProps) => {
  return (
    <UserSettings
      userId={userId}
      language={language}
      showBalance={true}
      showHourlyRate={true}
    />
  );
};

export default MoverSettings;

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import ReimbursementForm from "./ReimbursementForm";
import ReimbursementHistory from "./ReimbursementHistory";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";

interface MoverDashboardProps {
  userId: string;
}

const MoverDashboard = ({ userId }: MoverDashboardProps) => {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  
  const t = dashboardTranslations[language];

  const handleSubmitSuccess = () => {
    setShowForm(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      {!showForm && (
        <Card className="p-6">
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            {t.submitReimbursement}
          </Button>
        </Card>
      )}

      {showForm && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{t.reimbursementForm}</h2>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              {t.close}
            </Button>
          </div>
          <ReimbursementForm userId={userId} onSuccess={handleSubmitSuccess} language={language} />
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">{t.reimbursementHistory}</h2>
        <ReimbursementHistory userId={userId} refreshKey={refreshKey} userRole="mover" language={language} />
      </div>
    </div>
  );
};

export default MoverDashboard;

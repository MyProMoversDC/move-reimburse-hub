import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Star, DollarSign, AlertTriangle } from "lucide-react";
import ReimbursementForm from "./ReimbursementForm";
import ReimbursementHistory from "./ReimbursementHistory";
import ReviewBonusForm from "./ReviewBonusForm";
import ReviewBonusHistory from "./ReviewBonusHistory";
import MissingPaymentForm from "./MissingPaymentForm";
import MissingPaymentHistory from "./MissingPaymentHistory";
import MoverMisconductCases from "./MoverMisconductCases";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { reviewBonusTranslations } from "@/lib/reviewBonusTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";
import { supabase } from "@/integrations/supabase/client";

interface MoverDashboardProps {
  userId: string;
}

const MoverDashboard = ({ userId }: MoverDashboardProps) => {
  const [showReimbursementForm, setShowReimbursementForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showMissingPaymentForm, setShowMissingPaymentForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [missingPaymentRefreshKey, setMissingPaymentRefreshKey] = useState(0);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  const [foremanName, setForemanName] = useState("");
  
  const t = dashboardTranslations[language];
  const rt = reviewBonusTranslations[language];
  const mt = missingPaymentTranslations[language];

  useEffect(() => {
    fetchProfile();
  }, [userId]);

  const fetchProfile = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", userId)
      .maybeSingle();
    
    if (data) {
      setForemanName(`${data.first_name} ${data.last_name}`);
    }
  };

  const handleReimbursementSuccess = () => {
    setShowReimbursementForm(false);
    setRefreshKey((prev) => prev + 1);
  };

  const handleReviewSuccess = () => {
    setShowReviewForm(false);
    setReviewRefreshKey((prev) => prev + 1);
  };

  const handleMissingPaymentSuccess = () => {
    setShowMissingPaymentForm(false);
    setMissingPaymentRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="reimbursements" className="w-full">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="reimbursements">{t.reimbursementHistory}</TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-2" />
            {rt.formTitle}
          </TabsTrigger>
          <TabsTrigger value="missing-payments">
            <DollarSign className="h-4 w-4 mr-2" />
            {mt.formTitle}
          </TabsTrigger>
          <TabsTrigger value="misconduct">
            <AlertTriangle className="h-4 w-4 mr-2" />
            {language === 'ru' ? 'Случаи поведения' : language === 'es' ? 'Casos de Conducta' : 'Misconduct Cases'}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reimbursements" className="space-y-6">
          {!showReimbursementForm && (
            <Card className="p-6">
              <Button onClick={() => setShowReimbursementForm(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {t.submitReimbursement}
              </Button>
            </Card>
          )}

          {showReimbursementForm && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{t.reimbursementForm}</h2>
                <Button variant="outline" onClick={() => setShowReimbursementForm(false)}>
                  {t.close}
                </Button>
              </div>
              <ReimbursementForm userId={userId} onSuccess={handleReimbursementSuccess} language={language} />
            </Card>
          )}

          <div>
            <h2 className="text-2xl font-bold mb-4">{t.reimbursementHistory}</h2>
            <ReimbursementHistory userId={userId} refreshKey={refreshKey} userRole="mover" language={language} />
          </div>
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          {!showReviewForm && (
            <Card className="p-6">
              <Button onClick={() => setShowReviewForm(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {rt.submitReview}
              </Button>
            </Card>
          )}

          {showReviewForm && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{rt.formTitle}</h2>
                <Button variant="outline" onClick={() => setShowReviewForm(false)}>
                  {rt.close}
                </Button>
              </div>
              <ReviewBonusForm 
                userId={userId} 
                foremanName={foremanName}
                onSuccess={handleReviewSuccess} 
                language={language} 
              />
            </Card>
          )}

          <div>
            <h2 className="text-2xl font-bold mb-4">{rt.reviewHistory}</h2>
            <ReviewBonusHistory userId={userId} refreshKey={reviewRefreshKey} language={language} />
          </div>
        </TabsContent>

        <TabsContent value="missing-payments" className="space-y-6">
          {!showMissingPaymentForm && (
            <Card className="p-6">
              <Button onClick={() => setShowMissingPaymentForm(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {mt.submitMissingPayment}
              </Button>
            </Card>
          )}

          {showMissingPaymentForm && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{mt.formTitle}</h2>
                <Button variant="outline" onClick={() => setShowMissingPaymentForm(false)}>
                  {mt.close}
                </Button>
              </div>
              <MissingPaymentForm userId={userId} onSuccess={handleMissingPaymentSuccess} language={language} />
            </Card>
          )}

          <div>
            <h2 className="text-2xl font-bold mb-4">{mt.historyTitle}</h2>
            <MissingPaymentHistory userId={userId} refreshKey={missingPaymentRefreshKey} language={language} />
          </div>
        </TabsContent>

        <TabsContent value="misconduct" className="space-y-6">
          <MoverMisconductCases userId={userId} language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MoverDashboard;

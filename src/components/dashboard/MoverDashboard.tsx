import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Star, DollarSign, AlertTriangle, Shield, MessageSquare, Lightbulb } from "lucide-react";
import ReimbursementForm from "./ReimbursementForm";
import ReimbursementHistory from "./ReimbursementHistory";
import ReviewBonusForm from "./ReviewBonusForm";
import ReviewBonusHistory from "./ReviewBonusHistory";
import MissingPaymentForm from "./MissingPaymentForm";
import MissingPaymentHistory from "./MissingPaymentHistory";
import MoverMisconductCases from "./MoverMisconductCases";
import ViolenceIncidentForm from "./ViolenceIncidentForm";
import ViolenceIncidentHistory from "./ViolenceIncidentHistory";
import { MoverFeedbackForm } from "./MoverFeedbackForm";
import { MoverFeedbackHistory } from "./MoverFeedbackHistory";
import ChatContainer from "./chat/ChatContainer";
import MoverSettings from "./MoverSettings";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { reviewBonusTranslations } from "@/lib/reviewBonusTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";
import { violenceIncidentTranslations } from "@/lib/violenceIncidentTranslations";
import { chatTranslations } from "@/lib/chatTranslations";
import { supabase } from "@/integrations/supabase/client";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface MoverDashboardProps {
  userId: string;
}

const MoverDashboard = ({ userId }: MoverDashboardProps) => {
  const [showReimbursementForm, setShowReimbursementForm] = useState(false);
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [showMissingPaymentForm, setShowMissingPaymentForm] = useState(false);
  const [showViolenceForm, setShowViolenceForm] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [missingPaymentRefreshKey, setMissingPaymentRefreshKey] = useState(0);
  const [violenceRefreshKey, setViolenceRefreshKey] = useState(0);
  const [feedbackRefreshKey, setFeedbackRefreshKey] = useState(0);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  const [foremanName, setForemanName] = useState("");
  
  const t = dashboardTranslations[language];
  const rt = reviewBonusTranslations[language];
  const mt = missingPaymentTranslations[language];
  const vt = violenceIncidentTranslations[language];
  const ct = chatTranslations[language];
  
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

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

  const handleViolenceSuccess = () => {
    setShowViolenceForm(false);
    setViolenceRefreshKey((prev) => prev + 1);
  };

  const handleFeedbackSuccess = () => {
    setShowFeedbackForm(false);
    setFeedbackRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <MoverSettings userId={userId} language={language} />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="reimbursements" className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="inline-flex min-w-max md:flex md:flex-wrap gap-1 h-auto p-1">
            <TabsTrigger value="reimbursements" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              {t.reimbursementHistory}
            </TabsTrigger>
            <TabsTrigger value="reviews" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <Star className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{rt.formTitle}</span>
              <span className="sm:hidden">{language === 'ru' ? 'Отзывы' : language === 'es' ? 'Reseñas' : 'Reviews'}</span>
            </TabsTrigger>
            <TabsTrigger value="missing-payments" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{mt.formTitle}</span>
              <span className="sm:hidden">{language === 'ru' ? 'Платежи' : language === 'es' ? 'Pagos' : 'Payments'}</span>
            </TabsTrigger>
            <TabsTrigger value="misconduct" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <AlertTriangle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{language === 'ru' ? 'Случаи поведения' : language === 'es' ? 'Casos de Conducta' : 'Misconduct'}</span>
              <span className="sm:hidden">{language === 'ru' ? 'Случаи' : language === 'es' ? 'Casos' : 'Cases'}</span>
            </TabsTrigger>
            <TabsTrigger value="violence" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <Shield className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">{vt.formTitle}</span>
              <span className="sm:hidden">{language === 'ru' ? 'Инциденты' : language === 'es' ? 'Incidentes' : 'Incidents'}</span>
            </TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <Lightbulb className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              {language === 'ru' ? 'Отзыв' : language === 'es' ? 'Comentarios' : 'Feedback'}
            </TabsTrigger>
            <TabsTrigger value="chat" className="relative text-xs md:text-sm px-2 md:px-3 py-1.5">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              {ct.chat}
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
          </TabsList>
        </div>

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

        <TabsContent value="violence" className="space-y-6">
          {!showViolenceForm && (
            <Card className="p-6">
              <Button onClick={() => setShowViolenceForm(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {vt.submitReport}
              </Button>
            </Card>
          )}

          {showViolenceForm && (
            <Card className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold">{vt.formTitle}</h2>
                <Button variant="outline" onClick={() => setShowViolenceForm(false)}>
                  {vt.close}
                </Button>
              </div>
              <ViolenceIncidentForm userId={userId} onSuccess={handleViolenceSuccess} language={language} />
            </Card>
          )}

          <div>
            <h2 className="text-2xl font-bold mb-4">{vt.historyTitle}</h2>
            <ViolenceIncidentHistory userId={userId} refreshKey={violenceRefreshKey} language={language} />
          </div>
        </TabsContent>

        <TabsContent value="feedback" className="space-y-6">
          {!showFeedbackForm && (
            <Card className="p-6">
              <Button onClick={() => setShowFeedbackForm(true)} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                {language === 'ru' ? 'Отправить отзыв' : language === 'es' ? 'Enviar comentarios' : 'Submit Feedback'}
              </Button>
            </Card>
          )}

          {showFeedbackForm && (
            <div>
              <div className="flex justify-end mb-4">
                <Button variant="outline" onClick={() => setShowFeedbackForm(false)}>
                  {language === 'ru' ? 'Закрыть' : language === 'es' ? 'Cerrar' : 'Close'}
                </Button>
              </div>
              <MoverFeedbackForm userId={userId} language={language} onSuccess={handleFeedbackSuccess} />
            </div>
          )}

          <MoverFeedbackHistory userId={userId} language={language} refreshKey={feedbackRefreshKey} />
        </TabsContent>

        <TabsContent value="chat">
          <ChatContainer userId={userId} userRole="mover" language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default MoverDashboard;

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Star, DollarSign, AlertTriangle, Shield, Lightbulb, ChevronDown, LogOut } from "lucide-react";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import MoverSidebar from "./MoverSidebar";
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
import FeedList from "./feed/FeedList";
import MoverSettings from "./MoverSettings";
import { MoverNotificationBell } from "./MoverNotificationBell";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { reviewBonusTranslations } from "@/lib/reviewBonusTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";
import { violenceIncidentTranslations } from "@/lib/violenceIncidentTranslations";
import { chatTranslations } from "@/lib/chatTranslations";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import HandbookPopup from "./HandbookPopup";
import DriverLicenseDisclaimer from "./DriverLicenseDisclaimer";
import AddressDisclaimer from "./AddressDisclaimer";

interface MoverDashboardProps {
  userId: string;
}

const MoverDashboard = ({ userId }: MoverDashboardProps) => {
  const [activeTab, setActiveTab] = useState("feed");
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
  const [addressRefreshKey, setAddressRefreshKey] = useState(0);
  const { language, setLanguage } = useLanguage();
  const [foremanName, setForemanName] = useState("");
  const settingsButtonRef = useRef<HTMLButtonElement>(null);

  const handleNavigateToSettings = () => {
    settingsButtonRef.current?.click();
  };

  const handleSettingsClose = () => {
    // Refresh address disclaimer after settings dialog closes
    setAddressRefreshKey((prev) => prev + 1);
  };

  const handleFormSelect = (formType: string) => {
    setShowReimbursementForm(false);
    setShowReviewForm(false);
    setShowMissingPaymentForm(false);
    setShowViolenceForm(false);
    setShowFeedbackForm(false);

    switch (formType) {
      case 'reimbursement':
        setActiveTab('reimbursements');
        setTimeout(() => setShowReimbursementForm(true), 100);
        break;
      case 'review':
        setActiveTab('reviews');
        setTimeout(() => setShowReviewForm(true), 100);
        break;
      case 'missing-payment':
        setActiveTab('missing-payments');
        setTimeout(() => setShowMissingPaymentForm(true), 100);
        break;
      case 'violence':
        setActiveTab('violence');
        setTimeout(() => setShowViolenceForm(true), 100);
        break;
      case 'feedback':
        setActiveTab('feedback');
        setTimeout(() => setShowFeedbackForm(true), 100);
        break;
    }
  };
  
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(language === 'ru' ? 'Вы вышли из системы' : language === 'es' ? 'Sesión cerrada' : 'Logged out successfully');
  };

  const renderContent = () => {
    switch (activeTab) {
      case "feed":
        return <FeedList userId={userId} isAdmin={false} language={language} />;
      
      case "reimbursements":
        return (
          <div className="space-y-6">
            {!showReimbursementForm && (
              <Card className="p-6">
                <Button onClick={() => setShowReimbursementForm(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {t.submitReimbursement}
                </Button>
              </Card>
            )}
            {showReimbursementForm && (
              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold">{t.reimbursementForm}</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowReimbursementForm(false)}>
                    {t.close}
                  </Button>
                </div>
                <ReimbursementForm userId={userId} onSuccess={handleReimbursementSuccess} onCancel={() => setShowReimbursementForm(false)} language={language} />
              </Card>
            )}
            <div>
              <h2 className="text-lg md:text-2xl font-bold mb-4">{t.reimbursementHistory}</h2>
              <ReimbursementHistory userId={userId} refreshKey={refreshKey} userRole="mover" language={language} />
            </div>
          </div>
        );
      
      case "reviews":
        return (
          <div className="space-y-6">
            {!showReviewForm && (
              <Card className="p-6">
                <Button onClick={() => setShowReviewForm(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {rt.submitReview}
                </Button>
              </Card>
            )}
            {showReviewForm && (
              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold">{rt.formTitle}</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowReviewForm(false)}>
                    {rt.close}
                  </Button>
                </div>
                <ReviewBonusForm 
                  userId={userId} 
                  foremanName={foremanName}
                  onSuccess={handleReviewSuccess} 
                  onCancel={() => setShowReviewForm(false)}
                  language={language} 
                />
              </Card>
            )}
            <div>
              <h2 className="text-lg md:text-2xl font-bold mb-4">{rt.reviewHistory}</h2>
              <ReviewBonusHistory userId={userId} refreshKey={reviewRefreshKey} language={language} />
            </div>
          </div>
        );
      
      case "missing-payments":
        return (
          <div className="space-y-6">
            {!showMissingPaymentForm && (
              <Card className="p-6">
                <Button onClick={() => setShowMissingPaymentForm(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {mt.submitMissingPayment}
                </Button>
              </Card>
            )}
            {showMissingPaymentForm && (
              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold">{mt.formTitle}</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowMissingPaymentForm(false)}>
                    {mt.close}
                  </Button>
                </div>
                <MissingPaymentForm userId={userId} onSuccess={handleMissingPaymentSuccess} onCancel={() => setShowMissingPaymentForm(false)} language={language} />
              </Card>
            )}
            <div>
              <h2 className="text-lg md:text-2xl font-bold mb-4">{mt.historyTitle}</h2>
              <MissingPaymentHistory userId={userId} refreshKey={missingPaymentRefreshKey} language={language} />
            </div>
          </div>
        );
      
      case "misconduct":
        return <MoverMisconductCases userId={userId} language={language} />;
      
      case "violence":
        return (
          <div className="space-y-6">
            {!showViolenceForm && (
              <Card className="p-6">
                <Button onClick={() => setShowViolenceForm(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {vt.submitReport}
                </Button>
              </Card>
            )}
            {showViolenceForm && (
              <Card className="p-4 md:p-6">
                <div className="flex items-center justify-between mb-4 md:mb-6">
                  <h2 className="text-lg md:text-2xl font-bold">{vt.formTitle}</h2>
                  <Button variant="outline" size="sm" onClick={() => setShowViolenceForm(false)}>
                    {vt.close}
                  </Button>
                </div>
                <ViolenceIncidentForm userId={userId} onSuccess={handleViolenceSuccess} onCancel={() => setShowViolenceForm(false)} language={language} />
              </Card>
            )}
            <div>
              <h2 className="text-lg md:text-2xl font-bold mb-4">{vt.historyTitle}</h2>
              <ViolenceIncidentHistory userId={userId} refreshKey={violenceRefreshKey} language={language} />
            </div>
          </div>
        );
      
      case "feedback":
        return (
          <div className="space-y-6">
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
                  <Button variant="outline" size="sm" onClick={() => setShowFeedbackForm(false)}>
                    {language === 'ru' ? 'Закрыть' : language === 'es' ? 'Cerrar' : 'Close'}
                  </Button>
                </div>
                <MoverFeedbackForm userId={userId} language={language} onSuccess={handleFeedbackSuccess} onCancel={() => setShowFeedbackForm(false)} />
              </div>
            )}
            <MoverFeedbackHistory userId={userId} language={language} refreshKey={feedbackRefreshKey} />
          </div>
        );
      
      case "chat":
        return <ChatContainer userId={userId} userRole="mover" language={language} />;
      
      default:
        return null;
    }
  };

  // Mobile Layout
  const MobileLayout = () => (
    <div className="space-y-6">
      <HandbookPopup userId={userId} language={language} />
      <DriverLicenseDisclaimer userId={userId} language={language} onNavigateToSettings={handleNavigateToSettings} refreshKey={addressRefreshKey} />
      <AddressDisclaimer userId={userId} language={language} onNavigateToSettings={handleNavigateToSettings} refreshKey={addressRefreshKey} />
      
      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-1" />
          {language === 'ru' ? 'Выход' : language === 'es' ? 'Salir' : 'Exit'}
        </Button>
        <MoverNotificationBell userId={userId} language={language} />
        <MoverSettings userId={userId} language={language} ref={settingsButtonRef} onClose={handleSettingsClose} />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>

      {/* Form Selection Dropdown */}
      <Card className="p-4">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="w-full justify-between">
              <span className="flex items-center">
                <Plus className="h-4 w-4 mr-2" />
                {language === 'ru' ? 'Выбрать форму' : language === 'es' ? 'Seleccionar formulario' : 'Select Form to Submit'}
              </span>
              <ChevronDown className="h-4 w-4 ml-2" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-[calc(100vw-3rem)] bg-background border shadow-lg z-50">
            <DropdownMenuItem onClick={() => handleFormSelect('reimbursement')} className="py-3">
              <DollarSign className="h-4 w-4 mr-2" />
              {t.submitReimbursement}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFormSelect('review')} className="py-3">
              <Star className="h-4 w-4 mr-2" />
              {rt.submitReview}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFormSelect('missing-payment')} className="py-3">
              <DollarSign className="h-4 w-4 mr-2" />
              {mt.submitMissingPayment}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFormSelect('violence')} className="py-3">
              <Shield className="h-4 w-4 mr-2" />
              {vt.submitReport}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleFormSelect('feedback')} className="py-3">
              <Lightbulb className="h-4 w-4 mr-2" />
              {language === 'ru' ? 'Отправить отзыв' : language === 'es' ? 'Enviar comentarios' : 'Submit Feedback'}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Card>

      {/* Feed Section - Below Form Selector */}
      <FeedList userId={userId} isAdmin={false} language={language} />
    </div>
  );

  // Desktop Layout with Sidebar
  const DesktopLayout = () => (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-8rem)] w-full">
        <MoverSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          hasUnreadMessages={hasUnreadMessages}
          language={language}
        />
        <SidebarInset className="flex-1">
          <div className="p-6">
            <HandbookPopup userId={userId} language={language} />
            <DriverLicenseDisclaimer userId={userId} language={language} onNavigateToSettings={handleNavigateToSettings} refreshKey={addressRefreshKey} />
            <AddressDisclaimer userId={userId} language={language} onNavigateToSettings={handleNavigateToSettings} refreshKey={addressRefreshKey} />
            
            <div className="flex justify-between items-center mb-6">
              <SidebarTrigger className="md:hidden" />
              <div className="flex justify-end gap-2 ml-auto">
                <MoverNotificationBell userId={userId} language={language} />
                <MoverSettings userId={userId} language={language} ref={settingsButtonRef} onClose={handleSettingsClose} />
                <LanguageSelector language={language} onLanguageChange={setLanguage} />
              </div>
            </div>

            {renderContent()}
          </div>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );

  return (
    <>
      {/* Mobile Layout */}
      <div className="md:hidden">
        <MobileLayout />
      </div>
      
      {/* Desktop Layout */}
      <div className="hidden md:block">
        <DesktopLayout />
      </div>
    </>
  );
};

export default MoverDashboard;
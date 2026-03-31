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
import { Plus, Star, DollarSign, AlertTriangle, Shield, Lightbulb, ChevronDown, LogOut, ClipboardList, Newspaper, MessageSquare, HelpCircle, UserPlus } from "lucide-react";
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
import PaymentQuestionForm from "./PaymentQuestionForm";
import PaymentQuestionHistory from "./PaymentQuestionHistory";
import ReferFriendForm from "./ReferFriendForm";
import ReferFriendHistory from "./ReferFriendHistory";
import MoverSettings from "./MoverSettings";
import MoverTodoList from "./MoverTodoList";
import { MoverNotificationBell } from "./MoverNotificationBell";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { reviewBonusTranslations } from "@/lib/reviewBonusTranslations";
import { missingPaymentTranslations } from "@/lib/missingPaymentTranslations";
import { violenceIncidentTranslations } from "@/lib/violenceIncidentTranslations";
import { referralTranslations } from "@/lib/referralTranslations";
import { chatTranslations } from "@/lib/chatTranslations";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import HandbookPopup from "./HandbookPopup";
import ConsentDocumentPopup from "./ConsentDocumentPopup";
import AnnualAddressDisclaimer from "./AnnualAddressDisclaimer";
import DriverLicenseDisclaimer from "./DriverLicenseDisclaimer";
import AddressDisclaimer from "./AddressDisclaimer";
import FeedPostPopup from "./FeedPostPopup";

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
  const [showPaymentQuestionForm, setShowPaymentQuestionForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [reviewRefreshKey, setReviewRefreshKey] = useState(0);
  const [missingPaymentRefreshKey, setMissingPaymentRefreshKey] = useState(0);
  const [violenceRefreshKey, setViolenceRefreshKey] = useState(0);
  const [feedbackRefreshKey, setFeedbackRefreshKey] = useState(0);
  const [paymentQuestionRefreshKey, setPaymentQuestionRefreshKey] = useState(0);
  const [addressRefreshKey, setAddressRefreshKey] = useState(0);
  const { language, setLanguage } = useLanguage();
  const [foremanName, setForemanName] = useState("");
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  
  // Unacknowledged feed posts count
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  
  // Login flow states
  const [consentCompleted, setConsentCompleted] = useState(false);
  const [handbookCompleted, setHandbookCompleted] = useState(false);
  const [feedPostsCompleted, setFeedPostsCompleted] = useState(false);
  const [showHandbook, setShowHandbook] = useState(false);
  const [showFeedPosts, setShowFeedPosts] = useState(false);

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
    setShowPaymentQuestionForm(false);

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
      case 'payment-question':
        setActiveTab('payment-questions');
        setTimeout(() => setShowPaymentQuestionForm(true), 100);
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
    fetchUnacknowledgedCount();
  }, [userId]);

  const fetchUnacknowledgedCount = async () => {
    try {
      // Get all published feed posts
      const { data: posts } = await supabase
        .from("feed_posts")
        .select("id")
        .eq("is_published", true);

      if (!posts || posts.length === 0) {
        setUnacknowledgedCount(0);
        return;
      }

      // Get user's acknowledged posts
      const { data: acknowledgments } = await supabase
        .from("feed_post_acknowledgments")
        .select("post_id")
        .eq("user_id", userId);

      const acknowledgedPostIds = new Set(acknowledgments?.map(a => a.post_id) || []);
      const unreadCount = posts.filter(post => !acknowledgedPostIds.has(post.id)).length;
      
      setUnacknowledgedCount(unreadCount);
    } catch (error) {
      console.error("Error fetching unacknowledged count:", error);
    }
  };

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

  const handlePaymentQuestionSuccess = () => {
    setShowPaymentQuestionForm(false);
    setPaymentQuestionRefreshKey((prev) => prev + 1);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success(language === 'ru' ? 'Вы вышли из системы' : language === 'es' ? 'Sesión cerrada' : 'Logged out successfully');
  };

  const renderContent = () => {
    switch (activeTab) {
      case "feed":
        return <FeedList userId={userId} isAdmin={false} language={language} />;
      
      case "todo":
        return <MoverTodoList userId={userId} language={language} onNavigateToSettings={handleNavigateToSettings} />;
      
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
      
      case "payment-questions":
        return (
          <div className="space-y-6">
            {!showPaymentQuestionForm && (
              <Card className="p-6">
                <Button onClick={() => setShowPaymentQuestionForm(true)} className="w-full sm:w-auto">
                  <Plus className="h-4 w-4 mr-2" />
                  {language === 'ru' ? 'Задать вопрос по оплате' : language === 'es' ? 'Enviar pregunta de pago' : 'Submit Payment Question'}
                </Button>
              </Card>
            )}
            {showPaymentQuestionForm && (
              <div>
                <div className="flex justify-end mb-4">
                  <Button variant="outline" size="sm" onClick={() => setShowPaymentQuestionForm(false)}>
                    {language === 'ru' ? 'Закрыть' : language === 'es' ? 'Cerrar' : 'Close'}
                  </Button>
                </div>
                <PaymentQuestionForm userId={userId} language={language} onSuccess={handlePaymentQuestionSuccess} onCancel={() => setShowPaymentQuestionForm(false)} />
              </div>
            )}
            <PaymentQuestionHistory userId={userId} language={language} refreshKey={paymentQuestionRefreshKey} />
          </div>
        );

      case "chat":
        return <ChatContainer userId={userId} userRole="mover" language={language} />;
      
      default:
        return null;
    }
  };

  // Mobile Layout
  const MobileLayout = () => {
    const showFormContent = activeTab !== "feed" && (
      showReimbursementForm || showReviewForm || showMissingPaymentForm || 
      showViolenceForm || showFeedbackForm || showPaymentQuestionForm || activeTab === "misconduct" || activeTab === "chat" ||
      activeTab === "payment-questions" || activeTab === "reimbursements" || activeTab === "reviews" || activeTab === "missing-payments" || activeTab === "violence" || activeTab === "feedback"
    );

    const handleBackToFeed = () => {
      setActiveTab("feed");
      setShowReimbursementForm(false);
      setShowReviewForm(false);
      setShowMissingPaymentForm(false);
      setShowViolenceForm(false);
      setShowFeedbackForm(false);
    };

    return (
      <div className="space-y-6">
        {/* Consent Document Popup - First Step */}
        <ConsentDocumentPopup 
          userId={userId} 
          language={language} 
          onComplete={() => {
            setConsentCompleted(true);
            setShowHandbook(true);
          }}
        />
        
        {/* Handbook Popup - Second Step (only shown after consent is completed) */}
        {consentCompleted && showHandbook && (
          <HandbookPopup 
            userId={userId} 
            language={language} 
            onAcknowledge={() => {
              setHandbookCompleted(true);
              setShowHandbook(false);
              setShowFeedPosts(true);
            }}
          />
        )}

        {/* Feed Posts Popup - Third Step (only shown after handbook is completed) */}
        {handbookCompleted && showFeedPosts && (
          <FeedPostPopup
            userId={userId}
            language={language}
            onComplete={() => {
              setFeedPostsCompleted(true);
              setShowFeedPosts(false);
              setActiveTab("feed");
              fetchUnacknowledgedCount();
            }}
            onAcknowledge={fetchUnacknowledgedCount}
          />
        )}
        
        {/* Annual Address Disclaimer - Dec 31st */}
        <AnnualAddressDisclaimer userId={userId} language={language} />
        
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

        {/* Feed and To-Do List Buttons for Mobile */}
        <Card className="p-4">
          <div className="flex gap-2">
            <Button 
              variant={activeTab === "feed" ? "default" : "outline"}
              className="flex-1 justify-between"
              onClick={() => setActiveTab("feed")}
            >
              <span className="flex items-center">
                <Newspaper className="h-4 w-4 mr-2" />
                {language === 'ru' ? 'Лента' : language === 'es' ? 'Noticias' : 'Feed'}
              </span>
              {unacknowledgedCount > 0 && (
                <span className="min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1.5">
                  {unacknowledgedCount > 99 ? '99+' : unacknowledgedCount}
                </span>
              )}
            </Button>
            <Button 
              variant={activeTab === "todo" ? "default" : "outline"}
              className="flex-1 justify-between"
              onClick={() => setActiveTab("todo")}
            >
              <span className="flex items-center">
                <ClipboardList className="h-4 w-4 mr-2" />
                {language === 'ru' ? 'Задачи' : language === 'es' ? 'Tareas' : 'To-Do'}
              </span>
            </Button>
            <Button 
              variant={activeTab === "chat" ? "default" : "outline"}
              className="flex-1 justify-between"
              onClick={() => setActiveTab("chat")}
            >
              <span className="flex items-center">
                <MessageSquare className="h-4 w-4 mr-2" />
                {language === 'ru' ? 'Чат' : language === 'es' ? 'Chat' : 'Chat'}
              </span>
              {hasUnreadMessages && (
                <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </Button>
          </div>
        </Card>

        {/* Show Form Content or Feed */}
        {showFormContent ? (
          <div className="space-y-4">
            <Button variant="outline" size="sm" onClick={handleBackToFeed}>
              {language === 'ru' ? '← Назад к ленте' : language === 'es' ? '← Volver al feed' : '← Back to Feed'}
            </Button>
            {renderContent()}
          </div>
        ) : (
          <>
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
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleFormSelect('reimbursement'); }} className="py-3">
                    <DollarSign className="h-4 w-4 mr-2" />
                    {t.submitReimbursement}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleFormSelect('review'); }} className="py-3">
                    <Star className="h-4 w-4 mr-2" />
                    {rt.submitReview}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleFormSelect('missing-payment'); }} className="py-3">
                    <DollarSign className="h-4 w-4 mr-2" />
                    {mt.submitMissingPayment}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleFormSelect('violence'); }} className="py-3">
                    <Shield className="h-4 w-4 mr-2" />
                    {vt.submitReport}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleFormSelect('feedback'); }} className="py-3">
                    <Lightbulb className="h-4 w-4 mr-2" />
                    {language === 'ru' ? 'Отправить отзыв' : language === 'es' ? 'Enviar comentarios' : 'Submit Feedback'}
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); handleFormSelect('payment-question'); }} className="py-3">
                    <HelpCircle className="h-4 w-4 mr-2" />
                    {language === 'ru' ? 'Вопрос по оплате' : language === 'es' ? 'Pregunta de pago' : 'Payment Question'}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </Card>

            {/* Feed Section - Below Form Selector */}
            <FeedList userId={userId} isAdmin={false} language={language} />
          </>
        )}
      </div>
    );
  };

  // Desktop Layout with Sidebar
  const DesktopLayout = () => (
    <SidebarProvider>
      <div className="flex min-h-[calc(100vh-8rem)] w-full">
        <MoverSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          hasUnreadMessages={hasUnreadMessages}
          language={language}
          userId={userId}
          unacknowledgedCount={unacknowledgedCount}
        />
        <SidebarInset className="flex-1">
          <div className="p-6">
            {/* Consent Document Popup - First Step */}
            <ConsentDocumentPopup 
              userId={userId} 
              language={language} 
              onComplete={() => {
                setConsentCompleted(true);
                setShowHandbook(true);
              }}
            />
            
            {/* Handbook Popup - Second Step (only shown after consent is completed) */}
            {consentCompleted && showHandbook && (
              <HandbookPopup 
                userId={userId} 
                language={language}
                onAcknowledge={() => {
                  setHandbookCompleted(true);
                  setShowHandbook(false);
                  setShowFeedPosts(true);
                }}
              />
            )}
            
            {/* Feed Posts Popup - Third Step (only shown after handbook is completed) */}
            {handbookCompleted && showFeedPosts && (
              <FeedPostPopup
                userId={userId}
                language={language}
                onComplete={() => {
                  setFeedPostsCompleted(true);
                  setShowFeedPosts(false);
                  fetchUnacknowledgedCount();
                }}
                onAcknowledge={fetchUnacknowledgedCount}
              />
            )}
            
            <AnnualAddressDisclaimer userId={userId} language={language} />
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
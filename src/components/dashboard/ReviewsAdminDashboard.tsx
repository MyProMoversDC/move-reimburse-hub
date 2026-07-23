import { useState } from "react";
import { useDeepLink } from "@/hooks/useDeepLink";
import AdminReviewBonusList from "./AdminReviewBonusList";
import AdminMissingPaymentList from "./AdminMissingPaymentList";
import CustomerReviewReportingDashboard from "./CustomerReviewReportingDashboard";
import DeductiblesReport from "./DeductiblesReport";
import DateRangeFilter from "./DateRangeFilter";
import ShiftSchedule from "./ShiftSchedule";
import ChatContainer from "./chat/ChatContainer";
import AddBonusDialog from "./AddBonusDialog";
import UserSettings from "./UserSettings";
import { Button } from "@/components/ui/button";
import { Download, Star, FileBarChart, DollarSign, MinusCircle, MessageSquare, Clock, GraduationCap, FileText } from "lucide-react";
import { exportReviewBonusesToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/lib/i18n";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import PayStubsDashboard from "./PayStubsDashboard";
import { cn } from "@/lib/utils";
import MobileShell, { type MobileShellNavItem } from "@/components/mobile/MobileShell";

interface ReviewsAdminDashboardProps {
  userId: string;
}

const ReviewsAdminDashboard = ({ userId }: ReviewsAdminDashboardProps) => {
  const [exportingReviews, setExportingReviews] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { t: ti18n } = useT();
  const [activeTab, setActiveTab] = useState<string>("reviews");
  useDeepLink("reviews_admin", setActiveTab);

  const [reviewStartDate, setReviewStartDate] = useState<Date | undefined>();
  const [reviewEndDate, setReviewEndDate] = useState<Date | undefined>();

  const [missingPaymentStartDate, setMissingPaymentStartDate] = useState<Date | undefined>();
  const [missingPaymentEndDate, setMissingPaymentEndDate] = useState<Date | undefined>();

  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

  const t = dashboardTranslations[language];

  const navItems = [
    { id: "reviews", label: ti18n("nav.reviewSubmissions"), icon: Star },
    { id: "missing-payments", label: ti18n("nav.missingPayments"), icon: DollarSign },
    { id: "reports", label: ti18n("nav.reviewReports"), icon: FileBarChart },
    { id: "deductibles", label: ti18n("nav.deductibles"), icon: MinusCircle },
    { id: "paystubs", label: ti18n("nav.payStubs"), icon: FileText },
    { id: "chat", label: ti18n("nav.chat"), icon: MessageSquare },
    { id: "shift-schedule", label: ti18n("nav.shiftSchedule"), icon: Clock },
    { id: "knowledge-base", label: ti18n("nav.knowledgeBase"), icon: GraduationCap },
  ] as const;

  const handleExportReviews = async () => {
    setExportingReviews(true);
    try {
      let query = supabase
        .from("review_bonuses")
        .select("*")
        .order("submission_date", { ascending: false });

      if (reviewStartDate) {
        query = query.gte("submission_date", format(reviewStartDate, "yyyy-MM-dd"));
      }
      if (reviewEndDate) {
        const endDatePlusOne = new Date(reviewEndDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("submission_date", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        exportReviewBonusesToExcel(data, "review-bonuses");
        toast.success(t.exportComplete);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExportingReviews(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "reviews":
        return (
          <div className="space-y-4">
            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-end gap-2 flex-wrap">
                <AddBonusDialog userId={userId} language={language} />
                <Button onClick={handleExportReviews} disabled={exportingReviews} size="sm" className="text-xs">
                  <Download className="h-3 w-3 mr-1" />
                  Export
                </Button>
              </div>
              <DateRangeFilter startDate={reviewStartDate} endDate={reviewEndDate} onStartDateChange={setReviewStartDate} onEndDateChange={setReviewEndDate} onClear={() => { setReviewStartDate(undefined); setReviewEndDate(undefined); }} />
            </div>
            <AdminReviewBonusList language={language} startDate={reviewStartDate} endDate={reviewEndDate} />
          </div>
        );
      case "missing-payments":
        return (
          <div className="space-y-4">
            <DateRangeFilter startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} onStartDateChange={setMissingPaymentStartDate} onEndDateChange={setMissingPaymentEndDate} onClear={() => { setMissingPaymentStartDate(undefined); setMissingPaymentEndDate(undefined); }} />
            <AdminMissingPaymentList language={language} startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} />
          </div>
        );
      case "reports":
        return <CustomerReviewReportingDashboard language={language} />;
      case "deductibles":
        return <DeductiblesReport isAdmin={false} />;
      case "paystubs":
        return <PayStubsDashboard />;
      case "chat":
        return <ChatContainer userId={userId} userRole="reviews_admin" language={language} />;
      case "shift-schedule":
        return <ShiftSchedule userId={userId} language={language} />;
      case "knowledge-base":
        return <KnowledgeBaseViewer userId={userId} />;
      default:
        return null;
    }
  };

  const shellNav: MobileShellNavItem[] = navItems.map((n) => ({
    id: n.id,
    label: n.label,
    icon: n.icon,
    dot: n.id === "chat" && hasUnreadMessages,
    badgeCount: n.id === "chat" && hasUnreadMessages ? 1 : 0,
  }));

  return (
    <MobileShell
      navItems={shellNav}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderContent={renderContent}
      rightActions={
        <>
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </>
      }
    >
      <div className="flex gap-6">
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r pr-4 pt-2 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left relative",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.id === "chat" && hasUnreadMessages && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </button>
          ))}
        </aside>

        <div className="hidden md:block flex-1 min-w-0">
          <div className="flex justify-end gap-2 mb-4">
            <UserSettings userId={userId} language={language} />
            <LanguageSelector language={language} onLanguageChange={setLanguage} />
          </div>

          {activeTab === "reviews" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold">{ti18n("nav.reviewSubmissions")}</h2>
                  <div className="flex items-center gap-2">
                    <AddBonusDialog userId={userId} language={language} />
                    <Button onClick={handleExportReviews} disabled={exportingReviews} size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      {exportingReviews ? t.exporting : t.exportToExcel}
                    </Button>
                  </div>
                </div>
                <DateRangeFilter startDate={reviewStartDate} endDate={reviewEndDate} onStartDateChange={setReviewStartDate} onEndDateChange={setReviewEndDate} onClear={() => { setReviewStartDate(undefined); setReviewEndDate(undefined); }} />
              </div>
              <AdminReviewBonusList language={language} startDate={reviewStartDate} endDate={reviewEndDate} />
            </div>
          )}
          {activeTab === "missing-payments" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4">
                <h2 className="text-2xl font-bold">{ti18n("nav.missingPayments")}</h2>
                <DateRangeFilter startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} onStartDateChange={setMissingPaymentStartDate} onEndDateChange={setMissingPaymentEndDate} onClear={() => { setMissingPaymentStartDate(undefined); setMissingPaymentEndDate(undefined); }} />
              </div>
              <AdminMissingPaymentList language={language} startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} />
            </div>
          )}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">{ti18n("nav.reviewReports")}</h2>
              <CustomerReviewReportingDashboard language={language} />
            </div>
          )}
          {activeTab === "deductibles" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">{ti18n("nav.deductiblesReport")}</h2>
              <DeductiblesReport isAdmin={false} />
            </div>
          )}
          {activeTab === "chat" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">{ti18n("nav.chat")}</h2>
              <ChatContainer userId={userId} userRole="reviews_admin" language={language} />
            </div>
          )}
          {activeTab === "shift-schedule" && (
            <ShiftSchedule userId={userId} language={language} />
          )}
          {activeTab === "knowledge-base" && (
            <div className="space-y-6">
              <KnowledgeBaseViewer userId={userId} />
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
};

export default ReviewsAdminDashboard;

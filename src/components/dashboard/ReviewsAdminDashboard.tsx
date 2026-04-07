import { useState } from "react";
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
import { Download, Star, FileBarChart, DollarSign, MinusCircle, MessageSquare, Clock, GraduationCap } from "lucide-react";
import { exportReviewBonusesToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import { cn } from "@/lib/utils";

interface ReviewsAdminDashboardProps {
  userId: string;
}

const navItems = [
  { id: "reviews", label: "Review Submissions", shortLabel: "Reviews", icon: Star },
  { id: "missing-payments", label: "Missing Payments", shortLabel: "Payments", icon: DollarSign },
  { id: "reports", label: "Review Reports", shortLabel: "Reports", icon: FileBarChart },
  { id: "deductibles", label: "Deductibles", shortLabel: "Deductibles", icon: MinusCircle },
  { id: "chat", label: "Chat", shortLabel: "Chat", icon: MessageSquare },
  { id: "shift-schedule", label: "Shift Schedule", shortLabel: "Schedule", icon: Clock },
  { id: "knowledge-base", label: "Knowledge Base", shortLabel: "KB", icon: GraduationCap },
] as const;

const ReviewsAdminDashboard = ({ userId }: ReviewsAdminDashboardProps) => {
  const [exportingReviews, setExportingReviews] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("reviews");
  
  const [reviewStartDate, setReviewStartDate] = useState<Date | undefined>();
  const [reviewEndDate, setReviewEndDate] = useState<Date | undefined>();
  
  const [missingPaymentStartDate, setMissingPaymentStartDate] = useState<Date | undefined>();
  const [missingPaymentEndDate, setMissingPaymentEndDate] = useState<Date | undefined>();
  
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);
  
  const t = dashboardTranslations[language];

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

  return (
    <div className="flex gap-6">
      {/* Desktop left sidebar nav */}
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

      {/* Mobile horizontal nav */}
      <div className="md:hidden w-full">
        <div className="flex justify-end gap-2 mb-4">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </div>
        <div className="overflow-x-auto -mx-3 px-3 mb-4">
          <div className="inline-flex min-w-max gap-1 p-1 bg-muted rounded-lg">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors relative",
                  activeTab === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                {item.shortLabel}
                {item.id === "chat" && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile content */}
        <div className="space-y-4">
          {activeTab === "reviews" && (
            <>
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">Review Submissions</h2>
                  <div className="flex items-center gap-2">
                    <AddBonusDialog userId={userId} language={language} />
                    <Button onClick={handleExportReviews} disabled={exportingReviews} size="sm" className="text-xs">
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                  </div>
                </div>
                <DateRangeFilter startDate={reviewStartDate} endDate={reviewEndDate} onStartDateChange={setReviewStartDate} onEndDateChange={setReviewEndDate} onClear={() => { setReviewStartDate(undefined); setReviewEndDate(undefined); }} />
              </div>
              <AdminReviewBonusList language={language} startDate={reviewStartDate} endDate={reviewEndDate} />
            </>
          )}
          {activeTab === "missing-payments" && (
            <>
              <div className="flex flex-col gap-3">
                <h2 className="text-lg font-bold">Missing Payments</h2>
                <DateRangeFilter startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} onStartDateChange={setMissingPaymentStartDate} onEndDateChange={setMissingPaymentEndDate} onClear={() => { setMissingPaymentStartDate(undefined); setMissingPaymentEndDate(undefined); }} />
              </div>
              <AdminMissingPaymentList language={language} startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} />
            </>
          )}
          {activeTab === "reports" && (
            <>
              <h2 className="text-lg font-bold">Review Analytics</h2>
              <CustomerReviewReportingDashboard language={language} />
            </>
          )}
          {activeTab === "deductibles" && (
            <>
              <h2 className="text-lg font-bold">Deductibles</h2>
              <DeductiblesReport isAdmin={false} />
            </>
          )}
          {activeTab === "chat" && (
            <>
              <h2 className="text-lg font-bold">Chat</h2>
              <ChatContainer userId={userId} userRole="reviews_admin" language={language} />
            </>
          )}
          {activeTab === "shift-schedule" && (
            <ShiftSchedule userId={userId} language={language} />
          )}
          {activeTab === "knowledge-base" && (
            <KnowledgeBaseViewer userId={userId} />
          )}
        </div>
      </div>

      {/* Desktop content */}
      <div className="hidden md:block flex-1 min-w-0">
        <div className="flex justify-end gap-2 mb-4">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </div>

        {activeTab === "reviews" && (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="text-2xl font-bold">Customer Review Bonus Submissions</h2>
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
              <h2 className="text-2xl font-bold">Missing Payment Submissions</h2>
              <DateRangeFilter startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} onStartDateChange={setMissingPaymentStartDate} onEndDateChange={setMissingPaymentEndDate} onClear={() => { setMissingPaymentStartDate(undefined); setMissingPaymentEndDate(undefined); }} />
            </div>
            <AdminMissingPaymentList language={language} startDate={missingPaymentStartDate} endDate={missingPaymentEndDate} />
          </div>
        )}
        {activeTab === "reports" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Customer Review Analytics</h2>
            <CustomerReviewReportingDashboard language={language} />
          </div>
        )}
        {activeTab === "deductibles" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Deductibles Report</h2>
            <DeductiblesReport isAdmin={false} />
          </div>
        )}
        {activeTab === "chat" && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Chat</h2>
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
  );
};

export default ReviewsAdminDashboard;

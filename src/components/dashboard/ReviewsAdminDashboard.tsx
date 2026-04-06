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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

interface ReviewsAdminDashboardProps {
  userId: string;
}

const ReviewsAdminDashboard = ({ userId }: ReviewsAdminDashboardProps) => {
  const [exportingReviews, setExportingReviews] = useState(false);
  const { language, setLanguage } = useLanguage();
  
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
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <UserSettings userId={userId} language={language} />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="reviews" className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="inline-flex min-w-max md:flex gap-1 h-auto p-1">
            <TabsTrigger value="reviews" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <Star className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Review Submissions</span>
              <span className="sm:hidden">Reviews</span>
            </TabsTrigger>
            <TabsTrigger value="missing-payments" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Missing Payments</span>
              <span className="sm:hidden">Payments</span>
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <FileBarChart className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              <span className="hidden sm:inline">Review Reports</span>
              <span className="sm:hidden">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="deductibles" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <MinusCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Deductibles
            </TabsTrigger>
            <TabsTrigger value="chat" className="relative text-xs md:text-sm px-2 md:px-3 py-1.5">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Chat
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="shift-schedule" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <Clock className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Shift Schedule
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="reviews" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
              <h2 className="text-xl md:text-2xl font-bold">Customer Review Bonus Submissions</h2>
              <div className="flex items-center gap-2 flex-wrap">
                <AddBonusDialog userId={userId} language={language} />
                <Button onClick={handleExportReviews} disabled={exportingReviews} size="sm" className="text-xs md:text-sm">
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">{exportingReviews ? t.exporting : t.exportToExcel}</span>
                  <span className="sm:hidden">Export</span>
                </Button>
              </div>
            </div>
            <DateRangeFilter
              startDate={reviewStartDate}
              endDate={reviewEndDate}
              onStartDateChange={setReviewStartDate}
              onEndDateChange={setReviewEndDate}
              onClear={() => {
                setReviewStartDate(undefined);
                setReviewEndDate(undefined);
              }}
            />
          </div>
          <AdminReviewBonusList 
            language={language} 
            startDate={reviewStartDate}
            endDate={reviewEndDate}
          />
        </TabsContent>

        <TabsContent value="missing-payments" className="space-y-6">
          <div className="flex flex-col gap-4">
            <h2 className="text-2xl font-bold">Missing Payment Submissions</h2>
            <DateRangeFilter
              startDate={missingPaymentStartDate}
              endDate={missingPaymentEndDate}
              onStartDateChange={setMissingPaymentStartDate}
              onEndDateChange={setMissingPaymentEndDate}
              onClear={() => {
                setMissingPaymentStartDate(undefined);
                setMissingPaymentEndDate(undefined);
              }}
            />
          </div>
          <AdminMissingPaymentList 
            language={language} 
            startDate={missingPaymentStartDate}
            endDate={missingPaymentEndDate}
          />
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <h2 className="text-2xl font-bold">Customer Review Analytics</h2>
          <CustomerReviewReportingDashboard language={language} />
        </TabsContent>

        <TabsContent value="deductibles" className="space-y-6">
          <h2 className="text-2xl font-bold">Deductibles Report</h2>
          <DeductiblesReport isAdmin={false} />
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <h2 className="text-2xl font-bold">Chat</h2>
          <ChatContainer userId={userId} userRole="reviews_admin" language={language} />
        </TabsContent>

        <TabsContent value="shift-schedule">
          <ShiftSchedule userId={userId} language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ReviewsAdminDashboard;
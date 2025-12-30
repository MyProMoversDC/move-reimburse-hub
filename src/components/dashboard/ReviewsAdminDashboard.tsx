import { useState } from "react";
import AdminReviewBonusList from "./AdminReviewBonusList";
import AdminMissingPaymentList from "./AdminMissingPaymentList";
import CustomerReviewReportingDashboard from "./CustomerReviewReportingDashboard";
import DeductiblesReport from "./DeductiblesReport";
import DateRangeFilter from "./DateRangeFilter";
import ChatContainer from "./chat/ChatContainer";
import AddBonusDialog from "./AddBonusDialog";
import UserSettings from "./UserSettings";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Star, FileBarChart, DollarSign, MinusCircle, MessageSquare } from "lucide-react";
import { exportReviewBonusesToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface ReviewsAdminDashboardProps {
  userId: string;
}

const ReviewsAdminDashboard = ({ userId }: ReviewsAdminDashboardProps) => {
  const [exportingReviews, setExportingReviews] = useState(false);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  
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
        <TabsList>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-2" />
            Review Submissions
          </TabsTrigger>
          <TabsTrigger value="missing-payments">
            <DollarSign className="h-4 w-4 mr-2" />
            Missing Payments
          </TabsTrigger>
          <TabsTrigger value="reports">
            <FileBarChart className="h-4 w-4 mr-2" />
            Review Reports
          </TabsTrigger>
          <TabsTrigger value="deductibles">
            <MinusCircle className="h-4 w-4 mr-2" />
            Deductibles
          </TabsTrigger>
          <TabsTrigger value="chat" className="relative">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
            {hasUnreadMessages && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <h2 className="text-2xl font-bold">Customer Review Bonus Submissions</h2>
              <div className="flex items-center gap-2">
                <AddBonusDialog userId={userId} language={language} />
                <Button onClick={handleExportReviews} disabled={exportingReviews}>
                  <Download className="h-4 w-4 mr-2" />
                  {exportingReviews ? t.exporting : t.exportToExcel}
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
      </Tabs>
    </div>
  );
};

export default ReviewsAdminDashboard;
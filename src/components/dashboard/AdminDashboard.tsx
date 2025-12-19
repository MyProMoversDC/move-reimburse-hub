import { useState } from "react";
import ReimbursementHistory from "./ReimbursementHistory";
import MoversList from "./MoversList";
import AdminReviewBonusList from "./AdminReviewBonusList";
import DateRangeFilter from "./DateRangeFilter";
import ReimbursementReportingDashboard from "./ReimbursementReportingDashboard";
import CustomerReviewReportingDashboard from "./CustomerReviewReportingDashboard";
import UserRoleManager from "./UserRoleManager";
import PerformanceReportsList from "./PerformanceReportsList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Star, FileBarChart, UserCog, AlertTriangle } from "lucide-react";
import { exportToExcel, exportReviewBonusesToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { format } from "date-fns";

const AdminDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingReviews, setExportingReviews] = useState(false);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  
  // Date filters for reimbursements
  const [reimbStartDate, setReimbStartDate] = useState<Date | undefined>();
  const [reimbEndDate, setReimbEndDate] = useState<Date | undefined>();
  
  // Date filters for reviews
  const [reviewStartDate, setReviewStartDate] = useState<Date | undefined>();
  const [reviewEndDate, setReviewEndDate] = useState<Date | undefined>();
  
  const t = dashboardTranslations[language];

  const handleExportReimbursements = async () => {
    setExporting(true);
    try {
      let query = supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });

      if (reimbStartDate) {
        query = query.gte("created_at", format(reimbStartDate, "yyyy-MM-dd"));
      }
      if (reimbEndDate) {
        const endDatePlusOne = new Date(reimbEndDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("created_at", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        exportToExcel(data, "admin-reimbursements");
        toast.success(t.exportComplete);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

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
      <div className="flex justify-end">
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="requests" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="requests">{t.reimbursementRequests}</TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-2" />
            Review Bonuses
          </TabsTrigger>
          <TabsTrigger value="reimbursement-reports">
            <FileBarChart className="h-4 w-4 mr-2" />
            Reimbursement Reports
          </TabsTrigger>
          <TabsTrigger value="review-reports">
            <FileBarChart className="h-4 w-4 mr-2" />
            Review Reports
          </TabsTrigger>
          <TabsTrigger value="performance-reports">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Performance Reports
          </TabsTrigger>
          <TabsTrigger value="movers">{t.moversDirectory}</TabsTrigger>
          <TabsTrigger value="roles">
            <UserCog className="h-4 w-4 mr-2" />
            Role Management
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="requests" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t.allReimbursementRequests}</h2>
              <Button onClick={handleExportReimbursements} disabled={exporting}>
                <Download className="h-4 w-4 mr-2" />
                {exporting ? t.exporting : t.exportToExcel}
              </Button>
            </div>
            <DateRangeFilter
              startDate={reimbStartDate}
              endDate={reimbEndDate}
              onStartDateChange={setReimbStartDate}
              onEndDateChange={setReimbEndDate}
              onClear={() => {
                setReimbStartDate(undefined);
                setReimbEndDate(undefined);
              }}
            />
          </div>
          <ReimbursementHistory 
            refreshKey={refreshKey} 
            userRole="admin" 
            onUpdate={() => setRefreshKey((prev) => prev + 1)} 
            language={language}
            startDate={reimbStartDate}
            endDate={reimbEndDate}
          />
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Review Bonus Submissions</h2>
              <Button onClick={handleExportReviews} disabled={exportingReviews}>
                <Download className="h-4 w-4 mr-2" />
                {exportingReviews ? t.exporting : t.exportToExcel}
              </Button>
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

        <TabsContent value="reimbursement-reports" className="space-y-6">
          <h2 className="text-2xl font-bold">Reimbursement Reporting</h2>
          <ReimbursementReportingDashboard language={language} />
        </TabsContent>

        <TabsContent value="review-reports" className="space-y-6">
          <h2 className="text-2xl font-bold">Customer Review Reporting</h2>
          <CustomerReviewReportingDashboard language={language} />
        </TabsContent>
        
        <TabsContent value="performance-reports" className="space-y-6">
          <h2 className="text-2xl font-bold">Performance / Misconduct Reports</h2>
          <PerformanceReportsList refreshKey={refreshKey} onRefresh={() => setRefreshKey((prev) => prev + 1)} userRole="admin" />
        </TabsContent>
        
        <TabsContent value="movers">
          <MoversList language={language} />
        </TabsContent>

        <TabsContent value="roles" className="space-y-6">
          <h2 className="text-2xl font-bold">User Role Management</h2>
          <UserRoleManager language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;

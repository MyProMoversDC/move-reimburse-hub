import { useState, useEffect } from "react";
import ReimbursementHistory from "./ReimbursementHistory";
import MoversList from "./MoversList";
import AdminReviewBonusList from "./AdminReviewBonusList";
import AdminMissingPaymentList from "./AdminMissingPaymentList";
import DateRangeFilter from "./DateRangeFilter";
import ReimbursementReportingDashboard from "./ReimbursementReportingDashboard";
import CustomerReviewReportingDashboard from "./CustomerReviewReportingDashboard";
import MissingPaymentReportingDashboard from "./MissingPaymentReportingDashboard";
import UserRoleManager from "./UserRoleManager";
import PerformanceReportsList from "./PerformanceReportsList";
import AdminMisconductResponses from "./AdminMisconductResponses";
import DeductiblesReport from "./DeductiblesReport";
import AdminViolenceIncidentList from "./AdminViolenceIncidentList";
import AdminSidebar from "./AdminSidebar";
import AdminTodoList from "./AdminTodoList";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToExcel, exportReviewBonusesToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [exportingReviews, setExportingReviews] = useState(false);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  const [pendingCounts, setPendingCounts] = useState({
    reimbursements: 0,
    reviews: 0,
    appeals: 0,
    missingPayments: 0,
    misconductReplies: 0,
  });
  
  // Date filters for reimbursements
  const [reimbStartDate, setReimbStartDate] = useState<Date | undefined>();
  const [reimbEndDate, setReimbEndDate] = useState<Date | undefined>();
  
  // Date filters for reviews
  const [reviewStartDate, setReviewStartDate] = useState<Date | undefined>();
  const [reviewEndDate, setReviewEndDate] = useState<Date | undefined>();
  
  // Date filters for missing payments
  const [missingPaymentStartDate, setMissingPaymentStartDate] = useState<Date | undefined>();
  const [missingPaymentEndDate, setMissingPaymentEndDate] = useState<Date | undefined>();
  
  const t = dashboardTranslations[language];

  useEffect(() => {
    fetchPendingCounts();
  }, [refreshKey]);

  const fetchPendingCounts = async () => {
    try {
      const { count: reimbCount } = await supabase
        .from("reimbursements")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: reviewCount } = await supabase
        .from("review_bonuses")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      const { count: appealReimbCount } = await supabase
        .from("reimbursements")
        .select("*", { count: "exact", head: true })
        .eq("status", "appeal");

      const { count: appealReviewCount } = await supabase
        .from("review_bonuses")
        .select("*", { count: "exact", head: true })
        .eq("status", "appeal");

      const { count: missingPaymentCount } = await supabase
        .from("missing_payments")
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "appeal"]);

      // Count unread mover replies
      const { count: misconductReplyCount } = await supabase
        .from("performance_misconduct_messages")
        .select("*", { count: "exact", head: true })
        .eq("is_admin_message", false)
        .eq("is_read", false);

      setPendingCounts({
        reimbursements: (reimbCount || 0) + (appealReimbCount || 0),
        reviews: (reviewCount || 0) + (appealReviewCount || 0),
        appeals: (appealReimbCount || 0) + (appealReviewCount || 0),
        missingPayments: missingPaymentCount || 0,
        misconductReplies: misconductReplyCount || 0,
      });
    } catch (error) {
      console.error("Error fetching pending counts:", error);
    }
  };

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

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Admin Dashboard</h2>
            <AdminTodoList onNavigate={setActiveTab} />
          </div>
        );
      case "requests":
        return (
          <div className="space-y-6">
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
          </div>
        );
      case "reviews":
        return (
          <div className="space-y-6">
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
          </div>
        );
      case "missing-payments":
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h2 className="text-2xl font-bold">Missing Payment Submissions</h2>
              </div>
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
          </div>
        );
      case "reimbursement-reports":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Reimbursement Reporting</h2>
            <ReimbursementReportingDashboard language={language} />
          </div>
        );
      case "review-reports":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Customer Review Reporting</h2>
            <CustomerReviewReportingDashboard language={language} />
          </div>
        );
      case "missing-payment-reports":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Missing Payment Reporting</h2>
            <MissingPaymentReportingDashboard language={language} />
          </div>
        );
      case "performance-reports":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Performance / Misconduct Reports</h2>
            <PerformanceReportsList 
              refreshKey={refreshKey} 
              onRefresh={() => setRefreshKey((prev) => prev + 1)} 
              userRole="admin" 
            />
          </div>
        );
      case "misconduct-responses":
        return (
          <div className="space-y-6">
            <AdminMisconductResponses />
          </div>
        );
      case "deductibles":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Deductibles Report</h2>
            <DeductiblesReport isAdmin={true} />
          </div>
        );
      case "violence-incidents":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Violence Incident Reports</h2>
            <AdminViolenceIncidentList userRole="admin" />
          </div>
        );
      case "movers":
        return <MoversList language={language} />;
      case "roles":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">User Role Management</h2>
            <UserRoleManager language={language} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AdminSidebar 
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          pendingCounts={pendingCounts}
        />
        <SidebarInset>
          <header className="flex h-14 items-center gap-4 border-b bg-background px-6">
            <SidebarTrigger className="md:hidden" />
            <div className="flex-1" />
            <LanguageSelector language={language} onLanguageChange={setLanguage} />
          </header>
          <main className="flex-1 p-6">
            {renderContent()}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;

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
import AdminAlcoholTestList from "./AdminAlcoholTestList";
import AdminSidebar from "./AdminSidebar";
import AdminTodoList from "./AdminTodoList";
import ChatContainer from "./chat/ChatContainer";
import UserSettings from "./UserSettings";
import HandbookManager from "./HandbookManager";
import ConsentDocumentManager from "./ConsentDocumentManager";
import UserActivityLog from "./UserActivityLog";
import { AdminFeedbackList } from "./AdminFeedbackList";
import { AdminAIAssistant } from "./AdminAIAssistant";
import { FeedManager } from "./feed/FeedManager";
import AdminEmailLogs from "./AdminEmailLogs";
import AdminPaymentQuestionList from "./AdminPaymentQuestionList";
import AdminCustomerRefundList from "./AdminCustomerRefundList";
import CustomerRefundForm from "./CustomerRefundForm";
import AdminReferralList from "./AdminReferralList";
import AdminShiftManagement from "./AdminShiftManagement";
import AdminKnowledgeBase from "./AdminKnowledgeBase";
import AdminOfficeAIKnowledge from "./AdminOfficeAIKnowledge";
import AdminTestPushButton from "./AdminTestPushButton";
import AdminSignupApprovals from "./AdminSignupApprovals";
import MoverRatingsPage from "@/components/ratings/MoverRatingsPage";
import { Button } from "@/components/ui/button";
import { Download, PlayCircle, Search, Plus, X } from "lucide-react";
import { exportToExcel, exportReviewBonusesToExcel, exportMissingPaymentsToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { format } from "date-fns";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface AdminDashboardProps {
  userId: string;
}

const AdminDashboard = ({ userId }: AdminDashboardProps) => {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showRefundForm, setShowRefundForm] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingReviews, setExportingReviews] = useState(false);
  const [runningAlcoholCheck, setRunningAlcoholCheck] = useState(false);
  const [exportingMissingPayments, setExportingMissingPayments] = useState(false);
  const { language, setLanguage } = useLanguage();
  const [pendingCounts, setPendingCounts] = useState({
    reimbursements: 0,
    reviews: 0,
    appeals: 0,
    missingPayments: 0,
    misconductReplies: 0,
    moverFeedback: 0,
    performanceReports: 0,
    violenceIncidents: 0,
    alcoholTests: 0,
    customerRefunds: 0,
    paymentQuestions: 0,
    referrals: 0,
    signupApprovals: 0,
  });
  
  // Date filters for reimbursements
  const [reimbStartDate, setReimbStartDate] = useState<Date | undefined>();
  const [reimbEndDate, setReimbEndDate] = useState<Date | undefined>();
  const [reimbSearchNumber, setReimbSearchNumber] = useState("");
  
  
  // Date filters for reviews
  const [reviewStartDate, setReviewStartDate] = useState<Date | undefined>();
  const [reviewEndDate, setReviewEndDate] = useState<Date | undefined>();
  
  // Date filters for missing payments
  const [missingPaymentStartDate, setMissingPaymentStartDate] = useState<Date | undefined>();
  const [missingPaymentEndDate, setMissingPaymentEndDate] = useState<Date | undefined>();
  
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);
  
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

      // Count pending mover feedback
      const { count: moverFeedbackCount } = await supabase
        .from("mover_feedback")
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Count unreviewed performance reports (reviewed_at is null)
      const { count: performanceReportsCount } = await supabase
        .from("performance_reports")
        .select("*", { count: "exact", head: true })
        .is("reviewed_at", null);

      // Count unreviewed violence incidents (no admin_actions)
      const { count: violenceIncidentsCount } = await supabase
        .from("violence_incidents")
        .select("*", { count: "exact", head: true })
        .is("admin_actions", null);

      // Count unreviewed alcohol test reports (reviewed_at is null)
      const { count: alcoholTestsCount } = await supabase
        .from("alcohol_test_reports")
        .select("*", { count: "exact", head: true })
        .is("reviewed_at", null);

      // Count pending customer refunds only
      const { count: customerRefundsCount } = await supabase
        .from("customer_refunds" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "pending");

      // Count open payment questions
      const { count: paymentQuestionsCount } = await supabase
        .from("payment_questions")
        .select("*", { count: "exact", head: true })
        .eq("status", "open");

      // Count pending referrals
      const { count: referralsCount } = await supabase
        .from("referral_requests" as any)
        .select("*", { count: "exact", head: true })
        .in("status", ["pending", "bonus_claimed"]);

      // Count pending signup approvals
      const { count: signupApprovalsCount } = await (supabase
        .from("profiles")
        .select("*", { count: "exact", head: true }) as any)
        .eq("signup_status", "pending");

      setPendingCounts({
        reimbursements: (reimbCount || 0) + (appealReimbCount || 0),
        reviews: (reviewCount || 0) + (appealReviewCount || 0),
        appeals: (appealReimbCount || 0) + (appealReviewCount || 0),
        missingPayments: missingPaymentCount || 0,
        misconductReplies: misconductReplyCount || 0,
        moverFeedback: moverFeedbackCount || 0,
        performanceReports: performanceReportsCount || 0,
        violenceIncidents: violenceIncidentsCount || 0,
        alcoholTests: alcoholTestsCount || 0,
        customerRefunds: customerRefundsCount || 0,
        paymentQuestions: paymentQuestionsCount || 0,
        referrals: referralsCount || 0,
        signupApprovals: signupApprovalsCount || 0,
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

  const handleRunAlcoholCheck = async () => {
    setRunningAlcoholCheck(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-missing-alcohol-tests", {});
      
      if (error) throw error;
      
      if (data.missingCount === 0) {
        toast.success("All movers have alcohol test reports for the past week");
      } else {
        toast.success(`Alert sent: ${data.missingCount} mover(s) missing alcohol test reports`);
      }
    } catch (error: any) {
      console.error("Error running alcohol check:", error);
      toast.error(error.message || "Failed to run alcohol test check");
    } finally {
      setRunningAlcoholCheck(false);
    }
  };

  const handleExportMissingPayments = async () => {
    setExportingMissingPayments(true);
    try {
      let query = supabase
        .from("missing_payments")
        .select("*")
        .order("created_at", { ascending: false });

      if (missingPaymentStartDate) {
        query = query.gte("created_at", format(missingPaymentStartDate, "yyyy-MM-dd"));
      }
      if (missingPaymentEndDate) {
        const endDatePlusOne = new Date(missingPaymentEndDate);
        endDatePlusOne.setDate(endDatePlusOne.getDate() + 1);
        query = query.lt("created_at", format(endDatePlusOne, "yyyy-MM-dd"));
      }

      const { data, error } = await query;

      if (error) throw error;

      if (data) {
        exportMissingPaymentsToExcel(data, "missing-payments");
        toast.success(t.exportComplete);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExportingMissingPayments(false);
    }
  };

  const renderContent = () => {
    switch (activeTab) {
      case "dashboard":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <h2 className="text-2xl font-bold">Admin Dashboard</h2>
              <AdminTestPushButton />
            </div>
            <AdminTodoList onNavigate={(tab) => { setActiveTab(tab); }} />
          </div>
        );
      case "signup-approvals":
        return <AdminSignupApprovals />;
      case "feed":
        return <FeedManager userId={userId} />;
      case "requests":
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold">{t.allReimbursementRequests}</h2>
                <div className="flex gap-2">
                  <Button onClick={handleExportReimbursements} disabled={exporting} size="sm" className="self-start sm:self-auto">
                    <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                    <span className="hidden sm:inline">{exporting ? t.exporting : t.exportToExcel}</span>
                    <span className="sm:hidden">Export</span>
                  </Button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
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
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by Reimbursement #"
                    value={reimbSearchNumber}
                    onChange={(e) => setReimbSearchNumber(e.target.value)}
                    className="pl-9 pr-3 py-2 text-sm border rounded-md bg-background w-full sm:w-56 h-10"
                  />
                </div>
              </div>
            </div>
            <ReimbursementHistory 
              refreshKey={refreshKey} 
              userRole="admin" 
              onUpdate={() => setRefreshKey((prev) => prev + 1)} 
              language={language}
              startDate={reimbStartDate}
              endDate={reimbEndDate}
              
              searchNumber={reimbSearchNumber}
            />
          </div>
        );
      case "reviews":
        return (
          <div className="space-y-6">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold">Review Bonus Submissions</h2>
                <Button onClick={handleExportReviews} disabled={exportingReviews} size="sm" className="self-start sm:self-auto">
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">{exportingReviews ? t.exporting : t.exportToExcel}</span>
                  <span className="sm:hidden">Export</span>
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-xl md:text-2xl font-bold">Missing Payment Submissions</h2>
                <Button onClick={handleExportMissingPayments} disabled={exportingMissingPayments} size="sm" className="self-start sm:self-auto">
                  <Download className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
                  <span className="hidden sm:inline">{exportingMissingPayments ? t.exporting : t.exportToExcel}</span>
                  <span className="sm:hidden">Export</span>
                </Button>
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
      case "alcohol-tests":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">Alcohol Test Reports</h2>
              <Button 
                onClick={handleRunAlcoholCheck} 
                disabled={runningAlcoholCheck}
                variant="outline"
              >
                <PlayCircle className="h-4 w-4 mr-2" />
                {runningAlcoholCheck ? "Checking..." : "Run Weekly Check"}
              </Button>
            </div>
            <AdminAlcoholTestList language={language} onRefresh={() => setRefreshKey((prev) => prev + 1)} />
          </div>
        );
      case "payment-questions":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Payment Questions</h2>
            <AdminPaymentQuestionList language={language} userId={userId} />
          </div>
        );
      case "mover-feedback":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Mover Feedback & Suggestions</h2>
            <AdminFeedbackList />
          </div>
        );
      case "handbook":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Handbook Management</h2>
            <HandbookManager language={language} />
          </div>
        );
      case "email-logs":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Email Logs</h2>
            <AdminEmailLogs />
          </div>
        );
      case "consent-documents":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Consent Documents</h2>
            <ConsentDocumentManager />
          </div>
        );
      case "user-activity":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">User Activity Log</h2>
            <UserActivityLog />
          </div>
        );
      case "customer-refunds":
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-2xl font-bold">Customer Refunds</h2>
              <Button
                onClick={() => setShowRefundForm((prev) => !prev)}
                variant={showRefundForm ? "outline" : "default"}
                size="sm"
              >
                {showRefundForm ? (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Hide Form
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Submit Refund
                  </>
                )}
              </Button>
            </div>
            {showRefundForm && (
              <CustomerRefundForm
                userId={userId}
                language={language}
                onSubmitted={() => {
                  setRefreshKey((k) => k + 1);
                  setShowRefundForm(false);
                }}
              />
            )}
            <AdminCustomerRefundList key={refreshKey} />
          </div>
        );
      case "referrals":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Referral Requests</h2>
            <AdminReferralList language={language} />
          </div>
        );
      case "shift-schedule":
        return <AdminShiftManagement userId={userId} language={language} />;
      case "knowledge-base":
        return (
          <div className="space-y-6">
            <AdminKnowledgeBase userId={userId} />
          </div>
        );
      case "office-ai-knowledge":
        return (
          <div className="space-y-6">
            <AdminOfficeAIKnowledge userId={userId} />
          </div>
        );
      case "chat":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Chat</h2>
            <ChatContainer userId={userId} userRole="admin" language={language} />
          </div>
        );
      case "movers":
        return <MoversList language={language} />;
      case "mover-ratings":
        return <MoverRatingsPage />;
      case "roles":
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">User Management</h2>
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
          onTabChange={async (tab) => {
            setActiveTab(tab);
            try {
              let didMarkReviewed = false;
              if (tab === "performance-reports") {
                const { error } = await supabase
                  .from("performance_reports")
                  .update({ reviewed_at: new Date().toISOString() })
                  .is("reviewed_at", null);
                didMarkReviewed = !error;
              } else if (tab === "alcohol-tests") {
                const { error } = await supabase
                  .from("alcohol_test_reports")
                  .update({ reviewed_at: new Date().toISOString() })
                  .is("reviewed_at", null);
                didMarkReviewed = !error;
              }

              if (didMarkReviewed) {
                setRefreshKey((k) => k + 1);
              }
            } catch (e) {
              console.error("Failed to mark reports reviewed", e);
            }
            setTimeout(() => setRefreshKey((k) => k + 1), 600);
          }}
          pendingCounts={pendingCounts}
          hasUnreadMessages={hasUnreadMessages}
        />
        <SidebarInset>
          <header className="flex h-12 md:h-14 items-center gap-2 md:gap-4 border-b bg-background px-3 md:px-6">
            <SidebarTrigger />
            <div className="flex-1" />
            <UserSettings userId={userId} language={language} />
            <LanguageSelector language={language} onLanguageChange={setLanguage} />
          </header>
          <main className="flex-1 p-6">
            {renderContent()}
          </main>
        </SidebarInset>
        <AdminAIAssistant />
      </div>
    </SidebarProvider>
  );
};

export default AdminDashboard;

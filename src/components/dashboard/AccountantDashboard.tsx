import { useState } from "react";
import { useDeepLink } from "@/hooks/useDeepLink";
import ReimbursementHistory from "./ReimbursementHistory";
import MoversList from "./MoversList";
import ChatContainer from "./chat/ChatContainer";
import AdminPaymentQuestionList from "./AdminPaymentQuestionList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, MessageSquare, HelpCircle, GraduationCap, Receipt, Users, Clock } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/lib/i18n";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import UserSettings from "./UserSettings";
import ShiftSchedule from "./ShiftSchedule";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import MobileShell, { type MobileShellNavItem } from "@/components/mobile/MobileShell";

interface AccountantDashboardProps {
  userId: string;
}

const AccountantDashboard = ({ userId }: AccountantDashboardProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { t: ti18n } = useT();
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);
  const [activeTab, setActiveTab] = useState<string>("requests");
  useDeepLink("accountant", setActiveTab);

  const t = dashboardTranslations[language];

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data, error } = await supabase
        .from("reimbursements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      if (data) {
        exportToExcel(data, "accountant-reimbursements");
        toast.success(t.exportComplete);
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  const navItems = [
    { id: "requests", label: ti18n("nav.confirmedReimbursements"), icon: Receipt },
    { id: "movers", label: ti18n("nav.moversDirectory"), icon: Users },
    { id: "payment-questions", label: ti18n("nav.paymentQuestions"), icon: HelpCircle },
    { id: "chat", label: ti18n("nav.chat"), icon: MessageSquare },
    { id: "shift-schedule", label: ti18n("nav.shiftSchedule"), icon: Clock },
    { id: "knowledge-base", label: ti18n("nav.knowledgeBase"), icon: GraduationCap },
  ];

  const shellNav: MobileShellNavItem[] = navItems.map((n) => ({
    id: n.id,
    label: n.label,
    icon: n.icon,
    dot: n.id === "chat" && hasUnreadMessages,
    badgeCount: n.id === "chat" && hasUnreadMessages ? 1 : 0,
  }));

  const renderContent = () => {
    switch (activeTab) {
      case "requests":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <Button onClick={handleExport} disabled={exporting} size="sm">
                <Download className="h-3.5 w-3.5 mr-1" />
                Export
              </Button>
            </div>
            <ReimbursementHistory refreshKey={refreshKey} userRole="accountant" onUpdate={() => setRefreshKey((prev) => prev + 1)} language={language} />
          </div>
        );
      case "movers":
        return <MoversList language={language} />;
      case "payment-questions":
        return <AdminPaymentQuestionList language={language} userId={userId} />;
      case "chat":
        return <ChatContainer userId={userId} userRole="accountant" language={language} />;
      case "shift-schedule":
        return <ShiftSchedule userId={userId} language={language} />;
      case "knowledge-base":
        return <KnowledgeBaseViewer userId={userId} />;
      default:
        return null;
    }
  };

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
      <div className="space-y-6">
        <div className="flex justify-end gap-2">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="flex gap-1 h-auto p-1">
            <TabsTrigger value="requests" className="text-sm px-3 py-1.5">{t.confirmedReimbursements}</TabsTrigger>
            <TabsTrigger value="movers" className="text-sm px-3 py-1.5">{t.moversDirectory}</TabsTrigger>
            <TabsTrigger value="payment-questions" className="text-sm px-3 py-1.5">
              <HelpCircle className="h-4 w-4 mr-2" />
              Payment Questions
            </TabsTrigger>
            <TabsTrigger value="chat" className="relative text-sm px-3 py-1.5">
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="shift-schedule" className="text-sm px-3 py-1.5">Shift Schedule</TabsTrigger>
            <TabsTrigger value="knowledge-base" className="text-sm px-3 py-1.5">
              <GraduationCap className="h-4 w-4 mr-2" />
              Knowledge Base
            </TabsTrigger>
          </TabsList>

          <TabsContent value="requests" className="space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold">{t.confirmedReimbursements}</h2>
              <Button onClick={handleExport} disabled={exporting}>
                <Download className="h-4 w-4 mr-2" />
                {exporting ? t.exporting : t.exportToExcel}
              </Button>
            </div>
            <ReimbursementHistory refreshKey={refreshKey} userRole="accountant" onUpdate={() => setRefreshKey((prev) => prev + 1)} language={language} />
          </TabsContent>

          <TabsContent value="movers">
            <MoversList language={language} />
          </TabsContent>

          <TabsContent value="payment-questions" className="space-y-6">
            <h2 className="text-2xl font-bold">Payment Questions</h2>
            <AdminPaymentQuestionList language={language} userId={userId} />
          </TabsContent>

          <TabsContent value="chat" className="space-y-6">
            <h2 className="text-2xl font-bold">Chat</h2>
            <ChatContainer userId={userId} userRole="accountant" language={language} />
          </TabsContent>

          <TabsContent value="shift-schedule">
            <ShiftSchedule userId={userId} language={language} />
          </TabsContent>

          <TabsContent value="knowledge-base" className="space-y-6">
            <KnowledgeBaseViewer userId={userId} />
          </TabsContent>
        </Tabs>
      </div>
    </MobileShell>
  );
};

export default AccountantDashboard;

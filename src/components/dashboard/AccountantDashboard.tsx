import { useState } from "react";
import ReimbursementHistory from "./ReimbursementHistory";
import MoversList from "./MoversList";
import ChatContainer from "./chat/ChatContainer";
import AdminPaymentQuestionList from "./AdminPaymentQuestionList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, MessageSquare, HelpCircle, GraduationCap } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { dashboardTranslations } from "@/lib/dashboardTranslations";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import UserSettings from "./UserSettings";
import ShiftSchedule from "./ShiftSchedule";

interface AccountantDashboardProps {
  userId: string;
}

const AccountantDashboard = ({ userId }: AccountantDashboardProps) => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const { language, setLanguage } = useLanguage();
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);
  
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

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <UserSettings userId={userId} language={language} />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="requests" className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="inline-flex min-w-max md:flex gap-1 h-auto p-1">
            <TabsTrigger value="requests" className="text-xs md:text-sm px-2 md:px-3 py-1.5">{t.confirmedReimbursements}</TabsTrigger>
            <TabsTrigger value="movers" className="text-xs md:text-sm px-2 md:px-3 py-1.5">{t.moversDirectory}</TabsTrigger>
            <TabsTrigger value="payment-questions" className="text-xs md:text-sm px-2 md:px-3 py-1.5">
              <HelpCircle className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Payment Questions
            </TabsTrigger>
            <TabsTrigger value="chat" className="relative text-xs md:text-sm px-2 md:px-3 py-1.5">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2" />
              Chat
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="shift-schedule" className="text-xs md:text-sm px-2 md:px-3 py-1.5">Shift Schedule</TabsTrigger>
          </TabsList>
        </div>
        
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
      </Tabs>
    </div>
  );
};

export default AccountantDashboard;

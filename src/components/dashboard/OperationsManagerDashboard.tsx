import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield, MessageSquare, Wine, DollarSign } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import PerformanceReportsList from "./PerformanceReportsList";
import AdminViolenceIncidentList from "./AdminViolenceIncidentList";
import AlcoholTestReportForm from "./AlcoholTestReportForm";
import CustomerRefundForm from "./CustomerRefundForm";
import ChatContainer from "./chat/ChatContainer";
import UserSettings from "./UserSettings";
import ShiftSchedule from "./ShiftSchedule";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface OperationsManagerDashboardProps {
  userId: string;
}

const OperationsManagerDashboard = ({ userId }: OperationsManagerDashboardProps) => {
  const { language, setLanguage } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <UserSettings userId={userId} language={language} />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="reports" className="w-full">
        <div className="overflow-x-auto -mx-3 px-3 md:mx-0 md:px-0">
          <TabsList className="inline-flex min-w-max md:flex gap-1 h-auto p-1">
            <TabsTrigger value="reports" className="text-[11px] md:text-sm px-2 md:px-3 py-1.5">
              <FileText className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Performance Reports</span>
              <span className="sm:hidden">Reports</span>
            </TabsTrigger>
            <TabsTrigger value="violence" className="text-[11px] md:text-sm px-2 md:px-3 py-1.5">
              <Shield className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Violence Incidents</span>
              <span className="sm:hidden">Incidents</span>
            </TabsTrigger>
            <TabsTrigger value="alcohol-test" className="text-[11px] md:text-sm px-2 md:px-3 py-1.5">
              <Wine className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Alcohol Testing</span>
              <span className="sm:hidden">Alcohol</span>
            </TabsTrigger>
            <TabsTrigger value="customer-refund" className="text-[11px] md:text-sm px-2 md:px-3 py-1.5">
              <DollarSign className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              <span className="hidden sm:inline">Customer Refund</span>
              <span className="sm:hidden">Refund</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="relative text-[11px] md:text-sm px-2 md:px-3 py-1.5">
              <MessageSquare className="h-3 w-3 md:h-4 md:w-4 mr-1 md:mr-2 flex-shrink-0" />
              Chat
              {hasUnreadMessages && (
                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </TabsTrigger>
            <TabsTrigger value="shift-schedule" className="text-[11px] md:text-sm px-2 md:px-3 py-1.5">
              Shift Schedule
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="reports" className="space-y-4 md:space-y-6">
          <PerformanceReportsList 
            refreshKey={refreshKey} 
            onRefresh={() => setRefreshKey(prev => prev + 1)} 
          />
        </TabsContent>

        <TabsContent value="violence" className="space-y-4 md:space-y-6">
          <h2 className="text-lg md:text-2xl font-bold">Violence Incident Reports</h2>
          <AdminViolenceIncidentList userRole="operations_manager" />
        </TabsContent>

        <TabsContent value="alcohol-test" className="space-y-4 md:space-y-6">
          <AlcoholTestReportForm userId={userId} language={language} />
        </TabsContent>

        <TabsContent value="customer-refund" className="space-y-4 md:space-y-6">
          <CustomerRefundForm userId={userId} language={language} />
        </TabsContent>

        <TabsContent value="chat" className="space-y-4 md:space-y-6">
          <h2 className="text-lg md:text-2xl font-bold">Chat</h2>
          <ChatContainer userId={userId} userRole="operations_manager" language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperationsManagerDashboard;

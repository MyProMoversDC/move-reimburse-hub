import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield, MessageSquare } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import PerformanceReportsList from "./PerformanceReportsList";
import AdminViolenceIncidentList from "./AdminViolenceIncidentList";
import ChatContainer from "./chat/ChatContainer";
import UserSettings from "./UserSettings";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

interface OperationsManagerDashboardProps {
  userId: string;
}

const OperationsManagerDashboard = ({ userId }: OperationsManagerDashboardProps) => {
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  const [refreshKey, setRefreshKey] = useState(0);
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <UserSettings userId={userId} language={language} />
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="reports" className="w-full">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="reports">
            <FileText className="h-4 w-4 mr-2" />
            Performance Reports
          </TabsTrigger>
          <TabsTrigger value="violence">
            <Shield className="h-4 w-4 mr-2" />
            Violence Incidents
          </TabsTrigger>
          <TabsTrigger value="chat" className="relative">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
            {hasUnreadMessages && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="reports" className="space-y-6">
          <PerformanceReportsList 
            refreshKey={refreshKey} 
            onRefresh={() => setRefreshKey(prev => prev + 1)} 
          />
        </TabsContent>

        <TabsContent value="violence" className="space-y-6">
          <h2 className="text-2xl font-bold">Violence Incident Reports</h2>
          <AdminViolenceIncidentList userRole="operations_manager" />
        </TabsContent>

        <TabsContent value="chat" className="space-y-6">
          <h2 className="text-2xl font-bold">Chat</h2>
          <ChatContainer userId={userId} userRole="operations_manager" language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperationsManagerDashboard;

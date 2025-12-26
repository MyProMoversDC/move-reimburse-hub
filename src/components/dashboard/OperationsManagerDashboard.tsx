import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Shield } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import PerformanceReportsList from "./PerformanceReportsList";
import AdminViolenceIncidentList from "./AdminViolenceIncidentList";

const OperationsManagerDashboard = () => {
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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
      </Tabs>
    </div>
  );
};

export default OperationsManagerDashboard;

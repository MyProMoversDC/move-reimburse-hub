import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { DashboardLanguage } from "@/lib/dashboardTranslations";
import PerformanceReportsList from "./PerformanceReportsList";

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
        </TabsList>
        
        <TabsContent value="reports" className="space-y-6">
          <PerformanceReportsList 
            refreshKey={refreshKey} 
            onRefresh={() => setRefreshKey(prev => prev + 1)} 
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default OperationsManagerDashboard;

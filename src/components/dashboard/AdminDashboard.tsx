import { useState } from "react";
import ReimbursementHistory from "./ReimbursementHistory";
import MoversList from "./MoversList";
import AdminReviewBonusList from "./AdminReviewBonusList";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, Star } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LanguageSelector } from "@/components/LanguageSelector";
import { dashboardTranslations, DashboardLanguage } from "@/lib/dashboardTranslations";

const AdminDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [language, setLanguage] = useState<DashboardLanguage>('en');
  
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
        exportToExcel(data, "admin-reimbursements");
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
      <div className="flex justify-end">
        <LanguageSelector language={language} onLanguageChange={setLanguage} />
      </div>
      
      <Tabs defaultValue="requests" className="w-full">
        <TabsList>
          <TabsTrigger value="requests">{t.reimbursementRequests}</TabsTrigger>
          <TabsTrigger value="reviews">
            <Star className="h-4 w-4 mr-2" />
            Review Bonuses
          </TabsTrigger>
          <TabsTrigger value="movers">{t.moversDirectory}</TabsTrigger>
        </TabsList>
        
        <TabsContent value="requests" className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">{t.allReimbursementRequests}</h2>
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="h-4 w-4 mr-2" />
              {exporting ? t.exporting : t.exportToExcel}
            </Button>
          </div>
          <ReimbursementHistory refreshKey={refreshKey} userRole="admin" onUpdate={() => setRefreshKey((prev) => prev + 1)} language={language} />
        </TabsContent>

        <TabsContent value="reviews" className="space-y-6">
          <h2 className="text-2xl font-bold">Review Bonus Submissions</h2>
          <AdminReviewBonusList language={language} />
        </TabsContent>
        
        <TabsContent value="movers">
          <MoversList language={language} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminDashboard;

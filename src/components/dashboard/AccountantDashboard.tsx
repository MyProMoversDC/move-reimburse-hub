import { useState } from "react";
import ReimbursementHistory from "./ReimbursementHistory";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { exportToExcel } from "@/lib/exportToExcel";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AccountantDashboard = () => {
  const [refreshKey, setRefreshKey] = useState(0);
  const [exporting, setExporting] = useState(false);

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
        toast.success("Export complete!");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Confirmed Reimbursements</h2>
        <Button onClick={handleExport} disabled={exporting}>
          <Download className="h-4 w-4 mr-2" />
          {exporting ? "Exporting..." : "Export to Excel"}
        </Button>
      </div>
      <ReimbursementHistory refreshKey={refreshKey} userRole="accountant" onUpdate={() => setRefreshKey((prev) => prev + 1)} />
    </div>
  );
};

export default AccountantDashboard;

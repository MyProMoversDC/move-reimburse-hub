import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Plus } from "lucide-react";
import ReimbursementForm from "./ReimbursementForm";
import ReimbursementHistory from "./ReimbursementHistory";

interface MoverDashboardProps {
  userId: string;
}

const MoverDashboard = ({ userId }: MoverDashboardProps) => {
  const [showForm, setShowForm] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSubmitSuccess = () => {
    setShowForm(false);
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="space-y-6">
      {!showForm && (
        <Card className="p-6">
          <Button onClick={() => setShowForm(true)} className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Submit New Reimbursement
          </Button>
        </Card>
      )}

      {showForm && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">New Reimbursement Request</h2>
            <Button variant="outline" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
          <ReimbursementForm userId={userId} onSuccess={handleSubmitSuccess} />
        </Card>
      )}

      <div>
        <h2 className="text-2xl font-bold mb-4">Reimbursement History</h2>
        <ReimbursementHistory userId={userId} refreshKey={refreshKey} userRole="mover" />
      </div>
    </div>
  );
};

export default MoverDashboard;

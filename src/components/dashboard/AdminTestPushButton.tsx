import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminTestPushButton = () => {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-notification", {
        body: { test: true },
      });
      if (error) throw error;
      const sent = (data as any)?.sent ?? 0;
      if (sent > 0) toast.success(`Test push sent to ${sent} device(s).`);
      else toast.info("No registered devices for your account yet. Install the mobile app and sign in first.");
    } catch (e: any) {
      toast.error(e?.message ?? "Failed to send test push");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button onClick={handleClick} disabled={loading} variant="outline" size="sm">
      <Bell className="h-4 w-4 mr-2" />
      {loading ? "Sending..." : "Send Test Push"}
    </Button>
  );
};

export default AdminTestPushButton;

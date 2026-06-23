import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import logo from "@/assets/logo.png";

const MoverClockRedeem = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const action = params.get("action");
    const token = params.get("token");

    const run = async () => {
      if (!action || !token) {
        setStatus("error");
        setMessage("Invalid QR code link.");
        return;
      }
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate(`/auth?redirect=${encodeURIComponent(`/mover/clock?action=${action}&token=${token}`)}`);
        return;
      }
      const { data, error } = await supabase.rpc("redeem_mover_shift_qr" as any, { _action: action, _token: token });
      if (error) {
        setStatus("error");
        setMessage(error.message);
        return;
      }
      const r = data as any;
      if (!r?.ok) {
        const map: Record<string, string> = {
          not_authenticated: "Please sign in first.",
          not_a_mover: "Only movers can use this QR code.",
          invalid_token: "This QR code is no longer valid. Ask the admin to print the latest one.",
          already_clocked_in: "You are already clocked in.",
          not_clocked_in: "You are not currently clocked in.",
          bad_action: "Invalid action.",
        };
        setStatus("error");
        setMessage(map[r?.error] || "Unable to process this scan.");
      } else {
        setStatus("success");
        setMessage(r.action === "in" ? "Clocked in successfully!" : "Clocked out successfully!");
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardContent className="py-10 flex flex-col items-center text-center gap-4">
          <img src={logo} alt="MyProMovers" className="h-12" />
          {status === "loading" && (
            <>
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
              <p>Processing scan…</p>
            </>
          )}
          {status === "success" && (
            <>
              <CheckCircle2 className="h-14 w-14 text-green-600" />
              <h1 className="text-xl font-bold">{message}</h1>
            </>
          )}
          {status === "error" && (
            <>
              <XCircle className="h-14 w-14 text-destructive" />
              <h1 className="text-xl font-bold">Something went wrong</h1>
              <p className="text-sm text-muted-foreground">{message}</p>
            </>
          )}
          {status !== "loading" && (
            <Button onClick={() => navigate("/dashboard")} className="w-full">Go to Dashboard</Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default MoverClockRedeem;

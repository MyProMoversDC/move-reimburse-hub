import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { z } from "zod";
import { handleError } from "@/lib/errorHandler";
import { translations } from "@/lib/translations";
import { useLanguage } from "@/contexts/LanguageContext";

const ResetPassword = () => {
  const navigate = useNavigate();
  const { language } = useLanguage();
  const t = translations[language];
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  useEffect(() => {
    let cancelled = false;

    const prepareRecoverySession = async () => {
      const searchParams = new URLSearchParams(window.location.search);
      const authCode = searchParams.get("code");
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      if (tokenHash && type === "recovery") {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: "recovery",
        });

        if (!cancelled) {
          if (error) {
            toast.error(handleError(error));
          } else {
            setReady(true);
          }
        }
        return;
      }

      if (authCode) {
        const { error } = await supabase.auth.exchangeCodeForSession(authCode);
        if (!cancelled) {
          if (error) {
            toast.error(handleError(error));
          } else {
            setReady(true);
          }
        }
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!cancelled && session) setReady(true);
    };

    // Recovery links may arrive with tokens in the hash or with a one-time code.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setReady(true);
      }
    });

    prepareRecoverySession();

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const schema = z.object({
        password: z.string().min(6, t.passwordMinLength),
      });
      const v = schema.parse({ password });
      if (password !== confirm) {
        toast.error("Passwords do not match");
        return;
      }
      setLoading(true);
      const { error } = await supabase.auth.updateUser({ password: v.password });
      if (error) throw error;
      toast.success("Password updated successfully");
      await supabase.auth.signOut();
      navigate("/auth");
    } catch (err: unknown) {
      toast.error(handleError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img src={logo} alt="MyProMovers" className="h-16 mx-auto mb-4" />
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            {ready ? "Enter a new password for your account." : "Validating reset link..."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">{t.password}</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={!ready}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input
                id="confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                disabled={!ready}
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading || !ready}>
              {loading ? "Updating..." : "Update password"}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
              Back to login
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;

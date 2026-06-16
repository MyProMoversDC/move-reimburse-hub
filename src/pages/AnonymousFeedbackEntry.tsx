import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const REDIRECT_TARGET = "/dashboard?tab=anonymous-feedback";

const AnonymousFeedbackEntry = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(REDIRECT_TARGET, { replace: true });
      } else {
        navigate(`/auth?redirect=${encodeURIComponent(REDIRECT_TARGET)}`, { replace: true });
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Loading…</p>
    </div>
  );
};

export default AnonymousFeedbackEntry;

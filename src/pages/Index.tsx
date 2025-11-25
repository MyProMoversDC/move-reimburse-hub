import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate("/dashboard");
      }
    });
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/20 to-background p-4">
      <div className="text-center space-y-8 p-8">
        <img src={logo} alt="MyProMovers" className="h-24 mx-auto mb-8" />
        <h1 className="text-5xl font-bold text-foreground">
          Reimbursement Portal
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
          Submit and track your long-distance move reimbursements
        </p>
        <div className="flex gap-4 justify-center">
          <Button size="lg" onClick={() => navigate("/auth")}>
            Sign Up
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
            Login
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;

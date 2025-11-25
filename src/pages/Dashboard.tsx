import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MoverDashboard from "@/components/dashboard/MoverDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

type UserRole = "mover" | "admin" | "accountant";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>("");

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);

      // Fetch user profile and roles
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        setUserName(`${profile.first_name} ${profile.last_name}`);
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (roles && roles.length > 0) {
        // Priority: admin > accountant > mover
        if (roles.some((r) => r.role === "admin")) {
          setUserRole("admin");
        } else if (roles.some((r) => r.role === "accountant")) {
          setUserRole("accountant");
        } else {
          setUserRole("mover");
        }
      }

      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!userRole || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No role assigned</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={logo} alt="MyProMovers" className="h-12" />
            <div>
              <h1 className="text-xl font-bold">
                {userRole === "admin" && "Admin Portal"}
                {userRole === "accountant" && "Accountant Portal"}
                {userRole === "mover" && "Mover Portal"}
              </h1>
              <p className="text-sm text-muted-foreground">{userName}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {userRole === "mover" && <MoverDashboard userId={userId} />}
        {userRole === "admin" && <AdminDashboard />}
        {userRole === "accountant" && <AccountantDashboard />}
      </main>
    </div>
  );
};

export default Dashboard;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MoverDashboard from "@/components/dashboard/MoverDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import OperationsManagerDashboard from "@/components/dashboard/OperationsManagerDashboard";
import ReviewsAdminDashboard from "@/components/dashboard/ReviewsAdminDashboard";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";

type UserRole = "mover" | "admin" | "accountant" | "operations_manager" | "reviews_admin";

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
        // Priority: admin > reviews_admin > accountant > operations_manager > mover
        if (roles.some((r) => r.role === "admin")) {
          setUserRole("admin");
        } else if (roles.some((r) => r.role === "reviews_admin")) {
          setUserRole("reviews_admin");
        } else if (roles.some((r) => r.role === "accountant")) {
          setUserRole("accountant");
        } else if (roles.some((r) => r.role === "operations_manager")) {
          setUserRole("operations_manager");
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
        <div className="container mx-auto px-4 py-3 md:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img 
                src={logo} 
                alt="MyProMovers" 
                className="h-10 md:h-12 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity" 
                onClick={() => navigate("/")}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && navigate("/")}
              />
              <div className="min-w-0">
                <h1 className="text-lg md:text-xl font-bold truncate">
                  {userRole === "admin" && "Admin Portal"}
                  {userRole === "reviews_admin" && "Reviews Admin Portal"}
                  {userRole === "accountant" && "Accountant Portal"}
                  {userRole === "operations_manager" && "Ops Manager Portal"}
                  {userRole === "mover" && "Mover Portal"}
                </h1>
                <p className="text-xs md:text-sm text-muted-foreground truncate">{userName}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleLogout} size="sm" className="self-end sm:self-auto">
              <LogOut className="h-4 w-4 mr-2" />
              <span className="hidden xs:inline">Logout</span>
              <span className="xs:hidden">Exit</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-3 md:px-4 py-4 md:py-8">
        {userRole === "mover" && <MoverDashboard userId={userId} />}
        {userRole === "admin" && <AdminDashboard userId={userId} />}
        {userRole === "reviews_admin" && <ReviewsAdminDashboard userId={userId} />}
        {userRole === "accountant" && <AccountantDashboard userId={userId} />}
        {userRole === "operations_manager" && <OperationsManagerDashboard userId={userId} />}
      </main>
    </div>
  );
};

export default Dashboard;

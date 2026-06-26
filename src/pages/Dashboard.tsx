import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import MoverDashboard from "@/components/dashboard/MoverDashboard";
import AdminDashboard from "@/components/dashboard/AdminDashboard";
import AccountantDashboard from "@/components/dashboard/AccountantDashboard";
import OperationsManagerDashboard from "@/components/dashboard/OperationsManagerDashboard";
import ReviewsAdminDashboard from "@/components/dashboard/ReviewsAdminDashboard";
import HRDashboard from "@/components/dashboard/HRDashboard";
import OfficeStaffDashboard from "@/components/dashboard/OfficeStaffDashboard";
import WarehouseKeeperDashboard from "@/components/dashboard/WarehouseKeeperDashboard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, UserCog, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { AppShellProvider, type AppShellRole } from "@/components/mobile/AppShellContext";

type UserRole =
  | "mover"
  | "admin"
  | "accountant"
  | "operations_manager"
  | "reviews_admin"
  | "hr_manager"
  | "office_staff"
  | "warehouse_keeper";

const ROLE_PRIORITY: UserRole[] = [
  "admin",
  "reviews_admin",
  "accountant",
  "operations_manager",
  "hr_manager",
  "office_staff",
  "warehouse_keeper",
  "mover",
];

const ROLE_LABELS: Record<UserRole, string> = {
  admin: "Admin Portal",
  reviews_admin: "Reviews Admin Portal",
  accountant: "Accountant Portal",
  operations_manager: "Ops Manager Portal",
  hr_manager: "HR Portal",
  office_staff: "Office Staff Portal",
  warehouse_keeper: "Warehouse Keeper Portal",
  mover: "Mover Portal",
};

const ACTIVE_ROLE_STORAGE_KEY = "activeUserRole";

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [userRole, setUserRole] = useState<UserRole | null>(null);
  const [availableRoles, setAvailableRoles] = useState<UserRole[]>([]);
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name, signup_status")
        .eq("id", session.user.id)
        .single();

      if (profile) {
        const signupStatus = (profile as any).signup_status;
        if (signupStatus === "pending" || signupStatus === "declined") {
          await supabase.auth.signOut();
          navigate("/auth");
          return;
        }
        setUserName(`${profile.first_name} ${profile.last_name}`);
      }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", session.user.id);

      if (roles && roles.length > 0) {
        const userRoles = roles.map((r) => r.role as UserRole);
        const sorted = ROLE_PRIORITY.filter((r) => userRoles.includes(r));
        setAvailableRoles(sorted);

        const stored = localStorage.getItem(ACTIVE_ROLE_STORAGE_KEY) as UserRole | null;
        const initial = stored && sorted.includes(stored) ? stored : sorted[0];
        setUserRole(initial);
      }

      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
        navigate("/auth");
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    localStorage.removeItem(ACTIVE_ROLE_STORAGE_KEY);
    await supabase.auth.signOut();
    toast.success("Logged out successfully");
  };

  const handleSwitchRole = (role: UserRole) => {
    if (role === userRole) return;
    localStorage.setItem(ACTIVE_ROLE_STORAGE_KEY, role);
    setUserRole(role);
    toast.success(`Switched to ${ROLE_LABELS[role]}`);
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

  const canSwitch = availableRoles.length > 1;

  return (
    <AppShellProvider
      value={{
        currentRole: userRole as AppShellRole,
        availableRoles: availableRoles as AppShellRole[],
        roleLabels: ROLE_LABELS as Record<AppShellRole, string>,
        switchRole: (r) => handleSwitchRole(r as UserRole),
        logout: handleLogout,
        userName,
      }}
    >
      <div className="min-h-screen bg-background">
        {/* Desktop / landscape-tablet top bar — hidden on phones & portrait tablets where MobileShell takes over */}
        <header className="hidden md:portrait:hidden md:block border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={logo}
                  alt="MyProMovers"
                  className="h-12 flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => navigate("/")}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && navigate("/")}
                />
                <div className="min-w-0">
                  <h1 className="text-xl font-bold truncate">{ROLE_LABELS[userRole]}</h1>
                  <p className="text-sm text-muted-foreground truncate">{userName}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {canSwitch && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" title="Switch role">
                        <UserCog className="h-4 w-4 mr-2" />
                        <span>Switch Role</span>
                        <ChevronDown className="h-3 w-3 ml-1" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 bg-popover z-50">
                      <DropdownMenuLabel>Switch Cabinet</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      {availableRoles.map((role) => (
                        <DropdownMenuItem
                          key={role}
                          onClick={() => handleSwitchRole(role)}
                          className="cursor-pointer"
                        >
                          <span className="flex-1">{ROLE_LABELS[role]}</span>
                          {role === userRole && <Check className="h-4 w-4 ml-2" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button variant="outline" onClick={handleLogout} size="sm">
                  <LogOut className="h-4 w-4 mr-2" />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-0 md:px-4 py-0 md:py-8 md:portrait:px-0 md:portrait:py-0">
          {userRole === "mover" && <MoverDashboard userId={userId} />}
          {userRole === "admin" && <AdminDashboard userId={userId} />}
          {userRole === "reviews_admin" && <ReviewsAdminDashboard userId={userId} />}
          {userRole === "accountant" && <AccountantDashboard userId={userId} />}
          {userRole === "operations_manager" && <OperationsManagerDashboard userId={userId} />}
          {userRole === "hr_manager" && <HRDashboard userId={userId} />}
          {userRole === "office_staff" && <OfficeStaffDashboard userId={userId} />}
          {userRole === "warehouse_keeper" && <WarehouseKeeperDashboard userId={userId} />}
        </main>
      </div>
    </AppShellProvider>
  );
};

export default Dashboard;
    </div>
  );
};

export default Dashboard;

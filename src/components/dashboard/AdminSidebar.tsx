import { 
  FileText, 
  Star, 
  FileBarChart, 
  Users, 
  UserCog, 
  AlertTriangle,
  LayoutDashboard,
  ChevronLeft,
  DollarSign,
  MessageSquare,
  Shield
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import logo from "@/assets/logo.png";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  pendingCounts: {
    reimbursements: number;
    reviews: number;
    appeals: number;
    missingPayments: number;
    misconductReplies: number;
  };
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "requests", label: "Reimbursements", icon: FileText },
  { id: "reviews", label: "Review Bonuses", icon: Star },
  { id: "missing-payments", label: "Missing Payments", icon: DollarSign },
  { id: "reimbursement-reports", label: "Reimbursement Reports", icon: FileBarChart },
  { id: "review-reports", label: "Review Reports", icon: FileBarChart },
  { id: "missing-payment-reports", label: "Missing Payment Reports", icon: FileBarChart },
  { id: "performance-reports", label: "Performance Reports", icon: AlertTriangle },
  { id: "violence-incidents", label: "Violence Incidents", icon: Shield },
  { id: "misconduct-responses", label: "Misconduct Responses", icon: MessageSquare },
  { id: "deductibles", label: "Deductibles Report", icon: DollarSign },
  { id: "movers", label: "Movers Directory", icon: Users },
  { id: "roles", label: "Role Management", icon: UserCog },
];

const AdminSidebar = ({ activeTab, onTabChange, pendingCounts }: AdminSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const getBadgeCount = (id: string) => {
    if (id === "requests") return pendingCounts.reimbursements;
    if (id === "reviews") return pendingCounts.reviews;
    if (id === "missing-payments") return pendingCounts.missingPayments;
    if (id === "misconduct-responses") return pendingCounts.misconductReplies;
    if (id === "dashboard") return pendingCounts.reimbursements + pendingCounts.reviews + pendingCounts.missingPayments + pendingCounts.misconductReplies;
    return 0;
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between p-2">
          {!isCollapsed && (
            <img src={logo} alt="MyProMovers" className="h-8" />
          )}
          <SidebarTrigger className="ml-auto">
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
          </SidebarTrigger>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => {
                const count = getBadgeCount(item.id);
                return (
                  <SidebarMenuItem key={item.id}>
                    <SidebarMenuButton
                      isActive={activeTab === item.id}
                      onClick={() => onTabChange(item.id)}
                      tooltip={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      {!isCollapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {!isCollapsed && count > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                          {count}
                        </span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;

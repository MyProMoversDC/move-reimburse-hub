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
  Shield,
  MessageCircle
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
    moverFeedback: number;
    performanceReports: number;
    violenceIncidents: number;
  };
  hasUnreadMessages?: boolean;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "requests", label: "Reimbursements", icon: FileText },
  { id: "reviews", label: "Review Bonuses", icon: Star },
  { id: "missing-payments", label: "Missing Payments", icon: DollarSign },
  { id: "mover-feedback", label: "Mover Feedback", icon: MessageCircle },
  { id: "reimbursement-reports", label: "Reimbursement Reports", icon: FileBarChart },
  { id: "review-reports", label: "Review Reports", icon: FileBarChart },
  { id: "missing-payment-reports", label: "Missing Payment Reports", icon: FileBarChart },
  { id: "performance-reports", label: "Misconduct/Performance Submissions", icon: AlertTriangle },
  { id: "violence-incidents", label: "Violence Incidents", icon: Shield },
  { id: "misconduct-responses", label: "Misconduct Responses", icon: MessageSquare },
  { id: "deductibles", label: "Deductibles Report", icon: DollarSign },
  { id: "chat", label: "Chat", icon: MessageSquare },
  { id: "movers", label: "Movers Directory", icon: Users },
  { id: "roles", label: "Role Management", icon: UserCog },
];

const AdminSidebar = ({ activeTab, onTabChange, pendingCounts, hasUnreadMessages = false }: AdminSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const getBadgeCount = (id: string) => {
    if (id === "requests") return pendingCounts.reimbursements;
    if (id === "reviews") return pendingCounts.reviews;
    if (id === "missing-payments") return pendingCounts.missingPayments;
    if (id === "misconduct-responses") return pendingCounts.misconductReplies;
    if (id === "mover-feedback") return pendingCounts.moverFeedback;
    if (id === "performance-reports") return pendingCounts.performanceReports;
    if (id === "violence-incidents") return pendingCounts.violenceIncidents;
    if (id === "dashboard") return pendingCounts.reimbursements + pendingCounts.reviews + pendingCounts.missingPayments + pendingCounts.misconductReplies + pendingCounts.moverFeedback + pendingCounts.performanceReports + pendingCounts.violenceIncidents;
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
                      <div className="relative">
                        <item.icon className="h-4 w-4" />
                        {item.id === "chat" && hasUnreadMessages && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                        )}
                      </div>
                      {!isCollapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {!isCollapsed && count > 0 && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                          {count}
                        </span>
                      )}
                      {!isCollapsed && item.id === "chat" && hasUnreadMessages && count === 0 && (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
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

import { 
  FileText, 
  Star, 
  FileBarChart, 
  Users, 
  UserCog, 
  AlertTriangle,
  LayoutDashboard,
  ChevronLeft,
  ChevronDown,
  DollarSign,
  MessageSquare,
  Shield,
  MessageCircle,
  BookOpen,
  Newspaper,
  Mail
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import logo from "@/assets/logo.png";
import { useState } from "react";

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
    alcoholTests: number;
  };
  hasUnreadMessages?: boolean;
}

const menuItems = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "feed", label: "Feed Management", icon: Newspaper },
  { id: "requests", label: "Reimbursements", icon: FileText },
  { id: "reviews", label: "Review Bonuses", icon: Star },
  { id: "missing-payments", label: "Missing Payments", icon: DollarSign },
  { id: "mover-feedback", label: "Mover Feedback", icon: MessageCircle },
  { id: "performance-reports", label: "Misconduct/Performance Submissions", icon: AlertTriangle },
  { id: "violence-incidents", label: "Violence Incidents", icon: Shield },
  { id: "alcohol-tests", label: "Alcohol Test Reports", icon: Shield },
  { id: "misconduct-responses", label: "Misconduct Responses", icon: MessageSquare },
  { id: "deductibles", label: "Deductibles Report", icon: DollarSign },
  { id: "handbook", label: "Handbook Management", icon: BookOpen },
  { id: "consent-documents", label: "Consent Documents", icon: FileText },
  { id: "email-logs", label: "Email Logs", icon: Mail },
  { id: "user-activity", label: "User Activity Log", icon: FileBarChart },
  { id: "chat", label: "Chat", icon: MessageSquare },
];

const reportingItems = [
  { id: "reimbursement-reports", label: "Reimbursement Reports" },
  { id: "review-reports", label: "Customer Review Reports" },
  { id: "missing-payment-reports", label: "Missing Payment Reports" },
];

const bottomMenuItems = [
  { id: "movers", label: "Movers Directory", icon: Users },
  { id: "roles", label: "Role Management", icon: UserCog },
];

const AdminSidebar = ({ activeTab, onTabChange, pendingCounts, hasUnreadMessages = false }: AdminSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const [reportsOpen, setReportsOpen] = useState(false);

  const getBadgeCount = (id: string) => {
    if (id === "requests") return pendingCounts.reimbursements;
    if (id === "reviews") return pendingCounts.reviews;
    if (id === "missing-payments") return pendingCounts.missingPayments;
    if (id === "misconduct-responses") return pendingCounts.misconductReplies;
    if (id === "mover-feedback") return pendingCounts.moverFeedback;
    if (id === "performance-reports") return pendingCounts.performanceReports;
    if (id === "violence-incidents") return pendingCounts.violenceIncidents;
    if (id === "alcohol-tests") return pendingCounts.alcoholTests;
    if (id === "dashboard") return pendingCounts.reimbursements + pendingCounts.reviews + pendingCounts.missingPayments + pendingCounts.misconductReplies + pendingCounts.moverFeedback + pendingCounts.performanceReports + pendingCounts.violenceIncidents + pendingCounts.alcoholTests;
    return 0;
  };

  const isReportTab = reportingItems.some(item => item.id === activeTab);

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
                const showRedDot = count > 0 && ["mover-feedback", "performance-reports", "violence-incidents", "alcohol-tests"].includes(item.id);
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
                        {showRedDot && isCollapsed && (
                          <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                        )}
                      </div>
                      {!isCollapsed && (
                        <span className="flex-1">{item.label}</span>
                      )}
                      {!isCollapsed && count > 0 && !showRedDot && (
                        <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs">
                          {count}
                        </span>
                      )}
                      {!isCollapsed && showRedDot && (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
                      )}
                      {!isCollapsed && item.id === "chat" && hasUnreadMessages && count === 0 && (
                        <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}

              {/* Mover Form Reports dropdown */}
              {!isCollapsed && (
                <Collapsible open={reportsOpen || isReportTab} onOpenChange={setReportsOpen}>
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton tooltip="Mover Form Reports">
                        <FileBarChart className="h-4 w-4" />
                        <span className="flex-1">Mover Form Reports</span>
                        <ChevronDown className={`h-4 w-4 transition-transform ${reportsOpen || isReportTab ? "rotate-180" : ""}`} />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                  </SidebarMenuItem>
                  <CollapsibleContent>
                    {reportingItems.map((item) => (
                      <SidebarMenuItem key={item.id} className="pl-6">
                        <SidebarMenuButton
                          isActive={activeTab === item.id}
                          onClick={() => onTabChange(item.id)}
                          tooltip={item.label}
                        >
                          <span className="flex-1 text-sm">{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              )}

              {bottomMenuItems.map((item) => (
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
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;

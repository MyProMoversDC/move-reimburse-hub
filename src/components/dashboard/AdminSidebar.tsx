import {
  FileText,
  Star,
  FileBarChart,
  Users,
  UserCog,
  AlertTriangle,
  HelpCircle,
  LayoutDashboard,
  ChevronLeft,
  ChevronDown,
  DollarSign,
  MessageSquare,
  Shield,
  MessageCircle,
  BookOpen,
  Newspaper,
  Mail,
  UserPlus,
  Clock,
  GraduationCap,
  UserCheck,
  ShieldAlert,
  Wallet,
  BarChart3,
  Library,
  Megaphone,
  Briefcase,
  ClipboardList,
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
import { useEffect, useState } from "react";

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
    customerRefunds: number;
    paymentQuestions: number;
    referrals: number;
    signupApprovals: number;
  };
  hasUnreadMessages?: boolean;
}

type NavItem = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badgeKey?: keyof AdminSidebarProps["pendingCounts"];
  redDot?: boolean;
};

type NavGroup = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    id: "users",
    label: "User Management",
    icon: Users,
    items: [
      { id: "signup-approvals", label: "SignUp Approvals", icon: UserCheck, badgeKey: "signupApprovals", redDot: true },
      { id: "roles", label: "User Management", icon: UserCog },
      { id: "movers", label: "Movers Directory", icon: Users },
      { id: "mover-ratings", label: "Mover Ratings", icon: Star },
      { id: "user-activity", label: "User Activity Log", icon: FileBarChart },
    ],
  },
  {
    id: "operations",
    label: "Operations",
    icon: Briefcase,
    items: [
      { id: "shift-schedule", label: "Shift Schedule", icon: Clock },
      { id: "referrals", label: "Referral Requests", icon: UserPlus, badgeKey: "referrals" },
    ],
  },
  {
    id: "compliance",
    label: "Compliance & Safety",
    icon: ShieldAlert,
    items: [
      { id: "performance-reports", label: "Misconduct/Performance Submissions", icon: AlertTriangle, badgeKey: "performanceReports", redDot: true },
      { id: "misconduct-responses", label: "Misconduct Responses", icon: MessageSquare, badgeKey: "misconductReplies" },
      { id: "violence-incidents", label: "Violence Incidents", icon: Shield, badgeKey: "violenceIncidents", redDot: true },
      { id: "alcohol-tests", label: "Alcohol Test Reports", icon: Shield, badgeKey: "alcoholTests", redDot: true },
      { id: "consent-documents", label: "Consent Documents", icon: FileText },
    ],
  },
  {
    id: "finance",
    label: "Financial Management",
    icon: Wallet,
    items: [
      { id: "customer-refunds", label: "Customer Refunds", icon: DollarSign, badgeKey: "customerRefunds" },
      { id: "deductibles", label: "Deductibles Report", icon: DollarSign },
      { id: "missing-payments", label: "Missing Payments", icon: DollarSign, badgeKey: "missingPayments" },
      { id: "payment-questions", label: "Payment Questions", icon: HelpCircle, badgeKey: "paymentQuestions" },
      { id: "requests", label: "Reimbursements", icon: FileText, badgeKey: "reimbursements" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    items: [
      { id: "reimbursement-reports", label: "Reimbursement Reports", icon: FileBarChart },
      { id: "missing-payment-reports", label: "Missing Payment Reports", icon: FileBarChart },
      { id: "review-reports", label: "Customer Review Reports", icon: Star },
      { id: "reviews", label: "Mover Form Reports", icon: ClipboardList, badgeKey: "reviews" },
    ],
  },
  {
    id: "content",
    label: "Content & Knowledge",
    icon: Library,
    items: [
      { id: "feed", label: "Feed Management", icon: Newspaper },
      { id: "handbook", label: "Handbook Management", icon: BookOpen },
      { id: "knowledge-base", label: "Knowledge Base", icon: GraduationCap },
      { id: "office-ai-knowledge", label: "AI Assistant Knowledge", icon: Sparkles },
      { id: "mover-feedback", label: "Mover Feedback", icon: MessageCircle, badgeKey: "moverFeedback", redDot: true },
    ],
  },
  {
    id: "comms",
    label: "Communication & Logs",
    icon: Megaphone,
    items: [
      { id: "email-logs", label: "Email Logs", icon: Mail },
    ],
  },
];

const STORAGE_KEY = "adminSidebarOpenGroups";

const AdminSidebar = ({ activeTab, onTabChange, pendingCounts, hasUnreadMessages = false }: AdminSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return { users: true, operations: true, compliance: true, finance: true, reports: false, content: false, comms: false };
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(openGroups));
    } catch {}
  }, [openGroups]);

  const setGroupOpen = (id: string, open: boolean) =>
    setOpenGroups((prev) => ({ ...prev, [id]: open }));

  const getItemBadge = (item: NavItem) =>
    item.badgeKey ? pendingCounts[item.badgeKey] || 0 : 0;

  const getGroupBadge = (group: NavGroup) =>
    group.items.reduce((sum, i) => sum + getItemBadge(i), 0);

  const isGroupActive = (group: NavGroup) =>
    group.items.some((i) => i.id === activeTab);

  const renderItemRow = (item: NavItem, indent = false) => {
    const count = getItemBadge(item);
    const showRedDot = item.redDot && count > 0;
    return (
      <SidebarMenuItem key={item.id}>
        <SidebarMenuButton
          isActive={activeTab === item.id}
          onClick={() => onTabChange(item.id)}
          tooltip={item.label}
          className={indent && !isCollapsed ? "pl-8" : undefined}
        >
          <div className="relative">
            <item.icon className="h-4 w-4" />
            {isCollapsed && (showRedDot || count > 0) && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
            )}
          </div>
          {!isCollapsed && <span className="flex-1 truncate">{item.label}</span>}
          {!isCollapsed && count > 0 && (
            showRedDot ? (
              <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
            ) : (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-destructive-foreground text-xs font-medium">
                {count}
              </span>
            )
          )}
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center justify-between p-2">
          {!isCollapsed && <img src={logo} alt="MyProMovers" className="h-8" />}
          <SidebarTrigger className="ml-auto">
            <ChevronLeft className={`h-4 w-4 transition-transform ${isCollapsed ? "rotate-180" : ""}`} />
          </SidebarTrigger>
        </div>
      </SidebarHeader>
      <SidebarContent className="overflow-y-auto">
        {/* Top-level standalone items */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "dashboard"}
                  onClick={() => onTabChange("dashboard")}
                  tooltip="Dashboard"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {!isCollapsed && <span className="flex-1">Dashboard</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "chat"}
                  onClick={() => onTabChange("chat")}
                  tooltip="Chat"
                >
                  <div className="relative">
                    <MessageSquare className="h-4 w-4" />
                    {isCollapsed && hasUnreadMessages && (
                      <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                    )}
                  </div>
                  {!isCollapsed && <span className="flex-1">Chat</span>}
                  {!isCollapsed && hasUnreadMessages && (
                    <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Grouped sections */}
        {groups.map((group) => {
          const groupBadge = getGroupBadge(group);
          const active = isGroupActive(group);
          const open = isCollapsed ? true : (openGroups[group.id] ?? false) || active;

          if (isCollapsed) {
            return (
              <SidebarGroup key={group.id}>
                <SidebarGroupContent>
                  <SidebarMenu>{group.items.map((i) => renderItemRow(i))}</SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          }

          return (
            <SidebarGroup key={group.id}>
              <Collapsible open={open} onOpenChange={(o) => setGroupOpen(group.id, o)}>
                <SidebarGroupLabel asChild>
                  <CollapsibleTrigger className="flex w-full items-center gap-2 px-2 py-1.5 text-xs font-semibold uppercase tracking-wide text-sidebar-foreground/70 hover:text-sidebar-foreground transition-colors">
                    <group.icon className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{group.label}</span>
                    {groupBadge > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-destructive-foreground text-[10px] font-medium">
                        {groupBadge}
                      </span>
                    )}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
                  </CollapsibleTrigger>
                </SidebarGroupLabel>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => renderItemRow(item, true))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </Collapsible>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
};

export default AdminSidebar;

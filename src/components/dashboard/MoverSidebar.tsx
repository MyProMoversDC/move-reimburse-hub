import { useState, useEffect } from "react";
import { 
  DollarSign, 
  Star, 
  AlertTriangle,
  Shield,
  MessageSquare,
  Lightbulb,
  EyeOff,
  ChevronLeft,
  Newspaper,
  ClipboardList,
  HelpCircle,
  UserPlus,
  Truck,
  Clock,
  GraduationCap

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
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";

interface MoverSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasUnreadMessages?: boolean;
  language: 'en' | 'es' | 'ru';
  userId?: string;
  onRefreshUnacknowledged?: () => void;
  unacknowledgedCount?: number;
}

const MoverSidebar = ({ activeTab, onTabChange, hasUnreadMessages = false, userId, unacknowledgedCount = 0 }: MoverSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const { t } = useT();
  const [hasTodoItems, setHasTodoItems] = useState(false);

  useEffect(() => {
    if (userId) {
      checkTodoItems();
    }
  }, [userId]);

  const checkTodoItems = async () => {
    if (!userId) return;

    try {
      // Check if user has pending todo items
      const { data: driverStatus } = await supabase
        .from("user_driver_status")
        .select("is_driver, license_url, medical_card_url")
        .eq("user_id", userId)
        .maybeSingle();

      const { data: profile } = await supabase
        .from("profiles")
        .select("address")
        .eq("id", userId)
        .maybeSingle();

      const { count: declinedDocs } = await supabase
        .from("driver_document_reviews")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId)
        .eq("status", "declined");

      const hasItems =
        (driverStatus?.is_driver && !driverStatus.license_url) ||
        (driverStatus?.is_driver && !driverStatus.medical_card_url) ||
        !profile?.address ||
        profile?.address?.trim() === "" ||
        (declinedDocs && declinedDocs > 0);

      setHasTodoItems(!!hasItems);
    } catch (error) {
      console.error("Error checking todo items:", error);
    }
  };

  const menuItems = [
    { id: "feed", label: t("nav.feed"), icon: Newspaper, badgeCount: unacknowledgedCount },
    { id: "refer-friend", label: t("nav.referFriend"), icon: UserPlus },
    { id: "todo", label: t("nav.todoList"), icon: ClipboardList, hasBadge: hasTodoItems },
    { id: "my-jobs", label: t("nav.myJobs"), icon: Truck },
    { id: "shift-clock", label: t("nav.shiftClock"), icon: Clock },
    { id: "application-instructions", label: t("nav.applicationInstructions"), icon: GraduationCap },
    { id: "reimbursements", label: t("nav.reimbursements"), icon: DollarSign },
    { id: "reviews", label: t("nav.customerReviews"), icon: Star },
    { id: "missing-payments", label: t("nav.missingPayments"), icon: AlertTriangle },
    { id: "violence", label: t("nav.incidentReports"), icon: Shield },
    { id: "misconduct", label: t("nav.myCases"), icon: AlertTriangle },
    { id: "feedback", label: t("nav.feedback"), icon: Lightbulb },
    { id: "anonymous-feedback", label: t("nav.anonymousFeedback"), icon: EyeOff },
    { id: "payment-questions", label: t("nav.paymentQuestions"), icon: HelpCircle },
    { id: "chat", label: t("nav.chat"), icon: MessageSquare },
  ];

  const renderBadge = (item: typeof menuItems[0], isCollapsed: boolean) => {
    // Handle count badge for feed
    if (item.badgeCount !== undefined && item.badgeCount > 0) {
      if (isCollapsed) {
        return (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium px-1">
            {item.badgeCount > 99 ? '99+' : item.badgeCount}
          </span>
        );
      }
      return (
        <span className="ml-auto min-w-[20px] h-5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-xs font-medium px-1.5">
          {item.badgeCount > 99 ? '99+' : item.badgeCount}
        </span>
      );
    }
    
    // Handle simple dot badge for todo and chat
    if (item.hasBadge || (item.id === "chat" && hasUnreadMessages)) {
      if (isCollapsed) {
        return <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />;
      }
      return <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />;
    }
    
    return null;
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
          <SidebarGroupLabel>{t("common.navigation")}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.id}>
                  <SidebarMenuButton
                    isActive={activeTab === item.id}
                    onClick={() => onTabChange(item.id)}
                    tooltip={item.label}
                  >
                    <div className="relative">
                      <item.icon className="h-4 w-4" />
                      {isCollapsed && renderBadge(item, true)}
                    </div>
                    {!isCollapsed && (
                      <span className="flex-1">{item.label}</span>
                    )}
                    {!isCollapsed && renderBadge(item, false)}
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

export default MoverSidebar;
import { useState, useEffect } from "react";
import { 
  DollarSign, 
  Star, 
  AlertTriangle,
  Shield,
  MessageSquare,
  Lightbulb,
  ChevronLeft,
  Newspaper,
  ClipboardList
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

interface MoverSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  hasUnreadMessages?: boolean;
  language: 'en' | 'es' | 'ru';
  userId?: string;
}

const translations = {
  en: {
    navigation: "Navigation",
    feed: "Feed",
    todoList: "To-Do List",
    reimbursements: "Reimbursements",
    reviews: "Customer Reviews",
    missingPayments: "Missing Payments",
    incidents: "Incident Reports",
    cases: "My Cases",
    feedback: "Feedback",
    chat: "Chat",
  },
  es: {
    navigation: "Navegación",
    feed: "Noticias",
    todoList: "Lista de Tareas",
    reimbursements: "Reembolsos",
    reviews: "Reseñas de Clientes",
    missingPayments: "Pagos Faltantes",
    incidents: "Informes de Incidentes",
    cases: "Mis Casos",
    feedback: "Comentarios",
    chat: "Chat",
  },
  ru: {
    navigation: "Навигация",
    feed: "Лента",
    todoList: "Список Задач",
    reimbursements: "Возмещения",
    reviews: "Отзывы клиентов",
    missingPayments: "Пропущенные платежи",
    incidents: "Отчёты об инцидентах",
    cases: "Мои дела",
    feedback: "Отзывы",
    chat: "Чат",
  },
};

const MoverSidebar = ({ activeTab, onTabChange, hasUnreadMessages = false, language, userId }: MoverSidebarProps) => {
  const { state } = useSidebar();
  const isCollapsed = state === "collapsed";
  const t = translations[language];
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
    { id: "feed", label: t.feed, icon: Newspaper },
    { id: "todo", label: t.todoList, icon: ClipboardList, hasBadge: hasTodoItems },
    { id: "reimbursements", label: t.reimbursements, icon: DollarSign },
    { id: "reviews", label: t.reviews, icon: Star },
    { id: "missing-payments", label: t.missingPayments, icon: AlertTriangle },
    { id: "violence", label: t.incidents, icon: Shield },
    { id: "misconduct", label: t.cases, icon: AlertTriangle },
    { id: "feedback", label: t.feedback, icon: Lightbulb },
    { id: "chat", label: t.chat, icon: MessageSquare },
  ];

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
          <SidebarGroupLabel>{t.navigation}</SidebarGroupLabel>
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
                      {item.id === "chat" && hasUnreadMessages && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                      )}
                      {item.hasBadge && (
                        <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                      )}
                    </div>
                    {!isCollapsed && (
                      <span className="flex-1">{item.label}</span>
                    )}
                    {!isCollapsed && item.id === "chat" && hasUnreadMessages && (
                      <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
                    )}
                    {!isCollapsed && item.hasBadge && (
                      <span className="ml-auto h-2.5 w-2.5 rounded-full bg-destructive" />
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

export default MoverSidebar;
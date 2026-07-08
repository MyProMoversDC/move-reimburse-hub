import { useState } from "react";
import { useDeepLink } from "@/hooks/useDeepLink";
import { Package, Map, Truck, ShoppingCart, BarChart3, MessageSquare, GraduationCap } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/lib/i18n";
import UserSettings from "./UserSettings";
import ChatContainer from "./chat/ChatContainer";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import WarehouseManager from "./inventory/WarehouseManager";
import WarehouseLiveMap from "./inventory/WarehouseLiveMap";
import FleetManager from "./inventory/FleetManager";
import PurchasesManager from "./inventory/PurchasesManager";
import ReportsDashboard from "./inventory/ReportsDashboard";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";
import MobileShell, { type MobileShellNavItem } from "@/components/mobile/MobileShell";

interface Props { userId: string; }

const WarehouseKeeperDashboard = ({ userId }: Props) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<string>("warehouse");
  useDeepLink("warehouse_keeper", setActiveTab);
  const { hasUnread } = useUnreadMessages(userId);

  const navItems = [
    { id: "warehouse", label: t("nav.warehouse"), icon: Package },
    { id: "live-map", label: t("nav.liveMap"), icon: Map },
    { id: "fleet", label: t("nav.fleet"), icon: Truck },
    { id: "purchases", label: t("nav.purchases"), icon: ShoppingCart },
    { id: "reports", label: t("nav.reports"), icon: BarChart3 },
    { id: "chat", label: t("nav.chat"), icon: MessageSquare },
    { id: "knowledge-base", label: t("nav.knowledgeBase"), icon: GraduationCap },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case "warehouse": return <WarehouseManager userId={userId} />;
      case "live-map": return <WarehouseLiveMap />;
      case "fleet": return <FleetManager />;
      case "purchases": return <PurchasesManager userId={userId} />;
      case "reports": return <ReportsDashboard />;
      case "chat": return <ChatContainer userId={userId} userRole="warehouse_keeper" language={language} />;
      case "knowledge-base": return <KnowledgeBaseViewer userId={userId} />;
      default: return null;
    }
  };

  const shellNav: MobileShellNavItem[] = navItems.map((n) => ({
    id: n.id,
    label: n.label,
    icon: n.icon,
    dot: n.id === "chat" && hasUnread,
    badgeCount: n.id === "chat" && hasUnread ? 1 : 0,
  }));

  return (
    <MobileShell
      navItems={shellNav}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      renderContent={renderContent}
      rightActions={
        <>
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </>
      }
    >
      <div className="flex gap-6">
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r pr-4 pt-2 space-y-1">
          {navItems.map((item) => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left relative",
                activeTab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}>
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.id === "chat" && hasUnread && (
                <span className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-destructive" />
              )}
            </button>
          ))}
        </aside>

        <div className="hidden md:block flex-1 min-w-0">
          <div className="flex justify-end gap-2 mb-4">
            <UserSettings userId={userId} language={language} />
            <LanguageSelector language={language} onLanguageChange={setLanguage} />
          </div>
          {renderContent()}
        </div>
      </div>
    </MobileShell>
  );
};

export default WarehouseKeeperDashboard;

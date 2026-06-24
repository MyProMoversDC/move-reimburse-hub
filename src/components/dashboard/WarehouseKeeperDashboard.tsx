import { useState } from "react";
import { Package, Map, Truck, ShoppingCart, BarChart3, MessageSquare, GraduationCap } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
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

interface Props { userId: string; }

const navItems = [
  { id: "warehouse", label: "Warehouse", shortLabel: "Stock", icon: Package },
  { id: "live-map", label: "Live Map", shortLabel: "Map", icon: Map },
  { id: "fleet", label: "Fleet", shortLabel: "Fleet", icon: Truck },
  { id: "purchases", label: "Purchases", shortLabel: "Buy", icon: ShoppingCart },
  { id: "reports", label: "Reports", shortLabel: "Reports", icon: BarChart3 },
  { id: "chat", label: "Chat", shortLabel: "Chat", icon: MessageSquare },
  { id: "knowledge-base", label: "Knowledge Base", shortLabel: "KB", icon: GraduationCap },
] as const;

const WarehouseKeeperDashboard = ({ userId }: Props) => {
  const { language, setLanguage } = useLanguage();
  const [activeTab, setActiveTab] = useState<string>("warehouse");
  const { hasUnread } = useUnreadMessages(userId);

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

  return (
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

      <div className="md:hidden w-full">
        <div className="flex justify-end gap-2 mb-4">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </div>
        <div className="overflow-x-auto -mx-3 px-3 mb-4">
          <div className="inline-flex min-w-max gap-1 p-1 bg-muted rounded-lg">
            {navItems.map((item) => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors relative",
                  activeTab === item.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                )}>
                <item.icon className="h-3 w-3 shrink-0" />
                {item.shortLabel}
                {item.id === "chat" && hasUnread && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-4">{renderContent()}</div>
      </div>

      <div className="hidden md:block flex-1 min-w-0">
        <div className="flex justify-end gap-2 mb-4">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </div>
        {renderContent()}
      </div>
    </div>
  );
};

export default WarehouseKeeperDashboard;

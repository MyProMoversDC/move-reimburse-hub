import { useState } from "react";
import { useDeepLink } from "@/hooks/useDeepLink";
import { FileText, Shield, MessageSquare, Wine, DollarSign, GraduationCap, Clock, Truck, ClipboardList, Map, MapPin, Users } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import PerformanceReportsList from "./PerformanceReportsList";
import AdminViolenceIncidentList from "./AdminViolenceIncidentList";
import AlcoholTestReportForm from "./AlcoholTestReportForm";
import CustomerRefundForm from "./CustomerRefundForm";
import CustomerRefundHistory from "./CustomerRefundHistory";
import ChatContainer from "./chat/ChatContainer";
import UserSettings from "./UserSettings";
import ShiftSchedule from "./ShiftSchedule";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import FleetManager from "./inventory/FleetManager";
import JobOrdersManager from "./inventory/JobOrdersManager";
import PlanningCalendar from "./inventory/PlanningCalendar";
import CrewTrackingMap from "./inventory/CrewTrackingMap";
import CrewsManager from "./inventory/CrewsManager";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";
import MobileShell, { type MobileShellNavItem } from "@/components/mobile/MobileShell";

interface OperationsManagerDashboardProps {
  userId: string;
}

const navItems = [
  { id: "reports", label: "Performance Reports", icon: FileText, group: "Operations" },
  { id: "violence", label: "Violence Incidents", icon: Shield, group: "Operations" },
  { id: "alcohol-test", label: "Alcohol Testing", icon: Wine, group: "Operations" },
  { id: "customer-refund", label: "Customer Refund", icon: DollarSign, group: "Operations" },
  { id: "shift-schedule", label: "Shift Schedule", icon: Clock, group: "Operations" },
  { id: "fleet", label: "Fleet", icon: Truck, group: "Dispatch" },
  { id: "job-orders", label: "Job Orders", icon: ClipboardList, group: "Dispatch" },
  { id: "planning", label: "Planning", icon: Map, group: "Dispatch" },
  { id: "crew-tracking", label: "Crew Tracking", icon: MapPin, group: "Dispatch" },
  { id: "crews", label: "Crews", icon: Users, group: "Dispatch" },
  { id: "chat", label: "Chat", icon: MessageSquare, group: "Communication" },
  { id: "knowledge-base", label: "Knowledge Base", icon: GraduationCap, group: "Communication" },
] as const;

const OperationsManagerDashboard = ({ userId }: OperationsManagerDashboardProps) => {
  const { language, setLanguage } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("reports");
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

  const renderContent = () => {
    switch (activeTab) {
      case "reports":
        return (
          <PerformanceReportsList
            refreshKey={refreshKey}
            onRefresh={() => setRefreshKey(prev => prev + 1)}
          />
        );
      case "violence":
        return <AdminViolenceIncidentList userRole="operations_manager" />;
      case "alcohol-test":
        return <AlcoholTestReportForm userId={userId} language={language} />;
      case "customer-refund":
        return (
          <div className="space-y-4">
            <CustomerRefundForm userId={userId} language={language} onSubmitted={() => setRefreshKey(prev => prev + 1)} />
            <CustomerRefundHistory userId={userId} language={language} refreshKey={refreshKey} />
          </div>
        );
      case "chat":
        return <ChatContainer userId={userId} userRole="operations_manager" language={language} />;
      case "shift-schedule":
        return <ShiftSchedule userId={userId} language={language} />;
      case "knowledge-base":
        return <KnowledgeBaseViewer userId={userId} />;
      case "fleet":
        return <FleetManager />;
      case "job-orders":
        return <JobOrdersManager userId={userId} />;
      case "planning":
        return <PlanningCalendar userId={userId} />;
      case "crew-tracking":
        return <CrewTrackingMap />;
      case "crews":
        return <CrewsManager userId={userId} />;
      default:
        return null;
    }
  };

  const shellNav: MobileShellNavItem[] = navItems.map((n) => ({
    id: n.id,
    label: n.label,
    icon: n.icon,
    group: n.group,
    dot: n.id === "chat" && hasUnreadMessages,
    badgeCount: n.id === "chat" && hasUnreadMessages ? 1 : 0,
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
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left relative",
                activeTab === item.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.id === "chat" && hasUnreadMessages && (
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

          {activeTab === "reports" && (
            <div className="space-y-6">
              <PerformanceReportsList
                refreshKey={refreshKey}
                onRefresh={() => setRefreshKey(prev => prev + 1)}
              />
            </div>
          )}
          {activeTab === "violence" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Violence Incident Reports</h2>
              <AdminViolenceIncidentList userRole="operations_manager" />
            </div>
          )}
          {activeTab === "alcohol-test" && (
            <div className="space-y-6">
              <AlcoholTestReportForm userId={userId} language={language} />
            </div>
          )}
          {activeTab === "customer-refund" && (
            <div className="space-y-6">
              <CustomerRefundForm userId={userId} language={language} onSubmitted={() => setRefreshKey(prev => prev + 1)} />
              <CustomerRefundHistory userId={userId} language={language} refreshKey={refreshKey} />
            </div>
          )}
          {activeTab === "chat" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Chat</h2>
              <ChatContainer userId={userId} userRole="operations_manager" language={language} />
            </div>
          )}
          {activeTab === "shift-schedule" && (
            <ShiftSchedule userId={userId} language={language} />
          )}
          {activeTab === "knowledge-base" && (
            <div className="space-y-6">
              <KnowledgeBaseViewer userId={userId} />
            </div>
          )}
          {activeTab === "fleet" && <FleetManager />}
          {activeTab === "job-orders" && <JobOrdersManager userId={userId} />}
          {activeTab === "planning" && <PlanningCalendar userId={userId} />}
          {activeTab === "crew-tracking" && <CrewTrackingMap />}
          {activeTab === "crews" && <CrewsManager userId={userId} />}
        </div>
      </div>
    </MobileShell>
  );
};

export default OperationsManagerDashboard;

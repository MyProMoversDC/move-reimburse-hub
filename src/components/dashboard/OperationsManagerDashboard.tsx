import { useState } from "react";
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

interface OperationsManagerDashboardProps {
  userId: string;
}

const navItems = [
  { id: "reports", label: "Performance Reports", shortLabel: "Reports", icon: FileText },
  { id: "violence", label: "Violence Incidents", shortLabel: "Incidents", icon: Shield },
  { id: "alcohol-test", label: "Alcohol Testing", shortLabel: "Alcohol", icon: Wine },
  { id: "customer-refund", label: "Customer Refund", shortLabel: "Refund", icon: DollarSign },
  { id: "chat", label: "Chat", shortLabel: "Chat", icon: MessageSquare },
  { id: "shift-schedule", label: "Shift Schedule", shortLabel: "Schedule", icon: Clock },
  { id: "knowledge-base", label: "Knowledge Base", shortLabel: "KB", icon: GraduationCap },
  { id: "fleet", label: "Fleet", shortLabel: "Fleet", icon: Truck },
  { id: "job-orders", label: "Job Orders", shortLabel: "Jobs", icon: ClipboardList },
  { id: "planning", label: "Planning", shortLabel: "Plan", icon: Map },
  { id: "crew-tracking", label: "Crew Tracking", shortLabel: "Track", icon: MapPin },
  { id: "crews", label: "Crews", shortLabel: "Crews", icon: Users },
] as const;

const OperationsManagerDashboard = ({ userId }: OperationsManagerDashboardProps) => {
  const { language, setLanguage } = useLanguage();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("reports");
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

  return (
    <div className="flex gap-6">
      {/* Desktop left sidebar nav */}
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

      {/* Mobile horizontal nav */}
      <div className="md:hidden w-full">
        <div className="flex justify-end gap-2 mb-4">
          <UserSettings userId={userId} language={language} />
          <LanguageSelector language={language} onLanguageChange={setLanguage} />
        </div>
        <div className="overflow-x-auto -mx-3 px-3 mb-4">
          <div className="inline-flex min-w-max gap-1 p-1 bg-muted rounded-lg">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex items-center gap-1 px-2 py-1.5 rounded-md text-[11px] font-medium transition-colors relative",
                  activeTab === item.id
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <item.icon className="h-3 w-3 shrink-0" />
                {item.shortLabel}
                {item.id === "chat" && hasUnreadMessages && (
                  <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-destructive" />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Mobile content */}
        <div className="space-y-4">
          {activeTab === "reports" && (
            <PerformanceReportsList
              refreshKey={refreshKey}
              onRefresh={() => setRefreshKey(prev => prev + 1)}
            />
          )}
          {activeTab === "violence" && (
            <>
              <h2 className="text-lg font-bold">Violence Incident Reports</h2>
              <AdminViolenceIncidentList userRole="operations_manager" />
            </>
          )}
          {activeTab === "alcohol-test" && (
            <AlcoholTestReportForm userId={userId} language={language} />
          )}
          {activeTab === "customer-refund" && (
            <div className="space-y-4">
              <CustomerRefundForm userId={userId} language={language} onSubmitted={() => setRefreshKey(prev => prev + 1)} />
              <CustomerRefundHistory userId={userId} language={language} refreshKey={refreshKey} />
            </div>
          )}
          {activeTab === "chat" && (
            <>
              <h2 className="text-lg font-bold">Chat</h2>
              <ChatContainer userId={userId} userRole="operations_manager" language={language} />
            </>
          )}
          {activeTab === "shift-schedule" && (
            <ShiftSchedule userId={userId} language={language} />
          )}
          {activeTab === "knowledge-base" && (
            <KnowledgeBaseViewer userId={userId} />
          )}
          {activeTab === "fleet" && <FleetManager />}
          {activeTab === "job-orders" && <JobOrdersManager userId={userId} />}
          {activeTab === "planning" && <PlanningCalendar userId={userId} />}
          {activeTab === "crew-tracking" && <CrewTrackingMap />}
          {activeTab === "crews" && <CrewsManager userId={userId} />}
        </div>
      </div>

      {/* Desktop content */}
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
  );
};

export default OperationsManagerDashboard;

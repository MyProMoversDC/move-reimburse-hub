import { useState } from "react";
import { useDeepLink } from "@/hooks/useDeepLink";
import { Newspaper, MessageSquare, DollarSign, Clock, GraduationCap, Bookmark, Sparkles } from "lucide-react";
import { LanguageSelector } from "@/components/LanguageSelector";
import { useLanguage } from "@/contexts/LanguageContext";
import { useT } from "@/lib/i18n";
import CustomerRefundForm from "./CustomerRefundForm";
import CustomerRefundHistory from "./CustomerRefundHistory";
import ChatContainer from "./chat/ChatContainer";
import UserSettings from "./UserSettings";
import FeedList from "./feed/FeedList";
import SavedFeedPosts from "./feed/SavedFeedPosts";
import ShiftSchedule from "./ShiftSchedule";
import KnowledgeBaseViewer from "./KnowledgeBaseViewer";
import OfficeAIAssistant from "./OfficeAIAssistant";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { cn } from "@/lib/utils";
import MobileShell, { type MobileShellNavItem } from "@/components/mobile/MobileShell";

interface OfficeStaffDashboardProps {
  userId: string;
}

const OfficeStaffDashboard = ({ userId }: OfficeStaffDashboardProps) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useT();
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<string>("feed");
  useDeepLink("office_staff", setActiveTab);
  const { hasUnread: hasUnreadMessages } = useUnreadMessages(userId);

  const navItems = [
    { id: "feed", label: t("nav.feed"), icon: Newspaper },
    { id: "saved-posts", label: t("nav.savedPosts"), icon: Bookmark },
    { id: "customer-refund", label: t("nav.customerRefund"), icon: DollarSign },
    { id: "chat", label: t("nav.chat"), icon: MessageSquare },
    { id: "shift-schedule", label: t("nav.shiftSchedule"), icon: Clock },
    { id: "knowledge-base", label: t("nav.knowledgeBase"), icon: GraduationCap },
    { id: "ai-assistant", label: t("nav.aiAssistant"), icon: Sparkles },
  ] as const;

  const renderContent = () => {
    switch (activeTab) {
      case "feed":
        return (
          <div className="space-y-4">
            <FeedList userId={userId} language={language} isAdmin={false} canSavePosts={true} />
          </div>
        );
      case "saved-posts":
        return <SavedFeedPosts userId={userId} language={language} />;
      case "customer-refund":
        return (
          <div className="space-y-4">
            <CustomerRefundForm userId={userId} language={language} onSubmitted={() => setRefreshKey(prev => prev + 1)} />
            <CustomerRefundHistory userId={userId} language={language} refreshKey={refreshKey} />
          </div>
        );
      case "chat":
        return <ChatContainer userId={userId} userRole="office_staff" language={language} />;
      case "shift-schedule":
        return <ShiftSchedule userId={userId} language={language} />;
      case "knowledge-base":
        return <KnowledgeBaseViewer userId={userId} />;
      case "ai-assistant":
        return <OfficeAIAssistant userId={userId} language={language} />;
      default:
        return null;
    }
  };

  const shellNav: MobileShellNavItem[] = navItems.map((n) => ({
    id: n.id,
    label: n.label,
    icon: n.icon,
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

          {activeTab === "feed" && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold">Feed</h2>
              <FeedList userId={userId} language={language} isAdmin={false} canSavePosts={true} />
            </div>
          )}
          {activeTab === "saved-posts" && (
            <div className="space-y-6">
              <SavedFeedPosts userId={userId} language={language} />
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
              <ChatContainer userId={userId} userRole="office_staff" language={language} />
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
          {activeTab === "ai-assistant" && (
            <div className="space-y-6">
              <OfficeAIAssistant userId={userId} language={language} />
            </div>
          )}
        </div>
      </div>
    </MobileShell>
  );
};

export default OfficeStaffDashboard;

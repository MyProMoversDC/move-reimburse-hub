import { useEffect, useRef, useState, type ReactNode, type ComponentType } from "react";
import { Menu, LogOut, UserCog, Check, X, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { useTouchShell } from "@/hooks/use-touch-shell";
import { useAppShell } from "./AppShellContext";
import logo from "@/assets/logo.png";

export interface MobileShellNavItem {
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Numeric badge count (red dot if >0 and dot=true, otherwise count pill) */
  badgeCount?: number;
  /** Force a simple red dot indicator regardless of count */
  dot?: boolean;
  /** Optional grouping header label */
  group?: string;
}

interface MobileShellProps {
  /** Items shown in the slide-out drawer */
  navItems: MobileShellNavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  /** Right-side action slot in the top bar */
  rightActions?: ReactNode;
  /** Renders the content for the active tab (called on every render) */
  renderContent: () => ReactNode;
  /** Desktop content — rendered untouched when NOT in touch shell mode */
  children: ReactNode;
  /** Optional override for the page title; defaults to active nav item label */
  titleOverride?: string;
}

/**
 * Global native mobile shell.
 *
 * On phones and portrait tablets, replaces the dashboard's existing layout with:
 *  - Sticky safe-area top bar: hamburger (left), page title (center), actions (right)
 *  - Left slide-out drawer (Sheet) listing every feature in `navItems`
 *  - Edge-to-edge full-width content area, no horizontal scroll, no compressed
 *    desktop margins
 *  - Drawer footer with Switch Role + Logout pulled from AppShellContext
 *
 * On desktop / landscape tablets, returns `children` untouched so the existing
 * desktop layout is preserved byte-for-byte.
 */
const MobileShell = ({
  navItems,
  activeTab,
  onTabChange,
  rightActions,
  renderContent,
  children,
  titleOverride,
}: MobileShellProps) => {
  const isTouch = useTouchShell();
  const [open, setOpen] = useState(false);
  const activeItemRef = useRef<HTMLButtonElement>(null);
  const shell = useAppShell();
  const [roleExpanded, setRoleExpanded] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("mobileShell.switchRole.expanded") === "1";
    } catch {
      return false;
    }
  });
  const toggleRoleExpanded = () => {
    setRoleExpanded((v) => {
      const next = !v;
      try {
        sessionStorage.setItem("mobileShell.switchRole.expanded", next ? "1" : "0");
      } catch {}
      return next;
    });
  };

  // When the drawer opens, scroll the active item into view
  useEffect(() => {
    if (open) {
      // Allow the sheet to mount before scrolling
      const t = setTimeout(() => {
        activeItemRef.current?.scrollIntoView({ block: "center", behavior: "auto" });
      }, 50);
      return () => clearTimeout(t);
    }
  }, [open, activeTab]);

  if (!isTouch) {
    return <>{children}</>;
  }

  const activeItem = navItems.find((n) => n.id === activeTab);
  const title = titleOverride ?? activeItem?.label ?? "";

  const handleSelect = (id: string) => {
    onTabChange(id);
    setOpen(false);
  };

  // Group items if any have a `group` field
  const groups = navItems.reduce<Record<string, MobileShellNavItem[]>>((acc, item) => {
    const key = item.group ?? "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
  const groupKeys = Object.keys(groups);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background -mx-3 md:mx-0">
      {/* Native mobile top bar */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur-md border-b pt-safe">
        <div className="flex items-center h-14 px-2 gap-1">
          <button
            type="button"
            aria-label="Open navigation"
            onClick={() => setOpen(true)}
            className="touch-target-lg flex items-center justify-center rounded-md hover:bg-muted active:scale-95 transition-transform"
          >
            <Menu className="h-6 w-6" />
          </button>
          <h1 className="flex-1 min-w-0 text-[15px] font-semibold text-center truncate px-1">
            {title}
          </h1>
          <div
            className={cn(
              "flex items-center gap-1 shrink-0 justify-end max-w-[44vw] overflow-hidden",
              // Compress whatever the dashboard passes in so it fits the native bar
              "[&_button]:h-9 [&_button]:px-2 [&_button]:text-xs [&_button]:gap-1",
              "[&_button>span]:truncate [&_svg]:h-4 [&_svg]:w-4",
            )}
          >
            {rightActions}
          </div>
        </div>
      </header>

      {/* Edge-to-edge content area */}
      <main className="flex-1 w-full min-w-0 px-3 pt-3 pb-safe scroll-touch">
        {renderContent()}
      </main>

      {/* Slide-out navigation drawer */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="left"
          className="p-0 w-[85vw] max-w-[340px] flex flex-col gap-0"
        >
          <SheetHeader className="px-4 py-3 border-b flex-row items-center justify-between space-y-0">
            <div className="flex items-center gap-2">
              <img src={logo} alt="MyProMovers" className="h-8" />
            </div>
            <button
              type="button"
              aria-label="Close menu"
              onClick={() => setOpen(false)}
              className="touch-target rounded-md hover:bg-muted flex items-center justify-center"
            >
              <X className="h-5 w-5" />
            </button>
            <SheetTitle className="sr-only">Navigation</SheetTitle>
          </SheetHeader>

          <ScrollArea className="flex-1">
            <nav className="p-2 space-y-1">
              {groupKeys.map((groupKey) => (
                <div key={groupKey || "default"} className="mb-2">
                  {groupKey && (
                    <p className="px-3 pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {groupKey}
                    </p>
                  )}
                  {groups[groupKey].map((item) => {
                    const isActive = item.id === activeTab;
                    const count = item.badgeCount ?? 0;
                    return (
                      <button
                        key={item.id}
                        ref={isActive ? activeItemRef : undefined}
                        type="button"
                        onClick={() => handleSelect(item.id)}
                        className={cn(
                          "w-full touch-target flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-left transition-colors active:scale-[0.98]",
                          isActive
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "text-foreground hover:bg-muted",
                        )}
                      >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="flex-1 truncate">{item.label}</span>
                        {count > 0 && !item.dot && (
                          <span
                            className={cn(
                              "flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold",
                              isActive
                                ? "bg-primary-foreground text-primary"
                                : "bg-destructive text-destructive-foreground",
                            )}
                          >
                            {count > 99 ? "99+" : count}
                          </span>
                        )}
                        {item.dot && (count > 0 || item.dot) && (
                          <span className="h-2.5 w-2.5 rounded-full bg-destructive" />
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
            </nav>
          </ScrollArea>

          {/* Drawer footer — role switcher + logout */}
          {shell && (
            <div className="border-t bg-card pb-safe">
              <div className="px-3 py-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 pb-1">
                  Signed in
                </p>
                <p className="text-sm font-medium truncate px-2 pb-2">{shell.userName}</p>
                {shell.availableRoles.length > 1 && (
                  <div className="space-y-1 mb-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-2 flex items-center gap-1">
                      <UserCog className="h-3 w-3" /> Switch cabinet
                    </p>
                    {shell.availableRoles.map((role) => (
                      <button
                        key={role}
                        type="button"
                        onClick={() => {
                          shell.switchRole(role);
                          setOpen(false);
                        }}
                        className={cn(
                          "w-full touch-target flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors",
                          role === shell.currentRole
                            ? "bg-muted text-foreground"
                            : "hover:bg-muted text-muted-foreground",
                        )}
                      >
                        <span className="flex-1 text-left truncate">
                          {shell.roleLabels[role]}
                        </span>
                        {role === shell.currentRole && <Check className="h-4 w-4" />}
                      </button>
                    ))}
                  </div>
                )}
                <Button
                  variant="outline"
                  className="w-full touch-target-lg justify-start"
                  onClick={() => {
                    shell.logout();
                    setOpen(false);
                  }}
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default MobileShell;

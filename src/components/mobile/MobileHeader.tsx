import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";

interface MobileHeaderProps {
  title: ReactNode;
  /** Right-side actions (notifications bell, profile, etc.) */
  right?: ReactNode;
  /** When false, hides the hamburger trigger (e.g. modal sub-pages) */
  showMenu?: boolean;
  className?: string;
}

/**
 * Sticky, safe-area-aware mobile header.
 * Hamburger uses the existing SidebarTrigger so it integrates with each role's Sidebar.
 */
const MobileHeader = ({ title, right, showMenu = true, className }: MobileHeaderProps) => {
  return (
    <header
      className={cn(
        "sticky top-0 z-30 bg-card/95 backdrop-blur border-b pt-safe md:hidden",
        className,
      )}
    >
      <div className="flex items-center gap-2 h-14 px-2">
        {showMenu ? (
          <SidebarTrigger
            aria-label="Open menu"
            className="touch-target-lg flex items-center justify-center -ml-1"
          >
            <Menu className="h-5 w-5" />
          </SidebarTrigger>
        ) : (
          <span className="w-12" aria-hidden />
        )}
        <h1 className="flex-1 text-base font-semibold truncate text-center px-1">{title}</h1>
        <div className="flex items-center gap-1 min-w-[48px] justify-end">{right}</div>
      </div>
    </header>
  );
};

export default MobileHeader;

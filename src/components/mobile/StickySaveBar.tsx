import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StickySaveBarProps {
  children: ReactNode;
  className?: string;
}

/**
 * Bottom sticky action bar for long mobile forms.
 * Respects iOS home-indicator safe area.
 */
const StickySaveBar = ({ children, className }: StickySaveBarProps) => (
  <div
    className={cn(
      "sticky bottom-0 -mx-4 px-4 pt-3 pb-3 pb-safe bg-background/95 backdrop-blur border-t z-20",
      "flex items-center gap-2 md:static md:mx-0 md:px-0 md:py-0 md:bg-transparent md:border-0 md:backdrop-blur-none",
      className,
    )}
  >
    {children}
  </div>
);

export default StickySaveBar;

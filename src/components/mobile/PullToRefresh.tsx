import { useRef, useState, useCallback, type ReactNode } from "react";
import { Loader2, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobileOrTablet } from "@/hooks/use-tablet";

interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  children: ReactNode;
  className?: string;
  /** Disable native PTR behavior so iOS/Android won't trigger browser refresh */
  disabled?: boolean;
  /** px the user must drag past to trigger refresh */
  threshold?: number;
}

/**
 * Lightweight native-feeling pull-to-refresh.
 * Active only on touch devices (mobile + tablet). Desktop renders children unchanged.
 * Works inside Capacitor WebView and standard mobile browsers.
 */
const PullToRefresh = ({
  onRefresh,
  children,
  className,
  disabled,
  threshold = 70,
}: PullToRefreshProps) => {
  const isSmall = useIsMobileOrTablet();
  const containerRef = useRef<HTMLDivElement>(null);
  const startY = useRef<number | null>(null);
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const reset = () => {
    startY.current = null;
    setPull(0);
  };

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (disabled || refreshing) return;
    const el = containerRef.current;
    if (!el || el.scrollTop > 0) return;
    startY.current = e.touches[0].clientY;
  }, [disabled, refreshing]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    // Resistance curve so it feels native
    const resisted = Math.min(threshold * 1.8, dy * 0.55);
    setPull(resisted);
  }, [threshold]);

  const onTouchEnd = useCallback(async () => {
    if (startY.current == null) return;
    const reached = pull >= threshold;
    startY.current = null;
    if (reached) {
      setRefreshing(true);
      setPull(threshold);
      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
        setPull(0);
      }
    } else {
      setPull(0);
    }
  }, [pull, threshold, onRefresh]);

  if (!isSmall) {
    return <div className={className}>{children}</div>;
  }

  const indicatorOpacity = Math.min(1, pull / threshold);
  const rotation = Math.min(180, (pull / threshold) * 180);

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={reset}
      className={cn("relative no-native-ptr scroll-touch overflow-y-auto", className)}
      style={{ touchAction: "pan-y" }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center transition-transform"
        style={{
          height: threshold,
          transform: `translateY(${pull - threshold}px)`,
          opacity: refreshing ? 1 : indicatorOpacity,
        }}
        aria-hidden
      >
        <div className="bg-card border rounded-full shadow-md h-10 w-10 flex items-center justify-center">
          {refreshing ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : (
            <ArrowDown
              className="h-5 w-5 text-primary transition-transform"
              style={{ transform: `rotate(${rotation}deg)` }}
            />
          )}
        </div>
      </div>
      <div
        style={{
          transform: pull ? `translateY(${pull}px)` : undefined,
          transition: startY.current == null ? "transform 200ms ease-out" : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PullToRefresh;

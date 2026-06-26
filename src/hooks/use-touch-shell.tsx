import * as React from "react";

/**
 * Returns true when the app should render the native mobile shell:
 *  - All phones (any orientation)
 *  - Tablets in portrait orientation (iPad portrait, Android tablet portrait)
 *
 * Desktops and landscape tablets fall back to the desktop layout.
 *
 * Built on matchMedia so it stays in sync with rotation / window resizes.
 */
export function useTouchShell() {
  const [touch, setTouch] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return evaluate();
  });

  React.useEffect(() => {
    const phoneMql = window.matchMedia("(max-width: 767px)");
    const tabletPortraitMql = window.matchMedia(
      "(min-width: 768px) and (max-width: 1279px) and (orientation: portrait)",
    );

    const onChange = () => setTouch(evaluate());
    phoneMql.addEventListener("change", onChange);
    tabletPortraitMql.addEventListener("change", onChange);
    onChange();

    return () => {
      phoneMql.removeEventListener("change", onChange);
      tabletPortraitMql.removeEventListener("change", onChange);
    };
  }, []);

  return touch;
}

function evaluate(): boolean {
  if (typeof window === "undefined") return false;
  const isPhone = window.matchMedia("(max-width: 767px)").matches;
  const isTabletPortrait = window.matchMedia(
    "(min-width: 768px) and (max-width: 1279px) and (orientation: portrait)",
  ).matches;
  return isPhone || isTabletPortrait;
}

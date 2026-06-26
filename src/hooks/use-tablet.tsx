import * as React from "react";

const TABLET_MIN = 768;
const DESKTOP_MIN = 1024;

/** True for viewports 768px–1023px (tablet range). */
export function useIsTablet() {
  const [isTablet, setIsTablet] = React.useState<boolean>(false);

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${TABLET_MIN}px) and (max-width: ${DESKTOP_MIN - 1}px)`);
    const onChange = () => setIsTablet(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isTablet;
}

/** True for any non-desktop viewport (<1024px). */
export function useIsMobileOrTablet() {
  const [isSmall, setIsSmall] = React.useState<boolean>(false);
  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${DESKTOP_MIN - 1}px)`);
    const onChange = () => setIsSmall(mql.matches);
    mql.addEventListener("change", onChange);
    onChange();
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return isSmall;
}

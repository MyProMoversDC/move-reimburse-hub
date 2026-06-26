import { createContext, useContext, type ReactNode } from "react";

export type AppShellRole =
  | "mover"
  | "admin"
  | "accountant"
  | "operations_manager"
  | "reviews_admin"
  | "hr_manager"
  | "office_staff"
  | "warehouse_keeper";

export interface AppShellContextValue {
  currentRole: AppShellRole;
  availableRoles: AppShellRole[];
  roleLabels: Record<AppShellRole, string>;
  switchRole: (role: AppShellRole) => void;
  logout: () => void;
  userName: string;
}

const AppShellContext = createContext<AppShellContextValue | null>(null);

export const AppShellProvider = ({
  value,
  children,
}: {
  value: AppShellContextValue;
  children: ReactNode;
}) => <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;

export const useAppShell = () => useContext(AppShellContext);

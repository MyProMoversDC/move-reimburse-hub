import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

export interface ResponsiveColumn<T> {
  key: string;
  header: ReactNode;
  /** Renders the desktop cell and the mobile card row value. */
  cell: (row: T) => ReactNode;
  /** Hide this column from the mobile card variant. */
  mobileHidden?: boolean;
  /** Use as the prominent title row at the top of the mobile card. */
  mobilePrimary?: boolean;
  className?: string;
}

interface ResponsiveCardTableProps<T> {
  data: T[];
  columns: ResponsiveColumn<T>[];
  rowKey: (row: T) => string;
  /** Rendered on each mobile card (e.g. action buttons). */
  mobileActions?: (row: T) => ReactNode;
  /** Rendered as an empty state when data is empty. */
  empty?: ReactNode;
  /** Tap handler for the whole row/card. */
  onRowClick?: (row: T) => void;
  className?: string;
}

/**
 * One source of truth for tabular data:
 * - Desktop: classic table layout
 * - Mobile (<768px): each row becomes a full-width stacked card
 */
function ResponsiveCardTable<T>({
  data,
  columns,
  rowKey,
  mobileActions,
  empty,
  onRowClick,
  className,
}: ResponsiveCardTableProps<T>) {
  const isMobile = useIsMobile();

  if (data.length === 0 && empty) {
    return <div className={cn("py-8 text-center text-muted-foreground", className)}>{empty}</div>;
  }

  if (isMobile) {
    return (
      <div className={cn("space-y-3", className)}>
        {data.map((row) => {
          const primary = columns.find((c) => c.mobilePrimary);
          const rest = columns.filter((c) => !c.mobilePrimary && !c.mobileHidden);
          return (
            <Card
              key={rowKey(row)}
              className={cn(
                "p-4 active:bg-muted/40 transition-colors",
                onRowClick && "cursor-pointer touch-target-lg",
              )}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {primary && (
                <div className="text-base font-semibold mb-2 break-words">{primary.cell(row)}</div>
              )}
              <dl className="space-y-1.5 text-sm">
                {rest.map((col) => (
                  <div key={col.key} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground shrink-0">{col.header}</dt>
                    <dd className="text-right break-words min-w-0">{col.cell(row)}</dd>
                  </div>
                ))}
              </dl>
              {mobileActions && (
                <div className="mt-3 pt-3 border-t flex flex-wrap gap-2">{mobileActions(row)}</div>
              )}
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-x-auto rounded-md border", className)}>
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className={cn("text-left font-medium px-3 py-2", c.className)}>
                {c.header}
              </th>
            ))}
            {mobileActions && <th className="px-3 py-2 text-right">Actions</th>}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={rowKey(row)}
              className={cn("border-t hover:bg-muted/30", onRowClick && "cursor-pointer")}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-3 py-2 align-middle", c.className)}>
                  {c.cell(row)}
                </td>
              ))}
              {mobileActions && <td className="px-3 py-2 text-right">{mobileActions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default ResponsiveCardTable;

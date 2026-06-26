import type { ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  contentClassName?: string;
  /** "sheet" = bottom sheet, "full" = full-screen on mobile. Default: sheet */
  mobileVariant?: "sheet" | "full";
}

/**
 * Renders a Dialog on desktop and a bottom-sheet (or full-screen) Sheet on mobile.
 * Keeps the same API as Dialog so it can replace it incrementally.
 */
const ResponsiveDialog = ({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  contentClassName,
  mobileVariant = "sheet",
}: ResponsiveDialogProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    const side = mobileVariant === "full" ? "right" : "bottom";
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side={side}
          className={cn(
            mobileVariant === "full"
              ? "w-full sm:max-w-full p-0 flex flex-col"
              : "max-h-[92vh] rounded-t-2xl pt-3 pb-safe px-4 flex flex-col",
            contentClassName,
          )}
        >
          {(title || description) && (
            <SheetHeader className={mobileVariant === "full" ? "px-4 pt-4 pt-safe" : ""}>
              {title && <SheetTitle className="text-left">{title}</SheetTitle>}
              {description && <SheetDescription className="text-left">{description}</SheetDescription>}
            </SheetHeader>
          )}
          <div
            className={cn(
              "flex-1 overflow-y-auto scroll-touch",
              mobileVariant === "full" ? "px-4 py-4" : "py-3",
            )}
          >
            {children}
          </div>
          {footer && (
            <SheetFooter className={cn(mobileVariant === "full" ? "px-4 pb-4 pb-safe" : "pt-2")}>
              {footer}
            </SheetFooter>
          )}
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={contentClassName}>
        {(title || description) && (
          <DialogHeader>
            {title && <DialogTitle>{title}</DialogTitle>}
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>
        )}
        {children}
        {footer && <DialogFooter>{footer}</DialogFooter>}
      </DialogContent>
    </Dialog>
  );
};

export default ResponsiveDialog;

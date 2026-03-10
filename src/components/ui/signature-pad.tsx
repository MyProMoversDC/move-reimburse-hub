import { useRef, useEffect, useState, forwardRef, useImperativeHandle } from "react";
import SignatureCanvas from "react-signature-canvas";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface SignaturePadProps {
  onSign?: (signatureDataUrl: string) => void;
  onClear?: () => void;
  className?: string;
  clearLabel?: string;
  width?: number;
  height?: number;
}

export interface SignaturePadRef {
  clear: () => void;
  isEmpty: () => boolean;
  getSignatureDataUrl: () => string | null;
}

const SignaturePad = forwardRef<SignaturePadRef, SignaturePadProps>(
  ({ onSign, onClear, className, clearLabel = "Clear", width, height = 150 }, ref) => {
    const sigCanvas = useRef<SignatureCanvas>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [containerWidth, setContainerWidth] = useState<number>(300); // sensible default

    useImperativeHandle(ref, () => ({
      clear: () => {
        sigCanvas.current?.clear();
        onClear?.();
      },
      isEmpty: () => sigCanvas.current?.isEmpty() ?? true,
      getSignatureDataUrl: () => {
        if (!sigCanvas.current || sigCanvas.current.isEmpty()) return null;
        try {
          return sigCanvas.current.getTrimmedCanvas().toDataURL("image/png") ?? null;
        } catch {
          try {
            return sigCanvas.current.getCanvas().toDataURL("image/png") ?? null;
          } catch {
            return null;
          }
        }
      },
    }));

    const handleClear = () => {
      sigCanvas.current?.clear();
      onClear?.();
    };

    const handleEnd = () => {
      if (!sigCanvas.current || sigCanvas.current.isEmpty()) return;
      try {
        const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
        if (dataUrl) onSign?.(dataUrl);
      } catch {
        try {
          const dataUrl = sigCanvas.current.getCanvas().toDataURL("image/png");
          if (dataUrl) onSign?.(dataUrl);
        } catch {
          // silently fail
        }
      }
    };

    // Use ResizeObserver for reliable container width measurement
    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      const updateWidth = () => {
        const w = container.offsetWidth;
        if (w > 0) setContainerWidth(w);
      };

      // Initial measurement
      updateWidth();

      // ResizeObserver for dialog open animations and layout shifts
      let observer: ResizeObserver | null = null;
      if (typeof ResizeObserver !== "undefined") {
        observer = new ResizeObserver(() => updateWidth());
        observer.observe(container);
      }

      // Fallback: also measure after short delays for dialog animations
      const t1 = setTimeout(updateWidth, 50);
      const t2 = setTimeout(updateWidth, 200);
      const t3 = setTimeout(updateWidth, 500);

      window.addEventListener("resize", updateWidth);

      return () => {
        observer?.disconnect();
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        window.removeEventListener("resize", updateWidth);
      };
    }, []);

    return (
      <div className={cn("space-y-2", className)}>
        <div
          ref={containerRef}
          className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden"
          style={{ height: `${height}px` }}
        >
          <SignatureCanvas
            key={containerWidth} // re-mount when width changes significantly
            ref={sigCanvas}
            canvasProps={{
              width: containerWidth,
              height: height,
              className: "touch-none",
              style: {
                width: `${containerWidth}px`,
                height: `${height}px`,
                touchAction: "none",
              },
            }}
            backgroundColor="rgba(255,255,255,0)"
            penColor="#000000"
            onEnd={handleEnd}
          />
          {/* Signature line */}
          <div className="absolute bottom-6 left-4 right-4 border-b border-muted-foreground/40 pointer-events-none" />
          <span className="absolute bottom-2 left-4 text-xs text-muted-foreground pointer-events-none">
            Sign above the line
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleClear}
          className="w-full"
        >
          {clearLabel}
        </Button>
      </div>
    );
  }
);

SignaturePad.displayName = "SignaturePad";

export { SignaturePad };

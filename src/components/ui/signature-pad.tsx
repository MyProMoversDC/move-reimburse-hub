import { useRef, useEffect, useLayoutEffect, forwardRef, useImperativeHandle } from "react";
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
          // Mobile Safari can be flaky with getTrimmedCanvas() in some resize scenarios
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
      if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
        const dataUrl = sigCanvas.current.getTrimmedCanvas().toDataURL("image/png");
        onSign?.(dataUrl);
      }
    };

    // Handle resize
    const resizeCanvas = () => {
      if (containerRef.current && sigCanvas.current) {
        const canvas = sigCanvas.current.getCanvas();
        const ratio = Math.max(window.devicePixelRatio || 1, 1);
        const containerWidth = containerRef.current.offsetWidth;

        canvas.width = containerWidth * ratio;
        canvas.height = height * ratio;
        canvas.style.width = `${containerWidth}px`;
        canvas.style.height = `${height}px`;
        canvas.getContext("2d")?.setTransform(ratio, 0, 0, ratio, 0, 0);

        // IMPORTANT: Don't wipe a signature the user already drew (common on mobile
        // when the keyboard/address bar triggers a resize after drawing).
        if (sigCanvas.current.isEmpty()) {
          sigCanvas.current.clear();
        }
      }
    };

    useLayoutEffect(() => {
      resizeCanvas();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height]);

    useEffect(() => {
      window.addEventListener("resize", resizeCanvas);
      return () => window.removeEventListener("resize", resizeCanvas);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [height]);

    return (
      <div className={cn("space-y-2", className)}>
        <div 
          ref={containerRef}
          className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-background overflow-hidden"
          style={{ height: `${height}px` }}
        >
          <SignatureCanvas
            ref={sigCanvas}
            canvasProps={{
              className: "w-full h-full touch-none",
              style: { 
                width: "100%", 
                height: `${height}px`,
                touchAction: "none"
              }
            }}
            backgroundColor="transparent"
            penColor="currentColor"
            onEnd={handleEnd}
          />
          {/* Signature line */}
          <div className="absolute bottom-6 left-4 right-4 border-b border-muted-foreground/40" />
          <span className="absolute bottom-2 left-4 text-xs text-muted-foreground">
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

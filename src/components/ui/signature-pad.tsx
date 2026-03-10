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
    const [containerWidth, setContainerWidth] = useState<number>(0);

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
      const dataUrl = sigCanvas.current?.isEmpty()
        ? null
        : (() => {
            try {
              return sigCanvas.current?.getTrimmedCanvas().toDataURL("image/png") ?? null;
            } catch {
              try {
                return sigCanvas.current?.getCanvas().toDataURL("image/png") ?? null;
              } catch {
                return null;
              }
            }
          })();

      if (dataUrl) onSign?.(dataUrl);
    };

    // Measure container width on mount and resize
    useEffect(() => {
      const measure = () => {
        if (containerRef.current) {
          setContainerWidth(containerRef.current.offsetWidth);
        }
      };
      measure();
      // Small delay to handle modal open timing
      const timer = setTimeout(measure, 100);
      window.addEventListener("resize", measure);
      return () => {
        window.removeEventListener("resize", measure);
        clearTimeout(timer);
      };
    }, []);

    return (
      <div className={cn("space-y-2", className)}>
        <div 
          ref={containerRef}
          className="relative border-2 border-dashed border-muted-foreground/30 rounded-lg bg-white overflow-hidden"
          style={{ height: `${height}px` }}
        >
          {containerWidth > 0 && (
            <SignatureCanvas
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
          )}
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

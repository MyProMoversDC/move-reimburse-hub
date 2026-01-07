import { Button } from "@/components/ui/button";
import { Languages, Loader2 } from "lucide-react";

interface TranslateButtonProps {
  onClick: () => void;
  isTranslating: boolean;
  isTranslated: boolean;
  className?: string;
}

export function TranslateButton({ 
  onClick, 
  isTranslating, 
  isTranslated,
  className = ""
}: TranslateButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      disabled={isTranslating}
      className={`gap-2 ${className}`}
    >
      {isTranslating ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Translating...
        </>
      ) : isTranslated ? (
        <>
          <Languages className="h-4 w-4" />
          Show Original
        </>
      ) : (
        <>
          <Languages className="h-4 w-4" />
          Translate to English
        </>
      )}
    </Button>
  );
}

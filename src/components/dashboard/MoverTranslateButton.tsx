import { Button } from "@/components/ui/button";
import { Languages, Loader2, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface MoverTranslateButtonProps {
  onTranslate: (lang: 'es' | 'ru') => void;
  onShowOriginal: () => void;
  isTranslating: boolean;
  isTranslated: boolean;
  translatedToLang?: 'es' | 'ru' | null;
  className?: string;
  size?: "default" | "sm" | "lg" | "icon";
}

const langLabels = {
  es: { name: "Español", flag: "🇪🇸" },
  ru: { name: "Русский", flag: "🇷🇺" },
};

export function MoverTranslateButton({ 
  onTranslate, 
  onShowOriginal,
  isTranslating, 
  isTranslated,
  translatedToLang,
  className = "",
  size = "sm"
}: MoverTranslateButtonProps) {
  if (isTranslating) {
    return (
      <Button
        variant="outline"
        size={size}
        disabled
        className={`gap-2 ${className}`}
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        Translating...
      </Button>
    );
  }

  if (isTranslated && translatedToLang) {
    return (
      <Button
        variant="outline"
        size={size}
        onClick={onShowOriginal}
        className={`gap-2 ${className}`}
      >
        <Languages className="h-4 w-4" />
        Show Original
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size={size}
          className={`gap-2 ${className}`}
        >
          <Languages className="h-4 w-4" />
          Translate
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onTranslate('es')}>
          {langLabels.es.flag} {langLabels.es.name}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onTranslate('ru')}>
          {langLabels.ru.flag} {langLabels.ru.name}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

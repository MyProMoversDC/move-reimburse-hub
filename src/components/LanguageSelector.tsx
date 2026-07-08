import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";
import { useT } from "@/lib/i18n";

type Language = 'en' | 'es' | 'ru';

interface LanguageSelectorProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const LanguageSelector = ({ language, onLanguageChange }: LanguageSelectorProps) => {
  const { t } = useT();
  return (
    <Select value={language} onValueChange={(value) => onLanguageChange(value as Language)}>
      {/* Mobile: icon + 2-letter code (compact for the native top bar).
          Desktop (≥md): full label. Prevents header clipping on iPhone. */}
      <SelectTrigger
        aria-label={t("common.language")}
        className="w-auto md:w-[160px] bg-background gap-1.5 px-2 md:px-3"
      >
        <Languages className="h-4 w-4 shrink-0" />
        <span className="md:hidden text-xs font-semibold uppercase">{language}</span>
        <span className="hidden md:inline-flex">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent className="bg-background border border-border z-50">
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="ru">Русский</SelectItem>
      </SelectContent>
    </Select>
  );
};

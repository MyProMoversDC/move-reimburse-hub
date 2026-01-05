import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Languages } from "lucide-react";

type Language = 'en' | 'es' | 'ru';

interface LanguageSelectorProps {
  language: Language;
  onLanguageChange: (lang: Language) => void;
}

export const LanguageSelector = ({ language, onLanguageChange }: LanguageSelectorProps) => {
  return (
    <Select value={language} onValueChange={(value) => onLanguageChange(value as Language)}>
      <SelectTrigger className="w-[160px] bg-background">
        <Languages className="h-4 w-4 mr-2" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="bg-background border border-border z-50">
        <SelectItem value="en">English</SelectItem>
        <SelectItem value="es">Español</SelectItem>
        <SelectItem value="ru">Русский</SelectItem>
      </SelectContent>
    </Select>
  );
};

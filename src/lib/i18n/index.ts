/**
 * Unified i18n layer.
 *
 * - Reads language from the existing LanguageContext so every consumer stays
 *   reactive to language changes (no reload / re-mount needed).
 * - `t("nav.feed")` looks up a nested dot-path in the active dictionary.
 * - Missing keys fall back to English, then to the last path segment.
 * - In development, each missing key is warned exactly once.
 *
 * This layer is additive: legacy `*Translations.ts` files continue to work.
 */
import { useCallback } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { en, type Dictionary } from "./dictionaries/en";
import { es } from "./dictionaries/es";
import { ru } from "./dictionaries/ru";

const dictionaries: Record<"en" | "es" | "ru", Dictionary> = { en, es, ru };

const warned = new Set<string>();
const warnMissing = (key: string, lang: string) => {
  const tag = `${lang}:${key}`;
  if (warned.has(tag)) return;
  warned.add(tag);
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(`[i18n] missing key "${key}" for language "${lang}"`);
  }
};

const lookup = (dict: unknown, path: string): string | undefined => {
  const parts = path.split(".");
  let node: unknown = dict;
  for (const part of parts) {
    if (node && typeof node === "object" && part in (node as Record<string, unknown>)) {
      node = (node as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof node === "string" ? node : undefined;
};

export type TFunction = (key: string) => string;

export const useT = (): {
  t: TFunction;
  language: "en" | "es" | "ru";
  setLanguage: (l: "en" | "es" | "ru") => void;
} => {
  const { language, setLanguage } = useLanguage();
  const t = useCallback<TFunction>(
    (key) => {
      const primary = lookup(dictionaries[language], key);
      if (primary !== undefined) return primary;
      const fallback = lookup(dictionaries.en, key);
      if (fallback !== undefined) {
        warnMissing(key, language);
        return fallback;
      }
      warnMissing(key, language);
      // Never render the raw dotted key — return the last segment as a soft fallback.
      const tail = key.split(".").pop() ?? key;
      return tail;
    },
    [language],
  );
  return { t, language, setLanguage };
};

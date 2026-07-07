import { zhCN } from "./zh-CN";
import { en } from "./en";
import { ja } from "./ja";
import { es } from "./es";

export const translations: Record<string, typeof zhCN> = {
  ZH: zhCN,
  EN: en,
  JA: ja,
  ES: es,
};

/**
 * Helper to get active translations based on language code (e.g. "ZH", "EN", "JA", "ES")
 */
export function getI18n(langCode: string): typeof zhCN {
  const code = (langCode || "ZH").toUpperCase();
  return translations[code] || zhCN;
}

/**
 * Storage helpers for persisting selected language
 */
const LANGUAGE_STORAGE_KEY = "haze_app_language_code";

export function getPersistedLanguageCode(): string {
  try {
    const value = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (value && ["ZH", "EN", "JA", "ES"].includes(value.toUpperCase())) {
      return value.toUpperCase();
    }
  } catch (e) {
    console.error("Failed to read language memory", e);
  }
  return "ZH"; // Default to Chinese
}

export function persistLanguageCode(code: string): void {
  try {
    localStorage.setItem(LANGUAGE_STORAGE_KEY, code.toUpperCase());
  } catch (e) {
    console.error("Failed to persist language memory", e);
  }
}

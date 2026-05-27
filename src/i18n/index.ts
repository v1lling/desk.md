import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import de from "./de.json";
import fr from "./fr.json";

export const defaultNS = "translation";
export const resources = {
  en: { translation: en },
  de: { translation: de },
  fr: { translation: fr },
} as const;

export type SupportedLanguage = keyof typeof resources;

function readInitialLang(): SupportedLanguage {
  try {
    const raw = localStorage.getItem("desk-preferences");
    const lng = raw ? JSON.parse(raw)?.state?.language : null;
    return lng === "de" || lng === "fr" ? lng : "en";
  } catch {
    return "en";
  }
}

void i18next.use(initReactI18next).init({
  resources,
  lng: readInitialLang(),
  fallbackLng: "en",
  defaultNS,
  interpolation: {
    escapeValue: false,
  },
  returnNull: false,
});

export default i18next;

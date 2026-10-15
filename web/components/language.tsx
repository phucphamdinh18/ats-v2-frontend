"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { getCopy, LOCALE_KEY, savedLocale, type Locale } from "@/lib/i18n";
const LanguageContext = createContext<{
  locale: Locale;
  setLocale: (locale: Locale) => void;
}>({ locale: "vi", setLocale: () => {} });
export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [locale, updateLocale] = useState<Locale>("vi");
  useEffect(() => {
    try {
      updateLocale(savedLocale(localStorage.getItem(LOCALE_KEY)));
    } catch {
      /* Storage is optional. */
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = locale;
    document.title = "ATS · " + getCopy(locale).workspace;
  }, [locale]);
  function setLocale(next: Locale) {
    updateLocale(next);
    try {
      localStorage.setItem(LOCALE_KEY, next);
    } catch {
      /* Still usable in private browsers. */
    }
  }
  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      {children}
    </LanguageContext.Provider>
  );
}
export function useLanguage() {
  const context = useContext(LanguageContext);
  return { ...context, t: getCopy(context.locale) };
}

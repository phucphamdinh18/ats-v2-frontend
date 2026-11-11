"use client";
import { useCallback } from "react";
import { uiText, uiNotice, uiError } from "@/lib/ui-copy";
import { useLanguage } from "./language";
export function useUiText() {
  const { locale } = useLanguage();
  return useCallback(
    (key: string, values: readonly unknown[] = []) =>
      uiText(locale, key, values),
    [locale],
  );
}

export function useUiNotice() {
  const { locale } = useLanguage();
  return useCallback((text: string) => uiNotice(locale, text), [locale]);
}

export function useUiError() {
  const { locale } = useLanguage();
  return useCallback((text: string) => uiError(locale, text), [locale]);
}

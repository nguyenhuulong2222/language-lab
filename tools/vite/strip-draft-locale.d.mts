import type { Plugin } from "vite";

export function productionLocaleText(language: string, rawText: string): string;
export function stripDraftLocale(): Plugin;

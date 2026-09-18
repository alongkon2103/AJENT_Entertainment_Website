import "server-only";
import type { Locale } from "../i18n";
import { en } from "./en";
import { th } from "./th";

export const getDictionary = (lang: Locale) => (lang === "en" ? en : th);

// Shared by server and client code. Full page copy lives in app/dictionaries (server only).
export const locales = ["th", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "th";
export const isLocale = (v: unknown): v is Locale => locales.includes(v as Locale);

/** "/games" -> "/en/games", "/" -> "/en", "/#faq" -> "/en#faq". */
export const localePath = (lang: Locale, path = "/") => `/${lang}${path.replace(/^\/(?=#|$)/, "")}`;

/** Small strings used inside client components (cards, filters). */
export const ui = {
  th: { details: "ดูรายละเอียด", all: "ทั้งหมด", noGames: "ยังไม่มีเกมที่เปิดให้แสดง" },
  en: { details: "View details", all: "All", noGames: "No games to show yet" },
} satisfies Record<Locale, Record<string, string>>;

// Shared by server and client code (no server-only imports).
export const TAG_KINDS = {
  "game-category": { label: "หมวดหมู่เกม", item: "หมวดหมู่", hint: "ใช้เป็นปุ่มกรองเกม และป้ายสีมุมซ้ายบนของการ์ดเกม" },
  "game-badge": { label: "Badge เกม", item: "Badge", hint: "ป้ายเช่น HOT, NEW, UPDATE แสดงมุมขวาบนของการ์ดและในหน้ารายละเอียดเกม" },
  "news-category": { label: "หมวดข่าวสาร", item: "หมวดข่าว", hint: "ป้ายสีบนการ์ดข่าวสาร ใช้จัดกลุ่มข่าวและอัปเดต" },
} as const;

export type TagKind = keyof typeof TAG_KINDS;
export const isTagKind = (k: string): k is TagKind => Object.hasOwn(TAG_KINDS, k);

/** Hex color + 2-digit alpha, for soft chip backgrounds ("#8b5cf6" -> "#8b5cf61f"). */
export const tint = (hex: string, alpha = "1f") => (/^#[0-9a-f]{6}$/i.test(hex) ? hex + alpha : hex);

export const formatDate = (d: Date, lang: "th" | "en" = "th") =>
  new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Bangkok" }).format(d);
export const thaiDate = (d: Date) => formatDate(d, "th");

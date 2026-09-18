// Fills the empty English fields (nameEn, titleEn, excerptEn, contentEn) of existing tags, games and news
// from the Thai -> English phrase map in prisma/data/en.json. Never overwrites English text that is already
// there, so it's safe to re-run. Rows it can't fully translate are listed and left empty (the /en page then
// shows the Thai text) — translate those from the admin.
//   npx tsx prisma/i18n-backfill.ts
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../lib/generated/prisma/client";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });
const phrases: Record<string, string> = JSON.parse(readFileSync(new URL("./data/en.json", import.meta.url), "utf8"));
const THAI = /[฀-๿]/;

/** English for a whole plain-text value, "" when it isn't Thai or isn't in the map. */
const text = (s: string) => (THAI.test(s) ? (phrases[s.trim()] ?? "") : "");

/** Translates every text node (and "<name> ภาพที่ N" image alts); "" unless nothing Thai is left. */
const html = (s: string) => {
  if (!THAI.test(s)) return "";
  const out = s
    .replace(/>([^<]+)</g, (m, t: string) => (THAI.test(t) && phrases[t.trim()] ? `>${phrases[t.trim()]}<` : m))
    .replace(/ alt="([^"]*?) ภาพที่ (\d+)"/g, ' alt="$1 screenshot $2"');
  return THAI.test(out) ? "" : out;
};

async function main() {
  let updated = 0;
  const missed: string[] = [];
  /** Fields that are empty now and got a translation (null if none). Thai fields left untranslated are noted. */
  const plan = (label: string, row: Record<string, unknown>, fields: Record<string, [thai: string, en: string]>) => {
    const data: Record<string, string> = {};
    const gaps: string[] = [];
    for (const [field, [thai, en]] of Object.entries(fields)) {
      if (row[field]) continue;
      if (en) data[field] = en;
      else if (THAI.test(thai)) gaps.push(field);
    }
    if (gaps.length) missed.push(`${label}: ${gaps.join(", ")}`);
    if (!Object.keys(data).length) return null;
    updated++;
    return data;
  };

  for (const t of await prisma.tag.findMany()) {
    const data = plan(`tag ${t.kind}/${t.slug}`, t, { nameEn: [t.name, text(t.name)] });
    if (data) await prisma.tag.update({ where: { id: t.id }, data });
  }
  // Games and news keep their updatedAt: a translation isn't a content change for the sitemap's lastmod.
  for (const g of await prisma.game.findMany()) {
    const data = plan(`game ${g.slug}`, g, { excerptEn: [g.excerpt, text(g.excerpt)], contentEn: [g.content, html(g.content)] });
    if (data) await prisma.game.update({ where: { id: g.id }, data: { ...data, updatedAt: g.updatedAt } });
  }
  for (const n of await prisma.news.findMany()) {
    const data = plan(`news ${n.slug}`, n, {
      titleEn: [n.title, text(n.title)],
      excerptEn: [n.excerpt, text(n.excerpt)],
      contentEn: [n.content, html(n.content)],
    });
    if (data) await prisma.news.update({ where: { id: n.id }, data: { ...data, updatedAt: n.updatedAt } });
  }

  console.log(`English backfill: updated ${updated} rows.`);
  if (missed.length) console.log(`Still Thai-only (translate in /admin):\n  ${missed.join("\n  ")}`);
}

main().finally(() => prisma.$disconnect());

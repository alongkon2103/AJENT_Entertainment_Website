// Seeds the content that used to be hardcoded on the homepage. Safe to re-run: everything is upserted by slug.
import "dotenv/config";
import { readFileSync } from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../lib/generated/prisma/client";
import { cleanRichText } from "../lib/sanitize";

const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: process.env.DATABASE_URL ?? "file:./prisma/dev.db" }) });

const tags = [
  { kind: "game-category", slug: "roblox", name: "Roblox", color: "#3b82f6", textColor: "#ffffff", sortOrder: 1 },
  { kind: "game-category", slug: "minecraft", name: "Minecraft", color: "#22c55e", textColor: "#ffffff", sortOrder: 2 },
  { kind: "game-badge", slug: "hot", name: "HOT", color: "#ec4899", textColor: "#ffffff", sortOrder: 1 },
  { kind: "game-badge", slug: "new", name: "NEW", color: "#8b5cf6", textColor: "#ffffff", sortOrder: 2 },
  { kind: "game-badge", slug: "update", name: "UPDATE", color: "#f59e0b", textColor: "#1e1636", sortOrder: 3 },
  { kind: "game-badge", slug: "recommended", name: "แนะนำ", color: "#10b981", textColor: "#ffffff", sortOrder: 4 },
  { kind: "news-category", slug: "new-game", name: "เกมใหม่", color: "#5b6abf", textColor: "#ffffff", sortOrder: 1 },
  { kind: "news-category", slug: "update", name: "อัปเดต", color: "#2e8bc0", textColor: "#ffffff", sortOrder: 2 },
  { kind: "news-category", slug: "promotion", name: "โปรโมชั่น", color: "#c0467a", textColor: "#ffffff", sortOrder: 3 },
  { kind: "news-category", slug: "article", name: "บทความ", color: "#2e8b6a", textColor: "#ffffff", sortOrder: 4 },
];

type SeedGame = {
  slug: string; name: string; genre: string; excerpt: string; content: string; coverImage: string; playUrl: string;
  rating: number; sortOrder: number; isPublished: boolean; isFeatured: boolean; category: string; badges: string[];
};
// Judy Studio + A CLASS STORE games, imported from judygamestudio.com/shop (images live in public/game-media).
const games: SeedGame[] = JSON.parse(readFileSync(new URL("./data/games.json", import.meta.url), "utf8"));

const news = [
  { slug: "judy-legend-launch", title: "เปิดตัวเกมใหม่ JUDY Legend", category: "new-game", date: "2026-09-04", excerpt: "เกมต่อสู้สายอนิเมะตัวใหม่ พร้อมระบบ TikTok Live Integration ให้ผู้ชมส่งของขวัญเปลี่ยนเกมได้ทันที" },
  { slug: "program-v2-1-0", title: "อัปเดตโปรแกรม v2.1.0", category: "update", date: "2026-08-28", excerpt: "เพิ่มโหมดโหนดสำหรับต่อกฎ ปรับความเร็วการอ่านของขวัญ และแก้ปัญหาโอเวอร์เลย์ใน TikTok LIVE Studio" },
  { slug: "monthly-promotion", title: "โปรโมชั่นพิเศษเดือนนี้!", category: "promotion", date: "2026-08-25", excerpt: "สิทธิพิเศษสำหรับสมาชิกสังกัดใหม่ รับชุดโอเวอร์เลย์และเพรีเซ็ตเกมเพิ่มเติม" },
  { slug: "grow-live-income", title: "วิธีเพิ่มรายได้จากไลฟ์เกม", category: "article", date: "2026-08-20", excerpt: "เทคนิคจัดกฎของขวัญให้ผู้ชมมีส่วนร่วม พร้อมตัวอย่างการตั้งค่าที่สตรีมเมอร์ในสังกัดใช้จริง" },
];

const para = (text: string) => `<h2>รายละเอียด</h2><p>${text}</p><p>แก้ไขเนื้อหานี้ได้จากหน้าแอดมิน</p>`;

async function main() {
  const tagId = new Map<string, number>();
  for (const t of tags) {
    const row = await prisma.tag.upsert({ where: { kind_slug: { kind: t.kind, slug: t.slug } }, update: {}, create: t });
    tagId.set(`${t.kind}:${t.slug}`, row.id);
  }

  for (const { category, badges, ...g } of games) {
    const data = {
      ...g,
      content: cleanRichText(g.content),
      categoryId: tagId.get(`game-category:${category}`),
      badges: { connect: badges.map((b) => ({ id: tagId.get(`game-badge:${b}`)! })) },
    };
    await prisma.game.upsert({ where: { slug: g.slug }, update: {}, create: data });
  }

  for (const n of news) {
    const data = {
      title: n.title,
      excerpt: n.excerpt,
      content: para(n.excerpt),
      isPublished: true,
      publishedAt: new Date(`${n.date}T10:00:00+07:00`),
      categoryId: tagId.get(`news-category:${n.category}`),
    };
    await prisma.news.upsert({ where: { slug: n.slug }, update: {}, create: { slug: n.slug, ...data } });
  }

  console.log(`Seeded ${tags.length} tags, ${games.length} games, ${news.length} news.`);
}

main().finally(() => prisma.$disconnect());

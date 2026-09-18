import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "./db";
import type { Locale } from "@/app/i18n";
import type { Prisma, Tag } from "./generated/prisma/client";

// Public-site queries. Only published items; categories/badges that are switched off are hidden.
const gameInclude = {
  category: true,
  badges: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
} satisfies Prisma.GameInclude;
const newsInclude = { category: true } satisfies Prisma.NewsInclude;

export type GameWithTags = Prisma.GameGetPayload<{ include: typeof gameInclude }>;
export type NewsWithTag = Prisma.NewsGetPayload<{ include: typeof newsInclude }>;

const gameOrder: Prisma.GameOrderByWithRelationInput[] = [{ isFeatured: "desc" }, { sortOrder: "asc" }, { createdAt: "desc" }];
const newsOrder: Prisma.NewsOrderByWithRelationInput[] = [{ isPinned: "desc" }, { publishedAt: "desc" }];
const liveNews = () => ({ isPublished: true, publishedAt: { lte: new Date() } }); // future publishedAt = scheduled

const gameCategories = () =>
  prisma.tag.findMany({ where: { kind: "game-category", isActive: true }, orderBy: { sortOrder: "asc" } });

// English pages use the *En fields; any that are still empty fall back to the Thai text.
const tagIn = <T extends Tag | null>(lang: Locale, t: T): T => (lang === "en" && t?.nameEn ? { ...t, name: t.nameEn } : t);
const gameIn = (lang: Locale) => (g: GameWithTags): GameWithTags =>
  lang === "en"
    ? {
        ...g,
        excerpt: g.excerptEn || g.excerpt,
        content: g.contentEn || g.content,
        category: tagIn(lang, g.category),
        badges: g.badges.map((b) => tagIn(lang, b)),
      }
    : g;
const newsIn = (lang: Locale) => (n: NewsWithTag): NewsWithTag =>
  lang === "en"
    ? { ...n, title: n.titleEn || n.title, excerpt: n.excerptEn || n.excerpt, content: n.contentEn || n.content, category: tagIn(lang, n.category) }
    : n;

export async function getHomeContent(lang: Locale) {
  await connection(); // read at request time so admin edits show up immediately and builds never need the DB
  const [games, categories, news] = await Promise.all([
    prisma.game.findMany({ where: { isPublished: true }, include: gameInclude, orderBy: gameOrder, take: 4 }),
    gameCategories(),
    prisma.news.findMany({ where: liveNews(), include: newsInclude, orderBy: newsOrder, take: 4 }),
  ]);
  return { games: games.map(gameIn(lang)), categories: categories.map((c) => tagIn(lang, c)), news: news.map(newsIn(lang)) };
}

export async function getAllGames(lang: Locale) {
  await connection();
  const [games, categories] = await Promise.all([
    prisma.game.findMany({ where: { isPublished: true }, include: gameInclude, orderBy: gameOrder }),
    gameCategories(),
  ]);
  return { games: games.map(gameIn(lang)), categories: categories.map((c) => tagIn(lang, c)) };
}

export const getGame = cache(async (slug: string, lang: Locale) => {
  await connection();
  const game = await prisma.game.findFirst({ where: { slug, isPublished: true }, include: gameInclude });
  if (!game) return null;
  const more = await prisma.game.findMany({
    where: { isPublished: true, id: { not: game.id } },
    include: gameInclude,
    orderBy: gameOrder,
    take: 4,
  });
  return { game: gameIn(lang)(game), more: more.map(gameIn(lang)) };
});

export async function getAllNews(lang: Locale) {
  await connection();
  return (await prisma.news.findMany({ where: liveNews(), include: newsInclude, orderBy: newsOrder })).map(newsIn(lang));
}

export const getNews = cache(async (slug: string, lang: Locale) => {
  await connection();
  const item = await prisma.news.findFirst({ where: { slug, ...liveNews() }, include: newsInclude });
  if (!item) return null;
  const more = await prisma.news.findMany({ where: { ...liveNews(), id: { not: item.id } }, include: newsInclude, orderBy: newsOrder, take: 4 });
  return { item: newsIn(lang)(item), more: more.map(newsIn(lang)) };
});

/** Cover image per slug for published games (used by the Tikkies preset cards on /download). */
export async function getGameCovers(slugs: string[]) {
  await connection();
  const rows = await prisma.game.findMany({ where: { slug: { in: slugs }, isPublished: true }, select: { slug: true, coverImage: true } });
  return new Map(rows.map((r) => [r.slug, r.coverImage]));
}

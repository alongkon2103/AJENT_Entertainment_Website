import "server-only";
import { cache } from "react";
import { connection } from "next/server";
import { prisma } from "./db";
import type { Prisma } from "./generated/prisma/client";

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

export async function getHomeContent() {
  await connection(); // read at request time so admin edits show up immediately and builds never need the DB
  const [games, categories, news] = await Promise.all([
    prisma.game.findMany({ where: { isPublished: true }, include: gameInclude, orderBy: gameOrder, take: 4 }),
    gameCategories(),
    prisma.news.findMany({ where: liveNews(), include: newsInclude, orderBy: newsOrder, take: 4 }),
  ]);
  return { games, categories, news };
}

export async function getAllGames() {
  await connection();
  const [games, categories] = await Promise.all([
    prisma.game.findMany({ where: { isPublished: true }, include: gameInclude, orderBy: gameOrder }),
    gameCategories(),
  ]);
  return { games, categories };
}

export const getGame = cache(async (slug: string) => {
  await connection();
  const game = await prisma.game.findFirst({ where: { slug, isPublished: true }, include: gameInclude });
  if (!game) return null;
  const more = await prisma.game.findMany({
    where: { isPublished: true, id: { not: game.id } },
    include: gameInclude,
    orderBy: gameOrder,
    take: 4,
  });
  return { game, more };
});

export async function getAllNews() {
  await connection();
  return prisma.news.findMany({ where: liveNews(), include: newsInclude, orderBy: newsOrder });
}

export const getNews = cache(async (slug: string) => {
  await connection();
  const item = await prisma.news.findFirst({ where: { slug, ...liveNews() }, include: newsInclude });
  if (!item) return null;
  const more = await prisma.news.findMany({ where: { ...liveNews(), id: { not: item.id } }, include: newsInclude, orderBy: newsOrder, take: 4 });
  return { item, more };
});

/** Cover image per slug for published games (used by the Tikkies preset cards on /download). */
export async function getGameCovers(slugs: string[]) {
  await connection();
  const rows = await prisma.game.findMany({ where: { slug: { in: slugs }, isPublished: true }, select: { slug: true, coverImage: true } });
  return new Map(rows.map((r) => [r.slug, r.coverImage]));
}

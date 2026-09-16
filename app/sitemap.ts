import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/seo";

type Row = { slug: string; updatedAt: Date; coverImage: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // always reflect the current CMS content, and never touch the DB at build time
  const now = new Date();
  const select = { slug: true, updatedAt: true, coverImage: true } as const;
  const [games, news] = await Promise.all([
    prisma.game.findMany({ where: { isPublished: true }, select, orderBy: { sortOrder: "asc" } }),
    prisma.news.findMany({ where: { isPublished: true, publishedAt: { lte: now } }, select, orderBy: { publishedAt: "desc" } }),
  ]);
  const latest = (rows: Row[]) => rows.reduce<Date | undefined>((max, r) => (!max || r.updatedAt > max ? r.updatedAt : max), undefined);
  const entry = (base: string, r: Row, priority: number) => ({
    url: absoluteUrl(`${base}/${r.slug}`),
    lastModified: r.updatedAt,
    changeFrequency: "weekly" as const,
    priority,
    ...(r.coverImage && { images: [absoluteUrl(r.coverImage)] }),
  });

  return [
    { url: absoluteUrl("/"), lastModified: latest([...games, ...news]), changeFrequency: "daily", priority: 1 },
    { url: absoluteUrl("/games"), lastModified: latest(games), changeFrequency: "daily", priority: 0.9 },
    { url: absoluteUrl("/download"), changeFrequency: "weekly", priority: 0.8 },
    { url: absoluteUrl("/news"), lastModified: latest(news), changeFrequency: "daily", priority: 0.7 },
    ...games.map((g) => entry("/games", g, 0.8)),
    ...news.map((n) => entry("/news", n, 0.6)),
  ];
}

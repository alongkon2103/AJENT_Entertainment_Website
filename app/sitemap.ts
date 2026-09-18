import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { absoluteUrl, languageAlternates } from "@/lib/seo";
import { localePath, locales } from "./i18n";

type Row = { slug: string; updatedAt: Date; coverImage: string };
type Page = Omit<MetadataRoute.Sitemap[number], "url" | "alternates"> & { path: string };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection(); // always reflect the current CMS content, and never touch the DB at build time
  const now = new Date();
  const select = { slug: true, updatedAt: true, coverImage: true } as const;
  const [games, news] = await Promise.all([
    prisma.game.findMany({ where: { isPublished: true }, select, orderBy: { sortOrder: "asc" } }),
    prisma.news.findMany({ where: { isPublished: true, publishedAt: { lte: now } }, select, orderBy: { publishedAt: "desc" } }),
  ]);
  const latest = (rows: Row[]) => rows.reduce<Date | undefined>((max, r) => (!max || r.updatedAt > max ? r.updatedAt : max), undefined);
  const entry = (base: string, r: Row, priority: number): Page => ({
    path: `${base}/${r.slug}`,
    lastModified: r.updatedAt,
    changeFrequency: "weekly",
    priority,
    ...(r.coverImage && { images: [absoluteUrl(r.coverImage)] }),
  });

  const pages: Page[] = [
    { path: "/", lastModified: latest([...games, ...news]), changeFrequency: "daily", priority: 1 },
    { path: "/games", lastModified: latest(games), changeFrequency: "daily", priority: 0.9 },
    { path: "/download", changeFrequency: "weekly", priority: 0.8 },
    { path: "/news", lastModified: latest(news), changeFrequency: "daily", priority: 0.7 },
    ...games.map((g) => entry("/games", g, 0.8)),
    ...news.map((n) => entry("/news", n, 0.6)),
  ];

  // One URL per language, each listing every language version (hreflang) so Google pairs them.
  return pages.flatMap(({ path, ...rest }) => {
    const languages = Object.fromEntries(Object.entries(languageAlternates(path)).map(([k, v]) => [k, absoluteUrl(v)]));
    return locales.map((lang) => ({ url: absoluteUrl(localePath(lang, path)), alternates: { languages }, ...rest }));
  });
}

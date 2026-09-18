import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllGames } from "@/lib/content";
import { breadcrumbLd, itemListLd, pageMetadata } from "@/lib/seo";
import { getDictionary } from "../../dictionaries";
import { GamesShowcase } from "../../home-client";
import { isLocale } from "../../i18n";
import { JsonLd } from "../../json-ld";
import { RevealObserver } from "../../ui";

export async function generateMetadata({ params }: PageProps<"/[lang]/games">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).games;
  return pageMetadata({ lang, title: t.metaTitle, description: t.metaDescription, path: "/games" });
}

export default async function GamesPage({ params }: PageProps<"/[lang]/games">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).games;
  const { games, categories } = await getAllGames(lang);
  return (
    <>
      <JsonLd data={[breadcrumbLd(lang, [[t.crumb, "/games"]]), itemListLd(lang, games.map((g) => ({ name: g.name, path: `/games/${g.slug}` })))]} />
      <RevealObserver />
      <main>
      <section className="page-hero">
        <div className="page-hero-inner">
          <div className="faq-badge">{t.badge}</div>
          <h1 className="page-title">
            {t.title} <span className="grad-text">TikTok Live</span>
          </h1>
          <p className="page-desc">{t.desc}</p>
        </div>
      </section>
      <section className="sec-dark">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <GamesShowcase lang={lang} games={games} categories={categories} />
        </div>
      </section>
      </main>
    </>
  );
}

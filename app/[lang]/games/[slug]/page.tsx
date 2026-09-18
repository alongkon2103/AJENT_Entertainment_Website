import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/content";
import { absoluteUrl, breadcrumbLd, pageMetadata, snippet } from "@/lib/seo";
import { GameCard } from "../../../cards";
import { getDictionary } from "../../../dictionaries";
import { isLocale, localePath } from "../../../i18n";
import { lazyRichImages, Media } from "../../../media";
import { JsonLd } from "../../../json-ld";
import { Arrow, RevealObserver } from "../../../ui";

/** Keeps "<title> | AJENT" inside Google's display width, dropping words instead of cutting mid-phrase. */
const gameTitle = (candidates: string[], name: string) => [...candidates, name].find((t) => t.length <= 52) ?? name.slice(0, 52);

export async function generateMetadata({ params }: PageProps<"/[lang]/games/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).game;
  const data = await getGame(slug, lang);
  if (!data) return { title: t.notFound, robots: { index: false } };
  const { game } = data;
  const platform = game.category?.isActive ? game.category.name : "";
  return pageMetadata({
    lang,
    title: gameTitle(t.titles(game.name, platform), game.name),
    description: snippet([game.excerpt || t.fallbackDescription(game.name), game.genre].filter(Boolean).join(" · ")),
    path: `/games/${game.slug}`,
    image: game.coverImage ? { url: game.coverImage, alt: game.name } : undefined,
  });
}

export default async function GameDetailPage({ params }: PageProps<"/[lang]/games/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const t = d.game;
  const data = await getGame(slug, lang);
  if (!data) notFound();
  const { game, more } = data;
  const cat = game.category?.isActive ? game.category : null;
  const genreParts = game.genre.split("·").map((p) => p.trim()).filter(Boolean);
  const studio = genreParts.length > 1 ? genreParts[genreParts.length - 1] : undefined;
  const gameLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    url: absoluteUrl(localePath(lang, `/games/${game.slug}`)),
    description: game.excerpt || undefined,
    image: game.coverImage ? [absoluteUrl(game.coverImage)] : undefined,
    genre: studio ? genreParts.slice(0, -1) : genreParts,
    gamePlatform: cat?.name,
    applicationCategory: "Game",
    inLanguage: lang,
    keywords: [game.name, cat?.name, "TikTok Live", "TikFinity", "Interactive LIVE"].filter(Boolean).join(", "),
    ...(studio && { author: { "@type": "Organization", name: studio }, publisher: { "@type": "Organization", name: studio } }),
    ...(game.playUrl && { sameAs: game.playUrl }),
  };

  return (
    <>
      <JsonLd data={[gameLd, breadcrumbLd(lang, [[d.games.crumb, "/games"], [game.name, `/games/${game.slug}`]])]} />
      <RevealObserver />
      <main>
      <section className="detail-hero">
        <div className="detail-hero-inner">
          <div>
            <div className="detail-crumb">
              <Link href={localePath(lang, "/games")}>{d.games.crumb}</Link> / {game.name}
            </div>
            <div className="detail-chips">
              {cat && (
                <span className="detail-chip" style={{ background: cat.color, color: cat.textColor }}>
                  {cat.name}
                </span>
              )}
              {game.badges.map((b) => (
                <span key={b.id} className="detail-chip" style={{ background: b.color, color: b.textColor }}>
                  {b.name}
                </span>
              ))}
            </div>
            <h1 className="detail-title">{game.name}</h1>
            <div className="detail-meta">
              {game.genre && <span>{game.genre}</span>}
              {game.rating > 0 && (
                <span>
                  <span className="game-star">★</span> {game.rating.toFixed(1)}
                </span>
              )}
            </div>
            {game.excerpt && <p className="detail-lead">{game.excerpt}</p>}
            <div className="detail-actions">
              {game.playUrl && (
                <a className="preview-btn" href={game.playUrl} target="_blank" rel="noopener noreferrer">
                  {t.play} <Arrow size={14} />
                </a>
              )}
              <Link className="btn-ghost detail-ghost" href={localePath(lang, "/download")}>
                {t.download}
              </Link>
            </div>
          </div>
          <div className="detail-cover reveal-right">
            {game.coverImage ? <Media src={game.coverImage} alt={game.name} fill sizes="(max-width: 900px) 92vw, 560px" priority /> : <div className="game-img-placeholder" />}
          </div>
        </div>
      </section>

      {game.content && (
        <section className="detail-body">
          <div className="rich-card reveal">
            <div className="rich" dangerouslySetInnerHTML={{ __html: lazyRichImages(game.content) }} />
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="sec-dark">
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="games-header reveal">
              <div className="games-badge">{t.moreBadge}</div>
              <h2 className="games-title">
                {t.moreTitle}<span>{t.moreTitleAccent}</span>
              </h2>
            </div>
            <div className="games-grid">
              {more.map((g, i) => (
                <GameCard key={g.id} lang={lang} game={g} style={{ transitionDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </section>
      )}
      </main>
    </>
  );
}

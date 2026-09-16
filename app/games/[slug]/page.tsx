import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGame } from "@/lib/content";
import { absoluteUrl, breadcrumbLd, pageMetadata, snippet } from "@/lib/seo";
import { GameCard } from "../../cards";
import { JsonLd } from "../../json-ld";
import { Arrow, Footer, Nav, RevealObserver } from "../../ui";

export async function generateMetadata({ params }: PageProps<"/games/[slug]">): Promise<Metadata> {
  const data = await getGame((await params).slug);
  if (!data) return { title: "ไม่พบเกม", robots: { index: false } };
  const { game } = data;
  const platform = game.category?.isActive ? game.category.name : "";
  return pageMetadata({
    title: platform ? `${game.name} — เกม ${platform} เชื่อมต่อ TikTok Live` : `${game.name} — เกมเชื่อมต่อ TikTok Live`,
    description: snippet([game.excerpt || `${game.name} เกมสำหรับสตรีมเมอร์ TikTok Live`, game.genre].filter(Boolean).join(" · ")),
    path: `/games/${game.slug}`,
    image: game.coverImage ? { url: game.coverImage, alt: game.name } : undefined,
  });
}

export default async function GameDetailPage({ params }: PageProps<"/games/[slug]">) {
  const data = await getGame((await params).slug);
  if (!data) notFound();
  const { game, more } = data;
  const cat = game.category?.isActive ? game.category : null;
  const genreParts = game.genre.split("·").map((p) => p.trim()).filter(Boolean);
  const studio = genreParts.length > 1 ? genreParts[genreParts.length - 1] : undefined;
  const gameLd = {
    "@context": "https://schema.org",
    "@type": "VideoGame",
    name: game.name,
    url: absoluteUrl(`/games/${game.slug}`),
    description: game.excerpt || undefined,
    image: game.coverImage ? [absoluteUrl(game.coverImage)] : undefined,
    genre: studio ? genreParts.slice(0, -1) : genreParts,
    gamePlatform: cat?.name,
    applicationCategory: "Game",
    inLanguage: "th",
    keywords: [game.name, cat?.name, "TikTok Live", "TikFinity", "Interactive LIVE"].filter(Boolean).join(", "),
    ...(studio && { author: { "@type": "Organization", name: studio }, publisher: { "@type": "Organization", name: studio } }),
    ...(game.playUrl && { sameAs: game.playUrl }),
  };

  return (
    <>
      <Nav />
      <JsonLd data={[gameLd, breadcrumbLd([["เกมในสังกัด", "/games"], [game.name, `/games/${game.slug}`]])]} />
      <RevealObserver />
      <main>
      <section className="detail-hero">
        <div className="detail-hero-inner">
          <div>
            <div className="detail-crumb">
              <Link href="/games">เกมในสังกัด</Link> / {game.name}
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
                  เข้าเล่นเกม <Arrow size={14} />
                </a>
              )}
              <Link className="btn-ghost detail-ghost" href="/download">
                ดาวน์โหลดโปรแกรมเชื่อมต่อ
              </Link>
            </div>
          </div>
          <div className="detail-cover reveal-right">
            {game.coverImage ? <img src={game.coverImage} alt={game.name} /> : <div className="game-img-placeholder" />}
          </div>
        </div>
      </section>

      {game.content && (
        <section className="detail-body">
          <div className="rich-card reveal">
            <div className="rich" dangerouslySetInnerHTML={{ __html: game.content }} />
          </div>
        </section>
      )}

      {more.length > 0 && (
        <section className="sec-dark">
          <div style={{ maxWidth: 1100, margin: "0 auto" }}>
            <div className="games-header reveal">
              <div className="games-badge">เกมอื่นในสังกัด</div>
              <h2 className="games-title">
                ลองดูเกม<span>อื่นๆ</span>
              </h2>
            </div>
            <div className="games-grid">
              {more.map((g, i) => (
                <GameCard key={g.id} game={g} style={{ transitionDelay: `${i * 0.1}s` }} />
              ))}
            </div>
          </div>
        </section>
      )}
      </main>
      <Footer />
    </>
  );
}

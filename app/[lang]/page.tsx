import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getHomeContent } from "@/lib/content";
import { faqLd, pageMetadata } from "@/lib/seo";
import { NewsCard } from "../cards";
import { featIcons } from "../data";
import { getDictionary } from "../dictionaries";
import { GamesShowcase, HeroJoin, HeroVideo, StepsVisual } from "../home-client";
import { isLocale, localePath } from "../i18n";
import { JsonLd } from "../json-ld";
import { Media } from "../media";
import { Arrow, Faq, RevealObserver } from "../ui";

export async function generateMetadata({ params }: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { site } = getDictionary(lang);
  return pageMetadata({ lang, title: site.title, absoluteTitle: true, description: site.description, path: "/" });
}

export default async function Home({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const t = d.home;
  const { games, categories, news } = await getHomeContent(lang);

  return (
    <>
      <JsonLd data={faqLd(t.faqs)} />
      <RevealObserver />
      <main>

      {/* ===== HERO ===== */}
      <section className="hero" id="home">
        <div className="hero-diagonal" />
        <div className="hero-inner">
          <HeroJoin lang={lang} t={d.hero} />

          <div className="hero-devices">
            <div className="hero-laptop">
              <div className="hero-laptop-frame">
                <div className="hero-laptop-bar">
                  <div className="hero-laptop-dot" style={{ background: "#ff5f57" }} />
                  <div className="hero-laptop-dot" style={{ background: "#ffbd2e" }} />
                  <div className="hero-laptop-dot" style={{ background: "#28c840" }} />
                </div>
                <Media
                  className="hero-laptop-img"
                  src="/BannerTk.jpeg"
                  alt={t.heroImageAlt}
                  width={1024}
                  height={626}
                  sizes="(max-width: 1000px) 78vw, 560px"
                  priority
                />
              </div>
            </div>
            <div className="hero-phone">
              <div className="hero-phone-frame">
                <div className="hero-phone-notch"><div className="hero-phone-notch-inner" /></div>
                <div className="hero-phone-body">
                  <HeroVideo label={d.hero.videoLabel} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE STRIP ===== */}
      <div className="feat-strip-wrap reveal">
        <div className="feat-strip">
          {t.feats.map((f, i) => {
            const FeatIcon = featIcons[i];
            return (
            <div key={f.title} className="feat-item reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className={`feat-icon feat-icon-${i + 1}`}><FeatIcon size={24} strokeWidth={1.9} aria-hidden="true" /></div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-text">{f.text}</div>
            </div>
            );
          })}
        </div>
      </div>

      {/* ===== 4 STEPS ===== */}
      <section id="program" className="section">
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>{t.stepsLabel}</div>
            <h2 className="sec-title reveal">{t.stepsTitle}</h2>
            <p className="sec-desc">{t.stepsDesc}</p>
          </div>
          <div className="steps-new">
            <StepsVisual alt={t.stepsImageAlt} />
            <div className="steps-cards">
              {t.steps.map((s, i) => (
                <div key={s.num} className="step-new-card reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
                  <div className="step-new-num">{s.num}</div>
                  <div className="step-new-body">
                    <div className="step-new-t">{s.title}</div>
                    <div className="step-new-d">{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ===== GAMES ===== */}
      <section id="game" className="sec-dark">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="games-header reveal">
            <div className="games-badge">{t.gamesBadge}</div>
            <h2 className="games-title">{t.gamesTitle}<span>{t.gamesTitleAccent}</span></h2>
            <div className="games-subtitle">{t.gamesSubtitle}</div>
          </div>

          <GamesShowcase lang={lang} games={games} categories={categories} />

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link href={localePath(lang, "/games")} className="games-viewall reveal">
              {t.gamesViewAll}
              <Arrow size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ===== PROGRAM PREVIEW ===== */}
      <section id="preview" className="section">
        <div className="preview-wrap reveal">
          <div className="preview-content">
            <div className="preview-left reveal-left">
              <div className="sec-label reveal" style={{ color: "#a78bfa" }}>{t.previewLabel}</div>
              <h2 className="sec-title reveal">{t.previewTitle}<br /><span className="grad-text">TikTok Live</span></h2>
              <p className="sec-desc" style={{ margin: "16px 0 24px" }}>{t.previewDesc}</p>
              <div className="preview-features">
                {t.previewFeats.map((f) => (
                  <div key={f} className="preview-feat"><div className="preview-feat-dot" />{f}</div>
                ))}
              </div>
              <Link className="preview-btn" href={localePath(lang, "/download")}>
                {t.previewBtn}
                <Arrow size={14} />
              </Link>
            </div>
            <div className="preview-right reveal-right">
              <div className="preview-screen">
                <div className="preview-screen-bar">
                  <div className="preview-dot" style={{ background: "#ff5f57" }} />
                  <div className="preview-dot" style={{ background: "#ffbd2e" }} />
                  <div className="preview-dot" style={{ background: "#28c840" }} />
                  <span className="preview-screen-title">Tikkies Tools</span>
                </div>
                { }
                <Media src="/tikkies-preview.png" alt={d.common.screenshotAlt} width={1512} height={893} sizes="(max-width: 900px) 92vw, 560px" style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NEWS ===== */}
      <section id="news" className="section">
        <div className="sec-top reveal">
          <div>
            <div className="sec-label reveal" style={{ color: "#8b5cf6" }}>{t.newsLabel}</div>
            <p className="sec-desc">{t.newsDesc}</p>
          </div>
          <Link className="sec-link" href={localePath(lang, "/news")}>{d.common.viewAll} &rarr;</Link>
        </div>
        <div className="news-grid">
          {news.map((n, i) => (
            <NewsCard key={n.id} lang={lang} item={n} style={{ transitionDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="section" style={{ paddingTop: 0 }}>
        <div className="faq-header reveal">
          <div className="faq-badge">{t.faqBadge}</div>
          <h2 className="faq-title">{t.faqTitle}</h2>
          <div className="faq-subtitle">{t.faqSubtitle}</div>
        </div>
        <Faq items={t.faqs} />
      </section>

      </main>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getGameCovers } from "@/lib/content";
import { absoluteUrl, breadcrumbLd, faqLd, pageMetadata, snippet } from "@/lib/seo";
import { tikkies } from "../../data";
import { getDictionary } from "../../dictionaries";
import { isLocale, localePath } from "../../i18n";
import { Media } from "../../media";
import { JsonLd } from "../../json-ld";
import { Icon } from "../../icons";
import { Arrow, Faq, RevealObserver } from "../../ui";
import AppEmbed from "./AppEmbed";

export async function generateMetadata({ params }: PageProps<"/[lang]/download">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).download;
  return pageMetadata({
    lang,
    title: t.metaTitle,
    description: snippet(t.metaDescription(tikkies.app.version)),
    path: "/download",
    image: { url: "/BannerTk.jpeg", width: 1024, height: 626, alt: t.imageAlt },
  });
}

export default async function DownloadPage({ params }: PageProps<"/[lang]/download">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  const t = d.download;
  const { app, presets, compat } = tikkies;
  const { intro, capabilities, workflow, installSteps, faqs } = t;
  const covers = await getGameCovers(presets.map((p) => p.slug));
  return (
    <>
      <JsonLd
        data={[
          {
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "Tikkies Tools",
            applicationCategory: "MultimediaApplication",
            operatingSystem: "Windows 10, Windows 11",
            softwareVersion: app.version,
            fileSize: app.size,
            downloadUrl: app.url,
            url: absoluteUrl(localePath(lang, "/download")),
            image: absoluteUrl("/BannerTk.jpeg"),
            screenshot: absoluteUrl("/tikkies-preview.png"),
            description: t.appDescription,
            featureList: capabilities.map((c) => `${c.title}: ${c.sub}`),
            inLanguage: lang,
          },
          faqLd(faqs),
          breadcrumbLd(lang, [[t.crumb, "/download"]]),
        ]}
      />
      <RevealObserver />
      <main>

      {/* ===== HERO ===== */}
      <section className="page-hero" id="top">
        <div className="page-hero-inner">
          <div className="faq-badge">{t.badge}</div>
          <h1 className="page-title">{t.title} <span className="grad-text">Tikkies Tools</span></h1>
          <p className="page-desc">{t.desc}</p>
          <div className="dl-card reveal">
            <div>
              <div className="dl-card-name">Tikkies Tools <span className="dl-card-ver">v{app.version}</span></div>
              <div className="dl-card-meta">{app.os} · {app.size}</div>
            </div>
            <div className="dl-card-actions">
              <a className="preview-btn" href={app.url}>{t.installer} <Arrow size={14} /></a>
              <a className="btn-ghost" href="#try">{t.tryFirst}</a>
            </div>
          </div>
          <p className="dl-note">{t.noteBefore} <Link href={localePath(lang, "/#contact")}>{t.noteLink}</Link> {t.noteAfter}</p>
        </div>
      </section>

      {/* ===== WHAT IS IT ===== */}
      <section className="section">
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>{t.whatLabel}</div>
            <h2 className="sec-title reveal">{t.whatTitle}</h2>
            <p className="sec-desc">{t.whatDesc}</p>
          </div>
          <div className="card-grid">
            {intro.map((it, i) => (
              <div key={it.title} className="step-new-card reveal" style={{ transitionDelay: `${i * 0.12}s` }}>
                <div className="step-new-num"><Icon name={it.icon} size={20} /></div>
                <div className="step-new-body">
                  <div className="step-new-t">{it.title}</div>
                  <div className="step-new-d">{it.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== SEE THE REAL THING (the app, in-page) ===== */}
      <section className="sec-dark" id="try">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="games-header reveal">
            <div className="games-badge">{t.tryBadge}</div>
            <h2 className="games-title">{t.tryTitle}<span>{t.tryTitleAccent}</span></h2>
            <div className="games-subtitle">{t.trySubtitle}</div>
          </div>
          <AppEmbed lang={lang} demo={app.demo} t={d.embed} />
        </div>
      </section>

      {/* ===== WHAT IT CAN DO ===== */}
      <section className="section">
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>{t.capLabel}</div>
            <h2 className="sec-title reveal">{t.capTitle}</h2>
            <p className="sec-desc">{t.capDesc}</p>
          </div>
          <div className="steps-cards">
            {capabilities.map((c, i) => (
              <div key={c.num} className="step-new-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                <div className="step-new-num">{c.num}</div>
                <div className="step-new-body">
                  <div className="step-new-t">{c.title} <span style={{ fontWeight: 500, color: "#8b5cf6" }}>· {c.sub}</span></div>
                  <div className="step-new-d">{c.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="preview-wrap reveal">
          <div className="preview-content">
            <div className="preview-left reveal-left">
              <div className="sec-label reveal" style={{ color: "#a78bfa" }}>{t.howLabel}</div>
              <h2 className="sec-title reveal">{t.howTitle}<br /><span className="grad-text">{t.howTitleAccent}</span></h2>
              <div className="steps-cards" style={{ marginTop: 20 }}>
                {workflow.map((w, i) => (
                  <div key={w.num} className="step-new-card reveal" style={{ transitionDelay: `${i * 0.12}s`, padding: "16px 18px" }}>
                    <div className="step-new-num" style={{ width: 38, height: 38, fontSize: 14 }}>{w.num}</div>
                    <div className="step-new-body">
                      <div className="step-new-t">{w.title}</div>
                      <div className="step-new-d">{w.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
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

      {/* ===== EASY INSTALL ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>{t.installLabel}</div>
            <h2 className="sec-title reveal">{t.installTitle}</h2>
            <p className="sec-desc">{t.installDesc}</p>
          </div>
          <div className="card-grid cols-2">
            {installSteps.map((s, i) => (
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
      </section>

      {/* ===== SUPPORTED GAMES (dark) ===== */}
      <section className="sec-dark">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div className="games-header reveal">
            <div className="games-badge">{t.presetsBadge}</div>
            <h2 className="games-title">{t.presetsTitle}</h2>
            <div className="games-subtitle">{t.presetsSubtitle}</div>
          </div>
          <div className="card-grid">
            {presets.map((p, i) => {
              const cover = covers.get(p.slug);
              const href = covers.has(p.slug) ? localePath(lang, `/games/${p.slug}`) : undefined; // only link games that are published
              const image = (
                <>
                  {cover ? (
                    <Media className="game-cover" src={cover} alt={t.presetAlt(p.name)} fill sizes="(max-width: 600px) 92vw, (max-width: 900px) 46vw, 350px" />
                  ) : (
                    <div className="game-img-placeholder" />
                  )}
                  <div className="game-platform game-platform-hot">HOT</div>
                </>
              );
              return (
                <div key={p.name} className="game-card reveal" style={{ transitionDelay: `${i * 0.1}s` }}>
                  {href ? (
                    <Link href={href} className="game-img" style={{ background: p.bg }}>
                      {image}
                    </Link>
                  ) : (
                    <div className="game-img" style={{ background: p.bg }}>
                      {image}
                    </div>
                  )}
                  <div className="game-body">
                    <div className="game-name">{p.name}</div>
                    <div className="game-genre">{p.sub}</div>
                    <div className="game-bottom">
                      <div className="game-rating"><span className="game-star"><Icon name="zap" size={13} /></span>{p.rules} {t.presetRules}</div>
                      {href && (
                        <Link href={href} className="game-detail-btn">
                          {t.presetView}
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ===== WORKS WITH ===== */}
      <section className="section">
        <div className="sec-top reveal">
          <div>
            <div className="sec-label reveal" style={{ color: "#8b5cf6" }}>{t.compatLabel}</div>
            <h2 className="sec-title reveal">{t.compatTitle}</h2>
            <p className="sec-desc">{t.compatDesc}</p>
          </div>
        </div>
        <div className="card-grid cols-4">
          {compat.map((c, i) => (
            <div key={c.name} className="compat-item reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className="compat-icon" style={{ background: c.color }}>{c.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="compat-name">{c.name}</div>
                <div className="compat-desc">{t.compat[i]}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="faq-header reveal">
          <div className="faq-badge">{t.faqBadge}</div>
          <h2 className="faq-title">{t.faqTitle}</h2>
          <div className="faq-subtitle">{t.faqSubtitle}</div>
        </div>
        <Faq items={faqs} />
      </section>

      </main>
    </>
  );
}

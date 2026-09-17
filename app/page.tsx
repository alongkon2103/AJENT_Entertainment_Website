import Link from "next/link";
import { getHomeContent } from "@/lib/content";
import { faqLd, pageMetadata, SITE } from "@/lib/seo";
import { NewsCard } from "./cards";
import { Media } from "./media";
import { faqs, feats, previewFeats, steps } from "./data";
import { GamesShowcase, HeroJoin, HeroVideo, StepsVisual } from "./home-client";
import { JsonLd } from "./json-ld";
import { Arrow, Faq, Footer, Nav, RevealObserver } from "./ui";

export const metadata = pageMetadata({ title: SITE.title, absoluteTitle: true, description: SITE.description, path: "/" });

export default async function Home() {
  const { games, categories, news } = await getHomeContent();

  return (
    <>
      <Nav />
      <JsonLd data={faqLd(faqs)} />
      <RevealObserver />
      <main>

      {/* ===== HERO ===== */}
      <section className="hero" id="home">
        <div className="hero-diagonal" />
        <div className="hero-inner">
          <HeroJoin />

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
                  alt="Tikkies Tools โปรแกรม TikTok LIVE Interactive สำหรับสตรีมเมอร์"
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
                  <HeroVideo />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FEATURE STRIP ===== */}
      <div className="feat-strip-wrap reveal">
        <div className="feat-strip">
          {feats.map((f, i) => (
            <div key={f.title} className="feat-item reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className={`feat-icon feat-icon-${i + 1}`}><f.icon size={24} strokeWidth={1.9} aria-hidden="true" /></div>
              <div className="feat-title">{f.title}</div>
              <div className="feat-text">{f.text}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ===== 4 STEPS ===== */}
      <section id="program" className="section">
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>เริ่มใช้งานง่าย ๆ</div>
            <h2 className="sec-title reveal">4 ขั้นตอน ก็พร้อมไลฟ์ได้เลย</h2>
            <p className="sec-desc">ไม่ต้องมีความรู้โปรแกรม ทีมเราตั้งค่าให้ทั้งหมด แค่ทำตามขั้นตอนก็เริ่มไลฟ์ได้ทันที</p>
          </div>
          <div className="steps-new">
            <StepsVisual />
            <div className="steps-cards">
              {steps.map((s, i) => (
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
            <div className="games-badge">เกมในสังกัด</div>
            <h2 className="games-title">เกมที่พร้อม<span> Live</span></h2>
            <div className="games-subtitle">เกมทุกเกมพร้อมระบบ TikTok Live Integration ผู้ชมส่งของขวัญ = เกิดเหตุการณ์ในเกมทันที</div>
          </div>

          <GamesShowcase games={games} categories={categories} />

          <div style={{ textAlign: "center", marginTop: 36 }}>
            <Link href="/games" className="games-viewall reveal">
              ดูเกมทั้งหมด
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
              <div className="sec-label reveal" style={{ color: "#a78bfa" }}>ตัวอย่างโปรแกรม</div>
              <h2 className="sec-title reveal">โปรแกรมเชื่อมต่อ<br /><span className="grad-text">TikTok Live</span></h2>
              <p className="sec-desc" style={{ margin: "16px 0 24px" }}>ใช้งานง่าย ไม่ต้องมีความรู้โปรแกรม เชื่อมต่อเกมกับ TikTok Live ได้ในไม่กี่คลิก รองรับทั้ง Windows และ Mac</p>
              <div className="preview-features">
                {previewFeats.map((f) => (
                  <div key={f} className="preview-feat"><div className="preview-feat-dot" />{f}</div>
                ))}
              </div>
              <Link className="preview-btn" href="/download">
                ดาวน์โหลดโปรแกรม
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
                <Media src="/tikkies-preview.png" alt="หน้าจอโปรแกรม Tikkies Tools" width={1512} height={893} sizes="(max-width: 900px) 92vw, 560px" style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== NEWS ===== */}
      <section id="news" className="section">
        <div className="sec-top reveal">
          <div>
            <div className="sec-label reveal" style={{ color: "#8b5cf6" }}>ข่าวสาร &amp; อัปเดตล่าสุด</div>
            <p className="sec-desc">ติดตามข่าวสาร อัปเดตเกมใหม่ โปรโมชั่นพิเศษ และบทความน่าสนใจ</p>
          </div>
          <Link className="sec-link" href="/news">ดูทั้งหมด &rarr;</Link>
        </div>
        <div className="news-grid">
          {news.map((n, i) => (
            <NewsCard key={n.id} item={n} style={{ transitionDelay: `${i * 0.1}s` }} />
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="section" style={{ paddingTop: 0 }}>
        <div className="faq-header reveal">
          <div className="faq-badge">คำถามที่พบบ่อย</div>
          <h2 className="faq-title">มีคำถาม?</h2>
          <div className="faq-subtitle">คำตอบสำหรับคำถามที่พบบ่อย หากยังไม่พบคำตอบ ติดต่อเราได้เลย</div>
        </div>
        <Faq items={faqs} />
      </section>

      </main>
      <Footer />
    </>
  );
}

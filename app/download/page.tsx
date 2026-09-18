import Link from "next/link";
import { getGameCovers } from "@/lib/content";
import { absoluteUrl, breadcrumbLd, faqLd, pageMetadata, snippet } from "@/lib/seo";
import { tikkies } from "../data";
import { Media } from "../media";
import { JsonLd } from "../json-ld";
import { Icon } from "../icons";
import { Arrow, Faq, Footer, Nav, RevealObserver } from "../ui";
import AppEmbed from "./AppEmbed";

export const metadata = pageMetadata({
  title: "ดาวน์โหลด Tikkies Tools โปรแกรมรันของขวัญ TikTok",
  description: snippet(
    `ดาวน์โหลด Tikkies Tools v${tikkies.app.version} โปรแกรมเชื่อมต่อ TikTok Live กับเกมและโอเวอร์เลย์ ตั้งกฎของขวัญ แป้นเสียง อ่านแชทออกเสียง สั่ง OBS บน Windows สมาชิกสังกัด AJENT ใช้งานได้ฟรี`,
  ),
  path: "/download",
  image: { url: "/BannerTk.jpeg", width: 1024, height: 626, alt: "Tikkies Tools โปรแกรม TikTok LIVE Interactive" },
});

export default async function DownloadPage() {
  const { app, intro, capabilities, workflow, installSteps, presets, compat, faqs } = tikkies;
  const covers = await getGameCovers(presets.map((p) => p.slug));
  return (
    <>
      <Nav />
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
            url: absoluteUrl("/download"),
            image: absoluteUrl("/BannerTk.jpeg"),
            screenshot: absoluteUrl("/tikkies-preview.png"),
            description: "โปรแกรมเชื่อมต่อ TikTok Live กับเกมและโอเวอร์เลย์ ตั้งกฎว่าของขวัญแต่ละชิ้นให้เกิดอะไร ขึ้นจอไลฟ์อัตโนมัติ",
            featureList: capabilities.map((c) => `${c.title}: ${c.sub}`),
            inLanguage: "th",
          },
          faqLd(faqs),
          breadcrumbLd([["ดาวน์โหลดโปรแกรม", "/download"]]),
        ]}
      />
      <RevealObserver />
      <main>

      {/* ===== HERO ===== */}
      <section className="page-hero" id="top">
        <div className="page-hero-inner">
          <div className="faq-badge">ดาวน์โหลดโปรแกรม</div>
          <h1 className="page-title">ดาวน์โหลด <span className="grad-text">Tikkies Tools</span></h1>
          <p className="page-desc">โปรแกรมเชื่อมต่อ TikTok Live กับเกมและโอเวอร์เลย์ สำหรับสมาชิกสังกัด AJENT ไฟล์เดียวจบ ติดตั้งแล้วเปิดใช้ได้เลย</p>
          <div className="dl-card reveal">
            <div>
              <div className="dl-card-name">Tikkies Tools <span className="dl-card-ver">v{app.version}</span></div>
              <div className="dl-card-meta">{app.os} · {app.size}</div>
            </div>
            <div className="dl-card-actions">
              <a className="preview-btn" href={app.url}>ดาวน์โหลดตัวติดตั้ง <Arrow size={14} /></a>
              <a className="btn-ghost" href="#try">ลองกดเล่นก่อนโหลด ↓</a>
            </div>
          </div>
          <p className="dl-note">สมาชิกสังกัด AJENT ใช้งานได้ฟรี ทีมงานช่วยติดตั้งและตั้งค่าให้ · ยังไม่ได้เข้าสังกัด? <Link href="/#contact">ติดต่อเรา</Link> · ยังไม่รองรับ macOS (ใช้ผ่าน Parallels หรือ Boot Camp ได้)</p>
        </div>
      </section>

      {/* ===== WHAT IS IT ===== */}
      <section className="section">
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>Tikkies Tools คืออะไร</div>
            <h2 className="sec-title reveal">ของขวัญเข้า แล้วให้เกิดอะไร คุณเป็นคนกำหนด</h2>
            <p className="sec-desc">Tikkies Tools คือโปรแกรมบน Windows ที่เชื่อม TikTok LIVE ของคุณเข้ากับเกมและจอไลฟ์ ตั้งกฎครั้งเดียว ได้ Rose ให้หมุนกงล้อ ออกรางวัลใหญ่ให้กดปุ่มในเกม ทุกอย่างขึ้นบนจอไลฟ์อัตโนมัติ ไม่ต้องมานั่งกดเอง</p>
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
            <div className="games-badge">เห็นของจริงก่อน</div>
            <h2 className="games-title">ลองใช้ Tikkies Tools ตัวจริง <span>ตรงนี้</span></h2>
            <div className="games-subtitle">โปรแกรมตัวจริงรันอยู่ในหน้านี้ ตั้งกฎ ต่อสาย กดทดสอบได้ทุกอย่าง ไม่ต้องติดตั้งอะไรก่อน</div>
          </div>
          <AppEmbed />
        </div>
      </section>

      {/* ===== WHAT IT CAN DO ===== */}
      <section className="section">
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>ความสามารถ</div>
            <h2 className="sec-title reveal">Tikkies Tools ทำอะไรได้บ้าง</h2>
            <p className="sec-desc">5 ส่วนหลักของโปรแกรม ทำงานร่วมกันตั้งแต่รับเหตุการณ์จากไลฟ์จนถึงผลลัพธ์บนจอและในเกม</p>
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
              <div className="sec-label reveal" style={{ color: "#a78bfa" }}>ใช้งานอย่างไร</div>
              <h2 className="sec-title reveal">3 ขั้นตอน<br /><span className="grad-text">จากเปิดโปรแกรมถึงขึ้นจอไลฟ์</span></h2>
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
                <Media src="/tikkies-preview.png" alt="หน้าจอโปรแกรม Tikkies Tools" width={1512} height={893} sizes="(max-width: 900px) 92vw, 560px" style={{ width: "100%", height: "auto", display: "block" }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== EASY INSTALL ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="prog-wrap reveal">
          <div style={{ marginBottom: 32 }}>
            <div className="sec-label reveal" style={{ color: "#a78bfa" }}>ติดตั้งง่าย</div>
            <h2 className="sec-title reveal">4 ขั้นตอน ก็เริ่มใช้ได้เลย</h2>
            <p className="sec-desc">ดาวน์โหลดไฟล์เดียว ติดตั้งเสร็จทำตามนี้ ถ้าติดตรงไหนทีมงานช่วยตั้งค่าให้</p>
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
            <div className="games-badge">เกม / โปรเจกต์ที่รองรับ</div>
            <h2 className="games-title">มีชุดกฎสำเร็จรูปให้</h2>
            <div className="games-subtitle">กดนำเข้าในโปรแกรมครั้งเดียวก็ไลฟ์ได้เลย แล้วค่อยแก้ให้เข้ากับสไตล์ตัวเองทีหลัง เพิ่มเกมใหม่ให้เรื่อยๆ</div>
          </div>
          <div className="card-grid">
            {presets.map((p, i) => {
              const cover = covers.get(p.slug);
              const href = covers.has(p.slug) ? `/games/${p.slug}` : undefined; // only link games that are published
              const image = (
                <>
                  {cover ? (
                    <Media className="game-cover" src={cover} alt={`${p.name} ชุดกฎสำเร็จรูป`} fill sizes="(max-width: 600px) 92vw, (max-width: 900px) 46vw, 350px" />
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
                      <div className="game-rating"><span className="game-star"><Icon name="zap" size={13} /></span>{p.rules} กฎพร้อมใช้</div>
                      {href && (
                        <Link href={href} className="game-detail-btn">
                          ดูเกม
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
            <div className="sec-label reveal" style={{ color: "#8b5cf6" }}>โปรแกรมที่ใช้งานร่วมกันได้</div>
            <h2 className="sec-title reveal">ใช้กับโปรแกรมไลฟ์และเกมที่คุณใช้อยู่แล้ว</h2>
            <p className="sec-desc">ไม่ต้องเปลี่ยนเครื่องมือ โอเวอร์เลย์ทุกตัวเป็นลิงก์ ส่วนเกมสั่งผ่านปุ่มคีย์บอร์ด</p>
          </div>
        </div>
        <div className="card-grid cols-4">
          {compat.map((c, i) => (
            <div key={c.name} className="compat-item reveal" style={{ transitionDelay: `${i * 0.08}s` }}>
              <div className="compat-icon" style={{ background: c.color }}>{c.name.slice(0, 2).toUpperCase()}</div>
              <div>
                <div className="compat-name">{c.name}</div>
                <div className="compat-desc">{c.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section className="section" style={{ paddingTop: 0 }}>
        <div className="faq-header reveal">
          <div className="faq-badge">คำถามที่พบบ่อย</div>
          <h2 className="faq-title">เกี่ยวกับโปรแกรม</h2>
          <div className="faq-subtitle">ยังไม่พบคำตอบ ติดต่อทีมงาน AJENT ได้เลย</div>
        </div>
        <Faq items={faqs} />
      </section>

      </main>
      <Footer />
    </>
  );
}

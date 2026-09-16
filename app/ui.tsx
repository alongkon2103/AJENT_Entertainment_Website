"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { socials, texts } from "./data";

/* ===== Shared UI state (dark mode + language) — lives in the root layout so it survives page changes ===== */
type UI = { isDark: boolean; isEN: boolean; toggleDark: () => void; toggleLang: () => void };
const UIContext = createContext<UI>({ isDark: false, isEN: false, toggleDark: () => {}, toggleLang: () => {} });

export function UIProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);
  const [isEN, setIsEN] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <UIContext.Provider value={{ isDark, isEN, toggleDark: () => setIsDark((d) => !d), toggleLang: () => setIsEN((e) => !e) }}>
      {children}
    </UIContext.Provider>
  );
}

export const useUI = () => useContext(UIContext);

/** Adds .visible to .reveal* elements as they scroll into view (the design's scroll animations). Render once per page. */
export function RevealObserver() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && e.target.classList.add("visible")),
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" },
    );
    document.querySelectorAll(".reveal,.reveal-left,.reveal-right,.reveal-scale").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
  return null;
}

export function Arrow({ size }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

/* ===== NAV ===== */
const navItems = ["home", "game", "program", "faq", "contact"] as const;

export function Nav() {
  const { isDark, isEN, toggleDark, toggleLang } = useUI();
  const t = isEN ? texts.en : texts.th;
  const onHome = usePathname() === "/";
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (id: string) => () => {
    setActive(id);
    setMenuOpen(false);
  };

  return (
    <nav className="nav">
      <div className="nav-bar">
        <Link className="nav-logo" href="/#home" onClick={go("home")}>
          <div className="nav-logo-icon">AJ</div>
          <div className="nav-logo-t">AJENT <span>ENT.</span></div>
        </Link>
        <div className={`nav-links${menuOpen ? " open" : ""}`}>
          {navItems.map((id) => (
            <Link key={id} className={`nav-link${onHome && active === id ? " active" : ""}`} href={`/#${id}`} onClick={go(id)}>
              {t[id]}
            </Link>
          ))}
        </div>
        <div className="nav-spacer" />
        <div className="nav-right">
          <div className="nav-sep" />
          <button type="button" className="nav-lang" onClick={toggleLang}>
            {isEN ? "EN" : "TH"}
          </button>
          <button type="button" className="nav-dark" aria-label="Toggle dark mode" onClick={toggleDark}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {isDark ? (
                <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
              ) : (
                <>
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </>
              )}
            </svg>
          </button>
          <button type="button" className="hamburger" aria-label="Menu" onClick={() => setMenuOpen(!menuOpen)}>
            <span /><span /><span />
          </button>
        </div>
      </div>
    </nav>
  );
}

/* ===== FAQ accordion ===== */
export function Faq({ items }: { items: { q: string; a: string }[] }) {
  const [openIdx, setOpenIdx] = useState(-1);
  return (
    <div className="faq-list reveal">
      {items.map((f, i) => {
        const open = openIdx === i;
        // `open` is applied inline rather than via className so React never
        // overwrites the `visible` class the RevealObserver adds.
        return (
          <div key={f.q} className="faq-item reveal" style={{ transitionDelay: `${i * 0.08}s` }} onClick={() => setOpenIdx(open ? -1 : i)}>
            <div className="faq-q" style={{ color: open ? "#ec4899" : undefined }}>
              <span>{f.q}</span>
              <div className="faq-toggle" style={{ color: open ? "#ec4899" : undefined }}>{open ? "×" : "+"}</div>
            </div>
            <div className={`faq-a${open ? " open" : ""}`}>{f.a}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ===== FOOTER ===== */
export function Footer() {
  return (
    <footer id="contact" className="footer-wrap">
      <div className="footer">
        <div className="footer-top">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <div className="nav-logo-icon" style={{ width: 34, height: 34, fontSize: 13 }}>AJ</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 14, color: "#fff" }}>AJENT ENTERTAINMENT</div>
                <div style={{ fontSize: 10, color: "#6a5a8a" }}>TikTok Live &amp; Game Hub</div>
              </div>
            </div>
            <p style={{ fontSize: 13, color: "#6a5a8a", lineHeight: 1.7, maxWidth: 280 }}>AJENT ENTERTAINMENT สังกัดที่ครบครัน พร้อมเครื่องมือเชื่อมต่อเกม สำหรับสตรีมเมอร์ TikTok Live ทุกระดับ</p>
          </div>
          <div>
            <div className="footer-col-t">เมนูหลัก</div>
            <Link className="footer-link" href="/#home">หน้าแรก</Link>
            <Link className="footer-link" href="/#game">เกมในสังกัด</Link>
            <Link className="footer-link" href="/#program">โปรแกรมเชื่อม</Link>
            <Link className="footer-link" href="/games">เกมทั้งหมด</Link>
            <Link className="footer-link" href="/news">ข่าวสาร</Link>
            <Link className="footer-link" href="/download">ดาวน์โหลดโปรแกรม</Link>
            <Link className="footer-link" href="/download#try">ทดลองใช้โปรแกรม</Link>
          </div>
          <div>
            <div className="footer-col-t">ติดต่อเรา</div>
            <div className="footer-socials">
              {socials.map((s) => {
                const external = s.href.startsWith("http");
                return (
                  <a
                    key={s.id}
                    className={`footer-social footer-social-${s.id}`}
                    href={s.href}
                    {...(external && { target: "_blank", rel: "noopener noreferrer" })}
                  >
                    <span className="footer-social-icon">
                      <s.Logo size={18} />
                    </span>
                    <span>
                      <span className="footer-social-name">{s.name}</span>
                      <span className="footer-social-handle">{s.handle}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        </div>
        <div className="footer-bottom">
          <div className="footer-copy">&copy; 2026 AJENT ENTERTAINMENT. All rights reserved.</div>
          <div className="footer-copy">TikTok Live &amp; Game Hub</div>
        </div>
      </div>
    </footer>
  );
}

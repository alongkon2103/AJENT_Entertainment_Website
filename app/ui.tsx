"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { socials } from "./data";
import type { Dict } from "./dictionaries/th";
import { localePath, type Locale } from "./i18n";

/* ===== Shared UI state (dark mode) — lives in the root layout so it survives page and language changes ===== */
type UI = { isDark: boolean; toggleDark: () => void };
const UIContext = createContext<UI>({ isDark: false, toggleDark: () => {} });

export function UIProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    document.body.classList.toggle("dark", isDark);
  }, [isDark]);

  return (
    <UIContext.Provider value={{ isDark, toggleDark: () => setIsDark((d) => !d) }}>
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

export function Nav({ lang, t }: { lang: Locale; t: Dict["nav"] }) {
  const { isDark, toggleDark } = useUI();
  const pathname = usePathname();
  const onHome = pathname === `/${lang}`;
  const other: Locale = lang === "th" ? "en" : "th";
  // The root layout isn't re-rendered on a client-side language switch, so keep <html lang> in sync here.
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const [active, setActive] = useState("home");
  const [menuOpen, setMenuOpen] = useState(false);
  const go = (id: string) => () => {
    setActive(id);
    setMenuOpen(false);
  };

  return (
    <nav className="nav">
      <div className="nav-bar">
        <Link className="nav-logo" href={localePath(lang, "/#home")} onClick={go("home")}>
          <div className="nav-logo-icon">AJ</div>
          <div className="nav-logo-t">AJENT <span>ENT.</span></div>
        </Link>
        <div className={`nav-links${menuOpen ? " open" : ""}`}>
          {navItems.map((id) => (
            <Link key={id} className={`nav-link${onHome && active === id ? " active" : ""}`} href={localePath(lang, `/#${id}`)} onClick={go(id)}>
              {t[id]}
            </Link>
          ))}
        </div>
        <div className="nav-spacer" />
        <div className="nav-right">
          <div className="nav-sep" />
          <Link
            className="nav-lang"
            href={pathname.replace(/^\/(th|en)(?=\/|$)/, `/${other}`)}
            hrefLang={other}
            aria-label={t.switchLang}
            title={t.switchLang}
            scroll={false}
          >
            {lang.toUpperCase()}
          </Link>
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
export function Footer({ lang, t }: { lang: Locale; t: Dict["footer"] }) {
  const to = (path: string) => localePath(lang, path);
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
            <p style={{ fontSize: 13, color: "#6a5a8a", lineHeight: 1.7, maxWidth: 280 }}>{t.about}</p>
          </div>
          <div>
            <div className="footer-col-t">{t.menu}</div>
            <Link className="footer-link" href={to("/#home")}>{t.links.home}</Link>
            <Link className="footer-link" href={to("/#game")}>{t.links.game}</Link>
            <Link className="footer-link" href={to("/#program")}>{t.links.program}</Link>
            <Link className="footer-link" href={to("/games")}>{t.links.games}</Link>
            <Link className="footer-link" href={to("/news")}>{t.links.news}</Link>
            <Link className="footer-link" href={to("/download")}>{t.links.download}</Link>
            <Link className="footer-link" href={to("/download#try")}>{t.links.try}</Link>
          </div>
          <div>
            <div className="footer-col-t">{t.contact}</div>
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

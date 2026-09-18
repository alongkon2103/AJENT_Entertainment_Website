"use client";

import { useEffect, useRef, useState } from "react";
import type { Dict } from "../../dictionaries/th";
import type { Locale } from "../../i18n";

/** The real Tikkies Tools app running in-page with sample data, switchable by tab. */
export default function AppEmbed({ lang, demo, t }: { lang: Locale; demo: string; t: Dict["embed"] }) {
  const [tab, setTab] = useState(t.tabs[0].id);
  // The embed boots a whole app (its own scripts, fonts and gift images), so it only starts
  // loading when the visitor scrolls near it instead of competing with the rest of the page.
  const [visible, setVisible] = useState(false);
  const frameBox = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = frameBox.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const src = `${demo}?lang=${lang}&embed=1&tab=${tab}${tab === "actions" ? "&view=node" : ""}`;

  return (
    <div className="reveal">
      <div className="games-filter">
        {t.tabs.map((d) => (
          <button key={d.id} type="button" className={`games-filter-btn${tab === d.id ? " active" : ""}`} onClick={() => setTab(d.id)}>
            {d.label}
          </button>
        ))}
      </div>
      <div className="preview-screen demo-screen">
        <div className="preview-screen-bar">
          <div className="preview-dot" style={{ background: "#ff5f57" }} />
          <div className="preview-dot" style={{ background: "#ffbd2e" }} />
          <div className="preview-dot" style={{ background: "#28c840" }} />
          <span className="preview-screen-title">Tikkies Tools</span>
          <a className="demo-open" href={src} target="_blank" rel="noreferrer">{t.fullscreen}</a>
        </div>
        <div className="demo-frame-box" ref={frameBox}>
          {visible ? (
            <iframe key={src} className="demo-frame" src={src} title="Tikkies Tools" allow="autoplay" loading="lazy" />
          ) : (
            <div className="demo-frame demo-frame-idle">{t.loading}</div>
          )}
        </div>
      </div>
      <p className="demo-hint">{t.hint}</p>
    </div>
  );
}

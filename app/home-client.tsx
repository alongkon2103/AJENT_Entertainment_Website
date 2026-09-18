"use client";

import { Eye, Gift } from "lucide-react";
import { useEffect, useState, type FormEvent, type PointerEvent } from "react";
import type { GameWithTags } from "@/lib/content";
import type { Tag } from "@/lib/generated/prisma/client";
import { joinAjent, type JoinStatus } from "./actions";
import { GameCard } from "./cards";
import type { Dict } from "./dictionaries/th";
import { ui, type Locale } from "./i18n";
import { Media } from "./media";
import { Arrow } from "./ui";

/** Hero brand text + TikTok join form (posts to Discord through the joinAjent server action). */
export function HeroJoin({ lang, t }: { lang: Locale; t: Dict["hero"] }) {
  const [tiktok, setTiktok] = useState("");
  const [join, setJoin] = useState<JoinStatus | "idle" | "sending">("idle");

  async function submitJoin(e: FormEvent) {
    e.preventDefault();
    setJoin("sending");
    const status = await joinAjent(tiktok, lang === "en" ? "EN" : "TH").catch((): JoinStatus => "failed");
    setJoin(status);
    if (status === "ok") setTiktok("");
  }
  const joinMsg = { idle: "", sending: t.sending, ok: t.ok, invalid: t.invalid, rate: t.rate, failed: t.failed }[join];

  return (
    <div className="hero-center">
      <h1 className="hero-brand-text">
        <span className="line1">{t.line1}</span>
        <span className="line2">{t.line2}</span>
      </h1>
      <div className="hero-tagline">{t.tag}</div>
      <form className="hero-cta" onSubmit={submitJoin}>
        <input
          type="text"
          name="tiktok"
          placeholder={t.input}
          aria-label={t.input}
          value={tiktok}
          onChange={(e) => {
            setTiktok(e.target.value);
            if (join !== "sending") setJoin("idle");
          }}
          maxLength={200}
          autoComplete="off"
          required
        />
        <button type="submit" className="hero-cta-btn" disabled={join === "sending"}>
          {join === "sending" ? t.sending : t.btn}
          <Arrow />
        </button>
      </form>
      <p className={`hero-cta-msg${join === "ok" ? " ok" : join === "idle" || join === "sending" ? "" : " err"}`} role="status" aria-live="polite">
        {joinMsg}
      </p>
    </div>
  );
}

/** Category filter + game cards. Only categories that have a game in the list get a button. */
export function GamesShowcase({ lang, games, categories }: { lang: Locale; games: GameWithTags[]; categories: Tag[] }) {
  const [filter, setFilter] = useState<number | "all">("all");
  const used = categories.filter((c) => games.some((g) => g.categoryId === c.id));

  if (games.length === 0) return <p className="games-subtitle" style={{ textAlign: "center" }}>{ui[lang].noGames}</p>;
  return (
    <>
      {used.length > 0 && (
        <div className="games-filter reveal">
          {[{ id: "all" as const, name: ui[lang].all }, ...used].map((c) => (
            <button key={c.id} type="button" className={`games-filter-btn${filter === c.id ? " active" : ""}`} onClick={() => setFilter(c.id)}>
              {c.name}
            </button>
          ))}
        </div>
      )}
      <div className="games-grid">
        {games.map((g, i) => (
          <GameCard
            key={g.id}
            lang={lang}
            game={g}
            style={{ transitionDelay: `${i * 0.1}s`, display: filter === "all" || g.categoryId === filter ? undefined : "none" }}
          />
        ))}
      </div>
    </>
  );
}

/** "4 steps" artwork as a layered 3D card: back plate, glow, light sheen and floating chips that tilt toward the mouse. */
export function StepsVisual({ alt }: { alt: string }) {
  function track(e: PointerEvent<HTMLDivElement>) {
    if (e.pointerType !== "mouse") return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    el.classList.add("tracking");
    el.style.setProperty("--rx", `${(-y * 12).toFixed(2)}deg`);
    el.style.setProperty("--ry", `${(x * 16).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${((x + 0.5) * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${((y + 0.5) * 100).toFixed(1)}%`);
  }
  function rest(e: PointerEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    el.classList.remove("tracking");
    for (const v of ["--rx", "--ry", "--mx", "--my"]) el.style.removeProperty(v);
  }

  return (
    <div className="steps-visual reveal-scale" onPointerMove={track} onPointerLeave={rest}>
      <div className="steps-stage">
        <div className="steps-plate" />
        <div className="steps-card">
          <Media src="/steps-live.jpg" alt={alt} fill sizes="(max-width: 768px) 92vw, 470px" />
          <span className="steps-sheen" />
        </div>
        <div className="steps-chip steps-chip-live">
          <span className="live-dot" />
          LIVE
          <small>
            <Eye size={13} /> 1.2K
          </small>
        </div>
        {/* <div className="steps-chip steps-chip-gift">
          <Gift size={16} />
          Rose ×5
          <small>หมุนกงล้อ</small>
        </div> */}
      </div>
    </div>
  );
}

/**
 * The hero clip is decoration. The phone shows the poster frame (part of the first paint) and the
 * video only loads after the visitor first scrolls or taps, so it never competes with the hero image
 * for bandwidth or become the Largest Contentful Paint element.
 */
export function HeroVideo({ label }: { label: string }) {
  const [playVideo, setPlayVideo] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-data: reduce)").matches) return;
    const start = () => setPlayVideo(true);
    const events = ["scroll", "pointerdown", "keydown", "touchstart"] as const;
    for (const e of events) window.addEventListener(e, start, { once: true, passive: true });
    return () => {
      for (const e of events) window.removeEventListener(e, start);
    };
  }, []);

  if (!playVideo) return <Media src="/preview-poster.jpg" alt={label} fill sizes="200px" priority />;
  return <video src="/Preview.mp4" poster="/preview-poster.jpg" autoPlay muted loop playsInline preload="auto" aria-label={label} />;
}

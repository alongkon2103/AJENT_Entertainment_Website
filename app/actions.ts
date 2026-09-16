"use server";

import { headers } from "next/headers";

export type JoinStatus = "ok" | "invalid" | "rate" | "failed";

const COOLDOWN_MS = 30_000;
// ponytail: in-memory, per server instance. Move to Redis/KV if spam shows up on a multi-instance deploy.
const lastSubmit = new Map<string, number>();

/** Accepts "name", "@name" or a pasted profile link. Returns the bare TikTok handle, or null if it isn't a valid one. */
function parseHandle(raw: string) {
  const handle = raw.trim().replace(/^.*tiktok\.com\/@/i, "").replace(/^@/, "").split(/[/?#\s]/)[0];
  return /^[A-Za-z0-9._]{2,24}$/.test(handle) ? handle : null;
}

/** Hero "join" form: validates the handle and posts a Discord embed to DISCORD_WEBHOOK. */
export async function joinAjent(raw: unknown, lang: unknown): Promise<JoinStatus> {
  const handle = parseHandle(String(raw ?? "").slice(0, 200));
  if (!handle) return "invalid";

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const now = Date.now();
  if (now - (lastSubmit.get(ip) ?? 0) < COOLDOWN_MS) return "rate";
  if (lastSubmit.size > 5000) lastSubmit.clear();
  lastSubmit.set(ip, now);

  const webhook = process.env.DISCORD_WEBHOOK;
  if (!webhook) {
    console.error("[join] DISCORD_WEBHOOK is not set");
    lastSubmit.delete(ip);
    return "failed";
  }

  const ua = h.get("user-agent") ?? "";
  const device = /iPhone|iPad|Android|Mobile/i.test(ua) ? "มือถือ" : "คอมพิวเตอร์";
  const os = { iPhone: "iOS", iPad: "iPadOS", Android: "Android", Windows: "Windows", "Mac OS X": "macOS", Linux: "Linux" };
  const osName = Object.entries(os).find(([k]) => ua.includes(k))?.[1] ?? "ไม่ทราบ";
  const profile = `https://www.tiktok.com/@${handle}`;
  const unix = Math.floor(now / 1000);

  const payload = {
    username: "AJENT Website",
    allowed_mentions: { parse: [] },
    embeds: [
      {
        author: { name: "AJENT ENTERTAINMENT · ฟอร์มเข้าร่วมสังกัด" },
        title: "มีผู้สนใจเข้าร่วมสังกัดใหม่",
        url: profile,
        description: `[เปิดโปรไฟล์ @${handle.replace(/_/g, "\\_")} บน TikTok →](${profile})`,
        color: 0x8b5cf6,
        fields: [
          { name: "ชื่อ TikTok", value: `\`@${handle}\``, inline: true },
          { name: "อุปกรณ์", value: `${device} · ${osName}`, inline: true },
          { name: "ภาษาเว็บ", value: lang === "EN" ? "English" : "ไทย", inline: true },
          { name: "เวลาที่ส่ง", value: `<t:${unix}:F> · <t:${unix}:R>` },
        ],
        footer: { text: "ส่งจากหน้าแรกเว็บไซต์ AJENT" },
        timestamp: new Date(now).toISOString(),
      },
    ],
  };

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Discord responded ${res.status}: ${await res.text()}`);
    return "ok";
  } catch (err) {
    console.error("[join] Discord webhook failed:", err);
    lastSubmit.delete(ip);
    return "failed";
  }
}

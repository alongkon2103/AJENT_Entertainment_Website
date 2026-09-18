import { Gamepad2, Gift, Headset, Mail, Radio, ShieldCheck, TrendingUp } from "lucide-react";
import { DiscordLogo, LineLogo, TikTokLogo } from "./icons";

// Non-text site data. All copy lives in app/dictionaries/{th,en}.ts.

/** Footer contact buttons. */
export const socials = [
  { id: "tiktok", name: "TikTok", handle: "@ajent.th", href: "https://www.tiktok.com/@ajent.th", Logo: TikTokLogo },
  { id: "line", name: "LINE", handle: "@269nbxml", href: "https://line.me/R/ti/p/@269nbxml", Logo: LineLogo },
  { id: "discord", name: "Discord", handle: "AJent Entertainment", href: "https://discord.gg/utCjfDRMAs", Logo: DiscordLogo },
  { id: "email", name: "Email", handle: "ajent.entertainment@gmail.com", href: "mailto:ajent.entertainment@gmail.com", Logo: Mail },
];

/** Icons for the homepage feature strip, same order as dict.home.feats. */
export const featIcons = [Radio, Gamepad2, TrendingUp, ShieldCheck, Headset, Gift];

/* ===== Tikkies Tools (source: tikkies.aclassstore.com) ===== */
export const tikkies = {
  app: {
    version: "0.9.20",
    size: "81 MB",
    os: "Windows 10/11 (64-bit)",
    url: "https://github.com/alongkon2103/Tikkies/releases/download/0.9.20/Tikkies-Tools-Setup-0.9.20.exe",
    demo: "/app-demo/index.html",
  },
  presets: [
    { name: "Judy Smooth", slug: "judy-smooth", sub: "Roblox · Preset 1", rules: 14, bg: "linear-gradient(135deg,#1a1a4a,#2a1860)" },
    { name: "AC Hyper Run", slug: "ac-hyper-run", sub: "Roblox · Preset 1", rules: 17, bg: "linear-gradient(135deg,#2a1050,#4a1060)" },
    { name: "Judy Rush", slug: "judy-rush", sub: "Roblox · Judy Rush", rules: 13, bg: "linear-gradient(135deg,#0a2a1a,#1a4a2a)" },
    { name: "Judy Jump", slug: "judy-jump", sub: "Roblox · Preset 1", rules: 16, bg: "linear-gradient(135deg,#1a1a4a,#3a1a5a)" },
    { name: "AC Jump EVO", slug: "ac-jump-evo", sub: "Roblox · Preset 1", rules: 17, bg: "linear-gradient(135deg,#2a1050,#3a1a5a)" },
    { name: "Judy Legend", slug: "judy-legend", sub: "Roblox · Preset 1", rules: 16, bg: "linear-gradient(135deg,#1a1a4a,#4a1060)" },
  ],
  /** Same order as dict.download.compat (descriptions). */
  compat: [
    { name: "OBS Studio", color: "#302e31" },
    { name: "Streamlabs Desktop", color: "#31c3a2" },
    { name: "TikTok LIVE Studio", color: "#fe2c55" },
    { name: "XSplit / Prism", color: "#8b5cf6" },
    { name: "TikTok LIVE", color: "#25f4ee" },
    { name: "Roblox", color: "#3b82f6" },
    { name: "Minecraft", color: "#22c55e" },
    { name: "Windows 10/11", color: "#0ea5e9" },
  ],
};

import type { Metadata } from "next";
import { socials } from "@/app/data";

/** Set SITE_URL to the real domain in production (canonical URLs, sitemap, share cards and JSON-LD all use it). */
const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");

export const SITE = {
  name: "AJENT ENTERTAINMENT",
  url: siteUrl,
  locale: "th_TH",
  language: "th-TH",
  title: "AJENT ENTERTAINMENT | สังกัด TikTok Live สายเกม พร้อมเกมและโปรแกรมรันของขวัญ",
  description:
    "สังกัด TikTok Live สายเกม สมาชิกได้ใช้เกม Roblox, Minecraft และโปรแกรม Tikkies Tools ที่เชื่อมต่อของขวัญ TikTok พร้อมทีมซัพพอร์ตดูแลตั้งแต่เริ่มไลฟ์",
  keywords: [
    "สังกัด TikTok",
    "สังกัด TikTok Live",
    "สังกัดสตรีมเมอร์",
    "สตรีมเมอร์ TikTok",
    "ไลฟ์สด TikTok",
    "เกม TikTok Live",
    "เกม Roblox TikTok Live",
    "โปรแกรมรันของขวัญ TikTok",
    "Interactive LIVE",
    "TikFinity",
    "Tikkies Tools",
    "AJENT ENTERTAINMENT",
  ],
  email: "ajent.entertainment@gmail.com",
  ogImage: { url: "/og-default.jpg", width: 1200, height: 630, alt: "AJENT ENTERTAINMENT สังกัด TikTok Live สายเกม" },
};

export const absoluteUrl = (path = "/") => (/^https?:\/\//.test(path) ? path : new URL(path, `${SITE.url}/`).toString());

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * Per-page metadata: canonical URL + Open Graph + Twitter card.
 * Next merges openGraph/twitter shallowly, so every page rebuilds them here instead of inheriting from the layout.
 */
export function pageMetadata(p: {
  title: string;
  description: string;
  path: string;
  image?: OgImage;
  absoluteTitle?: boolean;
  article?: { publishedTime: Date; modifiedTime: Date; section?: string };
}): Metadata {
  const image = p.image ?? SITE.ogImage;
  const fullTitle = p.absoluteTitle ? p.title : `${p.title} | ${SITE.name}`;
  const base = { url: p.path, siteName: SITE.name, locale: SITE.locale, title: fullTitle, description: p.description, images: [image] };
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: p.path },
    openGraph: p.article
      ? {
          ...base,
          type: "article",
          publishedTime: p.article.publishedTime.toISOString(),
          modifiedTime: p.article.modifiedTime.toISOString(),
          section: p.article.section,
          authors: [SITE.name],
        }
      : { ...base, type: "website" },
    twitter: { card: "summary_large_image", title: fullTitle, description: p.description, images: [image.url] },
  };
}

/** Trim to a search-snippet friendly length without cutting mid-word where possible. */
export const snippet = (text: string, max = 160) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
};

// ---------- JSON-LD (schema.org) ----------

const ORG_ID = `${SITE.url}/#organization`;

export const organizationLd = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE.name,
  alternateName: ["AJent Entertainment", "AJENT"],
  url: SITE.url,
  logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 512, height: 512 },
  image: absoluteUrl(SITE.ogImage.url),
  description: SITE.description,
  email: SITE.email,
  sameAs: socials.filter((s) => s.href.startsWith("http")).map((s) => s.href),
  contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SITE.email, availableLanguage: ["th", "en"] }],
});

export const websiteLd = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  url: SITE.url,
  name: SITE.name,
  description: SITE.description,
  inLanguage: SITE.language,
  publisher: { "@id": ORG_ID },
});

export const breadcrumbLd = (items: [name: string, path: string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [["หน้าแรก", "/"], ...items].map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: absoluteUrl(path) })),
});

export const faqLd = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export const itemListLd = (items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absoluteUrl(it.path) })),
});

export const publisherRef = { "@id": ORG_ID };

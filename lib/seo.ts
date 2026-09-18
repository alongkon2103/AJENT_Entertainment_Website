import type { Metadata } from "next";
import { socials } from "@/app/data";
import { getDictionary } from "@/app/dictionaries";
import { defaultLocale, localePath, locales, type Locale } from "@/app/i18n";

/** Set SITE_URL to the real domain in production (canonical URLs, sitemap, share cards and JSON-LD all use it). */
const siteUrl = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
const th = getDictionary("th");

export const SITE = {
  name: "AJENT ENTERTAINMENT",
  url: siteUrl,
  // Thai defaults for pages outside /th and /en (admin, 404, manifest)
  title: th.site.title,
  description: th.site.description,
  keywords: th.site.keywords,
  email: "ajent.entertainment@gmail.com",
  ogImage: { url: "/og-default.jpg", width: 1200, height: 630, alt: th.site.ogAlt },
};

export const ogLocale = { th: "th_TH", en: "en_US" } satisfies Record<Locale, string>;
export const htmlLang = { th: "th-TH", en: "en-US" } satisfies Record<Locale, string>;

export const absoluteUrl = (path = "/") => (/^https?:\/\//.test(path) ? path : new URL(path, `${SITE.url}/`).toString());

/** hreflang map for an unprefixed path: every locale plus x-default (Thai). */
export const languageAlternates = (path: string) => ({
  ...Object.fromEntries(locales.map((l) => [l, localePath(l, path)])),
  "x-default": localePath(defaultLocale, path),
});

type OgImage = { url: string; width?: number; height?: number; alt?: string };

/**
 * Per-page metadata: canonical URL, hreflang alternates, Open Graph and Twitter card.
 * `path` is unprefixed ("/games"); the locale prefix is added here.
 * Next merges openGraph/twitter shallowly, so every page rebuilds them here instead of inheriting from the layout.
 */
export function pageMetadata(p: {
  lang: Locale;
  title: string;
  description: string;
  path: string;
  image?: OgImage;
  absoluteTitle?: boolean;
  article?: { publishedTime: Date; modifiedTime: Date; section?: string };
}): Metadata {
  const image = p.image ?? { ...SITE.ogImage, alt: getDictionary(p.lang).site.ogAlt };
  const fullTitle = p.absoluteTitle ? p.title : `${p.title} | AJENT`;
  const url = localePath(p.lang, p.path);
  const base = {
    url,
    siteName: SITE.name,
    locale: ogLocale[p.lang],
    alternateLocale: locales.filter((l) => l !== p.lang).map((l) => ogLocale[l]),
    title: fullTitle,
    description: p.description,
    images: [image],
  };
  return {
    title: p.absoluteTitle ? { absolute: p.title } : p.title,
    description: p.description,
    alternates: { canonical: url, languages: languageAlternates(p.path) },
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
export const snippet = (text: string, max = 155) => {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 20))}…`;
};

// ---------- JSON-LD (schema.org) ----------

const ORG_ID = `${SITE.url}/#organization`;

export const organizationLd = (lang: Locale) => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": ORG_ID,
  name: SITE.name,
  alternateName: ["AJent Entertainment", "AJENT"],
  url: SITE.url,
  logo: { "@type": "ImageObject", url: absoluteUrl("/logo.png"), width: 512, height: 512 },
  image: absoluteUrl(SITE.ogImage.url),
  description: getDictionary(lang).site.description,
  email: SITE.email,
  sameAs: socials.filter((s) => s.href.startsWith("http")).map((s) => s.href),
  contactPoint: [{ "@type": "ContactPoint", contactType: "customer support", email: SITE.email, availableLanguage: ["th", "en"] }],
});

export const websiteLd = (lang: Locale) => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "@id": `${SITE.url}/#website`,
  url: SITE.url,
  name: SITE.name,
  description: getDictionary(lang).site.description,
  inLanguage: htmlLang[lang],
  publisher: { "@id": ORG_ID },
});

/** Paths are unprefixed; "Home" is added first. */
export const breadcrumbLd = (lang: Locale, items: [name: string, path: string][]) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [[getDictionary(lang).site.home, "/"], ...items].map(([name, path], i) => ({
    "@type": "ListItem",
    position: i + 1,
    name,
    item: absoluteUrl(localePath(lang, path)),
  })),
});

export const faqLd = (faqs: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
});

export const itemListLd = (lang: Locale, items: { name: string; path: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  itemListElement: items.map((it, i) => ({ "@type": "ListItem", position: i + 1, name: it.name, url: absoluteUrl(localePath(lang, it.path)) })),
});

export const publisherRef = { "@id": ORG_ID };

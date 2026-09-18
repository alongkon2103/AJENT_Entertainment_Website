import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { organizationLd, websiteLd } from "@/lib/seo";
import { getDictionary } from "../dictionaries";
import { isLocale } from "../i18n";
import { JsonLd } from "../json-ld";
import { Footer, Nav } from "../ui";

export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const { site } = getDictionary(lang);
  return { title: { default: site.title, template: "%s | AJENT" }, description: site.description, keywords: site.keywords };
}

/** Everything public lives under /th or /en (proxy.ts redirects unprefixed URLs). */
export default async function LangLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const d = getDictionary(lang);
  return (
    <>
      <JsonLd data={[organizationLd(lang), websiteLd(lang)]} />
      <Nav lang={lang} t={d.nav} />
      {children}
      <Footer lang={lang} t={d.footer} />
    </>
  );
}

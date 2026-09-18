import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAllNews } from "@/lib/content";
import { breadcrumbLd, itemListLd, pageMetadata } from "@/lib/seo";
import { NewsCard } from "../../cards";
import { getDictionary } from "../../dictionaries";
import { isLocale } from "../../i18n";
import { JsonLd } from "../../json-ld";
import { RevealObserver } from "../../ui";

export async function generateMetadata({ params }: PageProps<"/[lang]/news">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const t = getDictionary(lang).news;
  return pageMetadata({ lang, title: t.metaTitle, description: t.metaDescription, path: "/news" });
}

export default async function NewsListPage({ params }: PageProps<"/[lang]/news">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).news;
  const news = await getAllNews(lang);
  return (
    <>
      <JsonLd data={[breadcrumbLd(lang, [[t.crumb, "/news"]]), itemListLd(lang, news.map((n) => ({ name: n.title, path: `/news/${n.slug}` })))]} />
      <RevealObserver />
      <main>
      <section className="page-hero">
        <div className="page-hero-inner">
          <div className="faq-badge">{t.badge}</div>
          <h1 className="page-title">
            {t.title} <span className="grad-text">AJENT</span>
          </h1>
          <p className="page-desc">{t.desc}</p>
        </div>
      </section>
      <section className="section">
        {news.length === 0 ? (
          <p className="sec-desc" style={{ textAlign: "center" }}>{t.empty}</p>
        ) : (
          <div className="news-grid">
            {news.map((n, i) => (
              <NewsCard key={n.id} lang={lang} item={n} style={{ transitionDelay: `${Math.min(i, 8) * 0.08}s` }} />
            ))}
          </div>
        )}
      </section>
      </main>
    </>
  );
}

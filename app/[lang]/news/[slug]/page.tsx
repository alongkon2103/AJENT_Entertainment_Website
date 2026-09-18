import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/content";
import { absoluteUrl, breadcrumbLd, htmlLang, pageMetadata, publisherRef, SITE, snippet } from "@/lib/seo";
import { formatDate } from "@/lib/tags";
import { NewsCard, NewsTag } from "../../../cards";
import { getDictionary } from "../../../dictionaries";
import { isLocale, localePath } from "../../../i18n";
import { lazyRichImages, Media } from "../../../media";
import { JsonLd } from "../../../json-ld";
import { RevealObserver } from "../../../ui";

export async function generateMetadata({ params }: PageProps<"/[lang]/news/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  if (!isLocale(lang)) return {};
  const data = await getNews(slug, lang);
  if (!data) return { title: getDictionary(lang).news.notFound, robots: { index: false } };
  const { item } = data;
  return pageMetadata({
    lang,
    title: snippet(item.title, 50),
    description: snippet(item.excerpt || item.title),
    path: `/news/${item.slug}`,
    image: item.coverImage ? { url: item.coverImage, alt: item.title } : undefined,
    article: { publishedTime: item.publishedAt, modifiedTime: item.updatedAt, section: item.category?.name },
  });
}

export default async function NewsDetailPage({ params }: PageProps<"/[lang]/news/[slug]">) {
  const { lang, slug } = await params;
  if (!isLocale(lang)) notFound();
  const t = getDictionary(lang).news;
  const data = await getNews(slug, lang);
  if (!data) notFound();
  const { item, more } = data;
  const cat = item.category?.isActive ? item.category : null;
  const articleLd = {
    "@context": "https://schema.org",
    "@type": "NewsArticle",
    headline: item.title.slice(0, 110),
    description: item.excerpt || undefined,
    image: [absoluteUrl(item.coverImage || SITE.ogImage.url)],
    datePublished: item.publishedAt.toISOString(),
    dateModified: item.updatedAt.toISOString(),
    articleSection: cat?.name,
    inLanguage: htmlLang[lang],
    mainEntityOfPage: absoluteUrl(localePath(lang, `/news/${item.slug}`)),
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: publisherRef,
  };

  return (
    <>
      <JsonLd data={[articleLd, breadcrumbLd(lang, [[t.crumb, "/news"], [item.title, `/news/${item.slug}`]])]} />
      <RevealObserver />
      <main>
      <section className="page-hero article-hero">
        <div className="page-hero-inner article-head">
          <div className="detail-crumb light">
            <Link href={localePath(lang, "/news")}>{t.backCrumb}</Link> / {formatDate(item.publishedAt, lang)}
          </div>
          {cat && <NewsTag name={cat.name} color={cat.color} />}
          <h1 className="page-title" style={{ marginTop: 12 }}>
            {item.title}
          </h1>
          {item.excerpt && <p className="page-desc">{item.excerpt}</p>}
        </div>
      </section>

      <section className="detail-body article-body">
        {item.coverImage && (
          <div className="article-cover reveal">
            <Media src={item.coverImage} alt={item.title} fill sizes="(max-width: 900px) 92vw, 820px" priority />
          </div>
        )}
        {item.content && (
          <div className="rich-card reveal">
            <div className="rich" dangerouslySetInnerHTML={{ __html: lazyRichImages(item.content) }} />
          </div>
        )}
      </section>

      {more.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="sec-top reveal">
            <div>
              <div className="sec-label" style={{ color: "#8b5cf6" }}>{t.moreLabel}</div>
              <p className="sec-desc">{t.moreDesc}</p>
            </div>
            <Link className="sec-link" href={localePath(lang, "/news")}>
              {getDictionary(lang).common.viewAll} &rarr;
            </Link>
          </div>
          <div className="news-grid">
            {more.map((n, i) => (
              <NewsCard key={n.id} lang={lang} item={n} style={{ transitionDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </section>
      )}
      </main>
    </>
  );
}

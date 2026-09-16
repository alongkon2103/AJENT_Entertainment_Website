import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getNews } from "@/lib/content";
import { absoluteUrl, breadcrumbLd, pageMetadata, publisherRef, SITE, snippet } from "@/lib/seo";
import { thaiDate } from "@/lib/tags";
import { NewsCard, NewsTag } from "../../cards";
import { JsonLd } from "../../json-ld";
import { Footer, Nav, RevealObserver } from "../../ui";

export async function generateMetadata({ params }: PageProps<"/news/[slug]">): Promise<Metadata> {
  const data = await getNews((await params).slug);
  if (!data) return { title: "ไม่พบข่าว", robots: { index: false } };
  const { item } = data;
  return pageMetadata({
    title: item.title,
    description: snippet(item.excerpt || item.title),
    path: `/news/${item.slug}`,
    image: item.coverImage ? { url: item.coverImage, alt: item.title } : undefined,
    article: { publishedTime: item.publishedAt, modifiedTime: item.updatedAt, section: item.category?.name },
  });
}

export default async function NewsDetailPage({ params }: PageProps<"/news/[slug]">) {
  const data = await getNews((await params).slug);
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
    inLanguage: SITE.language,
    mainEntityOfPage: absoluteUrl(`/news/${item.slug}`),
    author: { "@type": "Organization", name: SITE.name, url: SITE.url },
    publisher: publisherRef,
  };

  return (
    <>
      <Nav />
      <JsonLd data={[articleLd, breadcrumbLd([["ข่าวสาร", "/news"], [item.title, `/news/${item.slug}`]])]} />
      <RevealObserver />
      <main>
      <section className="page-hero article-hero">
        <div className="page-hero-inner article-head">
          <div className="detail-crumb light">
            <Link href="/news">ข่าวสาร &amp; อัปเดต</Link> / {thaiDate(item.publishedAt)}
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
            <img src={item.coverImage} alt={item.title} />
          </div>
        )}
        {item.content && (
          <div className="rich-card reveal">
            <div className="rich" dangerouslySetInnerHTML={{ __html: item.content }} />
          </div>
        )}
      </section>

      {more.length > 0 && (
        <section className="section" style={{ paddingTop: 0 }}>
          <div className="sec-top reveal">
            <div>
              <div className="sec-label" style={{ color: "#8b5cf6" }}>ข่าวอื่นๆ</div>
              <p className="sec-desc">อัปเดตล่าสุดจาก AJENT</p>
            </div>
            <Link className="sec-link" href="/news">
              ดูทั้งหมด &rarr;
            </Link>
          </div>
          <div className="news-grid">
            {more.map((n, i) => (
              <NewsCard key={n.id} item={n} style={{ transitionDelay: `${i * 0.1}s` }} />
            ))}
          </div>
        </section>
      )}
      </main>
      <Footer />
    </>
  );
}

import { getAllNews } from "@/lib/content";
import { breadcrumbLd, itemListLd, pageMetadata } from "@/lib/seo";
import { NewsCard } from "../cards";
import { JsonLd } from "../json-ld";
import { Footer, Nav, RevealObserver } from "../ui";

export const metadata = pageMetadata({
  title: "ข่าวสารและอัปเดตล่าสุด",
  description: "ติดตามข่าวสาร อัปเดตเกมใหม่ โปรโมชั่น และบทความสำหรับสตรีมเมอร์ TikTok Live จาก AJENT ENTERTAINMENT สังกัดสายเกม",
  path: "/news",
});

export default async function NewsListPage() {
  const news = await getAllNews();
  return (
    <>
      <Nav />
      <JsonLd data={[breadcrumbLd([["ข่าวสาร", "/news"]]), itemListLd(news.map((n) => ({ name: n.title, path: `/news/${n.slug}` })))]} />
      <RevealObserver />
      <main>
      <section className="page-hero">
        <div className="page-hero-inner">
          <div className="faq-badge">ข่าวสาร &amp; อัปเดตล่าสุด</div>
          <h1 className="page-title">
            ข่าวสารจาก <span className="grad-text">AJENT</span>
          </h1>
          <p className="page-desc">ติดตามข่าวสาร อัปเดตเกมใหม่ โปรโมชั่นพิเศษ และบทความน่าสนใจสำหรับสตรีมเมอร์</p>
        </div>
      </section>
      <section className="section">
        {news.length === 0 ? (
          <p className="sec-desc" style={{ textAlign: "center" }}>ยังไม่มีข่าวสาร</p>
        ) : (
          <div className="news-grid">
            {news.map((n, i) => (
              <NewsCard key={n.id} item={n} style={{ transitionDelay: `${Math.min(i, 8) * 0.08}s` }} />
            ))}
          </div>
        )}
      </section>
      </main>
      <Footer />
    </>
  );
}

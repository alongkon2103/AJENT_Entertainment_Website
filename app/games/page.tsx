import { getAllGames } from "@/lib/content";
import { breadcrumbLd, itemListLd, pageMetadata } from "@/lib/seo";
import { GamesShowcase } from "../home-client";
import { JsonLd } from "../json-ld";
import { Footer, Nav, RevealObserver } from "../ui";

export const metadata = pageMetadata({
  title: "เกมในสังกัด — เกม Roblox และ Minecraft สำหรับ TikTok Live",
  description:
    "รวมเกม Roblox และ Minecraft จาก Judy Studio และ A Class Store ที่เชื่อมต่อ TikTok Live ผู้ชมส่งของขวัญแล้วเกิดเหตุการณ์ในเกมทันที",
  path: "/games",
});

export default async function GamesPage() {
  const { games, categories } = await getAllGames();
  return (
    <>
      <Nav />
      <JsonLd data={[breadcrumbLd([["เกมในสังกัด", "/games"]]), itemListLd(games.map((g) => ({ name: g.name, path: `/games/${g.slug}` })))]} />
      <RevealObserver />
      <main>
      <section className="page-hero">
        <div className="page-hero-inner">
          <div className="faq-badge">เกมในสังกัด</div>
          <h1 className="page-title">
            เกมทั้งหมดที่พร้อม <span className="grad-text">TikTok Live</span>
          </h1>
          <p className="page-desc">ทุกเกมเชื่อมต่อ TikTok Live ได้ ผู้ชมส่งของขวัญแล้วเกิดเหตุการณ์ในเกมทันที สมาชิกสังกัดใช้งานได้ตามสิทธิ์</p>
        </div>
      </section>
      <section className="sec-dark">
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <GamesShowcase games={games} categories={categories} />
        </div>
      </section>
      </main>
      <Footer />
    </>
  );
}

import { BadgeCheck, CalendarClock, Gamepad2, Newspaper, Pencil, Plus, Shapes } from "lucide-react";
import Link from "next/link";
import { connection } from "next/server";
import { prisma } from "@/lib/db";
import { thaiDate } from "@/lib/tags";

export default async function AdminDashboard() {
  await connection(); // live counts, never prerendered at build time
  const now = new Date();
  const [games, gamesLive, news, newsLive, scheduled, categories, badges, recentGames, recentNews] = await Promise.all([
    prisma.game.count(),
    prisma.game.count({ where: { isPublished: true } }),
    prisma.news.count(),
    prisma.news.count({ where: { isPublished: true, publishedAt: { lte: now } } }),
    prisma.news.count({ where: { isPublished: true, publishedAt: { gt: now } } }),
    prisma.tag.count({ where: { kind: "game-category" } }),
    prisma.tag.count({ where: { kind: "game-badge" } }),
    prisma.game.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { category: true } }),
    prisma.news.findMany({ orderBy: { updatedAt: "desc" }, take: 5, include: { category: true } }),
  ]);

  const stats = [
    { href: "/admin/games", label: `เกม · เผยแพร่ ${gamesLive}`, value: games, icon: Gamepad2, color: "linear-gradient(135deg,#a78bfa,#7c3aed)" },
    { href: "/admin/news", label: `ข่าว · เผยแพร่ ${newsLive}`, value: news, icon: Newspaper, color: "linear-gradient(135deg,#f472b6,#db2777)" },
    { href: "/admin/news", label: "ข่าวตั้งเวลาไว้", value: scheduled, icon: CalendarClock, color: "linear-gradient(135deg,#fbbf24,#d97706)" },
    { href: "/admin/tags/game-category", label: "หมวดหมู่เกม", value: categories, icon: Shapes, color: "linear-gradient(135deg,#60a5fa,#2563eb)" },
    { href: "/admin/tags/game-badge", label: "Badge", value: badges, icon: BadgeCheck, color: "linear-gradient(135deg,#34d399,#059669)" },
  ];

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">แดชบอร์ด</h1>
          <p className="adm-sub">ภาพรวมเนื้อหาบนเว็บไซต์ AJENT</p>
        </div>
        <div className="adm-head-actions">
          <Link href="/admin/news/new" className="adm-btn">
            <Plus size={16} /> เขียนข่าว
          </Link>
          <Link href="/admin/games/new" className="adm-btn primary">
            <Plus size={16} /> เพิ่มเกม
          </Link>
        </div>
      </div>

      <div className="adm-stats">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="adm-card adm-stat">
            <span className="adm-stat-icon" style={{ background: s.color }}>
              <s.icon size={22} />
            </span>
            <span>
              <span className="adm-stat-num">{s.value}</span>
              <span className="adm-stat-label" style={{ display: "block" }}>{s.label}</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="adm-two">
        <section className="adm-card adm-card-pad">
          <div className="adm-card-title">
            <Gamepad2 size={18} /> เกมที่แก้ไขล่าสุด
          </div>
          <div className="adm-list">
            {recentGames.map((g) => (
              <Link key={g.id} href={`/admin/games/${g.id}`}>
                <span className="adm-thumb">{g.coverImage && <img src={g.coverImage} alt="" />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="adm-item-name">{g.name}</span>
                  <span className="adm-item-meta" style={{ display: "block" }}>
                    {g.category?.name ?? "ไม่มีหมวดหมู่"} · {g.isPublished ? "เผยแพร่" : "ซ่อนอยู่"} · แก้ไข {thaiDate(g.updatedAt)}
                  </span>
                </span>
                <Pencil size={15} className="adm-muted" />
              </Link>
            ))}
            {recentGames.length === 0 && <p className="adm-muted">ยังไม่มีเกม</p>}
          </div>
        </section>
        <section className="adm-card adm-card-pad">
          <div className="adm-card-title">
            <Newspaper size={18} /> ข่าวที่แก้ไขล่าสุด
          </div>
          <div className="adm-list">
            {recentNews.map((n) => (
              <Link key={n.id} href={`/admin/news/${n.id}`}>
                <span className="adm-thumb">{n.coverImage && <img src={n.coverImage} alt="" />}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="adm-item-name">{n.title}</span>
                  <span className="adm-item-meta" style={{ display: "block" }}>
                    {n.category?.name ?? "ไม่มีหมวด"} · {n.isPublished ? (n.publishedAt > now ? "ตั้งเวลาไว้" : "เผยแพร่") : "ฉบับร่าง"} · {thaiDate(n.publishedAt)}
                  </span>
                </span>
                <Pencil size={15} className="adm-muted" />
              </Link>
            ))}
            {recentNews.length === 0 && <p className="adm-muted">ยังไม่มีข่าว</p>}
          </div>
        </section>
      </div>
    </>
  );
}

import { ExternalLink, Gamepad2, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { thaiDate } from "@/lib/tags";
import { deleteGame, setGameFlag } from "../../actions";
import { ActionSwitch, DeleteButton } from "../../components";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminGamesPage({ searchParams }: PageProps<"/admin/games">) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const category = one(sp.category);
  const status = one(sp.status);

  const where: Prisma.GameWhereInput = {
    ...(q && { OR: [{ name: { contains: q } }, { slug: { contains: q } }, { genre: { contains: q } }] }),
    ...(category === "none" ? { categoryId: null } : category && { categoryId: Number(category) }),
    ...(status === "published" && { isPublished: true }),
    ...(status === "hidden" && { isPublished: false }),
    ...(status === "featured" && { isFeatured: true }),
  };

  const [games, categories, total] = await Promise.all([
    prisma.game.findMany({
      where,
      include: { category: true, badges: { orderBy: { sortOrder: "asc" } } },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    }),
    prisma.tag.findMany({ where: { kind: "game-category" }, orderBy: { sortOrder: "asc" } }),
    prisma.game.count(),
  ]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">เกมทั้งหมด</h1>
          <p className="adm-sub">
            {games.length === total ? `${total} เกม` : `แสดง ${games.length} จาก ${total} เกม`} · เปิด/ปิดการแสดงผลได้ทันทีจากตาราง
          </p>
        </div>
        <Link href="/admin/games/new" className="adm-btn primary">
          <Plus size={16} /> เพิ่มเกม
        </Link>
      </div>

      <div className="adm-card">
        <form className="adm-toolbar-filters">
          <input className="adm-input" name="q" defaultValue={q} placeholder="ค้นหาชื่อเกม, slug, แนวเกม" />
          <select className="adm-select" name="category" defaultValue={category}>
            <option value="">ทุกหมวดหมู่</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">ไม่มีหมวดหมู่</option>
          </select>
          <select className="adm-select" name="status" defaultValue={status}>
            <option value="">ทุกสถานะ</option>
            <option value="published">เผยแพร่อยู่</option>
            <option value="hidden">ซ่อนอยู่</option>
            <option value="featured">แสดงหน้าแรก</option>
          </select>
          <button className="adm-btn" type="submit">
            <Search size={16} /> ค้นหา
          </button>
        </form>

        {games.length === 0 ? (
          <div className="adm-empty">
            <Gamepad2 size={40} />
            {total === 0 ? "ยังไม่มีเกม เริ่มจากกด “เพิ่มเกม”" : "ไม่พบเกมที่ตรงกับตัวกรอง"}
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>เกม</th>
                  <th>หมวดหมู่ / Badge</th>
                  <th className="c">คะแนน</th>
                  <th className="c">ลำดับ</th>
                  <th className="c">เผยแพร่</th>
                  <th className="c">หน้าแรก</th>
                  <th>แก้ไขล่าสุด</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {games.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="adm-item">
                        <span className="adm-thumb">{g.coverImage && <img src={g.coverImage} alt="" />}</span>
                        <span>
                          <Link href={`/admin/games/${g.id}`} className="adm-item-name">
                            {g.name}
                          </Link>
                          <span className="adm-item-meta" style={{ display: "block" }}>
                            /{g.slug}
                            {g.genre && ` · ${g.genre}`}
                          </span>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="adm-chips">
                        {g.category ? (
                          <span className="adm-chip" style={{ background: g.category.color, color: g.category.textColor, opacity: g.category.isActive ? 1 : 0.45 }}>
                            {g.category.name}
                          </span>
                        ) : (
                          <span className="adm-hint">ไม่มีหมวดหมู่</span>
                        )}
                        {g.badges.map((b) => (
                          <span key={b.id} className="adm-chip" style={{ background: b.color, color: b.textColor, opacity: b.isActive ? 1 : 0.45 }}>
                            {b.name}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="c">{g.rating > 0 ? g.rating.toFixed(1) : "–"}</td>
                    <td className="c">{g.sortOrder}</td>
                    <td className="c">
                      <ActionSwitch on={g.isPublished} action={setGameFlag.bind(null, g.id, "isPublished")} label="เผยแพร่บนเว็บ" />
                    </td>
                    <td className="c">
                      <ActionSwitch on={g.isFeatured} action={setGameFlag.bind(null, g.id, "isFeatured")} label="แสดงในหน้าแรก" />
                    </td>
                    <td className="adm-muted" style={{ whiteSpace: "nowrap" }}>
                      {thaiDate(g.updatedAt)}
                    </td>
                    <td>
                      <div className="adm-row-actions">
                        {g.isPublished && (
                          <a href={`/th/games/${g.slug}`} target="_blank" className="adm-icon-btn" title="ดูบนเว็บ" aria-label="ดูบนเว็บ">
                            <ExternalLink size={16} />
                          </a>
                        )}
                        <Link href={`/admin/games/${g.id}`} className="adm-icon-btn" title="แก้ไข" aria-label="แก้ไข">
                          <Pencil size={16} />
                        </Link>
                        <DeleteButton action={deleteGame.bind(null, g.id)} confirmText={`ลบเกม "${g.name}"? ลบแล้วกู้คืนไม่ได้`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

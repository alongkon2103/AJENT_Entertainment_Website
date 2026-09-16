import { ExternalLink, Newspaper, Pencil, Plus, Search } from "lucide-react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma/client";
import { thaiDate, tint } from "@/lib/tags";
import { deleteNews, setNewsFlag } from "../../actions";
import { ActionSwitch, DeleteButton } from "../../components";

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export default async function AdminNewsPage({ searchParams }: PageProps<"/admin/news">) {
  const sp = await searchParams;
  const q = one(sp.q).trim();
  const category = one(sp.category);
  const status = one(sp.status);
  const now = new Date();

  const where: Prisma.NewsWhereInput = {
    ...(q && { OR: [{ title: { contains: q } }, { slug: { contains: q } }] }),
    ...(category === "none" ? { categoryId: null } : category && { categoryId: Number(category) }),
    ...(status === "published" && { isPublished: true, publishedAt: { lte: now } }),
    ...(status === "scheduled" && { isPublished: true, publishedAt: { gt: now } }),
    ...(status === "draft" && { isPublished: false }),
    ...(status === "pinned" && { isPinned: true }),
  };

  const [items, categories, total] = await Promise.all([
    prisma.news.findMany({ where, include: { category: true }, orderBy: [{ isPinned: "desc" }, { publishedAt: "desc" }] }),
    prisma.tag.findMany({ where: { kind: "news-category" }, orderBy: { sortOrder: "asc" } }),
    prisma.news.count(),
  ]);

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">ข่าวสาร &amp; อัปเดต</h1>
          <p className="adm-sub">{items.length === total ? `${total} ข่าว` : `แสดง ${items.length} จาก ${total} ข่าว`} · ข่าวที่ปักหมุดขึ้นก่อนเสมอ</p>
        </div>
        <Link href="/admin/news/new" className="adm-btn primary">
          <Plus size={16} /> เขียนข่าว
        </Link>
      </div>

      <div className="adm-card">
        <form className="adm-toolbar-filters">
          <input className="adm-input" name="q" defaultValue={q} placeholder="ค้นหาหัวข้อข่าว หรือ slug" />
          <select className="adm-select" name="category" defaultValue={category}>
            <option value="">ทุกหมวด</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
            <option value="none">ไม่มีหมวด</option>
          </select>
          <select className="adm-select" name="status" defaultValue={status}>
            <option value="">ทุกสถานะ</option>
            <option value="published">เผยแพร่อยู่</option>
            <option value="scheduled">ตั้งเวลาไว้</option>
            <option value="draft">ฉบับร่าง</option>
            <option value="pinned">ปักหมุด</option>
          </select>
          <button className="adm-btn" type="submit">
            <Search size={16} /> ค้นหา
          </button>
        </form>

        {items.length === 0 ? (
          <div className="adm-empty">
            <Newspaper size={40} />
            {total === 0 ? "ยังไม่มีข่าว เริ่มจากกด “เขียนข่าว”" : "ไม่พบข่าวที่ตรงกับตัวกรอง"}
          </div>
        ) : (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>ข่าว</th>
                  <th>หมวด</th>
                  <th>วันที่เผยแพร่</th>
                  <th className="c">เผยแพร่</th>
                  <th className="c">ปักหมุด</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((n) => {
                  const scheduled = n.isPublished && n.publishedAt > now;
                  return (
                    <tr key={n.id}>
                      <td>
                        <div className="adm-item">
                          <span className="adm-thumb">{n.coverImage && <img src={n.coverImage} alt="" />}</span>
                          <span>
                            <Link href={`/admin/news/${n.id}`} className="adm-item-name">
                              {n.title}
                            </Link>
                            <span className="adm-item-meta" style={{ display: "block" }}>
                              /{n.slug}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td>
                        {n.category ? (
                          <span className="news-tag" style={{ background: tint(n.category.color, "14"), color: n.category.color, border: `1px solid ${tint(n.category.color, "33")}`, margin: 0, opacity: n.category.isActive ? 1 : 0.45 }}>
                            {n.category.name}
                          </span>
                        ) : (
                          <span className="adm-hint">ไม่มีหมวด</span>
                        )}
                      </td>
                      <td style={{ whiteSpace: "nowrap" }}>
                        {thaiDate(n.publishedAt)}
                        {scheduled && (
                          <span className="adm-item-meta" style={{ display: "block", color: "#d97706" }}>
                            ตั้งเวลาไว้
                          </span>
                        )}
                      </td>
                      <td className="c">
                        <ActionSwitch on={n.isPublished} action={setNewsFlag.bind(null, n.id, "isPublished")} label="เผยแพร่บนเว็บ" />
                      </td>
                      <td className="c">
                        <ActionSwitch on={n.isPinned} action={setNewsFlag.bind(null, n.id, "isPinned")} label="ปักหมุดไว้บนสุด" />
                      </td>
                      <td>
                        <div className="adm-row-actions">
                          {n.isPublished && !scheduled && (
                            <a href={`/news/${n.slug}`} target="_blank" className="adm-icon-btn" title="ดูบนเว็บ" aria-label="ดูบนเว็บ">
                              <ExternalLink size={16} />
                            </a>
                          )}
                          <Link href={`/admin/news/${n.id}`} className="adm-icon-btn" title="แก้ไข" aria-label="แก้ไข">
                            <Pencil size={16} />
                          </Link>
                          <DeleteButton action={deleteNews.bind(null, n.id)} confirmText={`ลบข่าว "${n.title}"? ลบแล้วกู้คืนไม่ได้`} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteNews, saveNews } from "../../../actions";
import { DeleteButton, Field, FormSwitch, ImageField, SaveForm } from "../../../components";
import RichEditor from "../../../RichEditor";

/** Date -> "YYYY-MM-DDTHH:mm" in Thailand time, for <input type="datetime-local">. */
const bangkokInput = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 16);

export default async function AdminNewsEditPage({ params }: PageProps<"/admin/news/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const item = isNew ? null : await prisma.news.findUnique({ where: { id: Number(id) || -1 } });
  if (!isNew && !item) notFound();
  const categories = await prisma.tag.findMany({ where: { kind: "news-category" }, orderBy: { sortOrder: "asc" } });
  const live = item && item.isPublished && item.publishedAt <= new Date();

  return (
    <>
      <div className="adm-head">
        <div>
          <Link href="/admin/news" className="adm-back">
            <ArrowLeft size={15} /> ข่าวสาร &amp; อัปเดต
          </Link>
          <h1 className="adm-title">{item ? item.title : "เขียนข่าวใหม่"}</h1>
          <p className="adm-sub">{item ? `/news/${item.slug}` : "บันทึกเป็นฉบับร่างก่อนได้ เปิดเผยแพร่เมื่อพร้อม"}</p>
        </div>
        {item && (
          <div className="adm-head-actions">
            {live && (
              <a href={`/news/${item.slug}`} target="_blank" className="adm-btn">
                <ExternalLink size={16} /> ดูบนเว็บ
              </a>
            )}
            <DeleteButton action={deleteNews.bind(null, item.id)} confirmText={`ลบข่าว "${item.title}"? ลบแล้วกู้คืนไม่ได้`} redirectTo="/admin/news" withLabel />
          </div>
        )}
      </div>

      <SaveForm action={saveNews} sticky submitLabel={item ? "บันทึกการแก้ไข" : "สร้างข่าว"}>
        {item && <input type="hidden" name="id" value={item.id} />}
        <div className="adm-edit">
          <div className="adm-stack">
            <section className="adm-card adm-card-pad adm-grid">
              <Field label="หัวข้อข่าว" wide>
                <input className="adm-input lg" name="title" defaultValue={item?.title} required maxLength={160} placeholder="เช่น เปิดตัวเกมใหม่ JUDY Legend" />
              </Field>
              <Field label="Slug (URL)" hint="เว้นว่างเพื่อสร้างจากหัวข้อ หัวข้อภาษาไทยควรตั้ง slug เอง" wide>
                <input className="adm-input" name="slug" defaultValue={item?.slug} maxLength={80} placeholder="judy-legend-launch" />
              </Field>
              <Field label="คำโปรย" hint="แสดงใต้หัวข้อในหน้าข่าว และใช้ตอนแชร์ลิงก์" wide>
                <textarea className="adm-textarea" name="excerpt" defaultValue={item?.excerpt} maxLength={500} />
              </Field>
            </section>
            <section className="adm-stack">
              <span className="adm-label">เนื้อหาข่าว</span>
              <RichEditor name="content" defaultValue={item?.content} placeholder="เขียนเนื้อหาข่าว ใส่หัวข้อ รูป ลิงก์ หรือวิดีโอ YouTube ได้" />
            </section>
          </div>

          <aside className="adm-edit-side">
            <section className="adm-card adm-card-pad adm-stack">
              <div className="adm-card-title" style={{ marginBottom: 0 }}>การเผยแพร่</div>
              <FormSwitch name="isPublished" defaultChecked={item?.isPublished} label="เผยแพร่" hint="ปิดไว้ = ฉบับร่าง" />
              <FormSwitch name="isPinned" defaultChecked={item?.isPinned} label="ปักหมุด" hint="แสดงเป็นข่าวแรกเสมอ" />
              <Field label="วันเวลาเผยแพร่" hint="ตั้งเป็นอนาคตเพื่อตั้งเวลาเผยแพร่ (เวลาไทย)">
                <input className="adm-input" type="datetime-local" name="publishedAt" defaultValue={bangkokInput(item?.publishedAt ?? new Date())} />
              </Field>
              <Field label="หมวดข่าว">
                <select className="adm-select" name="categoryId" defaultValue={item?.categoryId ?? ""}>
                  <option value="">ไม่มีหมวด</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isActive ? "" : " (ปิดอยู่)"}
                    </option>
                  ))}
                </select>
              </Field>
            </section>
            <section className="adm-card adm-card-pad adm-stack">
              <span className="adm-label">รูปปก</span>
              <ImageField name="coverImage" defaultValue={item?.coverImage} />
            </section>
          </aside>
        </div>
      </SaveForm>
    </>
  );
}

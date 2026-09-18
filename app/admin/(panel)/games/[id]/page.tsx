import { ArrowLeft, ExternalLink } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { deleteGame, saveGame } from "../../../actions";
import { DeleteButton, Field, FormSwitch, ImageField, SaveForm } from "../../../components";
import RichEditor from "../../../RichEditor";

export default async function AdminGameEditPage({ params }: PageProps<"/admin/games/[id]">) {
  const { id } = await params;
  const isNew = id === "new";
  const game = isNew ? null : await prisma.game.findUnique({ where: { id: Number(id) || -1 }, include: { badges: { select: { id: true } } } });
  if (!isNew && !game) notFound();

  const [categories, badges] = await Promise.all([
    prisma.tag.findMany({ where: { kind: "game-category" }, orderBy: { sortOrder: "asc" } }),
    prisma.tag.findMany({ where: { kind: "game-badge" }, orderBy: { sortOrder: "asc" } }),
  ]);
  const selectedBadges = new Set(game?.badges.map((b) => b.id));

  return (
    <>
      <div className="adm-head">
        <div>
          <Link href="/admin/games" className="adm-back">
            <ArrowLeft size={15} /> เกมทั้งหมด
          </Link>
          <h1 className="adm-title">{game ? game.name : "เพิ่มเกมใหม่"}</h1>
          <p className="adm-sub">{game ? `/th/games/${game.slug}` : "กรอกข้อมูลแล้วกดบันทึก เกมจะยังไม่แสดงจนกว่าจะเปิดเผยแพร่"}</p>
        </div>
        {game && (
          <div className="adm-head-actions">
            {game.isPublished && (
              <a href={`/th/games/${game.slug}`} target="_blank" className="adm-btn">
                <ExternalLink size={16} /> ดูบนเว็บ
              </a>
            )}
            <DeleteButton action={deleteGame.bind(null, game.id)} confirmText={`ลบเกม "${game.name}"? ลบแล้วกู้คืนไม่ได้`} redirectTo="/admin/games" withLabel />
          </div>
        )}
      </div>

      <SaveForm action={saveGame} sticky submitLabel={game ? "บันทึกการแก้ไข" : "สร้างเกม"}>
        {game && <input type="hidden" name="id" value={game.id} />}
        <div className="adm-edit">
          <div className="adm-stack">
            <section className="adm-card adm-card-pad adm-grid">
              <Field label="ชื่อเกม" wide>
                <input className="adm-input lg" name="name" defaultValue={game?.name} required maxLength={120} placeholder="เช่น AC Jump EVO" />
              </Field>
              <Field label="Slug (URL)" hint="เว้นว่างเพื่อสร้างจากชื่อ ใช้ได้ a-z 0-9 และ -">
                <input className="adm-input" name="slug" defaultValue={game?.slug} maxLength={80} placeholder="ac-jump-evo" />
              </Field>
              <Field label="แนวเกม" hint="แสดงใต้ชื่อบนการ์ด">
                <input className="adm-input" name="genre" defaultValue={game?.genre} maxLength={120} placeholder="Obby · Adventure" />
              </Field>
              <Field label="คำอธิบายสั้น" hint="แสดงในหน้ารายละเอียดและใช้เป็นคำอธิบายตอนแชร์ลิงก์" wide>
                <textarea className="adm-textarea" name="excerpt" defaultValue={game?.excerpt} maxLength={500} />
              </Field>
            </section>
            <section className="adm-stack">
              <span className="adm-label">รายละเอียดเกม</span>
              <RichEditor name="content" defaultValue={game?.content} placeholder="เล่าเกี่ยวกับเกม วิธีเล่น ของขวัญที่ใช้ได้ ใส่รูปหรือวิดีโอ YouTube ได้" />
            </section>
            <section className="adm-card adm-card-pad adm-stack">
              <div className="adm-card-title" style={{ marginBottom: 0 }}>ภาษาอังกฤษ (หน้า /en)</div>
              <span className="adm-hint">ช่องไหนเว้นว่าง หน้าภาษาอังกฤษจะใช้ข้อความภาษาไทยแทน</span>
              <Field label="คำอธิบายสั้น (EN)">
                <textarea className="adm-textarea" name="excerptEn" defaultValue={game?.excerptEn} maxLength={500} />
              </Field>
              <span className="adm-label">รายละเอียดเกม (EN)</span>
              <RichEditor name="contentEn" defaultValue={game?.contentEn} placeholder="English version of the game details" />
            </section>
          </div>

          <aside className="adm-edit-side">
            <section className="adm-card adm-card-pad adm-stack">
              <div className="adm-card-title" style={{ marginBottom: 0 }}>การแสดงผล</div>
              <FormSwitch name="isPublished" defaultChecked={game?.isPublished} label="เผยแพร่บนเว็บ" hint="ปิดไว้ = ซ่อนจากทุกหน้า" />
              <FormSwitch name="isFeatured" defaultChecked={game?.isFeatured ?? true} label="แสดงในหน้าแรก" hint="เกมที่เปิดไว้ขึ้นก่อน" />
              <Field label="ลำดับ" hint="เลขน้อยขึ้นก่อน">
                <input className="adm-input" type="number" name="sortOrder" defaultValue={game?.sortOrder ?? 0} />
              </Field>
            </section>

            <section className="adm-card adm-card-pad adm-stack">
              <Field label="หมวดหมู่">
                <select className="adm-select" name="categoryId" defaultValue={game?.categoryId ?? ""}>
                  <option value="">ไม่มีหมวดหมู่</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.isActive ? "" : " (ปิดอยู่)"}
                    </option>
                  ))}
                </select>
              </Field>
              <div className="adm-field">
                <span className="adm-label">Badge</span>
                {badges.length === 0 ? (
                  <span className="adm-hint">
                    ยังไม่มี Badge <Link href="/admin/tags/game-badge">สร้าง Badge</Link>
                  </span>
                ) : (
                  <div className="adm-chips">
                    {badges.map((b) => (
                      <label key={b.id} className="adm-chip-toggle" style={{ "--chip": b.color, "--chip-text": b.textColor } as React.CSSProperties}>
                        <input type="checkbox" name="badgeIds" value={b.id} defaultChecked={selectedBadges.has(b.id)} />
                        <span>{b.name}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
              <Field label="คะแนน (0-5)">
                <input className="adm-input" type="number" name="rating" min={0} max={5} step={0.1} defaultValue={game?.rating ?? 0} />
              </Field>
              <Field label="ลิงก์เข้าเล่นเกม" hint="เช่นลิงก์ Roblox ปุ่ม “เข้าเล่นเกม” จะขึ้นเมื่อมีลิงก์">
                <input className="adm-input" type="url" name="playUrl" defaultValue={game?.playUrl} placeholder="https://www.roblox.com/games/..." />
              </Field>
            </section>

            <section className="adm-card adm-card-pad adm-stack">
              <span className="adm-label">รูปปก</span>
              <ImageField name="coverImage" defaultValue={game?.coverImage} ratio="16 / 10" />
            </section>
          </aside>
        </div>
      </SaveForm>
    </>
  );
}

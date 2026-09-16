import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isTagKind, TAG_KINDS } from "@/lib/tags";
import { TagEditor } from "../../../components";

export default async function AdminTagsPage({ params }: PageProps<"/admin/tags/[kind]">) {
  const { kind } = await params;
  if (!isTagKind(kind)) notFound();
  const info = TAG_KINDS[kind];

  const tags = await prisma.tag.findMany({
    where: { kind },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { categoryGames: true, badgeGames: true, news: true } } },
  });

  return (
    <>
      <div className="adm-head">
        <div>
          <h1 className="adm-title">{info.label}</h1>
          <p className="adm-sub">{info.hint} · ปิดใช้แล้วจะซ่อนจากหน้าเว็บทันที</p>
        </div>
      </div>
      <div className="adm-tag-list">
        <TagEditor kind={kind} />
        {tags.map((t) => (
          <TagEditor key={t.id} kind={kind} tag={t} usage={t._count.categoryGames + t._count.badgeGames + t._count.news} />
        ))}
        {tags.length === 0 && <p className="adm-empty">ยังไม่มี{info.item} เพิ่มจากแถวด้านบน</p>}
      </div>
    </>
  );
}

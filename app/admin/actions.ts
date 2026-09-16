"use server";

import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma/client";
import { cleanRichText } from "@/lib/sanitize";
import { createSessionToken, isCorrectPassword, isValidSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { isTagKind } from "@/lib/tags";

export type FormState = { error?: string; ok?: string } | null;

// ---------- auth ----------

async function requireAdmin() {
  if (!isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) redirect("/admin/login");
}

// ponytail: in-memory lockout per server instance; fine for one admin password on one server.
const failedLogins = new Map<string, { count: number; until: number }>();

export async function login(fd: FormData): Promise<FormState> {
  if (!process.env.ADMIN_PASSWORD) return { error: "ยังไม่ได้ตั้ง ADMIN_PASSWORD ในไฟล์ .env" };
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0].trim() || "unknown";
  const record = failedLogins.get(ip);
  if (record && record.until > Date.now()) return { error: "ใส่รหัสผิดหลายครั้ง กรุณารอ 15 นาทีแล้วลองใหม่" };

  if (!isCorrectPassword(String(fd.get("password") ?? ""))) {
    const count = (record?.count ?? 0) + 1;
    failedLogins.set(ip, count >= 5 ? { count: 0, until: Date.now() + 15 * 60_000 } : { count, until: 0 });
    return { error: "รหัสผ่านไม่ถูกต้อง" };
  }
  failedLogins.delete(ip);
  (await cookies()).set(SESSION_COOKIE, createSessionToken(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  redirect("/admin");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

// ---------- form helpers ----------

const text = (fd: FormData, key: string, max = 200) => String(fd.get(key) ?? "").trim().slice(0, max);
const int = (fd: FormData, key: string) => {
  const n = Number.parseInt(text(fd, key, 12), 10);
  return Number.isFinite(n) ? n : 0;
};
const checked = (fd: FormData, key: string) => fd.get(key) === "on";
const hex = (fd: FormData, key: string, fallback: string) => {
  const v = text(fd, key, 7);
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toLowerCase() : fallback;
};
/** Empty, a path on this site (/uploads/..., /game-media/...), or an http(s) URL. Anything else is null (invalid). */
const link = (fd: FormData, key: string) => {
  const v = text(fd, key, 500);
  const sitePath = /^\/[\w\-./]+$/.test(v) && !v.startsWith("//") && !v.includes("..");
  return v === "" || sitePath || /^https?:\/\/\S+$/i.test(v) ? v : null;
};
/** Slug from the slug field, else from the title. Thai-only titles fall back to "<prefix>-<random>". */
const slug = (fd: FormData, source: string, prefix: string) =>
  (text(fd, "slug") || text(fd, source)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) ||
  `${prefix}-${Date.now().toString(36)}`;
const richText = (fd: FormData) => cleanRichText(String(fd.get("content") ?? "").slice(0, 300_000));
const ids = (fd: FormData, key: string) => fd.getAll(key).map(Number).filter(Number.isInteger).map((id) => ({ id }));

function failed(err: unknown): FormState {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") return { error: "Slug นี้ถูกใช้แล้ว กรุณาเปลี่ยน slug" };
  console.error("[admin] save failed:", err);
  return { error: "บันทึกไม่สำเร็จ กรุณาลองใหม่" };
}

const refresh = () => revalidatePath("/", "layout");

// ---------- tags (game categories, badges, news categories) ----------

export async function saveTag(fd: FormData): Promise<FormState> {
  await requireAdmin();
  const kind = text(fd, "kind", 30);
  if (!isTagKind(kind)) return { error: "ประเภทไม่ถูกต้อง" };
  const name = text(fd, "name", 60);
  if (!name) return { error: "กรุณาใส่ชื่อ" };
  const id = int(fd, "id");
  const data = {
    kind,
    name,
    slug: slug(fd, "name", kind),
    color: hex(fd, "color", "#8b5cf6"),
    textColor: hex(fd, "textColor", "#ffffff"),
    sortOrder: int(fd, "sortOrder"),
    isActive: checked(fd, "isActive"),
  };
  try {
    if (id) await prisma.tag.update({ where: { id }, data });
    else await prisma.tag.create({ data });
  } catch (err) {
    return failed(err);
  }
  refresh();
  return { ok: id ? "บันทึกแล้ว" : `เพิ่ม "${name}" แล้ว` };
}

export async function setTagActive(id: number, isActive: boolean) {
  await requireAdmin();
  await prisma.tag.update({ where: { id }, data: { isActive } });
  refresh();
}

export async function deleteTag(id: number) {
  await requireAdmin();
  await prisma.tag.delete({ where: { id } }); // games/news using it keep existing, their categoryId becomes null
  refresh();
}

// ---------- games ----------

export async function saveGame(fd: FormData): Promise<FormState> {
  await requireAdmin();
  const name = text(fd, "name", 120);
  if (!name) return { error: "กรุณาใส่ชื่อเกม" };
  const coverImage = link(fd, "coverImage");
  if (coverImage === null) return { error: "ลิงก์รูปปกไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)" };
  const playUrl = link(fd, "playUrl");
  if (playUrl === null) return { error: "ลิงก์เข้าเล่นเกมไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)" };

  const id = int(fd, "id");
  const data = {
    name,
    slug: slug(fd, "name", "game"),
    genre: text(fd, "genre", 120),
    excerpt: text(fd, "excerpt", 500),
    content: richText(fd),
    coverImage,
    playUrl,
    rating: Math.min(5, Math.max(0, Math.round((Number(text(fd, "rating", 5)) || 0) * 10) / 10)),
    sortOrder: int(fd, "sortOrder"),
    isPublished: checked(fd, "isPublished"),
    isFeatured: checked(fd, "isFeatured"),
    categoryId: int(fd, "categoryId") || null,
  };
  const badges = ids(fd, "badgeIds");

  let savedId = id;
  try {
    if (id) await prisma.game.update({ where: { id }, data: { ...data, badges: { set: badges } } });
    else savedId = (await prisma.game.create({ data: { ...data, badges: { connect: badges } } })).id;
  } catch (err) {
    return failed(err);
  }
  refresh();
  if (!id) redirect(`/admin/games/${savedId}`);
  return { ok: "บันทึกแล้ว" };
}

export async function setGameFlag(id: number, flag: "isPublished" | "isFeatured", value: boolean) {
  await requireAdmin();
  await prisma.game.update({ where: { id }, data: flag === "isFeatured" ? { isFeatured: value } : { isPublished: value } });
  refresh();
}

export async function deleteGame(id: number) {
  await requireAdmin();
  await prisma.game.delete({ where: { id } });
  refresh();
}

// ---------- news ----------

/** <input type="datetime-local"> value is Thailand time (UTC+7, no DST). */
const bangkokDate = (value: string) => {
  const d = new Date(`${value}:00+07:00`);
  return Number.isNaN(d.getTime()) ? new Date() : d;
};

export async function saveNews(fd: FormData): Promise<FormState> {
  await requireAdmin();
  const title = text(fd, "title", 160);
  if (!title) return { error: "กรุณาใส่หัวข้อข่าว" };
  const coverImage = link(fd, "coverImage");
  if (coverImage === null) return { error: "ลิงก์รูปปกไม่ถูกต้อง (ต้องขึ้นต้นด้วย https://)" };

  const id = int(fd, "id");
  const data = {
    title,
    slug: slug(fd, "title", "news"),
    excerpt: text(fd, "excerpt", 500),
    content: richText(fd),
    coverImage,
    isPublished: checked(fd, "isPublished"),
    isPinned: checked(fd, "isPinned"),
    publishedAt: bangkokDate(text(fd, "publishedAt", 16)),
    categoryId: int(fd, "categoryId") || null,
  };

  let savedId = id;
  try {
    if (id) await prisma.news.update({ where: { id }, data });
    else savedId = (await prisma.news.create({ data })).id;
  } catch (err) {
    return failed(err);
  }
  refresh();
  if (!id) redirect(`/admin/news/${savedId}`);
  return { ok: "บันทึกแล้ว" };
}

export async function setNewsFlag(id: number, flag: "isPublished" | "isPinned", value: boolean) {
  await requireAdmin();
  await prisma.news.update({ where: { id }, data: flag === "isPinned" ? { isPinned: value } : { isPublished: value } });
  refresh();
}

export async function deleteNews(id: number) {
  await requireAdmin();
  await prisma.news.delete({ where: { id } });
  refresh();
}

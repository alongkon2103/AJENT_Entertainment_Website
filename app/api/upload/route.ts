import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { isValidSession, SESSION_COOKIE } from "@/lib/session";
import { IMAGE_TYPES, MAX_UPLOAD_BYTES, UPLOAD_DIR } from "@/lib/uploads";

/** Admin image upload (cover images and images inside the rich-text editor). Returns { url }. */
export async function POST(request: Request) {
  if (!isValidSession((await cookies()).get(SESSION_COOKIE)?.value)) {
    return Response.json({ error: "กรุณาเข้าสู่ระบบใหม่" }, { status: 401 });
  }
  const file = (await request.formData().catch(() => null))?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "ไม่พบไฟล์" }, { status: 400 });

  const ext = IMAGE_TYPES[file.type];
  if (!ext) return Response.json({ error: "รองรับเฉพาะ PNG, JPG, WEBP, GIF" }, { status: 415 });
  if (file.size > MAX_UPLOAD_BYTES) return Response.json({ error: "ไฟล์ใหญ่เกิน 5MB" }, { status: 413 });

  const name = `${randomUUID()}.${ext}`;
  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, name), Buffer.from(await file.arrayBuffer()));
  return Response.json({ url: `/uploads/${name}` });
}

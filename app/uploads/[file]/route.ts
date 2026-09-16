import { readFile } from "node:fs/promises";
import path from "node:path";
import { UPLOAD_DIR, UPLOAD_NAME } from "@/lib/uploads";

const MIME: Record<string, string> = { png: "image/png", jpg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

/** Serves files saved by /api/upload. Next only serves public/ files that existed at build time, hence this route. */
export async function GET(_request: Request, ctx: RouteContext<"/uploads/[file]">) {
  const { file } = await ctx.params;
  const match = UPLOAD_NAME.exec(file); // strict name check also blocks path traversal
  if (!match) return new Response("Not found", { status: 404 });
  try {
    const data = await readFile(path.join(/*turbopackIgnore: true*/ UPLOAD_DIR, file));
    return new Response(data, {
      headers: { "Content-Type": MIME[match[1]], "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}

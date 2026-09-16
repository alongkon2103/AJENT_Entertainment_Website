import path from "node:path";

// ponytail: local disk, fine on a VPS. On serverless hosting (files vanish between deploys) switch to S3/R2.
export const UPLOAD_DIR = path.join(/*turbopackIgnore: true*/ process.cwd(), "uploads");
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };
export const UPLOAD_NAME = /^[0-9a-f-]{36}\.(png|jpg|webp|gif)$/;

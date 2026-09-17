import type { NextConfig } from "next";

// robots.txt, the sitemap host and static pages' canonical/Open Graph URLs are baked in at build time from SITE_URL.
if (process.env.npm_lifecycle_event === "build" && !/^https:\/\//.test(process.env.SITE_URL ?? "")) {
  console.warn(`\n[SEO] SITE_URL is "${process.env.SITE_URL ?? ""}". Set it to the real https domain before building for production.\n`);
}

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory otherwise makes Next guess the wrong workspace root.
  turbopack: { root: __dirname },
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 2592000, // 30 days in the optimizer cache
  },
  async headers() {
    const cache = (value: string) => [{ key: "Cache-Control", value }];
    const year = "public, max-age=31536000, immutable";
    const month = "public, max-age=2592000";
    return [
      // CMS covers keep their name per game, but are replaced by re-uploading a new file
      { source: "/game-media/:path*", headers: cache(month) },
      { source: "/icons/:path*", headers: cache(year) },
      { source: "/app-demo/:path*", headers: cache(month) },
      { source: "/widgets/:path*", headers: cache(month) },
      { source: "/sfx/:path*", headers: cache(year) },
      ...["/BannerTk.jpeg", "/tikkies-preview.png", "/steps-live.jpg", "/og-default.jpg", "/logo.png", "/Preview.mp4", "/preview-poster.jpg", "/SetStream.png"].map((source) => ({
        source,
        headers: cache(month),
      })),
    ];
  },
};

export default nextConfig;

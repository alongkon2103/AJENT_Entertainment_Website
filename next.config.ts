import type { NextConfig } from "next";

// robots.txt, the sitemap host and static pages' canonical/Open Graph URLs are baked in at build time from SITE_URL.
if (process.env.npm_lifecycle_event === "build" && !/^https:\/\//.test(process.env.SITE_URL ?? "")) {
  console.warn(`\n[SEO] SITE_URL is "${process.env.SITE_URL ?? ""}". Set it to the real https domain before building for production.\n`);
}

const nextConfig: NextConfig = {
  // A stray package-lock.json in the home directory otherwise makes Next guess the wrong workspace root.
  turbopack: { root: __dirname },
};

export default nextConfig;

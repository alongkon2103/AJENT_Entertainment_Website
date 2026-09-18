import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { headers } from "next/headers";
import { SITE } from "@/lib/seo";
import "./globals.css";
import { defaultLocale, isLocale } from "./i18n";
import { UIProvider } from "./ui";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Defaults for every page (Thai). app/[lang]/layout.tsx localizes them; pages add canonical URL,
// hreflang and share cards via pageMetadata() in lib/seo.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: "%s | AJENT" },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: SITE.keywords,
  authors: [{ name: SITE.name, url: SITE.url }],
  creator: SITE.name,
  publisher: SITE.name,
  category: "entertainment",
  formatDetection: { telephone: false, email: false, address: false },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
  },
  openGraph: { type: "website", siteName: SITE.name, locale: "th_TH", title: SITE.title, description: SITE.description, images: [SITE.ogImage] },
  twitter: { card: "summary_large_image", title: SITE.title, description: SITE.description, images: [SITE.ogImage.url] },
  appleWebApp: { capable: true, title: "AJENT", statusBarStyle: "black-translucent" },
  ...(process.env.GOOGLE_SITE_VERIFICATION && { verification: { google: process.env.GOOGLE_SITE_VERIFICATION } }),
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f0ff" },
    { media: "(prefers-color-scheme: dark)", color: "#0c0818" },
  ],
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // proxy.ts sets x-locale from the /th or /en prefix (admin and other pages default to Thai)
  const locale = (await headers()).get("x-locale");
  const lang = isLocale(locale) ? locale : defaultLocale;
  return (
    <html lang={lang} className={`${notoThai.variable} ${inter.variable}`}>
      <body>
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}

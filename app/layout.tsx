import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Thai } from "next/font/google";
import { organizationLd, SITE, websiteLd } from "@/lib/seo";
import "./globals.css";
import { JsonLd } from "./json-ld";
import { UIProvider } from "./ui";

const notoThai = Noto_Sans_Thai({
  variable: "--font-noto-thai",
  subsets: ["thai", "latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Defaults for every page. Pages add their own canonical URL + share cards via pageMetadata() in lib/seo.ts.
export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: SITE.title, template: `%s | ${SITE.name}` },
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
  openGraph: { type: "website", siteName: SITE.name, locale: SITE.locale, title: SITE.title, description: SITE.description, images: [SITE.ogImage] },
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="th" className={`${notoThai.variable} ${inter.variable}`}>
      <body>
        <JsonLd data={[organizationLd(), websiteLd()]} />
        <UIProvider>{children}</UIProvider>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import siteJson from "@/data/site.json";
import { display, mono, sans } from "./fonts";
import "./globals.css";

const title = `${siteJson.name} — GTM engineering for B2B teams`;

export const metadata: Metadata = {
  metadataBase: new URL(siteJson.url),
  title: {
    default: title,
    template: `%s · ${siteJson.name}`,
  },
  description: siteJson.description,
  applicationName: siteJson.name,
  keywords: ["GTM engineering", "RevOps automation", "outbound systems", "lead enrichment", "lead scoring", "reply routing", "signal detection", "Clay", "HubSpot"],
  authors: [{ name: siteJson.owner.name, url: siteJson.owner.site }],
  openGraph: {
    type: "website",
    siteName: siteJson.name,
    title,
    description: siteJson.description,
    url: siteJson.url,
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title,
    description: siteJson.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0a0b0d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable} ${mono.variable}`}>
      <body>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100] focus:rounded-[8px] focus:bg-accent focus:px-3 focus:py-2 focus:text-[#0a0b0d]"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}

import localFont from "next/font/local";
import { GeistSans } from "geist/font/sans";

/**
 * Display face. Bricolage Grotesque ships with the @fontsource package so the
 * build never reaches the network for fonts.
 */
export const display = localFont({
  src: "../node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "200 800",
  display: "swap",
});

export const sans = GeistSans;

/**
 * Mono is used for small labels and logs only, so it is not preloaded; that
 * keeps ~70 KB off the critical path before the hero text paints.
 */
export const mono = localFont({
  src: "../node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2",
  variable: "--font-geist-mono",
  weight: "100 900",
  display: "swap",
  preload: false,
  adjustFontFallback: false,
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
});

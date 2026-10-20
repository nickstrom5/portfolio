import type { NextConfig } from "next";

/**
 * Content Security Policy. Everything the page loads is first-party, so every
 * fetch directive is 'self'. Next.js bootstraps static pages with inline
 * scripts (and the JSON-LD block is inline), so script-src needs
 * 'unsafe-inline'; per-request nonces would force dynamic rendering. The
 * policy still blocks third-party scripts, plugins, <base> hijacking, form
 * posts elsewhere and framing.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  // Vercel preview deployments inject the Vercel toolbar from vercel.live,
  // which this policy would block, so the CSP applies everywhere except there.
  ...(process.env.VERCEL_ENV === "preview" ? [] : [{ key: "Content-Security-Policy", value: csp }]),
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The showcase lives inside a larger repo; pin the workspace root here so
  // Turbopack does not pick up the parent lockfile.
  turbopack: { root: __dirname },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

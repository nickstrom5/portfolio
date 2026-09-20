import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The showcase lives inside a larger repo; pin the workspace root here so
  // Turbopack does not pick up the parent lockfile.
  turbopack: { root: __dirname },
};

export default nextConfig;

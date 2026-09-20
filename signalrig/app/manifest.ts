import type { MetadataRoute } from "next";
import siteJson from "@/data/site.json";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: siteJson.name,
    short_name: siteJson.name,
    description: siteJson.description,
    start_url: "/",
    display: "browser",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}

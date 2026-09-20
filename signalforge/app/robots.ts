import type { MetadataRoute } from "next";
import siteJson from "@/data/site.json";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: `${siteJson.url}/sitemap.xml`,
  };
}

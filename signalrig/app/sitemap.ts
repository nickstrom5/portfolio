import type { MetadataRoute } from "next";
import siteJson from "@/data/site.json";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: siteJson.url, lastModified: new Date(siteJson.seo.updated), changeFrequency: "monthly", priority: 1 }];
}

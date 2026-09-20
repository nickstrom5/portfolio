import siteJson from "@/data/site.json";

/**
 * JSON-LD for search engines. Honest shape: a website with an author and a
 * public source repository. No organisation or review markup, since the site
 * is a demonstration rather than a company with clients.
 */
export function StructuredData() {
  const o = siteJson.owner;
  const person = {
    "@type": "Person",
    "@id": `${o.site}/#person`,
    name: o.name,
    jobTitle: o.jobTitle,
    url: o.site,
    email: o.email,
    address: { "@type": "PostalAddress", addressLocality: o.location, addressCountry: "US" },
    sameAs: Object.values(o.links),
  };
  const data = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${siteJson.url}/#website`,
        url: siteJson.url,
        name: siteJson.name,
        description: siteJson.description,
        inLanguage: "en-US",
        author: { "@id": person["@id"] },
        dateModified: siteJson.seo.updated,
      },
      {
        "@type": "WebPage",
        "@id": `${siteJson.url}/#webpage`,
        url: siteJson.url,
        name: `${siteJson.name} — GTM engineering for B2B teams`,
        description: siteJson.description,
        isPartOf: { "@id": `${siteJson.url}/#website` },
        about: ["GTM engineering", "Revenue operations", "Outbound sales systems", "Lead enrichment", "Lead scoring"],
        primaryImageOfPage: `${siteJson.url}/opengraph-image`,
      },
      {
        "@type": "SoftwareSourceCode",
        name: `${siteJson.name} showcase`,
        codeRepository: siteJson.seo.sourceUrl,
        programmingLanguage: "TypeScript",
        runtimePlatform: "Next.js",
        author: { "@id": person["@id"] },
      },
      person,
    ],
  };
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

import { ImageResponse } from "next/og";
import siteJson from "@/data/site.json";

export const alt = `${siteJson.name}: GTM systems that compound`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(180deg, #0a0b0d 0%, #111318 100%)",
          color: "#f2f3f5",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <svg width="56" height="56" viewBox="0 0 32 32">
            <rect x="1" y="1" width="30" height="30" rx="8" fill="#171a20" stroke="#2a2f38" />
            <path d="M8 21 L13 12 L17 18 L20 14 L24 21" fill="none" stroke="#f4581a" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
            <circle cx="24" cy="21" r="2.4" fill="#f4581a" />
          </svg>
          <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: -1 }}>{siteJson.name}</div>
          <div style={{ fontSize: 22, color: "#737a87", marginLeft: 8 }}>GTM engineering</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", gap: 22, fontSize: 92, fontWeight: 700, letterSpacing: -4, lineHeight: 1 }}>
            <span>GTM systems that</span>
            <span style={{ color: "#ff8a4d" }}>compound.</span>
          </div>
          <div style={{ fontSize: 30, color: "#aab0bb", maxWidth: 980, lineHeight: 1.3 }}>
            Enrichment → scoring → routing → signals → reporting. Working demos, not decks.
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: "#737a87" }}>
          <div style={{ display: "flex", gap: 28 }}>
            {["Enrichment", "Scoring", "Routing", "Signals", "Reporting"].map((s, i) => (
              <div key={s} style={{ display: "flex", gap: 10 }}>
                <span style={{ color: "#f4581a" }}>0{i + 1}</span>
                <span>{s}</span>
              </div>
            ))}
          </div>
          <div>{siteJson.owner.siteLabel}</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

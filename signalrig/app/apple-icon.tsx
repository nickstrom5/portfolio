import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#111318" }}>
        <svg width="132" height="132" viewBox="0 0 32 32">
          <path d="M8 21 L13 12 L17 18 L20 14 L24 21" fill="none" stroke="#f4581a" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx="24" cy="21" r="2.4" fill="#f4581a" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

export function Logo({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="var(--surface-2)" stroke="var(--line-strong)" />
      <path d="M8 21 L13 12 L17 18 L20 14 L24 21" fill="none" stroke="var(--accent)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="24" cy="21" r="2.4" fill="var(--accent)" />
    </svg>
  );
}

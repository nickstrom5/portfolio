/** Tiny class-name joiner. Avoids a dependency for the common case. */
export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

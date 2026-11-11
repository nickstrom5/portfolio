/** Small helpers shared by the Zaps in src/data/zapier. */
import type { AppStep, Ctx, StepResult } from '@/lib/zapier/types';

/** A value as text, the way a mapped field reads: empty for nothing. */
export const str = (v: unknown): string => (v === null || v === undefined ? '' : String(v));

export const firstName = (name: unknown) => str(name).trim().split(/\s+/)[0] ?? '';

/** Formatter › Text › Capitalize: the first letter of every word, the rest lower case. */
export const capitalize = (s: unknown) =>
  str(s)
    .trim()
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_m, a: string, b: string) => a + b.toUpperCase());

/** Formatter › Numbers › Format Phone Number, to E.164 for US numbers; empty when it is not one. */
export function e164(s: unknown): string {
  const d = str(s).replace(/\D/g, '');
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : '';
}

export const money = (n: number) => `$${n.toLocaleString('en-US', { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 })}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Formatter › Date / Time › Format, as "Tue, Mar 3 at 9:00 AM", from an ISO time without a zone. */
export function niceTime(iso: unknown): string {
  const d = new Date(`${str(iso).replace(/Z$/, '').slice(0, 19)}Z`);
  const h = d.getUTCHours();
  return `${DAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()} at ${h % 12 === 0 ? 12 : h % 12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
}

/** "Mar 3" from an ISO date or time. */
export function shortDate(iso: unknown): string {
  const d = new Date(`${str(iso).slice(0, 10)}T00:00:00Z`);
  return `${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** A Formatter by Zapier step: free, and its output field is always called Output. */
export function formatter(o: {
  id: string;
  title: string;
  event: 'Text' | 'Numbers' | 'Utilities' | 'Date / Time';
  transform: string;
  input: string;
  summary: string;
  extra?: { k: string; v: string }[];
  run: (c: Ctx) => StepResult;
}): AppStep {
  return {
    kind: 'action',
    id: o.id,
    app: 'Formatter by Zapier',
    event: o.event,
    icon: 'wand',
    title: o.title,
    summary: o.summary,
    params: [{ k: 'Transform', v: o.transform }, { k: 'Input', v: o.input }, ...(o.extra ?? [])],
    run: o.run,
  };
}

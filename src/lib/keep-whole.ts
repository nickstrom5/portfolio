/**
 * Text that should never break inside itself: spaces become no-break spaces and
 * hyphens no-break hyphens. Used for the "See …" links under the tool pages' cards,
 * where a wrap split names ("Monday slides / chase", "check- / ins").
 */
export const keepWhole = (s: string) => s.replaceAll(' ', '\u00a0').replaceAll('-', '\u2011');

/**
 * "Case 03 · Step" for a link: the case name, number and dot stay together and so does
 * the step name, so the only break is after the dot and a line never starts with "·".
 */
export const caseStepLabel = (caseName: string, number: string, step: string) => `${keepWhole(caseName)}\u00a0${number}\u00a0· ${keepWhole(step)}`;

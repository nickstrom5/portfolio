/**
 * Everything /airtable/ shows: three case studies, each a sample Airtable base
 * with a working form and its automations. Checked by `npm run airtable:check`.
 * The page script loads each case on its own (src/lib/airtable/load-case.ts),
 * so a case added here needs a loader there too; airtable.astro fails the
 * build otherwise.
 */
import type { CaseStudy } from '@/lib/airtable/types';
import { eventsCase } from './events';
import { rentalsCase } from './rentals';
import { recruitingCase } from './recruiting';

/** Events team, operations team, then a recruiting firm. */
export const cases: CaseStudy[] = [eventsCase, rentalsCase, recruitingCase];

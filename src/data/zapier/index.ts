/**
 * Everything /zapier/ shows: three case studies, each a sample business with
 * its connected apps, a working form and its Zaps. Checked by
 * `npm run zapier:check`. The page script loads each case on its own
 * (src/lib/zapier/load-case.ts), so a case added here needs a loader there
 * too; zapier.astro fails the build otherwise.
 */
import type { CaseStudy } from '@/lib/zapier/types';
import { cleaningCase } from './cleaning';
import { solarCase } from './solar';
import { workshopsCase } from './workshops';

/** A service business, then a sales team, then an events business. */
export const cases: CaseStudy[] = [cleaningCase, solarCase, workshopsCase];

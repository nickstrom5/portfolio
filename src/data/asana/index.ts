/**
 * Everything /asana/ shows: three case studies, each a sample Asana
 * organization with its projects, intake form, reporting and automations.
 * Checked by `npm run asana:check`.
 */
import type { CaseStudy } from '@/lib/asana/types';
import { marketingCase } from './marketing';
import { servicesCase } from './services';
import { nonprofitCase } from './nonprofit';

/** Marketing team, professional-services firm, then nonprofit program. */
export const cases: CaseStudy[] = [marketingCase, servicesCase, nonprofitCase];

/**
 * Everything /n8n/ shows: three case studies, each a sample n8n instance with
 * a test form and its workflows. Checked by `npm run n8n:check`. The page
 * script loads each case on its own (src/lib/n8n/load-case.ts), so a case
 * added here needs a loader there too; n8n.astro fails the build otherwise.
 */
import type { CaseStudy } from '@/lib/n8n/types';
import { coffeeCase } from './coffee';
import { bookkeepingCase } from './bookkeeping';
import { recruitingCase } from './recruiting';

/** Small online store, professional services firm, then a recruiting agency. */
export const cases: CaseStudy[] = [coffeeCase, bookkeepingCase, recruitingCase];

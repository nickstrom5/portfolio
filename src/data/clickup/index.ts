/**
 * Everything /clickup/ shows: three case studies, each a sample Workspace
 * with a Form and its processes. Checked by `npm run clickup:check`. The page
 * script loads each case on its own (src/lib/clickup/load-case.ts), so a case
 * added here needs a loader there too; clickup.astro fails the build otherwise.
 */
import type { CaseStudy } from '@/lib/clickup/types';
import { agencyCase } from './agency';
import { opsCase } from './ops';
import { productCase } from './product';

/** Agency delivery, then operations, then a product team. */
export const cases: CaseStudy[] = [agencyCase, opsCase, productCase];

/** The operations case: a property manager's Workspace, its Form and four processes. */
import type { CaseStudy } from '@/lib/clickup/types';
import { workspace } from './workspace';
import { form } from './form';
import { maintenance } from './maintenance';
import { turnover } from './turnover';
import { inspections } from './inspections';
import { vendors } from './vendors';

/** Processes in page order. */
export const opsCase: CaseStudy = { workspace, form, processes: [maintenance, turnover, inspections, vendors] };

/** The agency case: a design studio's Workspace, its Form and four processes. */
import type { CaseStudy } from '@/lib/clickup/types';
import { workspace } from './workspace';
import { form } from './form';
import { intake } from './intake';
import { review } from './review';
import { launch } from './launch';
import { retainer } from './retainer';

/** Processes in page order. */
export const agencyCase: CaseStudy = { workspace, form, processes: [intake, review, launch, retainer] };

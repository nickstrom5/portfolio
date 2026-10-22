/** The product case: a software team's Workspace, its bug Form and four processes. */
import type { CaseStudy } from '@/lib/clickup/types';
import { workspace } from './workspace';
import { form } from './form';
import { triage } from './triage';
import { sprint } from './sprint';
import { launch } from './launch';
import { requests } from './requests';

/** Processes in page order. */
export const productCase: CaseStudy = { workspace, form, processes: [triage, sprint, launch, requests] };

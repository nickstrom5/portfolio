/** The nonprofit case: Cascadia Watershed Alliance's monitoring program, reporting and five automations. */
import type { CaseStudy } from '@/lib/asana/types';
import { nonprofitOrg } from './org';
import { dataRequests } from './automations/data-requests';
import { fieldQa } from './automations/field-qa';
import { blocked } from './automations/blocked';
import { reportPrep } from './automations/report-prep';
import { reportApproval } from './automations/report-approval';

export const nonprofitCase: CaseStudy = { ...nonprofitOrg, automations: [dataRequests, fieldQa, blocked, reportPrep, reportApproval] };

/**
 * Everything /ghl/ shows: the sample sub-account and its automations, in
 * the order they appear. Checked by `npm run ghl:check`.
 */
import type { Automation } from '@/lib/ghl/types';
import { speedToLead } from './automations/speed-to-lead';

export { business, pipeline, env, sampleContact, fieldLabels, team } from './business';

export const automations: Automation[] = [speedToLead];

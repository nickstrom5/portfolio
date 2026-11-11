import type { CaseStudy } from '@/lib/zapier/types';
import { business, connections, world } from './business';
import { demo } from './demo';
import { quoteRequest } from './zaps/quote-request';
import { jobDone } from './zaps/job-done';
import { visitReminder } from './zaps/visit-reminder';

/** Zaps in page order. Each file lives in ./zaps. */
export const cleaningCase: CaseStudy = { business, connections, world, demo, zaps: [quoteRequest, jobDone, visitReminder] };

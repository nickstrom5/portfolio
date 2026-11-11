import type { CaseStudy } from '@/lib/zapier/types';
import { business, connections, world } from './business';
import { demo } from './demo';
import { leadRouting } from './zaps/lead-routing';
import { consultBooked } from './zaps/consult-booked';
import { dailyRoundup } from './zaps/daily-roundup';

/** Zaps in page order. Each file lives in ./zaps. */
export const solarCase: CaseStudy = { business, connections, world, demo, zaps: [leadRouting, consultBooked, dailyRoundup] };

import type { CaseStudy } from '@/lib/zapier/types';
import { business, connections, world } from './business';
import { demo } from './demo';
import { paidSeat } from './zaps/paid-seat';
import { dayBefore } from './zaps/day-before';
import { afterWorkshop } from './zaps/after-workshop';

/** Zaps in page order. Each file lives in ./zaps. */
export const workshopsCase: CaseStudy = { business, connections, world, demo, zaps: [paidSeat, dayBefore, afterWorkshop] };

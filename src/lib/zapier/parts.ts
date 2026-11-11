/**
 * The parts of a /zapier/ case that can load when opened (src/lib/parts.ts):
 * its form and each Zap's body. CaseStudy.astro leaves a slot for every part
 * `inFull` rules out; /zapier/parts/<case>.json renders those parts.
 */
import ZapBody from '@/components/zapier/ZapBody.astro';
import DemoForm from '@/components/zapier/DemoForm.astro';
import { inFull } from '@/lib/parts';
import type { Part } from '@/lib/parts-render';
import type { CaseStudy } from './types';

/** How the page names the Zap a case's form feeds, and that Zap's trigger. */
export function fedBy({ zaps, demo }: CaseStudy) {
  const fed = zaps.find((z) => z.id === demo.feeds);
  return { feedsName: fed ? `Zap ${fed.number} · ${fed.name}` : 'the first Zap', triggerName: fed ? `${fed.trigger.app} · ${fed.trigger.event}` : 'form' };
}

/** The parts of the case at `index` on the page that its HTML leaves out. */
export function deferredParts(study: CaseStudy, index: number): Part[] {
  const id = study.business.id;
  const parts: Part[] = [];
  if (!inFull(index)) parts.push({ id: `${id}/demo`, component: DemoForm, props: { caseId: id, demo: study.demo, ...fedBy(study) } });
  study.zaps.forEach((z, i) => {
    if (!inFull(index, i)) parts.push({ id: `${id}/${z.id}`, component: ZapBody, props: { zap: z, caseId: id } });
  });
  return parts;
}

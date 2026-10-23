/**
 * The parts of a /ghl/ case that can load when opened (src/lib/parts.ts): its
 * landing demo and each workflow's body. CaseStudy.astro leaves a slot for
 * every part `inFull` rules out; /ghl/parts/<case>.json renders those parts.
 */
import AutomationBody from '@/components/ghl/AutomationBody.astro';
import LandingDemo from '@/components/ghl/LandingDemo.astro';
import { inFull } from '@/lib/parts';
import type { Part } from '@/lib/parts-render';
import type { CaseStudy } from './types';

/** "workflow 01 · Speed to Lead": the workflow a case's landing page feeds. */
export function feedsName({ automations, landing }: CaseStudy) {
  const fed = automations.find((a) => a.id === landing.feeds);
  return fed ? `workflow ${fed.number} · ${fed.name}` : 'the first workflow';
}

/** The parts of the case at `index` on the page that its HTML leaves out. */
export function deferredParts(study: CaseStudy, index: number): Part[] {
  const id = study.business.id;
  const parts: Part[] = [];
  if (!inFull(index)) parts.push({ id: `${id}/demo`, component: LandingDemo, props: { caseId: id, landing: study.landing, feedsName: feedsName(study) } });
  study.automations.forEach((a, i) => {
    if (!inFull(index, i)) parts.push({ id: `${id}/${a.id}`, component: AutomationBody, props: { automation: a, caseId: id } });
  });
  return parts;
}

/**
 * The parts of a /clickup/ case that can load when opened (src/lib/parts.ts):
 * its Form and each process's body. CaseStudy.astro leaves a slot for every
 * part `inFull` rules out; /clickup/parts/<case>.json renders those parts.
 */
import FormDemo from '@/components/clickup/FormDemo.astro';
import ProcessBody from '@/components/clickup/ProcessBody.astro';
import { inFull } from '@/lib/parts';
import type { Part } from '@/lib/parts-render';
import { namesOf } from './engine';
import type { CaseStudy } from './types';

/** How the page names the process a case's Form feeds, and where that process lives. */
export function fedBy({ processes, form }: CaseStudy) {
  const fed = processes.find((p) => p.id === form.feeds);
  return { feedsName: fed ? `${fed.number} · ${fed.name}` : 'the first process', where: fed ? `${fed.location.space} › ${fed.location.list}` : 'a List' };
}

/** The parts of the case at `index` on the page that its HTML leaves out. */
export function deferredParts(study: CaseStudy, index: number): Part[] {
  const id = study.workspace.id;
  const names = namesOf(study.workspace);
  const parts: Part[] = [];
  if (!inFull(index)) parts.push({ id: `${id}/demo`, component: FormDemo, props: { caseId: id, form: study.form, ...fedBy(study) } });
  study.processes.forEach((p, i) => {
    if (!inFull(index, i)) parts.push({ id: `${id}/${p.id}`, component: ProcessBody, props: { process: p, caseId: id, names } });
  });
  return parts;
}

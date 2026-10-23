/**
 * Deferred parts of the platform pages (/ghl/, /n8n/, /clickup/, /asana/,
 * /airtable/). Only one case shows at a time, so the HTML carries the first
 * case in full except its later workflows; every other diagram, simulator,
 * demo and build-notes block is an empty [data-part] slot (Part.astro), filled
 * from <page>/parts/<case>.json when its case or workflow is opened. Each
 * case's name, intro and workflow summaries stay in the HTML for search
 * engines and for anyone without JavaScript.
 */

/** Whether a page sends a part in its HTML: the first case's parts, except workflows after its first. */
export const inFull = (caseIndex: number, workflowIndex = 0) => caseIndex === 0 && workflowIndex === 0;

/** Fetches a parts file and puts each part into its slot; resolves with the elements added. */
async function fillParts(href: string): Promise<Element[]> {
  const res = await fetch(href);
  if (!res.ok) throw new Error(`${href}: HTTP ${res.status}`);
  const { parts } = (await res.json()) as { parts: Record<string, string> };
  const added: Element[] = [];
  for (const [id, html] of Object.entries(parts)) {
    const slot = document.querySelector(`[data-part="${CSS.escape(id)}"]`);
    if (!slot) continue;
    // A template parses without running anything or loading images until the part is placed.
    const t = document.createElement('template');
    t.innerHTML = html;
    added.push(...t.content.children);
    slot.replaceWith(t.content);
  }
  return added;
}

/**
 * One loader per page. `ensure(caseId)` fetches a case's parts once, hands the
 * elements added to `onFill` (to wire up tabs, simulators and so on), and
 * resolves whether or not the fetch worked; after a failure the slots say so
 * and the next call tries again. `need` does the same only when one of the
 * case's empty slots is showing, so hidden workflows wait until they're opened.
 */
export function partsLoader(href: (caseId: string) => string, onFill: (caseId: string, added: Element[]) => void) {
  const loading = new Map<string, Promise<void>>();
  const slots = (caseId: string) => document.querySelectorAll<HTMLElement>(`[data-part^="${CSS.escape(caseId)}/"]`);
  const ensure = (caseId: string): Promise<void> => {
    if (!slots(caseId).length) return Promise.resolve();
    let p = loading.get(caseId);
    if (!p) {
      p = fillParts(href(caseId)).then(
        (added) => onFill(caseId, added),
        () => {
          loading.delete(caseId);
          slots(caseId).forEach((s) => (s.textContent = 'This part didn’t load. Check your connection, then open it again.'));
        },
      );
      loading.set(caseId, p);
    }
    return p;
  };
  const need = (caseId: string) => ([...slots(caseId)].some((s) => !s.closest('[hidden]')) ? ensure(caseId) : Promise.resolve());
  return { ensure, need };
}

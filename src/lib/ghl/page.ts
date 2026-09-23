/**
 * Wires up /ghl/: the case-study switcher, each case's workflow tabs, the
 * simulators, copy buttons and the landing-page demos that turn the visitor
 * into the test contact for a case's first workflow.
 *
 * Deep links: #roofing opens a case; #roofing-speed-to-lead opens a case
 * and one of its workflows; #roofing-demo scrolls to a case's landing page.
 */
import { cases } from '@/data/ghl';
import { formatDay, formatTime, nextWindowOpen } from './engine';
import type { CaseStudy, Contact } from './types';
import { Simulator, envFor } from './ui';

const DAY = 1440;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollTo = (el: Element | null | undefined) => el?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });

/** Roving-focus tablist: click, arrow keys, Home and End. */
function tablist(tabs: HTMLButtonElement[], key: string, onSelect: (id: string, focus: boolean) => void) {
  const ids = tabs.map((t) => t.dataset[key]!);
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => onSelect(ids[i], false));
    t.addEventListener('keydown', (e) => {
      const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (move) {
        e.preventDefault();
        onSelect(ids[(i + move + ids.length) % ids.length], true);
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        onSelect(ids[e.key === 'Home' ? 0 : ids.length - 1], true);
      }
    });
  });
  return ids;
}

function mark(tabs: HTMLButtonElement[], key: string, id: string, focus: boolean) {
  tabs.forEach((t) => {
    const on = t.dataset[key] === id;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    if (on && focus) t.focus();
    // On phones the workflow tabs are a swipeable strip; keep the selected one visible.
    const strip = t.parentElement;
    if (on && strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: t.offsetLeft - strip.offsetLeft - 16 });
  });
}

export function initGhlPage() {
  const sims = new Map<string, Simulator>();
  document.querySelectorAll<HTMLElement>('[data-sim]').forEach((root) => {
    const study = cases.find((c) => c.business.id === root.dataset.case);
    if (study) sims.set(`${root.dataset.case}-${root.dataset.sim}`, new Simulator(root, envFor(study)));
  });

  // Workflow tabs inside each case.
  const openAutomation = new Map<string, (id: string, focus?: boolean) => void>();
  document.querySelectorAll<HTMLElement>('[data-case-tabs]').forEach((list) => {
    const caseId = list.dataset.caseTabs!;
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[data-tab]')];
    const panels = [...document.querySelectorAll<HTMLElement>(`[data-case-panel="${caseId}"] [data-panel]`)];
    const select = (id: string, focus = false) => {
      mark(tabs, 'tab', id, focus);
      panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
      history.replaceState(null, '', `#${caseId}-${id}`);
    };
    tablist(tabs, 'tab', (id, focus) => select(id, focus));
    openAutomation.set(caseId, select);
  });

  // The case switcher.
  const caseTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-case-tab]')];
  const casePanels = [...document.querySelectorAll<HTMLElement>('[data-case-panel]')];
  const selectCase = (id: string, focus = false, hash = true) => {
    mark(caseTabs, 'caseTab', id, focus);
    casePanels.forEach((p) => (p.hidden = p.dataset.casePanel !== id));
    if (hash) history.replaceState(null, '', `#${id}`);
  };
  const caseIds = tablist(caseTabs, 'caseTab', (id, focus) => selectCase(id, focus));

  /** Resolves "#case", "#case-automation" and "#case-section" to the right view. */
  function go(target: string, scroll: boolean) {
    const caseId = caseIds.find((c) => target === c || target.startsWith(`${c}-`));
    if (!caseId) return false;
    selectCase(caseId, false, false);
    const rest = target.slice(caseId.length + 1);
    const study = cases.find((c) => c.business.id === caseId);
    if (rest && study?.automations.some((a) => a.id === rest)) openAutomation.get(caseId)?.(rest);
    else history.replaceState(null, '', `#${target}`);
    if (scroll) scrollTo(document.getElementById(target));
    return true;
  }

  document.querySelectorAll<HTMLAnchorElement>('[data-open-auto]').forEach((a) =>
    a.addEventListener('click', (e) => {
      if (go(a.dataset.openAuto!, true)) e.preventDefault();
    }),
  );
  const fromHash = () => go(decodeURIComponent(location.hash.slice(1)), true);
  window.addEventListener('hashchange', fromHash);
  fromHash();

  // Copy buttons on snippets.
  document.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const code = btn.closest('.g-snippet')?.querySelector('pre')?.textContent ?? '';
      const label = btn.querySelector('span');
      try {
        await navigator.clipboard.writeText(code);
        if (label) label.textContent = 'Copied';
      } catch {
        if (label) label.textContent = 'Select and copy';
      }
      window.setTimeout(() => label && (label.textContent = 'Copy'), 1600);
    }),
  );

  document.querySelectorAll<HTMLElement>('[data-demo]').forEach((demo) => {
    const study = cases.find((c) => c.business.id === demo.dataset.demo);
    if (study) initLandingDemo(demo, study, sims, (id) => openAutomation.get(study.business.id)?.(id));
  });
}

function initLandingDemo(demo: HTMLElement, study: CaseStudy, sims: Map<string, Simulator>, openAutomation: (id: string) => void) {
  const l = study.landing;
  const caseId = study.business.id;
  const form = demo.querySelector<HTMLFormElement>('[data-lp-form]')!;
  const thanks = demo.querySelector<HTMLElement>('[data-lp-thanks]')!;
  const error = demo.querySelector<HTMLElement>('[data-lp-error]')!;
  const captured = demo.querySelector<HTMLElement>('[data-captured]')!;
  const list = demo.querySelector<HTMLElement>('[data-captured-list]')!;
  const when = demo.querySelector<HTMLElement>('[data-captured-when]')!;
  const params = new URLSearchParams(location.search);
  const utm = { utm_source: params.get('utm_source') ?? '', utm_medium: params.get('utm_medium') ?? '', utm_campaign: params.get('utm_campaign') ?? '' };
  const sim = () => sims.get(`${caseId}-${l.feeds}`);
  let identity: Partial<Contact> | undefined;
  let start = 0;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const texts = !!data.get('sms');
    const missing: string[] = [];
    for (const f of l.fields) {
      const v = get(f.name);
      const needed = f.required || (f.maps === 'phone' && texts);
      if (needed && !v) missing.push(f.maps === 'phone' && texts && !f.required ? 'a mobile number for the texts' : f.label.toLowerCase().replace(/\?$/, ''));
      else if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) missing.push('a valid email');
    }
    if (missing.length) {
      error.textContent = `Please add ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
      error.hidden = false;
      return;
    }
    error.hidden = true;

    const fields: Record<string, string> = { sms_consent: texts ? 'Yes' : 'No', sms_marketing_consent: data.get('smsMarketing') ? 'Yes' : 'No', ...utm };
    const who: Partial<Contact> = { source: 'Website form', firstName: '', lastName: '', phone: '', email: '' };
    const rows: [string, string][] = [];
    for (const f of l.fields) {
      const v = get(f.name);
      if (typeof f.maps === 'object') fields[f.maps.field] = v;
      else who[f.maps] = v;
      rows.push([f.label.replace(/ \(.*\)$/, '').replace(/\?$/, ''), v || '(left blank)']);
    }
    identity = { ...who, fields };
    rows.push(['SMS consent (service)', fields.sms_consent], ['SMS consent (offers)', fields.sms_marketing_consent]);
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign'] as const) rows.push([k, utm[k] || '(not in the URL)']);
    list.replaceChildren(
      ...rows.map(([k, v]) => {
        const d = document.createElement('div');
        const dt = document.createElement('dt');
        const dd = document.createElement('dd');
        dt.textContent = k;
        dd.textContent = v;
        d.append(dt, dd);
        return d;
      }),
    );
    const now = new Date();
    start = ((now.getDay() + 6) % 7) * DAY + now.getHours() * 60 + now.getMinutes();
    when.textContent = `Submitted ${formatDay(start).split(',')[0]} at ${formatTime(start)}, your local time. ${texts ? 'You ticked the SMS box, so you get texts.' : 'You left the SMS box unticked, so it is email only.'}`;
    captured.hidden = false;

    demo.querySelector('[data-lp-thanks-title]')!.textContent = l.thanks.title.replace('{first}', who.firstName || 'there');
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    // On one-column layouts the next step sits below the form; bring it into view.
    if (window.matchMedia('(max-width: 900px)').matches) captured.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
  });

  demo.querySelector('[data-lp-again]')?.addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    thanks.hidden = true;
    captured.hidden = true;
    identity = undefined;
    sim()?.useContact(undefined);
  });

  demo.querySelector('[data-run-demo]')?.addEventListener('click', () => {
    const s = sim();
    if (!s || !identity) return;
    const value = demo.querySelector<HTMLInputElement>(`input[name="${caseId}-next"]:checked`)?.value;
    const behavior = l.behaviors.find((b) => b.value === value) ?? l.behaviors[0];
    const texts = identity.fields?.sms_consent === 'Yes';
    // Replies and bookings land after the first text can actually go out.
    const firstText = texts && l.textWindow ? nextWindowOpen(start, l.textWindow) - start : 0;
    s.selectScenario(behavior.scenario);
    s.useContact(identity, { start, events: behavior.events({ start, firstText }) });
    openAutomation(l.feeds);
    scrollTo(document.querySelector(`#${caseId}-${l.feeds} .gx-lab`));
    window.setTimeout(() => s.run(false), reduceMotion() ? 0 : 500);
  });
}

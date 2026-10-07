/**
 * Wires up a /ghl/ page: its case study's workflow tabs, simulators, copy
 * buttons and the landing-page demo that turns the visitor into the test
 * contact for the case's first workflow. Each case has its own page and
 * loads only its own data.
 *
 * Deep links: #roofing-speed-to-lead opens a workflow; #roofing-demo scrolls
 * to the landing page. A hash naming another case is forwarded to its page.
 */
import { loadCase } from '@/data/ghl/load';
import { formatDay, formatTime, nextWindowOpen, useWeekOf } from './engine';
import type { CaseStudy, Contact } from './types';
import { Simulator, envFor } from './ui';

const DAY = 1440;
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollTo = (el: Element | null | undefined) => el?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });

/** Moves keyboard focus to an element without scrolling it (the smooth scroll is already under way). */
function focusQuietly(el: HTMLElement | null | undefined) {
  if (!el) return;
  if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
}

/** One shared polite live region for small confirmations like "Copied". */
function announcer() {
  let el = document.getElementById('gx-announce');
  if (!el) {
    el = document.createElement('p');
    el.id = 'gx-announce';
    el.className = 'sr-only';
    el.setAttribute('role', 'status');
    document.body.append(el);
  }
  return el;
}

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
    if (on && strip && strip.scrollWidth > strip.clientWidth) {
      const pad = parseFloat(getComputedStyle(strip).scrollPaddingInlineStart) || 16;
      strip.scrollTo({ left: Math.max(0, t.offsetLeft - strip.offsetLeft - pad) });
    }
  });
}

export async function initGhlPage() {
  // Dates in the log and in messages follow the visitor's own week.
  useWeekOf(new Date());
  const panel = document.querySelector<HTMLElement>('[data-case-panel]');
  if (!panel) return;
  const caseId = panel.dataset.casePanel!;

  // The switcher links to every case's page. A hash meant for another case (an old
  // /ghl/#saas-pql-alert, say) is forwarded there before anything else happens.
  const caseLinks = new Map([...document.querySelectorAll<HTMLAnchorElement>('[data-case-link]')].map((a) => [a.dataset.caseLink!, a]));
  const forward = (target: string) => {
    const other = [...caseLinks.keys()].find((id) => id !== caseId && (target === id || target.startsWith(`${id}-`)));
    if (!other) return false;
    location.replace(`${caseLinks.get(other)!.href.split('#')[0]}#${target}`);
    return true;
  };
  if (forward(currentHash())) return;

  const study = await loadCase[caseId]?.();
  if (!study) return;
  const env = envFor(study);

  // A workflow's simulator is set up the first time its panel is shown.
  const sims = new Map<string, Simulator>();
  const getSim = (id: string) => {
    let sim = sims.get(id);
    if (!sim) {
      const root = panel.querySelector<HTMLElement>(`[data-sim="${id}"]`);
      if (!root) return undefined;
      sim = new Simulator(root, env);
      sims.set(id, sim);
    }
    return sim;
  };

  // Workflow tabs.
  const list = panel.querySelector<HTMLElement>('[data-case-tabs]');
  const tabs = [...(list?.querySelectorAll<HTMLButtonElement>('[data-tab]') ?? [])];
  const panels = [...panel.querySelectorAll<HTMLElement>('[data-panel]')];
  const openAutomation = (id: string, focus = false) => {
    mark(tabs, 'tab', id, focus);
    panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
    getSim(id);
    history.replaceState(null, '', `#${caseId}-${id}`);
  };
  tablist(tabs, 'tab', (id, focus) => openAutomation(id, focus));
  const shown = panels.find((p) => !p.hidden)?.dataset.panel;
  if (shown) getSim(shown);

  // Build-note tabs inside each workflow panel.
  panel.querySelectorAll<HTMLElement>('[data-note-tabs]').forEach((notes) => {
    const noteTabs = [...notes.querySelectorAll<HTMLButtonElement>('[data-note-tab]')];
    const notePanels = [...(notes.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-note-panel]') ?? [])];
    tablist(noteTabs, 'noteTab', (id, focus) => {
      mark(noteTabs, 'noteTab', id, focus);
      notePanels.forEach((p) => (p.hidden = p.dataset.notePanel !== id));
    });
  });

  /**
   * Resolves "#case", "#case-automation" and "#case-section" on this page.
   * With `focus`, keyboard focus follows (the workflow's heading, or the section).
   */
  function go(target: string, scroll: boolean, focus = false, instant = false) {
    if (target !== caseId && !target.startsWith(`${caseId}-`)) return false;
    const rest = target.slice(caseId.length + 1);
    const isAutomation = !!rest && study!.automations.some((a) => a.id === rest);
    if (isAutomation) openAutomation(rest);
    else history.replaceState(null, '', `#${target}`);
    const el = document.getElementById(target);
    if (scroll) el?.scrollIntoView({ behavior: instant || reduceMotion() ? 'instant' : 'smooth', block: 'start' });
    if (focus) focusQuietly(isAutomation ? el?.querySelector<HTMLElement>('[data-panel-heading]') : el);
    return true;
  }

  // Each diagram is capped to one screen; its button opens the whole thing. Short ones need no button.
  panel.querySelectorAll<HTMLButtonElement>('[data-canvas-expand]').forEach((btn) => {
    const canvas = btn.closest<HTMLElement>('.g-canvas')!;
    const body = canvas.querySelector<HTMLElement>('.g-canvas-body')!;
    btn.addEventListener('click', () => {
      const open = canvas.classList.toggle('is-expanded');
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show less' : btn.dataset.more!;
      if (!open && canvas.getBoundingClientRect().top < 0) scrollTo(canvas);
    });
    // Sizes are only known once a panel is shown, so check whenever the body's box changes.
    new ResizeObserver(() => {
      if (!canvas.classList.contains('is-expanded') && body.clientHeight > 0) btn.hidden = body.scrollHeight <= body.clientHeight + 4;
    }).observe(body);
  });

  // The decoder in the hero opens itself when a link points at it.
  document.querySelectorAll<HTMLAnchorElement>('a[href="#decoder"]').forEach((a) =>
    a.addEventListener('click', () => {
      const d = document.getElementById('decoder');
      if (d instanceof HTMLDetailsElement) d.open = true;
    }),
  );

  // Copy buttons on snippets.
  panel.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) =>
    btn.addEventListener('click', async () => {
      const code = btn.closest('.g-snippet')?.querySelector('pre')?.textContent ?? '';
      const label = btn.querySelector('span');
      try {
        await navigator.clipboard.writeText(code);
        if (label) label.textContent = 'Copied';
        announcer().textContent = 'Copied to the clipboard.';
      } catch {
        if (label) label.textContent = 'Select and copy';
        announcer().textContent = 'Copying was blocked. Select the code and copy it.';
      }
      window.setTimeout(() => label && (label.textContent = 'Copy'), 1600);
    }),
  );

  const demo = panel.querySelector<HTMLElement>('[data-demo]');
  if (demo) initLandingDemo(demo, study, getSim, openAutomation);

  // Links last, so a bad hash can never stop the rest of the page from working.
  type Saved = { y: number };
  document.querySelectorAll<HTMLAnchorElement>('[data-open-auto]').forEach((a) =>
    a.addEventListener('click', (e) => {
      const target = a.dataset.openAuto!;
      if (target !== caseId && !target.startsWith(`${caseId}-`)) return;
      e.preventDefault();
      // Remember where the reader is, then give the jump its own history entry so Back returns here.
      history.replaceState({ y: window.scrollY } satisfies Saved, '');
      if (location.hash !== `#${target}`) history.pushState(null, '', `#${target}`);
      go(target, true, true);
    }),
  );
  const fromHash = (initial = false) => {
    const target = currentHash();
    if (forward(target)) return;
    const saved = history.state as Saved | null;
    if (typeof saved?.y === 'number') {
      // Back or Forward onto a spot this page saved: put the view and the scroll back.
      go(target, false);
      history.replaceState(saved, ''); // go() may have cleared it
      window.scrollTo({ top: saved.y, behavior: 'instant' }); // html has scroll-behavior: smooth
      return;
    }
    // Arriving from another page lands on the spot at once; html's smooth scrolling is for jumps within the page.
    if (!go(target, true, false, initial) && initial && target) document.getElementById(target)?.scrollIntoView({ behavior: 'instant', block: 'start' });
  };
  window.addEventListener('hashchange', () => fromHash());
  fromHash(true);
}

/** The URL fragment, decoded when it can be. */
function currentHash() {
  const raw = location.hash.slice(1);
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw; // Not a valid escape sequence; use it as written.
  }
}

function initLandingDemo(demo: HTMLElement, study: CaseStudy, getSim: (id: string) => Simulator | undefined, openAutomation: (id: string) => void) {
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
  const sim = () => getSim(l.feeds);
  let identity: Partial<Contact> | undefined;
  let start = 0;
  let formFields: Record<string, string> = {};

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const texts = !!data.get('sms');
    const missing: string[] = [];
    const invalid: HTMLElement[] = [];
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    for (const f of l.fields) {
      const v = get(f.name);
      const input = form.elements.namedItem(f.name) as HTMLElement | null;
      const needed = f.required || (f.maps === 'phone' && texts);
      const name = f.label.replace(/ \(.*\)$/, '').replace(/\?$/, '');
      let problem = '';
      if (needed && !v) problem = f.maps === 'phone' && texts && !f.required ? 'Mobile phone (needed for the texts you asked for)' : name;
      else if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) problem = `${name} (check the address)`;
      if (problem) {
        missing.push(problem);
        if (input) {
          input.setAttribute('aria-invalid', 'true');
          invalid.push(input);
        }
      }
    }
    if (missing.length) {
      error.textContent = `Please fill in: ${missing.join(', ')}.`;
      error.hidden = false;
      invalid[0]?.focus();
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
    const utmLabels = { utm_source: 'Ad source (utm_source)', utm_medium: 'Ad type (utm_medium)', utm_campaign: 'Ad campaign (utm_campaign)' };
    for (const k of ['utm_source', 'utm_medium', 'utm_campaign'] as const) rows.push([utmLabels[k], utm[k] || 'None (no ad link)']);
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
    // The page may have been open since last week; runs are dated in the week of the submit.
    useWeekOf(now);
    start = ((now.getDay() + 6) % 7) * DAY + now.getHours() * 60 + now.getMinutes();
    formFields = fields;
    when.textContent = `Submitted ${formatDay(start).split(',')[0]} at ${formatTime(start)}, your local time. ${texts ? (l.textsNote ?? 'You ticked the SMS box, so you get texts.') : 'You left the SMS box unticked, so it is email only.'} The button below jumps to the workflow and plays it with your details.`;
    captured.hidden = false;

    demo.querySelector('[data-lp-thanks-title]')!.textContent = l.thanks.title.replace('{first}', who.firstName || 'there');
    form.hidden = true;
    thanks.hidden = false;
    // On one-column layouts the next step sits below the form: move focus there and bring it into view.
    if (window.matchMedia('(max-width: 900px)').matches) {
      focusQuietly(captured.querySelector<HTMLElement>('.gx-captured-title'));
      captured.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    } else {
      thanks.focus({ preventScroll: true });
    }
  });

  // A field's red outline goes as soon as it is fixed, and the message once nothing is left to fix.
  const clearFixed = (e: Event) => {
    const input = e.target as HTMLInputElement | HTMLSelectElement;
    const v = input.value?.trim() ?? '';
    if (input.getAttribute('aria-invalid') !== 'true' || !v || (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(v))) return;
    input.removeAttribute('aria-invalid');
    if (!form.querySelector('[aria-invalid="true"]')) error.hidden = true;
  };
  form.addEventListener('input', clearFixed);
  form.addEventListener('change', clearFixed);

  demo.querySelector('[data-lp-again]')?.addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
    form.hidden = false;
    thanks.hidden = true;
    captured.hidden = true;
    identity = undefined;
    sim()?.useContact(undefined);
    form.querySelector<HTMLElement>('input, select')?.focus();
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
    s.useContact(identity, { start, events: behavior.events({ start, firstText, texts, fields: formFields }) });
    openAutomation(l.feeds);
    const panel = document.getElementById(`${caseId}-${l.feeds}`);
    const next = panel?.querySelector('[data-override-next]');
    if (next) next.textContent = behavior.label;
    // Two columns: the diagram's title and the sample list at the top. One column: the "Running with you" line, with the controls and log under it.
    scrollTo(window.matchMedia('(max-width: 960px)').matches ? panel?.querySelector('[data-override]') : panel?.querySelector('.gx-lab'));
    focusQuietly(s.logElement);
    s.runLater(reduceMotion() ? 0 : 500);
  });
}

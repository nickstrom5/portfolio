/**
 * Wires up /airtable/: the case-study switcher, each case's automation tabs,
 * the simulators, copy buttons and the forms that send a case's first
 * automation a submission built from the visitor's own answers.
 *
 * Deep links: #events opens a case; #events-pitch-accepted opens a case and
 * one of its automations; #events-demo scrolls to a case's form.
 *
 * A case's data loads when the case is opened (or its card is hovered, or,
 * for the case shown first, its demo or workflows come near the screen), and
 * only then do its simulators and test form start.
 * The HTML carries the first case in full except its later workflows; the
 * other parts load from /airtable/parts/<case>.json when opened (src/lib/parts.ts).
 */
import { partsLoader } from '@/lib/parts';
import { loadCase } from './load-case';
import { formatDay, formatTime, previewJson, useWeekOf } from './engine';
import type { CaseStudy } from './types';
import { Simulator } from './ui';

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
  let el = document.getElementById('ax-announce');
  if (!el) {
    el = document.createElement('p');
    el.id = 'ax-announce';
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

export function initAirtablePage() {
  // Dates in the log and in messages follow the visitor's own week.
  useWeekOf(new Date());
  const sims = new Map<string, Simulator>();
  const studies = new Map<string, CaseStudy>();
  const demos = new WeakSet<HTMLElement>();
  /** Starts the simulators and demo of a case that are on the page and not yet running. */
  const start = (caseId: string) => {
    const study = studies.get(caseId);
    if (!study) return;
    document.querySelectorAll<HTMLElement>(`[data-sim][data-case="${caseId}"]`).forEach((root) => {
      const key = `${caseId}-${root.dataset.sim}`;
      if (!sims.has(key)) sims.set(key, new Simulator(root, study));
    });
    document.querySelectorAll<HTMLElement>(`[data-demo="${caseId}"]`).forEach((demo) => {
      if (demos.has(demo)) return;
      demos.add(demo);
      initDemo(demo, study, sims, (id) => openAutomation.get(caseId)?.(id));
    });
  };
  const loading = new Map<string, Promise<void>>();
  /** Loads a case's data once, then starts what of it is on the page. */
  const ensureCase = (caseId: string) => {
    if (!loading.has(caseId)) {
      loading.set(
        caseId,
        loadCase(caseId).then((study) => {
          if (!study) return;
          studies.set(caseId, study);
          start(caseId);
        }),
      );
    }
    return loading.get(caseId)!;
  };
  // Parts arrive with their own tabs, diagrams and links; wire those up, then start them once the data is in.
  const parts = partsLoader(
    (caseId) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/airtable/parts/${caseId}.json`,
    (caseId, added) => {
      added.forEach(wire);
      start(caseId);
    },
  );
  /** Jumps and tab changes bump this, so a jump still waiting on its parts can tell it was overtaken. */
  let latest = 0;

  // Workflow tabs inside each case.
  const openAutomation = new Map<string, (id: string, focus?: boolean) => void>();
  document.querySelectorAll<HTMLElement>('[data-case-tabs]').forEach((list) => {
    const caseId = list.dataset.caseTabs!;
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[data-tab]')];
    const panels = [...document.querySelectorAll<HTMLElement>(`[data-case-panel="${caseId}"] [data-panel]`)];
    const select = (id: string, focus = false) => {
      latest++;
      mark(tabs, 'tab', id, focus);
      panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
      history.replaceState(null, '', `#${caseId}-${id}`);
      void parts.need(caseId);
    };
    tablist(tabs, 'tab', (id, focus) => select(id, focus));
    openAutomation.set(caseId, select);
  });

  // The case switcher.
  const caseTabs = [...document.querySelectorAll<HTMLButtonElement>('[data-case-tab]')];
  const casePanels = [...document.querySelectorAll<HTMLElement>('[data-case-panel]')];
  const selectCase = (id: string, focus = false, hash = true) => {
    latest++;
    void ensureCase(id);
    mark(caseTabs, 'caseTab', id, focus);
    casePanels.forEach((p) => (p.hidden = p.dataset.casePanel !== id));
    if (hash) history.replaceState(null, '', `#${id}`);
    void parts.need(id);
  };
  const caseIds = tablist(caseTabs, 'caseTab', (id, focus) => selectCase(id, focus));
  // On phones the case opens below the cards, out of sight: bring its heading up after a tap.
  // Start loading a case as soon as the pointer reaches its card.
  caseTabs.forEach((t) =>
    t.addEventListener(
      'pointerenter',
      () => {
        void ensureCase(t.dataset.caseTab!);
        void parts.ensure(t.dataset.caseTab!);
      },
      { once: true },
    ),
  );
  // The case shown first loads its data as its demo or workflow tabs come within a screen of view, and its
  // later workflows as the tabs do, so both are in by the time a visitor reaches them. Other cases load when opened.
  const nearby = new IntersectionObserver(
    (entries) =>
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        nearby.unobserve(e.target);
        const el = e.target as HTMLElement;
        const caseId = el.closest<HTMLElement>('[data-case-panel]')!.dataset.casePanel!;
        void ensureCase(caseId);
        if (el.dataset.caseTabs) void parts.ensure(caseId);
      }),
    { rootMargin: '0px 0px 100% 0px' },
  );
  document.querySelectorAll('[data-case-panel] [data-demo], [data-case-tabs]').forEach((el) => nearby.observe(el));
  caseTabs.forEach((t) =>
    t.addEventListener('click', () => {
      const panel = document.getElementById(t.dataset.caseTab!);
      if (panel && panel.getBoundingClientRect().top > window.innerHeight * 0.8) scrollTo(panel);
    }),
  );

  /** Runs `then` once the parts of a case that are showing have loaded, unless another jump or tab change came first. */
  const whenReady = (caseId: string, then: () => void) => {
    const n = ++latest;
    void parts.need(caseId).then(() => n === latest && then());
  };

  /**
   * Resolves "#case", "#case-automation" and "#case-section" to the right view.
   * With `focus`, keyboard focus follows (the workflow's heading, or the section).
   * Scrolling waits for the parts that are showing, so nothing loads in above the target afterwards.
   */
  function go(target: string, scroll: boolean, focus = false) {
    const caseId = caseIds.find((c) => target === c || target.startsWith(`${c}-`));
    if (!caseId) return false;
    selectCase(caseId, false, false);
    const rest = target.slice(caseId.length + 1);
    const isAutomation = !!rest && !!document.querySelector(`[data-case-panel="${caseId}"] [data-panel="${CSS.escape(rest)}"]`);
    if (isAutomation) openAutomation.get(caseId)?.(rest);
    else history.replaceState(null, '', `#${target}`);
    const el = document.getElementById(target);
    whenReady(caseId, () => {
      if (scroll) scrollTo(el);
      if (focus) focusQuietly(isAutomation ? el?.querySelector<HTMLElement>('[data-panel-heading]') : el);
    });
    return true;
  }

  /** Wires up the build-note tabs, diagrams, copy buttons and links in the page or in a part that just loaded. */
  function wire(root: ParentNode) {
    // Build-note tabs inside each workflow panel.
    root.querySelectorAll<HTMLElement>('[data-note-tabs]').forEach((list) => {
      const tabs = [...list.querySelectorAll<HTMLButtonElement>('[data-note-tab]')];
      const panels = [...(list.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-note-panel]') ?? [])];
      tablist(tabs, 'noteTab', (id, focus) => {
        mark(tabs, 'noteTab', id, focus);
        panels.forEach((p) => (p.hidden = p.dataset.notePanel !== id));
      });
    });

    // Each diagram is capped to one screen; its button opens the whole thing. Short ones need no button.
    root.querySelectorAll<HTMLButtonElement>('[data-canvas-expand]').forEach((btn) => {
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
    root.querySelectorAll<HTMLAnchorElement>('a[href="#decoder"]').forEach((a) =>
      a.addEventListener('click', () => {
        const d = document.getElementById('decoder');
        if (d instanceof HTMLDetailsElement) d.open = true;
      }),
    );

    // Copy buttons on snippets.
    root.querySelectorAll<HTMLButtonElement>('[data-copy]').forEach((btn) =>
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

    // Links to a workflow or a part of a case.
    root.querySelectorAll<HTMLAnchorElement>('[data-open-auto]').forEach((a) =>
      a.addEventListener('click', (e) => {
        const target = a.dataset.openAuto!;
        if (!caseIds.some((c) => target === c || target.startsWith(`${c}-`))) return;
        e.preventDefault();
        // Remember where the reader is, then give the jump its own history entry so Back returns here.
        history.replaceState({ gxCase: shownCase(), y: window.scrollY } satisfies Saved, '');
        if (location.hash !== `#${target}`) history.pushState(null, '', `#${target}`);
        go(target, true, true);
      }),
    );
  }

  // Links last, so a bad hash can never stop the rest of the page from working.
  type Saved = { gxCase: string; y: number };
  const shownCase = () => casePanels.find((p) => !p.hidden)?.dataset.casePanel ?? caseIds[0];
  wire(document);
  const fromHash = () => {
    let target = location.hash.slice(1);
    try {
      target = decodeURIComponent(target);
    } catch {
      // Not a valid escape sequence; use it as written.
    }
    const saved = history.state as Saved | null;
    if (saved?.gxCase) {
      // Back or Forward onto a spot this page saved: show the same case and put the scroll back.
      if (!go(target, false)) selectCase(saved.gxCase, false, false);
      history.replaceState(saved, ''); // go() may have cleared it
      whenReady(shownCase(), () => window.scrollTo({ top: saved.y, behavior: 'instant' })); // html has scroll-behavior: smooth
      return;
    }
    go(target, true);
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

function initDemo(demo: HTMLElement, study: CaseStudy, sims: Map<string, Simulator>, openAutomation: (id: string) => void) {
  const d = study.demo;
  const caseId = study.business.id;
  const form = demo.querySelector<HTMLFormElement>('[data-lp-form]')!;
  const thanks = demo.querySelector<HTMLElement>('[data-lp-thanks]')!;
  const error = demo.querySelector<HTMLElement>('[data-lp-error]')!;
  const captured = demo.querySelector<HTMLElement>('[data-captured]')!;
  const json = demo.querySelector<HTMLElement>('[data-captured-json]')!;
  const when = demo.querySelector<HTMLElement>('[data-captured-when]')!;
  const sim = () => sims.get(`${caseId}-${d.feeds}`);
  let record: ReturnType<typeof d.toRecord> | undefined;
  let answers: Record<string, string> = {};
  let start = 0;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const missing: string[] = [];
    const invalid: HTMLElement[] = [];
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    for (const f of d.fields) {
      const v = get(f.name);
      let problem = '';
      if (f.required && !v) problem = f.label;
      else if (f.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) problem = `${f.label} (check the address)`;
      else if (f.type === 'number' && v && !(Number(v) >= 0)) problem = `${f.label} (a number)`;
      if (problem) {
        missing.push(problem);
        const input = form.elements.namedItem(f.name) as HTMLElement | null;
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
    answers = Object.fromEntries(d.fields.map((f) => [f.name, get(f.name)]));
    const now = new Date();
    // The page may have been open since last week; runs are dated in the week of the submit.
    useWeekOf(now);
    start = ((now.getDay() + 6) % 7) * DAY + now.getHours() * 60 + now.getMinutes();
    record = d.toRecord(answers);
    json.textContent = previewJson(record);
    when.textContent = `Sent ${formatDay(start * 60000).split(',')[0]} at ${formatTime(start * 60000)}, your local time. The button below jumps to the automation and runs it on this record.`;
    captured.hidden = false;
    form.hidden = true;
    thanks.hidden = false;
    if (window.matchMedia('(max-width: 900px)').matches) {
      focusQuietly(captured.querySelector<HTMLElement>('.gx-captured-title'));
      captured.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    } else {
      thanks.focus({ preventScroll: true });
    }
  });

  // A field's red outline goes as soon as it is fixed, and the message once nothing is left to fix.
  const clearFixed = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const v = input.value?.trim() ?? '';
    if (input.getAttribute('aria-invalid') !== 'true' || !v || (input.type === 'email' && !/^\S+@\S+\.\S+$/.test(v))) return;
    input.removeAttribute('aria-invalid');
    if (!form.querySelector('[aria-invalid="true"]')) error.hidden = true;
  };
  form.addEventListener('input', clearFixed);
  form.addEventListener('change', clearFixed);

  demo.querySelector('[data-lp-again]')?.addEventListener('click', () => {
    form.reset();
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    form.hidden = false;
    thanks.hidden = true;
    captured.hidden = true;
    record = undefined;
    sim()?.useEvent(undefined);
    form.querySelector<HTMLElement>('input, select, textarea')?.focus();
  });

  demo.querySelector('[data-run-demo]')?.addEventListener('click', () => {
    const s = sim();
    if (!s || !record) return;
    const value = demo.querySelector<HTMLInputElement>(`input[name="${caseId}-next"]:checked`)?.value;
    const b = d.behaviors.find((x) => x.value === value) ?? d.behaviors[0];
    s.useEvent({ start, form: record, setup: b.setup?.(answers), failures: b.failures }, b.label);
    openAutomation(d.feeds);
    const panel = document.getElementById(`${caseId}-${d.feeds}`);
    scrollTo(window.matchMedia('(max-width: 960px)').matches ? panel?.querySelector('[data-override]') : panel?.querySelector('.gx-lab'));
    focusQuietly(s.logElement);
    s.runLater(reduceMotion() ? 0 : 500);
  });
}

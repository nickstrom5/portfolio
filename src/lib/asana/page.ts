/**
 * Wires up /asana/: the case switcher, each case's project and view tabs,
 * automation tabs, build-note tabs, the simulators and the intake-form
 * demos that turn the visitor's answers into a task.
 *
 * Deep links: #marketing opens a case; #marketing-request-triage opens a
 * case and one of its automations; #marketing-form scrolls to a section.
 *
 * A case's data loads when the case is opened (or its card is hovered, or,
 * for the case shown first, its form or automations come near the screen),
 * and only then do its simulators and form demo start. The HTML carries the
 * first case in full except its later automations; the other parts load from
 * /asana/parts/<case>.json when opened (src/lib/parts.ts).
 */
import { partsLoader } from '@/lib/parts';
import { loadCase } from './load-case';
import { DAY, formatDay, simulate } from './engine';
import type { CaseStudy, Scenario } from './types';
import { Simulator, el, logLine, peopleOf, plain, renderTask } from './ui';

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const scrollTo = (el: Element | null | undefined) => el?.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });

function focusQuietly(el: HTMLElement | null | undefined) {
  if (!el) return;
  if (!el.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(el.tagName)) el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
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
    const strip = t.parentElement;
    if (on && strip && strip.scrollWidth > strip.clientWidth) strip.scrollTo({ left: Math.max(0, t.offsetLeft - strip.offsetLeft - 16) });
  });
}

/** A simple tab group: buttons with data-<key>, panels with data-<panelKey>, inside `scope`. */
function group(scope: ParentNode, tabSel: string, key: string, panels: HTMLElement[], panelKey: string) {
  const tabs = [...scope.querySelectorAll<HTMLButtonElement>(tabSel)];
  tablist(tabs, key, (id, focus) => {
    mark(tabs, key, id, focus);
    panels.forEach((p) => (p.hidden = p.dataset[panelKey] !== id));
  });
}

export function initAsanaPage() {
  const studies = new Map<string, CaseStudy>();
  const started = new WeakSet<HTMLElement>();
  /** Starts the simulators and form demo of a case that are on the page and not yet running. */
  const start = (caseId: string) => {
    const study = studies.get(caseId);
    if (!study) return;
    document.querySelectorAll<HTMLElement>(`[data-sim][data-case="${caseId}"], [data-form-demo="${caseId}"]`).forEach((root) => {
      if (started.has(root)) return;
      started.add(root);
      if (root.dataset.sim) new Simulator(root, study);
      else initFormDemo(root, study);
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
  // Parts arrive with their own tabs, cards and galleries; wire those up, then start them once the data is in.
  const parts = partsLoader(
    (caseId) => `${import.meta.env.BASE_URL.replace(/\/$/, '')}/asana/parts/${caseId}.json`,
    (caseId, added) => {
      added.forEach(wire);
      start(caseId);
    },
  );
  /** Jumps and tab changes bump this, so a jump still waiting on its parts can tell it was overtaken. */
  let latest = 0;

  // Automation tabs inside each case.
  const openAutomation = new Map<string, (id: string, focus?: boolean) => void>();
  document.querySelectorAll<HTMLElement>('[data-case-tabs]').forEach((list) => {
    const caseId = list.dataset.caseTabs!;
    const tabs = [...list.querySelectorAll<HTMLButtonElement>('[data-tab]')];
    const panels = [...document.querySelectorAll<HTMLElement>(`[data-case-panel="${caseId}"] [data-panel]`)];
    const select = (id: string, focus = false) => {
      latest++;
      mark(tabs, 'tab', id, focus);
      panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
      history.replaceState(history.state, '', `#${caseId}-${id}`);
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
  // The case shown first loads its data as its form or automation tabs come within a screen of view, and its
  // later automations as the tabs do, so both are in by the time a visitor reaches them. Other cases load when opened.
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
  document.querySelectorAll('[data-case-panel] [data-form-demo], [data-case-tabs]').forEach((el) => nearby.observe(el));
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
   * Scrolling waits for the parts that are showing, so nothing loads in above the target afterwards.
   */
  function go(target: string, scroll: boolean, focus = false) {
    const caseId = caseIds.find((c) => target === c || target.startsWith(`${c}-`));
    if (!caseId) return false;
    selectCase(caseId, false, false);
    const rest = target.slice(caseId.length + 1);
    const isAutomation = !!rest && !!document.querySelector(`[data-case-panel="${caseId}"] [data-panel="${CSS.escape(rest)}"]`);
    if (isAutomation) openAutomation.get(caseId)?.(rest);
    else history.replaceState(history.state, '', `#${target}`);
    const dest = document.getElementById(target);
    whenReady(caseId, () => {
      if (scroll) scrollTo(dest);
      if (focus) focusQuietly(isAutomation ? dest?.querySelector<HTMLElement>('[data-panel-heading]') : dest);
    });
    return true;
  }

  /** `root` itself if it matches, plus whatever inside it does. */
  const within = (root: ParentNode, sel: string) => [...(root instanceof Element && root.matches(sel) ? [root as HTMLElement] : []), ...root.querySelectorAll<HTMLElement>(sel)];

  /** Wires up the tabs, builder cards, galleries and decoder links in the page or in a part that just loaded. */
  function wire(root: ParentNode) {
    // Build-note tabs.
    root.querySelectorAll<HTMLElement>('[data-note-tabs]').forEach((list) => {
      group(list, '[data-note-tab]', 'noteTab', [...(list.parentElement?.querySelectorAll<HTMLElement>(':scope > [data-note-panel]') ?? [])], 'notePanel');
    });

    // Project tabs, and each project's view tabs.
    within(root, '[data-projects]').forEach((wrap) => {
      group(wrap.querySelector('.a-proj-tabs')!, '[data-proj-tab]', 'projTab', [...wrap.querySelectorAll<HTMLElement>(':scope > [data-proj]')], 'proj');
      wrap.querySelectorAll<HTMLElement>(':scope > [data-proj]').forEach((proj) => {
        group(proj.querySelector('.a-view-tabs')!, '[data-view-tab]', 'viewTab', [...proj.querySelectorAll<HTMLElement>(':scope > [data-view]')], 'view');
      });
    });

    // Each builder card is capped to one screen; its button opens the whole thing. Short ones need no button.
    root.querySelectorAll<HTMLButtonElement>('[data-canvas-expand]').forEach((btn) => {
      const canvas = btn.closest<HTMLElement>('.g-canvas')!;
      const body = canvas.querySelector<HTMLElement>('.g-canvas-body')!;
      btn.addEventListener('click', () => {
        const open = canvas.classList.toggle('is-expanded');
        btn.setAttribute('aria-expanded', String(open));
        btn.textContent = open ? 'Show less' : btn.dataset.more!;
        if (!open && canvas.getBoundingClientRect().top < 0) scrollTo(canvas);
      });
      new ResizeObserver(() => {
        if (!canvas.classList.contains('is-expanded') && body.clientHeight > 0) btn.hidden = body.scrollHeight <= body.clientHeight + 4;
      }).observe(body);
    });

    // Screenshot galleries: a thumbnail opens its full-size copy in the gallery's dialog.
    within(root, '[data-gallery]').forEach((gallery) => {
      const dialog = gallery.querySelector<HTMLDialogElement>('[data-lightbox]')!;
      const img = dialog.querySelector<HTMLImageElement>('[data-lightbox-img]')!;
      const caption = dialog.querySelector<HTMLElement>('[data-lightbox-caption]')!;
      let opener: HTMLElement | null = null;
      gallery.querySelectorAll<HTMLButtonElement>('[data-shot]').forEach((btn) =>
        btn.addEventListener('click', () => {
          opener = btn;
          img.src = btn.dataset.shot!;
          img.alt = btn.dataset.shotAlt ?? '';
          caption.textContent = btn.dataset.shotCaption ?? '';
          dialog.showModal();
        }),
      );
      dialog.querySelector('[data-lightbox-close]')?.addEventListener('click', () => dialog.close());
      // A click on the backdrop (the dialog itself, outside its content) closes it too.
      dialog.addEventListener('click', (e) => {
        if (e.target === dialog) dialog.close();
      });
      dialog.addEventListener('close', () => opener?.focus());
    });

    root.querySelectorAll<HTMLAnchorElement>('a[href="#decoder"]').forEach((a) =>
      a.addEventListener('click', () => {
        const d = document.getElementById('decoder');
        if (d instanceof HTMLDetailsElement) d.open = true;
      }),
    );
  }

  wire(document);

  // In-page links that open a case or an automation. Delegated, so links the form demo adds work too.
  document.addEventListener('click', (e) => {
    const a = (e.target as Element | null)?.closest<HTMLAnchorElement>('a[data-open-auto]');
    if (!a) return;
    const target = a.dataset.openAuto!;
    if (!caseIds.some((c) => target === c || target.startsWith(`${c}-`))) return;
    e.preventDefault();
    if (location.hash !== `#${target}`) history.pushState(null, '', `#${target}`);
    go(target, true, true);
  });
  const fromHash = () => {
    let target = location.hash.slice(1);
    try {
      target = decodeURIComponent(target);
    } catch {
      // Not a valid escape sequence; use it as written.
    }
    go(target, true);
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();
}

function initFormDemo(demo: HTMLElement, study: CaseStudy) {
  const f = study.form;
  const form = demo.querySelector<HTMLFormElement>('[data-form]')!;
  const thanks = demo.querySelector<HTMLElement>('[data-form-thanks]')!;
  const error = demo.querySelector<HTMLElement>('[data-form-error]')!;
  const result = demo.querySelector<HTMLElement>('[data-form-result]')!;
  const announce = demo.querySelector<HTMLElement>('[data-form-announce]');
  const questions = [...form.querySelectorAll<HTMLElement>('[data-q]')];

  // Form branching: a follow-up question shows only for the answers it belongs to.
  const branch = () =>
    questions.forEach((q) => {
      if (!q.dataset.showIf) return;
      const rule = JSON.parse(q.dataset.showIf) as { question: string; is: string[] };
      const v = (form.elements.namedItem(rule.question) as HTMLSelectElement | null)?.value ?? '';
      q.hidden = !rule.is.includes(v);
    });
  form.addEventListener('change', branch);
  branch();

  form.addEventListener('input', (e) => {
    const input = e.target as HTMLElement;
    if (input.getAttribute('aria-invalid') === 'true' && (input as HTMLInputElement).value.trim()) input.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const missing: string[] = [];
    const invalid: HTMLElement[] = [];
    form.querySelectorAll('[aria-invalid]').forEach((x) => x.removeAttribute('aria-invalid'));
    for (const q of f.questions) {
      const wrap = questions.find((w) => w.dataset.q === q.name);
      if (wrap?.hidden) continue;
      const v = get(q.name);
      let problem = '';
      if (q.required && !v) problem = q.label.replace(/\?$/, '');
      else if (q.type === 'email' && v && !/^\S+@\S+\.\S+$/.test(v)) problem = `${q.label} (check the address)`;
      if (problem) {
        missing.push(problem);
        const input = form.elements.namedItem(q.name) as HTMLElement | null;
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

    // The task Asana would make: name from the title question, answers in mapped fields.
    const people = { ...peopleOf(study), you: { name: '' } };
    const fields: Record<string, string> = {};
    let name = 'New request';
    for (const q of f.questions) {
      const wrap = questions.find((w) => w.dataset.q === q.name);
      const v = get(q.name);
      if (wrap?.hidden || !v) continue;
      if (q.maps === 'title') name = v;
      else if (q.maps === 'requester') people.you.name = v;
      else if (q.maps && typeof q.maps === 'object') fields[q.maps.field] = v;
    }
    const now = new Date();
    const start = ((now.getDay() + 6) % 7) * DAY + now.getHours() * 60 + now.getMinutes();
    const scenario: Scenario = { id: 'you', label: 'Your submission', summary: '', start, submitted: true, task: { name, section: f.section, assignee: f.defaultAssignee, requester: people.you.name ? 'you' : undefined, collaborators: people.you.name ? ['you'] : [], fields }, events: [], expect: {} };
    const trace = simulate(study.automations, scenario, f.project, people);

    renderTask(demo.querySelector<HTMLElement>('[data-form-record]')!, trace.task, people);
    const log = demo.querySelector<HTMLOListElement>('[data-form-log]')!;
    log.replaceChildren(el('li', 'g-day', `${formatDay(start)} (your local time)`), ...trace.steps.map((s) => logLine(s)));
    const first = study.automations.find((a) => trace.fired.includes(a.id));
    const link = demo.querySelector<HTMLElement>('[data-form-open]')!;
    link.replaceChildren();
    if (first) {
      const a = el('a', undefined, `See ${first.number} · ${first.name} in the builder, with more sample tasks →`);
      a.href = `#${study.org.id}-${first.id}`;
      a.dataset.openAuto = `${study.org.id}-${first.id}`;
      link.append(a);
    }
    result.hidden = false;
    const text = plain(trace, people);
    if (announce) announce.textContent = `Submitted. ${text}`;

    const first_ = people.you.name.split(' ')[0] || 'there';
    demo.querySelector('[data-thanks-text]')!.textContent = f.confirmation.replace('{first}', first_);
    form.hidden = true;
    thanks.hidden = false;
    if (window.matchMedia('(max-width: 900px)').matches) {
      focusQuietly(result.querySelector<HTMLElement>('.gx-captured-title'));
      result.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'start' });
    } else thanks.focus({ preventScroll: true });
  });

  demo.querySelector('[data-form-again]')?.addEventListener('click', () => {
    form.reset();
    branch();
    form.hidden = false;
    thanks.hidden = true;
    result.hidden = true;
    form.querySelector<HTMLElement>('input, select')?.focus();
  });
}

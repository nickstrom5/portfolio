/**
 * Browser side of /asana/: plays a simulated run step by step, ticks the
 * builder card, keeps the task card in sync and writes the run history.
 * The log and record reuse the g-* styles from /ghl/.
 */
import { DAY, approvalLabel, formatClock, formatDay, formatDue, formatDuration, formatTime, simulate, startTask, type People, type Trace, type TraceStep } from './engine';
import type { Automation, CaseStudy, Task } from './types';

const STEP_MS = 480;

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export const peopleOf = (study: CaseStudy): People => Object.fromEntries(study.org.team.map((p) => [p.key, { name: p.name }]));

/** One run-history line, with its comment, Slack post or new task drawn like the GHL log's messages. */
export function logLine(step: TraceStep, focusAuto?: string): HTMLLIElement {
  const kind = step.kind === 'auto' ? 'trigger' : step.kind === 'path' || step.kind === 'nopath' ? 'branch' : step.kind === 'event' || step.kind === 'start' ? 'event' : step.kind === 'end' ? 'end' : 'action';
  const li = el('li', `g-li k-${kind}${focusAuto && step.auto && step.auto !== focusAuto ? ' a-other' : ''}`);
  const body = el('div');
  body.append(el('span', 'g-li-title', step.title));
  if (step.detail) body.append(el('span', 'g-li-detail', step.detail));
  const m = step.message;
  if (m) {
    const box = el('div', 'g-note');
    box.append(el('span', 'g-note-to', m.kind === 'slack' ? `Slack · ${m.to}` : m.kind === 'task' ? `New task · ${m.to}` : `Comment${m.by ? ` · ${m.by}` : ''}`));
    box.append(document.createTextNode(m.body));
    body.append(box);
  }
  li.append(el('time', undefined, formatTime(step.t)), body);
  return li;
}

/** The task as a record card: section, assignee, due date, fields, subtasks, collaborators. */
export function renderTask(target: HTMLElement, t: Task, people: People, prev?: Task) {
  const name = (k?: string) => (k ? (people[k]?.name ?? k) : 'Unassigned');
  const head = el('div', 'g-rec-head');
  const av = el('span', 'g-avatar', t.completed ? '✓' : (t.assignee ? name(t.assignee).split(' ').map((w) => w[0]).join('') : '–'));
  av.setAttribute('aria-hidden', 'true');
  const who = el('div');
  who.append(el('strong', undefined, t.name), el('span', undefined, `${t.project}${t.alsoIn.length ? ` · also in ${t.alsoIn.join(', ')}` : ''}`));
  head.append(av, who);
  const grid = el('dl', 'g-rec-grid');
  const row = (label: string, value: string, changed: boolean) => {
    const d = el('div');
    const dd = el('dd', undefined, value);
    if (changed) {
      dd.classList.add('is-new');
      window.setTimeout(() => dd.classList.remove('is-new'), 900);
    }
    d.append(el('dt', undefined, label), dd);
    grid.append(d);
  };
  row('Section', t.section, !!prev && prev.section !== t.section);
  row('Assignee', name(t.assignee), !!prev && prev.assignee !== t.assignee);
  row('Due date', formatDue(t.due), !!prev && prev.due !== t.due);
  row('Status', t.approval ? `Approval · ${approvalLabel[t.approval]}` : t.completed ? 'Complete' : 'Open', !!prev && (prev.completed !== t.completed || prev.approval !== t.approval));
  if (t.requester) row('Requested by', name(t.requester), false);
  for (const [k, v] of Object.entries(t.fields)) row(k, String(v), !!prev && prev.fields[k] !== v);
  if (t.collaborators.length) row('Collaborators', t.collaborators.map(name).join(', '), !!prev && prev.collaborators.length !== t.collaborators.length);
  const subTitle = el('p', 'g-rec-title', `Subtasks (${t.subtasks.length})`);
  const subs = el('ul', 'g-rec-tags a-subs');
  if (!t.subtasks.length) subs.append(el('li', 'g-none', 'No subtasks'));
  t.subtasks.forEach((s, i) => {
    const li = el('li', s.done ? 'is-done' : undefined, `${s.done ? '✓ ' : ''}${s.name}${s.assignee ? ` · ${name(s.assignee).split(' ')[0]}` : ''}`);
    if (prev && i >= prev.subtasks.length) {
      li.classList.add('is-new');
      window.setTimeout(() => li.classList.remove('is-new'), 900);
    }
    subs.append(li);
  });
  const extra = el('p', 'g-rec-title', `Comments: ${t.comments.length}`);
  target.replaceChildren(head, grid, subTitle, subs, extra);
}

/** The run in one or two plain sentences, for readers who won't read the log. */
export function plain(trace: Trace, people: People, auto?: Automation): string {
  const runs = trace.fired.length;
  const own = auto ? trace.fired.filter((f) => f === auto.id).length : runs;
  const others = [...new Set(trace.fired.filter((f) => f !== auto?.id))].length;
  const acts = trace.steps.filter((s) => s.kind === 'action').length;
  const t = trace.task;
  const who = t.assignee ? (people[t.assignee]?.name ?? t.assignee) : 'nobody';
  const path = auto ? trace.paths.filter((p) => p.startsWith(`${auto.id}:`)).map((p) => auto.automation.paths?.find((x) => `${auto.id}:${x.id}` === p)?.label) : [];
  return [
    auto ? (own ? `${auto.number} · ${auto.name} ran ${own === 1 ? 'once' : `${own} times`}${path.length ? `, taking the ${[...new Set(path)].join(' then ')} path` : ', and no path matched, so it did nothing more'}.` : `${auto.number} · ${auto.name} never ran: nothing happened that starts it.`) : `${runs} automation ${runs === 1 ? 'run' : 'runs'}.`,
    others ? `${others} other ${others === 1 ? 'automation' : 'automations'} in the project ran too.` : '',
    `${acts} ${acts === 1 ? 'action' : 'actions'} in all.`,
    `The task ends in ${t.section}, ${t.completed ? 'complete' : 'open'}, with ${who}${t.due !== undefined ? `, due ${formatDue(t.due)}` : ''}.`,
    trace.created.length ? `New ${trace.created.length === 1 ? 'task' : 'tasks'}: ${trace.created.map((c) => `“${c.name}”`).join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
}

export class Simulator {
  private root: HTMLElement;
  private canvas: HTMLElement | null;
  private auto: Automation;
  private study: CaseStudy;
  private people: People;
  private log: HTMLOListElement;
  private clock: HTMLElement;
  private elapsed: HTMLElement;
  private record: HTMLElement;
  private outcome: HTMLElement;
  private announce: HTMLElement | null;
  private recDot: HTMLElement | null;
  private timer: number | undefined;
  private prev: Task | undefined;
  private lastDay = -1;

  constructor(root: HTMLElement, study: CaseStudy) {
    this.root = root;
    this.study = study;
    this.people = peopleOf(study);
    const id = root.dataset.sim!;
    this.auto = study.automations.find((a) => a.id === id)!;
    this.canvas = document.querySelector<HTMLElement>(`[data-canvas="${root.dataset.case}:${id}"]`);
    this.log = root.querySelector('[data-log]')!;
    this.clock = root.querySelector('[data-clock]')!;
    this.elapsed = root.querySelector('[data-elapsed]')!;
    this.record = root.querySelector('[data-record]')!;
    this.outcome = root.querySelector('[data-outcome]')!;
    this.announce = root.querySelector('[data-announce]');
    this.recDot = root.querySelector('[data-rec-dot]');

    const views = [...root.querySelectorAll<HTMLButtonElement>('[data-view]')];
    const show = (v: string, focus: boolean) => {
      views.forEach((b) => {
        const on = b.dataset.view === v;
        b.setAttribute('aria-selected', String(on));
        b.tabIndex = on ? 0 : -1;
        if (on && focus) b.focus();
      });
      root.querySelectorAll<HTMLElement>('[data-view-panel]').forEach((p) => (p.hidden = p.dataset.viewPanel !== v));
      if (v === 'record' && this.recDot) this.recDot.hidden = true;
    };
    views.forEach((b, i) => {
      b.addEventListener('click', () => show(b.dataset.view!, false));
      b.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        show(views[(i + 1) % views.length].dataset.view!, true);
      });
    });
    root.querySelector('[data-run]')?.addEventListener('click', () => this.run(false));
    root.querySelector('[data-instant]')?.addEventListener('click', () => this.run(true));
    root.querySelector('[data-reset]')?.addEventListener('click', () => this.reset());
    root.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) => r.addEventListener('change', () => this.reset()));
    this.reset();
  }

  private get scenario() {
    const checked = this.root.querySelector<HTMLInputElement>('input[type=radio]:checked');
    return this.auto.scenarios.find((x) => x.id === checked?.value) ?? this.auto.scenarios[0];
  }

  private stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = undefined;
  }

  reset() {
    this.stop();
    this.log.replaceChildren(el('li', 'g-log-empty', 'Pick a sample task above, then press Run automation. Each line is one thing that happens, with its time: what people do to the task, which automations run, and every action they take. Days in between are fast-forwarded.'));
    const s = this.scenario;
    this.clock.textContent = formatClock(s.start);
    this.elapsed.textContent = 'Not started';
    this.outcome.hidden = true;
    this.lastDay = -1;
    this.prev = undefined;
    renderTask(this.record, startTask(s, this.auto.automation.project), this.people);
    if (this.recDot) this.recDot.hidden = true;
    if (this.announce) this.announce.textContent = '';
    this.clearCanvas();
  }

  private clearCanvas() {
    if (!this.canvas?.matches('.is-running, .is-ran')) return;
    const body = this.canvas.querySelector<HTMLElement>('.g-canvas-body');
    if (body) body.scrollTop = 0;
    this.canvas.classList.remove('is-running', 'is-ran');
    this.canvas.querySelectorAll('.is-done, .is-active, .is-taken, .is-dim').forEach((n) => n.classList.remove('is-done', 'is-active', 'is-taken', 'is-dim'));
  }

  run(instant: boolean) {
    this.reset();
    const trace = simulate(this.study.automations, this.scenario, this.auto.automation.project, this.people);
    this.log.replaceChildren();
    this.canvas?.classList.add('is-running');
    if (this.announce) this.announce.textContent = `Running ${this.auto.name}: ${this.scenario.label}.`;
    if (instant || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      trace.steps.forEach((s) => this.apply(s, trace, false));
      return this.finish(trace);
    }
    let i = 0;
    const tick = () => {
      this.apply(trace.steps[i], trace, true);
      i++;
      if (i < trace.steps.length) this.timer = window.setTimeout(tick, STEP_MS);
      else this.finish(trace);
    };
    tick();
  }

  private apply(step: TraceStep, trace: Trace, animate: boolean) {
    const day = Math.floor(step.t / DAY);
    if (day !== this.lastDay) {
      this.log.append(el('li', 'g-day', formatDay(step.t)));
      this.lastDay = day;
    }
    this.log.append(logLine(step, this.auto.id));
    this.log.scrollTop = this.log.scrollHeight;
    this.clock.textContent = formatClock(step.t);
    this.elapsed.textContent = step.t === trace.start ? 'Start' : `+${formatDuration(step.t - trace.start)}`;
    const changed = animate && this.prev && JSON.stringify(this.prev) !== JSON.stringify(step.task);
    if (changed && this.recDot && this.record.parentElement?.hidden) this.recDot.hidden = false;
    renderTask(this.record, step.task, this.people, animate ? this.prev : undefined);
    this.prev = step.task;
    this.markCanvas(step);
  }

  private markCanvas(step: TraceStep) {
    const c = this.canvas;
    if (!c) return;
    c.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    if (step.auto !== this.auto.id) return;
    if (step.node) {
      const node = c.querySelector<HTMLElement>(`[data-node="${CSS.escape(step.node)}"]`);
      node?.classList.add('is-done', 'is-active');
      if (step.node !== 'trigger') this.scrollCanvas(node);
    }
    if (step.branch) {
      c.querySelector('[data-node="check"]')?.classList.add('is-done');
      const branch = c.querySelector<HTMLElement>(`[data-branch="${CSS.escape(step.branch)}"]`);
      if (!branch) return;
      branch.classList.add('is-taken');
      branch.classList.remove('is-dim');
      branch.parentElement?.querySelectorAll<HTMLElement>(':scope > .g-branch').forEach((b) => {
        if (b !== branch && !b.classList.contains('is-taken')) b.classList.add('is-dim');
      });
    }
    if (step.kind === 'nopath') {
      c.querySelector('[data-node="check"]')?.classList.add('is-done');
      c.querySelectorAll<HTMLElement>('.g-branch:not(.is-taken)').forEach((b) => b.classList.add('is-dim'));
    }
  }

  private scrollCanvas(node: HTMLElement | null) {
    const body = this.canvas?.querySelector<HTMLElement>('.g-canvas-body');
    if (!node || !body || body.scrollHeight <= body.clientHeight + 4) return;
    const top = node.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3;
    body.scrollTo({ top: Math.max(0, top) });
  }

  private finish(trace: Trace) {
    this.stop();
    this.canvas?.classList.remove('is-running');
    this.canvas?.classList.add('is-ran');
    this.canvas?.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    const text = plain(trace, this.people, this.auto);
    const p = el('span', 'g-outcome-plain');
    p.append(el('strong', undefined, 'What happened: '), document.createTextNode(text));
    const tech = el('span', 'g-outcome-tech');
    tech.append(el('strong', undefined, 'Run complete'), document.createTextNode(` · ${trace.steps.filter((s) => s.kind === 'action').length} actions · ${trace.end > trace.start ? `over ${formatDuration(trace.end - trace.start)}` : 'all at once'}`));
    this.outcome.replaceChildren(p, tech);
    this.outcome.hidden = false;
    if (this.announce) this.announce.textContent = text;
  }
}

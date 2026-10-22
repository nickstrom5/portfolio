/**
 * Browser side of /clickup/: plays a simulated run step by step, ticks the
 * Automation cards, keeps the task view in sync and writes the activity log.
 */
import { formatClock, formatDay, formatDuration, formatTime, isFinished, namesOf, simulate, startTask, type Names, type Trace, type TraceStep } from './engine';
import type { CaseStudy, FieldValue, Process, Scenario, Task, Workspace } from './types';

const STEP_MS = 480;
type Override = { name?: string; fields?: Record<string, FieldValue> };

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export class Simulator {
  private root: HTMLElement;
  private canvas: HTMLElement | null;
  private proc: Process;
  private ws: Workspace;
  private names: Names;
  private log: HTMLOListElement;
  private clock: HTMLElement;
  private elapsed: HTMLElement;
  private record: HTMLElement;
  private outcome: HTMLElement;
  private runBtn: HTMLButtonElement;
  private announce: HTMLElement | null;
  private recDot: HTMLElement | null;
  private timer: number | undefined;
  private override: Override | undefined;
  private prev: Task | undefined;
  private lastDay = -1;

  constructor(root: HTMLElement, study: CaseStudy) {
    this.root = root;
    this.ws = study.workspace;
    this.names = namesOf(study.workspace);
    const id = root.dataset.sim!;
    this.proc = study.processes.find((p) => p.id === id)!;
    this.canvas = document.querySelector<HTMLElement>(`[data-canvas="${root.dataset.case}:${id}"]`);
    this.log = root.querySelector('[data-log]')!;
    this.clock = root.querySelector('[data-clock]')!;
    this.elapsed = root.querySelector('[data-elapsed]')!;
    this.record = root.querySelector('[data-record]')!;
    this.outcome = root.querySelector('[data-outcome]')!;
    this.runBtn = root.querySelector('[data-run]')!;
    this.announce = root.querySelector('[data-announce]');
    this.recDot = root.querySelector('[data-rec-dot]');

    // Activity / task tabs.
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

    this.runBtn.addEventListener('click', () => {
      this.run(false);
      this.showScreen();
    });
    root.querySelector('[data-instant]')?.addEventListener('click', () => {
      this.run(true);
      this.showScreen();
    });
    root.querySelector('[data-reset]')?.addEventListener('click', () => this.reset());
    root.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) => r.addEventListener('change', () => this.useTask(undefined)));
    root.querySelector('[data-clear-override]')?.addEventListener('click', () => {
      this.useTask(undefined);
      this.runBtn.focus();
    });
    this.reset();
  }

  runLater(ms: number) {
    this.stop();
    if (ms <= 0) return this.run(false);
    this.timer = window.setTimeout(() => this.run(false), ms);
  }

  get logElement() {
    return this.log;
  }

  get scenario(): Scenario {
    const checked = this.root.querySelector<HTMLInputElement>('input[type=radio]:checked');
    return this.proc.scenarios.find((x) => x.id === checked?.value) ?? this.proc.scenarios[0];
  }

  selectScenario(id: string) {
    const input = this.root.querySelector<HTMLInputElement>(`input[type=radio][value="${id}"]`);
    if (input) input.checked = true;
  }

  /** Runs with the visitor's Form answers in place of the sample task's name and fields. */
  useTask(o: Override | undefined) {
    this.override = o;
    const note = this.root.querySelector<HTMLElement>('[data-override]');
    if (note) {
      note.hidden = !o;
      const name = note.querySelector('[data-override-name]');
      if (name && o) name.textContent = `“${o.name ?? ''}”`;
    }
    this.reset();
  }

  private stop() {
    if (this.timer) window.clearTimeout(this.timer);
    this.timer = undefined;
    this.root.classList.remove('is-running');
  }

  reset() {
    this.stop();
    this.log.replaceChildren(el('li', 'g-log-empty', 'Pick a sample task above, then press Run it. Each line is one change, with the time it would happen: what people do, which Automation fires, and each Action it takes. Days are fast-forwarded.'));
    const s = this.scenario;
    this.clock.textContent = formatClock(s.start);
    this.elapsed.textContent = 'Not started';
    this.outcome.hidden = true;
    this.lastDay = -1;
    this.prev = undefined;
    this.renderTask(startTask(this.proc, s, this.override), false);
    this.clearCanvas();
    if (this.recDot) this.recDot.hidden = true;
    if (this.announce) this.announce.textContent = '';
  }

  private showScreen() {
    if (!window.matchMedia('(max-width: 960px)').matches) return;
    const screen = this.root.querySelector<HTMLElement>('.g-screen');
    if (screen && screen.getBoundingClientRect().top > window.innerHeight * 0.55) screen.scrollIntoView({ block: 'start', behavior: reduce() ? 'auto' : 'smooth' });
  }

  private clearCanvas() {
    if (!this.canvas?.matches('.is-running, .is-ran')) return;
    const body = this.canvas.querySelector<HTMLElement>('.g-canvas-body');
    if (body) body.scrollTop = 0;
    this.canvas.classList.remove('is-running', 'is-ran');
    this.canvas.querySelectorAll('.is-done, .is-active, .is-skipped').forEach((n) => n.classList.remove('is-done', 'is-active', 'is-skipped'));
  }

  run(instant: boolean) {
    this.stop();
    this.reset();
    const trace = simulate(this.proc, this.scenario, this.ws, this.override);
    this.log.replaceChildren();
    this.canvas?.classList.add('is-running');
    this.root.classList.add('is-running');
    if (this.announce) this.announce.textContent = `Running ${this.proc.name}: ${this.scenario.label}.`;
    if (instant || reduce()) {
      trace.steps.forEach((s) => this.apply(s, trace, false));
      this.finish(trace);
      return;
    }
    let i = 0;
    const tick = () => {
      const s = trace.steps[i];
      this.apply(s, trace, true);
      i++;
      if (i < trace.steps.length) this.timer = window.setTimeout(tick, s.kind === 'event' ? STEP_MS * 1.4 : STEP_MS);
      else this.finish(trace);
    };
    tick();
  }

  private apply(step: TraceStep, trace: Trace, animate: boolean) {
    const day = Math.floor(step.t / 1440);
    if (day !== this.lastDay) {
      this.log.append(el('li', 'g-day', formatDay(step.t)));
      this.lastDay = day;
    }
    const li = el('li', `g-li k-${step.kind}`);
    const body = el('div');
    body.append(el('span', 'g-li-title', step.title));
    if (step.detail) body.append(el('span', 'g-li-detail', step.detail));
    if (step.message) {
      const m = step.message;
      const box = el('div', m.kind === 'comment' && m.from !== 'ClickUp Automation' ? 'g-mail in' : 'g-note');
      box.append(el('span', 'g-note-to', m.kind === 'comment' ? `Comment${m.from && m.from !== 'ClickUp Automation' ? ` · ${m.from}` : ' · posted by the Automation'}` : m.kind === 'chat' ? `Chat · ${m.from}` : `Webhook POST · ${m.from}`));
      if (m.kind === 'webhook') {
        const pre = el('pre', 'cu-payload', m.body);
        box.append(pre);
      } else box.append(document.createTextNode(m.body));
      body.append(box);
    }
    li.append(el('time', undefined, formatTime(step.t)), body);
    this.log.append(li);
    this.log.scrollTop = this.log.scrollHeight;

    this.clock.textContent = formatClock(step.t);
    this.elapsed.textContent = step.t === trace.start ? 'Start' : `+${formatDuration(step.t - trace.start)}`;
    this.renderTask(step.task, animate);
    this.markCanvas(step);
  }

  private markCanvas(step: TraceStep) {
    const c = this.canvas;
    if (!c) return;
    c.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    if (!step.auto) return;
    const node = c.querySelector<HTMLElement>(`[data-node="${step.auto}"]`);
    if (!node) return;
    if (step.kind === 'skip') {
      if (!node.classList.contains('is-done')) node.classList.add('is-skipped');
    } else {
      node.classList.remove('is-skipped');
      node.classList.add('is-done');
    }
    node.classList.add('is-active');
    const body = c.querySelector<HTMLElement>('.g-canvas-body');
    if (body && body.scrollHeight > body.clientHeight + 4) {
      const top = node.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 4;
      body.scrollTo({ top: Math.max(0, top), behavior: c.classList.contains('is-running') && !reduce() ? 'smooth' : 'auto' });
    }
  }

  private finish(trace: Trace) {
    this.stop();
    this.canvas?.classList.remove('is-running');
    this.canvas?.classList.add('is-ran');
    this.canvas?.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    const fired = new Set(trace.fired);
    const blocked = new Set(trace.blocked.filter((b) => !fired.has(b)));
    const actions = trace.steps.filter((s) => s.kind === 'action').length;
    const t = trace.task;
    const label = isFinished(this.proc, t.status) ? `Finished in ${t.status}` : `Still open in ${t.status}`;
    const parts = [
      `${fired.size} of ${this.proc.automations.length} Automations fired`,
      `${actions} Action${actions === 1 ? '' : 's'}`,
      blocked.size ? `${blocked.size} stopped by Conditions` : '',
      `ran ${trace.end > trace.start ? formatDuration(trace.end - trace.start) : 'under a minute'}`,
    ].filter(Boolean);
    const plain = el('span', 'g-outcome-plain');
    plain.append(el('strong', undefined, 'What happened: '), document.createTextNode(this.plain(trace)));
    const tech = el('span', 'g-outcome-tech');
    tech.append(el('strong', undefined, label), document.createTextNode(` · ${parts.join(' · ')}`));
    this.outcome.replaceChildren(plain, tech);
    this.outcome.hidden = false;
    const col = this.root.closest<HTMLElement>('.gx-lab-sim');
    if (col) {
      const visBottom = Math.min(col.getBoundingClientRect().bottom, window.innerHeight);
      const over = this.outcome.getBoundingClientRect().bottom - visBottom;
      if (over > 0) col.scrollTop += over + 8;
    }
    if (this.announce) this.announce.textContent = `${this.plain(trace)} ${label}.`;
  }

  /** The run in a sentence or two, for readers who will not read the log. */
  private plain(trace: Trace): string {
    const t = trace.task;
    const people = trace.steps.filter((s) => s.kind === 'event' && !s.outside).length - 1;
    const comments = trace.steps.filter((s) => s.kind === 'action' && s.message?.kind === 'comment').length;
    const chats = trace.steps.filter((s) => s.message?.kind === 'chat').length;
    const fired = [...new Set(trace.fired)].map((id) => this.proc.automations.find((a) => a.id === id)?.name).filter(Boolean) as string[];
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    return [
      people > 0 ? `People made ${n(people, 'change', 'changes')} by hand; ` : 'Nobody touched the task by hand; ',
      fired.length ? `the Automations did the rest (${fired.join('; ')}).` : 'no Automation fired.',
      comments || chats ? ` They posted ${[comments && n(comments, 'comment', 'comments'), chats && n(chats, 'Chat message', 'Chat messages')].filter(Boolean).join(' and ')}.` : '',
      ` The task ends in ${t.status}${t.assignees.length ? `, assigned to ${t.assignees.map((k) => this.names[k] ?? k).join(', ')}` : ''}${t.priority ? `, priority ${t.priority}` : ''}.`,
    ].join('');
  }

  private renderTask(t: Task, animate: boolean) {
    const prev = this.prev;
    const changed = (a: unknown, b: unknown) => animate && prev !== undefined && JSON.stringify(a) !== JSON.stringify(b);
    const status = this.proc.statuses.find((s) => s.name === t.status);
    const head = el('div', 'g-rec-head cu-rec-head');
    const chip = el('span', 'cu-status-chip', t.status);
    chip.style.setProperty('--st', status?.color ?? '#87909e');
    const who = el('div');
    who.append(el('strong', undefined, t.name), el('span', undefined, [t.list, ...t.alsoIn].join(' · also in ')));
    head.append(who, chip);

    const grid = el('dl', 'g-rec-grid');
    const name = (k: string) => this.names[k] ?? k;
    const row = (label: string, value: string, was: unknown, now: unknown) => {
      const d = el('div');
      const dd = el('dd', undefined, value);
      if (changed(was, now)) {
        if (this.recDot) this.recDot.hidden = !this.record.parentElement?.hidden;
        dd.classList.add('is-new');
        window.setTimeout(() => dd.classList.remove('is-new'), 900);
      }
      d.append(el('dt', undefined, label), dd);
      grid.append(d);
    };
    row('Status', t.status, prev?.status, t.status);
    row('Assignees', t.assignees.length ? t.assignees.map(name).join(', ') : 'Unassigned', prev?.assignees, t.assignees);
    row('Priority', t.priority ?? 'None', prev?.priority, t.priority);
    row('Due date', t.due !== undefined ? formatDay(t.due) : 'None', prev?.due, t.due);
    if (t.start !== undefined || prev?.start !== undefined) row('Start date', t.start !== undefined ? formatDay(t.start) : 'None', prev?.start, t.start);
    if (t.followers.length) row('Followers', t.followers.map(name).join(', '), prev?.followers, t.followers);
    if (t.estimate !== undefined) row('Time estimate', formatDuration(t.estimate), prev?.estimate, t.estimate);
    if (t.tracked) row('Time tracked', formatDuration(t.tracked), prev?.tracked, t.tracked);
    if (t.sprint) row('Sprint', t.sprint, prev?.sprint, t.sprint);
    if (t.shared.length) row('Shared with', t.shared.map((s) => `${name(s.who)} (${s.permission})`).join(', '), prev?.shared, t.shared);
    for (const f of this.proc.fields) {
      const v = t.fields[f.name];
      if (v === undefined || v === '') continue;
      row(f.name, f.type === 'People' && typeof v === 'string' ? name(v) : String(v), prev?.fields[f.name], v);
    }
    const parts: HTMLElement[] = [head, grid];
    const items = (title: string, list: { name: string; done: boolean }[], was: { name: string; done: boolean }[] | undefined) => {
      if (!list.length) return;
      parts.push(el('p', 'g-rec-title', `${title} (${list.filter((x) => x.done).length}/${list.length})`));
      const ul = el('ul', 'cu-rec-items');
      for (const x of list) {
        const li = el('li', x.done ? 'is-checked' : undefined, x.name);
        const before = was?.find((y) => y.name === x.name);
        if (animate && prev && (!before || before.done !== x.done)) {
          li.classList.add('is-new');
          window.setTimeout(() => li.classList.remove('is-new'), 900);
        }
        ul.append(li);
      }
      parts.push(ul);
    };
    items('Subtasks', t.subtasks, prev?.subtasks);
    items('Checklist', t.checklist, prev?.checklist);
    items('Waiting on', t.waitingOn, prev?.waitingOn);
    if (t.links.length) {
      parts.push(el('p', 'g-rec-title', 'Linked tasks'));
      const ul = el('ul', 'cu-rec-items cu-rec-links');
      t.links.forEach((l) => ul.append(el('li', undefined, l)));
      parts.push(ul);
    }
    parts.push(el('p', 'g-rec-title', 'Tags'));
    const tags = el('ul', 'g-rec-tags');
    if (!t.tags.length) tags.append(el('li', 'g-none', 'No tags'));
    for (const tag of t.tags) {
      const li = el('li', undefined, tag);
      if (animate && prev && !prev.tags.includes(tag)) {
        if (this.recDot) this.recDot.hidden = !this.record.parentElement?.hidden;
        li.classList.add('is-new');
        window.setTimeout(() => li.classList.remove('is-new'), 900);
      }
      tags.append(li);
    }
    parts.push(tags);
    if (t.archived) parts.push(el('p', 'cu-archived', 'Archived'));
    this.record.replaceChildren(...parts);
    this.prev = JSON.parse(JSON.stringify(t));
  }
}

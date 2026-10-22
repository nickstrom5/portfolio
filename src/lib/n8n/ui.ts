/**
 * Browser side of /n8n/: plays a simulated execution node by node, marks the
 * path and item counts on the canvas, writes the log and the executions list.
 */
import { simulate, formatClock, formatDay, formatDuration, formatTime, previewJson, type Trace, type TraceStep } from './engine';
import type { Automation, CaseStudy, Message, Scenario } from './types';

const STEP_MS = 480;
const MIN = 60000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Log classes from ghl.css, plus n8n's error and retry lines. */
const KIND: Record<TraceStep['kind'], string> = {
  trigger: 'k-trigger',
  node: 'k-action',
  retry: 'k-hold',
  error: 'k-error',
  split: 'k-branch',
  empty: 'k-skip',
  wait: 'k-wait',
  resume: 'k-wait',
  handoff: 'k-goal',
  end: 'k-end',
};

/** A one-off test event from the case's form, in place of a sample one. */
export type Override = Pick<Scenario, 'input' | 'fixtures' | 'failures' | 'start'>;

export class Simulator {
  private root: HTMLElement;
  private canvas: HTMLElement | null;
  private auto: Automation;
  private study: CaseStudy;
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
  private lastDay = -1;

  constructor(root: HTMLElement, study: CaseStudy) {
    this.root = root;
    this.study = study;
    const id = root.dataset.sim!;
    this.auto = study.automations.find((a) => a.id === id)!;
    this.canvas = document.querySelector<HTMLElement>(`[data-canvas="${root.dataset.case}:${id}"]`);
    this.log = root.querySelector('[data-log]')!;
    this.clock = root.querySelector('[data-clock]')!;
    this.elapsed = root.querySelector('[data-elapsed]')!;
    this.record = root.querySelector('[data-record]')!;
    this.outcome = root.querySelector('[data-outcome]')!;
    this.runBtn = root.querySelector('[data-run]')!;
    this.announce = root.querySelector('[data-announce]');
    this.recDot = root.querySelector('[data-rec-dot]');

    // Execution / Executions list tabs.
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
    root.querySelectorAll<HTMLInputElement>('input[type=radio]').forEach((r) => r.addEventListener('change', () => this.useEvent(undefined)));
    root.querySelector('[data-clear-override]')?.addEventListener('click', () => {
      this.useEvent(undefined);
      this.runBtn.focus();
    });
    this.reset();
  }

  /** Starts an animated run after a delay; any reset or new run cancels it. */
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
    const s = this.auto.scenarios.find((x) => x.id === checked?.value) ?? this.auto.scenarios[0];
    return this.override ? { ...s, id: 'yours', label: 'Your form', resume: {}, fixtures: {}, failures: undefined, ...this.override } : s;
  }

  /** Runs with a test event built from the case's form instead of a sample one. */
  useEvent(o: Override | undefined, label?: string) {
    this.override = o;
    const note = this.root.querySelector<HTMLElement>('[data-override]');
    if (note) {
      note.hidden = !o;
      const next = note.querySelector('[data-override-next]');
      if (next && label) next.textContent = label;
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
    this.log.replaceChildren(el('li', 'g-log-empty', this.root.dataset.empty ?? ''));
    this.clock.textContent = formatClock(this.scenario.start * MIN);
    this.elapsed.textContent = 'Not started';
    this.outcome.hidden = true;
    this.lastDay = -1;
    this.record.replaceChildren(el('p', 'g-log-empty', 'No executions yet. Run the workflow to add one.'));
    this.clearCanvas();
    if (this.recDot) this.recDot.hidden = true;
    if (this.announce) this.announce.textContent = '';
  }

  /** On one-column layouts the log sits below the controls: bring it up so Execute visibly does something. */
  private showScreen() {
    if (!window.matchMedia('(max-width: 960px)').matches) return;
    const screen = this.root.querySelector<HTMLElement>('.g-screen');
    if (screen && screen.getBoundingClientRect().top > window.innerHeight * 0.55) screen.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  private clearCanvas() {
    if (!this.canvas?.matches('.is-running, .is-ran')) return;
    const body = this.canvas.querySelector<HTMLElement>('.g-canvas-body');
    if (body) body.scrollTop = 0;
    this.canvas.classList.remove('is-running', 'is-ran');
    this.canvas.querySelectorAll('.is-done, .is-active, .is-skipped, .is-error, .is-taken, .is-dim').forEach((n) => n.classList.remove('is-done', 'is-active', 'is-skipped', 'is-error', 'is-taken', 'is-dim'));
    this.canvas.querySelectorAll('[data-items]').forEach((n) => n.removeAttribute('data-items'));
  }

  run(instant: boolean) {
    this.stop();
    this.reset();
    const trace = simulate(this.study, this.auto, this.scenario);
    this.log.replaceChildren();
    this.canvas?.classList.add('is-running');
    this.root.classList.add('is-running');
    if (this.announce) this.announce.textContent = `Executing ${this.auto.name}: ${this.scenario.label}.`;
    if (instant || reduceMotion()) {
      trace.steps.forEach((s) => this.apply(s, trace));
      this.finish(trace);
      return;
    }
    let i = 0;
    const tick = () => {
      const s = trace.steps[i];
      this.apply(s, trace);
      i++;
      if (i < trace.steps.length) this.timer = window.setTimeout(tick, s.kind === 'wait' || s.kind === 'retry' ? STEP_MS * 1.5 : STEP_MS);
      else this.finish(trace);
    };
    tick();
  }

  private apply(step: TraceStep, trace: Trace) {
    const day = Math.floor(step.t / (1440 * MIN));
    if (day !== this.lastDay) {
      this.log.append(el('li', 'g-day', formatDay(step.t)));
      this.lastDay = day;
    }
    const li = el('li', `g-li ${KIND[step.kind]}${step.workflow ? ' is-sub' : ''}`);
    const time = el('time', undefined, formatTime(step.t, true));
    const body = el('div');
    if (step.workflow) body.append(el('span', 'n-sub-label', step.workflow));
    body.append(el('span', 'g-li-title', step.title));
    if (step.detail) body.append(el('span', 'g-li-detail', step.detail));
    for (const m of step.messages ?? []) body.append(this.renderMessage(m));
    if (step.items && step.items.length && step.kind !== 'split') {
      const d = el('details', 'n-out');
      d.append(el('summary', undefined, `Output: ${step.items.length} item${step.items.length === 1 ? '' : 's'}`), el('pre', 'n-json', previewJson(step.items)));
      body.append(d);
    }
    li.append(time, body);
    this.log.append(li);
    this.log.scrollTop = this.log.scrollHeight;
    this.clock.textContent = formatClock(step.t);
    this.elapsed.textContent = step.t === trace.start ? 'Start' : `+${formatDuration(step.t - trace.start)}`;
    if (!step.workflow) this.markCanvas(step, trace);
  }

  private renderMessage(m: Message): HTMLElement {
    if (m.channel === 'sms') return el('div', 'g-bubble out', m.body);
    if (m.channel === 'email') {
      const box = el('div', 'g-mail');
      box.append(el('span', 'g-note-to', `Email to ${m.to}`));
      if (m.subject) box.append(el('span', 'g-mail-subj', m.subject));
      box.append(document.createTextNode(m.body));
      return box;
    }
    const box = el('div', `g-note${m.channel === 'http' ? ' n-http' : ''}`);
    const label = m.channel === 'slack' ? `Slack · ${m.to}` : m.channel === 'http' ? `Response to ${m.to}` : m.to;
    box.append(el('span', 'g-note-to', label));
    if (m.subject) box.append(el('span', 'g-mail-subj', m.subject));
    box.append(document.createTextNode(m.body));
    return box;
  }

  private markCanvas(step: TraceStep, trace: Trace) {
    const c = this.canvas;
    if (!c) return;
    c.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    if (step.branch) {
      c.querySelector<HTMLElement>(`[data-branch="${step.branch}"]`)?.classList.add('is-taken');
      return;
    }
    if (!step.nodeId) return;
    const node = c.querySelector<HTMLElement>(`[data-node="${step.nodeId}"]`);
    if (!node) return;
    if (step.kind === 'empty') node.classList.add('is-skipped');
    else if (step.kind === 'error' && trace.counts[step.nodeId] === undefined) node.classList.add('is-error');
    else if (step.kind !== 'retry' && step.kind !== 'wait') node.classList.add('is-done');
    if (step.kind === 'retry') node.classList.add('is-error');
    if (step.kind !== 'retry' && step.kind !== 'error' && trace.counts[step.nodeId] !== undefined) node.classList.remove('is-error');
    const n = trace.counts[step.nodeId];
    // On the card itself, since a pseudo-element's attr() reads its own element.
    const card = node.querySelector<HTMLElement>(':scope > .g-card');
    if (card && n !== undefined && step.kind !== 'empty' && step.kind !== 'wait') card.dataset.items = `${n} item${n === 1 ? '' : 's'}`;
    node.classList.add('is-active');
    // The diagram is capped to one screen: scroll it, never the page, so the active node stays in view.
    const body = c.querySelector<HTMLElement>('.g-canvas-body');
    if (body && body.scrollHeight > body.clientHeight + 4) {
      const top = node.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3;
      body.scrollTo({ top: Math.max(0, top), behavior: c.classList.contains('is-running') && !reduceMotion() ? 'smooth' : 'auto' });
    }
  }

  private finish(trace: Trace) {
    this.stop();
    const c = this.canvas;
    c?.classList.remove('is-running');
    c?.classList.add('is-ran');
    c?.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    // Outputs that never carried an item fade, whatever their neighbours did: n8n can run several.
    c?.querySelectorAll<HTMLElement>('.g-branch').forEach((b) => b.classList.toggle('is-dim', !b.classList.contains('is-taken')));

    const label = trace.status === 'success' ? 'Execution succeeded' : `Execution failed at ${trace.error?.node}`;
    const handler = trace.executions.length > 1;
    const parts = [
      `ran in ${formatDuration(trace.executions[0].end - trace.start)}`,
      `${trace.visited.filter((v) => !v.includes(':')).length} nodes ran`,
      trace.skipped.length ? `${new Set(trace.skipped).size} did not run` : '',
      handler ? `error workflow ran (execution ${trace.executions[1].id})` : '',
    ].filter(Boolean);
    const plain = el('span', 'g-outcome-plain');
    plain.append(el('strong', undefined, 'What happened: '), document.createTextNode(this.plain(trace)));
    const tech = el('span', 'g-outcome-tech');
    tech.append(el('strong', undefined, label), document.createTextNode(` · ${parts.join(' · ')}`));
    this.outcome.replaceChildren(plain, tech);
    this.outcome.hidden = false;
    this.outcome.classList.toggle('is-error', trace.status === 'error');
    this.renderExecutions(trace);
    if (this.recDot && this.record.parentElement?.hidden) this.recDot.hidden = false;
    const col = this.root.closest<HTMLElement>('.gx-lab-sim');
    if (col) {
      const visBottom = Math.min(col.getBoundingClientRect().bottom, window.innerHeight);
      const over = this.outcome.getBoundingClientRect().bottom - visBottom;
      if (over > 0) col.scrollTop += over + 8;
    }
    if (this.announce) this.announce.textContent = `${this.plain(trace)} ${label}.`;
  }

  /** The run in two or three plain sentences, for readers who will not read the log. */
  private plain(trace: Trace): string {
    const main = trace.steps.filter((s) => !s.workflow);
    const msgs = main.flatMap((s) => s.messages ?? []);
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    const count = (ch: Message['channel']) => msgs.filter((m) => m.channel === ch).length;
    const got = [
      count('email') && n(count('email'), 'email', 'emails'),
      count('slack') && n(count('slack'), 'Slack message', 'Slack messages'),
      count('task') && n(count('task'), 'task or record', 'tasks or records'),
      count('http') && n(count('http'), 'HTTP response', 'HTTP responses'),
    ].filter(Boolean) as string[];
    const waited = main.filter((s) => s.kind === 'wait').length;
    const retries = main.filter((s) => s.kind === 'retry').length;
    // A failure the run survived: an error output, or a node set to Continue.
    const errOut = (trace.status === 'success' && main.some((s) => s.kind === 'error')) || main.some((s) => s.kind === 'node' && /Error output/.test(s.detail ?? ''));
    const empty = main.find((s) => s.kind === 'empty');
    const handler = trace.steps.filter((s) => s.workflow);
    const handlerMsgs = handler.flatMap((s) => s.messages ?? []).length;
    return [
      got.length ? `It sent ${got.join(', ')}.` : 'It sent nothing anyone reads.',
      waited ? `It waited ${n(waited, 'time', 'times')}, saved in the database meanwhile, and finished ${formatDuration(trace.executions[0].end - trace.start)} after it started.` : '',
      retries ? `${n(retries, 'call failed and was', 'calls failed and were')} tried again.` : '',
      errOut ? 'One call failed, and the workflow carried on around it instead of stopping.' : '',
      empty && trace.status === 'success' ? `${empty.title.split(':')[0]} got no items, so it and what follows did not run, as designed.` : '',
      trace.status === 'error' ? `It stopped at ${trace.error?.node} (${trace.error?.message}) and was saved as Error.` : 'The execution succeeded.',
      handler.length ? `The error workflow then ran and sent ${n(handlerMsgs, 'alert', 'alerts')}${handlerMsgs ? ' with a link to the failed execution' : ''}.` : '',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private renderExecutions(trace: Trace) {
    const table = el('table', 'gx-table n-execs');
    const cap = el('caption', 'sr-only', 'Executions');
    const head = el('thead');
    const hr = el('tr');
    for (const h of ['Workflow', 'Status', 'Started', 'Run time', 'ID']) {
      const th = el('th', undefined, h);
      th.scope = 'col';
      hr.append(th);
    }
    head.append(hr);
    const tbody = el('tbody');
    for (const x of [...trace.executions].reverse()) {
      const tr = el('tr');
      const st = el('td');
      st.append(el('span', `n-status n-${x.status}`, x.status === 'success' ? 'Success' : 'Error'));
      tr.append(el('td', undefined, x.workflow), st, el('td', undefined, formatClock(x.start)), el('td', undefined, formatDuration(x.end - x.start)), el('td', undefined, `#${x.id}`));
      tbody.append(tr);
    }
    table.append(cap, head, tbody);
    const wrap = el('div', 'gx-table-wrap');
    wrap.append(table);
    const note = el('p', 'n-execs-note', trace.executions.length > 1 ? 'Newest first. The error workflow’s execution is its own row, started by the failure below it.' : 'This execution as it would appear in the workflow’s Executions tab.');
    this.record.replaceChildren(wrap, note);
  }
}

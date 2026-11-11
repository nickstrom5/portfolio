/**
 * Browser side of /zapier/: plays a simulated Zap run step by step, ticks off
 * steps in the editor, writes the run log with what each step did in the
 * connected apps and whether it used a task, and fills in Zap history.
 */
import { simulate, formatClock, formatDay, formatDuration, formatTime, previewJson, type Trace, type TraceStep } from './engine';
import type { CaseStudy, Effect, Message, RunStatus, Scenario, Zap } from './types';

const STEP_MS = 520;
const MIN = 60000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const count = (k: number, one: string, many = `${one}s`) => `${k} ${k === 1 ? one : many}`;

/** Log classes from ghl.css and n8n.css. */
const KIND: Record<TraceStep['kind'], string> = {
  event: 'k-hold',
  trigger: 'k-trigger',
  action: 'k-action',
  filter: 'k-branch',
  stop: 'k-stop',
  paths: 'k-branch',
  path: 'k-branch',
  skip: 'k-skip',
  delay: 'k-wait',
  loop: 'k-branch',
  iteration: 'k-branch',
  error: 'k-error',
  replay: 'k-wait',
  handler: 'k-branch',
  notify: 'k-error',
  end: 'k-end',
};

/** Status pill classes from n8n.css and zapier.css. */
const STATUS: Record<RunStatus, string> = {
  Successful: 'n-success',
  Filtered: 'z-quiet',
  'Safely halted': 'z-quiet',
  'Handled error': 'z-handled',
  Errored: 'n-error',
};

/** A one-off test event from the case's form, in place of a sample one. */
export type Override = Pick<Scenario, 'trigger' | 'world' | 'fixtures' | 'failures' | 'start'>;

export function renderEffects(effects: Effect[], open = false): HTMLDetailsElement {
  const d = el('details', 'n-out z-effects');
  d.open = open;
  d.append(el('summary', undefined, `In your apps: ${count(effects.length, 'change')}`));
  const ul = el('ul', 'z-effect-list');
  for (const e of effects) {
    const li = el('li');
    li.append(el('span', 'z-effect-what', `${e.app} · ${e.what} · ${e.name}`));
    const fields = Object.entries(e.fields ?? {});
    if (fields.length) {
      const dl = el('dl');
      for (const [k, v] of fields) {
        const row = el('div');
        row.append(el('dt', undefined, k), el('dd', undefined, v || '(empty)'));
        dl.append(row);
      }
      li.append(dl);
    }
    ul.append(li);
  }
  d.append(ul);
  return d;
}

export class Simulator {
  private root: HTMLElement;
  private editor: HTMLElement | null;
  private zap: Zap;
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
    this.zap = study.zaps.find((z) => z.id === id)!;
    this.editor = document.querySelector<HTMLElement>(`[data-canvas="${root.dataset.case}:${id}"]`);
    this.log = root.querySelector('[data-log]')!;
    this.clock = root.querySelector('[data-clock]')!;
    this.elapsed = root.querySelector('[data-elapsed]')!;
    this.record = root.querySelector('[data-record]')!;
    this.outcome = root.querySelector('[data-outcome]')!;
    this.runBtn = root.querySelector('[data-run]')!;
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
    const s = this.zap.scenarios.find((x) => x.id === checked?.value) ?? this.zap.scenarios[0];
    return this.override ? { ...s, id: 'yours', label: 'Your form', event: 'You send the form', world: undefined, fixtures: {}, failures: undefined, ...this.override } : s;
  }

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
    this.record.replaceChildren(el('p', 'g-log-empty', 'No runs yet. Run the Zap to add one.'));
    this.clearEditor();
    if (this.recDot) this.recDot.hidden = true;
    if (this.announce) this.announce.textContent = '';
  }

  private showScreen() {
    if (!window.matchMedia('(max-width: 960px)').matches) return;
    const screen = this.root.querySelector<HTMLElement>('.g-screen');
    if (screen && screen.getBoundingClientRect().top > window.innerHeight * 0.55) screen.scrollIntoView({ block: 'start', behavior: reduceMotion() ? 'auto' : 'smooth' });
  }

  private clearEditor() {
    if (!this.editor?.matches('.is-running, .is-ran')) return;
    const body = this.editor.querySelector<HTMLElement>('.g-canvas-body');
    if (body) body.scrollTop = 0;
    this.editor.classList.remove('is-running', 'is-ran');
    this.editor.querySelectorAll('.is-done, .is-active, .is-skipped, .is-error, .is-taken, .is-dim').forEach((n) => n.classList.remove('is-done', 'is-active', 'is-skipped', 'is-error', 'is-taken', 'is-dim'));
  }

  run(instant: boolean) {
    this.stop();
    this.reset();
    let trace: Trace;
    try {
      trace = simulate(this.study, this.zap, this.scenario);
    } catch (e) {
      this.log.replaceChildren(el('li', 'g-log-empty', `This run could not start: ${(e as Error).message}`));
      return;
    }
    this.log.replaceChildren();
    this.editor?.classList.add('is-running');
    this.root.classList.add('is-running');
    if (this.announce) this.announce.textContent = `Running ${this.zap.name}: ${this.scenario.label}.`;
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
      if (i < trace.steps.length) this.timer = window.setTimeout(tick, s.kind === 'error' ? STEP_MS * 1.5 : STEP_MS);
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
    const li = el('li', `g-li ${KIND[step.kind]}`);
    const time = el('time', undefined, formatTime(step.t, true));
    const body = el('div');
    const title = el('span', 'g-li-title', step.title);
    if (step.kind === 'action') title.append(el('span', `z-task${step.task ? '' : ' z-free'}`, step.task ? '1 task' : 'No task'));
    body.append(title);
    if (step.detail) body.append(el('span', 'g-li-detail', step.detail));
    for (const m of step.messages ?? []) body.append(this.renderMessage(m));
    if (step.effects?.length) body.append(renderEffects(step.effects));
    if (step.output && Object.keys(step.output).length) {
      const d = el('details', 'n-out');
      d.append(el('summary', undefined, step.kind === 'trigger' ? 'Trigger data' : 'Output'), el('pre', 'n-json', previewJson(step.output)));
      body.append(d);
    }
    li.append(time, body);
    this.log.append(li);
    this.log.scrollTop = this.log.scrollHeight;
    this.clock.textContent = formatClock(step.t);
    this.elapsed.textContent = step.t === trace.start ? 'Start' : `+${formatDuration(step.t - trace.start)}`;
    this.markEditor(step);
  }

  private renderMessage(m: Message): HTMLElement {
    if (m.channel === 'email') {
      const box = el('div', 'g-mail');
      box.append(el('span', 'g-note-to', `Email to ${m.to}`));
      if (m.subject) box.append(el('span', 'g-mail-subj', m.subject));
      box.append(document.createTextNode(m.body));
      return box;
    }
    const box = el('div', 'g-note');
    box.append(el('span', 'g-note-to', m.channel === 'sms' ? `Text to ${m.to}` : `Slack · ${m.to}`));
    box.append(document.createTextNode(m.body));
    return box;
  }

  private markEditor(step: TraceStep) {
    const c = this.editor;
    if (!c) return;
    c.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    const target = step.kind === 'trigger' ? c.querySelector<HTMLElement>('[data-node="trigger"]') : step.stepId ? c.querySelector<HTMLElement>(`[data-node="${step.stepId}"]`) : null;
    if (step.branch) c.querySelector<HTMLElement>(`[data-branch="${step.branch}"]`)?.classList.add('is-taken');
    if (!target) return;
    if (step.kind === 'skip' || step.kind === 'stop') target.classList.add('is-skipped');
    else if (step.kind === 'error') target.classList.add('is-error');
    else {
      // A step Autoreplay recovers is no longer in error.
      if (step.kind === 'action') target.classList.remove('is-error');
      target.classList.add('is-done');
    }
    target.classList.add('is-active');
    const body = c.querySelector<HTMLElement>('.g-canvas-body');
    if (body && body.scrollHeight > body.clientHeight + 4) {
      const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3;
      body.scrollTo({ top: Math.max(0, top), behavior: c.classList.contains('is-running') && !reduceMotion() ? 'smooth' : 'auto' });
    }
  }

  /** "Run ended · Filtered", or for a loop "3 runs: 2 Successful, 1 Filtered". */
  private headline(trace: Trace): string {
    if (trace.runs.length === 1) return `Run ended · ${trace.status}`;
    const by = new Map<RunStatus, number>();
    trace.runs.forEach((r) => by.set(r.status, (by.get(r.status) ?? 0) + 1));
    return `${trace.runs.length} runs: ${[...by].map(([s, k]) => `${k} ${s}`).join(', ')}`;
  }

  private finish(trace: Trace) {
    this.stop();
    const c = this.editor;
    c?.classList.remove('is-running');
    c?.classList.add('is-ran');
    c?.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    c?.querySelectorAll<HTMLElement>('.g-branch').forEach((b) => b.classList.toggle('is-dim', !b.classList.contains('is-taken')));

    const label = this.headline(trace);
    const parts = [`took ${formatDuration(trace.end - trace.start)}`, `${count(trace.tasks, 'task')} used`, `${count(trace.effects.length, 'change')} in your apps`];
    const plain = el('span', 'g-outcome-plain');
    plain.append(el('strong', undefined, 'What happened: '), document.createTextNode(this.plain(trace)));
    const tech = el('span', 'g-outcome-tech');
    tech.append(el('strong', undefined, label), document.createTextNode(` · ${parts.join(' · ')}`));
    this.outcome.replaceChildren(plain, tech);
    this.outcome.hidden = false;
    this.outcome.classList.toggle('is-error', trace.status === 'Errored');
    this.renderHistory(trace);
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
    const msgs = trace.steps.flatMap((s) => s.messages ?? []);
    const emails = msgs.filter((m) => m.channel === 'email').length;
    const slack = msgs.filter((m) => m.channel === 'slack').length;
    const texts = msgs.filter((m) => m.channel === 'sms').length;
    const sent = [emails && count(emails, 'email'), slack && count(slack, 'Slack message'), texts && count(texts, 'text')].filter(Boolean) as string[];
    const paths = trace.steps.filter((s) => s.kind === 'path').map((s) => `“${s.title.replace('Path · ', '')}”`);
    const loop = trace.runs.length > 1 || trace.steps.some((s) => s.kind === 'iteration');
    const has = (k: TraceStep['kind']) => trace.steps.some((s) => s.kind === k);
    const end: Record<RunStatus, string> = {
      Successful: 'The run was Successful.',
      Filtered: 'A filter’s rules were not met, so the run stopped there on purpose (Filtered). Nobody is told, and that is the point.',
      'Safely halted': 'A search found nothing, so the run stopped there on purpose (Safely halted). It is not an error.',
      'Handled error': 'A step errored and its error handler dealt with it, so nothing was dropped (Handled error).',
      Errored: `It errored at ${trace.error?.step}, kept what the earlier steps did, and Zapier emailed ${this.zap.owner}.`,
    };
    return [
      sent.length ? `It sent ${sent.join(', ').replace(/, ([^,]*)$/, ' and $1')}.` : 'It sent nothing anyone reads.',
      trace.effects.length ? `It made ${count(trace.effects.length, 'change')} in the connected apps.` : '',
      !loop && paths.length ? `Paths took ${paths.join(' and ')}.` : '',
      has('replay') && trace.status !== 'Errored' ? 'One step failed the first time; Autoreplay tried it again 5 minutes later and it worked.' : '',
      loop ? `The loop ran ${count(trace.runs.length, 'time')}, each as its own run: ${this.headline(trace).replace(/^.*?: /, '')}.` : end[trace.status],
      `It used ${count(trace.tasks, 'task')}.`,
    ]
      .filter(Boolean)
      .join(' ');
  }

  private renderHistory(trace: Trace) {
    const table = el('table', 'gx-table n-execs');
    const head = el('thead');
    const hr = el('tr');
    for (const h of ['Run', 'Status', 'Tasks']) {
      const th = el('th', undefined, h);
      th.scope = 'col';
      hr.append(th);
    }
    head.append(hr);
    const tbody = el('tbody');
    for (const r of trace.runs) {
      const tr = el('tr');
      const st = el('td');
      st.append(el('span', `n-status ${STATUS[r.status]}`, r.status));
      tr.append(el('td', undefined, r.label), st, el('td', undefined, String(r.tasks)));
      tbody.append(tr);
    }
    table.append(el('caption', 'sr-only', 'Zap history'), head, tbody);
    const wrap = el('div', 'gx-table-wrap');
    wrap.append(table);
    const start = trace.steps.find((s) => s.kind === 'trigger')?.t ?? trace.start;
    const before = trace.runs.length > 1 && trace.beforeLoop ? ` The steps before the loop ran once and used ${count(trace.beforeLoop, 'task')}, for ${trace.tasks} in all.` : '';
    const note = el('p', 'n-execs-note', `${trace.runs.length > 1 ? 'These runs' : 'This run'} as Zap history would list ${trace.runs.length > 1 ? 'them' : 'it'}, started ${formatClock(start)}.${before} Tasks are what Zapier bills: one for each action or search that succeeds; triggers, filters, paths, formatting, delays and loops are free.`);
    const parts: HTMLElement[] = [wrap, note];
    if (trace.effects.length) parts.push(renderEffects(trace.effects, true));
    this.record.replaceChildren(...parts);
  }
}

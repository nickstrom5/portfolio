/**
 * Browser side of /airtable/: plays a simulated automation run step by step,
 * ticks off steps in the editor, writes the run log with every change to the
 * base, and the run history.
 */
import { simulate, formatClock, formatDay, formatDuration, formatTime, previewJson, type Change, type Trace, type TraceStep } from './engine';
import type { Automation, CaseStudy, Message, Scenario } from './types';

const STEP_MS = 520;
const MIN = 60000;

function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Log classes from ghl.css and n8n.css. */
const KIND: Record<TraceStep['kind'], string> = {
  setup: 'k-hold',
  form: 'k-trigger',
  trigger: 'k-trigger',
  action: 'k-action',
  group: 'k-branch',
  repeat: 'k-branch',
  skip: 'k-skip',
  error: 'k-error',
  notify: 'k-error',
  end: 'k-end',
};

/** A one-off test event from the case's form, in place of a sample one. */
export type Override = Pick<Scenario, 'form' | 'setup' | 'failures' | 'start'>;

export function renderChanges(changes: Change[]): HTMLDetailsElement {
  const d = el('details', 'n-out a-changes');
  const n = changes.length;
  d.append(el('summary', undefined, `Base changes: ${n} record${n === 1 ? '' : 's'}`));
  const ul = el('ul', 'a-change-list');
  for (const c of changes) {
    const li = el('li');
    li.append(el('span', `a-change-rec${c.created ? ' is-new' : ''}`, `${c.created ? 'New in' : 'Updated in'} ${c.table} · ${c.record}`));
    const dl = el('dl');
    for (const f of c.fields) {
      const row = el('div');
      const dt = el('dt', undefined, f.field);
      if (f.computed) dt.append(el('span', 'a-computed', ' computed'));
      const dd = el('dd');
      if (!c.created) dd.append(el('del', undefined, f.from || '(empty)'), document.createTextNode(' → '));
      dd.append(el('ins', undefined, f.to || '(empty)'));
      row.append(dt, dd);
      dl.append(row);
    }
    li.append(dl);
    ul.append(li);
  }
  d.append(ul);
  return d;
}

export class Simulator {
  private root: HTMLElement;
  private editor: HTMLElement | null;
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
    const s = this.auto.scenarios.find((x) => x.id === checked?.value) ?? this.auto.scenarios[0];
    return this.override ? { ...s, id: 'yours', label: 'Your form', fixtures: {}, setup: undefined, failures: undefined, record: undefined, ...this.override } : s;
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
    this.record.replaceChildren(el('p', 'g-log-empty', 'No runs yet. Run the automation to add one.'));
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
      trace = simulate(this.study, this.auto, this.scenario);
    } catch (e) {
      this.log.replaceChildren(el('li', 'g-log-empty', `This run could not start: ${(e as Error).message}`));
      return;
    }
    this.log.replaceChildren();
    this.editor?.classList.add('is-running');
    this.root.classList.add('is-running');
    if (this.announce) this.announce.textContent = `Running ${this.auto.name}: ${this.scenario.label}.`;
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
    body.append(el('span', 'g-li-title', step.title));
    if (step.detail) body.append(el('span', 'g-li-detail', step.detail));
    for (const m of step.messages ?? []) body.append(this.renderMessage(m));
    if (step.changes?.length) body.append(renderChanges(step.changes));
    if (step.output && step.kind !== 'trigger' && Object.keys(step.output).length) {
      const d = el('details', 'n-out');
      d.append(el('summary', undefined, 'Output'), el('pre', 'n-json', previewJson(step.output)));
      body.append(d);
    }
    if (step.output && step.kind === 'trigger') {
      const d = el('details', 'n-out');
      d.append(el('summary', undefined, 'Trigger record'), el('pre', 'n-json', previewJson(step.output)));
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
    box.append(el('span', 'g-note-to', `Slack · ${m.to}`));
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
    if (step.kind === 'skip') target.classList.add('is-skipped');
    else if (step.kind === 'error') target.classList.add('is-error');
    else target.classList.add('is-done');
    target.classList.add('is-active');
    const body = c.querySelector<HTMLElement>('.g-canvas-body');
    if (body && body.scrollHeight > body.clientHeight + 4) {
      const top = target.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop - body.clientHeight / 3;
      body.scrollTo({ top: Math.max(0, top), behavior: c.classList.contains('is-running') && !reduceMotion() ? 'smooth' : 'auto' });
    }
  }

  private finish(trace: Trace) {
    this.stop();
    const c = this.editor;
    c?.classList.remove('is-running');
    c?.classList.add('is-ran');
    c?.querySelectorAll('.is-active').forEach((n) => n.classList.remove('is-active'));
    c?.querySelectorAll<HTMLElement>('.g-branch').forEach((b) => b.classList.toggle('is-dim', !b.classList.contains('is-taken')));

    const actions = trace.visited.filter((v) => !v.includes(':') && trace.steps.some((s) => s.kind === 'action' && s.stepId === v)).length;
    const label = trace.status === 'success' ? 'Run succeeded' : `Run failed at ${trace.error?.step}`;
    const parts = [`took ${formatDuration(trace.end - trace.start)}`, `${actions} action${actions === 1 ? '' : 's'} ran`, `${trace.changes.length} record${trace.changes.length === 1 ? '' : 's'} changed`];
    const plain = el('span', 'g-outcome-plain');
    plain.append(el('strong', undefined, 'What happened: '), document.createTextNode(this.plain(trace)));
    const tech = el('span', 'g-outcome-tech');
    tech.append(el('strong', undefined, label), document.createTextNode(` · ${parts.join(' · ')}`));
    this.outcome.replaceChildren(plain, tech);
    this.outcome.hidden = false;
    this.outcome.classList.toggle('is-error', trace.status === 'failed');
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
    const n = (k: number, one: string, many: string) => `${k} ${k === 1 ? one : many}`;
    const emails = msgs.filter((m) => m.channel === 'email').length;
    const slack = msgs.filter((m) => m.channel === 'slack').length;
    const runSteps = trace.steps.filter((s) => s.kind !== 'setup' && s.kind !== 'form');
    const created = trace.steps.filter((s) => s.kind === 'action').flatMap((s) => s.changes ?? []).filter((c) => c.created).length;
    const updated = new Set(trace.steps.filter((s) => s.kind === 'action').flatMap((s) => s.changes ?? []).filter((c) => !c.created && c.fields.some((f) => !f.computed)).map((c) => `${c.table}/${c.record}`)).size;
    const skipped = runSteps.filter((s) => s.kind === 'skip' && s.title.startsWith('Conditional')).length;
    const emptyList = runSteps.some((s) => s.kind === 'skip' && s.title.startsWith('Repeating'));
    const sent = [emails && n(emails, 'email', 'emails'), slack && n(slack, 'Slack message', 'Slack messages')].filter(Boolean) as string[];
    const wrote = [created && `created ${n(created, 'record', 'records')}`, updated && `updated ${n(updated, 'record', 'records')}`].filter(Boolean) as string[];
    return [
      sent.length ? `It sent ${sent.join(' and ')}.` : 'It sent nothing anyone reads.',
      wrote.length ? `It ${wrote.join(' and ')}, and every lookup, rollup and formula that reads them updated too.` : '',
      skipped ? `${n(skipped, 'group was', 'groups were')} skipped because ${skipped === 1 ? 'its conditions were' : 'their conditions were'} not met.` : '',
      emptyList ? 'The repeating group had no items, so it did nothing.' : '',
      trace.status === 'failed' ? `It failed at ${trace.error?.step}, kept what the earlier steps did, and Airtable emailed the owner.` : 'The run succeeded.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  private renderHistory(trace: Trace) {
    const table = el('table', 'gx-table n-execs');
    const head = el('thead');
    const hr = el('tr');
    for (const h of ['Automation', 'Status', 'Started', 'Duration']) {
      const th = el('th', undefined, h);
      th.scope = 'col';
      hr.append(th);
    }
    head.append(hr);
    const tbody = el('tbody');
    const tr = el('tr');
    const st = el('td');
    st.append(el('span', `n-status ${trace.status === 'success' ? 'n-success' : 'n-error'}`, trace.status === 'success' ? 'Successful' : 'Failed'));
    const start = trace.steps.find((s) => s.kind === 'trigger')?.t ?? trace.start;
    tr.append(el('td', undefined, this.auto.name), st, el('td', undefined, formatClock(start)), el('td', undefined, formatDuration(trace.end - start)));
    tbody.append(tr);
    table.append(el('caption', 'sr-only', 'Run history'), head, tbody);
    const wrap = el('div', 'gx-table-wrap');
    wrap.append(table);
    const note = el('p', 'n-execs-note', 'This run as it would appear in the automation’s Run history. Below: every record changed, by the person who started it and by the run.');
    const parts: HTMLElement[] = [wrap, note];
    if (trace.changes.length) {
      const ch = renderChanges(trace.changes);
      ch.open = true;
      parts.push(ch);
    }
    this.record.replaceChildren(...parts);
  }
}

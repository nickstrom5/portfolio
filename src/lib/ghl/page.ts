/**
 * Wires up /ghl/: workflow tabs (with deep links), the simulators, copy
 * buttons and the landing-page demo that turns the visitor into the test
 * contact for workflow 01.
 */
import { automations, env, fieldLabels, sampleContact } from '@/data/ghl';
import { formatDay, formatTime, nextWindowOpen } from './engine';
import type { Contact, ScenarioEvent } from './types';
import { Simulator } from './ui';

const DAY = 1440;
const QUIET = { start: '08:00', end: '20:00', days: [0, 1, 2, 3, 4, 5, 6] };

export function initGhlPage() {
  const sims = new Map<string, Simulator>();
  document.querySelectorAll<HTMLElement>('[data-sim]').forEach((root) => {
    sims.set(root.dataset.sim!, new Simulator(root, { automations, contact: sampleContact, env, fieldLabels }));
  });

  const tabs = [...document.querySelectorAll<HTMLButtonElement>('[data-tab]')];
  const panels = [...document.querySelectorAll<HTMLElement>('[data-panel]')];
  const ids = tabs.map((t) => t.dataset.tab!);

  function select(id: string, opts: { focus?: boolean; scroll?: boolean; hash?: boolean } = {}) {
    if (!ids.includes(id)) return;
    tabs.forEach((t) => {
      const on = t.dataset.tab === id;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && opts.focus) t.focus();
    });
    panels.forEach((p) => (p.hidden = p.dataset.panel !== id));
    if (opts.hash) history.replaceState(null, '', `#${id}`);
    if (opts.scroll) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    }
  }

  tabs.forEach((t, i) => {
    t.addEventListener('click', () => select(t.dataset.tab!, { hash: true }));
    t.addEventListener('keydown', (e) => {
      const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (move) {
        e.preventDefault();
        select(ids[(i + move + ids.length) % ids.length], { focus: true, hash: true });
      } else if (e.key === 'Home' || e.key === 'End') {
        e.preventDefault();
        select(ids[e.key === 'Home' ? 0 : ids.length - 1], { focus: true, hash: true });
      }
    });
  });

  document.querySelectorAll<HTMLAnchorElement>('[data-open-auto]').forEach((a) =>
    a.addEventListener('click', (e) => {
      e.preventDefault();
      select(a.dataset.openAuto!, { scroll: true, hash: true });
    }),
  );

  const fromHash = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (ids.includes(id)) select(id, { scroll: true });
  };
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

  initLandingDemo(sims, select);
}

function initLandingDemo(sims: Map<string, Simulator>, select: (id: string, o?: { scroll?: boolean; hash?: boolean }) => void) {
  const demo = document.querySelector<HTMLElement>('[data-demo]');
  const form = demo?.querySelector<HTMLFormElement>('[data-lp-form]');
  if (!demo || !form) return;
  const thanks = demo.querySelector<HTMLElement>('[data-lp-thanks]')!;
  const error = demo.querySelector<HTMLElement>('[data-lp-error]')!;
  const captured = demo.querySelector<HTMLElement>('[data-captured]')!;
  const list = demo.querySelector<HTMLElement>('[data-captured-list]')!;
  const when = demo.querySelector<HTMLElement>('[data-captured-when]')!;
  const params = new URLSearchParams(location.search);
  const utm = { utm_source: params.get('utm_source') ?? '', utm_medium: params.get('utm_medium') ?? '', utm_campaign: params.get('utm_campaign') ?? '' };
  let identity: Partial<Contact> | undefined;
  let start = 0;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const get = (k: string) => String(data.get(k) ?? '').trim();
    const missing = [
      !get('first') && 'your first name',
      !get('phone') && 'a mobile number',
      !/^\S+@\S+\.\S+$/.test(get('email')) && 'a valid email',
      !get('service') && 'what you need',
    ].filter(Boolean) as string[];
    if (missing.length) {
      error.textContent = `Please add ${missing.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`;
      error.hidden = false;
      return;
    }
    error.hidden = true;

    identity = {
      firstName: get('first'),
      lastName: get('last'),
      phone: get('phone'),
      email: get('email'),
      source: 'Website form',
      fields: {
        service_needed: get('service'),
        roof_age: get('age'),
        sms_consent: data.get('sms') ? 'Yes' : 'No',
        sms_marketing_consent: data.get('smsMarketing') ? 'Yes' : 'No',
        ...utm,
      },
    };
    const now = new Date();
    start = ((now.getDay() + 6) % 7) * DAY + now.getHours() * 60 + now.getMinutes();

    const rows: [string, string][] = [
      ['Name', `${identity.firstName} ${identity.lastName}`.trim()],
      ['Phone', identity.phone!],
      ['Email', identity.email!],
      ['Service needed', get('service')],
      ['Roof age', get('age')],
      ['SMS consent (updates)', identity.fields!.sms_consent as string],
      ['SMS consent (offers)', identity.fields!.sms_marketing_consent as string],
      ['utm_source', utm.utm_source || '(not in the URL)'],
      ['utm_medium', utm.utm_medium || '(not in the URL)'],
      ['utm_campaign', utm.utm_campaign || '(not in the URL)'],
    ];
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
    when.textContent = `Submitted ${formatDay(start).split(',')[0]} at ${formatTime(start)}, your local time. ${identity.fields!.sms_consent === 'Yes' ? 'You ticked the SMS box, so you get texts.' : 'You left the SMS box unticked, so it is email and phone only.'}`;
    captured.hidden = false;

    demo.querySelector('[data-lp-name]')!.textContent = identity.firstName!;
    form.hidden = true;
    thanks.hidden = false;
    thanks.focus({ preventScroll: true });
    // On one-column layouts the next step sits below the form; bring it into view.
    if (window.matchMedia('(max-width: 900px)').matches) {
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      captured.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    }
  });

  demo.querySelector('[data-lp-again]')?.addEventListener('click', () => {
    form.reset();
    form.hidden = false;
    thanks.hidden = true;
    captured.hidden = true;
    identity = undefined;
    sims.get('speed-to-lead')?.useContact(undefined);
  });

  demo.querySelector('[data-run-demo]')?.addEventListener('click', () => {
    const sim = sims.get('speed-to-lead');
    if (!sim || !identity) return;
    const next = demo.querySelector<HTMLInputElement>('input[name="demo-next"]:checked')?.value ?? 'replies';
    const texts = identity.fields?.sms_consent === 'Yes';
    // Reply a couple of minutes after the first message actually reaches them.
    const firstMessage = texts ? nextWindowOpen(start, QUIET) - start : 0;
    let events: ScenarioEvent[] = [];
    if (next === 'replies') events = [{ at: firstMessage + 3, type: 'reply', value: 'Yes please. Tomorrow after 3 works for me.' }];
    if (next === 'books') {
      // Books for 10 AM on the next weekday.
      let day = Math.floor(start / DAY) + 1;
      while (day % 7 >= 5) day++;
      events = [{ at: firstMessage + 25, type: 'appointment_booked', appointmentAt: day * DAY + 600 - start }];
    }
    sim.selectScenario(next);
    sim.useContact(identity, { start, events });
    select('speed-to-lead', { hash: true });
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('#speed-to-lead .gx-lab')?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    window.setTimeout(() => sim.run(false), reduce ? 0 : 500);
  });
}

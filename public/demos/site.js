// Small behaviours shared by the concept sites. Every block is a no-op on pages without its markup.
(() => {
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  // Mobile menu.
  const menu = document.querySelector('[data-menu]');
  const nav = document.getElementById('nav');
  if (menu && nav) {
    menu.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menu.setAttribute('aria-expanded', String(open));
    });
  }

  // "Open now" pill. data-hours is [open, close] per weekday, Sunday first; null means closed.
  const hour = (h) => `${((Math.floor(h) + 11) % 12) + 1}${h % 1 ? ':30' : ''}${h < 12 ? 'am' : 'pm'}`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  $$('[data-hours]').forEach((el) => {
    const hours = JSON.parse(el.dataset.hours);
    const now = new Date();
    const day = now.getDay();
    const t = now.getHours() + now.getMinutes() / 60;
    const today = hours[day];
    if (today && t >= today[0] && t < today[1]) {
      el.textContent = `Open now until ${hour(today[1])}`;
      el.classList.add('is-open');
      return;
    }
    if (today && t < today[0]) { el.textContent = `Opens today at ${hour(today[0])}`; return; }
    for (let i = 1; i <= 7; i++) {
      const next = hours[(day + i) % 7];
      if (next) {
        el.textContent = `Closed now, opens ${i === 1 ? 'tomorrow' : days[(day + i) % 7]} at ${hour(next[0])}`;
        return;
      }
    }
  });

  // Tabs and filters. A [data-tabs] group holds buttons with data-tab; picking one shows the
  // [data-panel] that matches, shows [data-cat] items in that category ("all" shows every one),
  // and swaps the text of anything carrying a data-v-<tab> attribute (the pricing toggle).
  $$('[data-tabs]').forEach((group) => {
    const scope = group.closest('[data-scope]') || document;
    const buttons = $$('[data-tab]', group);
    const pick = (v) => {
      buttons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === v)));
      $$('[data-panel]', scope).forEach((p) => { p.hidden = p.dataset.panel !== v; });
      $$('[data-cat]', scope).forEach((p) => { p.hidden = v !== 'all' && p.dataset.cat !== v; });
      $$(`[data-v-${v}]`, scope).forEach((p) => { p.textContent = p.getAttribute(`data-v-${v}`); });
      const count = scope.querySelector('[data-count]');
      if (count) count.textContent = String($$('[data-cat]', scope).filter((p) => !p.hidden).length);
    };
    buttons.forEach((b) => b.addEventListener('click', () => pick(b.dataset.tab)));
  });

  // Party estimator: a package (base price, kids included, price per extra kid), a guest count and add-ons.
  $$('[data-estimator]').forEach((form) => {
    const out = form.querySelector('[data-total]');
    const kidsOut = form.querySelector('[data-kids]');
    const note = form.querySelector('[data-note]');
    const calc = () => {
      const pack = form.querySelector('input[name=package]:checked');
      const kids = +form.elements.kids.value;
      const included = +pack.dataset.included;
      const extra = Math.max(0, kids - included);
      let total = +pack.dataset.base + extra * +pack.dataset.extra;
      $$('input[type=checkbox]:checked', form).forEach((c) => { total += +(c.dataset.flat || 0) + +(c.dataset.per || 0) * kids; });
      kidsOut.textContent = String(kids);
      out.textContent = `$${total.toLocaleString('en-US')}`;
      note.textContent = extra
        ? `Includes ${extra} extra ${extra === 1 ? 'child' : 'children'} at $${pack.dataset.extra} each.`
        : `Up to ${included} children are included in this package.`;
    };
    form.addEventListener('input', calc);
    form.addEventListener('submit', (e) => e.preventDefault());
    calc();
  });

  // Contact forms: these are concept sites, so nothing is sent anywhere.
  $$('[data-demo-form]').forEach((form) => {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      form.hidden = true;
      const thanks = form.parentElement.querySelector('[data-thanks]');
      thanks.hidden = false;
      thanks.focus();
    });
  });
})();

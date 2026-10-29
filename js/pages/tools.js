/* Kvadrat.rs — alati: kalkulatori (viewCalc), procena vrednosti (viewValuation), tržište (viewMarket).
   Spec §6.6; istraživanje: „Standalone calculators page“, „Instant valuation“, „Cene po lokacijama“.
   Sve je u IIFE-u; napolje idu samo viewCalc / viewValuation / viewMarket (+ toolsMarketTrend za druge stranice).
   Stanje svake alatke živi u hash-u (history.replaceState, bez re-rendera) pa je rezultat deljiv linkom. */
'use strict';

(function () {
  /* ───────────────────────── zajedničko ───────────────────────── */
  const RSD = 117.2;                       /* demo kurs, svuda označen kao „demo kurs“ */
  const hasKX = () => typeof KX !== 'undefined' && KX;
  const safe = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const nf0 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 1, minimumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  const med = (arr) => { const a = arr.filter((x) => x != null && isFinite(x)).sort((x, y) => x - y); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
  const plural = (n, a, b, c) => (typeof fmt !== 'undefined' && fmt.plural ? fmt.plural(n, a, b, c) : (n % 10 === 1 && n % 100 !== 11 ? a : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? b : c));
  const pct = (v, sign) => safe(() => fmt.pct(v, { sign: !!sign }), (sign && v > 0 ? '+' : '') + nf1.format(v) + ' %');
  const fold = (s) => safe(() => fmt.fold(s), String(s || '').toLowerCase());

  /* novac u izabranoj valuti: m(125000) → „125.000 €“ | „14.650.000 RSD“; unit: '' | '/mes' | '/m²' | '/god' */
  function moneyFmt(cur) {
    return (v, unit = '') => {
      if (v == null || !isFinite(v)) return '—';
      if (cur === 'rsd') return nf0.format(Math.round(v * RSD)) + ' RSD' + unit;
      const small = unit === '/m²' && Math.abs(v) < 100;
      return (small ? nf1.format(Math.round(v * 10) / 10) : nf0.format(Math.round(v))) + ' €' + unit;
    };
  }
  const minus = (s) => '−' + s;
  /* replaceChildren ne ravna nizove i ispisuje null — put() to radi kao el() */
  const put = (node, ...kids) => node.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false && k !== true));

  /* hash bez re-rendera: replaceState ne okida 'hashchange' ni router.onChange; Safari ograničava učestalost → debounce + try */
  const hashTimers = {};
  function syncHash(path, params) {
    clearTimeout(hashTimers[path]);
    hashTimers[path] = setTimeout(() => {
      try {
        const h = typeof router !== 'undefined' && router.buildHash ? router.buildHash(path, params) : '#' + path + '?' + new URLSearchParams(params);
        if (location.hash !== h) history.replaceState(history.state, '', h);
      } catch (e) { /* artefakt iframe može da odbije — stanje ostaje u stranici */ }
    }, 220);
  }
  const qget = (q, k, d) => { const v = q && q.get ? q.get(k) : null; return v == null || v === '' ? d : v; };
  const qnum = (q, k, d, lo, hi) => { const v = parseFloat(String(qget(q, k, '')).replace(',', '.')); return isFinite(v) ? clamp(v, lo, hi) : d; };
  const qbool = (q, k, d) => { const v = qget(q, k, null); return v == null ? d : v === '1' || v === 'true'; };

  /* broj iz polja: „120.000“ → 120000, „5,25“ → 5.25 */
  function parseNum(s, dec) {
    let t = String(s || '').trim().replace(/\s|€|%|RSD/gi, '');
    if (dec) { t = t.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'); }
    else t = t.replace(/[.,](?=\d{3}(\D|$))/g, '').replace(',', '.');
    const v = parseFloat(t);
    return isFinite(v) ? v : null;
  }

  /* numField — label + input sa jedinicom (+ opcioni klizač) + pomoć; money:true poštuje izabranu valutu (vrednost je uvek u €) */
  let fid = 0;
  function numField(o) {
    const id = 'tl-f' + (++fid);
    const cur = o.cur || 'eur';
    const factor = o.money && cur === 'rsd' ? RSD : 1;
    const unit = o.money ? (cur === 'rsd' ? 'RSD' : '€') + (o.unitSuffix || '') : o.unit || '';
    const show = (v) => (v == null || v === '' ? '' : o.plain ? String(Math.round(v)) : o.dec ? nf2.format(v) : nf0.format(Math.round(v * factor)));
    const input = el('input', { class: 'input num', id, type: 'text', inputmode: o.dec ? 'decimal' : 'numeric', autocomplete: 'off', value: show(o.value), 'aria-describedby': id + '-h', placeholder: o.placeholder || null });
    const help = el('p', { class: 'help', id: id + '-h' }, o.hint || '');
    if (!o.hint) help.hidden = true;
    let slider = null;
    if (o.slider) {
      slider = el('input', { class: 'tl-slider', type: 'range', min: o.min, max: o.max, step: o.step || 1, value: clamp(o.value || 0, o.min, o.max), 'aria-label': o.label + ' — klizač', tabindex: '-1' });
      const paint = () => slider.style.setProperty('--fill', (((+slider.value - o.min) / (o.max - o.min)) * 100).toFixed(1) + '%');
      paint();
      slider.addEventListener('input', () => { const v = +slider.value; input.value = show(v); paint(); setErr(null); o.onChange(v); });
      slider.paint = paint;
    }
    const commit = (fromBlur) => {
      const raw = parseNum(input.value, o.dec);
      if (raw == null) { if (fromBlur && o.value != null) input.value = show(api.value); return; }
      let v = raw / factor;
      if (fromBlur) { v = clamp(v, o.min, o.hardMax != null ? o.hardMax : o.max * 4); input.value = show(v); }
      const changed = v !== api.value;
      api.value = v;
      if (slider) { slider.value = clamp(v, o.min, o.max); slider.paint(); }
      /* blur bez promene ne sme da re-renderuje rezultat (klik na dugme u rezultatu bi se izgubio) */
      if (changed || !fromBlur) o.onChange(v);
    };
    input.addEventListener('input', () => commit(false));
    input.addEventListener('blur', () => commit(true));
    input.addEventListener('keydown', (e) => {
      if (!o.step || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
      e.preventDefault();
      const v = clamp((api.value || 0) + (e.key === 'ArrowUp' ? o.step : -o.step), o.min, o.hardMax != null ? o.hardMax : o.max * 4);
      api.set(v); o.onChange(v);
    });
    function setErr(msg, kind) {
      if (msg) { help.textContent = msg; help.hidden = false; help.className = 'help' + (kind === 'warn' ? ' tl-warn' : ' err'); if (kind !== 'warn') input.setAttribute('aria-invalid', 'true'); else input.removeAttribute('aria-invalid'); }
      else { help.textContent = o.hint || ''; help.hidden = !o.hint; help.className = 'help'; input.removeAttribute('aria-invalid'); }
    }
    const node = el('div', { class: 'fld tl-fld' + (o.wide ? ' wide' : '') },
      el('label', { class: 'lbl', for: id }, o.label),
      el('div', { class: 'tl-inp' }, input, unit ? el('span', { class: 'tl-u', 'aria-hidden': 'true' }, unit) : null),
      slider, slider && o.ticks ? el('div', { class: 'tl-ticks', 'aria-hidden': 'true' }, o.ticks.map((t) => { const x = ((t[0] - o.min) / (o.max - o.min)) * 100; return el('span', { class: x < 5 ? 'l' : x > 95 ? 'r' : null, style: `left:${x.toFixed(1)}%` }, t[1]); })) : null,
      help);
    if (unit) input.style.paddingRight = (14 + unit.length * 8.5) + 'px';
    const api = { node, input, value: o.value, set(v) { api.value = v; if (document.activeElement !== input) input.value = show(v); if (slider) { slider.value = clamp(v || 0, o.min, o.max); slider.paint(); } }, setErr, key: o.key };
    return api;
  }
  /* izbor — pilule (single) sa labelom; pills su „stvari koje biraš“ (spec pill-vs-square) */
  function choice(label, opts, cur, onPick) {
    const p = pills(opts, [cur], (v, on, all) => { if (!on) { p.set([v]); } onPick(v); }, { single: true });
    p.setAttribute('aria-label', label);
    return el('div', { class: 'fld tl-fld wide' }, el('span', { class: 'lbl' }, label), p);
  }
  function selField(label, opts, cur, onChange, hint) {
    const s = select(opts, cur, onChange);
    return field(label, s, hint);
  }
  function infoTip(text) {
    if (!text) return null;
    return tip(el('button', { type: 'button', class: 'tl-i', 'aria-label': 'Objašnjenje' }, icon('info', 15)), text);
  }
  function rows(list) {
    /* list: [[label, value, {cls, tip, sub}]] → hairline tabela */
    return el('dl', { class: 'tl-rows' }, list.filter(Boolean).map(([k, v, o = {}]) => el('div', { class: 'r' + (o.cls ? ' ' + o.cls : '') },
      el('dt', {}, el('span', {}, k), infoTip(o.tip), o.sub ? el('small', {}, o.sub) : null),
      el('dd', { class: 'num' }, v))));
  }
  function extLink(hrefUrl, label) {
    return el('a', { class: 'tl-ext', href: hrefUrl, target: '_blank', rel: 'noopener noreferrer' }, label, icon('external', 14), el('span', { class: 'sr' }, ' (otvara se u novom prozoru)'));
  }

  /* telefon: lepljiv red sa rezultatom dok se kuca u formi (sakriva se kad je pravi rezultat na ekranu) */
  function peek() {
    const lb = el('span', { class: 'lbl' }), v = el('b', { class: 'num' });
    const btn = el('button', { type: 'button', class: 'btn btn-secondary btn-sm' }, 'Rezultat', icon('arrow-down'));
    const node = el('div', { class: 'tl-peek' }, el('p', {}, lb, v), btn);
    return {
      node,
      set(label, val) { lb.textContent = label; v.textContent = val; },
      watch(target) {
        btn.addEventListener('click', () => target.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        try { new IntersectionObserver(([e]) => node.classList.toggle('off', e.isIntersecting), { rootMargin: '-120px 0px 0px 0px' }).observe(target); } catch (e) { /* bez IO red ostaje vidljiv */ }
      },
    };
  }

  /* zaglavlje alata: mrvice, naslov, lede, valuta, navigacija između alata */
  const TOOLS = [['/kalkulator', 'Kalkulatori'], ['/procena', 'Procena vrednosti'], ['/trziste', 'Tržište']];
  function toolsHead(path, title, lede, cur, onCur) {
    const curSeg = segmented([{ v: 'eur', l: 'EUR' }, { v: 'rsd', l: 'RSD' }], cur, onCur);
    curSeg.setAttribute('aria-label', 'Valuta prikaza');
    return el('header', { class: 'tl-head' },
      crumbs([{ label: 'Početna', href: '#/' }, { label: 'Alati', href: '#/kalkulator' }, { label: (TOOLS.find((t) => t[0] === path) || [0, ''])[1] }]),
      el('div', { class: 'tl-hrow' },
        el('div', { class: 'tl-htxt' }, el('h1', { class: 't-h1' }, title), el('p', { class: 'lede' }, lede)),
        el('div', { class: 'tl-cur' }, el('span', { class: 'lbl' }, 'Prikaz u valuti'), curSeg, el('p', { class: 'meta num' }, `demo kurs 1 € = ${nf1.format(RSD)} RSD`))),
      el('nav', { class: 'tl-nav', 'aria-label': 'Alati' }, TOOLS.map(([p, l]) => el('a', { href: '#' + p, 'aria-current': p === path ? 'page' : null }, l))));
  }
  /* zamena cele stranice (npr. promena valute) uz zadržavanje fokusa na kontroli */
  function remount(root, next, focusSel) {
    root.replaceWith(next);
    if (focusSel) { const f = next.querySelector(focusSel); if (f) f.focus({ preventScroll: true }); }
  }

  /* ═════════════════════════ #/kalkulator ═════════════════════════ */
  function viewCalc(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(q || '');
    const P = safe(() => KX.profile.get(), {}) || {};
    const S = {
      tab: ['kredit', 'sposobnost', 'troskovi'].includes(qget(q, 'tab')) ? qget(q, 'tab') : 'kredit',
      cur: qget(q, 'cur') === 'rsd' ? 'rsd' : 'eur',
      p: qnum(q, 'p', 120000, 5000, 5000000),
      fh: qbool(q, 'fh', !!P.firstHome),
      u: 0, g: qnum(q, 'g', P.years || 25, 5, 30), k: qnum(q, 'k', P.ratePct || 5, 0, 20), nk: qbool(q, 'nk', !!P.nkosk),
      in: qnum(q, 'in', P.income || 1400, 0, 100000), ip: qnum(q, 'ip', P.partnerIncome || 0, 0, 100000), ob: qnum(q, 'ob', P.obligations || 0, 0, 50000),
      dti: qnum(q, 'dti', Math.round((P.dti || 0.5) * 100), 40, 60), ks: qnum(q, 'ks', P.cash || 0, 0, 5000000),
      nb: qbool(q, 'nb', false), vi: qbool(q, 'vi', true), hh: qnum(q, 'hh', P.household || 1, 1, 10), a: qnum(q, 'a', 60, 10, 1000),
      pp: qnum(q, 'pp', P.agencyFeePct != null ? P.agencyFeePct : 2, 0, 6), pa: qget(q, 'pa', P.agencyPayer || 'kupac') === 'prodavac' ? 'prodavac' : 'kupac',
      he: HEAT[qget(q, 'he', '')] ? qget(q, 'he') : 'centralno', c: qget(q, 'c', 'beograd'), kr: qbool(q, 'kr', true),
    };
    S.u = qnum(q, 'u', S.fh ? 10 : 20, 0, 90);
    const m = moneyFmt(S.cur);
    const fields = [];
    const reg = (f) => { fields.push(f); return f; };
    const save = () => syncHash('/kalkulator', { tab: S.tab, cur: S.cur === 'rsd' ? 'rsd' : '', p: Math.round(S.p), u: S.u, g: S.g, k: S.k, fh: S.fh ? 1 : '', nk: S.nk ? 1 : '', in: S.in, ip: S.ip || '', ob: S.ob || '', dti: S.dti, ks: S.ks || '', nb: S.nb ? 1 : '', vi: S.nb && !S.vi ? 0 : '', hh: S.hh > 1 ? S.hh : '', a: S.a, pp: S.pp, pa: S.pa === 'prodavac' ? 'prodavac' : '', he: S.he, c: S.c, kr: S.kr ? '' : 0 });
    const outs = {};
    const update = (key) => { fields.forEach((f) => { if (f.key === key && document.activeElement !== f.input) f.set(S[key]); }); Object.values(outs).forEach((fn) => fn()); save(); };
    const setS = (key) => (v) => { S[key] = v; update(key); };

    /* ── tab 1: stambeni kredit ── */
    const fP = reg(numField({ key: 'p', label: 'Cena nekretnine', money: true, cur: S.cur, value: S.p, min: 20000, max: 500000, step: 1000, hardMax: 5000000, slider: true, onChange: setS('p') }));
    const fU = reg(numField({ key: 'u', label: 'Učešće', unit: '%', value: S.u, min: 0, max: 60, step: 1, hardMax: 90, slider: true, ticks: [[10, '10 %'], [20, '20 %']], onChange: setS('u') }));
    const fG = reg(numField({ key: 'g', label: 'Rok otplate', unit: 'god.', value: S.g, min: 5, max: 30, step: 1, hardMax: 30, slider: true, onChange: setS('g') }));
    const fK = reg(numField({ key: 'k', label: 'Nominalna kamatna stopa (NKS)', unit: '%', dec: true, value: S.k, min: 1, max: 10, step: 0.05, hardMax: 20, slider: true, hint: 'Godišnja, EUR-indeksirano. Prosek banaka u 2026. je oko 4,5–5,5 %.', onChange: setS('k') }));
    const fhCheck = check('Kupujem prvi stan (NBS dozvoljava 10 % učešća)', S.fh, (on) => { S.fh = on; update('fh'); });
    const nkToggle = toggle(S.nk, (on) => { S.nk = on; update('nk'); }, { label: 'Uračunaj NKOSK osiguranje kredita' });
    const outKredit = el('div', { class: 'tl-out', 'aria-live': 'polite' });
    const pkK = peek(), pkS = peek(), pkT = peek();
    const inquiry = el('div', { class: 'tl-inq' });
    outs.kredit = () => {
      const minU = S.fh ? 10 : 20;
      if (S.u < 10) fU.setErr('Ispod minimuma: banke finansiraju najviše 90 % vrednosti (NBS, prvi stan).');
      else if (S.u < minU) fU.setErr('Za kupovinu koja nije prvi stan banke traže najmanje 20 % učešća (LTV 80 %).', 'warn');
      else fU.setErr(null);
      const sum = fU.node.querySelector('.tl-sum'); if (sum) sum.textContent = '= ' + m(S.p * S.u / 100);
      const loan = Math.max(0, S.p * (1 - S.u / 100));
      const mo = mortgage(loan, S.k, S.g);
      const ltv = S.p ? loan / S.p : 0;
      const nkPct = ltv > 0.85 ? 3.5 : ltv > 0.75 ? 2.5 : 1.5;
      const nkoskEur = loan * nkPct / 100;
      const am = amortization(loan, S.k, S.g);
      const yearly = [loan].concat(Array.from({ length: S.g }, (_, i) => (am[(i + 1) * 12 - 1] || am[am.length - 1] || { balance: 0 }).balance));
      const firstYear = am.slice(0, 12);
      const intShare = firstYear.length ? firstYear.reduce((t, x) => t + x.interest, 0) / Math.max(1, firstYear.reduce((t, x) => t + x.interest + x.principal, 0)) : 0;
      const upfront = loan * 0.005 + 120 + 40 + (S.nk ? nkoskEur : 0);
      pkK.set('Mesečna rata', m(mo.monthly, '/mes'));
      put(outKredit, 
        el('p', { class: 'eyebrow' }, 'Mesečna rata'),
        el('p', { class: 'tl-big' }, m(mo.monthly, '/mes')),
        el('p', { class: 'tl-sub num' }, `kredit ${m(loan)} · ${S.g} god. · ${nf2.format(S.k)} % NKS · LTV ${Math.round(ltv * 100)} %`),
        rows([
          ['Glavnica (iznos kredita)', m(loan)],
          [`Učešće (${nf1.format(S.u)} %)`, m(S.p - loan)],
          ['Kamata ukupno', m(mo.interest), { sub: `${Math.round(mo.interest / Math.max(1, loan) * 100)} % iznosa kredita` }],
          ['Ukupno plaćeno banci', m(mo.total), { cls: 'tot' }],
          ['Obrada kredita 0,5 %', m(loan * 0.005), { sub: 'jednokratno, procena' }],
          ['Procena nekretnine', m(120), { sub: 'jednokratno, procena' }],
          ['Osiguranje nekretnine', m(40, '/god'), { sub: 'banka ga traži kao uslov' }],
          [`NKOSK premija ${nf1.format(nkPct)} %`, m(nkoskEur), { cls: S.nk ? '' : 'opt', sub: S.nk ? 'jednokratno' : 'opciono — traže je samo neke banke', tip: 'Nacionalna korporacija za osiguranje stambenih kredita; premija raste sa LTV (1,5–3,5 %). Uz NKOSK neke banke odobravaju veći LTV.' }],
          ['Jednokratni troškovi kredita', m(upfront), { cls: 'tot', sub: 'obrada + procena + osiguranje' + (S.nk ? ' + NKOSK' : '') }],
          ['Potreban neto prihod domaćinstva', m(mo.monthly / 0.5, '/mes'), { sub: 'da rata bude najviše 50 % prihoda', tip: 'Banke u praksi računaju 50 % neto prihoda (konzervativno); NBS dozvoljava do 60 %.' }],
        ]),
        sparkline(yearly, {
          title: el('span', {}, 'Preostali dug · ', el('b', {}, `${S.g} godina`)),
          labels: yearly.map((_, i) => (i === 0 ? 'danas' : `${i}. god.`)),
          format: (v) => m(v), aria: `Preostali dug opada od ${m(loan)} do 0 za ${S.g} godina`,
        }),
        el('p', { class: 'tl-note note-rule' }, `U prvoj godini ${Math.round(intShare * 100)} % rate ide na kamatu, a ostatak otplaćuje glavnicu. Iznosi su informativni; banka računa i EKS sa svim troškovima.`),
        el('div', { class: 'btn-row tl-actions' },
          el('button', { type: 'button', class: 'btn btn-secondary', 'aria-expanded': inquiry.childElementCount ? 'true' : 'false', 'aria-controls': 'tl-inq', onclick: (e) => openInquiry(e.currentTarget) }, icon('mail'), 'Pošalji upit banci'),
          el('a', { class: 'btn btn-ghost', href: '#/kalkulator?' + new URLSearchParams({ tab: 'troskovi', p: Math.round(S.p) }), onclick: (e) => { e.preventDefault(); root.querySelector('.tabs').select('troskovi'); } }, 'Svi troškovi kupovine', icon('arrow-right'))),
        inquiry);
    };
    function openInquiry(btn) {
      if (inquiry.childElementCount) { put(inquiry); btn.setAttribute('aria-expanded', 'false'); return; }
      btn.setAttribute('aria-expanded', 'true');
      inquiry.id = 'tl-inq';
      const nm = el('input', { class: 'input', type: 'text', autocomplete: 'name' });
      const ct = el('input', { class: 'input', type: 'text', autocomplete: 'tel', inputmode: 'tel', placeholder: '06x xxx xxxx ili e-pošta' });
      const note = el('textarea', { class: 'input', rows: 3, placeholder: 'Npr. zaposlen/a na neodređeno, primanja preko banke…' });
      const ok = check('Saglasan/na sam da me banke kontaktiraju sa ponudom', true, null);
      const fN = field('Ime i prezime', nm), fC = field('Telefon ili e-pošta', ct);
      const form = el('form', { class: 'tl-form', novalidate: true, onsubmit: (e) => {
        e.preventDefault();
        let bad = false;
        [[nm, fN, 'Upiši ime'], [ct, fC, 'Upiši telefon ili e-poštu']].forEach(([inp, f, msg]) => {
          const h = f.querySelector('.help') || f.appendChild(el('p', { class: 'help err', id: inp.id + '-h' }));
          if (!inp.value.trim()) { inp.setAttribute('aria-invalid', 'true'); inp.setAttribute('aria-describedby', inp.id + '-h'); h.textContent = msg; h.className = 'help err'; bad = true; }
          else { inp.removeAttribute('aria-invalid'); h.textContent = ''; }
        });
        if (bad) { (nm.value.trim() ? ct : nm).focus(); return; }
        const loan = Math.max(0, S.p * (1 - S.u / 100));
        const text = `Upit za stambeni kredit\nIme: ${nm.value.trim()}\nKontakt: ${ct.value.trim()}\nCena nekretnine: ${nf0.format(S.p)} €\nUčešće: ${nf1.format(S.u)} % (${nf0.format(S.p - loan)} €)\nIznos kredita: ${nf0.format(loan)} €\nRok: ${S.g} god.\nOkvirna rata: ${nf0.format(mortgage(loan, S.k, S.g).monthly)} €/mes uz ${nf2.format(S.k)} % NKS${S.fh ? '\nPrvi stan: da' : ''}${note.value.trim() ? '\nNapomena: ' + note.value.trim() : ''}`;
        put(inquiry, el('div', { class: 'tl-done', role: 'status', tabindex: '-1' },
          el('p', { class: 'tl-done-h' }, icon('check-circle'), 'Upit je pripremljen'),
          el('p', {}, 'Ovo je demo: upit nije poslat nijednoj banci. Kopiraj tekst i pošalji ga banci po izboru — sadrži sve što banka pita u prvom koraku.'),
          el('pre', { class: 'tl-pre' }, text),
          el('div', { class: 'btn-row' }, copyButton(text, { outline: true, label: 'Kopiraj tekst upita' }), el('span', { class: 'meta' }, 'Kopiraj tekst upita'),
            el('button', { type: 'button', class: 'btn btn-ghost btn-sm', onclick: () => { put(inquiry); btn.setAttribute('aria-expanded', 'false'); btn.focus(); } }, 'Zatvori'))));
        inquiry.firstChild.focus();
      } },
      el('h3', { class: 't-h3' }, 'Upit banci'),
      el('p', { class: 'meta' }, `Šaljemo iznos kredita ${m(Math.max(0, S.p * (1 - S.u / 100)))}, rok ${S.g} god. i učešće iz kalkulatora.`),
      el('div', { class: 'tl-grid2' }, fN, fC),
      field('Napomena (opciono)', note), ok,
      el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-primary', type: 'submit' }, 'Pripremi upit'), el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { put(inquiry); btn.setAttribute('aria-expanded', 'false'); btn.focus(); } }, 'Odustani')));
      put(inquiry, form);
      nm.focus();
    }
    const uSum = el('span', { class: 'tl-sum num' });
    fU.node.querySelector('.tl-inp').appendChild(uSum);
    const panelKredit = el('div', { class: 'tl-calc' }, pkK.node,
      el('form', { class: 'tl-form tl-in', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Parametri kredita' },
        fP.node, fU.node, el('div', { class: 'tl-ltv note-rule' }, el('b', {}, 'LTV 80 % / 90 %. '), 'Banke uobičajeno finansiraju do 80 % vrednosti (20 % učešća). Za prvi stan NBS od 2020. dozvoljava 90 % (10 % učešća), ali ne nude sve banke taj uslov.'),
        fhCheck, fG.node, fK.node, nkToggle),
      el('div', { class: 'tl-res' }, outKredit));

    /* ── tab 2: kreditna sposobnost ── */
    const fIn = reg(numField({ key: 'in', label: 'Tvoj mesečni neto prihod', money: true, cur: S.cur, value: S.in, min: 0, max: 6000, step: 50, hardMax: 100000, slider: true, onChange: setS('in') }));
    const fIp = reg(numField({ key: 'ip', label: 'Prihod partnera (opciono)', money: true, cur: S.cur, value: S.ip, min: 0, max: 6000, step: 50, hardMax: 100000, slider: true, onChange: setS('ip') }));
    const fOb = reg(numField({ key: 'ob', label: 'Postojeće rate (krediti, kartice, lizing)', money: true, cur: S.cur, value: S.ob, min: 0, max: 2000, step: 10, hardMax: 50000, hint: 'Mesečni iznos svih rata koje već plaćaš.', onChange: setS('ob') }));
    const fDti = reg(numField({ key: 'dti', label: 'Deo prihoda za rate', unit: '%', value: S.dti, min: 40, max: 60, step: 1, hardMax: 60, slider: true, ticks: [[40, '40 %'], [50, 'konzervativno 50 %'], [60, 'NBS maks. 60 %']], onChange: (v) => { S.dti = clamp(Math.round(v), 40, 60); update('dti'); } }));
    const fG2 = reg(numField({ key: 'g', label: 'Rok otplate', unit: 'god.', value: S.g, min: 5, max: 30, step: 1, hardMax: 30, slider: true, hint: 'Kredit se po pravilu otplaćuje do 70. godine života.', onChange: setS('g') }));
    const fK2 = reg(numField({ key: 'k', label: 'Kamatna stopa (NKS)', unit: '%', dec: true, value: S.k, min: 1, max: 10, step: 0.05, hardMax: 20, onChange: setS('k') }));
    const fKs = reg(numField({ key: 'ks', label: 'Ušteđevina za učešće i troškove (opciono)', money: true, cur: S.cur, value: S.ks, min: 0, max: 200000, step: 1000, hardMax: 5000000, onChange: setS('ks') }));
    const outSp = el('div', { class: 'tl-out', 'aria-live': 'polite' });
    const maxLoanFor = (rata, ratePct, years) => { const r = ratePct / 100 / 12, n = years * 12; return r === 0 ? rata * n : rata * (1 - Math.pow(1 + r, -n)) / r; };
    outs.sp = () => {
      const income = S.in + S.ip;
      const share = S.dti / 100;
      const maxRata = Math.max(0, share * income - S.ob);
      const maxLoan = maxLoanFor(maxRata, S.k, S.g);
      const at = (ltv) => ({ price: maxLoan / ltv, down: maxLoan / ltv * (1 - ltv), costs: maxLoan / ltv * 0.06 });
      const a80 = at(0.8), a90 = at(0.9);
      const ltv = S.fh ? 0.9 : 0.8;
      /* bez ušteđevine: granica je kredit / LTV; sa ušteđevinom: keš mora da pokrije učešće + ≈ 6 % troškova, kredit ostatak */
      let target = (S.fh ? a90 : a80).price, limit = 'kredit';
      if (S.ks > 0) {
        const byCash = S.ks / (1 - ltv + 0.06);
        const byLoan = (S.ks + maxLoan) / 1.06;
        target = Math.min(byCash, byLoan);
        limit = byCash <= byLoan ? 'ustedjevina' : 'kredit';
      }
      target = Math.max(0, Math.floor(target / 1000) * 1000);
      const cnt = target > 0 ? safe(() => (hasKX() && KX.count ? KX.count({ t: 'prodaja', pt: ['stan'], pmax: target }) : applyFilters({ t: 'prodaja', pt: ['stan'], pmax: target }).length), 0) : 0;
      pkS.set('Maks. rata · kredit', `${m(maxRata, '/mes')} · ${m(maxLoan)}`);
      const searchHref = typeof router !== 'undefined' ? router.href('/pretraga', { t: 'prodaja', pt: ['stan'], pmax: target }) : '#/pretraga?pmax=' + target;
      put(outSp, 
        el('p', { class: 'eyebrow' }, 'Najveća rata koju banka odobrava'),
        el('p', { class: 'tl-big' }, m(maxRata, '/mes')),
        el('p', { class: 'tl-sub num' }, `${S.dti} % od ${m(income, '/mes')}${S.ob ? ' − postojeće rate ' + m(S.ob) : ''}`),
        maxRata <= 0 ? el('p', { class: 'tl-note note-rule' }, 'Sa ovim prihodom i postojećim ratama banka ne bi odobrila novi kredit. Smanji postojeće obaveze ili dodaj prihod partnera.') : null,
        rows([
          ['Ukupan neto prihod', m(income, '/mes')],
          [`Za rate (${S.dti} %${S.dti === 50 ? ', konzervativno' : S.dti === 60 ? ', maksimum NBS' : ''})`, m(share * income, '/mes')],
          S.ob ? ['Postojeće rate', minus(m(S.ob, '/mes'))] : null,
          ['Maksimalna nova rata', m(maxRata, '/mes'), { cls: 'tot' }],
          ['Maksimalan kredit', m(maxLoan), { cls: 'tot', sub: `${S.g} god. uz ${nf2.format(S.k)} % NKS` }],
        ]),
        el('div', { class: 'tl-ltvs' },
          [[a80, 'LTV 80 %', '20 % učešća — uobičajeno', !S.fh], [a90, 'LTV 90 %', '10 % učešća — prvi stan (NBS)', S.fh]].map(([x, h, sub, on]) => el('div', { class: 'tl-ltvc' + (on ? ' on' : '') },
            el('p', { class: 'label' }, h), el('p', { class: 't-stat num' }, m(x.price)), el('p', { class: 'meta' }, 'najviša cena stana · ' + sub),
            el('p', { class: 'meta num' }, `učešće ${m(x.down)} + troškovi ≈ ${m(x.costs)}`)))),
        S.ks > 0 ? el('p', { class: 'tl-note note-rule' }, `Sa ušteđevinom od ${m(S.ks)} realno možeš do `, el('b', {}, m(target)), limit === 'ustedjevina' ? ' — ograničava te učešće i troškovi kupovine (≈ 6 %), ne rata.' : ' — ograničava te visina kredita.') : el('p', { class: 'tl-note note-rule' }, 'Uz cenu računaj i ≈ 6 % troškova kupovine (porez ili PDV, provizija, notar, upis) koje banka ne finansira. Unesi ušteđevinu za realnu granicu.'),
        el('div', { class: 'btn-row tl-actions' },
          el('a', { class: 'btn btn-primary' + (target > 0 ? '' : ' disabled'), href: searchHref, 'aria-disabled': target > 0 ? null : 'true' }, icon('search'), `Pokaži stanove do ${m(target)}`),
          el('button', { type: 'button', class: 'btn btn-secondary', onclick: () => {
            if (!hasKX() || !KX.profile) { toast('Profil nije dostupan u ovoj verziji'); return; }
            KX.profile.set({ income: S.in, partnerIncome: S.ip, obligations: S.ob, dti: S.dti / 100, ratePct: S.k, years: S.g, cash: S.ks, firstHome: S.fh });
            toast('Budžet je sačuvan — oglasi sada pokazuju da li se uklapaju', { action: { label: 'Pogledaj', href: searchHref } });
          } }, 'Sačuvaj kao moj budžet')),
        el('p', { class: 'meta tl-count num' }, target > 0 ? `${cnt} ${plural(cnt, 'stan', 'stana', 'stanova')} u ponudi do ${m(target)}` : ''));
    };
    const panelSp = el('div', { class: 'tl-calc' }, pkS.node,
      el('form', { class: 'tl-form tl-in', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Prihodi i obaveze' },
        el('div', { class: 'tl-grid2' }, fIn.node, fIp.node), fOb.node, fDti.node,
        el('div', { class: 'tl-grid2' }, fG2.node, fK2.node), fKs.node,
        check('Kupujem prvi stan (LTV 90 %)', S.fh, (on) => { S.fh = on; update('fh'); })),
      el('div', { class: 'tl-res' }, outSp));

    /* ── tab 3: troškovi kupovine ── */
    const fP3 = reg(numField({ key: 'p', label: 'Cena iz oglasa', money: true, cur: S.cur, value: S.p, min: 20000, max: 500000, step: 1000, hardMax: 5000000, slider: true, onChange: setS('p') }));
    const fA = reg(numField({ key: 'a', label: 'Kvadratura', unit: 'm²', value: S.a, min: 10, max: 300, step: 1, hardMax: 1000, onChange: setS('a') }));
    const fHh = reg(numField({ key: 'hh', label: 'Članova domaćinstva', unit: 'osoba', value: S.hh, min: 1, max: 10, step: 1, hardMax: 10, hint: '40 m² za kupca + 15 m² po članu ulazi u olakšicu.', onChange: (v) => { S.hh = clamp(Math.round(v), 1, 10); update('hh'); } }));
    const fPp = reg(numField({ key: 'pp', label: 'Provizija agencije', unit: '% + PDV', dec: true, value: S.pp, min: 0, max: 6, step: 0.5, hardMax: 6, hint: 'Upiši 0 ako kupuješ od vlasnika.', onChange: setS('pp') }));
    const vatRow = toggle(S.vi, (on) => { S.vi = on; update('vi'); }, { label: 'Cena uključuje PDV' });
    const vatWrap = el('div', { class: 'tl-sub-opt' }, vatRow, el('p', { class: 'help' }, 'Investitori oglašavaju cene sa PDV-om. Isključi samo ako piše „+ PDV“.'));
    vatWrap.hidden = !S.nb;
    const hhWrap = el('div', {}, fHh.node); hhWrap.hidden = !S.fh;
    const outT = el('div', { class: 'tl-out', 'aria-live': 'polite' });
    const cityOpts = (typeof CITIES_MAJOR !== 'undefined' ? CITIES_MAJOR : D.cities.filter((c) => c.maj)).map((c) => ({ v: c.s, l: c.n }));
    outs.t = () => {
      vatWrap.hidden = !S.nb; hhWrap.hidden = !S.fh;
      const l = { s: 'kalk-troskovi', r: '', t: 'prodaja', pt: 'stan', p: S.p, a: S.a, ppm: S.a ? S.p / S.a : null, ro: 2, fl: 2, tf: 5, y: S.nb ? 2026 : 1985, co: S.nb ? 'novogradnja' : 'dobro-stanje', he: S.he, en: null, cs: S.c, c: (D.cities.find((c) => c.s === S.c) || {}).n, ms: '', m: '', ns: '', n: '', ags: S.pp > 0 ? 'kalkulator' : null, ag: S.pp > 0 ? 'Agencija' : null, am: ['hasElevator'], dz: 0, reg: true };
      const C = hasKX() ? safe(() => KX.cost(l, { firstHome: S.fh, household: S.hh, agencyFeePct: S.pp, agencyPayer: S.pa, vatIncluded: S.vi, financing: S.kr ? 'kredit' : 'kes', cash: 0, ltv: S.fh ? 0.9 : 0.8, ratePct: S.k, years: S.g, nkosk: S.nk, taxPayer: 'kupac' }), null) : null;
      if (!C) { put(outT, el('p', { class: 'tl-note note-rule' }, 'Kalkulator troškova trenutno nije dostupan.')); return; }
      const GROUPS = [['kupovina', 'Na dan kupovine', 'cena, porez i naknade'], ['useljenje', 'Pri useljenju', 'jednokratno'], ['mesecno', 'Svakog meseca', 'kredit i računi'], ['kasnije', 'Kasnije', 'priliv posle kupovine']];
      const lineRow = (x) => {
        const seller = x.payer === 'prodavac';
        const val = x.included ? `u ceni (${m(x.inPrice)})` : (x.amount < 0 ? (x.when === 'kasnije' ? '+' + m(-x.amount) : minus(m(-x.amount, x.when === 'mesecno' ? '/mes' : ''))) : m(x.amount, x.when === 'mesecno' ? '/mes' : ''));
        const sub = [seller ? 'plaća prodavac — nije u zbiru' : '', x.optional ? 'opciono — nije u zbiru' : '', x.estimate ? 'procena' : ''].filter(Boolean).join(' · ');
        return [x.label, val, { cls: (seller || x.optional ? 'opt' : '') + (x.amount < 0 ? ' neg' : ''), sub, tip: x.note }];
      };
      const groups = GROUPS.map(([w, h, sub]) => {
        const ls = C.lines.filter((x) => x.when === w);
        if (!ls.length) return null;
        const tot = w === 'kupovina' ? C.onPurchase : w === 'useljenje' ? C.moveIn : w === 'mesecno' ? C.monthly : C.laterInflow;
        return el('section', { class: 'tl-grp' },
          el('div', { class: 'tl-grp-h' }, el('h3', { class: 'eyebrow' }, h, el('span', {}, ' · ' + sub)), el('b', { class: 'num' }, w === 'kasnije' ? '+' + m(tot) : m(tot, w === 'mesecno' ? '/mes' : ''))),
          rows(ls.map(lineRow)));
      });
      const ownCash = C.onPurchase - C.loan + C.moveIn;
      pkT.set(S.kr ? 'Gotovine do useljenja' : 'Ukupno', m(ownCash));
      put(outT, 
        el('p', { class: 'eyebrow' }, S.kr ? 'Potrebno gotovine do useljenja' : 'Ukupno za kupovinu i useljenje'),
        el('p', { class: 'tl-big' }, m(ownCash)),
        el('p', { class: 'tl-sub num' }, `cena ${m(S.p)}${C.loan ? ' · kredit ' + m(C.loan) : ''} · troškovi ${m(C.fees + C.moveIn)} (${nf1.format((C.fees + C.moveIn) / S.p * 100)} % cene)`),
        tiles([
          { v: m(C.onPurchase - C.loan), l: 'na dan kupovine, iz džepa' },
          { v: m(C.moveIn), l: 'pri useljenju' },
          { v: m(C.monthly, '/mes'), l: S.kr ? 'mesečno, sa ratom' : 'mesečno, računi' },
          C.laterInflow ? { v: '+' + m(C.laterInflow), l: 'vraća se ≈ 45 dana posle' } : null,
        ].filter(Boolean)),
        groups,
        C.firstHome && C.firstHome.eligible && C.firstHome.saving ? el('p', { class: 'tl-note note-rule' }, `Prvi stan: olakšica važi za ${nf0.format(C.firstHome.eligibleM2)} od ${nf0.format(S.a)} m² — ušteda ${m(C.firstHome.saving)}${C.firstHome.when === 'kasnije' ? ', kao povraćaj PDV-a posle kupovine (ne smanjuje novac potreban na dan kupovine).' : ', odmah na porezu na prenos.'}`) : null,
        el('div', { class: 'tl-assume' }, el('p', { class: 'label' }, 'Pretpostavke'), el('ul', {}, C.assumptions.concat([
          'Mesečni računi (grejanje, struja, komunalije, održavanje) su procena po m² i vrsti grejanja.',
          'Porez na imovinu je gruba procena; tačan iznos određuje opština.',
        ]).map((a) => el('li', {}, a))), el('a', { class: 'link', href: '#/kako-racunamo' }, 'Kako računamo')));
    };
    const panelT = el('div', { class: 'tl-calc' }, pkT.node,
      el('form', { class: 'tl-form tl-in', onsubmit: (e) => e.preventDefault(), 'aria-label': 'Podaci o kupovini' },
        fP3.node,
        el('div', { class: 'tl-grid2' }, fA.node, selField('Grad (za porez na imovinu)', cityOpts, S.c, (v) => { S.c = v; update('c'); })),
        toggle(S.nb, (on) => { S.nb = on; update('nb'); }, { label: 'Novogradnja (kupujem od investitora)' }),
        vatWrap,
        check('Kupujem prvi stan', S.fh, (on) => { S.fh = on; update('fh'); }), hhWrap,
        el('div', { class: 'tl-grid2' }, fPp.node, field('Proviziju plaća', segmentedAs([{ v: 'kupac', l: 'Kupac' }, { v: 'prodavac', l: 'Prodavac' }], S.pa, (v) => { S.pa = v; update('pa'); }))),
        selField('Grejanje', Object.entries(HEAT).map(([v, l]) => ({ v, l })), S.he, (v) => { S.he = v; update('he'); }),
        toggle(S.kr, (on) => { S.kr = on; update('kr'); }, { label: 'Kupujem na kredit (rata, rok i kamata iz prvog taba)' })),
      el('div', { class: 'tl-res' }, outT));
    function segmentedAs(opts, cur, onPick) { const s = segmented(opts, cur, onPick); s.id = 'tl-seg-' + (++fid); return s; }

    const tb = tabs([
      { id: 'kredit', label: 'Stambeni kredit', panel: panelKredit },
      { id: 'sposobnost', label: 'Kreditna sposobnost', panel: panelSp },
      { id: 'troskovi', label: 'Troškovi kupovine', panel: panelT },
    ], { active: S.tab, onChange: (id) => { S.tab = id; fields.forEach((f) => f.set(S[f.key])); save(); } });
    const root = el('div', { class: 'wrap tl tl-page-calc' },
      toolsHead('/kalkulator', 'Kalkulatori za kupovinu stana', 'Rata kredita, koliko ti banka može odobriti i šta sve plaćaš pored cene — sa pravilima srpskih banaka i poreza za 2026.', S.cur,
        (v) => { S.cur = v; save(); const next = viewCalc(new URLSearchParams(curParams())); remount(root, next, '.tl-cur .seg button[aria-pressed="true"]'); }),
      tb);
    function curParams() { return { tab: S.tab, cur: S.cur, p: Math.round(S.p), u: S.u, g: S.g, k: S.k, fh: S.fh ? 1 : 0, nk: S.nk ? 1 : 0, in: S.in, ip: S.ip, ob: S.ob, dti: S.dti, ks: S.ks, nb: S.nb ? 1 : 0, vi: S.vi ? 1 : 0, hh: S.hh, a: S.a, pp: S.pp, pa: S.pa, he: S.he, c: S.c, kr: S.kr ? 1 : 0 }; }
    Object.values(outs).forEach((fn) => fn());
    [[pkK, panelKredit], [pkS, panelSp], [pkT, panelT]].forEach(([pk, panel]) => pk.watch(panel.querySelector('.tl-res')));
    return root;
  }

  /* ═════════════════════════ mesta (grad → opština → naselje) ═════════════════════════ */
  let placeIdx = null;
  function places() {
    if (placeIdx) return placeIdx;
    const cnt = new Map(), nb = new Map(), mc = new Map();
    for (const l of D.listings) {
      cnt.set(l.cs, (cnt.get(l.cs) || 0) + 1);
      if (l.ms) { const k = l.ms; const x = mc.get(k) || { lat: 0, lng: 0, n: 0 }; x.lat += l.lat || 0; x.lng += l.lng || 0; x.n++; mc.set(k, x); }
      if (l.ns) {
        const k = l.cs + '|' + l.ns;
        const x = nb.get(k) || { kind: 'nbhd', s: l.ns, name: l.n, ms: l.ms, m: l.m, cs: l.cs, c: l.c, lat: 0, lng: 0, n: 0 };
        x.lat += l.lat || 0; x.lng += l.lng || 0; x.n++; nb.set(k, x);
      }
    }
    const cities = D.cities.filter((c) => cnt.get(c.s)).map((c) => ({ kind: 'city', s: c.s, name: c.n, cs: c.s, c: c.n, lat: c.lat, lng: c.lng, n: cnt.get(c.s) || 0 }));
    const muns = D.muns.filter((m) => mc.get(m.s)).map((m) => { const x = mc.get(m.s); const city = D.cities.find((c) => c.s === m.cs) || {}; return { kind: 'mun', s: m.s, name: m.n, ms: m.s, m: m.n, cs: m.cs, c: city.n, lat: x.lat / x.n, lng: x.lng / x.n, n: x.n }; });
    const nbhds = [...nb.values()].map((x) => ({ ...x, lat: x.lat / x.n, lng: x.lng / x.n }));
    placeIdx = { cities, muns, nbhds, all: cities.concat(muns, nbhds) };
    return placeIdx;
  }
  function searchPlaces(qs) {
    const f = fold(qs).trim();
    if (!f) return [];
    const KIND = { city: 0, mun: 1, nbhd: 2 };
    const out = [];
    for (const p of places().all) {
      const nm = fold(p.name);
      let sc = nm === f ? 0 : nm.startsWith(f) ? 1 : nm.split(/[\s\-–.]+/).some((w) => w.startsWith(f)) ? 2 : nm.includes(f) ? 3 : -1;
      if (sc < 0) continue;
      out.push([sc * 10 + KIND[p.kind] - Math.min(5, p.n) * 0.1, p]);
    }
    /* isto ime opštine i naselja (npr. „Zvezdara“) — zadrži oba, ali bez duplog istog grada */
    return out.sort((a, b) => a[0] - b[0]).slice(0, 8).map((x) => x[1]);
  }
  const KIND_LABEL = { city: 'grad', mun: 'opština', nbhd: 'naselje' };
  function placeCtx(p) { return p.kind === 'city' ? `grad · ${p.n} ${plural(p.n, 'oglas', 'oglasa', 'oglasa')}` : p.kind === 'mun' ? `opština · ${p.c}` : `naselje · ${p.m && p.m !== p.c ? p.m + ', ' : ''}${p.c}`; }

  /* combobox (ARIA 1.2): input + listbox; strelice, Enter, Esc */
  function placeCombo(onPick, initial) {
    const id = 'tl-pc-' + (++fid);
    const input = el('input', { class: 'input', id, type: 'text', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': id + '-l', autocomplete: 'off', placeholder: 'Npr. Čubura, Liman, Vračar, Niš…', value: initial || '' });
    const list = el('ul', { class: 'tl-ac', role: 'listbox', id: id + '-l', hidden: true });
    let items = [], active = -1;
    const close = () => { list.hidden = true; input.setAttribute('aria-expanded', 'false'); input.removeAttribute('aria-activedescendant'); active = -1; };
    const paintActive = () => { [...list.children].forEach((li, i) => li.setAttribute('aria-selected', i === active ? 'true' : 'false')); if (active >= 0) { input.setAttribute('aria-activedescendant', id + '-o' + active); list.children[active].scrollIntoView({ block: 'nearest' }); } };
    const pick = (p) => { input.value = p.name; close(); onPick(p); };
    const open = () => {
      items = searchPlaces(input.value);
      put(list, ...(items.length ? items.map((p, i) => el('li', { role: 'option', id: id + '-o' + i, 'aria-selected': 'false', onmousedown: (e) => { e.preventDefault(); pick(p); } },
        el('span', { class: 'nm' }, p.name), el('span', { class: 'cx' }, placeCtx(p)))) : [el('li', { class: 'none', role: 'option', 'aria-disabled': 'true' }, 'Nema mesta sa tim imenom u ponudi')]));
      list.hidden = !input.value.trim(); input.setAttribute('aria-expanded', list.hidden ? 'false' : 'true'); active = -1;
    };
    input.addEventListener('input', open);
    input.addEventListener('focus', () => { if (input.value.trim() && !items.length) open(); });
    input.addEventListener('blur', () => setTimeout(close, 120));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); if (list.hidden) open(); active = Math.min(items.length - 1, active + 1); paintActive(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active = Math.max(0, active - 1); paintActive(); }
      else if (e.key === 'Enter') { if (!list.hidden && items.length) { e.preventDefault(); pick(items[Math.max(0, active)]); } }
      else if (e.key === 'Escape') { close(); }
    });
    return { node: el('div', { class: 'tl-combo' }, el('div', { class: 'tl-inp' }, icon('search', 16), input), list), input };
  }

  /* ═════════════════════════ #/procena ═════════════════════════ */
  const ADJ = [
    [(l) => l.fl === 0 && l.pt === 'stan', -5, 'Prizemlje'],
    [(l) => l.pt === 'stan' && l.tf >= 4 && l.fl === l.tf && !l.am.includes('hasElevator'), -4, 'Poslednji sprat bez lifta'],
    [(l) => l.co === 'lux', 8, 'Lux stanje'],
    [(l) => l.co === 'renovirano', 4, 'Renovirano'],
    [(l) => l.co === 'novogradnja', 3, 'Novogradnja'],
    [(l) => l.co === 'potrebno-renoviranje', -8, 'Potrebno renoviranje'],
    [(l) => ['ta-pec', 'struja', 'klima'].includes(l.he), -3, 'Grejanje na struju / TA'],
    [(l) => ['centralno', 'podno', 'toplotna-pumpa'].includes(l.he), 2, 'Centralno / podno grejanje'],
    [(l) => l.am.includes('hasTerrace'), 2, 'Terasa'],
    [(l) => l.y != null && l.y < 1965, -3, 'Gradnja pre 1965.'],
  ];
  const LEGAL = [{ v: 'uknjizeno', l: 'Uknjiženo' }, { v: 'u-procesu', l: 'U procesu uknjižavanja' }, { v: 'poseban-zakon', l: 'Upisano po Zakonu 2025' }, { v: 'nije', l: 'Nije uknjiženo' }];
  const STEPS = ['Lokacija', 'Nekretnina', 'Stanje', 'Rezultat'];

  function viewValuation(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(q || '');
    const PL = places();
    const S = {
      st: clamp(Math.round(qnum(q, 'st', 0, 0, 3)), 0, 3), cur: qget(q, 'cur') === 'rsd' ? 'rsd' : 'eur',
      c: qget(q, 'c', ''), m: qget(q, 'm', ''), n: qget(q, 'n', ''),
      pt: qget(q, 'pt') === 'kuca' ? 'kuca' : 'stan', a: qnum(q, 'a', null, 10, 2000), ro: qnum(q, 'ro', 2, 0.5, 5),
      fl: Math.round(qnum(q, 'fl', 2, -1, 40)), tf: Math.round(qnum(q, 'tf', 5, 0, 40)), y: Math.round(qnum(q, 'y', 1985, 1850, 2028)),
      co: COND[qget(q, 'co', '')] ? qget(q, 'co') : 'dobro-stanje', he: HEAT[qget(q, 'he', '')] ? qget(q, 'he') : 'centralno',
      li: qbool(q, 'li', true), te: qbool(q, 'te', false), rg: LEGAL.some((x) => x.v === qget(q, 'rg')) ? qget(q, 'rg') : 'uknjizeno',
    };
    if (!PL.cities.some((c) => c.s === S.c)) { S.c = ''; S.m = ''; S.n = ''; }
    if (S.m && !PL.muns.some((x) => x.s === S.m && x.cs === S.c)) S.m = '';
    if (S.n && !PL.nbhds.some((x) => x.s === S.n && x.cs === S.c)) S.n = '';
    if (S.st > 0 && !S.c) S.st = 0;
    if (S.st > 1 && !(S.a > 0)) S.st = 1;
    const m = moneyFmt(S.cur);
    const params = () => ({ st: S.st || '', cur: S.cur === 'rsd' ? 'rsd' : '', c: S.c, m: S.m, n: S.n, pt: S.pt === 'kuca' ? 'kuca' : '', a: S.a || '', ro: S.ro, fl: S.pt === 'stan' ? S.fl : '', tf: S.tf, y: S.y, co: S.co, he: S.he, li: S.li ? 1 : 0, te: S.te ? 1 : 0, rg: S.rg });
    const save = () => syncHash('/procena', params());
    const body = el('div', { class: 'tl-val-body' });
    const stepWrap = el('div', { class: 'tl-steps' });
    const go = (st) => { S.st = st; save(); paint(); const h = body.querySelector('h2'); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); } const top = root.querySelector('.tl-steps'); if (top && top.getBoundingClientRect().top < 0) top.scrollIntoView({ block: 'start' }); };
    const navRow = (backTo, nextLabel) => el('div', { class: 'btn-row tl-stepnav' },
      backTo != null ? el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(backTo) }, icon('arrow-left'), 'Nazad') : null,
      nextLabel ? el('button', { type: 'submit', class: 'btn btn-primary' }, nextLabel, icon('arrow-right')) : null);

    function stepLocation() {
      const city = PL.cities.find((c) => c.s === S.c);
      const mun = PL.muns.find((x) => x.s === S.m);
      const nbhd = PL.nbhds.find((x) => x.s === S.n && x.cs === S.c);
      const err = el('p', { class: 'help err', id: 'tl-loc-err', hidden: true }, 'Izaberi bar grad da bismo našli uporedive oglase.');
      const combo = placeCombo((p) => {
        S.c = p.cs; S.m = p.kind === 'city' ? '' : p.ms || ''; S.n = p.kind === 'nbhd' ? p.s : '';
        save(); paint();
        const nx = body.querySelector('.tl-stepnav .btn-primary'); if (nx) nx.focus();
      }, nbhd ? nbhd.name : mun ? mun.name : city ? city.name : '');
      combo.input.setAttribute('aria-describedby', 'tl-loc-err');
      const majors = PL.cities.filter((c) => (D.cities.find((x) => x.s === c.s) || {}).maj).sort((a, b) => b.n - a.n);
      const munsOf = city ? PL.muns.filter((x) => x.cs === city.s).sort((a, b) => b.n - a.n) : [];
      const nbOf = mun ? PL.nbhds.filter((x) => x.ms === mun.s && x.cs === S.c).sort((a, b) => b.n - a.n) : [];
      return el('form', { class: 'tl-form tl-step', novalidate: true, onsubmit: (e) => { e.preventDefault(); if (!S.c) { err.hidden = false; combo.input.setAttribute('aria-invalid', 'true'); combo.input.focus(); return; } go(1); } },
        el('h2', { class: 't-h2s' }, 'Gde se nalazi nekretnina?'),
        el('p', { class: 'meta' }, 'Što preciznije — naselje daje najbliže uporedive oglase. Ulica i broj nisu potrebni.'),
        el('div', { class: 'fld tl-fld wide' }, el('label', { class: 'lbl', for: combo.input.id }, 'Grad, opština ili naselje'), combo.node, err),
        city ? el('p', { class: 'tl-loc num' }, icon('pin', 16), el('b', {}, city.name), mun ? [' › ', el('b', {}, mun.name)] : null, nbhd ? [' › ', el('b', {}, nbhd.name)] : null,
          el('button', { type: 'button', class: 'btn-link tl-clear', onclick: () => { S.c = S.m = S.n = ''; save(); paint(); } }, 'Promeni')) : null,
        el('div', { class: 'fld tl-fld wide' }, el('span', { class: 'lbl' }, city ? (mun ? 'Naselje (opciono)' : 'Opština (opciono)') : 'Brzo: veći gradovi'),
          el('div', { class: 'pr tl-pills' }, (city ? (mun ? nbOf : munsOf) : majors).slice(0, 14).map((p) => el('button', {
            type: 'button', class: 'chip' + ((p.kind === 'nbhd' && p.s === S.n) || (p.kind === 'mun' && p.s === S.m) ? ' on' : ''), 'aria-pressed': (p.kind === 'nbhd' && p.s === S.n) || (p.kind === 'mun' && p.s === S.m) ? 'true' : 'false',
            onclick: () => { if (p.kind === 'city') { S.c = p.s; S.m = S.n = ''; } else if (p.kind === 'mun') { S.m = p.s; S.n = ''; } else { S.n = p.s === S.n ? '' : p.s; } save(); paint(); },
          }, p.name, el('span', { class: 'n' }, String(p.n)))))),
        navRow(null, 'Dalje: nekretnina'));
    }
    function stepProperty() {
      const fA = numField({ label: 'Kvadratura', unit: 'm²', plain: true, value: S.a, min: 10, max: 2000, step: 1, hardMax: 2000, placeholder: 'npr. 58', onChange: (v) => { S.a = v; save(); } });
      const fTf = numField({ plain: true, label: S.pt === 'kuca' ? 'Broj etaža' : 'Ukupno spratova u zgradi', unit: S.pt === 'kuca' ? 'etaže' : 'spratova', value: S.tf, min: 0, max: 40, step: 1, hardMax: 40, onChange: (v) => { S.tf = Math.round(v); save(); } });
      const fY = numField({ label: 'Godina izgradnje', plain: true, value: S.y, min: 1850, max: 2028, step: 1, hardMax: 2028, onChange: (v) => { S.y = Math.round(v); save(); } });
      const floorOpts = [{ v: -1, l: 'Suteren' }, { v: 0, l: 'Prizemlje' }].concat(Array.from({ length: 30 }, (_, i) => ({ v: i + 1, l: `${i + 1}. sprat` })));
      return el('form', { class: 'tl-form tl-step', novalidate: true, onsubmit: (e) => { e.preventDefault(); if (!(S.a >= 10 && S.a <= 2000)) { fA.setErr('Upiši kvadraturu između 10 i 2.000 m².'); fA.input.focus(); return; } go(2); } },
        el('h2', { class: 't-h2s' }, 'Kakva je nekretnina?'),
        choice('Tip', [{ v: 'stan', l: 'Stan' }, { v: 'kuca', l: 'Kuća' }], S.pt, (v) => { S.pt = v; save(); paint(); }),
        el('div', { class: 'tl-grid2' }, fA.node, selField('Struktura', (typeof ROOMS !== 'undefined' ? ROOMS : [[2, 'Dvosoban']]).map(([v, l]) => ({ v, l })), S.ro, (v) => { S.ro = +v; save(); })),
        el('div', { class: 'tl-grid2' }, S.pt === 'stan' ? selField('Sprat', floorOpts, S.fl, (v) => { S.fl = +v; save(); }) : null, fTf.node),
        el('div', { class: 'tl-grid2' }, fY.node),
        navRow(0, 'Dalje: stanje'));
    }
    function stepCondition() {
      return el('form', { class: 'tl-form tl-step', novalidate: true, onsubmit: (e) => { e.preventDefault(); go(3); } },
        el('h2', { class: 't-h2s' }, 'U kakvom je stanju?'),
        choice('Stanje', Object.entries(COND).map(([v, l]) => ({ v, l })), S.co, (v) => { S.co = v; save(); }),
        el('div', { class: 'tl-grid2' }, selField('Grejanje', Object.entries(HEAT).map(([v, l]) => ({ v, l })), S.he, (v) => { S.he = v; save(); })),
        el('div', { class: 'tl-toggles' },
          S.pt === 'stan' ? toggle(S.li, (on) => { S.li = on; save(); }, { label: 'Zgrada ima lift' }) : null,
          toggle(S.te, (on) => { S.te = on; save(); }, { label: 'Terasa ili lođa' })),
        choice('Uknjiženost', LEGAL, S.rg, (v) => { S.rg = v; save(); }),
        navRow(1, 'Izračunaj procenu'));
    }
    function compute() {
      const city = PL.cities.find((c) => c.s === S.c) || {};
      const mun = PL.muns.find((x) => x.s === S.m) || null;
      const nbhd = PL.nbhds.find((x) => x.s === S.n && x.cs === S.c) || null;
      const at = nbhd || mun || city;
      const am = [S.li && S.pt === 'stan' ? 'hasElevator' : null, S.te ? 'hasTerrace' : null].filter(Boolean);
      const key = JSON.stringify([S.c, S.m, S.n, S.pt, S.a, S.ro, S.fl, S.tf, S.y, S.co, S.he, S.li, S.te]);
      const l = {
        s: 'procena-' + (typeof hash === 'function' ? hash(key) : key.length), r: '', t: 'prodaja', pt: S.pt, p: Math.round(S.a * 1500), a: S.a, la: null, ro: S.ro,
        fl: S.pt === 'stan' ? S.fl : null, tf: S.tf, y: S.y, co: S.co, he: S.he, en: null, or: null, c: city.c || city.name, cs: S.c, m: mun ? mun.name : '', ms: S.m, n: nbhd ? nbhd.name : '', ns: S.n,
        lat: at.lat, lng: at.lng, am, dz: 0, neg: false, ags: 'procena', ag: 'Procena', reg: S.rg !== 'nije', pr: 'NONE', v: 0, fv: 0, im: 0,
      };
      const F = hasKX() ? safe(() => KX.fair(l), null) : null;
      let est = F && F.estimate ? F.estimate : null, kind = 'comps', basis = '', adjustments = F && F.adjustments ? F.adjustments : [];
      if (est) basis = `${F.n} ${plural(F.n, 'uporediv oglas', 'uporediva oglasa', 'uporedivih oglasa')} u blizini, težinska medijana ${nf0.format(F.basePpm)} €/m²`;
      else {
        let ref = safe(() => stats.refPpm(l), null);
        /* opština/grad ispod 5 oglasa: medijana grada je bliža od nacionalne ako ima bar 3 oglasa */
        if (!ref || ref.scope === 'all') {
          const cityPpm = D.listings.filter((x) => x.t === 'prodaja' && x.pt === S.pt && x.cs === S.c && x.ppm > 0).map((x) => x.ppm);
          if (cityPpm.length >= 3) ref = { ppm: med(cityPpm), n: cityPpm.length, label: city.c || city.name, scope: 'city' };
          else if (ref) ref = { ...ref, label: 'celu Srbiju' };
        }
        if (ref && ref.ppm) {
          kind = 'grubo';
          adjustments = ADJ.filter(([t]) => t(l)).map(([, p, label]) => ({ label, pct: p }));
          const ppm = ref.ppm * adjustments.reduce((x, a) => x * (1 + a.pct / 100), 1);
          const mid = Math.round(ppm * S.a);
          est = { low: Math.round(mid * 0.9), mid, high: Math.round(mid * 1.1), ppm: Math.round(ppm) };
          basis = `premalo uporedivih oglasa u blizini — korišćena medijana za ${ref.label} (${nf0.format(ref.ppm)} €/m², n=${ref.n}), raspon ±10 %`;
        }
      }
      if (est) { l.ppm = est.ppm; l.p = est.mid; }
      return { l, F, est, kind, basis, adjustments, city, mun, nbhd };
    }
    function stepResult() {
      const R = compute();
      const { l, F, est } = R;
      if (!est) {
        return el('div', { class: 'tl-step' }, el('h2', { class: 't-h2s' }, 'Procena nije moguća'),
          el('p', { class: 'lede' }, 'Za ovu lokaciju i tip nemamo dovoljno oglasa za poređenje. Izaberi širu lokaciju ili drugi tip.'),
          navRow(0, null));
      }
      const round = (v) => Math.round(v / 500) * 500;
      const placeName = [R.nbhd && R.nbhd.name, R.mun && R.mun.name, R.city.name].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(', ');
      const muns = safe(() => stats.munIndex(S.c, 'prodaja', S.pt), []) || [];
      const cityPpm = med(D.listings.filter((x) => x.t === 'prodaja' && x.pt === S.pt && x.cs === S.c && x.ppm > 0).map((x) => x.ppm));
      const comps = (F && F.comps ? F.comps : []).slice(0, 8);
      const lst = (s) => (typeof find !== 'undefined' && find.listing ? find.listing(s) : D.listings.find((x) => x.s === s));
      const postHref = typeof router !== 'undefined' ? router.href('/postavi', { t: 'prodaja', pt: S.pt, p: round(est.mid), a: S.a, ro: S.ro, c: S.c, m: S.m, n: S.n, fl: S.pt === 'stan' ? S.fl : '', tf: S.tf, y: S.y, co: S.co, he: S.he }) : '#/postavi';
      const trend = trendFor(D.listings.filter((x) => x.t === 'prodaja' && x.pt === S.pt && x.cs === S.c && (!S.m || x.ms === S.m) && x.a > 0 && x.p > 0));
      const trendScope = trend && trend.n >= 5 ? (S.m && R.mun ? R.mun.name : R.city.name) : null;
      const trendCity = trendScope ? trend : trendFor(D.listings.filter((x) => x.t === 'prodaja' && x.pt === S.pt && x.cs === S.c && x.a > 0 && x.p > 0));
      const merNode = safe(() => merilo(l), null);
      return el('div', { class: 'tl-step tl-result' },
        el('div', { class: 'tl-res-top' },
          el('div', { class: 'tl-range' },
            el('h2', { class: 'eyebrow' }, `Procenjena vrednost · ${placeName}`),
            el('p', { class: 'tl-big tl-big-range num' }, `${m(round(est.low))} – ${m(round(est.high))}`),
            el('p', { class: 'tl-sub num' }, `sredina ${m(round(est.mid))} · ${m(est.ppm, '/m²')} · ${nf0.format(S.a)} m², ${String(safe(() => fmt.rooms(S.ro), S.ro)).toLowerCase()}`),
            merNode,
            el('p', { class: 'meta tl-basis' }, R.kind === 'grubo' ? el('b', {}, 'Gruba procena: ') : el('b', {}, 'Osnov: '), R.basis + '.'),
            R.adjustments.length ? el('ul', { class: 'tl-adj' }, R.adjustments.map((a) => el('li', {}, el('span', {}, a.label), el('b', { class: 'num' }, pct(a.pct, true))))) : null,
            S.rg !== 'uknjizeno' ? el('p', { class: 'tl-note note-rule' }, S.rg === 'nije' ? 'Neuknjiženu nekretninu banke ne kreditiraju, pa je krug kupaca uži (samo keš) i cena se u praksi spušta. Procena to ne uračunava.' : 'Uknjižba u toku ili upis po Zakonu 2025: finansiranje zavisi od banke — neki kupci neće moći na kredit.') : null),
          el('aside', { class: 'tl-honest' },
            el('p', { class: 'label' }, 'Šta ova procena jeste, a šta nije'),
            el('p', {}, 'Računamo je iz ', el('b', {}, 'traženih cena'), ' sličnih oglasa na Kvadrat.rs, ne iz ostvarenih prodaja. Stvarne kupoprodajne cene su u proseku 10–20 % niže od traženih. Ovo nije procena ovlašćenog procenitelja.'),
            extLink('https://katastar.rgz.gov.rs/eKatastarPublic/', 'Proveri besplatnu procenu RGZ (eKatastar)'),
            el('div', { class: 'btn-row' },
              el('a', { class: 'btn btn-primary', href: postHref }, 'Postavi oglas sa ovom cenom'),
              el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(1) }, 'Izmeni podatke')))),
        el('div', { class: 'tl-mgrid' },
        muns.length >= 2 ? el('section', { class: 'tl-sec' },
          el('h3', { class: 't-h2s' }, `Cena po m² u opštinama — ${R.city.name}`),
          el('p', { class: 'meta' }, `${S.pt === 'kuca' ? 'Kuće' : 'Stanovi'} na prodaju, medijana tražene cene; tamna traka je tvoja opština.`),
          bars(muns.slice(0, 12).map((x) => ({ label: x.m, value: x.ppm, n: x.n, me: x.ms === S.m })).concat(muns.slice(0, 12).some((x) => x.ms === S.m) || !S.m ? [] : (muns.filter((x) => x.ms === S.m).map((x) => ({ label: x.m, value: x.ppm, n: x.n, me: true })))), { ref: cityPpm ? { value: cityPpm, label: 'grad' } : null, format: (v) => m(v, '/m²') }),
          el('p', { class: 'tl-src' }, 'Izvor: oglasi na Kvadrat.rs (tražene cene); n = broj oglasa.')) : null,
        trendCity && trendCity.n >= 5 ? el('section', { class: 'tl-sec' },
          sparkline(trendCity.values, { title: el('span', {}, 'Tražene cene po m² · ', el('b', {}, trendScope || R.city.name), ' · 12 meseci'), months: trendCity.months, delta: deltaNode(trendCity.d12), format: (v) => m(v, '/m²'), source: 'Izvor: istorija cena oglasa na Kvadrat.rs; indeks istih oglasa iz meseca u mesec.' })) : null),
        comps.length ? el('section', { class: 'tl-sec' },
          el('h3', { class: 't-h2s' }, 'Uporedivi oglasi'),
          el('p', { class: 'meta' }, R.kind === 'grubo' ? 'Najbliži oglasi po lokaciji i veličini — nedovoljno blizu za pouzdanu procenu, prikazani radi provere.' : 'Najbliži po lokaciji, kvadraturi i strukturi; sa ovim oglasima računamo procenu.'),
          el('div', { class: 'table-wrap' }, el('table', { class: 'table tl-comps' },
            el('thead', {}, el('tr', {}, ['Oglas', 'Naselje', 'm²', 'Sobe', 'Sprat', 'Godina', '€/m²', 'Udaljenost'].map((h, i) => el('th', { scope: 'col', class: i >= 2 ? 'num' : null }, h)))),
            el('tbody', {}, comps.map((c) => { const L = lst(c.s) || {}; return el('tr', {},
              el('td', {}, el('a', { class: 'ttl link', href: typeof UI_HREF !== 'undefined' ? UI_HREF.listing(c.s) : '#/oglas?s=' + c.s }, c.r || L.r || 'Oglas')),
              el('td', {}, c.n || L.n || '—'),
              el('td', { class: 'num' }, c.a ? nf0.format(c.a) : '—'),
              el('td', { class: 'num' }, c.ro != null ? safe(() => fmt.roomsN(c.ro), c.ro) : '—'),
              el('td', { class: 'num' }, c.fl != null ? safe(() => fmt.floor(c.fl, L.tf), c.fl) : '—'),
              el('td', { class: 'num' }, c.y ? String(c.y) : '—'),
              el('td', { class: 'num' }, el('b', {}, m(c.ppm, '/m²'))),
              el('td', { class: 'num' }, c.km != null ? nf1.format(c.km) + ' km' : '—')); })))),
          el('p', { class: 'tl-src' }, 'Izvor: aktivni oglasi na Kvadrat.rs; udaljenost je vazdušna linija.')) : null,
        el('div', { class: 'btn-row tl-stepnav' }, el('button', { type: 'button', class: 'btn btn-ghost', onclick: () => go(0) }, icon('refresh'), 'Nova procena')));
    }
    function paint() {
      put(stepWrap, stepper(STEPS, S.st));
      put(body, [stepLocation, stepProperty, stepCondition, stepResult][S.st]());
    }
    const root = el('div', { class: 'wrap tl tl-page-val' },
      toolsHead('/procena', 'Koliko vredi moj stan?', 'Procena iz uporedivih oglasa u četiri koraka — sa rasponom, poređenjem sa opštinom i oglasima iz kojih je izračunata.', S.cur,
        (v) => { S.cur = v; clearTimeout(hashTimers['/procena']); const p = params(); p.cur = v; syncHash('/procena', p); remount(root, viewValuation(new URLSearchParams(Object.entries(p).filter(([, x]) => x !== '' && x != null).map(([k, x]) => [k, String(x)]))), '.tl-cur .seg button[aria-pressed="true"]'); }),
      stepWrap, body);
    paint();
    return root;
  }

  /* ═════════════════════════ trend iz istorije oglasa ═════════════════════════ */
  /* lančani indeks: za svaki mesec prosečan odnos cene istih oglasa prema prethodnom mesecu; skaliran na današnju medijanu €/m² */
  function trendFor(list) {
    list = list.filter((l) => l.a > 0 && l.p > 0);
    if (!list.length) return null;
    const H = list.map((l) => (hasKX() ? safe(() => KX.history(l), null) : null) || { points: safe(() => mock.history(l).map((x) => ({ m: x.m, p: x.p, listed: true })), []), changes: [] });
    const base = H.find((h) => h.points && h.points.length === 12);
    if (!base) return null;
    const months = base.points.map((x) => x.m);
    const idx = [1];
    for (let i = 1; i < 12; i++) {
      let s = 0, k = 0;
      for (const h of H) { const a = h.points[i - 1], b = h.points[i]; if (a && b && a.listed !== false && b.listed !== false && a.p > 0) { s += b.p / a.p; k++; } }
      idx.push(idx[i - 1] * (k ? s / k : 1));
    }
    const now = med(list.map((l) => l.p / l.a));
    const values = idx.map((v) => now * v / idx[11]);
    const drops = H.filter((h) => h.changes && h.changes.length);
    const avgDrop = drops.length ? drops.reduce((t, h) => t + (h.changes[0].pct || 0), 0) / drops.length : 0;
    return { months, values, d12: (idx[11] / idx[0] - 1) * 100, n: list.length, drops: drops.length, avgDrop };
  }
  function deltaNode(p) {
    if (p == null || !isFinite(p)) return null;
    return safe(() => deltaChip({ pct: Math.round(p * 10) / 10, label: '12 meseci', n: 99 }, { title: `Promena za 12 meseci: ${pct(p, true)}` }), null);
  }

  /* ═════════════════════════ #/trziste ═════════════════════════ */
  const STRUCT = [['Garsonjera', (r) => r <= 0.5, 'garsonjera'], ['Jednosoban', (r) => r > 0.5 && r < 2, 'jednosobnih stanova'], ['Dvosoban', (r) => r >= 2 && r < 3, 'dvosobnih stanova'], ['Trosoban', (r) => r >= 3 && r < 4, 'trosobnih stanova'], ['Četvorosoban i veći', (r) => r >= 4, 'četvorosobnih i većih stanova']];
  const ROOM_PARAM = [['0.5'], ['1', '1.5'], ['2', '2.5'], ['3', '3.5'], ['4+']];
  function viewMarket(q) {
    q = q instanceof URLSearchParams ? q : new URLSearchParams(q || '');
    const cityCount = new Map();
    D.listings.forEach((l) => { if (l.pt === 'stan') cityCount.set(l.cs, (cityCount.get(l.cs) || 0) + 1); });
    const S = {
      c: D.cities.some((c) => c.s === qget(q, 'c')) ? qget(q, 'c') : 'beograd',
      t: qget(q, 't') === 'izdavanje' ? 'izdavanje' : 'prodaja',
      per: qget(q, 'per') === '90' ? '90' : 'sve',
      cur: qget(q, 'cur') === 'rsd' ? 'rsd' : 'eur',
    };
    const m = moneyFmt(S.cur);
    const majors = typeof CITIES_MAJOR !== 'undefined' ? CITIES_MAJOR : D.cities.filter((c) => c.maj);
    const others = D.cities.filter((c) => !majors.some((x) => x.s === c.s) && cityCount.get(c.s)).sort((a, b) => a.n.localeCompare(b.n, 'sr'));
    const params = () => ({ c: S.c === 'beograd' ? '' : S.c, t: S.t === 'izdavanje' ? 'izdavanje' : '', per: S.per === '90' ? '90' : '', cur: S.cur === 'rsd' ? 'rsd' : '' });
    const content = el('div', { class: 'tl-mkt' });
    const isNew = (l) => l.co === 'novogradnja' || l.co === 'u-izgradnji';
    const pool = (cs) => D.listings.filter((l) => l.cs === cs && l.t === S.t && l.pt === 'stan' && l.ppm > 0 && (S.per === 'sve' || l.dz <= 90));

    function paint() {
      syncHash('/trziste', params());
      const unitP = S.t === 'izdavanje' ? '/mes' : '';
      const city = D.cities.find((c) => c.s === S.c);
      const L = pool(S.c);
      const n = L.length;
      const ppmMed = med(L.map((l) => l.ppm));
      const pMed = med(L.map((l) => l.p));
      const aMed = med(L.map((l) => l.a));
      const newShare = n ? L.filter(isNew).length / n * 100 : null;
      const tr = trendFor(L);
      const loc = city ? city.loc : '';
      const kind = S.t === 'izdavanje' ? 'izdavanje' : 'prodaja';
      /* opštine */
      const byMun = new Map();
      L.forEach((l) => { if (!l.ms) return; const x = byMun.get(l.ms) || { m: l.m, ms: l.ms, v: [] }; x.v.push(l.ppm); byMun.set(l.ms, x); });
      const munRows = [...byMun.values()].filter((x) => x.v.length >= 2).map((x) => ({ label: x.m, value: med(x.v), n: x.v.length, ms: x.ms })).sort((a, b) => b.value - a.value);
      /* struktura */
      const struct = STRUCT.map(([label, test, gen], i) => { const g = L.filter((l) => l.ro != null && test(l.ro)); return { label, gen, n: g.length, ppm: med(g.map((l) => l.ppm)), p: med(g.map((l) => l.p)), a: med(g.map((l) => l.a)), ro: ROOM_PARAM[i] }; });
      const searchHref = (extra) => (typeof router !== 'undefined' ? router.href('/pretraga', { t: S.t, pt: ['stan'], c: S.c, ...(extra || {}) }) : '#/pretraga');
      /* komentar */
      const top = munRows[0], low = munRows[munRows.length - 1];
      const commonest = struct.filter((x) => x.n).sort((a, b) => b.n - a.n)[0];
      const sents = [];
      if (n) sents.push(`U ${loc} je medijana tražene ${S.t === 'izdavanje' ? 'kirije' : 'cene'} ${m(ppmMed, '/m²')}${S.t === 'izdavanje' ? ' mesečno' : ''}, a tipičan stan u ponudi ima ${nf0.format(aMed)} m² i ${S.t === 'izdavanje' ? 'kiriju' : 'cenu'} od ${m(pMed, unitP)}.`);
      const dropped = (k) => `${k} ${plural(k, 'oglas je snizio', 'oglasa su snizila', 'oglasa je snizilo')} cenu, u proseku ${pct(tr.avgDrop)}`;
      if (tr && tr.n >= 5) sents.push(Math.abs(tr.d12) < 0.5 ? 'Tražene cene istih oglasa su za godinu dana praktično nepromenjene' + (tr.drops ? ` — ${dropped(tr.drops)}.` : '.') : `Za 12 meseci tražene cene istih oglasa promenile su se za ${pct(tr.d12, true)}${tr.drops ? `; ${dropped(tr.drops)}` : ''}.`);
      if (top && low && top !== low) sents.push(`Najskuplja opština u ponudi je ${top.label} (${m(top.value, '/m²')}, n=${top.n}), najpovoljnija ${low.label} (${m(low.value, '/m²')}, n=${low.n}).`);
      if (newShare != null && n) sents.push(`Novogradnja čini ${nf0.format(newShare)} % ponude${commonest ? `, a najviše je ${commonest.gen} (${commonest.n})` : ''}.`);
      if (n && n < 15) sents.push(`Uzorak je mali (${n} ${plural(n, 'oglas', 'oglasa', 'oglasa')}), pa brojeve čitaj kao orijentir, ne kao statistiku.`);
      /* gradovi */
      const cityRows = majors.map((c) => { const P = pool(c.s); const t2 = trendFor(P); return { c, n: P.length, ppm: med(P.map((l) => l.ppm)), tr: t2 }; }).filter((x) => x.n);

      put(content, 
        el('div', { class: 'tl-tiles' }, n ? tiles([
          { v: m(ppmMed, '/m²'), l: S.t === 'izdavanje' ? 'medijana kirije po m²' : 'prosečno €/m² (medijana)', delta: tr && tr.n >= 5 ? deltaNode(tr.d12) : null },
          { v: m(pMed, unitP), l: S.t === 'izdavanje' ? 'medijana kirije' : 'medijana cene' },
          { v: nf0.format(aMed) + ' m²', l: 'medijana kvadrature' },
          { v: nf0.format(newShare) + ' %', l: 'udeo novogradnje' },
          { v: nf0.format(n), l: `${plural(n, 'oglas', 'oglasa', 'oglasa')} u uzorku` },
        ]) : empty('Nema oglasa za ovaj izbor', 'Za ovaj grad i period nema stanova u ponudi. Probaj „Svi aktivni oglasi“ ili drugi grad.', 'Svi aktivni oglasi', null, { onClick: () => { S.per = 'sve'; paint(); } })),
        n ? el('div', { class: 'tl-mgrid' },
          el('section', { class: 'tl-sec tl-trend' },
            sparkline(tr && tr.n >= 5 ? tr.values : [], { title: el('span', {}, `Tražene cene po m² — ${city ? city.n : ''} · `, el('b', {}, '12 meseci')), months: tr ? tr.months : [], delta: tr && tr.n >= 5 ? deltaNode(tr.d12) : null, format: (v) => m(v, '/m²'), aria: tr ? `Tražene cene po m² u ${loc} za 12 meseci: ${pct(tr.d12, true)}` : null }),
            el('p', { class: 'tl-src' }, 'tražene cene · indeks istih oglasa iz meseca u mesec, skaliran na današnju medijanu')),
          el('section', { class: 'tl-sec tl-comment' },
            el('p', { class: 'label' }, 'Ukratko'),
            el('p', { class: 'tl-lede' }, sents.join(' ')),
            el('a', { class: 'btn btn-secondary', href: searchHref() }, `Pogledaj ${n} ${plural(n, 'stan', 'stana', 'stanova')} u ${loc}`, icon('arrow-right')))) : null,
        n ? el('div', { class: 'tl-mgrid' },
          el('section', { class: 'tl-sec' },
            el('h2', { class: 't-h2s' }, 'Cena po m² po opštinama'),
            munRows.length >= 2 ? [bars(munRows.slice(0, 14), { ref: { value: ppmMed, label: 'grad' }, format: (v) => m(v, '/m²') }),
              el('p', { class: 'meta tl-small' }, 'Opštine sa najmanje 2 oglasa; n = broj oglasa.')]
              : el('p', { class: 'meta' }, `Za ${city ? city.n : 'ovaj grad'} nema dovoljno oglasa po opštinama (potrebno bar 2 po opštini).`),
            el('p', { class: 'tl-src' }, srcLine())),
          el('section', { class: 'tl-sec' },
            el('h2', { class: 't-h2s' }, 'Cena po strukturi'),
            el('div', { class: 'table-wrap' }, el('table', { class: 'table tl-struct' },
              el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Struktura'), el('th', { scope: 'col', class: 'num' }, '€/m²'), el('th', { scope: 'col', class: 'num' }, S.t === 'izdavanje' ? 'Kirija' : 'Cena'), el('th', { scope: 'col', class: 'num' }, 'm²'), el('th', { scope: 'col', class: 'num' }, 'n'))),
              el('tbody', {}, struct.map((x) => el('tr', {},
                el('td', {}, x.n ? el('a', { class: 'link', href: searchHref({ ro: x.ro }) }, x.label) : el('span', { class: 'muted' }, x.label)),
                el('td', { class: 'num' }, x.n ? el('b', {}, m(x.ppm, '/m²')) : '—'),
                el('td', { class: 'num' }, x.n ? m(x.p, unitP) : '—'),
                el('td', { class: 'num' }, x.n ? nf0.format(x.a) : '—'),
                el('td', { class: 'num muted' }, String(x.n))))))),
            el('p', { class: 'tl-src' }, 'Medijane; ' + srcLine()))) : null,
        el('section', { class: 'tl-sec' },
          el('h2', { class: 't-h2s' }, 'Veći gradovi'),
          el('div', { class: 'table-wrap' }, el('table', { class: 'table tl-cities' },
            el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Grad'), el('th', { scope: 'col', class: 'num' }, '€/m²'), el('th', { scope: 'col', class: 'num' }, 'Δ 12 m'), el('th', { scope: 'col' }, el('span', { class: 'sr' }, 'Trend 12 meseci')), el('th', { scope: 'col', class: 'num' }, 'n'))),
            el('tbody', {}, cityRows.map((x) => el('tr', { class: x.c.s === S.c ? 'on' : null },
              el('td', {}, el('button', { type: 'button', class: 'tl-cbtn', 'aria-pressed': x.c.s === S.c ? 'true' : 'false', onclick: () => { S.c = x.c.s; paintCity(); window.scrollTo({ top: Math.max(0, root.offsetTop - 70), behavior: 'smooth' }); } }, x.c.n)),
              el('td', { class: 'num' }, el('b', {}, m(x.ppm, '/m²'))),
              el('td', { class: 'num' }, x.tr && x.tr.n >= 5 ? deltaNode(x.tr.d12) || '—' : el('span', { class: 'muted' }, 'malo podataka')),
              el('td', { class: 'tl-minic' }, x.tr && x.tr.n >= 5 ? mini(x.tr.values) : null),
              el('td', { class: 'num muted' }, String(x.n))))))),
          el('p', { class: 'tl-src' }, srcLine())),
        el('p', { class: 'tl-foot' }, `Izvor: oglasi na Kvadrat.rs, ${S.per === '90' ? 'poslednjih 90 dana' : 'svi aktivni oglasi'} (tražene, ne ostvarene cene) · RGZ indeks cena: zvanična statistika `, extLink('https://www.rgz.gov.rs/', 'rgz.gov.rs')));
    }
    function srcLine() { return `Izvor: oglasi na Kvadrat.rs, ${S.per === '90' ? 'poslednjih 90 dana' : 'svi aktivni oglasi'}`; }
    function mini(vals) {
      const w = 96, h = 28, mn = Math.min(...vals), mx = Math.max(...vals), sp = (mx - mn) || 1;
      const pts = vals.map((v, i) => `${(i * (w - 4) / (vals.length - 1) + 2).toFixed(1)},${(h - 4 - (v - mn) / sp * (h - 8)).toFixed(1)}`).join(' ');
      return el('span', { class: 'tl-mini', 'aria-hidden': 'true', html: `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><polyline points="${pts}"/></svg>` });
    }
    const cityPills = pills(majors.filter((c) => cityCount.get(c.s)).map((c) => ({ v: c.s, l: c.n })), [S.c], (v) => { S.c = v; paintCity(); }, { single: true });
    cityPills.classList.add('rail', 'tl-crail');
    cityPills.setAttribute('aria-label', 'Grad');
    const otherSel = select([{ v: '', l: 'Ostali gradovi…' }].concat(others.map((c) => ({ v: c.s, l: `${c.n} (${cityCount.get(c.s)})` }))), majors.some((x) => x.s === S.c) ? '' : S.c, (v) => { if (v) { S.c = v; paintCity(); } }, { label: 'Ostali gradovi' });
    const h1 = el('h1', { class: 't-h1' });
    const setTitle = () => { const c = D.cities.find((x) => x.s === S.c); h1.textContent = `Cene stanova u ${c ? c.loc : 'Srbiji'}`; };
    function paintCity() { cityPills.set([S.c]); otherSel.value = majors.some((x) => x.s === S.c) ? '' : S.c; setTitle(); paint(); }
    const head = toolsHead('/trziste', '', 'Tražene cene iz oglasa po gradovima, opštinama i strukturi — sa trendom za 12 meseci i brojem oglasa uz svaku cifru.', S.cur,
      (v) => { S.cur = v; clearTimeout(hashTimers['/trziste']); const p = params(); remount(root, viewMarket(new URLSearchParams(Object.entries(p).filter(([, x]) => x).map(([k, x]) => [k, String(x)]))), '.tl-cur .seg button[aria-pressed="true"]'); });
    head.querySelector('h1').replaceWith(h1);
    setTitle();
    const tSeg = segmented([{ v: 'prodaja', l: 'Prodaja' }, { v: 'izdavanje', l: 'Izdavanje' }], S.t, (v) => { S.t = v; paint(); });
    tSeg.setAttribute('aria-label', 'Vrsta oglasa');
    const perSel = select([{ v: 'sve', l: 'Svi aktivni oglasi' }, { v: '90', l: 'Poslednjih 90 dana' }], S.per, (v) => { S.per = v; paint(); }, { label: 'Period', inline: true });
    const root = el('div', { class: 'wrap tl tl-page-mkt' }, head,
      el('div', { class: 'tl-mbar' }, cityPills, el('div', { class: 'tl-mbar-r' }, otherSel, tSeg, perSel)),
      content);
    paint();
    return root;
  }

  /* trend za druge stranice (npr. početna „Tržište ovog meseca“): toolsMarketTrend('beograd') → {months, values, d12, n, drops, avgDrop} | null */
  function toolsMarketTrend(cs, t = 'prodaja', pt = 'stan') { return trendFor(D.listings.filter((l) => l.cs === cs && l.t === t && l.pt === pt)); }

  Object.assign(window, { viewCalc, viewValuation, viewMarket, toolsMarketTrend });
})();

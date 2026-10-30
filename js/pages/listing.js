/* Kvadrat.rs — stranica: detalj oglasa (viewListing). Spec §6.3 + diferencijatori sa stranice oglasa.
   Redosled: mrvice → galerija (Fotografije · Tlocrt · Mapa) → [telefon: trake sekcija] → dgrid:
     glavna kolona: meta · h1 · ulica · lokacija · brojači · akcije → blok cene (Merilo, istorija, rata) → [telefon: kontakt + semafor]
       → Koliko me stvarno košta → Keš ili kredit → Fer cena i pregovarač → Istorija cene (+ isti stan kod drugih)
       → O stanu (opis, podaci) → Komšiluk + lokacija → Cena po m² → Dodatno → Dokumenti → [Uslovi zakupa] → Moja beleška
       → Slični oglasi → Ostali oglasi oglašivača
     strana (desktop, lepljivo): kontakt kartica → Semafor poverenja.
   Telefon: lepljiva .cta-bar (Pozovi · Poruka · Sačuvaj), donja navigacija sakrivena (body[data-bnav=off]).
   Zavisi od: core.js (D, el, $, fmt, stats, mock, store, toast, hash, rng, find, typeOf, COND, HEAT, FURN, ORIENT, AMEN, router),
   images.js (img), ui.js (header-less komponente), engine.js (KX), map.js (mapView). Sve je zaštićeno — stranica ne puca bez engine-a/mape.
   Izvozi samo window.viewListing (+ viewListing._planModel za testove tlocrta). */
'use strict';

(function () {
  /* ───────────────── pomoćno ───────────────── */
  const S = (fn, fb) => { try { const v = fn(); return v === undefined ? fb : v; } catch (e) { return fb; } };
  const hasKX = () => typeof KX !== 'undefined' && KX;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const nf0 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
  const nf1 = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 1 });
  const NB = '\u00a0';
  /* € nikad sam u redu: razmak ispred € (i €/mes, €/m²) postaje neprelomni */
  const nb = (s) => String(s == null ? '' : s).replace(/ (€)/g, NB + '$1');
  const eur = (v) => (v < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(v || 0))) + NB + '€';
  const price = (v, t) => nb(S(() => fmt.price(v, t), eur(v)));
  const ppmTxt = (v) => nb(S(() => fmt.ppm(v), nf1.format(v) + ' €/m²'));
  const pct = (v, sign) => S(() => fmt.pct(v, sign ? { sign: true } : undefined), nf1.format(v) + ' %');
  const plural = (n, a, b, c) => S(() => fmt.plural(n, a, b, c), c);
  const days = (n) => `${nf0.format(n)} ${plural(n, 'dan', 'dana', 'dana')}`;
  const rel = (n) => S(() => fmt.rel(n), `pre ${days(n)}`);
  const ico = (name, size) => S(() => icon(name, size), null);
  const DTF = S(() => new Intl.DateTimeFormat('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' }), null);
  const MTF = S(() => new Intl.DateTimeFormat('sr-Latn-RS', { month: 'long', year: 'numeric' }), null);
  const WDF = S(() => new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'short' }), null);
  const WLF = S(() => new Intl.DateTimeFormat('sr-Latn-RS', { weekday: 'long', day: 'numeric', month: 'long' }), null);
  const dateLong = (iso) => S(() => DTF.format(new Date(String(iso).slice(0, 10) + 'T12:00:00')).replace(/\.$/, ''), String(iso));
  const monthLong = (ym) => S(() => MTF.format(new Date(ym + '-15T12:00:00')).replace(/\.$/, ''), ym);
  const roomsTxt = (ro) => (ro === 0.5 ? 'garsonjera' : S(() => fmt.roomsText(ro), ''));
  const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
  const isPhone = () => S(() => window.matchMedia('(max-width:860px)').matches, false);
  const reduced = () => S(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches, false);
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v == null ? fb : JSON.parse(v); } catch (e) { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* privatni prozor */ } };
  const ssGet = (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  const ssSet = (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } };
  const put = (p, ...kids) => { kids.flat(Infinity).forEach((k) => { if (k != null && k !== false && k !== true) p.append(k); }); return p; };
  const say = (msg, opts) => S(() => toast(msg, opts), null);
  /* rečenice iz engine-a sa nazivom mesta posle predloga („za Čukarica”, „u Čukarica”) prepisujemo bez padeža */
  const fixCase = (t) => String(t == null ? '' : t)
    .replace(/sa prosekom za ([^(.]+?) \(/g, 'sa prosekom ($1, ')
    .replace(/sa prosekom za ([^(.]+?)\./g, 'sa prosekom — $1.')
    .replace(/(ispod|iznad) proseka za ([^(—.]+?)( —|\.|$)/g, '$1 proseka ($2)$3')
    .replace(/medijan u ([^,.]+?) je (\d+)(?! dan)/g, 'medijan ($1) je $2 dana')
    .replace(/medijan u ([^,.]+?) je /g, 'medijan ($1) je ');
  let uid = 0;
  const nid = (p) => `lst-${p}-${++uid}`;

  const ROUTE = {
    listing: (s) => '#/oglas?s=' + encodeURIComponent(s),
    search: (params) => S(() => router.href('/pretraga', params), '#/pretraga'),
    agency: (s) => '#/agencija?s=' + encodeURIComponent(s),
    compare: (ids) => '#/uporedi?ids=' + ids.map(encodeURIComponent).join(','),
    ledger: '#/kako-racunamo',
    calc: (l) => '#/kalkulator?s=' + encodeURIComponent(l.s),   /* kalkulator učitava cenu, m², grad, grejanje i agenciju iz oglasa */
    saved: '#/sacuvani',
  };
  const PT_ABOUT = { stan: 'O stanu', kuca: 'O kući', vikendica: 'O vikendici', 'poslovni-prostor': 'O prostoru', zemljiste: 'O placu', garaza: 'O garaži', soba: 'O sobi' };
  const PT_ACC = { stan: 'stan', kuca: 'kuću', vikendica: 'vikendicu', 'poslovni-prostor': 'poslovni prostor', zemljiste: 'plac', garaza: 'garažu', soba: 'sobu' };
  const AGENT_NAMES = ['Nikola Perić', 'Jelena Marković', 'Marko Ilić', 'Ana Stanković', 'Stefan Jovanović', 'Milica Petrović', 'Nemanja Đorđević', 'Tamara Lukić', 'Ivana Radovanović', 'Vladimir Kostić'];
  const initials = (name) => String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || 'K';
  const mockPhone = (l) => { const h = hash(l.s + '#ph'); return `06${(h % 6) + 1} ${String(100 + (h >>> 3) % 900)} ${String(1000 + (h >>> 13) % 9000)}`; };
  const maskPhone = (ph) => { const s = String(ph || '').trim(); return s.length > 4 ? s.slice(0, -2) + '··' : s; };

  async function copyText(text, okMsg) {
    let ok = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (!ok) {
      try {
        const ta = el('textarea', { style: 'position:fixed;left:-9999px;top:0;opacity:0', 'aria-hidden': 'true' });
        ta.value = text; document.body.appendChild(ta); ta.select();
        ok = document.execCommand('copy'); ta.remove();
      } catch (e) { ok = false; }
    }
    say(ok ? (okMsg || 'Kopirano') : 'Kopiranje nije dozvoljeno — označi tekst i kopiraj ručno');
    return ok;
  }

  /* životni ciklus: posle ubacivanja u dokument → onMount; kad element napusti dokument → onUnmount */
  function lifecycle(root) {
    const mounts = [], unmounts = [];
    let mounted = false, done = false, tries = 0, obs = null;
    const cleanup = () => { if (done) return; done = true; if (obs) obs.disconnect(); unmounts.forEach((f) => S(f)); };
    const check = () => {
      if (done) return;
      if (root.isConnected) {
        if (!mounted) {
          mounted = true;
          mounts.forEach((f) => S(f));
          obs = new MutationObserver(() => { if (!root.isConnected) cleanup(); });
          obs.observe(document.body, { childList: true, subtree: true });
        }
      } else if (!mounted && ++tries < 900) requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
    return { onMount: (f) => (mounted ? S(f) : mounts.push(f)), onUnmount: (f) => unmounts.push(f), get mounted() { return mounted; } };
  }

  function scrollToId(id) {
    const n = document.getElementById(id);
    if (!n) return;
    n.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  }

  function section(id, title, sub, body, cls) {
    return el('section', { class: ['lst-sec', cls], id, 'aria-labelledby': id + '-h' },
      el('div', { class: 'lst-sh' }, el('h2', { class: 't-h2s', id: id + '-h' }, title), sub ? el('p', { class: 'lst-sub' }, sub) : null),
      body);
  }

  /* prekidač sa natpisom: ceo red je klikabilan, a prekidač ima 40px zonu dodira (vidljiva staza ostaje 44×26) */
  function tgRow(on, onChange, label, help, k) {
    const row = S(() => toggle(on, onChange, { label }), null);
    if (!row) return null;
    row.classList.add('lst-tg');
    const btn = row.querySelector('.toggle');
    if (btn && k) btn.dataset.k = k;
    const lb = row.querySelector('span');
    /* ui.toggle već prosleđuje klik sa oznake na prekidač — drugi slušalac bi ga vratio nazad (dupli klik) */
    if (btn && lb) lb.classList.add('lst-tg-l');
    if (!help) return row;
    return el('div', { class: 'lst-tg-wrap' }, row, el('p', { class: 'meta lst-tg-help' }, help));
  }

  /* kvadratni čip „ko plaća” */
  const PAYER = { kupac: 'Plaća kupac', prodavac: 'Plaća prodavac', dogovor: 'Dogovor', zakupac: 'Plaća zakupac', vlasnik: 'Plaća vlasnik' };
  function payerChip(p, onToggle) {
    const lbl = PAYER[p] || 'Dogovor';
    const cls = ['lst-payer', 'is-' + (p || 'dogovor')];
    if (!onToggle) return el('span', { class: cls }, lbl);
    /* dugme je 40px visoko (zona dodira), a vidljivi čip ostaje 24px: pozadina se seče na sadržaj (vidi listing.css) */
    return el('button', { class: cls.concat('tg'), type: 'button', title: 'Promeni ko plaća', 'aria-label': `${lbl} — promeni ko plaća`, onclick: onToggle }, el('span', { class: 'in' }, lbl, ico('refresh', 12)));
  }

  /* ───────────────── galerija (§5.23) + lightbox ───────────────── */
  function photoNode(l, i, aspect, alt) {
    return S(() => img.el(l, i, { aspect, alt }), null) || el('span', { class: 'lst-ph-fb' });
  }
  function kindLabel(l, i) { return S(() => img.KIND_ALT[img.kinds(l)[i]], null) || `Fotografija ${i + 1}`; }

  function openLightbox(l, start) {
    const n = Math.max(1, l.im || 1);
    let i = clamp(start || 0, 0, n - 1);
    const opener = document.activeElement;
    const counter = el('span', { class: 'num', 'aria-live': 'polite' });
    const caption = el('span', { class: 'lst-lb-cap' });
    const stage = el('div', { class: 'stage' });
    const thumbs = el('div', { class: 'thumbs', role: 'group', 'aria-label': 'Sličice' });
    const closeBtn = el('button', { class: 'iconbtn', type: 'button', 'aria-label': 'Zatvori galeriju (Esc)', onclick: () => close() }, ico('x'));
    const prev = el('button', { class: 'arr l', type: 'button', 'aria-label': 'Prethodna fotografija', onclick: () => go(-1) }, ico('chev-l'));
    const next = el('button', { class: 'arr r', type: 'button', 'aria-label': 'Sledeća fotografija', onclick: () => go(1) }, ico('chev-r'));
    const pic = el('div', { class: 'lst-lb-pic' });
    put(stage, pic, prev, next);
    const paint = () => {
      counter.textContent = `${i + 1} / ${n}`;
      caption.textContent = kindLabel(l, i);
      pic.innerHTML = '';
      const p = photoNode(l, i, '16:10', `${l.ti} — ${kindLabel(l, i)} (${i + 1}/${n})`);
      if (p && p.loading) p.loading = 'eager';
      pic.appendChild(p);
      [...thumbs.children].forEach((b, k) => { b.setAttribute('aria-current', k === i ? 'true' : 'false'); if (k === i) S(() => b.scrollIntoView({ block: 'nearest', inline: 'center' })); });
    };
    const go = (d) => { i = (i + d + n) % n; paint(); };
    for (let k = 0; k < n; k++) {
      thumbs.appendChild(el('button', { type: 'button', 'aria-label': `Fotografija ${k + 1}: ${kindLabel(l, k)}`, onclick: () => { i = k; paint(); } }, photoNode(l, k, '1:1', '')));
    }
    const root = el('div', { class: 'lightbox lst-lb', role: 'dialog', 'aria-modal': 'true', 'aria-label': `Galerija fotografija — ${l.ti}` },
      el('div', { class: 'top' }, el('span', { class: 'lst-lb-t' }, counter, caption), closeBtn), stage, thumbs);
    const FOC = 'button:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); close(); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); go(1); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); return; }
      if (e.key === 'Tab') {
        const f = [...root.querySelectorAll(FOC)];
        const first = f[0], last = f[f.length - 1];
        if (!root.contains(document.activeElement)) { e.preventDefault(); first.focus(); return; }
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    let x0 = null;
    stage.addEventListener('pointerdown', (e) => { if (!e.target.closest('button')) x0 = e.clientX; });
    stage.addEventListener('pointerup', (e) => { if (x0 != null && Math.abs(e.clientX - x0) > 40) go(e.clientX < x0 ? 1 : -1); x0 = null; });
    let closed = false;
    const close = () => {
      if (closed) return; closed = true;
      document.removeEventListener('keydown', onKey, true);
      root.remove(); document.body.classList.remove('modal-open');
      if (opener && opener.focus) S(() => opener.focus({ preventScroll: true }));
    };
    document.addEventListener('keydown', onKey, true);
    document.body.classList.add('modal-open');
    document.body.appendChild(root);
    paint();
    closeBtn.focus();
    return { close, el: root };
  }

  /* značke na galeriji (max 3, redosled §5.6) — „Uknjiženo” samo kad pravni status iz semafora to potvrđuje,
     „Snižena cena” samo kad istorija oglasa ima sniženje (isto što pokazuje precrtana cena u bloku cene) */
  function galleryBadges(l, tr, hist) {
    const k = [];
    if (l.pr === 'TOP') k.push('top'); else if (l.pr === 'PREMIUM') k.push('premium');
    if (l.co === 'novogradnja' || l.co === 'u-izgradnji') k.push('novogradnja');
    const drop = hist ? hist.changes.some((c) => c.to < c.from) : null;
    if (drop) k.push('snizena');
    const legal = tr ? tr.legal : (l.reg ? 'uknjizeno' : 'nije');
    if (legal === 'uknjizeno') k.push('uknjizeno');
    if (l.dz <= 1) k.push('novo');
    if (drop === null && !tr) return S(() => badgesFor(l, 3), []);
    return k.slice(0, 3).map((x) => S(() => badge(x), null));
  }

  function photoGallery(l, tr, hist) {
    const n = Math.max(1, l.im || 1);
    const tiles = [];
    for (let i = 0; i < n; i++) {
      tiles.push(el('button', { class: 'g' + (i === 0 ? ' main' : ''), type: 'button', 'data-i': i, 'aria-label': `Otvori fotografiju ${i + 1} od ${n}: ${kindLabel(l, i)}`, onclick: () => openLightbox(l, i) },
        photoNode(l, i, '16:10', i === 0 ? `${l.ti} — ${kindLabel(l, 0)}` : ''),
        i === 4 && n > 5 ? el('span', { class: 'more', 'aria-hidden': 'true' }, `+${n - 5}`) : null));
    }
    const first = tiles[0].querySelector('img'); if (first) first.loading = 'eager';
    const grid = el('div', { class: 'gallery lst-g' + Math.min(n, 5), role: 'group', 'aria-label': `Fotografije (${n}). Strelice ← → menjaju fotografiju.` }, tiles);
    const pg = el('span', { class: 'gpager', 'aria-live': 'polite' }, `1 / ${n}`);
    grid.addEventListener('scroll', () => { const i = Math.round(grid.scrollLeft / Math.max(1, grid.clientWidth)); pg.textContent = `${clamp(i, 0, n - 1) + 1} / ${n}`; }, { passive: true });
    grid.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const vis = tiles.filter((t) => t.offsetParent !== null);
      const cur = Math.max(0, vis.indexOf(document.activeElement));
      const nx = vis[clamp(cur + (e.key === 'ArrowRight' ? 1 : -1), 0, vis.length - 1)];
      if (nx) { nx.focus({ preventScroll: true }); S(() => nx.scrollIntoView({ block: 'nearest', inline: 'start', behavior: reduced() ? 'auto' : 'smooth' })); }
    });
    return el('div', { class: 'gallery-wrap' }, grid,
      el('div', { class: 'gbadges' }, galleryBadges(l, tr, hist)),
      pg,
      el('button', { class: 'all', type: 'button', onclick: () => openLightbox(l, 0) }, ico('image'), `Sve fotografije (${n})`));
  }

  /* ───────────────── tlocrt (šematski, deterministički iz ro / a / ba / am / or) ───────────────── */
  const ORIENT_DEG = { sever: 0, severoistok: 45, istok: 90, jugoistok: 135, jug: 180, jugozapad: 225, zapad: 270, severozapad: 315 };
  const SHORT = { Kupatilo: 'Kup.', 'Kupatilo 2': 'Kup. 2', Toalet: 'WC', Hodnik: 'Hod.', Kuhinja: 'Kuh.', 'Čajna kuhinja': 'Kuh.', Kabinet: 'Kab.', Terasa: 'Ter.', Balkon: 'Balk.', Lođa: 'Lođa', 'Spavaća 1': 'Sp. 1', 'Spavaća 2': 'Sp. 2', 'Spavaća 3': 'Sp. 3', 'Spavaća 4': 'Sp. 4', Spavaća: 'Spav.', Ostava: 'Ost.', Trpezarija: 'Trp.', 'Radna soba': 'Rad.', Garderober: 'Gard.', Dnevna: 'Dn.', 'Kancelarija 1': 'K1', 'Kancelarija 2': 'K2', 'Kancelarija 3': 'K3', 'Kancelarija 4': 'K4', 'Kancelarija 5': 'K5' };

  function planModel(l) {
    if (!(l.a > 0) || (l.ro == null && l.pt !== 'poslovni-prostor') || !['stan', 'kuca', 'vikendica', 'poslovni-prostor'].includes(l.pt) || l.a > 600) return null;
    const r = rng(hash((l.ps || l.s) + '#plan'));   /* isti stan kod druge agencije = isti tlocrt */
    const a = l.a, ro = l.ro != null ? l.ro : clamp(Math.round(l.a / 30), 1, 5), ba = clamp(l.ba || 1, 1, 3);
    const am = l.am || [];
    const R = (n, area, kind) => ({ n, area, kind });
    const office = l.pt === 'poslovni-prostor';
    const hall = R('Hodnik', clamp(a * 0.09, 3, 12), 'hall');
    let kitchen, living; const baths = [], beds = [];
    if (office) {
      kitchen = R('Čajna kuhinja', clamp(a * 0.06, 3, 8), 'kitchen');
      for (let i = 0; i < ba; i++) baths.push(R(i ? 'Toalet ' + (i + 1) : 'Toalet', clamp(a * 0.04, 2.5, 5), 'bath'));
      const nRooms = clamp(Math.round(ro), 1, 5);
      living = R(nRooms > 1 ? 'Kancelarija 1' : 'Kancelarija', 0, 'living');
      for (let i = 1; i < nRooms; i++) beds.push(R(`Kancelarija ${i + 1}`, clamp(a * 0.16, 8, 30), 'bed'));
    } else {
      baths.push(R('Kupatilo', clamp(a * 0.065, 3.5, 8), 'bath'));
      if (ba >= 2) baths.push(ba >= 3 ? R('Kupatilo 2', clamp(a * 0.05, 3.5, 6), 'bath') : R('Toalet', clamp(a * 0.03, 1.8, 3), 'bath'));
      if (ba >= 3) baths.push(R('Toalet', 2, 'bath'));
      const big = a > 110;
      kitchen = ro <= 0.5 ? R('Kuhinja', clamp(a * 0.12, 3.5, 6), 'kitchen') : R('Kuhinja', clamp(a * 0.1, 5, big ? 28 : 16), 'kitchen');
      const full = ro >= 2 ? Math.floor(ro) - 1 : 0;
      const half = ro > 1 && ro % 1 === 0.5 ? 1 : 0;
      for (let i = 0; i < full; i++) beds.push(R(full > 1 ? `Spavaća ${i + 1}` : 'Spavaća', clamp(a * (0.48 / (full + 1.7)), 8.5, big ? 26 : 18), 'bed'));
      if (half) beds.push(R('Kabinet', clamp(a * 0.08, 5, 9), 'bed'));
      if (big) {
        hall.area = clamp(a * 0.1, 6, 24);
        beds.push(R('Trpezarija', clamp(a * 0.1, 10, 30), 'bed'));
        beds.push(R('Ostava', clamp(a * 0.035, 3, 10), 'store'));
        if (a > 170) beds.push(R('Radna soba', clamp(a * 0.07, 9, 18), 'bed'));
        if (a > 200) beds.push(R('Garderober', clamp(a * 0.03, 4, 8), 'store'));
      }
      living = R(ro <= 1 ? 'Soba' : 'Dnevna', 0, 'living');
    }
    const others = [hall, kitchen, ...baths, ...beds];
    const minLiving = Math.max(10, a * 0.24);
    const sumO = others.reduce((t, x) => t + x.area, 0);
    if (a - sumO < minLiving) { const k = Math.max(0.3, (a - minLiving) / sumO); others.forEach((x) => { x.area *= k; }); }
    others.forEach((x) => { x.area = x.area < 10 ? Math.round(x.area * 2) / 2 : Math.round(x.area); });
    living.area = Math.round((a - others.reduce((t, x) => t + x.area, 0)) * 2) / 2;
    if (living.area < 4) return null;
    let terrace = null;
    if (!office) {
      if (am.includes('hasTerrace')) terrace = R('Terasa', Math.round(clamp(a * 0.1, 4, 24)), 'terrace');
      else if (am.includes('hasBalcony')) terrace = R('Balkon', Math.round(clamp(a * 0.06, 3, 8)), 'terrace');
      else if (am.includes('hasLoggia')) terrace = R('Lođa', Math.round(clamp(a * 0.06, 3, 8)), 'terrace');
    }
    /* kandidati stabla (binarno sečenje po površini, uz dužu stranu); bira se raspored bez „traka” — najveća najmanja stranica sobe */
    const wet = [hall, ...baths];
    const kids = beds.length ? beds : null;
    const cands = [
      kids ? [[living, kitchen], [wet, kids]] : [[living, kitchen], wet],
      kids ? [living, [[kitchen, ...wet], kids]] : [living, [kitchen, ...wet]],
      kids ? [[living, kids], [kitchen, ...wet]] : [living, [wet, kitchen]],
      kids ? [living, [kitchen, ...wet, ...kids]] : [[living, wet], kitchen],
    ];
    const flip = r() < 0.5;
    const asp = 1.3 + r() * 0.4;
    const W = Math.sqrt(a * asp), H = a / W;
    const sum = (node) => (Array.isArray(node) ? node.reduce((t, x) => t + sum(x), 0) : node.area);
    let rooms = [];
    const lay = (node, x, y, w, h) => {
      if (!Array.isArray(node)) { rooms.push({ ...node, x, y, w, h }); return; }
      if (node.length === 1) { lay(node[0], x, y, w, h); return; }
      let A1, A2;
      if (node.length === 2) { A1 = [node[0]]; A2 = [node[1]]; }
      else {
        const tot = sum(node); let acc = 0, best = 1, bd = Infinity;
        for (let k = 1; k < node.length; k++) { acc += sum(node[k - 1]); const d = Math.abs(acc - tot / 2); if (d < bd) { bd = d; best = k; } }
        A1 = node.slice(0, best); A2 = node.slice(best);
      }
      const s1 = sum(A1), s2 = sum(A2), f = s1 / (s1 + s2);
      if (w >= h) { lay(A1.length === 1 ? A1[0] : A1, x, y, w * f, h); lay(A2.length === 1 ? A2[0] : A2, x + w * f, y, w * (1 - f), h); }
      else { lay(A1.length === 1 ? A1[0] : A1, x, y, w, h * f); lay(A2.length === 1 ? A2[0] : A2, x, y + h * f, w, h * (1 - f)); }
    };
    let best = null;
    cands.forEach((t, ci) => {
      const tree = flip ? t.slice().reverse() : t;
      rooms = []; lay(tree, 0, 0, W, H);
      const minSide = Math.min(...rooms.map((p) => Math.min(p.w, p.h) / (p.kind === 'bath' || p.kind === 'store' || p.kind === 'hall' ? 0.75 : 1)));
      const worstAsp = Math.max(...rooms.map((p) => Math.max(p.w, p.h) / Math.max(0.01, Math.min(p.w, p.h))));
      const score = Math.min(minSide, 2.4) * 10 - worstAsp * 0.2 - ci * 0.05;
      if (!best || score > best.score) best = { score, rooms };
    });
    rooms = best.rooms;
    return { rooms, terrace, W, H, a, office, or: l.or || null };
  }

  function planView(l) {
    const m = planModel(l);
    if (!m) return null;
    const SC = 40, eps = 0.01;
    const { rooms, W, H } = m;
    /* zajedničke ivice */
    const shared = (p, q) => {
      if (Math.abs(p.x + p.w - q.x) < eps || Math.abs(q.x + q.w - p.x) < eps) {
        const X = Math.abs(p.x + p.w - q.x) < eps ? q.x : p.x;
        const a0 = Math.max(p.y, q.y), a1 = Math.min(p.y + p.h, q.y + q.h);
        if (a1 - a0 > 0.9) return { v: true, c: X, a0, a1 };
      }
      if (Math.abs(p.y + p.h - q.y) < eps || Math.abs(q.y + q.h - p.y) < eps) {
        const Y = Math.abs(p.y + p.h - q.y) < eps ? q.y : p.y;
        const a0 = Math.max(p.x, q.x), a1 = Math.min(p.x + p.w, q.x + q.w);
        if (a1 - a0 > 0.9) return { v: false, c: Y, a0, a1 };
      }
      return null;
    };
    const outer = (p) => {
      const s = [];
      if (p.y < eps) s.push({ v: false, c: 0, a0: p.x, a1: p.x + p.w, side: 'n' });
      if (Math.abs(p.y + p.h - H) < eps) s.push({ v: false, c: H, a0: p.x, a1: p.x + p.w, side: 's' });
      if (p.x < eps) s.push({ v: true, c: 0, a0: p.y, a1: p.y + p.h, side: 'w' });
      if (Math.abs(p.x + p.w - W) < eps) s.push({ v: true, c: W, a0: p.y, a1: p.y + p.h, side: 'e' });
      return s;
    };
    const X = (v) => (v * SC).toFixed(1);
    const parts = [];
    const door = (edge, room, dw) => {
      const t0 = clamp(edge.a0 + 0.25, edge.a0 + 0.05, edge.a1 - dw - 0.05), t1 = t0 + dw;
      if (t1 > edge.a1) return;
      if (edge.v) {
        const dir = room.x + room.w / 2 < edge.c ? -1 : 1;
        const hx = edge.c, hy = t0, lx = edge.c + dir * dw;
        parts.push(`<line class="gap" x1="${X(hx)}" y1="${X(t0)}" x2="${X(hx)}" y2="${X(t1)}"/>`);
        parts.push(`<line class="leaf" x1="${X(hx)}" y1="${X(hy)}" x2="${X(lx)}" y2="${X(hy)}"/>`);
        parts.push(`<path class="arc" d="M${X(lx)} ${X(hy)} A${X(dw)} ${X(dw)} 0 0 ${dir > 0 ? 1 : 0} ${X(hx)} ${X(t1)}"/>`);
      } else {
        const dir = room.y + room.h / 2 < edge.c ? -1 : 1;
        const hy = edge.c, hx = t0, ly = edge.c + dir * dw;
        parts.push(`<line class="gap" x1="${X(t0)}" y1="${X(hy)}" x2="${X(t1)}" y2="${X(hy)}"/>`);
        parts.push(`<line class="leaf" x1="${X(hx)}" y1="${X(hy)}" x2="${X(hx)}" y2="${X(ly)}"/>`);
        parts.push(`<path class="arc" d="M${X(hx)} ${X(ly)} A${X(dw)} ${X(dw)} 0 0 ${dir > 0 ? 0 : 1} ${X(t1)} ${X(hy)}"/>`);
      }
    };
    const win = (edge) => {
      const len = edge.a1 - edge.a0; if (len < 1.2) return;
      const wl = Math.min(len * 0.45, 2.2), m0 = edge.a0 + (len - wl) / 2, m1 = m0 + wl;
      if (edge.v) parts.push(`<line class="gap" x1="${X(edge.c)}" y1="${X(m0)}" x2="${X(edge.c)}" y2="${X(m1)}"/><line class="win" x1="${X(edge.c - 0.06)}" y1="${X(m0)}" x2="${X(edge.c - 0.06)}" y2="${X(m1)}"/><line class="win" x1="${X(edge.c + 0.06)}" y1="${X(m0)}" x2="${X(edge.c + 0.06)}" y2="${X(m1)}"/>`);
      else parts.push(`<line class="gap" x1="${X(m0)}" y1="${X(edge.c)}" x2="${X(m1)}" y2="${X(edge.c)}"/><line class="win" x1="${X(m0)}" y1="${X(edge.c - 0.06)}" x2="${X(m1)}" y2="${X(edge.c - 0.06)}"/><line class="win" x1="${X(m0)}" y1="${X(edge.c + 0.06)}" x2="${X(m1)}" y2="${X(edge.c + 0.06)}"/>`);
    };
    /* sobe: zidovi (unutrašnji tanji) */
    const fills = rooms.map((p) => `<rect class="rm k-${p.kind}" x="${X(p.x)}" y="${X(p.y)}" width="${X(p.w)}" height="${X(p.h)}"/>`).join('');
    const inner = rooms.map((p) => `<rect class="iw" x="${X(p.x)}" y="${X(p.y)}" width="${X(p.w)}" height="${X(p.h)}"/>`).join('');
    const hall = rooms.find((p) => p.kind === 'hall');
    const living = rooms.find((p) => p.kind === 'living');
    let entranceSide = null;
    /* ulaz */
    const hallOuter = hall ? outer(hall).sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0))[0] : null;
    const entryRoom = hallOuter ? hall : living;
    const entryEdge = hallOuter || outer(living).sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0))[0];
    /* prozori */
    rooms.filter((p) => ['living', 'bed', 'kitchen'].includes(p.kind)).forEach((p) => outer(p).forEach((e) => { if (!(entryEdge && entryRoom === p && e.side === entryEdge.side)) win(e); }));
    /* vrata */
    rooms.forEach((p) => {
      if (p.kind === 'hall') return;
      const prefer = p.kind === 'living' ? [hall] : p.kind === 'kitchen' ? [living, hall] : p.kind === 'bath' ? [hall, ...rooms.filter((q) => q.kind === 'bed'), living] : [hall, living, ...rooms.filter((q) => q !== p)];
      for (const q of prefer) { if (!q || q === p) continue; const e = shared(p, q); if (e) { door(e, p, p.kind === 'bath' ? 0.7 : 0.8); return; } }
    });
    if (entryEdge) { entranceSide = entryEdge.side; door(entryEdge, entryRoom, 0.9); }
    /* terasa */
    let tRect = null;
    if (m.terrace && living) {
      const cand = outer(living).filter((e) => e.side !== entranceSide).sort((p, q) => (q.a1 - q.a0) - (p.a1 - p.a0))[0] || outer(living)[0];
      if (cand) {
        const len = cand.a1 - cand.a0;
        const depth = clamp(m.terrace.area / (len * 0.8), 1.2, 2.4);
        const tl = Math.min(len - 0.2, m.terrace.area / depth);
        const t0 = cand.a0 + (len - tl) / 2;
        if (cand.side === 'n') tRect = { x: t0, y: -depth, w: tl, h: depth };
        if (cand.side === 's') tRect = { x: t0, y: H, w: tl, h: depth };
        if (cand.side === 'w') tRect = { x: -depth, y: t0, w: depth, h: tl };
        if (cand.side === 'e') tRect = { x: W, y: t0, w: depth, h: tl };
        if (tRect) parts.unshift(`<rect class="ter" x="${X(tRect.x)}" y="${X(tRect.y)}" width="${X(tRect.w)}" height="${X(tRect.h)}"/>`);
      }
    }
    const pad = 0.5;
    const minX = Math.min(0, tRect ? tRect.x : 0) - pad, minY = Math.min(0, tRect ? tRect.y : 0) - pad;
    const maxX = Math.max(W, tRect ? tRect.x + tRect.w : W) + pad, maxY = Math.max(H, tRect ? tRect.y + tRect.h : H) + pad;
    const vb = [minX * SC, minY * SC, (maxX - minX) * SC, (maxY - minY) * SC];
    const svg = `<svg viewBox="${vb.map((v) => v.toFixed(1)).join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
      ${fills}${inner}<rect class="ow" x="0" y="0" width="${X(W)}" height="${X(H)}"/>${parts.join('')}</svg>`;
    const lbl = (p, name, area, extra) => {
      const left = ((p.x + p.w / 2) * SC - vb[0]) / vb[2] * 100, top = ((p.y + p.h / 2) * SC - vb[1]) / vb[3] * 100;
      const small = p.w < 2.6 || p.h < 1.6, tiny = p.w < 1.7 || p.h < 1.25;
      const rel = (p.w * SC) / vb[2], relH = (p.h * SC) / vb[3];
      const nar = !small && (rel < 0.24 || relH < 0.16);
      const short = SHORT[name] || (name.length > 6 ? name.slice(0, 4) + '.' : name);
      return el('span', { class: ['rl', small && 'sm', tiny && 'xs', nar && 'nar', extra], 'aria-hidden': 'true', style: `left:${left.toFixed(2)}%;top:${top.toFixed(2)}%` },
        small ? el('b', {}, short) : el('b', {}, el('span', { class: 'fu' }, name), el('span', { class: 'sh' }, short)),
        tiny ? null : el('span', { class: 'num' }, `${nf1.format(area)} m²`));
    };
    const labels = rooms.map((p) => lbl(p, p.n, p.area));
    if (tRect) labels.push(lbl(tRect, m.terrace.n, m.terrace.area, 'ter'));
    const deg = m.or && ORIENT_DEG[m.or] != null ? ORIENT_DEG[m.or] : null;
    const north = el('span', { class: 'lst-north', role: 'img', 'aria-label': deg == null ? 'Orijentacija nije navedena' : `Sever; stan je orijentisan na ${S(() => ORIENT[m.or], m.or).toLowerCase()}` },
      el('span', { class: 'nr', style: `transform:rotate(${deg == null ? 0 : -deg}deg)`, html: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 7 19l5-3.2L17 19z"/></svg>' }),
      el('b', {}, 'S'));
    /* kutija ima tačno odnos stranica viewBox-a (širina ograničena tako da visina ne pređe 520px) — procenti etiketa se poklapaju 1:1 sa crtežom na svakoj širini */
    const ratio = vb[2] / vb[3];
    const box = el('div', { class: 'lst-plan-box', style: `aspect-ratio:${ratio.toFixed(4)};width:min(100%, ${Math.round(520 * ratio)}px)` }, el('div', { class: 'svg', html: svg }), labels);
    const legendRooms = rooms.slice().sort((p, q) => (p.kind === 'living' ? -1 : q.kind === 'living' ? 1 : q.area - p.area));
    const legend = el('div', { class: 'lst-plan-side' },
      el('p', { class: 'eyebrow' }, 'Prostorije'),
      el('ul', { class: 'lst-plan-leg' }, legendRooms.map((p) => el('li', {}, el('span', {}, p.n), el('span', { class: 'num' }, `${nf1.format(p.area)} m²`))),
        m.terrace ? el('li', { class: 'ter' }, el('span', {}, m.terrace.n), el('span', { class: 'num' }, `${nf1.format(m.terrace.area)} m²`)) : null,
        el('li', { class: 'tot' }, el('span', {}, 'Ukupno'), el('span', { class: 'num' }, `${nf1.format(m.a)} m²`))),
      m.terrace ? el('p', { class: 'meta' }, `${m.terrace.n} nije uračunat${m.terrace.n === 'Terasa' || m.terrace.n === 'Lođa' ? 'a' : ''} u ${nf1.format(m.a)} m².`) : null,
      el('p', { class: 'meta lst-plan-or' }, north, deg == null ? 'Orijentacija nije navedena.' : `Orijentacija: ${S(() => ORIENT[m.or], m.or).toLowerCase()} — strelica pokazuje sever.`),
      el('p', { class: 'note-rule' }, 'Šematski tlocrt, izveden iz strukture, kvadrature i broja kupatila iz oglasa. Nije arhitektonski crtež — pravi tlocrt tražite od oglašivača.'));
    return el('div', { class: 'lst-plan' }, box, legend);
  }

  /* ───────────────── mapa ───────────────── */
  function mapTile(l, host, opts = {}) {
    let api = null, built = false;
    const build = () => {
      if (built || !host.isConnected || host.offsetWidth < 10) return false;
      built = true;
      if (typeof mapView !== 'function' || typeof l.lat !== 'number') { host.classList.add('lst-map-off'); host.appendChild(el('p', { class: 'meta' }, 'Mapa nije dostupna.')); return true; }
      const exact = !!l.ad;
      api = S(() => mapView(host, {
        listings: exact ? [l] : [], selected: exact ? l.s : null, city: l.cs, interactive: false, legend: false, popover: false,
        drawTool: false, showAreaButton: false, labels: true, radius: exact ? null : { lat: l.lat, lng: l.lng, m: 350 },
        view: { lat: l.lat, lng: l.lng, zoom: opts.zoom || 15 },
      }), null);
      return true;
    };
    return { build, destroy: () => S(() => api && api.destroy()), get api() { return api; } };
  }

  /* ───────────────── profil (kredit / budžet) — donji list ───────────────── */
  function openProfileSheet(focus) {
    if (!hasKX()) return;
    const P = KX.profile.get();
    const num = (v) => (v ? String(v) : '');
    const inp = (val, ph, extra) => el('input', { class: 'input', type: 'number', inputmode: 'numeric', min: '0', step: extra && extra.step || '50', value: num(val), placeholder: ph });
    const income = inp(P.income, 'npr. 1.200');
    const partner = inp(P.partnerIncome, 'opciono');
    const cash = inp(P.cash, 'npr. 25.000', { step: '1000' });
    const oblig = inp(P.obligations, '0');
    const down = S(() => select([{ v: '0.9', l: '10 % (prvi stan)' }, { v: '0.8', l: '20 %' }, { v: '0.7', l: '30 %' }, { v: '0.6', l: '40 %' }], String(P.ltv), () => {}), el('select'));
    const rate = el('input', { class: 'input', type: 'number', inputmode: 'decimal', min: '1', max: '12', step: '0.1', value: String(P.ratePct) });
    const years = S(() => select([10, 15, 20, 25, 30].map((y) => ({ v: String(y), l: `${y} godina` })), String(P.years), () => {}), el('select'));
    let first = !!P.firstHome, payer = P.agencyPayer || 'kupac';
    const firstT = S(() => toggle(first, (on) => { first = on; if (on && down.value === '0.8') down.value = '0.9'; }, { label: 'Kupujem prvi stan' }), null);
    const payerSeg = S(() => segmented([{ v: 'kupac', l: 'Kupac' }, { v: 'prodavac', l: 'Prodavac' }], payer, (v) => { payer = v; }), null);
    const body = el('div', { class: 'lst-prof' },
      el('p', { class: 'lst-sub' }, 'Podaci ostaju samo u ovom pregledaču i koriste se za ratu, „Keš ili kredit” i troškove na svakom oglasu.'),
      el('div', { class: 'grp' }, el('p', { class: 't' }, 'Prihod i ušteđevina'),
        el('div', { class: 'lst-form2' }, field('Neto plata (€/mes)', income), field('Plata partnera (€/mes)', partner), field('Keš / ušteđevina (€)', cash), field('Postojeće rate (€/mes)', oblig))),
      el('div', { class: 'grp' }, el('p', { class: 't' }, 'Kredit'),
        el('div', { class: 'lst-form2' }, field('Učešće', down), field('Kamata (%)', rate, 'Prosek banaka, fiksna ili EURIBOR + marža'), field('Rok otplate', years)),
        firstT, el('p', { class: 'help' }, 'Za prvi stan NBS dozvoljava učešće od 10 %; mnoge banke i dalje traže 20 %.')),
      el('div', { class: 'grp' }, el('p', { class: 't' }, 'Agencijsku proviziju plaća'), payerSeg));
    const save = () => {
      KX.profile.set({ income: income.value, partnerIncome: partner.value, cash: cash.value, obligations: oblig.value, ltv: down.value, ratePct: rate.value, years: years.value, firstHome: first, agencyPayer: payer });
      sh.close(); say('Profil je sačuvan — brojke na stranici su osvežene');
    };
    const sh = sheet('Moj budžet i kredit', body, { footer: [
      el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => sh.close() }, 'Odustani'),
      el('button', { class: 'btn btn-ink', type: 'button', onclick: save }, 'Sačuvaj') ] });
    const target = { income, cash, rate, years }[focus];
    if (target) setTimeout(() => S(() => target.focus()), 380);
  }

  /* ───────────────── glavni pogled ───────────────── */
  function viewListing(q) {
    let slug = null;
    if (typeof q === 'string') slug = q;
    else if (q && typeof q.get === 'function') slug = q.get('s');
    else if (q && q.s) slug = q.s;
    const l = slug ? S(() => find.listing(slug), null) || S(() => D.listings.find((x) => x.s === slug), null) : null;
    if (!l) {
      return el('div', { class: 'wrap lst lst-404' },
        S(() => empty('Oglas nije pronađen', 'Oglas je možda uklonjen ili je link pogrešan. Pogledaj slične oglase u pretrazi.', 'Nazad na pretragu', '#/pretraga', { primary: { label: 'Početna', href: '#/' } }),
          el('div', {}, el('h1', { class: 't-h1' }, 'Oglas nije pronađen'), el('a', { class: 'btn btn-secondary', href: '#/pretraga' }, 'Nazad na pretragu'))));
    }
    return buildListing(l);
  }

  function buildListing(l) {
    const rent = l.t === 'izdavanje';
    const T = S(() => typeOf(l.pt), { s: 'Nekretnina', l: 'Nekretnine', pl: 'nekretnina' });
    const ag = l.ags ? S(() => find.agency(l.ags), null) || S(() => D.agencies.find((a) => a.s === l.ags), null) : null;
    const kx = hasKX();
    const hist = kx ? S(() => KX.history(l), null) : null;
    const tr = kx ? S(() => KX.trust(l), null) : null;
    const grp = kx ? S(() => KX.dupes.groupOf(l.s), null) : null;
    const title = nb(kx ? S(() => KX.titleOf(l), l.ti) : l.ti);
    const daysOn = hist ? hist.daysOnMarket : l.dz;
    S(() => store.pushRecent(l.s));

    const root = el('div', { class: 'wrap lst', 'data-slug': l.s });
    const life = lifecycle(root);
    const refreshers = [];
    const refreshAll = () => refreshers.forEach((f) => S(f));
    if (kx) life.onMount(() => { const off = KX.profile.on(() => refreshAll()); life.onUnmount(off); });

    /* ── zajednički kontakt (forma poruke se otvara iz više mesta) ── */
    const contact = contactCard(l, ag, tr, life, refreshers);

    /* ── mrvice ── */
    const crumbItems = [
      { label: `${rent ? 'Izdavanje' : 'Prodaja'} · ${T.l.toLowerCase()}`, href: ROUTE.search({ t: l.t, pt: [l.pt] }) },
      l.c ? { label: l.c, href: ROUTE.search({ t: l.t, pt: [l.pt], c: l.cs }) } : null,
      l.m && l.m !== l.c ? { label: l.m, href: ROUTE.search({ t: l.t, pt: [l.pt], c: l.cs, m: [l.ms] }) } : null,
      l.n && l.n !== l.m && l.n !== l.c ? { label: l.n, href: ROUTE.search({ t: l.t, pt: [l.pt], c: l.cs, m: l.ms ? [l.ms] : [], n: l.ns ? [l.ns] : [] }) } : null,
      { label: l.r || 'Oglas', href: '#' },
    ].filter(Boolean);
    const crumbsNode = S(() => crumbs(crumbItems), null);

    /* ── galerija sa tabovima ── */
    const nPhotos = Math.max(1, l.im || 1);
    const plan = planView(l);
    const galMapHost = el('div', { class: 'lst-galmap' });
    const galMap = mapTile(l, galMapHost, { zoom: 15 });
    const mediaItems = [{ id: 'lm-foto', label: `Fotografije (${nPhotos})`, panel: photoGallery(l, tr, hist) }];
    if (plan) mediaItems.push({ id: 'lm-tlocrt', label: 'Tlocrt', panel: plan });
    mediaItems.push({ id: 'lm-mapa', label: 'Mapa', panel: el('div', { class: 'lst-galmap-wrap' }, galMapHost, mapCaption(l)) });
    const media = S(() => tabs(mediaItems, { active: 'lm-foto', onChange: (id) => { if (id === 'lm-mapa') requestAnimationFrame(() => galMap.build()); } }), mediaItems[0].panel);
    if (media.classList) media.classList.add('lst-media');
    life.onUnmount(() => galMap.destroy());

    /* ── trake sekcija (telefon) ── */
    const secTabs = sectionTabs(l, rent, life);

    /* ── zaglavlje oglasa ── */
    const head = headBlock(l, T, hist, title, contact, life);

    /* ── blok cene ── */
    const pb = priceBlockX(l, hist, grp, refreshers);

    /* ── strana / telefon: kontakt + semafor ── */
    const trustPanel = tr ? trustBlock(l, tr, contact) : null;
    const asideIn = el('div', { class: 'lst-aside-in', id: 'lst-kontakt' }, contact.node, trustPanel);
    const aside = el('div', { class: 'aside lst-aside' });
    const slot = el('div', { class: 'lst-slot' });
    const place = () => { const target = isPhone() ? slot : aside; if (asideIn.parentNode !== target) target.appendChild(asideIn); };
    place();
    const mq = S(() => window.matchMedia('(max-width:860px)'), null);
    if (mq) { const onCh = () => place(); S(() => mq.addEventListener('change', onCh)); life.onUnmount(() => S(() => mq.removeEventListener('change', onCh))); }

    /* ── sekcije glavne kolone ── */
    const main = el('div', { class: 'lst-main' },
      head, pb, slot, factsSection(l, tr),
      kx ? costSection(l, refreshers) : null,
      kx && !rent ? affordSection(l, refreshers) : null,
      kx ? fairSection(l, contact) : null,
      historySection(l, hist, grp),
      aboutSection(l, T),
      hoodSection(l, life),
      barsSection(l),
      amenitiesSection(l),
      docsSection(l, tr),
      rent ? leaseSection(l) : null,
      noteSection(l));
    const after = el('div', { class: 'lst-after' }, similarSection(l), agencySection(l, ag));

    put(root, crumbsNode, el('div', { class: 'lst-gal' }, media), secTabs, el('div', { class: 'dgrid lst-dgrid' }, main, aside), after);

    /* ── telefon: lepljiva CTA traka ── */
    const cta = ctaBarX(l, contact, life);
    root.appendChild(cta);
    life.onMount(() => { document.body.setAttribute('data-bnav', 'off'); document.body.classList.add('lst-on'); });
    life.onUnmount(() => { document.body.removeAttribute('data-bnav'); document.body.classList.remove('lst-on'); });
    return root;
  }

  const uniq = (a) => a.filter((v, i) => v && a.indexOf(v) === i);
  const placeTxt = (l) => [l.n, l.m && l.m !== l.n ? l.m : null].filter(Boolean).join(', ') || l.c || '';
  function mapCaption(l) {
    const st = S(() => mock.street(l), null);
    return el('p', { class: 'lst-mapcap meta' }, ico('pin', 14),
      l.ad ? `${st ? st + ' · ' : ''}${uniq([l.n, l.m, l.c]).join(', ')} — lokacija iz oglasa` : `Približna lokacija (krug od 350 m) · ${uniq([l.n, l.m]).join(', ')} — tačnu adresu daje oglašivač`);
  }

  /* ───────────────── trake sekcija (≤860) ───────────────── */
  function sectionTabs(l, rent, life) {
    const ALL = [['lst-top', 'Pregled'], ['lst-podaci', 'Podaci'], ['lst-troskovi', 'Troškovi'], ['lst-fer', 'Fer cena'], ['lst-istorija', 'Istorija'], ['lst-opis', 'Opis'], ['lst-komsiluk', 'Komšiluk'], ['lst-zakup', 'Uslovi zakupa'], ['lst-dokumenti', 'Dokumenti']];
    const inner = el('div', { class: 'in' });
    const nav = el('nav', { class: 'lst-sectabs', 'aria-label': 'Sekcije oglasa' }, inner);
    let items = [], btns = [];
    const build = () => {
      items = ALL.map(([id, label]) => ({ id, label, n: document.getElementById(id) })).filter((x) => x.n);
      items.sort((a, b) => (a.n.compareDocumentPosition(b.n) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1));
      inner.innerHTML = '';
      btns = items.map((x) => el('a', { href: '#' + x.id, 'data-id': x.id, onclick: (e) => { e.preventDefault(); scrollToId(x.id); } }, x.label));
      put(inner, btns);
    };
    let raf = 0;
    const spy = () => {
      raf = 0;
      if (!nav.isConnected || nav.offsetParent === null || !items.length) return;
      const off = nav.getBoundingClientRect().bottom + 24;
      let cur = items[0].id, best = -Infinity;
      for (const x of items) { const t = x.n.getBoundingClientRect().top; if (t - off <= 0 && t > best) { best = t; cur = x.id; } }
      btns.forEach((b) => { const on = b.dataset.id === cur; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); });
      const onB = btns.find((b) => b.classList.contains('on'));
      if (onB) { const r = onB.getBoundingClientRect(), nr = inner.getBoundingClientRect(); if (r.left < nr.left || r.right > nr.right - 36) inner.scrollLeft += r.left - nr.left - 16; }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
    life.onMount(() => { build(); window.addEventListener('scroll', onScroll, { passive: true }); spy(); });
    life.onUnmount(() => window.removeEventListener('scroll', onScroll));
    return nav;
  }

  /* ───────────────── zaglavlje: meta, h1, ulica, lokacija, brojači, akcije ───────────────── */
  function headBlock(l, T, hist, title, contact, life) {
    const rent = l.t === 'izdavanje';
    const d = hist ? hist.daysOnMarket : l.dz;
    const refBtn = el('button', { class: 'lst-ref', type: 'button', title: 'Kopiraj šifru oglasa', onclick: () => copyText(l.r, `Šifra ${l.r} je kopirana`) }, `Oglas ${l.r}`);
    const dateEl = el('span', { class: 'lst-date' }, `objavljen ${rel(d)}`);
    if (hist && hist.bumped) {
      dateEl.appendChild(ico('info', 14));
      dateEl.setAttribute('tabindex', '0');
      S(() => tip(dateEl, `Oglašivač je obnavljao oglas, pa drugi portali pišu „${rel(hist.shownDays)}”. Mi brojimo od prvog pojavljivanja (${dateLong(hist.firstSeen)}): ${days(d)}.`));
    }
    const meta = el('div', { class: 'dmeta' }, el('span', { class: 'eyebrow' }, `${rent ? 'Izdavanje' : 'Prodaja'} · ${T.s}`), el('span', { class: 'dot' }), refBtn, el('span', { class: 'dot' }), dateEl);
    const h1 = el('h1', { class: 't-h1 lst-h1' }, title);
    /* tačna ulica samo kad je oglas ima (l.ad); inače samo naselje i opština — isto što kaže natpis ispod mape */
    const street = l.ad ? S(() => streetLine(l), null)
      : el('p', { class: 'street', title: `${placeTxt(l)} — približna lokacija` }, ico('pin'), el('span', {}, placeTxt(l), el('span', { class: 'lst-approx' }, ' · približna lokacija')));
    const loc = el('p', { class: 'dloc' }, ico('pin'), el('span', {}, uniq([l.n, l.m, l.c]).join(', ')),
      el('a', { href: '#lst-komsiluk', onclick: (e) => { e.preventDefault(); scrollToId('lst-lokacija'); } }, 'prikaži na mapi'));
    const favs = () => (l.fv || 0) + (S(() => store.isFav(l.s), false) ? 1 : 0);
    const favCount = el('b', {}, nf0.format(favs()));
    const moveIn = l.co === 'u-izgradnji' ? 'U izgradnji' : l.co === 'potrebno-renoviranje' ? 'Za renoviranje' : 'Useljivo odmah';
    const ready = l.co !== 'u-izgradnji' && l.co !== 'potrebno-renoviranje';
    const livable = ['stan', 'kuca', 'vikendica', 'soba', 'poslovni-prostor'].includes(l.pt);
    const stats = el('p', { class: 'dstats' },
      el('span', {}, ico('eye', 14), el('b', {}, nf0.format(l.v || 0)), ' ', plural(l.v || 0, 'pregled', 'pregleda', 'pregleda')),
      el('span', {}, ico('heart', 14), favCount, ' sačuvalo'),
      !livable ? null : el('span', { class: ready ? 'lst-mv' : 'lst-mv no' }, ready ? ico('check', 14) : l.co === 'u-izgradnji' ? ico('clock', 14) : null, moveIn));

    /* akcije */
    const favBtn = el('button', { class: 'btn btn-secondary btn-sm lst-fav', type: 'button' });
    const paintFav = () => { const on = S(() => store.isFav(l.s), false); favBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); favBtn.innerHTML = ''; put(favBtn, ico('heart'), on ? 'Sačuvano' : 'Sačuvaj'); favCount.textContent = nf0.format(favs()); };
    favBtn.addEventListener('click', () => { const on = S(() => store.toggleFav(l.s), false); paintFav(); say(on ? 'Sačuvano' : 'Uklonjeno iz sačuvanih', on ? { action: { label: 'Pogledaj sačuvane', href: ROUTE.saved } } : undefined); });
    paintFav();
    const cmpBtn = el('button', { class: 'btn btn-secondary btn-sm', type: 'button' });
    const paintCmp = () => { const on = S(() => store.inCompare(l.s), false); const n = S(() => store.compare.length, 0); cmpBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); cmpBtn.innerHTML = ''; put(cmpBtn, ico('compare'), on ? `U poređenju (${n})` : 'Uporedi'); };
    cmpBtn.addEventListener('click', () => {
      const was = S(() => store.inCompare(l.s), false);
      const on = S(() => store.toggleCompare(l.s), false);
      paintCmp();
      if (on) say(`Dodato u poređenje (${store.compare.length} od 4)`, { action: { label: 'Uporedi', href: ROUTE.compare(store.compare) } });
      else if (was) say('Uklonjeno iz poređenja');
    });
    paintCmp();
    const shareBtn = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
      const url = S(() => location.href.split('#')[0], '') + ROUTE.listing(l.s);
      copyText(url, 'Link do oglasa je kopiran');
    } }, ico('share'), 'Podeli');
    const hidden = () => S(() => KX.profile.get().hidden.has(l.s), false);
    const hideBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button' });
    const paintHide = () => { const on = hidden(); hideBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); hideBtn.innerHTML = ''; put(hideBtn, ico(on ? 'eye' : 'x'), on ? 'Sakriven' : 'Sakrij'); };
    const setHidden = (on) => { if (!hasKX()) return; const h = KX.profile.get().hidden; if (on) h.add(l.s); else h.delete(l.s); KX.profile.set({ hidden: h }); paintHide(); };
    hideBtn.addEventListener('click', () => { const on = !hidden(); setHidden(on); if (on) say('Oglas je sakriven iz rezultata pretrage', { action: { label: 'Poništi', href: location.hash || ROUTE.listing(l.s), onClick: (e) => { if (e) e.preventDefault(); setHidden(false); say('Oglas se ponovo prikazuje u rezultatima'); } } }); else say('Oglas se ponovo prikazuje u rezultatima'); });
    paintHide();
    if (!hasKX()) hideBtn.hidden = true;
    const reportBox = el('div', { class: 'lst-report', hidden: true, id: 'lst-prijava' });
    const repBtn = el('button', { class: 'btn btn-ghost btn-sm', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'lst-prijava' }, ico('flag'), 'Prijavi oglas');
    const toggleReport = (open) => { const o = open == null ? reportBox.hidden : open; reportBox.hidden = !o; repBtn.setAttribute('aria-expanded', o ? 'true' : 'false'); if (o) { if (!reportBox.firstChild) reportBox.appendChild(reportForm(l, () => toggleReport(false))); const f = reportBox.querySelector('input,textarea,button'); if (f) f.focus({ preventScroll: true }); reportBox.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' }); } };
    repBtn.addEventListener('click', () => toggleReport());
    contact.onReport = () => toggleReport(true);
    life.onMount(() => { const off = S(() => store.on((w) => { if (w === 'favs') paintFav(); if (w === 'compare') paintCmp(); }), null); if (off) life.onUnmount(off); });
    const actions = el('div', { class: 'actions lst-actions' }, favBtn, shareBtn, cmpBtn, hideBtn, repBtn);
    return el('header', { class: 'lst-head', id: 'lst-top' }, meta, h1, street, loc, stats, actions, reportBox);
  }

  function reportForm(l, onClose) {
    const reasons = ['Prevara ili sumnjiv oglas', 'Pogrešna cena', 'Već prodato / izdato', 'Duplikat oglasa', 'Agencija se predstavlja kao vlasnik', 'Pogrešna lokacija ili fotografije'];
    let pick = null;
    const name = 'rep-' + l.s.slice(-7);
    const opts = reasons.map((r) => S(() => check(r, false, () => { pick = r; err.hidden = true; }, { type: 'radio', name, value: r }), null));
    const ta = el('textarea', { class: 'input', rows: '3', placeholder: 'Šta nije u redu? (opciono)' });
    const err = el('p', { class: 'help err', hidden: true, role: 'alert' }, 'Izaberi razlog prijave.');
    const form = el('form', { class: 'lst-repform', novalidate: true },
      el('fieldset', {}, el('legend', { class: 'eyebrow' }, 'Razlog prijave'), el('div', { class: 'lst-radios' }, opts)),
      field('Napomena', ta), err,
      el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-secondary btn-sm', type: 'submit' }, 'Pošalji prijavu'), el('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: onClose }, 'Odustani')));
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (!pick) { err.hidden = false; return; }
      const code = 'P-' + String(hash(l.s + pick) % 90000 + 10000);
      const all = lsGet('kv.reports', []); all.push({ s: l.s, reason: pick, note: ta.value.slice(0, 500), code, at: new Date().toISOString() }); lsSet('kv.reports', all.slice(-50));
      form.replaceWith(el('div', { class: 'lst-done', role: 'status' }, ico('check-circle'), el('div', {}, el('b', {}, 'Hvala — prijava je zabeležena.'), el('p', {}, `Šifra prijave ${code}. Moderator proverava oglas ${l.r} u roku od 24 sata; razlog: „${pick}”.`))));
    });
    return form;
  }

  /* ───────────────── blok cene (Merilo + istorija + rata) ───────────────── */
  function priceBlockX(l, hist, grp, refreshers) {
    const rent = l.t === 'izdavanje';
    const lastChange = hist && hist.changes.length ? hist.changes[hist.changes.length - 1] : null;
    const old = lastChange && lastChange.from > lastChange.to ? lastChange.from : null;
    const big = el('p', { class: 'big' }, price(l.p, l.t), old ? el('s', { 'aria-label': 'ranija cena' }, price(old, l.t)) : null);
    const dc = S(() => deltaChip(l), null);
    const ppmLine = l.ppm && l.pt !== 'zemljiste'
      ? el('p', { class: 'sub' }, el('b', {}, S(() => fmt.ppm(l.ppm), '')), dc, el('span', { class: 'dot' }), l.neg ? 'cena nije fiksna' : 'fiksna cena')
      : el('p', { class: 'sub' }, l.pt === 'zemljiste' && l.la ? el('b', {}, `${eur(l.p / (l.la / 100))} po aru`) : null, l.pt === 'zemljiste' && l.la ? el('span', { class: 'dot' }) : null, l.neg ? 'cena nije fiksna' : 'fiksna cena');
    const credit = el('div', { class: 'lst-credit' });
    const paintCredit = () => {
      credit.innerHTML = '';
      if (rent) {
        const c = hasKX() ? S(() => KX.cost(l), null) : null;
        put(credit, el('p', { class: 'sub' }, 'depozit ', el('b', {}, l.dep ? (l.dep <= l.p * 1.05 ? '1 kirija' : l.dep <= l.p * 2.05 ? '2 kirije' : eur(l.dep)) : '1 kirija'), el('span', { class: 'dot' }), 'računi nisu uključeni'),
          c ? el('p', { class: 'sub' }, 'sa računima ≈ ', el('b', {}, `${eur(c.monthly)}/mes`), el('span', { class: 'dot' }), el('a', { href: '#lst-troskovi', onclick: (e) => { e.preventDefault(); scrollToId('lst-troskovi'); } }, 'koliko me košta')) : null);
        return;
      }
      if (!(l.p >= 10000)) return;
      const P = hasKX() ? KX.profile.get() : { ltv: 0.8, ratePct: 5, years: 25 };
      const gate = hasKX() ? S(() => KX.afford(l).gate, null) : null;
      if (gate && gate.financeable === 'ne') {
        put(credit, el('p', { class: 'sub lst-nocredit' }, ico('alert', 14), l.pt === 'zemljiste' ? 'Banke po pravilu ne finansiraju zemljište — računaj na keš.' : 'Banke ne kreditiraju neuknjižene nekretnine — samo keš.'));
        return;
      }
      /* ista rata kao u „Koliko me košta” i „Keš ili kredit”: kredit = cena + troškovi − keš iz profila (KX.cost) */
      const c = hasKX() ? S(() => KX.cost(l), null) : null;
      const rl = c ? c.lines.find((x) => x.key === 'rata') : null;
      const chg = el('button', { class: 'lst-lnk', type: 'button', onclick: () => openProfileSheet('rate') }, 'promeni');
      let line;
      if (c && !rl) {
        line = el('p', { class: 'sub' }, el('b', {}, 'Kupovina za keš'), P.financing === 'kes' ? ' · računamo bez kredita' : ' · tvoj keš pokriva cenu i troškove', el('span', { class: 'dot' }), chg);
      } else {
        const loan = c ? c.loan : l.p * P.ltv;
        const m = rl ? rl.amount : hasKX() ? KX.annuity(loan, P.ratePct, P.years) : S(() => mortgage(loan, P.ratePct, P.years).monthly, 0);
        const downPct = c ? clamp(Math.round((c.downPayment || 0) / l.p * 100), 0, 100) : Math.round((1 - P.ltv) * 100);
        line = el('p', { class: 'sub' }, 'Rata ≈ ', el('b', {}, `${eur(m)}/mes`), ` uz ${downPct} % učešća, ${P.years} god., ${nf1.format(P.ratePct)} %`, el('span', { class: 'dot' }), chg);
      }
      put(credit, line,
      gate && gate.financeable === 'zavisi' ? el('p', { class: 'sub lst-muted' }, 'Kredit zavisi od banke: ', S(() => KX.legalLabel[gate.legal], gate.legal).toLowerCase(), '.') : null);
    };
    paintCredit();
    refreshers.push(paintCredit);
    const merilo_ = S(() => merilo(l), null);
    const dupLine = grp ? el('p', { class: 'sub lst-dupline' }, ico('blocks', 14), `Isti ${PT_ACC[l.pt] || 'oglas'} nudi još ${grp.offers.length - 1} ${plural(grp.offers.length - 1, 'oglašivač', 'oglašivača', 'oglašivača')} · ${eur(grp.span.min)} – ${eur(grp.span.max)}`, el('a', { href: '#lst-isti', onclick: (e) => { e.preventDefault(); scrollToId('lst-isti'); } }, 'uporedi ponude')) : null;
    const left = el('div', { class: 'left' }, big, ppmLine, credit, dupLine, merilo_);
    const right = historyMini(l, hist);
    return el('section', { class: 'priceblock lst-pb', id: 'lst-cena', 'aria-label': 'Cena' }, left, right);
  }

  /* sparkline cene oglasa iz KX.history (deli se sa sekcijom „Istorija cene”) */
  function historySpark(l, hist) {
    if (!hist || !hist.points || !hist.points.length) return null;
    const vals = hist.points.map((p) => p.p);
    const months = hist.points.map((p) => p.m);
    const changed = hist.changes.length > 0;
    const d = changed ? S(() => deltaChip({ pct: hist.dropPct, label: 'prve objave' }, { title: `Promena tražene cene od prve objave: ${pct(hist.dropPct, true)}` }), null) : null;
    return S(() => sparkline(vals, {
      title: el('span', {}, 'Tražena cena', ' · ', el('b', {}, '12 meseci')),
      months, delta: d, format: (v) => price(v, l.t),
      aria: changed ? `Tražena cena: ${price(hist.p0, l.t)} pa ${price(l.p, l.t)} (${pct(hist.dropPct, true)})` : `Tražena cena bez promene: ${price(l.p, l.t)}`,
    }), null);
  }
  function historyMini(l, hist) {
    if (!hist) return el('div', { class: 'lst-hmini' });
    if (hist.changes.length) {
      return el('div', { class: 'lst-hmini' }, historySpark(l, hist),
        el('p', { class: 'meta' }, `${hist.changes.length === 1 ? 'Jedna promena cene' : `${hist.changes.length} promene cene`} · na oglasu ${days(hist.daysOnMarket)} · `, el('a', { href: '#lst-istorija', onclick: (e) => { e.preventDefault(); scrollToId('lst-istorija'); } }, 'istorija')));
    }
    /* bez promene cene oglasa: desna kolona nosi Merilo trend (§5.9/5.21) — €/m² u istoj oblasti kroz 12 meseci — a ispod kratko, pošteno: oglas nije menjao cenu */
    const trend = S(() => areaTrend(l), null);
    const summary = el('p', { class: 'meta lst-hm-own' }, el('b', {}, 'Ovaj oglas: bez promene cene'), ` · na oglasu ${days(hist.daysOnMarket)}${hist.bumped ? ' (obnavljan — brojimo od prvog dana)' : ''} · `,
      el('a', { class: 'lst-more', href: '#lst-istorija', onclick: (e) => { e.preventDefault(); scrollToId('lst-istorija'); } }, 'istorija'));
    if (trend) return el('div', { class: 'lst-hmini' }, trend, summary);
    return el('div', { class: 'lst-hmini flat' },
      el('p', { class: 'eyebrow' }, 'Istorija cene'),
      el('p', { class: 'lst-hm-t' }, 'Bez promene cene'),
      el('p', { class: 'meta' }, `Objavljen ${dateLong(hist.firstSeen)} — na oglasu ${days(hist.daysOnMarket)}${hist.bumped ? ' (oglas je obnavljan, brojimo od prvog dana)' : ''}.`),
      el('a', { class: 'meta lst-more', href: '#lst-istorija', onclick: (e) => { e.preventDefault(); scrollToId('lst-istorija'); } }, 'Ceo hronološki pregled'));
  }
  /* tražena cena po m² u oblasti Merila (naselje → opština → grad, isti t+pt) kroz 12 meseci:
     današnja medijana × indeks promena traženih cena istih oglasa (KX.history, podrezana sredina) — isti metod kao na pretrazi */
  const trendMemo = new Map();
  function areaTrend(l) {
    if (!hasKX() || !l.ppm || l.pt === 'zemljiste') return null;
    const ref = S(() => stats.refPpm(l), null);
    if (!ref || !ref.ppm || !(ref.n >= 5)) return null;
    const key = `${l.t}|${l.pt}|${ref.scope}|${ref.label}`;
    let tr = trendMemo.get(key);
    if (tr === undefined) {
      /* indeks promena traži dovoljno oglasa u svakom mesecu: oblast Merila ako ih ima ≥ 25, inače grad, inače svi oglasi istog tipa */
      const pool = S(() => D.listings, []).filter((x) => x.t === l.t && x.pt === l.pt && x.ppm > 0 && x.p > 0);
      /* obim Merila (naselje, opština, prigradske opštine, grad, manji gradovi regiona) — ista definicija kao core stats.refPpm */
      const inScope = (x) => (typeof stats.inScope === 'function' ? !x.syn && stats.inScope(x, l, ref) : (ref.scope === 'nbhd' ? x.ns === l.ns && x.cs === l.cs : ref.scope === 'mun' ? x.ms === l.ms : ref.scope === 'city' ? x.cs === l.cs : true));
      let list = pool.filter(inScope), idxScope = ref.label;
      if (list.length < 25) { list = pool.filter((x) => x.cs === l.cs); idxScope = l.c; }
      if (list.length < 25) { list = pool; idxScope = 'Srbija'; }
      const hs = list.slice(0, 300).map((x) => [x, S(() => KX.history(x), null)]).filter(([, h]) => h && h.points && h.points.length === 12);
      tr = null;
      if (hs.length >= 5) {
        const months = hs[0][1].points.map((p) => p.m);
        const tmean = (r) => { const a = r.slice().sort((x, y) => x - y); const k = Math.floor(a.length * 0.05); const t = a.slice(k, a.length - k); return t.reduce((x, y) => x + y, 0) / t.length; };
        const ratios = months.map((m, i) => { const r = hs.filter(([, h]) => h.points[i].listed !== false && h.points[i].p > 0).map(([x, h]) => h.points[i].p / x.p); return r.length >= 5 ? tmean(r) : null; });
        const firstIdx = ratios.findIndex((v) => v != null);
        if (firstIdx >= 0 && ratios.filter((v) => v != null).length >= 5) {
          const rnd = ref.ppm < 100 ? (v) => Math.round(v * 10) / 10 : Math.round;
          const vals = ratios.map((r) => rnd((r ?? ratios[firstIdx]) * ref.ppm));
          vals[vals.length - 1] = ref.ppm;
          tr = { vals, months, ch: (ref.ppm / vals[firstIdx] - 1) * 100, n: hs.length, idxScope };
        }
      }
      trendMemo.set(key, tr);
    }
    if (!tr) return null;
    const d = S(() => deltaChip({ pct: tr.ch, label: '12 meseci' }, { title: `${pct(tr.ch, true)} za 12 meseci — ${ref.label}, tražena cena istih oglasa (procena)` }), null);
    return S(() => sparkline(tr.vals, {
      title: el('span', {}, `Cena po m² — ${ref.label}`, ' · ', el('b', {}, '12 meseci')),
      months: tr.months, delta: d, format: ppmTxt,
      aria: `Tražena cena po m², ${ref.label}, 12 meseci: od ${ppmTxt(tr.vals[0])} do ${ppmTxt(tr.vals[tr.vals.length - 1])} (${pct(tr.ch, true)})`,
      source: `Današnja medijana (${ref.label}, n=${ref.n}) × promene traženih cena istih oglasa${tr.idxScope !== ref.label ? ` (${tr.idxScope})` : ''} — procena.`,
    }), null);
  }
  function domBar(hist, c) {
    const p = c.percentile;
    const label = c.scope === 'all' ? 'cela Srbija' : c.label;
    const sentence = p == null ? `Medijan (${label}): ${days(c.median)} na oglasu.` : `${p >= 50 ? 'Duže' : 'Kraće'} na oglasu od ${p >= 50 ? p : 100 - p} % sličnih oglasa (${label}, medijan ${days(c.median)}).`;
    return el('div', { class: 'lst-dom' },
      p == null ? null : el('div', { class: 'tr', role: 'img', 'aria-label': sentence }, el('span', { class: 'med' }), el('span', { class: 'dot', style: `left:${clamp(p, 3, 97)}%` })),
      el('p', { class: 'meta' }, sentence));
  }

  /* ───────────────── Koliko me stvarno košta (KX.cost) ───────────────── */
  function costSection(l, refreshers) {
    const rent = l.t === 'izdavanje';
    const holder = el('div', { class: 'lst-cost' });
    const st = { tab: rent ? 'useljenje' : 'kupovina', season: 'prosek', opt: new Set() };
    /* ponovno crtanje praznilo bi fokus: pamtimo kontrolu (data-k) koja ga je imala i vraćamo ga istoj kontroli */
    const focusKey = () => { const a = document.activeElement; if (!a || !holder.contains(a)) return null; const n = a.closest('[data-k]'); return n ? n.dataset.k : null; };
    const render = () => {
      const fk = focusKey();
      draw();
      if (fk) { const n = holder.querySelector(`[data-k="${fk}"]`); if (n) S(() => n.focus({ preventScroll: true })); }
    };
    const draw = () => {
      const noLoan = !rent && S(() => KX.afford(l).gate.financeable === 'ne', false);
      const c = S(() => (noLoan ? KX.cost(l, { financing: 'kes' }) : KX.cost(l)), null);
      holder.innerHTML = '';
      if (!c) { holder.appendChild(el('p', { class: 'meta' }, 'Troškovi trenutno nisu dostupni.')); return; }
      const P = KX.profile.get();
      /* „Kasnije” samo kad ima smisla: novogradnja (povraćaj PDV-a) ili stvarni kasniji priliv/trošak */
      const hasLater = !rent && (c.taxMode === 'pdv' || (c.laterInflow || 0) !== 0 || c.lines.some((x) => x.when === 'kasnije'));
      if (st.tab === 'kasnije' && !hasLater) st.tab = 'kupovina';
      const tabsDef = rent
        ? [['useljenje', 'Pri useljenju'], ['mesecno', 'Mesečno']]
        : [['kupovina', 'Na dan kupovine']].concat(c.lines.some((x) => x.when === 'useljenje') ? [['useljenje', 'Pri useljenju']] : [], c.lines.some((x) => x.when === 'mesecno') ? [['mesecno', 'Mesečno']] : [], hasLater ? [['kasnije', 'Kasnije']] : []);
      if (!tabsDef.some(([id]) => id === st.tab)) st.tab = tabsDef[0][0];
      const items = tabsDef.map(([id, label]) => ({ id: 'ck-' + id, label, panel: costPanel(l, c, P, id, st, render) }));
      /* jedan jedini tab (npr. plac za keš: samo „Na dan kupovine”) ne treba traku tabova */
      const t = items.length === 1 ? el('div', { class: 'lst-cost-one', id: 'panel-' + items[0].id }, el('p', { class: 'eyebrow' }, items[0].label), items[0].panel)
        : S(() => tabs(items, { active: 'ck-' + st.tab, onChange: (id) => { st.tab = id.slice(3); } }), null);
      const controls = el('div', { class: 'lst-cost-ctl' });
      const isNew = c.taxMode === 'pdv';
      if (!rent && isNew) controls.appendChild(tgRow(c.priceIncludesVat !== false, (on) => KX.profile.set({ vatIncluded: on }), 'Cena uključuje PDV', null, 'tg-vat'));
      if (!rent && (l.pt === 'stan' || l.pt === 'kuca')) {
        controls.appendChild(tgRow(!!P.firstHome, (on) => KX.profile.set({ firstHome: on }), 'Kupujem prvi stan',
          !isNew ? 'Za starogradnju oslobođenje od poreza za prvi stan umanjuje iznos već na dan kupovine — nema kasnijeg povraćaja.' : null, 'tg-first'));
        if (P.firstHome) controls.appendChild(el('label', { class: 'lst-hh' }, el('span', {}, 'Članova domaćinstva'), S(() => select([1, 2, 3, 4, 5, 6].map((n) => ({ v: String(n), l: String(n) })), String(P.household || 1), (v) => KX.profile.set({ household: v }), { inline: true, label: 'Članova domaćinstva' }), null)));
        const hh = controls.querySelector('.lst-hh select'); if (hh) hh.dataset.k = 'hh';
      }
      if (!rent && noLoan) controls.appendChild(el('p', { class: 'meta lst-fin' }, l.pt === 'zemljiste' ? 'Banke po pravilu ne finansiraju zemljište — računamo kupovinu za keš.' : 'Banke ne finansiraju neuknjižene nekretnine — računamo kupovinu za keš.'));
      else if (!rent) controls.appendChild(el('p', { class: 'meta lst-fin' }, P.financing === 'kes' ? 'Računamo kupovinu za keš.' : !(c.loan > 0) ? 'Tvoj keš pokriva cenu i troškove — bez kredita.' : `Računamo kredit: ${clamp(Math.round((c.downPayment || 0) / l.p * 100), 0, 100)} % učešća, ${P.years} god., ${nf1.format(P.ratePct)} %.`, ' ',
        el('button', { class: 'lst-lnk', type: 'button', 'data-k': 'fin', onclick: () => KX.profile.set({ financing: P.financing === 'kes' ? 'kredit' : 'kes' }) }, P.financing === 'kes' ? 'Računaj sa kreditom' : 'Računaj za keš'), ' · ',
        el('button', { class: 'lst-lnk', type: 'button', 'data-k': 'cond', onclick: () => openProfileSheet('income') }, 'promeni uslove')));
      put(holder, controls.childNodes.length ? controls : null, t || el('div'),
        el('details', { class: 'lst-assume' }, el('summary', {}, 'Pretpostavke', ico('chev-d', 16)),
          el('ul', {}, (c.assumptions || []).map((a) => el('li', {}, a))),
          el('p', { class: 'meta' }, 'Iznosi označeni sa ≈ su procena. ', el('a', { href: ROUTE.ledger }, 'Kako računamo'))));
    };
    render();
    refreshers.push(render);
    const c0 = S(() => KX.cost(l), null);
    const has = (w) => !!(c0 && c0.lines.some((x) => x.when === w));
    const whenTxt = ['na dan kupovine', has('useljenje') ? 'pri useljenju' : null, has('mesecno') ? 'svakog meseca' : null].filter(Boolean);
    const saleSub = `Ne cena iz oglasa, nego koliko ćeš zaista platiti — ${whenTxt.length > 1 ? whenTxt.slice(0, -1).join(', ') + ' i ' + whenTxt[whenTxt.length - 1] : whenTxt[0] + ', sa porezom, provizijom i overom'}.`;
    return section('lst-troskovi', 'Koliko me stvarno košta', rent ? 'Ne samo kirija: šta treba da imaš za ključeve i koliko te stan košta svakog meseca.' : saleSub, holder);
  }

  function costPanel(l, c, P, when, st, rerender) {
    const rent = c.kind === 'izdavanje';
    let lines = c.lines.filter((x) => x.when === when);
    const season = st.season;
    const amountOf = (x) => (when === 'mesecno' && season !== 'prosek' && x[season] != null ? x[season] : x.amount);
    const rows = lines.map((x) => {
      const counted = !x.optional || st.opt.has(x.key);
      const excluded = x.payer === 'prodavac' || x.payer === 'vlasnik';
      const togglePayer = x.key === 'porez' ? () => KX.profile.set({ taxPayer: x.payer === 'prodavac' ? 'kupac' : 'prodavac' })
        : x.key === 'provizija' && !rent && l.ags ? () => KX.profile.set({ agencyPayer: x.payer === 'prodavac' ? 'kupac' : 'prodavac' }) : null;
      let amt;
      if (x.included) amt = el('span', { class: 'amt inc' }, `u ceni (${eur(x.inPrice || 0)})`);
      else amt = el('span', { class: ['amt', 'num', x.amount < 0 && 'neg', (excluded || !counted) && 'off'] }, (x.estimate ? '≈ ' : '') + (x.amount < 0 ? '−' : x.key === 'cena' || x.key === 'kirija' || x.key === 'kirija-mes' ? '' : '') + nf0.format(Math.abs(Math.round(amountOf(x)))) + NB + '€');
      const showPayer = togglePayer || (x.amount !== 0 && x.key !== 'cena' && x.key !== 'kirija' && x.key !== 'kirija-mes') || x.included;
      const pc = showPayer ? payerChip(x.payer, togglePayer) : null;
      if (pc && togglePayer) pc.dataset.k = 'payer-' + x.key;
      const chips = [pc, x.optional ? el('span', { class: 'lst-payer is-opt' }, 'Opciono') : null, x.refundable ? el('span', { class: 'lst-payer is-ref' }, 'Vraća se') : null].filter(Boolean);
      return el('li', { class: ['lst-line', x.optional && 'opt', excluded && 'ex', x.refundable && 'ref'] },
        el('div', { class: 'l' },
          el('div', { class: 'r1' },
            x.optional ? S(() => { const ck = check(x.label, st.opt.has(x.key), (on) => { if (on) st.opt.add(x.key); else st.opt.delete(x.key); rerender(); }); const inp = ck.querySelector('input'); if (inp) inp.dataset.k = 'opt-' + x.key; return ck; }, el('span', {}, x.label)) : el('span', { class: 'lb' }, x.label),
            chips.length ? el('span', { class: 'chips' }, chips) : null),
          x.note ? el('span', { class: 'nt' }, x.note) : null),
        amt);
    });
    const optSum = lines.filter((x) => x.optional && st.opt.has(x.key)).reduce((t, x) => t + x.amount, 0);
    let total = 0, totalLabel = '', foot = null, extra = null;
    if (when === 'kupovina') {
      total = c.onPurchase + optSum; totalLabel = 'Ukupno na dan kupovine';
      if (c.loan > 0) foot = el('p', { class: 'meta lst-split' }, 'Od toga kredit ', el('b', {}, eur(c.loan)), ' · iz džepa (učešće + troškovi) ', el('b', {}, eur(total - c.loan)));
    } else if (when === 'useljenje') {
      total = (rent ? c.moveIn : c.moveIn) + optSum; totalLabel = rent ? 'Potrebno za ključeve' : 'Ukupno pri useljenju';
      if (rent && c.refundable) {
        const ref = c.refundable, non = Math.max(0, total - ref);
        foot = el('div', { class: 'lst-refbar' },
          el('div', { class: 'bar', role: 'img', 'aria-label': `Povratno ${eur(ref)}, trošak ${eur(non)}` }, el('i', { class: 'non', style: `width:${(non / Math.max(1, total) * 100).toFixed(1)}%` }), el('i', { class: 'ref', style: `width:${(ref / Math.max(1, total) * 100).toFixed(1)}%` })),
          el('p', { class: 'meta' }, el('span', { class: 'k non' }), `Trošak ${eur(non)}`, el('span', { class: 'k ref' }), `Depozit ${eur(ref)} — vraća se pri iseljenju, zamrznut novac, ne trošak.`));
      }
    } else if (when === 'mesecno') {
      total = season === 'zima' ? c.monthlyWinter : season === 'leto' ? c.monthlySummer : c.monthly;
      total += optSum; totalLabel = rent ? 'Mesečno sa računima' : 'Mesečno ukupno';
      const hasSeason = lines.some((x) => x.winter != null);
      const SEAS = ['prosek', 'zima', 'leto'];
      if (hasSeason) extra = S(() => { const sg = segmented([{ v: 'prosek', l: 'Prosek' }, { v: 'zima', l: 'Zima' }, { v: 'leto', l: 'Leto' }], season, (v) => { st.season = v; rerender(); }); [...sg.children].forEach((b, i) => { b.dataset.k = 'season-' + SEAS[i]; }); return sg; }, null);
      if (!lines.length) rows.push(el('li', { class: 'lst-line' }, el('div', { class: 'l' }, el('span', { class: 'lb' }, 'Mesečni troškovi se ne procenjuju za ovaj tip nekretnine.'))));
    } else if (when === 'kasnije') {
      /* KX.cost daje laterInflow kao pozitivan priliv: prikazujemo ga kao povraćaj (−, zeleno), nikad kao trošak */
      const inflow = c.laterInflow || 0;
      total = -inflow; totalLabel = inflow > 0 ? 'Vraća ti se kasnije' : 'Kasnije';
      if (!lines.length) {
        rows.push(el('li', { class: 'lst-line' }, el('div', { class: 'l' }, el('span', { class: 'lb' }, c.taxMode === 'pdv'
          ? (P.firstHome ? 'Povraćaj PDV-a nije primenljiv za ovu nekretninu.' : 'Ako kupuješ prvi stan, deo PDV-a ti se vraća oko 45 dana posle kupovine — uključi „Kupujem prvi stan”.')
          : 'Za starogradnju nema kasnijih priliva: oslobođenje od poreza za prvi stan umanjuje iznos već na dan kupovine.'))));
      }
      if (c.taxMode === 'pdv') {
        foot = el('div', { class: 'lst-cond' }, el('p', { class: 'eyebrow' }, 'Uslovi za povraćaj PDV-a'),
          el('ul', {}, ['prva kupovina stana od investitora (prvi prenos prava)', 'kupac je državljanin Srbije sa prebivalištem u Srbiji i od 1. jula 2006. nije imao stan u svojini', 'članovi domaćinstva prijavljeni na istoj adresi', 'cela cena plaćena na račun prodavca', 'pravo se koristi jednom — zahtev na obrascu RFN'].map((t) => el('li', {}, t))),
          el('p', { class: 'meta' }, '40 m² za kupca + 15 m² po članu domaćinstva; PDV se vraća na neto cenu (bez PDV-a), ≈ 45 dana posle kupovine — zato ne smanjuje novac potreban na dan kupovine.'));
      }
    }
    const totalEl = el('div', { class: ['lst-total', total < 0 && 'neg'] }, el('span', {}, totalLabel), el('b', { class: 'num' }, (total < 0 ? '−' : '') + nf0.format(Math.abs(Math.round(total))) + NB + '€' + (when === 'mesecno' ? '/mes' : '')));
    return el('div', { class: 'lst-costp' }, extra ? el('div', { class: 'lst-season' }, extra) : null, el('ul', { class: 'lst-lines' }, rows), totalEl, foot);
  }

  /* ───────────────── Keš ili kredit (KX.afford) ───────────────── */
  function affordSection(l, refreshers) {
    const holder = el('div', { class: 'lst-aff' });
    const render = () => {
      holder.innerHTML = '';
      const a = S(() => KX.afford(l), null);
      if (!a) return;
      const P = KX.profile.get();
      const gateTxt = { da: 'Banka može da finansira', zavisi: 'Finansiranje zavisi od banke', ne: 'Banka ne finansira — samo keš' }[a.gate.financeable] || '';
      const gate = el('p', { class: 'lst-gate is-' + a.gate.financeable }, ico(a.gate.financeable === 'da' ? 'check-circle' : 'alert', 16), el('b', {}, gateTxt), ` · pravni status: ${S(() => KX.legalLabel[a.gate.legal], a.gate.legal).toLowerCase()}`);
      if (a.state === 'nepoznato') {
        put(holder, gate,
          el('p', { class: 'lst-lede' }, 'Unesi platu i ušteđevinu, a mi ćemo za ovaj i svaki drugi oglas reći: možeš odmah, može na kredit, samo za keš ili van budžeta.'),
          el('div', { class: 'btn-row' }, el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => openProfileSheet('income') }, ico('calc'), 'Unesi platu i keš')));
        return;
      }
      const cap = S(() => KX.creditCapacity(), null) || { maxRata: 0 };
      const badge_ = el('span', { class: 'lst-state is-' + a.state }, a.label);
      const top = el('div', { class: 'lst-aff-top' }, badge_, el('p', {}, a.reason));
      let gauge = null;
      if (cap.maxRata > 0 && a.monthly > 0) {
        const max = Math.max(cap.maxRata, a.monthly) * 1.15;
        const pos = clamp(a.monthly / max * 100, 2, 98), lim = clamp(cap.maxRata / max * 100, 2, 98);
        gauge = el('div', { class: 'lst-gauge', role: 'img', 'aria-label': `Rata ${eur(a.monthly)} od najviše ${eur(cap.maxRata)} mesečno` },
          el('div', { class: 'tr' }, el('i', { class: 'fill', style: `width:${pos.toFixed(1)}%` }), el('span', { class: 'lim', style: `left:${lim.toFixed(1)}%` }), el('span', { class: 'dot', style: `left:${pos.toFixed(1)}%` })),
          el('div', { class: 'lbl' }, el('span', {}, 'Rata ', el('b', {}, eur(a.monthly))), el('span', {}, `Maks. ${eur(cap.maxRata)} (${Math.round(cap.dti * 100)} % prihoda)`)));
      }
      const what = [
        ['Učešće +10.000 €', { cash: (P.cash || 0) + 10000 }],
        ['Rok 30 godina', { years: 30 }],
        /* kad je kredit već moguć, prihod partnera ne menja ni ishod ni ratu — tada pokazujemo nižu kamatu */
        a.state === 'kredit' || a.state === 'odmah'
          ? [`Kamata ${nf1.format(Math.max(0.5, (P.ratePct || 5) - 0.5))} % (−0,5)`, { ratePct: Math.max(0.5, (P.ratePct || 5) - 0.5) }]
          : [P.partnerIncome > 0 ? `Prihod partnera +200 €` : `Prihod partnera ${eur(Math.max(600, Math.round((P.income || 1000) * 0.8 / 50) * 50))}`, { partnerIncome: P.partnerIncome > 0 ? P.partnerIncome + 200 : Math.max(600, Math.round((P.income || 1000) * 0.8 / 50) * 50) }],
      ].map(([lbl, patch]) => {
        const r = S(() => KX.afford(l, patch), null);
        if (!r) return null;
        const better = r.state !== a.state;
        return el('li', {}, el('span', { class: 'k' }, lbl), ico('arrow-right', 14),
          el('span', { class: 'lst-state sm is-' + r.state }, r.label),
          r.monthly && r.state === 'kredit' && a.monthly > 0 ? (() => { const d = Math.round(r.monthly - a.monthly); return el('span', { class: 'meta num' }, d === 0 ? 'rata bez promene' : `${d > 0 ? '+' : '−'}${eur(Math.abs(d))}/mes`); })() : null,
          better ? el('span', { class: 'meta' }, 'menja ishod') : null);
      });
      put(holder, gate, top, gauge,
        el('div', { class: 'lst-whatif' }, el('p', { class: 'eyebrow' }, 'Šta ako'), el('ul', {}, what)),
        el('p', { class: 'meta' }, `Profil: plata ${eur((P.income || 0) + (P.partnerIncome || 0))}/mes, keš ${eur(P.cash || 0)}. `, el('button', { class: 'lst-lnk', type: 'button', onclick: () => openProfileSheet('income') }, 'Promeni'), ' · ', el('a', { href: ROUTE.calc(l) }, 'Otvori kalkulator')));
    };
    render();
    refreshers.push(render);
    return section('lst-kes', 'Keš ili kredit', 'Da li se ovaj oglas uklapa u tvoj budžet — sa porezom, provizijom i pravilom banke da finansira samo uknjiženo.', holder);
  }

  /* ───────────────── Fer cena i pregovarač (KX.fair) ───────────────── */
  /* zaštita: kad uporedivi oglasi dolaze iz drugih delova grada, procena protivreči Merilu (Δ prema oblasti) ili je
     nerealno velika (> 30 %) — tada stranica ne daje presudu (ni u fer ceni ni u semaforu), samo objašnjenje i tabelu uporedivih */
  function fairCheck(l) {
    const f = hasKX() && (l.pt === 'stan' || l.pt === 'kuca') ? S(() => KX.fair(l), null) : null;
    if (!f) return { f: null, unsure: false };
    const dl = S(() => stats.delta(l), null);
    const ppmD = dl && dl.pct != null && (dl.n == null || dl.n >= 5) ? dl.pct : null;
    const unsure = !!(f.estimate && f.diffPct != null && (Math.abs(f.diffPct) > 30 || (ppmD != null && Math.abs(f.diffPct) >= 6 && Math.abs(ppmD) >= 5 && Math.sign(f.diffPct) !== Math.sign(ppmD))));
    return { f, dl, ppmD, unsure };
  }
  /* razlozi semafora za prikaz: bez presude iz nesigurne procene, bez padežnih grešaka */
  function trustReasons(l, tr) {
    const unsure = fairCheck(l).unsure;
    return (tr.reasons || []).filter((r) => !(unsure && /procen/i.test(r))).map(fixCase);
  }
  function fairSection(l, contact) {
    if (!(l.pt === 'stan' || l.pt === 'kuca')) return null;
    const { f, dl, ppmD, unsure } = fairCheck(l);
    if (!f) return null;
    const rent = l.t === 'izdavanje';
    const body = el('div', { class: 'lst-fair' });
    const farComps = (f.comps || []).filter((c) => c.km != null && c.km > 3).length;
    if (unsure) {
      put(body,
        el('div', { class: 'lst-verdict' }, el('p', { class: 'v lst-unsure' }, 'Procena nesigurna')),
        el('p', { class: 'lst-lede' }, `Uporedivi oglasi su iz drugih delova grada${farComps ? ` (${farComps} od ${f.comps.length} dalje od 3 km)` : ''}, pa procena (${price(f.estimate.low, l.t)} – ${price(f.estimate.high, l.t)}) ne odgovara ovom kraju.`),
        el('p', { class: 'lst-sub' }, ppmD != null ? `Pouzdaniji signal je Merilo: ${ppmTxt(l.ppm)} je ${pct(Math.abs(ppmD))} ${ppmD >= 0 ? 'iznad' : 'ispod'} medijane oblasti (${dl.label}, ${ppmTxt(dl.ppm)}, n=${dl.n}).` : 'Pogledaj uporedive oglase ispod i proveri cenu sa oglašivačem.'));
    } else if (!f.estimate) {
      body.appendChild(el('p', { class: 'lst-lede' }, `Nema dovoljno uporedivih oglasa za pouzdanu procenu (${f.n || f.comps.length} u blizini). Pokazujemo najbliže, bez presude.`));
    } else {
      const v = f.verdict;
      const vtxt = v === 'ispod' ? `${pct(Math.abs(f.diffPct))} ispod procene` : v === 'iznad' ? `${pct(f.diffPct)} iznad procene` : 'U skladu sa procenom';
      const vsub = v === 'ispod' ? 'Traženo je ispod onoga što slični oglasi traže — proveri razlog (stanje, teret, hitna prodaja).' : v === 'iznad' ? 'Traženo je iznad sličnih oglasa — ima prostora za pregovor.' : 'Traženo je u opsegu sličnih oglasa (±6 %).';
      const lo = f.estimate.low, hi = f.estimate.high, mid = f.estimate.mid;
      const nego = f.negotiation || {};
      const pts = [lo, hi, l.p, nego.firstOffer].filter((x) => x > 0);
      const mn = Math.min(...pts) * 0.97, mx = Math.max(...pts) * 1.03;
      const X = (val) => clamp((val - mn) / (mx - mn) * 100, 1, 99);
      const range = el('div', { class: 'lst-range', role: 'img', 'aria-label': `Procena ${price(lo, l.t)} – ${price(hi, l.t)}; traženo ${price(l.p, l.t)}${nego.firstOffer ? `; prva ponuda ${price(nego.firstOffer, l.t)}` : ''}` },
        el('div', { class: 'tr' },
          el('i', { class: 'band', style: `left:${X(lo).toFixed(1)}%;width:${(X(hi) - X(lo)).toFixed(1)}%` }),
          el('span', { class: 'mid', style: `left:${X(mid).toFixed(1)}%` }),
          nego.firstOffer && !rent ? el('span', { class: 'mk offer', style: `left:${X(nego.firstOffer).toFixed(1)}%` }) : null,
          el('span', { class: 'mk ask', style: `left:${X(l.p).toFixed(1)}%` })),
        el('div', { class: 'leg' },
          el('span', {}, el('i', { class: 'k band' }), 'Procena ', el('b', { class: 'num' }, `${price(lo, l.t)} – ${price(hi, l.t)}`)),
          el('span', {}, el('i', { class: 'k ask' }), 'Traženo ', el('b', { class: 'num' }, price(l.p, l.t))),
          nego.firstOffer && !rent ? el('span', {}, el('i', { class: 'k offer' }), 'Prva ponuda ', el('b', { class: 'num' }, price(nego.firstOffer, l.t))) : null));
      put(body, 
        el('div', { class: 'lst-verdict' }, el('p', { class: 'v' }, vtxt), S(() => deltaChip({ pct: f.diffPct, label: 'procene' }, { title: `${pct(f.diffPct, true)} u odnosu na procenu ${price(mid, l.t)}` }), null)),
        el('p', { class: 'lst-sub' }, vsub, ` Procena: ${ppmTxt(rent || l.ppm < 100 ? Math.round(mid / l.a * 10) / 10 : f.estimate.ppm)} × ${S(() => fmt.m2(l.a), '')} iz ${f.n} uporedivih oglasa.`),
        range,
        f.adjustments && f.adjustments.length ? el('p', { class: 'meta lst-adj' }, 'Korekcije: ', f.adjustments.map((a) => `${a.label} ${pct(a.pct, true)}`).join(' · ')) : null);
    }
    /* uporedivi oglasi */
    if (f.comps && f.comps.length) {
      const comps = f.comps.slice(0, 8);
      const tr = (c) => {
        const cl = S(() => find.listing(c.s), null);
        return el('tr', {},
          el('td', {}, el('span', { class: 'ttl' }, c.n || '—'), el('span', { class: 'sub ph-only' }, [c.a ? `${nf0.format(c.a)} m²` : null, c.ro != null ? roomsTxt(c.ro) : null, c.fl != null ? S(() => fmt.floor(c.fl), '') : null].filter(Boolean).join(' · ')),
            c.km != null ? el('span', { class: 'sub' }, `${nf1.format(c.km)} km odavde`) : null),
          el('td', { class: 'num d' }, c.a ? `${nf0.format(c.a)} m²` : '—'),
          el('td', { class: 'num d' }, c.ro != null ? S(() => fmt.roomsN(c.ro), '') : '—'),
          el('td', { class: 'num d' }, c.fl != null ? S(() => fmt.floor(c.fl), '') : '—'),
          el('td', { class: 'num' }, S(() => fmt.ppm(c.ppm), '')),
          el('td', { class: 'num d' }, rel(c.dz)),
          el('td', { class: 'go' }, cl ? el('a', { class: 'iconbtn', href: ROUTE.listing(c.s), 'aria-label': `Otvori uporedivi oglas ${c.r || ''} — ${c.n || ''}` }, ico('chev-r')) : null));
      };
      body.appendChild(el('div', { class: 'lst-comps' },
        el('p', { class: 'eyebrow' }, `Uporedivi oglasi (${comps.length})`),
        el('table', { class: 'table lst-ctable' },
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Naselje'), el('th', { scope: 'col', class: 'num d' }, 'm²'), el('th', { scope: 'col', class: 'num d' }, 'Sobe'), el('th', { scope: 'col', class: 'num d' }, 'Sprat'), el('th', { scope: 'col', class: 'num' }, '€/m²'), el('th', { scope: 'col', class: 'num d' }, 'Objavljen'), el('th', { scope: 'col' }, el('span', { class: 'sr' }, 'Otvori')))),
          el('tbody', {},
            el('tr', { class: 'me' }, el('td', {}, el('span', { class: 'ttl' }, 'Ovaj oglas'), el('span', { class: 'sub ph-only' }, [l.a ? `${nf0.format(l.a)} m²` : null, l.ro != null ? roomsTxt(l.ro) : null, l.fl != null ? S(() => fmt.floor(l.fl), '') : null].filter(Boolean).join(' · '))),
              el('td', { class: 'num d' }, l.a ? `${nf0.format(l.a)} m²` : '—'), el('td', { class: 'num d' }, l.ro != null ? S(() => fmt.roomsN(l.ro), '') : '—'), el('td', { class: 'num d' }, l.fl != null ? S(() => fmt.floor(l.fl), '') : '—'),
              el('td', { class: 'num' }, el('b', {}, S(() => fmt.ppm(l.ppm), ''))), el('td', { class: 'num d' }, rel(l.dz)), el('td', {})),
            comps.map(tr)))));
    }
    /* pregovarač */
    const n0 = f.negotiation;
    const n = n0 ? { ...n0, arguments: (n0.arguments || []).filter((a) => !(unsure && /procen/i.test(a))).map(fixCase) } : null;
    if (n && f.estimate && n.arguments && n.arguments.length) {
      const sel = n.arguments.map((a) => !/^Oglas vlasnika/i.test(a));
      const levTxt = { slab: 'slaba', umeren: 'umerena', jak: 'jaka' }[n.leverage] || n.leverage;
      const levIdx = { slab: 1, umeren: 2, jak: 3 }[n.leverage] || 1;
      const isAgency = !!l.ags;
      const ta = el('textarea', { class: 'input lst-msg', rows: '8', readonly: true, 'aria-label': 'Poruka oglašivaču' });
      const compose = () => {
        const args = n.arguments.filter((_, i) => sel[i]);
        const offer = rent ? `${nf0.format(n.firstOffer)}${NB}€ mesečno` : price(n.firstOffer, l.t);
        return [
          'Poštovani,', '',
          `zainteresovan/a sam za ${PT_ACC[l.pt] || 'nekretninu'} iz oglasa ${l.r} (${l.n || l.m || l.c}, ${S(() => fmt.m2(l.a), '')}).`,
          args.length ? 'Pre obilaska želim da pomenem nekoliko stvari koje sam primetio/la:' : null,
          ...args.map((a) => '— ' + a),
          '',
          `S obzirom na to, bio/la bih spreman/na da ponudim ${offer}${rent ? '' : ', uz brzu realizaciju'}. Da li je moguće razgovarati o ceni i dogovoriti obilazak?`,
          '', 'Srdačan pozdrav',
        ].filter((x) => x !== null).join('\n');
      };
      const paint = () => { ta.value = compose(); ta.rows = Math.min(16, ta.value.split('\n').length + 2); };
      const argList = el('ul', { class: 'lst-args' }, n.arguments.map((a, i) => el('li', {}, S(() => check(a, sel[i], (on) => { sel[i] = on; paint(); }), el('span', {}, a)))));
      paint();
      body.appendChild(el('div', { class: 'lst-nego' },
        el('p', { class: 'eyebrow' }, 'Pregovarač'),
        el('div', { class: 'lst-tiles' },
          el('div', {}, el('b', { class: 'num' }, `${nf1.format(n.roomPct)} %`), el('span', {}, `prostor za pregovor ≈ ${price(n.roomEur, l.t)}`)),
          el('div', {}, el('b', { class: 'num' }, price(n.firstOffer, l.t)), el('span', {}, 'predlog prve ponude')),
          el('div', {}, el('b', { class: 'num lst-real' }, n.realistic.low === n.realistic.high ? `≈ ${price(n.realistic.low, l.t)}` : `${nf0.format(n.realistic.low)}–${price(n.realistic.high, l.t)}`), el('span', {}, 'realan dogovor'))),
        el('div', { class: 'lst-lev', role: 'img', 'aria-label': `Pregovaračka pozicija: ${levTxt}` }, [1, 2, 3].map((k) => el('i', { class: k <= levIdx ? 'on' : '' })), el('span', {}, `Pregovaračka pozicija: ${levTxt}`)),
        el('p', { class: 'eyebrow' }, 'Argumenti (uključi u poruku)'),
        argList,
        ta,
        el('div', { class: 'btn-row' },
          el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => copyText(ta.value, 'Poruka je kopirana') }, ico('copy'), isAgency ? 'Kopiraj poruku agentu' : 'Kopiraj poruku vlasniku'),
          el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => contact.openMessage(ta.value) }, 'Pošalji kroz formu'))));
    } else if (n && f.estimate) {
      body.appendChild(el('p', { class: 'meta lst-nego-none' }, 'Pregovarač nema jake argumente za ovaj oglas: cena je u skladu sa procenom, oglas je svež i nije sniživan.'));
    }
    body.appendChild(el('p', { class: 'meta' }, 'Procena se računa iz najbližih oglasa istog tipa u gradu (lokacija, kvadratura, struktura), ±6 %. Kad uporedivi oglasi nisu iz istog kraja, ne dajemo presudu. ', el('a', { href: ROUTE.ledger }, 'Kako računamo')));
    return section('lst-fer', 'Fer cena i pregovarač', `${l.pt === 'kuca' ? 'Koliko ovakva kuća realno vredi' : 'Koliko ovakav stan realno vredi'}, sa uporedivim oglasima na uvid, i koliko možeš da spustiš ${rent ? 'kiriju' : 'cenu'}.`, body);
  }

  /* ───────────────── Istorija cene + isti stan kod drugih ───────────────── */
  function historySection(l, hist, grp) {
    if (!hist) return null;
    const ev = [];
    ev.push({ when: dateLong(hist.firstSeen), label: 'Prvi put objavljen', val: price(hist.p0, l.t), kind: 'start' });
    hist.changes.forEach((c) => ev.push({ when: monthLong(c.m), label: c.to < c.from ? 'Snižena cena' : 'Povećana cena', val: `${price(c.from, l.t)} → ${price(c.to, l.t)}`, d: pct(c.pct, true), kind: c.to < c.from ? 'drop' : 'up' }));
    if (hist.bumped) ev.push({ when: `pre ${days(hist.shownDays)}`, label: 'Oglas obnovljen', val: 'datum objave kod nas ostaje isti', kind: 'renew' });
    ev.push({ when: 'Danas', label: 'Tražena cena', val: price(l.p, l.t), kind: 'now' });
    const tl = el('ol', { class: 'lst-tl' }, ev.map((e) => el('li', { class: 'is-' + e.kind }, el('span', { class: 'w' }, e.when), el('span', { class: 'e' }, el('b', {}, e.label), el('span', { class: 'num' }, e.val), e.d ? el('span', { class: 'delta ' + (e.kind === 'drop' ? 'down' : 'up') }, e.d) : null))));
    const headline = el('p', { class: 'lst-hl' }, `Objavljen ${dateLong(hist.firstSeen)} · na oglasu `, el('b', {}, days(hist.daysOnMarket)), hist.changes.length ? ` · ${hist.changes.length === 1 ? 'jedna promena cene' : hist.changes.length + ' promene cene'}` : ' · bez promene cene');
    const spark = hist.changes.length ? historySpark(l, hist) : null;
    const body = el('div', { class: 'lst-hist' }, headline,
      hist.bumped ? el('p', { class: 'note-rule' }, `Oglašivač je obnavljao oglas, pa se na drugim mestima vidi „${rel(hist.shownDays)}”. Kvadrat broji od prvog pojavljivanja — dugme „Obnovi” kod nas ne briše istoriju.`) : null,
      el('div', { class: 'lst-hist-g' }, spark, tl),
      hist.context && hist.context.median ? domBar(hist, hist.context) : null,
      el('p', { class: 'meta' }, 'Demo prikaz istorije: datumi i iznosi promena su deterministički simulirani; trenutna cena i broj dana su iz oglasa.'));
    let dup = null;
    if (grp && grp.offers && grp.offers.length > 1) {
      const cheapest = grp.master;
      dup = el('div', { class: 'lst-dupes', id: 'lst-isti' },
        el('h3', { class: 'lst-h3' }, 'Isti stan je oglašen i kod'),
        el('p', { class: 'lst-sub' }, `${grp.offers.length} ${plural(grp.offers.length, 'oglas', 'oglasa', 'oglasa')} · ${eur(grp.span.min)} – ${eur(grp.span.max)}${grp.saving ? ` · ušteda do ${eur(grp.saving)}` : ''}${grp.confidence === 'moguce' ? ' · moguće poklapanje' : ''}. Najranije objavljen pre ${days(Math.max(grp.daysMax || 0, hist.daysOnMarket, ...grp.offers.map((o) => o.dz || 0)))} — računamo od prvog oglasa.`),
        el('div', { class: 'table-wrap' }, el('table', { class: 'table lst-dtable' },
          el('thead', {}, el('tr', {}, el('th', { scope: 'col' }, 'Oglašivač'), el('th', { scope: 'col', class: 'num' }, 'Cena'), el('th', { scope: 'col', class: 'num d' }, '€/m²'), el('th', { scope: 'col', class: 'num d' }, 'Objavljen'), el('th', { scope: 'col' }, el('span', { class: 'sr' }, 'Otvori')))),
          el('tbody', {}, grp.offers.map((o) => el('tr', { class: o.s === l.s ? 'me' : '' },
            el('td', {}, el('span', { class: 'ttl' }, o.ag || 'Vlasnik', o.agv ? ico('check', 14) : null), o.s === l.s ? el('span', { class: 'sub' }, 'Ovaj oglas') : null, o.s === cheapest ? el('span', { class: 'lst-payer is-best' }, 'Najpovoljnije') : null,
              o.owner && grp.ownerPosing ? el('span', { class: 'sub warn' }, 'Moguće da agencija nastupa kao vlasnik') : null),
            el('td', { class: 'num' }, el('b', {}, price(o.p, l.t))), el('td', { class: 'num d' }, o.ppm ? S(() => fmt.ppm(o.ppm), '') : '—'), el('td', { class: 'num d' }, rel(o.dz)),
            el('td', { class: 'go' }, o.s !== l.s ? el('a', { class: 'iconbtn', href: ROUTE.listing(o.s), 'aria-label': `Otvori ponudu ${o.ag || 'vlasnika'}` }, ico('chev-r')) : null)))))));
    }
    return section('lst-istorija', 'Istorija cene', 'Svako sniženje i svaki dan na oglasu, zabeleženi.', el('div', {}, body, dup));
  }

  /* ───────────────── Osnovne informacije (§5.10) — odmah posle bloka cene ───────────────── */
  function factsSection(l, tr) {
    const C = S(() => COND, {}), H = S(() => HEAT, {}), F = S(() => FURN, {}), O = S(() => ORIENT, {});
    const yes = (k) => (l.am || []).includes(k);
    const NA = 'Nije navedeno';
    const flat = ['stan', 'poslovni-prostor', 'soba'].includes(l.pt);
    const house = l.pt === 'kuca' || l.pt === 'vikendica';
    /* redosled §5.10, pa pravni status, opremljenost i uslovi cene */
    const rows = [
      ['Kvadratura', l.a ? S(() => fmt.m2(l.a), null) : null, true],
      ['Struktura', l.ro != null ? S(() => fmt.rooms(l.ro), null) : null, ['stan', 'kuca', 'vikendica'].includes(l.pt)],
      ['Zemljište', l.la ? S(() => fmt.land(l.la), null) : null, false],
      /* cela kuća/vikendica nema položaj sprata — samo spratnost (broj etaža) */
      house ? ['Spratnost', l.tf ? `${l.tf} ${plural(l.tf, 'etaža', 'etaže', 'etaža')}` : null, false] : ['Sprat', l.fl != null ? S(() => fmt.floor(l.fl, l.tf), null) : null, flat],
      ['Godina gradnje', l.y ? l.y + '.' : null, !['zemljiste'].includes(l.pt)],
      ['Grejanje', l.he ? (H[l.he] || l.he) : null, !['zemljiste', 'garaza'].includes(l.pt)],
      ['Orijentacija', l.or ? (O[l.or] || l.or) : null, !['zemljiste', 'garaza'].includes(l.pt)],
      ['Stanje', l.co ? (C[l.co] || l.co) : null, !['zemljiste'].includes(l.pt)],
      ['Energetski razred', l.en || null, !['zemljiste', 'garaza'].includes(l.pt)],
      ['Kupatila', l.ba ? String(l.ba) : null, false],
      ['Parking', ['stan', 'kuca', 'vikendica', 'poslovni-prostor'].includes(l.pt) ? (yes('hasGarage') ? 'Garaža' : yes('hasParking') ? 'Parking mesto' : 'Ne') : null, false],
      ['Lift', flat ? (yes('hasElevator') ? 'Da' : 'Ne') : null, false],
      ['Opremljenost', l.fu ? (F[l.fu] || l.fu) : null, !['zemljiste', 'garaza'].includes(l.pt)],
      ['Pravni status', tr ? tr.legalLabel : l.reg ? 'Uknjiženo' : 'Nije uknjiženo', true],
      ['Depozit', l.t === 'izdavanje' ? (l.dep ? eur(l.dep) : NA) : null, false],
      ['Cena', l.neg ? 'Moguć dogovor' : 'Fiksna', true],
    ].filter(([, v, must]) => (v != null && v !== '') || must).map(([k, v]) => [k, v == null || v === '' ? NA : v]);
    const grid = el('dl', { class: 'keyfacts lst-facts' }, rows.map(([k, v]) => el('div', { class: ['kf', v === NA && 'na'] }, el('dt', {}, k), el('dd', {}, v === NA ? el('span', { title: 'Pitajte oglašivača' }, v) : v))));
    return section('lst-podaci', 'Osnovne informacije', null, grid, 'lst-podaci');
  }

  /* ───────────────── O stanu: opis ───────────────── */
  function aboutSection(l, T) {
    const paras = String(l.d || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean);
    const lede = paras.length ? el('p', { class: 't-desc-lede' }, paras[0]) : null;
    const rest = paras.slice(1);
    const SHOW = 1;
    const visible = rest.slice(0, SHOW).map((p) => el('p', {}, p));
    const hiddenP = rest.slice(SHOW).map((p) => el('p', {}, p));
    const more = el('div', { class: 'lst-more-text', id: 'lst-opis-vise', hidden: true }, hiddenP);
    const btn = hiddenP.length ? el('button', { class: 'btn btn-link lst-readmore', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'lst-opis-vise', onclick: () => { const open = more.hidden; more.hidden = !open; btn.setAttribute('aria-expanded', open ? 'true' : 'false'); btn.textContent = open ? 'Prikaži manje' : 'Pročitaj ceo opis'; } }, 'Pročitaj ceo opis') : null;
    const body = el('div', { class: 'lst-about' }, el('div', { class: 'prose lst-desc' }, lede, visible, more, btn));
    return section('lst-opis', PT_ABOUT[l.pt] || 'O nekretnini', null, body);
  }

  /* ───────────────── Komšiluk + lokacija ───────────────── */
  function hoodSection(l, life) {
    const h = S(() => hood(l), null);
    const walk = S(() => walkLine(l), null);
    const host = el('div', { class: 'lst-maptile' });
    const tile = mapTile(l, host, { zoom: 15 });
    const loc = el('div', { class: 'lst-loc', id: 'lst-lokacija' }, el('p', { class: 'eyebrow' }, 'Lokacija'), host, mapCaption(l));
    life.onMount(() => {
      const tryB = () => tile.build();
      if (typeof IntersectionObserver !== 'undefined') {
        const io = new IntersectionObserver((ents) => { if (ents.some((e) => e.isIntersecting) && tryB()) io.disconnect(); }, { rootMargin: '400px 0px' });
        io.observe(host); life.onUnmount(() => io.disconnect());
      } else tryB();
      const tm = setTimeout(tryB, 1800); life.onUnmount(() => clearTimeout(tm));
    });
    life.onUnmount(() => tile.destroy());
    if (h) {
      const h2 = h.querySelector('h2'); if (h2) h2.remove();
      /* bez adrese u oglasu stanica ne sme da nosi izmišljenu ulicu — zamenjujemo je naseljem */
      if (!l.ad) {
        const st = S(() => mock.street(l).replace(/\s+\d+[a-zA-Z]?(\/\d+)?\s*$/, ''), '');
        if (st) h.querySelectorAll('li .l span').forEach((sp) => { if (sp.textContent.endsWith(' · ' + st)) sp.textContent = sp.textContent.slice(0, -st.length) + (l.n || l.m || l.c); });
      }
    }
    const body = el('div', { class: 'lst-hood' }, el('div', { class: 'lst-hood-l' }, walk, h), loc);
    return section('lst-komsiluk', 'Komšiluk', null, body);
  }

  /* ───────────────── Cena po m² — opština, struktura ───────────────── */
  function barsSection(l) {
    /* plac: blok cene i Merilo računaju po aru, pa €/m² stubići ovde ne bi bili uporedivi — sekcija se ne prikazuje */
    if (!l.ppm || l.pt === 'garaza' || l.pt === 'zemljiste') return null;
    /* poređenje bez ovog oglasa i bez sintetičkih kopija; svaki red traži n ≥ 5 (isti prag kao Merilo i Δ) */
    const MIN_N = 5;
    const all = S(() => D.listings, []).filter((x) => x.t === l.t && x.pt === l.pt && x.ppm > 0 && x.s !== l.s && !x.syn);
    const med = (arr) => S(() => stats.median(arr), null) || (() => { const s = arr.slice().sort((a, b) => a - b); const m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : null; })();
    const word = l.ro != null && l.pt === 'stan' ? (S(() => KX.roomWord(l.ro), null) || S(() => fmt.rooms(l.ro).toLowerCase(), '')) : null;
    const wordPl = word ? (word === 'garsonjera' ? 'garsonjere' : word.replace(/an$/, 'ni')) : (S(() => typeOf(l.pt).l.toLowerCase(), 'oglasi'));
    const rows = [{ label: 'Ovaj oglas', value: l.ppm, me: true }];
    /* oblast Merila (blok cene) se ne ponavlja ovde sa drugim brojem: ta medijana je već prikazana uz Δ iznad */
    const mer = S(() => stats.refPpm(l), null);
    const merKind = mer && mer.ppm > 0 ? ({ nbhd: 'nbhd', mun: 'mun', city: 'city' })[mer.scope] || null : null;
    const add = (label, list, place, kind) => {
      if (rows.some((r) => r.label === label) || (kind === merKind && label === mer.label)) return;
      const v = list.length >= MIN_N ? med(list.map((x) => x.ppm)) : null;
      if (v) rows.push({ label, value: v, n: list.length, place, kind });
    };
    if (l.ns && l.n && l.n !== l.m) add(l.n, all.filter((x) => x.ns === l.ns && x.cs === l.cs), l.n, 'nbhd');
    if (word && l.ms) add(`${l.m} · ${wordPl}`, all.filter((x) => x.ms === l.ms && x.ro === l.ro), l.m, 'word');
    if (l.ms) add(l.m, all.filter((x) => x.ms === l.ms), l.m, 'mun');
    const city = all.filter((x) => x.cs === l.cs);
    const cityMed = city.length >= MIN_N ? med(city.map((x) => x.ppm)) : null;
    if (rows.length < 2 && cityMed && l.c) add(l.c, city, l.c, 'city');
    if (rows.length < 2) return null;
    const b = S(() => bars(rows, { ref: cityMed && merKind !== 'city' && !rows.some((r) => r.kind === 'city') ? { value: cityMed, label: `${l.c}` } : null, format: (v) => S(() => fmt.ppm(v), nf0.format(v)) }), null);
    /* naslov samo od redova koji su zaista nacrtani */
    const shown = rows.filter((r) => !r.me);
    const places = uniq(shown.map((r) => r.place));
    const head = places.slice(0, 2).join(', ') + (shown.some((r) => r.kind === 'word') ? ', ' + wordPl : '');
    return section('lst-m2', `Cena po m² — ${head}`, `Medijane traženih cena za ${l.t === 'izdavanje' ? 'izdavanje' : 'prodaju'}, n = broj oglasa (bez ovog).`,
      el('div', { class: 'lst-bars' }, b, el('p', { class: 'meta' }, 'Izvor: oglasi na Kvadrat.rs, trenutno aktivni.')));
  }

  function amenitiesSection(l) {
    if (!l.am || !l.am.length) return null;
    return section('lst-dodatno', 'Dodatno', null, S(() => amenityTags(l), null));
  }

  /* ───────────────── Dokumenti ───────────────── */
  function docsSection(l, tr) {
    const legal = tr ? tr.legal : l.reg ? 'uknjizeno' : 'nije';
    const legalLabel = tr ? tr.legalLabel : l.reg ? 'Uknjiženo' : 'Nije uknjiženo';
    const flags = (tr && tr.flags) || [];
    const rows = [
      [ico('doc', 16), 'Pravni status', el('span', { class: 'lst-legal is-' + legal }, el('i'), legalLabel)],
      flags.includes('hipoteka') ? [ico('alert', 16), 'Teret', 'Upisana hipoteka — briše se isplatom na dan overe'] : null,
      flags.includes('suvlasnistvo') ? [ico('alert', 16), 'Suvlasništvo', 'Svi suvlasnici potpisuju ugovor'] : null,
      ['stan', 'kuca', 'vikendica', 'poslovni-prostor'].includes(l.pt) ? [ico('bolt', 16), 'Energetski pasoš', l.en ? `Energetski razred ${l.en}` : 'Nije naveden — pitajte oglašivača'] : null,
      l.co === 'u-izgradnji' || l.co === 'novogradnja' || flags.includes('bez-upotrebne-dozvole') ? [ico('key', 16), 'Upotrebna dozvola', l.co === 'u-izgradnji' || flags.includes('bez-upotrebne-dozvole') ? 'Još nije izdata — tražite rok u ugovoru' : 'Tražite kopiju uz ugovor'] : null,
      [ico('building', 16), 'List nepokretnosti', 'Proverite sami, besplatno, u eKatastru (broj parcele ili adresa)'],
    ].filter(Boolean);
    const url = (tr && tr.ekatastarUrl) || 'https://katastar.rgz.gov.rs/eKatastarPublic/';
    /* rečenica o finansiranju iz iste kapije kao blok cene i „Keš ili kredit” (KX.afford) */
    const fin = hasKX() ? S(() => KX.afford(l).gate.financeable, null) : null;
    const finTxt = fin === 'ne' ? 'banke ga ne finansiraju — računaj na keš.' : fin === 'da' ? 'banka može da finansira kupovinu.' : 'finansiranje zavisi od banke.';
    return section('lst-dokumenti', 'Dokumenti', null, el('div', { class: 'lst-docs' },
      el('ul', {}, rows.map(([i, k, v]) => el('li', {}, el('span', { class: 'k' }, i, k), el('span', { class: 'v' }, v)))),
      el('a', { class: 'btn btn-secondary btn-sm', href: url, target: '_blank', rel: 'noopener noreferrer' }, ico('external'), 'Proveri u eKatastru'),
      tr && tr.legal !== 'uknjizeno' ? el('p', { class: 'note-rule' }, legal === 'poseban-zakon' ? (l.pt === 'zemljiste' ? 'Upisano po Zakonu o posebnim uslovima za evidentiranje (2025). Banke po pravilu ne finansiraju zemljište — računaj na keš.' : `Upisano po Zakonu o posebnim uslovima za evidentiranje (2025): upis ne garantuje bezbednost objekta; ${finTxt}`) : legal === 'ozakonjenje' ? 'U postupku ozakonjenja: tražite rešenje ili dokaz o podnetom zahtevu; banke ne finansiraju.' : legal === 'u-procesu' ? 'Uknjižba u toku: tražite dokaz o podnetom zahtevu i rok u ugovoru.' : 'Nije uknjiženo: banke ne daju kredit, a preprodaja je rizična.') : null));
  }

  /* ───────────────── Uslovi zakupa (izdavanje) ───────────────── */
  function leaseSection(l) {
    const c = hasKX() ? S(() => KX.cost(l), null) : null;
    const prov = c ? c.lines.find((x) => x.key === 'provizija') : null;
    const h = hash(l.s + '#lease');
    const minMonths = [6, 12, 12, 12][h % 4];
    const fromDays = 3 + (h >>> 4) % 25;
    const from = new Date(); from.setDate(from.getDate() + fromDays);
    const pets = (l.am || []).includes('petsAllowed');
    const noHome = l.pt === 'zemljiste' || l.pt === 'garaza';
    const F = S(() => FURN, {});
    const rows = [
      ['Kirija', `${eur(l.p)} mesečno`],
      ['Depozit', l.dep ? `${eur(l.dep)}${l.dep <= l.p * 1.05 ? ' (1 kirija)' : l.dep <= l.p * 2.05 ? ' (2 kirije)' : ''}` : '1 kirija'],
      ['Minimalni period', `${minMonths} meseci`],
      ['Useljivo od', S(() => DTF.format(from).replace(/\.$/, ''), '')],
      noHome ? null : ['Ljubimci', pets ? 'Dozvoljeni' : 'Po dogovoru sa vlasnikom'],
      noHome ? null : ['Opremljenost', l.fu ? (F[l.fu] || l.fu) : 'Nije navedeno'],
      c && !(c.bills > 0) ? (noHome ? null : ['Računi', 'Nisu uključeni']) : ['Računi', c ? `Nisu uključeni — ≈ ${eur(c.bills)}/mes` : 'Nisu uključeni'],
      ['Provizija', prov ? (prov.amount ? `${eur(prov.amount)} · ${PAYER[prov.payer] || prov.payer}` : prov.label) : (l.ags ? 'Pitajte agenciju' : 'Bez provizije (vlasnik)')],
    ].filter(Boolean);
    const monthly = c ? c.lines.filter((x) => x.when === 'mesecno') : [];
    return section('lst-zakup', 'Uslovi zakupa', 'Sve što treba da znaš pre potpisivanja ugovora.', el('div', { class: 'lst-lease' },
      el('dl', { class: 'keyfacts lst-facts' }, rows.map(([k, v]) => el('div', { class: 'kf' }, el('dt', {}, k), el('dd', {}, v)))),
      monthly.length ? el('div', { class: 'lst-lease-m' }, el('p', { class: 'eyebrow' }, 'Mesečni troškovi (procena)'),
        el('ul', { class: 'lst-lines compact' }, monthly.map((x) => el('li', { class: 'lst-line' }, el('div', { class: 'l' }, el('span', { class: 'lb' }, x.label)), el('span', { class: 'amt num' }, (x.estimate ? '≈ ' : '') + eur(x.amount))))),
        el('div', { class: 'lst-total' }, el('span', {}, 'Ukupno mesečno'), el('b', { class: 'num' }, `${eur(c.monthly)}/mes`))) : null,
      el('p', { class: 'note-rule' }, 'Nikada ne plaćajte depozit pre obilaska i potpisanog ugovora. Minimalni period i datum useljenja su demo podaci — potvrdite ih sa oglašivačem.')));
  }

  /* ───────────────── Moja beleška ───────────────── */
  function noteSection(l) {
    const status = el('p', { class: 'meta lst-note-st', 'aria-live': 'polite' });
    const ta = el('textarea', { class: 'input lst-note', rows: '4', id: 'lst-note-ta', placeholder: 'Npr. dobar raspored, proveriti buku sa ulice, pitati za parking…' });
    ta.value = S(() => store.getNote(l.s), '') || '';
    let tmr = 0;
    const save = () => {
      clearTimeout(tmr);
      S(() => store.setNote(l.s, ta.value.trim() ? ta.value : ''));
      const t = new Date();
      status.textContent = ta.value.trim() ? `Sačuvano u ${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}` : 'Beleška je prazna';
    };
    ta.addEventListener('input', () => { clearTimeout(tmr); status.textContent = 'Čuvam…'; tmr = setTimeout(save, 500); });
    ta.addEventListener('blur', () => { if (tmr) save(); });
    if (ta.value) status.textContent = 'Beleška je sačuvana u ovom pregledaču.';
    return section('lst-beleska', 'Moja beleška', 'Vidiš je samo ti — čuva se automatski, u ovom pregledaču.', el('div', { class: 'lst-notebox' }, el('label', { class: 'sr', for: 'lst-note-ta' }, 'Moja beleška'), ta, status));
  }

  /* ───────────────── Slični + ostali oglasi oglašivača ───────────────── */
  function cardsRail(list) {
    return el('div', { class: 'cards lst-cards' }, list.map((x) => S(() => card(x, 'grid'), null)));
  }
  function similarSection(l) {
    const list = S(() => stats.similar(l, 4), []) || [];
    if (!list.length) return null;
    return section('lst-slicni', 'Slični oglasi', `Isti tip i struktura, slična cena i kvadratura${l.c ? ' — ' + l.c : ''}.`, cardsRail(list), 'lst-wide');
  }
  function agencySection(l, ag) {
    if (!l.ags) return null;
    const list = S(() => D.listings, []).filter((x) => x.ags === l.ags && x.s !== l.s).sort((a, b) => (a.t === l.t ? 0 : 1) - (b.t === l.t ? 0 : 1) || a.dz - b.dz).slice(0, 4);
    if (!list.length) return null;
    const node = section('lst-agencija', `Ostali oglasi oglašivača`, `${ag ? ag.n : l.ag}${ag && ag.lc ? ` · ${nf0.format(ag.lc)} ${plural(ag.lc, 'oglas', 'oglasa', 'oglasa')}` : ''}`, cardsRail(list), 'lst-wide');
    node.querySelector('.lst-sh').appendChild(el('a', { class: 'btn btn-link', href: ROUTE.agency(l.ags) }, 'Svi oglasi agencije'));
    return node;
  }

  /* ───────────────── kontakt kartica (§5.25) ───────────────── */
  function contactCard(l, a, tr, life, refreshers) {
    const phoneNum = a && a.ph ? a.ph : mockPhone(l);
    /* isti agent kao na kartici „Tim” profila agencije (agencies.js), kad je modul učitan */
    const tm = a ? S(() => (typeof window.agencyAgentFor === 'function' ? window.agencyAgentFor(l) : null), null) : null;
    const agent = (tm && tm.n) || AGENT_NAMES[hash(l.s + '#ag') % AGENT_NAMES.length];
    const hrs = 1 + (hash(l.s + '#h') % 4);
    const api = { onReport: null };
    const risky = !!(tr && tr.color === 'crveno' && l.t === 'izdavanje');
    const gate = (fn) => {
      if (!risky || ssGet('kv.risk.' + l.s)) { fn(); return; }
      const reasons = trustReasons(l, tr).slice(0, 3);
      const body = el('div', { class: 'lst-risk' },
        el('p', { class: 'lst-risk-h' }, ico('alert', 20), el('b', {}, 'Ovaj oglas ima znake prevare')),
        el('ul', {}, reasons.map((r) => el('li', {}, r))),
        el('p', { class: 'eyebrow' }, 'Pravila bezbednog zakupa'),
        el('ul', { class: 'lst-rules' }, (tr.checks || []).slice(0, 4).map((c) => el('li', {}, c.label))));
      const m = modal('Pre nego što nastaviš', body, { footer: [
        el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, 'Odustani'),
        el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { ssSet('kv.risk.' + l.s, '1'); m.close(); setTimeout(fn, 60); } }, 'Razumem, nastavi') ] });
      S(() => m.el.classList.add('lst-riskdlg'));
    };
    /* telefon */
    const phoneWrap = el('div', { class: 'lst-phone' });
    let revealed = false;
    const paintPhone = () => {
      phoneWrap.innerHTML = '';
      if (!revealed) {
        phoneWrap.appendChild(el('button', { class: 'btn btn-primary btn-lg', type: 'button', 'aria-label': 'Prikaži broj telefona', onclick: () => gate(() => { revealed = true; paintPhone(); const n = phoneWrap.querySelector('.lst-num'); if (n) n.focus(); }) },
          ico('phone'), el('span', { class: 'mask' }, maskPhone(phoneNum)), el('span', { class: 'rev' }, 'prikaži broj')));
      } else {
        phoneWrap.appendChild(el('div', { class: 'lst-phone-on' },
          el('span', { class: 'lst-num num', tabindex: '-1' }, ico('phone'), phoneNum),
          S(() => copyButton(phoneNum, { outline: true, label: 'Kopiraj broj telefona' }), null)));
        phoneWrap.appendChild(el('p', { class: 'meta' }, 'Pozovi sa telefona i pomeni Kvadrat.rs i šifru ', el('b', {}, l.r), '.'));
      }
    };
    paintPhone();
    api.reveal = () => gate(() => { revealed = true; paintPhone(); });
    /* poruka (inline forma) */
    const msgBox = el('div', { class: 'lst-msgbox', hidden: true, id: 'lst-poruka' });
    const msgBtn = el('button', { class: 'btn btn-secondary', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'lst-poruka' }, ico('mail'), 'Pošalji poruku');
    const defaultMsg = `Poštovani, zanima me oglas ${l.r} (${l.n || l.m || l.c}). Da li je još aktuelan i kada je moguć obilazak?`;
    const buildForm = (text) => {
      msgBox.innerHTML = '';
      const name = el('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Ime i prezime' });
      const tel = el('input', { class: 'input', type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '06x xxx xxxx' });
      const ta = el('textarea', { class: 'input', rows: '5' }); ta.value = text || defaultMsg;
      const err = el('p', { class: 'help err', role: 'alert', hidden: true });
      const form = el('form', { class: 'lst-msgform', novalidate: true },
        field('Ime', name), field('Telefon ili e-pošta', tel), field('Poruka', ta), err,
        el('button', { class: 'btn btn-primary', type: 'submit' }, 'Pošalji poruku'),
        el('p', { class: 'meta' }, 'Šaljemo samo ime, kontakt i poruku. Broj ne delimo sa trećim licima.'));
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        const bad = !name.value.trim() ? 'Upiši ime.' : !tel.value.trim() ? 'Upiši telefon ili e-poštu da bi oglašivač mogao da odgovori.' : !ta.value.trim() ? 'Poruka je prazna.' : null;
        [name, tel, ta].forEach((x) => x.removeAttribute('aria-invalid'));
        if (bad) { err.textContent = bad; err.hidden = false; const tgt = !name.value.trim() ? name : !tel.value.trim() ? tel : ta; tgt.setAttribute('aria-invalid', 'true'); tgt.focus(); return; }
        const all = lsGet('kv.messages', []); all.push({ s: l.s, r: l.r, to: a ? a.n : 'Vlasnik', text: ta.value.slice(0, 2000), at: new Date().toISOString() }); lsSet('kv.messages', all.slice(-50));
        msgBox.innerHTML = '';
        const done = el('div', { class: 'lst-done', role: 'status', tabindex: '-1' }, ico('check-circle'), el('div', {}, el('b', {}, 'Poruka je poslata'), el('p', {}, `${a ? a.n : 'Vlasnik'} obično odgovara za ${hrs} ${hrs === 1 ? 'sat' : 'sata'}. Odgovor stiže na kontakt koji si ostavio/la: ${tel.value.trim()}.`),
          el('button', { class: 'lst-lnk', type: 'button', onclick: () => buildForm('') }, 'Pošalji još jednu')));
        msgBox.appendChild(done); done.focus();
      });
      msgBox.appendChild(form);
      return ta;
    };
    const openMessage = (text) => gate(() => {
      const ta = buildForm(text);
      msgBox.hidden = false; msgBtn.setAttribute('aria-expanded', 'true');
      msgBox.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
      setTimeout(() => S(() => (text ? ta : msgBox.querySelector('input')).focus({ preventScroll: true })), 200);
    });
    msgBtn.addEventListener('click', () => { if (!msgBox.hidden) { msgBox.hidden = true; msgBtn.setAttribute('aria-expanded', 'false'); } else openMessage(''); });
    api.openMessage = (text) => { openMessage(text); };
    api.scrollTo = () => scrollToId('lst-kontakt');
    /* obilazak */
    const visitBtn = el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => gate(() => openVisit(l, a, hrs)) }, ico('calendar'), 'Zakaži obilazak');
    /* provizija (zakonsko isticanje) */
    /* ko plaća proviziju menja se iz panela troškova i profila — red agenta se precrtava (refreshers) */
    const provTxt = () => {
      const cst = hasKX() ? S(() => KX.cost(l), null) : null;
      const prov = cst ? cst.lines.find((x) => x.key === 'provizija') : null;
      return !l.ags ? 'Bez provizije — oglas vlasnika' : prov ? (prov.amount ? `Provizija: ${prov.label.replace(/^Provizija agencije\s*/i, '').replace(/ — plaća.*$/, '') || '2 % + PDV'} · ${(PAYER[prov.payer] || '').toLowerCase() || 'po ugovoru'}` : prov.label) : 'Provizija po ugovoru sa agencijom';
    };
    const agentLine = el('span', {});
    const paintAgent = () => { const t = provTxt(); agentLine.innerHTML = ''; put(agentLine, 'Agent: ', el('b', {}, agent), ` · ${t.charAt(0).toLowerCase() + t.slice(1)}`); };
    if (a) { paintAgent(); if (refreshers) refreshers.push(paintAgent); }
    const node = el('aside', { class: 'contact lst-contact', 'aria-label': 'Kontakt sa oglašivačem' },
      el('div', { class: 'who' },
        a ? el('span', { class: 'ava', 'aria-hidden': 'true' }, S(() => el('img', { src: img.mark(a), alt: '', width: 52, height: 52 }), initials(a.n))) : el('span', { class: 'ava', 'aria-hidden': 'true' }, 'V'),
        el('div', { style: 'min-width:0' },
          el('b', {}, el('span', {}, a ? a.n : 'Vlasnik'), a && a.v ? ico('check') : null),
          el('small', {}, a ? `${a.v ? 'Verifikovana agencija' : 'Agencija'} · od ${a.y}.` : 'Privatni oglašivač · bez provizije'))),
      el('div', { class: 'rating' },
        a && a.r ? el('span', {}, el('b', {}, nf1.format(a.r)), ` ocena (${a.rc || 0})`) : el('span', {}, el('b', {}, nf0.format(l.v || 0)), ` ${plural(l.v || 0, 'pregled', 'pregleda', 'pregleda')}`),
        a ? el('span', {}, el('b', {}, nf0.format(a.lc || 0)), ` ${plural(a.lc || 0, 'oglas', 'oglasa', 'oglasa')}`) : el('span', {}, 'odgovara za ', el('b', {}, `~${hrs} h`)),
        a ? el('span', {}, 'odgovara za ', el('b', {}, `~${hrs} h`)) : null),
      risky ? el('p', { class: 'lst-riskline' }, ico('alert', 16), 'Visok rizik prevare — pročitaj semafor ispod pre kontakta.') : tr && tr.color === 'zuto' && l.t === 'izdavanje' ? el('p', { class: 'lst-warnline' }, ico('alert', 16), 'Proveri pre depozita — vidi semafor ispod.') : null,
      phoneWrap, msgBtn, msgBox, visitBtn,
      a ? el('p', { class: 'agent' }, el('i', { 'aria-hidden': 'true' }, initials(agent)), agentLine)
        : el('p', { class: 'agent' }, el('i', { 'aria-hidden': 'true' }, 'V'), el('span', {}, el('b', {}, 'Oglas vlasnika'), ' · bez provizije za kupca')),
      el('p', { class: 'note' }, l.t === 'izdavanje' ? 'Nikada ne uplaćujte depozit pre obilaska i potpisanog ugovora.' : 'Kaparu (uobičajeno do 10 %) dajte tek posle provere lista nepokretnosti i uz ugovor kod javnog beležnika.'),
      el('div', { class: 'lst-cfoot' },
        a ? el('a', { href: ROUTE.agency(a.s) }, `Svi oglasi agencije ${a.n}`, ico('arrow-right', 14)) : null,
        el('button', { class: 'report', type: 'button', onclick: () => { if (api.onReport) api.onReport(); } }, 'Prijavi oglas')));
    api.node = node;
    return api;
  }

  /* Zakaži obilazak: dan → termin → potvrda (deterministička dostupnost) */
  function openVisit(l, a, hrs) {
    const today = new Date(); today.setHours(12, 0, 0, 0);
    const dayList = [];
    for (let d = 1; d <= 8; d++) {
      const dt = new Date(today); dt.setDate(today.getDate() + d);
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
      const off = dt.getDay() === 0 || hash(l.s + '#v' + iso) % 5 === 0;
      dayList.push({ iso, dt, off });
    }
    const SLOTS = ['09:30', '11:00', '12:30', '15:00', '16:30', '18:00', '19:30'];
    const slotsFor = (iso) => SLOTS.map((t) => ({ t, taken: hash(l.s + iso + t) % 3 === 0 }));
    const st = { step: 0, day: (dayList.find((x) => !x.off) || dayList[0]).iso, slot: null, mode: 'uzivo', done: false };
    const body = el('div', { class: 'lst-visit' });
    const STEPS = ['Dan', 'Termin', 'Potvrda'];
    const dayLabel = (x) => `${S(() => WDF.format(x.dt).replace('.', ''), '')} ${x.dt.getDate()}.${x.dt.getMonth() + 1}.`;
    const name = el('input', { class: 'input', type: 'text', autocomplete: 'name', placeholder: 'Ime i prezime' });
    const tel = el('input', { class: 'input', type: 'tel', autocomplete: 'tel', inputmode: 'tel', placeholder: '06x xxx xxxx' });
    const render = () => {
      body.innerHTML = '';
      if (st.done) {
        const d = dayList.find((x) => x.iso === st.day);
        put(body, el('div', { class: 'lst-done', role: 'status', tabindex: '-1' }, ico('check-circle'), el('div', {},
          el('b', {}, 'Zahtev za obilazak je poslat'),
          el('p', {}, `${cap(S(() => WLF.format(d.dt), st.day))} u ${st.slot} · ${st.mode === 'video' ? 'video poziv' : 'uživo'}.`),
          el('p', {}, `${a ? a.n : 'Vlasnik'} potvrđuje termin porukom na ${tel.value.trim()}, obično za ${hrs} ${hrs === 1 ? 'sat' : 'sata'}.`))),
        el('div', { class: 'btn-row lst-vnav' }, el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => m.close() }, 'Zatvori')));
        S(() => body.querySelector('.lst-done').focus());
        return;
      }
      body.appendChild(S(() => stepper(STEPS, st.step), el('p', {}, `Korak ${st.step + 1} od 3`)));
      const err = el('p', { class: 'help err', role: 'alert', hidden: true });
      if (st.step === 0) {
        put(body, el('p', { class: 'lst-sub' }, 'Izaberi dan. Precrtani dani su zauzeti kod oglašivača.'),
          el('div', { class: 'lst-days', role: 'group', 'aria-label': 'Dan obilaska' }, dayList.map((x) => el('button', { type: 'button', class: 'chip' + (x.iso === st.day ? ' on' : ''), 'aria-pressed': x.iso === st.day ? 'true' : 'false', disabled: x.off, 'aria-label': `${S(() => WLF.format(x.dt), x.iso)}${x.off ? ' — zauzeto' : ''}`, onclick: () => { st.day = x.iso; st.slot = null; render(); } }, dayLabel(x)))));
      } else if (st.step === 1) {
        const sl = slotsFor(st.day);
        put(body, el('p', { class: 'lst-sub' }, `Slobodni termini — ${S(() => WLF.format(dayList.find((x) => x.iso === st.day).dt), st.day)}:`),
          el('div', { class: 'lst-days', role: 'group', 'aria-label': 'Termin' }, sl.map((x) => el('button', { type: 'button', class: 'chip' + (x.t === st.slot ? ' on' : ''), 'aria-pressed': x.t === st.slot ? 'true' : 'false', disabled: x.taken, 'aria-label': `${x.t}${x.taken ? ' — zauzeto' : ''}`, onclick: () => { st.slot = x.t; render(); } }, x.t))), err);
      } else {
        const d = dayList.find((x) => x.iso === st.day);
        put(body, el('p', { class: 'lst-vsum' }, el('b', {}, cap(S(() => WLF.format(d.dt), st.day))), ` u ${st.slot}`),
          el('div', { class: 'lst-vmode' }, S(() => segmented([{ v: 'uzivo', l: 'Uživo' }, { v: 'video', l: 'Video poziv' }], st.mode, (v) => { st.mode = v; }), null)),
          el('div', { class: 'stack' }, field('Ime', name), field('Telefon', tel)), err);
      }
      const back = st.step > 0 ? el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { st.step--; render(); } }, 'Nazad') : el('button', { class: 'btn btn-ghost', type: 'button', onclick: () => m.close() }, 'Odustani');
      const nextLbl = st.step < 2 ? 'Dalje' : 'Pošalji zahtev';
      const next = el('button', { class: 'btn ' + (st.step < 2 ? 'btn-secondary' : 'btn-primary'), type: 'button', onclick: () => {
        if (st.step === 1 && !st.slot) { err.textContent = 'Izaberi termin.'; err.hidden = false; return; }
        if (st.step === 2) {
          if (!name.value.trim() || !tel.value.trim()) { err.textContent = 'Upiši ime i telefon da bi oglašivač potvrdio termin.'; err.hidden = false; (name.value.trim() ? tel : name).focus(); return; }
          const all = lsGet('kv.viewings', []); all.push({ s: l.s, day: st.day, slot: st.slot, mode: st.mode, at: new Date().toISOString() }); lsSet('kv.viewings', all.slice(-30));
          st.done = true; render(); return;
        }
        st.step++; render();
        const f = body.querySelector('.chip:not([disabled]), input'); if (f) f.focus();
      } }, nextLbl);
      body.appendChild(el('div', { class: 'btn-row lst-vnav' }, back, next));
    };
    const m = modal('Zakaži obilazak', body, {});
    S(() => m.el.classList.add('lst-visitdlg'));
    render();
  }

  /* ───────────────── Semafor poverenja ───────────────── */
  function trustBlock(l, tr, contact) {
    const rentFace = tr.face === 'prevara';
    const COL = { zeleno: 'Zeleno', zuto: 'Žuto', crveno: 'Crveno' };
    const dots = el('span', { class: 'lst-dots', role: 'img', 'aria-label': `Semafor: ${COL[tr.color] || tr.color}` }, ['zeleno', 'zuto', 'crveno'].map((c) => el('i', { class: 'd-' + c + (c === tr.color ? ' on' : '') })));
    const checks = tr.checks || [];
    const doneSet = new Set(checks.map((c, i) => (c.done ? i : -1)).filter((i) => i >= 0));
    const prog = el('span', { class: 'meta num' });
    const paintProg = () => { prog.textContent = `Provereno ${doneSet.size} od ${checks.length}`; };
    paintProg();
    const list = el('ul', { class: 'lst-checks' }, checks.map((c, i) => el('li', {}, S(() => check(c.label, c.done, (on) => {
      if (on) doneSet.add(i); else doneSet.delete(i);
      S(() => KX.trustCheck(l.s, i, on));
      paintProg();
    }), el('span', {}, c.label)))));
    const ask = el('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: () => {
      const open = checks.filter((_, i) => !doneSet.has(i)).map((c) => '— ' + c.label);
      const txt = `Poštovani, u vezi sa oglasom ${l.r}: pre ${rentFace ? 'uplate depozita' : 'kapare'} molim vas da mi pošaljete ili pokažete:\n${open.join('\n')}\nHvala unapred.`;
      contact.openMessage(txt);
    } }, ico('doc'), 'Zatraži od oglašivača');
    const risk = tr.rental ? el('p', { class: 'lst-tr-risk' }, 'Rizik prevare: ', el('b', {}, tr.rental.risk), el('span', { class: 'meta num' }, ` · ${tr.rental.score}/100`)) : null;
    return el('section', { class: 'lst-trust is-' + tr.color, 'aria-labelledby': 'lst-trust-h' },
      el('div', { class: 'hd' }, dots, el('div', {}, el('p', { class: 'eyebrow' }, 'Semafor poverenja'), el('h2', { id: 'lst-trust-h' }, tr.title))),
      risk,
      !rentFace ? el('p', { class: 'lst-tr-legal' }, 'Pravni status: ', el('b', {}, tr.legalLabel)) : null,
      el('ul', { class: 'lst-reasons' }, trustReasons(l, tr).map((r) => el('li', {}, r))),
      el('div', { class: 'lst-tr-cl' }, el('p', { class: 'eyebrow' }, rentFace ? 'Pre depozita proveri' : 'Pre kapare proveri', ' ', prog), list),
      el('div', { class: 'btn-row' }, ask, el('a', { class: 'btn btn-ghost btn-sm', href: tr.ekatastarUrl || 'https://katastar.rgz.gov.rs/eKatastarPublic/', target: '_blank', rel: 'noopener noreferrer' }, ico('external'), 'eKatastar')),
      el('p', { class: 'meta' }, rentFace ? 'Rizik se računa iz cene u odnosu na kraj, fotografija, oglašivača i rečenica iz opisa. ' : 'Pravni status i tereti su demo prikaz dok oglašivač ne priloži list nepokretnosti. ', el('a', { href: ROUTE.ledger }, 'Kako računamo')));
  }

  /* ───────────────── lepljiva CTA traka (telefon) ───────────────── */
  function ctaBarX(l, contact, life) {
    const fav = el('button', { class: 'iconbtn iconbtn-outline lst-ctafav', type: 'button' }, ico('heart'));
    const paint = () => { const on = S(() => store.isFav(l.s), false); fav.setAttribute('aria-pressed', on ? 'true' : 'false'); fav.setAttribute('aria-label', on ? 'Ukloni iz sačuvanih' : 'Sačuvaj oglas'); };
    fav.addEventListener('click', () => { const on = S(() => store.toggleFav(l.s), false); paint(); say(on ? 'Sačuvano' : 'Uklonjeno iz sačuvanih'); });
    paint();
    life.onMount(() => { const off = S(() => store.on((w) => { if (w === 'favs') paint(); }), null); if (off) life.onUnmount(off); });
    return el('div', { class: 'cta-bar lst-cta', role: 'region', 'aria-label': 'Brzi kontakt' },
      el('button', { class: 'btn btn-primary', type: 'button', onclick: () => { contact.reveal(); contact.scrollTo(); } }, ico('phone'), 'Pozovi'),
      el('button', { class: 'btn btn-secondary', type: 'button', onclick: () => { contact.scrollTo(); contact.openMessage(''); } }, ico('mail'), 'Poruka'),
      fav);
  }

  window.viewListing = viewListing;
  viewListing._planModel = planModel; /* za testove (dev/listing) — nije globalno */
})();

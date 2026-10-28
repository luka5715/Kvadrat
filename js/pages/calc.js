/* Kvadrat.rs — stranica: kreditni kalkulator (viewCalc). */
'use strict';

/* ─────────── kalkulator ─────────── */
function viewCalc() {
  const S = { price: 120000, downPct: 20, years: 20, rate: 5.45 };
  const out = el('div', { class: 'calc-out' });

  function calc() {
    const down = S.price * (S.downPct / 100);
    const loan = Math.max(0, S.price - down);
    const n = S.years * 12;
    const i = S.rate / 100 / 12;
    const pay = i === 0 ? loan / n : (loan * i) / (1 - Math.pow(1 + i, -n));
    const total = pay * n;
    const interest = total - loan;
    const fees = S.price * 0.025 + 300 + (loan > 0 ? loan * 0.03 : 0);

    const bars = [];
    let bal = loan;
    const yearly = [];
    for (let y = 0; y < S.years; y++) {
      let pr = 0, ir = 0;
      for (let m = 0; m < 12; m++) { const int = bal * i; const prin = pay - int; bal -= prin; pr += prin; ir += int; }
      yearly.push([pr, ir]);
    }
    const maxY = Math.max(...yearly.map(([a, b]) => a + b));
    const bw = 100 / S.years;
    yearly.forEach(([pr, ir], y) => {
      const hP = (pr / maxY) * 100, hI = (ir / maxY) * 100;
      bars.push(`<g><rect x="${(y * bw + bw * 0.14).toFixed(2)}" y="${(100 - hP - hI).toFixed(2)}" width="${(bw * 0.72).toFixed(2)}" height="${hI.toFixed(2)}" fill="var(--accent)"/><rect x="${(y * bw + bw * 0.14).toFixed(2)}" y="${(100 - hP).toFixed(2)}" width="${(bw * 0.72).toFixed(2)}" height="${hP.toFixed(2)}" fill="var(--brand)"/></g>`);
    });

    out.innerHTML = '';
    out.append(
      el('div', { class: 'calc-hero' },
        el('p', { class: 'calc-label' }, 'Mesečna rata (anuitet)'),
        el('p', { class: 'calc-big' }, eur(pay)),
        el('p', { class: 'calc-sub' }, `Kredit ${eur(loan)} · ${S.years} god · NKS ${S.rate.toFixed(2)}%`)),
      el('dl', { class: 'calc-rows' },
        ...[['Iznos kredita', eur(loan)], ['Učešće', `${eur(down)} (${S.downPct}%)`],
            ['Ukupno plaćeno banci', eur(total)], ['Ukupna kamata', eur(interest)],
            ['Preplata', ((interest / Math.max(1, loan)) * 100).toFixed(1) + '%'],
            ['Jednokratni troškovi', eur(fees)], ['Potrebno pre useljenja', eur(down + fees)],
            ['Preporučena zarada', eur(pay * 2)]]
          .flatMap(([k, v]) => [el('dt', {}, k), el('dd', {}, v)])),
      el('div', { class: 'calc-chart' },
        el('p', { class: 'calc-label' }, 'Otplata po godinama'),
        el('div', { class: 'chart', html: `<svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-label="Odnos glavnice i kamate po godinama">${bars.join('')}</svg>` }),
        el('p', { class: 'legend' },
          el('span', { class: 'lg lg-b' }, 'Glavnica'), el('span', { class: 'lg lg-a' }, 'Kamata'),
          el('span', { class: 'muted' }, `godina 1 – ${S.years}`))),
    );
  }

  const field = (label, key, min, max, step, fmt) => {
    const num = el('input', { class: 'inp', type: 'number', min, max, step, value: S[key], 'aria-label': label,
      oninput: (e) => { S[key] = Number(e.target.value) || 0; rangeEl.value = S[key]; calc(); } });
    const rangeEl = el('input', { type: 'range', min, max, step, value: S[key], 'aria-label': label + ' (klizač)',
      oninput: (e) => { S[key] = Number(e.target.value); num.value = S[key]; calc(); } });
    return el('div', { class: 'cfield' }, el('label', {}, label, num), rangeEl, fmt ? el('span', { class: 'hint' }, fmt) : null);
  };

  calc();
  return el('div', { class: 'wrap block' },
    el('div', { class: 'head' }, el('div', {},
      el('h1', {}, 'Kalkulator stambenog kredita'),
      el('p', {}, 'Izračunajte mesečnu ratu, ukupnu kamatu i jednokratne troškove kupovine — uključujući porez na prenos apsolutnih prava.'))),
    el('div', { class: 'calc' },
      el('div', { class: 'calc-in panel' },
        el('h2', {}, 'Parametri kredita'),
        field('Cena nekretnine (€)', 'price', 20000, 500000, 5000),
        field('Učešće (%)', 'downPct', 0, 60, 1),
        field('Rok otplate (godina)', 'years', 5, 30, 1),
        field('Nominalna kamatna stopa (%)', 'rate', 2, 9, 0.05, 'Prosek za stambene kredite u Srbiji je oko 5–6%.')),
      out),
  );
}

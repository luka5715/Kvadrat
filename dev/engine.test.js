/* Kvadrat.rs — testovi za js/engine.js (KX). Pokretanje: node dev/engine.test.js
   Učitava data.js + js/core.js (ako postoji; inače minimalni stub ugovora iz CONTEXT.md) + js/engine.js u vm kontekst bez DOM-a. */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { window: {}, console, performance: { now: () => Number(process.hrtime.bigint()) / 1e6 }, Intl, Date, Math, JSON, Map, Set, Array, Object, Number, String, RegExp, Error, isFinite, parseFloat, parseInt };
ctx.window.KV = undefined;
vm.createContext(ctx);
const load = (f) => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
load('data.js');
if (fs.existsSync(path.join(ROOT, 'js/core.js'))) load('js/core.js');
else {
  /* minimalni stub ugovora core.js — koristi se samo kada core.js ne postoji */
  vm.runInContext(`
    const D = window.KV;
    function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
    function rng(seed) { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
    const nf = new Intl.NumberFormat('sr-RS', { maximumFractionDigits: 0 });
    const AMEN = { hasElevator: 'Lift', hasTerrace: 'Terasa', hasParking: 'Parking', hasBalcony: 'Balkon', hasAc: 'Klima', petsAllowed: 'Dozvoljeni ljubimci', hasGarage: 'Garaža' };
    const HEAT = { centralno: 'Centralno grejanje', etazno: 'Etažno grejanje' };
    const FILTER_DEFAULTS = Object.freeze({ t: 'prodaja', pt: [], c: '', m: [], n: [], pmin: '', pmax: '', amin: '', amax: '', ro: [], flmin: '', flmax: '', notLast: false, ymin: '', ymax: '', co: [], he: [], fu: [], reg: false, newbuild: false, am: [], agency: '', advertiser: '', q: '', deltaMax: '', sort: 'rel', view: 'grid', page: 1 });
  `, ctx);
}
load('js/engine.js');
const KX = ctx.window.KX;
const D = ctx.window.KV;
const L = D.listings;

let pass = 0, fail = 0;
const ok = (cond, msg, extra) => { if (cond) { pass++; console.log('  ok  ' + msg); } else { fail++; console.log('  FAIL ' + msg + (extra !== undefined ? ' → ' + JSON.stringify(extra) : '')); } };
const near = (a, b, tol = 1) => Math.abs(a - b) <= tol;
const section = (t) => console.log('\n' + t);
const by = (fn) => L.find(fn);
const lineOf = (c, k) => c.lines.find((x) => x.key === k);

section('enrich');
const t0 = performance.now();
const idx = KX.enrich();
const ms = performance.now() - t0;
ok(ms < 80, `enrich < 80 ms (${ms.toFixed(1)} ms)`);
ok(KX.enrich() === idx, 'enrich je idempotentan');
console.log('  dupes groups:', KX.dupes.count(), 'hidden:', KX.dupes.hiddenCount());

section('titleOf');
const flat = by((l) => l.pt === 'stan' && l.t === 'prodaja' && l.ro === 2 && l.cs === 'beograd' && l.co !== 'novogradnja' && l.co !== 'u-izgradnji');
const t1 = KX.titleOf(flat);
console.log('  ', t1);
ok(/^Dvosoban stan, \d+ m², .+ · .+/.test(t1), 'prodaja: "Dvosoban stan, 60 m², Opština · Naselje"');
const rent = by((l) => l.t === 'izdavanje' && l.pt === 'stan' && l.ro === 1);
console.log('  ', KX.titleOf(rent));
ok(/€\/mes$/.test(KX.titleOf(rent)), 'zakup se završava sa €/mes');
const build = by((l) => l.co === 'u-izgradnji' && l.pt === 'stan');
console.log('  ', KX.titleOf(build));
ok(/u izgradnji, rok Q[1-4] 20\d\d/.test(KX.titleOf(build)), 'u izgradnji ima rok Qn YYYY');
const house = by((l) => l.pt === 'kuca' && l.ro === 3);
console.log('  ', KX.titleOf(house));
ok(/^Trosobna kuća/.test(KX.titleOf(house)), 'kuća u ženskom rodu');
ok(KX.titleOf(by((l) => l.pt === 'zemljiste')).startsWith('Plac'), 'plac u arima');

section('cost — prodaja, starogradnja 100.000 €, podrazumevani profil');
const base = { ...flat, p: 100000, a: 60, ppm: 100000 / 60, co: 'dobro-stanje', ags: 'sava-estate', ag: 'Sava Estate' };
const c1 = KX.cost(base, {});
ok(c1.kind === 'prodaja' && c1.taxMode === 'prenos', 'kind/taxMode');
ok(lineOf(c1, 'porez').amount === 2500, 'porez na prenos 2,5 % = 2.500 €', lineOf(c1, 'porez'));
ok(lineOf(c1, 'porez').payer === 'kupac' && /obveznik je prodavac/.test(lineOf(c1, 'porez').note), 'porez: platilac kupac po ugovoru, napomena o zakonskom obvezniku');
ok(lineOf(c1, 'provizija').amount === 2400 && lineOf(c1, 'provizija').net === 2000 && lineOf(c1, 'provizija').vat === 400, 'provizija 2 % (2.000 €) + PDV 20 % = 2.400 €');
ok(lineOf(c1, 'notar').amount === 260, 'notar razred ≤ 120.000 € = 260 €');
ok(lineOf(c1, 'upis').amount === 45, 'upis 45 €');
ok(c1.loan === 80000, 'kredit = LTV 80 % × cena = 80.000 €', c1.loan);
ok(lineOf(c1, 'obrada').amount === 400 && lineOf(c1, 'procena').amount === 120, 'obrada 0,5 % = 400 €, procena 120 €');
ok(lineOf(c1, 'nkosk').optional === true && lineOf(c1, 'nkosk').amount === 2000, 'NKOSK opcion, 2,5 % pri LTV 80 %');
const expectedPurchase = 100000 + 2500 + 2400 + 260 + 45 + 120 + 400 + 40;
ok(c1.onPurchase === expectedPurchase, `onPurchase = ${expectedPurchase} €`, c1.onPurchase);
ok(c1.total === c1.onPurchase + c1.moveIn && c1.moveIn > 0, 'total = onPurchase + moveIn');
ok(c1.cashOnDay === c1.onPurchase - c1.loan + c1.moveIn, 'cashOnDay = onPurchase − kredit + useljenje');
ok(near(lineOf(c1, 'rata').amount, KX.annuity(80000, 5, 25), 1), 'rata = anuitet (80.000 €, 5 %, 25 god)');
ok(c1.monthly > lineOf(c1, 'rata').amount && c1.lines.some((x) => x.key === 'porez-imovina' && /gruba procena/.test(x.label)), 'mesečno sadrži račune i porez na imovinu (gruba procena)');
ok(c1.monthlyWinter >= c1.monthly && c1.monthlySummer <= c1.monthly, 'zima ≥ prosek ≥ leto');
const cProd = KX.cost(base, { taxPayer: 'prodavac', agencyPayer: 'prodavac' });
ok(cProd.onPurchase === expectedPurchase - 2500 - 2400, 'platilac prodavac isključuje porez i proviziju iz zbira kupca');
const cKes = KX.cost(base, { financing: 'kes' });
ok(cKes.loan === 0 && !lineOf(cKes, 'rata') && cKes.onPurchase === 100000 + 2500 + 2400 + 260 + 45, 'keš: bez bankarskih linija');
const cOwner = KX.cost({ ...base, ags: null, ag: null }, {});
ok(lineOf(cOwner, 'provizija').amount === 0, 'oglas vlasnika: bez provizije');
ok(c1.assumptions.length >= 2 && c1.lines.every((x) => ['kupovina', 'useljenje', 'mesecno', 'kasnije'].includes(x.when)), 'pretpostavke i when vrednosti');

section('cost — novogradnja (PDV u ceni)');
const nb = { ...base, co: 'novogradnja', p: 110000, ppm: 110000 / 60 };
const c2 = KX.cost(nb, {});
ok(c2.taxMode === 'pdv' && c2.priceIncludesVat === true, 'taxMode pdv, cena uključuje PDV');
ok(lineOf(c2, 'pdv').amount === 0 && lineOf(c2, 'pdv').included && lineOf(c2, 'pdv').inPrice === 10000, 'PDV nije dodat (inPrice 10.000 €)');
ok(!lineOf(c2, 'porez'), 'nema poreza na prenos kod novogradnje');
ok(c2.netPrice === 100000, 'neto cena = 110.000 ÷ 1,10');
const c2b = KX.cost(nb, { vatIncluded: false });
ok(lineOf(c2b, 'pdv').amount === 11000 && c2b.onPurchase - c2.onPurchase === 11000, 'prekidač „cena bez PDV-a” dodaje 10 %');

section('cost — prvi stan (60 m², 2 člana domaćinstva)');
const c3 = KX.cost(base, { firstHome: true, household: 2 });
ok(c3.firstHome.exemptM2 === 55 && c3.firstHome.eligibleM2 === 55, 'oslobođeno 40 + 15 = 55 m²', c3.firstHome);
ok(near(lineOf(c3, 'prvi-stan').amount, -2500 * 55 / 60, 1) && c3.firstHome.when === 'kupovina', 'starogradnja: umanjenje poreza −2.292 € na dan kupovine');
ok(c3.onPurchase === c1.onPurchase - 2292 + (c3.loan - c1.loan === 0 ? 0 : 0) || near(c3.onPurchase, c1.onPurchase - 2292 + (lineOf(c3, 'obrada').amount - lineOf(c1, 'obrada').amount) + (lineOf(c3, 'nkosk').optional ? 0 : 0), 2), 'onPurchase umanjen za olakšicu');
ok(c3.loan === 90000, 'prvi stan: LTV 90 %');
const c4 = KX.cost(nb, { firstHome: true, household: 2 });
const refund = lineOf(c4, 'pdv-povracaj');
ok(refund && refund.when === 'kasnije' && near(refund.amount, -(100000 * 0.10 * 55 / 60), 1), 'novogradnja: povraćaj PDV-a na neto cenu kao „kasnije” priliv (−9.167 €)', refund);
ok(c4.onPurchase === KX.cost(nb, { household: 2, ltv: 0.9 }).onPurchase && c4.laterInflow === -refund.amount, 'povraćaj ne smanjuje novac na dan kupovine; laterInflow pozitivan');

section('cost — izdavanje');
const r450 = { ...rent, p: 450, dep: 450, ags: 'sava-estate', ag: 'Sava Estate' };
const cr = KX.cost(r450, {});
ok(cr.kind === 'izdavanje' && lineOf(cr, 'depozit').amount === 450 && lineOf(cr, 'depozit').refundable, 'depozit 450 € (povratan)');
ok(lineOf(cr, 'provizija').amount === 225 && lineOf(cr, 'provizija').payer === 'zakupac', 'provizija 50 % = 225 €, plaća zakupac');
ok(cr.moveIn === 450 + 450 + 225 + 30, 'za ključeve = kirija + depozit + provizija + overa');
ok(cr.monthly > 450 && cr.bills === cr.monthly - 450, 'mesečno = kirija + računi');
const crOwnerPays = KX.cost({ ...r450, ags: 'nova-adresa', ag: 'Nova Adresa' }, {});
ok(lineOf(crOwnerPays, 'provizija').payer === 'vlasnik' && crOwnerPays.moveIn === 450 + 450 + 30, 'agencija sa pm=false: proviziju plaća vlasnik → 0 za zakupca');
const crOwner = KX.cost({ ...r450, ags: null, ag: null }, {});
ok(lineOf(crOwner, 'provizija').amount === 0, 'vlasnik: bez provizije');

section('afford — 4 profila');
const regFlat = { ...base, reg: true, s: base.s + '-x1' };
ctx.window.__r = null;
const a0 = KX.afford(regFlat, { income: 0, partnerIncome: 0, cash: 0 });
ok(a0.state === 'nepoznato', 'bez profila → nepoznato');
const aRich = KX.afford(regFlat, { income: 1000, cash: 200000 });
ok(aRich.state === 'odmah', 'keš 200.000 € → odmah', aRich);
const aCred = KX.afford(regFlat, { income: 2000, partnerIncome: 500, cash: 30000 });
ok(aCred.state === 'kredit' && aCred.monthly > 0 && aCred.loanNeeded > 0 && aCred.loanNeeded <= 80000, 'plata 2.500 €, keš 30.000 € → kredit', aCred);
ok(aCred.dtiUsed < 0.5 && aCred.gate.financeable === 'da', 'DTI ispod 50 %, kapija uknjiženosti da');
const aPoor = KX.afford(regFlat, { income: 600, cash: 26000 });
ok(aPoor.state === 'van-budzeta' && /Rata bi bila/.test(aPoor.reason), 'plata 600 € → van budžeta (rata)', aPoor);
const aNoDown = KX.afford(regFlat, { income: 3000, cash: 5000 });
ok(aNoDown.state === 'van-budzeta' && /učešća|troškove/.test(aNoDown.reason), 'keš 5.000 € → van budžeta (učešće)', aNoDown);
const unreg = L.find((l) => l.t === 'prodaja' && l.pt === 'stan' && !l.reg && ['nije', 'ozakonjenje'].includes(KX.trust(l).legal));
const aCash = KX.afford(unreg, { income: 3000, cash: 40000 });
ok(aCash.state === 'samo-kes' && aCash.gate.financeable === 'ne', 'neuknjiženo → samo keš', aCash);
const land = L.find((l) => l.pt === 'zemljiste');
ok(KX.afford(land, { income: 3000, cash: 10000 }).gate.financeable === 'ne', 'zemljište: nije finansirano');
const cap = KX.creditCapacity({ income: 2000, partnerIncome: 0, cash: 30000, ltv: 0.8, dti: 0.5, ratePct: 5, years: 25, age: 35, obligations: 0 });
ok(cap.maxRata === 1000 && cap.maxLoan > 150000 && cap.maxPrice > 0, 'creditCapacity: maks. rata 1.000 €', cap);

section('fair');
const tf0 = performance.now();
const fairs = L.map((l) => KX.fair(l));
const tf = (performance.now() - tf0) / L.length;
ok(tf < 3, `fair < 3 ms po oglasu (${tf.toFixed(2)} ms)`);
const withVerdict = fairs.filter((f) => f.verdict);
ok(withVerdict.length > 150, `presuda postoji za ${withVerdict.length} od ${L.filter((l) => l.pt === 'stan' || l.pt === 'kuca').length} stanova/kuća`);
ok(fairs.every((f) => (f.n < 5) === (f.verdict === null)), 'verdict null tačno kada n < 5');
const fv = L.find((l) => KX.fair(l).verdict);
const ff = KX.fair(fv);
ok(ff.estimate.low < ff.estimate.mid && ff.estimate.mid < ff.estimate.high && ff.comps.length >= 5 && ff.comps[0].dist <= ff.comps[1].dist, 'estimate opseg, komparativi sortirani');
ok(['ispod', 'fer', 'iznad'].includes(ff.verdict) && typeof ff.diffPct === 'number', 'verdict i diffPct');
ok(ff.negotiation.roomPct >= 0 && ff.negotiation.roomPct <= 15 && ff.negotiation.firstOffer < fv.p && Array.isArray(ff.negotiation.arguments), 'pregovarač: prostor 0–15 %, prva ponuda ispod cene');
const dist = { ispod: 0, fer: 0, iznad: 0 }; withVerdict.forEach((f) => dist[f.verdict]++); console.log('  verdicts', dist);
ok(dist.fer > 0 && dist.ispod > 0 && dist.iznad > 0, 'sve tri presude postoje');
const dl = KX.ppmDelta(flat);
ok(!dl || (typeof dl.pct === 'number' && /proseka za/.test(dl.label)), 'ppmDelta vraća pct + labelu ili null kad n < 5');
ok(KX.ppmDelta(L.find((l) => l.cs === 'kopaonik')) === null, 'ppmDelta null bez uzorka opštine');

section('history');
const h1 = KX.history(flat), h2 = KX.history(flat);
ok(h1 === h2, 'memoizovano');
KX.enrich(true);
const h3 = KX.history(flat);
ok(JSON.stringify(h1) === JSON.stringify(h3), 'determinističko posle ponovnog enrich-a');
ok(h1.points.length === 12 && h1.points[11].p === flat.p, '12 tačaka, poslednja = trenutna cena');
const hist = L.map((l) => KX.history(l));
const changed = hist.filter((h) => h.changes.length === 1).length, bumped = hist.filter((h) => h.bumped).length;
console.log(`  sa sniženjem ${changed} (${(changed / L.length * 100).toFixed(0)} %), obnavljano ${bumped} (${(bumped / L.length * 100).toFixed(0)} %)`);
ok(changed / L.length > 0.25 && changed / L.length < 0.45, '~35 % oglasa ima tačno jednu promenu');
ok(hist.every((h) => h.changes.length <= 1 && h.changes.every((c) => c.from > c.to && c.pct <= -1.5 && c.pct >= -10)), 'promene su sniženja 2–9 % (zaokružene na korak cene)');
ok(bumped / L.length > 0.12 && bumped / L.length < 0.28, '~20 % obnavljano');
ok(hist.every((h) => (h.bumped ? h.daysOnMarket >= h.shownDays + 30 && h.daysOnMarket <= h.shownDays + 120 : h.daysOnMarket === h.shownDays)), 'pošten broj dana = dz (+30..120 kad je obnavljan)');
ok(hist.every((h) => h.changes.every((c) => h.points.findIndex((p) => p.m === c.m) >= h.points.findIndex((p) => p.listed))), 'promena cene nije pre objave');
ok(/^\d{4}-\d{2}-\d{2}$/.test(h1.firstSeen) && h1.context && typeof h1.context.median === 'number', 'firstSeen ISO, kontekst medijana');

section('dupes');
const groups = KX.dupes.groups();
console.log('  broj grupa:', groups.length, '| confidence:', groups.map((g) => g.confidence).join(','));
groups.slice(0, 5).forEach((g) => console.log('   ', g.offers.map((o) => `${o.r} ${o.p}€ ${o.a}m² sp${o.fl} ${o.y} ${o.ags || 'vlasnik'}`).join(' | ')));
/* U demo podacima (data.js) nema pravih duplikata: nijedan par oglasa različitih agencija nema isto naselje, strukturu,
   sprat i kvadraturu ±1 m² (ni ±5 m²). Oglasi se ne izmišljaju, pa se algoritam proverava na test-fiksturi:
   10 „klonova” stvarnih oglasa (druga agencija, cena ±3 %, m² ±1) — fikstura postoji samo u ovom testu. */
const fixtureBase = L.filter((l) => l.t === 'prodaja' && l.pt === 'stan' && l.ags && l.fl != null && l.ro != null).slice(0, 10);
const agencies = D.agencies.map((a) => a.s);
const fixture = L.concat(fixtureBase.map((b, i) => ({ ...b, s: b.s + '-test-' + i, r: b.r + '/2', p: Math.round(b.p * (1 + (i % 2 ? 0.03 : -0.03)) / 500) * 500, a: b.a + (i % 3 === 0 ? 1 : 0), ags: agencies.find((s) => s !== b.ags), ag: 'Druga agencija', dz: b.dz + 5 })));
const fg = KX.dupes.build(fixture);
console.log('  fikstura: grupa', fg.length, '| confidence:', fg.map((g) => g.confidence).join(','));
ok(fg.length >= 8 && fg.length <= 10, `fikstura od 10 klonova daje ≥ 8 grupa (${fg.length})`);
ok(fg.every((g) => g.master === g.offers[0].s && g.offers.every((o) => o.p >= g.span.min) && g.offers[0].p === g.span.min), 'master je najjeftiniji');
ok(fg.every((g) => new Set(g.offers.map((o) => o.ags)).size === g.offers.length), 'različiti oglašivači u grupi');
ok(fg.every((g) => g.confidence === 'sigurno') && fg.every((g) => g.saving === g.span.max - g.span.min && g.daysMin <= g.daysMax), 'klonovi su „sigurno”; ušteda i dani');
ok(KX.dupes.match(fixtureBase[0], { ...fixtureBase[0], s: 'x', ags: 'other', fl: fixtureBase[0].fl + 2 }) === null, 'različit sprat (bez iste godine) nije duplikat');
ok(KX.dupes.match(fixtureBase[0], { ...fixtureBase[0], s: 'x', a: fixtureBase[0].a + 2, fl: null, ags: 'other' }) === 'moguce', 'm² +2 i nepoznat sprat → „moguće”');
ok(KX.dupes.match(fixtureBase[0], { ...fixtureBase[0], s: 'x' }) === null, 'isti oglašivač nije duplikat');
ok(groups.every((g) => g.offers.every((o) => KX.dupes.groupOf(o.s) === g) && g.offers.slice(1).every((o) => KX.dupes.isSecondary(o.s)) && !KX.dupes.isSecondary(g.master)), 'groupOf / isSecondary dosledni nad demo podacima');
ok(KX.dupes.groupOf('ne-postoji') === null && KX.dupes.isSecondary('ne-postoji') === false, 'nepoznat slug → null/false');
ok(KX.dupes.count() === groups.length && KX.stats.dupes === groups.length, `stats.dupes = ${groups.length} (pravi broj grupa u demo podacima)`);

section('trust');
const sale = L.filter((l) => l.t === 'prodaja');
const legalDist = {}; const colorDist = { zeleno: 0, zuto: 0, crveno: 0 };
sale.forEach((l) => { const t = KX.trust(l); legalDist[t.legal] = (legalDist[t.legal] || 0) + 1; colorDist[t.color]++; });
console.log('  legal', legalDist, 'colors', colorDist);
const share = (k) => (legalDist[k] || 0) / sale.length;
ok(share('uknjizeno') > 0.55 && share('uknjizeno') < 0.85, 'uknjiženo 55–85 %');
ok(share('nije') > 0 && share('nije') < 0.12 && share('poseban-zakon') > 0.03 && share('ozakonjenje') > 0.03 && share('u-procesu') > 0.03, 'pet pravnih stanja sa razumnim udelima');
ok(colorDist.zeleno > sale.length * 0.4 && colorDist.crveno > 0 && colorDist.crveno < sale.length * 0.3 && colorDist.zuto > 0, 'boje: većina zeleno, crveno retko');
const tr = KX.trust(flat);
ok(tr.ekatastarUrl === 'https://katastar.rgz.gov.rs/eKatastarPublic/' && tr.checks.length >= 4 && tr.checks.every((c) => typeof c.done === 'boolean') && tr.reasons.length > 0, 'ekatastar URL, lista provera, razlozi');
ok(tr.checks.some((c) => /kapara uobičajeno 10 %/.test(c.label)), 'kapara „uobičajeno 10 %”');
ok(sale.every((l) => !l.reg ? KX.trust(l).legal !== 'uknjizeno' : true), 'reg=false nikad nije „uknjiženo”');
ok(sale.every((l) => ['nije', 'ozakonjenje'].includes(KX.trust(l).legal) ? KX.trust(l).color === 'crveno' : true), 'nije/ozakonjenje → crveno');
const rentals = L.filter((l) => l.t === 'izdavanje');
const risk = { nizak: 0, srednji: 0, visok: 0 };
rentals.forEach((l) => { const t = KX.trust(l); risk[t.rental.risk]++; });
console.log('  rental risk', risk);
ok(risk.nizak > rentals.length * 0.4 && (risk.srednji + risk.visok) > 0, 'zakup: većina nizak rizik, postoje upozorenja');
const scam = KX.trust({ ...rent, s: rent.s + '-scam', d: 'Vlasnik je u inostranstvu, depozit unapred preko Western Union.', ags: null, ag: null, im: 2 });
ok(scam.color === 'crveno' && scam.rental.score >= 45 && scam.checks[0].label.includes('pre obilaska'), 'lažni oglas → crveno', scam.rental);

section('budgetMap');
const bm = KX.budgetMap(100000, { t: 'prodaja', pt: 'stan' });
console.log('  net', bm.net, 'rows', bm.length, bm.slice(0, 3).map((r) => `${r.label} (${r.city}) ${r.m2} m² n=${r.n}`).join(' | '));
ok(bm.length >= 10 && bm.every((r) => r.n >= 5 && r.m2 > 0 && r.label && r.city && typeof r.lat === 'number'), 'redovi po opštini sa label/city/m2');
ok(bm.some((r) => r.label === 'Vračar' && r.city === 'Beograd' && r.scope === 'mun'), 'sadrži Vračar (Beograd)');
ok(bm.net < 100000 && bm.net > 90000 && near(bm.net * (1 + 0.025 + 0.024) + KX.notar(bm.net) + 45, 100000, 3), 'neto = budžet − troškovi (rešeno iterativno)');
ok(bm[0].m2 >= bm[bm.length - 1].m2, 'sortirano po m² opadajuće');
ok(bm.some((r) => r.scope === 'city'), 'gradovi bez opštinskog uzorka dobijaju red grada');

section('travel');
const place = { id: 'p1', name: 'Posao', lat: 44.8026, lng: 20.4657, who: 'ja', mode: 'auto' };
const tv = KX.travel(flat, place);
ok(tv.min >= 1 && tv.min <= 180 && tv.mode === 'auto' && typeof tv.km === 'number', 'travel auto', tv);
ok(KX.travel(flat, { ...place, mode: 'pesice' }).min > tv.min && KX.travel(flat, { ...place, mode: 'gradski' }).min >= tv.min, 'peške > gradski ≥ auto');
const far = KX.travel(L.find((l) => l.cs === 'nis'), place);
ok(far.min === 180 && far.far, 'udaljeno: cap 180 i far');
const all2 = KX.travelAll(flat, [place, { ...place, id: 'p2', name: 'Fakultet', who: 'partner', mode: 'gradski' }]);
ok(all2.length === 2 && all2[0].min <= all2[1].min, 'travelAll sortiran');
const fm = KX.fairMiddle([flat, rent], [place, { ...place, id: 'p2', who: 'partner', lat: 44.82, lng: 20.41 }]);
ok(fm.get(flat.s).max >= fm.get(flat.s).ja && fm.get(flat.s).sum === fm.get(flat.s).ja + fm.get(flat.s).partner, 'fairMiddle max/sum');
ok(KX.placeSuggest('vracar').length > 0 && KX.placeSuggest('slav')[0].name === 'Slavija', 'placeSuggest bez dijakritika');

section('parseQuery');
const tp0 = performance.now();
const q = KX.parseQuery('dvosoban vracar do 150k uknjizen');
const tp = performance.now() - tp0;
console.log('  ', JSON.stringify(q));
ok(tp < 5, `parseQuery < 5 ms (${tp.toFixed(2)} ms)`);
ok(q.filters.ro && q.filters.ro.includes(2), 'ro 2');
ok(q.filters.m && q.filters.m.includes('vracar') && q.filters.c === 'beograd', 'm vracar (+ c beograd)');
ok(q.filters.pmax === 150000, 'pmax 150000');
ok(q.filters.reg === true, 'reg true');
/* Na Vračaru u demo podacima nema dvosobnog stana ispod 150.000 € (najjeftiniji je 230.000 €), pa je pošten broj 0;
   isti upit sa „do 300k” mora da ima rezultate. */
ok(typeof q.count === 'number' && q.count === KX.count({ t: 'prodaja', pt: ['stan'], ro: [2], m: ['vracar'], pmax: 150000, reg: true }), 'count = applyFilters (' + q.count + ' — u demo podacima nema dvosobnog na Vračaru ispod 150k)');
const qWide = KX.parseQuery('dvosoban vracar do 300k uknjizen');
ok(qWide.count > 0, 'count > 0 za „dvosoban vracar do 300k uknjizen” (' + qWide.count + ')');
ok(q.unparsed.length === 0 && q.chips.length === 4 && q.chips.some((c) => c.label === 'Vračar'), 'čipovi sa ljudskim nazivima, bez neparsiranih');
const q2 = KX.parseQuery('trosoban stan novi sad od 50 do 80 m2 lift terasa izdavanje ispod 600 €');
console.log('  ', JSON.stringify(q2.filters), q2.unparsed);
ok(q2.filters.t === 'izdavanje' && q2.filters.c === 'novi-sad' && q2.filters.pt[0] === 'stan' && q2.filters.amin === 50 && q2.filters.amax === 80 && q2.filters.pmax === 600 && q2.filters.am.includes('hasElevator') && q2.filters.am.includes('hasTerrace') && q2.filters.ro.includes(3), 'složen upit (m², €, lift, terasa, izdavanje)');
const q3 = KX.parseQuery('kuća zemun od 100.000 preko 120 kvadrata garaža');
ok(q3.filters.pt[0] === 'kuca' && q3.filters.m.includes('zemun') && q3.filters.pmin === 100000 && q3.filters.amin === 120 && q3.filters.am.includes('hasGarage'), 'kuća zemun, brojevi sa tačkom, garaža kao osobina', q3.filters);
const q4 = KX.parseQuery('2.5 sobe cerak namesten ljubimci kirija');
ok(q4.filters.ro.includes(2.5) && q4.filters.n && q4.filters.n.includes('cerak') && q4.filters.m.includes('cukarica') && q4.filters.fu.includes('namesten') && q4.filters.am.includes('petsAllowed') && q4.filters.t === 'izdavanje', 'naselje → n + m, 2.5 sobe, namešten, ljubimci', q4.filters);
const q5 = KX.parseQuery('garaža novi beograd ne poslednji sprat sprat 3 nije uknjizen blabla');
ok(q5.filters.pt[0] === 'garaza' && q5.filters.m.includes('novi-beograd') && q5.filters.notLast === true && q5.filters.flmin === 3 && q5.filters.flmax === 3 && q5.unparsed.includes('blabla') && q5.filters.q === 'blabla' && q5.chips.some((c) => /bez filtera/.test(c.label)), 'garaža prvi token = tip, nije poslednji sprat, sprat 3, neparsirano → q', q5);
ok(KX.parseQuery('KV-1112899').route && KX.parseQuery('kalkulator').route === '#/kalkulator', 'navigacija: KV ref i komande');
const q6 = KX.parseQuery('centar');
ok(q6.chips.length > 0 && q6.chips[0].label.includes('('), 'dvosmislena lokacija nosi grad u čipu: ' + (q6.chips[0] || {}).label);
ok(KX.parseQuery('nova gradnja 120-150k novi beograd').filters.pmin === 120000, 'opseg 120-150k');

section('relax');
const over = { t: 'prodaja', pt: ['stan'], m: ['vracar'], ro: [2], pmax: 60000, am: ['hasElevator', 'hasTerrace'], reg: true, co: ['lux'] };
ok(KX.count(over) === 0, 'prekomerno ograničen filter nema rezultata');
const rl = KX.relax(over);
console.log('  ', rl.map((r) => `${r.label} → ${r.count}`).join(' | '));
ok(rl.length >= 1 && rl.length <= 5 && rl.every((r) => r.count > 0 && r.filters && r.label), 'relax vraća 1–5 predloga sa brojem');
ok(rl.every((r, i) => i === 0 || rl[i - 1].count >= r.count), 'sortirano opadajuće');

section('count / filter / profile');
ok(KX.count({ t: 'prodaja', pt: ['stan'] }) === L.filter((l) => l.t === 'prodaja' && l.pt === 'stan').length, 'count bez filtera = svi prodaja/stan');
ok(KX.count({ t: 'prodaja', pt: ['stan'], advertiser: 'vlasnik' }) === L.filter((l) => l.t === 'prodaja' && l.pt === 'stan' && !l.ags).length, 'advertiser vlasnik');
ok(KX.count({ t: 'izdavanje', pt: ['stan'], n: ['cerak'] }) > 0, 'n (naselje) predikat');
ok(KX.count({ t: 'prodaja', pt: ['stan'], legal: true }) === L.filter((l) => l.t === 'prodaja' && l.pt === 'stan' && KX.trust(l).color === 'zeleno').length, 'legal (samo zeleni) predikat engine-a');
ok(KX.filter({ t: 'izdavanje', pt: ['stan'], risk: true }).every((l) => KX.trust(l).color !== 'crveno'), 'risk predikat');
const p = KX.profile.get();
ok(p.ltv === 0.8 && p.dti === 0.5 && p.ratePct === 5 && p.years === 25 && p.agencyFeePct === 2 && p.hidden instanceof Set, 'podrazumevani profil');
let fired = 0; const off = KX.profile.on(() => fired++);
KX.profile.set({ firstHome: true });
ok(KX.profile.get().ltv === 0.9 && fired === 1, 'firstHome → LTV 0,9, listener pozvan');
KX.profile.set({ firstHome: false }); off(); KX.profile.set({ cash: 1 });
ok(KX.profile.get().ltv === 0.8 && fired === 2, 'odjava listenera radi');
KX.profile.reset();
ok(KX.profile.get().cash === 0 && !KX.profile.hasBudget(), 'reset');

section('ledger');
ok(KX.ledger.length >= 12 && KX.ledger.length <= 20 && KX.ledger.every((e) => typeof e.feature === 'string' && typeof e.real === 'boolean' && e.how.length > 20), `ledger ima ${KX.ledger.length} stavki sa feature/real/how`);
ok(KX.ledger.some((e) => /PDV 10 % je već u oglašenoj ceni/.test(e.how)) && KX.ledger.some((e) => /Zakonu 2025/.test(e.how)), 'ledger pominje PDV u ceni i Zakon 2025');

section('performance — enrich + cost nad svim oglasima');
const tc0 = performance.now();
L.forEach((l) => KX.cost(l));
const tc = performance.now() - tc0;
ok(tc < 150, `cost za 660 oglasa (${tc.toFixed(1)} ms)`);
const ta0 = performance.now();
KX.profile.set({ income: 1500, cash: 40000 });
L.forEach((l) => KX.afford(l));
const ta = performance.now() - ta0;
ok(ta < 400, `afford za 660 oglasa (${ta.toFixed(1)} ms)`);
const st = {}; L.filter((l) => l.t === 'prodaja').forEach((l) => { const s = KX.afford(l).state; st[s] = (st[s] || 0) + 1; });
console.log('  afford states (1.500 €, 40.000 €):', st);
KX.profile.reset();

console.log(`\n${pass} prošlo, ${fail} palo`);
process.exit(fail ? 1 : 0);

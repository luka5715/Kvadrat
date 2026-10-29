# `js/engine.js` — global `KX` (product logic)

Pure logic over `D.listings`; no DOM at load time, no `Date.now()` randomness (everything from `hash()`/`rng()` in core.js;
`new Date()` only for relative dates). Load order: `data.js` → `js/core.js` → … → `js/engine.js` (needs `D`, `hash`, `rng`,
`nf`, `AMEN`, `HEAT`, `DEFAULTS`, `applyFilters`; all guarded with `typeof` so the engine also runs without them).
Every `KX.*` call lazily runs `KX.enrich()` once, so pages never need to call it themselves (boot may call it to pay the
~10–20 ms up front). Tests: `node dev/engine.test.js`.

Money is in €, rounded to whole euros; percentages are numbers (`diffPct: -7.3`), labels are Serbian Latin strings.

## `KX.enrich(force?)` → indexes
Builds per-(t|pt) pools, €/m² and days-on-market medians (naselje / opština / grad), duplicate groups and the query
dictionary; clears memo caches. Idempotent; `force=true` rebuilds. `KX.stats` → `{enrichMs, dupes, listings}`.

## `KX.profile`
```js
KX.profile.get()  // → { income, partnerIncome, obligations, cash, age, firstHome, household,
                  //     ltv (0.8; 0.9 when firstHome), dti (0.5 'konzervativno', NBS cap 0.6), ratePct 5, years 25,
                  //     financing 'kredit'|'kes', nkosk false, agencyFeePct 2, agencyPayer 'kupac'|'prodavac',
                  //     taxPayer 'kupac'|'prodavac', vatIncluded true, priceMode 'oglas'|'ukupno'|'mesecno',
                  //     budget, places:[{id,name,lat,lng,who:'ja'|'partner',mode:'auto'|'gradski'|'pesice'|'bicikl'}], hidden:Set }
KX.profile.set({ income: 1800, cash: 30000, firstHome: true })  // persists to localStorage 'kv.profile' (try/catch),
                  // bumps LTV to 0.9 automatically when firstHome flips (unless ltv was set explicitly), clears cost/afford memo, notifies
const off = KX.profile.on((profile, patch) => rerenderPanel());  // → unsubscribe fn
KX.profile.reset(); KX.profile.hasBudget(); KX.profile.defaults
```

## `KX.titleOf(l)` → string
`"Dvosoban stan, 60 m², Vračar · Čubura"` · rental `"…, 450 €/mes"` · `"…, u izgradnji, rok Q4 2027"` · `"…, novogradnja"` ·
`"Trosobna kuća, 180 m², Zemun · Altina"` (feminine agreement) · `"Garsonjera, 25 m², …"` · `"Plac 48 ari, Čačak · Uži centar"`.
Opština · naselje for Beograd/Novi Sad/Niš, grad · naselje elsewhere.

## `KX.cost(l, profile?)` → cost sheet (memoised when `profile` omitted)
Pass a partial profile to override (`{ firstHome: true, household: 2 }`, `{ financing: 'kes' }`, `{ vatIncluded: false }`).

**prodaja**
```js
{ kind:'prodaja', price, netPrice, priceIncludesVat: true|false|null, taxMode:'pdv'|'prenos',
  lines:[{ key, label, amount, when:'kupovina'|'useljenje'|'mesecno'|'kasnije', payer:'kupac'|'prodavac'|'dogovor',
           optional, estimate, note, included?, inPrice?, net?, vat?, winter?, summer? }],
  onPurchase, moveIn, monthly, laterInflow, total, optional:{kupovina?, useljenje?},   // totals skip optional lines and payer 'prodavac'
  monthlyWinter, monthlySummer, loan, downPayment, ltv, cashOnDay, fees,
  firstHome:{ eligible, exemptM2, eligibleM2, sharePct, saving, when:'kupovina'|'kasnije'|null }, assumptions:[string] }
```
Line keys, in order: `cena`, `pdv` (novogradnja: `amount 0, included:true, inPrice` when the price already contains PDV — the
default; `vatIncluded:false` adds 10 %) **or** `porez` (2,5 %, payer = `profile.taxPayer`, note about the legal payer being the
seller), `prvi-stan` (negative, starogradnja exemption 40 m² + 15 m² per extra household member, reduces day-of-purchase cash),
`pdv-povracaj` (negative, `when:'kasnije'`, novogradnja: PDV refund on the **net** price ≈ 45 days later; never reduces
`onPurchase`; surfaced as `laterInflow`), `provizija` (`agencyFeePct` % + PDV 20 %, `net`/`vat` split, payer `agencyPayer`;
0 for owner listings), `notar` (band 120–650 €), `upis` (45 €), then only with a loan: `procena` 120 €, `obrada` 0,5 %, `nkosk`
(`optional:true` unless `profile.nkosk`, 1,5/2,5/3,5 % by LTV), `osiguranje` 40 €; `selidba` (useljenje), `adaptacija`
(optional, only `co==='potrebno-renoviranje'`); monthly: `rata`, `grejanje`, `struja`, `komunalije`, `odrzavanje`
(stambena zajednica), `porez-imovina` (label „gruba procena”, formula in `note`), `osiguranje-mes`.
Loan = `ltv × price`, or `onPurchase − cash` clamped to `ltv × price` when `profile.cash > 0`; `financing:'kes'` → no loan lines.

```js
const c = KX.cost(l);                     // 100.000 € starogradnja, agency, default profile:
c.lines.find(x => x.key === 'porez').amount      // 2500
c.lines.find(x => x.key === 'provizija').amount  // 2400  (net 2000 + vat 400)
c.onPurchase                                      // 105765 (incl. 80.000 € loan lines)
KX.cost(l, { firstHome: true, household: 2 }).firstHome   // { exemptM2: 55, eligibleM2: 55, saving: 2292, when: 'kupovina' }
```

**izdavanje**
```js
{ kind:'izdavanje', price, lines:[kirija (useljenje), depozit (refundable:true), provizija (50 % kirije; payer 'zakupac' |
  'vlasnik' when agency.pm === false | 0 for owner listings), overa 30 €, 'kirija-mes' + utility lines (mesecno)],
  moveIn, monthly, bills, refundable, nonRefundable, monthlyWinter, monthlySummer, total, assumptions }
```
`KX.cost({…rental, p: 450, dep: 450})` → depozit 450, provizija 225 (or 0 for tenant when the agency bills the owner), moveIn 1.155.

Helpers: `KX.annuity(loan, ratePct, years)`, `KX.notar(price)`, `KX.utilities(l)` (monthly utility lines), `KX.TARIFF` (constants).

## `KX.afford(l, profile?)`
```js
{ state:'odmah'|'kredit'|'samo-kes'|'van-budzeta'|'nepoznato', label, reason, maxLoan, monthly, dtiUsed,
  gate:{ legal, financeable:'da'|'zavisi'|'ne' }, loanNeeded, cashAllIn, fees, missing? }
```
Rules: no income and no cash → `nepoznato`; `cash ≥ cashAllIn` → `odmah`; legal `nije`/`ozakonjenje` or `pt zemljiste` →
`samo-kes`; otherwise loan = price + fees − cash must be ≤ LTV × price and ≤ `maxLoan` (DTI × income − obligations through the
annuity) → `kredit` with `label 'Rata 512 €'`; `u-procesu`/`poseban-zakon`/`u-izgradnji` keep `kredit` but `financeable:'zavisi'`
and the reason says so. `KX.creditCapacity(profile?)` → `{income, maxRata, maxLoan, maxPrice, years, ltv, dti, creditPossible}` for
the rail summary line.

## `KX.fair(l)` (memoised; < 1 ms)
```js
{ estimate:{low, mid, high, ppm}|null, verdict:'ispod'|'fer'|'iznad'|null, diffPct, basePpm,
  comps:[{s, r, ppm, p, a, ro, fl, y, n, dz, dist, km}], n, adjustments:[{key, label, pct}], reason,
  negotiation:{ roomPct, roomEur, firstOffer, realistic:{low, high}, leverage:'slab'|'umeren'|'jak', arguments:[string] } }
```
Comps: same t+pt+city, distance `0.5·km + 6·|ln(a/a₀)| + 2·|Δro| + 1.5 (other naselje) + 1 (other opština)`, 8 nearest;
`verdict` is `null` when fewer than 5 comps have distance ≤ 8 (`estimate` null too, `comps` still returned). Band ±6 %.
Negotiation points (max 15 %): price vs estimate, days vs municipal median, drops, `neg`, duplicate group, renovation, owner ad.
`KX.ppmDelta(l)` → `{pct, median, n, dir:'up'|'down'|'flat', label}` or `null` when the opština sample is < 5 (spec 5.7 Δ chip;
core's `stats.delta(l)` is the same idea with naselje→opština→grad fallbacks — use either, consistently per page).

## `KX.history(l)` (memoised, deterministic)
```js
{ points:[{m:'2026-01', p, listed}], changes:[{m, from, to, pct}], daysOnMarket, shownDays, bumped, firstSeen:'2026-07-14',
  published, p0, dropPct, context:{median, scope:'mun'|'city'|'all', label, percentile, n} }
```
12 monthly points ending at the current price; ~⅓ of listings older than 14 days get exactly one drop (2–9 %, rounded to the
price step); ~20 % are „obnavljani”: `daysOnMarket = dz + 30…120` (the honest number), `shownDays = dz`.

## `KX.dupes`
```js
KX.dupes.groupOf(slug)      // null | { id, master (cheapest slug), confidence:'sigurno'|'moguce',
                            //   offers:[{s, r, ag, ags, p, ppm, dz, agv, owner, fl, a, y}] sorted by price,
                            //   span:{min,max}, saving, daysMin, daysMax, ownerPosing }
KX.dupes.isSecondary(slug)  // true for non-master members
KX.dupes.groups(); KX.dupes.count(); KX.dupes.hiddenCount()
KX.dupes.match(a, b)        // pure: null | 'sigurno' | 'moguce'
KX.dupes.build(list)        // pure: groups for any array of listing objects (used by the tests)
```
Key: same t, pt, grad, opština, struktura, |Δm²| ≤ 2, same floor (null = wildcard; ±1 only with the same year), |Δyear| ≤ 2,
≤ 3 km, **different advertiser**. `sigurno` = same naselje, |Δm²| ≤ 1, same floor. **The demo data contains no real
duplicates (0 groups)** — no listings are synthesised; the UI must handle `groupOf() === null` everywhere.

## `KX.trust(l)` (memoised)
```js
{ color:'zeleno'|'zuto'|'crveno', title, reasons:[string], checks:[{label, done}], legal:'uknjizeno'|'u-procesu'|
  'poseban-zakon'|'ozakonjenje'|'nije', legalLabel, flags:['hipoteka'|'suvlasnistvo'|'bez-upotrebne-dozvole'],
  ekatastarUrl:'https://katastar.rgz.gov.rs/eKatastarPublic/', rental: null | { risk:'nizak'|'srednji'|'visok', score, flags }, face }
KX.trustCheck(slug, index, done)   // user action: persists the checklist tick in localStorage 'kv.checks', returns the done indexes
KX.legalLabel[legal]
```
prodaja: legal state from `reg` + deterministic rng (≈ 68 % uknjiženo, 13 % u procesu, 9 % Zakon 2025, 6 % ozakonjenje,
4 % nije on the demo data); colour = legal + demo flags + unverified agency + price far from the fair estimate.
izdavanje: scam score from price ≪ area median, few photos, unverifiable advertiser, deposit > 2 months, risky phrases,
fresh+cheap; `< 20` zeleno, `20–44` žuto, `≥ 45` crveno; `checks` = the tenant's to-do before paying anything.

## `KX.budgetMap(budget, {t, pt, owner?, credit?, cs?})` → rows (array with `.net`, `.costs`, `.budget`)
`[{ key, label:'Vračar', city:'Beograd', cs, scope:'mun'|'city', lat, lng, m2, n, ppm, net, count, typical, cheapest }]`
sorted by `m2` desc; opštine with ≥ 5 listings of t/pt, plus one city row for cities without such opštine.
`net` solves `x + 2,5 % + 2 % + PDV + notar(x) + 45 = budget` (`KX.netForBudget(budget, opts)`); rent mode: `net = budget`.

## Travel (procena)
```js
KX.travel(l, place)          // { min (1..180), mode, km, far } — haversine × 1,3; auto 22 km/h + 4 min, gradski 14 km/h + 6 min,
                             //   pešice 4,5 km/h, bicikl 14 km/h + 2 min
KX.travelAll(l, places?)     // [{place, min, mode, km}] sorted asc (default: profile.places)
KX.fairMiddle(list, places?) // Map slug → { max, sum, ja, partner } using each person's primary place
KX.placeSuggest('vracar')    // [{name, lat, lng, cs, kind:'poi'|'mun'|'nbhd'}] for the places input; KX.POI = landmark list
```

## `KX.parseQuery(text)`
```js
KX.parseQuery('dvosoban vracar do 150k uknjizen')
// → { filters:{ ro:[2], c:'beograd', m:['vracar'], pmax:150000, reg:true }, chips:[{label:'Dvosoban',key:'ro',value:2},
//     {label:'Vračar',key:'m',value:'vracar'}, {label:'do 150.000 €',key:'pmax',value:150000}, {label:'Uknjiženo',key:'reg',value:true}],
//     unparsed:[], count:0 /* honest: no such flat in the demo data; 'do 300k' → 4 */, route:null }
```
`filters` uses the **core.js `FILTER_DEFAULTS` contract** (partial): `t`, `pt:[…]`, `c`, `m:[…]`, `n:[…]`, `ro:[…]`, `pmin/pmax`,
`amin/amax`, `flmin/flmax` (`sprat 3` → both 3, `prizemlje` → 0), `notLast`, `co:[…]`, `he:[…]`, `fu:[…]`, `reg`, `am:[…]`,
`advertiser:'vlasnik'`, `q` (unparsed words joined — core matches them against title/place/ref/agency). A naselje sets `n` and
its `m`; a mun sets `m` and `c`; a city sets `c`. Feed it straight to `setHash('/pretraga', filtersToParams({...FILTER_DEFAULTS, ...filters}))`.
Grammar (diacritic-insensitive, `đ→dj`): cities/muns/naselja incl. aliases (`bg`, `ns`, `nbg`, `blok 45`), ambiguous names →
chip `Centar (Čačak)` + `ili: …`; struktura words and `2 sobe`/`2.5`; `do|ispod|max 150k|150.000|150 hiljada`, `od|preko|min`,
ranges `120-150k` / `od 50 do 80 m2`; `m2|m²|kvadrata`; bare `60 m2` → ±10 %; bare number ≥ 10.000 → pmax; flags `uknjizen`,
`novogradnja`, `renoviran`, `lux`, `u izgradnji`, heating `cg|eg|ta|gas|podno`, `namesten|polunamesten|prazan`, amenities
(`lift terasa balkon parking garaza klima ljubimci pas …`), `vlasnik|od vlasnika|bez provizije` → `advertiser:'vlasnik'`,
`ne poslednji sprat` → `notLast`, `sprat 3`/`prizemlje` → `flmin/flmax`, `izdavanje|kirija|prodaja`, types (`stan kuca plac
lokal soba vikendica`; `garaza` is a type only as the first token); `nije uknjižen` → info chip only (no negative filter).
Commands: `kalkulator`, `mapa`, `uporedi`, `sacuvani`, `agencije`, `budzet`, `moja mesta`, `KV-1112899` → `route`.

## `KX.count(filters)` / `KX.filter(filters)`
`filter` = `applyFilters({...FILTER_DEFAULTS, ...filters})` (a built-in fallback with the same contract runs when core.js is
absent) plus the engine-only predicates `legal:true` (only green semafor), `risk:true` (hide red rentals), `fit:true` (only
`odmah`/`kredit`), `dup:true` (hide secondary duplicates), `hidden:true` (hide `profile.hidden` slugs). `count` memoises by
the filter JSON (`≈ 0,2 ms` per distinct filter) — use it for the live counts beside every rail option.

## `KX.relax(filters)` → `[{label, filters, count}]`, count desc, max 5
Input is a FILTER_DEFAULTS-shaped filter. Tries removing each active filter (`Ukloni filter Lift`), widening price/area by
20 % (`Cena do 180.000 € (+20 %)`), ±0,5 rooms, naselje → opština, floor +2, year −10; if no single change yields results it
tries pairs (`Ukloni filtere Opština i Cena do`), then „Zadrži samo lokaciju”, then „Ukloni sve filtere”. Each row's `filters`
is ready for `setHash`.

## `KX.ledger` → `[{feature, real:boolean, how}]` (20 entries, Serbian)
Source for the „Kako računamo” page: what is computed from data (`real:true`) vs. deterministic demo (`real:false`), each with
the formula in one line.

## Misc
`KX.median`, `KX.haversine`, `KX.deacc`, `KX.roomWord(ro)`, `KX.medianPpm(l, min, scopes)`, `KX.medianDz(l)`, `KX.EKATASTAR`.

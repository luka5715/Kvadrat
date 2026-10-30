# `js/core.js` — API za stranice (data & logic)

Klasičan `<script>` bez build koraka; sve ispod su **globali** u deljenom opsegu (`const`/`function` na vrhu skripte).
Redosled učitavanja: `data.js` → `js/core.js` → `js/images.js` → `js/ui.js` → `js/map.js` → `js/pages/*.js` → `js/app.js`.
Na učitavanju core **ne dira DOM** (radi i u node-u: `node dev/core.test.js`). Jedini DOM-poziv je `toast()` i `el()` pri pozivu.

Sve funkcije su čiste i sinhrone; `stats.*` i `mock.*` keširaju / determinističke su (isti ulaz → isti izlaz, i posle reload-a).

---

## Podaci i pregledi

| ime | opis |
|---|---|
| `D` | `window.KV` — `{ listings[660], cities[34], muns[124], agencies[18], articles[12] }` |
| `find.listing(slug)` / `find.city(cs)` / `find.mun(ms)` / `find.agency(ags)` / `find.article(s)` | O(1) pregled po slugu, `null` ako nema |
| `find.munsOf(cs)` | opštine grada |
| `CITIES_MAJOR` | `[{s, n, loc}]` gradovi sa `maj=true` (10) |
| `TYPES` | `[{v:'stan', l:'Stanovi', s:'Stan', pl:'stanova', icon}]` (7 tipova) |
| `ROOMS` | `[[0.5,'Garsonjera'],[1,'Jednosoban'],…,[5,'Petosoban i više']]` |
| `COND`, `HEAT`, `FURN`, `ORIENT`, `AMEN` | `{slug: 'Etiketa'}` (etikete iz starog core-a) |
| `ENERGY` | `['A+','A','B','C','D','E','F','G']` |
| `SORTS` | `[{v:'rel', l:'Preporučeno'}, {v:'new', l:'Najnovije'}, {v:'p-asc', l:'Cena rastuće'}, {v:'p-desc', l:'Cena opadajuće'}, {v:'ppm-asc', l:'€/m² rastuće'}, {v:'ppm-desc', l:'€/m² opadajuće'}, {v:'a-desc', l:'Kvadratura'}, {v:'delta', l:'Najbolja vrednost'}]` |
| `ADVERTISERS` | `[{v:'', l:'Svi oglašivači'}, {v:'agencija', l:'Agencije'}, {v:'vlasnik', l:'Vlasnici'}]` |
| `typeOf(v)` | `TYPES` stavka za slug (fallback `stan`) |

Napomena o podacima: `l.pr` je `'PREMIUM' | 'TOP' | 'ISTAKNUT' | 'NONE'` (ne `null`). `l.ag`/`l.ags` su `null` kod vlasnika (193 oglasa). `l.dep` je `null` za prodaju. Sva polja `co/he/fu/or/en/ro` mogu biti `null` (zemljišta, garaže).

## DOM helperi

```js
$(sel, root = document)            // querySelector
$$(sel, root = document)           // Array od querySelectorAll
el(tag, attrs, ...kids)            // → HTMLElement
```
`attrs`: `class` (string ili niz, falsy se preskače) · `id`, `href`, `type`, `style` (string) · `html` (innerHTML) · `text` (textContent) ·
`onclick`/`oninput`/`on*` (listener, ime događaja = sve posle `on`, malim slovima) · `dataset: {k: v}` ili direktno `'data-x': v` ·
`'aria-*'` i svi ostali → `setAttribute`. `null`/`undefined`/`false` se preskače, `true` → prazan atribut (`hidden`, `disabled`).
`kids`: string | number | Node | niz (proizvoljno ugnežđen) | `null`/`false`/`true` (preskače se).

## `hash(str) → uint32`, `rng(seed) → () => [0,1)`
FNV-1a i mulberry32 — **nepromenjeni** u odnosu na stari core (images.js zavisi od njih).

---

## `fmt` — formatiranje (sr-RS: hiljade `.`, decimale `,`, pravi minus `−`, tanak razmak ` ` pre `%`)

| poziv | rezultat |
|---|---|
| `fmt.num(125000)` / `fmt.num(4.756, 2)` | `125.000` / `4,76` |
| `fmt.price(125000)` / `fmt.price(450, 'izdavanje')` | `125.000 €` / `450 €/mes` (drugi arg = `l.t`; zaokružuje na ceo €). Između broja i jedinice je **NBSP** (U+00A0) u `price`, `ppm`, `m2`, pa jedinica ne prelazi sama u novi red; ne deli izlaz po `' '` |
| `fmt.ppm(1850.4)` / `fmt.ppm(13.13)` | `1.850 €/m²` / `13,1 €/m²` (ceo broj za ≥ 100, jedna decimala ispod — kirije) |
| `fmt.m2(46)` / `fmt.m2(46.5)` | `46 m²` / `46,5 m²` |
| `fmt.land(650)` / `fmt.land(12000)` | `6,5 ari` / `1,2 ha` (ulaz u m²) |
| `fmt.pct(9.66, {sign:true})` / `fmt.pct(-6.2)` / `fmt.pct(0, {sign:true})` | `+9,7 %` / `−6,2 %` / `±0,0 %` (`dec` opcija, podrazumevano 1; pre `%` je uski neprelomni razmak `THIN` = U+202F) |
| `fmt.rel(0/1/3/14/90/400)` | `danas` / `juče` / `pre 3 dana` / `pre 2 nedelje` / `pre 3 meseca` / `pre godinu dana` |
| `fmt.floor(2, 10)` / `fmt.floor(0, 6)` / `fmt.floor(-1)` | `2. od 10` / `Prizemlje od 6` / `Suteren` |
| `fmt.rooms(2)` / `fmt.roomsN(1.5)` / `fmt.roomsN(5)` / `fmt.roomsText(1.5)` | `Dvosoban` / `1,5` / `5+` / `1,5 sobe` (decimalni broj → genitiv jednine: `2,5 sobe`; `2 sobe`, `1 soba`, `5+ soba`) |
| `fmt.year(2025)` | `2025.` |
| `fmt.count(n, 'oglas','oglasa','oglasa')` / `fmt.listings(106)` | `106 oglasa` (`1 oglas`, `21 oglas`, `11 oglasa`) |
| `fmt.plural(n, a, b, c)` | srpska množina (1→a, 2–4→b, 5+→c, 11–14→c) |
| `fmt.month('2025-11')` | `nov ’25` (ose sparkline-a) |
| `fmt.fold('Čačak')` | `cacak` — bez dijakritika, mala slova (pretraga) |

Sve vraćaju `''` za `null`/`undefined`. Elementi koji prikazuju brojeve treba da imaju `font-variant-numeric: tabular-nums` (CSS, klasa `.num`).

---

## `stats` — statistika (keširano, računa se lenjo pri prvom pozivu)

```js
stats.refPpm(l)   // → { ppm, label, n, scope: 'nbhd'|'mun'|'sub'|'city'|'region', key }  |  { ppm:null, n:0, scope:null, reason:'malo'|'tip' }
```
Medijana €/m² oglasa **istog `t` i `pt`**, prvi obim sa dovoljno oglasa: naselje (≥ 5) → opština (≥ 5) → **prigradske opštine Beograda** (`sub`, ≥ 5: Surčin, Grocka, Obrenovac, Lazarevac, Mladenovac, Sopot, Barajevo — porede se međusobno, nikad sa gradskim jezgrom) → grad (≥ 5; Beograd bez prigradskih) → **manji gradovi istog regiona** (`region`, ≥ 6; po `city.reg`, samo gradovi bez sopstvenog uzorka; Zlatibor, Kopaonik i Vrnjačka Banja čine zaseban skup „turistička mesta”) → **null**. Nikad cela Srbija (Beograd bi dominirao: Leskovac je ranije pokazivao −46 %). Plac i soba nemaju Δ (`reason:'tip'`). Sintetički ponovljeni oglasi (`l.syn`) ne ulaze u medijane.
`label` je ime naselja / opštine / grada, `'prigradske opštine Beograda'` ili `'manji gradovi — <region>'`. Uvek vraća objekat; kad je `scope === null` (`reason:'malo'`) **nema Δ čipa** — €/m² stoji sam, uz tooltip „malo podataka” (`ui` to radi u `.ctx`). `stats.MIN_N === 5`. Napomena: u trenutnom data.js nijedno naselje nema ≥ 5 oglasa istog t+pt (najviše 4), pa se `scope:'nbhd'` u praksi ne javlja — UI mora da radi sa bilo kojim opsegom i da prikazuje `label`.
U ovom skupu podataka nijedno naselje nema ≥ 5 oglasa istog t+pt, pa je opseg u praksi `mun`/`city`/`all`.

```js
stats.delta(l)    // → { pct, ppm, label, n, scope, reason }   pct = (l.ppm / ref.ppm − 1) × 100, jedna decimala; pct:null (scope:null) bez uzorka
stats.inScope(x, l, ref) // da li oglas x pripada obimu reference ref izračunate za l (grafici „oblast Merila”)
stats.reset()     // briše keš medijana i Δ (posle dodavanja oglasa u D.listings — KX.enrich to radi)
stats.isSuburban(l) // Beograd + prigradska opština
stats.deltaPct(l) // → number | null   (brzo, za sortiranje)
```
`ppm` ovde je **referentna** medijana (za tooltip „9,7 % iznad proseka za Vračar (5.519 €/m²)“). Klasa čipa: `|pct| ≤ 1,5` → `flat`, `> 0` → `up`, `< 0` → `down` (radi `ui.deltaChip`).

```js
stats.cityIndex()               // → [{ c, cs, loc, ppm, n, change, change12 }]   prodaja+stan, gradovi sa maj=true ili ≥10 oglasa; sortirano po n
stats.munIndex(cs, t='prodaja', pt='stan') // → [{ m, ms, ppm, n }] opštine grada sa medijanom, sortirano po ppm opadajuće (bar-chart sa n=)
stats.histogram(list, key='p', bins=24)    // → [{ from, to, n }] „lepe“ ivice (1/2/2,5/5 × 10^k), gornja ivica = 98. percentil, poslednja korpa skuplja ostatak; key može biti i fn(l)
stats.medians(list)             // → { p, ppm, a, n }
stats.similar(l, n=4)           // → listings[]  isti t+pt, isti grad (dopuna iz drugih gradova ako nema n), najbliži po ceni i m², bonus za istu opštinu/naselje
stats.median(numbers)           // → number | null
```
`change` je deterministička „mesečna promena“ u [−1,5, +1,5] %, `change12` godišnja u [−2, +10] % (mock, iz `hash(cs)`).

---

## `mock` — deterministički podaci o lokaciji (iz `hash(l.s + '#…')`)

```js
mock.street(l)   // → 'Makenzijeva 41'   (l.ad ako postoji I ako se ta ulica nalazi u tabeli ulica opštine/grada — data.js ponekad dodeli ulicu iz pogrešnog dela grada, pa se tada generiše; za grad bez tabele l.ad se uvek prihvata — **nikad ne prikazuj `l.ad` direktno, uvek `mock.street(l)`**; inače ~15 realnih ulica po beogradskoj opštini, ~25 po Novom Sadu/Nišu/Kragujevcu, 15 generičkih; broj 1–150)
mock.walk(l)     // → { min: 6, to: 'pijace Vidikovac' }   min 3–14; `to` je u genitivu → "6 min hoda do pijace Vidikovac"
mock.history(l, months=12) // → [{ m: '2025-11', p: 118000 }, … 12 tačaka], poslednja = tekući mesec i tačno l.p; mali drift + najviše jedan skok (±3–8 %); cene zaokružene (100 € / 10 € / 5 €)
mock.hood(l)     // → { transport: [{type:'Autobus'|'Tramvaj'|'Trolejbus', line:'23', stop:'Vidikovac', min:4}, ×2–3],
                 //     pijaca:{name,min}, skola:{name:'OŠ „Vuk Karadžić“',min}, vrtic:{name,min}, park:{name,min}, prodavnica:{name,min},
                 //     linije po beogradskoj opštini: tramvaj/trolejbus samo gde realno saobraćaju; prigradske opštine (Surčin, Grocka, Obrenovac, Lazarevac, Mladenovac, Sopot, Barajevo) i Zemun samo autobus
                 //     jedan izvor istine sa walk(l): kad walk.to imenuje pijacu ili park iz liste (genitiv ↔ nominativ, „pijace Vidikovac“ = „Pijaca Vidikovac“), ta stavka dobija walk.min (zato pijaca/park min 3–15)
                 //     note: 'Kakav je kraj…' (1–2 rečenice, šablon po tipu opštine; minute pijace u tekstu = pijaca.min, „na 8 minuta hoda“), kind: 'centar'|'blokovi'|'brdo'|'stari'|'prigradski'|'centar-grad'|'mirno'|'odmor' }
mock.cityGen(cs) // → 'Novog Sada' (genitiv imena grada; lokativ je u D.cities[].loc: 'Novom Sadu')
```
POI rečnik po opštini za Beograd (Kalenić, Bajloni, Zeleni venac, Vidikovac, Banovo brdo, Kalemegdan, Ada, Tašmajdan, Ušće, Košutnjak, Vukov spomenik…), po gradu za Novi Sad (Štrand, Dunavski park, Futoška/Limanska pijaca, Spens…), Niš (Tvrđava, Čair, Kazandžijsko sokače…), Kragujevac, Subotica, banje; generički za ostale.
Tekstovi su u srpskoj latinici, bez marketinških fraza. Za `history` sparkline po m² podeli `p` sa `l.a` (ui.js to već radi).

---

## `store` — stanje korisnika (localStorage `kv.*`, fallback u memoriji; svi pristupi u try/catch)

| polje / metoda | opis |
|---|---|
| `store.favs: Set<slug>` · `store.isFav(s)` · `store.toggleFav(s) → bool` (novo stanje) | ♡ |
| `store.compare: slug[]` (max 4) · `store.inCompare(s)` · `store.toggleCompare(s) → bool` · `store.clearCompare()` | kad je puno: `toast('Možete uporediti najviše 4 oglasa')` i vraća `false` |
| `store.recent: slug[]` (max 12, najnovije prvo) · `store.pushRecent(s)` | „Nedavno pogledano“ |
| `store.searches: [{id, name, params, created}]` · `store.saveSearch(name, params) → item` · `store.removeSearch(id)` | `params` = `filtersToParams(f)` |
| `store.notes: {slug: text}` · `store.getNote(s)` · `store.setNote(s, text)` (prazno briše) | beleške |
| `store.getTheme() → 'light'|'dark'|null` · `store.setTheme(t)` | ključ `kv.theme` |
| `store.on(fn) → off` | `fn(what, store)`; `what ∈ 'favs'|'compare'|'recent'|'searches'|'notes'|'theme'`. Pretplatnik koji baci grešku ne ruši ostale. Uvek pozovi `off()` kad element nestane. |

Ključevi: `kv.favs`, `kv.compare`, `kv.recent`, `kv.searches`, `kv.notes`, `kv.theme`.

---

## Ruter

```js
parseHash(h?)                       // → { path: '/pretraga', q: URLSearchParams }   (podrazumevano location.hash; '' → '/')
setHash(path, params, replace=false)// gradi '#/path?k=v'; replace=true → history.replaceState (bez skrola i bez 'hashchange') + obaveštava router.onChange pretplatnike
router.href(path, params)           // → '#/pretraga?c=beograd&pt=stan,kuca'  (za <a href>)
router.buildHash(path, params)      // isto
router.onChange(fn) → off           // fn({path, q}, {replace}) — zove se i na native hashchange i na setHash(…, true)
router.current()                    // → parseHash()
```
Serijalizacija parametara: `''`/`null`/`false`/`[]` se izostavljaju, nizovi → `a,b` (zapeta ostaje čitljiva), `true` → `1`, razmak → `+`, `+` → `%2B`.
**Preporuka za app.js:** `router.onChange((r, o) => render(r, o))` + inicijalni `render(parseHash())`. Pri `replace` ne skroluj na vrh (koristi se za kucanje u filterima).

## Filteri

```js
FILTER_DEFAULTS = { t:'prodaja', pt:[], c:'', m:[], n:[], pmin:'', pmax:'', amin:'', amax:'', ro:[], flmin:'', flmax:'', notLast:false,
                    ymin:'', ymax:'', co:[], he:[], fu:[], reg:false, newbuild:false, am:[], agency:'', advertiser:'', q:'', deltaMax:'',
                    sort:'rel', view:'grid', page:1 }   // zamrznut — uvek { ...FILTER_DEFAULTS, … }
```
| ključ | tip | značenje |
|---|---|---|
| `t` | `'prodaja'\|'izdavanje'` | obavezan (nevažeće → `prodaja`) |
| `pt` | `string[]` | tipovi; `[]` = svi |
| `c` | city slug | jedan grad |
| `m`, `n` | slug[] | opštine / naselja (OR unutar grupe) |
| `pmin,pmax,amin,amax,flmin,flmax,ymin,ymax` | `number \| ''` | granice (uključive); u URL-u stringovi, `paramsToFilters` vraća brojeve |
| `ro` | `(number \| 'N+')[]` | `2` tačno, `'4+'` = ≥ 4 (pilule 1 · 1,5 · 2 · 2,5 · 3 · 4+) |
| `notLast` | bool | isključi poslednji sprat (`fl === tf`) |
| `co, he, fu` | slug[] | stanje / grejanje / opremljenost |
| `reg` | bool | samo uknjiženo |
| `newbuild` | bool | `co ∈ novogradnja, u-izgradnji` |
| `am` | key[] | svi navedeni dodaci (AND) |
| `agency` | ags slug | jedna agencija |
| `advertiser` | `''\|'agencija'\|'vlasnik'` | |
| `q` | string | tekst bez dijakritika, sve reči moraju da se nađu u naslovu/naselju/opštini/gradu/ref-u/adresi/agenciji |
| `deltaMax` | `number \| ''` | samo oglasi čiji je `stats.delta(l).pct ≤ X` (npr. `0` = ispod proseka, `-5`) |
| `sort` | v iz `SORTS` (+ `'pop'`) | `rel` = PREMIUM → TOP → ISTAKNUT → ostali, pa najnovije; `delta` = najbolja vrednost (najniži Δ) prvo |
| `view` | `'grid'\|'list'\|'map'` | prikaz (URL stanje, ne utiče na rezultate) |
| `page` | number ≥ 1 | strana (URL stanje) |

```js
filtersToParams(f)   // → {k: string|string[]|true} bez podrazumevanih vrednosti (za setHash / store.saveSearch)
paramsToFilters(q)   // URLSearchParams | string → kompletan objekat filtera (inverzno: paramsToFilters(new URLSearchParams(buildHash(p).split('?')[1])) ≡ f)
applyFilters(f)      // → listings[] (filtrirano + sortirano; ~1 ms za 660 oglasa, bezbedno na svaki keystroke)
countActive(f)       // → broj aktivnih filtera bez t/sort/view/page; svaki `am` se broji posebno
```
Isto je dostupno i kao `router.filtersToParams`, `router.paramsToFilters`, `router.applyFilters`, `router.countActive`, `router.FILTER_DEFAULTS`, `router.SORTS`.
Primer: `setHash('/pretraga', filtersToParams({ ...f, page: 1, c: 'beograd' }))`.

---

## Kredit i troškovi

```js
mortgage(principal, ratePct, years)      // → { monthly, total, interest, n, rate }    standardni anuitet; mortgage(100000, 5, 20).monthly === 659.96
amortization(principal, ratePct, years)  // → [{ m, balance, interest, principal }] po mesecu (sparkline u kalkulatoru)
purchaseCosts(price, {newbuild=false, agency=true, agencyRate=2})
   // → { tax, taxRate (2.5 | 10), agencyFee, agencyRate, notary, total, totalWithPrice }
   // porez na prenos apsolutnih prava 2,5 % ili PDV 10 % (novogradnja od investitora; KX.cost: 20 % za poslovni prostor); provizija 2 % (0 za vlasnika: agency:false);
   // javni beležnik po razredu: <30k 120 € · <60k 180 · <100k 250 · <150k 320 · <250k 420 · <500k 600 · ≥500k 900
rentCosts(rent, dep)                     // → { deposit (dep ?? rent), agencyFee (50 % jedne kirije), firstMonth, moveIn }
```
Linija na detalju (spec §5.9): `kredit od ${fmt.price(mortgage(l.p * 0.8, 5.2, 30).monthly, 'izdavanje')} · 20 % učešće, 30 god., 5,2 %`.

## `toast(msg, opts?) → element | null`
Renderuje u `#toasts` (kreira ga u `body` ako ne postoji), `role="status"`, auto-nestaje posle `opts.ms` (4000) uz klasu `is-out` 240 ms pre uklanjanja.
`opts.action = { label, href, onClick }` dodaje link `.toast-act`; `opts.kind` dodaje klasu (`success`/`error`). Primer: `toast('Sačuvano', { action: { label: 'Pogledaj sačuvane', href: '#/sacuvano' } })`.

---

## Legacy aliasi (samo dok se stare `js/pages/*.js` ne prepišu — **ne koristiti u novom kodu**)
`nf.format(n)`, `eur(n)`, `m2(n)`, `oglasa(n)`, `daysAgo(d)`, `roomLabel(v)`, `floorLabel(f, t)` (`'2. / 5'`), `LS = {fav:'kv.favs', theme:'kv.theme'}`, `readFav()`, `favs` (= `store.favs`), `saveFav()`,
`DEFAULTS` (stari oblik filtera), `let F`, `PROMO_RANK`, `heroArt()` (= `img.hero()`), `cityArt(slug)` (→ `<img>` string sa `img.city(slug)`, ili `img.article(slug)` za slug članka). Objekat iz `paramsToFilters` ima **ne-enumerabilne** gettere `loc`, `rooms`, `cond`, `heat`, `furn`, `promo` da stari search.js ne pukne.
`setHash(…, true)` bez `router.onChange` pretplatnika poziva globalni `render()` ako postoji (stari app.js).

## Testovi
`node dev/core.test.js` — 42 testa (formatiranje, opsezi Δ, histogram, round-trip filtera, sortiranja, brzina, ruter, kredit/troškovi, determinizam mock-a, store sa/bez localStorage, `el`, toast, legacy).

## Izmene integracije (2026-10-29)
- `stats`: novi obimi `sub` i `region`, `null` umesto `all` (vidi gore); `inScope`, `reset`, `isSuburban`, `SUBURBAN`.
- `find.reset()` — mape po slugu se grade iznova (posle dodavanja ponovljenih oglasa u `KX.enrich`).
- `mock.street / walk / hood` koriste `l.ps || l.s` (ponovljeni oglas istog stana deli ulicu, hod i komšiluk).
- Filter `promo` (bool, URL `promo=1`): samo izdvojeni oglasi (PREMIUM/TOP/ISTAKNUT).
- `paramsToFilters` zadržava sortove stranice rezultata (`total`, `monthly`, `rata`, `pair`, `near-<id>`); `applyFilters` za njih koristi `rel`.
- `store.saveSearch(name, params, {freq, n})` — učestalost obaveštenja i broj rezultata pri čuvanju.
- `toast(msg, {action:{label, onClick}})` bez `href`: klik zove `onClick`, poziva `preventDefault()` (adresa se ne menja) i zatvara obaveštenje.

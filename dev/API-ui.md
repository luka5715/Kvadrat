# Kvadrat.rs — `js/ui.js` API (dizajn sistem v1)

Referenca za inženjere stranica. Sve funkcije su **globali** (klasični `<script>`, bez modula) i vraćaju gotove DOM čvorove
izgrađene preko `el()` iz `core.js`; slike dolaze iz `img.*` (`images.js`). Vizuelna istina je `dev/index.html`
(styleguide) — svaka funkcija je tamo prikazana u svim stanjima. Spec: `scratchpad/design/SPEC.md`.
Styleguide se snima iz korena repoa (zbog `../css`, `../js`, `../data.js`): `node scratchpad/shot.js /home/user/Kvadrat <outDir> --page dev/index.html '#/'`.

## 0. Uključivanje i konvencije

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT@0,9..144,300..700,50;1,9..144,300..700,50&family=Hanken+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="css/tokens.css">
<link rel="stylesheet" href="css/base.css">
<link rel="stylesheet" href="css/components.css">
<!-- css/pages/*.css posle -->
…
<div id="app"></div>            <!-- header() + main + footer() -->
<div id="toasts" aria-live="polite"></div>   <!-- OBAVEZNO: toast() iz core.js dodaje .toast ovde -->
<script src="data.js"></script><script src="js/core.js"></script><script src="js/images.js"></script><script src="js/ui.js"></script>
```

* Redosled skripti: `data.js → core.js → images.js → ui.js → pages/*.js → app.js`. `ui.js` ne deklariše nijedan globalni
  identifikator osim izvoza (`Object.assign(window, …)` na kraju), pa se bezbedno učitava u deljeni globalni opseg.
* Zavisnosti iz `core.js` koje `ui.js` poziva: `D, el, $, hash, rng, fmt, stats, mock, store, toast, mortgage, TYPES, COND, HEAT, FURN, ORIENT, AMEN`.
  Svaki poziv je zaštićen (`S(fn, fallback)`), pa komponenta ne puca ako nešto nedostaje, ali tada gubi deo sadržaja.
* **Rute** (hash, kanonski oblici iz tabele ruta): `UI_HREF` objekat: `listing(lOrSlug) → '#/oglas?s={slug}'`, `agency(aOrSlug) → '#/agencija?s={slug}'`, `agencies`,
  `search(t,pt,c) → '#/pretraga?t=prodaja&pt=stan&c=beograd'` (prima i množinu 'stanovi'), `map '#/mapa'`, `saved '#/sacuvani'`, `compare '#/uporedi'`, `calc(l) → '#/kalkulator?s={slug}'`,
  `post '#/postavi'`, `profile '#/moja-mesta'`, `home '#/'`. Stari oblici (`#/oglas/<slug>`, `#/agencije/<slug>`, `#/prodaja/…`) preusmerava app.js. Glavna navigacija: `UI_NAV = [[href, label, basePath] …]`.
* **Opcije za izbornike** (`segmented`, `pills`, `select`, `views`): niz stavki `{ v, l, icon?, n? }` ili primitiva (`'2'`, `3`) — primitiv postaje `{v, l:String(v)}`.
* Sve interaktivne mete ≥ 40px; fokus je globalni (`:focus-visible`); sve ikone su 1,75px linije.
* Boje nikad u JS-u — samo klase; tema se menja atributom `data-theme` na `<html>` (`setTheme`).

---

## 1. Ikone, logo, tema

| Funkcija | Vraća | Napomena |
|---|---|---|
| `icon(name, size = 18, cls = '')` | `<svg class="ico [cls]" viewBox="0 0 24 24" aria-hidden>` | `size ≠ 18` postavlja `style="--ico:Npx"` (base.css ga čita). Nepoznato ime → kvadrat. |
| `icon.str(name, size, cls)` | string SVG-a | za `html:` atribute. |
| `icon.names()` | `string[]` | sva imena (≈95): `pin walk heart camera check check-circle chev-d/u/r/l x search zoom-in/out sun moon phone mail share compare menu filter grid list map star home user plus minus arrow-up/down/right/left eye info copy calendar clock building house office land garage bed bath area parking elevator balcony sofa flag external image draw locate bell trash download lock alert help sort doc school market park bus tram shop blocks euro ruler stairs fire compass bolt key dots refresh link bookmark print globe empty-search calc square`. |
| `logo()` | `<a class="logo" href="#/">` (mark + „Kvadrat“ + `<small>.rs`) | §5.30 |
| `themeToggle()` | `<button class="iconbtn theme-toggle">` | menja `data-theme` light/dark, pamti u `localStorage['kv.theme']`, sam se prefarba. |
| `setTheme('dark'|'light')`, `currentTheme()` | — / string | `currentTheme` uzima u obzir sistemsku temu. |

```js
el('button', { class: 'btn btn-secondary btn-sm' }, icon('share'), 'Podeli')
```

## 2. Zaglavlje, podnožje, donja navigacija (§4)

| Funkcija | Vraća / klase |
|---|---|
| `header(path = '/')` | `<header class="hdr">` sa skip-linkom (`.skip`, cilja `#main`), `.wrap` → `logo()`, `<nav class="nav">` (6 linkova, `aria-current="page"` po `path`), `.hdr-r` → `themeToggle()`, Sačuvano `a.iconbtn` sa `.cnt` brojem (živi `store.on`), `a.btn.btn-ink.btn-sm` „Postavi oglas“, `button.iconbtn.burger` (≤1100, otvara `sheet` meni). Na kraju header-a je i `bottomNav(path)` (`.bnav`, vidljiv ≤860). Dodaje `body.has-bnav` (padding-bottom za bnav). |
| `bottomNav(path)` | `<nav class="bnav">` (Pretraga · Mapa · Postavi · Sačuvano · Profil). Sakriva se dok je list otvoren (`body.sheet-open`) ili `body[data-bnav="off"]` (detalj oglasa sa `.cta-bar`). |
| `footer()` | `<footer class="ftr">` 4 kolone (Nekretnine / Gradovi / Kvadrat / Pomoć) + `.ftr-bot`. |

`path` je `parseHash().path` (npr. `'/prodaja/stanovi/beograd'`); aktivna je stavka čiji `basePath` je prefiks.

```js
const app = $('#app');
app.append(header(route.path), el('main', { id: 'main', class: 'wrap' }), footer());
```

## 3. Kartice oglasa (§5.3–5.5, 5.15)

| Funkcija | Vraća |
|---|---|
| `card(l, 'grid')` | `<article class="card" data-slug>` — `a.ph` (foto 4:3 + `.badges` max 2 + `.count`), `button.fav`, `.body` → `.mid` (`.street`, `.pricerow` = `.price` [+ `<s>` stara cena] + `.ctx` (`.ppm` + `.delta`), `h3 > a`, `.facts`, `.walk`) + `.foot` (`.ag` + ✓ ako `agv`, `<time>`). Kontejner: `<div class="cards">` (4→2→1 kolone) ili `.cards.cards-3` (pored bočne trake). |
| `card(l, 'list')` | `<article class="row">` — foto 200px, `.body` (street, pricerow, h3, facts, walk, foot), `.side` (`.fav` + „Detalji“ `.btn-secondary.btn-sm`). Istaknut red (hover sa mape): dodaj klasu `hl`. Kontejner `<div class="rows">`. |
| `card(l, 'compact')` | `<article class="row-c">` — 120px foto (1 oznaka), `.pricerow` (22px + ctx), h3 15px, `.street`, `.facts` u jednom redu; `.fav` apsolutno gore desno. Za telefon (≤600). |
| `skeletonCard()` | `<article class="card skel" aria-hidden>` |
| `loader()` | `<span class="loader" role="status">` (4 kvadrata; u dugmetu automatski 18px) |
| `favButton(l, extra = {})` | `<button class="fav" aria-pressed>` — toggluje `store.toggleFav`, `.pop` animacija, toast, sluša `store.on`. |

Pomoćne (deo kartice, upotrebljive samostalno):

| Funkcija | Vraća |
|---|---|
| `streetLine(l)` | `<p class="street">` pin-ikona + `MAKENZIJEVA 41 · VIDIKOVAC, RAKOVICA` (koristi `mock.street(l)`, odnosno `l.ad`). |
| `walkLine(l)` | `<p class="walk">` ili `null` ako nema POI (`mock.walk`). |
| `factsStrip(l)` | `<div class="facts">` sa `.fact` stavkama (m² · sobe · sprat; zemljište: ari · građevinsko; garaža: m² · zatvorena/parking; kuća: m² · ari · sobe). |
| `badgesFor(l, max = 2)` | `badge[]` po redosledu Top/Premium → Novogradnja → Snižena → Uknjiženo → Novo. |
| `badgeKinds(l)` | `string[]` istih vrsta. |
| `saleInfo(l)` | `{ old, pct } \| null` — deterministički mock snižene cene (≈11 % oglasa). |

```js
const grid = el('div', { class: 'cards' }, list.slice(0, 24).map((l) => card(l, 'grid')));
const phoneList = el('div', { class: 'rows' }, list.map((l) => card(l, 'compact')));
```

## 4. Oznake i Merilo (§5.6–5.9)

| Funkcija | Vraća |
|---|---|
| `badge(kind, label?)` | `<span class="badge badge-*" data-kind>`; `kind ∈ novogradnja (.badge-new) · uknjizeno (.badge-reg) · snizena (.badge-sale) · hitno (.badge-urgent) · premium/top (.badge-top) · novo (.badge-fresh) · verifikovan (.badge-verified, sa ✓) · vlasnik (osnovna)`. Nepoznat `kind` → osnovna oznaka sa tim tekstom. |
| `deltaChip(l \| {pct, ppm, label, n}, { title? })` | `<span class="delta up\|down\|flat" role="img" aria-label="…">` (nije Tab-stanica; tooltip na prelaz i dodir, pogodak 40px) glif + znak + `+9,7 %`; tooltip „9,7 % iznad proseka za Vračar (5.519 €/m²)“. Vraća **`null`** kad nema uzorka (`n < 5`) — uvek proveri. `flat` = unutar ±1,5 %. |
| `merilo(l)` | `<div class="merilo" role="img" aria-label="…">` (traka, `.med` tick, `.dot`, `.lbl`) ili `null`. Detalj oglasa. |
| `priceBlock(l)` | `<section class="priceblock">` — levo `.big` cena (+ `<s>`), `.sub` (€/m² + Δ · fiksna/nije fiksna), `.sub` kredit („kredit od 1.180 €/mes · 20 % učešće, 30 god., 5,2 % · Otvori kalkulator“) ili depozit za izdavanje, `merilo(l)`; desno `sparkline` 12 meseci iz `mock.history(l)`. |
| `amenityTags(l)` | `<div class="tags">` sa `.tag.static` (Dodatno). |

## 5. Detalj oglasa (§5.10, 5.23, 5.25, 5.29)

| Funkcija | Vraća |
|---|---|
| `keyFacts(l)` | `<dl class="keyfacts">` sa `.kf` (`dt` label, `dd` vrednost): Kvadratura, Struktura, Sobe, Sprat, Godina, Grejanje, Orijentacija, Stanje, Energetski razred, Kupatila, Parking, Lift[, Zemljište]. Prazne se preskaču. |
| `gallery(l)` | `<div class="gallery-wrap">` → `.gallery` (5 pločica desktop: `.g.main` + 4; `+N` na petoj), `.gbadges` (max 3), `.gpager` („3 / 12“, telefon), `button.all` „Sve fotografije (n)“. Klik na pločicu otvara `lightbox`. Na ≤860 postaje horizontalni carousel sa scroll-snap. |
| `lightbox(l, start = 0)` | otvara `.lightbox` (fixed, z 50) i vraća `{ close, el }`. Strelice/swipe/Esc, trakica sličica 64px. |
| `hood(l)` | `<section class="hood">` h2 „Komšiluk“, `<ul>` do 6 redova (pijaca, škola, vrtić, prevoz ×2, park, prodavnica — iz `mock.hood`), `.kraj` sa eyebrow „Kakav je kraj“. `null` bez podataka. |
| `contactCard(l)` | `<aside class="contact">` — `.who` (agencija iz `l.ags`, inače „Vlasnik“), `.rating`, `.btn-primary.btn-lg` maskirani telefon → klik otkriva, `Pošalji poruku` (otvara `modal` sa formom), `Zakaži obilazak` (otvara `sheet` sa pilulama dan/vreme), `.agent`, `.note` (kapara), `.report`. Lepljiv na desktopu; na ≤860 statičan — stavi ga inline posle `priceBlock`. |
| `ctaBar(l, { phone, onCall, onMessage })` | `<div class="cta-bar">` (Pozovi primary + Poruka secondary), vidljiv samo ≤860; kad je prisutan postavi `body[data-bnav="off"]`. |
| `photoCap({ eyebrow, title, facts, link:{href,label} })` | `<div class="cap">` gradijent natpis preko `.ph` (Oglas nedelje, projekti novogradnje). Stavi ga kao poslednje dete `.ph` (npr. `.ph.r45`, `.ph.r16`). |

Raspored detalja (iz `components.css`): `.dgrid` (1fr / 360px, 320 na ≤1100, 1 kolona ≤860) sa `.aside`; `.dmeta` (eyebrow · šifra · datum, sa `.dot` tačkama), `.dloc`, `.dstats`, `.actions`.

```js
main.append(
  crumbs([{label:'Prodaja stanova',href:'#/prodaja/stanovi'},{label:l.c,href:…},{label:l.m,href:…},{label:l.n,href:…}]),
  gallery(l),
  el('div', { class: 'dgrid' },
    el('div', {}, meta, h1, priceBlock(l), keyFacts(l), opis, hood(l), amenityTags(l)),
    el('div', { class: 'aside' }, contactCard(l))));
```

## 6. Sekcije, prazno, paginacija, mrvice, pločice, koraci (§5.16–5.20, 5.27)

| Funkcija | Vraća |
|---|---|
| `sectionHead(title, sub?, href?, linkLabel?)` | `<div class="shead">` h2 `.t-h2` + `.sub` + `a.btn.btn-link`. Sekciju obmotaj u `<section class="section">` (hairline između sekcija). |
| `empty(title, text, actionLabel, href, { primary:{label, href\|onClick}, onClick, icon })` | `<div class="empty" role="status">` 48px ikona, serif h3, pasus, `.btn-row` (secondary [+ primary]). Bez `href` akcija je dugme sa `onClick`. |
| `pager(page, pages, onPick(p), { per, perOptions=[20,40,60], onPer(n) })` | `<nav class="pager">` 44px dugmad (`button.pg` brojevi, `aria-current="page"`), „…“ elipse (`.dots`), prev/next; `per` dodaje „Po strani“ select desno. Na ≤600 ostaju samo `‹ [tekuća] / N ›` (`.cur` brojač) a „Po strani“ ostaje desno u istom redu (`margin-left:auto`) — jedan red, visina 92px, nema prelamanja. Prazan `<nav>` za `pages < 1`. Alternativa za rezultate na ≤860 (§5.17): `btn('Učitaj još', { variant:'secondary', block:true })` umesto brojeva. |
| `crumbs([{label, href}])` | `<nav class="crumbs">` sa „/“; na ≤600 prikazuje samo `‹ roditelj` (`.back`). Poslednja stavka je tekuća (`.cur`). |
| `tiles([{ v, l, delta?, xl? }])` | `<div class="tiles">` `.tile` (serif 30px `b` + 13px `span`); `delta` je čvor (npr. `deltaChip({pct, label})`); `xl` → 38–46px. Ispod ide ručno `.types` traka: `el('div',{class:'types'}, [el('a',{href},el('b',{},'388'),'stanova'),…])`. |
| `stepper(steps[], cur = 0)` | `<div class="stepper-wrap">` → `ol.stepper` (desktop: `li.done/.cur`) + `.stepper-m` („Korak 2 od 5 · Fotografije“ + 2px bar, ≤600). |

## 7. Tabovi, harmonika, dijalozi, tooltip (§5.11–5.14, 5.19)

| Funkcija | Vraća |
|---|---|
| `tabs([{ id, label, panel }], { active?, onChange(id)? })` | `<div class="tabs">` → `.tabs-ul[role=tablist]` + `.tabs-p[role=tabpanel]` (sakriveni osim aktivnog). Metoda `root.select(id)`. Strelice ←/→ menjaju tab. Na telefonu traka skroluje sa mask-fade. |
| `accordion(title, bodyNode, open = false)` | `<details class="acc">` sa `summary` (+ chevron) i `.body`. |
| `modal(title, bodyNode, { footer: [nodes], onClose })` | otvara odmah; vraća `{ el, body, close() }`. Desktop: `.backdrop` + `.modal > .panel` (`.hd` h2 + X, `.bd`, `.ft`). **Na ≤860 automatski postaje donji list.** Esc zatvara, fokus zarobljen i vraćen na okidač, `body.modal-open`. |
| `sheet(title, bodyNode, { footer, onClose })` | isto, uvek `.sheet` (`.handle`, `.hd` sa „Zatvori“, `.bd`, `.ft` gde `.btn` dobija `flex:1; height:52px`). Na desktopu dobija `.desk` (centrirani panel). Prevlačenje ručke > 80px zatvara. `body.sheet-open` sakriva `.bnav`. Grupe unutar tela: `el('div',{class:'grp'}, el('p',{class:'t'},'Sobe'), pills(…))`. |
| `tip(node, text)` | vraća isti `node` sa tooltipom (`.tip`, hover 300ms / fokus / tap). Čvor sa `role="img"` ili bez teksta dobija `aria-label`; čvor sa vidljivim tekstom dobija `aria-describedby` (ime ostaje). |
| `toast(msg)` | **iz core.js** — dodaje `.toast` u `#toasts` (fixed dole-levo / iznad bnav na telefonu). |

```js
const s = sheet('Filteri', body, { footer: [
  el('button', { class: 'btn btn-ghost', onclick: reset }, 'Obriši sve'),
  el('button', { class: 'btn btn-ink', onclick: () => { apply(); s.close(); } }, `Prikaži ${n} oglasa`) ] });
```

## 8. Grafikoni (§5.21)

| Funkcija | Vraća |
|---|---|
| `sparkline(values[], { w=420, h=110, title (string\|node), months ['2026-01',…], labels[], delta (čvor, npr. deltaChip), format(v)→string, source, aria })` | `<div class="spark">` → `.t` (naslov + Δ), `svg` (3 gridlinije, area, linija, krajnja tačka, hover crosshair + `.stip` tooltip, tastatura ←/→), `.ax` (prva · poslednja vrednost, poslednja bold), `.src`. **< 5 vrednosti → `.nodata` „Nedovoljno podataka“.** |
| `bars([{ label, value, n?, me? }], { ref:{value,label}?, format?, max? })` | `<div class="bars">` (grid label / track / vrednost + `n=…`); `me:true` = ink traka („Ovaj oglas“); `ref` crta 1px referentnu liniju kroz sve trake + `.refcap` natpis. |
| `histogram(bins:[{from,to,n}], { from?, to? })` | `<div class="histo">` 36px; metoda `root.update(from, to)` boji trake u izboru (`.on`). Koristi `stats.histogram(list, 'p', 24)`; stavi ga direktno iznad `range()`. |

## 9. Mapa (§5.22)

| Funkcija | Vraća |
|---|---|
| `pin(l, state = 'default'\|'hover'\|'selected'\|'visited', { left, top, static, onClick })` | `<button class="pin [hov|on|seen] [new]" data-slug aria-pressed>` (`.p` cena, `.s` stem). `left/top` su CSS vrednosti (`'42%'`, `'120px'`); `static:true` za prikaz u toku. Metoda `b.setState(s)`. Novogradnja automatski dobija `.new`. |
| `cluster(n, { left, top, static, onClick })` | `<button class="pin cl [lg]">` (`lg` za n ≥ 50). |
| `mapLegend()` | `<div class="legend">` sa 4 stanja — dete `.map`. |
| `pinPopover(l)` | `<div class="pin-pop" role="dialog">` 280px (foto, pricerow, h4, Detalji) — pozicionira ga strana/`map.js`. |

Kontejner mape: `<div class="map">` (bg `--map-bg`, `--r-md`); `.map .ctl` (zoom dugmad gore desno), `.map .draw` (Nacrtaj zonu gore levo), `.map .mlabel` (naziv kraja). Sinhronizacija: hover reda → `pin.setState('hover')`; hover pina → `row.classList.add('hl')`.

## 10. Agencije, poređenje, tabela (§5.24, 5.26, 5.28)

| Funkcija | Vraća |
|---|---|
| `agencyCard(a)` | `<article class="agency">` (56px `.lg` monogram iz `img.mark(a)`, `.nm` + ✓, `.sub`, `.kpi`, „Pogledaj oglase“). Kontejner `<div class="agencies">` (3→2→1). Za zaglavlje agencije koristi klasu `.lg.xl` (96px). |
| `compareTable(listings[], { onRemove(l), showSame })` | `<div class="compare-wrap">` → `table.compare` (sticky prva kolona, 240px kolone, `td.best` = `--accent-soft`, identični redovi `tr.same` sakriveni). Metoda `wrap.toggleSame(bool)`. Redovi: €/m², Δ opština, Kvadratura, Sobe, Sprat, Godina, Grejanje, Stanje, Uknjiženo, Parking, Lift, Agencija, Hod do centra. |
| `listTable(listings[], { sort, onSort(key) })` | `<div class="table-wrap">` (horizontalni scroll sa mask-fade na ≤1100) → `table.table` (Oglas · m² · Sobe · Sprat · €/m² · Δ opština · Cena · Oglašivač · ♡ · Detalji); `sort` ∈ `'a-desc' 'ppm-asc' 'p-asc' 'delta'` (+ `-desc` varijante) postavlja `aria-sort` i strelicu. |

## 11. Kontrole (§5.1–5.2, 5.31)

Dugmad su čiste klase: `.btn` + `.btn-primary | .btn-ink | .btn-secondary | .btn-ghost | .btn-link`, veličine `.btn-lg (52) / 44 / .btn-sm (40)`, `.btn-block`; `.iconbtn [.iconbtn-outline]` + `.cnt`. Tačno jedno primarno dugme po prikazu.

| Funkcija | Vraća |
|---|---|
| `segmented(opts, cur, onPick(v), o?)` | `<div class="seg">`; pilula samo kad su opcije Prodaja/Izdavanje (`prodaja`/`izdavanje`), sve ostale preklopke dobijaju `.seg.sq` (kvadrat, §9.3). `o.shape:'pill'\|'sq'` nadjačava. `root.set(v)`. |
| `titleText(l)` | naslov oglasa za prikaz: „59m²“ → „59 m²“ (kartice, redovi, tabele, pin, galerija). Stranice koje same ispisuju `l.ti` treba da koriste ovo. |
| `pills(opts, cur[] , onToggle(v, on, all[]), { single })` | `<div class="pr">` sa `button.chip[.on]` (opc. `.n` brojač, ikona); `root.set(arr)`. **Jedine pilule na sajtu.** |
| `filterChip(label, { on, n, icon, filters, chevron=true, expands, onClick })` | jedan `button.chip` (npr. „Stanovi ▾“); `filters:true` → `.chip-filters` („Filteri 4“). |
| `activeFilters([{ label, onRemove }], onClear)` | `<div class="active-filters">` „Aktivno:“ + `.tag` + „Obriši sve“; `null` za prazan niz. |
| `chip(label, onRemove?)` | `<span class="tag">` KVADRATNI tag (sa X ako je `onRemove`; `.static` bez). |
| `field(label, inputNode, hint?, { error, search })` | `<div class="fld">` (label + input + `.help[.err]`, `aria-describedby`/`aria-invalid`). Sa `search:true` → `.field` ćelija kutije za pretragu (select dobija `.sel` omot sa chevronom). |
| `select(opts, cur, onChange(value), { inline, label })` | `<select class="input select [select-inline]">` (inline = 40px bez okvira, za „Sortiraj“ / „Po strani“). |
| `check(label, checked, onChange(checked, value), { type='checkbox'\|'radio', name, value, count })` | `<label class="check">` sa `.cnt` brojem. |
| `toggle(checked, onChange(on), { label })` | `button.toggle[role=switch]`; sa `label` → `.toggle-row`. |
| `range({ min, max, step, from, to, format(v), label, onInput(from,to), onChange(from,to) })` | `<div class="range-wrap">` (`.range` sa dva `.kn` kvadratna jahača, `.fl`, `.lb` natpisi); `root.set(f,t)`, `root.get()`. Tastatura ←/→. Ispod: `.range-inputs` (2 `.input`). |
| `views(opts, cur, onPick(v))` | `<div class="views">` (Mreža · Lista · Mapa; ikone po `v`: grid/list/map). Na ≤860 samo ikone. |
| `copyButton(text\|()=>text, { outline, label })` | `button.iconbtn` → clipboard + toast. |

Kutija za pretragu (hero) je markup: `.search > .tabs-ul + form.fields > field(…,{search:true}) ×3 + .go > .btn-primary.btn-lg` (vidi styleguide). Traka rezultata: `.filterbar` (sticky `top:64px`; na ≤860 `.row1` + `.rail` sa mask-fade; `.desk` stavke se sakrivaju). Bočna traka: `.results > .frail (272px, .grp > .t) + .main`.

```js
const bar = el('div', { class: 'filterbar' },
  el('div', { class: 'row1' }, filterChip('Filteri', { filters: true, n: countActive(f), icon: 'filter', onClick: openSheet }), el('span', { class: 'sp' }), views(V, f.view, setView)),
  el('div', { class: 'rail' }, filterChip('Stanovi', { on: true }), filterChip('Beograd'), filterChip('Cena'), filterChip('Kvadratura'), filterChip('Sobe')),
  el('div', { class: 'desk' }, segmented(…)), …);
```

## 12. Klase rasporeda i tipografije (base.css) koje stranice koriste direktno

`.wrap` (1280px + safe-area gutteri) · `.wrap-text/.prose` (66ch) · `.section` (52/40px) · `.shead` · `.grid-2/3/4` · `.stack` · `.cluster` · `.rail` (horizontalna traka sa fade) · `.t-hero` (+ `<em>` za akcentnu reč) · `.t-h1` · `.t-h2` · `.t-h2s` (22px) · `.t-h3` · `.t-stat` · `.t-desc-lede` · `.lede` · `.small` · `.meta` · `.label` · `.eyebrow` · `.display` · `.num` · `.hr` · `.sr` · `.link` · `.skip` · `.ph[.r16|.r1|.r45]` (foto omot) · `.cap` · `.note-rule` (2px pine levi rub za beleške) · `.menu-list`.

## 13. Odstupanja od spec-a (namerna)

* `tip()` ne prepisuje `aria-label` na čvorovima koji imaju vidljiv tekst (koristi `aria-describedby`) — spec pominje `title/aria-label`, ali bi to pokvarilo ime dugmadi.
* Kompaktni red (`.row-c`): `.ctx` (€/m² + Δ) teče odmah iza cene i prelama se u drugi red kad ne stane u 182px (390px ekran); spec dozvoljava prelom „samo za > 7 cifara“, ali Δ čip (koji mock nije imao) to fizički ne dozvoljava.
* Δ čip „flat“ prikazuje `— ±0,4 %` (glif minus) — spec kaže `±0 %`; zadržana je jedna decimala radi doslednosti sa `.up/.down`.
* `modal()` na ≤860 postaje `sheet` (po spec-u), ali i `sheet()` na > 860 postaje centrirani panel (`.sheet.desk`) da filteri na tabletu ne vise sa dna.

## Izmene integracije (2026-10-29)
- `card(l, variant, {price, extras})` — `price`: čvor ili tekst umesto `.price`; `extras`: čvorovi na kraju `.body`.
- `saleInfo(l)` čita `KX.history(l).changes` (isto što prikazuju oglas, poređenje i filter „Snižena cena“); bez engine-a stari mock.
- `badgeKinds(l)`: „Uknjiženo“ samo kad je `KX.trust(l).legal === 'uknjizeno'` (prodaja).
- `placeLine` / `streetLine(l, {exactOnly})`: ime se ne ponavlja (naselje = opština ili = grad piše se jednom); `exactOnly` bez izmišljene ulice → „Naselje, Opština · približna lokacija“.
- Δ čip i Merilo bez padeža: „12,3 % ispod proseka · Čukarica (2.555 €/m²)“. Bez uzorka (`stats.delta(l).reason === 'malo'`) `.ppm.nodelta` dobija tooltip „Malo podataka…“.
- `header()` sadrži dugme brze pretrage (`.kv-search`, ⌘K/Ctrl+K → `KVG.palette.open()`, bez ljuske vodi na pretragu); sopstveni `.skip` samo kad stranica nema stalni `body > .kv-skip`.
- `sheet/modal`: Esc i Tab reaguju samo za najgornji dijalog i poštuju `e.defaultPrevented`. `lightbox`: Tab kruži unutar galerije.
- `tabs()`: traka dobija `is-start`/`is-end` pa maska-fade stoji samo na strani gde ima još tabova.
- `toggle(…, {label})`: klik na oznaku menja prekidač; prekidač ima nevidljiv pogodak 40 × 48 px.
- `contactCard`: agent iz `agencyAgentFor(l)` (agencies.js) kad postoji; drugi klik na broj kopira broj (umesto `tel:`).
- `tip(node, text)`: postojeći `aria-label` ostaje ime, tekst saveta ide u opis.

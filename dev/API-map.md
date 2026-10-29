# `js/map.js` — `mapView(container, opts)` i `js/pages/map.js` — `viewMap(q)`

Nacrtana mapa bez pločica: SVG tkivo grada (reka, blokovi, ulice, avenije, parkovi) generisano deterministički iz
`KV.cities` / `KV.listings` (`hash` + `rng`), HTML pinovi (§5.22) u jednom sloju koji se samo translira pri pomeranju.
Klasičan `<script>`, `'use strict'`, ES2020. Učitava se **posle** `data.js`, `core.js`, `images.js`, `ui.js`, a **pre**
`js/pages/*.js`. Stilovi: `css/pages/map.css` (komponenta `.mv` + stranica `.mp`); pin/legenda/popover su u `components.css`.

```html
<script src="js/map.js"></script>          <!-- definiše global: mapView -->
<script src="js/pages/map.js"></script>    <!-- definiše global: viewMap -->
```

Meke zavisnosti (sve kroz guard-ove, komponenta radi i bez njih): `hash`, `rng`, `fmt.price`, `store.recent`
(core.js); `pin`, `cluster`, `mapLegend`, `pinPopover`, `icon` (ui.js). Stranica dodatno: `applyFilters`,
`paramsToFilters`, `filtersToParams`, `countActive`, `setHash`, `toast`, `TYPES`, `COND`; `card`, `sheet`, `pills`,
`segmented`, `select`, `check`, `filterChip`, `chip`, `empty`; `KX.budgetMap` (engine, ako postoji).

---

## `mapView(container, opts) → api`

`container` dobija klase `map mv`, `tabindex=0`, `role=application`. Sadržaj se briše i gradi iznova.

| opts | podrazumevano | opis |
|---|---|---|
| `listings` | `[]` | oglasi sa `lat`/`lng` (ostali se ignorišu) |
| `city` | grad sa najviše oglasa | slug grada za centar projekcije |
| `selected` | `null` | slug izabranog pina |
| `mode` | `'pins'` | `'pins'` ili `'budget'` |
| `interactive` | `true` | `false` = statična mapa (bez kontrola, pomeranja, tastature) |
| `height` | — | broj (px) ili CSS vrednost; inače visina iz CSS-a |
| `drawTool` | `true` | alat „Nacrtaj zonu” (dugme + traka Završi/Poništi) |
| `drawButton` | `true` | `false` = bez sopstvenog dugmeta (stranica ima svoje, zove `api.startDraw()`), traka ostaje |
| `legend` | `true` | legenda dole-levo (`ui.mapLegend()`; u budžetu rampa m²) |
| `showAreaButton` | `true` | „Pretraži u ovom području” posle pomeranja/zuma |
| `popover` | `true` | popover izabranog pina (`ui.pinPopover(l)` + dugme ×) |
| `labels` | `true` | natpisi gradova/opština/naselja |
| `places` | `[]` | moja mesta (vidi `setPlaces`) |
| `radius` | `null` | `{lat,lng,m}` krug približne lokacije |
| `view` | — | `{lat,lng,zoom}` početni pogled umesto `fit()` |
| `budget` | — | redovi za `setBudget` kad je `mode:'budget'` |
| `onSelect(slug)` | | klik/Enter na pin (klaster → približavanje, bez poziva) |
| `onHover(slug\|null)` | | ulazak/izlazak miša na pin; u budžetu ključ opštine |
| `onBoundsChange(b)` | | posle „Pretraži u ovom području” i posle zatvaranja/brisanja zone; `b = getBounds()` + `count` kad je zona |
| `onViewChange(b)` | | ~220 ms po smirivanju svakog pomeranja/zuma (`getBounds()`) |
| `onDraw(state)` | | `'drawing'` \| `'zone'` \| `'cancel'` |
| `onArea(row)` | | klik na krug opštine u budžetu |

### api

```
setListings(list)      zameni oglase (briše zonu, ne radi fit — pozovi fit())
setSelected(slug|null) izabran pin (.on) + popover; pomera pogled ako pin nije u kadru; u budžetu ključ opštine
highlight(slug|null)   hover sinhronizacija iz liste (.hov na pinu ili klasteru koji ga sadrži)
fit(list?)             uklopi sve (ili zadate) oglase, max zum 15, 6–94. percentil bez ekstrema
fitTo(list, zmax?)     isto, sa sopstvenim max zumom
panTo(lat,lng,z?)      setView({lat,lng,zoom})   setZoom(z)   getZoom()   getView() → {lat,lng,zoom}
setMode('pins'|'budget')
setBudget(rows)        rows: [{key,label,cs,lat,lng,m2,n,ppm,scope}] — krug ∝ √m², boja ∝ m²/max, m2=0 → šupalj „malo podataka”; radi fit na redove
setPlaces(places)      [{id,name,lat,lng,who:'ja'|'partner',mode:'auto'|'gradski'|'pesice'|'bicikl'}] — krugovi 10/20/30 min
setRadius({lat,lng,m}|null)
getBounds()            {n,s,e,w,zoom,center:{lat,lng},polygon:[{lat,lng}]|null}
getVisible()           oglasi u kadru (i unutar zone)      getFiltered() oglasi unutar zone (ili svi)
startDraw() finishDraw() cancelDraw() isDrawing() clearZone() getPolygon() setPolygon([{lat,lng},…])
refresh()              ponovo rasporedi pinove i natpise
destroy()              skida slušače, prazni kontejner
el                     kontejner
mapView.shortPrice(l)  '125k' | '1,2M' | '450 €'      mapView.inPolygon(lat, lng, [{lat,lng}]) point-in-polygon
```

### Ponašanje
- **Projekcija**: ekvirektangularna oko centra grada, x skaliran sa cos(lat); jedinice sveta = px na zumu 13 (~13,5 m/px u Beogradu). Zum 11–17, korak dugmeta 1, točkić kontinualno oko kursora, dupli klik +1, pinch (dva pointera), tastatura: strelice pomeraju 60 px, `+`/`-` zum, `Esc` zatvara popover/crtanje, `Enter` završava crtanje. Inercija posle prevlačenja (ne uz `prefers-reduced-motion`).
- **Tkivo grada**: reke (Sava/Dunav, Dunav NS, Nišava…, 13 gradova — približne tačke, deklarisano kao mock), parkovi (Kalemegdan, Tašmajdan, Košutnjak, Ada, Ušće…; drugde nasumični), blokovi po sektorima sa blagim rotacijama, sekundarne ulice, 6–9 avenija iz centra + 2 polukružne obilaznice, sateliti za udaljene opštine. Sve kroz `--map-*` tokene, tamna tema automatski. Keširano po gradu.
- **Pinovi**: `ui.pin(l, state)` (fallback lokalni) sa kratkom cenom (`125k`, `1,2M`, `450 €`), stanja `default/hover/selected/visited` (`store.recent`), `.new` za novogradnju. Klasteri po mreži u px zavisnoj od zuma (46 px <13, 36 <14,5, 26 <16, 16 <17, 8 na 17); klik na klaster približava na članove. Pin sloj se ponovo gradi samo pri promeni zuma za ≥0,5 ili pomeraju > 60 % ekrana.
- **Natpisi**: grad (z<13,5), opštine (12–16), naselja (≥14,2) na centroidima oglasa; sudar sa pinovima i drugim natpisima se izbegava (5 kandidata pomeraja), pin uvek pobeđuje. U budžetu ostaju samo natpisi gradova.
- **Zona**: klik-tačke (zatvaranje klikom na prvu tačku, duplim klikom, Enter ili „Završi”) ili slobodna ruka prevlačenjem; Douglas–Peucker ≤ 40 tačaka; filtrira `point-in-polygon`; čip „Nacrtana zona · N oglasa” sa ×.
- **Performanse**: 660 oglasa, pomeranje = jedan `transform` na SVG grupi + `translate3d` na sloju pinova; ~16 ms/kadar (rAF) sa 70 pin-čvorova na z14 (Playwright, bez GPU).
- **Pristupačnost**: `aria-label` na kontejneru sa uputstvom, `aria-live` broj oglasa u prikazu, pinovi su `button` sa `aria-pressed`, fokus vidljiv, ciljevi ≥ 40 px.

---

## `viewMap(q) → HTMLElement` (ruta `#/mapa`)

`q` je `URLSearchParams` (prihvata i string = slug grada radi kompatibilnosti). Vraća `section.mp` visine
`calc(100dvh − var(--header-h))` (na telefonu minus donja navigacija). Mapa se gradi tek kad je element u dokumentu i
ima dimenzije (setTimeout 0 + provera), uništava se kad element napusti dokument (MutationObserver).

Parametri = standardni filteri core.js (`paramsToFilters`/`applyFilters`): `t`, `pt` (lista), `c` grad, `m` opštine, `n` naselja,
`pmin, pmax, amin, amax, ro (2 · 2.5 · '4+'), co, he, fu, am, reg, newbuild, q, sort…`; plus `m=budzet` (režim budžeta — tada se `m`
ne tumači kao opštine) i `b` budžet u €. Bez `c` bira se grad sa najviše oglasa za zadate filtere. URL se ažurira `history.replaceState`
bez ponovnog renderovanja (deljiv link).

- **Gornja traka**: lokacija (combobox, autocomplete nad gradovima → opštinama → naseljima, bez dijakritike, strelice/Enter/Esc),
  „Nacrtaj zonu” (menja se u „Crtam…” / „Obriši zonu”), pilula „Filteri N” (ui.sheet sa kompaktnom formom: Prodaja/Izdavanje,
  Tip, Cena, Kvadratura, Sobe, Stanje, Dodatno; živi broj „Prikaži N oglasa”; „Obriši sve”), segment Oglasi · Budžet, aktivni tagovi.
- **Fioka (≥1100)**: „N oglasa u prikazu”, do 60 `ui.card(l,'list')` redova; hover reda → pin `.hov`, hover pina → red `.hl` + scroll;
  klik reda → pin `.on`; prazno stanje kad u kadru nema oglasa.
- **Karusel (<1100)**: do 40 `ui.card(l,'compact')` kartica u scroll-snap traci; izbor pina centrira karticu, pomeranje trake bira pin.
  Visina se meri i prosleđuje legendi/razmerniku (`--mp-car`).
- **Budžet** (`m=budzet`): traka „Imaš 100.000 €? Vidi šta kupuje.” (unos, grad, klizač 30–500 k / kirija 150–2.000, linija
  „= ~94.834 € za stan (oko 5.166 € ode na porez 2,5 %, proviziju i overu)”, segment Kupujem/Iznajmljujem, „Nazad na oglase”).
  Redovi iz `KX.budgetMap(b, {t, pt, cs})` (engine; `n` ukupno, `count` u budžetu, `.net` neto), a ako engine nije učitan lokalno: po opštini
  grada sa ≥ 3 oglasa (t, pt) medijan €/m², m² = neto/medijan, broj oglasa p ≤ neto; < 3 oglasa → šupalj krug „malo podataka”; mali grad →
  jedan krug za grad. Fioka/karusel: lista krajeva po m² sa trakom; klik → `setHash('/pretraga', {t, pt:[pt], c, m:[ms], pmax: neto, sort:'p-asc'})`.
  Neto bez engine-a = (B − 45) / 1,054 (porez 2,5 % + provizija 2 % + PDV + overa ~0,5 %) — gruba procena; kirija bez odbitka.

### Mock / deklaracija za „Kako računamo”
- Tkivo grada (blokovi, ulice, parkovi bez imena) je generisano; reke i imenovani parkovi su približne koordinate (ručno unete).
- Krugovi „Moja mesta”: brzine auto 25 (NS/Niš ×1,12), gradski 18, pešice 4,5, bicikl 14 km/h, faktor zaobilaženja 1,3 — procena.
- Budžet bez engine-a: konstante troškova gore; medijane i centroidi su stvarni agregati iz oglasa.

### Test
`dev/map/index.html` (rute `#/`, `#/mapa?c=novi-sad&m=budzet`, `#/mapa?c=nis&t=izdavanje`, `#/komponenta` — goli API sa dugmadima
za setMode/setBudget/setPlaces/highlight/setSelected/setListings/setPolygon/setRadius; `window.__mapApi`). Sadrži dev-šim za
`fmt/stats/mock/store` koji je neaktivan čim ih core.js definiše — nikad ga ne kopirati u `index.html`.

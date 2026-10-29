# `js/images.js` — API proceduralnih slika

Implementira §7 dizajn-speca (placeholder „fotografije“). Klasičan `<script>`, `'use strict'`, ES2020, bez build koraka,
bez eksternih resursa. Mora se učitati **posle** `data.js` i `js/core.js` (koristi `hash`, `rng`, `D`; ako ih nema,
ima lokalnu kopiju `hash`/`rng`, a `D` je opcion).

```html
<script src="data.js"></script>
<script src="js/core.js"></script>
<script src="js/images.js"></script>   <!-- definiše globale: img, KV_CONFIG -->
```

Globali: `img` (objekat, i kao `window.img`) i `window.KV_CONFIG`.

Sve je determinističko: paleta se bira iz `hash(l.s)` (ista za ceo oglas), scena iz `hash(l.s + '#' + idx)`.
Isti slug uvek daje isti set slika; ništa se ne keširа (generisanje jedne slike traje < 1 ms).

---

## `img.src(l, idx = 0, opts) → string`

Vraća `data:image/svg+xml;utf8,…` URI (percent-enkodirani SVG; `#`, `<`, `>`, `"`, `%` i ne-ASCII su enkodirani —
bezbedno i za `src=""` i za CSS `url("…")`).

| param | tip | opis |
|---|---|---|
| `l` | listing | objekat iz `D.listings` (koristi `s`, `pt`, `im`, `ti`, `co`, `y`, `ms`, `ns`, `n`) |
| `idx` | int | redni broj fotografije, 0…`l.im-1` (veće vrednosti se ciklično mapiraju) |
| `opts.aspect` | `'4:3'` \| `'16:10'` \| `'1:1'` | isečak iste scene (`viewBox` + `preserveAspectRatio="xMidYMid slice"`). Podrazumevano `'4:3'` |
| `opts.w` | int | opciono: `width` atribut SVG korena (visina se računa iz odnosa); nema uticaja na sadržaj |

Master platno je 800×600. `16:10` = `viewBox 0 50 800 500`, `1:1` = `viewBox 100 0 600 600`.
Slika je uvek `slice`, nikad razvučena — CSS `object-fit:cover` je dodatno bezbedan.

Prosečna veličina URI-ja ≈ 8,5 KB (enterijeri 6–10 KB, fasade ≈ 10,5 KB, max ≈ 13 KB).

```js
card.querySelector('.ph').appendChild(img.el(l, 0));                 // kartica 4:3
gallery.appendChild(img.el(l, i, { aspect: '16:10', cls: 'g-img' })); // galerija
thumb.style.backgroundImage = `url("${img.src(l, i, { aspect: '1:1' })}")`;
```

## `img.el(l, idx = 0, opts) → HTMLImageElement`

Pravi `<img>` sa: `loading="lazy"`, `decoding="async"`, `width`/`height` prema odnosu
(4:3 → 800×600, 16:10 → 800×500, 1:1 → 600×600 — sprečava layout shift), `alt` (`"{naslov} — {vrsta kadra} (i/n)"`,
npr. `"Dvosoban stan 46 m² — Dnevna soba (2/6)"`), `data-kind` (naziv varijante) i `src`.

| opts | opis |
|---|---|
| `aspect` | kao kod `src` |
| `cls` | `className` |
| `alt` | eksplicitan alt (prazan string `''` je dozvoljen za dekorativne slike) |

Eksterne fotografije: ako je `KV_CONFIG.externalPhotos === true` **i** `location.hostname` se završava na `github.io`,
`src` je prvo `https://loremflickr.com/{w}/{h}/{tag}?lock={hash}` (tag `building,house` za eksterijere,
`apartment,interior` za enterijere), a na `error` se prebacuje na generisani data-URI. U artifact iframe-u i lokalno
uvek je generisani SVG. Podrazumevano `window.KV_CONFIG = { externalPhotos: false }` (može se postaviti pre učitavanja
skripte; `Object.assign` čuva postojeće ključeve).

## `img.kinds(l) → string[]`

Niz naziva varijanti dužine `max(1, l.im)`. `idx` 0 je uvek eksterijer koji odgovara `l.pt`:

| `pt` | redosled (ciklično za `im` > dužine) |
|---|---|
| `stan` | `facade, living, kitchen, bedroom, bath, balcony, entrance, facade, living` |
| `kuca` | `house, living, kitchen, bedroom, backyard, entrance, bath, house, land` |
| `vikendica` | `house, living, kitchen, bedroom, backyard, land, bath, house, living` |
| `poslovni-prostor` | `office, office-interior, entrance, office-interior, bath, office, kitchen, office-interior, balcony` |
| `zemljiste` | `land, land, land, backyard, land, …` |
| `garaza` | `garage, garage, facade, garage, entrance, …` (parni idx = garaža spolja, neparni = iznutra) |
| `soba` | `bedroom, living, facade, kitchen, bath, entrance, …` |

Srpski nazivi varijanti (za natpise/alt): `img.KIND_ALT` →
`facade: 'Fasada zgrade', house: 'Kuća spolja', living: 'Dnevna soba', kitchen: 'Kuhinja', bedroom: 'Spavaća soba',
bath: 'Kupatilo', balcony: 'Pogled sa terase', entrance: 'Ulaz u zgradu', land: 'Plac', backyard: 'Dvorište',
garage: 'Garaža', office: 'Poslovna zgrada', 'office-interior': 'Kancelarija'`.

Podvrsta fasade (`blok` / `nova` novogradnja / `stara` gradnja) bira se iz oglasa: `co` novogradnja/u-izgradnji (i lux)
→ novogradnja; `y < 1950` → stara gradnja; Novi Beograd / Blok / Cerak / Liman… → blok; ostalo po godini i rng-u.

## `img.hero() → string`

**Inline SVG string** (ne data-URI) za „Oglas nedelje“: fasada 4:5 (`viewBox 100 -140 600 750`), paleta A,
35 % upaljenih prozora, jača izmaglica. ID-jevi su prefiksirani `kvh-` da ne kolidiraju na stranici.
Ubacuje se sa `innerHTML` u `.ph` kontejner (ima `role="img"` i `aria-label`); nema `width/height` atributa,
pa se skalira po CSS-u (`.ph>svg{width:100%;height:100%}`).

## `img.city(citySlug) → string` (data-URI, 800×500 = 16:10)

Silueta grada sa prepoznatljivim motivima po slugu (Beograd: Sava + pilon Ada mosta + Hram + Genex; Novi Sad:
Petrovaradin sa satom; Subotica/Zrenjanin/Sombor/Kikinda: Gradska kuća; Zlatibor/Kopaonik: planine + brvnare;
Novi Pazar: minareti; Smederevo/Pirot/Niš: tvrđava; Bor/Pančevo: dimnjaci; banje: paviljon…). Nepoznat slug → brda + crkva.
`aria-label` je `"Silueta grada — {ime}"` ako postoji `D.cities`.

## `img.article(slug) → string` (data-URI, 800×500)

Apstraktna editorijalna ilustracija po kategoriji članka (`D.articles[].c`): `saveti` kontrolna lista,
`vodici` staza sa koracima, `trziste` stubići + linija, `kredit` koncentrični krugovi, `pravni-saveti` dokument + pečat.
Nepoznat slug → kategorija `saveti`. Veličina ≈ 2,3 KB.

## `img.mark(agency | slug) → string` (data-URI, 200×200 = 1:1)

Monogram pločica: inicijali (do 2 slova; preskače reči „Nekretnine“, „Real“, „Estate“, „Invest“, „Dom“…) u serifu
(`Fraunces, Georgia`), mirna podloga iz palete + pine detalj (ugaoni kvadrat / linija / dijagonala / okvir).
Prima objekat iz `D.agencies` ili slug. ≈ 0,6 KB. Za `.contact .ava` i `.agency` logo (56/96 px).

## Pomoćno

- `img.palette(seed) → {id:'A'|'B'|'C', name, sky, haze, wall[4], roof, glass, lit, ground, tree, vig}` — paleta za slug.
- `img.PAL` — sve tri palete.
- `img.scene(l, kind, idx) → string` — sirov SVG (800×600) određene varijante, za debug.
- `img.uri(svgString) → string` — enkoder u `data:image/svg+xml;utf8,…`.

## Stil (šta svaka slika garantuje)

- Tri filmske palete A „zlatni sat“ / B „kasno leto“ / C „svetla jesen“, niska saturacija, nebo hladno gore – toplo
  pri horizontu, sunce nisko desno; horizont eksterijera na 76 % (y=456).
- Svetlo s desne strane: leva senčena traka 12 % širine zgrade, meka senka na tlu ulevo.
- Radijalna vinjeta (0 → 35 %) + `feTurbulence` zrno na svakoj slici. Dark tema **ne** menja generator — `tokens.css`
  primenjuje `filter:brightness(.9)` na `.ph>img, .ph>svg`.
- Tačno **jedan** pine prozor (`#1F6B52` @ .95, 1,5 px `#8ED0B0` obrub, mint halo) po sceni — na glavnoj zgradi,
  nikad u gornjem redu, nikad uz upaljen prozor, iznad krošnji; u enterijerima u zgradi viđenoj kroz prozor; kupatilo
  ima mat pine prozor; plac ima isprekidani pine obris parcele; kancelarijska zgrada ima ceo pine stakleni modul.

## Napomene za stranice

- Na stranici sa 100+ karticama svaki `<img>` ima sopstveni `feTurbulence` filter; rendering je u redu (filter se
  rasterizuje na prikazanoj veličini), ali `loading="lazy"` zadržati — `img.el` ga već postavlja.
- Za `srcset`/retina ništa nije potrebno — SVG je vektorski.
- Test stranica: `dev/img/index.html` (`node scratchpad/shot.js dev/img out '#/'`) prikazuje sve varijante i
  veličine; `dev/images.html` samo preusmerava na nju.

# Kvadrat.rs

**Kvadrat.rs** je demo portal za nekretnine u Srbiji: prodaja, izdavanje i novogradnja u 34 grada.
Spaja ono najbolje sa srpskih portala (pretraga, filteri, mapa, agencije, oglasi) i dodaje ono što nijedan nema:
koliko stan **stvarno košta**, da li je cena **fer**, da li možeš da ga **priuštiš**, i da li je oglas **pouzdan**.

Sajt je statična aplikacija na jednoj stranici: čist JavaScript, bez build koraka, bez servera i bez spoljnih slika.
Sve „fotografije“, tlocrti i mape se crtaju u pregledaču. Radi na telefonu i računaru, u svetloj i tamnoj temi.

Živa verzija (kad je uključen GitHub Pages, vidi niže): <https://luka5715.github.io/Kvadrat/>

---

## Šta sve ima

### Pretraga
- Pretraga po tipu (stan, kuća, poslovni prostor, zemljište, soba, garaža, vikendica), gradu, opštini i naselju.
- **Pretraga rečima**: „dvosoban vračar do 300k“, „garsonjera kirija do 400 €“ — razume srpski, i bez dijakritika (`Ctrl K` / `⌘K` / `/`).
- Filteri: cena sa histogramom, kvadratura, sobe, sprat (nije prizemlje / nije poslednji), godina gradnje, stanje,
  pravni status, grejanje, opremljenost, kupatila, orijentacija, oprema (lift, terasa, parking…), od vlasnika, sniženo.
- Brze pretrage (čipovi sa živim brojem rezultata), sortiranje, prikaz mreža / lista / mapa.
- Cene se mogu prikazati kao **cena iz oglasa**, **ukupno sa troškovima** ili **mesečno**.
- Pametno prazno stanje: kad nema rezultata, nudi koji filter da ukloniš i koliko oglasa time dobijaš.
- **Mapa** nacrtana iz podataka (bez pločica): cene na pinovima, grupisanje, „Nacrtaj zonu“, „Pretraži u ovom području“.
- Sačuvane pretrage sa brojem novih oglasa i centrom obaveštenja (zvonce).

### Oglas
- Galerija (fotografije, **tlocrt**, mapa), ključni podaci, opis, oprema, dokumenti, uslovi zakupa.
- **Merilo**: cena po m² u odnosu na prosek opštine, sa grafikom kretanja cena u kraju za 12 meseci.
- **Koliko me stvarno košta**: porez, provizija, overa, upis, selidba — na dan kupovine, pri useljenju i mesečno.
- **Keš ili kredit**: rata, učešće i da li te banka finansira, iz tvog profila.
- **Fer cena i pregovarač**: procena iz uporedivih oglasa u blizini i argumenti za pregovor.
- **Istorija cene** i dani na oglasu; **isti stan kod više agencija** na jednom mestu, najjeftinija ponuda prva.
- **Semafor poverenja** (pravni status, rizik prevare kod zakupa) sa listom provera i linkom ka eKatastru.
- Komšiluk (škole, prevoz, pijace u minutima hoda), vreme do **mojih mesta**, lična beleška, slični oglasi.

### Alati
- **Kalkulatori**: stambeni kredit, kreditna sposobnost, troškovi kupovine, kupovina ili zakup; prikaz u EUR ili RSD.
- **Procena vrednosti** stana iz uporedivih oglasa.
- **Tržište**: cene po m² po gradovima i opštinama, promene za 12 meseci, sniženja.
- **Budžet mapa**: „Imaš 120.000 €?“ — mapa opština obojena po tome koliko kvadrata tvoj budžet kupuje.
- **Uporedi** do 4 oglasa: ko pobeđuje u kom redu i zašto.

### Nalog (sve se čuva samo u ovom pregledaču)
- Sačuvani oglasi, sačuvane pretrage, nedavno gledano, beleške.
- **Moja mesta**: posao, fakultet, vrtić — vreme putovanja se prikazuje na svakom oglasu.
- Finansijski profil (prihodi, keš, prvi stan) koji pokreće sve proračune.
- **Postavi oglas**: čarobnjak sa živim pregledom i ocenom kvaliteta oglasa; Moji oglasi.

### Sadržaj
- Agencije: imenik, profil agencije (oglasi, tim, ocene, kancelarija).
- Novogradnja: projekti investitora sa rasporedom zgrade, rokovima i cenama sa PDV-om.
- Saveti: vodiči o kupovini, kreditu, papirima i tržištu.
- Prekidač **Latinica / Ћирилица**, svetla i tamna tema, informativne stranice (privatnost, uslovi, pomoć, kontakt, prijava oglasa).

### Ono što nijedan srpski portal nema
1. **Ukupna cena** stana (porez 2,5 %, PDV u novogradnji, olakšica za prvi stan, provizija, overa, upis) — ne samo cena iz oglasa.
2. **Mogu li ovo da priuštim** — oznaka na svakoj kartici u rezultatima i filter po njoj, iz tvojih prihoda i keša (pravila NBS: 80 % / 90 % za prvi stan).
3. **Fer cena** sa uporedivim oglasima i konkretnim argumentima za pregovor.
4. **Istorija cene** i stvarni dani na oglasu (ne „obnovljen juče“).
5. **Spajanje duplikata**: isti stan kod više agencija prikazan jednom, sa svim ponudama.
6. **Semafor poverenja**: uknjiženo, u procesu, upisano po Zakonu 2025, ozakonjenje — i rizik prevare kod zakupa.
7. **Budžet mapa**: gde u gradu tvoj novac kupuje najviše kvadrata.
8. **Moja mesta**: minuti do posla i škole na svakom oglasu, za dvoje.
9. **Pretraga rečima** na srpskom.
10. **Kako računamo**: javna stranica koja za svaki broj kaže da li je iz podataka ili demo procena, i po kojoj formuli.

---

## Pokretanje lokalno

Potreban je samo Python 3 (ili bilo koji statični server).

```bash
git clone https://github.com/luka5715/Kvadrat.git
cd Kvadrat
python3 -m http.server 8000
```

Zatim otvorite <http://localhost:8000/>. Adrese su u obliku `#/pretraga?t=prodaja&pt=stan&c=beograd`.

Testovi (Node.js 18+):

```bash
node dev/core.test.js     # core.js: format, statistika, filteri, kredit, store
node dev/engine.test.js   # engine.js: troškovi, priuštivost, fer cena, duplikati, pretraga rečima
```

Galerija komponenti dizajn-sistema: <http://localhost:8000/dev/index.html>.

## Objavljivanje na GitHub Pages

1. Pošaljite kod na GitHub (`git push`), na granu koju želite da objavite (npr. `main`).
2. Na GitHub-u: **Settings → Pages → Build and deployment → Source: Deploy from a branch**.
3. Izaberite granu (`main`) i folder **`/ (root)`**, pa **Save**.
4. Posle minut-dva sajt je na `https://<korisnik>.github.io/Kvadrat/`.

Nema build koraka i nije potreban `404.html`: rute su u hash-u (`#/…`), pa svaka adresa radi i pri osvežavanju.

## Struktura projekta

```
index.html            ljuska: fontovi, CSS, #app, skripte redom zavisnosti
data.js               demo podaci: window.KV = { listings (660), cities (34), muns (124), agencies (18), articles (12) }
css/
  tokens.css          boje, tipografija, razmaci (svetla i tamna tema)
  base.css            osnova, raspored, pristupačnost
  components.css      komponente dizajn-sistema
  pages/*.css         stilovi po stranicama (home, search, listing, map, tools, account, agencies, content, shell)
js/
  core.js             podaci, DOM pomoćnici, formatiranje, statistika, store (localStorage), ruter, filteri, kredit
  images.js           generator SVG „fotografija“, tlocrta i ilustracija (deterministički)
  ui.js               komponente: kartice, oznake, galerija, tabovi, list, polja, grafikoni, pinovi…
  engine.js           KX: troškovi, priuštivost, fer cena, istorija, duplikati, poverenje, budžet mapa,
                      vreme do mesta, pretraga rečima, „Kako računamo“
  map.js              nacrtana mapa (SVG, bez pločica): pinovi, grupisanje, zum, crtanje zone, budžet režim
  pages/*.js          stranice: početna, pretraga, oglas, mapa, alati, nalog, agencije, sadržaj
  global.js           brza pretraga, fioka „Uporedi“, obaveštenja, latinica/ćirilica, „Kako računamo“, 404
  app.js              tabela ruta, iscrtavanje, pokretanje
dev/
  API-*.md            dokumentacija modula
  core.test.js, engine.test.js   testovi
  index.html          galerija komponenti; ostali folderi su radni prikazi po oblastima
```

Glavne rute: `#/` · `#/pretraga` · `#/oglas?s=…` · `#/mapa` (`?m=budzet`) · `#/agencije` · `#/agencija?s=…` ·
`#/novogradnja` · `#/projekat?s=…` · `#/saveti` · `#/savet?s=…` · `#/kalkulator` · `#/procena` · `#/trziste` ·
`#/uporedi` · `#/sacuvani` · `#/moja-mesta` · `#/postavi` · `#/kako-racunamo`.

## Šta su demo podaci

Ovo je prikaz proizvoda, ne pravi portal. **Svi oglasi, agencije, agenti, telefoni, adrese i članci su izmišljeni**
i generisani za potrebe prikaza; slučajnost u imenima ili brojevima sa stvarnim osobama i firmama nije namerna.

- **Iz podataka** (računa se iz 660 demo oglasa): cene, €/m², medijane po opštinama, poređenje sa prosekom, fer cena,
  troškovi kupovine po važećim pravilima (porez 2,5 %, PDV 10 % / 20 %, olakšica za prvi stan), rata kredita, priuštivost.
- **Demo procena** (deterministička simulacija): istorija cena i dani na oglasu, ponovljeni oglasi, pravni status,
  komšiluk i minuti hoda, pregledi i čuvanja, tarife beležnika i banaka, porez na imovinu, rokovi novogradnje,
  ocene i timovi agencija, kurs 1 € = 117,2 RSD.
- Slike su crteži generisani u pregledaču (`js/images.js`); nema pravih fotografija.
- Sačuvani oglasi, pretrage, profil i mesta čuvaju se samo u `localStorage` ovog pregledača; nema naloga ni servera.
- Poruke, pozivi, zakazivanje obilaska i objava oglasa su simulirani.

Tačan spisak (šta je stvarno, šta procena i po kojoj formuli) je na stranici **Kako računamo** (`#/kako-racunamo`).
Iznosi su informativni; za odluku o kupovini proverite podatke u eKatastru, kod banke i kod beležnika.

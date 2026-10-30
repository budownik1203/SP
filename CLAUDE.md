# Sztandary Popiołu: przekazanie projektu dla następnego AI

Ten plik jest dla modelu, który przejmie pracę nad grą. Przeczytaj go w całości przed pierwszą zmianą.
Stan na **Build 0.30** (30 października 2026).

## 1. Czym jest gra

Pixel-artowa gra dark fantasy w stylu Mount & Blade, połączona z globalną strategią. Całość działa jako
**jeden plik HTML** w przeglądarce: TypeScript skompilowany i wklejony w `index.html`. Nie ma silnika
ani zależności runtime. Grafika (sprite'y 32×40, mapa, sceny, ikony) i dźwięk (synteza Web Audio, muzyka
proceduralna) są w całości generowane kodem.

- **Mapa świata:** siatka 427×267 komórek (`WGW`, `WGH`, komórka `WCELL` = 8 px). 5 głównych frakcji
  plus nieumarli: 1 Korona Aureliańska, 2 Legion Varusa, 3 krasnoludy (Khazgrim), 4 Horda orków,
  5 Martwe Królestwo Morvatha, 6 bandyci, 7 bestie. `PLAYER_FACTION = 9` to królestwo gracza
  (tworzone w trakcie gry). Frakcje 11–15 to buntownicy (wojny domowe).
- **Bitwa:** czas rzeczywisty, do ok. 100 na stronę, bohater sterowany WASD i myszą (kierunkowe cięcia,
  blok, parowanie, łuk, konnica, kopia), rozkazy dla oddziałów 1–8, oblężenia z murami, wyrwami, drabinami,
  wieżą, taranem i trebuszem, walka w uliczkach, arena i turnieje.
- **Kampania:** najemnik → wasal → lord → król. Lenna, podatki, budowle, dyplomacja, wyprawy,
  szpiedzy, traktaty, kompani z osobistymi zadaniami, rzemiosło, obóz i podróż, choroby, reputacja,
  listy gończe, kronika. Główny wątek fabularny: relikwie i zaraza Morvatha (krucjata albo pakt z mrokiem).

Język gry, interfejsu i komunikacji z użytkownikiem: **polski**.

## 2. Użytkownik i sposób pracy

- Użytkownik pisze po polsku. Odpowiadaj po polsku, krótko i konkretnie.
- Stała dyspozycja: **„pracuj z całością, nie czekaj na mnie”, „pracuj dalej”**. Pracuj autonomicznie,
  build po buildzie, bez pytania o zgodę na kolejne kroki. Pytaj tylko, gdy decyzja jest naprawdę
  jego (np. sprzeczne wymagania).
- **Przy każdym buildzie aktualizuj ten plik (CLAUDE.md)**: stan, mapę kodu, historię, backlog, klawisze.
  Użytkownik wprost o to prosi.
- Po każdym buildzie wyślij plik i daj krótkie podsumowanie po polsku: co doszło, jak to obsłużyć
  (klawisze), co dalej.
- Decyzje projektowe zebrane są w dwóch ankietach (z odpowiedziami użytkownika) i w GDD (patrz punkt 9).
  Nie powtarzaj pytań, na które już odpowiedział.

## 3. Budowanie i wydanie

```
npx tsc -p . --noEmit      # szybkie sprawdzenie typów
python3 build.py           # kompilacja i sklejenie do dist/sztandary.html
```

`build.py` kompiluje przez `tsc` do `build/`, skleja pliki **w ustalonej kolejności** w jedną funkcję IIFE
i wkleja w miejsce `/*__GAME__*/` w `index.html`. Jeśli `const BUILD = "Build 0.N"` w `src/main.ts` ma
format `0.N`, wynik kopiuje się też do `/home/claude/buildy/Sztandary Popiołu B<N>.html`.
**Uwaga:** kopia nadpisuje plik o tym numerze, więc najpierw podbij numer `BUILD`, a dopiero potem
buduj nowy kod. Inaczej nadpiszesz wydany już build. Odtworzysz go przez
`git worktree add /tmp/x build-0.N` i build w tym katalogu.

**Nowy plik źródłowy** trzeba dopisać w dwóch miejscach: lista `order` w `build.py` i lista `files`
w `tsconfig.json`. Wszystkie pliki dzielą jeden zasięg (bez modułów i importów), a deklaracje funkcji są
wynoszone na początek (hoisting). Funkcja z pliku późniejszego może więc być wołana z wcześniejszego,
ale kod wykonywany od razu przy ładowaniu (np. `COMPANIONS.push` w `retinue.ts`) musi stać po tym,
czego używa.

**Procedura wydania** (stosowana przy każdym buildzie):
1. Podbij `BUILD` w `src/main.ts`, potem `python3 build.py`.
2. Testy regresji (punkt 6).
3. `git commit` z liniami
   `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` i
   `Claude-Session: https://claude.ai/code/session_01SkBcADfQirZfDgcVRHeGiG`
   (albo atrybucja z aktualnej sesji), potem `git tag build-0.N`.
4. Ponowna publikacja artefaktu gry narzędziem Artifact:
   `file_path: dist/sztandary.html`, `url: https://claude.ai/artifact/HWSJFEh7xhvbVMoPzZCc4i`,
   `label: "Build 0.N"`.
5. Dopisanie sekcji „## Build 0.N: …” na końcu GDD (punkt 9).
6. Wysłanie pliku z `/home/claude/buildy/` użytkownikowi i krótkie podsumowanie po polsku.

## 4. Mapa kodu (`src/`, ok. 16 tys. linii)

Kolejność sklejania: core, sprites, units, audio, battleMap, battle, herofeel, abilities, battleRender, world,
politics, skills, worldRender, ui, campaign, screens, camp, craft, siege, tactics, kingdom, intel,
renown, retinue, main.

| Plik | Zawartość |
|---|---|
| `core.ts` | paleta `PAL`, matematyka (`rr`, `chance`, `pick`, `clamp`, `hashInt`), wejście `Input` (`hit`, `held`, blokada klawiszy przeglądarki) |
| `sprites.ts` | `Look`, generator postaci 32×40 (6 klatek chodu, 4 tony cieniowania), konie, rekwizyty, portrety |
| `units.ts` | `UNITS` (drzewka 6 kultur, `TU(...)` generuje jednostki), `ARM(cut, pierce, blunt)`, `WEAPONS`, `RECRUITS`, `PLAYER_FACTION` |
| `audio.ts` | `Sfx`: efekty, instrumenty, nastroje muzyki (`MoodDef`, `MOTIF` frakcji), ambient |
| `battleMap.ts` | generowanie pól bitwy: teren, sezon, region, uliczki miasta, palisada obozu, mury |
| `battle.ts` | klasa `Battle` i `Unit`: symulacja, AI, rozkazy (`cmdMenu`, `cmdChoose`), oblężenia, `KEYDEF` (wszystkie klawisze), `resolveHit`, `damage`, `kill`, wynik |
| `herofeel.ts` | B29: walka bohaterem bez kierunków: klasy broni (`wclass`), serie ciosów (`SERIES_CUT`, `SERIES_THRUST`, `seriesNext`, `heroStartSeries`), miękkie przyciąganie (`softTarget`), obrót bohatera, rozpęd (`momentumK`), otoczenie (`backHitK`), pękanie gardy wroga (`guardBreaks`), mistrzostwo (`masteryK`, perk `mastery_<klasa>`, jeszcze nie przyznawany); B30: koniec serii (`isSeriesEnd`, `seriesEndMods`), ciężki zamach przez kilku (`cleaveCount`, `cleaveK`), uderzenie tarczą (`shieldBash`), zaparta drzewcowa (`braceTick`), postawa elit (`hasPosture`, `breakPosture`, `drawPosture`), idealny unik (`perfectDodge`), ciosy nie do zablokowania (`rollUnblockable`), zapowiedzi (`drawTelegraphs`), odbijanie strzał (`deflectArrow`), uderzenie o przeszkodę (`slamCheck`), egzekucje (`tryExecute`, klawisz kopniaka F), seria zabójstw (`heroKillStreak`), krytyki (`critRoll`) |
| `abilities.ts` | umiejętności bohatera (1–3), kule ognia (`explodeFire`) |
| `battleRender.ts` | rysowanie bitwy, noc, deszcz, mgła, tonowanie, celownik |
| `world.ts` | `World`, generowanie świata, A* (`findPath`), AI oddziałów (`partyAI`), `dailyTick`, ekonomia, `BUILDINGS`, `COMPANIONS`, `partyLimit`, `heroMaxHp` |
| `politics.ts` | wojny i pokój AI, wyprawy (kampanie), lojalność lordów, bunty, posłowie, zaraza, główny wątek |
| `skills.ts` | drzewka umiejętności (po 20 węzłów), `perk(P, k)`: suma perków, efektów przedmiotów i cech |
| `worldRender.ts` | rysowanie mapy świata (wypiekany teren, drogi, osady, oddziały, blizny po bitwach) |
| `ui.ts` | `showScr`, `toast`, ikony (`ICON_ART`, pikselowe 9×9), sceny ilustracji 400×168 |
| `campaign.ts` | `launchBattle`, `applyBattleResult`, oblężenie wygrane (`siegeWon`, tu powstaje królestwo gracza), spotkania, niewola, ucieczka |
| `screens.ts` | prawie wszystkie okna: osada (zakładki), spotkanie (`meetParty`), postać, ekwipunek, armia, frakcje, kronika, zapis (`serializeWorld`/`deserializeWorld`), po bitwie (`showAftermath`) |
| `camp.ts` | B19: zmęczenie, obóz i zadania obozowe, choroby, pole bitwy po walce, opowieści przy ognisku |
| `craft.ts` | B20: materiały, wzory, kuźnia, jakość, legendy, malowanie tarcz, trofea |
| `siege.ts` | B22: zniszczenia murów, kapitulacja, wypady, podkop, walka w uliczkach |
| `tactics.ts` | B23: pojedynek dowódców, ranni (oszczędź/dobij), pułapki, zsiadanie, ogień, pogoda, widok taktyczny |
| `kingdom.ts` | B24: okno Królestwo (U), budowy w terenie (drogi, mosty, wieże), przerzut załóg, koronacja, dwór, tytuły |
| `intel.ts` | B25: szpiedzy, intrygi, traktaty z warunkami, embargo, kompanie najemne na kontrakt |
| `renown.ts` | B26: czyny i cechy, przydomki, listy gończe i łowcy nagród, trwałe rany, cyrulik |
| `retinue.ts` | B26: 4 nowych kompanów, osobiste zadania, oddanie, dozbrajanie, nobilitacja kompana |
| `main.ts` | `BUILD`, `settings`, pętla gry, kamera i `ZOOMS`, muzyka sytuacyjna, haki testowe |

`index.html` zawiera cały CSS (pergaminowe, zniszczone okna) i szkielet HUD.

## 5. Ważne konwencje i pułapki

- **Luźne pola stanu.** Nowe dane gracza, osad i lordów trzymane są jako `(P as any).pole`,
  `(s as any).pole`, `(w as any).pole`, z leniwą inicjalizacją przez `||=`. Dzięki temu stare zapisy się
  wczytują. Rób tak samo i nie rozszerzaj interfejsów, jeśli nie musisz.
- **Zapis gry.** `serializeWorld` pomija `terr`, `road`, `nearest`, `blight` (mapa jest odtwarzana
  z ziarna). Wszystko, co zmienia te tablice w trakcie gry, trzeba odtworzyć po wczytaniu. Przykład:
  `restoreWorks(w)` nakłada zbudowane drogi i mosty. Przedmioty wykute i legendy odtwarza
  `restoreCrafted`. `MAP_VERSION = 6`: podbicie unieważnia stare zapisy (komunikat „oldmap”).
- **Efekty jako perki.** Bonusy przechodzą przez `perk(P, klucz)`
  (`P.perks` + `equipFx` + `traitFx`). W bitwie używany jest słownik `b.pk` (budowany w `launchBattle`)
  przez `this.P(klucz)`. Nowy klucz efektu działa tylko tam, gdzie ktoś go odczytuje. Sprawdź to grepem.
- **Pancerz:** mnożnik obrażeń, niższy = lepsza ochrona. Od B27 przepuszczany przez `armTune`
  (cięcie `^1.3`, obuch słabiej).
- **Klawisze** są tylko w `KEYDEF` (`battle.ts`), odczyt przez `KB("id")`. Gracz może je przemapować
  (`settings.keys`). W bitwie: LPM = seria ciosów (przytrzymanie = mocny cios), PPM = blok i parowanie,
  ŚPM = szybkie pchnięcie, PPM przytrzymany + LPM = uderzenie tarczą, Spacja = odskok, P = pauza taktyczna, Esc = menu, Y = widok z góry,
  R = tryb pchnięcia albo cięcia (zmienia serię broni kłutych), V = opuść kopię (konno), Q = rozkazy, Z/X/C/V/B = szybkie rozkazy, T/G = trebusz/okrzyk (w rozstawieniu obrony:
  pale/rów). Na mapie: U = Królestwo, C I P F K J L = okna, Spacja = obóz.
- **Teksty:** po polsku, krótko, w klimacie, bez myślników (używaj dwukropka, kropki, „·”). Zdania jak od
  narratora kroniki.
- **Wydajność:** bitwa ok. 53 FPS przy domyślnym zoomie. Nie dodawaj pracy na jednostkę na klatkę bez
  potrzeby. Nowa gra startuje 5–7 s (generowanie mapy i ścieżek dróg).
- **Walka bohatera (od B29):** kierunki ciosu zostały usunięte na życzenie użytkownika. Wewnętrznie `Dir`
  (L/R/O/T) nadal istnieje: seria broni podaje kierunki do animacji i do gardy wrogów (`d.guard === dir`).
  AI jednostek dalej losuje kierunki. Nie przywracaj sterowania kierunkiem myszą. Ustawienie `atkMode` jest
  martwe, zamiast niego `battleCam` (`fixed`/`auto`).
- **Pętle dzienne** są w `dailyTick` (`world.ts`): `campDaily`, `craftDaily`, `kingdomDaily`,
  `intelDaily`, `treatyDaily`, `bountyDaily`, `companionQuestsDaily`, `siegeDaily` (dla osad).
  Tam podpinaj nowe systemy.

## 6. Testy

Testy to skrypty Playwright (Chromium jest preinstalowany, `require('playwright')` działa bez instalacji).
Kopie w `tests/` (oryginały były w `/tmp/claude-0/t/`). Każdy otwiera
`file:///home/claude/sztandary/dist/sztandary.html`, zakłada nową grę i sprawdza swój obszar,
wypisując na końcu `errors N` (błędy strony). Uruchomienie: `node tests/b23.js`.

- Regresja po każdym buildzie: `t11` (bot gra 14 dni kampanii), `b8`, `b19`, `b22`, `b23`, `b24`,
  `b25`, `b26`, `b27`, `b29` (seria ciosów prawdziwymi kliknięciami myszy). Szybkie i najważniejsze:
  `t11`, `b23`, `b24`, `b26`, `b29`, `b30`.
- `b8`: tryb „duel” zawsze kończy się `NOAFTER` (test odnawia zdrowie bohatera, który nie atakuje), tak
  było też przed B30, to nie regresja.
- Znane niestabilności: `b8` (obrona, losowi lordowie) i `t11` (czasem timeout klikania) bywają
  niestabilne. Uruchom ponownie, zanim uznasz to za błąd.
- Haki testowe w przeglądarce: `window.__game()` (`G`, `WORLD`), `__battle()`,
  `__T` (m.in. `launchBattle`, `enterSettlement`, `showParty`, `showCharacter`, `makeCompanion`,
  `worldTick`, `spriteSheet`), `__T2` (oblężenia), `__T3` (nowe systemy B23–B27). Nowe funkcje do testów
  dopisuj do `__T3` w `main.ts`.
- Testy wizualne: zrzuty ekranu (`page.screenshot`) i obejrzenie ich narzędziem Read. Rób to dla
  każdego nowego okna i efektu.
- Długie serie testów puszczaj w tle. Nie przebudowuj `dist/` w trakcie, bo testy czytają ten plik.

## 7. Co jest zrobione (skrót historii)

B1–B18: rdzeń walki, kampania, frakcje, lordowie, oblężenia, arena, turnieje, umiejętności i drzewka,
kompani, ekonomia, główny wątek, mapa ręcznie projektowana i powiększona o 1/3 (B18).
B19 podróż i obóz · B20 ekwipunek i rzemiosło · B21 muzyka · B22 oblężenia ·
B23 nowe mechaniki bitwy · B24 królestwo · B25 dyplomacja i wywiad · B26 reputacja i kompani ·
B27 strojenie (blok jako okno czasowe, łuk, pancerz, morale, jeńcy) · B28 mapa świata bez winiety starej mapy, mgły i cieni chmur (na życzenie użytkownika: nie przywracać) ·
B29 mniej ociężałości: serie ciosów zamiast kierunków, bufor, przerwanie zamachu, szybszy obrót i zamach,
miękkie przyciąganie, rozpęd, pękanie gardy, kara za otoczenie, lżejszy pancerz, kamera auto ·
B30 koniec serii zależny od broni, ciężki zamach przez 2–3 wrogów, uderzenie tarczą, zaparta włócznia
zrzuca jeźdźców, pasek postawy elit, oficerów i lordów, idealny unik, zapowiedzi i ciosy nie do zablokowania,
odbijanie strzał parowaniem, uderzenie o przeszkodę, egzekucje (F), seria zabójstw, krytyki, więcej ćwiartowania.
Szczegóły każdego buildu są w GDD.

## 8. Co dalej (backlog z ankiet, kolejność według priorytetów użytkownika)

**Najpierw dokończ walkę bohaterem** (ankiety „Frajda z walki” i „Walka bohaterem”, odpowiedzi streszczone
w GDD; użytkownik prosi, by traktować je jako kierunek: realizm i ciężar zostają, bez zręcznościowych
skrajności, bez epickich finiszerów):

a. ~~Serie broni, koniec serii, ciężki zamach przez kilku~~ (zrobione w B29–B30). Zostało: widoczne
   wgniecenie hełmu po ogłuszeniu obuchem (flaga `dented` jest ustawiana, rysowanie brak).
b. ~~Uderzenie tarczą, zaparta drzewcowa~~ (B30). Zostało: ściana tarcz bohatera z oddziałem w szeregu.
c. **Czucie trafienia:** ~~odrzut na przeszkodę, egzekucje, seria zabójstw, krytyki, więcej ćwiartowania~~
   (B30). Zostało: wgniecione hełmy i rozdarte tuniki rysowane na wrogach w trakcie walki, więcej krwi
   na bohaterze, prawdziwe leżenie powalonych (teraz to długie ogłuszenie).
d. **Obrona:** ~~pasek postawy elit, oficerów i lordów~~ (B30: tier 5+, dowódcy, jednostki z umiejętnością);
   ~~idealny unik, zapowiedzi, ciosy nie do zablokowania, odbijanie strzał~~ (B30). Zostało: mistrzowskie
   uderzenie jako ulepszenie z mistrzostwa.
e. **Umiejętności:** 5 slotów (3 z drzewek, 1 z broni, 1 rzutka); źródła: drzewka, mistrzostwo broni,
   runy wkute w kuźni, dary świętych, starych bogów i duchów przodków, Morvath przy spaczeniu, z ukrytymi
   parami-synergiami; płatność: odnowienie, wytrzymałość, wiara lub mana. Rzutki zamiast drugiej broni,
   1 + 3 podniesione z ziemi. Szał jako umiejętność (szybciej i mocniej, bez ogłuszeń, okrzyk).
   Ruch specjalny każdej klasy broni. Cios z odskoku i łańcuch odskoków z drzewek. Cios obrotowy tylko
   dwuręczną.
f. **Mistrzostwo broni:** rośnie od trafień i z ćwiczeń (obóz, arena); daje ruch specjalny, krótszy
   zamach, szersze okno parowania, dłuższą serię; nauczyciele w miastach i zamkach.
g. **Lordowie** o 10–15% więksi, z gwardią i chorążym; cechy w bitwie (odważny, ostrożny, okrutny,
   honorowy i kilka innych); bestie z wzorcami ataków (wilk olbrzym, troll i ogr, upiór, abominacja).
h. **Konno:** szarża przewraca piechotę poza tarczownikami w szyku, broń drzewcowa zrzuca jeźdźca, cięcie
   z konia mocniejsze przy prędkości, koń może się przewrócić (bohater spada, ogłuszony).

Potem reszta backlogu:

1. **Konie** (po walce, decyzja użytkownika): rasy i hodowla, nazwany koń z rozwojem (częściowo jest: `horseInfo`), wierzchowce ras
   (np. dziki dla orków), tabory (wozy: udźwig, szybkość).
2. **Turnieje i rozrywki:** kusza, zapasy, zakłady, gry w karczmie, festyny.
3. **Treść jednostek:** drzewka do 6 poziomów z harcownikami, konnymi łucznikami, dwuręcznymi
   topornikami, procarzami, kapłanami i medykami; specjalności lenn; nazwani weterani; jednostki zakonne;
   egzotyczni najemnicy (częściowo są: kompanie B25).
4. **Nowe zadania:** wieś (zaginione dziecko, potwór z bagien, spór sąsiadów, bydło, ochrona wesela
   albo pogrzebu), miasto (przemytnicy, kupiec na jarmarku, morderca, dostawa na czas), lord (zdobycie
   sztandaru, zastraszenie wsi, odbicie zakładnika, pojedynek w jego imieniu).
5. **Wielkie wydarzenia świata:** głód, kometa i fanatycy, walka o tron, pożar miasta, powódź.
6. **Nowe miejsca:** kopalnie, klasztory, nawiedzone pobojowiska, wieże magów, kurhany; lochy mieszane;
   miejsca się odnawiają; bez kryjówki gracza.
7. **Przedmioty:** halabardy, cepy, szable, kusze, egzotyki; brygantyna, futra, zbroje kapłańskie,
   hełmy z przyłbicą; towary (wino, sól, przyprawy, konie, bydło, relikwie, rudy); materiały bojowe
   (bomby ogniowe i dymne, mikstury, sieci i bola, pawęże); slot amuletu; księgi i mapy.
8. **Życie mapy:** pielgrzymi, uchodźcy, łowcy nagród (są od B26), kupcy i kuglarze, pasterze, zwierzęta;
   mniej karawan nocą; wieści docierają z opóźnieniem.
9. **Grywalni nieumarli:** start w krypcie albo pakt; wskrzeszanie, nekropolia, **sale tworzenia**
   (części ciał z kurhanów, cmentarzy i pobojowisk składane przy stole w abominacje według schematów
   albo eksperymentu, np. zombie-ogr); płacenie duszami; żywi zamykają bramy; słońce i święta ziemia
   osłabiają; zaraza jako broń.
10. **Kampania ok. 100 h:** wyraźne etapy najemnik → wasal → lord → król; najazd z zewnątrz, gdy ktoś
    zjednoczy pół krainy; gra po końcu; więcej slotów i zapis do pliku.
11. **UI:** filtry minimapy, statystyki kampanii, kronika jako księga. Bez pada i bez samouczka.
12. **Technika:** zapis i wczytanie z pliku, tryb niskiej jakości, wersja angielska (później),
    docelowo wersja do pobrania (Steam). **Nie chce:** multiplayera, modów, edytora, starzenia się
    postaci, nowych wiosek, przestępczości w miastach, formacji (brak odpowiedzi).
13. Odłożone: scena polowania z łukiem (z B19).

## 9. Dokumenty i zasoby

- **GDD** (Claude Docs, rozpisany build po buildzie): projekt `73254690-6f75-4236-9037-f04c60d9433c`,
  węzeł dokumentu `b2141551-b502`. Nową sekcję dopisuj przez `mcp__Claude_Docs__update` z
  `engine: "prose"` i operacją `insert` na końcu (`target: {kind: "root"}, side: "end"`,
  `source: {from: {kind: "inline", content}, as: "markdown"}`). Długie treści dziel na 2–3 wywołania,
  bo za długi JSON nie przechodzi.
- **Artefakt gry:** https://claude.ai/artifact/HWSJFEh7xhvbVMoPzZCc4i
- **Ankiety z odpowiedziami:** „Dalszy rozwój” (https://claude.ai/artifact/Vv482bPRFmHitQ24d7eXQF)
  i „Mechaniki i treść” (https://claude.ai/artifact/NQSzHiT8jpKtJehWsvGErJ). Odpowiedzi są streszczone
  w GDD i w punkcie 8.
- **Wydane buildy:** `/home/claude/buildy/Sztandary Popiołu B<N>.html`; tagi git `build-0.N`.

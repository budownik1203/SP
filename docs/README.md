# Dokumentacja projektu Sztandary Popiołu

- `GDD.md`: dokument projektowy (eksport z Claude Docs), rozpisany build po buildzie, z decyzjami z ankiet.
- `ankiety/`: interaktywne ankiety HTML (do otwarcia w przeglądarce) i ich pytania (`q*.js`):
  `ankieta.html` (wczesne rundy), `dopracowanie.html`, `ankieta17.html` (Dalszy rozwój),
  `ankieta18.html` (Mechaniki i treść), `ankieta19.html` (Frajda z walki), `ankieta20.html` (Walka bohaterem, realizm).
- `odpowiedzi/`: odpowiedzi użytkownika na wszystkie ankiety, w kolejności chronologicznej
  (01–03 rundy projektowe, 04 krok B4, 05–07 dopracowania B7/B8, 08 dalszy rozwój, 09 mechaniki i treść,
  10–11 walka bohaterem). To główne źródło decyzji projektowych.
- `szkice/`: robocze szkice kodu (rysowanie postaci, ikony) użyte przy wczesnych buildach.
- `obrazy/`: zrzut ekranu przesłany przez użytkownika.

Wydane buildy (pojedyncze pliki HTML do uruchomienia w przeglądarce) są w `../releases/`.
Testy Playwright: `../tests/` (aktualne regresyjne opisane w `../CLAUDE.md`, reszta to archiwum starszych testów).

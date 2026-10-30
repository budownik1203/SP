# Sztandary Popiołu

Pixel-artowa wojenna piaskownica dark fantasy: Mount & Blade połączone z globalną strategią.

## Stan
Build 0.27. Pełny opis projektu, kodu, procedur i planów: zobacz `CLAUDE.md`.

## Budowanie
Wymaga TypeScript (`tsc`) i Pythona 3.

    python3 build.py

Wynik: `dist/sztandary.html` (jeden plik, uruchamiany w przeglądarce).

## Struktura
- `src/core.ts` – paleta, matematyka, wejście, dźwięk generowany
- `src/sprites.ts` – postacie i otoczenie rysowane kodem
- `src/units.ts` – dane jednostek i broni
- `src/battle.ts` – symulacja bitwy, AI, rozkazy, rysowanie
- `src/main.ts` – pętla gry i interfejs

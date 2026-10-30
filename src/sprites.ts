// Grafika rysowana kodem (Build B4). Postacie 24×32 z warstwami: sylwetka, twarz, hełm, zbroja, tabard, oporządzenie, brud i krew.
// Kierunki: 0 = w dół, 1 = w górę, 2 = w bok (prawo; lewo to odbicie). Klatki: 0–3 chód (0 to też postój).

type Race = "human" | "dwarf" | "orc" | "skel" | "ghoul" | "dk" | "necro" | "wolf";
type Helm = "none" | "nasal" | "kettle" | "great" | "coif" | "hood" | "crest" | "orc" | "dwarf" | "cap" | "mitre" | "rustcap";
type BodyMat = "mail" | "plate" | "leather" | "gambeson" | "rags" | "robe" | "bones";
type Pattern = "stripe" | "quarter" | "chevron" | "cross" | "plain";

interface Look {
  race: Race;
  build: number;              // 0 chudy, 1 zwykły, 2 gruby
  tall: boolean;
  skin: [string, string];
  hair: string;
  beard: number;              // 0 brak, 1 krótka, 2 długa, 3 zaplatana (krasnoludy)
  scar: number;               // 0 brak, 1 policzek, 2 przez nos
  helm: Helm;
  body: BodyMat;
  tabard: { main: string; shade: string; trim: string; pattern: Pattern } | null;
  cape?: [string, string];
  hood?: [string, string];
  pants: string;
  boots: string;
  quiver?: boolean;
  scabbard?: boolean;
  dirt: number;               // 0..1 błoto na dole
  blood: number;              // 0..1 plamy krwi
  seed: number;
  plume?: string;             // pióropusz na hełmie (kolor)
  hairStyle?: number;         // 0 krótkie, 1 łysy, 2 długie, 3 irokez, 4 warkocze, 5 kucyk
  eyes?: string;              // kolor tęczówek
  paint?: number;             // malunek: 0 brak, 1 pas przez oczy, 2 kreski na policzkach, 3 czaszka
  culture?: string;           // kształty hełmów, tarcz i płaszczy zależne od kultury
  rust?: number;              // 0..1 rdza na stali (zużycie przedmiotu)
  dents?: number;             // liczba wgnieceń
  stubble?: number;           // 0..1 zarost (portret)
  tired?: number;             // 0..1 zmęczenie (portret)
  bscars?: number;            // świeże blizny z bitew (portret)
}
interface Rig { sy: number; sx: number; arm: number; sleeve: string; sleeveD: string; hand: string; }
interface SpriteSet { frames: HTMLCanvasElement[][]; white: HTMLCanvasElement[][]; headless: HTMLCanvasElement[]; w: number; h: number; headY: number; bare?: HTMLCanvasElement[][]; bareWhite?: HTMLCanvasElement[][]; rig?: Rig; }

function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function hashInt(n: number) { n = Math.imul(n ^ 0x45d9f3b, 0x45d9f3b); n ^= n >>> 16; n = Math.imul(n, 0x45d9f3b); n ^= n >>> 16; return n >>> 0; }
function vpick<T>(v: number, salt: number, arr: T[]): T { return arr[hashInt(v * 31 + salt * 977) % arr.length]; }
function vrand(v: number, salt: number) { return (hashInt(v * 131 + salt * 7919) % 10000) / 10000; }

// Bufor pikseli z prostymi operacjami. Kolory jako "#rrggbb".
class Pix {
  w: number; h: number;
  px: (string | null)[];
  constructor(w: number, h: number) { this.w = w; this.h = h; this.px = new Array(w * h).fill(null); }
  p(x: number, y: number, c: string | null) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < this.w && y < this.h) this.px[y * this.w + x] = c; }
  r(x: number, y: number, w: number, h: number, c: string | null) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.p(x + i, y + j, c); }
  get(x: number, y: number) { return x >= 0 && y >= 0 && x < this.w && y < this.h ? this.px[y * this.w + x] : null; }
  has(x: number, y: number) { return !!this.get(x, y); }
  line(x0: number, y0: number, x1: number, y1: number, c: string) {
    x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (let i = 0; i < 64; i++) { this.p(x0, y0, c); if (x0 === x1 && y0 === y1) break; const e2 = 2 * err; if (e2 >= dy) { err += dy; x0 += sx; } if (e2 <= dx) { err += dx; y0 += sy; } }
  }
  // Nadpisz tylko piksele, które już coś zawierają (np. brud na tkaninie).
  over(x: number, y: number, c: string) { if (this.has(x, y)) this.p(x, y, c); }
  toCanvas(shade = true, outline = true): HTMLCanvasElement {
    const [c, g] = mkCanvas(this.w, this.h);
    const im = g.createImageData(this.w, this.h);
    const d = im.data;
    const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
      const col = this.px[y * this.w + x];
      if (!col) continue;
      let [r, gg, b] = rgb(col);
      if (shade) {
        // światło z lewej góry, cieniowanie w 4 tonach: blask, ton bazowy, półcień, głęboki cień
        let f = 1;
        if (!this.has(x - 1, y) || !this.has(x, y - 1)) f = 1.17;
        if (!this.has(x + 1, y)) f = 0.68;
        else if (!this.has(x, y + 1)) f = 0.8;
        else if (!this.has(x + 2, y)) f = 0.87;
        f *= 1.05 - (y / this.h) * 0.1;   // góra postaci jaśniejsza
        r = Math.min(255, r * f); gg = Math.min(255, gg * f); b = Math.min(255, b * f);
      }
      const k = (y * this.w + x) * 4;
      d[k] = r; d[k + 1] = gg; d[k + 2] = b; d[k + 3] = 255;
    }
    if (outline) {
      // obrys zależny od światła: po oświetlonej stronie ciepły brąz, po cienistej prawie czerń
      const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < this.w && y < this.h && !!this.px[y * this.w + x];
      for (let y = 0; y < this.h; y++) for (let x = 0; x < this.w; x++) {
        if (solid(x, y)) continue;
        const lit = solid(x + 1, y) || solid(x, y + 1), dark = solid(x - 1, y) || solid(x, y - 1);
        if (!lit && !dark) continue;
        const k = (y * this.w + x) * 4;
        if (dark) { d[k] = 10; d[k + 1] = 9; d[k + 2] = 8; d[k + 3] = 245; }
        else { d[k] = 38; d[k + 1] = 30; d[k + 2] = 22; d[k + 3] = 225; }
      }
    }
    g.putImageData(im, 0, 0);
    return c;
  }
}

function whiteOf(c: HTMLCanvasElement) {
  const [w, g] = mkCanvas(c.width, c.height);
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#f4ead6"; g.fillRect(0, 0, c.width, c.height);
  return w;
}

// ---------- Wymiary ras (Build 0.17: płótno 32×40, stopy w wierszu 38) ----------
const SPR_W = 32, SPR_H = 40, ANK = 36;
// Chód w 6 klatkach (1–6), 0 to postój. Krok w bok i podskok w fazie przenoszenia nogi.
const WALK_ST = [0, 0, 1, 2, 0, -1, -2];
function walkBob(f: number) { return f === 1 || f === 4 ? -1 : 0; }
interface Frame { cx: number; headTop: number; headW: number; headH: number; top: number; bot: number; hw: number; legW: number; legGap: number; }
function frameOf(L: Look): Frame {
  const t = L.tall ? -1 : 0;
  if (L.race === "dwarf") return { cx: 16, headTop: 12, headW: 8, headH: 8, top: 21, bot: 31, hw: 7 + (L.build === 2 ? 1 : 0), legW: 4, legGap: 1 };
  if (L.race === "orc") return { cx: 16, headTop: 5, headW: 8, headH: 8, top: 14, bot: 27, hw: 7 + (L.build === 2 ? 1 : 0), legW: 4, legGap: 1 };
  return { cx: 16, headTop: 6 + t, headW: 6, headH: 8, top: 15 + t, bot: 28 + t, hw: [5, 6, 7][L.build], legW: L.build === 2 ? 4 : 3, legGap: L.build === 2 ? 2 : 1 };
}

// ---------- Materiały ----------
function matColor(L: Look, x: number, y: number, top: number, shadeRight = false): string {
  switch (L.body) {
    case "mail": {   // kolczuga: rzędy kółek przesunięte co wiersz, błysk co kilka oczek
      const row = (y - top) % 2, k = (x + row) % 2;
      if (k === 0 && (x * 3 + y * 5) % 7 === 0) return PAL.steelL;
      return k === 0 ? PAL.steel : PAL.steelD;
    }
    case "plate": {
      if ((y - top) % 4 === 3) return PAL.steelD;
      return shadeRight ? PAL.steelD : PAL.steel;
    }
    case "leather": return (y - top) % 5 === 4 ? PAL.woodD : (x + y) % 6 === 0 ? PAL.dirtL : PAL.dirt;
    case "gambeson": return x % 3 === 0 ? PAL.ash : (y - top) % 4 === 2 && x % 3 === 1 ? PAL.ash : PAL.bone;   // pikowanie
    case "rags": return (x * 7 + y * 3) % 5 === 0 ? PAL.dirtD : (x * 5 + y) % 11 === 0 ? PAL.woodD : PAL.dirt;
    case "robe": return L.hood ? L.hood[0] : PAL.dusk;
    default: return PAL.bone;
  }
}
const STEEL_SET = new Set([PAL.steel, PAL.steelD, PAL.steelL]);

// ---------- Ludzie, krasnoludy, orkowie ----------
function drawMan(L: Look, dir: number, frame: number, headless = false, noArms = false): HTMLCanvasElement {
  const P = new Pix(SPR_W, SPR_H);
  const F = frameOf(L);
  const { cx, top, bot, hw } = F;
  const bob = walkBob(frame);
  const ht = F.headTop + bob, tp = top + bob, bt = bot + bob;
  const seed = L.seed;
  const orc = L.race === "orc", dwarf = L.race === "dwarf";
  const robe = L.body === "robe";
  const cul = L.culture || "";
  const wear = clamp((L.dirt || 0) * 0.7 + (L.rust || 0) * 0.5, 0, 1);
  // długość płaszcza zależy od kultury: legion krótki, Aurelia do kostek
  const capeEnd = cul === "varus" ? bt + 3 : cul === "aurelia" ? ANK + 1 : bt + 7;

  // peleryna z tyłu (widok z przodu i z boku)
  if (L.cape && dir !== 1) {
    if (dir === 0) { for (let y = tp + 1; y <= capeEnd - 1; y++) { P.p(cx - hw - 2, y, L.cape[1]); P.p(cx + hw + 1, y, L.cape[1]); } }
    else for (let y = tp; y <= capeEnd; y++) { const ragged = y > capeEnd - 2 && vrand(seed, y * 3) < 0.5; P.r(cx - hw, y, 3, 1, ragged ? null : y % 4 === 0 ? L.cape[1] : L.cape[0]); }
  }
  // kołczan na plecach (widok z boku: za plecami)
  if (L.quiver && dir === 2) { P.r(cx - 6, tp - 2, 3, 11, PAL.woodD); P.r(cx - 6, tp + 2, 3, 1, PAL.dirtL); P.r(cx - 6, tp - 3, 3, 1, PAL.bone); P.p(cx - 5, tp - 4, PAL.white); P.p(cx - 6, tp - 4, PAL.redL); }

  // ---- nogi ----
  const legTop = bt + 1;
  if (!robe) {
    if (dir === 2) {
      const st = WALK_ST[frame];
      const legs = [{ x: cx - 2 - st, c: PAL.dirtD, b: PAL.black }, { x: cx - 1 + st, c: L.pants, b: L.boots }];
      for (const lg of legs) {
        P.r(lg.x, legTop, F.legW - 1, ANK - legTop, lg.c);
        P.p(lg.x, legTop + Math.floor((ANK - legTop) / 2), PAL.dirtD);                 // kolano
        P.r(lg.x, ANK, F.legW, 3, lg.b); P.p(lg.x + F.legW, 38, lg.b);
        P.r(lg.x, ANK, F.legW, 1, PAL.dirtD);                                          // cholewa
      }
    } else {
      for (let side = 0; side < 2; side++) {
        const lift = ((frame === 1 || frame === 2) && side === 0) || ((frame === 4 || frame === 5) && side === 1) ? 1 : 0;
        const x0 = side === 0 ? cx - F.legGap - F.legW : cx + F.legGap;
        P.r(x0, legTop, F.legW, ANK - legTop - lift, L.pants);
        P.r(x0 + (side === 0 ? 0 : F.legW - 1), legTop, 1, ANK - legTop - lift, side === 0 ? L.pants : PAL.dirtD);
        // owijacze / przeszycia na łydce
        if (!dwarf) for (let y = legTop + 3; y < ANK - lift; y += 2) P.p(x0 + (y % 4 === 0 ? 0 : F.legW - 1), y, PAL.dirtD);
        P.r(x0 - (side === 0 ? 1 : 0), ANK - lift, F.legW + 1, 3, L.boots);
        P.r(x0 - (side === 0 ? 1 : 0), ANK - lift, F.legW + 1, 1, PAL.dirtD);
        P.p(x0 + (side === 0 ? 0 : F.legW - 1), ANK + 1 - lift, PAL.goldD);            // sprzączka buta
        if (L.body === "plate") { P.p(x0 + 1, legTop + 3, PAL.steelL); P.r(x0, legTop + 4, F.legW, 1, PAL.steel); P.r(x0, legTop + 5, F.legW, 1, PAL.steelD); }   // nakolanniki
      }
    }
  }

  // ---- tułów ----
  const tw = dir === 2 ? hw - 1 : hw;
  const bx0 = dir === 2 ? cx - tw : cx - hw;
  const bx1 = dir === 2 ? cx + tw - 1 : cx + hw - 1;
  const bodyBot = robe ? 38 : bt;
  for (let y = tp; y <= bodyBot; y++) for (let x = bx0; x <= bx1; x++) {
    if (y === tp && (x === bx0 || x === bx1)) continue;
    if (robe && y > 36 && vrand(seed, x * 11 + y) < 0.3) continue;
    P.p(x, y, matColor(L, x, y, tp, x === bx1));
  }
  // nity i krawędzie płyt
  if (L.body === "plate") {
    for (let y = tp + 1; y < bodyBot; y++) P.p(bx0 + 1, y, PAL.steelL);
    P.p(cx - 1, tp + 2, PAL.steelL); P.p(cx, tp + 6, PAL.boneHi);
    for (let y = tp + 3; y < bodyBot; y += 4) { P.p(bx0 + 2, y, PAL.boneHi); P.p(bx1 - 1, y, PAL.steelL); }
    if (dir !== 1) P.r(cx, tp + 1, 1, bodyBot - tp - 2, PAL.steelD);                     // grzbiet napierśnika
  }
  if (L.body === "mail" && dir !== 1) P.r(bx0, bodyBot, bx1 - bx0 + 1, 1, PAL.steelD);   // obrąbek kolczugi
  if (L.body === "leather") {
    for (let y = tp + 2; y < bodyBot; y += 5) { P.p(bx0 + 1, y, PAL.goldD); P.p(bx1 - 1, y, PAL.goldD); }   // nity na skórze
    P.r(bx0, tp, bx1 - bx0 + 1, 1, PAL.woodD);
  }
  if (L.body === "rags") { P.r(bx0 + 1, tp + 4, 2, 2, PAL.woodD); P.p(bx1 - 2, tp + 9, PAL.dirtL); P.p(bx1 - 1, tp + 9, PAL.dirtL); }   // łaty
  if (orc && L.body === "leather") { P.line(bx0, tp + 1, bx1, tp + 9, PAL.woodD); P.r(cx - 1, tp + 4, 3, 3, PAL.bone); P.p(cx, tp + 5, PAL.black); }   // pas krzyżowy z czaszką
  if (robe) { for (let y = tp; y <= 38; y++) { P.p(bx0 - 1, y, L.hood ? L.hood[1] : PAL.ink); } P.r(bx0, tp + 9, bx1 - bx0 + 1, 1, PAL.bone); P.p(cx, tp + 10, PAL.bone); P.p(cx, tp + 12, PAL.bone); }   // sznur z frędzlem
  // naramienniki: kształt zależny od kultury
  if (dir !== 2) {
    const sh = L.body === "plate" ? PAL.steelL : matColor(L, bx0, tp, tp), sh2 = L.body === "plate" ? PAL.steel : matColor(L, bx1, tp, tp, true);
    const big = L.body === "plate" || cul === "varus" ? 3 : 2;
    P.r(bx0 - 1, tp, 2, big, sh); P.r(bx1, tp, 2, big, sh2);
    if (cul === "varus" && L.body !== "rags") { for (let k = 0; k < 3; k++) { P.p(bx0 - 1, tp + k * 2, PAL.steelL); P.p(bx1 + 1, tp + k * 2, PAL.steelD); } }   // segmenty jak lorica
  }
  // futrzany kołnierz orków i krasnoludów
  if ((orc || dwarf) && L.body !== "robe" && dir !== 1) {
    const fur = orc ? PAL.dirtL : PAL.woodD;
    for (let x = bx0 - 1; x <= bx1 + 1; x++) { P.p(x, tp - 1 + (x % 2), fur); if (x % 3 === 0) P.p(x, tp + 1, orc ? PAL.bone : PAL.dirtL); }
  }

  // tabard: postrzępiony dół, wzór herbu, brud i krew
  if (L.tabard && !robe) {
    const T = L.tabard;
    const tx0 = dir === 2 ? cx - tw + 1 : cx - hw + 1, tx1 = dir === 2 ? cx + tw - 2 : cx + hw - 2;
    const ty0 = tp + 1, ty1 = bt + (cul === "aurelia" ? 5 : 3);
    const mid = Math.floor((ty0 + ty1) / 2) - 1;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      if (y >= ty1 - 1 && vrand(seed, x * 37 + y) < (y === ty1 ? 0.45 : 0.18) + wear * 0.15) continue;   // poszarpany brzeg
      let c = x === tx1 ? T.shade : T.main;
      if (dir !== 1) {
        const rx = x - cx + 0.5;
        if (T.pattern === "stripe" && Math.abs(rx) < 1) c = T.trim;
        if (T.pattern === "quarter" && ((x < cx) !== (y < mid))) c = T.trim;
        if (T.pattern === "chevron" && Math.floor(Math.abs(rx)) === y - ty0 - 1) c = T.trim;
        if (T.pattern === "cross" && (Math.abs(rx) < 1 || y === ty0 + 4)) c = T.trim;
      }
      // przetarcia: wypłowiałe plamy na starym płótnie
      if (wear > 0.3 && vrand(seed, x * 53 + y * 7) < wear * 0.12) c = PAL.dirtL;
      P.p(x, y, c);
    }
    if (cul === "aurelia" && dir !== 1) P.r(tx0, ty0, tx1 - tx0 + 1, 1, T.trim);       // złota lamówka
  }
  // pas, klamra, sakwa, rzemień przez pierś
  if (!robe) {
    const belt = tp + Math.round((bt - tp) * 0.62);
    P.r(bx0, belt, bx1 - bx0 + 1, 1, PAL.woodD);
    if (dir !== 1) { P.r(cx - 1, belt, 2, 1, PAL.goldD); P.p(cx - 1, belt, PAL.gold); }
    if (dir === 0) { P.r(bx1 - 2, belt + 1, 3, 3, PAL.dirtL); P.r(bx1 - 2, belt + 1, 3, 1, PAL.dirt); P.p(bx1 - 1, belt + 2, PAL.goldD); }   // sakwa z klamerką
    if (dir === 0 && bx0 + 2 < bx1 - 3) P.p(bx0 + 1, belt + 1, PAL.bone);              // nóż przy pasie
    if (L.quiver && dir !== 2) { P.line(bx0, tp, bx1, belt - 1, PAL.woodD); P.p(cx, Math.round((tp + belt) / 2), PAL.goldD); }
  }
  // pochwa miecza
  if (L.scabbard && !robe) {
    if (dir === 0) { P.line(bx0 - 1, tp + 10, bx0 - 3, tp + 18, PAL.woodD); P.p(bx0 - 3, tp + 18, PAL.steel); P.p(bx0 - 2, tp + 13, PAL.goldD); }
    if (dir === 2) { P.line(cx - 2, tp + 10, cx - 7, tp + 17, PAL.woodD); P.p(cx - 7, tp + 17, PAL.steel); P.p(cx - 4, tp + 13, PAL.goldD); }
  }

  // ---- ręce ----
  const sleeve = (x: number, y: number) => L.body === "robe" ? (L.hood ? L.hood[0] : PAL.dusk) : matColor(L, x, y, tp);
  const glove = L.body === "plate" || L.body === "mail" ? PAL.dirtD : L.skin[0];
  const armLen = dwarf ? 8 : orc ? 12 : 10;
  const swing = frame === 0 ? 0 : WALK_ST[frame] > 0 ? 1 : WALK_ST[frame] < 0 ? -1 : 0;
  if (noArms) { /* ręce rysuje bitwa, zgodnie z ruchem broni */ }
  else if (dir === 2) {
    for (let y = tp + 1; y < tp + 1 + armLen; y++) P.r(cx - 1 + (y > tp + 4 ? swing : 0), y, 2, 1, sleeve(cx, y));
    P.r(cx - 1 + swing, tp + 1 + armLen, 2, 2, orc ? L.skin[0] : glove);
  } else {
    for (let y = tp + 1; y < tp + 1 + armLen; y++) { P.r(bx0 - 2, y, 2, 1, sleeve(bx0 - 2, y)); P.r(bx1 + 1, y, 2, 1, sleeve(bx1 + 1, y)); }
    P.r(bx0 - 2, tp + 1 + armLen - swing, 2, 2, orc ? L.skin[0] : glove); P.r(bx1 + 1, tp + 1 + armLen + swing, 2, 2, orc ? L.skin[0] : glove);
    if (L.body === "mail" || L.body === "plate") { P.r(bx0 - 2, tp + armLen - 1, 2, 1, PAL.dirtD); P.r(bx1 + 1, tp + armLen - 1, 2, 1, PAL.dirtD); }   // mankiety rękawic
  }
  if (L.quiver && dir === 1) { P.r(cx + 2, tp - 3, 3, 12, PAL.woodD); P.r(cx + 2, tp + 1, 3, 1, PAL.dirtL); P.r(cx + 2, tp - 3, 3, 1, PAL.bone); P.p(cx + 3, tp - 4, PAL.white); P.p(cx + 4, tp - 4, PAL.redL); }
  if (L.cape && dir === 1) for (let y = tp; y <= capeEnd; y++) for (let x = cx - hw; x <= cx + hw - 1; x++) {
    if (y > capeEnd - 2 && vrand(seed, x * 13 + y) < 0.4 + wear * 0.2) continue;
    let c = x === cx + hw - 1 || x === cx - hw ? L.cape[1] : (x - cx) % 3 === 0 ? L.cape[1] : L.cape[0];   // fałdy
    if (wear > 0.25 && vrand(seed, x * 71 + y * 5) < wear * 0.1) c = PAL.dirtL;                      // przetarcia
    if (y === capeEnd && cul === "aurelia") c = L.tabard ? L.tabard.trim : PAL.gold;
    P.p(x, y, c);
  }
  if (L.cape && dir !== 1) { P.p(cx - hw + 1, tp, PAL.goldD); if (dir === 0) P.p(cx + hw - 2, tp, PAL.goldD); }   // zapinka płaszcza

  // ---- głowa ----
  if (!headless) drawHead(P, L, F, dir, ht);
  else { P.r(cx - 1, tp - 1, 2, 1, PAL.bloodL); P.r(cx - 2, tp, 4, 1, PAL.blood); }

  weatherPix(P, L, cx, hw, tp, bt);
  return P.toCanvas();
}

// Brud, krew, rdza i wgniecenia: nakładane na gotową postać.
function weatherPix(P: Pix, L: Look, cx: number, hw: number, tp: number, bt: number) {
  const seed = L.seed;
  // błoto od dołu: gęste przy stopach, rzadsze wyżej, w grudkach
  for (let i = 0; i < 70 * L.dirt; i++) {
    const x = Math.floor(vrand(seed, 300 + i) * SPR_W), y = 39 - Math.floor(Math.pow(vrand(seed, 400 + i), 1.8) * 16);
    const c = vrand(seed, 500 + i) < 0.5 ? PAL.dirtD : PAL.dirt;
    P.over(x, y, c); if (vrand(seed, 520 + i) < 0.4) P.over(x + 1, y, c);
  }
  // krew: plamy (2–3 piksele) i zacieki w dół
  for (let i = 0; i < 7 * L.blood; i++) {
    const x = cx - hw + Math.floor(vrand(seed, 600 + i) * hw * 2), y = tp + Math.floor(vrand(seed, 700 + i) * (bt - tp + 4));
    const c = vrand(seed, 800 + i) < 0.6 ? PAL.bloodD : PAL.blood;
    P.over(x, y, c); P.over(x + 1, y, c); if (vrand(seed, 820 + i) < 0.5) P.over(x, y - 1, PAL.bloodD);
    const drip = Math.floor(vrand(seed, 840 + i) * 4);
    for (let k = 1; k <= drip; k++) P.over(x, y + k, PAL.bloodD);
  }
  // rdza na stali (skupiska), wgniecenia na płycie i hełmie
  const rust = L.rust || 0;
  if (rust > 0.05) for (let y = 0; y < SPR_H; y++) for (let x = 0; x < SPR_W; x++) {
    const c = P.get(x, y);
    if (!c || !STEEL_SET.has(c)) continue;
    const blob = vrand(seed + ((x >> 1) * 31 + (y >> 1) * 17), 900);
    if (blob < rust * 0.45) P.p(x, y, blob < rust * 0.18 ? "#4a2716" : PAL.rust);
  }
  for (let i = 0; i < (L.dents || 0); i++) {
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.floor(vrand(seed, 950 + i * 13 + tries) * SPR_W), y = Math.floor(vrand(seed, 970 + i * 13 + tries) * SPR_H);
      const c = P.get(x, y);
      if (c && STEEL_SET.has(c) && P.get(x + 1, y + 1)) { P.p(x, y, PAL.ink); P.p(x + 1, y + 1, PAL.steelL); break; }
    }
  }
}

function drawHead(P: Pix, L: Look, F: Frame, dir: number, ht: number) {
  const { cx } = F;
  const orc = L.race === "orc", dwarf = L.race === "dwarf";
  const hw2 = F.headW / 2;
  const fx0 = cx - hw2, fx1 = cx + hw2 - 1;
  const fy0 = ht + 1, fy1 = ht + F.headH;
  const S = L.skin[0], SD = L.skin[1];
  const H = L.helm;
  const fullHelm = H === "great" || H === "coif" || H === "hood";
  // szyja
  P.r(cx - 1, fy1, 2, 2, SD);
  if (dir === 1) {
    // tył głowy
    P.r(fx0, fy0, F.headW, F.headH, H === "none" || H === "cap" ? L.hair : S);
    P.r(fx0, fy0, F.headW, F.headH - 2, L.hair);
  } else if (dir === 0) {
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) {
      if (y === fy1 && (x === fx0 || x === fx1)) continue;
      P.p(x, y, x === fx1 || y === fy1 ? SD : S);
    }
    // uszy
    if (orc) { P.r(fx0 - 2, fy0 + 2, 2, 2, S); P.p(fx0 - 3, fy0 + 1, S); P.r(fx1 + 1, fy0 + 2, 2, 2, SD); P.p(fx1 + 3, fy0 + 1, SD); }
    else { P.p(fx0 - 1, fy0 + 3, S); P.p(fx1 + 1, fy0 + 3, SD); }
    // brwi, oczy, nos, usta
    const ey = fy0 + 3;
    if (orc) P.r(fx0, ey - 1, F.headW, 1, SD);
    else { P.p(cx - 2, ey - 1, L.hair); P.p(cx + 1, ey - 1, L.hair); }
    P.p(cx - 2, ey, orc ? PAL.gold : PAL.black); P.p(cx + 1, ey, orc ? PAL.gold : PAL.black);
    if (dwarf) { P.p(cx - 3, ey, PAL.black); P.p(cx + 2, ey, PAL.black); }
    P.r(cx - 1, ey + 1, 1, 2, SD); P.p(cx, ey + 2, SD);
    P.r(cx - 1, ey + 3, 2, 1, orc ? PAL.black : SD);
    if (orc) { P.p(cx - 3, ey + 3, PAL.boneHi); P.p(cx + 2, ey + 3, PAL.boneHi); P.p(cx - 3, ey + 2, PAL.boneHi); P.p(cx + 2, ey + 2, PAL.boneHi); }   // kły
    // blizny
    if (L.scar === 1) P.line(cx + 1, ey - 2, cx + 2, ey + 2, PAL.bloodD);
    if (L.scar === 2) P.line(cx - 3, ey + 1, cx + 2, ey + 1, SD);
    if (L.scar === 3) { P.line(cx - 2, ey - 2, cx - 2, ey + 2, PAL.bloodD); P.p(cx - 2, ey, PAL.ash); }
    if (L.scar === 5) { P.r(cx - 3, ey - 1, 2, 2, PAL.black); }
    // malunki wojenne (widoczne bez zasłoniętej twarzy)
    if (L.paint && H !== "great") {
      const pc = orc ? PAL.black : PAL.bloodD;
      if (L.paint === 1) P.r(fx0, ey, F.headW, 1, pc);
      if (L.paint === 2) { P.p(cx - 2, ey + 2, pc); P.p(cx + 1, ey + 2, pc); P.p(cx - 3, ey + 2, pc); P.p(cx + 2, ey + 2, pc); }
      if (L.paint === 3) { P.r(cx - 2, ey - 1, 2, 2, PAL.black); P.r(cx + 1, ey - 1, 2, 2, PAL.black); P.p(cx - 2, ey, PAL.redL); }
    }
  } else {
    // profil (w prawo)
    for (let y = fy0; y <= fy1; y++) for (let x = fx0; x <= fx1; x++) P.p(x, y, x < cx ? L.hair : S);
    P.r(fx0, fy0 + 3, 2, 3, S);
    const ey = fy0 + 3;
    P.p(fx1, ey, orc ? PAL.gold : PAL.black);
    P.p(fx1 + 1, ey + 1, S); P.p(fx1 + 1, ey + 2, SD);         // nos
    P.p(fx1, ey + 3, orc ? PAL.black : SD);
    P.p(cx - 1, ey, SD); P.p(cx - 1, ey + 1, SD);              // ucho
    if (orc) { P.p(fx1, ey + 2, PAL.boneHi); P.p(fx1 + 1, ey + 3, PAL.boneHi); P.r(fx0 - 2, ey - 1, 2, 2, S); }
    if (L.scar) P.line(fx1 - 1, ey - 1, fx1, ey + 2, PAL.bloodD);
  }
  // kozia bródka i wąsy
  if ((L.beard === 4 || L.beard === 5) && dir === 0 && H !== "great") {
    if (L.beard === 4) { P.r(cx - 1, fy1 - 1, 2, 3, L.hair); }
    else { P.r(cx - 2, fy1 - 2, 4, 1, L.hair); P.p(cx - 3, fy1 - 1, L.hair); P.p(cx + 2, fy1 - 1, L.hair); }
  }
  // broda
  if (L.beard && L.beard < 4 && dir !== 1 && !(H === "great")) {
    const by0 = fy1 - (L.beard >= 2 ? 3 : 2);
    const long = L.beard === 2 ? 3 : L.beard === 3 ? 7 : 0;
    if (dir === 0) {
      for (let y = by0; y <= fy1 + long; y++) {
        const w = y <= fy1 ? F.headW : Math.max(2, F.headW - (y - fy1));
        P.r(cx - Math.floor(w / 2), y, w, 1, L.hair);
      }
      P.r(cx - 1, fy1 - 2, 2, 1, PAL.black);   // usta w brodzie
      if (L.beard === 3) { P.p(cx - 2, fy1 + 3, PAL.gold); P.p(cx + 1, fy1 + 3, PAL.gold); P.p(cx - 1, fy1 + 6, PAL.gold); }
    } else {
      for (let y = by0; y <= fy1 + long; y++) P.r(cx, y, Math.max(1, F.headW / 2 - (y > fy1 ? y - fy1 : 0) + 1), 1, L.hair);
    }
  }
  // włosy (bez hełmu)
  if (H === "none") {
    // fryzury z kreatora: 0 krótkie, 1 łysy, 2 długie, 3 irokez, 4 warkocze, 5 kucyk
    const hs = L.hairStyle || 0;
    if (hs === 1) { if (dir !== 1) { P.p(fx0, fy0 + 1, L.hair); P.p(fx1, fy0 + 1, L.hair); P.p(cx, fy0, PAL.boneHi); } else P.r(fx0, fy0, F.headW, F.headH - 2, S); return; }
    if (hs === 3) { P.r(cx - 1, fy0 - 3, 2, 4, L.hair); if (dir === 1) P.r(cx - 1, fy0, 2, F.headH - 2, L.hair); return; }
    if (dir === 0) { P.r(fx0, fy0 - 1, F.headW, 2, L.hair); P.p(fx0 - 1, fy0 + 1, L.hair); P.p(fx1 + 1, fy0 + 1, L.hair); if (orc && hs === 0) P.r(cx - 1, fy0 - 3, 2, 3, PAL.black); }
    if (dir === 2) { P.r(fx0, fy0 - 1, F.headW - 1, 2, L.hair); if (orc && hs === 0) P.r(cx - 1, fy0 - 3, 2, 3, PAL.black); }
    if (hs === 2) { if (dir === 0) { P.r(fx0 - 1, fy0 + 1, 1, 5, L.hair); P.r(fx1 + 1, fy0 + 1, 1, 5, L.hair); } else P.r(fx0 - 1, fy0, 2, 7, L.hair); }
    if (hs === 4) { if (dir === 0) { P.r(fx0 - 1, fy0 + 2, 1, 6, L.hair); P.r(fx1 + 1, fy0 + 2, 1, 6, L.hair); P.p(fx0 - 1, fy0 + 8, PAL.gold); P.p(fx1 + 1, fy0 + 8, PAL.gold); } else P.r(fx0 - 1, fy0 + 1, 1, 7, L.hair); }
    if (hs === 5) { if (dir !== 0) P.r(fx0 - 2, fy0 + 1, 2, 5, L.hair); }
    return;
  }
  // hełmy
  const dome = (y0: number, y1: number, x0: number, x1: number, c: string, hi: string) => {
    for (let y = y0; y <= y1; y++) {
      const inset = y === y0 ? 2 : y === y0 + 1 ? 1 : 0;
      for (let x = x0 + inset; x <= x1 - inset; x++) P.p(x, y, x === x0 + inset ? hi : c);
    }
  };
  if (L.plume && H !== "hood" && H !== "cap" && H !== "crest") {   // pióropusz
    if (dir === 2) { P.r(cx - 3, fy0 - 5, 4, 2, L.plume); P.r(cx - 6, fy0 - 4, 3, 2, L.plume); P.p(cx - 7, fy0 - 3, PAL.ink); }
    else { P.r(cx - 1, fy0 - 6, 2, 4, L.plume); P.p(cx - 2, fy0 - 5, L.plume); P.p(cx + 1, fy0 - 4, L.plume); }
  }
  switch (H) {
    case "nasal": case "crest": {
      dome(fy0 - 2, fy0 + 2, fx0 - 1, fx1 + 1, PAL.steel, PAL.steelL);
      P.r(fx0 - 1, fy0 + 2, F.headW + 2, 1, H === "crest" ? PAL.gold : PAL.steelD);
      if (dir === 0) P.r(cx - 1, fy0 + 2, 1, 4, PAL.steel);
      if (dir === 2) P.r(fx1, fy0 + 2, 1, 3, PAL.steel);
      P.p(fx0, fy0 + 1, PAL.steelL); P.p(fx1, fy0 + 1, PAL.steelD);
      if (H === "crest") {
        if (dir === 2) { P.r(cx - 4, fy0 - 4, 5, 2, PAL.redL); P.r(cx - 6, fy0 - 3, 3, 3, PAL.red); }
        else { P.r(cx - 1, fy0 - 5, 2, 4, PAL.redL); P.p(cx - 2, fy0 - 4, PAL.red); P.p(cx + 1, fy0 - 3, PAL.red); }
      }
      break;
    }
    case "kettle":
      dome(fy0 - 2, fy0 + 1, fx0, fx1, PAL.steel, PAL.steelL);
      P.r(fx0 - 3, fy0 + 2, F.headW + 6, 1, PAL.steel); P.r(fx0 - 3, fy0 + 2, 3, 1, PAL.steelL);
      if (dir === 0) P.r(fx0, fy0 + 3, F.headW, 1, L.skin[1]);
      break;
    case "great":
      for (let y = fy0 - 2; y <= fy1; y++) for (let x = fx0 - 1; x <= fx1 + 1; x++) {
        if (y === fy0 - 2 && (x === fx0 - 1 || x === fx1 + 1)) continue;
        P.p(x, y, x === fx0 - 1 ? PAL.steelL : x === fx1 + 1 ? PAL.steelD : PAL.steel);
      }
      if (dir === 0) {
        P.r(fx0, fy0 + 2, F.headW, 1, PAL.black);
        P.r(cx - 1, fy0 - 2, 1, F.headH + 2, PAL.steelL);
        P.p(cx + 1, fy0 + 5, PAL.black); P.p(cx + 2, fy0 + 5, PAL.black); P.p(cx + 1, fy0 + 6, PAL.black);
        P.p(fx0, fy1, PAL.boneHi); P.p(fx1, fy1, PAL.boneHi);
      } else if (dir === 2) { P.r(cx, fy0 + 2, F.headW / 2 + 1, 1, PAL.black); P.p(fx1, fy0 + 5, PAL.black); }
      if (L.dirt > 0.3) { P.p(fx0 + 1, fy1 - 1, PAL.rust); P.p(fx1, fy0 + 3, PAL.rust); }
      break;
    case "coif":
      for (let y = fy0 - 1; y <= fy1 + 1; y++) for (let x = fx0 - 1; x <= fx1 + 1; x++) {
        const face = dir === 0 && x >= fx0 + 1 && x <= fx1 - 1 && y >= fy0 + 2 && y <= fy1 - 1;
        const faceS = dir === 2 && x >= cx && y >= fy0 + 2 && y <= fy1 - 1;
        if (face || faceS) continue;
        P.p(x, y, (x + y) % 2 ? PAL.steel : PAL.steelD);
      }
      break;
    case "hood": {
      const [hc, hd] = L.hood || [PAL.dirt, PAL.dirtD];
      for (let y = fy0 - 2; y <= fy1 + 1; y++) for (let x = fx0 - 1; x <= fx1 + 1; x++) {
        const face = dir === 0 && x >= fx0 + 1 && x <= fx1 - 1 && y >= fy0 + 2 && y <= fy1;
        const faceS = dir === 2 && x >= cx + 1 && y >= fy0 + 2 && y <= fy1;
        if (face || faceS) continue;
        P.p(x, y, x === fx1 + 1 ? hd : hc);
      }
      if (dir === 0) P.r(fx0 + 1, fy0 + 2, F.headW - 2, 1, L.skin[1]);
      break;
    }
    case "orc":
      dome(fy0 - 2, fy0 + 1, fx0, fx1, PAL.steelD, PAL.steel);
      P.p(cx - 3, fy0 - 3, PAL.steelL); P.p(cx, fy0 - 4, PAL.steelL); P.p(cx + 2, fy0 - 3, PAL.steelL);
      P.p(fx0 + 1, fy0, PAL.rust); P.p(fx1 - 1, fy0 + 1, PAL.rust);
      break;
    case "dwarf":
      dome(fy0 - 2, fy0 + 1, fx0 - 1, fx1 + 1, PAL.steel, PAL.steelL);
      P.r(fx0 - 1, fy0 + 1, F.headW + 2, 1, PAL.gold);
      P.p(cx - 2, fy0 + 1, PAL.goldD); P.p(cx + 1, fy0 + 1, PAL.goldD);
      if (dir !== 1) { P.p(fx0 - 2, fy0 - 2, PAL.bone); P.p(fx0 - 3, fy0 - 3, PAL.bone); P.p(fx1 + 2, fy0 - 2, PAL.bone); P.p(fx1 + 3, fy0 - 3, PAL.bone); }
      if (dir === 0) P.r(cx - 1, fy0 + 2, 1, 3, PAL.steel);
      break;
    case "cap":
      dome(fy0 - 1, fy0 + 1, fx0, fx1, L.hood ? L.hood[0] : PAL.dirt, L.hood ? L.hood[0] : PAL.dirtL);
      break;
    case "rustcap":
      dome(fy0 - 1, fy0 + 1, fx0 - 1, fx1 + 1, PAL.rust, PAL.stone);
      break;
    case "mitre":
      for (let y = fy0 - 5; y <= fy0 + 1; y++) { const w = y < fy0 - 3 ? F.headW - 2 : F.headW; P.r(cx - w / 2, y, w, 1, PAL.bone); }
      if (dir !== 1) { P.r(cx - 1, fy0 - 4, 1, 4, PAL.red); P.r(cx - 2, fy0 - 3, 3, 1, PAL.red); }
      break;
  }
  // kształty hełmów zależne od kultury
  const cul = L.culture || "";
  const metal = H === "nasal" || H === "crest" || H === "kettle" || H === "great";
  if (cul === "aurelia" && metal) {   // złota obręcz, krzyż na przyłbicy
    P.r(fx0, fy0 - 1, F.headW, 1, PAL.goldD); P.p(cx - 1, fy0 - 1, PAL.gold);
    if (H === "great" && dir === 0) { P.r(cx - 1, fy0 + 3, 1, 3, PAL.gold); P.r(cx - 2, fy0 + 4, 3, 1, PAL.gold); }
  }
  if (cul === "varus" && (H === "nasal" || H === "crest")) {   // policzki i poprzeczny grzebień legionu
    if (dir !== 1) { P.r(fx0 - 1, fy0 + 3, 1, 4, PAL.steel); P.r(fx1 + 1, fy0 + 3, 1, 4, PAL.steelD); }
    if (H === "crest" && dir === 0) P.r(fx0 - 2, fy0 - 3, F.headW + 4, 1, PAL.redL);
    if (dir === 2) P.r(fx0 - 2, fy0 + 2, 2, 2, PAL.steelD);   // osłona karku
  }
  if (cul === "dwarf" && H === "dwarf") { P.p(fx0 + 1, fy0 - 1, PAL.boneHi); P.p(fx1 - 1, fy0 - 1, PAL.boneHi); if (dir === 0) { P.r(fx0, fy0 + 3, 2, 1, PAL.steel); P.r(fx1 - 1, fy0 + 3, 2, 1, PAL.steel); } }   // nity i maska
  if (cul === "orc" && H === "orc" && dir !== 1) {   // rogi z kości
    P.p(fx0 - 1, fy0 - 1, PAL.bone); P.p(fx0 - 2, fy0 - 2, PAL.bone); P.p(fx0 - 2, fy0 - 3, PAL.boneHi);
    P.p(fx1 + 1, fy0 - 1, PAL.bone); P.p(fx1 + 2, fy0 - 2, PAL.bone); P.p(fx1 + 2, fy0 - 3, PAL.boneHi);
  }
  if (cul === "bandit" && (H === "hood" || H === "cap") && dir === 0) P.r(fx0 + 1, fy0 + 5, F.headW - 2, 2, PAL.dirtD);   // chusta na twarzy
}

// ---------- Nieumarli ----------
function drawSkeleton(L: Look, dir: number, frame: number, headless = false, noArms = false): HTMLCanvasElement {
  const P = new Pix(24, 32);
  const cx = 12, bob = frame === 2 ? -1 : 0;
  const top = 11 + bob, B = PAL.bone, BH = PAL.boneHi, BD = PAL.ash;
  const rag = L.hood ? L.hood[0] : PAL.dusk;
  // nogi
  if (dir === 2) {
    const st = [0, 2, 0, -2][frame];
    for (const [x, c] of [[cx - 1 - st, BD], [cx + st, B]] as [number, string][]) { P.r(x, 22, 1, 4, c); P.p(x, 26, BH); P.r(x, 27, 1, 3, c); P.r(x, 30, 3, 1, c); }
  } else for (let s = 0; s < 2; s++) {
    const lift = (frame === 1 && s === 0) || (frame === 3 && s === 1) ? 1 : 0;
    const x = s === 0 ? cx - 3 : cx + 2;
    P.r(x, 22, 1, 4 - lift, B); P.r(x - 1, 26 - lift, 3, 1, BH); P.r(x, 27 - lift, 1, 3, B); P.r(x - 1, 30 - lift, 3, 1, B);
  }
  // miednica i kręgosłup
  P.r(cx - 3, 20 + bob, 6, 2, B); P.p(cx - 1, 21 + bob, PAL.black); P.p(cx, 21 + bob, PAL.black);
  P.r(cx - 1, top, 2, 9, dir === 1 ? BH : BD);
  // żebra
  if (dir === 2) for (let y = top + 1; y < top + 8; y += 2) P.r(cx - 2, y, 5, 1, B);
  else for (let y = top + 1; y < top + 8; y += 2) { P.r(cx - 4, y, 3, 1, B); P.r(cx + 1, y, 3, 1, B); P.p(cx - 4, y + 1, BD); P.p(cx + 3, y + 1, BD); }
  P.r(cx - 4, top, 8, 1, BH);   // obojczyki
  // łachmany lub resztki zbroi
  // zardzewiały ekwipunek: kolczuga, płyta, tabard; im wyższy tier, tym pełniejszy
  const rust = (x: number, y: number, base: string) => (vrand(L.seed, x * 13 + y * 5) < 0.3 ? PAL.rust : base);
  if (L.body === "mail" || L.body === "plate") {
    for (let y = top + 1; y < top + 10; y++) for (let x = cx - 4; x <= cx + 3; x++) {
      if (L.body === "mail") { if (vrand(L.seed, x * 9 + y) < 0.9) P.p(x, y, rust(x, y, (x + y) % 2 ? PAL.steelD : PAL.steel)); }
      else P.p(x, y, rust(x, y, (y - top) % 4 === 3 ? PAL.steelD : x > cx ? PAL.steelD : PAL.steel));
    }
    P.r(cx - 4, top + 8, 8, 1, PAL.woodD); P.p(cx - 1, top + 8, PAL.goldD);   // pas
    if (L.body === "plate") {
      for (const sx of dir === 2 ? [cx - 1] : [cx - 7, cx + 4]) { P.r(sx, top - 1, 3, 3, PAL.steel); P.r(sx, top + 2, 3, 1, PAL.steelD); P.p(sx + 1, top, PAL.rust); }
      for (let y = top + 9; y < top + 12; y++) for (let x = cx - 4; x <= cx + 3; x++) if ((x + y) % 3) P.p(x, y, rust(x, y, PAL.steelD));
    }
  }
  if (L.tabard && dir !== 1) { const tc = L.tabard.main; for (let y = top + 2; y < 25; y++) for (let x = cx - 2; x <= cx + 1; x++) if (y < 23 || vrand(L.seed, x * 3 + y) < 0.5) P.p(x, y, y % 5 === 0 ? L.tabard.shade : tc); P.p(cx - 1, top + 4, L.tabard.trim); }
  if (L.body === "leather") for (let y = top + 1; y < top + 9; y++) for (let x = cx - 4; x <= cx + 3; x++) if (vrand(L.seed, x * 5 + y) < 0.75) P.p(x, y, (y - top) % 4 === 3 ? PAL.woodD : PAL.dirt);
  for (let y = top + 6; y < 26; y++) for (let x = cx - 4; x <= cx + 3; x++) if (vrand(L.seed, x * 31 + y * 7) < 0.35 - (y - top) * 0.012) P.p(x, y, rag);
  // ręce
  if (noArms) { /* ręce w bitwie */ }
  else if (dir === 2) { P.r(cx, top + 1, 1, 5, B); P.p(cx, top + 6, BH); P.r(cx + 1, top + 7, 1, 3, B); P.r(cx + 1, top + 10, 2, 1, BH); }
  else { for (const x of [cx - 6, cx + 5]) { P.r(x, top + 1, 1, 5, B); P.p(x, top + 6, BH); P.r(x, top + 7, 1, 3, B); P.r(x - 1, top + 10, 2, 1, BH); } }
  // czaszka
  if (!headless) {
    const hy = 2 + bob;
    P.r(cx - 3, hy + 1, 7, 6, B); P.r(cx - 2, hy, 5, 1, BH); P.r(cx - 2, hy + 7, 5, 2, B);
    P.r(cx - 3, hy + 1, 1, 4, BH);
    if (dir === 0) {
      P.r(cx - 2, hy + 3, 2, 2, PAL.black); P.r(cx + 1, hy + 3, 2, 2, PAL.black);
      P.p(cx - 2, hy + 3, PAL.purpleL); P.p(cx + 2, hy + 3, PAL.purpleL);
      P.p(cx, hy + 5, PAL.black);
      P.r(cx - 2, hy + 7, 5, 1, PAL.black); P.p(cx - 1, hy + 7, BH); P.p(cx + 1, hy + 7, BH);
    } else if (dir === 2) {
      P.r(cx + 1, hy + 3, 2, 2, PAL.black); P.p(cx + 2, hy + 3, PAL.purpleL); P.p(cx + 3, hy + 5, PAL.black); P.r(cx, hy + 7, 3, 1, PAL.black);
    } else { P.r(cx - 2, hy + 2, 5, 1, BD); }
    const H = L.helm;
    if (H === "kettle" || H === "nasal" || H === "great" || H === "crest") {
      const met = (x: number, y: number) => P.p(x, y, rust(x, y, x > cx ? PAL.steelD : PAL.steel));
      for (let y = hy - 1; y < hy + 3; y++) for (let x = cx - 4; x <= cx + 4; x++) met(x, y);
      if (H === "kettle") { P.r(cx - 6, hy + 2, 13, 1, PAL.steelD); P.p(cx - 6, hy + 2, PAL.rust); }
      if (H === "nasal" && dir !== 1) P.r(dir === 2 ? cx + 2 : cx, hy + 3, 1, 3, PAL.steelD);
      if (H === "great" || H === "crest") {
        for (let y = hy + 3; y < hy + 8; y++) for (let x = cx - 4; x <= cx + 4; x++) met(x, y);
        if (dir === 0) { P.r(cx - 3, hy + 4, 7, 1, PAL.black); P.p(cx - 2, hy + 4, PAL.purpleL); P.p(cx + 2, hy + 4, PAL.purpleL); }
        else if (dir === 2) { P.r(cx + 1, hy + 4, 4, 1, PAL.black); P.p(cx + 3, hy + 4, PAL.purpleL); }
        if (H === "crest") { P.r(cx - 1, hy - 4, 2, 3, PAL.purple); P.r(cx - 2, hy - 5, 4, 1, PAL.purpleL); }
      }
    }
    if (L.helm === "rustcap") { P.r(cx - 4, hy - 1, 9, 3, PAL.rust); P.r(cx - 3, hy - 1, 3, 1, PAL.stone); P.r(cx - 4, hy + 2, 9, 1, PAL.dirtD); }
    if (L.helm === "hood") { const hc = L.hood || [PAL.purple, PAL.dusk]; P.r(cx - 4, hy - 1, 9, 3, hc[0]); P.r(cx - 4, hy + 2, 1, 6, hc[0]); P.r(cx + 4, hy + 2, 1, 6, hc[1]); if (dir === 1) P.r(cx - 3, hy + 2, 7, 6, hc[0]); }
  }
  return P.toCanvas();
}

function drawGhoul(L: Look, dir: number, frame: number): HTMLCanvasElement {
  const P = new Pix(24, 32);
  const [S, SD] = L.skin;
  const cx = 12, st = [0, 1, 0, -1][frame];
  // ugięte nogi
  if (dir === 2) { P.r(cx - 3 - st, 22, 2, 7, SD); P.r(cx + 1 + st, 22, 2, 7, S); P.r(cx - 4 - st, 29, 3, 1, SD); P.r(cx + 1 + st, 29, 4, 1, S); }
  else { P.r(cx - 5, 22 + (st > 0 ? 1 : 0), 3, 7, SD); P.r(cx + 2, 22 + (st < 0 ? 1 : 0), 3, 7, SD); P.r(cx - 6, 29, 4, 1, SD); P.r(cx + 2, 29, 4, 1, SD); }
  // pochylony tułów z żebrami
  const tx0 = dir === 2 ? cx - 4 : cx - 6, tx1 = dir === 2 ? cx + 4 : cx + 5;
  for (let y = 14; y <= 22; y++) for (let x = tx0; x <= tx1; x++) P.p(x, y, S);
  for (let y = 15; y <= 20; y += 2) P.r(tx0 + 1, y, tx1 - tx0 - 1, 1, SD);
  P.r(tx0, 21, tx1 - tx0 + 1, 2, PAL.dirtD);
  // długie ręce z pazurami
  if (dir === 2) { P.r(cx + 3, 15, 2, 10, SD); P.r(cx + 3, 25, 4, 1, PAL.boneHi); P.p(cx + 6, 24, PAL.boneHi); }
  else { P.r(tx0 - 2, 15, 2, 10, SD); P.r(tx1 + 1, 15, 2, 10, SD); P.r(tx0 - 3, 25, 4, 1, PAL.boneHi); P.r(tx1, 25, 4, 1, PAL.boneHi); }
  // głowa nisko i do przodu
  const hx = dir === 2 ? cx + 1 : cx - 4;
  P.r(hx, 8, 8, 7, S); P.r(hx + 1, 7, 6, 1, S);
  if (dir === 0) { P.p(cx - 2, 10, PAL.purpleL); P.p(cx + 1, 10, PAL.purpleL); P.r(cx - 3, 13, 6, 1, PAL.black); P.p(cx - 2, 13, PAL.boneHi); P.p(cx, 13, PAL.boneHi); P.p(cx + 2, 13, PAL.boneHi); P.r(cx - 2, 12, 4, 1, PAL.bloodD); }
  if (dir === 2) { P.p(hx + 6, 10, PAL.purpleL); P.r(hx + 4, 13, 4, 1, PAL.black); P.p(hx + 5, 13, PAL.boneHi); P.p(hx + 7, 12, PAL.bloodD); }
  if (dir === 1) P.r(hx + 1, 8, 6, 3, SD);
  for (let i = 0; i < 8; i++) P.over(Math.floor(vrand(L.seed, i) * 24), 14 + Math.floor(vrand(L.seed, 50 + i) * 10), PAL.bloodD);
  return P.toCanvas();
}

// Wilk (zwykły albo upiorny): nisko, cztery łapy.
function drawWolf(L: Look, dir: number, frame: number): HTMLCanvasElement {
  const P = new Pix(24, 32);
  const [C, CD] = L.skin;
  const st = [0, 1, 0, -1][frame];
  if (dir === 2) {
    P.r(4, 20, 14, 6, C); P.r(5, 19, 11, 1, C); P.r(4, 25, 14, 1, CD);
    P.r(16, 16, 5, 6, C); P.r(20, 18, 3, 3, C); P.p(22, 20, PAL.black); P.p(18, 17, L.hair); P.r(17, 14, 2, 2, CD);
    P.p(19, 18, PAL.gold);
    P.r(1, 19, 4, 2, CD); P.p(0, 18, CD);
    [5, 8, 14, 17].forEach((x, i) => { const o = i % 2 ? st : -st; P.r(x + o, 26, 2, 4, i % 2 ? CD : C); P.r(x + o, 30, 3, 1, PAL.black); });
  } else {
    P.r(8, 16, 8, 13, C); P.r(8, 28, 8, 1, CD);
    P.r(8, 28 + (st > 0 ? 1 : 0), 2, 3, CD); P.r(14, 28 + (st < 0 ? 1 : 0), 2, 3, CD);
    if (dir === 0) { P.r(9, 12, 6, 6, C); P.r(10, 17, 4, 3, C); P.p(10, 14, PAL.gold); P.p(13, 14, PAL.gold); P.p(11, 19, PAL.black); P.p(12, 19, PAL.black); P.r(9, 10, 2, 2, CD); P.r(13, 10, 2, 2, CD); }
    else { P.r(10, 13, 4, 4, CD); P.r(11, 29, 2, 2, CD); }
  }
  for (let i = 0; i < 6; i++) P.over(4 + Math.floor(vrand(L.seed, i) * 16), 18 + Math.floor(vrand(L.seed, 9 + i) * 8), L.hair);
  return P.toCanvas();
}

function drawDK(L: Look, dir: number, frame: number): HTMLCanvasElement {
  const P = new Pix(28, 38);
  const cx = 14, bob = frame === 2 ? -1 : 0, top = 13 + bob;
  const st = [0, 2, 0, -2][frame];
  // peleryna
  if (dir !== 1) for (let y = top; y <= 33; y++) { const x0 = dir === 0 ? cx - 8 : cx - 7; P.r(x0, y, 2, 1, (y + L.seed) % 5 === 0 && y > 29 ? null : PAL.purple); if (dir === 0) P.r(cx + 6, y, 2, 1, y > 30 && y % 2 ? null : PAL.purple); }
  // nogi
  if (dir === 2) { P.r(cx - 3 - st, 25, 3, 8, PAL.ink); P.r(cx - 1 + st, 25, 3, 8, PAL.slate); P.r(cx - 1 + st, 33, 5, 2, PAL.black); P.r(cx - 3 - st, 33, 4, 2, PAL.black); }
  else for (let s = 0; s < 2; s++) { const lift = (frame === 1 && s === 0) || (frame === 3 && s === 1) ? 1 : 0; const x = s ? cx + 1 : cx - 5; P.r(x, 25, 4, 8 - lift, PAL.slate); P.r(x, 27, 4, 1, PAL.stone); P.r(x - (s ? 0 : 1), 33 - lift, 5, 2, PAL.black); }
  // tors płytowy
  const x0 = dir === 2 ? cx - 5 : cx - 7, x1 = dir === 2 ? cx + 4 : cx + 6;
  for (let y = top; y <= top + 11; y++) for (let x = x0; x <= x1; x++) P.p(x, y, (y - top) % 4 === 3 ? PAL.ink : x === x0 + 1 ? PAL.stone : PAL.slate);
  P.r(x0, top + 10, x1 - x0 + 1, 1, PAL.purple);
  if (dir === 0) { P.r(cx - 1, top + 2, 2, 6, PAL.purple); P.p(cx - 1, top + 3, PAL.purpleL); }
  // naramienniki z kolcami
  if (dir !== 2) { P.r(x0 - 3, top - 1, 5, 4, PAL.slate); P.r(x1 - 1, top - 1, 5, 4, PAL.slate); P.p(x0 - 3, top - 2, PAL.bone); P.p(x1 + 3, top - 2, PAL.bone); P.r(x0 - 3, top - 1, 5, 1, PAL.stone); }
  // ręce
  if (dir === 2) P.r(cx - 1, top + 1, 3, 10, PAL.slate); else { P.r(x0 - 3, top + 3, 3, 8, PAL.slate); P.r(x1 + 1, top + 3, 3, 8, PAL.slate); }
  // hełm z rogami
  const hy = 3 + bob;
  for (let y = hy; y <= hy + 9; y++) for (let x = cx - 4; x <= cx + 3; x++) P.p(x, y, x === cx - 4 ? PAL.stone : PAL.slate);
  P.r(cx - 6, hy - 2, 2, 3, PAL.bone); P.p(cx - 7, hy - 3, PAL.bone); P.r(cx + 4, hy - 2, 2, 3, PAL.ash); P.p(cx + 6, hy - 3, PAL.ash);
  if (dir === 0) { P.r(cx - 3, hy + 4, 6, 1, PAL.black); P.p(cx - 2, hy + 4, PAL.purpleL); P.p(cx + 1, hy + 4, PAL.purpleL); P.r(cx - 1, hy + 6, 2, 3, PAL.black); }
  if (dir === 2) { P.r(cx, hy + 4, 4, 1, PAL.black); P.p(cx + 2, hy + 4, PAL.purpleL); }
  if (dir === 1) { for (let y = top; y <= 34; y++) for (let x = x0; x <= x1; x++) if (!(y > 31 && (x + y) % 3 === 0)) P.p(x, y, x === x1 ? PAL.dusk : PAL.purple); }
  return P.toCanvas();
}

// ---------- Zestaw klatek dla wyglądu ----------
const SPRITE_CACHE = new Map<string, SpriteSet>();
// Stare rysunki (szkielety, ghule, wilki, rycerz śmierci) mają 4 klatki i mniejsze płótno: dopasuj do 32×40 i 6 klatek chodu.
const OLD_FRAME = [0, 2, 1, 1, 2, 3, 3];
function padSprite(c: HTMLCanvasElement): HTMLCanvasElement {
  if (c.width === SPR_W && c.height === SPR_H) return c;
  const [o, g] = mkCanvas(SPR_W, SPR_H);
  g.drawImage(c, Math.round((SPR_W - c.width) / 2), SPR_H - 2 - (c.height - 2));
  return o;
}
function spritesFor(L: Look, key: string): SpriteSet {
  let s = SPRITE_CACHE.get(key);
  if (s) return s;
  const old = L.race === "skel" || L.race === "ghoul" || L.race === "dk" || L.race === "wolf";
  const oy = old ? (L.race === "dk" ? 2 : 8) : 0;
  const draw = (d: number, f: number, headless = false, noArms = false) => {
    const of = OLD_FRAME[f];
    if (L.race === "skel") return padSprite(drawSkeleton(L, d, of, headless, noArms));
    if (L.race === "ghoul") return padSprite(drawGhoul(L, d, of));
    if (L.race === "dk") return padSprite(drawDK(L, d, of));
    if (L.race === "wolf") return padSprite(drawWolf(L, d, of));
    return drawMan(L, d, f, headless, noArms);
  };
  const FR = [0, 1, 2, 3, 4, 5, 6];
  const frames = [0, 1, 2].map((d) => FR.map((f) => draw(d, f)));
  const headless = [0, 1, 2].map((d) => draw(d, 0, true));
  const Fm = frameOf(L);
  s = { frames, white: frames.map((r) => r.map(whiteOf)), headless, w: SPR_W, h: SPR_H, headY: old ? (L.race === "dk" ? 10 : 14) : Fm.headTop + 4 };
  // wersja bez rąk i „szkielet” ramion: bitwa rysuje ręce tak, by naprawdę trzymały i wymachiwały bronią
  if (L.race === "skel") {
    s.bare = [0, 1, 2].map((d) => FR.map((f) => draw(d, f, false, true)));
    s.rig = { sy: 12 + oy, sx: 5, arm: 9, sleeve: PAL.bone, sleeveD: PAL.ash, hand: PAL.boneHi };
  } else if (L.race === "human" || L.race === "dwarf" || L.race === "orc" || L.race === "necro") {
    s.bare = [0, 1, 2].map((d) => FR.map((f) => drawMan(L, d, f, false, true)));
    const sl = L.body === "robe" ? (L.hood ? L.hood[0] : PAL.dusk) : matColor(L, 16, Fm.top + 2, Fm.top);
    const sd = L.body === "robe" ? (L.hood ? L.hood[1] : PAL.ink) : L.body === "plate" || L.body === "mail" ? PAL.steelD : L.body === "leather" ? PAL.woodD : L.body === "gambeson" ? PAL.ash : PAL.dirtD;
    const glove = L.race === "orc" ? L.skin[0] : L.body === "plate" || L.body === "mail" ? PAL.dirtD : L.skin[0];
    s.rig = { sy: Fm.top + 1, sx: Fm.hw + 1, arm: L.race === "dwarf" ? 8 : L.race === "orc" ? 12 : 10, sleeve: sl, sleeveD: sd, hand: glove };
  }
  if (s.bare) s.bareWhite = s.bare.map((r) => r.map(whiteOf));
  SPRITE_CACHE.set(key, s);
  return s;
}

// Głowa odcięta: mała kulka z twarzą, do cząsteczek.
function headSprite(L: Look): HTMLCanvasElement {
  const P = new Pix(10, 10);
  if (L.race === "skel") { P.r(2, 2, 6, 6, PAL.bone); P.r(3, 4, 1, 1, PAL.black); P.r(6, 4, 1, 1, PAL.black); return P.toCanvas(); }
  P.r(2, 2, 6, 6, L.skin[0]); P.r(2, 2, 6, 2, L.helm === "none" ? L.hair : PAL.steel);
  P.p(3, 5, PAL.black); P.p(6, 5, PAL.black); P.r(3, 8, 4, 1, PAL.bloodL);
  return P.toCanvas();
}

// ---------- Konie ----------
interface HorseSet { frames: HTMLCanvasElement[][]; }
const HORSE_CACHE = new Map<string, HorseSet>();
function getHorse(v: number, cap: [string, string, string], undead = false): HorseSet {
  const key = (v % 4) + ":" + cap.join() + undead;
  let h = HORSE_CACHE.get(key);
  if (h) return h;
  const coat = undead ? [PAL.bone, PAL.ash, PAL.stone] : [[PAL.dirt, PAL.dirtD, PAL.black], [PAL.ink, PAL.black, PAL.dusk], [PAL.ash, PAL.stone, PAL.slate], [PAL.wood, PAL.woodD, PAL.black]][v % 4];
  const frames = [0, 1, 2].map((dir) => [0, 1, 2, 3].map((f) => {
    const side = dir === 2;
    const P = new Pix(side ? 36 : 18, side ? 28 : 32);
    if (side) {
      const legs = [[0, 0, 0, 0], [3, -1, 2, -2], [0, 2, -2, 1], [-2, 1, 3, -1]][f];
      [8, 12, 23, 27].forEach((x, i) => { const o = legs[i]; P.r(x + o, 18, 2, 3, i % 2 ? coat[1] : coat[0]); P.r(x + o + (o > 0 ? 1 : 0), 21, 2, 4, i % 2 ? coat[1] : coat[0]); P.r(x + o + (o > 0 ? 1 : 0), 25, 3, 1, coat[2]); });
      P.r(6, 10, 23, 9, coat[0]); P.r(7, 9, 20, 1, coat[0]); P.r(6, 17, 23, 2, coat[1]);
      P.r(26, 5, 4, 7, coat[0]); P.r(28, 2, 5, 5, coat[0]); P.r(32, 4, 2, 4, coat[0]); P.r(32, 7, 2, 1, coat[2]);
      P.p(30, 3, undead ? PAL.purpleL : PAL.black); P.r(28, 0, 1, 2, coat[1]);
      P.r(25, 3, 2, 8, coat[2]); P.r(27, 1, 1, 3, coat[2]);
      P.r(3, 10, 3, 2, coat[2]); P.r(2, 12, 2, 7, coat[2]); P.p(1, 18, coat[2]);
      // czaprak w barwach
      for (let y = 9; y <= 16; y++) for (let x = 9; x <= 24; x++) if (!(y === 16 && (x + f) % 3 === 0)) P.p(x, y, y === 16 ? cap[2] : x % 4 === 0 ? cap[1] : cap[0]);
      P.r(14, 7, 6, 3, PAL.woodD); P.r(15, 7, 4, 1, PAL.wood);
      if (undead) for (let y = 11; y <= 15; y += 2) P.r(7, y, 3, 1, PAL.black);
    } else {
      const front = dir === 0, st = f % 2;
      P.r(5, 7, 8, 18, coat[0]); P.r(6, 6, 6, 1, coat[0]);
      P.r(5, 21 - st, 2, 9, coat[1]); P.r(11, 20 + st, 2, 9, coat[1]); P.r(5, 29, 2, 1, coat[2]); P.r(11, 29, 2, 1, coat[2]);
      if (front) { P.r(6, 21, 6, 8, coat[0]); P.r(7, 28, 4, 3, coat[0]); P.p(7, 25, PAL.black); P.p(10, 25, PAL.black); P.r(8, 21, 2, 4, coat[2]); }
      else { P.r(7, 0, 4, 7, coat[0]); P.r(8, 0, 2, 5, coat[2]); P.r(8, 24, 2, 6, coat[2]); }
      for (let y = 9; y <= 20; y++) for (let x = 3; x <= 14; x++) P.p(x, y, y === 20 ? cap[2] : x === 3 || x === 14 ? cap[1] : cap[0]);
      P.r(6, 12, 6, 3, PAL.woodD);
    }
    return P.toCanvas();
  }));
  h = { frames };
  HORSE_CACHE.set(key, h);
  return h;
}

// ---------- Portrety (40×40) do rozmów ----------
function drawPortrait(L: Look, frameCol: string): HTMLCanvasElement {
  const P = new Pix(40, 40);
  const S = L.skin[0], SD = L.skin[1];
  // tło
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) P.p(x, y, (x + y) % 7 === 0 ? PAL.slate : PAL.dusk);
  const und = L.race === "skel" || L.race === "dk" || L.race === "necro";
  const orc = L.race === "orc", dwarf = L.race === "dwarf";
  // ramiona i strój
  const shoulder = L.body === "plate" ? PAL.steel : L.body === "mail" ? PAL.steelD : L.body === "robe" ? (L.hood ? L.hood[0] : PAL.dusk) : PAL.dirt;
  for (let y = 30; y < 40; y++) for (let x = 6; x < 34; x++) P.p(x, y, L.body === "mail" && (x + y) % 2 ? PAL.steel : shoulder);
  if (L.tabard) for (let y = 32; y < 40; y++) for (let x = 13; x < 27; x++) P.p(x, y, Math.abs(x - 19.5) < 1.5 && L.tabard.pattern !== "plain" ? L.tabard.trim : L.tabard.main);
  if (L.cape) { P.r(4, 30, 3, 10, L.cape[0]); P.r(33, 30, 3, 10, L.cape[1]); }
  // szyja i głowa
  const hx0 = dwarf ? 11 : orc ? 10 : 12, hx1 = dwarf ? 28 : orc ? 29 : 27;
  const hy0 = 7, hy1 = orc ? 29 : 28;
  if (L.race === "skel" || L.race === "dk") {
    for (let y = 8; y < 28; y++) for (let x = 13; x < 27; x++) { const r = Math.hypot((x - 19.5) / 7, (y - 16) / 9.5); if (r < 1) P.p(x, y, r > 0.85 ? PAL.ash : PAL.bone); }
    P.r(15, 15, 4, 4, PAL.black); P.r(21, 15, 4, 4, PAL.black); P.p(16, 16, PAL.purpleL); P.p(22, 16, PAL.purpleL);
    P.r(19, 20, 2, 3, PAL.black); for (let x = 15; x < 25; x += 2) P.r(x, 25, 1, 2, PAL.black);
    if (L.race === "dk") { for (let y = 4; y < 29; y++) for (let x = 11; x < 29; x++) { if (y > 12 && y < 27 && x > 13 && x < 26) continue; P.p(x, y, x === 11 ? PAL.stone : PAL.slate); } P.r(13, 15, 14, 2, PAL.black); P.p(16, 15, PAL.purpleL); P.p(23, 15, PAL.purpleL); P.r(7, 1, 3, 6, PAL.bone); P.r(30, 1, 3, 6, PAL.ash); }
  } else {
    P.r(17, 26, 6, 5, SD);
    for (let y = hy0; y <= hy1; y++) for (let x = hx0; x <= hx1; x++) {
      const r = Math.hypot((x - (hx0 + hx1) / 2) / ((hx1 - hx0) / 2 + 0.5), (y - (hy0 + hy1) / 2) / ((hy1 - hy0) / 2 + 0.5));
      if (r < 1) P.p(x, y, x > (hx0 + hx1) / 2 + 3 ? SD : S);
    }
    const ey = orc ? 17 : 16;
    // oczy
    if (L.paint === 1) P.r(hx0 + 1, ey - 1, hx1 - hx0 - 1, 4, orc ? PAL.black : PAL.bloodD);
    for (const ex of [15, 23]) { P.r(ex, ey, 3, 2, orc ? PAL.gold : PAL.white); P.p(ex + 1, ey, L.eyes || PAL.black); P.p(ex + 1, ey + 1, PAL.black); }
    P.r(14, ey - 2, 5, 1, orc ? SD : L.hair); P.r(22, ey - 2, 5, 1, orc ? SD : L.hair);
    if (orc) P.r(13, ey - 3, 15, 2, SD);
    // nos, usta
    P.r(19, ey + 2, 2, 4, SD); P.p(18, ey + 5, SD); P.p(21, ey + 5, SD);
    P.r(17, ey + 8, 6, 1, PAL.bloodD);
    if (orc) { P.r(15, ey + 5, 2, 4, PAL.boneHi); P.r(23, ey + 5, 2, 4, PAL.boneHi); P.r(14, ey + 8, 12, 2, SD); }
    // uszy
    if (orc) { P.r(6, 13, 4, 3, S); P.r(4, 11, 2, 2, S); P.r(30, 13, 4, 3, SD); P.r(34, 11, 2, 2, SD); }
    else { P.r(hx0 - 1, ey, 2, 4, S); P.r(hx1, ey, 2, 4, SD); }
    // blizny
    if (L.scar === 1) { P.line(24, 11, 27, 22, PAL.bloodD); P.line(25, 11, 28, 22, SD); }
    if (L.scar === 2) P.line(13, 21, 27, 18, PAL.bloodD);
    if (L.scar === 3) { P.line(16, ey - 5, 18, ey + 6, PAL.bloodD); P.r(15, ey, 3, 2, PAL.ash); }                 // przez oko, bielmo
    if (L.scar === 4) { for (const [x, y] of [[23, 20], [24, 21], [25, 20], [24, 22], [26, 22], [23, 23], [25, 24]]) P.p(x, y, PAL.rust); }   // oparzenie
    if (L.scar === 5) { P.r(14, ey - 1, 5, 4, PAL.black); P.line(12, ey - 4, 27, ey - 6, PAL.black); }          // opaska na oko
    if (L.paint === 2) for (const x of [14, 16, 24, 26]) P.r(x, ey + 3, 1, 5, orc ? PAL.black : PAL.steelL);
    if (L.paint === 3) { P.r(14, ey - 1, 5, 4, PAL.black); P.r(22, ey - 1, 5, 4, PAL.black); P.p(16, ey, PAL.redL); P.p(24, ey, PAL.redL); P.r(18, ey + 8, 4, 1, PAL.bone); }
    // ślady drogi i bitew: brud, krew, zarost, zmęczenie, świeże blizny
    const inFace = (x: number, y: number) => Math.hypot((x - (hx0 + hx1) / 2) / ((hx1 - hx0) / 2 + 0.5), (y - (hy0 + hy1) / 2) / ((hy1 - hy0) / 2 + 0.5)) < 0.95;
    const sd = L.seed * 13 + 5;
    const stub = L.stubble ?? (vrand(sd, 1) < 0.35 ? 0.5 : 0);
    if (stub > 0 && (!L.beard || L.beard >= 4) && !orc) for (let y = ey + 4; y <= hy1; y++) for (let x = hx0 + 1; x < hx1; x++) if (inFace(x, y) && (y > ey + 6 || x < 16 || x > 23) && vrand(sd + x * 41 + y, 2) < stub * 0.55) P.p(x, y, vrand(sd + x + y * 7, 3) < 0.5 ? L.hair : SD);
    const tired = L.tired || 0;
    if (tired > 0.15) { for (const ex of [15, 23]) { P.r(ex, ey + 2, 3, 1, tired > 0.5 ? PAL.dusk : SD); if (tired > 0.45) P.r(ex, ey, 3, 1, S); } if (tired > 0.6) P.r(17, ey + 8, 6, 1, SD); }   // podkrążone, opadające powieki
    for (let i = 0; i < (L.dirt || 0) * 26; i++) { const x = hx0 + Math.floor(vrand(sd, 10 + i) * (hx1 - hx0)), y = hy0 + 3 + Math.floor(vrand(sd, 40 + i) * (hy1 - hy0 - 3)); if (inFace(x, y) && !(y >= ey && y <= ey + 1 && (x >= 15 && x <= 17 || x >= 23 && x <= 25))) { P.p(x, y, vrand(sd, 70 + i) < 0.5 ? PAL.dirt : PAL.dirtD); if (vrand(sd, 90 + i) < 0.5) P.p(x + 1, y, PAL.dirt); } }
    for (let i = 0; i < (L.blood || 0) * 6; i++) { const x = hx0 + 2 + Math.floor(vrand(sd, 120 + i) * (hx1 - hx0 - 4)), y = hy0 + 2 + Math.floor(vrand(sd, 140 + i) * 10); if (!inFace(x, y)) continue; P.p(x, y, PAL.bloodD); P.p(x + 1, y, PAL.blood); for (let k = 1; k < 2 + Math.floor(vrand(sd, 160 + i) * 4); k++) P.p(x, y + k, PAL.bloodD); }
    for (let i = 0; i < Math.min(4, L.bscars || 0); i++) { const x = hx0 + 2 + Math.floor(vrand(sd, 200 + i) * (hx1 - hx0 - 5)), y = hy0 + 4 + Math.floor(vrand(sd, 220 + i) * (hy1 - hy0 - 8)); P.line(x, y, x + 2, y + 3, PAL.bloodD); P.p(x + 1, y + 1, PAL.skin === S ? PAL.boneHi : S); }
    // broda
    if (L.beard) {
      const by = ey + (L.beard === 1 ? 6 : 5), bend = L.beard === 1 ? hy1 + 1 : L.beard === 2 ? 34 : 38;
      for (let y = by; y <= bend; y++) { const w = y <= hy1 ? hx1 - hx0 - 2 : Math.max(4, hx1 - hx0 - 2 - (y - hy1) * 2); P.r(Math.round(20 - w / 2), y, w, 1, (y + Math.floor(y / 3)) % 5 === 0 ? SD : L.hair); }
      P.r(17, ey + 8, 6, 1, PAL.black);
      if (L.beard === 3) { P.r(17, 33, 2, 2, PAL.gold); P.r(22, 33, 2, 2, PAL.gold); }
    }
    if (L.beard === 4) { P.r(18, ey + 9, 4, 5, L.hair); P.r(17, ey + 7, 6, 1, L.hair); }            // kozia bródka
    if (L.beard === 5) { P.r(15, ey + 7, 10, 1, L.hair); P.r(14, ey + 8, 2, 3, L.hair); P.r(24, ey + 8, 2, 3, L.hair); }   // wąsy
    // włosy albo hełm
    if (L.helm === "none" || L.helm === "cap") {
      const hs = L.hairStyle || 0;
      if (hs === 1) { P.r(hx0, hy0 + 4, 2, 4, L.hair); P.r(hx1 - 1, hy0 + 4, 2, 4, L.hair); P.p(15, hy0 + 1, S); P.p(16, hy0 + 1, PAL.boneHi); }
      else if (hs === 3) { P.r(18, hy0 - 4, 4, 10, L.hair); P.r(19, hy0 - 5, 2, 1, L.hair); }
      else {
        P.r(hx0 + 1, hy0 - 1, hx1 - hx0 - 1, 5, L.hair); P.r(hx0, hy0 + 3, 2, 6, L.hair); P.r(hx1 - 1, hy0 + 3, 2, 6, L.hair);
        if (hs === 2) { P.r(hx0 - 1, hy0 + 3, 3, 22, L.hair); P.r(hx1 - 1, hy0 + 3, 3, 22, L.hair); }
        if (hs === 4) { for (const x of [hx0 - 1, hx1]) { for (let y = hy0 + 8; y < 36; y++) P.p(x + (y % 3 === 0 ? 1 : 0), y, L.hair); P.r(x, 36, 2, 2, PAL.gold); } }
        if (hs === 5) { P.r(hx1, hy0 + 2, 4, 3, L.hair); P.r(hx1 + 2, hy0 + 5, 2, 9, L.hair); }
      }
      if (orc && hs !== 1 && hs !== 3) P.r(18, 1, 4, 7, PAL.black);
    }
    else if (L.helm === "hood" || L.helm === "coif") {
      const hc = L.helm === "coif" ? [PAL.steel, PAL.steelD] : L.hood || [PAL.dirt, PAL.dirtD];
      for (let y = 2; y < 32; y++) for (let x = 8; x < 32; x++) { const inFace = x > 13 && x < 27 && y > 11 && y < 30; if (inFace) continue; const r = Math.hypot((x - 20) / 12, (y - 17) / 15); if (r < 1) P.p(x, y, L.helm === "coif" ? ((x + y) % 2 ? hc[0] : hc[1]) : x > 24 ? hc[1] : hc[0]); }
    } else {
      // hełm
      for (let y = 2; y < 13; y++) for (let x = 10; x < 30; x++) { const r = Math.hypot((x - 20) / 10, (y - 13) / 11); if (r < 1) P.p(x, y, x < 15 ? PAL.steelL : x > 25 ? PAL.steelD : PAL.steel); }
      P.r(9, 12, 22, 2, L.helm === "crest" ? PAL.gold : PAL.steelD);
      if (L.helm === "nasal" || L.helm === "crest") P.r(19, 12, 2, 9, PAL.steel);
      if (L.helm === "kettle") P.r(4, 12, 32, 2, PAL.steel);
      if (L.helm === "great") { for (let y = 12; y < 29; y++) for (let x = 10; x < 30; x++) P.p(x, y, x < 13 ? PAL.steelL : x > 27 ? PAL.steelD : PAL.steel); P.r(12, 16, 16, 2, PAL.black); P.r(19, 3, 2, 26, PAL.steelL); }
      if (L.helm === "crest") { P.r(18, 0, 4, 3, PAL.redL); P.r(22, 1, 6, 2, PAL.red); }
      if (L.helm === "dwarf") { P.r(10, 12, 20, 2, PAL.gold); P.r(4, 4, 3, 7, PAL.bone); P.r(33, 4, 3, 7, PAL.bone); }
      if (L.helm === "orc") { P.r(13, 0, 2, 3, PAL.steelL); P.r(19, 0, 2, 2, PAL.steelL); P.r(25, 0, 2, 3, PAL.steelL); }
      if (L.helm === "mitre") { P.r(14, 0, 12, 13, PAL.bone); P.r(19, 2, 2, 9, PAL.red); P.r(16, 5, 8, 2, PAL.red); }
    }
  }
  // ramka w barwach
  for (let i = 0; i < 40; i++) { P.p(i, 0, frameCol); P.p(i, 39, frameCol); P.p(0, i, frameCol); P.p(39, i, frameCol); }
  return P.toCanvas(false, false);
}

// ---------- Figurki na mapę świata (12×16) ----------
const MAPFIG_CACHE = new Map<string, HTMLCanvasElement[]>();
function mapFigure(col: string, trim: string, mounted: boolean, undead = false): HTMLCanvasElement[] {
  const key = col + trim + mounted + undead;
  let f = MAPFIG_CACHE.get(key);
  if (f) return f;
  f = [0, 1].map((fr) => {
    const P = new Pix(14, 18);
    if (mounted) {
      const c = undead ? PAL.bone : PAL.dirt;
      P.r(2, 10, 9, 4, c); P.r(10, 8, 2, 3, c); P.r(11, 7, 2, 2, c);
      P.r(3 + fr, 14, 1, 3, c); P.r(9 - fr, 14, 1, 3, c);
      P.r(4, 9, 5, 3, col);
      P.r(5, 4, 3, 5, undead ? PAL.bone : PAL.steel); P.r(5, 2, 3, 2, undead ? PAL.bone : PAL.steelL);
    } else {
      P.r(5, 4, 4, 7, undead ? PAL.bone : col); P.r(5, 2, 4, 2, undead ? PAL.boneHi : PAL.skin); P.r(5, 1, 4, 1, undead ? PAL.bone : PAL.steel);
      P.r(5, 11, 1, 4 - fr, PAL.dirtD); P.r(8, 11, 1, 3 + fr, PAL.dirtD);
    }
    // proporzec
    P.r(1, 0, 1, 12, PAL.wood);
    P.r(2, 0, 4, 3, col); P.r(2, 3, 3, 1, col); P.p(3, 1, trim);
    return P.toCanvas(true, true);
  });
  MAPFIG_CACHE.set(key, f);
  return f;
}

// ---------- Otoczenie bitwy ----------
let BONES: HTMLCanvasElement;
let TREES: HTMLCanvasElement[] = [];
let DEADTREES: HTMLCanvasElement[] = [];
let ROCKS: HTMLCanvasElement[] = [];
let BUSH: HTMLCanvasElement;
let TUFTS: HTMLCanvasElement[] = [];
let PROPS: Record<string, HTMLCanvasElement> = {};

function buildSprites() {
  const blob = (P: Pix, cx: number, cy: number, r: number, col: string, ry = r) => {
    for (let y = -ry; y <= ry; y++) for (let x = -r; x <= r; x++) if ((x * x) / (r * r) + (y * y) / (ry * ry) <= 1 + rnd() * 0.25) P.p(cx + x, cy + y, col);
  };
  { const P = new Pix(14, 7); P.r(1, 4, 10, 1, PAL.bone); P.r(3, 2, 1, 4, PAL.bone); P.r(8, 3, 4, 1, PAL.boneHi); P.r(9, 1, 4, 3, PAL.bone); P.p(10, 2, PAL.black); P.r(5, 5, 6, 1, PAL.ash); BONES = P.toCanvas(); }
  // drzewa liściaste (dwa warianty), sosny
  for (let k = 0; k < 2; k++) {
    const P = new Pix(34, 46);
    P.r(15, 28, 4, 16, PAL.woodD); P.r(16, 28, 1, 15, PAL.wood); P.r(12, 43, 10, 2, PAL.woodD); P.r(19, 33, 3, 1, PAL.woodD);
    blob(P, 17, 17, 13, PAL.grassD, 12); blob(P, 13 + k * 2, 13, 8, PAL.grass, 7); blob(P, 21, 19, 7, PAL.grass, 6);
    blob(P, 11, 9, 4, PAL.moss); blob(P, 19, 12, 3, PAL.grassL); blob(P, 16, 25, 5, PAL.grassD, 3);
    for (let i = 0; i < 30; i++) P.over(5 + Math.floor(rnd() * 24), 5 + Math.floor(rnd() * 22), chance(0.5) ? PAL.moss : PAL.dirtD);
    TREES.push(P.toCanvas());
  }
  {
    const P = new Pix(26, 48);
    P.r(12, 37, 3, 10, PAL.woodD);
    for (let i = 0; i < 6; i++) { const y = 4 + i * 6, w = 3 + i * 2; for (let r = 0; r < 8; r++) { const ww = Math.round((w * r) / 7); P.r(13 - ww, y + r, ww * 2 + 1, 1, r < 2 ? PAL.grass : PAL.grassD); } P.p(13 - Math.round(w / 2), y + 3, PAL.moss); }
    TREES.push(P.toCanvas());
  }
  // martwe, poskręcane drzewa
  for (let k = 0; k < 2; k++) {
    const P = new Pix(32, 44);
    P.r(14, 16, 3, 27, PAL.woodD); P.r(15, 16, 1, 26, PAL.wood); P.r(12, 42, 8, 1, PAL.woodD);
    P.line(15, 22, 6, 10 + k * 2, PAL.woodD); P.line(16, 19, 25, 8, PAL.woodD); P.line(15, 16, 13, 3, PAL.woodD);
    P.line(9, 14, 4, 14, PAL.woodD); P.line(21, 11, 28, 12 - k, PAL.woodD); P.line(14, 8, 10, 4, PAL.woodD); P.line(16, 28, 23, 24, PAL.woodD);
    if (k === 1) { P.line(25, 8, 25, 13, PAL.ink); P.r(24, 13, 3, 3, PAL.dirt); }   // wisielec
    DEADTREES.push(P.toCanvas());
  }
  for (let k = 0; k < 2; k++) {
    const P = new Pix(16, 11);
    if (k === 0) { P.r(2, 3, 11, 7, PAL.stone); P.r(3, 2, 8, 2, PAL.ash); P.r(10, 5, 3, 5, PAL.slate); P.r(4, 3, 2, 1, PAL.bone); }
    else { P.r(1, 5, 7, 5, PAL.stone); P.r(2, 4, 5, 1, PAL.ash); P.r(8, 3, 6, 7, PAL.slate); P.r(9, 2, 4, 2, PAL.stone); P.p(3, 6, PAL.moss); }
    ROCKS.push(P.toCanvas());
  }
  { const P = new Pix(14, 9); P.r(1, 3, 12, 6, PAL.grassD); P.r(3, 1, 8, 3, PAL.grass); P.r(4, 2, 3, 1, PAL.moss); P.r(9, 4, 2, 2, PAL.grassL); BUSH = P.toCanvas(); }
  for (let k = 0; k < 4; k++) {
    const [c, g] = mkCanvas(7, 5);
    const col = k === 3 ? PAL.dirtL : PAL.grassL;
    g.fillStyle = col; g.fillRect(1, 2, 1, 3); g.fillRect(5, 1, 1, 4);
    g.fillStyle = PAL.moss; g.fillRect(3, 0, 1, 5);
    if (k === 1) { g.fillStyle = PAL.bone; g.fillRect(3, 0, 1, 1); }
    TUFTS.push(c);
  }
  // makabra: pal z czaszką, szubienica, krzyż nagrobny, ognisko, pochodnia na palu
  { const P = new Pix(9, 26); P.r(4, 6, 1, 20, PAL.wood); P.r(2, 0, 5, 5, PAL.bone); P.p(3, 2, PAL.black); P.p(5, 2, PAL.black); P.r(3, 4, 3, 1, PAL.black); P.r(4, 5, 1, 3, PAL.bloodD); PROPS.pike = P.toCanvas(); }
  { const P = new Pix(22, 30); P.r(3, 2, 2, 28, PAL.woodD); P.r(3, 2, 16, 2, PAL.woodD); P.line(5, 8, 9, 3, PAL.woodD); P.r(15, 4, 1, 6, PAL.ink); P.r(13, 10, 5, 4, PAL.dirt); P.r(14, 14, 3, 7, PAL.dirtD); P.r(14, 9, 3, 2, PAL.skinD); P.r(14, 21, 1, 3, PAL.dirtD); P.r(16, 21, 1, 3, PAL.dirtD); PROPS.gallows = P.toCanvas(); }
  { const P = new Pix(9, 13); P.r(4, 0, 2, 13, PAL.stone); P.r(1, 3, 8, 2, PAL.stone); P.p(4, 0, PAL.ash); PROPS.grave = P.toCanvas(); }
  { const P = new Pix(12, 8); P.r(1, 5, 10, 3, PAL.stone); P.r(3, 4, 6, 2, PAL.woodD); PROPS.fire = P.toCanvas(); }
  { const P = new Pix(5, 20); P.r(2, 4, 1, 16, PAL.woodD); P.r(1, 2, 3, 3, PAL.dirtD); PROPS.torch = P.toCanvas(); }
  { const P = new Pix(26, 26); P.r(2, 10, 22, 15, PAL.dirt); P.r(2, 10, 22, 1, PAL.dirtL); for (let y = 0; y < 11; y++) P.r(1 + Math.floor(y * 1.1), 10 - y, 24 - Math.floor(y * 2.2), 1, y % 3 === 0 ? PAL.woodD : PAL.wood); P.r(10, 16, 5, 9, PAL.woodD); P.r(4, 14, 4, 3, PAL.black); P.r(17, 14, 4, 3, PAL.black); PROPS.house = P.toCanvas(); }
  { const P = new Pix(10, 7); P.r(2, 2, 6, 3, PAL.black); P.r(0, 3, 3, 1, PAL.black); P.r(7, 3, 3, 1, PAL.black); P.p(4, 1, PAL.black); PROPS.crow = P.toCanvas(); }
}

// Linia pikselowa (Bresenham) – broń, strzały, łuki.
function pxLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = col;
  for (let i = 0; i < 120; i++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

// Grafika rysowana kodem. Ludzie: szablony pikselowe z wariantami (hełm, broda, skóra, barwy).
// Nieumarli: rysowani proceduralnie. Kierunki: 0 = w dół, 1 = w górę, 2 = w bok (prawo; lewo to odbicie).

type BodyKind = "hero" | "inf" | "arch" | "skel" | "skelArch" | "dk";
type Frames = HTMLCanvasElement[][]; // [kierunek][klatka]
interface SpriteSet { frames: Frames; white: Frames; w: number; h: number; }

function mkCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d");
  g.imageSmoothingEnabled = false;
  return [c, g];
}

function outline(c: HTMLCanvasElement) {
  const g = c.getContext("2d");
  const im = g.getImageData(0, 0, c.width, c.height);
  const d = im.data, w = c.width, h = c.height;
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 200;
  const add: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push(x, y);
  }
  for (let i = 0; i < add.length; i += 2) {
    const k = (add[i + 1] * w + add[i]) * 4;
    d[k] = 13; d[k + 1] = 11; d[k + 2] = 14; d[k + 3] = 235;
  }
  g.putImageData(im, 0, 0);
}

function whiteOf(c: HTMLCanvasElement) {
  const [w, g] = mkCanvas(c.width, c.height);
  g.drawImage(c, 0, 0);
  g.globalCompositeOperation = "source-in";
  g.fillStyle = "#fff4e0"; g.fillRect(0, 0, c.width, c.height);
  return w;
}

// ---------- Szablony ludzi (16 x 22) ----------
// Głowa: wiersze 0–8, tułów: 9–16, nogi: 17–21.
const HEADS: Record<string, string[][]> = {
  nasal: [
    ["................", ".......LH.......", "......LHHh......", ".....LHHHHh.....", ".....HHHHHh.....", ".....hSHHSh.....", ".....SEhhEs.....", ".....SSssSs.....", "......BBBB......"],
    ["................", ".......LH.......", "......LHHh......", ".....LHHHHh.....", ".....HHHHHh.....", ".....hHHHHh.....", ".....YYYYYy.....", "......sSSs......", "......ssss......"],
    ["................", "......LHh.......", ".....LHHHh......", ".....HHHHHh.....", ".....HHHHHHh....", ".....hHhSSE.....", ".....YhSSSSs....", "......hSSss.....", "......sSBB......"],
  ],
  kettle: [
    ["................", "......LHHh......", ".....LHHHHh.....", ".....HHHHHh.....", "...LHHHHHHHHh...", "....hhhhhhhh....", ".....SESSEs.....", ".....SSssSs.....", "......BBBB......"],
    ["................", "......LHHh......", ".....LHHHHh.....", ".....HHHHHh.....", "...LHHHHHHHHh...", "....hhhhhhhh....", ".....YYYYYy.....", "......YYYy......", "......ssss......"],
    ["................", ".....LHHh.......", "....LHHHHh......", "....HHHHHHh.....", "..LHHHHHHHHHh...", "...hhhhhhhhh....", ".....YSSSES.....", "......SSSss.....", "......sSBB......"],
  ],
  coif: [
    ["................", "......mMMm......", ".....mMMMMm.....", "....mMMMMMMm....", "....MSSSSSSm....", "....MSESSESm....", "....MSSssSSm....", "....mSBBBBSm....", ".....mmMMmm....."],
    ["................", "......mMMm......", ".....mMMMMm.....", "....mMMMMMMm....", "....MMMMMMMm....", "....MMMMMMMm....", "....mMMMMMMm....", "....mMMMMMmm....", ".....mmMMmm....."],
    ["................", ".....mMMm.......", "....mMMMMm......", "....MMMMMMm.....", "....MMMSSSS.....", "....MMMSSES.....", "....mMMSSSSs....", "....mMMSSBB.....", ".....mmMMm......"],
  ],
  hood: [
    ["................", "......DDDd......", ".....DDDDDd.....", "....DDDDDDDd....", "....DdSSSSdd....", "....DSESSESd....", "....DSSssSSd....", "....dSSBBSSd....", ".....dDDDDd....."],
    ["................", "......DDDd......", ".....DDDDDd.....", "....DDDDDDDd....", "....DDDDDDDd....", "....DDDDDDDd....", "....dDDDDDDd....", "....dDDDDDdd....", ".....dDDDDd....."],
    ["................", ".....DDDd.......", "....DDDDDd......", "....DDDDDDd.....", "....DDDdSSS.....", "....DDDSSES.....", "....dDDSSSSs....", "....dDDSSBB.....", ".....dDDDd......"],
  ],
};
HEADS.crest = HEADS.nasal.map((rows, d) => {
  const r = rows.slice();
  if (d === 2) { r[0] = "...rRRR........."; r[1] = "......GHh......."; }
  else { r[0] = "......RRRr......"; r[1] = ".......GH......."; }
  return r;
});

const TORSO = [
  ["....mMMTTMMm....", "...AmMTCCTMmA...", "...AMTTCCTTMA...", "...ATTTCCTTtA...", "...aTTTCCTTta...", "...KbbbGGbbbK...", "....TTTCCTTt....", "....tTTCCTtt...."],
  ["....mMMMMMMm....", "...AmMTTTTMmA...", "...AMTTTTTTMA...", "...ATTTTTTTtA...", "...aTTTTTTTta...", "...KbbbbbbbbK...", "....TTTTTTTt....", "....tTTTTTtt...."],
  [".....mMMMm......", ".....MTTTMA.....", ".....TTTCAA.....", ".....TTTCAA.....", ".....tTTCaK.....", ".....bbbbG......", ".....TTTCt......", ".....tTTtt......"],
];
const LEGS = [
  [
    [".....PP..pP.....", ".....PP..pP.....", ".....PP..pP.....", ".....FF..fF.....", "....FFF..fFF...."],
    [".....PP..pP.....", ".....PP..pP.....", ".....FF..pP.....", "....FFF..fF.....", ".........fFF...."],
    [".....PP..pP.....", ".....PP..pP.....", ".....PP..fF.....", ".....FF..fFF....", "....FFF........."],
  ],
  null,
  [
    ["......Pp........", "......Pp........", "......Pp........", "......FF........", "......FFF......."],
    ["......Pp........", ".....Pp.p.......", "....Pp...p......", "....FF...pF.....", "...FF.....FF...."],
    ["......pP........", "......p.PP......", ".....p...PP.....", ".....fF...FF....", "....ff.....FF..."],
  ],
];
LEGS[1] = LEGS[0];

function hashInt(n: number) { n = Math.imul(n ^ 0x45d9f3b, 0x45d9f3b); n ^= n >>> 16; return n >>> 0; }
function vpick<T>(v: number, salt: number, arr: T[]): T { return arr[hashInt(v * 31 + salt) % arr.length]; }

function humanColors(kind: BodyKind, v: number): Record<string, string> {
  const skin = vpick(v, 1, [[PAL.skin, PAL.skinD], [PAL.skin, PAL.skinD], [PAL.skinD, PAL.dirt]]);
  const hair = vpick(v, 2, [PAL.dirtD, PAL.dirt, PAL.black, PAL.ash, PAL.woodD]);
  const beard = vpick(v, 3, [skin[0], skin[0], hair, PAL.ash, PAL.redL]);
  const c: Record<string, string> = {
    L: PAL.steelL, H: PAL.steel, h: PAL.steelD, S: skin[0], s: skin[1], E: PAL.black, B: beard, Y: hair, y: PAL.black,
    M: PAL.stone, m: PAL.slate, A: PAL.stone, a: PAL.slate, K: skin[0],
    T: PAL.red, t: PAL.bloodD, C: vpick(v, 4, [PAL.redL, PAL.bone, PAL.red]), b: PAL.woodD, G: PAL.goldD,
    P: vpick(v, 5, [PAL.dirt, PAL.dirtD, PAL.slate]), p: PAL.dirtD, F: PAL.woodD, f: PAL.black,
    D: PAL.red, d: PAL.bloodD, R: PAL.red, r: PAL.bloodD, Q: PAL.wood, q: PAL.woodD,
  };
  if (kind === "hero") {
    Object.assign(c, { T: PAL.red, t: PAL.bloodD, C: PAL.gold, G: PAL.gold, M: PAL.steel, m: PAL.steelD, A: PAL.steel, a: PAL.steelD, P: PAL.steelD, p: PAL.slate, B: PAL.dirtD, S: PAL.skin, s: PAL.skinD, K: PAL.skin, Y: PAL.dirtD });
  }
  if (kind === "arch") {
    const hood = vpick(v, 6, [[PAL.moss, PAL.grassD], [PAL.dirt, PAL.dirtD], [PAL.red, PAL.bloodD], [PAL.woodD, PAL.black]]);
    Object.assign(c, { T: PAL.moss, t: PAL.grassD, C: PAL.woodD, M: PAL.dirt, m: PAL.dirtD, A: PAL.dirt, a: PAL.dirtD, D: hood[0], d: hood[1] });
  }
  return c;
}

function drawHuman(kind: BodyKind, v: number, dir: number, frame: number): HTMLCanvasElement {
  const head = kind === "hero" ? "crest" : kind === "arch" ? vpick(v, 7, ["hood", "hood", "kettle"]) : vpick(v, 8, ["nasal", "kettle", "coif", "nasal"]);
  const rows = [...HEADS[head][dir], ...TORSO[dir], ...LEGS[dir][frame]].map((r) => r.split(""));
  const set = (x: number, y: number, ch: string, onlyEmpty = true) => {
    if (y < 0 || y >= rows.length || x < 0 || x > 15) return;
    if (!onlyEmpty || rows[y][x] === ".") rows[y][x] = ch;
  };
  // peleryna bohatera
  if (kind === "hero") {
    if (dir === 0) for (let y = 10; y <= 18; y++) { set(3, y, "r"); set(12, y, "r"); if (y > 16) for (let x = 4; x <= 11; x++) set(x, y, y === 18 ? "r" : "R"); }
    if (dir === 1) for (let y = 9; y <= 19; y++) for (let x = 4; x <= 11; x++) { if (y >= 9) rows[y][x] = (x === 4 || x === 11 || y === 19) ? "r" : "R"; }
    if (dir === 2) for (let y = 9; y <= 19; y++) { set(4, y, "R"); set(3, y, y > 12 ? "r" : "."); }
  }
  // kołczan łucznika
  if (kind === "arch") {
    if (dir === 1) for (let y = 8; y <= 14; y++) { rows[y][10] = "Q"; rows[y][11] = "q"; }
    if (dir === 2) for (let y = 8; y <= 14; y++) set(4, y, "Q");
    if (dir === 0) { set(11, 8, "Q"); set(12, 7, "B" === "B" ? "q" : "q"); }
  }
  const col = humanColors(kind, v);
  const [c, g] = mkCanvas(16, 22);
  rows.forEach((r, y) => r.forEach((ch, x) => { if (ch !== "." && col[ch]) { g.fillStyle = col[ch]; g.fillRect(x, y, 1, 1); } }));
  outline(c);
  return c;
}

// ---------- Nieumarli ----------
function drawUndead(kind: BodyKind, v: number, dir: number, frame: number): HTMLCanvasElement {
  const big = kind === "dk";
  const [c, g] = mkCanvas(big ? 20 : 16, big ? 27 : 22);
  const ox = big ? 2 : 0, oy = big ? 3 : 0;
  const P = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x + ox, y + oy, w, h); };
  const lift = (leg: number) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1) ? 1 : 0;
  const helm = !big && kind === "skel" && hashInt(v) % 3 === 0;
  const legCol = big ? PAL.slate : PAL.bone;

  if (big && dir !== 1) { P(3, 9, dir === 0 ? 10 : 3, 10, PAL.purple); P(dir === 0 ? 4 : 3, 18, 1, 1, PAL.ink); }
  // nogi
  if (dir === 2) {
    const fx = frame === 1 ? 9 : frame === 2 ? 5 : 7, bx = frame === 1 ? 5 : frame === 2 ? 9 : 7;
    if (big) { P(bx, 16, 2, 4, PAL.ink); P(fx, 16, 2, 4, legCol); P(fx, 19, 3, 2, PAL.ink); }
    else { P(bx, 16, 1, 4, PAL.ash); P(fx + 1, 16, 1, 4, legCol); P(fx, 20, 3, 1, legCol); P(bx, 20, 2, 1, PAL.ash); }
  } else {
    for (let leg = 0; leg < 2; leg++) {
      const x = leg === 0 ? 5 : 9, up = lift(leg);
      if (big) { P(x, 16, 2, 4 - up, legCol); P(x, 19 - up, 2, 2, PAL.ink); P(x, 16, 1, 1, PAL.stone); }
      else { P(x + (leg ? 0 : 1), 16, 1, 4 - up, legCol); P(x, 20 - up, 2, 1, legCol); P(x + (leg ? 0 : 1), 17, 1, 1, PAL.ash); }
    }
  }
  // tułów
  if (!big) {
    const rag = kind === "skelArch" ? PAL.purple : vpick(v, 9, [PAL.dusk, PAL.dirtD, PAL.slate]);
    if (dir === 2) {
      P(7, 9, 2, 6, PAL.bone); P(6, 10, 4, 1, PAL.bone); P(6, 12, 4, 1, PAL.bone); P(6, 11, 1, 1, PAL.ash);
      P(5, 15, 5, 1, PAL.bone); P(8, 10, 1, 5, PAL.boneHi);
      P(4, 12, 2, 5, rag); P(4, 16, 1, 1, PAL.ink);
      P(8, 10, 1, 4, PAL.boneHi); P(9, 14, 1, 1, PAL.bone);
    } else {
      P(7, 9, 2, 6, dir === 1 ? PAL.ash : PAL.bone);
      for (const y of [10, 12]) { P(5, y, 6, 1, PAL.bone); P(5, y, 1, 1, PAL.boneHi); }
      P(5, 11, 1, 1, PAL.ash); P(10, 11, 1, 1, PAL.ash); P(6, 13, 4, 1, PAL.ash);
      P(5, 15, 6, 1, PAL.bone); P(6, 15, 1, 1, PAL.boneHi);
      P(4, 10, 1, 5, PAL.bone); P(11, 10, 1, 5, PAL.ash);
      P(4, 9, 1, 1, PAL.boneHi); P(11, 9, 1, 1, PAL.bone);
      P(4, 13, 2, 4, rag); P(10, 14, 2, 3, rag); P(5, 16, 1, 1, PAL.ink);
    }
  } else {
    if (dir === 2) {
      P(4, 8, 8, 8, PAL.ink); P(4, 8, 8, 1, PAL.stone); P(10, 9, 1, 6, PAL.slate);
      P(6, 9, 3, 6, PAL.slate); P(6, 9, 1, 6, PAL.stone); P(6, 14, 3, 1, PAL.purpleL);
    } else {
      P(3, 8, 10, 8, PAL.ink);
      P(2, 8, 3, 3, PAL.slate); P(11, 8, 3, 3, PAL.slate);
      P(2, 8, 3, 1, PAL.ash); P(11, 8, 3, 1, PAL.stone);
      if (dir === 0) { P(6, 9, 4, 6, PAL.slate); P(6, 9, 1, 6, PAL.stone); P(7, 10, 2, 4, PAL.purple); P(7, 11, 2, 1, PAL.purpleL); }
      else { P(5, 9, 6, 6, PAL.dusk); }
      P(3, 14, 10, 1, PAL.purple);
      P(2, 11, 2, 4, PAL.slate); P(12, 11, 2, 4, PAL.slate); P(2, 11, 1, 3, PAL.stone);
    }
  }
  // głowa
  if (!big) {
    P(5, 2, 6, 6, PAL.bone); P(6, 2, 4, 1, PAL.boneHi); P(5, 3, 1, 3, PAL.boneHi); P(5, 8, 6, 1, PAL.bone); P(10, 3, 1, 4, PAL.ash);
    if (dir === 0) {
      P(6, 5, 1, 2, PAL.black); P(9, 5, 1, 2, PAL.black);
      P(6, 5, 1, 1, PAL.purpleL); P(9, 5, 1, 1, PAL.purpleL);
      P(7, 7, 2, 1, PAL.ash); P(6, 8, 1, 1, PAL.black); P(8, 8, 1, 1, PAL.black);
    } else if (dir === 2) {
      P(9, 5, 1, 2, PAL.black); P(9, 5, 1, 1, PAL.purpleL); P(9, 8, 1, 1, PAL.black); P(10, 7, 1, 1, PAL.ash);
    } else { P(5, 6, 6, 1, PAL.ash); P(7, 3, 2, 1, PAL.ash); }
    if (kind === "skelArch") {
      P(4, 1, 8, 2, PAL.purple); P(5, 1, 3, 1, PAL.purpleL); P(4, 3, 1, 5, PAL.purple); P(11, 3, 1, 5, PAL.dusk);
      if (dir === 1) P(5, 3, 6, 5, PAL.purple);
    }
    if (helm) { P(4, 1, 8, 3, PAL.stone); P(5, 1, 4, 1, PAL.ash); P(4, 3, 8, 1, PAL.dirtD); P(9, 2, 1, 1, PAL.dirt); }
  } else {
    P(4, 1, 8, 7, PAL.slate); P(5, 1, 5, 1, PAL.ash); P(4, 2, 1, 5, PAL.stone);
    P(2, 0, 2, 1, PAL.bone); P(2, 1, 1, 2, PAL.bone); P(12, 0, 2, 1, PAL.bone); P(13, 1, 1, 2, PAL.ash);
    if (dir === 0) { P(5, 4, 6, 1, PAL.black); P(6, 4, 1, 1, PAL.purpleL); P(9, 4, 1, 1, PAL.purpleL); P(7, 5, 2, 2, PAL.black); }
    else if (dir === 2) { P(8, 4, 4, 1, PAL.black); P(10, 4, 1, 1, PAL.purpleL); }
  }
  if (big && dir === 1) { P(4, 9, 8, 10, PAL.purple); P(4, 9, 8, 1, PAL.ink); P(5, 18, 1, 1, PAL.ink); P(9, 18, 1, 1, PAL.ink); P(7, 10, 2, 6, PAL.dusk); }
  outline(c);
  return c;
}

const SPRITE_CACHE = new Map<string, SpriteSet>();
function getSprites(kind: BodyKind, v: number): SpriteSet {
  const human = kind === "hero" || kind === "inf" || kind === "arch";
  const key = kind + ":" + (human || kind === "skel" ? v % 64 : 0);
  let s = SPRITE_CACHE.get(key);
  if (s) return s;
  const frames = [0, 1, 2].map((d) => [0, 1, 2].map((f) => human ? drawHuman(kind, v % 64, d, f) : drawUndead(kind, v % 64, d, f)));
  s = { frames, white: frames.map((r) => r.map(whiteOf)), w: frames[0][0].width, h: frames[0][0].height };
  SPRITE_CACHE.set(key, s);
  return s;
}

// ---------- Otoczenie ----------
let BONES: HTMLCanvasElement;
let TREES: HTMLCanvasElement[] = [];
let ROCKS: HTMLCanvasElement[] = [];
let BUSH: HTMLCanvasElement;
let TUFTS: HTMLCanvasElement[] = [];

function buildSprites() {
  const P = (g: CanvasRenderingContext2D) => (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  {
    const [c, g] = mkCanvas(14, 7); const p = P(g);
    p(1, 4, 10, 1, PAL.bone); p(3, 2, 1, 4, PAL.bone); p(8, 3, 4, 1, PAL.boneHi);
    p(9, 1, 4, 3, PAL.bone); p(10, 2, 1, 1, PAL.black); p(5, 5, 6, 1, PAL.ash); p(2, 5, 2, 1, PAL.bone);
    outline(c); BONES = c;
  }
  const blob = (p: any, cx: number, cy: number, r: number, col: string, ry = r) => {
    for (let y = -ry; y <= ry; y++) for (let x = -r; x <= r; x++)
      if ((x * x) / (r * r) + (y * y) / (ry * ry) <= 1 + rnd() * 0.25) p(cx + x, cy + y, 1, 1, col);
  };
  // drzewo liściaste, ciemne
  {
    const [c, g] = mkCanvas(32, 42); const p = P(g);
    p(14, 25, 4, 15, PAL.woodD); p(15, 25, 1, 14, PAL.wood); p(12, 39, 8, 2, PAL.woodD); p(17, 30, 3, 1, PAL.woodD);
    blob(p, 16, 16, 12, PAL.grassD, 11); blob(p, 13, 13, 8, PAL.grass, 7); blob(p, 20, 18, 7, PAL.grass, 6);
    blob(p, 11, 9, 4, PAL.grassL); blob(p, 18, 12, 3, PAL.grassL); blob(p, 15, 23, 5, PAL.grassD, 3);
    for (let i = 0; i < 25; i++) p(6 + (rnd() * 20) | 0, 6 + (rnd() * 18) | 0, 1, 1, chance(0.5) ? PAL.moss : PAL.grassD);
    outline(c); TREES.push(c);
  }
  // martwe drzewo
  {
    const [c, g] = mkCanvas(30, 40); const p = P(g);
    p(13, 14, 3, 25, PAL.woodD); p(14, 14, 1, 24, PAL.wood); p(11, 38, 7, 1, PAL.woodD);
    pxLine(g, 14, 20, 6, 10, PAL.woodD); pxLine(g, 15, 17, 23, 7, PAL.woodD); pxLine(g, 14, 14, 13, 3, PAL.woodD);
    pxLine(g, 9, 13, 5, 13, PAL.woodD); pxLine(g, 20, 10, 25, 11, PAL.woodD); pxLine(g, 13, 7, 10, 4, PAL.woodD);
    pxLine(g, 15, 26, 21, 22, PAL.woodD);
    outline(c); TREES.push(c);
  }
  // sosna
  {
    const [c, g] = mkCanvas(24, 44); const p = P(g);
    p(11, 34, 3, 9, PAL.woodD); p(12, 34, 1, 8, PAL.wood);
    for (let i = 0; i < 5; i++) {
      const y = 4 + i * 6, w = 3 + i * 2;
      for (let r = 0; r < 8; r++) { const ww = Math.round((w * r) / 7); p(12 - ww, y + r, ww * 2 + 1, 1, r < 2 ? PAL.grass : PAL.grassD); }
      p(12 - Math.round(w / 2), y + 3, 1, 1, PAL.grassL);
    }
    outline(c); TREES.push(c);
  }
  // skały
  for (let k = 0; k < 2; k++) {
    const [c, g] = mkCanvas(16, 11); const p = P(g);
    if (k === 0) { p(2, 3, 11, 7, PAL.stone); p(3, 2, 8, 2, PAL.ash); p(10, 5, 3, 5, PAL.slate); p(2, 9, 11, 1, PAL.slate); p(4, 3, 2, 1, PAL.bone); p(6, 6, 1, 1, PAL.slate); }
    else { p(1, 5, 7, 5, PAL.stone); p(2, 4, 5, 1, PAL.ash); p(8, 3, 6, 7, PAL.slate); p(9, 2, 4, 2, PAL.stone); p(10, 2, 1, 1, PAL.ash); p(1, 9, 13, 1, PAL.dusk); p(3, 6, 1, 1, PAL.moss); }
    outline(c); ROCKS.push(c);
  }
  {
    const [c, g] = mkCanvas(14, 9); const p = P(g);
    p(1, 3, 12, 6, PAL.grassD); p(3, 1, 8, 3, PAL.grass); p(4, 2, 3, 1, PAL.moss); p(9, 4, 2, 2, PAL.grassL); p(6, 5, 1, 1, PAL.bloodL);
    outline(c); BUSH = c;
  }
  // kępki trawy i kwiatki (bez obrysu)
  for (let k = 0; k < 4; k++) {
    const [c, g] = mkCanvas(7, 5); const p = P(g);
    const col = k === 3 ? PAL.dirtL : PAL.grassL;
    p(1, 2, 1, 3, col); p(3, 0, 1, 5, PAL.moss); p(5, 1, 1, 4, col); p(2, 3, 1, 2, PAL.grass);
    if (k === 1) p(3, 0, 1, 1, PAL.bone);
    if (k === 2) p(5, 1, 1, 1, PAL.gold);
    TUFTS.push(c);
  }
}

// Linia pikselowa (Bresenham) – broń, strzały, łuki.
function pxLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = col;
  for (let i = 0; i < 80; i++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

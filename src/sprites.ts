// Postacie rysowane kodem, piksel po pikselu. Kierunki: 0 = w dół, 1 = w górę, 2 = w bok (prawo; lewo to odbicie).

type BodyKind = "hero" | "inf" | "arch" | "skel" | "skelArch" | "dk";
type Frames = HTMLCanvasElement[][]; // [kierunek][klatka]

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
  const solid = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && d[(y * w + x) * 4 + 3] > 0;
  const add: number[] = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (solid(x, y)) continue;
    if (solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1)) add.push(x, y);
  }
  for (let i = 0; i < add.length; i += 2) {
    const k = (add[i + 1] * w + add[i]) * 4;
    d[k] = 13; d[k + 1] = 11; d[k + 2] = 14; d[k + 3] = 220;
  }
  g.putImageData(im, 0, 0);
}

interface Look {
  w: number; h: number;
  head: "helm" | "hood" | "crest" | "skull" | "skullHood" | "horned";
  body: "tabard" | "ribs" | "plate";
  main: string; trim: string; legs: string; cape?: string;
}

const LOOKS: Record<BodyKind, Look> = {
  hero: { w: 16, h: 22, head: "crest", body: "tabard", main: PAL.red, trim: PAL.gold, legs: PAL.steelD, cape: PAL.red },
  inf: { w: 16, h: 22, head: "helm", body: "tabard", main: PAL.red, trim: PAL.redL, legs: PAL.dirt },
  arch: { w: 16, h: 22, head: "hood", body: "tabard", main: PAL.moss, trim: PAL.red, legs: PAL.dirtD },
  skel: { w: 16, h: 22, head: "skull", body: "ribs", main: PAL.bone, trim: PAL.dusk, legs: PAL.bone },
  skelArch: { w: 16, h: 22, head: "skullHood", body: "ribs", main: PAL.bone, trim: PAL.purple, legs: PAL.bone },
  dk: { w: 20, h: 27, head: "horned", body: "plate", main: PAL.ink, trim: PAL.purple, legs: PAL.slate, cape: PAL.purple },
};

function drawBody(kind: BodyKind, dir: number, frame: number): HTMLCanvasElement {
  const L = LOOKS[kind];
  const [c, g] = mkCanvas(L.w, L.h);
  const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
  const big = kind === "dk";
  const ox = big ? 2 : 0, oy = big ? 3 : 0;          // przesunięcie dla większej postaci
  const P = (x: number, y: number, w: number, h: number, col: string) => p(x + ox, y + oy, w, h, col);
  const bony = L.body === "ribs";
  const lift = (leg: number) => (frame === 1 && leg === 0) || (frame === 2 && leg === 1) ? 1 : 0;

  // Peleryna za plecami
  if (L.cape && dir !== 1) {
    if (dir === 0) { P(3, 9, 10, 9, PAL.bloodD); }
    else { P(3, 9, 3, 9, L.cape === PAL.purple ? PAL.purple : PAL.bloodD); }
  }

  // Nogi
  if (dir === 2) {
    const fx = frame === 1 ? 9 : frame === 2 ? 5 : 7;
    const bx = frame === 1 ? 5 : frame === 2 ? 9 : 7;
    if (bony) { P(bx, 16, 1, 4, PAL.boneHi); P(fx + 1, 16, 1, 4, L.legs); P(fx, 20, 3, 1, L.legs); P(bx, 20, 2, 1, PAL.bone); }
    else { P(bx, 16, 2, 4, PAL.ink); P(fx, 16, 2, 4, L.legs); P(fx, 19, 3, 2, PAL.woodD); P(bx, 19, 2, 2, PAL.black); }
  } else {
    for (let leg = 0; leg < 2; leg++) {
      const x = leg === 0 ? 5 : 9, up = lift(leg);
      if (bony) { P(x + (leg ? 0 : 1), 16, 1, 4 - up, L.legs); P(x, 20 - up, 2, 1, L.legs); }
      else { P(x, 16, 2, 4 - up, L.legs); P(x, 19 - up, 2, 2, PAL.woodD); }
    }
  }

  // Tułów
  if (L.body === "tabard") {
    if (dir === 2) {
      P(5, 9, 6, 7, L.main); P(5, 9, 1, 7, PAL.ink);
      P(5, 14, 6, 1, PAL.woodD); P(6, 14, 1, 1, PAL.gold);
      P(7, 10, 2, 5, PAL.steel); P(7, 14, 2, 1, PAL.skin);       // ramię z przodu
      P(5, 9, 6, 1, PAL.steelD);
    } else {
      P(4, 9, 8, 7, dir === 1 ? PAL.steelD : PAL.steel);
      P(5, 10, 6, 6, L.main);
      if (dir === 0) { P(7, 10, 2, 6, L.trim); }
      P(4, 14, 8, 1, PAL.woodD); P(7, 14, 2, 1, PAL.gold);
      P(3, 10, 1, 4, PAL.steel); P(12, 10, 1, 4, PAL.steel);   // ramiona
      P(3, 14, 1, 1, PAL.skin); P(12, 14, 1, 1, PAL.skin);
      P(4, 9, 1, 1, PAL.steelL); P(11, 9, 1, 1, PAL.steelL);
    }
  } else if (L.body === "ribs") {
    if (dir === 2) {
      P(7, 9, 2, 6, PAL.bone); P(6, 10, 4, 1, PAL.bone); P(6, 12, 4, 1, PAL.bone);
      P(5, 15, 5, 1, PAL.bone); P(8, 10, 1, 5, PAL.boneHi);
      P(4, 12, 2, 4, L.trim);                                       // łachmany
    } else {
      P(7, 9, 2, 6, PAL.bone);
      for (const y of [10, 12]) P(5, y, 6, 1, PAL.bone);
      P(5, 11, 1, 1, PAL.bone); P(10, 11, 1, 1, PAL.bone);
      P(5, 15, 6, 1, PAL.bone);
      P(4, 10, 1, 5, PAL.bone); P(11, 10, 1, 5, PAL.bone);       // ramiona
      P(4, 13, 2, 4, L.trim); P(10, 13, 2, 4, L.trim);
    }
  } else {
    // zbroja płytowa Rycerza Śmierci
    if (dir === 2) {
      P(4, 8, 8, 8, L.main); P(4, 8, 8, 1, PAL.slate); P(10, 9, 1, 6, PAL.slate);
      P(6, 9, 3, 6, PAL.slate); P(6, 14, 3, 1, PAL.purpleL);
    } else {
      P(3, 8, 10, 8, L.main);
      P(2, 8, 3, 3, PAL.slate); P(11, 8, 3, 3, PAL.slate);       // naramienniki
      P(2, 8, 3, 1, PAL.stone); P(11, 8, 3, 1, PAL.stone);
      if (dir === 0) { P(6, 9, 4, 6, PAL.slate); P(7, 10, 2, 4, PAL.purple); }
      P(3, 14, 10, 1, PAL.purple);
      P(2, 11, 2, 4, PAL.slate); P(12, 11, 2, 4, PAL.slate);
    }
  }

  // Głowa
  const H = L.head;
  if (H === "skull" || H === "skullHood") {
    P(5, 2, 6, 6, PAL.bone); P(6, 2, 4, 1, PAL.boneHi); P(5, 8, 6, 1, PAL.bone);
    if (dir === 0) {
      P(6, 5, 1, 2, PAL.black); P(9, 5, 1, 2, PAL.black);
      P(6, 5, 1, 1, PAL.purpleL); P(9, 5, 1, 1, PAL.purpleL);
      P(6, 8, 1, 1, PAL.black); P(8, 8, 1, 1, PAL.black);
    } else if (dir === 2) {
      P(9, 5, 1, 2, PAL.black); P(9, 5, 1, 1, PAL.purpleL); P(9, 8, 1, 1, PAL.black);
    } else { P(5, 6, 6, 1, PAL.bone); P(7, 3, 2, 1, PAL.ash); }
    if (H === "skullHood") {
      P(4, 1, 8, 2, PAL.purple); P(4, 3, 1, 5, PAL.purple); P(11, 3, 1, 5, PAL.purple);
      if (dir === 1) P(5, 3, 6, 5, PAL.purple);
    }
  } else if (H === "horned") {
    P(4, 1, 8, 7, PAL.slate); P(5, 1, 6, 1, PAL.stone);
    P(2, 0, 2, 1, PAL.bone); P(2, 1, 1, 2, PAL.bone); P(12, 0, 2, 1, PAL.bone); P(13, 1, 1, 2, PAL.bone);
    if (dir === 0) { P(5, 4, 6, 1, PAL.black); P(6, 4, 1, 1, PAL.purpleL); P(9, 4, 1, 1, PAL.purpleL); P(7, 5, 2, 2, PAL.black); }
    else if (dir === 2) { P(8, 4, 4, 1, PAL.black); P(10, 4, 1, 1, PAL.purpleL); }
  } else {
    // ludzka głowa
    if (dir === 1) {
      P(5, 3, 6, 6, H === "hood" ? L.trim : PAL.steelD);
    } else if (dir === 2) {
      P(6, 4, 5, 5, PAL.skin); P(9, 6, 1, 1, PAL.black); P(10, 7, 1, 1, PAL.skinD);
      P(5, 4, 2, 5, H === "hood" ? L.trim : PAL.steelD);
    } else {
      P(5, 4, 6, 5, PAL.skin); P(6, 6, 1, 1, PAL.black); P(9, 6, 1, 1, PAL.black);
      P(7, 8, 2, 1, PAL.skinD);
    }
    if (H === "helm" || H === "crest") {
      P(5, 2, 6, 3, PAL.steel); P(6, 1, 4, 1, PAL.steel); P(6, 1, 2, 1, PAL.steelL);
      if (dir === 0) P(7, 5, 2, 2, PAL.steelD);
      if (dir === 2) P(10, 4, 1, 3, PAL.steelD);
      if (H === "crest") { P(7, 0, 2, 1, PAL.gold); P(8, -0, 1, 1, PAL.redL); if (dir === 2) P(5, 0, 3, 1, PAL.redL); else P(7, 0, 2, 1, PAL.redL); }
    } else if (H === "hood") {
      P(5, 2, 6, 2, L.trim); P(6, 1, 4, 1, L.trim);
      if (dir !== 1) { P(5, 4, 1, 4, L.trim); P(10, 4, 1, 4, L.trim); }
    }
  }
  // Peleryna na plecach (widok z tyłu)
  if (L.cape && dir === 1) { P(4, 9, 8, 9, L.cape); P(4, 9, 8, 1, PAL.ink); P(5, 17, 1, 1, PAL.ink); P(9, 17, 1, 1, PAL.ink); }

  outline(c);
  return c;
}

const SPRITES = {} as Record<BodyKind, Frames>;
let BONES: HTMLCanvasElement;
let TREE: HTMLCanvasElement;
let ROCK: HTMLCanvasElement;
let BUSH: HTMLCanvasElement;

function buildSprites() {
  (Object.keys(LOOKS) as BodyKind[]).forEach((k) => {
    SPRITES[k] = [0, 1, 2].map((d) => [0, 1, 2].map((f) => drawBody(k, d, f)));
  });
  // kupka kości
  {
    const [c, g] = mkCanvas(14, 7);
    const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    p(1, 4, 10, 1, PAL.bone); p(3, 2, 1, 4, PAL.bone); p(8, 3, 4, 1, PAL.boneHi);
    p(9, 1, 4, 3, PAL.bone); p(10, 2, 1, 1, PAL.black); p(5, 5, 6, 1, PAL.ash); p(2, 5, 2, 1, PAL.bone);
    outline(c); BONES = c;
  }
  // drzewo: martwy, ponury las
  {
    const [c, g] = mkCanvas(30, 40);
    const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    p(13, 24, 4, 14, PAL.woodD); p(14, 24, 1, 13, PAL.wood); p(11, 37, 8, 2, PAL.woodD);
    const blob = (cx: number, cy: number, r: number, col: string) => {
      for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++)
        if (x * x + y * y <= r * r + rnd() * r) p(cx + x, cy + y, 1, 1, col);
    };
    blob(15, 15, 11, PAL.grassD); blob(12, 12, 8, PAL.grass); blob(18, 17, 7, PAL.grass);
    blob(11, 9, 4, PAL.grassL); blob(17, 13, 3, PAL.grassL); blob(14, 22, 4, PAL.grassD);
    outline(c); TREE = c;
  }
  {
    const [c, g] = mkCanvas(14, 10);
    const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    p(2, 3, 10, 6, PAL.stone); p(3, 2, 7, 2, PAL.ash); p(9, 5, 3, 4, PAL.slate); p(2, 8, 10, 1, PAL.slate); p(4, 3, 2, 1, PAL.bone);
    outline(c); ROCK = c;
  }
  {
    const [c, g] = mkCanvas(14, 9);
    const p = (x: number, y: number, w: number, h: number, col: string) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    p(1, 3, 12, 6, PAL.grassD); p(3, 1, 8, 3, PAL.grass); p(4, 2, 3, 1, PAL.moss); p(9, 4, 2, 2, PAL.grassL);
    outline(c); BUSH = c;
  }
}

// Linia pikselowa (Bresenham) – broń, strzały, łuki.
function pxLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), sx = x0 < x1 ? 1 : -1, dy = -Math.abs(y1 - y0), sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  g.fillStyle = col;
  for (let i = 0; i < 64; i++) {
    g.fillRect(x0, y0, 1, 1);
    if (x0 === x1 && y0 === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
  }
}

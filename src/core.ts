// Rdzeń: paleta, matematyka, losowość, wejście, dźwięk.

// Rozdzielczość gry zmienia się z przybliżeniem (kółko myszy), 16:9.
let W = 480, H = 270;
// Rozdzielczość wewnętrzna: szerokości stałe, wysokość z proporcji okna (gra wypełnia cały ekran).
let ASPECT = 9 / 16;
const ZOOMS: [number, number][] = [[384, 216], [480, 270], [640, 360], [800, 450], [960, 540], [1120, 630], [1280, 720]];

// Stała, zgniła paleta (Build B4): oliwki, brązy, szarości, mocny kontrast. 35 kolorów.
const PAL = {
  black: "#0a0908", ink: "#15120e", dusk: "#221d18", slate: "#332e28",
  stone: "#4c463e", ash: "#746c62", bone: "#ada28a", boneHi: "#d2c7ad",
  grassD: "#181b12", grass: "#252818", grassL: "#343722", moss: "#4c4c2e",
  dirtD: "#281f16", dirt: "#3f3125", dirtL: "#5b4734",
  bloodD: "#360c0b", blood: "#5e1716", bloodL: "#8a2a20",
  skin: "#a67759", skinD: "#6c4935",
  steelD: "#393b3f", steel: "#5f636a", steelL: "#92969c",
  woodD: "#372818", wood: "#573e26",
  red: "#6e2525", redL: "#954030", gold: "#a2822f", goldD: "#6a5423",
  purple: "#462750", purpleL: "#865ea3", white: "#ded7c6",
  water: "#1f2a2b", waterL: "#334342", rust: "#6b3a20",
};

type V = { x: number; y: number };
const clamp = (a: number, lo: number, hi: number) => (a < lo ? lo : a > hi ? hi : a);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const dist = (ax: number, ay: number, bx: number, by: number) => Math.hypot(bx - ax, by - ay);
function angDiff(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

let _seed = (Date.now() ^ 0x9e3779b9) >>> 0;
function rnd() {
  _seed = (_seed + 0x6d2b79f5) >>> 0;
  let t = _seed;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const rr = (a: number, b: number) => a + rnd() * (b - a);
const chance = (p: number) => rnd() < p;
function pick<T>(a: T[]): T { return a[Math.floor(rnd() * a.length)]; }

// ---------- Wejście ----------
class Input {
  keys = new Set<string>();
  pressed = new Set<string>();
  mx = W / 2; my = H / 2;            // pozycja kursora w pikselach gry
  down = [false, false, false];
  mPressed = [false, false, false];
  mReleased = [false, false, false];
  motion: { x: number; y: number; t: number }[] = [];
  canvas: HTMLCanvasElement;
  wheel = 0;

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const block = ["Space", "Tab", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "F1", "F2", "F3", "F4", "F5"];
    addEventListener("keydown", (e) => {
      if (block.includes(e.code)) e.preventDefault();
      if (!this.keys.has(e.code)) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("blur", () => { this.keys.clear(); this.down = [false, false, false]; });
    canvas.addEventListener("contextmenu", (e) => e.preventDefault());
    addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      this.mx = ((e.clientX - r.left) / r.width) * W;
      this.my = ((e.clientY - r.top) / r.height) * H;
      this.motion.push({ x: e.movementX, y: e.movementY, t: performance.now() });
      if (this.motion.length > 64) this.motion.shift();
    });
    canvas.addEventListener("wheel", (e) => { e.preventDefault(); this.wheel += Math.sign(e.deltaY); }, { passive: false });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button > 2) return;
      if (e.button === 1) e.preventDefault();
      this.down[e.button] = true; this.mPressed[e.button] = true;
    });
    addEventListener("mouseup", (e) => {
      if (e.button > 2) return;
      if (this.down[e.button]) this.mReleased[e.button] = true;
      this.down[e.button] = false;
    });
  }
  // Suma ruchów myszy z ostatnich `ms` milisekund (w pikselach ekranu).
  gesture(ms = 160): V {
    const now = performance.now();
    let x = 0, y = 0;
    for (const m of this.motion) if (now - m.t < ms) { x += m.x; y += m.y; }
    return { x, y };
  }
  hit(code: string) { return this.pressed.has(code); }
  held(code: string) { return this.keys.has(code); }
  endFrame() {
    this.wheel = 0;
    this.pressed.clear();
    this.mPressed = [false, false, false];
    this.mReleased = [false, false, false];
  }
}


// Szum wartości (teren, mgła).
function hashN(x: number, y: number) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = x / s - xi, fy = y / s - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hashN(xi, yi), hashN(xi + 1, yi), sx), lerp(hashN(xi, yi + 1), hashN(xi + 1, yi + 1), sx), sy);
}

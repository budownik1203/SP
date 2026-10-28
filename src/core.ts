// Rdzeń: paleta, matematyka, losowość, wejście, dźwięk.

// Rozdzielczość gry zmienia się z przybliżeniem (kółko myszy), 16:9.
let W = 480, H = 270;
const ZOOMS = [[384, 216], [480, 270], [640, 360]];

// Stała, ponura paleta (32 kolory).
const PAL = {
  black: "#0d0b0e", ink: "#1a1620", dusk: "#2a2433", slate: "#3d3a4b",
  stone: "#5c5a6a", ash: "#8a8794", bone: "#c9c0a8", boneHi: "#e6dfc9",
  grassD: "#1c2619", grass: "#28351f", grassL: "#37462a", moss: "#4f5a37",
  dirtD: "#33291f", dirt: "#4f3d2e", dirtL: "#6e5841",
  bloodD: "#3f0c0f", blood: "#701719", bloodL: "#a12b26",
  skin: "#c08d6c", skinD: "#86593f",
  steelD: "#474c5a", steel: "#767e8e", steelL: "#adb4c1",
  woodD: "#44301f", wood: "#6a4a2d",
  red: "#86292a", redL: "#b1443a", gold: "#c39a42", goldD: "#86682b",
  purple: "#55296a", purpleL: "#a066cc", white: "#f0e9da",
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
    const block = ["Space", "Tab", "Backspace", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
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


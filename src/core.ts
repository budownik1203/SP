// Rdzeń: paleta, matematyka, losowość, wejście, dźwięk.

const W = 480, H = 270;

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

  attach(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const block = ["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"];
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
    this.pressed.clear();
    this.mPressed = [false, false, false];
    this.mReleased = [false, false, false];
  }
}

// ---------- Dźwięk generowany ----------
class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode;
  noiseBuf: AudioBuffer;
  last: Record<string, number> = {};
  volume = 0.55;

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      this.ctx = new AudioContext();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      const comp = this.ctx.createDynamicsCompressor();
      this.master.connect(comp); comp.connect(this.ctx.destination);
      const len = this.ctx.sampleRate;
      this.noiseBuf = this.ctx.createBuffer(1, len, len);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  }
  private ok(name: string, gapMs: number) {
    if (!this.ctx) return false;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < gapMs) return false;
    this.last[name] = now;
    return true;
  }
  private env(g: GainNode, peak: number, dur: number, attack = 0.004) {
    const t = this.ctx.currentTime;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  noise(dur: number, f0: number, f1: number, q: number, peak: number, type: BiquadFilterType = "bandpass", pan = 0) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    s.playbackRate.value = rr(0.8, 1.2);
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); this.env(g, peak, dur);
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    s.connect(f); f.connect(g); g.connect(p); p.connect(this.master);
    s.start(t, rnd() * 0.5); s.stop(t + dur + 0.05);
  }
  tone(f0: number, f1: number, dur: number, type: OscillatorType, peak: number, pan = 0) {
    const c = this.ctx, t = c.currentTime;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this.env(g, peak, dur);
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    o.connect(g); g.connect(p); p.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // Głośność i panorama zależą od odległości od kamery.
  spatial(x: number, cam: V): { v: number; pan: number } {
    const dx = x - (cam.x + W / 2);
    return { v: clamp(1 - Math.abs(dx) / 500, 0.15, 1), pan: dx / 300 };
  }
  swing(v = 1, pan = 0) { if (!this.ok("swing", 40)) return; this.noise(0.16, 600, 2400, 1.2, 0.25 * v, "bandpass", pan); }
  hit(v = 1, pan = 0) {
    if (!this.ok("hit", 30)) return;
    this.tone(150, 45, 0.16, "sine", 0.7 * v, pan);
    this.noise(0.1, 1400, 300, 0.8, 0.45 * v, "bandpass", pan);
  }
  heavy(v = 1, pan = 0) {
    if (!this.ok("heavy", 60)) return;
    this.tone(110, 35, 0.3, "sine", 0.9 * v, pan);
    this.noise(0.18, 900, 120, 0.7, 0.6 * v, "lowpass", pan);
  }
  clang(v = 1, pan = 0) {
    if (!this.ok("clang", 35)) return;
    const b = rr(1500, 1900);
    this.tone(b, b * 0.97, 0.35, "triangle", 0.28 * v, pan);
    this.tone(b * 1.51, b * 1.48, 0.25, "square", 0.06 * v, pan);
    this.noise(0.06, 5000, 3000, 1, 0.35 * v, "highpass", pan);
  }
  parry() {
    if (!this.ctx) return;
    this.tone(2200, 2100, 0.6, "triangle", 0.35);
    this.tone(3300, 3200, 0.45, "sine", 0.15);
    this.noise(0.08, 6000, 4000, 1, 0.5, "highpass");
  }
  thunk(v = 1, pan = 0) { if (!this.ok("thunk", 30)) return; this.tone(240, 90, 0.12, "triangle", 0.45 * v, pan); this.noise(0.06, 800, 400, 1, 0.3 * v, "bandpass", pan); }
  bow(v = 1, pan = 0) { if (!this.ok("bow", 25)) return; this.tone(260, 170, 0.18, "triangle", 0.25 * v, pan); this.noise(0.05, 3000, 1500, 2, 0.12 * v, "bandpass", pan); }
  bone(v = 1, pan = 0) {
    if (!this.ok("bone", 30)) return;
    this.noise(0.09, 3200, 1800, 3, 0.45 * v, "bandpass", pan);
    this.tone(700, 300, 0.05, "square", 0.08 * v, pan);
  }
  kick() { if (!this.ok("kick", 50)) return; this.tone(95, 40, 0.14, "sine", 0.9); this.noise(0.08, 500, 150, 1, 0.4, "lowpass"); }
  death(v = 1, pan = 0) {
    if (!this.ok("death", 120)) return;
    this.tone(rr(170, 220), 70, 0.55, "sawtooth", 0.08 * v, pan);
  }
  shout(v = 1) {
    if (!this.ok("shout", 400)) return;
    const c = this.ctx, t = c.currentTime;
    for (let i = 0; i < 4; i++) {
      const o = c.createOscillator(); o.type = "sawtooth";
      const f0 = rr(110, 170);
      o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f0 * 1.35, t + 0.25);
      o.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.7);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rr(600, 900); bp.Q.value = 3;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.05 * v, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8);
      o.connect(bp); bp.connect(g); g.connect(this.master); o.start(t + i * 0.03); o.stop(t + 0.9);
    }
  }
  wail() {
    if (!this.ctx) return;
    this.tone(420, 90, 1.6, "sawtooth", 0.08);
    this.tone(300, 60, 1.8, "sine", 0.2);
  }
}

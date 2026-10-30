// Interfejs okien (DOM nad płótnem): ekrany, przyciski z akcjami, portrety i ilustracje miejsc rysowane kodem.

type Acts = Record<string, (v: string) => void>;
const PICS = new Map<string, HTMLCanvasElement>();
let picN = 0;
function pic(c: HTMLCanvasElement, cls = "pic", scale = 0) {
  const k = "p" + picN++;
  PICS.set(k, c);
  return `<span class="${cls}" data-pic="${k}"${scale ? ` style="--w:${c.width * scale}px"` : ""}></span>`;
}
function esc(s: string) { return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])); }

class Win {
  el: HTMLElement;
  acts: Acts = {};
  onClose: (() => void) | null = null;
  constructor(public root: HTMLElement, cls: string) {
    this.el = document.createElement("div");
    this.el.className = "win " + cls;
    root.appendChild(this.el);
    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest("[data-a]") as HTMLElement | null;
      if (!b || (b as HTMLButtonElement).disabled) return;
      const f = this.acts[b.dataset.a];
      if (f) { sfxUi(); f(b.dataset.v || ""); }
    });
    // przeciąganie (np. towary na targu): data-drag="akcja:wartość" upuszczone na data-drop="akcja"
    this.el.addEventListener("dragstart", (e) => { const d = (e.target as HTMLElement).closest("[data-drag]") as HTMLElement | null; if (d && e.dataTransfer) e.dataTransfer.setData("text/plain", d.dataset.drag); });
    this.el.addEventListener("dragover", (e) => { if ((e.target as HTMLElement).closest("[data-drop]")) e.preventDefault(); });
    this.el.addEventListener("drop", (e) => {
      const z = (e.target as HTMLElement).closest("[data-drop]") as HTMLElement | null; if (!z || !e.dataTransfer) return;
      e.preventDefault(); const [a, v] = e.dataTransfer.getData("text/plain").split(":");
      if (a === z.dataset.drop && this.acts[a]) { sfxUi(); this.acts[a](`${v}:${e.ctrlKey || e.shiftKey ? 5 : 1}`); }
    });
    this.el.addEventListener("input", (e) => {
      const t = e.target as HTMLInputElement;
      if (t.dataset.in && this.acts[t.dataset.in]) this.acts[t.dataset.in](t.type === "checkbox" ? (t.checked ? "1" : "") : t.value);
    });
  }
  set(html: string, acts: Acts) {
    this.acts = acts;
    this.el.innerHTML = html;
    for (const s of Array.from(this.el.querySelectorAll("[data-pic]"))) { const c = PICS.get((s as HTMLElement).dataset.pic); if (c) { const cc = c.cloneNode() as HTMLCanvasElement; cc.getContext("2d").drawImage(c, 0, 0); s.appendChild(cc); if (SCENE_META.has(c)) animateScene(cc, c); } }
    PICS.clear();
    typeBubble();
    return this;
  }
  close() { this.el.remove(); if (this.onClose) this.onClose(); }
}
let sfxUi: () => void = () => {};

// Okno pełnoekranowe (jedno naraz) i drobne powiadomienia.
let SCREEN: Win | null = null;
function showScr(html: string, acts: Acts, cls = "") {
  const root = document.getElementById("ui");
  const tipEl = document.getElementById("tip"); if (tipEl) tipEl.hidden = true;   // dymek z mapy nie wisi nad oknem
  if (!SCREEN || SCREEN.el.className.replace(" fresh", "") !== "win " + cls) { if (SCREEN) SCREEN.el.remove(); SCREEN = new Win(root, cls); const el = SCREEN.el; el.classList.add("fresh"); setTimeout(() => el.classList.remove("fresh"), 260); }
  SCREEN.set(html, acts);
  return SCREEN;
}
function closeScreen() { if (SCREEN) { SCREEN.el.remove(); SCREEN = null; } }
function screenOpen() { return !!SCREEN; }

// Dziennik powiadomień: każdy komunikat z mapy trafia tu z datą.
const TOASTLOG: { t: string; c?: string; d: number; h: number }[] = [];
let toastStamp: () => [number, number] = () => [0, 0];
function toast(text: string, col?: string) {
  const [d0, h0] = toastStamp();
  if (!TOASTLOG.length || TOASTLOG[TOASTLOG.length - 1].t !== text) { TOASTLOG.push({ t: text, c: col, d: d0, h: h0 }); if (TOASTLOG.length > 300) TOASTLOG.shift(); }
  const box = document.getElementById("toasts");
  if (!box) return;
  const d = document.createElement("div");
  d.className = "toast";
  d.textContent = text;
  if (col) d.style.color = col;
  box.appendChild(d);
  while (box.children.length > 6) box.firstElementChild.remove();
  setTimeout(() => d.classList.add("out"), 6000);
  setTimeout(() => d.remove(), 7000);
}

function barHtml(v: number, max: number, cls: string, label = "") { return `<div class="bar ${cls}"><i style="width:${clamp((v / Math.max(1, max)) * 100, 0, 100)}%"></i>${label ? `<b>${label}</b>` : ""}</div>`; }

// ---------- Ilustracje miejsc ----------
const SCENE_CACHE = new Map<string, HTMLCanvasElement>();
interface SceneMeta { houses: [number, number, number, number][]; figs: [number, number, string, boolean, boolean][]; fires: [number, number][]; night: boolean; indoor: boolean; kind: string; culture: string; extra: number; }
function drawSceneBase(kind: string, seed: number, culture: Culture | string, night: boolean, extra: number, M: SceneMeta): HTMLCanvasElement {
  const Wd = 200, Hd = 84;
  const [c, g] = mkCanvas(Wd, Hd);
  const save = _seed;
  _seed = (seed * 9301 + 49297) >>> 0;
  const undead = culture === "undead", dwarf = culture === "dwarf", orc = culture === "orc";
  const sky = night ? [PAL.black, PAL.ink, PAL.dusk] : undead ? [PAL.dusk, PAL.slate, PAL.stone] : [PAL.slate, PAL.stone, PAL.ash];
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const dith = (x: number, y: number) => (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
  const indoor = kind === "tavern" || kind === "smith" || kind === "captive";
  if (!indoor) {
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      const t = y / 50 + (vnoise(x + seed, y, 30) - 0.5) * 0.4;
      g.fillStyle = sky[clamp(Math.floor(t * 2.4 + dith(x, y) - 0.3), 0, 2)];
      g.fillRect(x, y, 1, 1);
    }
    // chmury i dym
    g.fillStyle = night ? PAL.dusk : PAL.bone; g.globalAlpha = 0.25;
    for (let k = 0; k < 7; k++) { const cx = rr(0, Wd), cy = rr(4, 24); for (let i = 0; i < 20; i++) g.fillRect(Math.round(cx + rr(-14, 14)), Math.round(cy + rr(-3, 3)), rr(3, 9), 1); }
    g.globalAlpha = 1;
    if (night) { g.fillStyle = PAL.boneHi; g.fillRect(160, 10, 5, 5); g.fillStyle = PAL.ink; g.fillRect(162, 10, 3, 4); for (let k = 0; k < 20; k++) g.fillRect(Math.round(rr(0, Wd)), Math.round(rr(0, 30)), 1, 1); }
    // odległe wzgórza
    for (let x = 0; x < Wd; x++) { const hh = 46 + Math.round(vnoise(x + seed, 0, 40) * 14); g.fillStyle = night ? PAL.ink : PAL.slate; g.fillRect(x, hh, 1, Hd - hh); }
    // ziemia
    for (let y = 58; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      const n = vnoise(x, y + seed, 12);
      const pal = kind === "arena" ? [PAL.dirtL, PAL.bone, PAL.dirt] : undead ? [PAL.dusk, PAL.slate, PAL.stone] : [PAL.dirtD, PAL.dirt, PAL.grass];
      g.fillStyle = pal[clamp(Math.floor(n * 2.4 + dith(x, y) - 0.5), 0, 2)];
      g.fillRect(x, y, 1, 1);
    }
  } else {
    // wnętrze: belki, ściana z desek lub kamienia
    for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) {
      const plank = kind === "captive" ? ((x >> 3) + (y >> 2)) % 5 === 0 : (y % 7 === 0) || ((x + (y >> 3) * 13) % 23 === 0);
      g.fillStyle = y > 62 ? ((x + y) % 9 === 0 ? PAL.dirtD : PAL.woodD) : kind === "captive" ? (plank ? PAL.slate : PAL.stone) : plank ? PAL.woodD : PAL.wood;
      if (y < 62 && dith(x, y) > 0.9 && kind !== "captive") g.fillStyle = PAL.dirtD;
      g.fillRect(x, y, 1, 1);
    }
    g.fillStyle = PAL.woodD; for (let x = 0; x < Wd; x += 40) g.fillRect(x, 0, 4, 62);
    g.fillStyle = PAL.ink; g.fillRect(0, 6, Wd, 3);
  }
  const house = (x: number, y: number, w: number, h: number, roof = undead ? PAL.slate : orc ? PAL.dirt : PAL.red) => {
    M.houses.push([x, y, w, h]);
    g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, w + 2, h + 2);
    g.fillStyle = orc ? PAL.wood : dwarf ? PAL.stone : PAL.bone; g.fillRect(x, y, w, h);
    g.fillStyle = PAL.dirt; for (let k = 0; k < h; k += 4) g.fillRect(x, y + k, w, 1);
    g.fillStyle = PAL.woodD; g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
    for (let k = 0; k < Math.ceil(w / 2) + 1; k++) { g.fillStyle = k % 3 === 0 ? PAL.ink : roof; g.fillRect(x - 2 + k, y - 1 - k, w + 4 - k * 2, 1); }
    g.fillStyle = night ? PAL.gold : PAL.ink; g.fillRect(x + 2, y + 3, 2, 2); if (w > 10) g.fillRect(x + w - 4, y + 3, 2, 2);
    g.fillStyle = PAL.ink; g.fillRect(x + Math.floor(w / 2) - 1, y + h - 5, 3, 5);
  };
  const figure = (x: number, y: number, col: string, hood = false, sword = false) => {
    M.figs.push([x, y, col, hood, sword]); return;   // postacie rysuje warstwa szczegółów w podwójnej rozdzielczości
    g.fillStyle = PAL.ink; g.fillRect(x - 2, y - 11, 5, 12);
    g.fillStyle = col; g.fillRect(x - 1, y - 7, 3, 6);
    g.fillStyle = hood ? col : PAL.skin; g.fillRect(x - 1, y - 10, 3, 3);
    g.fillStyle = PAL.dirtD; g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 1, y - 1, 1, 1);
    if (sword) { g.fillStyle = PAL.steelL; g.fillRect(x + 2, y - 9, 1, 6); }
  };
  const wall = (x0: number, x1: number, y: number, h: number) => {
    g.fillStyle = PAL.ink; g.fillRect(x0 - 1, y - 2, x1 - x0 + 2, h + 2);
    for (let x = x0; x < x1; x++) for (let k = 0; k < h; k++) { g.fillStyle = ((x + (k >> 2) * 3) % 6 === 0 || k % 4 === 0) ? PAL.slate : PAL.stone; g.fillRect(x, y + k, 1, 1); }
    for (let x = x0; x < x1; x += 4) { g.fillStyle = PAL.stone; g.fillRect(x, y - 2, 2, 2); }
  };
  const gallows = (x: number, y: number) => { g.fillStyle = PAL.woodD; g.fillRect(x, y - 22, 2, 22); g.fillRect(x, y - 22, 10, 2); g.fillStyle = PAL.bone; g.fillRect(x + 8, y - 20, 1, 4); g.fillStyle = PAL.dirtD; g.fillRect(x + 7, y - 16, 3, 6); };
  const crow = (x: number, y: number) => { g.fillStyle = PAL.black; g.fillRect(x, y, 3, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x - 1, y - 1, 1, 1); g.fillRect(x + 3, y - 1, 1, 1); };
  const fire = (x: number, y: number) => { M.fires.push([x, y]); g.fillStyle = PAL.woodD; g.fillRect(x - 3, y, 7, 2); g.fillStyle = PAL.redL; g.fillRect(x - 2, y - 3, 5, 3); g.fillStyle = PAL.gold; g.fillRect(x - 1, y - 5, 3, 3); g.fillStyle = PAL.boneHi; g.fillRect(x, y - 4, 1, 2); };
  const pike = (x: number, y: number) => { g.fillStyle = PAL.woodD; g.fillRect(x, y - 16, 1, 16); g.fillStyle = PAL.bone; g.fillRect(x - 1, y - 19, 3, 3); g.fillStyle = PAL.black; g.fillRect(x - 1, y - 18, 1, 1); g.fillRect(x + 1, y - 18, 1, 1); };
  const grave = (x: number, y: number) => { g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 9, 6, 10); g.fillStyle = PAL.stone; g.fillRect(x, y - 8, 4, 8); g.fillStyle = PAL.ash; g.fillRect(x, y - 8, 4, 1); g.fillStyle = PAL.slate; g.fillRect(x + 1, y - 6, 2, 1); };
  const people = undead ? [PAL.bone, PAL.purple, PAL.ash] : orc ? [PAL.moss, PAL.dirt, PAL.bloodD] : [PAL.red, PAL.dirt, PAL.moss, PAL.slate, PAL.bone];

  switch (kind) {
    case "town": {
      wall(0, Wd, 34, 14);
      for (let k = 0; k < 7; k++) house(4 + k * 28 + rr(-3, 3), 30 + rr(-6, 4), 18 + rr(0, 6), 14 + rr(0, 6));
      for (let k = 0; k < 4; k++) house(rr(0, 180), rr(48, 52), 20, 12);
      gallows(150, 70); crow(152, 46); crow(60, 20); crow(66, 22);
      if (extra === 2) { for (let k = 0; k < 5; k++) { g.fillStyle = PAL.ink; g.fillRect(Math.round(rr(6, 190)), Math.round(rr(28, 50)), rr(3, 7), rr(2, 4)); } crow(120, 40); crow(30, 52); }   // bieda: dziury w dachach, wrony
      if (extra === 3) { for (let k = 0; k < 4; k++) { const x = 20 + k * 45; g.fillStyle = PAL.ink; g.fillRect(x - 1, 58, 22, 9); g.fillStyle = pick([PAL.red, PAL.gold, PAL.moss, PAL.purple]); g.fillRect(x, 58, 20, 3); g.fillStyle = PAL.wood; g.fillRect(x, 61, 20, 5); g.fillStyle = PAL.gold; g.fillRect(x + 4, 60, 2, 1); } g.fillStyle = PAL.red; for (let x = 8; x < Wd; x += 24) { g.fillRect(x, 20, 3, 6); } }   // bogactwo: kramy i chorągwie
      for (let k = 0; k < (extra === 2 ? 4 : extra === 3 ? 13 : 9); k++) figure(Math.round(rr(10, 190)), Math.round(rr(68, 82)), pick(people), chance(0.4), chance(0.2));
      pike(22, 80); pike(178, 82);
      break;
    }
    case "village": {
      for (let x = 0; x < Wd; x++) for (let y = 60; y < 70; y += 2) { g.fillStyle = extra ? PAL.ink : PAL.moss; if ((x + y) % 3) g.fillRect(x, y, 1, 1); }
      for (let k = 0; k < 5; k++) house(10 + k * 38 + rr(-4, 4), 44 + rr(-3, 3), 16 + rr(0, 6), 12, orc ? PAL.dirt : PAL.dirtL);
      g.fillStyle = PAL.woodD; for (let x = 0; x < Wd; x += 6) g.fillRect(x, 70, 1, 6); g.fillRect(0, 71, Wd, 1);
      for (let k = 0; k < 5; k++) figure(Math.round(rr(10, 190)), Math.round(rr(76, 83)), pick(people), chance(0.5));
      if (extra) { for (let k = 0; k < 4; k++) { const x = 20 + k * 45; g.fillStyle = PAL.ink; g.fillRect(x, 40, 14, 6); fire(x + 6, 46); } }
      crow(100, 30); crow(108, 26);
      break;
    }
    case "castle": {
      wall(10, 190, 28, 30);
      g.fillStyle = PAL.ink; g.fillRect(78, 4, 44, 56);
      for (let y = 5; y < 58; y++) for (let x = 79; x < 121; x++) { g.fillStyle = (y % 5 === 0 || (x + (y >> 2) * 2) % 7 === 0) ? PAL.slate : PAL.stone; g.fillRect(x, y, 1, 1); }
      for (let x = 79; x < 121; x += 5) { g.fillStyle = PAL.stone; g.fillRect(x, 1, 3, 4); }
      g.fillStyle = PAL.ink; g.fillRect(94, 42, 12, 16); g.fillStyle = night ? PAL.gold : PAL.ink; g.fillRect(90, 16, 3, 5); g.fillRect(107, 16, 3, 5);
      g.fillStyle = PAL.woodD; g.fillRect(99, -2, 1, 8); g.fillStyle = extra ? PAL.purple : PAL.red; g.fillRect(100, -1, 8, 5);
      for (let k = 0; k < 6; k++) figure(Math.round(rr(20, 180)), Math.round(rr(70, 82)), pick(people), false, true);
      gallows(30, 70); pike(170, 80); crow(36, 46);
      break;
    }
    case "tavern": {
      g.fillStyle = PAL.ink; g.fillRect(150, 22, 40, 40); g.fillStyle = PAL.slate; g.fillRect(152, 24, 36, 38);
      fire(170, 58); g.globalAlpha = 0.25; g.fillStyle = PAL.gold; g.fillRect(140, 30, 60, 40); g.globalAlpha = 1;
      for (let k = 0; k < 3; k++) { const x = 18 + k * 44; g.fillStyle = PAL.ink; g.fillRect(x - 1, 62, 32, 6); g.fillStyle = PAL.wood; g.fillRect(x, 63, 30, 3); g.fillStyle = PAL.woodD; g.fillRect(x + 2, 66, 2, 10); g.fillRect(x + 26, 66, 2, 10); g.fillStyle = PAL.gold; g.fillRect(x + 8, 60, 2, 3); g.fillRect(x + 18, 60, 2, 3); figure(x + 4, 76, pick(people), chance(0.5)); figure(x + 24, 76, pick(people), chance(0.5)); }
      for (let k = 0; k < 4; k++) { g.fillStyle = PAL.ink; g.fillRect(4 + k * 9, 40, 8, 12); g.fillStyle = PAL.woodD; g.fillRect(5 + k * 9, 41, 6, 10); g.fillStyle = PAL.wood; g.fillRect(5 + k * 9, 44, 6, 1); }
      g.fillStyle = PAL.bone; g.fillRect(70, 18, 10, 6); g.fillStyle = PAL.ink; g.fillRect(72, 20, 2, 1); g.fillRect(76, 20, 2, 1);
      break;
    }
    case "smith": {
      g.fillStyle = PAL.ink; g.fillRect(120, 30, 50, 34); g.fillStyle = PAL.slate; g.fillRect(122, 32, 46, 32);
      g.fillStyle = PAL.redL; g.fillRect(130, 50, 30, 10); g.fillStyle = PAL.gold; g.fillRect(136, 52, 18, 6); g.fillStyle = PAL.boneHi; g.fillRect(142, 54, 6, 2);
      g.globalAlpha = 0.3; g.fillStyle = PAL.gold; g.fillRect(100, 20, 90, 64); g.globalAlpha = 1;
      g.fillStyle = PAL.ink; g.fillRect(60, 64, 26, 6); g.fillStyle = PAL.steelD; g.fillRect(61, 65, 24, 4); g.fillRect(68, 69, 10, 8);
      figure(90, 80, PAL.dirtD, false, false); g.fillStyle = PAL.steel; g.fillRect(92, 66, 4, 3);
      for (let k = 0; k < 6; k++) { g.fillStyle = PAL.steelL; g.fillRect(10 + k * 7, 16, 1, 22); g.fillStyle = PAL.gold; g.fillRect(9 + k * 7, 36, 3, 1); }
      g.fillStyle = PAL.steel; g.fillRect(64, 20, 12, 12); g.fillRect(84, 20, 10, 14);
      break;
    }
    case "arena": {
      for (let y = 20; y < 56; y++) for (let x = 0; x < Wd; x++) { g.fillStyle = (y % 6 === 0) ? PAL.ink : (y % 6 < 3 ? PAL.stone : PAL.slate); g.fillRect(x, y, 1, 1); }
      for (let k = 0; k < 60; k++) { const x = Math.round(rr(0, Wd)), y = 20 + Math.floor(rr(0, 6)) * 6 - 3; g.fillStyle = pick(people); g.fillRect(x, y, 2, 3); g.fillStyle = PAL.skin; g.fillRect(x, y - 1, 2, 1); }
      g.fillStyle = PAL.woodD; g.fillRect(0, 56, Wd, 3);
      figure(80, 78, PAL.red, false, true); figure(120, 78, PAL.steelD, false, true);
      g.fillStyle = PAL.bloodD; g.fillRect(96, 76, 6, 2);
      break;
    }
    case "ruins": {
      for (let k = 0; k < 6; k++) { const x = 15 + k * 32, hh = Math.round(rr(14, 40)); g.fillStyle = PAL.ink; g.fillRect(x - 1, 62 - hh, 10, hh); g.fillStyle = PAL.stone; g.fillRect(x, 62 - hh, 8, hh); g.fillStyle = PAL.ash; g.fillRect(x, 62 - hh, 2, hh); }
      g.fillStyle = PAL.ink; g.fillRect(80, 52, 40, 12); g.fillStyle = PAL.black; g.fillRect(90, 54, 20, 10);
      crow(40, 20); crow(120, 14); g.fillStyle = PAL.bone; g.fillRect(60, 74, 4, 1); g.fillRect(140, 76, 3, 2);
      break;
    }
    case "shrine": {
      g.fillStyle = PAL.ink; g.fillRect(88, 16, 24, 48); g.fillStyle = PAL.stone; g.fillRect(90, 18, 20, 46); g.fillStyle = PAL.ash; g.fillRect(90, 18, 3, 46);
      g.fillStyle = PAL.gold; g.fillRect(99, 24, 2, 14); g.fillRect(95, 28, 10, 2);
      g.globalAlpha = 0.25; g.fillStyle = PAL.gold; g.fillRect(70, 10, 60, 60); g.globalAlpha = 1;
      for (let k = 0; k < 8; k++) { g.fillStyle = PAL.boneHi; g.fillRect(80 + k * 5, 64, 1, 2); g.fillStyle = PAL.gold; g.fillRect(80 + k * 5, 62, 1, 1); }
      break;
    }
    case "camp": {
      for (let k = 0; k < 4; k++) { const x = 20 + k * 45; for (let j = 0; j < 14; j++) { g.fillStyle = j % 4 === 0 ? PAL.dirtD : PAL.dirt; g.fillRect(x + j, 62 - j, 28 - j * 2, 1); } }
      fire(100, 70); for (let k = 0; k < 6; k++) figure(Math.round(rr(30, 170)), Math.round(rr(74, 82)), pick([PAL.dirt, PAL.dirtD, PAL.ink]), true, chance(0.6));
      pike(10, 78); pike(190, 78);
      break;
    }
    case "cemetery": {
      for (let k = 0; k < 14; k++) grave(Math.round(rr(5, 190)), Math.round(rr(62, 82)));
      g.fillStyle = PAL.woodD; g.fillRect(150, 30, 2, 34); g.fillRect(144, 38, 14, 2);
      for (let k = 0; k < 4; k++) figure(Math.round(rr(20, 180)), Math.round(rr(72, 82)), PAL.bone, false, chance(0.5));
      g.globalAlpha = 0.3; g.fillStyle = PAL.purpleL; g.fillRect(0, 56, Wd, 10); g.globalAlpha = 1;
      crow(60, 28); crow(70, 24);
      break;
    }
    case "lair": {
      g.fillStyle = PAL.ink; g.fillRect(50, 20, 100, 44); g.fillStyle = PAL.slate; g.fillRect(52, 22, 96, 42);
      g.fillStyle = PAL.black; g.fillRect(80, 36, 40, 28); g.fillStyle = PAL.gold; g.fillRect(92, 46, 2, 1); g.fillRect(102, 46, 2, 1);
      for (let k = 0; k < 8; k++) { g.fillStyle = PAL.bone; g.fillRect(Math.round(rr(40, 160)), Math.round(rr(66, 82)), 4, 1); }
      break;
    }
    case "siege": {
      wall(110, 200, 20, 44); g.fillStyle = PAL.woodD; for (let k = 0; k < 3; k++) { g.fillRect(100 - k * 4, 30 + k * 10, 2, 34); }
      for (let k = 0; k < 4; k++) { const x = 10 + k * 22; for (let j = 0; j < 10; j++) { g.fillStyle = j % 3 === 0 ? PAL.dirtD : PAL.dirt; g.fillRect(x + j, 66 - j, 20 - j * 2, 1); } }
      fire(60, 76); fire(150, 18);
      for (let k = 0; k < 6; k++) { const ph = rr(0, 1); g.globalAlpha = 0.4; g.fillStyle = PAL.ash; g.fillRect(150 + rr(-6, 6), Math.round(14 - ph * 14), 3, 3); }
      g.globalAlpha = 1;
      for (let k = 0; k < 5; k++) figure(Math.round(rr(20, 100)), Math.round(rr(74, 82)), pick(people), false, true);
      break;
    }
    case "captive": {
      g.fillStyle = PAL.black; g.fillRect(80, 14, 40, 24); g.fillStyle = PAL.steelD; for (let x = 82; x < 120; x += 6) g.fillRect(x, 14, 2, 24);
      g.globalAlpha = 0.25; g.fillStyle = PAL.boneHi; g.fillRect(84, 38, 30, 30); g.globalAlpha = 1;
      figure(100, 78, PAL.dirtD, false, false);
      g.fillStyle = PAL.steel; g.fillRect(96, 74, 9, 1);
      g.fillStyle = PAL.bone; g.fillRect(30, 76, 6, 2); g.fillRect(160, 78, 4, 1);
      break;
    }
    case "bivouac": {   // obóz drużyny: namioty, ognisko, ludzie wokół ognia, konie, wóz, chorągiew; palisada przy dłuższym postoju
      const tentC = orc ? [PAL.dirtL, PAL.dirt] : dwarf ? [PAL.stone, PAL.slate] : undead ? [PAL.dusk, PAL.ink] : [PAL.bone, PAL.ash];
      const tent = (x: number, y: number, w: number) => { for (let j = 0; j < w / 2; j++) { g.fillStyle = j % 3 === 0 ? tentC[1] : tentC[0]; g.fillRect(x + j, y - j, w - j * 2, 1); } g.fillStyle = PAL.ink; g.fillRect(x + w / 2 - 2, y - 6, 4, 6); g.fillStyle = PAL.woodD; g.fillRect(x + w / 2, y - w / 2 - 2, 1, 3); };
      if (extra === 1) { g.fillStyle = PAL.woodD; for (let x = 0; x < Wd; x += 3) { const hh = 10 + ((x * 7) % 4); g.fillRect(x, 60 - hh, 2, hh); g.fillStyle = PAL.wood; g.fillRect(x, 60 - hh, 1, hh); g.fillStyle = PAL.woodD; } g.fillStyle = PAL.ink; g.fillRect(90, 48, 20, 12); }
      tent(14, 62, 26); tent(52, 58, 22); tent(132, 60, 24); tent(166, 63, 28);
      g.fillStyle = PAL.woodD; g.fillRect(118, 34, 1, 30); g.fillStyle = PAL.red; g.fillRect(119, 35, 10, 7); g.fillRect(119, 42, 7, 2);   // chorągiew
      for (let k = 0; k < 2; k++) { const x = 176 + k * 10; g.fillStyle = PAL.ink; g.fillRect(x - 1, 64, 9, 6); g.fillStyle = k ? PAL.dirt : PAL.woodD; g.fillRect(x, 65, 7, 4); g.fillRect(x + 5, 62, 3, 3); g.fillStyle = PAL.dirtD; g.fillRect(x, 69, 1, 4); g.fillRect(x + 6, 69, 1, 4); }   // konie
      g.fillStyle = PAL.ink; g.fillRect(4, 66, 22, 8); g.fillStyle = PAL.wood; g.fillRect(5, 67, 20, 5); g.fillStyle = PAL.bone; g.fillRect(6, 63, 18, 4); g.fillStyle = PAL.black; g.fillRect(8, 72, 3, 3); g.fillRect(19, 72, 3, 3);   // wóz
      fire(100, 72);
      for (let k = 0; k < 7; k++) { const a = (k / 7) * Math.PI * 2; figure(Math.round(100 + Math.cos(a) * 22), Math.round(78 + Math.sin(a) * 5), pick(people), chance(0.4), chance(0.3)); }
      g.fillStyle = PAL.steel; g.fillRect(60, 74, 1, 8); g.fillRect(63, 75, 1, 7); g.fillRect(58, 74, 7, 1);   // kozioł z bronią
      g.fillStyle = PAL.ink; g.fillRect(144, 74, 7, 4); g.fillStyle = PAL.steelD; g.fillRect(145, 72, 5, 3);   // kocioł
      break;
    }
    case "battlefield": {   // pobojowisko: trupy, połamane drzewca, przewrócone chorągwie, dym, wrony
      for (let k = 0; k < 26; k++) { const x = Math.round(rr(4, 196)), y = Math.round(rr(62, 82)); g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, 9, 4); g.fillStyle = pick([PAL.dirt, PAL.steelD, PAL.red, PAL.slate, PAL.dirtD]); g.fillRect(x, y, 7, 2); g.fillStyle = PAL.skinD; g.fillRect(x + 7, y, 2, 2); g.fillStyle = PAL.bloodD; g.fillRect(x + rr(-2, 6), y + 2, 4, 1); }
      for (let k = 0; k < 10; k++) { const x = Math.round(rr(4, 196)), y = Math.round(rr(56, 80)); g.fillStyle = PAL.woodD; for (let j = 0; j < 12; j++) g.fillRect(x + Math.round(j * 0.6), y - j, 1, 1); g.fillStyle = PAL.steel; g.fillRect(x + 7, y - 13, 1, 2); }
      for (let k = 0; k < 3; k++) { const x = 30 + k * 60 + rr(-10, 10); g.fillStyle = PAL.woodD; g.fillRect(x, 40, 1, 26); g.fillStyle = k === 1 && extra ? PAL.ink : pick([PAL.red, PAL.purple, PAL.moss]); g.fillRect(x + 1, 41, 10, 7); g.fillRect(x + 1, 48, 6, 2); }
      g.fillStyle = PAL.woodD; g.fillRect(140, 74, 22, 1); g.fillStyle = PAL.red; g.fillRect(150, 75, 8, 4);   // przewrócona chorągiew
      for (let k = 0; k < 4; k++) { const x = rr(10, 190); g.globalAlpha = 0.35; for (let j = 0; j < 30; j++) { g.fillStyle = j % 2 ? PAL.ash : PAL.slate; g.fillRect(Math.round(x + Math.sin(j * 0.4) * 4 + j * 0.5), 58 - j * 1.6, 4 + (j >> 3), 3); } g.globalAlpha = 1; }
      fire(rr(20, 80), 70); fire(rr(120, 180), 76);
      for (let k = 0; k < 7; k++) crow(Math.round(rr(10, 190)), Math.round(rr(8, 40)));
      for (let k = 0; k < (extra ? 2 : 5); k++) figure(Math.round(rr(20, 180)), Math.round(rr(72, 82)), pick(people), chance(0.3), true);
      break;
    }
    default: { // pole
      for (let k = 0; k < 6; k++) { const x = Math.round(rr(0, 190)); g.fillStyle = PAL.ink; g.fillRect(x - 3, 48, 7, 12); g.fillStyle = PAL.grassD; g.fillRect(x - 2, 49, 5, 10); g.fillStyle = PAL.woodD; g.fillRect(x, 58, 1, 4); }
      crow(80, 24); pike(150, 80);
    }
  }
  M.indoor = indoor;
  _seed = save;
  return c;
}

// Ilustracja w podwójnej rozdzielczości (400×168): podkład 200×84 powiększony, na nim drobne szczegóły:
// faktura, gonty i belki domów, kominy, ludzie z twarzami i ubraniami, zwierzęta, beczki, pranie.
const SCENE_META = new WeakMap<HTMLCanvasElement, SceneMeta>();
function drawScene(kind: string, seed: number, culture: Culture | string, night: boolean, extra = 0): HTMLCanvasElement {
  const key = [kind, seed, culture, night, extra].join(":");
  const cached = SCENE_CACHE.get(key);
  if (cached) return cached;
  const M: SceneMeta = { houses: [], figs: [], fires: [], night, indoor: false, kind, culture: String(culture), extra };
  const base = drawSceneBase(kind, seed, culture, night, extra, M);
  const Wd = 400, Hd = 168;
  const [c, g] = mkCanvas(Wd, Hd);
  g.drawImage(base, 0, 0, Wd, Hd);
  const save = _seed;
  _seed = (seed * 7919 + 1013) >>> 0;
  const R = (col: string, x: number, y: number, w: number, h: number) => { g.fillStyle = col; g.fillRect(Math.round(x), Math.round(y), w, h); };
  const undead = culture === "undead", orc = culture === "orc", dwarf = culture === "dwarf";
  // domy: gonty lub strzecha, belki, okiennice, kominy, łaty
  const chimneys: [number, number][] = [];
  for (const [x0, y0, w0, h0] of M.houses) {
    const x = x0 * 2, y = y0 * 2, w = w0 * 2, h = h0 * 2;
    const rh = Math.ceil(w0 / 2) + 1;
    for (let r = 0; r < rh * 2; r += 2) { g.globalAlpha = 0.35; R(PAL.ink, x - 4 + r, y - 2 - r, w + 8 - r * 2, 1); g.globalAlpha = 1; }   // rzędy gontów
    if (chance(0.5)) { R(PAL.rust, x + rr(2, w - 8), y - rr(4, rh * 2 - 2), 5, 3); }   // łata na dachu
    if (!orc && !dwarf) { g.globalAlpha = 0.6; for (let k = 6; k < w - 4; k += 10) { R(PAL.woodD, x + k, y + 2, 1, h - 4); } R(PAL.woodD, x + 2, y + Math.floor(h / 2), w - 4, 1); g.globalAlpha = 1; }   // mur pruski
    if (chance(0.4)) { R(PAL.slate, x + w - 10, y + 4, 4, 1); R(PAL.ink, x + w - 10, y + 5, 4, 1); }   // spękany tynk
    R(night ? PAL.gold : PAL.ink, x + 4, y + 6, 4, 4); R(PAL.woodD, x + 3, y + 5, 1, 6); R(PAL.woodD, x + 8, y + 5, 1, 6); R(PAL.woodD, x + 5, y + 8, 2, 1);   // okno z okiennicami
    if (night) { g.globalAlpha = 0.25; R(PAL.gold, x + 2, y + 4, 8, 8); g.globalAlpha = 1; }
    if (!undead && chance(0.7)) { const cx = x + rr(4, w - 8); const cy = y - Math.round(rh * 1.2); R(PAL.ink, cx - 1, cy - 9, 6, 10); R(PAL.slate, cx, cy - 8, 4, 9); R(PAL.stone, cx, cy - 8, 1, 9); chimneys.push([cx + 2, cy - 10]); }
  }
  // drobne życie: kury, pies, beczki, skrzynie, pranie między domami
  if (!M.indoor && (kind === "town" || kind === "village" || kind === "castle")) {
    for (let k = 0; k < (kind === "village" ? 6 : 3); k++) { const x = rr(10, 390), y = rr(140, 162); R(PAL.ink, x - 1, y - 4, 6, 5); R(PAL.bone, x, y - 3, 4, 3); R(PAL.redL, x + 3, y - 4, 1, 1); R(PAL.gold, x + 4, y - 2, 1, 1); }   // kury
    { const x = rr(30, 370), y = rr(146, 162); R(PAL.ink, x - 1, y - 6, 12, 7); R(PAL.dirt, x, y - 5, 10, 4); R(PAL.dirt, x + 8, y - 7, 3, 3); R(PAL.dirtD, x, y - 1, 1, 2); R(PAL.dirtD, x + 8, y - 1, 1, 2); R(PAL.black, x + 10, y - 6, 1, 1); }   // pies
    for (let k = 0; k < 3; k++) { const x = rr(10, 380), y = rr(128, 150); R(PAL.ink, x - 1, y - 11, 10, 12); R(PAL.wood, x, y - 10, 8, 10); R(PAL.woodD, x, y - 7, 8, 1); R(PAL.woodD, x, y - 3, 8, 1); R(PAL.steelD, x, y - 10, 8, 1); }   // beczki
    if (M.houses.length > 1 && !undead) { const [a1, b1] = M.houses[0], [a2, b2] = M.houses[1]; const x1 = a1 * 2 + 10, x2 = a2 * 2 + 4, y1 = Math.min(b1, b2) * 2 + 6; for (let x = x1; x < x2; x++) { const sag = Math.sin(((x - x1) / Math.max(1, x2 - x1)) * Math.PI) * 4; R(PAL.ink, x, y1 + sag, 1, 1); if ((x - x1) % 9 === 3) R(pick([PAL.bone, PAL.redL, PAL.dirtL, PAL.ash]), x - 1, y1 + sag + 1, 4, 5); } }   // pranie
  }
  // ludzie: twarz, włosy lub kaptur, ubranie z paskiem, ręce, nogi, czasem broń, kosz albo worek
  const walkers: { x: number; y: number; col: string; hood: boolean; sword: boolean; dir: number; sp: number; x0: number; x1: number }[] = [];
  for (const [fx, fy, col, hood, sword] of M.figs) {
    const x = fx * 2, y = fy * 2;
    const walk = !M.indoor && chance(0.45) && kind !== "arena" && kind !== "captive";
    if (walk) { walkers.push({ x, y, col, hood, sword, dir: chance(0.5) ? 1 : -1, sp: rr(4, 10), x0: Math.max(6, x - rr(30, 80)), x1: Math.min(394, x + rr(30, 80)) }); continue; }
    drawScenePerson(g, x, y, col, hood, sword, Math.floor(rr(0, 4)), 0, undead);
  }
  // faktura: drobne ziarno i zacieki
  const im = g.getImageData(0, 0, Wd, Hd);
  for (let i = 0; i < Wd * Hd; i++) { const n = (hashInt(i * 2654435761 + seed) % 100) / 100; const f = 0.93 + n * 0.12; im.data[i * 4] *= f; im.data[i * 4 + 1] *= f; im.data[i * 4 + 2] *= f * 0.98; }
  g.putImageData(im, 0, 0);
  // winieta i noc
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0; y < Hd; y++) for (let x = 0; x < Wd; x++) { const e = Math.max(Math.abs(x - Wd / 2) / (Wd / 2), Math.abs(y - Hd / 2) / (Hd / 2)); if (e > 0.88 && (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16 < (e - 0.88) * 6) { g.fillStyle = PAL.black; g.fillRect(x, y, 1, 1); } }
  if (night) { g.globalCompositeOperation = "multiply"; g.fillStyle = "#6a6a90"; g.fillRect(0, 0, Wd, Hd); g.globalCompositeOperation = "source-over"; }
  _seed = save;
  (M as any).chimneys = chimneys; (M as any).walkers = walkers;
  SCENE_META.set(c, M);
  SCENE_CACHE.set(key, c);
  return c;
}

function drawScenePerson(g: CanvasRenderingContext2D, x: number, y: number, col: string, hood: boolean, sword: boolean, variant: number, step: number, undead: boolean) {
  const R = (c: string, a: number, b: number, w: number, h: number) => { g.fillStyle = c; g.fillRect(Math.round(x + a), Math.round(y + b), w, h); };
  const skin = undead ? PAL.bone : variant % 2 ? PAL.skin : PAL.skinD;
  R(PAL.ink, -4, -23, 9, 24);                                  // obrys
  const lg = step % 2 ? 1 : 0;
  R(PAL.dirtD, -2 - lg, -7, 2, 6); R(PAL.dirtD, 1 + lg, -7, 2, 6);   // nogi
  R(PAL.black, -3 - lg, -1, 3, 1); R(PAL.black, 1 + lg, -1, 3, 1);  // buty
  const dress = variant === 2 && !sword;
  R(col, -3, -16, 7, dress ? 14 : 10); R(PAL.ink, 3, -16, 1, dress ? 14 : 10);   // tułów, cień
  R(PAL.woodD, -3, -11, 7, 1); R(PAL.goldD, 0, -11, 1, 1);            // pas
  R(col, -4, -15, 1, 6); R(col, 4, -15, 1, 6); R(skin, -4, -9, 1, 2); R(skin, 4, -9, 1, 2);   // ręce
  if (hood) { R(col, -3, -22, 7, 6); R(PAL.ink, -1, -19, 3, 3); R(skin, -1, -19, 3, 2); }
  else { R(skin, -2, -21, 5, 5); R(variant === 3 ? PAL.ash : PAL.dirtD, -2, -22, 5, 2); R(PAL.black, -1, -19, 1, 1); R(PAL.black, 1, -19, 1, 1); if (variant === 1) R(PAL.dirtD, -2, -17, 5, 1); }   // twarz, włosy, oczy, broda
  if (sword) { R(PAL.steelL, 5, -21, 1, 11); R(PAL.goldD, 4, -11, 3, 1); }
  else if (variant === 0) { R(PAL.wood, 4, -10, 4, 4); R(PAL.woodD, 4, -10, 4, 1); }   // kosz
  else if (variant === 3) { R(PAL.dirtL, -7, -18, 4, 6); R(PAL.dirt, -7, -18, 4, 1); }   // worek na plecach
}

// Animowane sceny: dym z kominów, migające ogniska i pochodnie, chodzący ludzie. Odświeżane ok. 12 razy na sekundę.
const ANIM_SCENES: { cv: HTMLCanvasElement; base: HTMLCanvasElement; M: SceneMeta }[] = [];
let ANIM_ON = false;
function animateScene(cv: HTMLCanvasElement, base: HTMLCanvasElement) {
  const M = SCENE_META.get(base); if (!M) return;
  ANIM_SCENES.push({ cv, base, M });
  if (ANIM_ON) return;
  ANIM_ON = true;
  let last = 0;
  const loop = (ts: number) => {
    for (let i = ANIM_SCENES.length - 1; i >= 0; i--) if (!ANIM_SCENES[i].cv.isConnected) ANIM_SCENES.splice(i, 1);
    if (!ANIM_SCENES.length) { ANIM_ON = false; return; }
    if (ts - last > 80) {
      last = ts;
      const t = ts / 1000;
      for (const A of ANIM_SCENES) {
        const g = A.cv.getContext("2d"), M = A.M as any;
        g.drawImage(A.base, 0, 0);
        for (const [cx, cy] of (M.chimneys || []) as [number, number][]) for (let j = 0; j < 5; j++) {   // dym z kominów
          const ph = (t * 0.25 + j / 5 + cx * 0.013) % 1;
          g.globalAlpha = (1 - ph) * 0.4; g.fillStyle = M.night ? PAL.slate : PAL.ash;
          const r = 2 + Math.round(ph * 4);
          g.fillRect(Math.round(cx - r / 2 + Math.sin(ph * 4 + cx) * 3 + ph * 10), Math.round(cy - ph * 34), r, r);
        }
        g.globalAlpha = 1;
        for (const [fx, fy] of M.fires as [number, number][]) {   // migające ognie i dym
          for (let j = 0; j < 4; j++) { const ph = (t * 0.3 + j / 4 + fx * 0.01) % 1; g.globalAlpha = (1 - ph) * 0.3; g.fillStyle = PAL.ash; const r = 2 + Math.round(ph * 5); g.fillRect(Math.round(fx * 2 - r / 2 + Math.sin(ph * 5 + fx) * 4), Math.round(fy * 2 - 14 - ph * 40), r, r); }
          g.globalAlpha = 1;
          const fl = Math.floor(t * 9 + fx) % 3;
          g.fillStyle = PAL.redL; g.fillRect(fx * 2 - 4, fy * 2 - 6 - fl, 9, 6 + fl);
          g.fillStyle = PAL.gold; g.fillRect(fx * 2 - 2 + (fl === 1 ? 1 : 0), fy * 2 - 10 - fl, 5, 6);
          g.fillStyle = PAL.boneHi; g.fillRect(fx * 2, fy * 2 - 8 - fl, 1, 3);
          g.globalAlpha = 0.12 + fl * 0.04; g.fillStyle = PAL.gold; g.fillRect(fx * 2 - 30, fy * 2 - 34, 60, 50); g.globalAlpha = 1;
          if (Math.floor(t * 4 + fx) % 2) { g.fillStyle = PAL.gold; g.fillRect(fx * 2 + Math.round(Math.sin(t * 3 + fx) * 4), fy * 2 - 16 - Math.round((t * 20 + fx) % 14), 1, 1); }
        }
        for (const wk of (M.walkers || []) as any[]) {   // ruch ludzi
          const span = wk.x1 - wk.x0, p = ((t * wk.sp + wk.x * 0.7) % (span * 2) + span * 2) % (span * 2);
          const dir = p < span ? wk.dir : -wk.dir, xx = wk.dir > 0 ? (p < span ? wk.x0 + p : wk.x1 - (p - span)) : (p < span ? wk.x1 - p : wk.x0 + (p - span));
          drawScenePerson(g, xx, wk.y, wk.col, wk.hood, wk.sword, Math.abs(Math.round(wk.x)) % 4, Math.floor(t * 6 + wk.x), M.culture === "undead");
          if (M.night) { g.globalCompositeOperation = "multiply"; g.fillStyle = "#6a6a90"; g.fillRect(Math.round(xx) - 8, wk.y - 24, 17, 26); g.globalCompositeOperation = "source-over"; }
          void dir;
        }
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------- Ikony pikselowe (9×9) ----------
const ICON_URL = new Map<string, string>();
const ICON_ART: Record<string, [string, string[]]> = {
  coin: [PAL.gold, ["..xxxxx..", ".xx...xx.", "xx.xxx.xx", "x.x.x.x.x", "x.xx..x.x", "x..xx.x.x", "xx.xxx.xx", ".xx...xx.", "..xxxxx.."]],
  man: [PAL.boneHi, ["...xxx...", "...xxx...", "....x....", ".xxxxxxx.", "x..xxx..x", "...xxx...", "...x.x...", "..xx.xx..", "..x...x.."]],
  food: [PAL.dirtL, ["....xx...", "...xxxx..", "..xxxxxx.", ".xx.xx.xx", ".xxxxxxxx", "xxxxxxxxx", "x.xx.xx.x", ".xxxxxxx.", "..xxxxx.."]],
  heart: [PAL.redL, [".xx...xx.", "xxxx.xxxx", "xxxxxxxxx", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "...xxx...", "....x....", "........."]],
  sun: [PAL.gold, ["....x....", ".x..x..x.", "..xxxxx..", ".xxxxxxx.", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", ".x..x..x.", "....x...."]],
  moon: [PAL.bone, ["...xxx...", "..xx.....", ".xx......", ".xx......", ".xx......", ".xx......", "..xx.....", "...xxx...", "........."]],
  rain: [PAL.waterL, ["..xxxxx..", ".xxxxxxx.", "xxxxxxxxx", ".........", ".x..x..x.", "x..x..x..", ".x..x..x.", "x..x..x..", "........."]],
  sword: [PAL.steelL, [".......xx", "......xxx", ".....xxx.", "....xxx..", "x..xxx...", ".xxxx....", "..xx.....", ".x.xx....", "x...x...."]],
  shield: [PAL.redL, ["xxxxxxxxx", "x.......x", "x...x...x", "x..xxx..x", "x...x...x", ".x.....x.", "..x...x..", "...x.x...", "....x...."]],
  bow: [PAL.dirtL, ["..xx.....", "...xx...x", "....x..x.", "....xxx..", "....xx...", "....x.x..", "...xx..x.", "..xx....x", "........."]],
  horse: [PAL.dirtL, [".......xx", "......xxx", "xxxxxxxx.", "xxxxxxxx.", "xxxxxxx..", "x.x..x.x.", "x.x..x.x.", "x.x..x.x.", "........."]],
  axe: [PAL.steelL, ["...xxx...", "..xxxx...", ".xxxxx...", "..xxxxx..", "....x.x..", ".....x...", "......x..", ".......x.", "........x"]],
  crown: [PAL.gold, [".........", "x...x...x", "xx.xxx.xx", "xxxxxxxxx", "xxxxxxxxx", "x.x.x.x.x", "xxxxxxxxx", ".........", "........."]],
  wind: [PAL.boneHi, [".........", "xxxxxx...", "......x..", "xxxxxxx..", ".........", "xxxxxxxx.", "........x", "...xxxxx.", "........."]],
  fire: [PAL.redL, ["....x....", "...xx....", "...xxx.x.", "..xxxxxx.", ".xxx.xxx.", ".xx...xx.", ".xx...xx.", "..xx.xx..", "...xxx..."]],
  eye: [PAL.boneHi, [".........", "..xxxxx..", ".x.....x.", "x..xxx..x", "x..x.x..x", "x..xxx..x", ".x.....x.", "..xxxxx..", "........."]],
  wolf: [PAL.ash, ["x.....x..", "xx...xx..", "xxxxxxx..", "x.xxx.x..", "xxxxxxxx.", ".xxxxxxx.", "..x.xxxxx", "...x....x", "........."]],
  banner: [PAL.redL, ["x........", "xxxxxxx..", "xxxxxxxx.", "xxxxxxx..", "xxxxxxxx.", "x........", "x........", "x........", "x........"]],
  cross: [PAL.gold, ["...xxx...", "...xxx...", "xxxxxxxxx", "xxxxxxxxx", "...xxx...", "...xxx...", "...xxx...", "...xxx...", "........."]],
  drop: [PAL.bloodL, ["....x....", "...xxx...", "...xxx...", "..xxxxx..", ".xxxxxxx.", ".xxxxxxx.", ".xx.xxxx.", "..xxxxx..", "........."]],
  leaf: [PAL.moss, [".......xx", "....xxxxx", "..xxxxxx.", ".xxxxxxx.", ".xxxx.x..", "xxx.xx...", "x.xx.....", "x........", "........."]],
  skull: [PAL.bone, ["..xxxxx..", ".xxxxxxx.", "xxxxxxxxx", "x..x..x.x", "x..x..x.x", "xxxxxxxxx", ".xxx.xxx.", "..x.x.x..", "........."]],
  star: [PAL.gold, ["....x....", "....x....", "...xxx...", "xxxxxxxxx", ".xxxxxxx.", "..xxxxx..", "..xx.xx..", ".x.....x.", "........."]],
  scroll: [PAL.bone, [".xxxxxxx.", "x.x.....x", ".xxxxxxx.", ".x.....x.", ".x.xxx.x.", ".x.....x.", ".x.xxx.x.", ".xxxxxxx.", "x.......x"]],
  chain: [PAL.steel, ["xxx......", "x.x......", "xxxxx....", "..x.x....", "..xxxxx..", "....x.x..", "....xxxxx", "......x.x", "......xxx"]],
  castle: [PAL.ash, ["x.x...x.x", "xxx...xxx", "xxx.x.xxx", "xxxxxxxxx", "xxxxxxxxx", "xxxx.xxxx", "xxx...xxx", "xxx...xxx", "........."]],
  hammer: [PAL.steelL, ["xxxxx....", "xxxxx....", "xxxxx....", "..x......", "...x.....", "....x....", ".....x...", "......x..", ".......x."]],
  mug: [PAL.gold, [".xxxxx...", "xxxxxxx..", "x.....xx.", "x.....x.x", "x.....x.x", "x.....xx.", "x.....x..", "xxxxxxx..", "........."]],
  tent: [PAL.dirtL, ["....x....", "...xxx...", "..xx.xx..", "..x...x..", ".xx...xx.", ".x..x..x.", "xx..x..xx", "x...x...x", "xxxxxxxxx"]],
};
function iconUrl(name: string): string {
  let u = ICON_URL.get(name);
  if (u) return u;
  const art = ICON_ART[name] || ICON_ART.star;
  const P = new Pix(9, 9);
  art[1].forEach((row, y) => { for (let x = 0; x < 9; x++) if (row[x] === "x") P.p(x, y, art[0]); });
  u = P.toCanvas(true, true).toDataURL();
  ICON_URL.set(name, u);
  return u;
}
function ic(name: string, cls = "") { return `<img class="ic ${cls}" src="${iconUrl(name)}" alt="">`; }

// ---------- Podgląd jednostki: postać z koniem, przód i bok ----------
const UPREV = new Map<string, HTMLCanvasElement>();
function unitCanvas(key: string, dir = 0, frame = 0, faction?: number, look?: Look): HTMLCanvasElement {
  const def = UNITS[key];
  const fac = faction ?? (FACTION_OF_CULTURE[def.culture] || (def.culture === "merc" ? 9 : def.culture === "monster" ? 7 : 6));
  const ck = [key, dir, frame, fac, look ? look.seed : ""].join(":");
  let c = UPREV.get(ck);
  if (c) return c;
  if (def.mount && dir === 0) dir = 2;   // jeźdźca lepiej widać z boku
  const L = look || troopLook(def, 7, fac);
  const spr = spritesFor(L, look ? "prev:" + key + L.seed : `${key}:${fac}:7`);
  const img = spr.frames[dir][frame];
  if (def.mount) {
    const F = FACTIONS[fac] || FACTIONS[6];
    const hs = getHorse(7, [F.col, F.shade, F.trim], !!def.mount.undead);
    const himg = hs.frames[dir][frame];
    const [cv, g] = mkCanvas(40, 48);
    g.drawImage(himg, Math.round(20 - himg.width / 2), 48 - himg.height + 2);
    const riderY = dir === 2 ? -11 : -9;
    const rh = Math.round(img.height * 0.72);
    g.drawImage(img, 0, 0, img.width, rh, Math.round(20 - img.width / 2), 48 - img.height + riderY, img.width, rh);
    c = cv;
  } else {
    const [cv, g] = mkCanvas(32, 40);
    g.drawImage(img, 0, -2);
    c = cv;
  }
  UPREV.set(ck, c);
  return c;
}
// Animowany pasek klatek (bok, chód) jako tło CSS.
function unitAnim(key: string, scale = 3, look?: Look) {
  const frames = [1, 2, 3, 4, 5, 6].map((f) => unitCanvas(key, 2, f, undefined, look));
  const w = frames[0].width, h = frames[0].height;
  const [strip, g] = mkCanvas(w * 6, h);
  frames.forEach((f, i) => g.drawImage(f, i * w, 0));
  return `<div class="uanim" style="width:${w * scale}px;height:${h * scale}px;background-image:url(${strip.toDataURL()});background-size:${w * 6 * scale}px ${h * scale}px;--sw:-${w * 6 * scale}px"></div>`;
}
function unitThumb(key: string, scale = 1) { return pic(unitCanvas(key, 0, 0), "uthumb", scale); }
function tierStars(t: number) { return `<span class="stars">${"★".repeat(t)}<span class="muted">${"★".repeat(Math.max(0, 5 - t))}</span></span>`; }
function unitStats(key: string) {
  const d = UNITS[key], w = WEAPONS[d.weapon];
  const bar = (lab: string, v: number, max: number, cls: string, txt?: string) => `<div class="stat"><span>${lab}</span><div class="bar ${cls}"><i style="width:${clamp((v / max) * 100, 0, 100)}%"></i></div><b>${txt ?? Math.round(v)}</b></div>`;
  const atk = (w.dmg.L + w.dmg.O + w.dmg.T) / 3;
  return `<div class="ustats">
    ${bar("Zdrowie", d.hp, 160, "s-hp")}
    ${bar("Pancerz", (1 - d.armor.cut) * 100, 60, "s-arm", Math.round((1 - d.armor.cut) * 100) + "")}
    ${bar("Atak", atk, 50, "s-atk")}
    ${bar("Obrona", d.guard * 100, 70, "s-def")}
    ${bar("Szybkość", d.mount ? d.mount.speed : d.speed, d.mount ? 120 : 60, "s-spd", String(d.mount ? d.mount.speed : d.speed))}
    ${d.bow ? bar(d.bow.bolt ? "Kusza" : d.bow.axe ? "Topory" : "Łuk", d.bow.dmg, 70, "s-bow") : ""}
    <p class="tip">${w.name}${d.shield ? " i tarcza" : ""}${d.mount ? " · konno" : ""}${d.undead ? " · nieumarły: odporny na strzały, kruchy na obuch" : ""}${d.ability ? " · " + abilityWord(d.ability) : ""} · żołd ${d.wage}/dzień</p>
  </div>`;
}
// Drzewko linii jednostki: od korzenia kultury do szczytu, bieżąca podświetlona.
function unitRoot(key: string): string {
  let cur = key;
  for (let guard = 0; guard < 8; guard++) { const parent = Object.values(UNITS).find((u) => u.up && u.up.includes(cur)); if (!parent) break; cur = parent.key; }
  return cur;
}
function unitTreeHtml(key: string, act = "", actFor?: (k: string) => string) {
  const root = unitRoot(key);
  const node = (k: string): string => {
    const d = UNITS[k];
    const kids = (d.up || []).map(node).join("");
    return `<div class="tn"><div class="tbox ${k === key ? "cur" : ""}" ${act ? `data-a="${act}" data-v="${k}"` : ""} title="${esc(d.name)}">${unitThumb(k)}<span>${d.name}</span><span class="stars">${"★".repeat(d.tier)}</span>${actFor ? actFor(k) : ""}</div>${kids ? `<div class="tch">${kids}</div>` : ""}</div>`;
  };
  return `<div class="utree">${node(root)}</div>`;
}

// ---------- Dialog: dwa portrety, dymek, numerowane odpowiedzi ----------
interface Choice { a: string; label: string; v?: string; cls?: string; disabled?: boolean; }
function dialogHtml(o: { left: HTMLCanvasElement; right: HTMLCanvasElement; title: string; sub?: string; speech: string; info?: string; choices: Choice[]; scene?: HTMLCanvasElement }) {
  return `<div class="dlg">
    ${o.scene ? `<div class="scene">${pic(o.scene, "scene-img")}</div>` : ""}
    <div class="dlg-row">
      <div class="dlg-p">${pic(o.left, "portrait big")}</div>
      <div class="dlg-mid"><div class="dlg-name"><b>${o.title}</b>${o.sub ? ` <span class="muted">${o.sub}</span>` : ""}</div>
        <div class="bubble" id="bubble" data-full="${esc(o.speech)}"></div>
        ${o.info ? `<div class="dlg-info">${o.info}</div>` : ""}</div>
      <div class="dlg-p">${pic(o.right, "portrait big")}</div>
    </div>
    <ol class="choices">${o.choices.map((c, i) => `<li><button class="choice ${c.cls || ""}" data-a="${c.a}" data-v="${c.v || ""}" ${c.disabled ? "disabled" : ""}><span class="key">${i + 1}</span>${c.label}</button></li>`).join("")}</ol>
  </div>`;
}
// Pisanie tekstu w dymku litera po literze.
function typeBubble() {
  const b = document.getElementById("bubble");
  if (!b) return;
  const full = b.dataset.full || "";
  if (settings.typeText === false) { b.textContent = full; return; }
  let i = 0;
  const step = () => { if (!document.body.contains(b)) return; i = Math.min(full.length, i + 2); b.textContent = full.slice(0, i); if (i < full.length) setTimeout(step, 14); };
  step();
  const skip = () => { i = full.length; b.textContent = full; };
  b.addEventListener("click", skip);
  b.closest(".dlg")?.addEventListener("mousedown", (e) => { if (!(e.target as HTMLElement).closest("button")) skip(); }, { once: true });
}
function grunt(kind: string) { if (settings.voices !== false) sfx.grunt(kind); }
function playerPortrait() { return drawPortrait(heroCfgFromPlayer(WORLD.player).look, PAL.gold); }

// Podpowiedź przy pierwszym użyciu (raz na grę i profil, do wyzerowania w ustawieniach).
let seenTip: (id: string) => boolean = () => true;
let markTip: (id: string) => void = () => {};
function firstTip(id: string, title: string, text: string) {
  if (seenTip(id)) return;
  markTip(id);
  const old = document.getElementById("ftip"); if (old) old.remove();
  const d = document.createElement("div");
  d.id = "ftip"; d.className = "parch";
  d.innerHTML = `<b>${title}</b>${text}<br><button class="mini">Rozumiem</button>`;
  d.querySelector("button").addEventListener("click", () => d.remove());
  document.getElementById("wrap").appendChild(d);
  setTimeout(() => d.remove(), 22000);
}

// Ekran ładowania: ilustracja, cytat i wskazówka. Krótki, klik pomija.
const QUOTES: [string, string][] = [
  ["Popiół pamięta każdy sztandar, który spłonął.", "przysłowie z Doliny"],
  ["Król bez wojska to tylko człowiek w ładnym kapeluszu.", "Kassian Varus"],
  ["Kamień nie zapomina. Krasnolud też nie.", "Durgan Kamienna Brew"],
  ["Silny bierze. Słaby płacze. Mądry ucieka wcześniej.", "Ghrakk Krwawy Kieł"],
  ["Śmierć to nie koniec. To zaciąg.", "napis na bramie Morvath"],
  ["Lepiej zjeść suchy chleb w obozie niż ciepłą zupę w lochu.", "stary najemnik"],
  ["Tarcza, która pękła, wciąż osłoniła jeden cios.", "kowal z Valdmoor"],
  ["Kto pyta w karczmie, ten wie, co dzieje się w królestwie.", "bard bez imienia"],
  ["Zboże wygrywa więcej wojen niż miecze.", "kwatermistrz Legionu"],
  ["Modlitwa nie zastąpi pancerza, ale pomaga go nosić.", "kapłan Zakonu Świtu"],
];
const LOADTIPS = [
  "Przytrzymaj PPM w ostatniej chwili przed ciosem wroga, by skontrować.",
  "Jeńcy potrzebują straży: zbyt wielu spowalnia armię i może uciec nocą.",
  "Lordowie pamiętają, co dla nich zrobiłeś. Okno frakcji (F) pokazuje, skąd wzięła się relacja.",
  "Q otwiera rozkazy. W trybie rozkazów widzisz mapę taktyczną.",
  "Morvath rośnie jak zaraza. Im dłużej zwlekasz, tym więcej ziem pochłania popiół.",
  "Kowal naprawi zużyty sprzęt. Zardzewiały miecz tnie gorzej i szybciej pęka.",
  "W karczmie najmiesz kompanów, posłuchasz plotek i zagrasz w kości.",
  "F1 na mapie pokazuje wszystkie skróty. Klawisze zmienisz w ustawieniach.",
  "Wysłannik dotrze do dworu po kilku dniach. Odpowiedź przyjdzie w kronice.",
  "Marszałek zbiera lordów na wyprawę. Dołącz, a łupy i sława przypadną także tobie.",
  "Zimą armie wolniej maszerują, a wioski mają mniej zboża.",
  "Przesłuchany jeniec zdradzi, gdzie stoją wojska jego pana.",
];
function showLoading(scene: HTMLCanvasElement | null, done: () => void, minMs = 1100) {
  const old = document.getElementById("loadscr"); if (old) old.remove();
  const d = document.createElement("div"); d.id = "loadscr";
  const [q, who] = pick(QUOTES);
  d.innerHTML = `<div class="lc"></div>`;
  const lc = d.querySelector(".lc") as HTMLElement;
  if (scene) lc.appendChild(scene);
  lc.insertAdjacentHTML("beforeend", `<q>${q}</q><div class="who">— ${who}</div><div class="lbar"><i></i></div><div class="ltip">${pick(LOADTIPS)}</div>`);
  document.getElementById("wrap").appendChild(d);
  const bar = d.querySelector(".lbar i") as HTMLElement;
  let fin = false;
  const end = () => { if (fin) return; fin = true; d.remove(); };
  requestAnimationFrame(() => { bar.style.width = "35%"; });
  setTimeout(() => { try { done(); } catch (e) { console.error(e); } bar.style.width = "100%"; setTimeout(end, Math.max(150, minMs - 300)); }, 120);
  d.addEventListener("click", () => { if (bar.style.width === "100%") end(); });
}

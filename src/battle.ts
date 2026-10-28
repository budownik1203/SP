// Bitwa: symulacja walki, AI, rozkazy, tryb dowodzenia, efekty i rysowanie.

const WW = 1200, WH = 760;               // rozmiar pola bitwy w pikselach
type State = "idle" | "windup" | "strike" | "recover" | "stagger" | "kick" | "down" | "dead" | "fled";
type Group = "inf" | "arch" | "hero" | "cmd" | "skel" | "skelArch";
type Mode = "hold" | "follow" | "charge";
type GKey = "inf" | "arch";

let UID = 1;

class Unit {
  id = UID++;
  def: UnitDef;
  team: number;
  group: Group;
  x: number; y: number;
  vx = 0; vy = 0;
  face = 0;
  hp: number;
  state: State = "idle";
  t = 0;
  dir: Dir = "R";
  hold = 0;
  released = false;
  hitDone = false;
  guard: Dir | null = null;
  guardT = 0;
  pendingGuard: { dir: Dir; at: number } | null = null;
  idleGuardT = 0;
  blocking = false;
  blockStart = -9;
  stamina = 100;
  staminaWait = 0;
  morale = 100;
  fleeing = false;
  target: Unit | null = null;
  retarget = 0;
  slotX = 0; slotY = 0; slotFace = 0;
  cooldown = 0;
  anim = 0;
  moving = false;
  flash = 0;
  hero = false;
  commander = false;
  reload = 0;
  drawT = 0;
  ammo = 0;
  loadout = 0;
  weaponKey: string;
  hasShield: boolean;
  kills = 0;
  trail: number[] = [];
  decay = false;
  bloodT = 0;
  variant: number;
  spr: SpriteSet;

  constructor(defKey: string, team: number, group: Group, x: number, y: number) {
    this.def = UNITS[defKey];
    this.team = team; this.group = group;
    this.x = x; this.y = y;
    this.hp = this.def.hp;
    this.weaponKey = this.def.weapon;
    this.hasShield = this.def.shield;
    this.face = team === 0 ? 0 : Math.PI;
    this.reload = rr(0.2, 1.5);
    this.ammo = this.def.bow ? 30 : 0;
    this.dir = pick<Dir>(["L", "R", "O", "T"]);
    this.variant = Math.floor(rnd() * 64);
    this.spr = getSprites(this.def.body, this.variant);
  }
  get alive() { return this.state !== "dead" && this.state !== "fled"; }
  get active() { return this.alive && this.state !== "down"; }
  get w() { return WEAPONS[this.weaponKey]; }
  get usingBow() { return this.hero ? HERO_LOADOUTS[this.loadout].bow : !!this.def.bow; }
}

interface Arrow { x: number; y: number; vx: number; vy: number; team: number; src: Unit; dmg: number; age: number; travel: number; dist: number; done: boolean; }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; col: string; kind: "blood" | "spark" | "dust" | "bone" | "flash" | "ring" | "soul"; }
interface Corpse { x: number; y: number; img: HTMLCanvasElement; flip: boolean; rot: number; undead: boolean; bones: boolean; t: number; pooled: boolean; }
interface Obstacle { x: number; y: number; r: number; img: HTMLCanvasElement; }
interface Floater { x: number; y: number; text: string; col: string; t: number; }
interface Order { mode: Mode; ax: number; ay: number; formation: Formation; fire: boolean; cols?: number; face?: number; }
interface Slot { x: number; y: number; face: number; }

class Battle {
  units: Unit[] = [];
  hero: Unit;
  dk: Unit;
  arrows: Arrow[] = [];
  parts: Particle[] = [];
  corpses: Corpse[] = [];
  obstacles: Obstacle[] = [];
  floaters: Floater[] = [];
  ground: HTMLCanvasElement;
  decals: HTMLCanvasElement;
  dg: CanvasRenderingContext2D;
  vignette: HTMLCanvasElement;
  fog: HTMLCanvasElement;
  ash: { x: number; y: number; s: number; p: number; c: string }[] = [];

  orders: Record<GKey, Order>;
  selected: GKey[] = ["inf", "arch"];
  enemyAnchor: V = { x: 930, y: 380 };
  enemyCharge = false;

  // tryb dowodzenia
  cmdOpen = false;
  cmdLevel: "groups" | "orders" | "formation" = "groups";
  drag: { sx: number; sy: number; ex: number; ey: number } | null = null;
  preview: { slots: Slot[]; t: number; col: string }[] = [];

  cam: V = { x: 0, y: 0 };
  camFree = false;
  shakeX = 0; shakeY = 0; shakeVX = 0; shakeVY = 0; rumble = 0;
  hitstop = 0;
  slowT = 0;
  slowmo = false;
  hurtFlash = 0;
  time = 0;
  real = 0;
  phase: "deploy" | "fight" | "end" = "deploy";
  result: "win" | "lose" | null = null;
  log: { text: string; t: number; col?: string }[] = [];
  banner: { text: string; t: number; col: string } | null = null;
  loadDir: Dir = "R";
  paused = false;
  relayoutT = 0;
  intensity = 0;

  constructor(public input: Input, public sfx: Sfx) {
    this.makeTerrain();
    this.spawn();
  }

  // ---------- Teren ----------
  makeTerrain() {
    const [g, gc] = mkCanvas(WW, WH);
    const im = gc.createImageData(WW, WH);
    const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const grass = [PAL.grassD, PAL.grass, PAL.grassL, PAL.moss].map(rgb);
    const dirt = [PAL.dirtD, PAL.dirt, PAL.dirtL].map(rgb);
        const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vnoise = (x: number, y: number, s: number) => {
      const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = x / s - xi, fy = y / s - yi;
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
    };
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const off = rnd() * 1000;
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const n = vnoise(x + off, y, 70) * 0.62 + vnoise(x, y + off, 22) * 0.38;
      const th = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const roadY = 380 + Math.sin((x + off) / 170) * 60 + Math.sin(x / 53) * 7;
      const rd = Math.abs(y - roadY) - 15 - vnoise(x, y, 14) * 9;
      let col: number[];
      if (rd < 0) {
        const lv = n * 2.2 + (th - 0.5) * 0.9;
        col = dirt[clamp(Math.floor(lv), 0, 2)];
        const rut = Math.abs(Math.abs(y - roadY) - 6);
        if (rut < 1.2 && hash(x >> 2, 7) > 0.2) col = dirt[0];
        if (vnoise(x, y, 9) > 0.8 && rd < -4 && th < 0.75) col = dirt[0];
      } else if (rd < 3) col = th < 0.5 ? dirt[0] : grass[0];
      else {
        const lv = n * 2.5 + (th - 0.5) * 0.8;
        col = grass[clamp(Math.floor(lv), 0, 2)];
        if (vnoise(x + 300, y, 40) > 0.78 && th > 0.75) col = grass[3];
      }
      const k = (y * WW + x) * 4;
      im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
    }
    gc.putImageData(im, 0, 0);
    for (let i = 0; i < 900; i++) {
      const x = rr(0, WW) | 0, y = rr(0, WH) | 0;
      const roadY = 380 + Math.sin((x + off) / 170) * 60;
      if (Math.abs(y - roadY) < 20) continue;
      gc.drawImage(pick(TUFTS), x, y);
    }
    for (let i = 0; i < 220; i++) { gc.fillStyle = chance(0.5) ? PAL.stone : PAL.slate; const x = rr(0, WW) | 0, y = rr(0, WH) | 0; gc.fillRect(x, y, 2, 1); gc.fillStyle = PAL.ash; gc.fillRect(x, y, 1, 1); }
    this.ground = g;
    const [d, dg] = mkCanvas(WW, WH);
    this.decals = d; this.dg = dg;

    const place = (n: number, imgs: HTMLCanvasElement[], r: number) => {
      for (let i = 0; i < n; i++) for (let tries = 0; tries < 30; tries++) {
        const x = rr(30, WW - 30), y = rr(30, WH - 20);
        if (y > 250 && y < 520 && x > 180 && x < 1020 && !chance(0.12)) continue;
        if (this.obstacles.some((o) => dist(o.x, o.y, x, y) < o.r + r + 18)) continue;
        this.obstacles.push({ x, y, r, img: pick(imgs) });
        break;
      }
    };
    place(30, TREES, 7);
    place(14, ROCKS, 6);
    for (let i = 0; i < 40; i++) this.obstacles.push({ x: rr(0, WW), y: rr(0, WH), r: 0, img: BUSH });

    const [v, vg] = mkCanvas(W, H);
    const grd = vg.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.6);
    grd.addColorStop(0, "rgba(13,11,14,0)"); grd.addColorStop(1, "rgba(13,11,14,0.6)");
    vg.fillStyle = grd; vg.fillRect(0, 0, W, H);
    this.vignette = v;
    // mgła: gładki szum w małej rozdzielczości
    const [f, fg] = mkCanvas(160, 90);
    const fim = fg.createImageData(160, 90);
    for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
      const n = vnoise(x * 3, y * 3, 30) * 0.7 + vnoise(x * 3 + 99, y * 3, 12) * 0.3;
      const a = clamp((n - 0.45) * 2.2, 0, 1);
      const k = (y * 160 + x) * 4;
      fim.data[k] = 200; fim.data[k + 1] = 196; fim.data[k + 2] = 210; fim.data[k + 3] = Math.floor(a * 255);
    }
    fg.putImageData(fim, 0, 0);
    this.fog = f;
    for (let i = 0; i < 110; i++) this.ash.push({ x: rr(0, W), y: rr(0, H), s: rr(4, 12), p: rr(0.3, 1), c: chance(0.7) ? PAL.ash : PAL.boneHi });
  }

  // ---------- Jednostki ----------
  spawn() {
    const h = new Unit("hero", 0, "hero", 345, 380);
    h.hero = true; h.ammo = 24;
    this.hero = h; this.units.push(h);
    for (let i = 0; i < 12; i++) this.units.push(new Unit("inf", 0, "inf", 300 + (i % 2) * 12, 340 + i * 7));
    for (let i = 0; i < 8; i++) this.units.push(new Unit("arch", 0, "arch", 250, 350 + i * 9));
    this.orders = {
      inf: { mode: "hold", ax: 315, ay: 380, formation: "line", fire: true },
      arch: { mode: "hold", ax: 262, ay: 380, formation: "line", fire: true },
    };
    const dk = new Unit("dk", 1, "cmd", 925, 380);
    dk.commander = true; this.dk = dk; this.units.push(dk);
    for (let i = 0; i < 13; i++) this.units.push(new Unit("skel", 1, "skel", 945 + (i % 2) * 12, 330 + i * 8));
    for (let i = 0; i < 6; i++) this.units.push(new Unit("skelArch", 1, "skelArch", 1010, 350 + i * 12));
    this.layoutAll(true);
    this.cam.x = clamp(h.x - W / 2, 0, WW - W); this.cam.y = clamp(h.y - H / 2, 0, WH - H);
  }

  groupUnits(g: Group) { return this.units.filter((u) => u.team === 0 && u.group === g && u.active && !u.fleeing); }
  centroid(team: number, group?: Group): V {
    let x = 0, y = 0, n = 0;
    for (const u of this.units) if (u.team === team && u.active && (!group || u.group === group)) { x += u.x; y += u.y; n++; }
    return n ? { x: x / n, y: y / n } : { x: team === 0 ? 300 : 900, y: 380 };
  }

  // Miejsca w szyku. Przód szyku leży na punkcie (ax, ay), kolejne szeregi cofają się.
  slotsFor(n: number, ax: number, ay: number, face: number, f: Formation, colsOverride?: number): Slot[] {
    const out: Slot[] = [];
    if (!n) return out;
    const fx = Math.cos(face), fy = Math.sin(face);
    const rx = -fy, ry = fx;
    const sp = FORMATION_SPACING[f];
    const put = (lx: number, ly: number, sf = face) => out.push({ x: clamp(ax + rx * lx - fx * ly, 10, WW - 10), y: clamp(ay + ry * lx - fy * ly, 12, WH - 8), face: sf });
    if (f === "circle") {
      const r = Math.max(10, (n * sp) / (Math.PI * 2));
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push({ x: clamp(ax + Math.cos(a) * r, 10, WW - 10), y: clamp(ay + Math.sin(a) * r, 12, WH - 8), face: a });
      }
      return out;
    }
    if (f === "wedge") {
      for (let i = 0; i < n; i++) {
        let row = 0, idx = i;
        while (idx > row) { idx -= row + 1; row++; }
        put((idx - row / 2) * sp, row * 11);
      }
      return out;
    }
    const defCols = f === "wall" ? 10 : f === "loose" ? 6 : f === "column" ? 2 : 8;
    const cols = clamp(f === "column" ? defCols : colsOverride || defCols, 1, n);
    const rowGap = f === "wall" ? 9 : f === "column" ? 11 : 12;
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      put((col - (inRow - 1) / 2) * sp, row * rowGap);
    }
    return out;
  }

  assign(list: Unit[], slots: Slot[], snap = false) {
    // przydział miejsc: najpierw najbliższe pary (zachłannie), żeby żołnierze nie przechodzili przez siebie
    const free = slots.slice();
    const order = list.slice().sort((a, b) => a.id - b.id);
    for (const u of order) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < free.length; i++) { const d = dist(u.x, u.y, free[i].x, free[i].y); if (d < bd) { bd = d; bi = i; } }
      const s = free.splice(bi, 1)[0];
      if (!s) continue;
      u.slotX = s.x; u.slotY = s.y; u.slotFace = s.face;
      if (snap) { u.x = s.x; u.y = s.y; u.face = s.face; }
    }
  }

  groupAnchor(g: GKey): { ax: number; ay: number; face: number } {
    const o = this.orders[g], ec = this.centroid(1);
    let ax = o.ax, ay = o.ay;
    if (o.mode === "follow" && this.hero.active) {
      const a = Math.atan2(ec.y - this.hero.y, ec.x - this.hero.x);
      const back = g === "inf" ? 22 : 52;
      ax = this.hero.x - Math.cos(a) * back; ay = this.hero.y - Math.sin(a) * back;
      return { ax, ay, face: a };
    }
    const face = o.face !== undefined ? o.face : Math.atan2(ec.y - ay, ec.x - ax);
    return { ax, ay, face };
  }

  layoutAll(snap = false) {
    for (const g of ["inf", "arch"] as const) {
      const o = this.orders[g];
      const list = this.groupUnits(g);
      const a = this.groupAnchor(g);
      this.assign(list, this.slotsFor(list.length, a.ax, a.ay, a.face, o.formation, o.cols), snap);
    }
    const pc = this.centroid(0);
    const a = Math.atan2(pc.y - this.enemyAnchor.y, pc.x - this.enemyAnchor.x);
    const war = this.units.filter((u) => u.team === 1 && u.group === "skel" && u.active);
    this.assign(war, this.slotsFor(war.length, this.enemyAnchor.x, this.enemyAnchor.y, a, "line"), snap);
    const arc = this.units.filter((u) => u.team === 1 && u.group === "skelArch" && u.active);
    this.assign(arc, this.slotsFor(arc.length, this.enemyAnchor.x - Math.cos(a) * 55, this.enemyAnchor.y - Math.sin(a) * 55, a, "line"), snap);
    if (this.dk.active) {
      this.dk.slotX = this.enemyAnchor.x + Math.cos(a) * 16; this.dk.slotY = this.enemyAnchor.y + Math.sin(a) * 16; this.dk.slotFace = a;
      if (snap) { this.dk.x = this.dk.slotX; this.dk.y = this.dk.slotY; this.dk.face = a; }
    }
  }

  say(text: string, col?: string) { this.log.push({ text, t: 5, col }); if (this.log.length > 6) this.log.shift(); }
  shout(text: string, col = PAL.gold) { this.banner = { text, t: 1.1, col }; }
  vol(x: number) { return this.sfx.spatial(x, this.cam); }
  groupName(gs: GKey[]) { return gs.length === 2 ? "Wszyscy" : gs[0] === "inf" ? "Piechota" : "Łucznicy"; }

  // ---------- Rozkazy ----------
  orderMode(gs: GKey[], mode: Mode) {
    const n = this.groupName(gs);
    for (const g of gs) {
      const o = this.orders[g];
      o.mode = mode;
      if (mode !== "hold") { o.face = undefined; }
    }
    if (mode === "follow") { this.say(`${n}: za mną!`); this.sfx.shout(0.6); }
    if (mode === "charge") { this.say(`${n}: do szarży!`, PAL.redL); this.sfx.shout(1); }
  }
  orderHere(gs: GKey[], wx: number, wy: number) {
    const ec = this.centroid(1), a = Math.atan2(ec.y - wy, ec.x - wx);
    for (const g of gs) {
      const o = this.orders[g]; o.mode = "hold"; o.face = undefined;
      const back = gs.length > 1 && g === "arch" ? 40 : 0;
      o.ax = wx - Math.cos(a) * back; o.ay = wy - Math.sin(a) * back;
    }
    this.say(`${this.groupName(gs)}: stać tutaj!`); this.sfx.shout(0.6);
    this.flashPreview(gs);
  }
  orderHoldPosition(gs: GKey[]) {
    for (const g of gs) {
      const c = this.centroid(0, g), o = this.orders[g];
      const a = this.groupAnchor(g);
      o.mode = "hold"; o.ax = c.x + Math.cos(a.face) * 6; o.ay = c.y + Math.sin(a.face) * 6; o.face = a.face;
    }
    this.say(`${this.groupName(gs)}: utrzymać pozycję!`);
  }
  orderRetreat(gs: GKey[]) {
    const ec = this.centroid(1);
    for (const g of gs) {
      const c = this.centroid(0, g), o = this.orders[g];
      const a = Math.atan2(c.y - ec.y, c.x - ec.x);
      o.mode = "hold"; o.ax = c.x + Math.cos(a) * 50; o.ay = c.y + Math.sin(a) * 50; o.face = a + Math.PI;
    }
    this.say(`${this.groupName(gs)}: cofnąć się!`);
  }
  orderFormation(gs: GKey[], f: Formation) {
    for (const g of gs) { this.orders[g].formation = f; this.orders[g].cols = undefined; }
    this.say(`${this.groupName(gs)}: ${FORMATION_NAME[f].toLowerCase()}`);
  }
  orderFire(gs: GKey[]) {
    const o = this.orders.arch; o.fire = !o.fire;
    this.say(o.fire ? "Łucznicy: strzelać wedle uznania!" : "Łucznicy: wstrzymać ogień!");
  }

  // Linia narysowana prawym przyciskiem: przód szyku od A do B.
  dragPlan(d: { sx: number; sy: number; ex: number; ey: number }) {
    const ec = this.centroid(1);
    const len = dist(d.sx, d.sy, d.ex, d.ey);
    const mx = (d.sx + d.ex) / 2, my = (d.sy + d.ey) / 2;
    let face: number;
    if (len < 8) face = Math.atan2(ec.y - d.sy, ec.x - d.sx);
    else {
      const a = Math.atan2(d.ey - d.sy, d.ex - d.sx);
      const f1 = a - Math.PI / 2, f2 = a + Math.PI / 2;
      const toE = Math.atan2(ec.y - my, ec.x - mx);
      face = Math.abs(angDiff(f1, toE)) < Math.abs(angDiff(f2, toE)) ? f1 : f2;
    }
    const plan: { g: GKey; ax: number; ay: number; face: number; cols?: number; slots: Slot[] }[] = [];
    const ax0 = len < 8 ? d.sx : mx, ay0 = len < 8 ? d.sy : my;
    for (const g of this.selected) {
      const list = this.groupUnits(g);
      const o = this.orders[g];
      const back = this.selected.length > 1 && g === "arch" ? 34 : 0;
      const ax = ax0 - Math.cos(face) * back, ay = ay0 - Math.sin(face) * back;
      const cols = len < 8 ? o.cols : clamp(Math.round(len / FORMATION_SPACING[o.formation]) + 1, 1, Math.max(1, list.length));
      plan.push({ g, ax, ay, face, cols, slots: this.slotsFor(list.length, ax, ay, face, o.formation, cols) });
    }
    return plan;
  }

  applyDrag() {
    if (!this.drag) return;
    const plan = this.dragPlan(this.drag);
    for (const p of plan) {
      const o = this.orders[p.g];
      o.mode = "hold"; o.ax = p.ax; o.ay = p.ay; o.face = p.face; o.cols = p.cols;
      this.preview.push({ slots: p.slots, t: 1.4, col: p.g === "inf" ? PAL.redL : PAL.moss });
    }
    this.say(`${this.groupName(this.selected)}: na pozycje!`);
    this.sfx.shout(0.5);
    this.drag = null;
    this.cmdLevel = "groups";
    this.relayoutT = 0;
  }

  flashPreview(gs: GKey[]) {
    for (const g of gs) {
      const list = this.groupUnits(g), a = this.groupAnchor(g), o = this.orders[g];
      this.preview.push({ slots: this.slotsFor(list.length, a.ax, a.ay, a.face, o.formation, o.cols), t: 1.2, col: g === "inf" ? PAL.redL : PAL.moss });
    }
    this.relayoutT = 0;
  }

  cmdMenu(): { n: number; label: string; on?: boolean }[] {
    if (this.cmdLevel === "groups") return [
      { n: 1, label: "Piechota", on: this.selected.length === 1 && this.selected[0] === "inf" },
      { n: 2, label: "Łucznicy", on: this.selected.length === 1 && this.selected[0] === "arch" },
      { n: 3, label: "Wszyscy", on: this.selected.length === 2 },
    ];
    if (this.cmdLevel === "orders") return [
      { n: 1, label: "Stań w miejscu kursora" },
      { n: 2, label: "Za mną" },
      { n: 3, label: "Szarża" },
      { n: 4, label: "Utrzymaj pozycję" },
      { n: 5, label: "Cofnij się" },
      { n: 6, label: "Formacja ›" },
      { n: 7, label: this.orders.arch.fire ? "Wstrzymaj ogień" : "Strzelać wedle uznania" },
    ];
    const cur = this.orders[this.selected[0]].formation;
    return FORMATIONS.map((f, i) => ({ n: i + 1, label: FORMATION_NAME[f], on: f === cur }));
  }

  cmdChoose(n: number) {
    const gs = this.selected;
    this.sfx.ui();
    if (this.cmdLevel === "groups") {
      if (n === 1) this.selected = ["inf"]; else if (n === 2) this.selected = ["arch"]; else if (n === 3) this.selected = ["inf", "arch"]; else return;
      this.cmdLevel = "orders";
      return;
    }
    if (this.cmdLevel === "orders") {
      const wx = this.cam.x + this.input.mx, wy = this.cam.y + this.input.my;
      if (n === 1) this.orderHere(gs, wx, wy);
      else if (n === 2) this.orderMode(gs, "follow");
      else if (n === 3) this.orderMode(gs, "charge");
      else if (n === 4) this.orderHoldPosition(gs);
      else if (n === 5) this.orderRetreat(gs);
      else if (n === 6) { this.cmdLevel = "formation"; return; }
      else if (n === 7) this.orderFire(gs);
      else return;
      this.cmdLevel = "groups";
      this.relayoutT = 0;
      return;
    }
    if (n >= 1 && n <= FORMATIONS.length) { this.orderFormation(gs, FORMATIONS[n - 1]); this.cmdLevel = "groups"; this.flashPreview(gs); }
  }

  cmdBack() {
    if (this.cmdLevel === "formation") this.cmdLevel = "orders";
    else if (this.cmdLevel === "orders") this.cmdLevel = "groups";
    else this.toggleCmd(false);
  }

  toggleCmd(open = !this.cmdOpen) {
    this.cmdOpen = open;
    this.cmdLevel = "groups";
    this.drag = null;
    if (open) { this.hero.blocking = false; if (this.hero.state === "windup") { this.hero.state = "idle"; } this.hero.drawT = 0; }
    this.sfx.ui();
  }

  handleOrders() {
    const I = this.input;
    if (I.hit("KeyQ")) this.toggleCmd();
    if (this.cmdOpen) {
      for (let n = 1; n <= 9; n++) if (I.hit("Digit" + n) || I.hit("Numpad" + n)) this.cmdChoose(n);
      if (I.hit("Backspace") || I.hit("Digit0")) this.cmdBack();
      const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
      // prawy przycisk: rysowanie pozycji
      if (I.mPressed[2]) this.drag = { sx: wx, sy: wy, ex: wx, ey: wy };
      if (this.drag && I.down[2]) { this.drag.ex = wx; this.drag.ey = wy; }
      if (this.drag && I.mReleased[2]) this.applyDrag();
      // lewy przycisk: kliknięcie żołnierza wybiera jego oddział
      if (I.mPressed[0]) {
        let best: Unit | null = null, bd = 12;
        for (const u of this.units) if (u.team === 0 && !u.hero && u.active) { const d = dist(u.x, u.y - 8, wx, wy); if (d < bd) { bd = d; best = u; } }
        if (best) { this.selected = [best.group as GKey]; this.cmdLevel = "orders"; this.sfx.ui(); }
      }
      return;
    }
    // skróty poza trybem dowodzenia
    if (I.hit("Digit1")) { this.selected = ["inf"]; this.say("Wybrano: piechota"); }
    if (I.hit("Digit2")) { this.selected = ["arch"]; this.say("Wybrano: łucznicy"); }
    if (I.hit("Digit3")) { this.selected = ["inf", "arch"]; this.say("Wybrano: wszyscy"); }
    if (I.hit("KeyZ")) this.orderHere(this.selected, this.cam.x + I.mx, this.cam.y + I.my);
    if (I.hit("KeyX")) this.orderMode(this.selected, "follow");
    if (I.hit("KeyC")) this.orderMode(this.selected, "charge");
    if (I.hit("KeyV")) {
      const cur = this.orders[this.selected[0]].formation;
      this.orderFormation(this.selected, FORMATIONS[(FORMATIONS.indexOf(cur) + 1) % FORMATIONS.length]);
      this.flashPreview(this.selected);
    }
    if (I.hit("KeyB")) this.orderFire(this.selected);
  }

  // ---------- Bohater ----------
  updateHero(dt: number) {
    const h = this.hero, I = this.input;
    if (!h.active) return;
    const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
    h.face = Math.atan2(wy - (h.y - 8), wx - h.x);

    if (I.hit("Tab") && h.state === "idle") {
      h.loadout = (h.loadout + 1) % HERO_LOADOUTS.length;
      const L = HERO_LOADOUTS[h.loadout];
      h.weaponKey = L.weapon; h.hasShield = L.shield; h.drawT = 0;
      this.say(`Broń: ${L.name}`);
    }
    const gst = I.gesture(170);
    if (!this.cmdOpen && Math.abs(gst.x) + Math.abs(gst.y) > 5) {
      this.loadDir = Math.abs(gst.x) > Math.abs(gst.y) ? (gst.x < 0 ? "L" : "R") : (gst.y < 0 ? "O" : "T");
    }

    let mx = 0, my = 0;
    if (I.held("KeyW")) my -= 1; if (I.held("KeyS")) my += 1;
    if (I.held("KeyA")) mx -= 1; if (I.held("KeyD")) mx += 1;
    const ml = Math.hypot(mx, my) || 1;
    const sprint = I.held("ShiftLeft") || I.held("ShiftRight");
    let sp = h.def.speed;
    const canSprint = sprint && h.stamina > 1 && (mx || my) && !h.blocking && h.state === "idle";
    if (canSprint) { sp *= 1.55; h.stamina -= 20 * dt; h.staminaWait = 0.6; }
    if (h.blocking) sp *= 0.55;
    if (h.state === "windup") sp *= 0.7;
    if (h.state === "strike") sp *= 0.5;
    if (h.usingBow && h.drawT > 0) sp *= 0.5;
    if (h.state === "stagger" || h.state === "kick") sp *= 0.2;
    const tvx = (mx / ml) * sp, tvy = (my / ml) * sp;
    const acc = h.state === "strike" || h.state === "stagger" ? 4 : 14;
    h.vx = lerp(h.vx, tvx, clamp(dt * acc, 0, 1)); h.vy = lerp(h.vy, tvy, clamp(dt * acc, 0, 1));
    h.moving = !!(mx || my);

    if (h.staminaWait > 0) h.staminaWait -= dt;
    else if (!h.blocking) h.stamina = Math.min(100, h.stamina + 24 * dt);
    h.stamina = Math.max(0, h.stamina);

    if (this.cmdOpen) { h.blocking = false; return; }
    if (h.usingBow) { this.heroBow(dt, wx, wy); return; }

    if (I.mPressed[2]) {
      if (h.state === "windup") { h.state = "idle"; h.t = 0; h.cooldown = 0.12; this.say("Zwód"); }
      else h.blockStart = this.time;
    }
    h.blocking = I.down[2] && (h.state === "idle" || h.state === "recover") && h.hasShield;
    if (h.blocking) h.staminaWait = Math.max(h.staminaWait, 0.3);

    if (I.mPressed[0] && h.state === "idle" && !h.blocking && h.cooldown <= 0) this.startWindup(h, this.loadDir);
    if (h.state === "windup") { if (I.down[0]) h.hold += dt; else h.released = true; }

    if (I.hit("KeyF") && (h.state === "idle" || h.state === "recover") && h.stamina >= 12) {
      h.state = "kick"; h.t = 0; h.hitDone = false; h.stamina -= 15; h.staminaWait = 0.5; h.blocking = false;
      h.vx += Math.cos(h.face) * 40; h.vy += Math.sin(h.face) * 40;
    }
  }

  heroBow(dt: number, wx: number, wy: number) {
    const h = this.hero, I = this.input;
    h.blocking = false;
    if (h.state !== "idle") return;
    if (I.down[0] && h.ammo > 0) h.drawT = Math.min(1, h.drawT + dt / 0.85);
    if (I.mReleased[0] && h.drawT > 0) {
      if (h.drawT > 0.18) {
        const k = h.drawT;
        const spread = lerp(0.22, 0.015, k) * (h.moving ? 1.8 : 1);
        const a = Math.atan2(wy - (h.y - 9), wx - h.x) + rr(-spread, spread);
        const d = clamp(dist(h.x, h.y - 9, wx, wy), 40, 320);
        this.fire(h, a, lerp(260, 380, k), lerp(14, 36, k), d);
        h.ammo--;
        this.kickCam(-Math.cos(a), -Math.sin(a), 1.2);
      }
      h.drawT = 0;
    }
  }

  // ---------- Walka wręcz ----------
  startWindup(u: Unit, dir: Dir) {
    u.state = "windup"; u.t = 0; u.dir = dir; u.hold = 0; u.released = false; u.hitDone = false;
    u.guard = null; u.guardT = 0; u.trail = [];
    for (const e of this.units) {
      if (e.team === u.team || !e.active || e.hero) continue;
      const d = dist(e.x, e.y, u.x, u.y);
      if (d > 48) continue;
      const facing = Math.abs(angDiff(e.face, Math.atan2(u.y - e.y, u.x - e.x))) < 1.3;
      if (facing && (e.state === "idle" || e.state === "recover") && chance(e.def.guard * (u.hero ? 1 : 0.8)))
        e.pendingGuard = { dir, at: this.time + e.def.react * rr(0.85, 1.25) };
    }
  }

  windupTime(u: Unit) { return u.w.windup * (u.hero ? 1 : rr(1, 1.2)); }
  weight(u: Unit) { return u.w.len >= 14 ? 1.5 : u.w.head ? 1.2 : 1; }

  updateCombat(u: Unit, dt: number) {
    u.t += dt;
    if (u.cooldown > 0) u.cooldown -= dt;
    if (u.flash > 0) u.flash -= dt;
    if (u.bloodT > 0) u.bloodT -= dt;
    if (u.guardT > 0) { u.guardT -= dt; if (u.guardT <= 0) u.guard = null; }
    if (u.pendingGuard && this.time >= u.pendingGuard.at) {
      if (u.state === "idle" || u.state === "recover") { u.guard = u.pendingGuard.dir; u.guardT = 0.75; }
      u.pendingGuard = null;
    }
    const w = u.w;
    switch (u.state) {
      case "windup": {
        const minT = u.hero ? w.windup * 0.75 : this.windupTime(u);
        if (u.t >= minT && (!u.hero || u.released || u.hold > 1.4)) {
          u.state = "strike"; u.t = 0; u.hitDone = false;
          const s = this.vol(u.x);
          this.sfx.swing(s.v * (u.hero ? 1 : 0.45), s.pan, this.weight(u) * (u.hero && u.hold > 0.45 ? 1.25 : 1));
          // wypad do przodu: ciężar ciała idzie za ciosem
          const lunge = (u.hero ? 70 : 40) * (u.dir === "T" ? 1.3 : u.dir === "O" ? 0.8 : 1);
          u.vx += Math.cos(u.face) * lunge; u.vy += Math.sin(u.face) * lunge;
        }
        break;
      }
      case "strike":
        if (!u.hitDone && u.t >= w.strike * 0.45) { u.hitDone = true; this.meleeHit(u); }
        if (u.t >= w.strike) { u.state = "recover"; u.t = 0; }
        break;
      case "recover":
        if (u.t >= w.recover) { u.state = "idle"; u.t = 0; u.cooldown = u.hero ? 0.04 : rr(0.25, 0.9); }
        break;
      case "stagger":
        if (u.t >= u.hold) { u.state = "idle"; u.t = 0; u.hold = 0; }
        break;
      case "kick":
        if (!u.hitDone && u.t >= 0.1) { u.hitDone = true; this.kickHit(u); }
        if (u.t >= 0.26) { u.state = "idle"; u.t = 0; }
        break;
    }
  }

  stagger(u: Unit, time: number) {
    if (!u.active) return;
    u.state = "stagger"; u.t = 0; u.hold = time; u.guard = null; u.guardT = 0; u.pendingGuard = null;
    u.blocking = false; u.drawT = 0;
  }

  push(u: Unit, fromX: number, fromY: number, power: number) {
    const a = Math.atan2(u.y - fromY, u.x - fromX);
    const k = u.def.poise ? 0.35 : 1;
    u.vx += Math.cos(a) * power * k; u.vy += Math.sin(a) * power * k;
  }

  kickCam(dx: number, dy: number, amount: number) {
    this.shakeVX += dx * amount * 90; this.shakeVY += dy * amount * 90;
  }

  meleeHit(a: Unit) {
    const w = a.w, dir = a.dir;
    const arc = dir === "T" ? 0.5 : dir === "O" ? 0.75 : 1.35;
    const reach = w.reach + (dir === "T" ? 4 : 0);
    let best: Unit | null = null, bd = 1e9;
    for (const u of this.units) {
      if (u.team === a.team || !u.active) continue;
      const d = dist(a.x, a.y, u.x, u.y);
      if (d > reach + u.def.radius) continue;
      if (Math.abs(angDiff(a.face, Math.atan2(u.y - a.y, u.x - a.x))) > arc) continue;
      if (d < bd) { bd = d; best = u; }
    }
    if (best) this.resolveHit(a, best);
  }

  parryWindow(d: Unit) { return 0.2; }

  resolveHit(a: Unit, d: Unit) {
    const w = a.w, dir = a.dir;
    const angFromD = Math.abs(angDiff(d.face, Math.atan2(a.y - d.y, a.x - d.x)));
    const s = this.vol(d.x);
    const heroInvolved = a.hero || d.hero;
    const hx = a.x + (d.x - a.x) * 0.6, hy = a.y + (d.y - a.y) * 0.6 - 10;
    const ha = Math.atan2(d.y - a.y, d.x - a.x);

    if (d.hero && d.blocking && angFromD < 1.2) {
      if (this.time - d.blockStart <= this.parryWindow(d)) {
        this.sfx.parry();
        this.hitstop = Math.max(this.hitstop, 0.17); this.kickCam(Math.cos(ha), Math.sin(ha), 1.5);
        this.stagger(a, a.def.poise ? 0.55 : 0.85);
        this.push(a, d.x, d.y, 80);
        this.sparks(hx, hy, 18, PAL.gold); this.impact(hx, hy, PAL.gold, 1.4);
        this.shout("Parowanie!");
        d.stamina = Math.min(100, d.stamina + 8);
        return;
      }
      const cost = 9 + w.dmg[dir] * 0.35;
      d.stamina -= cost; d.staminaWait = 0.6;
      this.sfx.thunk(1, s.pan);
      this.sparks(hx, hy, 6, PAL.steelL); this.impact(hx, hy, PAL.wood, 0.7);
      this.push(d, a.x, a.y, 50);
      this.hitstop = Math.max(this.hitstop, 0.05); this.kickCam(Math.cos(ha), Math.sin(ha), 0.8);
      if (d.stamina <= 0) { d.stamina = 0; this.stagger(d, 0.7); this.shout("Garda przełamana!", PAL.redL); }
      return;
    }
    if (!d.hero && d.guard === dir && angFromD < 1.6 && (d.state === "idle" || d.state === "recover")) {
      this.sfx.clang(s.v, s.pan);
      this.sparks(hx, hy, 9, PAL.steelL); this.impact(hx, hy, PAL.white, 0.8);
      if (a.hero) { this.stagger(a, 0.3); this.hitstop = Math.max(this.hitstop, 0.07); this.kickCam(-Math.cos(ha), -Math.sin(ha), 0.8); this.floater(d.x, d.y - 24, "BLOK", PAL.steelL); this.push(a, d.x, d.y, 50); }
      else a.cooldown = 0.2;
      d.guardT = Math.max(d.guardT, 0.3);
      return;
    }
    if (!d.hero && d.hasShield && d.state === "idle" && angFromD < 1.0) {
      const wall = d.team === 0 && this.orders[d.group as GKey]?.formation === "wall";
      if (chance(d.def.shieldBlock * (wall ? 1.6 : 1))) {
        this.sfx.thunk(s.v, s.pan);
        this.sparks(hx, hy, 3, PAL.wood);
        if (a.hero) { this.floater(d.x, d.y - 24, "TARCZA", PAL.dirtL); this.hitstop = Math.max(this.hitstop, 0.05); }
        return;
      }
    }
    let dmg = w.dmg[dir] * d.def.armor[w.type[dir]] * rr(0.9, 1.1);
    const charged = a.hero && a.hold > 0.45;
    if (a.hero) dmg *= lerp(0.85, 1.3, clamp(a.hold / 0.6, 0, 1));
    const head = dir === "O" && chance(0.45);
    if (head) dmg *= 1.5;
    if (d.state === "windup" && dir === "T") dmg *= 1.15;
    const heavy = dir === "O" || charged || w.type[dir] === "blunt" || w.len >= 14;
    a.bloodT = d.def.undead ? a.bloodT : 8;
    this.damage(d, dmg, a, head, w.type[dir], heavy, hx, hy);
    if (heroInvolved) {
      const killed = d.hp <= 0;
      this.hitstop = Math.max(this.hitstop, (head ? 0.13 : heavy ? 0.11 : 0.075) + (killed ? 0.05 : 0));
      this.kickCam(Math.cos(ha), Math.sin(ha), (d.hero ? 2.2 : heavy ? 1.8 : 1.2) + (killed ? 0.6 : 0));
      if (heavy || head) this.rumble = Math.max(this.rumble, 2);
      if (killed && a.hero) this.slowT = Math.max(this.slowT, 0.18);
    }
  }

  kickHit(a: Unit) {
    for (const u of this.units) {
      if (u.team === a.team || !u.active) continue;
      if (dist(a.x, a.y, u.x, u.y) > 17 + u.def.radius) continue;
      if (Math.abs(angDiff(a.face, Math.atan2(u.y - a.y, u.x - a.x))) > 0.9) continue;
      this.sfx.kick();
      this.stagger(u, u.def.poise ? 0.35 : 0.7);
      this.push(u, a.x, a.y, 140);
      this.hitstop = Math.max(this.hitstop, 0.07);
      this.kickCam(Math.cos(a.face), Math.sin(a.face), 1.4);
      this.dust(u.x, u.y, 8);
      this.impact(u.x, u.y - 9, PAL.dirtL, 0.8);
      return;
    }
  }

  damage(d: Unit, dmg: number, src: Unit | null, head: boolean, type: DmgType = "cut", heavy = false, hx?: number, hy?: number) {
    dmg = Math.round(dmg);
    d.hp -= dmg; d.flash = 0.09;
    const s = this.vol(d.x);
    const x = hx ?? d.x, y = hy ?? d.y - 9;
    if (d.def.undead) {
      this.sfx.bone(s.v, s.pan, heavy);
      if (type === "blunt") this.sfx.hit(s.v * 0.5, s.pan, "blunt", true);
      this.bones(x, y, 5 + (dmg / 5) | 0, src);
      this.impact(x, y, PAL.boneHi, heavy ? 1.2 : 0.9);
    } else {
      this.sfx.hit(s.v, s.pan, type, heavy);
      this.blood(x, y, 8 + (dmg / 2.5) | 0, src, heavy);
      this.impact(x, y, PAL.bloodL, heavy ? 1.2 : 0.9);
      if (src) this.streak(d.x, d.y, Math.atan2(d.y - src.y, d.x - src.x), 5 + dmg / 6);
    }
    if (src) this.push(d, src.x, src.y, 60 + dmg * (heavy ? 1.6 : 1));
    const interrupt = !d.def.poise || head || dmg >= 40 || type === "blunt";
    if (d.hp > 0 && interrupt) this.stagger(d, d.hero ? 0.22 : heavy ? 0.42 : 0.3);
    if (src?.hero || d.hero) this.floater(d.x + rr(-3, 3), d.y - 26, (head ? "GŁOWA " : "") + dmg, d.hero ? PAL.redL : head ? PAL.gold : PAL.white);
    if (d.hero) this.hurtFlash = 0.35;
    if (d.hp <= 0) this.kill(d, src);
  }

  kill(d: Unit, src: Unit | null) {
    const s = this.vol(d.x);
    if (src) src.kills++;
    if (d.hero) {
      d.state = "down"; d.hp = 0; d.blocking = false;
      this.camFree = true;
      this.say("Padłeś ogłuszony. Armia walczy dalej. Kamera: WASD lub strzałki.", PAL.redL);
      this.shout("Padłeś!", PAL.redL);
      this.slowT = 1;
      for (const u of this.units) if (u.team === 0 && !u.hero) u.morale -= 25;
      return;
    }
    d.state = "dead";
    this.sfx.death(s.v * 0.8, s.pan, !!d.def.undead);
    const dirI = Math.abs(Math.cos(d.face)) > Math.abs(Math.sin(d.face)) * 0.9 ? 2 : Math.sin(d.face) > 0 ? 0 : 1;
    const bones = !!d.def.undead && !d.commander;
    this.corpses.push({ x: d.x, y: d.y, img: d.spr.frames[dirI][0], flip: Math.cos(d.face) < 0, rot: src && Math.cos(Math.atan2(d.y - src.y, d.x - src.x)) < 0 ? -1 : 1, undead: !!d.def.undead, bones, t: 0, pooled: false });
    if (bones) this.bones(d.x, d.y - 8, 12, src);
    for (const u of this.units) {
      if (!u.active || u.def.undead) continue;
      const near = dist(u.x, u.y, d.x, d.y) < 90;
      if (u.team === d.team && near) u.morale -= 8;
      if (u.team !== d.team && near) u.morale = Math.min(100, u.morale + 3);
    }
    if (d.commander) this.collapse();
    if (src?.hero) this.say(`Zabiłeś: ${d.def.name}`);
  }

  collapse() {
    this.sfx.wail();
    this.shout("Rycerz Śmierci padł!", PAL.purpleL);
    this.say("Klątwa słabnie. Nieumarli rozpadają się!", PAL.purpleL);
    this.slowT = 1.2;
    this.rumble = 4;
    for (let i = 0; i < 40; i++) this.parts.push({ x: this.dk.x + rr(-6, 6), y: this.dk.y, z: rr(4, 20), vx: rr(-20, 20), vy: rr(-20, 20), vz: rr(20, 70), life: 1.4, max: 1.4, col: pick([PAL.purpleL, PAL.purple]), kind: "soul" });
    for (const u of this.units) if (u.team === 1 && u.active) u.decay = true;
    for (const u of this.units) if (u.team === 0 && u.active) u.morale = Math.min(100, u.morale + 30);
  }

  // ---------- Łuki ----------
  fire(u: Unit, a: number, speed: number, dmg: number, d: number) {
    const ox = u.x + Math.cos(a) * 6, oy = u.y - 9 + Math.sin(a) * 6;
    this.arrows.push({ x: ox, y: oy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, team: u.team, src: u, dmg, age: 0, travel: 0, dist: d, done: false });
    const s = this.vol(u.x);
    this.sfx.bow(s.v * (u.hero ? 1 : 0.4), s.pan);
  }

  updateArrows(dt: number) {
    for (const ar of this.arrows) {
      if (ar.done) continue;
      const step = Math.hypot(ar.vx, ar.vy) * dt;
      ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.age += dt; ar.travel += step;
      const p = ar.travel / ar.dist;
      const low = ar.travel < 14 || p > 0.78;
      if (low && ar.age > 0.03) {
        for (const u of this.units) {
          if (!u.active || u === ar.src) continue;
          if (dist(u.x, u.y - 8, ar.x, ar.y) > u.def.radius + 3) continue;
          this.arrowHit(ar, u);
          if (ar.done) break;
        }
      }
      if (!ar.done && (p > 1.15 || ar.x < 0 || ar.y < 0 || ar.x > WW || ar.y > WH)) {
        ar.done = true;
        const a = Math.atan2(ar.vy, ar.vx);
        pxLine(this.dg, ar.x, ar.y + 9, ar.x - Math.cos(a) * 4, ar.y + 9 - Math.sin(a) * 4, PAL.woodD);
        this.dg.fillStyle = PAL.white; this.dg.fillRect(Math.round(ar.x - Math.cos(a) * 4), Math.round(ar.y + 9 - Math.sin(a) * 4), 1, 1);
      }
    }
    this.arrows = this.arrows.filter((a) => !a.done);
  }

  arrowHit(ar: Arrow, u: Unit) {
    const back = Math.atan2(-ar.vy, -ar.vx);
    const facing = Math.abs(angDiff(u.face, back));
    const s = this.vol(u.x);
    if (u.team === 0 && !u.hero && this.orders[u.group as GKey]?.formation === "loose" && chance(0.25)) return; // przeleciała między szeregami
    ar.done = true;
    if (u.hero && u.blocking && facing < 1.25) { this.sfx.thunk(1, s.pan); this.sparks(u.x, u.y - 9, 3, PAL.wood); return; }
    if (!u.hero && u.hasShield && u.state === "idle" && facing < 1.1) {
      const wall = u.team === 0 && this.orders[u.group as GKey]?.formation === "wall";
      if (chance(wall ? 0.88 : 0.5)) { this.sfx.thunk(s.v * 0.6, s.pan); return; }
    }
    const head = chance(0.12);
    const dmg = ar.dmg * u.def.armor.pierce * rr(0.85, 1.15) * (head ? 1.5 : 1);
    if (ar.src.team === u.team && ar.src.hero) this.say("Trafiłeś swojego!", PAL.redL);
    this.sfx.arrowHit(s.v, s.pan);
    this.damage(u, dmg, null, head, "pierce", false);
    this.push(u, u.x - ar.vx, u.y - ar.vy, 25);
    if (ar.src.hero) { this.hitstop = Math.max(this.hitstop, 0.05); }
  }

  // ---------- AI ----------
  updateAI(u: Unit, dt: number) {
    if (u.decay) {
      u.hp -= 6 * dt;
      if (chance(dt * 6)) this.parts.push({ x: u.x + rr(-4, 4), y: u.y, z: rr(4, 14), vx: rr(-6, 6), vy: rr(-6, 6), vz: rr(8, 20), life: 0.8, max: 0.8, col: PAL.purpleL, kind: "soul" });
      if (u.hp <= 0) { this.kill(u, null); return; }
    }
    if (u.state === "stagger" || u.state === "strike" || u.state === "kick") { u.moving = false; return; }

    if (!u.def.undead && !u.fleeing && u.morale < 18) {
      u.fleeing = true;
      if (chance(0.5)) this.say(`${u.def.name} ucieka z pola bitwy!`, PAL.ash);
    }
    if (u.fleeing) {
      const ec = this.centroid(1 - u.team);
      const a = Math.atan2(u.y - ec.y, u.x - ec.x);
      this.steer(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, u.def.speed * 1.1, dt);
      u.face = a;
      if (u.x < 4 || u.y < 4 || u.x > WW - 4 || u.y > WH - 4) u.state = "fled";
      return;
    }

    let mode: Mode = "hold", fire = true;
    if (u.team === 0) { const o = this.orders[u.group as GKey]; mode = o.mode; fire = o.fire; }
    else mode = this.enemyCharge && u.group !== "skelArch" ? "charge" : "hold";
    const engage = mode === "charge" ? 9999 : mode === "hold" ? 50 : 70;

    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || !u.target.active) { u.retarget = rr(0.3, 0.6); u.target = this.chooseTarget(u); }
    const t = u.target;
    const td = t ? dist(u.x, u.y, t.x, t.y) : 1e9;

    if (u.def.bow && t) {
      const near = this.nearestEnemy(u);
      const closeThreat = near && dist(u.x, u.y, near.x, near.y) < 26;
      if (!closeThreat && fire && td < u.def.bow.range && mode !== "charge") {
        if (u.state === "idle") {
          this.steer(u, u.slotX, u.slotY, u.def.speed * 0.6, dt, 6);
          u.moving = false;
          u.face = Math.atan2(t.y - u.y, t.x - u.x);
          u.reload -= dt;
          if (u.reload <= 0 && u.ammo > 0) {
            const lead = td / 300;
            const tx = t.x + t.vx * lead, ty = t.y + t.vy * lead;
            const a = Math.atan2(ty - (u.y - 9), tx - u.x) + rr(-1, 1) * u.def.bow.spread * (1 + td / 260);
            this.fire(u, a, 300, u.def.bow.dmg, dist(u.x, u.y, tx, ty));
            u.ammo--; u.reload = u.def.bow.reload * rr(0.85, 1.25);
          }
        }
        return;
      }
      if (closeThreat) u.target = near;
    }

    const tgt = u.target;
    const tdist = tgt ? dist(u.x, u.y, tgt.x, tgt.y) : 1e9;
    const slotDist = tgt ? dist(u.slotX, u.slotY, tgt.x, tgt.y) : 1e9;
    const engaged = tgt && (mode === "charge" || tdist < engage || slotDist < engage + 15);

    if (engaged && tgt) {
      const want = u.w.reach - 4 + tgt.def.radius;
      const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      if (u.state === "idle" || u.state === "recover") u.face = a;
      if (u.state === "windup") u.face = u.face + angDiff(u.face, a) * 0.2;
      if (tdist > want) this.steer(u, tgt.x, tgt.y, u.def.speed * (u.state === "windup" ? 0.6 : 1), dt);
      else {
        this.steer(u, u.x - Math.cos(a) * 3, u.y - Math.sin(a) * 3, u.def.speed * 0.3, dt);
        u.moving = false;
        if (u.state === "idle" && u.cooldown <= 0) {
          const dirs = (["L", "R", "O", "T"] as Dir[]).filter((d) => d !== tgt.guard);
          this.startWindup(u, pick(dirs));
        }
      }
      if (tgt.hero && u.state === "idle") {
        u.idleGuardT -= dt;
        if (u.idleGuardT <= 0) {
          u.idleGuardT = rr(0.9, 2.2);
          if (chance(0.5)) { u.guard = pick<Dir>(["L", "R", "O", "T"]); u.guardT = rr(0.8, 1.6); }
        }
      }
    } else {
      const d = dist(u.x, u.y, u.slotX, u.slotY);
      const formSpeed = u.team === 0 && this.orders[u.group as GKey]?.formation === "wall" ? 0.65 : 1;
      if (d > 2) this.steer(u, u.slotX, u.slotY, u.def.speed * formSpeed * (d > 40 ? 1.15 : 1), dt, 3);
      else { u.vx *= 0.8; u.vy *= 0.8; u.moving = false; }
      if (d < 8 && u.state === "idle") u.face = u.face + angDiff(u.face, u.slotFace) * clamp(dt * 6, 0, 1);
    }
  }

  nearestEnemy(u: Unit): Unit | null {
    let b: Unit | null = null, bd = 1e9;
    for (const e of this.units) {
      if (e.team === u.team || !e.active) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d < bd) { bd = d; b = e; }
    }
    return b;
  }

  chooseTarget(u: Unit): Unit | null {
    if (u.commander && this.hero.active && dist(u.x, u.y, this.hero.x, this.hero.y) < 170) return this.hero;
    const counts = new Map<Unit, number>();
    for (const o of this.units) if (o.team === u.team && o.active && o.target && o !== u) counts.set(o.target, (counts.get(o.target) || 0) + 1);
    let b: Unit | null = null, bs = 1e9;
    for (const e of this.units) {
      if (e.team === u.team || !e.active) continue;
      let s = dist(u.x, u.y, e.x, e.y);
      const c = counts.get(e) || 0;
      if (!u.def.bow && c >= 3) s += 120;
      s += c * 10;
      if (s < bs) { bs = s; b = e; }
    }
    return b;
  }

  steer(u: Unit, tx: number, ty: number, speed: number, dt: number, arrive = 0) {
    let dx = tx - u.x, dy = ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    let sp = speed;
    if (arrive && d < arrive * 4) sp *= d / (arrive * 4);
    dx /= d; dy /= d;
    let sx = 0, sy = 0;
    for (const o of this.units) {
      if (o === u || !o.active) continue;
      const ox = u.x - o.x, oy = u.y - o.y, od = Math.hypot(ox, oy);
      if (od < 11 && od > 0.01) { const k = (11 - od) / 11; sx += (ox / od) * k; sy += (oy / od) * k; }
    }
    for (const ob of this.obstacles) {
      if (!ob.r) continue;
      const ox = u.x - ob.x, oy = u.y - ob.y, od = Math.hypot(ox, oy);
      if (od < ob.r + 16 && od > 0.01) { const k = (ob.r + 16 - od) / 16; sx += (ox / od) * k * 1.5; sy += (oy / od) * k * 1.5; }
    }
    const vx = (dx + sx * 0.9) * sp, vy = (dy + sy * 0.9) * sp;
    u.vx = lerp(u.vx, vx, clamp(dt * 8, 0, 1));
    u.vy = lerp(u.vy, vy, clamp(dt * 8, 0, 1));
    u.moving = sp > 5;
  }

  // ---------- Efekty ----------
  blood(x: number, y: number, n: number, src: Unit | null, heavy = false) {
    const a0 = src ? Math.atan2(y - src.y + 9, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + rr(-0.8, 0.8), sp = rr(25, heavy ? 140 : 100);
      this.parts.push({ x, y: y + 10, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rr(15, 80), life: 2, max: 2, col: pick([PAL.blood, PAL.bloodL, PAL.bloodD, PAL.blood]), kind: "blood" });
    }
  }
  bones(x: number, y: number, n: number, src: Unit | null) {
    const a0 = src ? Math.atan2(y - src.y + 9, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + rr(-1, 1), sp = rr(20, 80);
      this.parts.push({ x, y: y + 10, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rr(20, 70), life: 2, max: 2, col: pick([PAL.bone, PAL.boneHi, PAL.ash]), kind: "bone" });
    }
  }
  sparks(x: number, y: number, n: number, col: string) {
    for (let i = 0; i < n; i++) {
      const a = rr(0, 6.28), sp = rr(40, 140);
      this.parts.push({ x, y: y + 10, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rr(10, 70), life: rr(0.12, 0.3), max: 0.3, col, kind: "spark" });
    }
  }
  impact(x: number, y: number, col: string, size: number) {
    this.parts.push({ x, y: y + 10, z: 10, vx: 0, vy: 0, vz: 0, life: 0.07, max: 0.07, col: PAL.white, kind: "flash" });
    this.parts.push({ x, y: y + 10, z: 10, vx: size, vy: 0, vz: 0, life: 0.16, max: 0.16, col, kind: "ring" });
  }
  dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rr(-4, 4), y, z: 1, vx: rr(-25, 25), vy: rr(-10, 10), vz: rr(5, 20), life: 0.5, max: 0.5, col: PAL.dirtL, kind: "dust" });
  }
  streak(x: number, y: number, a: number, len: number) {
    for (let i = 0; i < len; i++) {
      const px = x + Math.cos(a) * (i + 3) + rr(-1, 1), py = y + Math.sin(a) * (i + 3) * 0.7 + rr(-0.5, 0.5);
      this.dg.fillStyle = i < len * 0.6 ? PAL.blood : PAL.bloodD;
      if (chance(0.85)) this.dg.fillRect(Math.round(px), Math.round(py), 1, 1);
    }
  }
  pool(x: number, y: number, r: number) {
    const g = this.dg;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r * 1.5; xx <= r * 1.5; xx++) {
      if ((xx * xx) / 2.25 + yy * yy <= r * r * rr(0.6, 1)) { g.fillStyle = chance(0.85) ? PAL.bloodD : PAL.blood; g.fillRect(Math.round(x + xx), Math.round(y + yy + 1), 1, 1); }
    }
  }
  floater(x: number, y: number, text: string, col: string) { this.floaters.push({ x, y, text, col, t: 0.9 }); }

  updateParticles(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.kind === "flash" || p.kind === "ring") continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= (p.kind === "soul" ? -20 : 240) * dt;
      if (p.kind === "dust" || p.kind === "soul") { p.vx *= 0.92; p.vy *= 0.92; }
      if (p.z <= 0 && (p.kind === "blood" || p.kind === "bone")) {
        this.dg.fillStyle = p.col;
        this.dg.fillRect(Math.round(p.x), Math.round(p.y), p.kind === "blood" && chance(0.4) ? 2 : 1, 1);
        p.life = 0;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.t -= dt; f.y -= 14 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    for (const c of this.corpses) if (c.t < 1) {
      c.t = Math.min(1, c.t + dt / 0.38);
      if (c.t >= 1 && !c.pooled) { c.pooled = true; if (!c.undead) this.pool(c.x, c.y, 3 + rnd() * 3); this.dust(c.x, c.y, 5); }
    }
  }

  // ---------- Pętla ----------
  update(realDt: number) {
    const I = this.input;
    this.real += realDt;
    if (I.hit("KeyP") || (I.hit("Escape") && !this.cmdOpen)) { if (this.phase === "fight") this.paused = !this.paused; }
    else if (I.hit("Escape") && this.cmdOpen) this.toggleCmd(false);
    if (I.hit("KeyM")) this.say(this.sfx.toggleMusic() ? "Muzyka: włączona" : "Muzyka: wyłączona");
    for (const l of this.log) l.t -= realDt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.banner) { this.banner.t -= realDt; if (this.banner.t <= 0) this.banner = null; }
    if (this.hurtFlash > 0) this.hurtFlash -= realDt;
    for (const p of this.preview) p.t -= realDt;
    this.preview = this.preview.filter((p) => p.t > 0);

    // sprężyna kamery (drganie kierunkowe)
    const k = 520, damp = Math.pow(0.0009, realDt);
    this.shakeVX -= this.shakeX * k * realDt; this.shakeVY -= this.shakeY * k * realDt;
    this.shakeVX *= damp; this.shakeVY *= damp;
    this.shakeX += this.shakeVX * realDt; this.shakeY += this.shakeVY * realDt;
    this.rumble = Math.max(0, this.rumble - realDt * 18);

    this.updateCamera(realDt);
    let fighting = 0;
    for (const u of this.units) if (u.active && (u.state === "windup" || u.state === "strike")) fighting++;
    this.intensity = this.phase === "fight" ? clamp(fighting / 10, 0, 1) : 0;
    this.sfx.tick(realDt, this.intensity);
    if (this.phase !== "fight" || this.paused) return;

    if (this.hitstop > 0) { this.hitstop -= realDt; return; }
    if (this.slowT > 0) this.slowT -= realDt;
    this.slowmo = I.held("Space") || this.cmdOpen;
    const scale = this.slowmo ? 0.3 : this.slowT > 0 ? 0.35 : 1;
    const dt = Math.min(realDt, 0.05) * scale;
    this.time += dt;

    this.handleOrders();
    this.updateHero(dt);

    this.relayoutT -= dt;
    if (this.relayoutT <= 0) { this.relayoutT = 0.4; this.enemyPlan(); this.layoutAll(); }

    for (const u of this.units) {
      if (!u.active) continue;
      this.updateCombat(u, dt);
      if (!u.hero) this.updateAI(u, dt);
    }
    for (const u of this.units) {
      if (!u.active) continue;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (!u.hero && !u.moving) { u.vx *= Math.pow(0.02, dt); u.vy *= Math.pow(0.02, dt); }
      if (u.state === "stagger") { u.vx *= Math.pow(0.04, dt); u.vy *= Math.pow(0.04, dt); }
      const speed = Math.hypot(u.vx, u.vy);
      if (speed > 8) u.anim += dt * speed * 0.12;
      if (!u.fleeing) { u.x = clamp(u.x, 6, WW - 6); u.y = clamp(u.y, 12, WH - 6); }
    }
    this.collide();
    this.updateArrows(dt);
    this.updateParticles(dt);
    this.checkEnd();
  }

  enemyPlan() {
    const pc = this.centroid(0);
    if (!this.enemyCharge) {
      const a = Math.atan2(pc.y - this.enemyAnchor.y, pc.x - this.enemyAnchor.x);
      this.enemyAnchor.x += Math.cos(a) * 8; this.enemyAnchor.y += Math.sin(a) * 8;
      let nearest = 1e9;
      for (const u of this.units) if (u.team === 1 && u.active && u.group !== "skelArch")
        for (const p of this.units) if (p.team === 0 && p.active) nearest = Math.min(nearest, dist(u.x, u.y, p.x, p.y));
      if (nearest < 120 || this.time > 50) {
        this.enemyCharge = true;
        this.say("Nieumarli ruszają do szarży!", PAL.purpleL);
        this.sfx.wail();
      }
    }
  }

  collide() {
    const act = this.units.filter((u) => u.active);
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), m = a.def.radius + b.def.radius - 1;
      if (d < m && d > 0.001) {
        const push = (m - d) / 2, nx = dx / d, ny = dy / d;
        const wa = a.def.poise ? 0.3 : 1, wb = b.def.poise ? 0.3 : 1;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
      }
    }
    for (const u of act) for (const o of this.obstacles) {
      if (!o.r) continue;
      const dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy), m = o.r + u.def.radius;
      if (d < m && d > 0.001) { u.x = o.x + (dx / d) * m; u.y = o.y + (dy / d) * m; }
    }
  }

  checkEnd() {
    const foes = this.units.filter((u) => u.team === 1 && u.active).length;
    const ours = this.units.filter((u) => u.team === 0 && u.active).length;
    if (foes === 0) { this.phase = "end"; this.result = "win"; this.shout("Zwycięstwo!"); this.sfx.shout(1); this.cmdOpen = false; }
    else if (ours === 0) { this.phase = "end"; this.result = "lose"; this.shout("Klęska", PAL.redL); this.cmdOpen = false; }
  }

  updateCamera(dt: number) {
    const I = this.input;
    if (!this.hero.active) this.camFree = true;
    const sp = 260 * dt;
    if (this.camFree || this.cmdOpen) {
      if (I.held("ArrowLeft")) this.cam.x -= sp; if (I.held("ArrowRight")) this.cam.x += sp;
      if (I.held("ArrowUp")) this.cam.y -= sp; if (I.held("ArrowDown")) this.cam.y += sp;
      if (this.cmdOpen && this.hero.active) {
        // przy krawędzi ekranu kamera przesuwa się w tę stronę
        const m = 10;
        if (I.mx < m) this.cam.x -= sp; if (I.mx > W - m) this.cam.x += sp;
        if (I.my < m) this.cam.y -= sp; if (I.my > H - m) this.cam.y += sp;
      }
      if (!this.hero.active) {
        if (I.held("KeyA")) this.cam.x -= sp; if (I.held("KeyD")) this.cam.x += sp;
        if (I.held("KeyW")) this.cam.y -= sp; if (I.held("KeyS")) this.cam.y += sp;
      }
    } else {
      const h = this.hero;
      const tx = h.x - W / 2 + (I.mx - W / 2) * 0.18, ty = h.y - H / 2 + (I.my - H / 2) * 0.18;
      this.cam.x = lerp(this.cam.x, tx, clamp(dt * 7, 0, 1));
      this.cam.y = lerp(this.cam.y, ty, clamp(dt * 7, 0, 1));
    }
    this.cam.x = clamp(this.cam.x, 0, WW - W); this.cam.y = clamp(this.cam.y, 0, WH - H);
  }

  // ---------- Rysowanie ----------
  render(g: CanvasRenderingContext2D) {
    const sx = Math.round(this.cam.x + this.shakeX + rr(-1, 1) * this.rumble * 0.5), sy = Math.round(this.cam.y + this.shakeY + rr(-1, 1) * this.rumble * 0.5);
    g.drawImage(this.ground, clamp(sx, 0, WW - W), clamp(sy, 0, WH - H), W, H, clamp(sx, 0, WW - W) - sx, clamp(sy, 0, WH - H) - sy, W, H);
    g.drawImage(this.decals, sx, sy, W, H, 0, 0, W, H);
    const vis = (x: number, y: number, m = 40) => x > sx - m && x < sx + W + m && y > sy - m && y < sy + H + m;

    for (const c of this.corpses) if (vis(c.x, c.y)) this.drawCorpse(g, c, sx, sy);

    // znaczniki rozkazów
    if (this.phase !== "end") for (const gname of ["inf", "arch"] as const) {
      const o = this.orders[gname];
      if (o.mode !== "hold") continue;
      const fx = Math.round(o.ax - sx), fy = Math.round(o.ay - sy);
      const sel = this.selected.includes(gname);
      g.globalAlpha = sel || this.cmdOpen ? 0.9 : 0.35;
      g.fillStyle = PAL.ink; g.fillRect(fx - 1, fy - 12, 3, 13);
      g.fillStyle = PAL.wood; g.fillRect(fx, fy - 11, 1, 11);
      g.fillStyle = gname === "inf" ? PAL.red : PAL.moss; g.fillRect(fx + 1, fy - 11, 6, 4);
      g.fillStyle = PAL.gold; g.fillRect(fx + 3, fy - 10, 1, 1);
      g.globalAlpha = 1;
    }
    // podgląd szyku
    const drawSlots = (slots: Slot[], col: string, alpha: number) => {
      g.globalAlpha = alpha;
      for (const s of slots) {
        const x = Math.round(s.x - sx), y = Math.round(s.y - sy);
        g.fillStyle = PAL.ink; g.fillRect(x - 2, y - 1, 5, 3);
        g.fillStyle = col; g.fillRect(x - 1, y, 3, 1);
        g.fillRect(Math.round(x + Math.cos(s.face) * 3), Math.round(y + Math.sin(s.face) * 3), 1, 1);
      }
      g.globalAlpha = 1;
    };
    for (const p of this.preview) drawSlots(p.slots, p.col, clamp(p.t, 0, 1));
    if (this.drag) {
      const plan = this.dragPlan(this.drag);
      pxLine(g, this.drag.sx - sx, this.drag.sy - sy, this.drag.ex - sx, this.drag.ey - sy, PAL.gold);
      for (const p of plan) drawSlots(p.slots, p.g === "inf" ? PAL.redL : PAL.moss, 0.95);
    }

    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const o of this.obstacles) if (vis(o.x, o.y, 50)) list.push({ y: o.y - (o.r ? 0 : 20), draw: () => g.drawImage(o.img, Math.round(o.x - sx - o.img.width / 2), Math.round(o.y - sy - o.img.height + 3)) });
    for (const u of this.units) if (u.alive && vis(u.x, u.y)) list.push({ y: u.y, draw: () => this.drawUnit(g, u, sx, sy) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    for (const ar of this.arrows) {
      if (!vis(ar.x, ar.y)) continue;
      const p = clamp(ar.travel / ar.dist, 0, 1);
      const lift = Math.sin(p * Math.PI) * Math.min(26, ar.dist * 0.12);
      const a = Math.atan2(ar.vy - Math.cos(p * Math.PI) * 40, ar.vx);
      const x = ar.x - sx, y = ar.y - sy - lift;
      g.fillStyle = "rgba(13,11,14,0.35)"; g.fillRect(Math.round(ar.x - sx), Math.round(ar.y - sy + 9), 2, 1);
      pxLine(g, x, y, x - Math.cos(a) * 6, y - Math.sin(a) * 6, PAL.wood);
      g.fillStyle = PAL.steelL; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillStyle = PAL.white; g.fillRect(Math.round(x - Math.cos(a) * 6), Math.round(y - Math.sin(a) * 6), 1, 1);
    }
    for (const p of this.parts) {
      if (!vis(p.x, p.y)) continue;
      const px = Math.round(p.x - sx), py = Math.round(p.y - sy - p.z);
      if (p.kind === "flash") {
        g.fillStyle = PAL.white;
        g.fillRect(px - 3, py, 7, 1); g.fillRect(px, py - 3, 1, 7); g.fillRect(px - 1, py - 1, 3, 3);
        continue;
      }
      if (p.kind === "ring") {
        const k = 1 - p.life / p.max, r = Math.round((2 + k * 6) * p.vx);
        g.globalAlpha = 1 - k; g.fillStyle = p.col;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r * 0.7), 1, 1); }
        g.globalAlpha = 1;
        continue;
      }
      g.globalAlpha = p.kind === "dust" || p.kind === "soul" ? clamp(p.life / p.max * 1.5, 0, 1) : 1;
      g.fillStyle = p.col;
      g.fillRect(px, py, 1, p.kind === "blood" && p.vz < 0 ? 2 : 1);
    }
    g.globalAlpha = 1;

    this.drawTells(g, sx, sy);
    for (const f of this.floaters) {
      g.globalAlpha = clamp(f.t * 2, 0, 1);
      pxText(g, f.text, Math.round(f.x - sx - textW(f.text) / 2), Math.round(f.y - sy), f.col);
    }
    g.globalAlpha = 1;

    // mgła i popiół
    g.save();
    g.imageSmoothingEnabled = true;
    g.globalAlpha = 0.09;
    const fo = (this.real * 6 + sx * 0.6) % (W * 1.5), foy = (sy * 0.6) % (H * 1.5);
    g.drawImage(this.fog, -fo, -foy, W * 1.5, H * 1.5); g.drawImage(this.fog, W * 1.5 - fo, -foy, W * 1.5, H * 1.5);
    g.drawImage(this.fog, -fo, H * 1.5 - foy, W * 1.5, H * 1.5); g.drawImage(this.fog, W * 1.5 - fo, H * 1.5 - foy, W * 1.5, H * 1.5);
    g.restore();
    for (const a of this.ash) {
      const ax = ((a.x - sx * a.p * 0.5 + this.real * a.s * 0.8) % W + W) % W;
      const ay = ((a.y - sy * a.p * 0.5 + this.real * a.s) % H + H) % H;
      g.globalAlpha = 0.35 + a.p * 0.4; g.fillStyle = a.c;
      g.fillRect(Math.round(ax + Math.sin(this.real + a.x) * 2), Math.round(ay), 1, 1);
    }
    g.globalAlpha = 1;

    g.globalCompositeOperation = "multiply";
    g.fillStyle = this.cmdOpen ? "#a59bb4" : this.slowmo ? "#9d93b8" : "#d6cdd8";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    g.drawImage(this.vignette, 0, 0);
    if (this.hurtFlash > 0) { g.fillStyle = `rgba(112,23,25,${this.hurtFlash})`; g.fillRect(0, 0, W, H); }
    if (this.dk.active && !this.dk.decay && vis(this.dk.x, this.dk.y)) {
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(this.dk.x - sx, this.dk.y - sy - 10, 2, this.dk.x - sx, this.dk.y - sy - 10, 30);
      gr.addColorStop(0, "rgba(160,102,204,0.28)"); gr.addColorStop(1, "rgba(160,102,204,0)");
      g.fillStyle = gr; g.fillRect(this.dk.x - sx - 32, this.dk.y - sy - 42, 64, 64);
      g.globalCompositeOperation = "source-over";
    }
    // w trybie dowodzenia: obwódki wybranych oddziałów ponad mgłą
    if (this.cmdOpen) for (const u of this.units) {
      if (u.team !== 0 || u.hero || !u.active || !this.selected.includes(u.group as GKey)) continue;
      const x = Math.round(u.x - sx), y = Math.round(u.y - sy);
      g.fillStyle = u.group === "inf" ? PAL.redL : PAL.moss;
      g.fillRect(x - 3, y + 1, 7, 1); g.fillRect(x - 4, y, 1, 1); g.fillRect(x + 4, y, 1, 1);
    }
    if (this.phase === "fight") {
      const mx = Math.round(this.input.mx), my = Math.round(this.input.my);
      g.fillStyle = PAL.ink;
      g.fillRect(mx - 4, my - 1, 9, 3); g.fillRect(mx - 1, my - 4, 3, 9);
      g.fillStyle = this.cmdOpen ? PAL.gold : PAL.white;
      g.fillRect(mx - 3, my, 2, 1); g.fillRect(mx + 2, my, 2, 1); g.fillRect(mx, my - 3, 1, 2); g.fillRect(mx, my + 2, 1, 2);
    }
  }

  drawCorpse(g: CanvasRenderingContext2D, c: Corpse, sx: number, sy: number) {
    if (c.bones && c.t >= 1) { g.drawImage(BONES, Math.round(c.x - sx - 7), Math.round(c.y - sy - 5)); return; }
    const img = c.img;
    const e = 1 - Math.pow(1 - c.t, 3);
    const ang = c.rot * (Math.PI / 2) * (e + Math.sin(e * Math.PI) * 0.12);
    g.save();
    g.translate(Math.round(c.x - sx), Math.round(c.y - sy - 1));
    g.rotate(ang);
    if (c.flip) g.scale(-1, 1);
    g.drawImage(img, -Math.round(img.width / 2), -img.height + 2);
    g.restore();
  }

  weaponAngle(u: Unit): { a: number; ext: number } {
    const f = u.face, w = u.w;
    const side = (d: Dir) => (d === "L" ? -1 : 1);
    const ease = (p: number) => 1 - Math.pow(1 - p, 3);
    switch (u.state) {
      case "windup": {
        const p = clamp(u.t / (u.hero ? w.windup * 0.75 : w.windup), 0, 1), e = ease(p);
        if (u.dir === "O") return { a: f + angDiff(f, -Math.PI / 2 - 0.3 * Math.sign(Math.cos(f))) * e, ext: -1 * e };
        if (u.dir === "T") return { a: f, ext: -6 * e };
        return { a: f + 0.9 + angDiff(f + 0.9, f + side(u.dir) * 2.1) * e, ext: 0 };
      }
      case "strike": {
        const p = ease(clamp(u.t / w.strike, 0, 1));
        if (u.dir === "O") { const from = -Math.PI / 2 - 0.3 * Math.sign(Math.cos(f)); return { a: from + angDiff(from, f + 0.2) * p, ext: 2 * p }; }
        if (u.dir === "T") return { a: f, ext: lerp(-6, 8, p) };
        return { a: f + side(u.dir) * lerp(2.1, -1.5, p), ext: 1 };
      }
      case "recover": {
        const p = clamp(u.t / w.recover, 0, 1);
        if (u.dir === "T") return { a: f, ext: lerp(8, 0, p) };
        const end = u.dir === "O" ? f + 0.2 : f + side(u.dir) * -1.5;
        return { a: end + angDiff(end, f + 0.9) * p, ext: 0 };
      }
      case "kick": return { a: f + 1.3, ext: 0 };
      case "stagger": return { a: f + 1.6, ext: -1 };
      default: return { a: f + 0.9 + Math.sin(this.real * 2 + u.id) * 0.05, ext: 0 };
    }
  }

  drawUnit(g: CanvasRenderingContext2D, u: Unit, sx: number, sy: number) {
    if (u.state === "down") {
      this.drawCorpse(g, { x: u.x, y: u.y, img: u.spr.frames[0][0], flip: false, rot: 1, undead: false, bones: false, t: 1, pooled: true }, sx, sy);
      return;
    }
    const c = Math.cos(u.face), s = Math.sin(u.face);
    let dirI = 0, flip = false;
    if (Math.abs(c) > Math.abs(s) * 0.9) { dirI = 2; flip = c < 0; } else dirI = s > 0 ? 0 : 1;
    const moving = Math.hypot(u.vx, u.vy) > 8;
    const frame = moving ? 1 + (Math.floor(u.anim) % 2) : 0;
    const img = u.spr.frames[dirI][frame];
    // pochylenie ciała: do tyłu przy zamachu, do przodu przy ciosie
    let lean = 0;
    if (u.state === "windup") lean = -1;
    else if (u.state === "strike") lean = 2;
    else if (u.state === "recover") lean = u.t < 0.08 ? 1 : 0;
    const bob = moving && Math.floor(u.anim) % 2 === 1 ? -1 : 0;
    const x = Math.round(u.x - sx + c * lean), y = Math.round(u.y - sy + s * lean * 0.6);

    // cień (dithering)
    g.fillStyle = "rgba(13,11,14,0.45)";
    const sw = u.spr.w > 16 ? 6 : 4;
    g.fillRect(Math.round(u.x - sx) - sw, Math.round(u.y - sy) - 1, sw * 2 + 1, 2);
    g.fillRect(Math.round(u.x - sx) - sw + 1, Math.round(u.y - sy) - 2, sw * 2 - 1, 1);
    if (u.hero) { g.fillStyle = PAL.gold; g.fillRect(Math.round(u.x - sx) - 2, Math.round(u.y - sy) + 1, 5, 1); }

    const hand = { x: x + c * 3, y: y - 10 + s * 2 + bob };
    const wa = this.weaponAngle(u);
    const drawGear = () => this.drawGear(g, u, hand, wa);
    if (dirI === 1) drawGear();
    let off = 0;
    if (u.state === "stagger") off = Math.round(Math.sin(u.t * 70) * 1);
    const ix = x - Math.floor(img.width / 2) + off, iy = y - img.height + 1 + bob;
    const draw = (im: HTMLCanvasElement) => {
      if (flip) { g.save(); g.translate(ix + im.width, iy); g.scale(-1, 1); g.drawImage(im, 0, 0); g.restore(); }
      else g.drawImage(im, ix, iy);
    };
    draw(img);
    if (u.flash > 0) { g.globalAlpha = clamp(u.flash / 0.09, 0, 1); draw(u.spr.white[dirI][frame]); g.globalAlpha = 1; }
    if (u.decay) { g.globalAlpha = 0.3 + Math.sin(this.real * 8 + u.id) * 0.1; g.fillStyle = PAL.purple; g.fillRect(ix + 4, iy + 2, img.width - 8, img.height - 4); g.globalAlpha = 1; }
    if (dirI !== 1) drawGear();

    if (!u.hero && u.hp < u.def.hp && dist(u.x, u.y, this.hero.x, this.hero.y) < 120) {
      const w = u.commander ? 18 : 10, k = clamp(u.hp / u.def.hp, 0, 1);
      const bx = Math.round(u.x - sx - w / 2), by = Math.round(u.y - sy) - img.height - 3;
      g.fillStyle = PAL.ink; g.fillRect(bx - 1, by - 1, w + 2, 4);
      g.fillStyle = u.team === 0 ? PAL.redL : u.commander ? PAL.purpleL : PAL.bone;
      g.fillRect(bx, by, Math.ceil(w * k), 2);
    }
  }

  drawGear(g: CanvasRenderingContext2D, u: Unit, hand: V, wa: { a: number; ext: number }) {
    const w = u.w;
    if (u.usingBow && (u.hero || (u.def.bow && u.state === "idle"))) {
      const a = u.face;
      const bx = hand.x + Math.cos(a) * 3, by = hand.y + Math.sin(a) * 3;
      const px = -Math.sin(a), py = Math.cos(a);
      const pull = u.hero ? u.drawT * 4 : clamp(1 - u.reload / 1.2, 0, 1) * 3;
      for (let i = -5; i <= 5; i++) {
        const bend = (1 - (i * i) / 25) * 2.5;
        g.fillStyle = Math.abs(i) > 3 ? PAL.woodD : PAL.wood;
        g.fillRect(Math.round(bx + px * i + Math.cos(a) * bend), Math.round(by + py * i + Math.sin(a) * bend), 1, 1);
      }
      pxLine(g, bx + px * 5, by + py * 5, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, PAL.bone);
      pxLine(g, bx - px * 5, by - py * 5, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, PAL.bone);
      if (pull > 1) { pxLine(g, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, bx + Math.cos(a) * 6, by + Math.sin(a) * 6, PAL.wood); g.fillStyle = PAL.steelL; g.fillRect(Math.round(bx + Math.cos(a) * 6), Math.round(by + Math.sin(a) * 6), 1, 1); }
      return;
    }
    if (u.hasShield) {
      const blockingNow = u.hero ? u.blocking : u.state === "idle" && u.guardT > 0;
      const a = blockingNow ? u.face : u.face - 1.5;
      const r = blockingNow ? 5 : 4;
      const sxp = Math.round(hand.x - Math.cos(u.face) * 3 + Math.cos(a) * r), syp = Math.round(hand.y + 1 + Math.sin(a) * r);
      const body = u.hero ? PAL.red : u.team === 0 ? PAL.red : PAL.dusk;
      g.fillStyle = PAL.ink; g.fillRect(sxp - 3, syp - 4, 7, 8); g.fillRect(sxp - 2, syp + 4, 5, 1);
      g.fillStyle = body; g.fillRect(sxp - 2, syp - 3, 5, 6); g.fillRect(sxp - 1, syp + 3, 3, 1);
      g.fillStyle = PAL.steel; g.fillRect(sxp - 2, syp - 3, 5, 1);
      g.fillStyle = u.hero ? PAL.gold : PAL.redL; g.fillRect(sxp, syp - 2, 1, 4); g.fillRect(sxp - 1, syp - 1, 3, 1);
      g.fillStyle = PAL.steelL; g.fillRect(sxp, syp - 1, 1, 1);
    }
    const ex = Math.cos(wa.a), ey = Math.sin(wa.a);
    const bx = hand.x + Math.cos(u.face) * wa.ext, by = hand.y + Math.sin(u.face) * wa.ext;
    const tipx = bx + ex * w.len, tipy = by + ey * w.len;
    if (u.state === "strike" && u.dir !== "T") {
      u.trail.push(wa.a);
      if (u.trail.length > 6) u.trail.shift();
      // smuga cięcia: wypełniony łuk między kolejnymi położeniami ostrza
      g.globalAlpha = 0.5;
      g.fillStyle = u.hero ? PAL.white : PAL.boneHi;
      for (let i = 1; i < u.trail.length; i++) {
        const a0 = u.trail[i - 1], a1 = u.trail[i];
        for (let k = 0; k <= 4; k++) {
          const aa = a0 + angDiff(a0, a1) * (k / 4);
          for (let r = w.len * 0.45; r <= w.len + 1; r += 1) g.fillRect(Math.round(bx + Math.cos(aa) * r), Math.round(by + Math.sin(aa) * r), 1, 1);
        }
      }
      g.globalAlpha = 1;
    }
    pxLine(g, bx + ex * 2, by + ey * 2, tipx, tipy, w.blade);
    if (w.len >= 9) pxLine(g, bx + ex * 3 + 0.5, by + ey * 3 + 0.5, bx + ex * (w.len - 2) + 0.5, by + ey * (w.len - 2) + 0.5, w.blade === PAL.steelL ? PAL.steel : PAL.steelD);
    if (u.bloodT > 0) {
      g.fillStyle = PAL.blood;
      for (let i = 0; i < 3; i++) g.fillRect(Math.round(bx + ex * (w.len - i * 2 - 1)), Math.round(by + ey * (w.len - i * 2 - 1)), 1, 1);
    }
    if (w.head) {
      g.fillStyle = PAL.ink; g.fillRect(Math.round(tipx) - 2, Math.round(tipy) - 2, 5, 5);
      g.fillStyle = w.head; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 3, 3);
      g.fillStyle = PAL.steelL; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 1, 1);
    }
    g.fillStyle = w.hilt;
    g.fillRect(Math.round(bx + ex * 2 - ey), Math.round(by + ey * 2 + ex), 1, 1);
    g.fillRect(Math.round(bx + ex * 2 + ey), Math.round(by + ey * 2 - ex), 1, 1);
    g.fillStyle = PAL.woodD; g.fillRect(Math.round(bx), Math.round(by), 1, 1);
  }

  drawTells(g: CanvasRenderingContext2D, sx: number, sy: number) {
    const h = this.hero;
    for (const u of this.units) {
      if (!u.active || u.team === 0) continue;
      const d = dist(u.x, u.y, h.x, h.y);
      if (d > 150) continue;
      const top = u.y - sy - (u.commander ? 31 : 26);
      const x = Math.round(u.x - sx);
      if (u.state === "windup") dirGlyph(g, u.dir, x, Math.round(top), u.target === h ? PAL.bloodL : PAL.red, true);
      else if (u.guard && d < 90) dirGlyph(g, u.guard, x, Math.round(top), PAL.steelL, false);
    }
    if (h.active && !h.usingBow && this.phase === "fight" && !this.cmdOpen) {
      const col = h.state === "windup" ? (h.hold > 0.45 ? PAL.white : PAL.gold) : PAL.goldD;
      dirGlyph(g, h.state === "windup" ? h.dir : this.loadDir, Math.round(h.x - sx), Math.round(h.y - sy - 26), col, h.state === "windup");
    }
  }
}

function dirGlyph(g: CanvasRenderingContext2D, d: Dir, x: number, y: number, col: string, attack: boolean) {
  const shapes: Record<Dir, number[][]> = attack ? {
    L: [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [1, -1], [1, 1], [0, -2], [0, 2]],
    R: [[3, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-2, 0], [-1, -1], [-1, 1], [0, -2], [0, 2]],
    O: [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [-1, 0], [1, 0], [-2, -1], [2, -1]],
    T: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, -3], [0, 3], [-3, 0], [3, 0]],
  } : {
    L: [[-5, -3], [-5, -2], [-5, -1], [-5, 0], [-5, 1], [-5, 2]],
    R: [[5, -3], [5, -2], [5, -1], [5, 0], [5, 1], [5, 2]],
    O: [[-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3]],
    T: [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]],
  };
  g.fillStyle = PAL.ink;
  for (const [px, py] of shapes[d]) { g.fillRect(x + px - 1, y + py, 3, 1); g.fillRect(x + px, y + py - 1, 1, 3); }
  g.fillStyle = col;
  for (const [px, py] of shapes[d]) g.fillRect(x + px, y + py, 1, 1);
}

const FONT: Record<string, string> = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
  "5": "111100111001111", "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111",
  A: "010101111101101", B: "110101110101110", C: "011100100100011", D: "110101101101110", E: "111100110100111",
  G: "011100101101011", Ł: "100110100100111", L: "100100100100111", O: "010101101101010", W: "101101111111101",
  K: "101101110101101", T: "111010010010010", R: "110101110101101", Z: "111001010100111", P: "110101110100100",
  " ": "000000000000000", "!": "010010010000010",
};
function textW(t: string) { return t.length * 4 - 1; }
function pxText(g: CanvasRenderingContext2D, t: string, x: number, y: number, col: string) {
  for (let pass = 0; pass < 2; pass++) {
    g.fillStyle = pass === 0 ? PAL.ink : col;
    for (let i = 0; i < t.length; i++) {
      const f = FONT[t[i]] || FONT[" "];
      for (let k = 0; k < 15; k++) if (f[k] === "1") {
        const px = x + i * 4 + (k % 3), py = y + Math.floor(k / 3);
        if (pass === 0) g.fillRect(px - 1, py - 1, 3, 3); else g.fillRect(px, py, 1, 1);
      }
    }
  }
}

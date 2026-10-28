// Bitwa: symulacja walki, konnica, AI, oddziały i rozkazy, tryb dowodzenia, teren, efekty i rysowanie.

const WW = 1600, WH = 1000;              // rozmiar pola bitwy w pikselach
type State = "idle" | "windup" | "strike" | "recover" | "stagger" | "kick" | "down" | "dead" | "fled";
type Mode = "hold" | "follow" | "charge" | "flank" | "ambush";
type CmdLevel = "groups" | "orders" | "formation" | "more" | "target" | "assign";

let UID = 1;

const SQUAD_NAMES: Record<number, string> = { 1: "Piechota", 2: "Łucznicy", 3: "Konnica", 4: "Oddział 4", 5: "Oddział 5", 6: "Oddział 6", 7: "Oddział 7", 8: "Oddział 8" };
const SQUAD_COLORS: Record<number, string> = { 1: PAL.redL, 2: PAL.moss, 3: PAL.gold, 4: PAL.bone, 5: PAL.purpleL, 6: PAL.steelL, 7: PAL.dirtL, 8: PAL.ash };
const ENEMY_SQUADS: Record<number, string> = { 1: "Linia szkieletów", 2: "Skrzydło szkieletów", 3: "Szkielety łucznicy", 4: "Ghule", 5: "Rycerz Śmierci" };

interface Settings { damageNumbers: boolean; gesture: boolean; }

class Unit {
  id = UID++;
  def: UnitDef;
  team: number;
  squad: number;
  x: number; y: number;
  vx = 0; vy = 0;
  face = 0;
  wantFace = 0;
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
  officer = false;
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
  bleedT = 0;
  variant: number;
  spr: SpriteSet;
  nextSide: Dir = "R";
  key = "";
  // konnica
  mounted = false;
  horseHp = 0;
  horseMax = 0;
  heading = 0;
  rspeed = 0;
  horse: HorseSet | null = null;
  wheelTo: V | null = null;
  trampleT = 0;
  // zasadzka i zaznaczenie
  hidden = false;
  picked = false;

  constructor(defKey: string, team: number, squad: number, x: number, y: number) {
    this.def = UNITS[defKey];
    this.team = team; this.squad = squad;
    this.x = x; this.y = y;
    this.hp = this.def.hp;
    this.weaponKey = this.def.weapon;
    this.hasShield = this.def.shield;
    this.face = this.wantFace = this.heading = team === 0 ? 0 : Math.PI;
    this.reload = rr(0.2, 1.5);
    this.ammo = this.def.bow ? 30 : 0;
    this.dir = pick<Dir>(["L", "R", "O", "T"]);
    this.variant = Math.floor(rnd() * 64);
    this.spr = getSprites(this.def.body, this.variant);
    if (this.def.mount) this.mount(this.def.mount);
  }
  mount(m: Mount) { this.mounted = true; this.horseHp = this.horseMax = m.hp; this.horse = getHorse(this.variant, this.team); }
  get alive() { return this.state !== "dead" && this.state !== "fled"; }
  get active() { return this.alive && this.state !== "down"; }
  get w() { return WEAPONS[this.weaponKey]; }
  get usingBow() { return this.hero ? HERO_LOADOUTS[this.loadout].bow : !!this.def.bow; }
  get radius() { return this.mounted ? 8 : this.def.radius; }
  get maxRide() { return (this.def.mount || HORSE).speed; }
}

interface Arrow { x: number; y: number; vx: number; vy: number; team: number; src: Unit; dmg: number; age: number; travel: number; dist: number; done: boolean; }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; col: string; kind: "blood" | "spark" | "dust" | "bone" | "flash" | "ring" | "soul"; }
interface Corpse { x: number; y: number; img: HTMLCanvasElement; flip: boolean; rot: number; undead: boolean; bones: boolean; t: number; pooled: boolean; horse?: boolean; }
interface Obstacle { x: number; y: number; r: number; img: HTMLCanvasElement; }
interface Floater { x: number; y: number; text: string; col: string; t: number; }
interface Order {
  mode: Mode; ax: number; ay: number; formation: Formation; fire: boolean; meleeOnly: boolean; spacing: number;
  cols?: number; face?: number; targetSquad?: number | null; flank?: { x: number; y: number } | null;
}
interface Slot { x: number; y: number; face: number; }
interface Area { x: number; y: number; r: number; }

function newOrder(ax: number, ay: number, formation: Formation = "line"): Order {
  return { mode: "hold", ax, ay, formation, fire: true, meleeOnly: false, spacing: 1, targetSquad: null, flank: null };
}
function hashN(x: number, y: number) { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
function vnoise(x: number, y: number, s: number) {
  const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = x / s - xi, fy = y / s - yi;
  const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  return lerp(lerp(hashN(xi, yi), hashN(xi + 1, yi), sx), lerp(hashN(xi, yi + 1), hashN(xi + 1, yi + 1), sx), sy);
}

class Battle {
  units: Unit[] = [];
  hero: Unit;
  dk: Unit;
  arrows: Arrow[] = [];
  parts: Particle[] = [];
  corpses: Corpse[] = [];
  obstacles: Obstacle[] = [];
  floaters: Floater[] = [];
  hills: Area[] = [];
  forests: Area[] = [];
  ground: HTMLCanvasElement;
  decals: HTMLCanvasElement;
  dg: CanvasRenderingContext2D;
  vignette: HTMLCanvasElement;
  fog: HTMLCanvasElement;
  ash: { x: number; y: number; s: number; p: number; c: string }[] = [];

  orders: Record<number, Order> = {};
  eorders: Record<number, Order> = {};
  selected: number[] = [1, 2, 3];
  enemyCharge = false;
  dkRetreatT = 0;
  waver: Record<number, number> = {};

  cmdOpen = false;
  cmdLevel: CmdLevel = "groups";
  drag: { sx: number; sy: number; ex: number; ey: number } | null = null;
  box: { sx: number; sy: number; ex: number; ey: number } | null = null;
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
  log: { text: string; t: number; col?: string; n: number; big?: boolean }[] = [];
  banner: { text: string; t: number; col: string } | null = null;
  loadDir: Dir = "R";
  paused = false;
  relayoutT = 0;
  intensity = 0;
  moanT = 3;

  constructor(public input: Input, public sfx: Sfx, public settings: Settings, heroMounted = false) {
    this.makeTerrain();
    this.spawn(heroMounted);
  }

  // ---------- Teren ----------
  height(x: number, y: number) {
    let h = 0;
    for (const hl of this.hills) {
      const d = dist(x, y, hl.x, hl.y) / hl.r;
      if (d < 1) h = Math.max(h, (1 - d * d) * (1 - d * d));
    }
    return h;
  }
  inForest(x: number, y: number) { return this.forests.some((f) => dist(x, y, f.x, f.y) < f.r); }

  makeTerrain() {
    this.hills = [{ x: 560, y: 360, r: 120 }, { x: 1060, y: 660, r: 130 }, { x: 820, y: 230, r: 95 }];
    this.forests = [{ x: 760, y: 820, r: 115 }, { x: 1030, y: 170, r: 120 }];
    const [g, gc] = mkCanvas(WW, WH);
    const im = gc.createImageData(WW, WH);
    const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const grass = [PAL.grassD, PAL.grass, PAL.grassL, PAL.moss].map(rgb);
    const dirt = [PAL.dirtD, PAL.dirt, PAL.dirtL].map(rgb);
    const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
    const off = rnd() * 1000;
    const roadAt = (x: number) => 500 + Math.sin((x + off) / 200) * 70 + Math.sin(x / 61) * 8;
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const n = vnoise(x + off, y, 80) * 0.62 + vnoise(x, y + off, 22) * 0.38;
      const th = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
      const hgt = this.height(x, y);
      const sl = hgt > 0 ? (this.height(x - 3, y - 3) - this.height(x + 3, y + 3)) * 6 : 0;   // światło z lewej góry
      const rd = Math.abs(y - roadAt(x)) - 15 - vnoise(x, y, 14) * 9;
      const forest = this.forests.some((f) => dist(x, y, f.x, f.y) < f.r + vnoise(x, y, 20) * 20);
      let col: number[];
      if (rd < 0) {
        col = dirt[clamp(Math.floor(n * 2.2 + (th - 0.5) * 0.9), 0, 2)];
        const rut = Math.abs(Math.abs(y - roadAt(x)) - 6);
        if (rut < 1.2 && hashN(x >> 2, 7) > 0.2) col = dirt[0];
        if (vnoise(x, y, 9) > 0.8 && rd < -4 && th < 0.75) col = dirt[0];
      } else if (rd < 3) col = th < 0.5 ? dirt[0] : grass[0];
      else {
        const lv = n * 2.5 + (th - 0.5) * 0.8 + sl * 1.2 + hgt * 0.5 - (forest ? 0.9 : 0);
        col = grass[clamp(Math.floor(lv), 0, 2)];
        if (vnoise(x + 300, y, 40) > 0.78 && th > 0.75) col = grass[3];
        if (hgt > 0.05 && Math.abs(((hgt * 5) % 1) - 0.5) < 0.04 && th < 0.5) col = grass[0];   // poziomice
      }
      const k = (y * WW + x) * 4;
      im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
    }
    gc.putImageData(im, 0, 0);
    for (let i = 0; i < 1500; i++) {
      const x = rr(0, WW) | 0, y = rr(0, WH) | 0;
      if (Math.abs(y - roadAt(x)) < 20) continue;
      gc.drawImage(pick(TUFTS), x, y);
    }
    for (let i = 0; i < 380; i++) { gc.fillStyle = chance(0.5) ? PAL.stone : PAL.slate; const x = rr(0, WW) | 0, y = rr(0, WH) | 0; gc.fillRect(x, y, 2, 1); gc.fillStyle = PAL.ash; gc.fillRect(x, y, 1, 1); }
    for (const f of this.forests) for (let i = 0; i < 500; i++) {
      const a = rr(0, 6.28), r = Math.sqrt(rnd()) * f.r;
      gc.fillStyle = pick([PAL.woodD, PAL.dirtD, PAL.grassD]); gc.fillRect((f.x + Math.cos(a) * r) | 0, (f.y + Math.sin(a) * r) | 0, 1, 1);
    }
    this.ground = g;
    const [d, dg] = mkCanvas(WW, WH);
    this.decals = d; this.dg = dg;

    const tryPlace = (x: number, y: number, r: number, imgs: HTMLCanvasElement[], gap: number) => {
      if (this.obstacles.some((o) => o.r && dist(o.x, o.y, x, y) < o.r + r + gap)) return false;
      this.obstacles.push({ x, y, r, img: pick(imgs) }); return true;
    };
    for (const f of this.forests) for (let i = 0; i < 60; i++) {
      const a = rr(0, 6.28), r = Math.sqrt(rnd()) * f.r;
      tryPlace(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 6, [TREES[0], TREES[2], TREES[2], TREES[1]], 9);
    }
    for (let i = 0; i < 90; i++) {
      const x = rr(20, WW - 20), y = rr(20, WH - 15);
      const center = y > 330 && y < 680 && x > 250 && x < 1350;
      if (center && !chance(0.08)) continue;
      tryPlace(x, y, chance(0.75) ? 7 : 6, chance(0.75) ? TREES : ROCKS, 18);
    }
    for (let i = 0; i < 70; i++) this.obstacles.push({ x: rr(0, WW), y: rr(0, WH), r: 0, img: BUSH });
    this.makeOverlays();
    for (let i = 0; i < 220; i++) this.ash.push({ x: rr(0, 640), y: rr(0, 360), s: rr(4, 13), p: rr(0.3, 1), c: chance(0.7) ? PAL.ash : PAL.boneHi });
  }

  makeOverlays() {
    const [v, vg] = mkCanvas(W, H);
    const grd = vg.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, W * 0.6);
    grd.addColorStop(0, "rgba(13,11,14,0)"); grd.addColorStop(1, "rgba(13,11,14,0.6)");
    vg.fillStyle = grd; vg.fillRect(0, 0, W, H);
    this.vignette = v;
    if (!this.fog) {
      const [f, fg] = mkCanvas(160, 90);
      const fim = fg.createImageData(160, 90);
      for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
        const n = vnoise(x * 3, y * 3, 30) * 0.7 + vnoise(x * 3 + 99, y * 3, 12) * 0.3;
        const k = (y * 160 + x) * 4;
        fim.data[k] = 200; fim.data[k + 1] = 196; fim.data[k + 2] = 210; fim.data[k + 3] = Math.floor(clamp((n - 0.4) * 2, 0, 1) * 255);
      }
      fg.putImageData(fim, 0, 0);
      this.fog = f;
    }
  }

  // ---------- Jednostki ----------
  spawn(heroMounted: boolean) {
    const h = new Unit("hero", 0, 0, 430, 500);
    h.hero = true; h.ammo = 30;
    if (heroMounted) { h.mount(HORSE); h.horseHp = h.horseMax = 160; }
    this.hero = h; this.units.push(h);
    const add = (key: string, team: number, sq: number, n: number, x: number, y: number) => {
      const out: Unit[] = [];
      for (let i = 0; i < n; i++) { const u = new Unit(key, team, sq, x + rr(-10, 10), y + rr(-60, 60)); this.units.push(u); out.push(u); }
      return out;
    };
    add("inf", 0, 1, 22, 420, 500)[0].officer = true;
    add("arch", 0, 2, 14, 360, 500)[0].officer = true;
    add("cav", 0, 3, 13, 380, 650);
    this.orders[1] = newOrder(450, 500);
    this.orders[2] = newOrder(375, 500);
    this.orders[3] = newOrder(400, 660);

    const dk = new Unit("dk", 1, 5, 1170, 500);
    dk.commander = true; this.dk = dk; this.units.push(dk);
    add("skel", 1, 1, 24, 1190, 500);
    add("skel", 1, 2, 10, 1190, 360);
    add("skelArch", 1, 3, 10, 1250, 500);
    const ghouls = add("ghoul", 1, 4, 5, 760, 830);
    for (const gh of ghouls) gh.hidden = true;
    this.eorders[1] = newOrder(1190, 500);
    this.eorders[2] = newOrder(1190, 380);
    this.eorders[3] = newOrder(1250, 500);
    this.eorders[4] = { ...newOrder(760, 830, "loose"), mode: "ambush" };
    this.eorders[5] = newOrder(1160, 500);
    this.layoutAll(true);
    this.cam.x = clamp(h.x - W / 2, 0, WW - W); this.cam.y = clamp(h.y - H / 2, 0, WH - H);
  }

  squadUnits(sq: number, team = 0) { return this.units.filter((u) => u.team === team && u.squad === sq && u.active && !u.fleeing && !u.hero); }
  liveSquads(): number[] { const s = new Set<number>(); for (const u of this.units) if (u.team === 0 && !u.hero && u.active && !u.fleeing) s.add(u.squad); return [...s].sort(); }
  centroid(team: number, squad?: number): V {
    let x = 0, y = 0, n = 0;
    for (const u of this.units) {
      if (u.team !== team || !u.active || u.hidden) continue;
      if (squad !== undefined && (u.squad !== squad || u.hero)) continue;
      x += u.x; y += u.y; n++;
    }
    return n ? { x: x / n, y: y / n } : { x: team === 0 ? 400 : 1200, y: 500 };
  }

  // Miejsca w szyku. Przód szyku leży na punkcie (ax, ay), kolejne szeregi cofają się.
  slotsFor(n: number, ax: number, ay: number, face: number, f: Formation, colsOverride?: number, spacing = 1, mounted = false): Slot[] {
    const out: Slot[] = [];
    if (!n) return out;
    const fx = Math.cos(face), fy = Math.sin(face);
    const rx = -fy, ry = fx;
    const mk = mounted ? 1.6 : 1;
    const sp = FORMATION_SPACING[f] * spacing * mk;
    const put = (lx: number, ly: number) => out.push({ x: clamp(ax + rx * lx - fx * ly, 10, WW - 10), y: clamp(ay + ry * lx - fy * ly, 14, WH - 8), face });
    if (f === "circle") {
      const r = Math.max(10, (n * sp) / (Math.PI * 2));
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: clamp(ax + Math.cos(a) * r, 10, WW - 10), y: clamp(ay + Math.sin(a) * r, 14, WH - 8), face: a }); }
      return out;
    }
    if (f === "wedge") {
      for (let i = 0; i < n; i++) { let row = 0, idx = i; while (idx > row) { idx -= row + 1; row++; } put((idx - row / 2) * sp, row * 11 * spacing * mk); }
      return out;
    }
    const defCols = f === "wall" ? 11 : f === "loose" ? 7 : f === "column" ? 2 : 11;
    const cols = clamp(f === "column" ? defCols : colsOverride || defCols, 1, n);
    const rowGap = (f === "wall" ? 9 : f === "column" ? 11 : 12) * spacing * (mounted ? 1.7 : 1);
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols), col = i % cols;
      const inRow = Math.min(cols, n - row * cols);
      put((col - (inRow - 1) / 2) * sp, row * rowGap);
    }
    return out;
  }

  assign(list: Unit[], slots: Slot[], snap = false) {
    const free = slots.slice();
    const order = list.slice().sort((a, b) => a.id - b.id);
    for (const u of order) {
      let bi = 0, bd = 1e9;
      for (let i = 0; i < free.length; i++) { const d = dist(u.x, u.y, free[i].x, free[i].y); if (d < bd) { bd = d; bi = i; } }
      const s = free.splice(bi, 1)[0];
      if (!s) continue;
      u.slotX = s.x; u.slotY = s.y; u.slotFace = s.face;
      if (snap) { u.x = s.x; u.y = s.y; u.face = u.wantFace = u.heading = s.face; }
    }
  }

  anchorOf(sq: number, team = 0): { ax: number; ay: number; face: number } {
    const o = team === 0 ? this.orders[sq] : this.eorders[sq];
    const ec = this.centroid(1 - team);
    if (team === 0 && o.mode === "follow" && this.hero.active) {
      const a = Math.atan2(ec.y - this.hero.y, ec.x - this.hero.x);
      const back = sq === 2 ? 55 : sq === 3 ? 40 : 22;
      const side = sq === 3 ? 45 : 0;
      return { ax: this.hero.x - Math.cos(a) * back - Math.sin(a) * side, ay: this.hero.y - Math.sin(a) * back + Math.cos(a) * side, face: a };
    }
    if (o.mode === "flank" && o.flank) return { ax: o.flank.x, ay: o.flank.y, face: Math.atan2(ec.y - o.flank.y, ec.x - o.flank.x) };
    const face = o.face !== undefined ? o.face : Math.atan2(ec.y - o.ay, ec.x - o.ax);
    return { ax: o.ax, ay: o.ay, face };
  }

  layoutAll(snap = false) {
    for (const team of [0, 1]) {
      const ord = team === 0 ? this.orders : this.eorders;
      for (const k of Object.keys(ord)) {
        const sq = Number(k), o = ord[sq];
        const list = this.squadUnits(sq, team);
        if (!list.length) continue;
        const a = this.anchorOf(sq, team);
        this.assign(list, this.slotsFor(list.length, a.ax, a.ay, a.face, o.formation, o.cols, o.spacing, list[0].mounted), snap);
      }
    }
  }

  say(text: string, col?: string, big = false) {
    const last = this.log[this.log.length - 1];
    if (last && last.text === text) { last.n++; last.t = 5; return; }
    this.log.push({ text, t: big ? 6 : 4.5, col, n: 1, big });
    if (this.log.length > 4) this.log.shift();
  }
  shout(text: string, col = PAL.gold) { this.banner = { text, t: 1.3, col }; }
  vol(x: number) { return this.sfx.spatial(x, this.cam); }
  groupName(gs: number[]) {
    const live = this.liveSquads();
    if (gs.length > 1 && live.every((s) => gs.includes(s))) return "Wszyscy";
    return gs.map((s) => SQUAD_NAMES[s]).join(" i ");
  }

  // ---------- Rozkazy ----------
  ensureOrder(sq: number) { if (!this.orders[sq]) { const c = this.centroid(0, sq); this.orders[sq] = newOrder(c.x, c.y); } return this.orders[sq]; }
  orderMode(gs: number[], mode: Mode) {
    for (const g of gs) { const o = this.ensureOrder(g); o.mode = mode; o.face = undefined; o.flank = null; }
    if (mode === "follow") { this.say(`${this.groupName(gs)}: za mną!`); this.sfx.shout(0.6); }
    if (mode === "charge") { this.say(`${this.groupName(gs)}: do szarży!`, PAL.redL); this.sfx.battleCry(1); }
  }
  orderHere(gs: number[], wx: number, wy: number) {
    const ec = this.centroid(1), a = Math.atan2(ec.y - wy, ec.x - wx);
    for (const g of gs) {
      const o = this.ensureOrder(g); o.mode = "hold"; o.face = undefined; o.flank = null;
      const back = gs.length > 1 && g === 2 ? 40 : 0, side = gs.length > 1 && g === 3 ? 90 : 0;
      o.ax = wx - Math.cos(a) * back - Math.sin(a) * side; o.ay = wy - Math.sin(a) * back + Math.cos(a) * side;
    }
    this.say(`${this.groupName(gs)}: stać tutaj!`); this.sfx.shout(0.6);
    this.flashPreview(gs);
  }
  orderHoldPosition(gs: number[]) {
    for (const g of gs) {
      const c = this.centroid(0, g), o = this.ensureOrder(g), a = this.anchorOf(g);
      o.mode = "hold"; o.ax = c.x + Math.cos(a.face) * 6; o.ay = c.y + Math.sin(a.face) * 6; o.face = a.face; o.flank = null;
    }
    this.say(`${this.groupName(gs)}: utrzymać pozycję!`);
  }
  orderRetreat(gs: number[]) {
    const ec = this.centroid(1);
    for (const g of gs) {
      const c = this.centroid(0, g), o = this.ensureOrder(g);
      const a = Math.atan2(c.y - ec.y, c.x - ec.x);
      o.mode = "hold"; o.ax = clamp(c.x + Math.cos(a) * 60, 20, WW - 20); o.ay = clamp(c.y + Math.sin(a) * 60, 20, WH - 20); o.face = a + Math.PI; o.flank = null;
    }
    this.say(`${this.groupName(gs)}: cofnąć się!`);
  }
  orderFormation(gs: number[], f: Formation) {
    for (const g of gs) { const o = this.ensureOrder(g); o.formation = f; o.cols = undefined; }
    this.say(`${this.groupName(gs)}: ${FORMATION_NAME[f].toLowerCase()}`);
  }
  orderSpacing(gs: number[]) {
    const cur = this.ensureOrder(gs[0]).spacing;
    const next = cur < 1 ? 1 : cur === 1 ? 1.45 : 0.75;
    for (const g of gs) this.ensureOrder(g).spacing = next;
    this.say(`${this.groupName(gs)}: ${next < 1 ? "zewrzeć szyk!" : next > 1 ? "rozluźnić szyk!" : "normalne odstępy"}`);
  }
  spacingName(s: number) { return s < 1 ? "ciasno" : s > 1 ? "luźno" : "normalnie"; }
  orderFire(gs: number[]) {
    const on = !this.ensureOrder(gs[0]).fire;
    for (const g of gs) this.ensureOrder(g).fire = on;
    this.say(on ? `${this.groupName(gs)}: strzelać wedle uznania!` : `${this.groupName(gs)}: wstrzymać ogień!`);
  }
  orderMelee(gs: number[]) {
    const on = !this.ensureOrder(gs[0]).meleeOnly;
    for (const g of gs) this.ensureOrder(g).meleeOnly = on;
    this.say(on ? `${this.groupName(gs)}: tylko broń biała!` : `${this.groupName(gs)}: wolna broń`);
  }
  orderTarget(gs: number[], esq: number | null) {
    for (const g of gs) {
      const o = this.ensureOrder(g); o.targetSquad = esq;
      const ranged = this.squadUnits(g).some((u) => u.def.bow);
      if (esq !== null && !ranged && o.mode !== "charge") { o.mode = "charge"; o.flank = null; }
    }
    this.say(esq === null ? `${this.groupName(gs)}: wolny wybór celu` : `${this.groupName(gs)}: atakować cel: ${ENEMY_SQUADS[esq]}!`, PAL.redL);
    if (esq !== null) this.sfx.battleCry(0.6);
  }
  orderOccupy(gs: number[], kind: "hill" | "forest") {
    for (const g of gs) {
      const c = this.centroid(0, g);
      const areas = kind === "hill" ? this.hills : this.forests;
      let best = areas[0], bd = 1e9;
      for (const a of areas) { const d = dist(c.x, c.y, a.x, a.y); if (d < bd) { bd = d; best = a; } }
      const o = this.ensureOrder(g); o.mode = "hold"; o.ax = best.x; o.ay = best.y; o.face = undefined; o.flank = null;
      if (kind === "forest") o.formation = "loose";
    }
    this.say(`${this.groupName(gs)}: zająć ${kind === "hill" ? "wzgórze" : "las"}!`); this.sfx.shout(0.6);
    this.flashPreview(gs);
  }
  orderFlank(gs: number[], side: number) {
    const ec = this.centroid(1), pc = this.centroid(0);
    const a = Math.atan2(ec.y - pc.y, ec.x - pc.x);
    for (const g of gs) {
      const o = this.ensureOrder(g);
      o.mode = "flank"; o.face = undefined;
      o.flank = { x: clamp(ec.x - Math.cos(a) * 30 - Math.sin(a) * side * 150, 20, WW - 20), y: clamp(ec.y - Math.sin(a) * 30 + Math.cos(a) * side * 150, 20, WH - 20) };
    }
    this.say(`${this.groupName(gs)}: oskrzydlić ${side < 0 ? "z lewej" : "z prawej"}!`, PAL.gold); this.sfx.shout(0.8);
  }
  orderAmbush(gs: number[]) {
    for (const g of gs) {
      const o = this.ensureOrder(g); o.mode = "ambush"; o.flank = null; o.formation = "loose";
      for (const u of this.squadUnits(g)) u.hidden = true;
    }
    this.say(`${this.groupName(gs)}: zasadzka! Kryć się i czekać.`, PAL.moss);
  }
  assignPicked(sq: number) {
    const picked = this.units.filter((u) => u.picked && u.active);
    if (!picked.length) return;
    const c = picked.reduce((s, u) => ({ x: s.x + u.x / picked.length, y: s.y + u.y / picked.length }), { x: 0, y: 0 });
    if (!this.orders[sq] || !this.squadUnits(sq).length) this.orders[sq] = newOrder(c.x, c.y);
    for (const u of picked) { u.squad = sq; u.picked = false; u.hidden = this.orders[sq].mode === "ambush"; }
    this.selected = [sq];
    this.say(`Przeniesiono ${picked.length} do: ${SQUAD_NAMES[sq]}`);
    this.relayoutT = 0;
  }

  dragPlan(d: { sx: number; sy: number; ex: number; ey: number }) {
    const ec = this.centroid(1);
    const len = dist(d.sx, d.sy, d.ex, d.ey);
    const mx = (d.sx + d.ex) / 2, my = (d.sy + d.ey) / 2;
    let face: number;
    if (len < 8) face = Math.atan2(ec.y - d.sy, ec.x - d.sx);
    else {
      const a = Math.atan2(d.ey - d.sy, d.ex - d.sx);
      const f1 = a - Math.PI / 2, f2 = a + Math.PI / 2, toE = Math.atan2(ec.y - my, ec.x - mx);
      face = Math.abs(angDiff(f1, toE)) < Math.abs(angDiff(f2, toE)) ? f1 : f2;
    }
    const plan: { g: number; ax: number; ay: number; face: number; cols?: number; slots: Slot[] }[] = [];
    const ax0 = len < 8 ? d.sx : mx, ay0 = len < 8 ? d.sy : my;
    const multi = this.selected.length > 1;
    for (const g of this.selected) {
      const list = this.squadUnits(g);
      if (!list.length) continue;
      const o = this.ensureOrder(g);
      const back = multi && g === 2 ? 34 : 0;
      const side = multi && g === 3 ? (len < 8 ? 90 : len / 2 + 50) : 0;
      const ax = ax0 - Math.cos(face) * back - Math.sin(face) * side, ay = ay0 - Math.sin(face) * back + Math.cos(face) * side;
      const sp = FORMATION_SPACING[o.formation] * o.spacing * (list[0].mounted ? 1.6 : 1);
      const cols = len < 8 || (g === 3 && multi) ? o.cols : clamp(Math.round(len / sp) + 1, 1, list.length);
      plan.push({ g, ax, ay, face, cols, slots: this.slotsFor(list.length, ax, ay, face, o.formation, cols, o.spacing, list[0].mounted) });
    }
    return plan;
  }

  applyDrag() {
    if (!this.drag) return;
    for (const p of this.dragPlan(this.drag)) {
      const o = this.ensureOrder(p.g);
      o.mode = "hold"; o.ax = p.ax; o.ay = p.ay; o.face = p.face; o.cols = p.cols; o.flank = null;
      this.preview.push({ slots: p.slots, t: 1.4, col: SQUAD_COLORS[p.g] });
    }
    this.say(`${this.groupName(this.selected)}: na pozycje!`);
    this.sfx.shout(0.5);
    this.drag = null;
    this.cmdLevel = "groups";
    this.relayoutT = 0;
  }

  flashPreview(gs: number[]) {
    for (const g of gs) {
      const list = this.squadUnits(g); if (!list.length) continue;
      const a = this.anchorOf(g), o = this.orders[g];
      this.preview.push({ slots: this.slotsFor(list.length, a.ax, a.ay, a.face, o.formation, o.cols, o.spacing, list[0].mounted), t: 1.2, col: SQUAD_COLORS[g] });
    }
    this.relayoutT = 0;
  }

  enemySquadsVisible(): number[] {
    const s = new Set<number>();
    for (const u of this.units) if (u.team === 1 && u.active && !u.hidden) s.add(u.squad);
    return [...s].sort();
  }

  cmdMenu(): { n: number; label: string; on?: boolean; dim?: boolean }[] {
    const live = this.liveSquads();
    if (this.cmdLevel === "assign") {
      const n = this.units.filter((u) => u.picked).length;
      const items: { n: number; label: string; on?: boolean; dim?: boolean }[] = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => ({ n: s, label: `${SQUAD_NAMES[s]}${live.includes(s) ? "" : " (nowy)"}`, dim: !live.includes(s) }));
      items.push({ n: 9, label: `Odznacz (${n})` });
      return items;
    }
    if (this.cmdLevel === "groups") {
      const items: { n: number; label: string; on?: boolean }[] = live.map((s) => ({ n: s, label: `${SQUAD_NAMES[s]} (${this.squadUnits(s).length})`, on: this.selected.length === 1 && this.selected[0] === s }));
      items.push({ n: 9, label: "Wszyscy", on: this.selected.length > 1 && live.every((s) => this.selected.includes(s)) });
      return items;
    }
    const o = this.ensureOrder(this.selected[0]);
    if (this.cmdLevel === "orders") return [
      { n: 1, label: "Stań w miejscu kursora" },
      { n: 2, label: "Za mną" },
      { n: 3, label: "Szarża" },
      { n: 4, label: "Utrzymaj pozycję" },
      { n: 5, label: "Cofnij się" },
      { n: 6, label: `Formacja: ${FORMATION_NAME[o.formation].toLowerCase()} ›` },
      { n: 7, label: `Zwartość: ${this.spacingName(o.spacing)}` },
      { n: 8, label: "Atakuj oddział ›" },
      { n: 9, label: "Więcej ›" },
    ];
    if (this.cmdLevel === "more") return [
      { n: 1, label: "Zajmij wzgórze" },
      { n: 2, label: "Zajmij las" },
      { n: 3, label: "Oskrzydlenie z lewej" },
      { n: 4, label: "Oskrzydlenie z prawej" },
      { n: 5, label: "Zasadzka: ukryj się" },
      { n: 6, label: o.fire ? "Wstrzymaj ogień" : "Strzelać wedle uznania" },
      { n: 7, label: o.meleeOnly ? "Wolna broń" : "Tylko broń biała" },
    ];
    if (this.cmdLevel === "target") {
      const items: { n: number; label: string; on?: boolean }[] = this.enemySquadsVisible().map((s) => ({ n: s, label: ENEMY_SQUADS[s], on: o.targetSquad === s }));
      items.push({ n: 9, label: "Wolny wybór celu", on: o.targetSquad == null });
      return items;
    }
    return FORMATIONS.map((f, i) => ({ n: i + 1, label: FORMATION_NAME[f], on: f === o.formation }));
  }

  cmdChoose(n: number) {
    const gs = this.selected;
    this.sfx.ui();
    const back = () => { this.cmdLevel = "groups"; this.relayoutT = 0; };
    switch (this.cmdLevel) {
      case "assign":
        if (n === 9) { for (const u of this.units) u.picked = false; back(); return; }
        if (n >= 1 && n <= 8) { this.assignPicked(n); this.cmdLevel = "orders"; }
        return;
      case "groups": {
        const live = this.liveSquads();
        if (n === 9) this.selected = live.slice();
        else if (live.includes(n)) this.selected = [n];
        else return;
        this.cmdLevel = "orders";
        return;
      }
      case "orders": {
        const wx = this.cam.x + this.input.mx, wy = this.cam.y + this.input.my;
        if (n === 1) this.orderHere(gs, wx, wy);
        else if (n === 2) this.orderMode(gs, "follow");
        else if (n === 3) this.orderMode(gs, "charge");
        else if (n === 4) this.orderHoldPosition(gs);
        else if (n === 5) this.orderRetreat(gs);
        else if (n === 6) { this.cmdLevel = "formation"; return; }
        else if (n === 7) { this.orderSpacing(gs); this.flashPreview(gs); }
        else if (n === 8) { this.cmdLevel = "target"; return; }
        else if (n === 9) { this.cmdLevel = "more"; return; }
        else return;
        back(); return;
      }
      case "more":
        if (n === 1) this.orderOccupy(gs, "hill");
        else if (n === 2) this.orderOccupy(gs, "forest");
        else if (n === 3) this.orderFlank(gs, -1);
        else if (n === 4) this.orderFlank(gs, 1);
        else if (n === 5) this.orderAmbush(gs);
        else if (n === 6) this.orderFire(gs);
        else if (n === 7) this.orderMelee(gs);
        else return;
        back(); return;
      case "target":
        if (n === 9) this.orderTarget(gs, null);
        else if (this.enemySquadsVisible().includes(n)) this.orderTarget(gs, n);
        else return;
        back(); return;
      case "formation":
        if (n >= 1 && n <= FORMATIONS.length) { this.orderFormation(gs, FORMATIONS[n - 1]); this.flashPreview(gs); back(); }
        return;
    }
  }

  cmdBack() {
    if (this.cmdLevel === "formation" || this.cmdLevel === "more" || this.cmdLevel === "target") this.cmdLevel = "orders";
    else if (this.cmdLevel === "orders" || this.cmdLevel === "assign") { this.cmdLevel = "groups"; for (const u of this.units) u.picked = false; }
    else this.toggleCmd(false);
  }

  toggleCmd(open = !this.cmdOpen) {
    if (!this.hero.active && open) open = false;
    this.cmdOpen = open;
    this.cmdLevel = "groups";
    this.drag = null; this.box = null;
    for (const u of this.units) u.picked = false;
    if (open) { this.hero.blocking = false; if (this.hero.state === "windup") this.hero.state = "idle"; this.hero.drawT = 0; }
    this.sfx.ui();
  }

  handleOrders() {
    const I = this.input;
    if (I.hit("KeyQ")) this.toggleCmd();
    if (!this.hero.active) return;
    if (this.cmdOpen) {
      for (let n = 1; n <= 9; n++) if (I.hit("Digit" + n) || I.hit("Numpad" + n)) this.cmdChoose(n);
      if (I.hit("Backspace") || I.hit("Digit0")) this.cmdBack();
      const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
      if (I.mPressed[2]) this.drag = { sx: wx, sy: wy, ex: wx, ey: wy };
      if (this.drag && I.down[2]) { this.drag.ex = wx; this.drag.ey = wy; }
      if (this.drag && I.mReleased[2]) this.applyDrag();
      if (this.cmdLevel === "target" && I.mPressed[0]) {
        const e = this.units.find((u) => u.team === 1 && u.active && !u.hidden && dist(u.x, u.y - 8, wx, wy) < 12);
        if (e) { this.orderTarget(this.selected, e.squad); this.cmdLevel = "groups"; return; }
      }
      // lewy przycisk: kliknięcie żołnierza wybiera oddział; przeciągnięcie ramki zaznacza żołnierzy do przeniesienia
      if (I.mPressed[0]) this.box = { sx: wx, sy: wy, ex: wx, ey: wy };
      if (this.box && I.down[0]) { this.box.ex = wx; this.box.ey = wy; }
      if (this.box && I.mReleased[0]) {
        const b = this.box; this.box = null;
        if (dist(b.sx, b.sy, b.ex, b.ey) < 5) {
          let best: Unit | null = null, bd = 12;
          for (const u of this.units) if (u.team === 0 && !u.hero && u.active) { const d = dist(u.x, u.y - 8, wx, wy); if (d < bd) { bd = d; best = u; } }
          if (best) {
            if (I.held("ShiftLeft") || I.held("ShiftRight")) { best.picked = !best.picked; this.cmdLevel = "assign"; }
            else { this.selected = [best.squad]; this.cmdLevel = "orders"; }
            this.sfx.ui();
          }
        } else {
          const x0 = Math.min(b.sx, b.ex), x1 = Math.max(b.sx, b.ex), y0 = Math.min(b.sy, b.ey), y1 = Math.max(b.sy, b.ey);
          let n = 0;
          for (const u of this.units) if (u.team === 0 && !u.hero && u.active && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1) { u.picked = true; n++; }
          if (n) { this.cmdLevel = "assign"; this.sfx.ui(); }
        }
      }
      return;
    }
    if (I.hit("KeyZ")) this.orderHere(this.selected, this.cam.x + I.mx, this.cam.y + I.my);
    if (I.hit("KeyX")) this.orderMode(this.selected, "follow");
    if (I.hit("KeyC")) this.orderMode(this.selected, "charge");
    if (I.hit("KeyV")) {
      const cur = this.ensureOrder(this.selected[0]).formation;
      this.orderFormation(this.selected, FORMATIONS[(FORMATIONS.indexOf(cur) + 1) % FORMATIONS.length]);
      this.flashPreview(this.selected);
    }
    if (I.hit("KeyB")) this.orderFire(this.selected);
  }

  // ---------- Obrót z ograniczoną prędkością: ciężar ciała ----------
  turnRate(u: Unit) {
    switch (u.state) {
      case "windup": return 3.2;
      case "strike": return 1.1;
      case "recover": return 2.4;
      case "stagger": return 0.6;
      case "kick": return 1.5;
      default: return u.mounted ? 6 : 7.5;
    }
  }
  turn(u: Unit, dt: number) {
    const d = angDiff(u.face, u.wantFace), r = this.turnRate(u) * dt;
    u.face += clamp(d, -r, r);
  }

  // ---------- Bohater ----------
  updateHero(dt: number) {
    const h = this.hero, I = this.input;
    if (!h.active) return;
    const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
    h.wantFace = Math.atan2(wy - (h.y - (h.mounted ? 18 : 8)), wx - h.x);

    if (I.hit("Tab") && h.state === "idle") {
      h.loadout = (h.loadout + 1) % HERO_LOADOUTS.length;
      const L = HERO_LOADOUTS[h.loadout];
      h.weaponKey = L.weapon; h.hasShield = L.shield; h.drawT = 0;
      this.say(`Broń: ${L.name}`);
    }
    if (this.settings.gesture) {
      const gst = I.gesture(170);
      if (!this.cmdOpen && Math.abs(gst.x) + Math.abs(gst.y) > 5) this.loadDir = Math.abs(gst.x) > Math.abs(gst.y) ? (gst.x < 0 ? "L" : "R") : (gst.y < 0 ? "O" : "T");
    }

    let mx = 0, my = 0;
    if (I.held("KeyW")) my -= 1; if (I.held("KeyS")) my += 1;
    if (I.held("KeyA")) mx -= 1; if (I.held("KeyD")) mx += 1;
    const ml = Math.hypot(mx, my) || 1;
    const sprint = I.held("ShiftLeft") || I.held("ShiftRight");

    if (h.mounted) {
      const gallop = sprint && h.stamina > 1;
      if (mx || my) this.ride(h, h.x + (mx / ml) * 60, h.y + (my / ml) * 60, h.maxRide * (gallop ? 1 : 0.6), dt);
      else this.ride(h, h.x + Math.cos(h.heading) * 40, h.y + Math.sin(h.heading) * 40, 0, dt);
      if (gallop && h.rspeed > 60) { h.stamina -= 10 * dt; h.staminaWait = 0.6; }
    } else {
      let sp = h.def.speed;
      const canSprint = sprint && h.stamina > 1 && (mx || my) && !h.blocking && h.state === "idle";
      if (canSprint) { sp *= 1.45; h.stamina -= 18 * dt; h.staminaWait = 0.6; }
      if (h.blocking) sp *= 0.5;
      if (h.state === "windup") sp *= 0.55;
      if (h.state === "strike") sp *= 0.3;
      if (h.state === "recover") sp *= 0.6;
      if (h.usingBow && h.drawT > 0) sp *= 0.45;
      if (h.state === "stagger" || h.state === "kick") sp *= 0.15;
      const tvx = (mx / ml) * sp, tvy = (my / ml) * sp;
      const acc = h.state === "strike" || h.state === "stagger" ? 2.5 : 6;
      h.vx = lerp(h.vx, tvx, clamp(dt * acc, 0, 1)); h.vy = lerp(h.vy, tvy, clamp(dt * acc, 0, 1));
      h.moving = !!(mx || my);
    }

    if (h.staminaWait > 0) h.staminaWait -= dt;
    else if (!h.blocking) h.stamina = Math.min(100, h.stamina + 20 * dt);
    h.stamina = Math.max(0, h.stamina);

    if (this.cmdOpen) { h.blocking = false; return; }
    if (h.usingBow) { this.heroBow(dt, wx, wy); return; }

    if (I.mPressed[2]) {
      if (h.state === "windup") { h.state = "idle"; h.t = 0; h.cooldown = 0.15; h.nextSide = h.dir === "L" ? "R" : "L"; this.say("Zwód"); }
      else h.blockStart = this.time;
    }
    h.blocking = I.down[2] && (h.state === "idle" || h.state === "recover") && h.hasShield;
    if (h.blocking) h.staminaWait = Math.max(h.staminaWait, 0.3);

    // ciosy: LPM cięcie (na przemian), E z góry, Spacja pchnięcie; opcjonalnie gest myszą
    if (h.state === "idle" && !h.blocking && h.cooldown <= 0) {
      if (I.mPressed[0]) {
        let d: Dir = this.settings.gesture ? this.loadDir : h.nextSide;
        if (h.mounted && !this.settings.gesture) d = angDiff(h.heading, h.wantFace) < 0 ? "L" : "R";
        this.startWindup(h, d); h.key = "mouse";
      } else if (I.hit("KeyE")) { this.startWindup(h, "O"); h.key = "KeyE"; }
      else if (I.hit("Space")) { this.startWindup(h, "T"); h.key = "Space"; }
    }
    if (h.state === "windup") {
      const held = h.key === "mouse" ? I.down[0] : I.held(h.key);
      if (held) h.hold += dt; else h.released = true;
    }

    if (I.hit("KeyF") && !h.mounted && (h.state === "idle" || h.state === "recover") && h.stamina >= 12) {
      h.state = "kick"; h.t = 0; h.hitDone = false; h.stamina -= 15; h.staminaWait = 0.5; h.blocking = false;
      h.vx += Math.cos(h.face) * 30; h.vy += Math.sin(h.face) * 30;
    }
  }

  heroBow(dt: number, wx: number, wy: number) {
    const h = this.hero, I = this.input;
    h.blocking = false;
    if (h.state !== "idle") return;
    if (I.down[0] && h.ammo > 0) h.drawT = Math.min(1, h.drawT + dt / 0.7);
    if (I.mReleased[0] && h.drawT > 0) {
      if (h.drawT > 0.15) {
        const k = h.drawT;
        const a = h.face + rr(-1, 1) * this.bowSpread();
        const d = clamp(dist(h.x, h.y - 9, wx, wy), 40, 360);
        this.fire(h, a, lerp(300, 440, k), lerp(20, 50, k), d);
        h.ammo--;
        this.kickCam(-Math.cos(a), -Math.sin(a), 1.3);
      }
      h.drawT = 0;
    }
  }
  bowSpread() { const h = this.hero; return lerp(0.18, 0.012, h.drawT) * (h.moving || h.rspeed > 20 ? 1.8 : 1); }

  // ---------- Jazda konna ----------
  ride(u: Unit, tx: number, ty: number, want: number, dt: number) {
    const m = u.def.mount || HORSE;
    const desired = Math.atan2(ty - u.y, tx - u.x);
    const diff = angDiff(u.heading, desired);
    const maxTurn = m.turn * (1 - 0.45 * clamp(u.rspeed / m.speed, 0, 1));
    if (u.rspeed > 3 || Math.abs(diff) > 0.05) u.heading += clamp(diff, -maxTurn * dt, maxTurn * dt);
    if (Math.abs(diff) > 1.6 && u.rspeed > 40) want *= 0.5;
    if (u.decay) want *= 0.8;
    const acc = want > u.rspeed ? m.accel : m.accel * 1.6;
    u.rspeed += clamp(want - u.rspeed, -acc * dt, acc * dt);
    u.vx = Math.cos(u.heading) * u.rspeed; u.vy = Math.sin(u.heading) * u.rspeed;
    u.moving = u.rspeed > 6;
    if (!u.hero && (u.state === "idle" || !u.target)) u.wantFace = u.heading;
  }

  dismount(u: Unit) {
    if (!u.mounted) return;
    u.mounted = false;
    const s = this.vol(u.x);
    this.sfx.neigh(s.v, s.pan); this.sfx.trample(s.v * 0.7, s.pan);
    const [hd] = this.dirIndex(u.heading);
    this.corpses.push({ x: u.x, y: u.y + 2, img: u.horse.frames[hd][0], flip: Math.cos(u.heading) < 0, rot: 0, undead: false, bones: false, t: 1, pooled: false, horse: true });
    this.pool(u.x, u.y + 3, 6);
    u.rspeed = 0; u.vx *= 0.3; u.vy *= 0.3;
    u.hp -= 10;
    this.stagger(u, 1.2);
    this.dust(u.x, u.y, 12);
    if (u.hero) { this.say("Twój koń padł!", PAL.redL, true); this.shake(2); }
    if (u.hp <= 0 && u.state !== "dead") this.kill(u, null);
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
      if (facing && (e.state === "idle" || e.state === "recover") && chance(e.def.guard * (u.hero ? 1 : 0.8) * (e.decay ? 0.5 : 1)))
        e.pendingGuard = { dir, at: this.time + e.def.react * rr(0.85, 1.25) };
    }
  }

  windupTime(u: Unit) { return u.w.windup * (u.hero ? 1 : rr(1, 1.2)) * (u.dir === "O" ? 1.15 : 1) * (u.target?.mounted && !u.mounted ? 0.7 : 1); }
  weight(u: Unit) { return u.w.len >= 14 ? 1.5 : u.w.head ? 1.25 : 1; }

  updateCombat(u: Unit, dt: number) {
    u.t += dt;
    if (u.cooldown > 0) u.cooldown -= dt;
    if (u.flash > 0) u.flash -= dt;
    if (u.bloodT > 0) u.bloodT -= dt;
    if (u.trampleT > 0) u.trampleT -= dt;
    if (u.guardT > 0) { u.guardT -= dt; if (u.guardT <= 0) u.guard = null; }
    if (u.pendingGuard && this.time >= u.pendingGuard.at) {
      if (u.state === "idle" || u.state === "recover") { u.guard = u.pendingGuard.dir; u.guardT = 0.8; }
      u.pendingGuard = null;
    }
    this.turn(u, dt);
    const w = u.w;
    switch (u.state) {
      case "windup": {
        const minT = u.hero ? w.windup * 0.8 * (u.dir === "O" ? 1.15 : 1) : this.windupTime(u);
        if (u.t >= minT && (!u.hero || u.released || u.hold > 1.6)) {
          u.state = "strike"; u.t = 0; u.hitDone = false;
          const s = this.vol(u.x);
          this.sfx.swing(s.v * (u.hero ? 1 : 0.4), s.pan, this.weight(u) * (u.hero && u.hold > 0.5 ? 1.25 : 1));
          if (!u.mounted) {
            const lunge = (u.hero ? 45 : 28) * (u.dir === "T" ? 1.4 : u.dir === "O" ? 0.7 : 1);
            u.vx += Math.cos(u.face) * lunge; u.vy += Math.sin(u.face) * lunge;
          }
          if (u.hero && !u.mounted) u.nextSide = u.dir === "R" ? "L" : u.dir === "L" ? "R" : u.nextSide;
        }
        break;
      }
      case "strike":
        if (!u.hitDone && u.t >= w.strike * 0.5) { u.hitDone = true; this.meleeHit(u); }
        if (u.t >= w.strike) { u.state = "recover"; u.t = 0; }
        break;
      case "recover":
        if (u.t >= w.recover) { u.state = "idle"; u.t = 0; u.cooldown = u.hero ? 0.06 : rr(0.35, 1.1); }
        break;
      case "stagger":
        if (u.t >= u.hold) { u.state = "idle"; u.t = 0; u.hold = 0; }
        break;
      case "kick":
        if (!u.hitDone && u.t >= 0.12) { u.hitDone = true; this.kickHit(u); }
        if (u.t >= 0.32) { u.state = "idle"; u.t = 0; }
        break;
    }
  }

  stagger(u: Unit, time: number) {
    if (!u.active) return;
    u.state = "stagger"; u.t = 0; u.hold = time; u.guard = null; u.guardT = 0; u.pendingGuard = null;
    u.blocking = false; u.drawT = 0;
  }

  push(u: Unit, fromX: number, fromY: number, power: number) {
    if (u.mounted) { u.rspeed *= 0.85; return; }
    const a = Math.atan2(u.y - fromY, u.x - fromX);
    const k = u.def.poise ? 0.3 : 1;
    u.vx += Math.cos(a) * power * k; u.vy += Math.sin(a) * power * k;
  }

  kickCam(dx: number, dy: number, amount: number) { this.shakeVX += dx * amount * 75; this.shakeVY += dy * amount * 75; }
  shake(n: number) { this.rumble = Math.max(this.rumble, n); }

  meleeHit(a: Unit) {
    const w = a.w, dir = a.dir;
    let arc = dir === "T" ? 0.5 : dir === "O" ? 0.75 : 1.35;
    let reach = w.reach + (dir === "T" ? 4 : 0);
    if (a.mounted) { arc = 1.7; reach += 4; }
    let best: Unit | null = null, bd = 1e9;
    for (const u of this.units) {
      if (u.team === a.team || !u.active) continue;
      const d = dist(a.x, a.y, u.x, u.y);
      if (d > reach + u.radius) continue;
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
    const hx = a.x + (d.x - a.x) * 0.6, hy = a.y + (d.y - a.y) * 0.6 - (d.mounted ? 18 : 10);
    const ha = Math.atan2(d.y - a.y, d.x - a.x);
    if (a.hidden) this.reveal(a);

    if (d.hero && d.blocking && angFromD < 1.2) {
      if (this.time - d.blockStart <= this.parryWindow(d)) {
        this.sfx.parry();
        this.hitstop = Math.max(this.hitstop, 0.18); this.kickCam(Math.cos(ha), Math.sin(ha), 1.5);
        this.stagger(a, a.def.poise ? 0.65 : 1.0);
        this.push(a, d.x, d.y, 55);
        this.sparks(hx, hy, 20, PAL.gold); this.impact(hx, hy, PAL.gold, 1.4);
        this.shout("Parowanie!");
        d.stamina = Math.min(100, d.stamina + 8);
        return;
      }
      const cost = 9 + w.dmg[dir] * 0.35;
      d.stamina -= cost; d.staminaWait = 0.6;
      this.sfx.thunk(1, s.pan);
      this.sparks(hx, hy, 6, PAL.steelL); this.impact(hx, hy, PAL.wood, 0.7);
      this.push(d, a.x, a.y, 40);
      this.hitstop = Math.max(this.hitstop, 0.06); this.kickCam(Math.cos(ha), Math.sin(ha), 0.9);
      if (d.stamina <= 0) { d.stamina = 0; this.stagger(d, 0.8); this.shout("Garda przełamana!", PAL.redL); }
      return;
    }
    if (!d.hero && d.guard === dir && angFromD < 1.6 && (d.state === "idle" || d.state === "recover")) {
      this.sfx.clang(s.v, s.pan);
      this.sparks(hx, hy, 9, PAL.steelL); this.impact(hx, hy, PAL.white, 0.8);
      if (a.hero) { this.stagger(a, 0.4); this.hitstop = Math.max(this.hitstop, 0.08); this.kickCam(-Math.cos(ha), -Math.sin(ha), 0.9); this.floater(d.x, d.y - 24, "BLOK", PAL.steelL, true); this.push(a, d.x, d.y, 35); }
      else a.cooldown = 0.3;
      d.guardT = Math.max(d.guardT, 0.3);
      return;
    }
    if (!d.hero && d.hasShield && d.state === "idle" && angFromD < 1.0) {
      const wall = d.team === 0 && this.orders[d.squad]?.formation === "wall";
      if (chance(d.def.shieldBlock * (wall ? 1.6 : 1))) {
        this.sfx.thunk(s.v, s.pan);
        this.sparks(hx, hy, 3, PAL.wood);
        if (a.hero) { this.floater(d.x, d.y - 24, "TARCZA", PAL.dirtL, true); this.hitstop = Math.max(this.hitstop, 0.06); }
        return;
      }
    }
    let dmg = w.dmg[dir] * d.def.armor[w.type[dir]] * rr(0.9, 1.1);
    const charged = a.hero && a.hold > 0.5;
    if (a.hero) dmg *= lerp(0.85, 1.3, clamp(a.hold / 0.7, 0, 1));
    if (a.decay) dmg *= 0.75;
    const speedK = a.mounted ? a.rspeed / a.maxRide : 0;
    dmg *= 1 + speedK * 0.45;
    if (this.height(a.x, a.y) - this.height(d.x, d.y) > 0.15) dmg *= 1.2;
    const head = dir === "O" && chance(0.45);
    if (head) dmg *= 1.5;
    if (d.state === "windup" && dir === "T") dmg *= 1.15;
    const heavy = dir === "O" || charged || w.type[dir] === "blunt" || w.len >= 14 || speedK > 0.7;
    if (!d.def.undead) a.bloodT = 8;
    if (d.mounted && chance(0.5)) {   // trafiony koń zamiast jeźdźca
      d.horseHp -= dmg * 1.2;
      this.blood(hx, hy + 8, 10, a, heavy);
      this.sfx.hit(s.v, s.pan, w.type[dir], heavy);
      if (heroInvolved) { this.hitstop = Math.max(this.hitstop, 0.08); this.kickCam(Math.cos(ha), Math.sin(ha), 1.2); }
      if (d.horseHp <= 0) this.dismount(d);
      return;
    }
    this.damage(d, dmg, a, head, w.type[dir], heavy, hx, hy);
    if (heroInvolved) {
      const killed = d.hp <= 0;
      this.hitstop = Math.max(this.hitstop, (head ? 0.14 : heavy ? 0.12 : 0.085) + (killed ? 0.05 : 0));
      this.kickCam(Math.cos(ha), Math.sin(ha), (d.hero ? 2.2 : heavy ? 1.8 : 1.2) + (killed ? 0.6 : 0));
      if (heavy || head) this.shake(2);
      if (killed && a.hero) this.slowT = Math.max(this.slowT, 0.2);
    }
  }

  kickHit(a: Unit) {
    for (const u of this.units) {
      if (u.team === a.team || !u.active || u.mounted) continue;
      if (dist(a.x, a.y, u.x, u.y) > 17 + u.def.radius) continue;
      if (Math.abs(angDiff(a.face, Math.atan2(u.y - a.y, u.x - a.x))) > 0.9) continue;
      this.sfx.kick();
      this.stagger(u, u.def.poise ? 0.4 : 0.85);
      this.push(u, a.x, a.y, 110);
      this.hitstop = Math.max(this.hitstop, 0.08);
      this.kickCam(Math.cos(a.face), Math.sin(a.face), 1.4);
      this.dust(u.x, u.y, 8);
      this.impact(u.x, u.y - 9, PAL.dirtL, 0.8);
      return;
    }
  }

  damage(d: Unit, dmg: number, src: Unit | null, head: boolean, type: DmgType = "cut", heavy = false, hx?: number, hy?: number) {
    dmg = Math.round(dmg);
    d.hp -= dmg; d.flash = 0.08;
    if (d.hidden) this.reveal(d);
    const s = this.vol(d.x);
    const x = hx ?? d.x, y = hy ?? d.y - 9;
    if (d.def.undead) {
      this.sfx.bone(s.v, s.pan, heavy);
      if (type === "blunt") this.sfx.hit(s.v * 0.5, s.pan, "blunt", true);
      this.bones(x, y, 6 + (dmg / 5) | 0, src);
      this.impact(x, y, PAL.boneHi, heavy ? 1.2 : 0.9);
    } else {
      this.sfx.hit(s.v, s.pan, type, heavy);
      if (d.hp > 0 && chance(0.6)) this.sfx.pain(s.v, s.pan);
      this.blood(x, y, 14 + (dmg / 1.8) | 0, src, heavy);
      this.impact(x, y, PAL.bloodL, heavy ? 1.2 : 0.9);
      if (src) this.streak(d.x, d.y, Math.atan2(d.y - src.y, d.x - src.x), 8 + dmg / 4);
    }
    if (src) this.push(d, src.x, src.y, 30 + dmg * (heavy ? 1.0 : 0.6));
    const interrupt = !d.def.poise || head || dmg >= 40 || type === "blunt";
    if (d.hp > 0 && interrupt) this.stagger(d, d.hero ? 0.3 : heavy ? 0.7 : 0.45);
    if (this.settings.damageNumbers && (src?.hero || d.hero)) this.floater(d.x + rr(-3, 3), d.y - 26, (head ? "GŁOWA " : "") + dmg, d.hero ? PAL.redL : head ? PAL.gold : PAL.white, true);
    else if (head && src?.hero) this.floater(d.x, d.y - 26, "GŁOWA", PAL.gold, true);
    if (d.hero) this.hurtFlash = 0.35;
    if (d.hp <= 0) this.kill(d, src);
  }

  kill(d: Unit, src: Unit | null) {
    if (!d.active) return;
    const s = this.vol(d.x);
    if (src) src.kills++;
    if (d.hero) {
      if (d.mounted) { d.mounted = false; const [hd] = this.dirIndex(d.heading); this.corpses.push({ x: d.x, y: d.y + 2, img: d.horse.frames[hd][0], flip: Math.cos(d.heading) < 0, rot: 0, undead: false, bones: false, t: 1, pooled: false, horse: true }); }
      d.state = "down"; d.hp = 0; d.blocking = false; d.vx = d.vy = 0;
      this.camFree = true; this.cmdOpen = false;
      this.say("Padłeś ogłuszony. Oddziały bez oficera ruszają do szarży.", PAL.redL, true);
      this.shout("Padłeś!", PAL.redL);
      this.slowT = 1;
      for (const u of this.units) if (u.team === 0 && !u.hero) u.morale -= 20;
      this.heroDown();
      return;
    }
    d.state = "dead";
    if (d.def.undead) this.sfx.death(s.v * 0.8, s.pan, true);
    else { this.sfx.death(s.v * 0.8, s.pan, false); if (chance(0.5)) this.sfx.scream(s.v * 0.8, s.pan); }
    if (d.mounted) {
      d.mounted = false;
      const [hd] = this.dirIndex(d.heading);
      this.corpses.push({ x: d.x + 4, y: d.y + 3, img: d.horse.frames[hd][0], flip: Math.cos(d.heading) < 0, rot: 0, undead: false, bones: false, t: 1, pooled: false, horse: true });
    }
    const [dirI] = this.dirIndex(d.face);
    const bones = !!d.def.undead && !d.commander && d.def.body !== "ghoul";
    this.corpses.push({ x: d.x, y: d.y, img: d.spr.frames[dirI][0], flip: Math.cos(d.face) < 0, rot: src && Math.cos(Math.atan2(d.y - src.y, d.x - src.x)) < 0 ? -1 : 1, undead: !!d.def.undead, bones, t: 0, pooled: false });
    if (bones) this.bones(d.x, d.y - 8, 14, src);
    else if (!d.def.undead) this.blood(d.x, d.y - 8, 18, src, true);
    for (const u of this.units) {
      if (!u.active || u.def.undead) continue;
      const near = dist(u.x, u.y, d.x, d.y) < 90;
      if (u.team === d.team && near) u.morale -= 7;
      if (u.team !== d.team && near) u.morale = Math.min(100, u.morale + 3);
    }
    if (d.officer) {
      for (const u of this.units) if (u.team === 0 && u.squad === d.squad && u.active) u.morale -= 15;
      this.say(`Oficer oddziału ${SQUAD_NAMES[d.squad]} poległ!`, PAL.redL, true);
      if (!this.hero.active && this.orders[d.squad]) this.orders[d.squad].mode = "charge";
    }
    if (d.commander) this.collapse();
    if (src?.hero) this.say(`Zabiłeś: ${d.def.name}`);
  }

  heroDown() {
    for (const sq of this.liveSquads()) {
      const off = this.units.find((u) => u.team === 0 && u.squad === sq && u.officer && u.active);
      if (off) this.say(`${SQUAD_NAMES[sq]}: oficer przejmuje dowodzenie.`, PAL.gold);
      else { this.ensureOrder(sq).mode = "charge"; this.orders[sq].flank = null; }
    }
    this.sfx.battleCry(1);
  }

  // Oficerowie dowodzą, gdy bohater leży.
  officerAI() {
    if (this.hero.active) return;
    for (const sq of this.liveSquads()) {
      const off = this.units.find((u) => u.team === 0 && u.squad === sq && u.officer && u.active);
      const o = this.ensureOrder(sq);
      if (!off) { o.mode = "charge"; continue; }
      const c = this.centroid(0, sq);
      let near = 1e9;
      for (const e of this.units) if (e.team === 1 && e.active && !e.hidden) near = Math.min(near, dist(c.x, c.y, e.x, e.y));
      const list = this.squadUnits(sq);
      if (list.some((u) => u.def.bow)) {
        const ammo = list.reduce((s, u) => s + u.ammo, 0);
        if (ammo === 0) { o.mode = "charge"; o.meleeOnly = true; }
        else if (near < 55 && o.mode !== "charge") this.orderRetreat([sq]);
        else if (o.mode !== "hold") { o.mode = "hold"; o.ax = c.x; o.ay = c.y; o.face = undefined; }
      } else {
        if (near < 110) o.mode = "charge";
        else if (o.mode === "charge" && near > 200) { o.mode = "hold"; o.ax = c.x; o.ay = c.y; o.face = undefined; }
      }
    }
  }

  collapse() {
    this.sfx.wail();
    this.shout("Rycerz Śmierci padł!", PAL.purpleL);
    this.say("Klątwa słabnie: nieumarli są wolniejsi i słabsi.", PAL.purpleL, true);
    this.slowT = 1.2;
    this.shake(4);
    for (let i = 0; i < 50; i++) this.parts.push({ x: this.dk.x + rr(-6, 6), y: this.dk.y, z: rr(4, 20), vx: rr(-20, 20), vy: rr(-20, 20), vz: rr(20, 70), life: 1.4, max: 1.4, col: pick([PAL.purpleL, PAL.purple]), kind: "soul" });
    for (const u of this.units) if (u.team === 1 && u.active) {
      u.decay = true;
      if (u.def.body === "skel" && chance(0.15)) this.kill(u, null);
    }
    for (const u of this.units) if (u.team === 0 && u.active) u.morale = Math.min(100, u.morale + 25);
  }

  reveal(u: Unit) {
    const sq = u.squad, team = u.team;
    let any = false;
    for (const o of this.units) if (o.team === team && o.squad === sq && o.hidden) { o.hidden = false; any = true; }
    const ord = team === 0 ? this.orders[sq] : this.eorders[sq];
    if (ord && ord.mode === "ambush") ord.mode = "charge";
    if (!any) return;
    if (team === 1) { this.say("Zasadzka! Ghule wypadają z lasu!", PAL.purpleL, true); this.sfx.moan(1, 0); this.sfx.battleCry(0.5); this.shake(2); }
    else { this.say(`${SQUAD_NAMES[sq]}: z zasadzki, naprzód!`, PAL.gold); this.sfx.battleCry(0.8); for (const o of this.units) if (o.team === 0 && o.squad === sq) o.morale = Math.min(100, o.morale + 15); }
  }

  // ---------- Łuki ----------
  fire(u: Unit, a: number, speed: number, dmg: number, d: number) {
    const oy = u.mounted ? 18 : 9;
    if (!u.hero && this.height(u.x, u.y) > 0.3) dmg *= 1.1;
    this.arrows.push({ x: u.x + Math.cos(a) * 6, y: u.y - oy + Math.sin(a) * 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, team: u.team, src: u, dmg, age: 0, travel: 0, dist: d, done: false });
    if (u.hidden) this.reveal(u);
    const s = this.vol(u.x);
    this.sfx.bow(s.v * (u.hero ? 1 : 0.35), s.pan);
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
          if (u.team === ar.team && ar.travel >= 14 && p < 0.92) continue;   // swoich strzała mija wysoko, chyba że spada tuż przy nich
          if (dist(u.x, u.y - (u.mounted ? 12 : 8), ar.x, ar.y) > u.radius + (u.team === ar.team ? 1 : 3)) continue;
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
    if (u.team === 0 && !u.hero && this.orders[u.squad]?.spacing > 1 && chance(0.25)) return;   // przeleciała między szeregami
    ar.done = true;
    if (this.inForest(u.x, u.y) && chance(0.4)) { this.sfx.thunk(s.v * 0.3, s.pan); return; }   // drzewo przyjęło strzałę
    if (u.hero && u.blocking && facing < 1.25) { this.sfx.thunk(1, s.pan); this.sparks(u.x, u.y - 9, 3, PAL.wood); return; }
    if (!u.hero && u.hasShield && u.state === "idle" && facing < 1.1) {
      const wall = u.team === 0 && this.orders[u.squad]?.formation === "wall";
      if (chance(wall ? 0.88 : 0.5)) { this.sfx.thunk(s.v * 0.6, s.pan); return; }
    }
    const head = chance(0.12);
    const dmg = ar.dmg * u.def.armor.pierce * rr(0.85, 1.15) * (head ? 1.5 : 1);
    if (ar.src.team === u.team && ar.src.hero) this.say("Trafiłeś swojego!", PAL.redL);
    this.sfx.arrowHit(s.v, s.pan);
    if (u.mounted && chance(0.5)) {
      u.horseHp -= dmg * 1.3;
      this.blood(u.x, u.y - 6, 6, null);
      if (u.horseHp <= 0) this.dismount(u);
      return;
    }
    this.damage(u, dmg, null, head, "pierce", false);
    this.push(u, u.x - ar.vx, u.y - ar.vy, 20);
    if (ar.src.hero) this.hitstop = Math.max(this.hitstop, 0.05);
  }

  // ---------- AI ----------
  isVisibleTo(e: Unit, viewer: Unit) {
    if (!e.hidden) return true;
    return dist(e.x, e.y, viewer.x, viewer.y) < (this.inForest(e.x, e.y) ? 40 : 80);
  }

  updateAI(u: Unit, dt: number) {
    if (u.decay) {
      u.hp -= 1.3 * dt;
      if (chance(dt * 3)) this.parts.push({ x: u.x + rr(-4, 4), y: u.y, z: rr(4, 14), vx: rr(-6, 6), vy: rr(-6, 6), vz: rr(8, 20), life: 0.8, max: 0.8, col: PAL.purpleL, kind: "soul" });
      if (u.hp <= 0) { this.kill(u, null); return; }
    }
    if (u.state === "stagger" || u.state === "kick") { u.moving = false; if (u.mounted) this.ride(u, u.x + Math.cos(u.heading) * 30, u.y + Math.sin(u.heading) * 30, 0, dt); return; }

    if (!u.def.undead && !u.fleeing && u.morale < 18) {
      u.fleeing = true;
      this.say(`${u.def.name} ucieka z pola bitwy!`, PAL.ash);
    }
    if (u.fleeing) {
      const ec = this.centroid(1 - u.team);
      const a = Math.atan2(u.y - ec.y, u.x - ec.x);
      if (u.mounted) this.ride(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, u.maxRide, dt);
      else this.steer(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, u.def.speed * 1.15, dt);
      u.wantFace = a;
      if (u.x < 4 || u.y < 4 || u.x > WW - 4 || u.y > WH - 4) u.state = "fled";
      u.morale += dt * 2;
      if (u.morale > 45 && chance(dt * 0.3)) { u.fleeing = false; this.say(`${u.def.name} wraca do walki.`, PAL.ash); }
      return;
    }

    const o = u.team === 0 ? this.orders[u.squad] : this.eorders[u.squad];
    const mode: Mode = o ? o.mode : "charge";
    if (mode === "ambush") {
      this.steer(u, u.slotX, u.slotY, u.def.speed * 0.5, dt, 3);
      for (const e of this.units) if (e.team !== u.team && e.active && dist(e.x, e.y, u.x, u.y) < (u.team === 1 ? 85 : 60)) { this.reveal(u); break; }
      return;
    }
    if (mode === "flank" && o.flank) {
      const c = this.centroid(u.team, u.squad);
      if (dist(c.x, c.y, o.flank.x, o.flank.y) < 45) { o.mode = "charge"; o.flank = null; if (u.team === 0) this.say(`${SQUAD_NAMES[u.squad]}: uderzamy w skrzydło!`, PAL.gold); }
    }
    const fire = o ? o.fire && !o.meleeOnly : true;
    const engage = mode === "charge" ? 9999 : mode === "hold" ? (u.mounted ? 60 : 34) : mode === "flank" ? 28 : 60;

    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || !u.target.active || !this.isVisibleTo(u.target, u)) { u.retarget = rr(0.35, 0.7); u.target = this.chooseTarget(u, o); }
    const t = u.target;
    const td = t ? dist(u.x, u.y, t.x, t.y) : 1e9;

    if (u.def.bow && t && !u.mounted) {
      const near = this.nearestEnemy(u);
      const closeThreat = near && dist(u.x, u.y, near.x, near.y) < 26;
      const range = u.def.bow.range * (this.height(u.x, u.y) > 0.3 ? 1.2 : 1);
      if (!closeThreat && fire && u.ammo > 0 && td < range && mode !== "charge") {
        if (u.state === "idle") {
          this.steer(u, u.slotX, u.slotY, u.def.speed * 0.6, dt, 6);
          u.moving = false;
          u.wantFace = Math.atan2(t.y - u.y, t.x - u.x);
          u.reload -= dt * (u.decay ? 0.7 : 1);
          let safe = true;
          for (const f of this.units) if (f.team === u.team && f.active && f !== u && dist(f.x, f.y, t.x, t.y) < 28) { safe = false; break; }
          if (!safe) { u.retarget = 0; return; }
          if (u.reload <= 0 && Math.abs(angDiff(u.face, u.wantFace)) < 0.3) {
            const lead = td / 300;
            const tx = t.x + t.vx * lead, ty = t.y + t.vy * lead;
            const a = Math.atan2(ty - (u.y - 9), tx - u.x) + rr(-1, 1) * u.def.bow.spread * (1 + td / 260) * (u.decay ? 1.6 : 1);
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
    // w szyku walcz z miejsca i nie wybiegaj daleko: mniej kłębienia
    const leash = mode === "hold" ? 22 : mode === "follow" ? 40 : 9999;
    const engaged = !!tgt && (mode === "charge" || (slotDist < engage + 18 && tdist < engage + leash));

    if (u.mounted) { this.mountedAI(u, tgt, engaged, dt); return; }

    if (engaged && tgt) {
      const want = u.w.reach - 3 + tgt.radius;
      const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      if (u.state === "idle" || u.state === "recover" || u.state === "windup") u.wantFace = a;
      const spd = u.def.speed * (u.decay ? 0.8 : 1);
      if (tdist > want) {
        // jeśli ktoś z twoich już stoi między wami, obejdź go bokiem
        let side = 0;
        for (const f of this.units) if (f !== u && f.team === u.team && f.active && f.target === tgt && dist(f.x, f.y, u.x, u.y) < 10) side += angDiff(a, Math.atan2(f.y - u.y, f.x - u.x)) > 0 ? -1 : 1;
        const sa = a + clamp(side, -1, 1) * 0.9;
        this.steer(u, u.x + Math.cos(sa) * 30, u.y + Math.sin(sa) * 30, spd * (u.state === "windup" ? 0.5 : 1), dt);
      } else {
        this.steer(u, u.x - Math.cos(a) * 3, u.y - Math.sin(a) * 3, spd * 0.25, dt);
        u.moving = false;
        if (u.state === "idle" && u.cooldown <= 0 && Math.abs(angDiff(u.face, a)) < 0.5) {
          const dirs = (["L", "R", "O", "T"] as Dir[]).filter((d) => d !== tgt.guard);
          this.startWindup(u, pick(dirs));
        }
      }
      if (tgt.hero && u.state === "idle") {
        u.idleGuardT -= dt;
        if (u.idleGuardT <= 0) {
          u.idleGuardT = rr(1, 2.4);
          if (chance(0.45)) { u.guard = pick<Dir>(["L", "R", "O", "T"]); u.guardT = rr(0.8, 1.6); }
        }
      }
    } else {
      const d = dist(u.x, u.y, u.slotX, u.slotY);
      const formSpeed = u.team === 0 && this.orders[u.squad]?.formation === "wall" ? 0.65 : 1;
      const spd = u.def.speed * formSpeed * (d > 40 ? 1.15 : 1) * (u.decay ? 0.8 : 1);
      if (d > 2) this.steer(u, u.slotX, u.slotY, spd, dt, 3);
      else { u.vx *= 0.8; u.vy *= 0.8; u.moving = false; }
      u.wantFace = d < 8 ? u.slotFace : Math.atan2(u.slotY - u.y, u.slotX - u.x);
    }
  }

  // Jeździec: najazd, cięcie z boku w przelocie, nawrót i ponowna szarża.
  mountedAI(u: Unit, tgt: Unit | null, engaged: boolean, dt: number) {
    const max = u.maxRide;
    if (u.wheelTo) {
      this.ride(u, u.wheelTo.x, u.wheelTo.y, max * 0.85, dt);
      if (dist(u.x, u.y, u.wheelTo.x, u.wheelTo.y) < 25 || u.x < 30 || u.x > WW - 30 || u.y < 30 || u.y > WH - 30) u.wheelTo = null;
      return;
    }
    if (engaged && tgt) {
      const d = dist(u.x, u.y, tgt.x, tgt.y);
      const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      const ahead = Math.cos(angDiff(u.heading, a));
      const side = angDiff(u.heading, a) < 0 ? -1 : 1;
      const px = tgt.x - Math.sin(a) * side * 8 + Math.cos(a) * 20, py = tgt.y + Math.cos(a) * side * 8 + Math.sin(a) * 20;
      this.ride(u, px, py, max, dt);
      if (u.state === "idle" || u.state === "windup") u.wantFace = a;
      if (u.state === "idle" && u.cooldown <= 0 && d < u.w.reach + 26) this.startWindup(u, angDiff(u.heading, a) < 0 ? "L" : "R");
      if (d < 26 && ahead < 0 && u.rspeed > 40) {
        u.wheelTo = { x: clamp(u.x + Math.cos(u.heading) * 110, 40, WW - 40), y: clamp(u.y + Math.sin(u.heading) * 110, 40, WH - 40) };
        u.target = null; u.retarget = 0;
      }
      return;
    }
    const d = dist(u.x, u.y, u.slotX, u.slotY);
    if (d > 6) this.ride(u, u.slotX, u.slotY, Math.min(max * 0.7, d * 1.5), dt);
    else {
      this.ride(u, u.x + Math.cos(u.heading) * 30, u.y + Math.sin(u.heading) * 30, 0, dt);
      if (u.rspeed < 5) u.heading += clamp(angDiff(u.heading, u.slotFace), -dt * 1.5, dt * 1.5);
    }
  }

  nearestEnemy(u: Unit): Unit | null {
    let b: Unit | null = null, bd = 1e9;
    for (const e of this.units) {
      if (e.team === u.team || !e.active || !this.isVisibleTo(e, u)) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d < bd) { bd = d; b = e; }
    }
    return b;
  }

  chooseTarget(u: Unit, o?: Order): Unit | null {
    if (u.commander && this.hero.active && dist(u.x, u.y, this.hero.x, this.hero.y) < 140) return this.hero;
    const counts = new Map<Unit, number>();
    for (const f of this.units) if (f.team === u.team && f.active && f.target && f !== u) counts.set(f.target, (counts.get(f.target) || 0) + 1);
    let b: Unit | null = null, bs = 1e9;
    const pref = o?.targetSquad;
    for (const e of this.units) {
      if (e.team === u.team || !e.active || !this.isVisibleTo(e, u)) continue;
      let s = dist(u.x, u.y, e.x, e.y);
      const c = counts.get(e) || 0;
      if (!u.def.bow && c >= 2) s += 160 * (c - 1);
      s += c * 12;
      if (!u.def.bow && Math.abs(angDiff(u.slotFace, Math.atan2(e.y - u.y, e.x - u.x))) > 1.2) s += 30;   // walka w linii: przeciwnik przed sobą
      if (pref != null && e.squad === pref) s -= 400;
      if (u.def.bow) {
        // nie strzelaj w zwarcie, w którym walczą nasi
        for (const f of this.units) if (f.team === u.team && f.active && dist(f.x, f.y, e.x, e.y) < 30) { s += 600; break; }
      }
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
      const r = o.mounted ? 18 : 12;
      const ox = u.x - o.x, oy = u.y - o.y, od = Math.hypot(ox, oy);
      if (od < r && od > 0.01) { const k = ((r - od) / r) * (o.team === u.team ? 1.2 : 0.6); sx += (ox / od) * k; sy += (oy / od) * k; }
    }
    for (const ob of this.obstacles) {
      if (!ob.r) continue;
      const ox = u.x - ob.x, oy = u.y - ob.y, od = Math.hypot(ox, oy);
      if (od < ob.r + 14 && od > 0.01) { const k = (ob.r + 14 - od) / 14; sx += (ox / od) * k * 1.5; sy += (oy / od) * k * 1.5; }
    }
    const vx = (dx + sx) * sp, vy = (dy + sy) * sp;
    u.vx = lerp(u.vx, vx, clamp(dt * 6, 0, 1));
    u.vy = lerp(u.vy, vy, clamp(dt * 6, 0, 1));
    u.moving = sp > 5;
  }

  // Generał nieumarłych: linia naciera, skrzydło oskrzydla, łucznicy wspierają, Rycerz poluje na bohatera.
  enemyGeneral() {
    const pc = this.centroid(0);
    const line = this.eorders[1], wing = this.eorders[2], arc = this.eorders[3], dko = this.eorders[5];
    const lc = this.centroid(1, 1);
    let nearest = 1e9;
    for (const u of this.units) if (u.team === 1 && u.active && u.squad === 1)
      for (const p of this.units) if (p.team === 0 && p.active && !p.hidden) nearest = Math.min(nearest, dist(u.x, u.y, p.x, p.y));
    if (!this.enemyCharge) {
      const a = Math.atan2(pc.y - line.ay, pc.x - line.ax);
      line.ax += Math.cos(a) * 9; line.ay += Math.sin(a) * 9;
      if (nearest < 110 || this.time > 70) {
        this.enemyCharge = true; line.mode = "charge";
        this.say("Nieumarli ruszają do szarży!", PAL.purpleL, true);
        this.sfx.wail();
      }
    }
    if (wing.mode === "hold" && !wing.flank) {
      if (this.time > 14) {
        const a = Math.atan2(pc.y - lc.y, pc.x - lc.x);
        let up = 0; for (const p of this.units) if (p.team === 0 && p.active) up += p.y < pc.y ? 1 : -1;
        const side = up > 0 ? 1 : -1;
        wing.mode = "flank";
        wing.flank = { x: clamp(pc.x + Math.cos(a) * 40 - Math.sin(a) * side * 150, 30, WW - 30), y: clamp(pc.y + Math.sin(a) * 40 + Math.cos(a) * side * 150, 30, WH - 30) };
        this.say("Część szkieletów obchodzi nasze skrzydło!", PAL.purpleL);
      } else { wing.ax = line.ax; wing.ay = line.ay - 120; }
    }
    const back = Math.atan2(lc.y - pc.y, lc.x - pc.x);
    let cavNear = false;
    for (const p of this.units) if (p.team === 0 && p.active && p.mounted && dist(p.x, p.y, arc.ax, arc.ay) < 90) cavNear = true;
    arc.ax = clamp(lc.x + Math.cos(back) * (cavNear ? 120 : 60), 30, WW - 30);
    arc.ay = clamp(lc.y + Math.sin(back) * (cavNear ? 120 : 60), 30, WH - 30);
    if (this.dk.active) {
      if (this.dk.hp < this.dk.def.hp * 0.3 && this.dkRetreatT === 0) { this.dkRetreatT = 10; this.say("Ranny Rycerz Śmierci cofa się za linię!", PAL.purpleL); }
      if (this.dkRetreatT > 0.001) { dko.mode = "hold"; dko.ax = arc.ax; dko.ay = arc.ay; dko.face = undefined; }
      else if (this.enemyCharge || dist(this.dk.x, this.dk.y, this.hero.x, this.hero.y) < 130) dko.mode = "charge";
      else { dko.mode = "hold"; dko.ax = lc.x + Math.cos(back) * 16; dko.ay = lc.y + Math.sin(back) * 16; }
    }
    if (this.eorders[4].mode === "ambush" && this.time > 85) { const g = this.units.find((u) => u.team === 1 && u.squad === 4 && u.active); if (g) this.reveal(g); }
  }

  // ---------- Efekty ----------
  blood(x: number, y: number, n: number, src: Unit | null, heavy = false) {
    const a0 = src ? Math.atan2(y - src.y + 9, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + rr(-0.8, 0.8), sp = rr(25, heavy ? 150 : 110);
      this.parts.push({ x, y: y + 10, z: 10, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rr(20, 95), life: 2, max: 2, col: pick([PAL.blood, PAL.bloodL, PAL.bloodD, PAL.blood]), kind: "blood" });
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
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rr(-4, 4), y, z: 1, vx: rr(-25, 25), vy: rr(-10, 10), vz: rr(5, 20), life: 0.6, max: 0.6, col: PAL.dirtL, kind: "dust" });
  }
  streak(x: number, y: number, a: number, len: number) {
    for (let i = 0; i < len; i++) {
      const px = x + Math.cos(a) * (i + 3) + rr(-1, 1), py = y + Math.sin(a) * (i + 3) * 0.7 + rr(-0.5, 0.5);
      this.dg.fillStyle = i < len * 0.6 ? PAL.blood : PAL.bloodD;
      if (chance(0.85)) this.dg.fillRect(Math.round(px), Math.round(py), 1, 1);
      if (i % 3 === 0 && chance(0.5)) this.dg.fillRect(Math.round(px), Math.round(py + 1), 1, 1);
    }
  }
  pool(x: number, y: number, r: number) {
    const g = this.dg;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r * 1.5; xx <= r * 1.5; xx++) {
      if ((xx * xx) / 2.25 + yy * yy <= r * r * rr(0.6, 1)) { g.fillStyle = chance(0.8) ? PAL.bloodD : PAL.blood; g.fillRect(Math.round(x + xx), Math.round(y + yy + 1), 1, 1); }
    }
  }
  floater(x: number, y: number, text: string, col: string, force = false) { if (force || this.settings.damageNumbers) this.floaters.push({ x, y, text, col, t: 0.9 }); }

  updateParticles(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.kind === "flash" || p.kind === "ring") continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= (p.kind === "soul" ? -20 : 240) * dt;
      if (p.kind === "dust" || p.kind === "soul") { p.vx *= 0.92; p.vy *= 0.92; }
      if (p.z <= 0 && (p.kind === "blood" || p.kind === "bone")) {
        this.dg.fillStyle = p.col;
        this.dg.fillRect(Math.round(p.x), Math.round(p.y), p.kind === "blood" && chance(0.5) ? 2 : 1, 1);
        p.life = 0;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.t -= dt; f.y -= 14 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    for (const c of this.corpses) if (c.t < 1) {
      c.t = Math.min(1, c.t + dt / 0.45);
      if (c.t >= 1 && !c.pooled) { c.pooled = true; if (!c.undead) this.pool(c.x, c.y, 4 + rnd() * 3); this.dust(c.x, c.y, 6); }
    }
  }

  // ---------- Pętla ----------
  update(realDt: number) {
    this.real += realDt;
    for (const l of this.log) l.t -= realDt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.banner) { this.banner.t -= realDt; if (this.banner.t <= 0) this.banner = null; }
    if (this.hurtFlash > 0) this.hurtFlash -= realDt;
    for (const p of this.preview) p.t -= realDt;
    this.preview = this.preview.filter((p) => p.t > 0);

    // sprężyna kamery: wolniejsze, cięższe drganie
    const k = 300, damp = Math.pow(0.004, realDt);
    this.shakeVX -= this.shakeX * k * realDt; this.shakeVY -= this.shakeY * k * realDt;
    this.shakeVX *= damp; this.shakeVY *= damp;
    this.shakeX += this.shakeVX * realDt; this.shakeY += this.shakeVY * realDt;
    this.rumble = Math.max(0, this.rumble - realDt * 14);

    this.updateCamera(realDt);
    let fighting = 0;
    for (const u of this.units) if (u.active && (u.state === "windup" || u.state === "strike")) fighting++;
    this.intensity = this.phase === "fight" ? clamp(fighting / 14, 0, 1) : 0;
    this.sfx.tick(realDt, this.intensity);
    if (this.phase !== "fight" || this.paused) return;

    // zamrożenie klatki: świat stoi, ale naciśnięcia klawiszy nie mogą przepaść
    if (this.hitstop > 0) { this.hitstop -= realDt; this.handleOrders(); this.updateHero(0); return; }
    if (this.slowT > 0) this.slowT -= realDt;
    this.slowmo = this.cmdOpen;
    const scale = this.slowmo ? 0.3 : this.slowT > 0 ? 0.35 : 1;
    const dt = Math.min(realDt, 0.05) * scale;
    this.time += dt;
    if (this.dkRetreatT > 0.001) this.dkRetreatT = Math.max(0.0005, this.dkRetreatT - dt);

    this.handleOrders();
    this.updateHero(dt);

    this.relayoutT -= dt;
    if (this.relayoutT <= 0) { this.relayoutT = 0.4; this.enemyGeneral(); this.officerAI(); this.layoutAll(); this.moraleCheck(); }

    for (const u of this.units) {
      if (!u.active) continue;
      this.updateCombat(u, dt);
      if (!u.hero) this.updateAI(u, dt);
    }
    const h = this.hero;
    for (const u of this.units) {
      if (!u.active) continue;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (!u.mounted) {
        if (!u.hero && !u.moving) { u.vx *= Math.pow(0.03, dt); u.vy *= Math.pow(0.03, dt); }
        if (u.state === "stagger") { u.vx *= Math.pow(0.03, dt); u.vy *= Math.pow(0.03, dt); }
      }
      const speed = Math.hypot(u.vx, u.vy);
      const prev = Math.floor(u.anim);
      if (speed > 8) u.anim += dt * speed * (u.mounted ? 0.09 : 0.11);
      if (Math.floor(u.anim) !== prev && dist(u.x, u.y, h.x, h.y) < 140) {
        const s = this.vol(u.x);
        if (u.mounted) this.sfx.hoof(s.v * (u.hero ? 1 : 0.5), s.pan);
        else if (u.hero) this.sfx.step(0.8, 1);
      }
      if (!u.def.undead && u.hp < u.def.hp * 0.55) {   // krwawienie rannych
        u.bleedT -= dt;
        if (u.bleedT <= 0) { u.bleedT = rr(0.25, 0.6); this.dg.fillStyle = chance(0.6) ? PAL.blood : PAL.bloodD; this.dg.fillRect(Math.round(u.x + rr(-2, 2)), Math.round(u.y + rr(-1, 1)), 1, 1); }
      }
      if (!u.fleeing) { u.x = clamp(u.x, 6, WW - 6); u.y = clamp(u.y, 14, WH - 6); }
    }
    this.collide();
    this.updateArrows(dt);
    this.updateParticles(dt);
    this.moanT -= dt;
    if (this.moanT <= 0) {
      this.moanT = rr(2.5, 6);
      const z = this.units.filter((u) => u.team === 1 && u.active && !u.hidden && dist(u.x, u.y, h.x, h.y) < 200);
      if (z.length) { const u = pick(z); const s = this.vol(u.x); this.sfx.moan(s.v * 0.8, s.pan); }
    }
    this.checkEnd();
  }

  moraleCheck() {
    for (const sq of this.liveSquads()) {
      const list = this.squadUnits(sq);
      const m = list.reduce((s, u) => s + clamp(u.morale, 0, 100), 0) / list.length;
      const lvl = m < 25 ? 2 : m < 45 ? 1 : 0;
      if ((this.waver[sq] || 0) < lvl) this.say(lvl === 2 ? `${SQUAD_NAMES[sq]} łamie się!` : `${SQUAD_NAMES[sq]} się chwieje!`, PAL.redL, lvl === 2);
      this.waver[sq] = lvl;
    }
  }
  squadMorale(sq: number) {
    const list = this.squadUnits(sq);
    return list.length ? list.reduce((s, u) => s + clamp(u.morale, 0, 100), 0) / list.length : 0;
  }

  collide() {
    const act = this.units.filter((u) => u.active);
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 18 || Math.abs(dy) > 18) continue;
      const d = Math.hypot(dx, dy), m = a.radius + b.radius - 1;
      if (d < m && d > 0.001) {
        // tratowanie: rozpędzony koń przewraca piechura wroga
        for (const [r, f] of [[a, b], [b, a]] as [Unit, Unit][]) {
          if (r.mounted && !f.mounted && r.team !== f.team && r.rspeed > 55 && f.trampleT <= 0 && !f.def.poise && f.active) {
            f.trampleT = 0.8;
            const k = r.rspeed / r.maxRide;
            const s = this.vol(f.x);
            this.sfx.trample(s.v, s.pan);
            this.stagger(f, 1.0);
            this.push(f, r.x, r.y, 80);
            this.damage(f, 5 + 8 * k, r, false, "blunt", true);
            r.rspeed *= 0.45; r.horseHp -= 6;
            if (r.hero || f.hero) { this.hitstop = Math.max(this.hitstop, 0.09); this.kickCam(Math.cos(r.heading), Math.sin(r.heading), 1.6); }
          }
        }
        const push = (m - d) / 2, nx = dx / d, ny = dy / d;
        const wa = a.def.poise || a.mounted ? 0.25 : 1, wb = b.def.poise || b.mounted ? 0.25 : 1;
        a.x -= nx * push * wa; a.y -= ny * push * wa; b.x += nx * push * wb; b.y += ny * push * wb;
      }
    }
    for (const u of act) for (const o of this.obstacles) {
      if (!o.r) continue;
      const dx = u.x - o.x, dy = u.y - o.y;
      if (Math.abs(dx) > 20 || Math.abs(dy) > 20) continue;
      const d = Math.hypot(dx, dy), m = o.r + u.radius;
      if (d < m && d > 0.001) { u.x = o.x + (dx / d) * m; u.y = o.y + (dy / d) * m; if (u.mounted) u.rspeed *= 0.9; }
    }
  }

  checkEnd() {
    const foes = this.units.filter((u) => u.team === 1 && u.active).length;
    const ours = this.units.filter((u) => u.team === 0 && u.active).length;
    if (foes === 0) { this.phase = "end"; this.result = "win"; this.shout("Zwycięstwo!"); this.sfx.battleCry(1); this.cmdOpen = false; }
    else if (ours === 0) { this.phase = "end"; this.result = "lose"; this.shout("Klęska", PAL.redL); this.cmdOpen = false; }
  }

  updateCamera(dt: number) {
    const I = this.input;
    if (!this.hero.active) this.camFree = true;
    const sp = 280 * dt;
    if (this.camFree || this.cmdOpen) {
      if (I.held("ArrowLeft")) this.cam.x -= sp; if (I.held("ArrowRight")) this.cam.x += sp;
      if (I.held("ArrowUp")) this.cam.y -= sp; if (I.held("ArrowDown")) this.cam.y += sp;
      if (this.cmdOpen && this.hero.active) {
        const m = 8;
        if (I.mx < m) this.cam.x -= sp; if (I.mx > W - m) this.cam.x += sp;
        if (I.my < m) this.cam.y -= sp; if (I.my > H - m) this.cam.y += sp;
      }
      if (!this.hero.active) {
        if (I.held("KeyA")) this.cam.x -= sp; if (I.held("KeyD")) this.cam.x += sp;
        if (I.held("KeyW")) this.cam.y -= sp; if (I.held("KeyS")) this.cam.y += sp;
      }
    } else {
      const h = this.hero;
      const tx = h.x - W / 2 + (I.mx - W / 2) * 0.15, ty = h.y - (h.mounted ? 8 : 0) - H / 2 + (I.my - H / 2) * 0.15;
      this.cam.x = lerp(this.cam.x, tx, clamp(dt * 4.5, 0, 1));
      this.cam.y = lerp(this.cam.y, ty, clamp(dt * 4.5, 0, 1));
    }
    this.cam.x = clamp(this.cam.x, 0, WW - W); this.cam.y = clamp(this.cam.y, 0, WH - H);
  }

  // ---------- Rysowanie ----------
  render(g: CanvasRenderingContext2D) {
    const sx = Math.round(this.cam.x + this.shakeX + rr(-1, 1) * this.rumble * 0.5), sy = Math.round(this.cam.y + this.shakeY + rr(-1, 1) * this.rumble * 0.5);
    g.fillStyle = PAL.black; g.fillRect(0, 0, W, H);
    const gx = clamp(sx, 0, WW - W), gy = clamp(sy, 0, WH - H);
    g.drawImage(this.ground, gx, gy, W, H, gx - sx, gy - sy, W, H);
    g.drawImage(this.decals, gx, gy, W, H, gx - sx, gy - sy, W, H);
    const vis = (x: number, y: number, m = 40) => x > sx - m && x < sx + W + m && y > sy - m && y < sy + H + m;

    for (const c of this.corpses) if (vis(c.x, c.y)) this.drawCorpse(g, c, sx, sy);

    if (this.phase !== "end") for (const k of Object.keys(this.orders)) {
      const sq = Number(k), o = this.orders[sq];
      if (o.mode !== "hold" || !this.squadUnits(sq).length) continue;
      const fx = Math.round(o.ax - sx), fy = Math.round(o.ay - sy);
      g.globalAlpha = this.selected.includes(sq) || this.cmdOpen ? 0.9 : 0.3;
      g.fillStyle = PAL.ink; g.fillRect(fx - 1, fy - 12, 3, 13);
      g.fillStyle = PAL.wood; g.fillRect(fx, fy - 11, 1, 11);
      g.fillStyle = SQUAD_COLORS[sq]; g.fillRect(fx + 1, fy - 11, 6, 4);
      g.fillStyle = PAL.ink; g.fillRect(fx + 3, fy - 10, 1, 2);
      g.globalAlpha = 1;
    }
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
      pxLine(g, this.drag.sx - sx, this.drag.sy - sy, this.drag.ex - sx, this.drag.ey - sy, PAL.gold);
      for (const p of this.dragPlan(this.drag)) drawSlots(p.slots, SQUAD_COLORS[p.g], 0.95);
    }

    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const o of this.obstacles) if (vis(o.x, o.y, 50)) list.push({ y: o.y - (o.r ? 0 : 20), draw: () => g.drawImage(o.img, Math.round(o.x - sx - o.img.width / 2), Math.round(o.y - sy - o.img.height + 3)) });
    for (const u of this.units) if (u.alive && vis(u.x, u.y) && !(u.hidden && u.team === 1)) list.push({ y: u.y, draw: () => this.drawUnit(g, u, sx, sy) });
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
      if (p.kind === "flash") { g.fillStyle = PAL.white; g.fillRect(px - 3, py, 7, 1); g.fillRect(px, py - 3, 1, 7); g.fillRect(px - 1, py - 1, 3, 3); continue; }
      if (p.kind === "ring") {
        const k = 1 - p.life / p.max, r = Math.round((2 + k * 6) * p.vx);
        g.globalAlpha = 1 - k; g.fillStyle = p.col;
        for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillRect(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r * 0.7), 1, 1); }
        g.globalAlpha = 1; continue;
      }
      g.globalAlpha = p.kind === "dust" || p.kind === "soul" ? clamp((p.life / p.max) * 1.5, 0, 1) : 1;
      g.fillStyle = p.col;
      g.fillRect(px, py, 1, p.kind === "blood" && p.vz < 0 ? 2 : 1);
    }
    g.globalAlpha = 1;

    this.drawTells(g, sx, sy);
    for (const f of this.floaters) { g.globalAlpha = clamp(f.t * 2, 0, 1); pxText(g, f.text, Math.round(f.x - sx - textW(f.text) / 2), Math.round(f.y - sy), f.col); }
    g.globalAlpha = 1;

    // mgła (dwie warstwy) i popiół
    g.save();
    g.imageSmoothingEnabled = true;
    for (const [alpha, spd, par, scl] of [[0.13, 5, 0.6, 1.5], [0.08, 11, 0.9, 2.2]]) {
      g.globalAlpha = alpha;
      const fw = W * scl, fh = H * scl;
      const fo = (((this.real * spd + sx * par) % fw) + fw) % fw, foy = (((sy * par) % fh) + fh) % fh;
      for (const ox of [0, fw]) for (const oy of [0, fh]) g.drawImage(this.fog, ox - fo, oy - foy, fw, fh);
    }
    g.restore();
    for (const a of this.ash) {
      const ax = (((a.x - sx * a.p * 0.5 + this.real * a.s * 0.8) % W) + W) % W;
      const ay = (((a.y - sy * a.p * 0.5 + this.real * a.s) % H) + H) % H;
      g.globalAlpha = 0.35 + a.p * 0.45; g.fillStyle = a.c;
      g.fillRect(Math.round(ax + Math.sin(this.real + a.x) * 2), Math.round(ay), 1, a.p > 0.85 ? 2 : 1);
    }
    g.globalAlpha = 1;

    g.globalCompositeOperation = "multiply";
    g.fillStyle = this.cmdOpen ? "#a59bb4" : "#d6cdd8";
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
    if (this.cmdOpen) for (const u of this.units) {
      if (u.team !== 0 || u.hero || !u.active) continue;
      if (!this.selected.includes(u.squad) && !u.picked) continue;
      const x = Math.round(u.x - sx), y = Math.round(u.y - sy);
      g.fillStyle = u.picked ? PAL.white : SQUAD_COLORS[u.squad];
      g.fillRect(x - 3, y + 1, 7, 1); g.fillRect(x - 4, y, 1, 1); g.fillRect(x + 4, y, 1, 1);
    }
    if (this.box) {
      const x0 = Math.round(Math.min(this.box.sx, this.box.ex) - sx), y0 = Math.round(Math.min(this.box.sy, this.box.ey) - sy);
      const bw = Math.round(Math.abs(this.box.ex - this.box.sx)), bh = Math.round(Math.abs(this.box.ey - this.box.sy));
      g.fillStyle = "rgba(240,233,218,0.12)"; g.fillRect(x0, y0, bw, bh);
      g.fillStyle = PAL.white; g.fillRect(x0, y0, bw, 1); g.fillRect(x0, y0 + bh, bw, 1); g.fillRect(x0, y0, 1, bh); g.fillRect(x0 + bw, y0, 1, bh);
    }
    if (this.phase === "fight") this.drawCrosshair(g);
  }

  drawCrosshair(g: CanvasRenderingContext2D) {
    const mx = Math.round(this.input.mx), my = Math.round(this.input.my), h = this.hero;
    if (h.active && h.usingBow && !this.cmdOpen) {
      const d = dist(h.x - this.cam.x, h.y - 9 - this.cam.y, mx, my);
      const r = Math.max(2, Math.round(this.bowSpread() * d));
      g.fillStyle = h.drawT >= 0.98 ? PAL.gold : PAL.white;
      for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillRect(Math.round(mx + Math.cos(a) * r), Math.round(my + Math.sin(a) * r), 1, 1); }
      g.fillRect(mx, my, 1, 1);
      return;
    }
    const col = this.cmdOpen ? PAL.gold : PAL.white;
    const c = (x: number, y: number, dx: number, dy: number) => {
      g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, 3, 3); g.fillRect(x + dx - 1, y - 1, 3, 3); g.fillRect(x - 1, y + dy - 1, 3, 3);
      g.fillStyle = col; g.fillRect(x, y, 1, 1); g.fillRect(x + dx, y, 1, 1); g.fillRect(x, y + dy, 1, 1);
    };
    c(mx - 4, my - 4, 1, 1); c(mx + 4, my - 4, -1, 1); c(mx - 4, my + 4, 1, -1); c(mx + 4, my + 4, -1, -1);
    g.fillStyle = col; g.fillRect(mx, my, 1, 1);
  }

  drawCorpse(g: CanvasRenderingContext2D, c: Corpse, sx: number, sy: number) {
    if (c.bones && c.t >= 1) { g.drawImage(BONES, Math.round(c.x - sx - 7), Math.round(c.y - sy - 5)); return; }
    const img = c.img;
    if (c.horse) {
      g.save(); g.translate(Math.round(c.x - sx), Math.round(c.y - sy));
      if (c.flip) g.scale(-1, 1);
      g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2), img.width, Math.round(img.height * 0.6));
      g.restore();
      return;
    }
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
    const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
    const easeIn = (p: number) => p * p;
    switch (u.state) {
      case "windup": {
        const full = u.hero ? w.windup * 0.8 : w.windup;
        const e = easeOut(clamp(u.t / full, 0, 1));
        if (u.dir === "O") return { a: f + angDiff(f, -Math.PI / 2 - 0.3 * Math.sign(Math.cos(f))) * e, ext: -2 * e };
        if (u.dir === "T") return { a: f, ext: -7 * e };
        return { a: f + 0.9 + angDiff(f + 0.9, f + side(u.dir) * 2.3) * e, ext: -1 * e };
      }
      case "strike": {
        const p = easeIn(clamp(u.t / w.strike, 0, 1));
        if (u.dir === "O") { const from = -Math.PI / 2 - 0.3 * Math.sign(Math.cos(f)); return { a: from + angDiff(from, f + 0.25) * p, ext: 3 * p }; }
        if (u.dir === "T") return { a: f, ext: lerp(-7, 9, p) };
        return { a: f + side(u.dir) * lerp(2.3, -1.7, p), ext: 1 };
      }
      case "recover": {
        const p = clamp(u.t / w.recover, 0, 1);
        if (u.dir === "T") return { a: f, ext: lerp(9, 0, p) };
        const end = u.dir === "O" ? f + 0.25 : f + side(u.dir) * -1.7;
        return { a: end + angDiff(end, f + 0.9) * easeOut(p), ext: 0 };
      }
      case "kick": return { a: f + 1.3, ext: 0 };
      case "stagger": return { a: f + 1.8, ext: -1 };
      default: return { a: f + 0.9 + Math.sin(this.real * 1.5 + u.id) * 0.05, ext: 0 };
    }
  }

  dirIndex(a: number): [number, boolean] {
    const c = Math.cos(a), s = Math.sin(a);
    if (Math.abs(c) > Math.abs(s) * 0.9) return [2, c < 0];
    return [s > 0 ? 0 : 1, false];
  }

  drawUnit(g: CanvasRenderingContext2D, u: Unit, sx: number, sy: number) {
    if (u.state === "down") {
      this.drawCorpse(g, { x: u.x, y: u.y, img: u.spr.frames[0][0], flip: false, rot: 1, undead: false, bones: false, t: 1, pooled: true }, sx, sy);
      return;
    }
    const alpha = u.hidden ? 0.45 : 1;
    g.globalAlpha = alpha;
    const [dirI, flip] = this.dirIndex(u.face);
    const moving = Math.hypot(u.vx, u.vy) > 8;
    const frame = moving && !u.mounted ? 1 + (Math.floor(u.anim) % 2) : 0;
    const img = u.spr.frames[dirI][frame];
    let lean = 0;
    if (u.state === "windup") lean = -2;
    else if (u.state === "strike") lean = 2;
    else if (u.state === "recover") lean = u.t < 0.12 ? 1 : 0;
    const c = Math.cos(u.face), s = Math.sin(u.face);
    const bob = moving && !u.mounted && Math.floor(u.anim) % 2 === 1 ? -1 : 0;
    const bx = Math.round(u.x - sx), by = Math.round(u.y - sy);
    const x = Math.round(u.x - sx + c * lean), y = Math.round(u.y - sy + s * lean * 0.6);

    g.fillStyle = "rgba(13,11,14,0.45)";
    const sw = u.mounted ? 11 : u.spr.w > 16 ? 6 : 4;
    g.fillRect(bx - sw, by - 1, sw * 2 + 1, 2); g.fillRect(bx - sw + 1, by - 2, sw * 2 - 1, 1);
    if (u.hero) { g.fillStyle = PAL.gold; g.fillRect(bx - 2, by + 1, 5, 1); }

    let riderY = 0;
    if (u.mounted && u.horse) {
      const [hd, hflip] = this.dirIndex(u.heading);
      const hf = u.rspeed > 10 ? Math.floor(u.anim) % 4 : 0;
      const himg = u.horse.frames[hd][hf];
      const hx = bx - Math.floor(himg.width / 2), hy = by - himg.height + 2 + (u.rspeed > 60 && hf % 2 ? -1 : 0);
      if (hflip) { g.save(); g.translate(hx + himg.width, hy); g.scale(-1, 1); g.drawImage(himg, 0, 0); g.restore(); } else g.drawImage(himg, hx, hy);
      if (u.horseHp < u.horseMax * 0.6) { g.fillStyle = PAL.blood; g.fillRect(bx + (hflip ? 3 : -4), by - 9, 1, 2); g.fillRect(bx + (hflip ? -2 : 2), by - 11, 1, 1); }
      riderY = hd === 2 ? -9 : -7;
    }

    const hand = { x: x + c * 3, y: y - 10 + s * 2 + bob + riderY };
    const wa = this.weaponAngle(u);
    const drawGear = () => this.drawGear(g, u, hand, wa);
    if (dirI === 1) drawGear();
    const off = u.state === "stagger" ? Math.round(Math.sin(u.t * 50) * 1) : 0;
    const ix = x - Math.floor(img.width / 2) + off, iy = y - img.height + 1 + bob + riderY;
    const srcH = u.mounted ? 16 : img.height;    // jeździec: tylko górna część postaci
    const draw = (im: HTMLCanvasElement) => {
      if (flip) { g.save(); g.translate(ix + im.width, iy); g.scale(-1, 1); g.drawImage(im, 0, 0, im.width, srcH, 0, 0, im.width, srcH); g.restore(); }
      else g.drawImage(im, 0, 0, im.width, srcH, ix, iy, im.width, srcH);
    };
    draw(img);
    if (!u.def.undead && u.hp < u.def.hp) {   // rany na ciele
      const n = Math.floor((1 - u.hp / u.def.hp) * 7);
      g.fillStyle = PAL.blood;
      for (let i = 0; i < n; i++) { const hs = hashInt(u.id * 13 + i); g.fillRect(ix + 4 + (hs % 8), iy + 9 + ((hs >> 4) % 6), 1, (hs >> 8) % 3 === 0 ? 2 : 1); }
    }
    if (u.flash > 0) { g.globalAlpha = alpha * clamp(u.flash / 0.08, 0, 1) * 0.8; draw(u.spr.white[dirI][frame]); g.globalAlpha = alpha; }
    if (u.decay) { g.globalAlpha = 0.25 + Math.sin(this.real * 6 + u.id) * 0.08; g.fillStyle = PAL.purple; g.fillRect(ix + 4, iy + 2, img.width - 8, Math.min(srcH, img.height) - 4); g.globalAlpha = alpha; }
    if (dirI !== 1) drawGear();

    if (u.officer) {   // proporzec na plecach
      const px = ix + (flip ? 11 : 4), py = iy - 6;
      g.fillStyle = PAL.ink; g.fillRect(px - 1, py - 1, 3, 12);
      g.fillStyle = PAL.wood; g.fillRect(px, py, 1, 11);
      g.fillStyle = SQUAD_COLORS[u.squad]; g.fillRect(px + (flip ? -5 : 1), py, 5, 3); g.fillRect(px + (flip ? -4 : 1), py + 3, 3, 1);
    }
    if (u.fleeing) {   // biała flaga nad uciekającym
      const px = bx, py = by - img.height - 8 + riderY;
      g.fillStyle = PAL.ink; g.fillRect(px - 1, py - 1, 7, 6);
      g.fillStyle = PAL.white; g.fillRect(px, py, 5, 3);
      g.fillStyle = PAL.wood; g.fillRect(px - 1, py, 1, 6);
    }
    g.globalAlpha = 1;

    if (!u.hero && u.hp < u.def.hp && dist(u.x, u.y, this.hero.x, this.hero.y) < 110) {
      const w = u.commander ? 18 : 10, k = clamp(u.hp / u.def.hp, 0, 1);
      const hx = bx - Math.round(w / 2), hy = by - img.height - 3 + riderY;
      g.fillStyle = PAL.ink; g.fillRect(hx - 1, hy - 1, w + 2, 4);
      g.fillStyle = u.team === 0 ? PAL.redL : u.commander ? PAL.purpleL : PAL.bone;
      g.fillRect(hx, hy, Math.ceil(w * k), 2);
    }
  }

  drawGear(g: CanvasRenderingContext2D, u: Unit, hand: V, wa: { a: number; ext: number }) {
    const w = u.w;
    const meleeOnly = u.team === 0 && this.orders[u.squad]?.meleeOnly;
    if (u.usingBow && (u.hero || (u.def.bow && u.state === "idle" && u.ammo > 0 && !meleeOnly))) {
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
      g.fillStyle = PAL.ink; g.fillRect(sxp - 3, syp - 4, 7, 8); g.fillRect(sxp - 2, syp + 4, 5, 1);
      g.fillStyle = u.team === 0 ? PAL.red : PAL.dusk; g.fillRect(sxp - 2, syp - 3, 5, 6); g.fillRect(sxp - 1, syp + 3, 3, 1);
      g.fillStyle = PAL.steel; g.fillRect(sxp - 2, syp - 3, 5, 1);
      g.fillStyle = u.hero ? PAL.gold : SQUAD_COLORS[u.squad] || PAL.redL; g.fillRect(sxp, syp - 2, 1, 4); g.fillRect(sxp - 1, syp - 1, 3, 1);
      g.fillStyle = PAL.steelL; g.fillRect(sxp, syp - 1, 1, 1);
    }
    if (w.claws) {
      if (u.state === "strike" || u.state === "windup") {
        const ex = Math.cos(wa.a), ey = Math.sin(wa.a);
        for (let i = 0; i < 3; i++) pxLine(g, hand.x + ex * 2 - ey * (i - 1), hand.y + ey * 2 + ex * (i - 1), hand.x + ex * 5 - ey * (i - 1), hand.y + ey * 5 + ex * (i - 1), PAL.boneHi);
      }
      return;
    }
    const ex = Math.cos(wa.a), ey = Math.sin(wa.a);
    const bx = hand.x + Math.cos(u.face) * wa.ext, by = hand.y + Math.sin(u.face) * wa.ext;
    const tipx = bx + ex * w.len, tipy = by + ey * w.len;
    if (u.state === "strike" && u.dir !== "T") {
      u.trail.push(wa.a);
      if (u.trail.length > 6) u.trail.shift();
      g.globalAlpha = 0.45;
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
    if (u.bloodT > 0) { g.fillStyle = PAL.blood; for (let i = 0; i < 4; i++) g.fillRect(Math.round(bx + ex * (w.len - i * 2 - 1)), Math.round(by + ey * (w.len - i * 2 - 1)), 1, 1); }
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

  // Mniej informacji: tylko ciosy wymierzone w bohatera i garda przeciwnika, na którego patrzysz.
  drawTells(g: CanvasRenderingContext2D, sx: number, sy: number) {
    const h = this.hero;
    if (!h.active || this.cmdOpen) return;
    let focus: Unit | null = null, fd = 1e9;
    for (const u of this.units) {
      if (!u.active || u.team === 0 || u.hidden) continue;
      const d = dist(u.x, u.y, h.x, h.y);
      if (d < 42 && Math.abs(angDiff(h.face, Math.atan2(u.y - h.y, u.x - h.x))) < 0.8 && d < fd) { fd = d; focus = u; }
      const top = u.y - sy - (u.commander ? 31 : u.mounted ? 32 : 26);
      if (u.state === "windup" && u.target === h && d < 60) dirGlyph(g, u.dir, Math.round(u.x - sx), Math.round(top), PAL.bloodL, true);
    }
    if (focus && focus.guard && focus.state !== "windup") dirGlyph(g, focus.guard, Math.round(focus.x - sx), Math.round(focus.y - sy - (focus.commander ? 31 : 26)), PAL.steelL, false);
    if (focus && !h.usingBow && h.state === "idle" && !this.settings.gesture && !h.mounted) {   // strona następnego cięcia
      const side = h.nextSide === "L" ? -1 : 1;
      const px = Math.round(h.x - sx + Math.cos(h.face + side * 1.4) * 9), py = Math.round(h.y - sy - 10 + Math.sin(h.face + side * 1.4) * 6);
      g.fillStyle = PAL.ink; g.fillRect(px - 1, py - 1, 3, 3);
      g.fillStyle = PAL.goldD; g.fillRect(px, py, 1, 1);
    }
    if (this.settings.gesture && !h.usingBow) dirGlyph(g, h.state === "windup" ? h.dir : this.loadDir, Math.round(h.x - sx), Math.round(h.y - sy - 26), h.state === "windup" ? PAL.gold : PAL.goldD, h.state === "windup");
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

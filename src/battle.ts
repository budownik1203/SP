// Bitwa: symulacja walki, AI, rozkazy, efekty i rysowanie.

const WW = 1200, WH = 760;               // rozmiar pola bitwy w pikselach
type State = "idle" | "windup" | "strike" | "recover" | "stagger" | "kick" | "down" | "dead" | "fled";
type Group = "inf" | "arch" | "hero" | "cmd" | "skel" | "skelArch";
type Mode = "hold" | "follow" | "charge";

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
  }
  get alive() { return this.state !== "dead" && this.state !== "fled"; }
  get active() { return this.alive && this.state !== "down"; }
  get w() { return WEAPONS[this.weaponKey]; }
  get usingBow() { return this.hero ? HERO_LOADOUTS[this.loadout].bow : !!this.def.bow; }
}

interface Arrow { x: number; y: number; vx: number; vy: number; team: number; src: Unit; dmg: number; age: number; travel: number; dist: number; done: boolean; }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; col: string; kind: "blood" | "spark" | "dust" | "bone"; }
interface Corpse { x: number; y: number; kind: BodyKind; flip: boolean; rot: number; undead: boolean; }
interface Obstacle { x: number; y: number; r: number; img: HTMLCanvasElement; }
interface Floater { x: number; y: number; text: string; col: string; t: number; }
interface Order { mode: Mode; ax: number; ay: number; formation: Formation; fire: boolean; }

class Battle {
  units: Unit[] = [];
  hero: Unit;
  dk: Unit;
  arrows: Arrow[] = [];
  parts: Particle[] = [];
  corpses: Corpse[] = [];
  obstacles: Obstacle[] = [];
  bushes: { x: number; y: number }[] = [];
  floaters: Floater[] = [];
  ground: HTMLCanvasElement;
  decals: HTMLCanvasElement;
  dg: CanvasRenderingContext2D;
  vignette: HTMLCanvasElement;

  orders: Record<"inf" | "arch", Order>;
  selected: ("inf" | "arch")[] = ["inf", "arch"];
  enemyAnchor: V = { x: 930, y: 380 };
  enemyCharge = false;

  cam: V = { x: 0, y: 0 };
  camFree = false;
  shake = 0;
  hitstop = 0;
  slowmo = false;
  hurtFlash = 0;
  time = 0;
  phase: "deploy" | "fight" | "end" = "deploy";
  result: "win" | "lose" | null = null;
  log: { text: string; t: number; col?: string }[] = [];
  banner: { text: string; t: number; col: string } | null = null;
  loadDir: Dir = "R";
  paused = false;

  constructor(public input: Input, public sfx: Sfx) {
    this.makeTerrain();
    this.spawn();
  }

  // ---------- Teren ----------
  makeTerrain() {
    const [g, gc] = mkCanvas(WW, WH);
    const im = gc.createImageData(WW, WH);
    const rgb = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
    const grass = [PAL.grassD, PAL.grass, PAL.grass, PAL.grassL, PAL.moss].map(rgb);
    const dirt = [PAL.dirtD, PAL.dirt, PAL.dirt, PAL.dirtL].map(rgb);
    const hash = (x: number, y: number) => { let h = (x * 374761393 + y * 668265263) ^ 0x5bd1e995; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
    const vnoise = (x: number, y: number, s: number) => {
      const xi = Math.floor(x / s), yi = Math.floor(y / s), fx = x / s - xi, fy = y / s - yi;
      const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
      const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
      return lerp(lerp(a, b, sx), lerp(c, d, sx), sy);
    };
    const off = rnd() * 1000;
    for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) {
      const n = vnoise(x + off, y, 48) * 0.6 + vnoise(x, y + off, 12) * 0.3 + hash(x, y) * 0.25;
      const roadY = 380 + Math.sin((x + off) / 160) * 60 + Math.sin(x / 47) * 6;
      const rd = Math.abs(y - roadY) - 16 - vnoise(x, y, 10) * 10;
      let col: number[];
      if (rd < 0) col = dirt[clamp(Math.floor((n - 0.1) * 4), 0, 3)];
      else if (rd < 4 && hash(x, y) < 0.5) col = dirt[1];
      else col = grass[clamp(Math.floor((n - 0.05) * 5), 0, 4)];
      const k = (y * WW + x) * 4;
      im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
    }
    gc.putImageData(im, 0, 0);
    // źdźbła trawy i kamyki
    for (let i = 0; i < 2600; i++) {
      const x = rr(0, WW), y = rr(0, WH);
      gc.fillStyle = chance(0.5) ? PAL.grassL : PAL.moss;
      gc.fillRect(x | 0, y | 0, 1, 2); gc.fillRect((x | 0) + 1, (y | 0) - 1, 1, 2);
    }
    for (let i = 0; i < 260; i++) { gc.fillStyle = chance(0.5) ? PAL.stone : PAL.slate; gc.fillRect(rr(0, WW) | 0, rr(0, WH) | 0, 2, 1); }
    this.ground = g;
    const [d, dg] = mkCanvas(WW, WH);
    this.decals = d; this.dg = dg;

    // drzewa i skały
    const place = (n: number, img: HTMLCanvasElement, r: number, avoidCenter: boolean) => {
      for (let i = 0; i < n; i++) {
        for (let tries = 0; tries < 30; tries++) {
          const x = rr(30, WW - 30), y = rr(30, WH - 20);
          if (avoidCenter && y > 250 && y < 520 && x > 180 && x < 1020 && !chance(0.12)) continue;
          if (this.obstacles.some((o) => dist(o.x, o.y, x, y) < o.r + r + 18)) continue;
          this.obstacles.push({ x, y, r, img });
          break;
        }
      }
    };
    place(26, TREE, 7, true);
    place(12, ROCK, 6, true);
    for (let i = 0; i < 40; i++) this.bushes.push({ x: rr(0, WW), y: rr(0, WH) });

    // winieta
    const [v, vg] = mkCanvas(W, H);
    const grd = vg.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.62);
    grd.addColorStop(0, "rgba(13,11,14,0)"); grd.addColorStop(1, "rgba(13,11,14,0.55)");
    vg.fillStyle = grd; vg.fillRect(0, 0, W, H);
    this.vignette = v;
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

  enemiesOf(team: number) { return this.units.filter((u) => u.team !== team && u.active); }
  centroid(team: number): V {
    let x = 0, y = 0, n = 0;
    for (const u of this.units) if (u.team === team && u.active) { x += u.x; y += u.y; n++; }
    return n ? { x: x / n, y: y / n } : { x: team === 0 ? 300 : 900, y: 380 };
  }

  // Rozmieszczenie miejsc w formacji
  layout(list: Unit[], ax: number, ay: number, face: number, f: Formation, snap = false) {
    const n = list.length;
    if (!n) return;
    const fx = Math.cos(face), fy = Math.sin(face);
    const rx = -fy, ry = fx;                     // wektor „w prawo” formacji
    const sp = f === "wall" ? 9 : f === "loose" ? 20 : 12;
    const cols = f === "wall" ? Math.min(n, 10) : f === "loose" ? Math.min(n, 6) : Math.min(n, 8);
    list.forEach((u, i) => {
      let lx: number, ly: number;
      if (f === "wedge") {
        let row = 0, idx = i;
        while (idx > row) { idx -= row + 1; row++; }
        lx = (idx - row / 2) * sp; ly = row * 11;
      } else {
        const row = Math.floor(i / cols), col = i % cols;
        const inRow = Math.min(cols, n - row * cols);
        lx = (col - (inRow - 1) / 2) * sp; ly = row * (f === "wall" ? 9 : 12);
      }
      u.slotX = clamp(ax + rx * lx - fx * ly, 10, WW - 10);
      u.slotY = clamp(ay + ry * lx - fy * ly, 10, WH - 10);
      u.slotFace = face;
      if (snap) { u.x = u.slotX; u.y = u.slotY; u.face = face; }
    });
  }

  layoutAll(snap = false) {
    const ec = this.centroid(1), pc = this.centroid(0);
    for (const g of ["inf", "arch"] as const) {
      const o = this.orders[g];
      const list = this.units.filter((u) => u.team === 0 && u.group === g && u.active && !u.fleeing);
      let ax = o.ax, ay = o.ay;
      if (o.mode === "follow" && this.hero.active) {
        const a = Math.atan2(ec.y - this.hero.y, ec.x - this.hero.x);
        const back = g === "inf" ? 22 : 52;
        ax = this.hero.x - Math.cos(a) * back; ay = this.hero.y - Math.sin(a) * back;
      }
      this.layout(list, ax, ay, Math.atan2(ec.y - ay, ec.x - ax), o.formation, snap);
    }
    // nieumarli
    const a = Math.atan2(pc.y - this.enemyAnchor.y, pc.x - this.enemyAnchor.x);
    const war = this.units.filter((u) => u.team === 1 && u.group === "skel" && u.active);
    this.layout(war, this.enemyAnchor.x, this.enemyAnchor.y, a, "line", snap);
    const arc = this.units.filter((u) => u.team === 1 && u.group === "skelArch" && u.active);
    this.layout(arc, this.enemyAnchor.x - Math.cos(a) * 55, this.enemyAnchor.y - Math.sin(a) * 55, a, "line", snap);
    if (this.dk.active) {
      this.dk.slotX = this.enemyAnchor.x + Math.cos(a) * 16; this.dk.slotY = this.enemyAnchor.y + Math.sin(a) * 16; this.dk.slotFace = a;
      if (snap) { this.dk.x = this.dk.slotX; this.dk.y = this.dk.slotY; this.dk.face = a; }
    }
  }

  say(text: string, col?: string) { this.log.push({ text, t: 5, col }); if (this.log.length > 6) this.log.shift(); }
  shout(text: string, col = PAL.gold) { this.banner = { text, t: 1.1, col }; }
  vol(x: number) { return this.sfx.spatial(x, this.cam); }

  // ---------- Rozkazy gracza ----------
  handleOrders() {
    const I = this.input;
    if (I.hit("Digit1")) { this.selected = ["inf"]; this.say("Wybrano: piechota"); }
    if (I.hit("Digit2")) { this.selected = ["arch"]; this.say("Wybrano: łucznicy"); }
    if (I.hit("Digit3")) { this.selected = ["inf", "arch"]; this.say("Wybrano: wszyscy"); }
    const names = this.selected.map((g) => (g === "inf" ? "Piechota" : "Łucznicy")).join(" i ");
    if (I.hit("KeyZ")) {
      const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
      this.selected.forEach((g, i) => {
        const o = this.orders[g]; o.mode = "hold";
        const ec = this.centroid(1), a = Math.atan2(ec.y - wy, ec.x - wx);
        const back = this.selected.length > 1 && g === "arch" ? 45 : 0;
        o.ax = wx - Math.cos(a) * back; o.ay = wy - Math.sin(a) * back;
      });
      this.say(`${names}: stać tutaj!`); this.sfx.shout(0.6);
    }
    if (I.hit("KeyX")) { this.selected.forEach((g) => (this.orders[g].mode = "follow")); this.say(`${names}: za mną!`); this.sfx.shout(0.6); }
    if (I.hit("KeyC")) { this.selected.forEach((g) => (this.orders[g].mode = "charge")); this.say(`${names}: do szarży!`, PAL.redL); this.sfx.shout(1); }
    if (I.hit("KeyV")) {
      const cur = this.orders[this.selected[0]].formation;
      const next = FORMATIONS[(FORMATIONS.indexOf(cur) + 1) % FORMATIONS.length];
      this.selected.forEach((g) => (this.orders[g].formation = next));
      this.say(`${names}: ${FORMATION_NAME[next].toLowerCase()}`);
    }
    if (I.hit("KeyB")) {
      const o = this.orders.arch; o.fire = !o.fire;
      this.say(o.fire ? "Łucznicy: strzelać wedle uznania!" : "Łucznicy: wstrzymać ogień!");
    }
  }

  // ---------- Bohater ----------
  updateHero(dt: number) {
    const h = this.hero, I = this.input;
    if (!h.active) return;
    const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
    h.face = Math.atan2(wy - (h.y - 8), wx - h.x);

    if (I.hit("Tab") && (h.state === "idle")) {
      h.loadout = (h.loadout + 1) % HERO_LOADOUTS.length;
      const L = HERO_LOADOUTS[h.loadout];
      h.weaponKey = L.weapon; h.hasShield = L.shield; h.drawT = 0;
      this.say(`Broń: ${L.name}`);
    }

    // kierunek ciosu z ruchu myszy
    const gst = I.gesture(170);
    if (Math.abs(gst.x) + Math.abs(gst.y) > 5) {
      this.loadDir = Math.abs(gst.x) > Math.abs(gst.y) ? (gst.x < 0 ? "L" : "R") : (gst.y < 0 ? "O" : "T");
    }

    // ruch
    let mx = 0, my = 0;
    if (I.held("KeyW")) my -= 1; if (I.held("KeyS")) my += 1;
    if (I.held("KeyA")) mx -= 1; if (I.held("KeyD")) mx += 1;
    const ml = Math.hypot(mx, my) || 1;
    const sprint = I.held("ShiftLeft") || I.held("ShiftRight");
    let sp = h.def.speed;
    const canSprint = sprint && h.stamina > 1 && (mx || my) && !h.blocking && h.state === "idle";
    if (canSprint) { sp *= 1.55; h.stamina -= 20 * dt; h.staminaWait = 0.6; }
    if (h.blocking) sp *= 0.55;
    if (h.state === "windup") sp *= 0.75;
    if (h.usingBow && h.drawT > 0) sp *= 0.5;
    if (h.state === "stagger" || h.state === "kick") sp *= 0.25;
    const tvx = (mx / ml) * sp, tvy = (my / ml) * sp;
    h.vx = lerp(h.vx, tvx, clamp(dt * 14, 0, 1)); h.vy = lerp(h.vy, tvy, clamp(dt * 14, 0, 1));
    h.moving = !!(mx || my);

    // wytrzymałość
    if (h.staminaWait > 0) h.staminaWait -= dt;
    else if (!h.blocking) h.stamina = Math.min(100, h.stamina + 24 * dt);
    h.stamina = Math.max(0, h.stamina);

    if (h.usingBow) { this.heroBow(dt, wx, wy); return; }

    // blok i zwód
    if (I.mPressed[2]) {
      if (h.state === "windup") { h.state = "idle"; h.t = 0; h.cooldown = 0.12; this.say("Zwód"); }
      else h.blockStart = this.time;
    }
    h.blocking = I.down[2] && (h.state === "idle" || h.state === "recover") && h.hasShield;
    if (h.blocking) h.staminaWait = Math.max(h.staminaWait, 0.3);

    // atak
    if (I.mPressed[0] && h.state === "idle" && !h.blocking && h.cooldown <= 0) {
      this.startWindup(h, this.loadDir);
    }
    if (h.state === "windup") {
      if (I.down[0]) h.hold += dt; else h.released = true;
    }

    // kopnięcie
    if (I.hit("KeyF") && (h.state === "idle" || h.state === "recover") && h.stamina >= 12) {
      h.state = "kick"; h.t = 0; h.hitDone = false; h.stamina -= 15; h.staminaWait = 0.5; h.blocking = false;
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
      }
      h.drawT = 0;
    }
  }

  // ---------- Walka wręcz ----------
  startWindup(u: Unit, dir: Dir) {
    u.state = "windup"; u.t = 0; u.dir = dir; u.hold = 0; u.released = false; u.hitDone = false;
    u.guard = null; u.guardT = 0; u.trail = [];
    // przeciwnicy w pobliżu mogą odczytać zamach i postawić gardę
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

  updateCombat(u: Unit, dt: number) {
    u.t += dt;
    if (u.cooldown > 0) u.cooldown -= dt;
    if (u.flash > 0) u.flash -= dt;
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
          this.sfx.swing(s.v * (u.hero ? 1 : 0.5), s.pan);
        }
        break;
      }
      case "strike":
        if (!u.hitDone && u.t >= w.strike * 0.55) { u.hitDone = true; this.meleeHit(u); }
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
    const cx = (a.x + d.x) / 2, cy = (a.y + d.y) / 2 - 9;

    // bohater: tarcza i parowanie
    if (d.hero && d.blocking && angFromD < 1.2) {
      if (this.time - d.blockStart <= this.parryWindow(d)) {
        this.sfx.parry();
        this.hitstop = Math.max(this.hitstop, 0.14); this.shake = Math.max(this.shake, 3);
        this.stagger(a, a.def.poise ? 0.55 : 0.85);
        this.push(a, d.x, d.y, 70);
        this.sparks(cx, cy, 16, PAL.gold);
        this.shout("Parowanie!");
        d.stamina = Math.min(100, d.stamina + 8);
        return;
      }
      const cost = 9 + w.dmg[dir] * 0.35;
      d.stamina -= cost; d.staminaWait = 0.6;
      this.sfx.thunk(1, s.pan);
      this.sparks(cx, cy, 5, PAL.steelL);
      this.push(d, a.x, a.y, 45);
      this.hitstop = Math.max(this.hitstop, 0.04);
      if (d.stamina <= 0) {
        d.stamina = 0; this.stagger(d, 0.7); this.shout("Garda przełamana!", PAL.redL);
      }
      return;
    }
    // AI: garda w kierunku ciosu
    if (!d.hero && d.guard === dir && angFromD < 1.6 && (d.state === "idle" || d.state === "recover")) {
      this.sfx.clang(s.v, s.pan);
      this.sparks(cx, cy, 8, PAL.steelL);
      if (a.hero) { this.stagger(a, 0.3); this.hitstop = Math.max(this.hitstop, 0.06); this.floater(d.x, d.y - 22, "BLOK", PAL.steelL); }
      else a.cooldown = 0.2;
      d.guardT = Math.max(d.guardT, 0.3);
      return;
    }
    // AI: tarcza
    if (!d.hero && d.hasShield && d.state === "idle" && angFromD < 1.0) {
      const wall = d.team === 0 && this.orders[d.group as "inf"]?.formation === "wall";
      if (chance(d.def.shieldBlock * (wall ? 1.6 : 1))) {
        this.sfx.thunk(s.v, s.pan);
        this.sparks(cx, cy, 3, PAL.wood);
        if (a.hero) this.floater(d.x, d.y - 22, "TARCZA", PAL.dirtL);
        return;
      }
    }
    // trafienie
    let dmg = w.dmg[dir] * d.def.armor[w.type[dir]] * rr(0.9, 1.1);
    if (a.hero) dmg *= lerp(0.85, 1.3, clamp(a.hold / 0.6, 0, 1));
    const head = dir === "O" && chance(0.45);
    if (head) dmg *= 1.5;
    if (d.state === "windup" && dir === "T") dmg *= 1.15;   // kontra pchnięciem
    this.damage(d, dmg, a, head, w.type[dir] === "blunt");
    if (heroInvolved) {
      this.hitstop = Math.max(this.hitstop, head ? 0.11 : 0.07);
      this.shake = Math.max(this.shake, d.hero ? 4 : head ? 3 : 2);
    }
  }

  kickHit(a: Unit) {
    for (const u of this.units) {
      if (u.team === a.team || !u.active) continue;
      if (dist(a.x, a.y, u.x, u.y) > 17 + u.def.radius) continue;
      if (Math.abs(angDiff(a.face, Math.atan2(u.y - a.y, u.x - a.x))) > 0.9) continue;
      this.sfx.kick();
      this.stagger(u, u.def.poise ? 0.35 : 0.7);
      this.push(u, a.x, a.y, 130);
      this.hitstop = Math.max(this.hitstop, 0.06); this.shake = Math.max(this.shake, 2);
      this.dust(u.x, u.y, 6);
      return;
    }
  }

  damage(d: Unit, dmg: number, src: Unit | null, head: boolean, blunt = false) {
    dmg = Math.round(dmg);
    d.hp -= dmg; d.flash = 0.1;
    const s = this.vol(d.x);
    if (d.def.undead) {
      this.sfx.bone(s.v, s.pan);
      if (blunt) this.sfx.heavy(s.v * 0.7, s.pan);
      this.bones(d.x, d.y - 9, 4 + (dmg / 6) | 0, src);
    } else {
      this.sfx.hit(s.v, s.pan);
      this.blood(d.x, d.y - 9, 6 + (dmg / 3) | 0, src);
    }
    if (src) this.push(d, src.x, src.y, 55 + dmg);
    const interrupt = !d.def.poise || head || dmg >= 40 || blunt;
    if (d.hp > 0 && interrupt) this.stagger(d, d.hero ? 0.22 : 0.3);
    if (src?.hero || d.hero) {
      this.floater(d.x + rr(-3, 3), d.y - 24, (head ? "GŁOWA " : "") + dmg, d.hero ? PAL.redL : head ? PAL.gold : PAL.white);
    }
    if (d.hero) { this.hurtFlash = 0.35; }
    if (d.hp <= 0) this.kill(d, src);
  }

  kill(d: Unit, src: Unit | null) {
    const s = this.vol(d.x);
    if (src) src.kills++;
    if (d.hero) {
      d.state = "down"; d.hp = 0; d.blocking = false;
      this.camFree = true;
      this.say("Padłeś ogłuszony. Armia walczy dalej. Kamera: strzałki.", PAL.redL);
      this.shout("Padłeś!", PAL.redL);
      for (const u of this.units) if (u.team === 0 && !u.hero) u.morale -= 25;
      return;
    }
    d.state = "dead";
    this.sfx.death(s.v * (d.def.undead ? 0.3 : 0.8), s.pan);
    this.corpses.push({ x: d.x, y: d.y, kind: d.def.body, flip: chance(0.5), rot: chance(0.5) ? 1 : -1, undead: !!d.def.undead });
    if (!d.def.undead) this.pool(d.x, d.y, 4 + rnd() * 3);
    for (const u of this.units) {
      if (!u.active || u.def.undead) continue;
      const near = dist(u.x, u.y, d.x, d.y) < 90;
      if (u.team === d.team && near) u.morale -= 8;
      if (u.team !== d.team && near) u.morale = Math.min(100, u.morale + 3);
    }
    if (d.commander) this.collapse();
    if (src?.hero) {
      this.say(`Zabiłeś: ${d.def.name}`);
    }
  }

  collapse() {
    this.sfx.wail();
    this.shout("Rycerz Śmierci padł!", PAL.purpleL);
    this.say("Klątwa słabnie. Nieumarli rozpadają się!", PAL.purpleL);
    for (const u of this.units) if (u.team === 1 && u.active) u.decay = true;
    for (const u of this.units) if (u.team === 0 && u.active) u.morale = Math.min(100, u.morale + 30);
  }

  // ---------- Łuki ----------
  fire(u: Unit, a: number, speed: number, dmg: number, d: number) {
    const ox = u.x + Math.cos(a) * 6, oy = u.y - 9 + Math.sin(a) * 6;
    this.arrows.push({ x: ox, y: oy, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, team: u.team, src: u, dmg, age: 0, travel: 0, dist: d, done: false });
    const s = this.vol(u.x);
    this.sfx.bow(s.v * (u.hero ? 1 : 0.45), s.pan);
  }

  updateArrows(dt: number) {
    for (const ar of this.arrows) {
      if (ar.done) continue;
      const step = Math.hypot(ar.vx, ar.vy) * dt;
      ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.age += dt; ar.travel += step;
      const p = ar.travel / ar.dist;
      // strzała leci łukiem: trafia tylko tuż po wystrzale lub pod koniec lotu (ogień sojuszniczy możliwy)
      const low = ar.travel < 14 || p > 0.78;
      if (low && ar.age > 0.03) {
        for (const u of this.units) {
          if (!u.active || u === ar.src) continue;
          if (dist(u.x, u.y - 8, ar.x, ar.y) > u.def.radius + 3) continue;
          this.arrowHit(ar, u);
          break;
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
    ar.done = true;
    const back = Math.atan2(-ar.vy, -ar.vx);
    const facing = Math.abs(angDiff(u.face, back));
    const s = this.vol(u.x);
    if (u.hero && u.blocking && facing < 1.25) { this.sfx.thunk(1, s.pan); this.sparks(u.x, u.y - 9, 3, PAL.wood); return; }
    if (!u.hero && u.hasShield && u.state === "idle" && facing < 1.1) {
      const wall = u.team === 0 && this.orders[u.group as "inf"]?.formation === "wall";
      if (chance(wall ? 0.88 : 0.5)) { this.sfx.thunk(s.v * 0.6, s.pan); return; }
    }
    const loose = u.team === 0 && !u.hero && this.orders[u.group as "inf"]?.formation === "loose";
    if (loose && chance(0.25)) { ar.done = false; return; }
    const head = chance(0.12);
    let dmg = ar.dmg * u.def.armor.pierce * rr(0.85, 1.15) * (head ? 1.5 : 1);
    if (ar.src.team === u.team && ar.src.hero) this.say("Trafiłeś swojego!", PAL.redL);
    this.damage(u, dmg, null, head);
    this.push(u, u.x - ar.vx, u.y - ar.vy, 25);
    if (ar.src.hero) this.hitstop = Math.max(this.hitstop, 0.05);
  }

  // ---------- AI ----------
  updateAI(u: Unit, dt: number) {
    if (u.decay) {
      u.hp -= 7 * dt;
      if (chance(dt * 6)) this.parts.push({ x: u.x + rr(-4, 4), y: u.y, z: rr(4, 14), vx: rr(-6, 6), vy: rr(-6, 6), vz: rr(8, 20), life: 0.8, col: PAL.purpleL, kind: "dust" });
      if (u.hp <= 0) { this.kill(u, null); return; }
    }
    if (u.state === "stagger" || u.state === "strike" || u.state === "kick") { u.moving = false; return; }

    // morale
    if (!u.def.undead && !u.fleeing && u.morale < 18) {
      u.fleeing = true;
      if (chance(0.5)) this.say(`${u.def.name} ucieka z pola bitwy!`, PAL.ash);
    }
    if (u.fleeing) {
      const ec = this.centroid(1 - u.team);
      const a = Math.atan2(u.y - ec.y, u.x - ec.x);
      this.steer(u, u.x + Math.cos(a) * 100, u.y + Math.sin(a) * 100, u.def.speed * 1.1, dt);
      u.face = a;
      if (u.x < 4 || u.y < 4 || u.x > WW - 4 || u.y > WH - 4) { u.state = "fled"; }
      return;
    }

    // tryb działania
    let mode: Mode = "hold", fire = true;
    if (u.team === 0) { const o = this.orders[u.group as "inf" | "arch"]; mode = o.mode; fire = o.fire; }
    else mode = this.enemyCharge && u.group !== "skelArch" ? "charge" : "hold";
    const engage = mode === "charge" ? 9999 : mode === "hold" ? 50 : 70;

    // wybór celu
    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || !u.target.active) {
      u.retarget = rr(0.3, 0.6);
      u.target = this.chooseTarget(u);
    }
    const t = u.target;
    const td = t ? dist(u.x, u.y, t.x, t.y) : 1e9;

    // łucznicy
    if (u.def.bow && t) {
      const near = this.nearestEnemy(u);
      const closeThreat = near && dist(u.x, u.y, near.x, near.y) < 26;
      if (!closeThreat && fire && td < u.def.bow.range && mode !== "charge") {
        if (u.state === "idle") {
          u.moving = false;
          this.steer(u, u.slotX, u.slotY, u.def.speed * 0.6, dt, 6);
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
      if (u.state === "windup") u.face = lerp(u.face, u.face + angDiff(u.face, a), 0.2);
      if (tdist > want) {
        this.steer(u, tgt.x, tgt.y, u.def.speed * (u.state === "windup" ? 0.6 : 1), dt);
      } else {
        this.steer(u, u.x - Math.cos(a) * 3, u.y - Math.sin(a) * 3, u.def.speed * 0.3, dt);
        u.moving = false;
        if (u.state === "idle" && u.cooldown <= 0) {
          // unikaj kierunku, który przeciwnik zasłania
          const dirs: Dir[] = ["L", "R", "O", "T"].filter((d) => d !== tgt.guard) as Dir[];
          this.startWindup(u, pick(dirs));
        }
      }
      // gdy walczy z bohaterem, czasem trzyma gardę z wyprzedzeniem
      if (tgt.hero && u.state === "idle") {
        u.idleGuardT -= dt;
        if (u.idleGuardT <= 0) {
          u.idleGuardT = rr(0.9, 2.2);
          if (chance(0.5)) { u.guard = pick<Dir>(["L", "R", "O", "T"]); u.guardT = rr(0.8, 1.6); }
        }
      }
    } else {
      // wracaj na miejsce w szyku
      const d = dist(u.x, u.y, u.slotX, u.slotY);
      const formSpeed = u.team === 0 && this.orders[u.group as "inf"]?.formation === "wall" ? 0.65 : 1;
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
    // rozpychanie od sojuszników
    let sx = 0, sy = 0;
    for (const o of this.units) {
      if (o === u || !o.active) continue;
      const ox = u.x - o.x, oy = u.y - o.y, od = Math.hypot(ox, oy);
      if (od < 11 && od > 0.01) { const k = (11 - od) / 11; sx += (ox / od) * k; sy += (oy / od) * k; }
    }
    for (const ob of this.obstacles) {
      const ox = u.x - ob.x, oy = u.y - ob.y, od = Math.hypot(ox, oy);
      if (od < ob.r + 16 && od > 0.01) { const k = (ob.r + 16 - od) / 16; sx += (ox / od) * k * 1.5; sy += (oy / od) * k * 1.5; }
    }
    const vx = (dx + sx * 0.9) * sp, vy = (dy + sy * 0.9) * sp;
    u.vx = lerp(u.vx, vx, clamp(dt * 8, 0, 1));
    u.vy = lerp(u.vy, vy, clamp(dt * 8, 0, 1));
    u.moving = sp > 5;
  }

  // ---------- Efekty ----------
  blood(x: number, y: number, n: number, src: Unit | null) {
    const a0 = src ? Math.atan2(y - src.y + 9, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + rr(-0.9, 0.9), sp = rr(20, 90);
      this.parts.push({ x, y: y + 9, z: 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rr(10, 70), life: 2, col: pick([PAL.blood, PAL.bloodL, PAL.bloodD]), kind: "blood" });
    }
  }
  bones(x: number, y: number, n: number, src: Unit | null) {
    const a0 = src ? Math.atan2(y - src.y + 9, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) {
      const a = a0 + rr(-1, 1), sp = rr(20, 70);
      this.parts.push({ x, y: y + 9, z: 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rr(20, 60), life: 2, col: pick([PAL.bone, PAL.boneHi, PAL.ash]), kind: "bone" });
    }
  }
  sparks(x: number, y: number, n: number, col: string) {
    for (let i = 0; i < n; i++) {
      const a = rr(0, 6.28), sp = rr(30, 110);
      this.parts.push({ x, y: y + 9, z: 9, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rr(10, 60), life: rr(0.15, 0.35), col, kind: "spark" });
    }
  }
  dust(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rr(-4, 4), y, z: 1, vx: rr(-20, 20), vy: rr(-10, 10), vz: rr(5, 20), life: 0.5, col: PAL.dirtL, kind: "dust" });
  }
  pool(x: number, y: number, r: number) {
    const g = this.dg;
    for (let yy = -r; yy <= r; yy++) for (let xx = -r * 1.4; xx <= r * 1.4; xx++) {
      if ((xx * xx) / 2 + yy * yy <= r * r * rr(0.6, 1)) { g.fillStyle = chance(0.8) ? PAL.bloodD : PAL.blood; g.fillRect(Math.round(x + xx), Math.round(y + yy + 1), 1, 1); }
    }
  }
  floater(x: number, y: number, text: string, col: string) { this.floaters.push({ x, y, text, col, t: 0.9 }); }

  updateParticles(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= 240 * dt;
      if (p.kind === "dust") { p.vx *= 0.92; p.vy *= 0.92; p.vz *= 0.9; }
      if (p.z <= 0 && (p.kind === "blood" || p.kind === "bone")) {
        this.dg.fillStyle = p.col;
        this.dg.fillRect(Math.round(p.x), Math.round(p.y), p.kind === "blood" && chance(0.4) ? 2 : 1, 1);
        p.life = 0;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.t -= dt; f.y -= 14 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
  }

  // ---------- Pętla ----------
  update(realDt: number) {
    const I = this.input;
    if (I.hit("KeyP") || I.hit("Escape")) { if (this.phase === "fight") this.paused = !this.paused; }
    if (I.hit("KeyQ")) { this.camFree = !this.camFree || !this.hero.active; }
    for (const l of this.log) l.t -= realDt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.banner) { this.banner.t -= realDt; if (this.banner.t <= 0) this.banner = null; }
    if (this.hurtFlash > 0) this.hurtFlash -= realDt;

    this.updateCamera(realDt);
    if (this.phase !== "fight" || this.paused) return;

    if (this.hitstop > 0) { this.hitstop -= realDt; return; }
    this.slowmo = I.held("Space");
    const dt = Math.min(realDt, 0.05) * (this.slowmo ? 0.3 : 1);
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
    // ruch i kolizje
    for (const u of this.units) {
      if (!u.active) continue;
      u.x += u.vx * dt; u.y += u.vy * dt;
      if (!u.hero && !u.moving) { u.vx *= Math.pow(0.02, dt); u.vy *= Math.pow(0.02, dt); }
      if (u.state === "stagger") { u.vx *= Math.pow(0.05, dt); u.vy *= Math.pow(0.05, dt); }
      const speed = Math.hypot(u.vx, u.vy);
      if (speed > 8) u.anim += dt * speed * 0.12;
      if (!u.fleeing) { u.x = clamp(u.x, 6, WW - 6); u.y = clamp(u.y, 10, WH - 6); }
    }
    this.collide();
    this.updateArrows(dt);
    this.updateParticles(dt);
    this.checkEnd();
  }
  relayoutT = 0;

  enemyPlan() {
    const pc = this.centroid(0);
    if (!this.enemyCharge) {
      const a = Math.atan2(pc.y - this.enemyAnchor.y, pc.x - this.enemyAnchor.x);
      this.enemyAnchor.x += Math.cos(a) * 20 * 0.4; this.enemyAnchor.y += Math.sin(a) * 20 * 0.4;
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
      const dx = u.x - o.x, dy = u.y - o.y, d = Math.hypot(dx, dy), m = o.r + u.def.radius;
      if (d < m && d > 0.001) { u.x = o.x + (dx / d) * m; u.y = o.y + (dy / d) * m; }
    }
  }

  checkEnd() {
    const foes = this.units.filter((u) => u.team === 1 && u.active).length;
    const ours = this.units.filter((u) => u.team === 0 && u.active).length;
    if (foes === 0) { this.phase = "end"; this.result = "win"; this.shout("Zwycięstwo!"); this.sfx.shout(1); }
    else if (ours === 0) { this.phase = "end"; this.result = "lose"; this.shout("Klęska", PAL.redL); }
  }

  updateCamera(dt: number) {
    const I = this.input;
    if (!this.hero.active) this.camFree = true;
    if (this.camFree) {
      const sp = 260 * dt;
      if (I.held("ArrowLeft")) this.cam.x -= sp; if (I.held("ArrowRight")) this.cam.x += sp;
      if (I.held("ArrowUp")) this.cam.y -= sp; if (I.held("ArrowDown")) this.cam.y += sp;
      if (!this.hero.active) {
        if (I.held("KeyA")) this.cam.x -= sp; if (I.held("KeyD")) this.cam.x += sp;
        if (I.held("KeyW")) this.cam.y -= sp; if (I.held("KeyS")) this.cam.y += sp;
      }
    } else {
      const h = this.hero;
      // kamera lekko wyprzedza w stronę kursora
      const tx = h.x - W / 2 + (I.mx - W / 2) * 0.18, ty = h.y - H / 2 + (I.my - H / 2) * 0.18;
      this.cam.x = lerp(this.cam.x, tx, clamp(dt * 7, 0, 1));
      this.cam.y = lerp(this.cam.y, ty, clamp(dt * 7, 0, 1));
    }
    this.cam.x = clamp(this.cam.x, 0, WW - W); this.cam.y = clamp(this.cam.y, 0, WH - H);
    this.shake = Math.max(0, this.shake - dt * 20);
  }

  // ---------- Rysowanie ----------
  render(g: CanvasRenderingContext2D) {
    const sx = Math.round(this.cam.x + rr(-1, 1) * this.shake), sy = Math.round(this.cam.y + rr(-1, 1) * this.shake);
    g.drawImage(this.ground, sx, sy, W, H, 0, 0, W, H);
    g.drawImage(this.decals, sx, sy, W, H, 0, 0, W, H);
    const vis = (x: number, y: number, m = 40) => x > sx - m && x < sx + W + m && y > sy - m && y < sy + H + m;

    for (const b of this.bushes) if (vis(b.x, b.y)) g.drawImage(BUSH, Math.round(b.x - sx - 7), Math.round(b.y - sy - 8));
    for (const c of this.corpses) if (vis(c.x, c.y)) this.drawCorpse(g, c, sx, sy);

    // znaczniki rozkazów
    if (this.phase !== "end") for (const gname of ["inf", "arch"] as const) {
      const o = this.orders[gname];
      if (o.mode !== "hold") continue;
      const fx = Math.round(o.ax - sx), fy = Math.round(o.ay - sy);
      const sel = this.selected.includes(gname);
      g.globalAlpha = sel ? 0.9 : 0.4;
      g.fillStyle = PAL.woodD; g.fillRect(fx, fy - 10, 1, 10);
      g.fillStyle = gname === "inf" ? PAL.red : PAL.moss; g.fillRect(fx + 1, fy - 10, 5, 3);
      g.globalAlpha = 1;
    }

    type D = { y: number; draw: () => void };
    const list: D[] = [];
    for (const o of this.obstacles) if (vis(o.x, o.y, 50)) list.push({ y: o.y, draw: () => g.drawImage(o.img, Math.round(o.x - sx - o.img.width / 2), Math.round(o.y - sy - o.img.height + 3)) });
    for (const u of this.units) if (u.alive && vis(u.x, u.y)) list.push({ y: u.y, draw: () => this.drawUnit(g, u, sx, sy) });
    list.sort((a, b) => a.y - b.y);
    for (const d of list) d.draw();

    // strzały
    for (const ar of this.arrows) {
      if (!vis(ar.x, ar.y)) continue;
      const p = clamp(ar.travel / ar.dist, 0, 1);
      const lift = Math.sin(p * Math.PI) * Math.min(26, ar.dist * 0.12);
      const a = Math.atan2(ar.vy, ar.vx);
      const x = ar.x - sx, y = ar.y - sy - lift;
      g.fillStyle = "rgba(13,11,14,0.35)"; g.fillRect(Math.round(ar.x - sx), Math.round(ar.y - sy + 9), 2, 1);
      pxLine(g, x, y, x - Math.cos(a) * 6, y - Math.sin(a) * 6, PAL.wood);
      g.fillStyle = PAL.steelL; g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillStyle = PAL.white; g.fillRect(Math.round(x - Math.cos(a) * 6), Math.round(y - Math.sin(a) * 6), 1, 1);
    }
    // cząsteczki
    for (const p of this.parts) {
      if (!vis(p.x, p.y)) continue;
      g.globalAlpha = p.kind === "dust" ? clamp(p.life * 2, 0, 1) : 1;
      g.fillStyle = p.col;
      g.fillRect(Math.round(p.x - sx), Math.round(p.y - sy - p.z), p.kind === "spark" ? 1 : 1, p.kind === "blood" ? 2 : 1);
    }
    g.globalAlpha = 1;

    this.drawTells(g, sx, sy);
    for (const f of this.floaters) {
      g.globalAlpha = clamp(f.t * 2, 0, 1);
      pxText(g, f.text, Math.round(f.x - sx - textW(f.text) / 2), Math.round(f.y - sy), f.col);
    }
    g.globalAlpha = 1;

    // nastrój: zmierzch, winieta, spowolnienie, ból
    g.globalCompositeOperation = "multiply";
    g.fillStyle = this.slowmo ? "#9d93b8" : "#d6cdd8";
    g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = "source-over";
    g.drawImage(this.vignette, 0, 0);
    if (this.hurtFlash > 0) { g.fillStyle = `rgba(112,23,25,${this.hurtFlash})`; g.fillRect(0, 0, W, H); }
    if (this.dk.active && this.dk.decay === false && vis(this.dk.x, this.dk.y)) {
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(this.dk.x - sx, this.dk.y - sy - 10, 2, this.dk.x - sx, this.dk.y - sy - 10, 28);
      gr.addColorStop(0, "rgba(160,102,204,0.25)"); gr.addColorStop(1, "rgba(160,102,204,0)");
      g.fillStyle = gr; g.fillRect(this.dk.x - sx - 30, this.dk.y - sy - 40, 60, 60);
      g.globalCompositeOperation = "source-over";
    }
    // celownik
    if (this.hero.active && this.phase === "fight") {
      const mx = Math.round(this.input.mx), my = Math.round(this.input.my);
      g.fillStyle = PAL.white;
      g.fillRect(mx - 3, my, 2, 1); g.fillRect(mx + 2, my, 2, 1); g.fillRect(mx, my - 3, 1, 2); g.fillRect(mx, my + 2, 1, 2);
    }
  }

  drawCorpse(g: CanvasRenderingContext2D, c: Corpse, sx: number, sy: number) {
    if (c.undead && c.kind !== "dk") { g.drawImage(BONES, Math.round(c.x - sx - 7), Math.round(c.y - sy - 5)); return; }
    const img = SPRITES[c.kind][0][0];
    g.save();
    g.translate(Math.round(c.x - sx), Math.round(c.y - sy - 3));
    g.rotate((c.rot * Math.PI) / 2);
    if (c.flip) g.scale(1, -1);
    g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height / 2));
    g.restore();
  }

  weaponAngle(u: Unit): { a: number; up: boolean; ext: number } {
    const f = u.face, w = u.w;
    const side = (d: Dir) => (d === "L" ? -1 : 1);
    switch (u.state) {
      case "windup": {
        if (u.dir === "O") return { a: -Math.PI / 2, up: true, ext: 0 };
        if (u.dir === "T") return { a: f, up: false, ext: -5 };
        return { a: f + side(u.dir) * 1.9, up: false, ext: 0 };
      }
      case "strike": {
        const p = clamp(u.t / w.strike, 0, 1);
        if (u.dir === "O") return { a: -Math.PI / 2 + angDiff(-Math.PI / 2, f) * p, up: false, ext: 2 * p };
        if (u.dir === "T") return { a: f, up: false, ext: lerp(-5, 7, p) };
        return { a: f + side(u.dir) * lerp(1.9, -1.4, p), up: false, ext: 1 };
      }
      case "recover": {
        const p = clamp(u.t / w.recover, 0, 1);
        if (u.dir === "T") return { a: f, up: false, ext: lerp(7, 0, p) };
        const end = u.dir === "O" ? f : f + side(u.dir) * -1.4;
        return { a: end + angDiff(end, f + 0.9) * p, up: false, ext: 0 };
      }
      case "kick": return { a: f + 1.3, up: false, ext: 0 };
      default: return { a: f + 0.9, up: false, ext: 0 };
    }
  }

  drawUnit(g: CanvasRenderingContext2D, u: Unit, sx: number, sy: number) {
    const x = Math.round(u.x - sx), y = Math.round(u.y - sy);
    const S = SPRITES[u.def.body];
    const c = Math.cos(u.face), s = Math.sin(u.face);
    let dirI = 0, flip = false;
    if (Math.abs(c) > Math.abs(s) * 0.9) { dirI = 2; flip = c < 0; } else dirI = s > 0 ? 0 : 1;
    const moving = Math.hypot(u.vx, u.vy) > 8;
    const frame = u.state === "down" ? 0 : moving ? 1 + (Math.floor(u.anim) % 2) : 0;
    const img = S[dirI][frame];

    if (u.state === "down") {
      this.drawCorpse(g, { x: u.x, y: u.y, kind: u.def.body, flip: false, rot: 1, undead: false }, sx, sy);
      return;
    }
    // cień i oznaczenie oddziału
    g.fillStyle = "rgba(13,11,14,0.4)";
    g.fillRect(x - 4, y - 1, 9, 2); g.fillRect(x - 3, y - 2, 7, 1);
    if (u.team === 0 && !u.hero) {
      const sel = this.selected.includes(u.group as "inf");
      g.fillStyle = u.group === "inf" ? PAL.redL : PAL.moss;
      if (sel || this.slowmo) g.fillRect(x - 1, y + 1, 3, 1);
    }
    if (u.hero) { g.fillStyle = PAL.gold; g.fillRect(x - 2, y + 1, 5, 1); }

    const hand = { x: x + c * 3, y: y - 10 + s * 2 };
    const wa = this.weaponAngle(u);
    const drawGear = () => this.drawGear(g, u, hand, wa, flip, dirI);
    if (dirI === 1) drawGear();
    let off = 0;
    if (u.state === "stagger") off = Math.round(Math.sin(u.t * 60) * 1);
    const ix = x - Math.floor(img.width / 2) + off, iy = y - img.height + 1;
    if (flip) { g.save(); g.translate(ix + img.width, iy); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore(); }
    else g.drawImage(img, ix, iy);
    if (u.flash > 0) {
      g.globalCompositeOperation = "lighter"; g.globalAlpha = 0.6;
      if (flip) { g.save(); g.translate(ix + img.width, iy); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore(); } else g.drawImage(img, ix, iy);
      g.globalAlpha = 1; g.globalCompositeOperation = "source-over";
    }
    if (u.decay) { g.globalAlpha = 0.35; g.fillStyle = PAL.purple; g.fillRect(ix + 3, iy + 2, img.width - 6, img.height - 4); g.globalAlpha = 1; }
    if (dirI !== 1) drawGear();

    // pasek zdrowia dla rannych w pobliżu bohatera
    if (!u.hero && u.hp < u.def.hp && dist(u.x, u.y, this.hero.x, this.hero.y) < 120) {
      const w = u.commander ? 18 : 10, k = clamp(u.hp / u.def.hp, 0, 1);
      g.fillStyle = PAL.ink; g.fillRect(x - w / 2, y - img.height - 3, w, 2);
      g.fillStyle = u.team === 0 ? PAL.redL : u.commander ? PAL.purpleL : PAL.bone;
      g.fillRect(x - w / 2, y - img.height - 3, Math.ceil(w * k), 2);
    }
  }

  drawGear(g: CanvasRenderingContext2D, u: Unit, hand: V, wa: { a: number; up: boolean; ext: number }, flip: boolean, dirI: number) {
    const w = u.w;
    // łuk
    if (u.usingBow && (u.hero || (u.def.bow && u.state === "idle" && u.reload < u.def.bow.reload))) {
      const a = u.face;
      const bx = hand.x + Math.cos(a) * 3, by = hand.y + Math.sin(a) * 3;
      const px = -Math.sin(a), py = Math.cos(a);
      const pull = u.hero ? u.drawT * 4 : clamp(1 - u.reload / 1.2, 0, 1) * 3;
      for (let i = -4; i <= 4; i++) {
        const bend = (1 - (i * i) / 16) * 2;
        g.fillStyle = PAL.wood;
        g.fillRect(Math.round(bx + px * i + Math.cos(a) * bend), Math.round(by + py * i + Math.sin(a) * bend), 1, 1);
      }
      pxLine(g, bx + px * 4, by + py * 4, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, PAL.bone);
      pxLine(g, bx - px * 4, by - py * 4, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, PAL.bone);
      if (pull > 1) pxLine(g, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, bx + Math.cos(a) * 6, by + Math.sin(a) * 6, PAL.white);
      if (!u.hero || u.drawT === 0) { /* bez broni białej */ }
      return;
    }
    // tarcza
    if (u.hasShield) {
      const blockingNow = u.hero ? u.blocking : u.state === "idle" && u.guardT > 0;
      const a = blockingNow ? u.face : u.face - 1.5;
      const r = blockingNow ? 5 : 4;
      const sxp = Math.round(hand.x - Math.cos(u.face) * 3 + Math.cos(a) * r), syp = Math.round(hand.y + 1 + Math.sin(a) * r);
      g.fillStyle = PAL.ink; g.fillRect(sxp - 3, syp - 3, 7, 7);
      g.fillStyle = u.team === 0 ? PAL.red : PAL.dusk; g.fillRect(sxp - 2, syp - 2, 5, 5);
      g.fillStyle = PAL.steel; g.fillRect(sxp - 2, syp - 2, 5, 1); g.fillRect(sxp, syp - 1, 1, 3);
      if (u.hero) { g.fillStyle = PAL.gold; g.fillRect(sxp, syp, 1, 1); }
    }
    // broń biała
    const ex = Math.cos(wa.a), ey = Math.sin(wa.a);
    const bx = hand.x + Math.cos(u.face) * wa.ext, by = hand.y + Math.sin(u.face) * wa.ext;
    const tipx = bx + ex * w.len, tipy = by + ey * w.len;
    if (u.state === "strike" && u.dir !== "T") {
      u.trail.push(wa.a);
      if (u.trail.length > 5) u.trail.shift();
      g.globalAlpha = 0.45;
      for (const ta of u.trail) g.fillStyle = PAL.white, g.fillRect(Math.round(bx + Math.cos(ta) * w.len), Math.round(by + Math.sin(ta) * w.len), 1, 1);
      for (let i = 1; i < u.trail.length; i++) pxLine(g, bx + Math.cos(u.trail[i - 1]) * w.len, by + Math.sin(u.trail[i - 1]) * w.len, bx + Math.cos(u.trail[i]) * w.len, by + Math.sin(u.trail[i]) * w.len, PAL.white);
      g.globalAlpha = 1;
    }
    pxLine(g, bx + ex * 2, by + ey * 2, tipx, tipy, w.blade);
    if (w.head) { g.fillStyle = w.head; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 3, 3); g.fillStyle = PAL.steelL; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 1, 1); }
    g.fillStyle = w.hilt;
    g.fillRect(Math.round(bx + ex * 2 - ey), Math.round(by + ey * 2 + ex), 1, 1);
    g.fillRect(Math.round(bx + ex * 2 + ey), Math.round(by + ey * 2 - ex), 1, 1);
    g.fillRect(Math.round(bx), Math.round(by), 1, 1);
  }

  // Zapowiedzi ciosów, gardy i kierunek ciosu bohatera
  drawTells(g: CanvasRenderingContext2D, sx: number, sy: number) {
    const h = this.hero;
    for (const u of this.units) {
      if (!u.active || u.team === 0) continue;
      const d = dist(u.x, u.y, h.x, h.y);
      if (d > 150) continue;
      const top = u.y - sy - (u.commander ? 30 : 25);
      const x = Math.round(u.x - sx);
      if (u.state === "windup") dirGlyph(g, u.dir, x, Math.round(top), PAL.bloodL, true);
      else if (u.guard && d < 90) dirGlyph(g, u.guard, x, Math.round(top), PAL.steelL, false);
    }
    if (h.active && !h.usingBow && this.phase === "fight") {
      const col = h.state === "windup" ? PAL.gold : PAL.goldD;
      dirGlyph(g, h.state === "windup" ? h.dir : this.loadDir, Math.round(h.x - sx), Math.round(h.y - sy - 25), col, h.state === "windup");
    }
  }
}

// Mały znak kierunku nad głową: strzałka = cios, kreska = garda.
function dirGlyph(g: CanvasRenderingContext2D, d: Dir, x: number, y: number, col: string, attack: boolean) {
  g.fillStyle = PAL.ink;
  const P = (px: number, py: number) => { g.fillRect(x + px, y + py, 1, 1); };
  const shapes: Record<Dir, number[][]> = attack ? {
    L: [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [1, -1], [1, 1], [0, -2], [0, 2]],   // → z lewej
    R: [[3, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-2, 0], [-1, -1], [-1, 1], [0, -2], [0, 2]],  // ← z prawej
    O: [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [-1, 0], [1, 0], [-2, -1], [2, -1]],         // ↓ z góry
    T: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, -3], [0, 3], [-3, 0], [3, 0]], // pchnięcie
  } : {
    L: [[-5, -3], [-5, -2], [-5, -1], [-5, 0], [-5, 1], [-5, 2]],
    R: [[5, -3], [5, -2], [5, -1], [5, 0], [5, 1], [5, 2]],
    O: [[-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3]],
    T: [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]],
  };
  for (const [px, py] of shapes[d]) { g.fillRect(x + px - 1, y + py, 3, 1); g.fillRect(x + px, y + py - 1, 1, 3); }
  g.fillStyle = col;
  for (const [px, py] of shapes[d]) P(px, py);
}

// Mały pikselowy krój 3x5 do liczb i krótkich słów.
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

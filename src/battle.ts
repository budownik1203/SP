// Bitwa (Build B4): konfiguracja z mapy świata, armie z rezerwami i falami, teren, noc, deszcz,
// oblężenie i arena, AI generałów, oficerowie, umiejętności, ćwiartowanie i wynik bitwy.

type State = "idle" | "windup" | "strike" | "recover" | "stagger" | "kick" | "down" | "dead" | "fled";
type Mode = "hold" | "follow" | "charge" | "flank" | "ambush";
type CmdLevel = "groups" | "orders" | "formation" | "more" | "target" | "assign";
type Role = "inf" | "ranged" | "cav" | "special";

let UID = 1;

const SQUAD_NAMES: Record<number, string> = { 1: "Piechota", 2: "Strzelcy", 3: "Konnica", 4: "Oddział 4", 5: "Oddział 5", 6: "Oddział 6", 7: "Oddział 7", 8: "Oddział 8", 11: "Sojusznicza piechota", 12: "Sojuszniczy strzelcy", 13: "Sojusznicza jazda" };
const SQUAD_COLORS: Record<number, string> = { 1: PAL.redL, 2: PAL.moss, 3: PAL.gold, 4: PAL.bone, 5: PAL.purpleL, 6: PAL.steelL, 7: PAL.dirtL, 8: PAL.ash };

// Klawisze do przypisania: id, domyślny klawisz, opis, gdzie działa.
let UNIT_PAINT: Record<number, { main: string; trim: string; charge: string }> | null = null;
const KEYDEF: [string, string, string, string][] = [
  ["char", "KeyC", "Okno postaci", "Mapa"], ["inv", "KeyI", "Ekwipunek", "Mapa"], ["party", "KeyP", "Armia", "Mapa"], ["fac", "KeyF", "Frakcje", "Mapa"],
  ["chron", "KeyK", "Kronika", "Mapa"], ["quest", "KeyJ", "Zadania", "Mapa"], ["log", "KeyL", "Dziennik powiadomień", "Mapa"], ["camp", "Space", "Postój / obóz", "Mapa"],
  ["home", "KeyH", "Widok na armię", "Mapa"], ["overview", "Tab", "Widok całej mapy", "Mapa"], ["borders", "KeyB", "Granice frakcji", "Mapa"], ["help", "F1", "Lista skrótów", "Mapa"], ["kingdom", "KeyU", "Królestwo: ziemie, budowy, dwór", "Mapa"],
  ["mini", "KeyN", "Minimapa", "Mapa i bitwa"], ["music", "KeyM", "Muzyka wł./wył.", "Mapa i bitwa"],
  ["dodge", "Space", "Odskok", "Bitwa"], ["tpause", "KeyP", "Pauza taktyczna", "Bitwa"], ["tview", "KeyY", "Widok taktyczny z góry", "Bitwa"], ["kick", "KeyF", "Kopniak", "Bitwa"], ["stance", "KeyR", "Pchnięcie / cięcie (konno: kopia)", "Bitwa"], ["over", "KeyV", "Opuść kopię (konno)", "Bitwa"], ["swap", "Tab", "Zmiana broni / łuk", "Bitwa"],
  ["mount", "KeyE", "Zsiądź / dosiądź", "Bitwa"], ["cmd", "KeyQ", "Rozkazy", "Bitwa"], ["cry", "KeyG", "Okrzyk bojowy", "Bitwa"], ["band", "Digit4", "Opatrunek", "Bitwa"], ["treb", "KeyT", "Celowanie trebuszem", "Bitwa"],
];
const KEYDEF_MAP: Record<string, string> = Object.fromEntries(KEYDEF.map((k) => [k[0], k[1]]));
function KB(id: string): string { return (settings.keys && settings.keys[id]) || KEYDEF_MAP[id]; }
function keyName(code: string) { return code.replace(/^Key/, "").replace(/^Digit/, "").replace("Space", "Spacja").replace("ShiftLeft", "Shift").replace("AltLeft", "Alt").replace("Escape", "Esc").replace("Numpad", "Num "); }
interface Settings {
  fxVol?: number; voiceVol?: number; uiVol?: number; mapText?: number; density?: number; keys?: Record<string, string>; seenTips?: string[]; loadScreens?: boolean; battleCam?: "fixed" | "auto";
  damageNumbers: boolean; gesture: boolean; music: boolean; volume: number; battleSize: number;
  musicVol: number; shake: number; killSlow: boolean; blood: number; hpBars: "near" | "all" | "off"; tells: boolean; dirHint: boolean;
  questMarkers: boolean; questArrows: boolean; partyNames: "hover" | "lords" | "all"; autosaveDays: number; uiScale: number; toastsOn: boolean; pauseOnEvent: boolean; fewLog?: boolean; minimap?: boolean; deploy?: boolean; borders?: boolean; typeText?: boolean; voices?: boolean; crossStyle?: boolean; atkMode?: "mouse" | "keys" | "screen"; horseMode?: "dir" | "tank"; gore?: boolean; dmgHeroOnly?: boolean; outline?: boolean; palette?: "region" | "warm" | "cold"; autoCamp?: boolean;
}

interface HeroCfg {
  name: string; look: Look; hp: number; maxHp: number; weapon: string; shield: boolean; bowDmg: number; ammo: number;
  armor: number; mount: Mount | null; abilities: string[]; abLevels: Record<string, number>; xbow?: boolean; weapon2?: string;
  faith: number; mana: number; fury: number; corruption: number; bandages: number;
  leadership: number; medicine: number;
}
interface CompanionCfg { id: string; name: string; look: Look; hp: number; maxHp: number; weapon: string; shield: boolean; armor: number; squad: number; bow?: number; mount?: Mount | null; ab?: string; }
interface SideCfg { name: string; faction: number; troops: { type: string; n: number; squad?: number }[]; hero?: HeroCfg; companions?: CompanionCfg[]; allies?: { name: string; faction: number; troops: { type: string; n: number }[] }[]; }
interface BattleConfig {
  terrain: Terrain; night: boolean; rain: boolean; fog?: boolean; season?: number; region?: string; hour?: number;
  engines?: { ram?: boolean; tower?: boolean; trebuchet?: boolean };
  player: SideCfg; enemy: SideCfg;
  siegeDefender?: 0 | 1;           // która strona broni murów
  arena?: { kind: "duel" | "team" | "beasts"; lethal?: boolean; joust?: boolean; archery?: boolean };
  maxPerSide?: number;
  title?: string;
  allyObey?: boolean; deploy?: boolean; keep?: boolean; sally?: boolean;
  tutorial?: boolean; defensive?: boolean; moraleMod?: { team0?: number; team1?: number }; dmgTaken?: number; campFort?: boolean; wallDmg?: number; paint?: Record<number, { main: string; trim: string; charge: string }>;
}
interface Casualty { type: string; killed: number; wounded: number; }
interface BattleResult {
  win: boolean; heroKO: boolean; heroHp: number; heroKills: number;
  faith: number; mana: number; fury: number; corruption: number; bandages: number; ammo: number;
  ours: Casualty[]; theirs: Casualty[]; allies: Casualty[];
  xp: Record<string, number>;          // doświadczenie na typ jednostki gracza
  prisoners: { type: string; n: number }[];
  companionsKO: string[]; companionHp: Record<string, number>;
  enemyKilled: number; time: number; retreated: boolean;
  timeline?: { t: number; a: number; b: number }[]; best?: { type: string; name: string; kills: number } | null;
}

// Pancerz (B27): wyraźnie chroni przed cięciem, słabo przed obuchem. Mnożnik obrażeń: niższy = lepsza ochrona.
function armTune(a: Record<DmgType, number>): Record<DmgType, number> { return { cut: Math.pow(a.cut, 1.3), pierce: a.pierce, blunt: 1 - (1 - a.blunt) * 0.55 }; }
class Unit {
  id = UID++;
  def: UnitDef;
  key: string;
  team: number;
  squad: number;
  x: number; y: number;
  vx = 0; vy = 0;
  face = 0;
  wantFace = 0;
  hp: number;
  maxHp: number;
  arm: Record<DmgType, number>;
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
  companion: string | null = null;
  commander = false;
  reload = 0;
  drawT = 0;
  ammo = 0;
  bowDmg = 0;
  loadout = 0;
  tankWant = 0; dodgeVx = 0; dodgeVy = 0; countering = false; bowShake = 0;
  carry = -1; carryT = 0;
  bearer = false; fatigue = 0; surrendered = false; kiteT = 0; crumbleT = 0;
  dodgeT = 0; dodgeCd = 0; counterT = 0; shieldOffT = 0; bowHoldT = 0; gore = 0; shieldHp = 200;
  weaponKey: string;
  hasShield: boolean;
  kills = 0;
  trail: number[] = [];
  decay = false;
  bloodT = 0;
  bleedT = 0; mud = 0;
  look: Look;
  spr: SpriteSet;
  nextSide: Dir = "R";
  key2 = "";
  name = "";
  // konnica
  mounted = false; horseHp = 0; horseMax = 0; heading = 0; rspeed = 0;
  mountDef: Mount | null = null;
  horse: HorseSet | null = null;
  wheelTo: V | null = null;
  trampleT = 0;
  // zasadzka, zaznaczenie, nawigacja
  hidden = false;
  legT = 0;           // trafienie w nogi: spowolnienie
  recoil = 0;         // odrzut po trafieniu (do rysowania)
  swingVar = 0;       // wariant cięcia: wyżej lub niżej
  couched = false; couchCd = 0;
  weaponBlock = false;
  compAb = "";       // umiejętność kompana w bitwie
  picked = false;
  climbing = false;
  // efekty umiejętności
  buffT = 0; buffDmg = 1;
  cursedT = 0; burnT = 0; bloodRiteT = 0; smiteT = 0;
  abilityT = 0;
  lifeT = 0;          // jednostki przyzwane znikają po czasie
  ko = false;         // arena: nokaut zamiast śmierci
  torch = false;
  fireT = 0;          // ostatni wystrzał (do łuku jednostek)

  constructor(key: string, team: number, squad: number, x: number, y: number, faction: number, look?: Look) {
    this.key = key;
    this.def = UNITS[key];
    this.team = team; this.squad = squad;
    this.x = x; this.y = y;
    this.hp = this.maxHp = this.def.hp;
    this.arm = armTune(this.def.armor);
    this.weaponKey = this.def.weapon;
    this.hasShield = this.def.shield; this.shieldHp = 140 + this.def.tier * 30;
    this.face = this.wantFace = this.heading = team === 0 ? 0 : Math.PI;
    this.reload = rr(0.2, 1.5);
    this.ammo = this.def.bow ? 30 : 0;
    this.bowDmg = this.def.bow ? this.def.bow.dmg : 0;
    this.dir = pick<Dir>(["L", "R", "O", "T"]);
    const variant = Math.floor(rnd() * 48);
    this.look = look || troopLook(this.def, variant, faction);
    const paint = !look && team === 0 && UNIT_PAINT ? UNIT_PAINT[squad] : undefined;   // barwy oddziału gracza
    if (paint && (paint.main || paint.trim || (paint.charge && paint.charge !== "none"))) this.look = applyPaint(this.look, paint);
    this.spr = spritesFor(this.look, look ? "custom:" + this.id : `${key}:${faction}:${variant}${paint ? ":p" + paint.main + paint.trim + paint.charge : ""}`);
    if (this.def.mount) this.mount(this.def.mount, faction);
    this.name = this.def.name;
  }
  mount(m: Mount, faction: number) {
    this.mounted = true; this.mountDef = m; this.horseHp = this.horseMax = m.hp;
    const F = FACTIONS[faction] || FACTIONS[6];
    this.horse = getHorse(this.id, [F.col, F.shade, F.trim], !!m.undead);
  }
  get alive() { return this.state !== "dead" && this.state !== "fled"; }
  get active() { return this.alive && this.state !== "down"; }
  get w() { return WEAPONS[this.weaponKey]; }
  get usingBow() { return this.hero ? this.loadout === 1 : !!this.def.bow; }
  get radius() { return this.mounted ? 9 : this.def.radius; }
  get maxRide() { return (this.mountDef || HORSE).speed; }
  get role(): Role { return this.def.ability ? "special" : this.mounted ? "cav" : this.def.bow ? "ranged" : "inf"; }
}

interface Arrow { x: number; y: number; vx: number; vy: number; team: number; src: Unit; dmg: number; age: number; travel: number; dist: number; done: boolean; kind: "arrow" | "bolt" | "axe" | "fire"; }
interface Particle { x: number; y: number; z: number; vx: number; vy: number; vz: number; life: number; max: number; col: string; kind: "blood" | "spark" | "dust" | "bone" | "flash" | "ring" | "soul" | "fire" | "head" | "limb" | "holy" | "beam" | "rain" | "cloud" | "smoke" | "ember"; img?: HTMLCanvasElement; rot?: number; }
interface Corpse { x: number; y: number; img: HTMLCanvasElement; flip: boolean; rot: number; undead: boolean; bones: boolean; t: number; pooled: boolean; horse?: boolean; kind?: DmgType; dx?: number; dy?: number; }
interface Floater { x: number; y: number; text: string; col: string; t: number; }
interface Order {
  mode: Mode; ax: number; ay: number; formation: Formation; fire: boolean; meleeOnly: boolean; spacing: number; volley?: boolean;
  cols?: number; face?: number; targetSquad?: number | null; flank?: { x: number; y: number } | null;
}
interface Slot { x: number; y: number; face: number; }
interface SiegeEngine { kind: "ram" | "tower"; x: number; y: number; hp: number; max: number; t: number; done: boolean; tx: number; }
interface Reserve { key: string; team: number; faction: number; squadHint?: number; ally?: boolean; }

function newOrder(ax: number, ay: number, formation: Formation = "line"): Order {
  return { mode: "hold", ax, ay, formation, fire: true, meleeOnly: false, spacing: 1, targetSquad: null, flank: null };
}

class Battle {
  cfg: BattleConfig;
  map: BattleMap;
  mw: number; mh: number;
  units: Unit[] = [];
  hero: Unit | null = null;
  heroCfg: HeroCfg | null = null;
  commanders: Unit[] = [];
  arrows: Arrow[] = [];
  parts: Particle[] = [];
  corpses: Corpse[] = [];
  floaters: Floater[] = [];
  decals: HTMLCanvasElement;
  dg: CanvasRenderingContext2D;
  vignette: HTMLCanvasElement;
  fog: HTMLCanvasElement;
  ash: { x: number; y: number; s: number; p: number; c: string }[] = [];
  reserves: Reserve[][] = [[], []];
  spawned: Record<string, number>[] = [{}, {}];

  orders: Record<number, Order> = {};
  eorders: Record<number, Order> = {};
  aorders: Record<number, Order> = {};   // sojusznicy AI (oddziały 11+)
  selected: number[] = [1, 2, 3];
  charge: boolean[] = [false, false];
  waver: Record<number, number> = {};
  generalT = 0;

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
  focusT = 0;
  slowmo = false;
  hurtFlash = 0;
  time = 0;
  real = 0;
  phase: "deploy" | "fight" | "end" = "deploy";
  result: BattleResult | null = null;
  retreated = false;
  log: { text: string; t: number; col?: string; n: number; big?: boolean }[] = [];
  banner: { text: string; t: number; col: string } | null = null;
  loadDir: Dir = "R";
  paused = false;
  relayoutT = 0;
  intensity = 0;
  moanT = 3;
  cds: Record<string, number> = {};
  lastAbility = "";
  fx: AbilityFx[] = [];
  fogged = false; tacPause = false; tacView = false;
  thrustMode = false;
  engines: SiegeEngine[] = [];
  trebT = 6; stoneT = 2; oilT = 12; boulders: { x: number; y: number; t: number }[] = [];
  alliesManual = false;
  edgeT = 0;
  regrouped: boolean[] = [false, false];
  reserveOut = false;
  regroupT = 0;
  heroDmg = 1; heroStamina = 1; heroBlockCost = 1; corruptMul = 1; fireMul = 1; furyMul = 1; heroSpeed = 1;
  light: HTMLCanvasElement | null = null;

  constructor(cfg: BattleConfig, public input: Input, public sfx: Sfx, public settings: Settings) {
    this.cfg = cfg;
    this.fogged = !!cfg.fog;
    this.map = makeBattleMap(cfg.terrain, cfg.night, { season: cfg.season ?? 1, region: cfg.region || "grass", rain: cfg.rain, fort: !!cfg.campFort });
    if (this.map.wall) {
      const W2 = this.map.wall; W2.gateHp = W2.gateMax = 1800;
      const atk = cfg.siegeDefender === 0 ? 1 : 0; void atk;
      if (cfg.engines?.ram) this.engines.push({ kind: "ram", x: 420, y: W2.gateY, hp: 700, max: 700, t: 0, done: false, tx: W2.x0 - 16 });
      if (cfg.engines?.tower) this.engines.push({ kind: "tower", x: 380, y: 500 + (chance(0.5) ? -230 : 230), hp: 900, max: 900, t: 0, done: false, tx: W2.x0 - 14 });
      // drabiny trzeba donieść i przystawić w bitwie
      (W2 as any).placed = W2.ladders.map(() => false);
      this.map.barrier.crossings = this.map.barrier.crossings.filter((c) => c.gate);
      for (const ly of W2.ladders) for (let y = ly - 8; y <= ly + 8; y += CELL) { const cx = Math.floor(W2.x0 / CELL), cy = Math.floor(y / CELL); if (this.map.grid[cy * this.map.gw + cx] === 5) this.map.grid[cy * this.map.gw + cx] = 2; }
    }
    this.mw = this.map.w; this.mh = this.map.h;
    const [d, dg] = mkCanvas(this.mw, this.mh);
    this.decals = d; this.dg = dg;
    this.makeOverlays();
    for (let i = 0; i < 220; i++) this.ash.push({ x: rr(0, 640), y: rr(0, 360), s: rr(4, 13), p: rr(0.3, 1), c: chance(0.7) ? PAL.ash : PAL.boneHi });
    UNIT_PAINT = cfg.paint || null;   // obowiązuje przez całą bitwę (także posiłki z odwodu)
    this.spawnAll();
    if (this.map.wall && cfg.wallDmg) { const n = Math.min(2, Math.floor(cfg.wallDmg / 34)); const spots = [220, 780, 300, 700]; for (let i = 0; i < n; i++) this.openBreach(spots[i] + rr(-30, 30), true); if (n) this.say(n > 1 ? "Ostrzał zrobił w murze dwie wyrwy." : "Ostrzał zrobił w murze wyrwę.", PAL.gold, true); }
    if (cfg.arena?.archery) {   // łucznictwo: słomiane tarcze w różnych odległościach
      this.units = this.units.filter((u) => u.team === 0);
      const h = this.hero; h.x = this.mw / 2 - 150; h.y = this.mh / 2; h.loadout = 1; h.ammo = 12; this.heroAmmoMax = 12; if (!h.bowDmg) h.bowDmg = 40;
      for (let i = 0; i < 8; i++) { const U2 = new Unit("x_dummy", 1, 1, this.mw / 2 - 40 + (i % 4) * 55 + rr(-10, 10), this.mh / 2 - 90 + Math.floor(i / 4) * 150 + rr(-20, 20), 7); U2.face = Math.PI; this.units.push(U2); }
      this.archery = { score: 0, opp: Math.round(rr(3, 7)), n: 8 };
    }
    if (cfg.arena?.joust) { this.joust = { p: [0, 0], pass: -1, resetT: 0 } as any; this.joustReset(); }
    if (cfg.sally) for (const u of this.units) if (u.team === 1) { u.morale *= 0.6; if (chance(0.4)) { u.state = "stagger"; u.t = 0; u.hold = rr(3, 7); } }   // obóz zaskoczony we śnie
  }

  // ---------- Pomocnicze ----------
  cell(x: number, y: number) {
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL);
    if (cx < 0 || cy < 0 || cx >= this.map.gw || cy >= this.map.gh) return 2;
    const v = this.map.grid[cy * this.map.gw + cx];
    if (v === 6) return this.map.wall && this.map.wall.broken ? 0 : 2;
    return v;
  }
  passable(x: number, y: number) { const c = this.cell(x, y); return c !== 2; }
  slowAt(x: number, y: number) { const c = this.cell(x, y); return c === 1 ? 0.55 : c === 5 ? 0.35 : 1; }
  // Oblężenie: taran i wieża pchane przez atakujących, trebusz, kamienie i wrzący olej z murów.
  placeLadder(i: number) {
    const W2 = this.map.wall, pl = (W2 as any).placed as boolean[];
    if (pl[i]) return;
    pl[i] = true;
    const ly = W2.ladders[i];
    for (let y = ly - 8; y <= ly + 8; y += CELL) { const cx = Math.floor(W2.x0 / CELL), cy = Math.floor(y / CELL); this.map.grid[cy * this.map.gw + cx] = 5; }
    this.map.barrier.crossings.push({ y: ly, h: 6 });
    this.say("Drabina przystawiona do muru!", (this.cfg.siegeDefender ?? 1) === 1 ? PAL.gold : PAL.redL);
    const s = this.vol(W2.x0); this.sfx.thunk(s.v, s.pan); this.dust(W2.x0 - 6, ly, 8); this.relayoutT = 0;
  }
  // Wyrwa w murze w miejscu y: przejście przez mur, ranni obrońcy na tym odcinku.
  openBreach(y: number, quiet = false) {
    const W2 = this.map.wall; if (!W2) return;
    const key = Math.round(y / 40), br = ((W2 as any).breaches ||= []) as number[];
    if (br.includes(key * 40) || Math.abs(key * 40 - W2.gateY) < 40) return;
    br.push(key * 40);
    for (let yy = key * 40 - 10; yy <= key * 40 + 10; yy += CELL) for (let x = W2.x0; x <= W2.x1; x += CELL) { const cx = Math.floor(x / CELL), cy = Math.floor(yy / CELL); if (cy >= 0 && cy < this.map.gh) this.map.grid[cy * this.map.gw + cx] = 1; }
    this.map.barrier.crossings.push({ y: key * 40, h: 10 });
    if (!quiet) { this.say("Wyrwa w murze!", (this.cfg.siegeDefender ?? 1) === 1 ? PAL.gold : PAL.redL, true); this.shout("Wyrwa!"); this.shake(5); }
    this.relayoutT = 0;
  }
  oilT2 = 7;
  updateSiege(dt: number) {
    const W2 = this.map.wall, defT = this.cfg.siegeDefender ?? 1, atkT = 1 - defT;
    // wrzący olej z blanków na tych, którzy tłoczą się pod murem
    this.oilT2 -= dt;
    const foot = (u: Unit) => u.team === atkT && u.active && u.x > W2.x0 - 34 && u.x < W2.x0 + 2;
    const defOnWall = this.units.filter((u) => u.team === defT && u.active && this.onWall(u));
    if (this.oilT2 <= 0) {   // kociołki z olejem także na odcinkach z drabinami i wyrwami
      this.oilT2 = rr(7, 11);
      if (defOnWall.length >= 2) {
        const tg = this.units.filter(foot);
        let best: Unit | null = null, bn = 0;
        for (const u of tg) { const n = tg.filter((v) => dist(u.x, u.y, v.x, v.y) < 18).length; if (n > bn) { bn = n; best = u; } }
        if (best && bn >= 3) {
          const bx = best.x, by = best.y;
          this.say(defT === 0 ? "Twoi ludzie leją wrzący olej z blanków!" : "Wrzący olej leje się z murów!", defT === 0 ? PAL.gold : PAL.redL);
          for (const u of this.units) if (u.team === atkT && u.active && dist(u.x, u.y, bx, by) < 18) { this.damage(u, 28 + rr(0, 14), null, false, "blunt", true); u.burnT = Math.max(u.burnT, 2.5); if (u.active) u.morale -= 8; }
          for (let i = 0; i < 26; i++) this.parts.push({ x: bx + rr(-12, 12), y: by + rr(-6, 6), z: rr(10, 40), vx: rr(-10, 10), vy: rr(-5, 5), vz: rr(-30, 10), life: rr(0.4, 0.9), max: 0.9, col: pick([PAL.gold, PAL.redL, PAL.dirtD]), kind: "fire" });
          this.smoke(bx, by, 6, 5);
          const s = this.vol(bx); this.sfx.scream(s.v, s.pan);
        }
      }
    }
    // balista na murach
    this.ballistaT -= dt;
    if (this.ballistaT <= 0) {
      this.ballistaT = rr(5, 8);
      const gunner = this.units.find((u) => u.team === defT && u.active && this.onWall(u));
      const tg = gunner ? this.units.filter((u) => u.team === atkT && u.active && u.x < W2.x0 - 40 && u.x > W2.x0 - 420).sort((a, b) => (b.mounted ? 1 : 0) - (a.mounted ? 1 : 0))[0] : null;
      if (gunner && tg) { const a = Math.atan2(tg.y - (gunner.y - 12), tg.x - gunner.x); this.fire(gunner, a, 420, 75, dist(gunner.x, gunner.y, tg.x, tg.y), "bolt"); const s = this.vol(gunner.x); this.sfx.thunk(s.v, s.pan); }
    }
    // płonące strzały w machiny
    for (const e of this.engines) {
      if (e.done || e.x < W2.x0 - 220) continue;
      if (!(e as any).burnT && chance(dt * 0.12) && this.units.some((u) => u.team === defT && u.active && u.def.bow && this.onWall(u))) { (e as any).burnT = 6; this.say(e.kind === "ram" ? "Płonące strzały w taran!" : "Płonące strzały w wieżę!", defT === 0 ? PAL.gold : PAL.redL); }
      if ((e as any).burnT > 0) { (e as any).burnT -= dt; e.hp -= 35 * dt; if (chance(dt * 20)) this.parts.push({ x: e.x + rr(-10, 10), y: e.y, z: rr(4, 30), vx: rr(-5, 5), vy: rr(-5, 5), vz: rr(15, 40), life: 0.6, max: 0.6, col: pick([PAL.gold, PAL.redL]), kind: "fire" }); }
    }
    // dziedziniec: ostatni obrońcy ruszają, gdy brama padnie
    if (!this.keepOut && (W2.broken || this.units.filter((u) => u.team === atkT && u.active && u.x > W2.x1).length > 6)) {
      this.keepOut = true;
      const ord = defT === 0 ? this.orders : this.eorders;
      if (ord[7]) { ord[7].mode = "charge"; this.shout("Walka na dziedzińcu!", defT === 0 ? PAL.gold : PAL.redL); this.say("Ostatni obrońcy wypadają z twierdzy na dziedziniec!", PAL.redL, true); this.sfx.horn?.(0.8); }
    }
    for (const e of this.engines) {
      if (e.done) continue;
      e.t += dt;
      const pushers = this.units.filter((u) => u.team === atkT && u.active && !u.mounted && dist(u.x, u.y, e.x - 14, e.y) < 30).length;
      if (e.x < e.tx) {
        e.x = Math.min(e.tx, e.x + Math.min(4, pushers) * (e.kind === "ram" ? 4.5 : 3) * dt);
        // atakujący bez celu idą pchać machiny
      } else if (e.kind === "ram") {
        if (W2.broken) { e.done = true; continue; }
        if (e.t > 2.2 && pushers > 0) {
          e.t = 0; W2.gateHp -= 240 + pushers * 20;
          const s = this.vol(e.x); this.sfx.trample(s.v, s.pan); this.sfx.thunk(s.v, s.pan); this.shake(2); this.dust(W2.x0, W2.gateY, 10); this.sparks(W2.x0, W2.gateY - 8, 6, PAL.wood);
          if (W2.gateHp <= 0) { W2.broken = true; this.sfx.trample(1, 0); this.shake(5); this.dust(W2.x0, W2.gateY, 30); this.say("Taran rozbił bramę!", defT === 0 ? PAL.redL : PAL.gold, true); this.shout("Brama pękła!"); this.relayoutT = 0; e.done = true; }
        }
      } else if (e.kind === "tower") {
        e.done = true;
        this.map.barrier.crossings.push({ y: e.y, h: 12 });
        for (let y = e.y - 12; y <= e.y + 12; y += CELL) { const cx = Math.floor(W2.x0 / CELL), cy = Math.floor(y / CELL); this.map.grid[cy * this.map.gw + cx] = 0; }
        this.say("Wieża oblężnicza przy murach! Pomost opuszczony.", defT === 0 ? PAL.redL : PAL.gold, true); this.sfx.trample(0.8, 0); this.relayoutT = 0;
      }
      if (e.hp <= 0) { e.done = true; e.x = -999; this.say(e.kind === "ram" ? "Taran zniszczony!" : "Wieża spłonęła!", defT === 0 ? PAL.gold : PAL.redL, true); }
    }
    // kamienie z murów na atakujących u stóp muru i na drabinach
    this.stoneT -= dt;
    if (this.stoneT <= 0) {
      this.stoneT = rr(1.6, 2.6);
      const defs = this.units.filter((u) => u.team === defT && u.active && this.onWall(u));
      const targets = this.units.filter((u) => u.team === atkT && u.active && u.x > W2.x0 - 34 && u.x < W2.x0 + 2 && defs.some((d) => Math.abs(d.y - u.y) < 50));
      if (defs.length && targets.length) {
        const t = pick(targets);
        this.parts.push({ x: t.x, y: t.y, z: 40, vx: 0, vy: 0, vz: -40, life: 0.9, max: 0.9, col: PAL.stone, kind: "bone" });
        this.damage(t, 26, null, chance(0.3), "blunt", true); if (t.active && !t.def.poise) this.stagger(t, 0.9);
        const s = this.vol(t.x); this.sfx.bone(s.v * 0.6, s.pan, true);
      }
      for (const e of this.engines) if (!e.done && e.x > W2.x0 - 160 && defs.length && chance(0.35)) { e.hp -= 30; this.sparks(e.x, e.y - 10, 4, PAL.wood); }
    }
    // wrzący olej nad bramą
    this.oilT -= dt;
    if (this.oilT <= 0 && !W2.broken) {
      const at = this.units.filter((u) => u.team === atkT && u.active && dist(u.x, u.y, W2.x0 - 10, W2.gateY) < 38);
      if (at.length >= 4) {
        this.oilT = 20;
        for (const u of at) { u.burnT = 4; this.damage(u, 14, null, false, "blunt", false); }
        for (let i = 0; i < 40; i++) this.parts.push({ x: W2.x0 - 10 + rr(-20, 20), y: W2.gateY + rr(-25, 25), z: rr(0, 20), vx: rr(-10, 10), vy: rr(-10, 10), vz: rr(5, 30), life: 0.8, max: 0.8, col: pick([PAL.gold, PAL.redL, PAL.dirtD]), kind: "fire" });
        for (const e of this.engines) if (e.kind === "ram" && !e.done && e.x >= e.tx - 2) e.hp -= 260;
        this.say("Wrzący olej leje się z bramy!", defT === 0 ? PAL.gold : PAL.redL, true);
        const s = this.vol(W2.x0); this.sfx.explode(s.v * 0.5, s.pan); for (const u of at) if (!u.def.undead && chance(0.5)) this.sfx.scream(s.v * 0.6, s.pan);
      } else this.oilT = 2;
    }
    // trebusz atakującego: głazy na mury i bramę
    if (this.cfg.engines?.trebuchet) {
      this.trebT -= dt;
      if (this.trebT <= 0) {
        this.trebT = rr(7, 10);
        const defs = this.units.filter((u) => u.team === defT && u.active && this.onWall(u));
        const t = defs.length && chance(0.7) ? pick(defs) : null;
        this.boulders.push({ x: t ? t.x : W2.x0 + 4, y: t ? t.y : W2.gateY + rr(-12, 12), t: 1.4 });
        const s = this.vol(200); this.sfx.swing(s.v, s.pan, 2);
      }
    }
    for (const bo of this.boulders) {
      bo.t -= dt;
      if (bo.t <= 0) {
        const s = this.vol(bo.x); this.sfx.explode(s.v * 0.8, s.pan); this.shake(3); this.dust(bo.x, bo.y, 24);
        for (let i = 0; i < 14; i++) this.parts.push({ x: bo.x, y: bo.y, z: 4, vx: rr(-60, 60), vy: rr(-40, 40), vz: rr(20, 80), life: 1.2, max: 1.2, col: pick([PAL.stone, PAL.ash, PAL.slate]), kind: "bone" });
        for (const u of this.units) if (u.active && dist(u.x, u.y, bo.x, bo.y) < 26) { this.damage(u, 45, null, false, "blunt", true); if (u.active) { this.stagger(u, 1.2); this.push(u, bo.x, bo.y, 120); } }
        if (Math.abs(bo.x - W2.x0) < 22 && Math.abs(bo.y - W2.gateY) >= 22) {   // trafienie w mur: trzy głazy w jedno miejsce robią wyrwę
          const key = Math.round(bo.y / 40), hits = ((W2 as any).hits ||= {}) as Record<number, number>;
          hits[key] = (hits[key] || 0) + 1;
          const br = ((W2 as any).breaches ||= []) as number[];
          if (hits[key] >= 3 && !br.includes(key * 40)) {
            br.push(key * 40);
            for (let y = key * 40 - 10; y <= key * 40 + 10; y += CELL) for (let x = W2.x0; x <= W2.x1; x += CELL) { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); if (cy >= 0 && cy < this.map.gh) this.map.grid[cy * this.map.gw + cx] = 1; }
            this.map.barrier.crossings.push({ y: key * 40, h: 10 });
            this.say("Wyrwa w murze!", (this.cfg.siegeDefender ?? 1) === 1 ? PAL.gold : PAL.redL, true); this.shout("Wyrwa!"); this.shake(5); this.relayoutT = 0;
            for (const u of this.units) if (u.active && this.onWall(u) && Math.abs(u.y - key * 40) < 14) { this.damage(u, 60, null, false, "blunt", true); }
          }
        }
        if (!W2.broken && Math.abs(bo.y - W2.gateY) < 22 && Math.abs(bo.x - W2.x0) < 20) { W2.gateHp -= 160; if (W2.gateHp <= 0) { W2.broken = true; this.say("Głaz z trebusza kruszy bramę!", PAL.gold, true); this.relayoutT = 0; } }
      }
    }
    this.boulders = this.boulders.filter((b) => b.t > 0);
  }
  // Pod górę wolniej, z górki trochę szybciej.
  slope(u: Unit, tx: number, ty: number) {
    if (!this.map.hills.length) return 1;
    const a = Math.atan2(ty - u.y, tx - u.x);
    const dh = this.height(u.x + Math.cos(a) * 10, u.y + Math.sin(a) * 10) - this.height(u.x, u.y);
    return clamp(1 - dh * 5, 0.65, 1.12);
  }
  // Opuszczona kopia: trafia wszystko na drodze konia, siła rośnie z prędkością.
  lanceCheck(u: Unit) {
    if (!u.mounted || u.weaponKey !== "lance") { u.couched = false; return; }
    if (!u.hero) u.couched = u.rspeed > u.maxRide * 0.7 && !!u.target && u.target.active && dist(u.x, u.y, u.target.x, u.target.y) < 90 && Math.abs(angDiff(u.heading, Math.atan2(u.target.y - u.y, u.target.x - u.x))) < 0.5;
    if (!u.couched || u.couchCd > 0 || u.rspeed < u.maxRide * 0.5) return;
    for (const e of this.units) {
      if (e.team === u.team || !e.active) continue;
      const d = dist(u.x, u.y, e.x, e.y);
      if (d > (u.hero ? 36 : 30) + e.radius || d < 4) continue;
      if (Math.abs(angDiff(u.heading, Math.atan2(e.y - u.y, e.x - u.x))) > (u.hero ? 0.48 : 0.32)) continue;
      const k = u.rspeed / u.maxRide;
      if (this.joust) {   // kopie: punkt za czyste trafienie, zrzucenie z konia kończy pojedynek
        u.couchCd = 1; u.rspeed *= 0.6;
        const side = u.team; this.joust.p[side] += 1;
        const sv = this.vol(e.x); this.sfx.hit(sv.v, sv.pan, "blunt", true); this.sfx.clang(sv.v, sv.pan);
        this.sparks(e.x, e.y - 22, 14, PAL.wood); this.shake(3); this.hitstop = Math.max(this.hitstop, 0.16);
        this.shout(`${u.hero ? "Trafienie!" : "Trafiony!"} ${this.joust.p[0]} : ${this.joust.p[1]}`, u.hero ? PAL.gold : PAL.redL);
        if (u.hero) this.crowd(e.x, e.y, 5);
        if (chance(0.18 + k * 0.15) && e.mounted) { this.dismount(e); this.joust.p[side] += 2; this.say(`${e.hero ? "Spadasz" : e.def.name + " spada"} z konia!`, PAL.gold, true); }
        (this.joust as any).resetT = 1.6;
        break;
      }
      const dmg = (28 + 60 * k) * e.arm.pierce * (u.hero ? this.heroDmg : 1) * (this.cfg.arena && !this.cfg.arena.lethal ? 0.55 : 1);
      u.couchCd = 0.7; u.rspeed *= 0.55;
      const s = this.vol(e.x);
      this.sfx.hit(s.v, s.pan, "pierce", true); this.sfx.trample(s.v * 0.6, s.pan);
      if (e.mounted && chance(0.5)) { e.horseHp -= dmg * 1.2; if (e.horseHp <= 0) this.dismount(e); }
      else { this.damage(e, dmg, u, false, "pierce", true); if (e.active && !e.def.poise) { this.stagger(e, 1.2); this.push(e, u.x, u.y, 140); } }
      if (u.hero || e.hero) { this.hitstop = Math.max(this.hitstop, 0.14); this.kickCam(Math.cos(u.heading), Math.sin(u.heading), 2.2); this.shake(3); if (u.hero) this.shout("Kopia!", PAL.gold); }
      break;
    }
  }
  height(x: number, y: number) {
    let h = 0;
    for (const hl of this.map.hills) { const d = dist(x, y, hl.x, hl.y) / hl.r; if (d < 1) h = Math.max(h, (1 - d * d) * (1 - d * d)); }
    if (this.map.wall && x >= this.map.wall.x0 && x <= this.map.wall.x1 + 4) h = Math.max(h, 0.6);
    return h;
  }
  inForest(x: number, y: number) { return this.map.forests.some((f) => dist(x, y, f.x, f.y) < f.r); }

  makeOverlays() {
    const [v, vg] = mkCanvas(W, H);
    const grd = vg.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.6);
    grd.addColorStop(0, "rgba(10,9,8,0)"); grd.addColorStop(1, "rgba(10,9,8,0.7)");
    vg.fillStyle = grd; vg.fillRect(0, 0, W, H);
    this.vignette = v;
    if (!this.fog) {
      const [f, fg] = mkCanvas(160, 90);
      const fim = fg.createImageData(160, 90);
      for (let y = 0; y < 90; y++) for (let x = 0; x < 160; x++) {
        const n = vnoise(x * 3, y * 3, 30) * 0.7 + vnoise(x * 3 + 99, y * 3, 12) * 0.3;
        const k = (y * 160 + x) * 4;
        fim.data[k] = 190; fim.data[k + 1] = 186; fim.data[k + 2] = 176; fim.data[k + 3] = Math.floor(clamp((n - 0.4) * 2, 0, 1) * 255);
      }
      fg.putImageData(fim, 0, 0);
      this.fog = f;
    }
  }

  // ---------- Rozstawienie ----------
  spawnAll() {
    const cfg = this.cfg, siegeDef = cfg.siegeDefender;
    const max = cfg.maxPerSide || 100;
    const arena = !!cfg.arena;
    // strony: gracz na zachodzie, wróg na wschodzie; w oblężeniu obrońca za murami
    const zone = (team: number) => {
      if (arena) return { x: team === 0 ? this.mw / 2 - 120 : this.mw / 2 + 120, y: this.mh / 2 };
      if (cfg.terrain === "siege") return team === siegeDef ? { x: 1180, y: 500 } : { x: 520, y: 500 };
      return { x: team === 0 ? 380 : 1220, y: 500 };
    };
    for (const team of [0, 1]) {
      const side = team === 0 ? cfg.player : cfg.enemy;
      const z = zone(team);
      const list: Reserve[] = [];
      for (const tr of side.troops) for (let i = 0; i < tr.n; i++) list.push({ key: tr.type, team, faction: side.faction, squadHint: (tr as any).squad });
      if (team === 0 && side.allies) for (const a of side.allies) for (const tr of a.troops) for (let i = 0; i < tr.n; i++) list.push({ key: tr.type, team, faction: a.faction, ally: true });
      // najlepsi i najbardziej różnorodni najpierw, reszta czeka w rezerwie
      for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
      list.sort((a, b) => UNITS[b.key].tier - UNITS[a.key].tier);
      const firstN = Math.max(0, max - (team === 0 && side.hero ? 1 : 0) - (side.companions ? side.companions.length : 0));
      const now = list.slice(0, firstN);
      this.reserves[team] = list.slice(firstN);
      for (const r of now) this.spawnUnit(r, z.x + rr(-30, 30), z.y + (arena ? rr(-40, 40) : rr(-120, 120)));
      if (team === 0 && side.hero) {
        const H = side.hero;
        this.heroCfg = H;
        const h = new Unit("hero", 0, 0, z.x + 60, z.y, (side.faction || 9), H.look);
        h.hero = true; h.name = H.name;
        h.maxHp = H.maxHp; h.hp = H.hp;
        h.weaponKey = H.weapon; h.hasShield = H.shield; h.shieldHp = 420;
        h.bowDmg = H.bowDmg; h.ammo = H.ammo; this.heroAmmoMax = Math.max(H.ammo, 1);
        h.arm = { cut: Math.max(0.22, 1 - H.armor * 1.2), pierce: 1 - H.armor * 0.8, blunt: 1 - H.armor * 0.4 };
        if (H.mount) { h.mount(H.mount, (side.faction || 9)); h.horseHp = h.horseMax = H.mount.hp; }
        this.hero = h; this.units.push(h);
      }
      if (side.companions) for (const C of side.companions) {
        const u = new Unit("companion", 0, C.squad, z.x + rr(-20, 20), z.y + rr(-60, 60), (side.faction || 9), C.look);
        u.companion = C.id; u.name = C.name; u.officer = true; u.compAb = C.ab || "";
        u.maxHp = C.maxHp; u.hp = C.hp; u.weaponKey = C.weapon; u.hasShield = C.shield;
        u.arm = { cut: Math.max(0.22, 1 - C.armor * 1.2), pierce: 1 - C.armor * 0.8, blunt: 1 - C.armor * 0.4 };
        if (C.bow) { u.bowDmg = C.bow; u.ammo = 30; }
        if (C.mount) u.mount(C.mount, (side.faction || 9));
        this.units.push(u);
      }
    }
    // oficerowie: najlepszy żołnierz każdego oddziału gracza, chyba że prowadzi go towarzysz
    for (const sq of this.liveSquads()) if (!this.units.some((u) => u.team === 0 && u.squad === sq && u.officer)) {
      const best = this.squadUnits(sq).sort((a, b) => b.def.tier - a.def.tier)[0];
      if (best) best.officer = true;
    }
    for (let sq = 1; sq <= 7; sq++) { const L = this.squadUnits(sq, 1); if (L.length >= 4) { const best = L.slice().sort((a, b) => b.def.tier - a.def.tier)[0]; best.bearer = true; } }
    // dowódcy wroga: najsilniejsza jednostka po drugiej stronie dostaje rolę dowódcy
    const enemyBest = this.units.filter((u) => u.team === 1).sort((a, b) => b.def.tier * 1000 + b.maxHp - (a.def.tier * 1000 + a.maxHp))[0];
    if (enemyBest && !arena) { enemyBest.commander = true; this.commanders.push(enemyBest); if (!enemyBest.def.ability) enemyBest.squad = 5; }
    // rozkazy domyślne
    const z0 = zone(0), z1 = zone(1);
    const face0 = Math.atan2(z1.y - z0.y, z1.x - z0.x);
    this.orders[1] = newOrder(z0.x + 30, z0.y); this.orders[2] = newOrder(z0.x - 35, z0.y); this.orders[3] = newOrder(z0.x, z0.y + 170);
    for (let s = 4; s <= 8; s++) this.orders[s] = newOrder(z0.x, z0.y);
    for (const k of [11, 12, 13, 14]) this.aorders[k] = newOrder(z0.x - 10, z0.y - 160);
    this.eorders[1] = newOrder(z1.x - 30, z1.y); this.eorders[2] = newOrder(z1.x - 30, z1.y - 150); this.eorders[3] = newOrder(z1.x + 40, z1.y);
    this.eorders[4] = newOrder(z1.x, z1.y + 170); this.eorders[5] = newOrder(z1.x + 10, z1.y);
    this.eorders[6] = { ...newOrder(z1.x, z1.y, "loose"), mode: "hold" };
    if (arena) { for (const k in this.orders) { this.orders[k].ax = z0.x + 20; this.orders[k].ay = z0.y; } for (const k in this.eorders) { this.eorders[k].ax = z1.x; this.eorders[k].ay = z1.y; this.eorders[k].mode = "charge"; } }
    if (cfg.terrain === "siege") {
      const W2 = this.map.wall, defTeam = siegeDef;
      const ord = defTeam === 0 ? this.orders : this.eorders;
      // obrońcy: strzelcy w linii wzdłuż blanków, część piechoty na koronie muru przy drabinach, reszta za bramą
      const rangedK = defTeam === 0 ? 2 : 3, wallK = defTeam === 0 ? 4 : 2, cavK = defTeam === 0 ? 3 : 4;
      ord[1].ax = W2.x1 + 50; ord[1].ay = W2.gateY; ord[1].face = Math.PI;
      ord[rangedK] = { ...newOrder(W2.x0 + 7, W2.gateY, "line"), face: Math.PI, spacing: 1.5 };
      ord[wallK] = { ...newOrder(W2.x0 + 18, W2.gateY, "line"), face: Math.PI, spacing: 1.9 };
      if (ord[cavK]) { ord[cavK].ax = W2.x1 + 130; ord[cavK].ay = W2.gateY + 90; ord[cavK].face = Math.PI; }
      // część piechoty obrońców idzie na mury
      const defInf = this.units.filter((u) => u.team === defTeam && u.squad === 1 && !u.hero && !u.companion);
      for (const u of defInf.slice(0, Math.floor(defInf.length * 0.45))) u.squad = wallK;
      // straż twierdzy: czeka na dziedzińcu, rusza po upadku bramy (druga faza)
      const rest = defInf.slice(Math.floor(defInf.length * 0.45));
      if (rest.length >= 6) { for (const u of rest.slice(0, Math.floor(rest.length * 0.4))) u.squad = 7; ord[7] = { ...newOrder(W2.x1 + 230, W2.gateY, "wall"), face: Math.PI, mode: "hold" }; }
      if (defTeam === 1) { ord[5].ax = W2.x1 + 90; ord[5].ay = W2.gateY; }
      if (defTeam === 1) {   // gracz szturmuje: piechota rusza na drabiny i bramę, strzelcy osłaniają
        this.orders[1].mode = "charge"; this.orders[3].mode = "charge";
        this.orders[2].ax = W2.x0 - 150; this.orders[2].ay = W2.gateY; this.orders[2].face = 0;
      }
    }
    // rezerwa wroga: część piechoty czeka z tyłu, generał wprowadza ją później
    if (!arena && cfg.terrain !== "siege") {
      const inf = this.units.filter((u) => u.team === 1 && u.squad === 1 && !u.commander);
      if (inf.length >= 24) { for (const u of inf.slice(0, Math.floor(inf.length * 0.25))) u.squad = 7; this.eorders[7] = newOrder(z1.x + 120, z1.y); }
    }
    // zasadzka nieumarłych: ghule w lesie, jeśli jest las
    if (!arena && this.map.forests.length) {
      const gh = this.units.filter((u) => u.team === 1 && u.key === "u_ghoul");
      if (gh.length >= 3 && cfg.terrain !== "siege") {
        const f = this.map.forests.reduce((a, b) => (Math.abs(b.x - 800) < Math.abs(a.x - 800) ? b : a));
        for (const u of gh) { u.squad = 6; u.hidden = true; }
        this.eorders[6] = { ...newOrder(f.x, f.y, "loose"), mode: "ambush" };
      }
    }
    this.layoutAll(true);
    if (this.hero) { this.hero.x = z0.x + 60; this.hero.y = z0.y; this.hero.face = this.hero.wantFace = this.hero.heading = face0; }
    // pochodnie w nocy
    if (cfg.night) for (const u of this.units) if (!u.def.undead && chance(0.22)) u.torch = true;
    if (this.hero) { this.cam.x = clamp(this.hero.x - W / 2, 0, this.mw - W); this.cam.y = clamp(this.hero.y - H / 2, 0, this.mh - H); }
    else { this.cam.x = clamp(z0.x - W / 2, 0, this.mw - W); this.cam.y = clamp(z0.y - H / 2, 0, this.mh - H); this.camFree = true; }
  }

  squadFor(team: number, def: UnitDef, ally: boolean): number {
    const role: Role = def.ability ? "special" : def.mount ? "cav" : def.bow ? "ranged" : "inf";
    if (team === 0) {
      if (ally) return role === "ranged" ? 12 : role === "cav" ? 13 : 11;
      return role === "ranged" ? 2 : role === "cav" ? 3 : role === "special" ? 1 : 1;
    }
    if (role === "ranged") return 3;
    if (role === "cav") return 4;
    if (role === "special") return 5;
    // część piechoty na skrzydło
    const inLine = this.units.filter((u) => u.team === 1 && u.squad === 1).length, inWing = this.units.filter((u) => u.team === 1 && u.squad === 2).length;
    return inWing < inLine * 0.35 ? 2 : 1;
  }

  spawnUnit(r: Reserve, x: number, y: number): Unit {
    const def = UNITS[r.key];
    const sq = r.team === 0 && !r.ally && r.squadHint ? r.squadHint : this.squadFor(r.team, def, !!r.ally);
    for (let i = 0; i < 20 && !this.passable(x, y); i++) { x += rr(-20, 20); y += rr(-20, 20); }
    const fac = r.faction || FACTION_OF_CULTURE[def.culture] || (def.culture === "merc" ? 9 : 6);
    const u = new Unit(r.key, r.team, sq, clamp(x, 10, this.mw - 10), clamp(y, 14, this.mh - 8), fac);
    if (this.cfg.night && !def.undead && chance(0.22)) u.torch = true;
    this.units.push(u);
    this.spawned[r.team][r.key] = (this.spawned[r.team][r.key] || 0) + 1;
    return u;
  }

  // Fale posiłków: gdy na polu robi się luźno, z rezerwy wchodzi kolejna grupa przy krawędzi swojej strony.
  reinforce() {
    const max = this.cfg.maxPerSide || 100;
    for (const team of [0, 1]) {
      const res = this.reserves[team];
      if (!res.length) continue;
      const active = this.units.filter((u) => u.team === team && u.active).length;
      if (active > max - Math.min(12, Math.ceil(max / 2))) continue;
      const n = Math.min(res.length, max - active, 18);
      const att = this.cfg.terrain === "siege" ? this.cfg.siegeDefender !== team : true;
      const ex = this.cfg.terrain === "siege" && !att ? this.mw - 40 : team === 0 ? 30 : this.mw - 30;
      for (let i = 0; i < n; i++) this.spawnUnit(res.shift(), ex + rr(-10, 10), this.mh / 2 + rr(-200, 200));
      const side = team === 0 ? "Nasze posiłki" : "Posiłki wroga";
      this.say(`Róg! ${side} wchodzą na pole (${n}).`, team === 0 ? PAL.gold : PAL.purpleL, true);
      this.sfx.horn(team === 0 ? 1 : 0.6);
      if (team === 0) this.sfx.battleCry(0.6);
      this.relayoutT = 0;
    }
  }

  squadUnits(sq: number, team = 0) { return this.units.filter((u) => u.team === team && u.squad === sq && u.active && !u.fleeing && !u.hero); }
  liveSquads(): number[] { const s = new Set<number>(); for (const u of this.units) if (u.team === 0 && !u.hero && u.active && !u.fleeing && u.squad <= 8 && u.squad > 0) s.add(u.squad); return [...s].sort(); }
  centroid(team: number, squad?: number): V {
    let x = 0, y = 0, n = 0;
    for (const u of this.units) {
      if (u.team !== team || !u.active || u.hidden) continue;
      if (squad !== undefined && (u.squad !== squad || u.hero)) continue;
      x += u.x; y += u.y; n++;
    }
    return n ? { x: x / n, y: y / n } : { x: team === 0 ? 400 : this.mw - 400, y: this.mh / 2 };
  }
  ordersOf(team: number, sq: number): Order | undefined { return team === 0 ? (sq >= 11 ? this.aorders[sq] : this.orders[sq]) : this.eorders[sq]; }

  slotsFor(n: number, ax: number, ay: number, face: number, f: Formation, colsOverride?: number, spacing = 1, mounted = false): Slot[] {
    const out: Slot[] = [];
    if (!n) return out;
    const fx = Math.cos(face), fy = Math.sin(face);
    const rx = -fy, ry = fx;
    const mk = mounted ? 1.5 : 1;
    const sp = FORMATION_SPACING[f] * spacing * mk;
    const put = (lx: number, ly: number) => out.push({ x: clamp(ax + rx * lx - fx * ly, 10, this.mw - 10), y: clamp(ay + ry * lx - fy * ly, 14, this.mh - 8), face });
    if (f === "circle") {
      const r = Math.max(12, (n * sp) / (Math.PI * 2));
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; out.push({ x: clamp(ax + Math.cos(a) * r, 10, this.mw - 10), y: clamp(ay + Math.sin(a) * r, 14, this.mh - 8), face: a }); }
      return out;
    }
    if (f === "wedge") { for (let i = 0; i < n; i++) { let row = 0, idx = i; while (idx > row) { idx -= row + 1; row++; } put((idx - row / 2) * sp, row * 13 * spacing * mk); } return out; }
    const defCols = f === "wall" ? 12 : f === "loose" ? 8 : f === "column" ? 2 : 12;
    const cols = clamp(f === "column" ? (colsOverride || defCols) : colsOverride || defCols, 1, n);
    const rowGap = (f === "wall" ? 11 : f === "column" ? 13 : 14) * spacing * (mounted ? 1.6 : 1);
    for (let i = 0; i < n; i++) { const row = Math.floor(i / cols), col = i % cols; const inRow = Math.min(cols, n - row * cols); put((col - (inRow - 1) / 2) * sp, row * rowGap); }
    return out;
  }

  assign(list: Unit[], slots: Slot[], snap = false) {
    if (list.length >= 4 && slots.length === list.length && !snap) {
      // obrót i przesunięcie bez mieszania: każdy zostaje w swoim rzędzie i na swojej stronie szyku
      const f = slots[0].face, fx = Math.cos(f), fy = Math.sin(f), rx = -fy, ry = fx;
      const cx = list.reduce((s, u) => s + u.x, 0) / list.length, cy = list.reduce((s, u) => s + u.y, 0) / list.length;
      const sx0 = slots.reduce((s, q) => s + q.x, 0) / slots.length, sy0 = slots.reduce((s, q) => s + q.y, 0) / slots.length;
      const key = (x: number, y: number, ox: number, oy: number) => { const lat = (x - ox) * rx + (y - oy) * ry, dep = (x - ox) * fx + (y - oy) * fy; return Math.round(-dep / 12) * 10000 + lat; };
      const us = list.slice().sort((a, b) => key(a.x, a.y, cx, cy) - key(b.x, b.y, cx, cy));
      const ss = slots.slice().sort((a, b) => key(a.x, a.y, sx0, sy0) - key(b.x, b.y, sx0, sy0));
      us.forEach((u, i) => { const s = ss[i]; u.slotX = s.x; u.slotY = s.y; u.slotFace = s.face; });
      return;
    }
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
    const o = this.ordersOf(team, sq);
    const ec = this.centroid(1 - team);
    if (team === 0 && o.mode === "follow" && this.hero && this.hero.active) {
      const a = Math.atan2(ec.y - this.hero.y, ec.x - this.hero.x);
      const back = sq === 2 ? 60 : sq === 3 ? 44 : 26, side = sq === 3 ? 50 : 0;
      return { ax: this.hero.x - Math.cos(a) * back - Math.sin(a) * side, ay: this.hero.y - Math.sin(a) * back + Math.cos(a) * side, face: a };
    }
    if (o.mode === "flank" && o.flank) return { ax: o.flank.x, ay: o.flank.y, face: Math.atan2(ec.y - o.flank.y, ec.x - o.flank.x) };
    const face = o.face !== undefined ? o.face : Math.atan2(ec.y - o.ay, ec.x - o.ax);
    return { ax: o.ax, ay: o.ay, face };
  }

  layoutAll(snap = false) {
    for (const team of [0, 1]) {
      const groups = team === 0 ? [this.orders, this.aorders] : [this.eorders];
      for (const ord of groups) for (const k of Object.keys(ord)) {
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
    if (!big && settings.fewLog !== false && !col) return;   // tylko ważne // mniej spamu: drobne wpisy nie wypychają ważnych
    this.log.push({ text, t: big ? 5.5 : 3.6, col, n: 1, big });
    if (this.log.length > 3) this.log.shift();
  }
  shout(text: string, col = PAL.gold) { this.banner = { text, t: 1.3, col }; }
  vol(x: number) { return this.sfx.spatial(x, this.cam); }
  groupName(gs: number[]) {
    const live = this.liveSquads();
    if (gs.length > 1 && live.every((s) => gs.includes(s))) return "Wszyscy";
    return gs.map((s) => SQUAD_NAMES[s]).join(" i ");
  }
  get heroUp() { return !!this.hero && this.hero.active; }

  // ---------- Rozkazy gracza ----------
  ensureOrder(sq: number) {
    if (sq >= 11) { this.alliesManual = true; if (!this.aorders[sq]) { const c = this.centroid(0, sq); this.aorders[sq] = newOrder(c.x, c.y); } return this.aorders[sq]; }
    if (!this.orders[sq]) { const c = this.centroid(0, sq); this.orders[sq] = newOrder(c.x, c.y); } return this.orders[sq];
  }
  allySquads() { const s = new Set<number>(); for (const u of this.units) if (u.team === 0 && u.active && u.squad >= 11 && u.squad <= 13) s.add(u.squad); return [...s].sort(); }
  onWall(u: Unit) { const W2 = this.map.wall; return !!W2 && u.team === this.cfg.siegeDefender && u.x >= W2.x0 - 2 && u.x <= W2.x1 + 8; }
  orderMode(gs: number[], mode: Mode) {
    for (const g of gs) { const o = this.ensureOrder(g); o.mode = mode; o.face = undefined; o.flank = null; }
    if (mode === "follow") { this.say(`${this.groupName(gs)}: za mną!`); this.sfx.shout(0.6); }
    if (mode === "charge") { this.say(`${this.groupName(gs)}: do szarży!`, PAL.redL); this.sfx.battleCry(1); }
  }
  orderHere(gs: number[], wx: number, wy: number) {
    const ec = this.centroid(1), a = Math.atan2(ec.y - wy, ec.x - wx);
    for (const g of gs) {
      const o = this.ensureOrder(g); o.mode = "hold"; o.face = undefined; o.flank = null;
      const back = gs.length > 1 && g === 2 ? 44 : 0, side = gs.length > 1 && g === 3 ? 100 : 0;
      o.ax = wx - Math.cos(a) * back - Math.sin(a) * side; o.ay = wy - Math.sin(a) * back + Math.cos(a) * side;
    }
    this.say(`${this.groupName(gs)}: stać tutaj!`); this.sfx.shout(0.6);
    this.flashPreview(gs);
  }
  orderHoldPosition(gs: number[]) {
    for (const g of gs) { const c = this.centroid(0, g), o = this.ensureOrder(g), a = this.anchorOf(g); o.mode = "hold"; o.ax = c.x + Math.cos(a.face) * 6; o.ay = c.y + Math.sin(a.face) * 6; o.face = a.face; o.flank = null; }
    this.say(`${this.groupName(gs)}: utrzymać pozycję!`);
  }
  orderRetreat(gs: number[]) {
    const ec = this.centroid(1);
    for (const g of gs) { const c = this.centroid(0, g), o = this.ensureOrder(g); const a = Math.atan2(c.y - ec.y, c.x - ec.x); o.mode = "hold"; o.ax = clamp(c.x + Math.cos(a) * 60, 20, this.mw - 20); o.ay = clamp(c.y + Math.sin(a) * 60, 20, this.mh - 20); o.face = a + Math.PI; o.flank = null; }
    this.say(`${this.groupName(gs)}: cofnąć się!`);
  }
  orderFormation(gs: number[], f: Formation) { for (const g of gs) { const o = this.ensureOrder(g); o.formation = f; o.cols = undefined; } this.say(`${this.groupName(gs)}: ${FORMATION_NAME[f].toLowerCase()}`); }
  orderSpacing(gs: number[]) {
    const cur = this.ensureOrder(gs[0]).spacing;
    const next = cur < 1 ? 1 : cur === 1 ? 1.45 : 0.75;
    for (const g of gs) this.ensureOrder(g).spacing = next;
    this.say(`${this.groupName(gs)}: ${next < 1 ? "zewrzeć szyk!" : next > 1 ? "rozluźnić szyk!" : "normalne odstępy"}`);
  }
  spacingName(s: number) { return s < 1 ? "ciasno" : s > 1 ? "luźno" : "normalnie"; }
  orderFire(gs: number[]) { const on = !this.ensureOrder(gs[0]).fire; for (const g of gs) this.ensureOrder(g).fire = on; this.say(on ? `${this.groupName(gs)}: strzelać wedle uznania!` : `${this.groupName(gs)}: wstrzymać ogień!`); }
  orderMelee(gs: number[]) { const on = !this.ensureOrder(gs[0]).meleeOnly; for (const g of gs) this.ensureOrder(g).meleeOnly = on; this.say(on ? `${this.groupName(gs)}: tylko broń biała!` : `${this.groupName(gs)}: wolna broń`); }
  enemySquadName(sq: number) {
    const u = this.units.find((x) => x.team === 1 && x.squad === sq && x.active);
    const names: Record<number, string> = { 1: "Linia wroga", 2: "Skrzydło wroga", 3: "Strzelcy wroga", 4: "Jazda wroga", 5: "Dowódca i specjaliści", 6: "Zasadzka" };
    return (names[sq] || "Oddział wroga") + (u ? ` (${u.def.name})` : "");
  }
  orderTarget(gs: number[], esq: number | null) {
    for (const g of gs) { const o = this.ensureOrder(g); o.targetSquad = esq; const ranged = this.squadUnits(g).some((u) => u.def.bow); if (esq !== null && !ranged && o.mode !== "charge") { o.mode = "charge"; o.flank = null; } }
    this.say(esq === null ? `${this.groupName(gs)}: wolny wybór celu` : `${this.groupName(gs)}: cel: ${this.enemySquadName(esq)}!`, PAL.redL);
    if (esq !== null) this.sfx.battleCry(0.6);
  }
  orderOccupy(gs: number[], kind: "hill" | "forest") {
    const areas = kind === "hill" ? this.map.hills : this.map.forests;
    if (!areas.length) { this.say(kind === "hill" ? "Tu nie ma wzgórza." : "Tu nie ma lasu."); return; }
    for (const g of gs) {
      const c = this.centroid(0, g);
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
    for (const g of gs) { const o = this.ensureOrder(g); o.mode = "flank"; o.face = undefined; o.flank = { x: clamp(ec.x - Math.cos(a) * 30 - Math.sin(a) * side * 160, 20, this.mw - 20), y: clamp(ec.y - Math.sin(a) * 30 + Math.cos(a) * side * 160, 20, this.mh - 20) }; }
    this.say(`${this.groupName(gs)}: oskrzydlić ${side < 0 ? "z lewej" : "z prawej"}!`, PAL.gold); this.sfx.shout(0.8);
  }
  orderAmbush(gs: number[]) {
    for (const g of gs) { const o = this.ensureOrder(g); o.mode = "ambush"; o.flank = null; o.formation = "loose"; for (const u of this.squadUnits(g)) u.hidden = true; }
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
    else { const a = Math.atan2(d.ey - d.sy, d.ex - d.sx); const f1 = a - Math.PI / 2, f2 = a + Math.PI / 2, toE = Math.atan2(ec.y - my, ec.x - mx); face = Math.abs(angDiff(f1, toE)) < Math.abs(angDiff(f2, toE)) ? f1 : f2; }
    const plan: { g: number; ax: number; ay: number; face: number; cols?: number; slots: Slot[] }[] = [];
    const ax0 = len < 8 ? d.sx : mx, ay0 = len < 8 ? d.sy : my;
    const multi = this.selected.length > 1;
    for (const g of this.selected) {
      const list = this.squadUnits(g);
      if (!list.length) continue;
      const o = this.ensureOrder(g);
      const back = multi && g === 2 ? 38 : 0, side = multi && g === 3 ? (len < 8 ? 100 : len / 2 + 60) : 0;
      const ax = ax0 - Math.cos(face) * back - Math.sin(face) * side, ay = ay0 - Math.sin(face) * back + Math.cos(face) * side;
      const sp = FORMATION_SPACING[o.formation] * o.spacing * (list[0].mounted ? 1.5 : 1);
      const cols = len < 8 || (g === 3 && multi) ? o.cols : clamp(Math.round(len / sp) + 1, 1, list.length);
      plan.push({ g, ax, ay, face, cols, slots: this.slotsFor(list.length, ax, ay, face, o.formation, cols, o.spacing, list[0].mounted) });
    }
    return plan;
  }
  applyDrag() {
    if (!this.drag) return;
    for (const p of this.dragPlan(this.drag)) { const o = this.ensureOrder(p.g); o.mode = "hold"; o.ax = p.ax; o.ay = p.ay; o.face = p.face; o.cols = p.cols; o.flank = null; this.preview.push({ slots: p.slots, t: 1.4, col: SQUAD_COLORS[p.g] }); }
    this.say(`${this.groupName(this.selected)}: na pozycje!`);
    this.sfx.shout(0.5);
    this.drag = null; this.cmdLevel = "groups"; this.relayoutT = 0;
  }
  flashPreview(gs: number[]) {
    for (const g of gs) { const list = this.squadUnits(g); if (!list.length) continue; const a = this.anchorOf(g), o = this.ensureOrder(g); this.preview.push({ slots: this.slotsFor(list.length, a.ax, a.ay, a.face, o.formation, o.cols, o.spacing, list[0].mounted), t: 1.2, col: SQUAD_COLORS[g] }); }
    this.relayoutT = 0;
  }
  enemySquadsVisible(): number[] { const s = new Set<number>(); for (const u of this.units) if (u.team === 1 && u.active && !u.hidden) s.add(u.squad); return [...s].sort(); }

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
      if (this.allySquads().length && !live.includes(8)) items.push({ n: 8, label: `Sojusznicy (${this.allySquads().reduce((a, s) => a + this.squadUnits(s).length, 0)})`, on: this.selected[0] >= 11 });
      items.push({ n: 9, label: "Wszyscy", on: this.selected.length > 1 && live.every((s) => this.selected.includes(s)) });
      return items;
    }
    const o = this.ensureOrder(this.selected[0]);
    if (this.cmdLevel === "orders") return [
      { n: 1, label: "Stań w miejscu kursora" }, { n: 2, label: "Za mną" }, { n: 3, label: "Szarża" }, { n: 4, label: "Utrzymaj pozycję" }, { n: 5, label: "Cofnij się" },
      { n: 6, label: `Formacja: ${FORMATION_NAME[o.formation].toLowerCase()} ›` }, { n: 7, label: `Zwartość: ${this.spacingName(o.spacing)}` }, { n: 8, label: "Atakuj oddział ›" }, { n: 9, label: "Więcej ›" },
    ];
    if (this.cmdLevel === "more") return [
      { n: 1, label: "Zajmij wzgórze" }, { n: 2, label: "Zajmij las" }, { n: 3, label: "Oskrzydlenie z lewej" }, { n: 4, label: "Oskrzydlenie z prawej" },
      { n: 5, label: "Zasadzka: ukryj się" }, { n: 6, label: o.fire ? "Wstrzymaj ogień" : "Strzelać wedle uznania" }, { n: 7, label: o.meleeOnly ? "Wolna broń" : "Tylko broń biała" },
      { n: 8, label: o.volley ? "SALWA! Strzelajcie razem" : "Salwa na rozkaz (celujcie i czekajcie)", on: !!o.volley },
      { n: 9, label: this.selected.some((g) => this.squadUnits(g).some((u) => u.mounted)) ? "Zsiąść z koni" : "Na koń!" },
    ];
    if (this.cmdLevel === "target") {
      const items: { n: number; label: string; on?: boolean }[] = this.enemySquadsVisible().map((s) => ({ n: s, label: this.enemySquadName(s), on: o.targetSquad === s }));
      items.push({ n: 9, label: "Wolny wybór celu", on: o.targetSquad == null });
      return items;
    }
    return FORMATIONS.map((f, i) => ({ n: i + 1, label: FORMATION_NAME[f], on: f === o.formation }));
  }
  cmdChoose(n: number) {
    const gs = this.selected;
    this.sfx.ui();
    if (this.cmdLevel !== "groups" && this.cmdLevel !== "assign" && this.cmdLevel !== "target" && this.heroUp) this.sfx.shout(0.35);
    if (this.cmdLevel === "groups" && n === 8 && this.allySquads().length && this.cfg.allyObey === false) { this.say("Sojusznicy nie słuchają twoich rozkazów: za słaba relacja z ich panem.", PAL.redL, true); return; }
    const back = () => { this.cmdLevel = "groups"; this.relayoutT = 0; };
    switch (this.cmdLevel) {
      case "assign": if (n === 9) { for (const u of this.units) u.picked = false; back(); return; } if (n >= 1 && n <= 8) { this.assignPicked(n); this.cmdLevel = "orders"; } return;
      case "groups": { const live = this.liveSquads(); if (n === 9) this.selected = live.slice(); else if (live.includes(n)) this.selected = [n]; else if (n === 8 && this.allySquads().length) this.selected = this.allySquads(); else return; this.cmdLevel = "orders"; return; }
      case "orders": {
        const wx = this.cam.x + this.input.mx, wy = this.cam.y + this.input.my;
        if (n === 1) this.orderHere(gs, wx, wy); else if (n === 2) this.orderMode(gs, "follow"); else if (n === 3) this.orderMode(gs, "charge");
        else if (n === 4) this.orderHoldPosition(gs); else if (n === 5) this.orderRetreat(gs); else if (n === 6) { this.cmdLevel = "formation"; return; }
        else if (n === 7) { this.orderSpacing(gs); this.flashPreview(gs); } else if (n === 8) { this.cmdLevel = "target"; return; } else if (n === 9) { this.cmdLevel = "more"; return; } else return;
        back(); return;
      }
      case "more":
        if (n === 1) this.orderOccupy(gs, "hill"); else if (n === 2) this.orderOccupy(gs, "forest"); else if (n === 3) this.orderFlank(gs, -1); else if (n === 4) this.orderFlank(gs, 1);
        else if (n === 5) this.orderAmbush(gs); else if (n === 6) this.orderFire(gs); else if (n === 7) this.orderMelee(gs); else if (n === 8) this.orderVolley(gs); else if (n === 9) orderDismount(this, gs); else return;
        back(); return;
      case "target": if (n === 9) this.orderTarget(gs, null); else if (this.enemySquadsVisible().includes(n)) this.orderTarget(gs, n); else return; back(); return;
      case "formation": if (n >= 1 && n <= FORMATIONS.length) { this.orderFormation(gs, FORMATIONS[n - 1]); this.flashPreview(gs); back(); } return;
    }
  }
  // kopie: po każdym przejeździe jeźdźcy wracają na końce szranków
  joustReset() {
    this.joust.pass++;
    for (const u of this.units) if (u.active && u.mounted) { const left = u.team === 0; u.x = this.mw / 2 + (left ? -210 : 210); u.y = this.mh / 2 + (left ? -18 : 18); u.heading = left ? 0 : Math.PI; u.face = u.heading; u.rspeed = 0; u.state = "idle"; }
    this.say(`Przejazd ${this.joust.pass + 1}`, PAL.bone);
  }
  // publiczność: kwiaty i monety za dobre akcje
  crowd(x: number, y: number, n: number) {
    if (!this.cfg.arena) return;
    for (let i = 0; i < n * 3; i++) this.parts.push({ x: x + rr(-30, 30), y: y + rr(-20, 20), z: rr(40, 80), vx: rr(-10, 10), vy: rr(-10, 10), vz: rr(-20, 10), life: 1.4, max: 1.4, col: pick([PAL.redL, PAL.gold, PAL.boneHi, PAL.purpleL]), kind: "blood" });
    if (this.crowdGold < 40) this.crowdGold += Math.min(n, 40 - this.crowdGold);
    this.sfx.battleCry?.(0.25); this.sfx.coin?.();
  }
  startFight() {
    if (this.phase !== "deploy") return;
    this.phase = "fight"; this.cmdOpen = false; this.cmdLevel = "groups";
    this.sfx.horn?.(0.8); this.sfx.battleCry(1); this.shout("Do boju!");
  }
  orderVolley(gs: number[]) {
    const o0 = this.ensureOrder(gs[0]);
    if (o0.volley) {
      for (const g of gs) { const o = this.ensureOrder(g); o.volley = false; o.fire = true; for (const u of this.squadUnits(g)) if (u.def.bow || u.bowDmg) u.reload = rr(0, 0.12); }
      this.shout("Salwa!"); this.sfx.horn?.(0.4); this.say("Salwa!", PAL.gold, true);
    } else { for (const g of gs) { const o = this.ensureOrder(g); o.volley = true; o.fire = true; } this.say("Strzelcy celują i czekają na rozkaz salwy (F5).", PAL.gold); }
  }
  cmdBack() {
    if (this.cmdLevel === "formation" || this.cmdLevel === "more" || this.cmdLevel === "target") this.cmdLevel = "orders";
    else if (this.cmdLevel === "orders" || this.cmdLevel === "assign") { this.cmdLevel = "groups"; for (const u of this.units) u.picked = false; }
    else this.toggleCmd(false);
  }
  toggleCmd(open = !this.cmdOpen) {
    if (!this.heroUp && open) open = false;
    this.cmdOpen = open; this.cmdLevel = "groups"; this.drag = null; this.box = null;
    for (const u of this.units) u.picked = false;
    if (open && this.hero) { this.hero.blocking = false; if (this.hero.state === "windup") this.hero.state = "idle"; this.hero.drawT = 0; }
    this.sfx.ui();
  }
  handleOrders() {
    const I = this.input;
    if (this.cfg.arena) return;
    if (I.hit(KB("cmd"))) this.toggleCmd();
    if (!this.heroUp) return;
    if (this.cmdOpen) {
      for (let n = 1; n <= 9; n++) if (I.hit("Digit" + n) || I.hit("Numpad" + n)) this.cmdChoose(n);
      if (I.hit("Backspace") || I.hit("Digit0")) this.cmdBack();
      const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
      if (I.mPressed[2]) this.drag = { sx: wx, sy: wy, ex: wx, ey: wy };
      if (this.drag && I.down[2]) { this.drag.ex = wx; this.drag.ey = wy; }
      if (this.drag && I.mReleased[2]) this.applyDrag();
      if (this.cmdLevel === "target" && I.mPressed[0]) { const e = this.units.find((u) => u.team === 1 && u.active && !u.hidden && dist(u.x, u.y - 12, wx, wy) < 14); if (e) { this.orderTarget(this.selected, e.squad); this.cmdLevel = "groups"; return; } }
      if (I.mPressed[0]) this.box = { sx: wx, sy: wy, ex: wx, ey: wy };
      if (this.box && I.down[0]) { this.box.ex = wx; this.box.ey = wy; }
      if (this.box && I.mReleased[0]) {
        const b = this.box; this.box = null;
        if (dist(b.sx, b.sy, b.ex, b.ey) < 5) {
          let best: Unit | null = null, bd = 14;
          for (const u of this.units) if (u.team === 0 && !u.hero && u.active && u.squad <= 8) { const d = dist(u.x, u.y - 12, wx, wy); if (d < bd) { bd = d; best = u; } }
          if (best) { if (I.held("ShiftLeft") || I.held("ShiftRight")) { best.picked = !best.picked; this.cmdLevel = "assign"; } else { this.selected = [best.squad]; this.cmdLevel = "orders"; } this.sfx.ui(); }
        } else {
          const x0 = Math.min(b.sx, b.ex), x1 = Math.max(b.sx, b.ex), y0 = Math.min(b.sy, b.ey), y1 = Math.max(b.sy, b.ey);
          let n = 0;
          for (const u of this.units) if (u.team === 0 && !u.hero && u.active && u.squad <= 8 && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1) { u.picked = true; n++; }
          if (n) { this.cmdLevel = "assign"; this.sfx.ui(); }
        }
      }
      return;
    }
    // szybkie rozkazy jak w M&B: F1 stań tu, F2 za mną, F3 szarża, F4 następna formacja, F5 salwa
    if (I.hit("F1")) { this.orderHere(this.selected, this.cam.x + I.mx, this.cam.y + I.my); this.sfx.shout(0.35); }
    if (I.hit("F2")) { this.orderMode(this.selected, "follow"); this.sfx.shout(0.35); }
    if (I.hit("F3")) { this.orderMode(this.selected, "charge"); this.sfx.shout(0.4); this.say("Szarża!", PAL.gold); }
    if (I.hit("F4")) { const cur = this.ensureOrder(this.selected[0]).formation; const f = FORMATIONS[(FORMATIONS.indexOf(cur) + 1) % FORMATIONS.length]; this.orderFormation(this.selected, f); this.flashPreview(this.selected); this.say(`Formacja: ${FORMATION_NAME[f]}`); }
    if (I.hit("F5")) { const archers = this.liveSquads().filter((g) => this.squadUnits(g).some((u) => u.def.bow)); if (archers.length) this.orderVolley(archers); }
    // okrzyk bojowy bohatera: G
    if (I.hit(KB("cry")) && this.heroUp && this.cryCd <= 0 && this.hero.stamina >= 25) {
      const h = this.hero; this.cryCd = 25 * (1 - this.P("cryB")); h.stamina -= 25; this.sfx.battleCry(1); this.shout("Za mną!"); this.shake(2);
      const ck = 1 + this.P("cryB");
      for (const u of this.units) if (u.active && dist(u.x, u.y, h.x, h.y) < 170 * ck) { if (u.team === 0) u.morale = Math.min(100, u.morale + 16 * ck); else if (!u.def.undead) u.morale -= 8 * ck; }
      this.parts.push({ x: h.x, y: h.y, z: 4, vx: 14, vy: 0, vz: 0, life: 0.7, max: 0.7, col: PAL.gold, kind: "ring" });
    }
    // trebusz: T strzela w miejsce kursora
    if (I.hit(KB("treb")) && this.cfg.engines?.trebuchet && this.map.wall && this.trebAimCd <= 0 && (this.cfg.siegeDefender ?? 1) === 1) {
      this.trebAimCd = 11; this.boulders.push({ x: this.cam.x + I.mx, y: this.cam.y + I.my, t: 1.6 }); this.say("Trebusz: głaz poleciał!", PAL.gold); const sv = this.vol(200); this.sfx.swing(sv.v, sv.pan, 2);
    }
    if (I.hit("KeyZ")) this.orderHere(this.selected, this.cam.x + I.mx, this.cam.y + I.my);
    if (I.hit("KeyX")) this.orderMode(this.selected, "follow");
    if (I.hit("KeyC")) this.orderMode(this.selected, "charge");
    if (I.hit("KeyV")) { const cur = this.ensureOrder(this.selected[0]).formation; this.orderFormation(this.selected, FORMATIONS[(FORMATIONS.indexOf(cur) + 1) % FORMATIONS.length]); this.flashPreview(this.selected); }
    if (I.hit("KeyB")) this.orderFire(this.selected);
  }

  // ---------- Obrót z ograniczoną prędkością ----------
  turnRate(u: Unit) {
    if (u.hero) return heroTurnRate(u);
    switch (u.state) { case "windup": return 3.2; case "strike": return 1.1; case "recover": return 2.4; case "stagger": return 0.6; case "kick": return 1.5; default: return u.mounted ? 6 : 7.5; }
  }
  turn(u: Unit, dt: number) { const d = angDiff(u.face, u.wantFace), r = this.turnRate(u) * dt; u.face += clamp(d, -r, r); }

  // ---------- Bohater ----------
  updateHero(dt: number) {
    const h = this.hero, I = this.input;
    if (!h || !h.active) return;
    const wx = this.cam.x + I.mx, wy = this.cam.y + I.my;
    h.wantFace = Math.atan2(wy - (h.y - (h.mounted ? 24 : 12)), wx - h.x);
    // Tab: broń główna → druga broń → łuk/kusza → z powrotem
    if (I.hit(KB("swap")) && (h.state === "idle" || h.state === "recover") && this.heroCfg) {
      const H = this.heroCfg; h.drawT = 0; h.state = "idle";
      if (h.loadout === 0 && h.weaponKey === H.weapon && H.weapon2) { h.weaponKey = H.weapon2; h.hasShield = H.shield && !WEAPONS[H.weapon2].twoHanded; this.say(`Broń: ${WEAPONS[H.weapon2].name}`); }
      else if (h.loadout === 0 && H.bowDmg > 0) { h.loadout = 1; this.say(H.xbow ? "Broń: kusza" : "Broń: łuk"); }
      else { h.loadout = 0; h.weaponKey = H.weapon; h.hasShield = H.shield; this.say(`Broń: ${WEAPONS[H.weapon].name}`); }
    }
    // R: przełącznik pchnięcie / cięcie (pieszo; konno R trzymane opuszcza kopię)
    if (I.hit(KB("stance")) && !h.mounted && h.loadout === 0) { this.thrustMode = !this.thrustMode; this.say(this.thrustMode ? "Tryb: pchnięcie" : "Tryb: cięcie"); }
    // bez kierunków: wskaźnik pokazuje następny cios serii
    if (!h.mounted && h.loadout === 0) this.loadDir = seriesNext(this, h).dir;
    heroSurroundTick(this, h, dt);
    { const S = (h as any).soft as Unit | undefined; if (S && (h.state === "windup" || h.state === "strike") && S.active) h.wantFace = Math.atan2(S.y - h.y, S.x - h.x); }

    let mx = 0, my = 0;
    if (I.held("KeyW")) my -= 1; if (I.held("KeyS")) my += 1;
    if (I.held("KeyA")) mx -= 1; if (I.held("KeyD")) mx += 1;
    const ml = Math.hypot(mx, my) || 1;
    const sprint = I.held("ShiftLeft") || I.held("ShiftRight");
    const rite = h.bloodRiteT > 0 ? 1.2 : 1;
    if (h.mounted) {
      const gallop = sprint && h.stamina > 1;
      if (this.settings.horseMode === "tank") {
        // W przyspiesza, S hamuje, A/D skręcają; koń trzyma tempo bez trzymania klawisza
        h.tankWant = clamp((h.tankWant ?? 0) + (I.held("KeyW") ? dt * 0.9 : 0) - (I.held("KeyS") ? dt * 1.4 : 0), 0, 1);
        const turn = (I.held("KeyD") ? 1 : 0) - (I.held("KeyA") ? 1 : 0);
        const a = h.heading + turn * 0.9;
        this.ride(h, h.x + Math.cos(a) * 60, h.y + Math.sin(a) * 60, h.maxRide * h.tankWant * (gallop ? 1 : 0.65) * rite, dt);
      } else if (mx || my) this.ride(h, h.x + (mx / ml) * 60, h.y + (my / ml) * 60, h.maxRide * (gallop ? 1 : 0.6) * rite, dt);
      else this.ride(h, h.x + Math.cos(h.heading) * 40, h.y + Math.sin(h.heading) * 40, 0, dt);
      if (gallop && h.rspeed > 60) { h.stamina -= 10 * dt; h.staminaWait = 0.6; }
    } else {
      let sp = h.def.speed * this.heroSpeed * rite * this.slowAt(h.x, h.y) * (h.legT > 0 ? 0.55 : 1) * this.slope(h, h.x + mx * 10, h.y + my * 10);
      const canSprint = sprint && h.stamina > 1 && (mx || my) && !h.blocking && h.state === "idle";
      if (canSprint) { sp *= 1.45; h.stamina -= 18 * dt * (1 - Math.min(0.8, this.P("dodgeCost"))); h.staminaWait = 0.6; }
      if (h.blocking) sp *= 0.5;
      if (h.state === "windup") sp *= 0.55;
      if (h.state === "strike") sp *= 0.3;
      if (h.state === "recover") sp *= 0.6;
      if (h.usingBow && h.drawT > 0) sp *= 0.45;
      if (h.state === "stagger" || h.state === "kick") sp *= 0.15;
      let tvx = (mx / ml) * sp, tvy = (my / ml) * sp;
      if (h.dodgeT > 0) { const k = 1 + h.dodgeT * 9; tvx = h.dodgeVx * k; tvy = h.dodgeVy * k; }
      const acc = h.state === "strike" || h.state === "stagger" ? 2.5 : 6;
      h.vx = lerp(h.vx, tvx, clamp(dt * acc, 0, 1)); h.vy = lerp(h.vy, tvy, clamp(dt * acc, 0, 1));
      h.moving = !!(mx || my);
    }
    if (h.dodgeT > 0) h.dodgeT -= dt; if (h.dodgeCd > 0) h.dodgeCd -= dt; if (h.counterT > 0) h.counterT -= dt;
    // podnoszenie strzał z ziemi
    if (this.heroCfg && this.heroCfg.bowDmg > 0 && h.ammo < this.heroAmmoMax && this.groundArrows.length) {
      for (let i = this.groundArrows.length - 1; i >= 0; i--) { const g2 = this.groundArrows[i]; if (Math.abs(g2.x - h.x) < 9 && Math.abs(g2.y - h.y) < 9) { this.groundArrows.splice(i, 1); h.ammo++; this.floater(h.x, h.y - 30, "+1 STRZAŁA", PAL.bone, true); break; } }
    }
    if (h.staminaWait > 0) h.staminaWait -= dt;
    else if (!h.blocking) h.stamina = Math.min(100, h.stamina + (this.time - ((h as any).lastAtkT ?? -9) > 1 ? 32 : 20) * this.heroStamina * dt);   // szybciej, gdy nie atakujesz
    h.stamina = Math.max(0, h.stamina);
    if (this.heroCfg) this.heroCfg.mana = Math.min(100, this.heroCfg.mana + dt * 1.5);

    h.couched = h.mounted && h.weaponKey === "lance" && (I.held(KB("stance")) || I.held(KB("over"))) && h.rspeed > h.maxRide * 0.5 && h.state === "idle";
    if (this.cmdOpen) { h.blocking = false; return; }
    // umiejętności: 1–3, opatrunek: 4
    for (let i = 0; i < 3; i++) if (I.hit("Digit" + (i + 1))) castHeroAbility(this, i);
    if (I.hit(KB("band"))) useBandage(this);
    if (h.usingBow) { this.heroBow(dt, wx, wy); return; }

    const earlyWind = h.state === "windup" && h.t < h.w.windup * 0.33;   // pierwsza połowa zamachu: można przerwać
    if (I.mPressed[2]) {
      if (earlyWind) { h.state = "idle"; h.t = 0; h.cooldown = 0.08; (h as any).comboI = 0; h.blockStart = this.time; }
      else if (h.state !== "windup") h.blockStart = this.time;
    }
    h.blocking = I.down[2] && (h.state === "idle" || h.state === "recover") && !h.couched;
    h.weaponBlock = h.blocking && !h.hasShield;
    if (h.blocking) h.staminaWait = Math.max(h.staminaWait, 0.3);
    const H = h as any;
    if (I.mPressed[0] && h.state !== "idle") H.buf = this.time;   // bufor: kliknięcie w trakcie ciosu ustawia następny
    if (h.state === "idle" && !h.blocking && h.cooldown <= 0) {
      if (I.mPressed[0] || (H.buf && this.time - H.buf < 0.4)) { H.buf = 0; heroStartSeries(this, h, wx, wy); }
      else if (I.mPressed[1] && !h.mounted) { this.startWindup(h, "T"); h.key2 = "mouse1"; H.runSp = Math.hypot(h.vx, h.vy); H.soft = softTarget(this, h, wx, wy); }
    }
    // odskok: Spacja, krótki zryw w kierunku ruchu (albo do tyłu), chwila nietykalności
    if (I.hit(KB("dodge")) && !h.mounted && h.dodgeCd <= 0 && h.stamina >= 14 && (h.state === "idle" || h.state === "recover" || earlyWind)) {
      let dx = mx, dy = my; if (!dx && !dy) { dx = -Math.cos(h.face); dy = -Math.sin(h.face); }
      const dl = Math.hypot(dx, dy) || 1; h.dodgeVx = dx / dl * 95; h.dodgeVy = dy / dl * 95;
      h.dodgeT = this.P("dodgeLong") ? 0.34 : 0.24; h.dodgeCd = 0.55; h.stamina -= 18 * (1 - Math.min(0.8, this.P("dodgeCost"))); h.staminaWait = 0.6; (h as any).dodgeBuff = this.time + 1.5; h.state = "idle"; h.t = 0; h.blocking = false;
      this.dust(h.x, h.y, 6); this.sfx.trample?.(0.25, 0);
    }
    // E: zsiadanie i wsiadanie na luźnego konia
    if (I.hit(KB("mount")) && (h.state === "idle" || h.state === "recover")) {
      if (h.mounted && h.rspeed < 40) this.leaveHorse(h);
      else if (!h.mounted) { const lh = this.looseHorses.find((x) => dist(x.x, x.y, h.x, h.y) < 20); if (lh) this.takeHorse(h, lh); else this.say("Brak konia w pobliżu", PAL.ash); }
    }
    if (h.state === "windup") { const held = h.key2 === "mouse" ? I.down[0] : h.key2 === "mouse1" ? I.down[1] : I.held(h.key2); if (held) h.hold += dt; else h.released = true; }
    if (I.hit(KB("kick")) && !h.mounted && (h.state === "idle" || h.state === "recover") && h.stamina >= 12) {
      h.state = "kick"; h.t = 0; h.hitDone = false; h.stamina -= 15; h.staminaWait = 0.5; h.blocking = false;
      h.vx += Math.cos(h.face) * 30; h.vy += Math.sin(h.face) * 30;
    }
  }

  heroBow(dt: number, wx: number, wy: number) {
    const h = this.hero, I = this.input;
    h.blocking = false;
    if (h.state !== "idle") return;
    if (I.down[0] && h.ammo > 0) {
      h.drawT = Math.min(1, h.drawT + dt / ((this.heroCfg as any)?.xbow ? 1.3 : 0.7) * (1 + this.P("draw")));
      // trzymanie pełnego naciągu męczy; bez tchu ręka drży
      if (h.drawT >= 1) { h.stamina -= 14 * dt; h.staminaWait = 0.5; if (h.stamina <= 0) { h.stamina = 0; h.bowShake = Math.min(1, (h.bowShake || 0) + dt); } }
    } else h.bowShake = 0;
    if (I.mReleased[0] && h.drawT > 0) {
      const xb = !!this.heroCfg?.xbow;
      if (xb && h.drawT < 1) { h.drawT = 0; this.say("Kusza nienaciągnięta", PAL.ash); return; }
      if (h.drawT > 0.15) {
        const k = h.drawT;
        const a = h.face + rr(-1, 1) * this.bowSpread();
        const d = clamp(dist(h.x, h.y - 12, wx, wy), 40, 380);
        if (xb) this.fire(h, a, 380, h.bowDmg, d, "bolt"); else this.fire(h, a, lerp(190, 280, k), lerp(h.bowDmg * 0.5, h.bowDmg * 1.3, k), d, "arrow");
        h.ammo--;
        this.kickCam(-Math.cos(a), -Math.sin(a), 1.3);
      }
      h.drawT = 0;
    }
  }
  bowSpread() { const h = this.hero; return lerp(0.22, 0.03, h.drawT) * ((h.moving || h.rspeed > 20) && !(h.mounted && this.P("horseArch")) ? 1.8 : 1) * ((this.heroCfg as any)?.xbow ? 0.5 : 1) * (this.cfg.rain ? 1.3 : 1) * (1 + (h.bowShake || 0) * 5); }
  atkMode(): "mouse" | "keys" | "screen" { return this.settings.atkMode || (this.settings.gesture ? "screen" : "mouse"); }
  heroAmmoMax = 30;
  castFlash: { col: string; t: number } | null = null;
  pk: Record<string, number> = {}; cheatUsed = false;
  P(k: string) { return this.pk[k] || 0; }
  timeline: { t: number; a: number; b: number }[] = []; tlT = 0;
  orcCry: Record<number, boolean> = {};
  archery: { score: number; opp: number; n: number } | null = null; crowdGold = 0;
  keepOut = false;
  cryCd = 0; trebAimCd = 0; ballistaT = 6; joust: { p: [number, number]; pass: number } | null = null;
  groundArrows: { x: number; y: number }[] = [];
  looseHorses: { x: number; y: number; heading: number; def: Mount; hp: number; max: number; horse: any }[] = [];
  leaveHorse(u: Unit) {
    if (!u.mounted) return;
    this.looseHorses.push({ x: u.x + 10, y: u.y + 2, heading: u.heading, def: u.mountDef, hp: u.horseHp, max: u.horseMax, horse: u.horse });
    u.mounted = false; u.rspeed = 0; u.vx = 0; u.vy = 0; u.x -= 6;
    const s = this.vol(u.x); this.sfx.neigh(s.v * 0.6, s.pan);
    if (u.hero) this.say("Zsiadasz z konia. E przy koniu: wsiądź.", PAL.ash);
  }
  takeHorse(u: Unit, lh: { x: number; y: number; heading: number; def: Mount; hp: number; max: number; horse: any }) {
    this.looseHorses.splice(this.looseHorses.indexOf(lh), 1);
    u.mounted = true; u.mountDef = lh.def; u.horseHp = lh.hp; u.horseMax = lh.max; u.horse = lh.horse; u.heading = lh.heading; u.rspeed = 0; u.x = lh.x; u.y = lh.y;
    const s = this.vol(u.x); this.sfx.neigh(s.v, s.pan);
    if (u.hero) this.say("Dosiadasz konia.", PAL.gold);
  }

  // ---------- Jazda konna ----------
  ride(u: Unit, tx: number, ty: number, want: number, dt: number) {
    const m = u.mountDef || HORSE;
    const desired = Math.atan2(ty - u.y, tx - u.x);
    const diff = angDiff(u.heading, desired);
    const maxTurn = m.turn * (1 - 0.45 * clamp(u.rspeed / m.speed, 0, 1));
    if (u.rspeed > 3 || Math.abs(diff) > 0.05) u.heading += clamp(diff, -maxTurn * dt, maxTurn * dt);
    if (Math.abs(diff) > 1.6 && u.rspeed > 40) want *= 0.5;
    if (u.decay) want *= 0.8;
    want *= this.slowAt(u.x, u.y);
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
    this.pool(u.x, u.y + 3, 7);
    u.rspeed = 0; u.vx *= 0.3; u.vy *= 0.3;
    u.hp -= 10;
    this.stagger(u, 1.2);
    this.dust(u.x, u.y, 12);
    if (u.hero) { this.say("Twój koń padł!", PAL.redL, true); this.shake(2); }
    if (u.hp <= 0 && u.active) this.kill(u, null);
  }
  dirIndex(a: number): [number, boolean] { const c = Math.cos(a), s = Math.sin(a); if (Math.abs(c) > Math.abs(s) * 0.9) return [2, c < 0]; return [s > 0 ? 0 : 1, false]; }

  // ---------- Walka wręcz ----------
  startWindup(u: Unit, dir: Dir) {
    u.state = "windup"; u.t = 0; u.dir = dir; u.hold = 0; u.released = false; u.hitDone = false;
    u.countering = u.counterT > 0; u.counterT = 0;
    if (!u.hero) u.fatigue = Math.min(1, u.fatigue + 0.01);
    u.swingVar = dir === "L" || dir === "R" ? rr(-0.45, 0.45) : rr(-0.2, 0.2);
    if (u.hero) { const cost = 5 + this.weight(u) * 5; u.stamina -= cost; u.staminaWait = 0.7; if (u.stamina < 0) { u.stamina = 0; this.say("Brak tchu: ciosy wolniejsze", PAL.ash); } }
    u.guard = null; u.guardT = 0; u.trail = [];
    for (const e of this.units) {
      if (e.team === u.team || !e.active || e.hero) continue;
      if (dist(e.x, e.y, u.x, u.y) > 52) continue;
      const facing = Math.abs(angDiff(e.face, Math.atan2(u.y - e.y, u.x - e.x))) < 1.3;
      if (facing && (e.state === "idle" || e.state === "recover") && chance(e.def.guard * (u.hero ? 1 : 0.8) * (e.decay ? 0.5 : 1)))
        e.pendingGuard = { dir, at: this.time + e.def.react * rr(0.85, 1.25) };
      else if (facing && e.def.tier >= 4 && !e.mounted && e.state === "idle" && chance(0.12 * (e.def.tier - 3))) { const a = Math.atan2(e.y - u.y, e.x - u.x); e.vx += Math.cos(a) * 70; e.vy += Math.sin(a) * 70; }   // weteran odskakuje
    }
  }
  windupTime(u: Unit) { return u.w.windup * (u.hero ? 1 : rr(1, 1.2)) * (u.dir === "O" ? 1.15 : 1) * (u.target?.mounted && !u.mounted ? 0.7 : 1) * (u.cursedT > 0 ? 1.3 : 1); }
  weight(u: Unit) { return u.w.len >= 13 ? 1.5 : u.w.head ? 1.25 : 1; }

  updateCombat(u: Unit, dt: number) {
    u.t += dt;
    if (u.cooldown > 0) u.cooldown -= dt;
    if (u.flash > 0) u.flash -= dt;
    if (u.bloodT > 0) u.bloodT -= dt;
    if (u.trampleT > 0) u.trampleT -= dt;
    if (u.buffT > 0) { u.buffT -= dt; if (u.buffT <= 0) u.buffDmg = 1; }
    if (u.cursedT > 0) u.cursedT -= dt;
    if (u.bloodRiteT > 0) u.bloodRiteT -= dt;
    if (u.smiteT > 0) u.smiteT -= dt;
    if (u.legT > 0) u.legT -= dt;
    if (u.recoil > 0) u.recoil = Math.max(0, u.recoil - dt * 4);
    if (u.couchCd > 0) u.couchCd -= dt;
    if (u.shieldOffT > 0) u.shieldOffT -= dt;
    if (!u.hero) u.fatigue = clamp(u.fatigue + dt * (u.moving || u.state === "strike" ? 0.0035 : -0.004), 0, 1);   // zmęczenie w długiej bitwie
    if (u.kiteT > 0) u.kiteT -= dt;
    if (u.crumbleT > 0) { u.crumbleT -= dt; if (u.crumbleT <= 0) { this.bones(u.x, u.y - 10, 18, null); this.kill(u, null); return; } }
    if (u.burnT > 0) { u.burnT -= dt; u.hp -= 7 * dt; if (chance(dt * 10)) this.parts.push({ x: u.x + rr(-4, 4), y: u.y, z: rr(6, 20), vx: rr(-5, 5), vy: rr(-5, 5), vz: rr(15, 35), life: 0.5, max: 0.5, col: pick([PAL.gold, PAL.redL, PAL.bloodL]), kind: "fire" }); if (u.hp <= 0) { this.kill(u, null); return; } }
    if (u.lifeT > 0) { u.lifeT -= dt; if (u.lifeT <= 0) { u.state = "fled"; this.sparks(u.x, u.y - 10, 10, PAL.boneHi); return; } }
    if (u.guardT > 0) { u.guardT -= dt; if (u.guardT <= 0) u.guard = null; }
    if (u.pendingGuard && this.time >= u.pendingGuard.at) { if (u.state === "idle" || u.state === "recover") { u.guard = u.pendingGuard.dir; u.guardT = 0.8; } u.pendingGuard = null; }
    this.turn(u, dt);
    const w = u.w;
    switch (u.state) {
      case "windup": {
        const minT = u.hero ? w.windup * 0.66 * (u.dir === "O" ? 1.15 : 1) * (u.stamina < 10 ? 1.45 : 1) * (u.countering ? 0.45 : 1) * (1 - this.P("swing")) : this.windupTime(u);
        if (u.t >= minT && (!u.hero || u.released || u.hold > 1.6)) {
          u.state = "strike"; u.t = 0; u.hitDone = false;
          const s = this.vol(u.x);
          this.sfx.swing(s.v * (u.hero ? 1 : 0.4), s.pan, this.weight(u) * (u.hero && u.hold > 0.5 ? 1.25 : 1));
          if (!u.mounted) { const lunge = (u.hero ? 45 : 28) * (u.dir === "T" ? 1.4 : u.dir === "O" ? 0.7 : 1); u.vx += Math.cos(u.face) * lunge; u.vy += Math.sin(u.face) * lunge; }
          if (u.hero && !u.mounted) u.nextSide = u.dir === "R" ? "L" : u.dir === "L" ? "R" : u.nextSide;
        }
        break;
      }
      case "strike":
        if (!u.hitDone && u.t >= w.strike * 0.5) { u.hitDone = true; this.meleeHit(u); }
        if (u.t >= w.strike) { u.state = "recover"; u.t = 0; }
        break;
      case "recover": if (u.t >= w.recover * (u.hero ? 0.72 : 1)) { u.state = "idle"; u.t = 0; u.cooldown = u.hero ? seriesCooldown(this, u) : rr(0.35, 1.1); if (u.hero) (u as any).lastAtkT = this.time; } break;
      case "stagger": if (u.t >= u.hold) { u.state = "idle"; u.t = 0; u.hold = 0; } break;
      case "kick": if (!u.hitDone && u.t >= 0.12) { u.hitDone = true; this.kickHit(u); } if (u.t >= 0.32) { u.state = "idle"; u.t = 0; } break;
    }
  }

  stagger(u: Unit, time: number) {
    if (!u.active) return;
    u.state = "stagger"; u.t = 0; u.hold = time; u.guard = null; u.guardT = 0; u.pendingGuard = null; u.blocking = false; u.drawT = 0;
  }
  inFormation(u: Unit) {
    if (u.hero || u.state !== "idle" && u.state !== "windup" && u.state !== "recover") return false;
    const o = this.ordersOf(u.team, u.squad);
    return !!o && o.mode === "hold" && (o.formation === "wall" || o.formation === "line") && dist(u.x, u.y, u.slotX, u.slotY) < 10;
  }
  push(u: Unit, fromX: number, fromY: number, power: number) {
    if (u.mounted) { u.rspeed *= 0.85; return; }
    const a = Math.atan2(u.y - fromY, u.x - fromX), k = (u.def.poise ? 0.3 : 1) * (this.inFormation(u) ? (this.ordersOf(u.team, u.squad).formation === "wall" ? 0.3 : 0.55) : 1) * (this.onWall(u) ? 0.3 : 1);
    u.vx += Math.cos(a) * power * k; u.vy += Math.sin(a) * power * k;
  }
  kickCam(dx: number, dy: number, amount: number) { const k = this.settings.shake ?? 1; this.shakeVX += dx * amount * 75 * k; this.shakeVY += dy * amount * 75 * k; }
  shake(n: number) { this.rumble = Math.max(this.rumble, n * (this.settings.shake ?? 1)); }

  meleeHit(a: Unit) {
    const w = a.w, dir = a.dir;
    let arc = dir === "T" ? 0.5 : dir === "O" ? 0.75 : 1.35;
    let reach = w.reach + 3 + (dir === "T" ? 4 : 0);
    if (a.mounted) { arc = 1.8; reach += a.hero ? 9 : 5; }
    let best: Unit | null = null, bd = 1e9;
    for (const u of this.units) {
      if (u.team === a.team || !u.active) continue;
      const d = dist(a.x, a.y, u.x, u.y);
      if (d > reach + u.radius) continue;
      if (Math.abs(angDiff(a.face, Math.atan2(u.y - a.y, u.x - a.x))) > arc) continue;
      if (d < bd) { bd = d; best = u; }
    }
    if (best) { this.resolveHit(a, best); return; }
    // brama w oblężeniu
    const W2 = this.map.wall;
    if (W2 && !W2.broken && a.team !== this.cfg.siegeDefender && dist(a.x, a.y, W2.x0 - 4, W2.gateY) < reach + 16) {
      const dmg = w.dmg[dir] * (w.type[dir] === "blunt" ? 1.4 : w.axe ? 1.3 : 0.8) * 0.35;   // bez taranu brama ledwo drgnie
      W2.gateHp -= dmg;
      const s = this.vol(a.x);
      this.sfx.thunk(s.v, s.pan);
      this.sparks(W2.x0, W2.gateY + rr(-10, 10) - 8, 4, PAL.wood);
      if (W2.gateHp <= 0) { W2.broken = true; this.sfx.trample(1, 0); this.shake(4); this.dust(W2.x0, W2.gateY, 30); this.say("Brama pękła!", this.cfg.siegeDefender === 0 ? PAL.redL : PAL.gold, true); this.shout("Brama pękła!"); this.relayoutT = 0; }
    }
  }

  parryWindow() { return 0.2 + this.P("parry"); }
  // Tarcza zbiera ciosy; zniszczona pęka w drzazgi.
  shieldWear(d: Unit, dmg: number) {
    d.shieldHp -= dmg;
    if (d.shieldHp > 0 || !d.hasShield) return false;
    d.hasShield = false; d.blocking = false;
    for (let i = 0; i < 16; i++) this.parts.push({ x: d.x + rr(-3, 3), y: d.y, z: 14, vx: rr(-50, 50), vy: rr(-30, 30), vz: rr(30, 80), life: 1.2, max: 1.2, col: pick([PAL.wood, PAL.woodD, PAL.steel]), kind: "bone" });
    const s = this.vol(d.x); this.sfx.bone(s.v, s.pan, true); this.sfx.thunk(s.v, s.pan);
    if (d.hero || dist(d.x, d.y, this.hero?.x ?? 0, this.hero?.y ?? 0) < 80) this.floater(d.x, d.y - 34, "TARCZA PĘKA", PAL.dirtL, true);
    if (d.hero) this.say("Twoja tarcza pękła!", PAL.redL, true);
    this.stagger(d, 0.6);
    return true;
  }

  resolveHit(a: Unit, d: Unit) {
    const w = a.w, dir = a.dir;
    const angFromD = Math.abs(angDiff(d.face, Math.atan2(a.y - d.y, a.x - d.x)));
    const s = this.vol(d.x);
    const heroInvolved = a.hero || d.hero;
    const hx = a.x + (d.x - a.x) * 0.6, hy = a.y + (d.y - a.y) * 0.6 - (d.mounted ? 24 : 14);
    const ha = Math.atan2(d.y - a.y, d.x - a.x);
    if (a.hidden) this.reveal(a);

    if (d.hero && d.blocking && angFromD < 1.2) {
      if (this.time - d.blockStart <= this.parryWindow()) {
        this.sfx.parry();
        this.hitstop = Math.max(this.hitstop, 0.18); this.kickCam(Math.cos(ha), Math.sin(ha), 1.5);
        this.stagger(a, a.def.poise ? 0.65 : 1.0); this.push(a, d.x, d.y, 55);
        this.sparks(hx, hy, 20, PAL.gold); this.impact(hx, hy, PAL.gold, 1.4);
        this.shout("Parowanie! Kontra!");
        d.counterT = 0.9;
        d.stamina = Math.min(100, d.stamina + 8);
        if (this.heroCfg) this.heroCfg.fury = Math.min(100, this.heroCfg.fury + 12 * this.furyMul);
        return;
      }
      // blok to okno czasowe: tuż po parowaniu tanio, trzymany długo coraz drożej i coraz więcej przepuszcza
      const age = this.time - d.blockStart, good = age <= this.parryWindow() + 0.25, stale = age > 1.2 ? Math.min(2.4, 1 + (age - 1.2) * 0.7) : 1;
      if (good) this.floater(d.x, d.y - 32, "DOBRY BLOK", PAL.steelL, true); else if (stale > 1.6 && chance(0.4)) this.floater(d.x, d.y - 32, "RĘCE SŁABNĄ", PAL.ash, true);
      d.stamina -= (9 + w.dmg[dir] * 0.35) * this.heroBlockCost * (d.weaponBlock ? 1.5 : 1) * (good ? 0.55 : stale); d.staminaWait = 0.6;
      if (!good && stale > 1.3 && !d.weaponBlock) this.damage(d, w.dmg[dir] * d.arm[w.type[dir]] * 0.12 * (stale - 1), a, false, w.type[dir], false, hx, hy);
      if (d.weaponBlock) {   // blok bronią: część ciosu przechodzi
        this.sfx.clang(1, s.pan); this.sparks(hx, hy, 10, PAL.steelL);
        this.push(d, a.x, a.y, 60);
        const leak = w.dmg[dir] * d.arm[w.type[dir]] * 0.4;
        this.hitstop = Math.max(this.hitstop, 0.07); this.kickCam(Math.cos(ha), Math.sin(ha), 1.1);
        if (d.stamina <= 0) { d.stamina = 0; this.stagger(d, 0.9); this.shout("Garda przełamana!", PAL.redL); this.damage(d, w.dmg[dir] * d.arm[w.type[dir]] * 0.8, a, false, w.type[dir], true, hx, hy); }
        else this.damage(d, leak, a, false, w.type[dir], false, hx, hy);
        return;
      }
      this.sfx.thunk(1, s.pan);
      this.sparks(hx, hy, 6, PAL.steelL); this.impact(hx, hy, PAL.wood, 0.7);
      this.shieldWear(d, w.dmg[dir] * (w.axe ? 2 : 1) * 0.6);
      this.push(d, a.x, a.y, 40);
      this.hitstop = Math.max(this.hitstop, 0.06); this.kickCam(Math.cos(ha), Math.sin(ha), 0.9);
      if (d.stamina <= 0) { d.stamina = 0; this.stagger(d, 0.8); this.shout("Garda przełamana!", PAL.redL); }
      return;
    }
    if (!d.hero && d.guard === dir && angFromD < 1.6 && (d.state === "idle" || d.state === "recover") && a.hero && guardBreaks(this, d)) {
      this.sfx.clang(s.v, s.pan); this.sparks(hx, hy, 14, PAL.steelL); this.floater(d.x, d.y - 32, "GARDA PĘKA", PAL.gold, true); d.guard = null; d.guardT = 0; this.stagger(d, 0.5);
    } else if (!d.hero && d.guard === dir && angFromD < 1.6 && (d.state === "idle" || d.state === "recover")) {
      this.sfx.clang(s.v, s.pan);
      this.sparks(hx, hy, 9, PAL.steelL); this.impact(hx, hy, PAL.white, 0.8);
      if (a.hero) { this.stagger(a, 0.4); this.hitstop = Math.max(this.hitstop, 0.08); this.kickCam(-Math.cos(ha), -Math.sin(ha), 0.9); this.floater(d.x, d.y - 32, "BLOK", PAL.steelL, true); this.push(a, d.x, d.y, 35); }
      else a.cooldown = 0.3;
      d.guardT = Math.max(d.guardT, 0.3);
      return;
    }
    if (d.dodgeT > 0.05) { this.floater(d.x, d.y - 30, "UNIK", PAL.boneHi, true); this.sfx.swing?.(0.5, 0, 0.5); return; }
    if (!d.hero && d.hasShield && d.shieldOffT <= 0 && d.state === "idle" && angFromD < 1.0) {
      const wall = d.team === 0 && this.ordersOf(0, d.squad)?.formation === "wall";
      if (chance(d.def.shieldBlock * (wall ? 1.6 : 1))) {
        this.sfx.thunk(s.v, s.pan); this.sparks(hx, hy, 3, PAL.wood);
        if (this.shieldWear(d, w.dmg[dir] * (w.axe ? 2 : 1) * (a.hero ? 1 + this.P("shieldBreak") : 1))) return;
        if (a.hero) { this.floater(d.x, d.y - 32, "TARCZA", PAL.dirtL, true); this.hitstop = Math.max(this.hitstop, 0.06); }
        return;
      }
    }
    let dmg = w.dmg[dir] * d.arm[w.type[dir]] * rr(0.9, 1.1) * a.buffDmg * backHitK(this, d, a);
    if (a.hero && !a.mounted) { const mk = momentumK(a); dmg *= mk; if (mk > 1.15) this.floater(d.x, d.y - 40, "Z ROZPĘDU", PAL.gold, true); }
    const charged = a.hero && a.hold > 0.5;
    if (a.hero) {
      dmg *= lerp(0.85, 1.5, clamp(a.hold / 0.9, 0, 1)) * this.heroDmg * (a.countering ? 1.35 + this.P("counter") : 1);
      if (a.mounted) dmg *= 1 + this.P("cavDmg");
      if (a.hp < a.maxHp * 0.5) dmg *= 1 + this.P("berserk");
      if (angFromD > 2.1) dmg *= 1 + this.P("backstab");
      if (d.def.undead) dmg *= 1 + this.P("undeadB");
      if (d.look.race === "wolf") dmg *= 1 + this.P("beastB");
      if ((a as any).dodgeBuff > this.time) { dmg *= 1 + this.P("dodgeStrike"); (a as any).dodgeBuff = 0; }
    }
    if (a.team === 0 && !a.hero && d.def.undead) dmg *= 1 + this.P("crusade");
    if (a.decay) dmg *= 0.75;
    dmg *= 1 - 0.2 * a.fatigue;
    if (this.onWall(a)) dmg *= 1.15;   // z góry muru łatwiej
    if (a.cursedT > 0) dmg *= 0.7;
    if (a.bloodRiteT > 0) dmg *= 1.4;
    const speedK = a.mounted ? a.rspeed / a.maxRide : 0;
    dmg *= 1 + speedK * (a.hero ? 0.75 : 0.5);
    if (this.height(a.x, a.y) - this.height(d.x, d.y) > 0.15) dmg *= 1.3;
    const head = dir === "O" && chance(0.45);
    if (head) dmg *= 1.5 * (a.hero ? 1 + this.P("headDmg") : 1);
    const legs = !head && !d.mounted && (dir === "T" ? chance(0.3) : chance(0.12));
    if (legs) { dmg *= 0.8; d.legT = 4; if (a.hero || d.hero) this.floater(d.x, d.y - 26, "NOGI", PAL.bone, true); }
    if (d.state === "windup" && dir === "T") dmg *= 1.15;
    const heavy = dir === "O" || charged || w.type[dir] === "blunt" || w.len >= 13 || speedK > 0.7;
    if (!d.def.undead) a.bloodT = 8;
    // smite poziom 1: święty ogień w ostrzu
    if (a.smiteT > 0) { a.smiteT = 0; const holy = 25 * (d.def.undead ? 2.2 : 1); dmg += holy; this.holyBurst(hx, hy + 10, 16); this.sfx.smite(); }
    if (d.mounted && chance(0.5)) {
      d.horseHp -= dmg * 1.2;
      this.blood(hx, hy + 8, 10, a, heavy);
      this.sfx.hit(s.v, s.pan, w.type[dir], heavy);
      if (heroInvolved) { this.hitstop = Math.max(this.hitstop, 0.08); this.kickCam(Math.cos(ha), Math.sin(ha), 1.2); }
      if (d.horseHp <= 0) this.dismount(d);
      return;
    }
    if (a.bloodRiteT > 0) a.hp = Math.min(a.maxHp, a.hp + dmg * 0.25);
    if (a.hero && this.P("lifeSteal")) a.hp = Math.min(a.maxHp, a.hp + dmg * this.P("lifeSteal"));
    if (a.hero && this.heroCfg) this.heroCfg.fury = Math.min(100, this.heroCfg.fury + 6 * this.furyMul);
    if (d.hero && this.heroCfg) this.heroCfg.fury = Math.min(100, this.heroCfg.fury + 8 * this.furyMul);
    this.damage(d, dmg, a, head, w.type[dir], heavy, hx, hy);
    if (heroInvolved) {
      const killed = d.hp <= 0;
      this.hitstop = Math.max(this.hitstop, (head ? 0.19 : heavy ? 0.16 : 0.11) + (killed ? 0.07 : 0));
      this.kickCam(Math.cos(ha), Math.sin(ha), (d.hero ? 2.2 : heavy ? 1.8 : 1.2) + (killed ? 0.6 : 0));
      if (heavy || head) this.shake(2);
      if (killed && a.hero && (heavy || head) && this.settings.killSlow !== false) this.slowT = Math.max(this.slowT, 0.22);
    }
  }

  kickHit(a: Unit) {
    for (const u of this.units) {
      if (u.team === a.team || !u.active || u.mounted) continue;
      if (dist(a.x, a.y, u.x, u.y) > 19 + u.def.radius) continue;
      if (Math.abs(angDiff(a.face, Math.atan2(u.y - a.y, u.x - a.x))) > 0.9) continue;
      this.sfx.kick();
      const shielded = u.hasShield && (u.blocking || u.state === "idle");
      this.stagger(u, (u.def.poise ? 0.5 : 1.1) * (shielded ? 1.3 : 1) * (a.hero && this.P("kick") ? 1.5 : 1)); this.push(u, a.x, a.y, 120 * (a.hero && this.P("kick") ? 1.4 : 1));
      if (a.hero && this.P("kick")) this.damage(u, 15, a, false, "blunt", true);
      if (shielded) { u.shieldOffT = 2.2; this.floater(u.x, u.y - 32, "TARCZA ODBITA", PAL.gold, true); this.sfx.thunk(1, 0); }
      // spychanie z drabin i muru
      if (this.map.wall && !u.mounted && Math.abs(u.x - this.map.wall.x0) < 14) { this.damage(u, 30, a, false, "blunt", true); this.say(`${u.def.name} spada z drabiny!`, PAL.gold); }
      this.hitstop = Math.max(this.hitstop, 0.08); this.kickCam(Math.cos(a.face), Math.sin(a.face), 1.4);
      this.dust(u.x, u.y, 8); this.impact(u.x, u.y - 12, PAL.dirtL, 0.8);
      return;
    }
  }

  damage(d: Unit, dmg: number, src: Unit | null, head: boolean, type: DmgType = "cut", heavy = false, hx?: number, hy?: number) {
    this.lastHitT = this.time;
    if (!d.active) return;
    if (this.onWall(d)) dmg *= 0.6;                       // obrońca za blankami
    if (d.def.undead && src && src.team === 0 && this.P("undeadDmg")) dmg *= 1 + this.P("undeadDmg");
    else if (this.map.wall && this.cell(d.x, d.y) === 5) dmg *= 1.25;   // na drabinie łatwo oberwać
    if (d.hero) {
      dmg *= 1 - (type === "cut" ? this.P("cutRes") : type === "blunt" ? this.P("bluntRes") : 0);
      if (d.hp < d.maxHp * 0.3) dmg *= 1 - this.P("bastion") * 2;
      if (this.heroCfg && this.heroCfg.mana > 50) dmg *= 1 - this.P("manaShield");
      if (!src) dmg *= 1 - this.P("magicRes") * 0.5;
    }
    if (d.team === 0 && this.cfg.dmgTaken) dmg *= this.cfg.dmgTaken;      // trudność
    dmg = Math.round(dmg);
    d.hp -= dmg; d.flash = src?.hero ? 0.13 : 0.08;
    if (d.hero && d.hp <= 0 && this.P("cheat") && !this.cheatUsed) { this.cheatUsed = true; d.hp = 1; this.shout("Jeszcze nie!", PAL.gold); this.say("Ostatkiem sił stajesz na nogi.", PAL.gold, true); this.slowT = 0.8; }
    if (d.hidden) this.reveal(d);
    const s = this.vol(d.x);
    const x = hx ?? d.x, y = hy ?? d.y - 14;
    if (d.def.undead) {
      this.sfx.bone(s.v, s.pan, heavy);
      if (type === "blunt") this.sfx.hit(s.v * 0.5, s.pan, "blunt", true);
      this.bones(x, y, 6 + (dmg / 5) | 0, src);
      this.impact(x, y, PAL.boneHi, heavy ? 1.2 : 0.9);
    } else {
      const plate = d.arm[type] < 0.62;   // ciężka zbroja: iskry i brzęk
      if (plate && type !== "blunt") { this.sfx.clang(s.v * 0.8, s.pan); this.sparks(x, y, 7 + (dmg / 8 | 0), PAL.steelL); }
      this.sfx.hit(s.v, s.pan, type, heavy);
      if (d.hp > 0 && chance(0.6)) this.sfx.pain(s.v, s.pan, d.def.undead ? "undead" : d.def.culture);
      this.blood(x, y, (plate ? 10 : 22) + (dmg / 1.3) | 0, src, heavy);
      d.gore = Math.min(1, d.gore + dmg / 160);
      if (heavy) d.mud = Math.min(1, d.mud + 0.08);
      this.impact(x, y, PAL.bloodL, heavy ? 1.2 : 0.9);
      if (src) this.streak(d.x, d.y, Math.atan2(d.y - src.y, d.x - src.x), 9 + dmg / 4);
    }
    if (src) this.push(d, src.x, src.y, 40 + dmg * (heavy ? 1.35 : 0.8));
    const interrupt = !d.def.poise || head || dmg >= 40 || type === "blunt";
    if (d.hp > 0 && head && dmg >= 15) { this.stagger(d, d.hero ? 0.6 : 1.1); if (src?.hero || d.hero) this.floater(d.x, d.y - 38, "OGŁUSZONY", PAL.gold, true); }
    else if (d.hp > 0 && (interrupt || (d.hero && dmg >= 12))) this.stagger(d, d.hero ? (heavy ? 0.65 : 0.45) : heavy ? 0.7 : 0.45);
    d.recoil = Math.min(1.5, d.recoil + dmg / 25);
    if (d.hero && d.hp > 0 && src) this.push(d, src.x, src.y, 35);
    if (this.settings.damageNumbers && (src?.hero || (d.hero && !this.settings.dmgHeroOnly))) this.floater(d.x + rr(-3, 3), d.y - 34, (head ? "GŁOWA " : "") + dmg, d.hero ? PAL.redL : head ? PAL.gold : PAL.white, true);
    else if (head && src?.hero) this.floater(d.x, d.y - 34, "GŁOWA", PAL.gold, true);
    if (d.hero) this.hurtFlash = 0.35;
    if (d.hp <= 0) this.kill(d, src, head, type, heavy);
  }

  kill(d: Unit, src: Unit | null, head = false, type: DmgType = "cut", heavy = false) {
    if (!d.active) return;
    this.lastKillT = this.time;
    const s = this.vol(d.x);
    if (src) src.kills++;
    if (src?.team === 0 && this.heroCfg && d.def.undead) this.heroCfg.faith = Math.min(100, this.heroCfg.faith + 2);
    if (this.archery && d.key === "x_dummy") { this.archery.score++; this.floater(d.x, d.y - 26, "TRAFIONY!", PAL.gold, true); this.crowd(d.x, d.y, 3); }
    if (d.hero && this.P("cheat") && !this.cheatUsed) { this.cheatUsed = true; d.hp = 1; this.shout("Jeszcze nie!", PAL.gold); return; }
    if (d.hero || (this.cfg.arena && !this.cfg.arena.lethal)) {
      // bohater (i każdy na arenie) zostaje ogłuszony, nie ginie
      if (d.mounted) { d.mounted = false; const [hd] = this.dirIndex(d.heading); this.corpses.push({ x: d.x, y: d.y + 2, img: d.horse.frames[hd][0], flip: Math.cos(d.heading) < 0, rot: 0, undead: false, bones: false, t: 1, pooled: false, horse: true }); }
      d.state = "down"; d.hp = 0; d.blocking = false; d.vx = d.vy = 0; d.ko = true;
      if (d.hero) {
        this.camFree = true; this.cmdOpen = false;
        this.say("Padłeś ogłuszony. Oddziały bez oficera ruszają do szarży.", PAL.redL, true);
        this.shout("Padłeś!", PAL.redL);
        this.slowT = 1;
        for (const u of this.units) if (u.team === 0 && !u.hero) u.morale -= 20;
        this.heroDown();
      } else { this.sfx.death(s.v * 0.6, s.pan, false); this.say(`${d.name} pada na piasek.`); }
      return;
    }
    if (d.companion) { d.state = "down"; d.hp = 0; d.ko = true; this.say(`${d.name} pada ranny!`, PAL.redL, true); this.sfx.scream(s.v, s.pan); for (const u of this.units) if (u.team === 0 && u.squad === d.squad && u.active) u.morale -= 12; if (!this.heroUp && this.orders[d.squad]) this.orders[d.squad].mode = "charge"; return; }
    d.state = "dead";
    if (d.def.undead) this.sfx.death(s.v * 0.8, s.pan, true);
    else { this.sfx.death(s.v * 0.8, s.pan, false); if (chance(0.5)) this.sfx.scream(s.v * 0.8, s.pan, d.def.culture); }
    if (d.mounted) { d.mounted = false; if (d.horseHp > d.horseMax * 0.3 && !d.mountDef?.undead && chance(0.6)) this.looseHorses.push({ x: d.x + 8, y: d.y + 2, heading: d.heading, def: d.mountDef, hp: d.horseHp, max: d.horseMax, horse: d.horse }); else { const [hd] = this.dirIndex(d.heading); this.corpses.push({ x: d.x + 4, y: d.y + 3, img: d.horse.frames[hd][0], flip: Math.cos(d.heading) < 0, rot: 0, undead: false, bones: false, t: 1, pooled: false, horse: true }); } }
    const [dirI] = this.dirIndex(d.face);
    const bones = !!d.def.undead && d.look.race === "skel";
    // ćwiartowanie: ciężkie cięcie albo cios w głowę może odrąbać głowę lub kończynę
    const sever = this.settings.gore !== false && (type === "cut" && (heavy || head) && chance(head ? 0.6 : 0.35)) || (src?.hero && type === "cut" && chance(0.15));
    let img = d.spr.frames[dirI][0];
    if (sever && d.look.race !== "ghoul" && d.look.race !== "wolf" && d.look.race !== "dk") {
      img = d.spr.headless[dirI];
      const a = src ? Math.atan2(d.y - src.y, d.x - src.x) : rr(0, 6.28);
      this.parts.push({ x: d.x, y: d.y, z: d.spr.h - d.spr.headY - 2, vx: Math.cos(a) * rr(50, 90), vy: Math.sin(a) * rr(30, 60), vz: rr(60, 110), life: 3, max: 3, col: "", kind: "head", img: headSprite(d.look), rot: 0 });
      if (!d.def.undead) for (let i = 0; i < 26; i++) this.parts.push({ x: d.x + rr(-1, 1), y: d.y, z: d.spr.h - d.spr.headY - 6, vx: rr(-30, 30), vy: rr(-20, 20), vz: rr(40, 120), life: 2, max: 2, col: pick([PAL.blood, PAL.bloodL, PAL.bloodD]), kind: "blood" });
      if (src?.hero) { if (this.settings.killSlow !== false) this.slowT = Math.max(this.slowT, 0.35); this.shake(2); }
    } else if (this.settings.gore !== false && type === "cut" && heavy && chance(0.25) && d.look.race !== "wolf") {
      const a = src ? Math.atan2(d.y - src.y, d.x - src.x) : rr(0, 6.28);
      this.parts.push({ x: d.x, y: d.y, z: 14, vx: Math.cos(a) * rr(40, 80), vy: Math.sin(a) * rr(20, 50), vz: rr(50, 90), life: 3, max: 3, col: d.def.undead ? PAL.bone : d.look.skin[0], kind: "limb", rot: 0 });
    }
    const fa = src ? Math.atan2(d.y - src.y, d.x - src.x) : rr(0, 6.28), fk = heavy ? 1.6 : 1;
    // śmierć zależna od ciosu: pchnięcie odrzuca do tyłu, obuch zgniata, cięcie obraca
    this.corpses.push({ x: d.x, y: d.y, img, flip: Math.cos(d.face) < 0, rot: src && Math.cos(fa) < 0 ? -1 : 1, undead: !!d.def.undead, bones, t: 0, pooled: false, kind: type, dx: Math.cos(fa) * (type === "pierce" ? 10 : type === "blunt" ? 3 : 5) * fk, dy: Math.sin(fa) * (type === "pierce" ? 6 : 2) * fk });
    if (bones) this.bones(d.x, d.y - 10, 14, src);
    else if (!d.def.undead) this.blood(d.x, d.y - 10, 20, src, true);
    this.dropGear(d, fa);
    for (const u of this.units) {
      if (!u.active || u.def.undead) continue;
      const near = dist(u.x, u.y, d.x, d.y) < 100;
      if (u.team === d.team && near) u.morale -= 7;
      if (u.team !== d.team && near) u.morale = Math.min(100, u.morale + 3);
    }
    if (d.officer && d.team === 0) {
      for (const u of this.units) if (u.team === 0 && u.squad === d.squad && u.active) u.morale -= 28;
      this.say(`Oficer oddziału ${SQUAD_NAMES[d.squad] || ""} poległ!`, PAL.redL, true);
      if (!this.heroUp && this.orders[d.squad]) this.orders[d.squad].mode = "charge";
    }
    if (d.commander) this.commanderDown(d);
    if (src?.hero) { if (this.heroCfg) this.heroCfg.mana = Math.min(100, this.heroCfg.mana + this.P("soulMana")); if (this.P("terror")) for (const u of this.units) if (u.team === d.team && u.active && dist(u.x, u.y, d.x, d.y) < 80) u.morale -= 6;
      this.say(`Zabiłeś: ${d.def.name}`); for (const u of this.units) if (u.team === 0 && u.active && !u.hero && dist(u.x, u.y, src.x, src.y) < 130) u.morale = Math.min(100, u.morale + (heavy ? 8 : 5)); }
  }

  heroDown() {
    for (const sq of this.liveSquads()) {
      const off = this.units.find((u) => u.team === 0 && u.squad === sq && u.officer && u.active);
      if (off) this.say(`${SQUAD_NAMES[sq]}: ${off.companion ? off.name : "oficer"} przejmuje dowodzenie.`, PAL.gold);
      else { this.ensureOrder(sq).mode = "charge"; this.orders[sq].flank = null; }
    }
    this.sfx.battleCry(1);
  }
  officerAI() {
    if (this.heroUp) return;
    for (const sq of this.liveSquads()) {
      const off = this.units.find((u) => u.team === 0 && u.squad === sq && u.officer && u.active);
      const o = this.ensureOrder(sq);
      if (!off) { o.mode = "charge"; continue; }
      const c = this.centroid(0, sq);
      let near = 1e9;
      for (const e of this.units) if (e.team === 1 && e.active && !e.hidden) near = Math.min(near, dist(c.x, c.y, e.x, e.y));
      const list = this.squadUnits(sq);
      if (this.cfg.terrain === "siege" && this.cfg.siegeDefender === 1) { o.mode = "charge"; continue; }
      if (this.time > 90 && near > 200) { o.mode = "charge"; continue; }
      if (list.some((u) => u.def.bow)) {
        const ammo = list.reduce((s, u) => s + u.ammo, 0);
        if (ammo === 0) { o.mode = "charge"; o.meleeOnly = true; }
        else if (near < 55 && o.mode !== "charge") this.orderRetreat([sq]);
        else if (o.mode !== "hold") { o.mode = "hold"; o.ax = c.x; o.ay = c.y; o.face = undefined; }
      } else {
        if (near < 120) o.mode = "charge";
        else if (o.mode === "charge" && near > 220) { o.mode = "hold"; o.ax = c.x; o.ay = c.y; o.face = undefined; }
      }
    }
  }

  // Śmierć dowódcy: nieumarli słabną bez klątwy, żywi tracą morale.
  commanderDown(d: Unit) {
    if (d.def.undead || d.key === "u_necro") {
      this.sfx.wail();
      this.shout(`${d.def.name} padł!`, PAL.purpleL);
      this.say("Klątwa słabnie: nieumarli są wolniejsi i słabsi.", PAL.purpleL, true);
      this.slowT = 1.2; this.shake(4);
      for (let i = 0; i < 50; i++) this.parts.push({ x: d.x + rr(-6, 6), y: d.y, z: rr(4, 24), vx: rr(-20, 20), vy: rr(-20, 20), vz: rr(20, 70), life: 1.4, max: 1.4, col: pick([PAL.purpleL, PAL.purple]), kind: "soul" });
      this.say("Nieumarli rozsypują się w proch!", PAL.purpleL, true);
      for (const u of this.units) if (u.team === d.team && u.active && u.def.undead && u.key !== "u_dk" && u.key !== "u_necro") { u.decay = true; u.crumbleT = rr(1.5, 16); }
    } else {
      this.shout(`Dowódca wroga padł!`, PAL.gold);
      this.say("Wróg traci ducha!", PAL.gold, true);
      for (const u of this.units) if (u.team === d.team && u.active) u.morale -= 30;
    }
    for (const u of this.units) if (u.team !== d.team && u.active) u.morale = Math.min(100, u.morale + 25);
  }

  reveal(u: Unit) {
    const sq = u.squad, team = u.team;
    let any = false;
    for (const o of this.units) if (o.team === team && o.squad === sq && o.hidden) { o.hidden = false; any = true; }
    const ord = this.ordersOf(team, sq);
    if (ord && ord.mode === "ambush") ord.mode = "charge";
    if (!any) return;
    if (team === 1) { this.say("Zasadzka! Wróg wypada z ukrycia!", PAL.purpleL, true); this.sfx.moan(1, 0); this.sfx.battleCry(0.5); this.shake(2); }
    else { this.say(`${SQUAD_NAMES[sq]}: z zasadzki, naprzód!`, PAL.gold); this.sfx.battleCry(0.8); for (const o of this.units) if (o.team === 0 && o.squad === sq) o.morale = Math.min(100, o.morale + 15); }
  }

  // ---------- Pociski ----------
  fire(u: Unit, a: number, speed: number, dmg: number, d: number, kind: Arrow["kind"]) {
    const oy = u.mounted ? 24 : 14;
    if (!u.hero && this.height(u.x, u.y) > 0.3) dmg *= 1.1;
    this.arrows.push({ x: u.x + Math.cos(a) * 6, y: u.y - oy + Math.sin(a) * 6, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, team: u.team, src: u, dmg, age: 0, travel: 0, dist: d, done: false, kind });
    if (u.hidden) this.reveal(u);
    const s = this.vol(u.x);
    if (kind === "fire") this.sfx.fireball(s.v, s.pan); else this.sfx.bow(s.v * (u.hero ? 1 : 0.35), s.pan);
  }
  updateArrows(dt: number) {
    for (const ar of this.arrows) {
      if (ar.done) continue;
      const step = Math.hypot(ar.vx, ar.vy) * dt;
      ar.x += ar.vx * dt; ar.y += ar.vy * dt; ar.age += dt; ar.travel += step;
      const p = ar.travel / ar.dist;
      if (ar.kind === "fire") {
        if (chance(dt * 40)) this.parts.push({ x: ar.x, y: ar.y + 10, z: 10, vx: rr(-10, 10), vy: rr(-10, 10), vz: rr(5, 20), life: 0.4, max: 0.4, col: pick([PAL.gold, PAL.redL]), kind: "fire" });
        let hitU = false;
        for (const u of this.units) if (u.active && u.team !== ar.team && dist(u.x, u.y - 12, ar.x, ar.y) < u.radius + 4) { hitU = true; break; }
        if (hitU || p >= 1 || !this.passable(ar.x, ar.y + 10)) { ar.done = true; explodeFire(this, ar.x, ar.y + 10, ar.dmg, ar.src); }
        continue;
      }
      if (p > 0.55 && ar.kind !== "axe") for (const o of this.map.obstacles) if (o.cover && Math.abs(o.x - ar.x) < 12 && Math.abs(o.y - (ar.y + 12)) < 7) { ar.done = true; const s2 = this.vol(ar.x); this.sfx.thunk(s2.v * 0.4, s2.pan); this.sparks(ar.x, ar.y + 8, 2, PAL.stone); break; }
      if (ar.done) continue;
      const low = ar.travel < 14 || p > 0.78;
      if (low && ar.age > 0.03) {
        for (const u of this.units) {
          if (!u.active || u === ar.src) continue;
          if (u.team === ar.team && ar.travel >= 14 && p < 0.92) continue;
          if (dist(u.x, u.y - (u.mounted ? 16 : 12), ar.x, ar.y) > u.radius + (u.team === ar.team ? 1 : 3)) continue;
          this.arrowHit(ar, u);
          if (ar.done) break;
        }
      }
      if (!ar.done && (p > 1.15 || ar.x < 0 || ar.y < 0 || ar.x > this.mw || ar.y > this.mh)) {
        ar.done = true;
        const a = Math.atan2(ar.vy, ar.vx);
        if (ar.kind === "arrow" && ar.x > 0 && ar.y > 0 && ar.x < this.mw && ar.y < this.mh && chance(0.6)) { this.groundArrows.push({ x: ar.x, y: ar.y + 12 }); if (this.groundArrows.length > 250) this.groundArrows.shift(); }
        if (ar.kind === "axe") { this.dg.fillStyle = PAL.steel; this.dg.fillRect(Math.round(ar.x), Math.round(ar.y + 12), 3, 2); }
        else { pxLine(this.dg, ar.x, ar.y + 12, ar.x - Math.cos(a) * 4, ar.y + 12 - Math.sin(a) * 4, PAL.woodD); this.dg.fillStyle = PAL.white; this.dg.fillRect(Math.round(ar.x - Math.cos(a) * 4), Math.round(ar.y + 12 - Math.sin(a) * 4), 1, 1); }
      }
    }
    this.arrows = this.arrows.filter((a) => !a.done);
  }
  arrowHit(ar: Arrow, u: Unit) {
    const back = Math.atan2(-ar.vy, -ar.vx);
    const facing = Math.abs(angDiff(u.face, back));
    const s = this.vol(u.x);
    if (u.team === 0 && !u.hero && (this.ordersOf(0, u.squad)?.spacing || 1) > 1 && chance(0.25)) return;
    ar.done = true;
    if (this.inForest(u.x, u.y) && chance(0.4)) { this.sfx.thunk(s.v * 0.3, s.pan); return; }
    // blanki: strzały z zewnątrz często grzęzną w kamieniu
    if (this.onWall(u) && this.map.wall && ar.vx * (this.cfg.siegeDefender === 0 ? 1 : 1) > 0 && chance(0.5)) { this.sfx.thunk(s.v * 0.35, s.pan); this.sparks(u.x - 4, u.y - 10, 2, PAL.stone); return; }
    if (u.hero && u.blocking && !u.weaponBlock && facing < 1.25) { this.sfx.thunk(1, s.pan); this.sparks(u.x, u.y - 12, 3, PAL.wood); return; }
    if (!u.hero && u.hasShield && u.state === "idle" && facing < 1.1) {
      const wall = u.team === 0 && this.ordersOf(0, u.squad)?.formation === "wall";
      if (chance(wall ? 0.88 : 0.5)) { this.sfx.thunk(s.v * 0.6, s.pan); return; }
    }
    if (u.hero && chance(this.P("arrowDodge"))) { this.floater(u.x, u.y - 30, "UNIK", PAL.boneHi, true); return; }
    const head = chance(0.12);
    const type: DmgType = ar.kind === "axe" ? "cut" : "pierce";
    const dmg = ar.dmg * u.arm[type] * rr(0.85, 1.15) * (head ? 1.5 : 1) * (u.hero ? 1 - this.P("arrowRes") : 1) * (ar.src.hero && head ? 1 + this.P("headDmg") : 1);
    if (ar.src.team === u.team && ar.src.hero) this.say("Trafiłeś swojego!", PAL.redL);
    this.sfx.arrowHit(s.v, s.pan);
    if (u.mounted && chance(0.5)) { u.horseHp -= dmg * 1.3; this.blood(u.x, u.y - 8, 6, null); if (u.horseHp <= 0) this.dismount(u); return; }
    this.damage(u, dmg, null, head, type, false);
    this.push(u, u.x - ar.vx, u.y - ar.vy, 20);
    if (ar.src.hero) this.hitstop = Math.max(this.hitstop, 0.05);
  }

  // ---------- AI ----------
  isVisibleTo(e: Unit, viewer: Unit) {
    if (this.fogged && dist(e.x, e.y, viewer.x, viewer.y) > 170) return false;
    if (!e.hidden) return true;
    const night = this.cfg.night ? 0.6 : 1;
    return dist(e.x, e.y, viewer.x, viewer.y) < (this.inForest(e.x, e.y) ? 40 : 80) * night;
  }

  // Omijanie przeszkód liniowych: rzeka i mury mają przeprawy, przez które trzeba przejść.
  waypoint(u: Unit, tx: number, ty: number): V {
    const B = this.map.barrier;
    if (!B) return { x: tx, y: ty };
    const side = (x: number) => (x < B.x0 ? -1 : x > B.x1 ? 1 : 0);
    const su = side(u.x), st = side(tx);
    if (su === st || su === 0) return { x: tx, y: ty };
    const usable = B.crossings.filter((c) => !c.gate || (this.map.wall && this.map.wall.broken) || (this.map.wall && u.team !== this.cfg.siegeDefender && !this.map.wall.broken && this.ordersOf(u.team, u.squad)?.mode === "charge"));
    if (!usable.length) return { x: tx, y: ty };
    let best = usable[0], bd = 1e9;
    for (const c of usable) { const d = Math.abs(c.y - u.y) + Math.abs(c.y - ty) * 0.5; if (d < bd) { bd = d; best = c; } }
    if (Math.abs(u.y - best.y) < best.h * 0.6) return { x: su < 0 ? B.x1 + 20 : B.x0 - 20, y: best.y };
    return { x: su < 0 ? B.x0 - 14 : B.x1 + 14, y: best.y };
  }

  updateAI(u: Unit, dt: number) {
    if (u.def.speed === 0) { u.vx = 0; u.vy = 0; u.moving = false; return; }
    if (u.decay) {
      u.hp -= 1.3 * dt;
      if (chance(dt * 3)) this.parts.push({ x: u.x + rr(-4, 4), y: u.y, z: rr(4, 20), vx: rr(-6, 6), vy: rr(-6, 6), vz: rr(8, 20), life: 0.8, max: 0.8, col: PAL.purpleL, kind: "soul" });
      if (u.hp <= 0) { this.kill(u, null); return; }
    }
    if (u.state === "stagger" || u.state === "kick") { u.moving = false; if (u.mounted) this.ride(u, u.x + Math.cos(u.heading) * 30, u.y + Math.sin(u.heading) * 30, 0, dt); return; }
    if ((u.def.ability || u.compAb) && !u.hero) unitAbilityAI(this, u, dt);

    const walled = this.map.wall && u.team === (this.cfg.siegeDefender ?? 1) && !this.map.wall.broken; // obrońcy za murami nie mają dokąd uciekać
    if (!u.def.undead && !u.fleeing && u.morale < (walled ? 4 : 18) && !this.cfg.arena && u.lifeT <= 0) {
      // przy przewadze wroga część się poddaje (więcej jeńców), reszta ucieka
      const foesNear = this.units.some((e) => e.team !== u.team && e.active && dist(e.x, e.y, u.x, u.y) < 40);
      if (u.team === 1 && foesNear && u.def.culture !== "monster" && chance(0.4)) { u.surrendered = true; u.state = "fled"; this.say(`${u.def.name} rzuca broń i się poddaje!`, PAL.gold); this.floater(u.x, u.y - 30, "PODDAJE SIĘ", PAL.boneHi, true); return; }
      u.fleeing = true; this.say(`${u.def.name} ucieka z pola bitwy!`, PAL.ash);
    }
    if (u.fleeing) {
      const ec = this.centroid(1 - u.team);
      const a = Math.atan2(u.y - ec.y, u.x - ec.x);
      const wp = this.waypoint(u, u.x + Math.cos(a) * 200, u.y + Math.sin(a) * 200);
      if (u.mounted) this.ride(u, wp.x, wp.y, u.maxRide, dt);
      else this.steer(u, wp.x, wp.y, u.def.speed * 1.15, dt);
      u.wantFace = a;
      if (u.x < 4 || u.y < 4 || u.x > this.mw - 4 || u.y > this.mh - 4) u.state = "fled";
      u.morale += dt * 2;
      if (u.morale > 45 && chance(dt * 0.3)) { u.fleeing = false; this.say(`${u.def.name} wraca do walki.`, PAL.ash); }
      return;
    }

    const o = this.ordersOf(u.team, u.squad);
    let mode: Mode = o ? o.mode : "charge";
    if (u.key === "o_berserk" && this.time > 3) mode = "charge";   // berserkerzy wybiegają przed szereg
    if (mode === "ambush") {
      this.steer(u, u.slotX, u.slotY, u.def.speed * 0.5, dt, 3);
      for (const e of this.units) if (e.team !== u.team && e.active && dist(e.x, e.y, u.x, u.y) < (u.team === 1 ? 85 : 60)) { this.reveal(u); break; }
      return;
    }
    if (mode === "flank" && o.flank) {
      const c = this.centroid(u.team, u.squad);
      if (dist(c.x, c.y, o.flank.x, o.flank.y) < 45) { o.mode = "charge"; o.flank = null; if (u.team === 0 && u.squad <= 8) this.say(`${SQUAD_NAMES[u.squad]}: uderzamy w skrzydło!`, PAL.gold); }
    }
    const fire = o ? o.fire && !o.meleeOnly : true;
    const engage = mode === "charge" ? 9999 : mode === "hold" ? (u.mounted ? 60 : 36) : mode === "flank" ? 28 : 60;

    u.retarget -= dt;
    if (u.retarget <= 0 || !u.target || !u.target.active || !this.isVisibleTo(u.target, u)) { u.retarget = rr(0.35, 0.7); u.target = this.chooseTarget(u, o); }
    const t = u.target;
    const td = t ? dist(u.x, u.y, t.x, t.y) : 1e9;

    if (u.bowDmg > 0 && t && !u.mounted && !u.hero) {
      const near = this.nearestEnemy(u);
      const closeThreat = near && dist(u.x, u.y, near.x, near.y) < 28;
      // strzelec cofa się przed piechotą, zamiast od razu sięgać po nóż
      if (closeThreat && u.ammo > 0 && !near.def.bow && !near.mounted && u.def.tier >= 2 && u.kiteT <= 0 && chance(dt * 2)) u.kiteT = 1.1;
      if (u.kiteT > 0 && near) { const a = Math.atan2(u.y - near.y, u.x - near.x); this.steer(u, u.x + Math.cos(a) * 40, u.y + Math.sin(a) * 40, u.def.speed * 1.05, dt); u.wantFace = a + Math.PI; return; }
      const bow = u.def.bow || { dmg: u.bowDmg, range: 230, reload: 2.2, spread: 0.06 };
      const range = bow.range * (this.height(u.x, u.y) > 0.3 ? 1.3 : 1) * (this.cfg.night ? 0.75 : 1) * (this.fogged ? 0.6 : 1) * (this.cfg.rain ? 0.85 : 1);
      if (!closeThreat && fire && u.ammo > 0 && td < range && mode !== "charge") {
        if (o?.volley) { u.wantFace = Math.atan2(t.y - u.y, t.x - u.x); u.moving = false; u.reload = Math.max(u.reload, 0.05); return; }   // czekają na salwę
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
            const a = Math.atan2(ty - (u.y - 12), tx - u.x) + rr(-1, 1) * bow.spread * (1 + td / 260) * (u.decay ? 1.6 : 1) * (this.cfg.rain ? 1.4 : 1);
            this.fire(u, a, bow.bolt ? 360 : bow.axe ? 220 : 300, bow.dmg * (this.cfg.rain && !bow.bolt ? 0.8 : 1), dist(u.x, u.y, tx, ty), bow.bolt ? "bolt" : bow.axe ? "axe" : "arrow");
            u.ammo--; u.reload = bow.reload * rr(0.85, 1.25) * (u.team === 0 ? 1 - this.P("volleyB") : 1);
          }
        }
        return;
      }
      if (closeThreat) u.target = near;
    }

    const tgt = u.target;
    const tdist = tgt ? dist(u.x, u.y, tgt.x, tgt.y) : 1e9;
    const slotDist = tgt ? dist(u.slotX, u.slotY, tgt.x, tgt.y) : 1e9;
    const leash = mode === "hold" ? 24 : mode === "follow" ? 44 : 9999;
    const engaged = !!tgt && (mode === "charge" || (slotDist < engage + 18 && tdist < engage + leash));
    // oblężenie: część atakujących pcha taran i wieżę
    const W2 = this.map.wall;
    // drabiny: co szósty atakujący niesie drabinę pod mur
    const placed = W2 ? (W2 as any).placed as boolean[] : null;
    if (W2 && placed && u.team !== this.cfg.siegeDefender && !u.def.bow && !u.mounted && u.id % 6 === 1 && placed.some((p) => !p)) {
      let li = u.id % placed.length; if (placed[li]) li = placed.indexOf(false);
      const px = W2.x0 - 10, py = W2.ladders[li];
      u.carry = li;
      if (dist(u.x, u.y, px, py) > 6) { this.steer(u, px, py, u.def.speed * 0.8, dt); return; }
      u.carryT = (u.carryT || 0) + dt; u.moving = false;
      if (u.carryT > 2) { u.carryT = 0; u.carry = -1; this.placeLadder(li); }
      return;
    }
    u.carry = -1;
    if (W2 && u.team !== this.cfg.siegeDefender && !u.def.bow && !u.mounted && u.id % 4 === 0 && (!tgt || tdist > 40)) {
      const open = this.engines.filter((en) => !en.done && en.x < en.tx);
      const e = open.length ? open[(u.id >> 2) % open.length] : null;
      if (e) { const px = e.x - 16, py = e.y + ((u.id % 3) - 1) * 9; if (dist(u.x, u.y, px, py) > 4) this.steer(u, px, py, u.def.speed, dt); else { u.moving = false; u.vx = 0; u.vy = 0; } u.wantFace = 0; return; }
    }
    // oblężenie: atakujący bez celu w zasięgu szturmują bramę
    if (W2 && !W2.broken && u.team !== this.cfg.siegeDefender && mode === "charge" && !u.def.bow && u.x < W2.x0 && (!tgt || tdist > 60) && (u.id % 3 === 0)) {
      const gx = W2.x0 - 10, gy = W2.gateY + ((u.id % 5) - 2) * 7;
      if (dist(u.x, u.y, gx, gy) > 12) this.steer(u, gx, gy, u.def.speed, dt); else { u.moving = false; u.wantFace = 0; if (u.state === "idle" && u.cooldown <= 0) this.startWindup(u, pick<Dir>(["L", "R", "O"])); }
      return;
    }

    if (u.mounted) { this.mountedAI(u, tgt, engaged, dt); return; }

    if (engaged && tgt) {
      const want = u.w.reach - 1 + tgt.radius;
      const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      if (u.state === "idle" || u.state === "recover" || u.state === "windup") u.wantFace = a;
      const spd = u.def.speed * (u.decay ? 0.8 : 1) * (u.cursedT > 0 ? 0.7 : 1) * (u.bloodRiteT > 0 ? 1.2 : 1);
      if (tdist > want) {
        const wp = this.waypoint(u, tgt.x, tgt.y);
        let side = 0;
        for (const f of this.units) if (f !== u && f.team === u.team && f.active && f.target === tgt && dist(f.x, f.y, u.x, u.y) < 12) side += angDiff(a, Math.atan2(f.y - u.y, f.x - u.x)) > 0 ? -1 : 1;
        const da = Math.atan2(wp.y - u.y, wp.x - u.x) + clamp(side, -1, 1) * 0.9;
        this.steer(u, u.x + Math.cos(da) * 30, u.y + Math.sin(da) * 30, spd * (u.state === "windup" ? 0.5 : 1), dt);
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
        if (u.idleGuardT <= 0) { u.idleGuardT = rr(1, 2.4); if (chance(0.45)) { u.guard = pick<Dir>(["L", "R", "O", "T"]); u.guardT = rr(0.8, 1.6); } }
      }
    } else {
      const d = dist(u.x, u.y, u.slotX, u.slotY);
      const formSpeed = u.team === 0 && this.ordersOf(0, u.squad)?.formation === "wall" ? 0.65 : 1;
      const spd = u.def.speed * formSpeed * (d > 40 ? 1.15 : 1) * (u.decay ? 0.8 : 1);
      const wp = this.waypoint(u, u.slotX, u.slotY);
      if (d > 2) this.steer(u, wp.x, wp.y, spd, dt, wp.x === u.slotX ? 3 : 0);
      else { u.vx *= 0.8; u.vy *= 0.8; u.moving = false; }
      u.wantFace = d < 8 ? u.slotFace : Math.atan2(wp.y - u.y, wp.x - u.x);
    }
  }

  mountedAI(u: Unit, tgt: Unit | null, engaged: boolean, dt: number) {
    const max = u.maxRide;
    if (u.wheelTo) {
      this.ride(u, u.wheelTo.x, u.wheelTo.y, max * 0.85, dt);
      if (dist(u.x, u.y, u.wheelTo.x, u.wheelTo.y) < 25 || u.x < 30 || u.x > this.mw - 30 || u.y < 30 || u.y > this.mh - 30) u.wheelTo = null;
      return;
    }
    if (engaged && tgt) {
      const d = dist(u.x, u.y, tgt.x, tgt.y);
      const a = Math.atan2(tgt.y - u.y, tgt.x - u.x);
      const ahead = Math.cos(angDiff(u.heading, a));
      const side = angDiff(u.heading, a) < 0 ? -1 : 1;
      const wp = this.waypoint(u, tgt.x, tgt.y);
      const px = wp.x === tgt.x ? tgt.x - Math.sin(a) * side * 9 + Math.cos(a) * 22 : wp.x, py = wp.x === tgt.x ? tgt.y + Math.cos(a) * side * 9 + Math.sin(a) * 22 : wp.y;
      this.ride(u, px, py, max, dt);
      if (u.state === "idle" || u.state === "windup") u.wantFace = a;
      if (u.state === "idle" && u.cooldown <= 0 && d < u.w.reach + 28) this.startWindup(u, angDiff(u.heading, a) < 0 ? "L" : "R");
      if (d < 28 && ahead < 0 && u.rspeed > 40) { u.wheelTo = { x: clamp(u.x + Math.cos(u.heading) * 120, 40, this.mw - 40), y: clamp(u.y + Math.sin(u.heading) * 120, 40, this.mh - 40) }; u.target = null; u.retarget = 0; }
      return;
    }
    const d = dist(u.x, u.y, u.slotX, u.slotY);
    const wp = this.waypoint(u, u.slotX, u.slotY);
    if (d > 6) this.ride(u, wp.x, wp.y, Math.min(max * 0.7, d * 1.5), dt);
    else { this.ride(u, u.x + Math.cos(u.heading) * 30, u.y + Math.sin(u.heading) * 30, 0, dt); if (u.rspeed < 5) u.heading += clamp(angDiff(u.heading, u.slotFace), -dt * 1.5, dt * 1.5); }
  }

  nearestEnemy(u: Unit): Unit | null {
    let b: Unit | null = null, bd = 1e9;
    for (const e of this.units) { if (e.team === u.team || !e.active || !this.isVisibleTo(e, u)) continue; const d = dist(u.x, u.y, e.x, e.y); if (d < bd) { bd = d; b = e; } }
    return b;
  }
  chooseTarget(u: Unit, o?: Order): Unit | null {
    if (u.commander && this.heroUp && dist(u.x, u.y, this.hero.x, this.hero.y) < 150) return this.hero;
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
      if (!u.def.bow && Math.abs(angDiff(u.slotFace, Math.atan2(e.y - u.y, e.x - u.x))) > 1.2) s += 30;
      if (pref != null && e.squad === pref) s -= 400;
      if (u.mounted && e.def.bow && !e.mounted) s -= 120;
      if (u.mounted && (this.inForest(e.x, e.y) || this.cell(e.x, e.y) === 1)) s += 200;   // jazda omija las i bagno
      if (u.def.bow) { if (e.hasShield && Math.abs(angDiff(e.face, Math.atan2(u.y - e.y, u.x - e.x))) < 1.0) s += 70; if (e.target && e.target !== u && e.state !== "idle") s -= 40; if (!e.hasShield) s -= 20; }
      if (e.commander && !u.def.bow) s += 40;
      if (u.def.bow) for (const f of this.units) if (f.team === u.team && f.active && dist(f.x, f.y, e.x, e.y) < 30) { s += 600; break; }
      // za murami: trudno dosięgnąć
      if (this.map.barrier && Math.sign(u.x - this.map.barrier.x0) !== Math.sign(e.x - this.map.barrier.x0) && !u.def.bow) s += 120;
      if (s < bs) { bs = s; b = e; }
    }
    return b;
  }

  steer(u: Unit, tx: number, ty: number, speed: number, dt: number, arrive = 0) {
    let dx = tx - u.x, dy = ty - u.y;
    const d = Math.hypot(dx, dy) || 1;
    let sp = speed * this.slowAt(u.x, u.y) * (this.cfg.rain ? 0.92 : 1) * (u.legT > 0 ? 0.55 : 1) * this.slope(u, tx, ty) * (1 - 0.25 * u.fatigue);
    if (arrive && d < arrive * 4) sp *= d / (arrive * 4);
    dx /= d; dy /= d;
    let sx = 0, sy = 0;
    for (const o of this.units) {
      if (o === u || !o.active) continue;
      const ox = u.x - o.x, oy = u.y - o.y;
      if (Math.abs(ox) > 22 || Math.abs(oy) > 22) continue;
      const r = o.mounted ? 20 : 14, od = Math.hypot(ox, oy);
      if (od < r && od > 0.01) { const k = ((r - od) / r) * (o.team === u.team ? 1.2 : 0.6); sx += (ox / od) * k; sy += (oy / od) * k; }
    }
    for (const ob of this.map.obstacles) {
      if (!ob.r) continue;
      const ox = u.x - ob.x, oy = u.y - ob.y;
      if (Math.abs(ox) > 30 || Math.abs(oy) > 30) continue;
      const od = Math.hypot(ox, oy);
      if (od < ob.r + 14 && od > 0.01) { const k = (ob.r + 14 - od) / 14; sx += (ox / od) * k * 1.5; sy += (oy / od) * k * 1.5; }
    }
    // unikaj wody i murów: badaj komórkę przed sobą
    const ahead = 10;
    if (!this.passable(u.x + dx * ahead, u.y + dy * ahead)) {
      const l = this.passable(u.x - dy * ahead, u.y + dx * ahead), r = this.passable(u.x + dy * ahead, u.y - dx * ahead);
      if (l) { sx += -dy * 1.5; sy += dx * 1.5; } else if (r) { sx += dy * 1.5; sy += -dx * 1.5; }
    }
    const vx = (dx + sx) * sp, vy = (dy + sy) * sp;
    u.vx = lerp(u.vx, vx, clamp(dt * 6, 0, 1));
    u.vy = lerp(u.vy, vy, clamp(dt * 6, 0, 1));
    u.moving = sp > 5;
  }

  // Generał AI: używany dla wroga i dla sojuszników. Linia naciera, skrzydło oskrzydla, strzelcy wspierają, jazda uderza w bok.
  general(team: number, ord: Record<number, Order>, lineSq: number, wingSq: number, rangedSq: number, cavSq: number, specialSq: number) {
    const foe = 1 - team;
    const pc = this.centroid(foe);
    const line = ord[lineSq], wing = ord[wingSq], arc = ord[rangedSq], cav = ord[cavSq], spec = ord[specialSq];
    const lc = this.centroid(team, lineSq);
    const siege = this.cfg.terrain === "siege";
    const defending = siege && this.cfg.siegeDefender === team;
    if (this.cfg.arena) { for (const k of Object.keys(ord)) { ord[Number(k)].mode = "charge"; ord[Number(k)].flank = null; } return; }
    // orkowie: szarża z rykiem, mało formacji
    if (!siege && !this.orcCry[team] && this.time > 4) {
      const L = this.units.filter((u) => u.team === team && u.active);
      if (L.length && L.filter((u) => u.def.culture === "orc").length > L.length * 0.6) {
        this.orcCry[team] = true; this.charge[team] = true;
        for (const k of Object.keys(ord)) { const o = ord[Number(k)]; if (o.mode !== "ambush") { o.mode = "charge"; o.flank = null; o.formation = "loose"; } }
        this.sfx.battleCry(1, "orc"); this.say(team === 1 ? "Orkowie ryczą i rzucają się do szarży!" : "Twoi orkowie ryczą i ruszają!", PAL.redL, true); this.shake(2);
      }
    }
    if (defending) {
      // obrońcy trzymają mury i bramę, ruszają tylko na wrogów w środku
      let inside = 0;
      for (const u of this.units) if (u.team === foe && u.active && u.x > this.map.wall.x0) inside++;
      if (inside > 0 || this.map.wall.broken) { if (line) line.mode = "charge"; if (cav) cav.mode = "charge"; if (spec) spec.mode = "charge"; }
      return;
    }
    // przewaga albo przeciągająca się bitwa: wszyscy do szarży; strzelcy bez strzał też
    const mineN = this.units.filter((u) => u.team === team && u.active).length, foeN = this.units.filter((u) => u.team === foe && u.active).length;
    if (!siege && (this.time > 110 || (this.time > 25 && mineN > foeN * 2.5))) { for (const k of Object.keys(ord)) { const o = ord[Number(k)]; if (o.mode !== "ambush") { o.mode = "charge"; o.flank = null; } } this.charge[team] = true; return; }
    if (arc && this.squadUnits(rangedSq, team).length && this.squadUnits(rangedSq, team).every((u) => u.ammo <= 0)) arc.mode = "charge";
    let nearest = 1e9;
    for (const u of this.units) if (u.team === team && u.active && u.squad === lineSq)
      for (const p of this.units) if (p.team === foe && p.active && !p.hidden) { const d = dist(u.x, u.y, p.x, p.y); if (d < nearest) nearest = d; }
    if (!this.charge[team] && line) {
      const a = Math.atan2(pc.y - line.ay, pc.x - line.ax);
      if (!siege) { line.ax += Math.cos(a) * 9; line.ay += Math.sin(a) * 9; }
      if (nearest < 120 || this.time > (siege ? 25 : 70) || siege) {
        this.charge[team] = true; line.mode = "charge";
        if (team === 1) { this.say(siege ? "Wróg szturmuje mury!" : "Wróg rusza do szarży!", PAL.purpleL, true); this.sfx.wail(); }
      }
    }
    if (wing && wing.mode === "hold" && !wing.flank) {
      if (this.time > 14 && !siege) {
        const a = Math.atan2(pc.y - lc.y, pc.x - lc.x);
        let up = 0; for (const p of this.units) if (p.team === foe && p.active) up += p.y < pc.y ? 1 : -1;
        const side = up > 0 ? 1 : -1;
        wing.mode = "flank";
        wing.flank = { x: clamp(pc.x + Math.cos(a) * 40 - Math.sin(a) * side * 160, 30, this.mw - 30), y: clamp(pc.y + Math.sin(a) * 40 + Math.cos(a) * side * 160, 30, this.mh - 30) };
        if (team === 1) this.say("Część wroga obchodzi nasze skrzydło!", PAL.purpleL);
      } else if (line) { wing.ax = line.ax; wing.ay = line.ay - 140; if (siege) wing.mode = "charge"; }
    }
    if (arc) {
      const back = Math.atan2(lc.y - pc.y, lc.x - pc.x);
      let cavNear = false;
      for (const p of this.units) if (p.team === foe && p.active && p.mounted && dist(p.x, p.y, arc.ax, arc.ay) < 90) cavNear = true;
      arc.ax = clamp(lc.x + Math.cos(back) * (cavNear ? 120 : 60), 30, this.mw - 30); arc.ay = clamp(lc.y + Math.sin(back) * (cavNear ? 120 : 60), 30, this.mh - 30);
      // wzgórze lub las blisko własnej linii: strzelcy zajmują przewagę
      if (!cavNear) {
        const spot = [...this.map.hills, ...this.map.forests.map((f) => ({ ...f, forest: true }))].filter((h) => dist(h.x, h.y, lc.x, lc.y) < 260 && dist(h.x, h.y, pc.x, pc.y) > 140).sort((a, b) => dist(a.x, a.y, lc.x, lc.y) - dist(b.x, b.y, lc.x, lc.y))[0] as any;
        if (spot) { arc.ax = spot.x; arc.ay = spot.y; arc.formation = spot.forest ? "loose" : "line"; }
      }
      if (siege) { arc.ax = clamp(this.map.wall.x0 - 170, 30, this.mw); arc.ay = this.map.wall.gateY; }
    }
    if (cav && cav.mode === "hold") {
      if (this.charge[team] && this.time > 8) { cav.mode = "flank"; const a = Math.atan2(pc.y - lc.y, pc.x - lc.x); cav.flank = { x: clamp(pc.x - Math.sin(a) * 170, 30, this.mw - 30), y: clamp(pc.y + Math.cos(a) * 170, 30, this.mh - 30) }; }
      else if (line) { cav.ax = line.ax - Math.cos(Math.atan2(pc.y - line.ay, pc.x - line.ax)) * 40; cav.ay = line.ay + 170; }
    }
    if (spec && line) {
      const cmd = this.commanders.find((c) => c.team === team && c.active);
      if (cmd && cmd.hp < cmd.maxHp * 0.3 && arc) { spec.mode = "hold"; spec.ax = arc.ax; spec.ay = arc.ay; }
      else if (this.charge[team] && cmd && this.heroUp && dist(cmd.x, cmd.y, this.hero.x, this.hero.y) < 160) spec.mode = "charge";
      else { spec.mode = "hold"; const back = Math.atan2(lc.y - pc.y, lc.x - pc.x); spec.ax = lc.x + Math.cos(back) * 30; spec.ay = lc.y + Math.sin(back) * 30; }
    }
    // rezerwa wchodzi, gdy linia słabnie albo minęło trochę czasu
    if (team === 1 && ord[7] && !this.reserveOut && this.squadUnits(7, 1).length) {
      const lineN = this.squadUnits(lineSq, 1).length;
      if (this.time > 50 || (this.charge[team] && lineN < 10)) { this.reserveOut = true; ord[7].mode = "charge"; this.say("Wróg wprowadza rezerwę!", PAL.purpleL, true); this.sfx.horn(); }
    }
    // odwrót i przegrupowanie przy upadającym morale
    if (!this.regrouped[team] && this.time > 20) {
      const alive = this.units.filter((u) => u.team === team && u.active && !u.def.undead);
      const m = alive.length ? alive.reduce((s, u) => s + u.morale, 0) / alive.length : 100;
      if (alive.length > 8 && m < 38) {
        this.regrouped[team] = true;
        const back = Math.atan2(lc.y - pc.y, lc.x - pc.x);
        for (const k of [lineSq, wingSq]) { const o = ord[k]; if (!o) continue; o.mode = "hold"; o.flank = null; o.ax = clamp(lc.x + Math.cos(back) * 160, 40, this.mw - 40); o.ay = clamp(lc.y + Math.sin(back) * 160, 40, this.mh - 40); o.face = back + Math.PI; }
        this.charge[team] = false; this.regroupT = this.time + 12;
        for (const u of alive) u.morale = Math.min(100, u.morale + 18);
        if (team === 1) this.say("Wróg cofa się i przegrupowuje!", PAL.gold, true);
      }
    }
    if (this.regroupT && this.time > this.regroupT && team === 1) { this.regroupT = 0; const o = ord[lineSq]; if (o) o.mode = "charge"; if (ord[wingSq]) ord[wingSq].mode = "charge"; this.charge[team] = true; this.say("Wróg znów naciera!", PAL.purpleL); }
    if (ord[6] && ord[6].mode === "ambush" && this.time > 85) { const g = this.units.find((u) => u.team === team && u.squad === 6 && u.active); if (g) this.reveal(g); }
  }

  // ---------- Efekty ----------
  blood(x: number, y: number, n: number, src: Unit | null, heavy = false) {
    n = Math.round(n * (this.settings.blood ?? 1));
    const a0 = src ? Math.atan2(y - src.y + 12, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) { const a = a0 + rr(-0.8, 0.8), sp = rr(25, heavy ? 150 : 110); this.parts.push({ x, y: y + 14, z: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rr(20, 95), life: 2, max: 2, col: pick([PAL.blood, PAL.bloodL, PAL.bloodD, PAL.blood]), kind: "blood" }); }
  }
  bones(x: number, y: number, n: number, src: Unit | null) {
    const a0 = src ? Math.atan2(y - src.y + 12, x - src.x) : rr(0, 6.28);
    for (let i = 0; i < n; i++) { const a = a0 + rr(-1, 1), sp = rr(20, 80); this.parts.push({ x, y: y + 14, z: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rr(20, 70), life: 2, max: 2, col: pick([PAL.bone, PAL.boneHi, PAL.ash]), kind: "bone" }); }
  }
  sparks(x: number, y: number, n: number, col: string) {
    for (let i = 0; i < n; i++) { const a = rr(0, 6.28), sp = rr(40, 140); this.parts.push({ x, y: y + 14, z: 14, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rr(10, 70), life: rr(0.12, 0.3), max: 0.3, col, kind: "spark" }); }
  }
  holyBurst(x: number, y: number, n: number) {
    for (let i = 0; i < n; i++) { const a = rr(0, 6.28), sp = rr(20, 90); this.parts.push({ x, y, z: 12, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, vz: rr(20, 80), life: rr(0.3, 0.7), max: 0.7, col: pick([PAL.gold, PAL.boneHi, PAL.white]), kind: "holy" }); }
  }
  impact(x: number, y: number, col: string, size: number) {
    this.parts.push({ x, y: y + 14, z: 14, vx: 0, vy: 0, vz: 0, life: 0.07, max: 0.07, col: PAL.white, kind: "flash" });
    this.parts.push({ x, y: y + 14, z: 14, vx: size, vy: 0, vz: 0, life: 0.16, max: 0.16, col, kind: "ring" });
  }
  // Ślady na ziemi: wydeptana trawa, błoto, odciski kopyt; kurz spod nóg, przy szarży gęsta chmura.
  muddy(x: number, y: number) { const c = this.map.grid[Math.floor(y / CELL) * this.map.gw + Math.floor(x / CELL)]; return this.cfg.rain || this.cfg.terrain === "swamp" || (this.cfg.season ?? 1) === 3 || c === 1; }
  footstep(u: Unit) {
    if (this.cfg.arena && !this.cfg.arena.archery) { if (chance(0.3)) this.dust(u.x, u.y, 1); return; }
    const wet = this.muddy(u.x, u.y), winter = (this.cfg.season ?? 1) === 3;
    const g = this.dg;
    g.globalAlpha = wet ? 0.55 : 0.3;
    g.fillStyle = winter ? "#4a4639" : wet ? PAL.dirtD : "#1d1f13";
    const px = Math.round(u.x), py = Math.round(u.y);
    if (u.mounted) { const a = u.heading + Math.PI / 2, ox = Math.round(Math.cos(a) * 2), oy = Math.round(Math.sin(a) * 1); g.fillRect(px + ox, py + oy, 2, 1); g.fillRect(px - ox, py - oy + 1, 2, 1); }
    else { const side = Math.floor(u.anim) % 2 ? 1 : -1; g.fillRect(px + side, py, 1, 1); if (wet) g.fillRect(px + side, py + 1, 1, 1); }
    g.globalAlpha = 1;
    if (wet) { u.mud = Math.min(1, u.mud + (u.mounted ? 0.002 : 0.004)); return; }
    if (this.parts.length > 1400) return;
    const charge = u.mounted && u.rspeed > 70;
    if (charge) this.cloud(u.x, u.y, 3, winter);
    else if (chance(u.mounted ? 0.5 : 0.18)) this.cloud(u.x, u.y, 1, winter);
  }
  cloud(x: number, y: number, n: number, snow = false) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rr(-5, 5), y: y + rr(-1, 2), z: rr(0, 3), vx: rr(-14, 14), vy: rr(-5, 5), vz: rr(2, 9), life: rr(0.7, 1.3), max: 1.3, col: snow ? PAL.boneHi : pick([PAL.dirtL, PAL.ash, PAL.dirtL]), kind: "cloud" });
  }
  smoke(x: number, y: number, z: number, n: number, dark = true) {
    for (let i = 0; i < n; i++) this.parts.push({ x: x + rr(-2, 2), y, z: z + rr(0, 3), vx: rr(-6, 6) + 5, vy: rr(-2, 2), vz: rr(6, 16), life: rr(1.6, 3), max: 3, col: dark ? pick([PAL.slate, PAL.stone, PAL.dusk]) : pick([PAL.ash, PAL.stone]), kind: "smoke" });
  }
  // porzucony sprzęt zostaje na ziemi do końca bitwy
  dropGear(d: Unit, fa: number) {
    if (d.look.race === "wolf" || d.look.race === "ghoul") return;
    const g = this.dg, a = fa + rr(-1.2, 1.2), r = rr(5, 11);
    const x = Math.round(d.x + Math.cos(a) * r), y = Math.round(d.y + Math.sin(a) * r * 0.6);
    const wa = rr(0, Math.PI), len = d.w?.reach > 40 ? 11 : 7;
    for (let i = 0; i < len; i++) { g.fillStyle = i < 2 ? PAL.woodD : i === 2 ? PAL.steelD : (d.look.rust || 0) > 0.3 && i % 3 === 0 ? PAL.rust : PAL.steel; g.fillRect(Math.round(x + Math.cos(wa) * i), Math.round(y + Math.sin(wa) * i * 0.5), 1, 1); }
    if (d.hasShield && chance(0.7)) {
      const sx = Math.round(d.x - Math.cos(a) * 6), sy = Math.round(d.y + rr(-2, 3));
      const main = d.look.tabard ? d.look.tabard.main : PAL.wood;
      g.fillStyle = PAL.ink; g.fillRect(sx - 3, sy - 2, 7, 5); g.fillStyle = main; g.fillRect(sx - 2, sy - 1, 5, 3); g.fillStyle = PAL.woodD; g.fillRect(sx, sy - 1, 1, 3);
    }
    if (d.look.helm !== "none" && chance(0.3)) { g.fillStyle = PAL.steelD; g.fillRect(x + 4, y + 2, 3, 2); g.fillStyle = PAL.steel; g.fillRect(x + 4, y + 2, 2, 1); }
  }
  // Dym z ognisk, płonących chat i uszkodzonych machin; iskry z ognia.
  emitAmbient(dt: number) {
    if (this.parts.length > 900) return;
    const M = this.map;
    for (const L of M.lights) if (chance(dt * 2.5)) { this.smoke(L.x, L.y, 6, 1); if (chance(0.5)) this.parts.push({ x: L.x + rr(-2, 2), y: L.y, z: 4, vx: rr(-8, 8), vy: 0, vz: rr(10, 30), life: rr(0.5, 1.1), max: 1.1, col: PAL.gold, kind: "ember" }); }
    const burn = ((M as any).burning || []) as V[];
    for (const f of burn) if (chance(dt * 6)) { this.smoke(f.x, f.y, 14, 1); if (chance(0.6)) this.parts.push({ x: f.x + rr(-6, 6), y: f.y, z: rr(4, 12), vx: rr(-10, 10), vy: 0, vz: rr(14, 40), life: rr(0.5, 1.2), max: 1.2, col: PAL.gold, kind: "ember" }); }
    for (const e of this.engines) if (!e.done && e.hp < e.max * 0.6 && chance(dt * 4)) this.smoke(e.x, e.y, 18, 1);
    for (const u of this.units) if (u.active && u.burnT > 0 && chance(dt * 5)) this.smoke(u.x, u.y, 14, 1);
  }
  dust(x: number, y: number, n: number) { for (let i = 0; i < n; i++) this.parts.push({ x: x + rr(-4, 4), y, z: 1, vx: rr(-25, 25), vy: rr(-10, 10), vz: rr(5, 20), life: 0.6, max: 0.6, col: PAL.dirtL, kind: "dust" }); }
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
    for (let yy = -r; yy <= r; yy++) for (let xx = -r * 1.5; xx <= r * 1.5; xx++) if ((xx * xx) / 2.25 + yy * yy <= r * r * rr(0.6, 1)) { g.fillStyle = chance(0.8) ? PAL.bloodD : PAL.blood; g.fillRect(Math.round(x + xx), Math.round(y + yy + 1), 1, 1); }
  }
  floater(x: number, y: number, text: string, col: string, force = false) { if (force || this.settings.damageNumbers) this.floaters.push({ x, y, text, col, t: 0.9 }); }

  updateParticles(dt: number) {
    for (const p of this.parts) {
      p.life -= dt;
      if (p.kind === "flash" || p.kind === "ring" || p.kind === "beam") continue;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vz -= (p.kind === "soul" || p.kind === "fire" || p.kind === "holy" || p.kind === "smoke" || p.kind === "ember" ? -20 : p.kind === "cloud" ? 0 : 240) * dt;
      if (p.kind === "dust" || p.kind === "soul" || p.kind === "fire" || p.kind === "holy" || p.kind === "cloud" || p.kind === "smoke" || p.kind === "ember") { p.vx *= 0.92; p.vy *= 0.92; }
      if (p.kind === "head" || p.kind === "limb") {
        p.rot += dt * 12 * Math.sign(p.vx || 1);
        if (p.z <= 0) { p.z = 0; p.vz = Math.abs(p.vz) > 40 ? -p.vz * 0.35 : 0; p.vx *= 0.5; p.vy *= 0.5; if (Math.abs(p.vz) < 1) { p.vx = p.vy = 0; } this.dg.fillStyle = PAL.blood; this.dg.fillRect(Math.round(p.x), Math.round(p.y), 2, 1); }
        if (p.life < 0.1 && p.z <= 0) { // zostaje na ziemi jako ślad
          if (p.kind === "head" && p.img) this.dg.drawImage(p.img, Math.round(p.x - 5), Math.round(p.y - 6));
          else { this.dg.fillStyle = p.col; this.dg.fillRect(Math.round(p.x - 2), Math.round(p.y - 1), 5, 2); this.dg.fillStyle = PAL.bloodL; this.dg.fillRect(Math.round(p.x + 2), Math.round(p.y - 1), 1, 2); }
          p.life = 0;
        }
        continue;
      }
      if (p.z <= 0 && (p.kind === "blood" || p.kind === "bone")) {
        this.dg.fillStyle = p.col;
        this.dg.fillRect(Math.round(p.x), Math.round(p.y), p.kind === "blood" && chance(0.5) ? 2 : 1, 1);
        p.life = 0;
      }
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const f of this.floaters) { f.t -= dt; f.y -= 14 * dt; }
    this.floaters = this.floaters.filter((f) => f.t > 0);
    for (const c of this.corpses) if (c.t < 1) { c.t = Math.min(1, c.t + dt / (c.kind === "pierce" ? 0.85 : c.kind === "blunt" ? 0.55 : 0.75)); if (c.t >= 1 && !c.pooled) { c.pooled = true; if (!c.undead) this.pool(c.x, c.y, 4 + rnd() * 4); this.dust(c.x, c.y, 6); } }
  }

  // ---------- Pętla ----------
  // Samouczek prologu: kolejne podpowiedzi znikają, gdy gracz wykona ruch.
  tut = 0; tutT = 0; tutMoved = 0; tutSwung = false; tutBlocked = false; tutOrdered = false;
  tutorialTick(dt: number) {
    if (!this.cfg.tutorial || this.phase === "end") return;
    const steps: [string, () => boolean][] = [
      ["Rozstaw ludzi: przeciągnij PPM. Enter albo Spacja zaczyna bitwę.", () => this.phase === "fight"],
      ["Ruch: WSAD. Shift to sprint.", () => this.tutMoved > 80],
      ["Cios: LPM. Ruch myszy tuż przed kliknięciem wybiera kierunek (lewo, prawo, góra).", () => this.tutSwung],
      ["Blok: przytrzymaj PPM. Blok w ostatniej chwili przed ciosem to kontra.", () => this.tutBlocked],
      [`Rozkazy: ${keyName(KB("cmd"))} otwiera menu, albo F3: wszyscy do szarży!`, () => this.tutOrdered],
      ["Dobrze. Rozbij zbójów. Opatrunek pod 4, gdy krwawisz.", () => false],
    ];
    const h = this.hero;
    if (h && this.phase === "fight") {
      this.tutMoved += Math.hypot(h.vx || 0, h.vy || 0) * dt;
      if (h.state === "windup" || h.state === "strike") this.tutSwung = true;
      if (h.blocking) this.tutBlocked = true;
      if (this.cmdOpen || (this.orders && Object.values(this.orders).some((o: any) => o && o.mode === "charge"))) this.tutOrdered = true;
    }
    this.tutT -= dt;
    while (this.tut < steps.length - 1 && steps[this.tut][1]()) { this.tut++; this.tutT = 0; this.sfx.page(); }
    if (this.tutT <= 0) { this.tutT = 7; this.say("Samouczek: " + steps[this.tut][0], PAL.gold, true); }
  }
  private bmood = "";
  // Muzyka bitwy zależy od rasy przeciwnika.
  // Warstwy bitwy: rozkazy wykrzykiwane w szeregach, rżenie koni, sygnały rogów przy szarży.
  layerT = 2; chargeN = 0;
  battleLayers(dt: number) {
    this.layerT -= dt;
    const ch = Object.values(this.orders).filter((o: any) => o && o.mode === "charge").length;
    if (ch > this.chargeN) this.sfx.horn?.(0.6);
    this.chargeN = ch;
    if (this.layerT > 0) return;
    this.layerT = rr(1.5, 4);
    const act = this.units.filter((u) => u.active);
    const h = this.hero;
    const near = h ? act.filter((u) => dist(u.x, u.y, h.x, h.y) < 260) : act;
    if (near.some((u) => u.mounted) && chance(0.5)) { const m = pick(near.filter((u) => u.mounted)); const s = this.vol(m.x); this.sfx.neigh(s.v * 0.6, s.pan); }
    if (near.length > 12 && chance(0.6)) this.sfx.shout(0.25 + Math.min(0.4, near.length / 120));
    if (chance(0.12)) this.sfx.drum(0.25);
  }
  battleMood() {
    if (this.bmood) return this.bmood;
    const cnt: Record<string, number> = {};
    for (const u of this.units) if (u.team === 1) cnt[u.def.culture] = (cnt[u.def.culture] || 0) + 1;
    const top = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a])[0] || "aurelia";
    this.bmood = top === "orc" ? "battle_orc" : top === "undead" ? "battle_undead" : top === "dwarf" ? "battle_dwarf" : top === "monster" ? "battle_beast" : top === "aurelia" ? "battle_aurelia" : top === "varus" ? "battle_varus" : "battle_human";
    return this.bmood;
  }
  update(realDt: number) {
    this.real += realDt;
    for (const l of this.log) l.t -= realDt;
    this.log = this.log.filter((l) => l.t > 0);
    if (this.banner) { this.banner.t -= realDt; if (this.banner.t <= 0) this.banner = null; }
    if (this.hurtFlash > 0) this.hurtFlash -= realDt;
    for (const p of this.preview) p.t -= realDt;
    this.preview = this.preview.filter((p) => p.t > 0);
    const k = 300, damp = Math.pow(0.004, realDt);
    this.shakeVX -= this.shakeX * k * realDt; this.shakeVY -= this.shakeY * k * realDt;
    this.shakeVX *= damp; this.shakeVY *= damp;
    this.shakeX += this.shakeVX * realDt; this.shakeY += this.shakeVY * realDt;
    this.rumble = Math.max(0, this.rumble - realDt * 14);
    this.updateCamera(realDt);
    let fighting = 0;
    for (const u of this.units) if (u.active && (u.state === "windup" || u.state === "strike")) fighting++;
    this.intensity = this.phase === "fight" ? clamp(fighting / 14, 0, 1) : 0;
    this.sfx.setMood(this.phase === "deploy" ? "silence" : this.battleMood());
    if (this.phase === "fight") this.battleLayers(realDt);
    this.tutorialTick(realDt);
    this.sfx.tick(realDt, this.intensity, this.cfg.rain);
    if (this.phase === "deploy" && !this.paused) {
      // rozstawienie: czas stoi, gracz ustawia oddziały (PPM przeciągnij), Enter / Spacja rozpoczyna
      this.cmdOpen = true; this.slowmo = true;
      this.handleOrders();
      for (const o of Object.values(this.orders)) o.ax = Math.min(o.ax, this.cfg.terrain === "siege" ? this.map.wall.x0 - 60 : this.mw * 0.46);
      this.relayoutT -= realDt; if (this.relayoutT <= 0) { this.relayoutT = 0.25; this.layoutAll(true); }
      if (trapsAllowed(this)) { const wx = this.cam.x + this.input.mx, wy = this.cam.y + this.input.my; if (this.input.hit(KB("treb"))) placeTrap(this, "stakes", wx, wy); if (this.input.hit(KB("cry"))) placeTrap(this, "ditch", wx, wy); }
      if (this.input.hit("Enter") || this.input.hit("Space")) this.startFight();
      return;
    }
    if (this.phase !== "fight" || this.paused) return;
    if (this.input.hit(KB("tview"))) { this.tacView = !this.tacView; this.say(this.tacView ? "Widok taktyczny" : "Widok zwykły", PAL.ash); }
    if (this.input.hit(KB("tpause")) && !this.cfg.arena && this.heroUp) { this.tacPause = !this.tacPause; if (this.tacPause) { this.toggleCmd(true); this.say("PAUZA TAKTYCZNA: wydawaj rozkazy, P wznawia.", PAL.gold, true); } else this.toggleCmd(false); }
    if (this.tacPause) {
      if (!this.cmdOpen || !this.heroUp) { this.tacPause = false; this.say("Wznowiono.", PAL.ash); }
      this.handleOrders();
      this.relayoutT -= realDt; if (this.relayoutT <= 0) { this.relayoutT = 0.25; this.layoutAll(); }
      return;
    }

    if (this.hitstop > 0) { this.hitstop -= realDt; this.handleOrders(); this.updateHero(0); return; }
    if (this.slowT > 0) this.slowT -= realDt;
    if (this.cryCd > 0) this.cryCd -= realDt;
    if (this.joust && (this.joust as any).resetT > 0) { (this.joust as any).resetT -= realDt; if ((this.joust as any).resetT <= 0) this.joustReset(); } if (this.trebAimCd > 0) this.trebAimCd -= realDt;
    if (this.focusT > 0) this.focusT -= realDt;
    this.slowmo = this.cmdOpen;
    const scale = this.slowmo ? 0.3 : this.focusT > 0 ? 0.4 : this.slowT > 0 ? 0.35 : 1;
    const dt = Math.min(realDt, 0.05) * scale;
    this.time += dt;
    for (const k2 of Object.keys(this.cds)) this.cds[k2] = Math.max(0, this.cds[k2] - dt);

    this.handleOrders();
    // skupienie: bohater porusza się w normalnym tempie
    this.updateHero(this.focusT > 0 ? dt / 0.4 : dt);

    this.relayoutT -= dt;
    if (this.relayoutT <= 0) {
      this.relayoutT = 0.4;
      this.general(1, this.eorders, 1, 2, 3, 4, 5);
      if (!this.alliesManual) this.general(0, this.aorders, 11, 0, 12, 13, 0);
      this.officerAI();
      this.layoutAll();
      this.moraleCheck();
      this.reinforce();
    }
    for (const u of this.units) {
      if (!u.active) continue;
      this.updateCombat(u, u.hero && this.focusT > 0 ? dt / 0.4 : dt);
      if (u.mounted) this.lanceCheck(u);
      if (!u.hero && u.active) this.updateAI(u, dt);
    }
    updateFire(this, dt); updateWeather(this, dt); updateTraps(this, dt);
    const h = this.hero;
    for (const u of this.units) {
      if (!u.active) continue;
      const udt = u.hero && this.focusT > 0 ? dt / 0.4 : dt;
      // ruch z poszanowaniem wody i murów (ślizg wzdłuż przeszkody)
      const nx = u.x + u.vx * udt, ny = u.y + u.vy * udt;
      if (this.passable(nx, ny)) { u.x = nx; u.y = ny; }
      else if (this.passable(nx, u.y)) { u.x = nx; u.vy *= 0.5; }
      else if (this.passable(u.x, ny)) { u.y = ny; u.vx *= 0.5; }
      else { u.vx *= -0.2; u.vy *= -0.2; if (u.mounted) u.rspeed *= 0.5; }
      if (!u.mounted) {
        if (!u.hero && !u.moving) { u.vx *= Math.pow(0.03, udt); u.vy *= Math.pow(0.03, udt); }
        if (u.state === "stagger") { u.vx *= Math.pow(0.03, udt); u.vy *= Math.pow(0.03, udt); }
      }
      const speed = Math.hypot(u.vx, u.vy);
      const prev = Math.floor(u.anim);
      if (speed > 8) u.anim += udt * speed * (u.mounted ? 0.09 : 0.11);
      if (Math.floor(u.anim) !== prev) this.footstep(u);
      if (h && Math.floor(u.anim) !== prev && dist(u.x, u.y, h.x, h.y) < 140) {
        const s = this.vol(u.x);
        if (u.mounted) this.sfx.hoof(s.v * (u.hero ? 1 : 0.5), s.pan);
        else if (u.hero) this.sfx.step(0.8, 1);
      }
      if (!u.def.undead && u.hp < u.maxHp * 0.55) { u.bleedT -= udt; if (u.bleedT <= 0) { u.bleedT = rr(0.25, 0.6); this.dg.fillStyle = chance(0.6) ? PAL.blood : PAL.bloodD; this.dg.fillRect(Math.round(u.x + rr(-2, 2)), Math.round(u.y + rr(-1, 1)), 1, 1); } }
      if (!u.fleeing) { u.x = clamp(u.x, 6, this.mw - 6); u.y = clamp(u.y, 14, this.mh - 6); }
    }
    if (h && h.active && !this.cfg.arena && this.cfg.terrain !== "siege") {
      const edge = h.x < 14 || h.y < 20 || h.x > this.mw - 14 || h.y > this.mh - 12;
      if (edge) { this.edgeT += dt; if (this.edgeT > 0.2 && this.edgeT - dt <= 0.2) this.say("Zostań przy krawędzi, by wycofać armię z bitwy…", PAL.ash, true); if (this.edgeT > 2.5) { this.say("Odwrót!", PAL.redL, true); this.retreat(); } }
      else this.edgeT = 0;
    }
    if (this.map.wall) this.updateSiege(dt);
    this.tlT -= dt; if (this.tlT <= 0) { this.tlT = 4; this.timeline.push({ t: this.time, a: this.units.filter((u) => u.team === 0 && u.active).length + this.reserves[0].length, b: this.units.filter((u) => u.team === 1 && u.active).length + this.reserves[1].length }); }
    this.collide();
    this.updateArrows(dt);
    this.emitAmbient(dt);
    this.updateParticles(dt);
    updateAbilityFx(this, dt);
    this.moanT -= dt;
    if (this.moanT <= 0 && h) {
      this.moanT = rr(2.5, 6);
      const z = this.units.filter((u) => u.team === 1 && u.active && !u.hidden && u.def.undead && dist(u.x, u.y, h.x, h.y) < 200);
      if (z.length) { const u = pick(z); const s = this.vol(u.x); this.sfx.moan(s.v * 0.8, s.pan); }
    }
    this.checkEnd(dt);
  }

  moraleCheck() {
    for (const sq of this.liveSquads()) {
      const m = this.squadMorale(sq);
      const lvl = m < 25 ? 2 : m < 45 ? 1 : 0;
      if ((this.waver[sq] || 0) < lvl) this.say(lvl === 2 ? `${SQUAD_NAMES[sq]} łamie się!` : `${SQUAD_NAMES[sq]} się chwieje!`, PAL.redL, lvl === 2);
      this.waver[sq] = lvl;
    }
  }
  squadMorale(sq: number) { const list = this.squadUnits(sq); return list.length ? list.reduce((s, u) => s + clamp(u.morale, 0, 100), 0) / list.length : 0; }

  collide() {
    const act = this.units.filter((u) => u.active);
    for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
      const a = act[i], b = act[j];
      const dx = b.x - a.x, dy = b.y - a.y;
      if (Math.abs(dx) > 20 || Math.abs(dy) > 20) continue;
      const d = Math.hypot(dx, dy), m = a.radius + b.radius - 1;
      if (d < m && d > 0.001) {
        for (const [r, f] of [[a, b], [b, a]] as [Unit, Unit][]) {
          if (r.mounted && !f.mounted && r.team !== f.team && r.rspeed > 55 && f.trampleT <= 0 && !f.def.poise && f.active) {
            f.trampleT = 0.8;
            const k2 = r.rspeed / r.maxRide, s = this.vol(f.x);
            this.sfx.trample(s.v, s.pan);
            this.stagger(f, 1.0); this.push(f, r.x, r.y, 80);
            const wedge = this.ordersOf(r.team, r.squad)?.formation === "wedge";
            this.damage(f, (5 + 8 * k2) * (wedge ? 1.6 : 1) * (this.inFormation(f) ? 0.6 : 1), r, false, "blunt", true);
            r.rspeed *= wedge ? 0.7 : this.inFormation(f) && this.ordersOf(f.team, f.squad)?.formation === "wall" ? 0.25 : 0.45; r.horseHp -= wedge ? 4 : 6;
            if (r.hero || f.hero) { this.hitstop = Math.max(this.hitstop, 0.09); this.kickCam(Math.cos(r.heading), Math.sin(r.heading), 1.6); }
          }
        }
        const push = (m - d) / 2, nx = dx / d, ny = dy / d;
        const wa = a.def.poise || a.mounted ? 0.25 : this.inFormation(a) && a.team !== b.team ? 0.4 : 1, wb = b.def.poise || b.mounted ? 0.25 : this.inFormation(b) && a.team !== b.team ? 0.4 : 1;
        const ax2 = a.x - nx * push * wa, ay2 = a.y - ny * push * wa, bx2 = b.x + nx * push * wb, by2 = b.y + ny * push * wb;
        if (this.passable(ax2, ay2)) { a.x = ax2; a.y = ay2; }
        if (this.passable(bx2, by2)) { b.x = bx2; b.y = by2; }
      }
    }
    for (const u of act) for (const o of this.map.obstacles) {
      if (!o.r) continue;
      const dx = u.x - o.x, dy = u.y - o.y;
      if (Math.abs(dx) > 22 || Math.abs(dy) > 22) continue;
      const d = Math.hypot(dx, dy), m = o.r + u.radius;
      if (d < m && d > 0.001) { u.x = o.x + (dx / d) * m; u.y = o.y + (dy / d) * m; if (u.mounted) u.rspeed *= 0.9; }
    }
  }

  // Koniec bitwy: liczą się tylko walczący. Ukryci dostają rozkaz ataku, uciekający nie blokują zwycięstwa.
  mopT = 0; lastHitT = 0; lastKillT = 0;
  checkEnd(dt = 0) {
    if (this.archery) {
      const left = this.units.filter((u) => u.key === "x_dummy" && u.active).length;
      if (left === 0 || ((this.hero.ammo <= 0) && !this.arrows.length) || this.time > 50) { this.say(`Twoje trafienia: ${this.archery.score} · przeciwnik: ${this.archery.opp}`, PAL.gold, true); this.finish(this.archery.score > this.archery.opp || (this.archery.score === this.archery.opp && chance(0.5))); }
      return;
    }
    if (this.joust && (this.joust.p[0] + this.joust.p[1] >= 3 || this.time > 90)) { this.say(`Kopie: ${this.joust.p[0]} : ${this.joust.p[1]}`, PAL.gold, true); this.finish(this.joust.p[0] > this.joust.p[1]); return; }
    // bezpiecznik: 45 s bez żadnego ciosu kończy impas (szturm odparty / pole bitwy dla silniejszego)
    if (this.phase === "fight" && !this.cfg.arena && (((this.time - this.lastHitT > 45 || this.time - this.lastKillT > 75) && this.time > 60) || this.time > 600)) {
      const pw = (t: number) => this.units.reduce((a, u) => a + (u.team === t && u.active && !u.fleeing ? u.hp : 0), 0) + this.reserves[t].length * 60;
      const atk = 1 - (this.cfg.siegeDefender ?? 1);
      const win0 = this.map.wall && !this.map.wall.broken && !this.engines.some((e) => e.kind === "tower" && e.done) ? atk !== 0 : pw(0) >= pw(1);
      this.say(win0 ? "Wróg nie podejmuje walki i wycofuje się." : "Impas. Twoi ludzie odstępują.", PAL.ash, true);
      if (win0) for (const u of this.units) if (u.team === 1 && u.active) u.state = "fled";
      this.finish(win0); return;
    }
    const foes = this.units.filter((u) => u.team === 1 && u.active);
    const foeFight = foes.filter((u) => !u.fleeing);
    const ours = this.units.filter((u) => u.team === 0 && u.active && u.lifeT <= 0);
    const ourFight = ours.filter((u) => !u.fleeing);
    if (foeFight.length && !this.reserves[1].length && foeFight.every((u) => u.hidden)) for (const u of foeFight) if (u.hidden) this.reveal(u);
    if (!foeFight.length && !this.reserves[1].length) {
      if (!foes.length) { this.finish(true); return; }
      this.mopT += dt; if (this.mopT > 2.5) { for (const u of foes) u.state = "fled"; this.finish(true); }
      return;
    }
    if (!ourFight.length && !this.reserves[0].length) {
      if (!ours.length) { this.finish(false); return; }
      this.mopT += dt; if (this.mopT > 2.5) this.finish(false);
      return;
    }
    this.mopT = 0;
  }

  // Odwrót z bitwy: gracz wycofuje się, część żołnierzy w zasięgu wroga może przepaść.
  retreat() {
    if (this.phase !== "fight") return;
    this.retreated = true;
    for (const u of this.units) if (u.team === 0 && u.active && !u.hero) {
      let near = false;
      for (const e of this.units) if (e.team === 1 && e.active && dist(u.x, u.y, e.x, e.y) < 50) { near = true; break; }
      if (near && chance(0.35)) { u.state = "dead"; }
    }
    this.finish(false);
  }

  finish(win: boolean) {
    if (this.phase === "end") return;
    this.phase = "end"; this.cmdOpen = false;
    if (win) { this.shout(this.cfg.arena ? "Wygrana!" : "Zwycięstwo!"); this.sfx.battleCry(1); } else this.shout(this.retreated ? "Odwrót" : "Klęska", PAL.redL);
    const H = this.heroCfg;
    const med = H ? H.medicine : 0;
    const tally = (team: number, ally: boolean): Casualty[] => {
      const m = new Map<string, Casualty>();
      for (const u of this.units) {
        if (u.team !== team || u.hero || u.companion || u.lifeT > 0) continue;
        const isAlly = u.squad >= 11;
        if (team === 0 && isAlly !== ally) continue;
        if (!m.has(u.key)) m.set(u.key, { type: u.key, killed: 0, wounded: 0 });
        const c = m.get(u.key);
        if (u.state === "dead") {
          // ranni zamiast poległych: zależy od medycyny i strony
          const woundCh = team === 0 ? 0.5 + med * 0.03 : this.P("plague") ? 0.12 : 0.3;
          if (chance(woundCh) && !u.def.undead) c.wounded++; else c.killed++;
        } else if (u.surrendered && win) c.wounded++;   // poddani trafiają do niewoli
        else if (u.state === "fled" && team === 1 && !win) { /* uciekli i wrócą */ }
        else if (u.state === "fled" && team === 0 && !win && chance(0.3)) c.killed++;
      }
      return [...m.values()].filter((c) => c.killed || c.wounded);
    };
    const xp: Record<string, number> = {};
    for (const u of this.units) if (u.team === 0 && !u.hero && !u.companion && u.squad <= 8 && u.state !== "dead") xp[u.key] = (xp[u.key] || 0) + 8 + u.kills * 12 * (win ? 1 : 0.5);
    const theirs = tally(1, false);
    const prisoners: { type: string; n: number }[] = [];
    if (win && !this.cfg.arena) for (const c of theirs) { const def = UNITS[c.type]; if (def.undead || def.culture === "monster") continue; const n = Math.round(c.wounded * 0.8); if (n > 0) prisoners.push({ type: c.type, n }); }
    const comp: Record<string, number> = {};
    for (const u of this.units) if (u.companion) comp[u.companion] = Math.max(1, Math.round(u.hp));
    this.result = {
      win, heroKO: !!this.hero && !this.hero.active, heroHp: this.hero ? Math.max(1, Math.round(this.hero.hp)) : 0, heroKills: this.hero ? this.hero.kills : 0,
      faith: H ? H.faith : 0, mana: H ? H.mana : 0, fury: 0, corruption: H ? H.corruption : 0, bandages: H ? H.bandages : 0, ammo: this.hero ? this.hero.ammo : 0,
      ours: tally(0, false), theirs, allies: tally(0, true), xp, prisoners,
      companionsKO: this.units.filter((u) => u.companion && u.ko).map((u) => u.companion), companionHp: comp,
      enemyKilled: this.units.filter((u) => u.team === 1 && u.state === "dead").length, time: this.time, retreated: this.retreated,
      timeline: this.timeline.concat([{ t: this.time, a: this.units.filter((u) => u.team === 0 && u.active).length + this.reserves[0].length, b: this.units.filter((u) => u.team === 1 && u.active).length + this.reserves[1].length }]),
      best: (() => { const c = this.units.filter((u) => u.team === 0 && !u.hero && u.squad <= 8 && u.kills > 0).sort((a, b) => b.kills - a.kills)[0]; return c ? { type: c.key, name: c.companion ? c.name : c.def.name, kills: c.kills } : null; })(),
    };
  }

  updateCamera(dt: number) {
    const I = this.input;
    if (!this.heroUp) this.camFree = true;
    const sp = 300 * dt;
    if (this.camFree || this.cmdOpen) {
      if (I.held("ArrowLeft")) this.cam.x -= sp; if (I.held("ArrowRight")) this.cam.x += sp;
      if (I.held("ArrowUp")) this.cam.y -= sp; if (I.held("ArrowDown")) this.cam.y += sp;
      if (this.cmdOpen && this.heroUp) { const m = 8; if (I.mx < m) this.cam.x -= sp; if (I.mx > W - m) this.cam.x += sp; if (I.my < m) this.cam.y -= sp; if (I.my > H - m) this.cam.y += sp; }
      if (!this.heroUp) { if (I.held("KeyA")) this.cam.x -= sp; if (I.held("KeyD")) this.cam.x += sp; if (I.held("KeyW")) this.cam.y -= sp; if (I.held("KeyS")) this.cam.y += sp; }
    } else {
      const h = this.hero;
      const lead = h.usingBow && h.drawT > 0.6 ? 0.42 : 0.25;
      const tx = h.x - W / 2 + (I.mx - W / 2) * lead, ty = h.y - (h.mounted ? 12 : 4) - H / 2 + (I.my - H / 2) * lead;
      this.cam.x = lerp(this.cam.x, tx, clamp(dt * 4.5, 0, 1));
      this.cam.y = lerp(this.cam.y, ty, clamp(dt * 4.5, 0, 1));
    }
    this.cam.x = clamp(this.cam.x, 0, Math.max(0, this.mw - W)); this.cam.y = clamp(this.cam.y, 0, Math.max(0, this.mh - H));
  }
}

// Świat: generowanie mapy (teren, rzeki, drogi), osady, frakcje, lordowie, oddziały, ekonomia, wojny, kronika.

const WCELL = 8;
const WGW = 240, WGH = 150;              // komórki mapy świata (1920×1200 px)
const T_SEA = 0, T_PLAIN = 1, T_FOREST = 2, T_HILL = 3, T_MOUNT = 4, T_SWAMP = 5, T_RIVER = 6, T_BEACH = 7;
const TERR_NAME = ["Morze", "Równina", "Las", "Wzgórza", "Góry", "Bagno", "Rzeka", "Wybrzeże"];
const HOURS_PER_SEC = 0.8;               // 1 dzień = 30 s przy normalnej prędkości

interface Troop { type: string; n: number; wounded: number; xp: number; }
type PartyKind = "player" | "lord" | "bandit" | "monster" | "undead" | "caravan" | "villagers";
interface Party {
  id: number; kind: PartyKind; name: string; faction: number;
  x: number; y: number;                  // piksele świata
  path: number[];                        // indeksy komórek
  troops: Troop[]; prisoners: Troop[];
  gold: number; food: number;
  lord?: number;                         // id lorda
  home?: number;                         // id osady
  dest?: number;                         // osada docelowa
  state: string; wait: number; target?: number;
  siege?: number;                        // oblegana osada
  goods?: Record<string, number>;
  quest?: number;
  anim: number;
}
type SKind = "town" | "castle" | "village";
interface Settlement {
  id: number; name: string; kind: SKind; cx: number; cy: number; faction: number; culture: Culture;
  owner: number;                         // id lorda, -1 brak, -2 gracz
  prosperity: number;
  garrison: Troop[];
  stock: Record<string, number>;
  recruits: number; recruitDay: number;
  bound: number;                         // wioska przypisana do miasta/zamku
  siegeBy: number[];                     // oddziały oblegające
  siegeDays: number;
  raided: number;                        // dni do odbudowy po grabieży
  companions: string[];
  relation: number;                      // nastawienie mieszkańców do gracza
  tournament: number;                    // dni do końca turnieju (0 brak)
  seed: number;
  capital?: boolean;
}
interface Lord {
  id: number; name: string; title: string; faction: number; look: Look;
  party: number; renown: number; relation: number; alive: boolean;
  captive: number;                       // -1 wolny, inaczej id frakcji/oddziału trzymającego
  respawn: number; ruler: boolean; personality: "honorowy" | "chciwy" | "okrutny" | "ostrożny";
}
interface SpecialPlace { id: number; kind: "ruins" | "lair" | "shrine" | "camp" | "cemetery"; cx: number; cy: number; name: string; cleared: number; seen: boolean; }
interface Quest { id: number; kind: "bandits" | "letter" | "grain" | "wolves"; giver: number; target: number; amount: number; reward: number; days: number; text: string; done: boolean; }
interface ChronEntry { day: number; text: string; col?: string; }

const GOODS: Record<string, { name: string; base: number; food?: boolean }> = {
  grain: { name: "Zboże", base: 12, food: true }, meat: { name: "Suszone mięso", base: 26, food: true }, ale: { name: "Piwo", base: 18, food: true },
  salt: { name: "Sól", base: 40 }, cloth: { name: "Sukno", base: 60 }, iron: { name: "Żelazo", base: 70 },
  timber: { name: "Drewno", base: 24 }, wine: { name: "Wino", base: 55 }, spice: { name: "Przyprawy", base: 140 },
};
const GOOD_KEYS = Object.keys(GOODS);
const FOOD_KEYS = GOOD_KEYS.filter((k) => GOODS[k].food);

// produkcja według kultury (co jest tanie gdzie)
const CULTURE_PROD: Partial<Record<Culture, Record<string, number>>> = {
  aurelia: { grain: 1.5, wine: 1.6, cloth: 1.3, ale: 1.1 },
  varus: { iron: 1.2, cloth: 1.2, salt: 1.5, grain: 1.0 },
  dwarf: { iron: 2.0, ale: 1.6, salt: 1.2, timber: 0.6 },
  orc: { meat: 2.0, timber: 1.4, ale: 0.8 },
  undead: { salt: 1.0, iron: 1.1, spice: 0.6, grain: 0.3 },
};

interface FactionState { id: number; war: Record<number, boolean>; warDays: Record<number, number>; truce: Record<number, number>; relation: Record<number, number>; gold: number; alive: boolean; name: string; }

interface PlayerState {
  name: string; race: string; origin: string; look: Look;
  level: number; xp: number; attrPts: number; skillPts: number;
  attr: Record<string, number>; skills: Record<string, number>;
  hp: number; gold: number; renown: number; honor: number;
  equip: Record<ESlot, string | null>; items: string[]; goods: Record<string, number>;
  abilities: string[]; learned: string[]; abLevels: Record<string, number>;
  nodes: string[]; perks: Record<string, number>;
  faith: number; mana: number; corruption: number; bandages: number; ammo: number;
  companions: CompanionState[];
  liege: number; status: "wolny" | "najemnik" | "wasal" | "król"; contractDays: number;
  wars: number[];                        // wojny prowadzone osobiście (gdy niezależny)
  morale: number; wageDebt: number; lastPay: number;
  captive: { by: number; days: number } | null;
  quests: Quest[];
  kingdom: string;
  kills: number; battlesWon: number;
}
interface CompanionState { id: string; name: string; look: Look; hp: number; maxHp: number; weapon: string; shield: boolean; armor: number; bow: number; horse: boolean; role: string; wage: number; bio: string; level: number; squad: number; }

interface World {
  seed: number; day: number; hour: number; rain: boolean; fog?: boolean;
  terr: Uint8Array; road: Uint8Array; nearest: Int16Array; explored: Uint8Array; blight: Uint8Array;
  settlements: Settlement[]; parties: Party[]; lords: Lord[]; places: SpecialPlace[];
  factions: Record<number, FactionState>;
  chronicle: ChronEntry[];
  player: PlayerState; pid: number;      // id oddziału gracza
  nextId: number; questId: number;
  ownerVersion: number;
}

let WORLD: World = null as any;

// ---------- Pomocnicze ----------
const cidx = (cx: number, cy: number) => cy * WGW + cx;
const cellOf = (x: number, y: number) => cidx(clamp(Math.floor(x / WCELL), 0, WGW - 1), clamp(Math.floor(y / WCELL), 0, WGH - 1));
function terrAt(w: World, cx: number, cy: number) { if (cx < 0 || cy < 0 || cx >= WGW || cy >= WGH) return T_SEA; return w.terr[cidx(cx, cy)]; }
function passableCell(w: World, i: number) { const t = w.terr[i]; if (t === T_SEA || t === T_MOUNT) return false; if (t === T_RIVER) return w.road[i] === 2 || w.road[i] === 3; return true; }
function moveCost(w: World, i: number) {
  const r = w.road[i];
  if (r === 1 || r === 2) return 0.65;
  if (r === 3) return 2.2;
  switch (w.terr[i]) { case T_FOREST: return 1.6; case T_HILL: return 1.5; case T_SWAMP: return 2.3; case T_BEACH: return 1.1; default: return 1; }
}
function partyById(w: World, id: number) { return w.parties.find((p) => p.id === id); }
function lordById(w: World, id: number) { return w.lords.find((l) => l.id === id); }
function settlementById(w: World, id: number) { return w.settlements[id]; }
function troopCount(t: Troop[]) { return t.reduce((s, x) => s + x.n, 0); }
function healthyCount(t: Troop[]) { return t.reduce((s, x) => s + x.n - x.wounded, 0); }
function addTroops(list: Troop[], type: string, n: number, wounded = 0) {
  if (n <= 0) return;
  const e = list.find((t) => t.type === type);
  if (e) { e.n += n; e.wounded += wounded; } else list.push({ type, n, wounded, xp: 0 });
}
function removeTroops(list: Troop[], type: string, n: number) {
  const e = list.find((t) => t.type === type);
  if (!e) return;
  e.n = Math.max(0, e.n - n); e.wounded = Math.min(e.wounded, e.n);
  if (e.n === 0) list.splice(list.indexOf(e), 1);
}
function unitPower(key: string) { const d = UNITS[key]; if (!d) return 1; return (d.hp / 100) * (1 + d.tier * 0.55) * (d.bow ? 1.1 : 1) * (d.mount ? 1.35 : 1) * (d.ability ? 1.3 : 1); }
function troopPower(t: Troop[], healthyOnly = true) { return t.reduce((s, x) => s + unitPower(x.type) * (healthyOnly ? x.n - x.wounded : x.n), 0); }
function partyPower(w: World, p: Party) {
  let pw = troopPower(p.troops);
  if (p.kind === "player") pw += 3 + w.player.level * 0.4 + w.player.companions.length * 2.2;
  if (p.lord !== undefined) pw += 3;
  return pw;
}
function chron(w: World, text: string, col?: string) { w.chronicle.push({ day: w.day, text, col }); if (w.chronicle.length > 200) w.chronicle.shift(); if (typeof onChronicle === "function") onChronicle(text, col); }
let onChronicle: (t: string, c?: string) => void = null as any;
function isNight(w: World) { return w.hour < 5 || w.hour >= 21; }
function factionName(id: number) { if (id === PLAYER_FACTION) return WORLD?.player.kingdom || "Twoje królestwo"; return FACTIONS[id]?.name || "Nikt"; }
function factionShort(id: number) { if (id === PLAYER_FACTION) return WORLD?.player.kingdom || "Twoje królestwo"; return FACTIONS[id]?.short || "?"; }
function factionCol(id: number) { if (id === PLAYER_FACTION) return [PAL.gold, PAL.goldD, PAL.white]; const F = FACTIONS[id]; return F ? [F.col, F.shade, F.trim] : [PAL.dirt, PAL.dirtD, PAL.bone]; }

// ---------- A* ----------
let AS_G: Float32Array = null as any, AS_CAME: Int32Array = null as any, AS_STAMP: Uint32Array = null as any, AS_CLOSED: Uint32Array = null as any, AS_GEN = 0;
function findPath(w: World, from: number, to: number, maxIter = 40000, allowMountains = false): number[] {
  if (from === to) return [to];
  const N = WGW * WGH;
  if (!AS_G || AS_G.length !== N) { AS_G = new Float32Array(N); AS_CAME = new Int32Array(N); AS_STAMP = new Uint32Array(N); AS_CLOSED = new Uint32Array(N); }
  const stamp = ++AS_GEN;
  const g = AS_G, came = AS_CAME, seen = AS_STAMP, closedS = AS_CLOSED;
  const G0 = (i: number) => (seen[i] === stamp ? g[i] : 1e9);
  const heap: number[] = [], hf: number[] = [];
  const tx = to % WGW, ty = Math.floor(to / WGW);
  const h = (i: number) => { const dx = Math.abs((i % WGW) - tx), dy = Math.abs(Math.floor(i / WGW) - ty); return (Math.max(dx, dy) + 0.41 * Math.min(dx, dy)) * 0.65; };
  const push = (i: number, f: number) => { heap.push(i); hf.push(f); let k = heap.length - 1; while (k > 0) { const p = (k - 1) >> 1; if (hf[p] <= hf[k]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; [hf[p], hf[k]] = [hf[k], hf[p]]; k = p; } };
  const pop = () => { const top = heap[0]; const li = heap.pop(), lf = hf.pop(); if (heap.length) { heap[0] = li; hf[0] = lf; let k = 0; for (;;) { const l = k * 2 + 1, r = l + 1; let m = k; if (l < heap.length && hf[l] < hf[m]) m = l; if (r < heap.length && hf[r] < hf[m]) m = r; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; [hf[m], hf[k]] = [hf[k], hf[m]]; k = m; } } return top; };
  g[from] = 0; seen[from] = stamp; came[from] = -1; push(from, h(from));
  const targetOk = allowMountains || passableCell(w, to);
  let it = 0;
  while (heap.length && it++ < maxIter) {
    const c = pop();
    if (c === to) break;
    if (closedS[c] === stamp) continue;
    closedS[c] = stamp;
    const cx = c % WGW, cy = Math.floor(c / WGW);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dy) continue;
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= WGW || ny >= WGH) continue;
      const n = cidx(nx, ny);
      let cost: number;
      if (allowMountains) { const t = w.terr[n]; cost = t === T_SEA ? 1e9 : t === T_MOUNT ? 40 : t === T_RIVER ? 6 : t === T_SWAMP ? 4 : t === T_FOREST ? 2 : t === T_HILL ? 2 : 1; if (w.road[n] === 1) cost = 0.5; }
      else { if (!passableCell(w, n) && !(n === to && !targetOk)) continue; cost = moveCost(w, n); }
      if (cost >= 1e9) continue;
      if (dx && dy) { cost *= 1.41; if (!allowMountains && (!passableCell(w, cidx(cx + dx, cy)) || !passableCell(w, cidx(cx, cy + dy)))) continue; }
      const ng = g[c] + cost;
      if (ng < G0(n)) { g[n] = ng; seen[n] = stamp; came[n] = c; push(n, ng + h(n)); }
    }
  }
  if (seen[to] !== stamp || came[to] < 0) return [];
  const path: number[] = [];
  for (let c = to; c !== from && c >= 0; c = came[c]) path.push(c);
  return path.reverse();
}

// ---------- Generowanie świata ----------
const SETTLEMENT_PLAN: { f: number; cx: number; cy: number; list: [SKind, string][] }[] = [
  { f: 1, cx: 0.26, cy: 0.56, list: [["town", "Aurelion"], ["town", "Valmora"], ["castle", "Strażnica Świtu"], ["village", "Dębniki"], ["village", "Złota Łąka"]] },
  { f: 2, cx: 0.47, cy: 0.27, list: [["town", "Varusgrad"], ["town", "Kassia"], ["castle", "Żelazna Wieża"], ["village", "Obozowo"], ["village", "Kamionka"]] },
  { f: 3, cx: 0.8, cy: 0.5, list: [["town", "Khazgrim"], ["town", "Durnhold"], ["castle", "Brama Gromu"], ["village", "Miedziana Dolina"], ["village", "Kowalnia"]] },
  { f: 4, cx: 0.57, cy: 0.8, list: [["town", "Ghrakkar"], ["town", "Krwawy Bród"], ["castle", "Kościany Gród"], ["village", "Obóz Wilków"], ["village", "Czarne Namioty"]] },
  { f: 5, cx: 0.82, cy: 0.16, list: [["town", "Morvath"], ["town", "Popielisko"], ["castle", "Wieża Lamentu"], ["village", "Grobowo"], ["village", "Szare Mogiły"]] },
];
const LORD_PLAN: Record<number, { names: string[]; title: string }> = {
  1: { names: ["Edrik Valmont", "Maren Sorel", "Teodor Brann", "Alwin Morrow"], title: "Sir" },
  2: { names: ["Corvus Mallo", "Severa Dru", "Mallius Kato", "Drusa Venn"], title: "Legat" },
  3: { names: ["Borin Młotodzierżca", "Hilda Żelazna", "Grumli Szary", "Orvik Kamień"], title: "Than" },
  4: { names: ["Gorz Łamacz Czaszek", "Mokra Kieł", "Ugash Rzeźnik", "Throg Jednooki"], title: "Wódz" },
  5: { names: ["Valdris", "Selra Bladoręka", "Oszron", "Mardun Kościej"], title: "Upiór" },
};
const PERSONALITIES: Lord["personality"][] = ["honorowy", "chciwy", "okrutny", "ostrożny"];

function generateWorld(seed: number, player: PlayerState): World {
  _seed = seed >>> 0;
  const N = WGW * WGH;
  const w: World = {
    seed, day: 1, hour: 8, rain: false,
    terr: new Uint8Array(N), road: new Uint8Array(N), nearest: new Int16Array(N), explored: new Uint8Array(N), blight: new Uint8Array(N),
    settlements: [], parties: [], lords: [], places: [], factions: {}, chronicle: [], player, pid: 0, nextId: 1, questId: 1, ownerVersion: 0,
  };
  const so = seed % 10000;
  // wysokość i wilgotność
  const height = new Float32Array(N), moist = new Float32Array(N);
  for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) {
    const i = cidx(x, y);
    let h = vnoise(x + so, y, 40) * 0.5 + vnoise(x, y + so, 18) * 0.3 + vnoise(x + 77 + so, y + 31, 7) * 0.2;
    const nx = x / WGW, ny = y / WGH;
    // morze na zachodzie i południowym zachodzie
    const coast = 0.1 + Math.sin(ny * 6 + so) * 0.03 + (ny > 0.75 ? (ny - 0.75) * 0.9 : 0);
    if (nx < coast) h -= (coast - nx) * 6;
    if (nx > 0.97 || ny < 0.02 || ny > 0.97) h -= 0.25;
    // pasmo gór na wschodzie (Khazgrim) i grzbiet środkowy
    const ridge = 1 - Math.abs(vnoise(x + 200 + so, y + 50, 26) * 2 - 1);
    const east = Math.exp(-(((nx - 0.86) / 0.07) ** 2)) * (ny > 0.25 && ny < 0.78 ? 1 : 0.3);
    const mid = Math.exp(-(((nx - 0.6 - (ny - 0.5) * 0.25) / 0.03) ** 2)) * (ny > 0.38 && ny < 0.66 ? 1 : 0);
    h += ridge * 0.22 + east * 0.38 + mid * 0.3;
    height[i] = h;
    moist[i] = vnoise(x + 500 + so, y + 300, 22) * 0.7 + vnoise(x, y + 900, 9) * 0.3;
  }
  for (let i = 0; i < N; i++) {
    const h = height[i], m = moist[i];
    let t = T_PLAIN;
    if (h < 0.28) t = T_SEA;
    else if (h > 0.86) t = T_MOUNT;
    else if (h > 0.7) t = T_HILL;
    else if (m > 0.62) t = T_FOREST;
    else if (h < 0.37 && m > 0.5) t = T_SWAMP;
    w.terr[i] = t;
  }
  // rzeki z gór do morza
  const sources: number[] = [];
  for (let k = 0; k < 400 && sources.length < 6; k++) {
    const x = Math.floor(rr(WGW * 0.3, WGW * 0.92)), y = Math.floor(rr(8, WGH - 8)), i = cidx(x, y);
    if (height[i] > 0.72 && height[i] < 0.86 && sources.every((s) => dist(s % WGW, Math.floor(s / WGW), x, y) > 30)) sources.push(i);
  }
  for (const s of sources) {
    let c = s, steps = 0, prevDir = -1;
    const seen = new Set<number>();
    while (steps++ < 400) {
      seen.add(c);
      if (w.terr[c] === T_SEA) break;
      if (w.terr[c] !== T_MOUNT) w.terr[c] = T_RIVER;
      const cx = c % WGW, cy = Math.floor(c / WGW);
      let best = -1, bh = 1e9;
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (let d = 0; d < 4; d++) {
        const nx = cx + dirs[d][0], ny = cy + dirs[d][1];
        if (nx < 0 || ny < 0 || nx >= WGW || ny >= WGH) continue;
        const n = cidx(nx, ny);
        if (seen.has(n)) continue;
        // ciągnij lekko na zachód (do morza), z meandrami
        const v = height[n] + (d === 1 ? -0.012 : 0) + (d === prevDir ? -0.004 : 0) + vnoise(nx * 3, ny * 3, 5) * 0.02;
        if (v < bh) { bh = v; best = n; prevDir = d; }
      }
      if (best < 0) break;
      if (w.terr[best] === T_RIVER && steps > 4) break;   // dopływ
      c = best;
    }
  }
  // wybrzeże
  for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) {
    const i = cidx(x, y);
    if (w.terr[i] === T_SEA || w.terr[i] === T_RIVER) continue;
    let sea = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (terrAt(w, x + dx, y + dy) === T_SEA) sea = true;
    if (sea) w.terr[i] = T_BEACH;
  }
  // osady
  const okSite = (x: number, y: number) => { const t = terrAt(w, x, y); if (t !== T_PLAIN && t !== T_HILL && t !== T_FOREST && t !== T_BEACH) return false; for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const tt = terrAt(w, x + dx, y + dy); if (tt === T_SEA || tt === T_MOUNT || tt === T_RIVER) return false; } return true; };
  for (const plan of SETTLEMENT_PLAN) {
    const culture = FACTIONS[plan.f].culture;
    let first: Settlement | null = null;
    for (const [kind, name] of plan.list) {
      let px = 0, py = 0, ok = false;
      for (let tries = 0; tries < 900 && !ok; tries++) {
        const r = (first ? rr(9, 24) : rr(0, 6)) * (tries > 400 ? 1.6 : 1), a = rr(0, 6.28);
        const bx = first ? first.cx : plan.cx * WGW, by = first ? first.cy : plan.cy * WGH;
        px = Math.round(bx + Math.cos(a) * r); py = Math.round(by + Math.sin(a) * r * 0.8);
        if (px < 4 || py < 4 || px >= WGW - 4 || py >= WGH - 4) continue;
        if (!okSite(px, py)) continue;
        if (w.settlements.some((s) => dist(s.cx, s.cy, px, py) < (kind === "village" ? 8 : 11))) continue;
        ok = true;
      }
      if (!ok) { // wymuś miejsce: osusz teren
        px = Math.round(plan.cx * WGW + rr(-12, 12)); py = Math.round(plan.cy * WGH + rr(-10, 10));
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) w.terr[cidx(px + dx, py + dy)] = T_PLAIN;
      }
      const s: Settlement = {
        id: w.settlements.length, name, kind, cx: px, cy: py, faction: plan.f, culture, owner: -1,
        prosperity: kind === "village" ? 40 : 60, garrison: [], stock: {}, recruits: kind === "village" ? 8 : 12, recruitDay: 0, bound: -1,
        siegeBy: [], siegeDays: 0, raided: 0, companions: [], relation: 0, tournament: 0, seed: Math.floor(rnd() * 1e6), capital: !first,
      };
      for (const k of GOOD_KEYS) s.stock[k] = 30 * (CULTURE_PROD[culture]?.[k] || 1);
      w.settlements.push(s);
      if (!first) first = s;
      // ogródek wokół osady: równina
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const i = cidx(px + dx, py + dy); if (w.terr[i] === T_FOREST || w.terr[i] === T_SWAMP) w.terr[i] = T_PLAIN; }
    }
  }
  // wioski przypisane do najbliższego miasta lub zamku tej samej frakcji
  for (const v of w.settlements) if (v.kind === "village") {
    let best = -1, bd = 1e9;
    for (const s of w.settlements) if (s.kind !== "village" && s.faction === v.faction && w.settlements.filter((x) => x.bound === s.id).length < 2) { const d = dist(s.cx, s.cy, v.cx, v.cy); if (d < bd) { bd = d; best = s.id; } }
    v.bound = best;
  }
  // drogi: każda osada łączy się z dwiema najbliższymi; przez góry robi się przełęcz
  const linked = new Set<string>();
  const roadBetween = (a: Settlement, b: Settlement) => {
    const key = Math.min(a.id, b.id) + ":" + Math.max(a.id, b.id);
    if (linked.has(key)) return; linked.add(key);
    const path = findPath(w, cidx(a.cx, a.cy), cidx(b.cx, b.cy), 60000, true);
    for (const c of path) {
      if (w.terr[c] === T_MOUNT) w.terr[c] = T_HILL;
      if (w.terr[c] === T_SEA) continue;
      if (w.terr[c] === T_RIVER) w.road[c] = 2; else w.road[c] = 1;
    }
  };
  for (const a of w.settlements) {
    const others = w.settlements.filter((b) => b !== a).sort((p, q) => dist(a.cx, a.cy, p.cx, p.cy) - dist(a.cx, a.cy, q.cx, q.cy));
    for (const b of others.slice(0, a.kind === "village" ? 1 : 2)) roadBetween(a, b);
  }
  // spójność: każde miasto połączone ze stolicą Aurelii
  for (const s of w.settlements) if (findPath(w, cidx(s.cx, s.cy), cidx(w.settlements[0].cx, w.settlements[0].cy), 60000).length === 0) roadBetween(s, w.settlements[0]);
  // brody na rzekach
  for (let i = 0; i < N; i++) if (w.terr[i] === T_RIVER && w.road[i] === 0 && hashN(i, seed) < 0.035) {
    w.road[i] = 3;
    // rozszerz bród na sąsiednie komórki rzeki (przejście w poprzek)
    const x = i % WGW, y = Math.floor(i / WGW);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = cidx(x + dx, y + dy); if (terrAt(w, x + dx, y + dy) === T_RIVER) w.road[n] = 3; }
  }
  // najbliższa osada każdej komórki (terytoria)
  computeNearest(w);
  // martwa ziemia wokół Morvath
  for (let i = 0; i < N; i++) { const s = w.settlements[w.nearest[i]]; if (s && s.culture === "undead") w.blight[i] = 1; }
  // miejsca specjalne
  const placeKinds: SpecialPlace["kind"][] = ["ruins", "ruins", "ruins", "lair", "lair", "lair", "shrine", "shrine", "shrine", "camp", "camp", "camp", "camp", "cemetery", "cemetery", "cemetery"];
  const placeNames: Record<SpecialPlace["kind"], string[]> = {
    ruins: ["Ruiny Starego Opactwa", "Zapadła Twierdza", "Kurhan Pierwszych Królów", "Spalona Wieża"],
    lair: ["Wilcze Leże", "Jaskinia Wargów", "Gniazdo Bestii"],
    shrine: ["Kapliczka Świętej Ilvy", "Kamień Runiczny", "Ołtarz Popiołu"],
    camp: ["Obóz Zbójców", "Kryjówka Rzezimieszków", "Leśny Obóz Banitów", "Jaskinia Przemytników"],
    cemetery: ["Przeklęty Cmentarz", "Kopce Zarazy", "Pole Kości"],
  };
  const usedNames = new Set<string>();
  for (const kind of placeKinds) {
    for (let tries = 0; tries < 400; tries++) {
      const x = Math.floor(rr(6, WGW - 6)), y = Math.floor(rr(6, WGH - 6));
      if (!passableCell(w, cidx(x, y)) || w.terr[cidx(x, y)] === T_RIVER) continue;
      if (w.settlements.some((s) => dist(s.cx, s.cy, x, y) < 9)) continue;
      if (w.places.some((p) => dist(p.cx, p.cy, x, y) < 10)) continue;
      if (findPath(w, cidx(x, y), cidx(w.settlements[0].cx, w.settlements[0].cy), 60000).length === 0) continue;
      if (kind === "cemetery" && chance(0.5) && w.blight[cidx(x, y)] === 0) continue;
      const name = placeNames[kind].find((n) => !usedNames.has(n)) || placeNames[kind][0];
      usedNames.add(name);
      w.places.push({ id: w.places.length, kind, cx: x, cy: y, name, cleared: 0, seen: false });
      break;
    }
  }
  // frakcje
  for (const f of [1, 2, 3, 4, 5]) w.factions[f] = { id: f, war: {}, warDays: {}, truce: {}, relation: {}, gold: 5000, alive: true, name: FACTIONS[f].name };
  for (const a of [1, 2, 3, 4, 5]) for (const b of [1, 2, 3, 4, 5]) if (a !== b) w.factions[a].relation[b] = a === 5 || b === 5 ? -80 : Math.round(rr(-30, 30));
  for (const a of [1, 2, 3, 4]) setWar(w, a, 5, true, true);
  setWar(w, 1, 2, true, true);      // Korona i Legion zaczynają w wojnie
  setWar(w, 3, 4, true, true);      // krasnoludy i orkowie
  // lordowie i ich armie
  for (const f of [1, 2, 3, 4, 5]) {
    const LP = LORD_PLAN[f];
    const names = [FACTIONS[f].ruler.split(" ").slice(1).join(" "), ...LP.names];
    names.forEach((nm, k) => {
      const ruler = k === 0;
      const look = lordLook(f, ruler, w.lords.length);
      const L: Lord = { id: w.lords.length, name: nm, title: ruler ? FACTIONS[f].ruler.split(" ")[0] : LP.title, faction: f, look, party: -1, renown: ruler ? 800 : Math.round(rr(150, 500)), relation: 0, alive: true, captive: -1, respawn: 0, ruler, personality: ruler ? "honorowy" : pick(PERSONALITIES) };
      w.lords.push(L);
    });
    // nadania: zamki i miasta dla lordów
    const fiefs = w.settlements.filter((s) => s.faction === f && s.kind !== "village");
    const lords = w.lords.filter((l) => l.faction === f);
    fiefs.forEach((s, i) => { s.owner = lords[i % lords.length].id; });
  }
  for (const L of w.lords) spawnLordParty(w, L);
  // załogi
  for (const s of w.settlements) fillGarrison(w, s, s.kind === "town" ? 34 : s.kind === "castle" ? 26 : 0);
  // towarzysze w karczmach
  const towns = w.settlements.filter((s) => s.kind === "town");
  COMPANIONS.forEach((c, i) => towns[(i * 3 + 1) % towns.length].companions.push(c.id));
  // gracz: start w pobliżu wybranej frakcji lub losowej
  const startTown = w.settlements[0];
  const pp = newParty(w, "player", player.name, PLAYER_FACTION, startTown.cx * WCELL + 12, startTown.cy * WCELL + 14);
  w.pid = pp.id;
  // bandyci i bestie na start
  for (let i = 0; i < 7; i++) spawnFromPlace(w, "camp");
  for (let i = 0; i < 3; i++) spawnFromPlace(w, "lair");
  for (let i = 0; i < 3; i++) spawnFromPlace(w, "cemetery");
  chron(w, "Rok Popiołu. Korona Aureliańska i Legion Varusa toczą wojnę o Dolinę. Martwe Królestwo budzi się na północy.", PAL.bone);
  return w;
}

function computeNearest(w: World) {
  for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) {
    let best = 0, bd = 1e9;
    for (const s of w.settlements) { const d = (s.cx - x) ** 2 + (s.cy - y) ** 2 * 1.1 / (s.kind === "village" ? 0.6 : 1); if (d < bd) { bd = d; best = s.id; } }
    w.nearest[cidx(x, y)] = best;
  }
}

function lordLook(f: number, ruler: boolean, seed: number): Look {
  const best: Record<number, string> = { 1: "a_paladin", 2: "v_praetor", 3: "d_warden", 4: "o_ironhide", 5: "u_wight" };
  const key = f === 5 && ruler ? "u_dk" : f === 5 && seed % 3 === 1 ? "u_necro" : best[f];
  const L = troopLook(UNITS[key], seed * 7 + 3, f);
  if (f !== 5 || key === "u_wight") L.cape = [FACTIONS[f].col, FACTIONS[f].shade];
  if (ruler && L.race !== "dk") L.helm = f === 4 ? "orc" : f === 3 ? "dwarf" : "crest";
  L.dirt = 0.25; L.blood = 0.1;
  return L;
}

function newParty(w: World, kind: PartyKind, name: string, faction: number, x: number, y: number): Party {
  const p: Party = { id: w.nextId++, kind, name, faction, x, y, path: [], troops: [], prisoners: [], gold: 0, food: 20, state: "idle", wait: 0, anim: rnd() * 10 };
  w.parties.push(p);
  return p;
}

function factionTroops(f: number, budget: number, eliteBias = 0.5): Troop[] {
  const cul = FACTIONS[f]?.culture || "bandit";
  const pool = Object.values(UNITS).filter((d) => d.culture === cul && d.cost > 0 || (cul === "undead" && d.culture === "undead" && d.key !== "u_dk"));
  const out: Troop[] = [];
  let left = budget;
  let guard = 0;
  while (left > 0 && guard++ < 400) {
    const d = pick(pool);
    if (!d || d.key === "u_dk" || d.key === "hero" || d.key === "companion") continue;
    const w = [1, 0.85, 0.45 + eliteBias * 0.3, 0.2 + eliteBias * 0.3, 0.06 + eliteBias * 0.2][d.tier - 1] || 0.05;
    if (d.ability && chance(0.6)) continue;
    if (!chance(w)) continue;
    addTroops(out, d.key, 1);
    left -= 1;
  }
  return out;
}

function spawnLordParty(w: World, L: Lord) {
  const home = w.settlements.find((s) => s.owner === L.id) || w.settlements.find((s) => s.faction === L.faction && s.kind === "town");
  if (!home) { L.alive = false; return; }
  const p = newParty(w, "lord", `${L.title} ${L.name}`, L.faction, home.cx * WCELL + rr(-10, 10), home.cy * WCELL + rr(8, 16));
  p.lord = L.id; p.home = home.id; p.gold = 500;
  const size = Math.round((L.ruler ? 70 : 34) + L.renown / 20);
  p.troops = factionTroops(L.faction, size, L.ruler ? 0.9 : 0.5);
  if (L.faction === 5 && L.ruler) addTroops(p.troops, "u_dk", 1);
  if (L.faction === 5 && L.look.race === "human") addTroops(p.troops, "u_necro", 1);
  L.party = p.id;
}

function fillGarrison(w: World, s: Settlement, n: number) {
  const add = factionTroops(s.faction === PLAYER_FACTION ? (FACTION_OF_CULTURE[s.culture] || 1) : s.faction, n, 0.4);
  for (const t of add) addTroops(s.garrison, t.type, t.n);
}
const FACTION_OF_CULTURE: Partial<Record<Culture, number>> = { aurelia: 1, varus: 2, dwarf: 3, orc: 4, undead: 5 };

function spawnFromPlace(w: World, kind: "camp" | "lair" | "cemetery", place?: SpecialPlace) {
  const src = place || pick(w.places.filter((p) => p.kind === kind && p.cleared <= 0));
  if (!src) return;
  const x = src.cx * WCELL + rr(-8, 8), y = src.cy * WCELL + rr(-8, 8);
  if (kind === "camp") {
    const p = newParty(w, "bandit", pick(["Zbóje", "Banici", "Rzezimieszki", "Łotrzykowie", "Dezerterzy"]), 6, x, y);
    const n = Math.round(rr(6, 18) + w.day * 0.15);
    addTroops(p.troops, "b_bandit", Math.ceil(n * 0.6)); addTroops(p.troops, "b_archer", Math.floor(n * 0.35)); if (n > 12) addTroops(p.troops, "b_chief", 1);
    p.gold = n * 8; p.home = src.id;
  } else if (kind === "lair") {
    const p = newParty(w, "monster", pick(["Wilcza wataha", "Wargi", "Głodne wilki"]), 7, x, y);
    addTroops(p.troops, "x_wolf", Math.round(rr(5, 12))); p.home = src.id;
  } else {
    const p = newParty(w, "undead", pick(["Wstali z grobów", "Kościana horda", "Upiorna procesja"]), 5, x, y);
    const n = Math.round(rr(8, 20));
    addTroops(p.troops, "u_skel", Math.ceil(n * 0.6)); addTroops(p.troops, "u_ghoul", Math.floor(n * 0.3)); addTroops(p.troops, "u_archer", Math.floor(n * 0.15));
    if (chance(0.4)) addTroops(p.troops, "u_necro", 1);
    p.home = src.id;
  }
}

// ---------- Wojna i pokój ----------
function setWar(w: World, a: number, b: number, war: boolean, silent = false) {
  if (!w.factions[a] || !w.factions[b]) return;
  w.factions[a].war[b] = war; w.factions[b].war[a] = war;
  w.factions[a].warDays[b] = 0; w.factions[b].warDays[a] = 0;
  if (!war) { w.factions[a].truce[b] = 20; w.factions[b].truce[a] = 20; }
  if (!silent) chron(w, war ? `${factionName(a)} wypowiada wojnę: ${factionName(b)}!` : `${factionName(a)} i ${factionName(b)} zawierają pokój.`, war ? PAL.redL : PAL.moss);
}
function atWar(w: World, a: number, b: number): boolean {
  if (a === b) return false;
  if (a === 6 || b === 6 || a === 7 || b === 7) return true;            // bandyci i bestie
  if (a === PLAYER_FACTION || b === PLAYER_FACTION) { const o = a === PLAYER_FACTION ? b : a; return playerAtWarWith(w, o); }
  return !!w.factions[a]?.war[b];
}
function playerAtWarWith(w: World, f: number) {
  const P = w.player;
  if (f === 6 || f === 7) return true;
  if (P.liege > 0 && P.status !== "król") return f !== P.liege && !!w.factions[P.liege]?.war[f];
  if (P.status === "król" && w.factions[PLAYER_FACTION]) return !!w.factions[PLAYER_FACTION].war[f];
  return P.wars.includes(f);
}
function hostile(w: World, a: Party, b: Party) {
  if (a.kind === "caravan" && b.kind === "caravan") return false;
  if ((a.kind === "villagers" || a.kind === "caravan") && (b.kind === "villagers" || b.kind === "caravan")) return false;
  if (a.kind === "undead" || b.kind === "undead") return a.faction !== b.faction;
  if (a.kind === "bandit" && b.kind === "bandit") return false;
  if (a.kind === "monster" && b.kind === "monster") return false;
  if ((a.kind === "bandit" && b.kind === "monster") || (a.kind === "monster" && b.kind === "bandit")) return false;
  return atWar(w, a.faction, b.faction);
}
function playerDeclareWar(w: World, f: number) {
  const P = w.player;
  if (f === 6 || f === 7 || playerAtWarWith(w, f)) return;
  if (P.status === "król") { if (!w.factions[PLAYER_FACTION]) return; setWar(w, PLAYER_FACTION, f, true); return; }
  if (P.liege > 0) { // atak na neutralną frakcję jako wasal: zrywa przysięgę
    chron(w, `${P.name} łamie słowo dane władcy: ${factionName(P.liege)}.`, PAL.redL);
    leaveLiege(w, true);
  }
  P.wars.push(f);
  for (const L of w.lords) if (L.faction === f) L.relation -= 10;
  chron(w, `${P.name} napada na ludzi frakcji ${factionName(f)}. To oznacza wojnę.`, PAL.redL);
}
function leaveLiege(w: World, betray: boolean) {
  const P = w.player;
  if (P.liege <= 0) return;
  const f = P.liege;
  if (betray) { for (const L of w.lords) if (L.faction === f) L.relation -= 25; P.honor -= 10; P.wars.push(f); }
  // nadania wracają do korony
  for (const s of w.settlements) if (s.owner === -2 && s.faction === f) { s.owner = w.lords.find((l) => l.faction === f && l.alive)?.id ?? -1; }
  P.liege = 0; P.status = "wolny"; P.contractDays = 0;
}

// ---------- Ekonomia ----------
function price(w: World, s: Settlement, good: string) {
  const target = 40 * (s.kind === "village" ? 0.7 : 1);
  const k = clamp(Math.pow(target / Math.max(2, s.stock[good]), 0.55), 0.45, 3.2);
  return Math.max(1, Math.round(GOODS[good].base * k * (s.raided > 0 ? 1.3 : 1)));
}
function buyPrice(w: World, s: Settlement, good: string) { return Math.round(price(w, s, good) * (1.12 - w.player.skills.trade * 0.01)); }
function sellPrice(w: World, s: Settlement, good: string) { return Math.max(1, Math.round(price(w, s, good) * (0.88 + w.player.skills.trade * 0.01))); }
function itemPrice(it: Item, buy: boolean, trade: number) { return Math.round(it.price * (buy ? 1.1 - trade * 0.01 : 0.45 + trade * 0.015)); }
function smithItems(s: Settlement): string[] {
  const all = Object.values(ITEMS).filter((it) => !it.culture || it.culture === s.culture);
  const maxTier = s.kind === "town" ? (s.prosperity > 55 ? 3 : 2) : 1;
  const r = rnd; void r;
  return all.filter((it) => it.tier <= maxTier && hashInt(s.seed + it.id.length * 31 + it.price) % 100 < 72 - it.tier * 8).map((it) => it.id);
}

// ---------- Symulacja ----------
function partySpeed(w: World, p: Party): number {
  const n = Math.max(1, troopCount(p.troops) + (p.kind === "player" ? 1 + w.player.companions.length : 0));
  let cav = 0, wounded = 0;
  for (const t of p.troops) { if (UNITS[t.type]?.mount || UNITS[t.type]?.speed >= 65) cav += t.n; wounded += t.wounded; }
  let sp = 4.4 - Math.min(1.8, n * 0.012);
  sp += (cav / n) * 1.6;
  sp -= (wounded / n) * 1.6;
  if (season(w) === 3) sp *= 0.85;   // zima: śnieg spowalnia
  if (p.kind === "player") { if (w.player.equip.horse) sp += 0.25; sp += w.player.skills.tracking * 0.03; sp *= 1.12; }   // lekka przewaga gracza w pościgu
  if (p.kind === "caravan" || p.kind === "villagers") sp *= 0.8;
  if (p.kind === "monster") sp *= 1.15;
  if (p.kind === "undead") sp *= 0.85;
  if (isNight(w)) sp *= 0.85;
  if (p.prisoners.length) sp -= troopCount(p.prisoners) * 0.02;
  const i = cellOf(p.x, p.y);
  sp /= moveCost(w, i);
  if (w.blight[i] && p.faction !== 5) sp *= 0.93;
  return Math.max(0.8, sp);
}
function sightRadius(w: World, p?: Party) { const base = isNight(w) ? 7 : 13; return base + (p && p.kind === "player" ? w.player.skills.tracking * 0.8 : 0); }

// Pory roku: 30 dni każda. 0 wiosna, 1 lato, 2 jesień, 3 zima.
function season(w: World) { return Math.floor((w.day - 1) / 30) % 4; }
const SEASON_NAME = ["wiosna", "lato", "jesień", "zima"];
function moveParty(w: World, p: Party, hours: number) {
  if (!p.path.length) return;
  // ślady na mapie (do tropienia)
  const pa = p as any; pa.trailD = (pa.trailD || 0) + partySpeed(w, p) * hours;
  if (pa.trailD > 2) { pa.trailD = 0; (pa.trail ||= []).push([Math.round(p.x), Math.round(p.y), w.day * 24 + w.hour]); if (pa.trail.length > 14) pa.trail.shift(); }
  let budget = partySpeed(w, p) * hours * WCELL;
  while (budget > 0 && p.path.length) {
    const c = p.path[0];
    const tx = (c % WGW) * WCELL + 4, ty = Math.floor(c / WGW) * WCELL + 4;
    const d = dist(p.x, p.y, tx, ty);
    if (d <= budget) { p.x = tx; p.y = ty; budget -= d; p.path.shift(); }
    else { p.x += ((tx - p.x) / d) * budget; p.y += ((ty - p.y) / d) * budget; budget = 0; }
    p.anim += hours * 6;
  }
}
function goTo(w: World, p: Party, x: number, y: number) {
  const from = cellOf(p.x, p.y), to = cellOf(x, y);
  p.path = findPath(w, from, to, 25000);
  return p.path.length > 0;
}

// Codzienny przebieg świata: żołd, jedzenie, produkcja, rekrutacja, dyplomacja, oblężenia.
function dailyTick(w: World) {
  w.day++;
  const win = season(w) === 3;
  w.rain = chance(win ? 0.3 : 0.22);
  w.fog = !w.rain && chance(season(w) === 2 ? 0.25 : 0.14);
  (w as any).storm = w.rain && !win && chance(0.3);
  // dyplomacja
  const F = [1, 2, 3, 4];
  for (const a of F) for (const b of F) if (a < b && w.factions[a].alive && w.factions[b].alive) {
    const fa = w.factions[a];
    if (fa.war[b]) {
      fa.warDays[b] = (fa.warDays[b] || 0) + 1; w.factions[b].warDays[a] = fa.warDays[b];
      if (fa.warDays[b] > 18 && chance(0.04 + fa.warDays[b] * 0.001)) setWar(w, a, b, false);
    } else {
      fa.truce[b] = Math.max(0, (fa.truce[b] || 0) - 1); w.factions[b].truce[a] = fa.truce[b];
      const wars = Object.values(fa.war).filter(Boolean).length;
      if (fa.truce[b] <= 0 && wars < 3 && chance(0.012 + (fa.relation[b] < -10 ? 0.02 : 0))) setWar(w, a, b, true);
    }
  }
  // królestwo gracza: wrogowie mogą zaproponować pokój, inni wypowiedzieć wojnę
  // osady
  for (const s of w.settlements) {
    if (s.raided > 0) { s.raided--; if (s.raided === 0) chron(w, `${s.name} odbudowuje się po grabieży.`); }
    const prod = CULTURE_PROD[s.culture] || {};
    for (const k of GOOD_KEYS) {
      const p = (prod[k] || 0.6) * (s.kind === "village" ? (GOODS[k].food ? 2.2 : 0.6) : 1) * (s.raided > 0 ? 0.2 : 1) * (0.6 + s.prosperity / 100);
      s.stock[k] = clamp(s.stock[k] + p * 2 - (s.kind === "town" ? 1.6 : 0.9) * (GOODS[k].food ? 1.2 : 0.7), 1, 160);
    }
    s.prosperity = clamp(s.prosperity + (s.siegeBy.length || s.raided ? -0.6 : 0.08), 5, 100);
    if (w.day - s.recruitDay >= 5) { s.recruitDay = w.day; s.recruits = Math.min(s.kind === "village" ? 14 : 20, s.recruits + Math.round(2 + s.prosperity / 25)); }
    // załoga rośnie powoli
    if (s.kind !== "village" && !s.siegeBy.length && troopCount(s.garrison) < (s.kind === "town" ? 42 : 30) && chance(0.3)) fillGarrison(w, s, 2);
    if (s.tournament > 0) s.tournament--;
    if (s.kind === "town" && s.tournament === 0 && chance(0.015)) { s.tournament = 6; chron(w, `W ${s.name} ogłoszono turniej. Nagroda: 600 denarów.`, PAL.gold); }
    // oblężenie AI
    if (s.siegeBy.length) {
      s.siegeBy = s.siegeBy.filter((id) => { const p = partyById(w, id); return p && p.siege === s.id && atWar(w, p.faction, s.faction); });
      if (s.siegeBy.length) {
        s.siegeDays++;
        // głód: po wyczerpaniu zapasów załoga słabnie z dnia na dzień
        if (s.siegeDays > siegeStores(s)) { applyLosses(s.garrison, 0.05); if (s.siegeDays === siegeStores(s) + 1) chron(w, `Głód w oblężonym ${s.name}. Załoga słabnie.`, PAL.redL); }
        if (s.siegeDays >= 4 && !s.siegeBy.includes(w.pid)) aiAssault(w, s);
      }
      else s.siegeDays = 0;
    }
  }
  // lordowie bez armii wracają
  for (const L of w.lords) {
    if (!L.alive) continue;
    if (L.party < 0 || !partyById(w, L.party)) {
      if (L.captive >= 0) { if (chance(0.06)) { L.captive = -1; chron(w, `${L.title} ${L.name} wraca z niewoli.`); } continue; }
      L.respawn--;
      if (L.respawn <= 0 && w.settlements.some((s) => s.faction === L.faction)) { spawnLordParty(w, L); const p = partyById(w, L.party); if (p) p.troops = p.troops.slice(0, Math.max(1, Math.floor(p.troops.length * 0.6))); }
    }
  }
  // frakcja bez osad upada
  for (const f of [1, 2, 3, 4, 5]) if (w.factions[f].alive && !w.settlements.some((s) => s.faction === f)) {
    w.factions[f].alive = false;
    chron(w, `${factionName(f)} upada. Ostatnie twierdze zostały zdobyte.`, PAL.redL);
    for (const L of w.lords) if (L.faction === f) { L.alive = false; const p = partyById(w, L.party); if (p) w.parties.splice(w.parties.indexOf(p), 1); }
  }
  // bandyci, bestie, karawany
  const count = (k: PartyKind) => w.parties.filter((p) => p.kind === k).length;
  if (count("bandit") < 10 && chance(0.6)) spawnFromPlace(w, "camp");
  if (count("monster") < 4 && chance(0.25)) spawnFromPlace(w, "lair");
  if (count("undead") < 5 && chance(0.3)) spawnFromPlace(w, "cemetery");
  if (count("caravan") < 6 && chance(0.5)) spawnCaravan(w);
  if (count("villagers") < 5 && chance(0.4)) spawnVillagers(w);
  for (const p of w.places) if (p.cleared > 0) p.cleared--;
  // lordowie: uzupełnienia w domu
  for (const p of w.parties) if (p.kind === "lord") {
    const L = lordById(w, p.lord);
    const home = p.home !== undefined ? w.settlements[p.home] : null;
    const cap = Math.round((L.ruler ? 90 : 45) + L.renown / 15);
    if (home && home.faction === p.faction && dist(p.x, p.y, home.cx * WCELL, home.cy * WCELL) < 40 && troopCount(p.troops) < cap) {
      for (const t of factionTroops(p.faction, Math.min(8, cap - troopCount(p.troops)), 0.3)) addTroops(p.troops, t.type, t.n);
    }
    for (const t of p.troops) t.wounded = Math.max(0, t.wounded - Math.ceil(t.wounded * 0.15));
    // awanse wojsk lordów
    if (chance(0.15)) for (const t of p.troops) { const d = UNITS[t.type]; if (d.up && d.up.length && t.n > 2 && chance(0.3)) { const up = pick(d.up); const n = Math.ceil(t.n * 0.15); removeTroops(p.troops, t.type, n); addTroops(p.troops, up, n); break; } }
  }
  playerDaily(w);
}

function spawnCaravan(w: World) {
  const towns = w.settlements.filter((s) => s.kind === "town");
  const a = pick(towns), b = pick(towns.filter((t) => t !== a && !atWar(w, t.faction, a.faction)));
  if (!b) return;
  const p = newParty(w, "caravan", `Karawana z ${a.name}`, a.faction, a.cx * WCELL + 4, a.cy * WCELL + 12);
  addTroops(p.troops, "m_sword", Math.round(rr(4, 9))); addTroops(p.troops, "m_xbow", Math.round(rr(2, 5)));
  p.dest = b.id; p.home = a.id; p.gold = Math.round(rr(300, 700)); p.goods = {};
  // zabiera z miasta to, czego ma najwięcej
  const sorted = GOOD_KEYS.slice().sort((x, y) => a.stock[y] - a.stock[x]);
  for (const k of sorted.slice(0, 2)) { const n = Math.floor(a.stock[k] * 0.3); a.stock[k] -= n; p.goods[k] = n; }
  goTo(w, p, b.cx * WCELL + 4, b.cy * WCELL + 4);
}
function spawnVillagers(w: World) {
  const v = pick(w.settlements.filter((s) => s.kind === "village" && s.bound >= 0 && s.raided === 0));
  if (!v) return;
  const t = w.settlements[v.bound];
  if (!t || t.faction !== v.faction) return;
  const p = newParty(w, "villagers", `Chłopi z ${v.name}`, v.faction, v.cx * WCELL + 4, v.cy * WCELL + 10);
  addTroops(p.troops, FACTIONS[v.faction]?.culture === "undead" ? "u_skel" : (RECRUITS[v.culture]?.village[0] || "b_bandit"), Math.round(rr(4, 10)));
  p.dest = t.id; p.home = v.id; p.goods = { grain: 20 };
  goTo(w, p, t.cx * WCELL + 4, t.cy * WCELL + 4);
}

function aiAssault(w: World, s: Settlement) {
  const att = s.siegeBy.map((id) => partyById(w, id)).filter(Boolean);
  const ap = att.reduce((sum, p) => sum + partyPower(w, p), 0);
  const dp = troopPower(s.garrison) * 2.1 + 8;
  const win = ap * rr(0.75, 1.25) > dp;
  const lossA = clamp((dp / Math.max(1, ap)) * 0.45, 0.05, 0.9), lossD = clamp((ap / Math.max(1, dp)) * 0.5, 0.1, 1);
  for (const p of att) applyLosses(p.troops, win ? lossA : Math.min(0.9, lossA * 1.4));
  applyLosses(s.garrison, win ? 1 : lossD);
  if (win) {
    const leader = att.sort((a, b) => partyPower(w, b) - partyPower(w, a))[0];
    captureSettlement(w, s, leader.faction, leader.lord ?? -1);
    // część armii zostaje w załodze
    for (const t of leader.troops) { const n = Math.floor(t.n * 0.3); if (n > 0) { addTroops(s.garrison, t.type, n); removeTroops(leader.troops, t.type, n); } }
  } else chron(w, `Szturm na ${s.name} odparty. Obrońcy trzymają mury.`, PAL.bone);
  for (const p of att) { p.siege = undefined; p.state = "idle"; p.wait = 0; }
  s.siegeBy = []; s.siegeDays = 0;
}
function captureSettlement(w: World, s: Settlement, faction: number, ownerLord: number) {
  const old = s.faction;
  s.faction = faction; s.owner = ownerLord;
  s.prosperity = Math.max(10, s.prosperity - 15);
  // wioski przypisane idą za swym zamkiem
  for (const v of w.settlements) if (v.bound === s.id) { v.faction = faction; v.owner = ownerLord; }
  w.ownerVersion++;
  chron(w, `${s.name} pada! ${factionName(faction)} odbiera to miejsce frakcji ${factionName(old)}.`, PAL.gold);
}
function siegeStores(s: Settlement) { return Math.round((s.kind === "castle" ? 12 : 9) * (0.6 + s.prosperity / 100)); }
function applyLosses(list: Troop[], frac: number) {
  for (const t of list.slice()) { const n = Math.min(t.n, Math.round(t.n * frac * rr(0.8, 1.2))); removeTroops(list, t.type, n); }
}

// Starcie dwóch oddziałów AI rozstrzygane od razu.
function aiBattle(w: World, a: Party, b: Party) {
  const pa = partyPower(w, a) * rr(0.8, 1.2), pb = partyPower(w, b) * rr(0.8, 1.2);
  const [win, lose] = pa >= pb ? [a, b] : [b, a];
  const ratio = Math.min(pa, pb) / Math.max(pa, pb, 0.01);
  applyLosses(win.troops, clamp(ratio * 0.45, 0.02, 0.8));
  const survivors = Math.round(troopCount(lose.troops) * rr(0.05, 0.25));
  // jeńcy
  if (lose.kind !== "monster" && lose.kind !== "undead" && win.kind !== "monster" && win.kind !== "undead") for (const t of lose.troops) addTroops(win.prisoners, t.type, Math.floor(t.n * 0.25));
  win.gold += Math.floor(lose.gold * 0.7);
  if (lose.goods && win.kind === "bandit") win.gold += 200;
  // lordowie
  if (lose.lord !== undefined) {
    const L = lordById(w, lose.lord);
    if (win.kind === "lord" && chance(0.45)) { L.captive = win.faction; chron(w, `${win.name} rozbija armię ${lose.name}. ${L.title} ${L.name} trafia do niewoli.`, PAL.redL); }
    else chron(w, `${win.name} rozbija armię ${lose.name}.`, PAL.redL);
    L.party = -1; L.respawn = Math.round(rr(4, 9));
  } else if (win.lord !== undefined && (lose.kind === "bandit" || lose.kind === "undead") && chance(0.3)) chron(w, `${win.name} rozgromił: ${lose.name}.`);
  else if (lose.kind === "caravan" && win.kind === "bandit") chron(w, `Zbóje złupili karawanę w pobliżu ${nearestSettlement(w, lose.x, lose.y).name}.`, PAL.ash);
  else if (lose.kind === "villagers") chron(w, `${win.name}: napad na chłopów z ${w.settlements[lose.home]?.name || "wioski"}.`, PAL.ash);
  if (survivors > 0 && lose.kind === "lord") { /* rozproszeni */ }
  removeParty(w, lose);
  if (troopCount(win.troops) === 0 && win.kind !== "player") removeParty(w, win);
}
function removeParty(w: World, p: Party) {
  const i = w.parties.indexOf(p);
  if (i >= 0) w.parties.splice(i, 1);
  if (p.lord !== undefined) { const L = lordById(w, p.lord); if (L && L.party === p.id) { L.party = -1; if (L.respawn <= 0) L.respawn = Math.round(rr(4, 9)); } }
  for (const s of w.settlements) s.siegeBy = s.siegeBy.filter((id) => id !== p.id);
}
function nearestSettlement(w: World, x: number, y: number) { return w.settlements[w.nearest[cellOf(x, y)]]; }

// AI oddziałów: wybór celu co jakiś czas, pościg, ucieczka, oblężenia, grabież.
function partyAI(w: World, p: Party, hours: number) {
  if (p.kind === "player") return;
  p.wait -= hours;
  if (!p.path.length) { arrive(w, p); if (!w.parties.includes(p)) return; }
  const pw = (o: Party) => { let v = POWC.get(o.id); if (v === undefined) { v = partyPower(w, o); POWC.set(o.id, v); } return v; };
  const sight = sightRadius(w) * WCELL;
  // zagrożenia i ofiary w zasięgu wzroku
  let threat: Party | null = null, prey: Party | null = null, td = 1e9, pd = 1e9;
  const myPow = pw(p);
  if (p.state !== "siege") for (const o of w.parties) {
    if (o === p || !hostile(w, p, o)) continue;
    const d = dist(p.x, p.y, o.x, o.y);
    if (d > sight) continue;
    if (o.kind === "player" && w.player.captive) continue;
    const op = pw(o);
    if (op > myPow * 1.2 && d < td) { td = d; threat = o; }
    else if (op < myPow * 0.9 && d < pd && (p.kind !== "caravan" && p.kind !== "villagers")) { pd = d; prey = o; }
  }
  if (threat && (p.kind !== "lord" || td < sight * 0.6)) {
    if (p.state !== "flee" || p.wait <= 0) {
      p.state = "flee"; p.wait = 3;
      const a = Math.atan2(p.y - threat.y, p.x - threat.x);
      const safe = p.kind === "caravan" || p.kind === "villagers" || p.kind === "lord" ? friendlySettlementNear(w, p) : null;
      if (safe) goTo(w, p, safe.cx * WCELL + 4, safe.cy * WCELL + 4);
      else goTo(w, p, clamp(p.x + Math.cos(a) * 90, 20, WGW * WCELL - 20), clamp(p.y + Math.sin(a) * 90, 20, WGH * WCELL - 20));
    }
  } else if (prey && (p.kind === "bandit" || p.kind === "monster" || p.kind === "undead" || p.kind === "lord")) {
    if (p.state !== "chase" || p.target !== prey.id || p.wait <= 0) { p.state = "chase"; p.target = prey.id; p.wait = 1; goTo(w, p, prey.x, prey.y); }
  } else if (p.wait <= 0 || (!p.path.length && p.state !== "siege" && p.state !== "raid" && p.state !== "rest" && p.state !== "besiege")) {
    chooseGoal(w, p);
  }
  moveParty(w, p, hours);
  // kontakt
  for (const o of w.parties) {
    if (o === p || o.kind === "player" || !hostile(w, p, o)) continue;
    if (dist(p.x, p.y, o.x, o.y) < 7) { aiBattle(w, p, o); return; }
  }
}
function friendlySettlementNear(w: World, p: Party) {
  let best: Settlement | null = null, bd = 1e9;
  for (const s of w.settlements) if (s.kind !== "village" && !atWar(w, p.faction, s.faction)) { const d = dist(p.x, p.y, s.cx * WCELL, s.cy * WCELL); if (d < bd) { bd = d; best = s; } }
  return best;
}
function chooseGoal(w: World, p: Party) {
  p.wait = rr(6, 18);
  if (p.kind === "caravan" || p.kind === "villagers") {
    const d = w.settlements[p.dest];
    if (d) goTo(w, p, d.cx * WCELL + 4, d.cy * WCELL + 4);
    return;
  }
  if (p.kind === "bandit" || p.kind === "monster" || p.kind === "undead") {
    const home = p.home !== undefined ? w.places[p.home] : null;
    const bx = home ? home.cx * WCELL : p.x, by = home ? home.cy * WCELL : p.y;
    const r = p.kind === "undead" ? 140 : 180;
    for (let k = 0; k < 8; k++) { if (goTo(w, p, clamp(bx + rr(-r, r), 10, WGW * WCELL - 10), clamp(by + rr(-r, r), 10, WGH * WCELL - 10))) break; }
    p.state = "wander";
    return;
  }
  if (p.kind === "lord") {
    const L = lordById(w, p.lord);
    const n = troopCount(p.troops);
    const home = p.home !== undefined ? w.settlements[p.home] : null;
    // słaba armia: do domu
    if (n < 20 && home && home.faction === p.faction) { p.state = "rest"; goTo(w, p, home.cx * WCELL + 4, home.cy * WCELL + 10); p.wait = 30; return; }
    const enemies = w.settlements.filter((s) => atWar(w, p.faction, s.faction) && s.faction !== 6);
    if (enemies.length && chance(L.personality === "ostrożny" ? 0.35 : 0.6)) {
      const near = enemies.sort((a, b) => dist(p.x, p.y, a.cx * WCELL, a.cy * WCELL) - dist(p.x, p.y, b.cx * WCELL, b.cy * WCELL)).slice(0, 3);
      const t = pick(near);
      if (t.kind === "village" && t.raided === 0 && (L.personality !== "honorowy" || chance(0.3))) { p.state = "raid"; p.target = t.id; goTo(w, p, t.cx * WCELL + 4, t.cy * WCELL + 4); return; }
      if (t.kind !== "village" && partyPower(w, p) > troopPower(t.garrison) * 1.7) { p.state = "besiege"; p.target = t.id; goTo(w, p, t.cx * WCELL + 4, t.cy * WCELL + 14); p.wait = 40; return; }
    }
    // patrol własnych ziem
    const own = w.settlements.filter((s) => s.faction === p.faction);
    if (own.length) { const t = pick(own); p.state = "patrol"; goTo(w, p, t.cx * WCELL + rr(-20, 20), t.cy * WCELL + rr(-20, 20)); }
  }
}
function arrive(w: World, p: Party) {
  if ((p.kind === "caravan" || p.kind === "villagers") && p.dest !== undefined) {
    const d = w.settlements[p.dest];
    if (d && dist(p.x, p.y, d.cx * WCELL + 4, d.cy * WCELL + 4) < 14) {
      for (const k in p.goods || {}) d.stock[k] = Math.min(160, d.stock[k] + p.goods[k]);
      d.prosperity = Math.min(100, d.prosperity + (p.kind === "caravan" ? 2 : 1));
      if (p.home !== undefined) w.settlements[p.home].prosperity = Math.min(100, w.settlements[p.home].prosperity + 1);
      removeParty(w, p);
    }
    return;
  }
  if (p.kind !== "lord") return;
  if (p.state === "raid" && p.target !== undefined) {
    const v = w.settlements[p.target];
    if (v && dist(p.x, p.y, v.cx * WCELL + 4, v.cy * WCELL + 4) < 16 && atWar(w, p.faction, v.faction)) {
      if (p.wait > 8) p.wait = 8;
      if (p.wait <= 0.5) { v.raided = 12; v.prosperity = Math.max(5, v.prosperity - 20); p.gold += 300; for (const k of FOOD_KEYS) v.stock[k] = 2; chron(w, `${p.name} pustoszy wioskę ${v.name}.`, PAL.redL); p.state = "idle"; p.wait = 0; }
    }
  }
  if (p.state === "besiege" && p.target !== undefined) {
    const s = w.settlements[p.target];
    if (s && dist(p.x, p.y, s.cx * WCELL + 4, s.cy * WCELL + 14) < 16 && atWar(w, p.faction, s.faction)) {
      p.state = "siege"; p.siege = s.id; p.wait = 999;
      if (!s.siegeBy.includes(p.id)) { s.siegeBy.push(p.id); if (s.siegeBy.length === 1) chron(w, `${p.name} oblega ${s.name}.`, PAL.redL); }
    } else if (s && !atWar(w, p.faction, s.faction)) { p.state = "idle"; p.wait = 0; }
  }
  if (p.state === "siege" && p.siege !== undefined) {
    const s = w.settlements[p.siege];
    if (!s || !atWar(w, p.faction, s.faction)) { p.state = "idle"; p.siege = undefined; p.wait = 0; }
  }
}

// Godzinny przebieg: ruch wszystkich oddziałów AI.
const POWC = new Map<number, number>();
function worldTick(w: World, hours: number) {
  POWC.clear();
  const before = w.hour;
  w.hour += hours;
  if (w.hour >= 24) { w.hour -= 24; dailyTick(w); }
  void before;
  for (const p of w.parties.slice()) if (w.parties.includes(p)) partyAI(w, p, hours);
}

// ---------- Gracz: dzienne koszty ----------
function playerParty(w: World) { return partyById(w, w.pid); }
function partyWages(w: World) {
  const p = playerParty(w);
  let s = 0;
  for (const t of p.troops) s += (UNITS[t.type]?.wage || 1) * t.n;
  for (const c of w.player.companions) s += c.wage;
  return s;
}
function partyLimit(w: World) { const P = w.player; return 20 + P.skills.leadership * 5 + Math.floor(P.attr.cha * 1.5) + Math.floor(P.renown / 25); }
function foodTotal(w: World) { return FOOD_KEYS.reduce((s, k) => s + (w.player.goods[k] || 0), 0); }
function playerDaily(w: World) {
  const P = w.player, p = playerParty(w);
  if (!p || P.captive) return;
  const n = troopCount(p.troops) + 1 + P.companions.length;
  // jedzenie
  let need = Math.ceil(n / 8);
  const kinds = FOOD_KEYS.filter((k) => (P.goods[k] || 0) > 0).length;
  for (const k of FOOD_KEYS) { while (need > 0 && (P.goods[k] || 0) > 0) { P.goods[k]--; need--; } }
  if (need > 0) { P.morale -= 12; addLogMsg("Brak jedzenia! Morale spada, ludzie dezerterują.", PAL.redL); desert(w, 0.06); }
  else P.morale += kinds >= 2 ? 1.5 : 0.3;
  // rany
  const cm = p.state === "camp" ? ((P as any).campMode || "rest") : "";
  const heal = 0.1 + P.skills.medicine * 0.03 + (cm === "rest" ? 0.25 : cm ? 0.1 : 0);
  // obóz: trening podnosi doświadczenie (kosztem jedzenia), wartownicy chronią przed zaskoczeniem
  if (cm === "train") { for (const t of p.troops) t.xp += (6 + P.skills.leadership * 2) * Math.max(1, t.n - t.wounded); if ((P.goods.grain || 0) > 0) P.goods.grain--; }
  for (const t of p.troops) t.wounded = Math.max(0, t.wounded - Math.ceil(t.wounded * heal));
  const maxHp = heroMaxHp(P);
  P.hp = Math.min(maxHp, P.hp + maxHp * (0.12 + (cm === "rest" ? 0.25 : cm ? 0.1 : 0)));
  for (const c of P.companions) c.hp = Math.min(c.maxHp, c.hp + c.maxHp * 0.15);
  P.faith = Math.min(100, P.faith + (8 + P.attr.cha) * (1 + perk(P, "faith")));
  P.mana = Math.min(100, P.mana + (10 + P.attr.int * 1.5) * (1 + perk(P, "mana")));
  P.corruption = Math.max(0, P.corruption - 0.5);
  // żołd co 7 dni
  if (w.day - P.lastPay >= 7) {
    P.lastPay = w.day;
    const wage = partyWages(w) * 7;
    if (P.gold >= wage) { P.gold -= wage; addLogMsg(`Wypłacono żołd: ${wage} denarów.`, PAL.gold); }
    else { const paid = P.gold; P.gold = 0; P.morale -= 25; addLogMsg(`Brak pieniędzy na żołd (${paid}/${wage}). Ludzie szemrzą i odchodzą.`, PAL.redL); desert(w, 0.12); }
  }
  // najemnik: zapłata od pracodawcy
  if (P.status === "najemnik" && P.liege > 0) {
    const pay = Math.round(troopCount(p.troops) * 3 + 20);
    P.gold += pay; P.contractDays--;
    if (P.contractDays <= 0) { addLogMsg(`Kontrakt najemniczy z ${factionName(P.liege)} wygasł.`, PAL.bone); P.liege = 0; P.status = "wolny"; }
  }
  // dochód z lenn
  for (const s of w.settlements) if (s.owner === -2) { const inc = Math.round((s.kind === "town" ? 60 : s.kind === "castle" ? 30 : 15) * (0.5 + s.prosperity / 100) * (s.raided ? 0.2 : 1)); P.gold += inc; }
  // przesadna armia obniża morale
  if (n > partyLimit(w)) P.morale -= 3;
  P.morale = clamp(P.morale, 0, 100);
  if (P.morale < 20) desert(w, 0.04);
  // jeńcy mogą się dołączyć
  for (const t of p.prisoners.slice()) if (chance(0.03 + P.skills.leadership * 0.005) && !UNITS[t.type].undead) { removeTroops(p.prisoners, t.type, 1); addTroops(p.troops, t.type, 1); addLogMsg(`Jeniec (${UNITS[t.type].name}) przechodzi na twoją stronę.`, PAL.bone); }
  // zadania
  for (const q of P.quests) if (!q.done) { q.days--; if (q.days <= 0) { q.done = true; addLogMsg(`Zadanie przepadło: ${q.text}`, PAL.ash); if (w.settlements[q.giver]) w.settlements[q.giver].relation -= 5; } }
  P.quests = P.quests.filter((q) => !q.done || q.days > -3);
}
function desert(w: World, frac: number) {
  const p = playerParty(w);
  let lost = 0;
  for (const t of p.troops.slice()) { const n = Math.floor(t.n * frac + (chance(frac * t.n % 1) ? 1 : 0)); if (n > 0) { removeTroops(p.troops, t.type, n); lost += n; } }
  if (lost) addLogMsg(`Zdezerterowało ${lost} ludzi.`, PAL.redL);
}
let addLogMsg: (t: string, c?: string) => void = () => {};

function heroMaxHp(P: PlayerState) { return 70 + P.attr.str * 3 + (P.attr.end || 4) * 7 + P.skills.ironflesh * 8 + P.level * 2 + (P.race === "dwarf" ? 15 : P.race === "orc" ? 10 : 0); }

// ---------- Towarzysze ----------
const COMPANIONS: { id: string; name: string; race: Race; role: string; weapon: string; shield: boolean; armor: number; bow: number; horse: boolean; hp: number; cost: number; wage: number; bio: string; helm: Helm; body: BodyMat }[] = [
  { id: "kasia", name: "Kasia Wrona", race: "human", role: "łuczniczka", weapon: "dagger", shield: false, armor: 0.12, bow: 46, horse: false, hp: 110, cost: 300, wage: 8, bio: "Kłusowniczka spod Valmory. Nie pyta, do kogo strzela, póki płacisz.", helm: "hood", body: "leather" },
  { id: "bogdan", name: "Bogdan Siekiera", race: "human", role: "rębajło", weapon: "greataxe", shield: false, armor: 0.2, bow: 0, horse: false, hp: 150, cost: 450, wage: 12, bio: "Były drwal i dezerter z Legionu. Topór trzyma pewniej niż kufel.", helm: "kettle", body: "mail" },
  { id: "ilse", name: "Siostra Ilse", race: "human", role: "kapłanka", weapon: "mace", shield: true, armor: 0.16, bow: 0, horse: false, hp: 120, cost: 400, wage: 10, bio: "Wygnana z zakonu za walkę z nieumarłymi bez rozkazu. Leczy rany i dusze.", helm: "mitre", body: "robe" },
  { id: "dvalin", name: "Dvalin Ognisty Kufel", race: "dwarf", role: "obrońca", weapon: "warhammer", shield: true, armor: 0.28, bow: 0, horse: false, hp: 170, cost: 600, wage: 14, bio: "Krasnolud wygnany z Khazgrim za zbyt głośne śpiewanie w kopalni.", helm: "dwarf", body: "plate" },
  { id: "grashna", name: "Grashna", race: "orc", role: "zwiadowczyni", weapon: "axe", shield: false, armor: 0.14, bow: 0, horse: true, hp: 140, cost: 380, wage: 10, bio: "Orczyca, która porzuciła hordę. Jeździ jak burza, milczy jak grób.", helm: "none", body: "leather" },
  { id: "brakk", name: "Brakk Żelazna Miarka", race: "dwarf", role: "inżynier", weapon: "warhammer", shield: false, armor: 0.22, bow: 0, horse: false, hp: 140, cost: 550, wage: 13, bio: "Krasnoludzki saper. Postawi wieżę oblężniczą z byle czego i policzy, ile głazów trzeba na mur.", helm: "dwarf", body: "mail" },
  { id: "teodor", name: "Teodor Zdrajca", race: "human", role: "rycerz", weapon: "sword", shield: true, armor: 0.25, bow: 0, horse: true, hp: 150, cost: 800, wage: 18, bio: "Pozbawiony herbu rycerz Korony. Twierdzi, że był niewinny.", helm: "great", body: "plate" },
];
function makeCompanion(id: string): CompanionState {
  const c = COMPANIONS.find((x) => x.id === id);
  const v = hashInt(id.length * 99 + id.charCodeAt(0));
  const look: Look = {
    race: c.race, build: c.race === "dwarf" ? 2 : 1, tall: c.race === "orc", skin: c.race === "orc" ? [PAL.moss, PAL.grassD] : [PAL.skin, PAL.skinD],
    hair: vpick(v, 1, [PAL.dirtD, PAL.black, PAL.rust, PAL.ash]), beard: c.race === "dwarf" ? 3 : id === "bogdan" ? 2 : 0, scar: id === "grashna" || id === "bogdan" ? 1 : 0,
    helm: c.helm, body: c.body, tabard: null, cape: id === "teodor" ? [PAL.red, PAL.bloodD] : undefined, hood: c.body === "robe" ? [PAL.bone, PAL.ash] : c.helm === "hood" ? [PAL.moss, PAL.grassD] : undefined,
    pants: PAL.dirt, boots: PAL.woodD, quiver: c.bow > 0, scabbard: c.weapon === "sword", dirt: 0.4, blood: 0.2, seed: v,
  };
  return { id, name: c.name, look, hp: c.hp, maxHp: c.hp, weapon: c.weapon, shield: c.shield, armor: c.armor, bow: c.bow, horse: c.horse, role: c.role, wage: c.wage, bio: c.bio, level: 1, squad: c.bow ? 2 : c.horse ? 3 : 1 };
}

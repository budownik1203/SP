// Świat: generowanie mapy (teren, rzeki, drogi), osady, frakcje, lordowie, oddziały, ekonomia, wojny, kronika.

const WCELL = 8;
const WGW = 320, WGH = 200;              // komórki mapy świata (2560×1600 px)
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
interface Quest { id: number; kind: "bandits" | "letter" | "grain" | "wolves" | "defend" | "cattle" | "militia" | "capture" | "persuade" | "raid" | "kidnap" | "relieve" | "relic" | "escort"; giver: number; target: number; amount: number; reward: number; days: number; text: string; done: boolean; giverLord?: number; item?: string; hide?: boolean; failed?: boolean; }
interface ChronEntry { day: number; text: string; col?: string; cat?: string; }

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

interface Diff { dmg: number; enemy: number; gold: number; aggro: number; plague: number; xp: number; }
interface World {
  diff?: Diff; plot?: { stage: number; relics: number; day: number; hermit?: number; done?: boolean };
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
function chronCat(text: string, col?: string) {
  const t = text.toLowerCase();
  if (/turniej|karawan/.test(t)) return "trade";
  if (/wojn|napada|szturm|odparty|rozbija|pustoszy|grabi|pali|łupi/.test(t)) return /oblega|szturm|pada!|odparty/.test(t) ? "siege" : "war";
  if (/oblega|pada!|zdobyt|głód w oblężonym/.test(t)) return "siege";
  if (/pokój|sojusz|trybut|ślub|rozejm/.test(t)) return "peace";
  if (/zaraza|zmarli|morvath|martw/.test(t)) return "plague";
  if (/turniej|karawan|targ|ceny/.test(t)) return "trade";
  if (/lord|niewol|przysięg|zdrad|bunt|rada /.test(t)) return "lord";
  return col === PAL.gold ? "player" : "misc";
}
function chron(w: World, text: string, col?: string, cat?: string) { w.chronicle.push({ day: w.day, text, col, cat: cat || chronCat(text, col) }); if (w.chronicle.length > 300) w.chronicle.shift(); if (typeof onChronicle === "function") onChronicle(text, col); }
let onChronicle: (t: string, c?: string) => void = null as any;
function isNight(w: World) { return w.hour < 5 || w.hour >= 21; }
function factionName(id: number) { if (id === PLAYER_FACTION) return WORLD?.player.kingdom || "Twoje królestwo"; return FACTIONS[id]?.name || "Nikt"; }
function factionShort(id: number) { if (id === PLAYER_FACTION) return WORLD?.player.kingdom || "Twoje królestwo"; return FACTIONS[id]?.short || "?"; }
function factionCol(id: number) { if (id === PLAYER_FACTION) { const F = FACTIONS[PLAYER_FACTION]; return F.col === PAL.goldD && F.trim === PAL.gold ? [PAL.gold, PAL.goldD, PAL.white] : [F.col, F.shade, F.trim]; } const F = FACTIONS[id]; return F ? [F.col, F.shade, F.trim] : [PAL.dirt, PAL.dirtD, PAL.bone]; }

// ---------- A* ----------
let AS_G: Float32Array = null as any, AS_CAME: Int32Array = null as any, AS_STAMP: Uint32Array = null as any, AS_CLOSED: Uint32Array = null as any, AS_GEN = 0;
function findPath(w: World, from: number, to: number, maxIter = 90000, allowMountains = false): number[] {
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
// ---------- Projekt mapy (zawsze ta sama kraina, szczegóły z szumu) ----------
// Projekt w siatce 240×150, skalowany do rozmiaru mapy (MS).
const MS = WGW / 240;
const RIVER_PTS: { pts: number[]; wide: boolean }[] = [];   // gładkie koryta rzek do rysowania (komórki zostają do przejść)
const sc2 = (a: [number, number][]) => a.map(([x, y]) => [x * MS, y * MS] as [number, number]);
const sc3 = (a: [number, number, number][]) => a.map(([x, y, r]) => [x * MS, y * MS, r * MS] as [number, number, number]);
// Współrzędne w komórkach (240×150). Wybrzeże, pasma gór, rzeki, lasy, bagna i osady są rozplanowane ręcznie.
const MAP_COAST: [number, number][] = sc2([[18, 10], [44, 7], [70, 9], [96, 5], [124, 8], [150, 4], [176, 6], [204, 5], [228, 10], [235, 34], [229, 52], [236, 74], [231, 98], [236, 118], [224, 136], [198, 142], [176, 139], [154, 144], [128, 141], [106, 145], [86, 139], [72, 131], [60, 136], [42, 133], [28, 124], [20, 108], [9, 96], [14, 80], [7, 62], [13, 46], [8, 30]]);
const MAP_GULFS: [number, number, number][] = sc3([[50, 121, 11], [9, 56, 4], [232, 64, 4], [120, 144, 5], [182, 141, 4]]);   // zatoki
const MAP_ISLES: [number, number, number][] = sc3([[5, 40, 3], [28, 140, 3], [215, 145, 2], [240, 88, 3]]);
const MAP_LAKES: [number, number, number][] = sc3([[121, 76, 5], [176, 32, 3]]);
const MAP_RANGES: { pts: [number, number][]; w: number }[] = ([
  { pts: [[198, 28], [206, 46], [203, 64], [210, 82], [205, 102], [212, 122]], w: 12 },   // Góry Khazgrim
  { pts: [[146, 40], [158, 30], [170, 26], [182, 30]], w: 6 },                            // Kły Popiołu
  { pts: [[118, 118], [132, 111], [146, 114], [158, 110]], w: 5 },                         // Grań Kości
  { pts: [[96, 48], [101, 52]], w: 4 },                                                     // Samotna Turnia
  { pts: [[226, 40], [230, 56]], w: 4 },
] as { pts: [number, number][]; w: number }[]).map((r) => ({ pts: sc2(r.pts), w: r.w * MS }));
const MAP_HILLS: { pts: [number, number][]; w: number }[] = ([
  { pts: [[42, 52], [46, 66], [40, 80]], w: 7 },     // Wzgórza Aureliańskie
  { pts: [[78, 22], [96, 18], [112, 22]], w: 6 },    // pogórze Legionu
  { pts: [[184, 70], [188, 96], [186, 118]], w: 7 },  // przedgórze Khazgrim
  { pts: [[140, 52], [152, 58]], w: 5 },
] as { pts: [number, number][]; w: number }[]).map((r) => ({ pts: sc2(r.pts), w: r.w * MS }));
const MAP_RIVERS: { name: string; pts: [number, number][]; wide?: number }[] = ([
  { name: "Srebrna", pts: [[196, 62], [180, 66], [160, 70], [140, 73], [126, 76], [116, 76], [100, 73], [84, 71], [66, 69], [50, 68], [34, 66], [18, 64], [10, 64]], wide: 1 },
  { name: "Szara", pts: [[160, 38], [150, 48], [140, 58], [130, 66], [122, 72]] },
  { name: "Krwawa", pts: [[202, 108], [190, 114], [176, 120], [160, 126], [146, 132], [134, 142]] },
  { name: "Popielna", pts: [[192, 24], [186, 16], [182, 8], [182, 4]] },
  { name: "Dębnica", pts: [[66, 34], [52, 38], [38, 34], [24, 30], [12, 28]] },
  { name: "Wilcza", pts: [[96, 104], [104, 96], [112, 88], [118, 80]] },
  { name: "Zimny Potok", pts: [[220, 70], [226, 72], [234, 74]] },
] as { name: string; pts: [number, number][]; wide?: number }[]).map((r) => ({ ...r, pts: sc2(r.pts) }));
const MAP_FORESTS: [number, number, number][] = sc3([[62, 42, 14], [30, 46, 7], [128, 38, 11], [90, 98, 12], [160, 84, 9], [74, 112, 8], [214, 132, 8], [186, 52, 6], [116, 60, 6], [50, 96, 6]]);
const MAP_SWAMPS: [number, number, number][] = sc3([[170, 38, 8], [210, 22, 6], [60, 116, 6], [138, 96, 4]]);
const MAP_REGIONS: [string, number, number][] = ([["Korona Aurelii", 38, 84], ["Dolina Srebrna", 96, 66], ["Ziemie Legionu", 106, 30], ["Puszcza Dębowa", 60, 44], ["Góry Khazgrim", 210, 74], ["Step Ghrakka", 150, 124], ["Pustkowia Morvath", 196, 20], ["Kły Popiołu", 162, 34], ["Wilczy Las", 90, 102], ["Morze Zachodnie", 4, 112], ["Zatoka Mgieł", 50, 124], ["Jezioro Lustrzane", 121, 82], ["Grań Kości", 138, 108]] as [string, number, number][]).map(([n, x, y]) => [n, Math.round(x * MS), Math.round(y * MS)] as [string, number, number]);
function inPoly(x: number, y: number, P: [number, number][]) { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, yi] = P[i], [xj, yj] = P[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; }
function segD(px: number, py: number, a: [number, number], b: [number, number]) { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1; const t = clamp(((px - a[0]) * dx + (py - a[1]) * dy) / L, 0, 1); return Math.hypot(px - a[0] - dx * t, py - a[1] - dy * t); }
function lineD(px: number, py: number, P: [number, number][]) { let d = 1e9; for (let k = 0; k < P.length - 1; k++) d = Math.min(d, segD(px, py, P[k], P[k + 1])); return P.length === 1 ? Math.hypot(px - P[0][0], py - P[0][1]) : d; }
function steppeAt(cx: number, cy: number) { cx /= MS; cy /= MS; return cx > 100 && cx < 200 && cy > 94 + (cx > 180 ? 10 : 0); }
// Osady: stolice i część twierdz w stałych miejscach, reszta rozstawiona w krainie frakcji w dużych odstępach.
// Na frakcję: 3 miasta, 4 zamki, 10 wiosek (każda wioska należy do swojego miasta lub zamku).
const SETTLEMENT_PLAN: { f: number; cx: number; cy: number; rx: number; ry: number; fixed: [SKind, string, number, number][]; towns: string[]; castles: string[]; villages: string[] }[] = [
  { f: 1, cx: 40, cy: 82, rx: 36, ry: 38, fixed: [["town", "Aurelion", 40, 74], ["town", "Valmora", 30, 104], ["castle", "Strażnica Świtu", 62, 90], ["castle", "Wieża Mew", 22, 48]], towns: ["Solmira"], castles: ["Zamek Lilii", "Twierdza Brzegowa"], villages: ["Dębniki", "Złota Łąka", "Rybaki", "Winnice", "Makowo", "Pszeniczna", "Jabłonka", "Owcza Dolina", "Młyńsko", "Białe Brzegi"] },
  { f: 2, cx: 106, cy: 28, rx: 44, ry: 22, fixed: [["town", "Varusgrad", 92, 30], ["town", "Kassia", 128, 22], ["castle", "Żelazna Wieża", 110, 52], ["castle", "Orli Szaniec", 72, 16]], towns: ["Novium"], castles: ["Kamienny Obóz", "Strażnica Legatów"], villages: ["Obozowo", "Kamionka", "Brzozy", "Wilcze Pole", "Żołnierska Wola", "Zbrojnica", "Kopacze", "Kolonia", "Smolna", "Cyprysy"] },
  { f: 3, cx: 206, cy: 84, rx: 26, ry: 44, fixed: [["town", "Khazgrim", 204, 70], ["town", "Durnhold", 214, 104], ["castle", "Brama Gromu", 190, 88], ["castle", "Kamienna Straż", 200, 44]], towns: ["Karak Druun"], castles: ["Kuźnia Przodków", "Strażnica Runów"], villages: ["Miedziana Dolina", "Kowalnia", "Głęboka Sztolnia", "Rudna", "Węglowo", "Srebrna Żyła", "Kamieniołom", "Grota Piwna", "Mszysta Hala", "Kopalnia Gromu"] },
  { f: 4, cx: 148, cy: 120, rx: 50, ry: 24, fixed: [["town", "Ghrakkar", 150, 122], ["town", "Krwawy Bród", 176, 128], ["castle", "Kościany Gród", 124, 104], ["castle", "Czaszkowa Skała", 108, 130]], towns: ["Ugrakh"], castles: ["Kieł Stepu", "Krwawe Ostrogi"], villages: ["Obóz Wilków", "Czarne Namioty", "Błotne Szałasy", "Dymiące Ogniska", "Kościste Koło", "Stado Bawołów", "Pasterski Kurhan", "Suche Studnie", "Popielne Pastwiska", "Wronie Gniazdo"] },
  { f: 5, cx: 196, cy: 24, rx: 36, ry: 20, fixed: [["town", "Morvath", 202, 20], ["town", "Popielisko", 168, 16], ["castle", "Wieża Lamentu", 184, 40], ["castle", "Czarna Cytadela", 224, 28]], towns: ["Nekropol"], castles: ["Kostnica", "Mglista Wieża"], villages: ["Grobowo", "Szare Mogiły", "Zgniła Grobla", "Wronie Pole", "Kurhany", "Trumniki", "Popielnik", "Zimne Krzyże", "Martwy Młyn", "Cicha Dolina"] },
];
const LORD_PLAN: Record<number, { names: string[]; title: string }> = {
  1: { names: ["Edrik Valmont", "Maren Sorel", "Teodor Brann", "Alwin Morrow", "Ida Solmir", "Konrad Brzeg"], title: "Sir" },
  2: { names: ["Corvus Mallo", "Severa Dru", "Mallius Kato", "Drusa Venn", "Tiber Ostra", "Livia Grank"], title: "Legat" },
  3: { names: ["Borin Młotodzierżca", "Hilda Żelazna", "Grumli Szary", "Orvik Kamień", "Dvalgar Runiczny", "Thora Miedziana"], title: "Than" },
  4: { names: ["Gorz Łamacz Czaszek", "Mokra Kieł", "Ugash Rzeźnik", "Throg Jednooki", "Brakka Stepowa", "Muzg Kościożerca"], title: "Wódz" },
  5: { names: ["Valdris", "Selra Bladoręka", "Oszron", "Mardun Kościej", "Grawen Bezoki", "Ilsa Szronowa"], title: "Upiór" },
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
  // teren z projektu: ląd z wielokąta wybrzeża (poszarpany szumem), góry i wzgórza wzdłuż pasm, lasy, bagna, jeziora
  for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) {
    const i = cidx(x, y);
    const jx = (vnoise(x, y, 14) - 0.5) * 14 + (vnoise(x + 300, y, 5) - 0.5) * 5, jy = (vnoise(x + 50, y + 50, 14) - 0.5) * 14 + (vnoise(x, y + 300, 5) - 0.5) * 5;
    let land = inPoly(x + jx, y + jy, MAP_COAST);
    for (const [gx, gy, r] of MAP_GULFS) if (Math.hypot(x - gx, y - gy) < r + (vnoise(x * 2, y * 2, 6) - 0.5) * 4) land = false;
    for (const [ix, iy, r] of MAP_ISLES) if (Math.hypot(x - ix, y - iy) < r + (vnoise(x * 3, y * 3, 4) - 0.5) * 2) land = true;
    for (const [lx, ly, r] of MAP_LAKES) if (Math.hypot(x - lx, (y - ly) * 1.3) < r + (vnoise(x * 3, y * 3, 5) - 0.5) * 2) land = false;
    if (x < 1 || y < 1 || x >= WGW - 1 || y >= WGH - 1) land = false;
    if (!land) { w.terr[i] = T_SEA; continue; }
    let t = T_PLAIN;
    const n1 = vnoise(x, y, 6), n2 = vnoise(x + 900, y + 400, 14);
    let ridge = 0;
    for (const R of MAP_RANGES) ridge = Math.max(ridge, 1 - lineD(x, y, R.pts) / (R.w * (0.65 + n2 * 0.7)));
    let hill = 0;
    for (const R of MAP_HILLS) hill = Math.max(hill, 1 - lineD(x, y, R.pts) / (R.w * (0.6 + n2 * 0.8)));
    if (ridge > 0.42 + n1 * 0.18) t = T_MOUNT;
    else if (ridge > 0.12 || (hill > 0.2 && n1 > 0.35) || vnoise(x + 11, y + 77, 8) > 0.82) t = T_HILL;
    else {
      let forest = false, swamp = false;
      for (const [fx, fy, r] of MAP_FORESTS) if (Math.hypot(x - fx, (y - fy) * 1.15) < r * (0.7 + vnoise(x * 2 + fx, y * 2, 7) * 0.6)) forest = true;
      if (!forest && !steppeAt(x, y) && vnoise(x + 500, y + 300, 10) > 0.76) forest = true;   // zagajniki
      if (steppeAt(x, y) && forest && n1 < 0.5) forest = false;                                 // step: mało lasu
      for (const [sx2, sy2, r] of MAP_SWAMPS) if (Math.hypot(x - sx2, y - sy2) < r * (0.6 + vnoise(x * 2, y * 2 + sx2, 6) * 0.7)) swamp = true;
      t = swamp ? T_SWAMP : forest ? T_FOREST : T_PLAIN;
    }
    w.terr[i] = t;
  }
  // przełęcze i doliny w Górach Khazgrim (240-siatka: linie w poprzek pasma)
  for (const [ax, ay, bx, by] of [[188, 58, 222, 54], [186, 88, 222, 90], [190, 112, 226, 116], [196, 36, 214, 40]]) {
    const A2: [number, number] = [ax * MS, ay * MS], B2: [number, number] = [bx * MS, by * MS];
    for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) { const i = cidx(x, y); if (w.terr[i] === T_MOUNT && segD(x, y, A2, B2) < 1.6 + vnoise(x * 3, y * 3, 5) * 1.5) w.terr[i] = T_HILL; }
  }
  // rzeki według projektu, z meandrami; w górach drążą dolinę
  RIVER_PTS.length = 0;
  let curPts: number[] | null = null;
  const riverCells = (R: typeof MAP_RIVERS[number]) => {
    const out: number[] = [];
    const ph = R.name.length * 1.7;
    for (let k = 0; k < R.pts.length - 1; k++) {
      const [ax, ay] = R.pts[k], [bx, by] = R.pts[k + 1];
      const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / (L || 1), ny = (bx - ax) / (L || 1);
      for (let s2 = 0; s2 <= L; s2 += 0.25) {
        const u = s2 / (L || 1), gt = k * 10 + s2;
        const m = Math.sin(gt * 0.45 + ph) * 1.4 + (vnoise(gt * 3, ph * 10, 6) - 0.5) * 2.2;
        const fx = ax + (bx - ax) * u + nx * m, fy = ay + (by - ay) * u + ny * m;
        const x = Math.round(fx), y = Math.round(fy);
        if (curPts) curPts.push(fx, fy);
        if (x < 0 || y < 0 || x >= WGW || y >= WGH) continue;
        const c = cidx(x, y);
        if (out[out.length - 1] !== c) out.push(c);
      }
    }
    return out;
  };
  for (const R of MAP_RIVERS) {
    curPts = []; const ptsR = curPts;
    const cells = riverCells(R);
    curPts = null;
    // punkty gładkiego koryta: do ujścia w morzu (jeziora po drodze są wodą)
    { const out: number[] = []; for (let k = 0; k < ptsR.length; k += 2) { const c = cidx(clamp(Math.round(ptsR[k]), 0, WGW - 1), clamp(Math.round(ptsR[k + 1]), 0, WGH - 1)); if (w.terr[c] === T_SEA && !MAP_LAKES.some(([lx, ly, r]) => Math.hypot(ptsR[k] - lx, ptsR[k + 1] - ly) < r + 3)) { out.push(ptsR[k], ptsR[k + 1]); break; } out.push(ptsR[k], ptsR[k + 1]); } RIVER_PTS.push({ pts: out, wide: !!R.wide }); }
    let prev = -1;
    for (const c of cells) {
      if (w.terr[c] === T_SEA) { const cx3 = c % WGW, cy3 = Math.floor(c / WGW); if (MAP_LAKES.some(([lx, ly, r]) => Math.hypot(cx3 - lx, cy3 - ly) < r + 3)) { prev = -1; continue; } break; }
      // ciągłość 4-sąsiedzka (żeby nie dało się przejść po skosie)
      if (prev >= 0) { const px = prev % WGW, py = Math.floor(prev / WGW), cx2 = c % WGW, cy2 = Math.floor(c / WGW); if (px !== cx2 && py !== cy2) { const mid = cidx(cx2, py); if (w.terr[mid] !== T_SEA) w.terr[mid] = T_RIVER; } }
      w.terr[c] = T_RIVER;
      if (R.wide && (c % WGW) < 70 * MS) { const b = c + WGW; if (b < N && w.terr[b] !== T_SEA) w.terr[b] = T_RIVER; }
      // dolina: wokół rzeki w górach wzgórza
      const cx2 = c % WGW, cy2 = Math.floor(c / WGW);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const n = cidx(clamp(cx2 + dx, 0, WGW - 1), clamp(cy2 + dy, 0, WGH - 1)); if (w.terr[n] === T_MOUNT) w.terr[n] = T_HILL; }
      prev = c;
    }
  }
  // wybrzeże
  for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) {
    const i = cidx(x, y);
    if (w.terr[i] === T_SEA || w.terr[i] === T_RIVER) continue;
    let sea = false;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (terrAt(w, x + dx, y + dy) === T_SEA) sea = true;
    if (sea && w.terr[i] !== T_MOUNT) w.terr[i] = T_BEACH;
  }
  // osady: stałe miejsca (z korektą terenu), potem losowo w krainie frakcji z dużymi odstępami, wioski wokół swoich panów
  const okSite = (x: number, y: number) => { const t = terrAt(w, x, y); if (t !== T_PLAIN && t !== T_HILL && t !== T_FOREST && t !== T_BEACH) return false; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const tt = terrAt(w, x + dx, y + dy); if (tt === T_SEA || tt === T_MOUNT || tt === T_RIVER) return false; } return true; };
  const ownRegion = (x: number, y: number, f: number) => { let best = -1, bd = 1e9; for (const P of SETTLEMENT_PLAN) { const d = Math.hypot((x - P.cx * MS) / (P.rx * MS), (y - P.cy * MS) / (P.ry * MS)); if (d < bd) { bd = d; best = P.f; } } return best === f && bd < 1; };
  const addS = (kind: SKind, name: string, px: number, py: number, f: number, first: boolean, bound = -1) => {
    const culture = FACTIONS[f].culture;
    const st: Settlement = {
      id: w.settlements.length, name, kind, cx: px, cy: py, faction: f, culture, owner: -1,
      prosperity: kind === "village" ? 40 : 60, garrison: [], stock: {}, recruits: kind === "village" ? 8 : 12, recruitDay: 0, bound,
      siegeBy: [], siegeDays: 0, raided: 0, companions: [], relation: 0, tournament: 0, seed: Math.floor(rnd() * 1e6), capital: first,
    };
    for (const k of GOOD_KEYS) st.stock[k] = 30 * (CULTURE_PROD[culture]?.[k] || 1);
    w.settlements.push(st);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = cidx(clamp(px + dx, 0, WGW - 1), clamp(py + dy, 0, WGH - 1)); if (w.terr[c] === T_FOREST || w.terr[c] === T_SWAMP || w.terr[c] === T_MOUNT) w.terr[c] = T_PLAIN; }
    return st;
  };
  const nearAny = (x: number, y: number, dF: number, dV: number) => w.settlements.some((o) => Math.hypot(o.cx - x, o.cy - y) < (o.kind === "village" ? dV : dF));
  const forts: Settlement[][] = [];
  for (const plan of SETTLEMENT_PLAN) {
    const mine: Settlement[] = [];
    plan.fixed.forEach(([kind, name, bx0, by0], k) => {
      const bx = Math.round(bx0 * MS), by = Math.round(by0 * MS);
      let px = bx, py = by, ok = okSite(bx, by);
      for (let r = 1; r <= 6 && !ok; r++) for (let dy = -r; dy <= r && !ok; dy++) for (let dx = -r; dx <= r && !ok; dx++) if (okSite(bx + dx, by + dy)) { px = bx + dx; py = by + dy; ok = true; }
      if (!ok) for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const c = cidx(bx + dx, by + dy); if (w.terr[c] !== T_SEA && w.terr[c] !== T_RIVER) w.terr[c] = T_PLAIN; }
      mine.push(addS(kind, name, px, py, plan.f, k === 0));
    });
    forts.push(mine);
  }
  // dodatkowe miasta i zamki w krainie frakcji
  SETTLEMENT_PLAN.forEach((plan, pi) => {
    const extra: [SKind, string][] = [...plan.towns.map((n) => ["town", n] as [SKind, string]), ...plan.castles.map((n) => ["castle", n] as [SKind, string])];
    for (const [kind, name] of extra) {
      let placed = false;
      for (let tries = 0; tries < 3000 && !placed; tries++) {
        const a = rr(0, Math.PI * 2), r = Math.sqrt(rnd());
        const x = Math.round((plan.cx + Math.cos(a) * plan.rx * r) * MS), y = Math.round((plan.cy + Math.sin(a) * plan.ry * r) * MS);
        if (x < 6 || y < 6 || x >= WGW - 6 || y >= WGH - 6 || !okSite(x, y) || !ownRegion(x, y, plan.f)) continue;
        if (nearAny(x, y, tries < 2000 ? 22 : 16, 9)) continue;
        forts[pi].push(addS(kind, name, x, y, plan.f, false)); placed = true;
      }
    }
  });
  // wioski wokół miast (po 2) i zamków (po 1); zostałe przy najbliższym panu
  SETTLEMENT_PLAN.forEach((plan, pi) => {
    const names = plan.villages.slice();
    const lords2 = [...forts[pi].filter((x) => x.kind === "town"), ...forts[pi].filter((x) => x.kind === "town"), ...forts[pi].filter((x) => x.kind === "castle")];
    while (names.length && lords2.length) {
      const par = lords2.shift(), name = names.shift();
      let placed = false;
      for (let tries = 0; tries < 2500 && !placed; tries++) {
        const a = rr(0, Math.PI * 2), r = rr(8, tries < 1500 ? 15 : 22);
        const x = Math.round(par.cx + Math.cos(a) * r), y = Math.round(par.cy + Math.sin(a) * r * 0.85);
        if (x < 4 || y < 4 || x >= WGW - 4 || y >= WGH - 4 || !okSite(x, y)) continue;
        if (nearAny(x, y, 8, 8)) continue;
        addS("village", name, x, y, plan.f, false, par.id); placed = true;
      }
    }
  });
  // wioski przypisane do najbliższego miasta lub zamku tej samej frakcji
  for (const v of w.settlements) if (v.kind === "village" && v.bound < 0) {
    let best = -1, bd = 1e9;
    for (const s of w.settlements) if (s.kind !== "village" && s.faction === v.faction && w.settlements.filter((x) => x.bound === s.id).length < 2) { const d = dist(s.cx, s.cy, v.cx, v.cy); if (d < bd) { bd = d; best = s.id; } }
    v.bound = best;
  }
  // drogi: każda osada łączy się z dwiema najbliższymi; przez góry robi się przełęcz
  const linked = new Set<string>();
  const roadBetween = (a: Settlement, b: Settlement) => {
    const key = Math.min(a.id, b.id) + ":" + Math.max(a.id, b.id);
    if (linked.has(key)) return; linked.add(key);
    const path = findPath(w, cidx(a.cx, a.cy), cidx(b.cx, b.cy), 120000, true);
    for (const c of path) {
      if (w.terr[c] === T_MOUNT) w.terr[c] = T_HILL;
      if (w.terr[c] === T_SEA) continue;
      if (w.terr[c] === T_RIVER) w.road[c] = 2; else w.road[c] = 1;
    }
  };
  // trakty: miasta z dwoma najbliższymi miastami; zamki zwykle z miastem; wioski tylko czasem mają drogę do pana
  const towns0 = w.settlements.filter((x) => x.kind === "town");
  for (const a of towns0) for (const b of towns0.filter((b) => b !== a).sort((p, q) => dist(a.cx, a.cy, p.cx, p.cy) - dist(a.cx, a.cy, q.cx, q.cy)).slice(0, 2)) roadBetween(a, b);
  for (const a of w.settlements.filter((x) => x.kind === "castle")) if (hashN(a.id, 17) < 0.75) { const b = towns0.slice().sort((p, q) => dist(a.cx, a.cy, p.cx, p.cy) - dist(a.cx, a.cy, q.cx, q.cy))[0]; roadBetween(a, b); }
  for (const v of w.settlements.filter((x) => x.kind === "village")) if (v.bound >= 0 && hashN(v.id, 29) < 0.35) roadBetween(v, w.settlements[v.bound]);
  // wielkie trakty między stolicami i przez przełęcze
  const byName = (n: string) => w.settlements.find((x) => x.name === n);
  for (const [a2, b2] of [["Aurelion", "Varusgrad"], ["Aurelion", "Kościany Gród"], ["Varusgrad", "Kassia"], ["Kassia", "Popielisko"], ["Żelazna Wieża", "Brama Gromu"], ["Brama Gromu", "Khazgrim"], ["Ghrakkar", "Krwawy Bród"], ["Krwawy Bród", "Durnhold"], ["Kościany Gród", "Żelazna Wieża"], ["Morvath", "Kamienna Straż"], ["Strażnica Świtu", "Czaszkowa Skała"], ["Valmora", "Aurelion"]] as [string, string][]) { const A = byName(a2), B = byName(b2); if (A && B) roadBetween(A, B); }
  // brody na rzekach
  for (let i = 0; i < N; i++) if (w.terr[i] === T_RIVER && w.road[i] === 0 && hashN(i, 7) < 0.05) {
    w.road[i] = 3;
    // rozszerz bród na sąsiednie komórki rzeki (przejście w poprzek)
    const x = i % WGW, y = Math.floor(i / WGW);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = cidx(x + dx, y + dy); if (terrAt(w, x + dx, y + dy) === T_RIVER) w.road[n] = 3; }
  }
  // spójność: każde miasto połączone ze stolicą Aurelii
  for (const s of w.settlements) if (findPath(w, cidx(s.cx, s.cy), cidx(w.settlements[0].cx, w.settlements[0].cy), 120000).length === 0) roadBetween(s, w.settlements[0]);
  // najbliższa osada każdej komórki (terytoria)
  computeNearest(w);
  // martwa ziemia wokół Morvath
  recomputeBlight(w);
  // miejsca specjalne
  const placeKinds: SpecialPlace["kind"][] = ["ruins", "ruins", "ruins", "ruins", "ruins", "lair", "lair", "lair", "lair", "shrine", "shrine", "shrine", "shrine", "camp", "camp", "camp", "camp", "camp", "camp", "cemetery", "cemetery", "cemetery", "cemetery"];
  const placeNames: Record<SpecialPlace["kind"], string[]> = {
    ruins: ["Ruiny Starego Opactwa", "Zapadła Twierdza", "Kurhan Pierwszych Królów", "Spalona Wieża", "Zatopiona Kaplica"],
    lair: ["Wilcze Leże", "Jaskinia Wargów", "Gniazdo Bestii", "Nora Dzików"],
    shrine: ["Kapliczka Świętej Ilvy", "Kamień Runiczny", "Ołtarz Popiołu", "Studnia Pielgrzymów"],
    camp: ["Obóz Zbójców", "Kryjówka Rzezimieszków", "Leśny Obóz Banitów", "Jaskinia Przemytników", "Stepowy Obóz Rabusiów", "Spalony Młyn"],
    cemetery: ["Przeklęty Cmentarz", "Kopce Zarazy", "Pole Kości", "Stare Kurhany"],
  };
  const usedNames = new Set<string>();
  // obszar osiągalny ze stolicy (zalewanie), żeby miejsca nie trafiały na odcięte wyspy
  const reach = new Uint8Array(N); { const q = [cidx(w.settlements[0].cx, w.settlements[0].cy)]; reach[q[0]] = 1; for (let h = 0; h < q.length; h++) { const c = q[h], x = c % WGW, y = Math.floor(c / WGW); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= WGW || Y >= WGH) continue; const n = cidx(X, Y); if (!reach[n] && passableCell(w, n)) { reach[n] = 1; q.push(n); } } } }
  for (const kind of placeKinds) {
    for (let tries = 0; tries < 400; tries++) {
      const x = Math.floor(rr(6, WGW - 6)), y = Math.floor(rr(6, WGH - 6));
      if (!passableCell(w, cidx(x, y)) || w.terr[cidx(x, y)] === T_RIVER) continue;
      if (w.settlements.some((s) => dist(s.cx, s.cy, x, y) < 9)) continue;
      if (w.places.some((p) => dist(p.cx, p.cy, x, y) < 14)) continue;
      if (!reach[cidx(x, y)]) continue;
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
  for (const s of w.settlements) fillGarrison(w, s, (s.kind === "town" ? 34 : s.kind === "castle" ? 26 : 0) + (s.faction === 3 && s.kind !== "village" ? 12 : 0));
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

function spawnBandits(w: World, x: number, y: number, n: number): Party | null {
  n = Math.max(3, Math.round(n * (w.diff?.enemy ?? 1)));
  const c = cellOf(x, y); if (w.terr[c] === T_SEA || w.terr[c] === T_MOUNT) return null;
  const p = newParty(w, "bandit", pick(["Podpalacze", "Wilcze Kły", "Banda Szczerbatego", "Nocni Goście"]), 6, x, y);
  addTroops(p.troops, "b_bandit", Math.ceil(n * 0.6)); addTroops(p.troops, "b_archer", Math.floor(n * 0.35)); addTroops(p.troops, "b_chief", 1);
  p.gold = n * 10;
  return p;
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
  const size = Math.round(((L.ruler ? 70 : 34) + L.renown / 20) * (w.diff?.enemy ?? 1));
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
    const n = Math.round((rr(6, 18) + w.day * 0.15) * (w.diff?.enemy ?? 1));
    addTroops(p.troops, "b_bandit", Math.ceil(n * 0.6)); addTroops(p.troops, "b_archer", Math.floor(n * 0.35)); if (n > 12) addTroops(p.troops, "b_chief", 1);
    p.gold = n * 8; p.home = src.id;
  } else if (kind === "lair") {
    const p = newParty(w, "monster", pick(["Wilcza wataha", "Wargi", "Głodne wilki"]), 7, x, y);
    addTroops(p.troops, "x_wolf", Math.round(rr(5, 12) * (w.diff?.enemy ?? 1))); p.home = src.id;
  } else {
    const p = newParty(w, "undead", pick(["Wstali z grobów", "Kościana horda", "Upiorna procesja"]), 5, x, y);
    const n = Math.round(rr(8, 20) * (w.diff?.enemy ?? 1) * (1 + Math.min(1, w.day / 200) * (w.diff?.plague ?? 1)));   // zaraza rośnie z czasem
    addTroops(p.troops, "u_skel", Math.ceil(n * 0.6)); addTroops(p.troops, "u_ghoul", Math.floor(n * 0.3)); addTroops(p.troops, "u_archer", Math.floor(n * 0.15));
    if (chance(0.4)) addTroops(p.troops, "u_necro", 1);
    p.home = src.id;
  }
}

// Relacja lorda z graczem z zapisanym powodem (okno frakcji pokazuje ostatnie zmiany).
function lordRel(w: World, L: Lord, d: number, why = "") {
  if (!d) return;
  L.relation = clamp(L.relation + d, -100, 100);
  const log: { day: number; d: number; why: string }[] = ((L as any).why ||= []);
  const last = log[log.length - 1];
  if (last && last.why === why && last.day === w.day) last.d += d; else log.push({ day: w.day, d, why: why || "różne sprawy" });
  if (log.length > 10) log.shift();
}

// ---------- Wojna i pokój ----------
function setWar(w: World, a: number, b: number, war: boolean, silent = false) {
  if (!w.factions[a] || !w.factions[b]) return;
  w.factions[a].war[b] = war; w.factions[b].war[a] = war;
  w.factions[a].warDays[b] = 0; w.factions[b].warDays[a] = 0;
  if (!war) { w.factions[a].truce[b] = 40; w.factions[b].truce[a] = 40; }
  if (war) { const A = w.factions[a] as any, B = w.factions[b] as any; if (A.ally?.[b]) { A.ally[b] = false; B.ally[a] = false; } }
  if (!silent) chron(w, war ? `${factionName(a)} wypowiada wojnę: ${factionName(b)}!` : `${factionName(a)} i ${factionName(b)} zawierają pokój.`, war ? PAL.redL : PAL.moss, war ? "war" : "peace");
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
  const tru = (w.plot as any)?.truce; if (tru && tru > w.day && ((a.kind === "player" && (b.kind === "undead" || b.faction === 5)) || (b.kind === "player" && (a.kind === "undead" || a.faction === 5)))) return false;
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
  for (const L of w.lords) if (L.faction === f) lordRel(w, L, -10, "napadłeś na ludzi jego frakcji");
  chron(w, `${P.name} napada na ludzi frakcji ${factionName(f)}. To oznacza wojnę.`, PAL.redL);
}
function leaveLiege(w: World, betray: boolean) {
  const P = w.player;
  if (P.liege <= 0) return;
  const f = P.liege;
  if (betray) { for (const L of w.lords) if (L.faction === f) lordRel(w, L, -25, "zdradziłeś jego władcę"); P.honor -= 10; P.wars.push(f); }
  // nadania wracają do korony
  for (const s of w.settlements) if (s.owner === -2 && s.faction === f) { s.owner = w.lords.find((l) => l.faction === f && l.alive)?.id ?? -1; }
  P.liege = 0; P.status = "wolny"; P.contractDays = 0;
}

// ---------- Ekonomia ----------
function price(w: World, s: Settlement, good: string) {
  const target = 40 * (s.kind === "village" ? 0.7 : 1);
  const k = clamp(Math.pow(target / Math.max(2, s.stock[good]), 0.75), 0.35, 4);   // większe różnice: handel się opłaca
  return Math.max(1, Math.round(GOODS[good].base * k * (s.raided > 0 ? 1.3 : 1)));
}
function buyPrice(w: World, s: Settlement, good: string) { return Math.round(price(w, s, good) * (1.12 - w.player.skills.trade * 0.01)); }
function sellPrice(w: World, s: Settlement, good: string) { return Math.max(1, Math.round(price(w, s, good) * (0.88 + w.player.skills.trade * 0.01))); }
function itemPrice(it: Item, buy: boolean, trade: number) { return Math.round(it.price * (buy ? 1.1 - trade * 0.01 : 0.45 + trade * 0.015)); }
// Lenno: dochód dzienny zależny od dobrobytu, budowli, podatku i rządcy.
const BUILDINGS: Record<string, { name: string; cost: number; days: number; desc: string; kinds: SKind[] }> = {
  mlyn: { name: "Młyn", cost: 700, days: 6, desc: "+10% dochodu, dobrobyt powoli rośnie", kinds: ["village", "town", "castle"] },
  targ: { name: "Targowisko", cost: 1200, days: 8, desc: "+20% dochodu", kinds: ["village", "town"] },
  mury: { name: "Mury i baszty", cost: 1600, days: 10, desc: "większa załoga, dłuższe zapasy w oblężeniu", kinds: ["town", "castle"] },
  koszary: { name: "Koszary", cost: 1000, days: 7, desc: "więcej ochotników, lepiej wyszkoleni", kinds: ["village", "town", "castle"] },
  swiatynia: { name: "Świątynia", cost: 900, days: 7, desc: "mieszkańcy z dnia na dzień przychylniejsi", kinds: ["village", "town"] },
};
function fiefIncome(w: World, s: Settlement) {
  const S = s as any, b = S.build || {};
  const base = (s.kind === "town" ? 60 : s.kind === "castle" ? 30 : 15) * (0.5 + s.prosperity / 100) * (s.raided ? 0.2 : 1);
  const mul = (1 + (b.mlyn ? 0.1 : 0) + (b.targ ? 0.2 : 0) + (S.tax === 2 ? 0.35 : S.tax === 0 ? -0.3 : 0) + (S.steward ? 0.1 : 0) + perk(w.player, "fiefB")) * (w.diff?.gold ?? 1);
  return Math.round(base * mul);
}
function smithItems(s: Settlement): string[] {
  const all = baseItems().filter((it) => !it.culture || it.culture === s.culture);
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
  if (p.kind === "player") { if (w.player.equip.horse) sp += 0.25; sp += w.player.skills.tracking * 0.03; sp *= 1.12 * (1 + perk(w.player, "mapSpeed")); }   // lekka przewaga gracza w pościgu
  if (p.kind === "caravan" || p.kind === "villagers") sp *= 0.8;
  if (p.kind === "monster") sp *= 1.15;
  if (p.kind === "undead") sp *= 0.85;
  if (isNight(w)) sp *= 0.85;
  if (p.prisoners.length) {
    // jeńcy potrzebują straży: gdy jest ich więcej niż strażników, marsz zwalnia mocniej
    const pr = troopCount(p.prisoners), guards = Math.max(1, healthyCount(p.troops));
    sp -= pr * 0.02 + Math.max(0, pr - guards) * 0.04;
  }
  const i = cellOf(p.x, p.y);
  sp /= moveCost(w, i);
  if (w.blight[i] && p.faction !== 5) sp *= 0.93;
  return Math.max(0.8, sp);
}
function sightRadius(w: World, p?: Party) { const base = isNight(w) ? 10 : 18; return base + (p && p.kind === "player" ? w.player.skills.tracking * 0.8 + perk(w.player, "sightB") : 0); }

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
  // dyplomacja, wyprawy, lojalność, zaraza (politics.ts)
  dailyPolitics(w);
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
    if (w.day - s.recruitDay >= 5) { s.recruitDay = w.day; const kz = (s as any).build?.koszary ? 1.5 : 1; s.recruits = Math.min(Math.round((s.kind === "village" ? 14 : 20) * kz), s.recruits + Math.round((2 + s.prosperity / 25 + Math.max(0, s.relation) / 15) * kz)); }   // relacja: więcej ochotników
    // załoga rośnie powoli
    const und = s.faction === 5;   // umarli wstają szybciej
    if (s.kind !== "village" && !s.siegeBy.length && troopCount(s.garrison) < (s.kind === "town" ? 42 : 30) + ((s as any).build?.mury ? 15 : 0) + (und ? 20 : 0) && chance(und ? 0.6 : 0.3)) fillGarrison(w, s, und ? 3 : 2);
    if (s.tournament > 0) s.tournament--;
    if (s.kind === "town" && s.faction !== 5 && s.tournament === 0 && chance(0.015)) { s.tournament = 6; chron(w, `W ${s.name} ogłoszono turniej. Nagroda: 600 denarów.`, PAL.gold); }
    // oblężenie AI
    if (s.siegeBy.length) {
      s.siegeBy = s.siegeBy.filter((id) => { const p = partyById(w, id); return p && p.siege === s.id && atWar(w, p.faction, s.faction); });
      if (s.siegeBy.length) {
        s.siegeDays++;
        // głód: po wyczerpaniu zapasów załoga słabnie z dnia na dzień
        if (s.faction !== 5 && s.siegeDays > siegeStores(s)) { applyLosses(s.garrison, 0.05); if (s.siegeDays === siegeStores(s) + 1) chron(w, `Głód w oblężonym ${s.name}. Załoga słabnie.`, PAL.redL); }
        // szturm dopiero po dłuższym oblężeniu (chyba że przewaga jest miażdżąca)
        const apow = s.siegeBy.reduce((a2, id) => { const o = partyById(w, id); return a2 + (o ? partyPower(w, o) : 0); }, 0);
        const need = apow > troopPower(s.garrison) * 2.1 * 3 ? 5 : 9;
        if (s.siegeDays >= need && !s.siegeBy.includes(w.pid)) aiAssault(w, s);
      }
      else s.siegeDays = 0;
    }
  }
  // lordowie bez armii wracają
  for (const L of w.lords) {
    if (!L.alive) continue;
    if (L.party < 0 || !partyById(w, L.party)) {
      if (L.captive >= 0) { if (chance(0.06)) { L.captive = -1; chron(w, `${L.title} ${L.name} wraca z niewoli.`); } continue; }
      L.respawn -= L.faction === 5 ? 2 : 1;
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
  for (let k = 0; k < 3; k++) if (count("bandit") < 16 * densityK() && chance(0.6)) spawnFromPlace(w, "camp");
  if (count("monster") < 6 * densityK() && chance(0.3)) spawnFromPlace(w, "lair");
  if (count("undead") < 7 * densityK() && chance(0.3)) spawnFromPlace(w, "cemetery");
  livingWorldDaily(w);
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

// ---------- Życie świata: chłopi wożą nadwyżki do miasta i wracają, każde miasto ma swoją karawanę ----------
function livingWorldDaily(w: World) {
  const alive = new Set(w.parties.map((p) => p.id));
  for (const s of w.settlements) {
    const S = s as any;
    if (s.kind === "village") {
      if (s.raided > 0 || s.siegeBy.length || (S.trip || 0) > w.day || (S.vparty && alive.has(S.vparty))) continue;
      const food = FOOD_KEYS.reduce((a, k) => a + Math.max(0, s.stock[k] - 12), 0);
      if (food < 6) { S.trip = w.day + 2; continue; }
      const p = spawnVillagers(w, s);
      S.trip = w.day + Math.round(rr(1, 3) / densityK());
      if (p) S.vparty = p.id;
    } else if (s.kind === "town") {
      if ((S.car && alive.has(S.car)) || (S.carDay || 0) > w.day || s.siegeBy.length) continue;
      const p = spawnCaravan(w, s);
      if (p) S.car = p.id; else S.carDay = w.day + 3;
    }
  }
}
// Miasto docelowe chłopów: miasto pana wioski albo najbliższe miasto tej samej (lub niewrogiej) frakcji.
function villageMarket(w: World, v: Settlement) {
  const b = v.bound >= 0 ? w.settlements[v.bound] : null;
  if (b && b.kind === "town" && !atWar(w, b.faction, v.faction)) return b;
  let best: Settlement | null = null, bd = 1e9;
  for (const t of w.settlements) if (t.kind === "town" && !atWar(w, t.faction, v.faction) && !t.siegeBy.length) { const d = dist(t.cx, t.cy, v.cx, v.cy) * (t.faction === v.faction ? 1 : 1.6); if (d < bd) { bd = d; best = t; } }
  return best;
}
function spawnVillagers(w: World, v: Settlement): Party | null {
  const t = villageMarket(w, v);
  if (!t) return null;
  const und = v.faction === 5 || v.culture === "undead";
  const p = newParty(w, "villagers", und ? `Truposze z ${v.name}` : `Chłopi z ${v.name}`, v.faction, v.cx * WCELL + 4, v.cy * WCELL + 10);
  addTroops(p.troops, und ? "u_skel" : (RECRUITS[v.culture]?.village[0] || "b_bandit"), Math.round(rr(4, 9)));
  p.dest = t.id; p.home = v.id; p.goods = {};
  // nadwyżka jedzenia i to, czego wioska ma najwięcej
  for (const k of FOOD_KEYS) { const n = Math.max(0, Math.floor((v.stock[k] - 12) * 0.7)); if (n > 0) { p.goods[k] = Math.min(30, n); v.stock[k] -= p.goods[k]; } }
  const top = GOOD_KEYS.filter((k) => !GOODS[k].food).sort((a, b) => v.stock[b] - v.stock[a])[0];
  if (top && v.stock[top] > 20) { const n = Math.floor((v.stock[top] - 15) * 0.5); p.goods[top] = n; v.stock[top] -= n; }
  if (!goTo(w, p, t.cx * WCELL + 4, t.cy * WCELL + 4)) { removeParty(w, p); return null; }
  p.state = "travel";
  return p;
}
// Karawana: kupuje to, co w jej mieście tanie, i wiezie tam, gdzie drogie; potem szuka następnego interesu.
function caravanPlan(w: World, p: Party, at: Settlement) {
  let best: { t: Settlement; k: string; gain: number } | null = null;
  for (const t of w.settlements) {
    if (t.kind !== "town" || t === at || t.siegeBy.length || atWar(w, t.faction, p.faction)) continue;
    const d = dist(t.cx, t.cy, at.cx, at.cy); if (d > 110) continue;
    for (const k of GOOD_KEYS) { const gain = (price(w, t, k) - price(w, at, k)) * Math.min(30, at.stock[k] * 0.3) / (20 + d); if (!best || gain > best.gain) best = { t, k, gain }; }
  }
  return best;
}
function spawnCaravan(w: World, home: Settlement): Party | null {
  const p = newParty(w, "caravan", `Karawana z ${home.name}`, home.faction, home.cx * WCELL + 4, home.cy * WCELL + 12);
  addTroops(p.troops, "m_sword", Math.round(rr(5, 10))); addTroops(p.troops, "m_xbow", Math.round(rr(2, 5)));
  p.home = home.id; p.gold = Math.round(rr(500, 900)); p.goods = {};
  if (!caravanNext(w, p, home)) { removeParty(w, p); return null; }
  return p;
}
function caravanNext(w: World, p: Party, at: Settlement) {
  const plan = caravanPlan(w, p, at);
  if (!plan) return false;
  const n = Math.max(4, Math.floor(Math.min(30, at.stock[plan.k] * 0.3)));
  at.stock[plan.k] = Math.max(1, at.stock[plan.k] - n);
  p.goods = { [plan.k]: n };
  p.gold -= Math.round(price(w, at, plan.k) * n * 0.5);
  p.dest = plan.t.id; p.state = "travel";
  return goTo(w, p, plan.t.cx * WCELL + 4, plan.t.cy * WCELL + 4);
}
function aiAssault(w: World, s: Settlement) {
  const att = s.siegeBy.map((id) => partyById(w, id)).filter(Boolean);
  const ap = att.reduce((sum, p) => sum + partyPower(w, p), 0);
  const dp = (troopPower(s.garrison) * 2.1 + 8) * (s.faction === 5 ? 1.45 : s.faction === 3 ? 1.7 : 1);   // martwi nie głodują, krasnoludzkie twierdze w skale
  const win = ap * rr(0.75, 1.25) > dp;
  const lossA = clamp((dp / Math.max(1, ap)) * 0.45, 0.05, 0.9), lossD = clamp((ap / Math.max(1, dp)) * 0.5, 0.1, 1);
  for (const p of att) applyLosses(p.troops, win ? lossA : Math.min(0.9, lossA * 1.4));
  applyLosses(s.garrison, win ? 1 : lossD);
  if (win) {
    const leader = att.sort((a, b) => partyPower(w, b) - partyPower(w, a))[0];
    captureSettlement(w, s, leader.faction, leader.lord ?? -1);
    // część armii zostaje w załodze
    // zdobywca zostawia mocną załogę ze wszystkich armii szturmu
    for (const pa of att) for (const t of pa.troops.slice()) { const n = Math.floor(t.n * (pa === leader ? 0.45 : 0.2)); if (n > 0) { addTroops(s.garrison, t.type, n); removeTroops(pa.troops, t.type, n); } }
    fillGarrison(w, s, 10);
  } else chron(w, `Szturm na ${s.name} odparty. Obrońcy trzymają mury.`, PAL.bone);
  for (const p of att) { p.siege = undefined; p.state = "idle"; p.wait = 0; }
  s.siegeBy = []; s.siegeDays = 0;
}
function captureSettlement(w: World, s: Settlement, faction: number, ownerLord: number) {
  const old = s.faction;
  if (s.owner >= 0 && s.kind !== "village") { const OL = lordById(w, s.owner); if (OL) addLoyal(OL, -12); }   // stracone lenno: żal do korony
  s.faction = faction; s.owner = ownerLord;
  s.prosperity = Math.max(10, s.prosperity - 15);
  // wioski przypisane idą za swym zamkiem
  for (const v of w.settlements) if (v.bound === s.id) { v.faction = faction; v.owner = ownerLord; }
  w.ownerVersion++;
  chron(w, `${s.name} pada! ${factionName(faction)} odbiera to miejsce frakcji ${factionName(old)}.`, PAL.gold, "siege");
  if (old === 5 || faction === 5) recomputeBlight(w);
  if (ownerLord >= 0) councilVote(w, s, faction, ownerLord);
}
function siegeStores(s: Settlement) { return Math.round((s.kind === "castle" ? 12 : 9) * (0.6 + s.prosperity / 100)) + ((s as any).build?.mury ? 5 : 0); }
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
  if (lose.kind === "villagers" && win.kind === "bandit" && lose.home !== undefined) { (win as any).captVillage = lose.home; for (const t of lose.troops) addTroops(win.prisoners, t.type, Math.max(1, Math.floor(t.n * 0.5))); }
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
  else if (lose.kind === "villagers" && chance(0.35)) chron(w, `${win.name}: napad na chłopów z ${w.settlements[lose.home]?.name || "wioski"}.`, PAL.ash);
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
    else if (op < myPow * 0.9 && d < pd && (p.kind !== "caravan" && p.kind !== "villagers") && !(p.kind === "lord" && (o.kind === "bandit" || o.kind === "monster") && hashN(p.id, o.id) < 0.65)) { pd = d; prey = o; }
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
    if (campaignGoal(w, p, L)) return;
    const home = p.home !== undefined ? w.settlements[p.home] : null;
    // słaba armia: do domu
    if (n < 20 && home && home.faction === p.faction) { p.state = "rest"; goTo(w, p, home.cx * WCELL + 4, home.cy * WCELL + 10); p.wait = 30; return; }
    const enemies = w.settlements.filter((s) => atWar(w, p.faction, s.faction) && s.faction !== 6 && (s.faction !== 5 || p.faction === 5 || dist(p.x, p.y, s.cx * WCELL, s.cy * WCELL) < 160 || chance(0.3)));
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
    if (!d) { removeParty(w, p); return; }
    if (dist(p.x, p.y, d.cx * WCELL + 4, d.cy * WCELL + 4) < 14) {
      let value = 0;
      for (const k in p.goods || {}) { value += price(w, d, k) * p.goods[k]; d.stock[k] = Math.min(160, d.stock[k] + p.goods[k]); }
      p.goods = {};
      if (p.kind === "villagers") {
        if (p.state === "return") { d.prosperity = Math.min(100, d.prosperity + 0.6); removeParty(w, p); return; }   // w domu
        d.prosperity = Math.min(100, d.prosperity + 0.2);
        // za utarg kupują w mieście sól i sukno, potem wracają do wioski
        const home = w.settlements[p.home];
        if (!home) { removeParty(w, p); return; }
        for (const k of ["salt", "cloth"]) { const n = Math.min(3, Math.floor(d.stock[k] * 0.1)); if (n > 0) { d.stock[k] -= n; p.goods[k] = n; } }
        p.gold = Math.round(value * 0.4);
        p.dest = home.id; p.state = "return"; p.wait = 6;
        if (!goTo(w, p, home.cx * WCELL + 4, home.cy * WCELL + 4)) removeParty(w, p);
        return;
      }
      for (const q of w.player.quests) if (!q.done && q.kind === "escort" && q.target === p.id && q.amount === d.id) { const pp = playerParty(w); if (dist(pp.x, pp.y, p.x, p.y) < 30 * WCELL) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => addLogMsg(l, PAL.gold)); } else { q.done = true; q.failed = true; addLogMsg("Karawana dotarła sama. Kupcy nie zapłacą za eskortę, której nie było.", PAL.ash); } }
      // karawana: sprzedaje, płaci cło miastu, kupuje dalej
      p.gold += Math.round(value * 0.6);
      d.prosperity = Math.min(100, d.prosperity + 0.25);
      if (p.home !== undefined && w.settlements[p.home]) w.settlements[p.home].prosperity = Math.min(100, w.settlements[p.home].prosperity + 0.15);
      p.wait = 4;
      if (!caravanNext(w, p, d)) removeParty(w, p);
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
let WTICK = 0;
function densityK() { return typeof settings !== "undefined" && settings.density ? settings.density : 1; }
function worldTick(w: World, hours: number) {
  POWC.clear();
  const before = w.hour;
  w.hour += hours;
  if (w.hour >= 24) { w.hour -= 24; dailyTick(w); }
  void before;
  // oddziały daleko od gracza liczone rzadziej (zbierają czas i wykonują go naraz): płynność przy dużym świecie
  WTICK++;
  const pp = playerParty(w);
  for (const p of w.parties.slice()) {
    if (!w.parties.includes(p)) continue;
    const A = p as any;
    const far = pp && p !== pp && Math.abs(p.x - pp.x) + Math.abs(p.y - pp.y) > 110 * WCELL;
    if (far && (WTICK + p.id) % 3 !== 0) { A.acc = (A.acc || 0) + hours; continue; }
    const hh = hours + (A.acc || 0); A.acc = 0;
    partyAI(w, p, hh);
  }
}

// ---------- Gracz: dzienne koszty ----------
function playerParty(w: World) { return partyById(w, w.pid); }
function partyWages(w: World) {
  const p = playerParty(w);
  let s = 0;
  for (const t of p.troops) s += (UNITS[t.type]?.wage || 1) * t.n * (UNITS[t.type]?.undead ? 1 - perk(w.player, "undeadWage") : 1);
  for (const c of w.player.companions) s += c.wage;
  return Math.round(s * (1 - perk(w.player, "wageB")));
}
function partyLimit(w: World) { const P = w.player; return 20 + P.skills.leadership * 5 + Math.floor(P.attr.cha * 1.5) + Math.floor(P.renown / 25); }
function foodTotal(w: World) { return FOOD_KEYS.reduce((s, k) => s + (w.player.goods[k] || 0), 0); }
function playerDaily(w: World) {
  const P = w.player, p = playerParty(w);
  if (!p || P.captive) return;
  const n = troopCount(p.troops) + 1 + P.companions.length;
  // jedzenie
  let need = Math.ceil(n / 8 * (1 - Math.min(0.5, perk(P, "food"))));
  const kinds = FOOD_KEYS.filter((k) => (P.goods[k] || 0) > 0).length;
  for (const k of FOOD_KEYS) { while (need > 0 && (P.goods[k] || 0) > 0) { P.goods[k]--; need--; } }
  if (need > 0) { P.morale -= 12; addLogMsg("Brak jedzenia! Morale spada, ludzie dezerterują.", PAL.redL); desert(w, 0.06); }
  else P.morale += kinds >= 2 ? 1.5 : 0.3;
  // jeńcy uciekają, gdy straż jest za słaba
  const prN = troopCount(p.prisoners), grd = healthyCount(p.troops) + P.companions.length;
  if (prN > 0 && prN > grd * 1.2 && chance(0.35)) {
    const k = Math.max(1, Math.round((prN - grd) * rr(0.2, 0.5)));
    let left = k;
    for (const t of p.prisoners.slice().sort(() => rnd() - 0.5)) { const m = Math.min(left, t.n); removeTroops(p.prisoners, t.type, m); left -= m; if (left <= 0) break; }
    addLogMsg(`Nocą ucieka ${k - left} jeńców. Straż jest za słaba (jeńców ${prN}, strażników ${grd}).`, PAL.redL);
  }
  // rany
  companionsDaily(w);
  // rasy w jednej armii: orkowie z krasnoludami albo żywi z nieumarłymi kiepsko się znoszą
  const races = new Set(p.troops.map((t) => UNITS[t.type]?.culture));
  if ((races.has("orc") && races.has("dwarf")) || (races.has("undead") && [...races].some((c) => c && c !== "undead" && c !== "merc" && c !== "bandit"))) { P.morale -= 2; if (chance(0.15)) addLogMsg("W obozie dochodzi do bójki między rasami. Morale spada.", PAL.redL); }
  // jeńcy po kilku dniach w niewoli: część gotowa przejść na twoją stronę
  const pa2 = p as any;
  if (p.prisoners.length) { pa2.prisDays = (pa2.prisDays || 0) + 1; if (pa2.prisDays >= 3) pa2.willing = Math.min(troopCount(p.prisoners), (pa2.willing || 0) + Math.ceil(troopCount(p.prisoners) * 0.2)); } else { pa2.prisDays = 0; pa2.willing = 0; }
  // karawany wracają z zyskiem albo przepadają
  const cars = ((P as any).caravans || []) as { from: number; to: number; gold: number; back: number }[];
  for (const c of cars.slice()) if (c.back <= w.day) {
    (P as any).caravans = ((P as any).caravans as any[]).filter((x) => x !== c);
    if (chance(0.12)) addLogMsg(`Karawana do ${w.settlements[c.to].name} przepadła. Zbóje ją ograbili.`, PAL.redL);
    else { const g = Math.round(c.gold * (1.15 + P.skills.trade * 0.03 + rr(0, 0.25))); P.gold += g; addLogMsg(`Karawana wraca z ${w.settlements[c.to].name}: ${g} denarów (zysk ${g - c.gold}).`, PAL.gold); }
  }
  const cm = p.state === "camp" ? ((P as any).campMode || "rest") : "";
  const heal = 0.06 + P.skills.medicine * 0.05 + (cm === "rest" ? 0.25 : cm ? 0.1 : 0);   // medycyna wyraźniej przyspiesza leczenie
  // obóz: trening podnosi doświadczenie (kosztem jedzenia), wartownicy chronią przed zaskoczeniem
  if (cm === "train") { for (const t of p.troops) t.xp += (6 + P.skills.leadership * 2) * Math.max(1, t.n - t.wounded) * (1 + perk(P, "trainB") + (P.companions.some((c) => c.role === "rycerz" || c.role === "obrońca") ? 0.3 : 0)); if ((P.goods.grain || 0) > 0) P.goods.grain--; }
  for (const t of p.troops) t.wounded = Math.max(0, t.wounded - Math.ceil(t.wounded * heal));
  const maxHp = heroMaxHp(P);
  P.hp = Math.min(maxHp, P.hp + maxHp * (0.12 + (cm === "rest" ? 0.25 : cm ? 0.1 : 0)) * (1 + perk(P, "heal")));
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
  for (const s of w.settlements) if (s.owner === -2) {
    P.gold += fiefIncome(w, s);
    const S = s as any;
    // podatki i budowy w lennie
    if (S.tax === 2) { s.relation -= 0.3; s.prosperity -= 0.05; } else if (S.tax === 0) s.relation += 0.15;
    if (S.build?.mlyn) s.prosperity = Math.min(100, s.prosperity + 0.08);
    if (S.build?.swiatynia) s.relation += 0.1;
    if (S.buildQ) { S.buildQ.days--; if (S.buildQ.days <= 0) { (S.build ||= {})[S.buildQ.k] = 1; chron(w, `W ${s.name} ukończono: ${BUILDINGS[S.buildQ.k].name}.`, PAL.gold); S.buildQ = null; } }
  }
  // przesadna armia obniża morale
  if (n > partyLimit(w)) P.morale -= 3;
  P.morale = clamp(P.morale, 0, 100);
  if (P.morale < 20) desert(w, 0.04);
  // jeńcy mogą się dołączyć
  for (const t of p.prisoners.slice()) if (chance(0.03 + P.skills.leadership * 0.005) && !UNITS[t.type].undead) { removeTroops(p.prisoners, t.type, 1); addTroops(p.troops, t.type, 1); addLogMsg(`Jeniec (${UNITS[t.type].name}) przechodzi na twoją stronę.`, PAL.bone); }
  // zadania
  for (const q of P.quests) if (!q.done) {
    // zdobycie zamku: wystarczy, że zamek przejdzie w ręce twojej strony
    if (q.kind === "capture") { const t = w.settlements[q.target]; if (t && (t.faction === PLAYER_FACTION || (P.liege > 0 && t.faction === P.liege))) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => addLogMsg(l, PAL.gold)); continue; } }
    // odsiecz: oblężenie zdjęte, twierdza wciąż w rękach sojusznika, a ty byłeś w pobliżu
    if (q.kind === "relieve") { const t = w.settlements[q.target]; if (t && t.faction !== q.amount) { q.done = true; q.failed = true; addLogMsg(`Za późno: ${t.name} padło.`, PAL.redL); continue; } if (t && !t.siegeBy.length && dist(t.cx * WCELL, t.cy * WCELL, p.x, p.y) < 40 * WCELL) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => addLogMsg(l, PAL.gold)); continue; } }
    if (q.kind === "kidnap") { const L = lordById(w, q.target); if (L && L.captive === PLAYER_FACTION) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => addLogMsg(l, PAL.gold)); continue; } if (L && !L.alive) { q.done = true; q.failed = true; continue; } }
    if (q.kind === "escort") { const c = partyById(w, q.target); if (!c) { q.done = true; q.failed = true; addLogMsg("Karawana, którą eskortowałeś, przepadła.", PAL.redL); if (w.settlements[q.giver]) w.settlements[q.giver].relation -= 6; continue; } const d0 = w.settlements[q.amount]; if (d0 && dist(c.x, c.y, d0.cx * WCELL, d0.cy * WCELL) < 16) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => addLogMsg(l, PAL.gold)); continue; } }
    q.days--;
    if (q.days <= 0) { q.done = true; q.failed = true; addLogMsg(`Zadanie przepadło: ${q.text}`, PAL.ash); if (w.settlements[q.giver]) w.settlements[q.giver].relation -= 5; if (q.giverLord != null) { const L = lordById(w, q.giverLord); if (L) L.relation -= 6; } }
  }
  P.quests = P.quests.filter((q) => !q.done || q.days > -3);
}
function desert(w: World, frac: number) {
  const p = playerParty(w);
  let lost = 0;
  for (const t of p.troops.slice()) { const n = Math.floor(t.n * frac + (chance(frac * t.n % 1) ? 1 : 0)); if (n > 0) { removeTroops(p.troops, t.type, n); lost += n; } }
  if (lost) addLogMsg(`Zdezerterowało ${lost} ludzi.`, PAL.redL);
}
let addLogMsg: (t: string, c?: string) => void = () => {};

function heroMaxHp(P: PlayerState) { return 70 + P.attr.str * 3 + (P.attr.end || 4) * 7 + P.skills.ironflesh * 8 + P.level * 2 + (P.race === "dwarf" ? 15 : P.race === "orc" ? 10 : 0) + perk(P, "maxHp"); }

// ---------- Towarzysze ----------
const COMPANIONS: { id: string; name: string; race: Race; role: string; weapon: string; shield: boolean; armor: number; bow: number; horse: boolean; hp: number; cost: number; wage: number; bio: string; helm: Helm; body: BodyMat }[] = [
  { id: "kasia", name: "Kasia Wrona", race: "human", role: "łuczniczka", weapon: "dagger", shield: false, armor: 0.12, bow: 46, horse: false, hp: 110, cost: 300, wage: 8, bio: "Kłusowniczka spod Valmory. Nie pyta, do kogo strzela, póki płacisz.", helm: "hood", body: "leather" },
  { id: "bogdan", name: "Bogdan Siekiera", race: "human", role: "rębajło", weapon: "greataxe", shield: false, armor: 0.2, bow: 0, horse: false, hp: 150, cost: 450, wage: 12, bio: "Były drwal i dezerter z Legionu. Topór trzyma pewniej niż kufel.", helm: "kettle", body: "mail" },
  { id: "ilse", name: "Siostra Ilse", race: "human", role: "kapłanka", weapon: "mace", shield: true, armor: 0.16, bow: 0, horse: false, hp: 120, cost: 400, wage: 10, bio: "Wygnana z zakonu za walkę z nieumarłymi bez rozkazu. Leczy rany i dusze.", helm: "mitre", body: "robe" },
  { id: "dvalin", name: "Dvalin Ognisty Kufel", race: "dwarf", role: "obrońca", weapon: "warhammer", shield: true, armor: 0.28, bow: 0, horse: false, hp: 170, cost: 600, wage: 14, bio: "Krasnolud wygnany z Khazgrim za zbyt głośne śpiewanie w kopalni.", helm: "dwarf", body: "plate" },
  { id: "grashna", name: "Grashna", race: "orc", role: "zwiadowczyni", weapon: "axe", shield: false, armor: 0.14, bow: 0, horse: true, hp: 140, cost: 380, wage: 10, bio: "Orczyca, która porzuciła hordę. Jeździ jak burza, milczy jak grób.", helm: "none", body: "leather" },
  { id: "brakk", name: "Brakk Żelazna Miarka", race: "dwarf", role: "inżynier", weapon: "warhammer", shield: false, armor: 0.22, bow: 0, horse: false, hp: 140, cost: 550, wage: 13, bio: "Krasnoludzki saper. Postawi wieżę oblężniczą z byle czego i policzy, ile głazów trzeba na mur.", helm: "dwarf", body: "mail" },
  { id: "mira", name: "Mira Złotousta", race: "human", role: "kupcowa", weapon: "dagger", shield: false, armor: 0.1, bow: 34, horse: true, hp: 100, cost: 350, wage: 9, bio: "Handlarka z Kassii. Zna ceny w każdym mieście i każdego celnika po imieniu.", helm: "hood", body: "gambeson" },
  { id: "wojmir", name: "Wojmir Kostucha", race: "human", role: "medyk", weapon: "mace", shield: true, armor: 0.14, bow: 0, horse: false, hp: 115, cost: 420, wage: 10, bio: "Cyrulik spod Valmory. Wyciąga groty i zęby, nie pyta o pochodzenie ran.", helm: "cap", body: "robe" },
  { id: "urgh", name: "Urgh Łamignat", race: "orc", role: "rębajło", weapon: "greataxe", shield: false, armor: 0.2, bow: 0, horse: false, hp: 180, cost: 500, wage: 13, bio: "Wygnany z hordy za to, że pobił wodza na uczcie. Nie żałuje.", helm: "none", body: "leather" },
  { id: "elsbeth", name: "Elsbeth z Wieży", race: "human", role: "czarodziejka", weapon: "staff", shield: false, armor: 0.08, bow: 0, horse: false, hp: 95, cost: 700, wage: 16, bio: "Uczennica varusjańskich magów. Mówi, że ogień słucha jej lepiej niż ludzie.", helm: "hood", body: "robe" },
  { id: "hrodgar", name: "Hrodgar Tarczownik", race: "dwarf", role: "obrońca", weapon: "axe", shield: true, armor: 0.3, bow: 0, horse: false, hp: 175, cost: 650, wage: 15, bio: "Weteran oblężenia Khazgrim. Stoi tam, gdzie mu każą, dopóki nie każą odejść.", helm: "dwarf", body: "plate" },
  { id: "lisek", name: "Lisek", race: "human", role: "zwiadowca", weapon: "dagger", shield: false, armor: 0.1, bow: 42, horse: true, hp: 100, cost: 320, wage: 8, bio: "Kłusownik i złodziej koni. Widzi ślady tam, gdzie inni widzą błoto.", helm: "hood", body: "leather" },
  { id: "agata", name: "Agata Czarna", race: "human", role: "rycerz", weapon: "sword", shield: true, armor: 0.26, bow: 0, horse: true, hp: 155, cost: 850, wage: 18, bio: "Ostatnia z rodu spalonego przez Morvath. Jej przysięga jest prosta: zemsta.", helm: "great", body: "plate" },
  { id: "teodor", name: "Teodor Zdrajca", race: "human", role: "rycerz", weapon: "sword", shield: true, armor: 0.25, bow: 0, horse: true, hp: 150, cost: 800, wage: 18, bio: "Pozbawiony herbu rycerz Korony. Twierdzi, że był niewinny.", helm: "great", body: "plate" },
];
// Charaktery kompanów: kogo lubią, kogo nie znoszą, czego nie zniosą u ciebie.
const COMP_TRAITS: Record<string, { likes: string[]; hates: string[]; quit?: (P: PlayerState) => string | null }> = {
  kasia: { likes: ["lisek"], hates: ["teodor"] },
  bogdan: { likes: ["urgh"], hates: ["ilse", "mira"] },
  ilse: { likes: ["agata", "wojmir"], hates: ["bogdan", "elsbeth"], quit: (P) => ((P as any).corruption || 0) > 60 ? "Nie będę służyć komuś, kogo toczy mrok." : P.honor < -10 ? "Twoje czyny hańbią imię bogów." : null },
  dvalin: { likes: ["hrodgar", "brakk"], hates: ["urgh", "grashna"] },
  grashna: { likes: ["urgh"], hates: ["dvalin"] },
  brakk: { likes: ["dvalin", "hrodgar"], hates: ["elsbeth"] },
  mira: { likes: ["lisek"], hates: ["bogdan"], quit: (P) => P.gold < 0 ? "Bez złota nie ma interesu." : null },
  wojmir: { likes: ["ilse"], hates: ["urgh"] },
  urgh: { likes: ["grashna", "bogdan"], hates: ["dvalin", "wojmir"] },
  elsbeth: { likes: [], hates: ["ilse", "brakk"] },
  hrodgar: { likes: ["dvalin", "brakk"], hates: [] },
  lisek: { likes: ["kasia", "mira"], hates: ["agata"] },
  agata: { likes: ["ilse"], hates: ["lisek"], quit: (P) => P.liege === 5 ? "Służysz Morvath. Nasze drogi się rozchodzą." : null },
  teodor: { likes: [], hates: ["kasia"], quit: (P) => P.honor < -15 ? "Jestem rycerzem, nie zbójem. Odchodzę." : null },
};
function companionMax(P: PlayerState) { return 3 + Math.floor(P.attr.cha / 3); }
// Codziennie: kłótnie, odejścia, powroty z misji.
function companionsDaily(w: World) {
  const P = w.player, p = playerParty(w);
  const here = P.companions.filter((c) => !((c as any).away > w.day));
  for (const c of P.companions) { const cc = c as any; if (cc.away && cc.away <= w.day) { cc.away = 0; const msg = cc.mission === "scout" ? scoutReport(w) : cc.mission === "trade" ? (() => { const g = Math.round(rr(120, 320) * (c.role === "kupcowa" ? 1.6 : 1)); P.gold += g; return `przynosi ${g} denarów z handlu`; })() : (() => { const n = 2 + Math.round(rr(0, 4)); addTroops(p.troops, RECRUITS[nearestSettlement(w, p.x, p.y).culture]?.village[0] || "a_recruit", n); return `prowadzi ${n} ochotników`; })(); addLogMsg(`${c.name} wraca z misji: ${msg}.`, PAL.gold); cc.mission = ""; } }
  for (const a of here) for (const b of here) {
    if (a === b || !COMP_TRAITS[a.id]?.hates.includes(b.id) || !chance(perk(P, "loyal") ? 0.02 : 0.06)) continue;
    P.morale -= 3; const ca = a as any; ca.grudge = (ca.grudge || 0) + 1;
    addLogMsg(`${a.name} kłóci się z ${b.name}. Ludzie patrzą na to krzywo.`, PAL.redL);
    if (ca.grudge >= 4 && !perk(P, "loyal")) { P.companions = P.companions.filter((x) => x !== a); addLogMsg(`${a.name} ma dość towarzystwa ${b.name} i odchodzi.`, PAL.redL); chron(w, `${a.name} opuszcza ${P.name}.`); return; }
  }
  for (const a of here) { if (here.some((b) => COMP_TRAITS[a.id]?.likes.includes(b.id)) && chance(0.04)) P.morale = Math.min(100, P.morale + 2); }
  for (const c of here) { const why = COMP_TRAITS[c.id]?.quit?.(P); if (why && chance(0.25)) { P.companions = P.companions.filter((x) => x !== c); addLogMsg(`${c.name}: „${why}” Odchodzi.`, PAL.redL); chron(w, `${c.name} opuszcza ${P.name}.`); return; } }
}
function scoutReport(w: World) {
  const p = playerParty(w); const r = 26, cx = Math.floor(p.x / WCELL) + Math.round(rr(-30, 30)), cy = Math.floor(p.y / WCELL) + Math.round(rr(-20, 20));
  for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < WGW && y < WGH && (x - cx) ** 2 + (y - cy) ** 2 < r * r) w.explored[cidx(x, y)] = 1;
  const enemies = w.parties.filter((o) => o.kind === "lord" && atWar(w, o.faction, w.player.liege || PLAYER_FACTION) && dist(o.x / WCELL, o.y / WCELL, cx, cy) < r).length;
  return `odkrywa okolice ${nearestSettlement(w, cx * WCELL, cy * WCELL).name}${enemies ? ` i widzi ${enemies} wrogie armie` : ""}`;
}
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

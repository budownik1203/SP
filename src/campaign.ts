// Kampania: stan gry, ruch po mapie, spotkania, bitwy z mapy i ich skutki, oblężenia, arena, niewola, zapis.

type GState = "title" | "creator" | "map" | "battle";
interface BattleCtx {
  kind: "field" | "siege" | "arena" | "place" | "custom";
  enemies: Party[]; allies: Party[];
  settlement?: Settlement; place?: SpecialPlace;
  arena?: { tournament: boolean; round: number; bet: number; team: boolean; mode?: string; foe?: string };
  enemyTroops?: Troop[];               // gdy wrogiem jest załoga lub miejsce
  garrisonAlly?: Troop[];
  title: string;
  onWin?: (lines: string[]) => void;
  defend?: boolean;
}
const G = {
  state: "title" as GState,
  view: { cam: { x: 0, y: 0 }, hover: null as { kind: string; id: number } | null, time: 0 } as WorldView,
  battle: null as Battle | null,
  ctx: null as BattleCtx | null,
  speed: 1,
  camping: false,
  waitHours: 0,
  target: null as { kind: "settlement" | "party" | "place"; id: number } | null,
  pan: { active: false, sx: 0, sy: 0, cx: 0, cy: 0, t: 0 },
  lastAuto: 0,
  encounterCooldown: 0,
  seen: new Set<number>(),
};

function W0() { return WORLD; }

// ---------- Nowa gra ----------
// Pochodzenia: atrybuty, jeden darmowy węzeł bez umiejętności aktywnej i nędzny sprzęt. Reszta do zdobycia.
const ORIGINS: Record<string, { name: string; desc: string; attr: Partial<Record<HAttr, number>>; node: string; equip: Partial<Record<ESlot, string>>; items: string[]; gold: number; troops: [string, number][]; renown: number; faith: number; mana: number; corruption: number; hint: string }> = {
  merc: { name: "Najemnik", desc: "Lata wojaczki za cudzy grosz. Zostały ci topór, stary puklerz i dwóch kompanów z rozbitego oddziału.", attr: { str: 2, end: 1 }, node: "ps1", equip: { weapon: "w_axe", shield: "s_buckler", body: "gambeson", head: "cap", feet: "boots" }, items: [], gold: 250, troops: [["m_sword", 2], ["a_recruit", 2]], renown: 15, faith: 10, mana: 0, corruption: 0, hint: "Oręż: Tarczownik lub Rębacz" },
  priest: { name: "Kapłan wojownik", desc: "Zakon dał ci habit, pałkę i wiarę. Nieumarli boją się twojej modlitwy.", attr: { cha: 2, end: 1 }, node: "pray", equip: { weapon: "w_club", body: "robe", feet: "boots" }, items: [], gold: 150, troops: [["a_recruit", 4]], renown: 5, faith: 100, mana: 0, corruption: 0, hint: "Wiara: Smite i Modlitwa leczenia" },
  mage: { name: "Mag renegat", desc: "Wygnany z Kolegium za zakazane księgi. Masz kostur, płaszcz i głowę pełną zaklęć.", attr: { int: 3 }, node: "flow", equip: { weapon: "w_staff", body: "robe", head: "hood" }, items: [], gold: 200, troops: [["v_levy", 3]], renown: 0, faith: 0, mana: 100, corruption: 8, hint: "Magia: Kula ognia albo Mrok" },
  noble: { name: "Szlachcic bez ziemi", desc: "Herb bez zamku. Została ci szkapa, miecz po ojcu i nazwisko, które czasem otwiera drzwi.", attr: { cha: 2, agi: 1 }, node: "ld1", equip: { weapon: "w_armsword", body: "gambeson", head: "cap", feet: "boots", horse: "h_nag" }, items: [], gold: 450, troops: [["a_recruit", 3], ["a_militia", 1]], renown: 60, faith: 20, mana: 0, corruption: 0, hint: "Dowództwo i Łowiectwo (jazda)" },
  barb: { name: "Barbarzyńca", desc: "Z dzikich ziem za rzeką. Topór, łachmany i furia w żyłach.", attr: { str: 2, end: 2 }, node: "if1", equip: { weapon: "w_axe", body: "rags" }, items: [], gold: 80, troops: [["o_young", 3]], renown: 5, faith: 0, mana: 20, corruption: 0, hint: "Kondycja: Furia i Okrzyk" },
  hunter: { name: "Łowca", desc: "Las był twoim domem. Krótki łuk, nóż i znajomość tropów.", attr: { agi: 3 }, node: "ar1", equip: { weapon: "w_dagger", bow: "b_short", body: "leather", head: "hood" }, items: [], gold: 120, troops: [["a_recruit", 3]], renown: 0, faith: 10, mana: 40, corruption: 0, hint: "Łowiectwo: Skupienie i Wilcza wataha" },
};
const RACES: Record<string, { name: string; race: Race; desc: string; attr: Partial<Record<string, number>> }> = {
  human: { name: "Człowiek", race: "human", desc: "Wszechstronni i liczni. Ludzie łatwiej dogadują się z koronami.", attr: { cha: 1 } },
  dwarf: { name: "Krasnolud", race: "dwarf", desc: "Niscy, twardzi jak skała. Więcej zdrowia, wolniej biegają.", attr: { str: 1 } },
  orc: { name: "Ork", race: "orc", desc: "Silni i budzący grozę. Ludzie patrzą na nich krzywo.", attr: { str: 1 } },
  undead: { name: "Przebudzony", race: "skel", desc: "Martwy, który wstał z własną wolą. Nie czuje bólu, żywi mu nie ufają.", attr: { int: 1 } },
};
const SKILL_NAME: Record<string, string> = { ironflesh: "Wytrzymałość", powerstrike: "Silny cios", archery: "Łucznictwo", riding: "Jazda konna", leadership: "Dowodzenie", trade: "Handel", medicine: "Medycyna", tactics: "Taktyka", tracking: "Tropienie" };


function newPlayer(name: string, raceId: string, originId: string, look: Look): PlayerState {
  const O = ORIGINS[originId], R = RACES[raceId];
  const attr: Record<string, number> = { str: 4, agi: 4, end: 4, int: 4, cha: 4 };
  for (const k in O.attr) attr[k] += O.attr[k];
  for (const k in R.attr) attr[k] += R.attr[k];
  const skills: Record<string, number> = {};
  for (const k in SKILL_NAME) skills[k] = 0;
  const equip: Record<ESlot, string | null> = { head: null, body: null, hands: null, feet: null, weapon: null, shield: null, bow: null, horse: null };
  for (const k in O.equip) equip[k as ESlot] = O.equip[k as ESlot];
  const P: PlayerState = {
    name, race: raceId, origin: originId, look, level: 1, xp: 0, attrPts: 1, skillPts: 2, attr, skills, hp: 0, gold: O.gold, renown: O.renown, honor: 0,
    equip, items: O.items.slice(), goods: { grain: 10, meat: 3 }, abilities: ["", "", ""], learned: [], abLevels: { smite: 1 }, nodes: [], perks: {},
    faith: O.faith, mana: O.mana, corruption: O.corruption, bandages: 2, ammo: 30, companions: [], liege: 0, status: "wolny", contractDays: 0, wars: [],
    morale: 65, wageDebt: 0, lastPay: 1, captive: null, quests: [], kingdom: `Królestwo ${name}`, kills: 0, battlesWon: 0,
  };
  unlockNode(P, NODE(O.node), true);
  P.hp = heroMaxHp(P);
  return P;
}

function startNewGame(P: PlayerState) {
  const seed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  WORLD = generateWorld(seed, P);
  const p = playerParty(WORLD);
  for (const [t, n] of ORIGINS[P.origin].troops) addTroops(p.troops, t, n);
  // nieumarły bohater zaczyna w martwych ziemiach, ork u orków, krasnolud u krasnoludów
  const startF = P.race === "undead" ? 5 : P.race === "orc" ? 4 : P.race === "dwarf" ? 3 : 1;
  const st = WORLD.settlements.find((s) => s.faction === startF && s.kind === "town");
  if (st) { p.x = st.cx * WCELL + 10; p.y = st.cy * WCELL + 16; }
  WMAP = null; WBORDER = null; WBORDER_VER = -1;
  renderWorldMap(WORLD);
  G.view.cam.x = p.x - W / 2; G.view.cam.y = p.y - H / 2;
  G.state = "map";
  updateExplored(WORLD);
  chron(WORLD, `${P.name}, ${ORIGINS[P.origin].name.toLowerCase()}, przybywa do ${st ? st.name : "Doliny"} z garstką ludzi.`, PAL.gold);
  autosave();
  showMapHud();
  toast("Kliknij na mapie, by iść. Kliknij miasto, by wejść. PPM przesuwa widok, Spacja to postój lub obóz.", PAL.gold);
}

// ---------- Mapa: aktualizacja ----------
function mapUpdate(dt: number) {
  const w = WORLD, P = w.player, p = playerParty(w);
  G.view.time += dt;
  if (P.captive) return;
  const I = input;
  // kamera: przeciąganie PPM, strzałki, środkowanie na graczu
  if (I.mPressed[2]) { G.pan = { active: true, sx: I.mx, sy: I.my, cx: G.view.cam.x, cy: G.view.cam.y, t: G.view.time }; }
  if (G.pan.active && I.down[2]) { G.view.cam.x = G.pan.cx - (I.mx - G.pan.sx); G.view.cam.y = G.pan.cy - (I.my - G.pan.sy); }
  if (I.mReleased[2]) G.pan.active = false;
  const ps = 260 * dt;
  let panned = false;
  if (I.held("ArrowLeft") || I.held("KeyA")) { G.view.cam.x -= ps; panned = true; }
  if (I.held("ArrowRight") || I.held("KeyD")) { G.view.cam.x += ps; panned = true; }
  if (I.held("ArrowUp") || I.held("KeyW")) { G.view.cam.y -= ps; panned = true; }
  if (I.held("ArrowDown") || I.held("KeyS")) { G.view.cam.y += ps; panned = true; }
  if (panned || G.pan.active) G.pan.t = G.view.time;
  if (p.path.length && G.view.time - G.pan.t > 1.5) { G.view.cam.x = lerp(G.view.cam.x, p.x - W / 2, clamp(dt * 3, 0, 1)); G.view.cam.y = lerp(G.view.cam.y, p.y - H / 2, clamp(dt * 3, 0, 1)); }
  if (I.hit("KeyH")) { G.view.cam.x = p.x - W / 2; G.view.cam.y = p.y - H / 2; G.pan.t = -9; }
  // najechanie kursorem
  const wx = G.view.cam.x + I.mx, wy = G.view.cam.y + I.my;
  G.view.hover = null;
  // osada ma pierwszeństwo, gdy kursor jest na niej (lordowie często stoją pod murami)
  let sd = 1e9, sId = -1;
  for (const s of w.settlements) { if (!w.explored[cidx(s.cx, s.cy)]) continue; const d = dist(s.cx * WCELL + 4, s.cy * WCELL, wx, wy); if (d < 16 && d < sd) { sd = d; sId = s.id; } }
  let bd = 12;
  for (const o of w.parties) { if (o.kind === "player" || !partyVisible(w, o)) continue; const d = dist(o.x, o.y - 6, wx, wy); if (d < bd && d < sd - 6) { bd = d; G.view.hover = { kind: "party", id: o.id }; } }
  if (!G.view.hover && sId >= 0) G.view.hover = { kind: "settlement", id: sId };
  if (!G.view.hover) for (const pl of w.places) { if (!w.explored[cidx(pl.cx, pl.cy)]) continue; if (dist(pl.cx * WCELL + 4, pl.cy * WCELL, wx, wy) < 10) { G.view.hover = { kind: "place", id: pl.id }; break; } }
  updateTip();
  // widok świata: klik pokazuje miejsce
  if (G.view.overview) {
    const o = (G.view as any).ovK;
    if (I.mPressed[0] && o) { G.view.cam.x = (I.mx - o.ox) / o.k - W / 2; G.view.cam.y = (I.my - o.oy) / o.k - H / 2; G.view.overview = false; G.pan.t = G.view.time; }
    G.view.hover = null; updateTip();
  } else
  // przytrzymanie LPM: ciągły marsz za kursorem
  if (I.down[0] && !I.mPressed[0] && !screenOpen() && !G.view.hover && G.view.time - (G as any).holdT > 0.3) { (G as any).holdT = G.view.time; G.camping = false; G.target = null; p.state = "move"; goTo(w, p, wx, wy); G.pan.t = -9; }
  // klik: ruch
  if (I.mPressed[0] && !screenOpen() && !G.view.overview) {
    (G as any).holdT = G.view.time;
    G.camping = false; G.waitHours = 0; p.state = "move";
    const hv = G.view.hover;
    if (hv) {
      G.target = { kind: hv.kind as any, id: hv.id };
      if (hv.kind === "party") { const o = partyById(w, hv.id); goTo(w, p, o.x, o.y); }
      else if (hv.kind === "settlement") { const s = w.settlements[hv.id]; goTo(w, p, s.cx * WCELL + 4, s.cy * WCELL + 4); }
      else { const pl = w.places[hv.id]; goTo(w, p, pl.cx * WCELL + 4, pl.cy * WCELL + 4); }
    } else {
      G.target = null;
      if (!goTo(w, p, wx, wy)) toast("Tam nie da się dojść.", PAL.ash);
    }
    G.pan.t = -9;
  }
  if (I.hit("Space")) { if (p.path.length) { p.path = []; toast("Postój."); } else { G.camping = !G.camping; p.state = G.camping ? "camp" : "idle"; toast(G.camping ? "Rozbijasz obóz. Czas płynie, rany goją się szybciej." : "Zwijacie obóz."); } }
  // czas płynie tylko w ruchu, w obozie lub podczas czekania
  const moving = p.path.length > 0;
  if (!moving) checkArrival();
  if (G.state !== "map" || screenOpen()) return;
  if (!moving && !G.camping && G.waitHours <= 0) { G.encounterCooldown = Math.max(0, G.encounterCooldown - dt); return; }
  const hours = dt * HOURS_PER_SEC * G.speed;
  if (G.waitHours > 0) { G.waitHours -= hours; if (G.waitHours <= 0) waitDone(); }
  // pościg za celem-oddziałem
  if (G.target && G.target.kind === "party") {
    const o = partyById(w, G.target.id);
    if (!o) G.target = null;
    else if (p.path.length < 3 || chance(dt * 2)) goTo(w, p, o.x, o.y);
  }
  const prevDay = w.day;
  moveParty(w, p, hours);
  worldTick(w, hours);
  if (moving) maybeTravelEvent(hours);
  if (w.day !== prevDay) { refreshMapHud(); if (settings.autosaveDays > 0 && w.day - G.lastAuto >= settings.autosaveDays) { G.lastAuto = w.day; autosave(); } }
  G.encounterCooldown = Math.max(0, G.encounterCooldown - hours);
  checkArrival();
  if (G.state === "map" && !screenOpen()) checkEncounters();
  // zatrzymaj marsz, gdy w polu widzenia pojawi się groźny wróg
  if (settings.pauseOnEvent && p.path.length) {
    const mine = partyPower(w, p);
    for (const o of w.parties) {
      if (o === p || G.seen.has(o.id) || !hostile(w, p, o) || !partyVisible(w, o)) continue;
      G.seen.add(o.id);
      if (partyPower(w, o) > mine * 1.0 && !(G.target && G.target.kind === "party" && G.target.id === o.id)) { p.path = []; G.camping = false; toast(`Uwaga: ${o.name} w zasięgu wzroku (${troopCount(o.troops)} ludzi). Marsz wstrzymany.`, PAL.redL); sfx.drum(0.6); break; }
    }
  }
}

function waitDone() { G.waitHours = 0; G.camping = false; const p = playerParty(WORLD); p.state = "idle"; if (pendingAfterWait) { const f = pendingAfterWait; pendingAfterWait = null; f(); } }
let pendingAfterWait: (() => void) | null = null;

function checkArrival() {
  const w = WORLD, p = playerParty(w);
  if (!G.target || p.path.length) return;
  const t = G.target;
  if (t.kind === "settlement") { const s = w.settlements[t.id]; if (dist(p.x, p.y, s.cx * WCELL + 4, s.cy * WCELL + 4) < 14) { G.target = null; enterSettlement(s); } }
  else if (t.kind === "place") { const pl = w.places[t.id]; if (dist(p.x, p.y, pl.cx * WCELL + 4, pl.cy * WCELL + 4) < 12) { G.target = null; enterPlace(pl); } }
  else if (t.kind === "party") { const o = partyById(w, t.id); if (o && dist(p.x, p.y, o.x, o.y) < 12) { G.target = null; meetParty(o, false); } }
}

function checkEncounters() {
  const w = WORLD, p = playerParty(w);
  if (G.encounterCooldown > 0) return;
  for (const o of w.parties) {
    if (o === p || !hostile(w, p, o)) continue;
    if (dist(p.x, p.y, o.x, o.y) < 9 && (o.state === "chase" && o.target === p.id || dist(p.x, p.y, o.x, o.y) < 6)) { p.path = []; const guarded = G.camping && (w.player as any).campMode === "guard"; if (guarded) toast("Wartownicy podnoszą alarm! Zdążycie się uszykować.", PAL.gold); meetParty(o, !guarded); return; }
  }
}

// ---------- Siła i skład bitwy ----------
function heroCfgFromPlayer(P: PlayerState): HeroCfg {
  const it = (s: ESlot) => (P.equip[s] ? ITEMS[P.equip[s]] : null);
  let armor = 0;
  for (const s of ["head", "body", "hands", "feet"] as ESlot[]) armor += (it(s)?.armor || 0) * condK(P, s);
  if (P.race === "undead") armor += 0.05;
  armor = Math.min(0.66, armor + perk(P, "armorB"));
  const hd = it("head");
  const look: Look = { ...P.look, helm: hd?.helm || (P.look.race === "skel" ? "none" : "none"), body: it("body")?.body || "rags", scabbard: !!it("weapon"), plume: hd && hd.tier >= 3 ? (P.status === "król" ? PAL.gold : PAL.redL) : undefined };
  const horse = it("horse");
  const bow = it("bow");
  const hs = horseStats(P);
  const w2 = (P as any).weapon2 ? ITEMS[(P as any).weapon2] : null;
  return {
    name: P.name, look, hp: Math.max(1, P.hp), maxHp: heroMaxHp(P), weapon: it("weapon")?.weapon || "dagger", shield: !!it("shield"),
    bowDmg: bow ? Math.round(bow.bowDmg * (1 + P.skills.archery * 0.05) * (1 + (bow.xbow ? perk(P, "xbowB") : perk(P, "bowB")) + perk(P, "pierce") / 2) * condK(P, "bow")) : 0, ammo: bow ? P.ammo + perk(P, "ammo") : 0,
    xbow: !!bow?.xbow, weapon2: w2?.weapon,
    armor, mount: horse ? { ...horse.mount, hp: Math.round(horse.mount.hp * hs.hp * (1 + perk(P, "horseB"))), speed: horse.mount.speed * (1 + P.skills.riding * 0.02 + perk(P, "horseSpd")) * hs.speed } : null,
    abilities: P.abilities.slice(), abLevels: { ...P.abLevels }, faith: P.faith, mana: P.mana, fury: 0, corruption: P.corruption, bandages: P.bandages,
    leadership: P.skills.leadership, medicine: P.skills.medicine,
  };
}
// Zużycie sprzętu: poniżej 50% gorzej chroni, poniżej 20% dużo gorzej.
function condOf(P: PlayerState, s: ESlot) { return ((P as any).cond || {})[s] ?? 100; }
function condK(P: PlayerState, s: ESlot) { const c = condOf(P, s); return c < 20 ? 0.75 : c < 50 ? 0.9 : 1; }
// Koń z imieniem, cechą i doświadczeniem.
const HORSE_TRAITS: Record<string, { name: string; speed: number; hp: number }> = { swift: { name: "Rączy", speed: 1.06, hp: 1 }, tough: { name: "Wytrzymały", speed: 1, hp: 1.15 }, war: { name: "Bojowy", speed: 1.02, hp: 1.06 }, wild: { name: "Narowisty", speed: 1.1, hp: 0.9 } };
const HORSE_NAMES = ["Burza", "Węgielek", "Siwek", "Kasztan", "Wicher", "Popiół", "Kruk", "Iskra", "Grom", "Mgła"];
function horseInfo(P: PlayerState) {
  const id = P.equip.horse; if (!id) return null;
  const H = (P as any).horse;
  if (!H || H.id !== id) (P as any).horse = { id, name: pick(HORSE_NAMES), trait: pick(Object.keys(HORSE_TRAITS)), xp: 0 };
  return (P as any).horse as { id: string; name: string; trait: string; xp: number };
}
function horseStats(P: PlayerState) { const h = horseInfo(P); if (!h) return { speed: 1, hp: 1 }; const T = HORSE_TRAITS[h.trait], lv = Math.min(5, Math.floor(h.xp / 50)); return { speed: T.speed * (1 + lv * 0.02), hp: T.hp * (1 + lv * 0.02) }; }
// Waga: kara do szybkości i oddechu ponad udźwig (siła), łagodzona przez drzewko Ciężkiego pancerza.
function equipWeight(P: PlayerState) { return (Object.values(P.equip) as (string | null)[]).reduce((a, id) => a + itemWeight(id ? ITEMS[id] : null), 0) + ((P as any).weapon2 ? itemWeight(ITEMS[(P as any).weapon2]) : 0); }
function carryCap(P: PlayerState) { return 10 + P.attr.str * 1.4; }
function weightPenalty(P: PlayerState) { return Math.max(0, equipWeight(P) - carryCap(P)) * (1 - Math.min(0.9, perk(P, "weightRes"))); }
function companionCfgs(P: PlayerState): CompanionCfg[] {
  const AB: Record<string, string> = { "kapłanka": "priest", "medyk": "priest", "rębajło": "whirlai", "obrońca": "rally", "rycerz": "rally", "zwiadowczyni": "whirlai", "zwiadowca": "whirlai", "czarodziejka": "mage", "inżynier": "rally", "kupcowa": "whirlai" };
  return P.companions.filter((c) => c.hp > c.maxHp * 0.25 && !((c as any).away > WORLD.day)).map((c) => ({ id: c.id, name: c.name, look: c.look, hp: c.hp, maxHp: c.maxHp, weapon: c.weapon, shield: c.shield, armor: c.armor, squad: c.squad, bow: c.bow || undefined, mount: c.horse ? HORSE : null, ab: AB[c.role] }));
}
function healthyTroops(list: Troop[]) { return list.map((t) => ({ type: t.type, n: t.n - t.wounded })).filter((t) => t.n > 0); }
function battleTerrainAt(w: World, x: number, y: number): Terrain {
  const cx = Math.floor(x / WCELL), cy = Math.floor(y / WCELL);
  let river = 0, sea = 0, mount = 0, bridge = 0;
  for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const t = terrAt(w, cx + dx, cy + dy); if (t === T_RIVER) river++; if (t === T_SEA) sea++; if (t === T_MOUNT) mount++; const i = cidx(clamp(cx + dx, 0, WGW - 1), clamp(cy + dy, 0, WGH - 1)); if (w.road[i] === 2) bridge++; }
  const vil = w.settlements.find((s) => s.kind === "village" && dist(s.cx, s.cy, cx, cy) < 3.5);
  if (vil) return "village";
  if (bridge) return "bridge";
  if (river >= 2) return "river";
  if (mount >= 4) return "ravine";
  if (sea >= 3) return "coast";
  const t = terrAt(w, cx, cy);
  if (t === T_FOREST) return "forest";
  if (t === T_HILL) return "hills";
  if (t === T_SWAMP) return "swamp";
  if (t === T_BEACH) return "coast";
  if (w.blight[cidx(cx, cy)] && chance(0.5)) return "ruins";
  return "plains";
}
function nearbyAllies(w: World, enemy: Party, r = 64): Party[] {
  const p = playerParty(w);
  return w.parties.filter((o) => o !== p && o.kind === "lord" && !hostile(w, p, o) && hostile(w, o, enemy) && dist(o.x, o.y, p.x, p.y) < r);
}
function nearbyEnemyHelpers(w: World, enemy: Party, r = 56): Party[] {
  const p = playerParty(w);
  return w.parties.filter((o) => o !== enemy && o !== p && (o.kind === "lord" || o.kind === enemy.kind) && hostile(w, p, o) && !hostile(w, o, enemy) && dist(o.x, o.y, enemy.x, enemy.y) < r);
}

function launchBattle(ctx: BattleCtx, cfgExtra: Partial<BattleConfig> = {}) {
  const w = WORLD, P = w.player, p = playerParty(w);
  closeScreen();
  const enemyTroops: Troop[] = [];
  for (const e of ctx.enemies) for (const t of healthyTroops(e.troops)) addTroops(enemyTroops, t.type, t.n);
  if (ctx.enemyTroops) for (const t of ctx.enemyTroops) addTroops(enemyTroops, t.type, t.n - (t.wounded || 0));
  const allies = ctx.allies.map((a) => ({ name: a.name, faction: a.faction, troops: healthyTroops(a.troops) }));
  if (ctx.garrisonAlly) allies.push({ name: "Załoga", faction: ctx.settlement?.faction || 1, troops: healthyTroops(ctx.garrisonAlly) });
  const enemyFaction = ctx.enemies[0]?.faction ?? ctx.settlement?.faction ?? (ctx.place?.kind === "cemetery" ? 5 : ctx.place?.kind === "lair" ? 7 : 6);
  const terrain = ctx.kind === "siege" ? "siege" : ctx.kind === "arena" ? "arena" : ctx.place ? (ctx.place.kind === "ruins" || ctx.place.kind === "cemetery" ? "ruins" : ctx.place.kind === "lair" || ctx.place.kind === "camp" ? "forest" : "plains") : battleTerrainAt(w, p.x, p.y);
  const night = ctx.kind === "arena" ? false : ctx.place?.kind === "cemetery" ? true : isNight(w);
  const cfg: BattleConfig = {
    terrain: terrain as Terrain, night, rain: ctx.kind === "arena" ? false : w.rain, fog: ctx.kind !== "arena" && !!w.fog,
    player: { name: P.name, faction: P.status === "król" ? PLAYER_FACTION : P.liege > 0 ? P.liege : 0, troops: ctx.kind === "arena" ? [] : healthyTroops(p.troops).map((t) => ({ ...t, squad: ((P as any).squadOf || {})[t.type] || undefined })), hero: heroCfgFromPlayer(P), companions: ctx.kind === "arena" ? [] : companionCfgs(P), allies },
    enemy: { name: ctx.defend && ctx.enemies[0] ? ctx.enemies[0].name : ctx.title, faction: enemyFaction, troops: enemyTroops.map((t) => ({ type: t.type, n: t.n })) },
    siegeDefender: ctx.kind === "siege" ? 1 : undefined,
    maxPerSide: settings.battleSize,
    title: ctx.title,
    ...cfgExtra,
  };
  if (ctx.kind === "arena") {
    const A = ctx.arena as any, mode = A.mode || (A.team ? "team3" : "duel");
    cfg.arena = { kind: mode.startsWith("team") ? "team" : mode === "beasts" ? "beasts" : "duel", lethal: mode === "death", joust: mode === "joust", archery: mode === "archery" };
    cfg.maxPerSide = mode === "waves" ? 2 : 20;
    if (mode === "team3") cfg.player.troops = [{ type: pick(["m_sword", "a_maa", "v_legion"]), n: 2 }];
    if (mode === "team5") cfg.player.troops = [{ type: pick(["m_sword", "a_maa"]), n: 2 }, { type: pick(["v_legion", "o_warrior", "d_shield"]), n: 2 }];
    const kit = ARENA_KITS[A.kit || 0];
    if (kit && kit.weapon) cfg.player.hero = { ...cfg.player.hero, weapon: kit.weapon, shield: !!kit.shield, bowDmg: kit.bow || 0, ammo: kit.bow ? 20 : 0 };
    if (mode === "joust") cfg.player.hero = { ...cfg.player.hero, weapon: "lance", shield: true, mount: cfg.player.hero.mount || { hp: 130, speed: 118, accel: 66, turn: 2.8 } };
    if (mode === "archery") cfg.player.hero = { ...cfg.player.hero, bowDmg: Math.max(cfg.player.hero.bowDmg || 0, 40), ammo: 12 };
    if (mode === "death") cfg.night = true;
  }
  G.ctx = ctx;
  const tb = document.getElementById("toasts"); if (tb) tb.innerHTML = "";
  G.battle = new Battle(cfg, input, sfx, settings);
  const b = G.battle;
  const two = P.equip.weapon && WEAPONS[ITEMS[P.equip.weapon].weapon]?.twoHanded;
  b.heroDmg = (1 + P.attr.str * 0.02 + P.skills.powerstrike * 0.06 + (two ? perk(P, "twoHand") : 0)) * (P.equip.weapon ? (QUAL[qualOf(P.equip.weapon)]?.k ?? 1) : 1);
  b.heroStamina = 1 + (P.attr.end - 4) * 0.04 + perk(P, "stamina");
  b.heroBlockCost = 1 + perk(P, "blockCost");
  b.corruptMul = Math.max(0.2, 1 - perk(P, "corruptRes"));
  b.fireMul = 1 + perk(P, "fireDmg");
  b.furyMul = 1 + perk(P, "fury");
  b.heroSpeed = (1 + (P.attr.agi - 4) * 0.015 + perk(P, "bspeed")) * Math.max(0.7, 1 - weightPenalty(P) * 0.012);
  b.heroStamina *= Math.max(0.6, 1 - weightPenalty(P) * 0.015);
  b.heroDmg *= 1 + perk(P, "meleeDmg");
  b.pk = { ...(P.perks || {}) };
  if (b.hero) b.hero.shieldHp *= 1 + perk(P, "shieldHp");
  for (const u of b.units) if (u.team === 0 && !u.hero) u.morale = clamp(40 + P.morale * 0.6 + P.skills.leadership * 2 + perk(P, "moraleB"), 20, 100);
  for (const u of b.units) if (u.team === 1 && !u.def.undead) u.morale -= perk(P, "dread");
  G.state = "battle";
  hideMapHud();
  showBattleHud();
  // rozstawienie przed bitwą (pole i szturm), chyba że zasadzka albo arena
  const ambushed = ctx.kind === "field" && ctx.enemies.some((e) => (e as any).ambush);
  b.phase = settings.deploy !== false && (ctx.kind === "field" || (ctx.kind === "siege" && !ctx.defend)) && !ambushed && !(ctx as any).sally ? "deploy" : "fight";
  if (b.phase === "deploy") { b.cmdOpen = true; b.say("Rozstawienie: ustaw oddziały (wybierz numer, PPM przeciągnij linię). Enter lub Spacja: do boju!", PAL.gold, true); }
  // sojusznicy słuchają tylko przy dobrej relacji z ich panem (albo gdy jesteś władcą lub marszałkiem)
  b.cfg.allyObey = P.status === "król" || ctx.allies.every((a) => a.lord == null || a.lord < 0 || (w.lords[a.lord]?.relation ?? 0) >= 10);
  const intro = ctx.kind === "siege" && ctx.defend ? `Wróg pod murami ${ctx.settlement.name}! Trzymajcie blanki i bramę.` : ctx.kind === "siege" ? `Szturm na ${ctx.settlement.name}! Drabiny pod murami, taran przy bramie.` : ctx.kind === "arena" ? "Arena. Walczysz do nokautu." : `${TERRAIN_NAME[cfg.terrain]}${night ? ", noc" : ""}${cfg.rain ? ", deszcz" : ""}. ${troopCount(enemyTroops)} wrogów przeciw ${healthyTroops(p.troops).reduce((s, t) => s + t.n, 0) + 1 + cfg.player.companions.length + allies.reduce((s, a) => s + a.troops.reduce((q, t) => q + t.n, 0), 0)} twoim.`;
  b.say(intro, PAL.bone, true);
  b.shout(ctx.title, PAL.gold);
  sfx.battleCry(1);
}

// Rozdzielenie strat bitwy na konkretne oddziały.
function distributeLosses(parties: { troops: Troop[] }[], cas: Casualty[], woundedToo: boolean) {
  for (const c of cas) {
    let kill = c.killed, wound = c.wounded;
    for (const pt of parties) {
      const t = pt.troops.find((x) => x.type === c.type);
      if (!t) continue;
      const healthy = t.n - t.wounded;
      const k = Math.min(kill, healthy); kill -= k; t.n -= k;
      const wd = Math.min(wound, t.n - t.wounded); wound -= wd;
      if (woundedToo) t.wounded += wd; else t.n -= wd;
      if (kill <= 0 && wound <= 0) break;
    }
    for (const pt of parties) pt.troops.splice(0, pt.troops.length, ...pt.troops.filter((t) => t.n > 0));
  }
}

function battleFinished() { applyBattleResult(G.battle.result); }
// Rozstrzygnięcie bez walki: siła obu stron, taktyka i dowodzenie, losowość. Bohater nie walczy osobiście.
function autoResolve(ctx: BattleCtx) {
  const w = WORLD, P = w.player, p = playerParty(w);
  closeScreen();
  G.ctx = ctx;
  const mine = troopPower(p.troops) + ctx.allies.reduce((s, a) => s + troopPower(a.troops), 0) + P.companions.length * 1.5;
  const theirs = ctx.enemies.reduce((s, e) => s + troopPower(e.troops), 0) + (ctx.enemyTroops ? troopPower(ctx.enemyTroops) : 0);
  const k = 1 + P.skills.tactics * 0.08 + P.skills.leadership * 0.03;
  const pm = mine * k * rr(0.8, 1.2), pt = theirs * rr(0.8, 1.2) * (ctx.kind === "siege" ? 1.8 : 1);
  const win = pm > pt;
  const ratio = Math.min(pm, pt) / Math.max(pm, pt, 0.01);
  const lose = (list: Troop[], frac: number, woundShare: number): Casualty[] => list.map((t) => { const n = Math.min(t.n - t.wounded, Math.round((t.n - t.wounded) * frac * rr(0.7, 1.3))); const wd = Math.round(n * woundShare); return { type: t.type, killed: n - wd, wounded: wd }; }).filter((c) => c.killed + c.wounded > 0);
  const ourFrac = win ? clamp(ratio * 0.5, 0.03, 0.7) : clamp(0.5 + ratio * 0.3, 0.4, 1);
  const theirFrac = win ? clamp(0.7 + (1 - ratio) * 0.3, 0.6, 1) : clamp(ratio * 0.45, 0.05, 0.6);
  const enemyAll: Troop[] = []; for (const e of ctx.enemies) for (const t of e.troops) addTroops(enemyAll, t.type, t.n - t.wounded); if (ctx.enemyTroops) for (const t of ctx.enemyTroops) addTroops(enemyAll, t.type, t.n - (t.wounded || 0));
  const allyAll: Troop[] = []; for (const a of ctx.allies) for (const t of a.troops) addTroops(allyAll, t.type, t.n - t.wounded);
  const ours = lose(p.troops, ourFrac, 0.5 + P.skills.medicine * 0.03), theirsC = lose(enemyAll, theirFrac, 0.3);
  const xp: Record<string, number> = {};
  for (const t of p.troops) xp[t.type] = (t.n - t.wounded) * (win ? 10 : 4);
  const prisoners = win ? theirsC.filter((c) => !UNITS[c.type].undead && UNITS[c.type].culture !== "monster").map((c) => ({ type: c.type, n: Math.round(c.wounded * 0.8) })).filter((x) => x.n > 0) : [];
  const r: BattleResult = { win, heroKO: false, heroHp: P.hp, heroKills: 0, faith: P.faith, mana: P.mana, fury: 0, corruption: P.corruption, bandages: P.bandages, ammo: P.ammo,
    ours, theirs: theirsC, allies: lose(allyAll, ourFrac, 0.4), xp, prisoners, companionsKO: [], companionHp: {}, enemyKilled: theirsC.reduce((s, c) => s + c.killed, 0), time: 0, retreated: !win };
  G.battle = null;
  applyBattleResult(r, true);
}
function applyBattleResult(r: BattleResult, auto = false) {
  const ctx = G.ctx, w = WORLD, P = w ? w.player : null, p = w ? playerParty(w) : null;
  hideBattleHud();
  if (!w || ctx.kind === "custom") { G.state = "title"; G.battle = null; showTitle(); return; }
  // stan bohatera
  P.hp = r.heroKO ? Math.max(1, Math.round(heroMaxHp(P) * 0.1)) : r.heroHp;
  P.faith = r.faith; P.mana = r.mana; P.corruption = r.corruption; P.bandages = r.bandages; if (P.equip.bow) P.ammo = Math.max(10, r.ammo);
  for (const c of P.companions) { if (r.companionHp[c.id] !== undefined) c.hp = r.companionHp[c.id]; if (r.companionsKO.includes(c.id)) c.hp = Math.max(1, Math.round(c.maxHp * 0.1)); }
  P.kills += r.heroKills;
  const lines: string[] = [];
  let lootGold = 0;
  let sackNext: (() => void) | null = null;
  const lootItems: string[] = [];
  if (ctx.kind === "arena") { arenaFinished(r); return; }
  // straty własne i sojuszników
  distributeLosses([p], r.ours, true);
  distributeLosses(ctx.allies, r.allies, true);
  if (ctx.garrisonAlly) distributeLosses([{ troops: ctx.garrisonAlly }], r.allies, true);
  // straty wroga
  const enemyHolders: { troops: Troop[] }[] = [...ctx.enemies];
  if (ctx.enemyTroops) enemyHolders.push({ troops: ctx.enemyTroops });
  distributeLosses(enemyHolders, r.theirs, false);
  // doświadczenie oddziałów
  for (const k in r.xp) { const t = p.troops.find((x) => x.type === k); if (t) t.xp += Math.round(r.xp[k]); }
  // zużycie sprzętu i doświadczenie konia
  if (G.ctx?.kind !== "arena") { const cond = ((P as any).cond ||= {}) as Record<string, number>; for (const sl of Object.keys(P.equip)) if (P.equip[sl as ESlot] && sl !== "horse") cond[sl] = Math.max(5, (cond[sl] ?? 100) - Math.round(rr(2, 6) + (r.heroHp < heroMaxHp(P) * 0.4 ? 4 : 0))); const hz = horseInfo(P); if (hz) hz.xp += 10; }
  // doświadczenie bohatera
  const enemyPow = r.theirs.reduce((s, c) => s + unitPower(c.type) * (c.killed + c.wounded), 0);
  const heroXp = Math.round(enemyPow * 6 + r.heroKills * 12 + (r.win ? 40 : 10));
  gainXp(P, heroXp, lines);
  if (r.win) {
    P.battlesWon++;
    const renown = Math.round(clamp(enemyPow * 0.6, 1, 60) * (ctx.kind === "siege" ? 2 : 1));
    P.renown += Math.round(renown * (1 + perk(P, "renownB")));
    P.morale = clamp(P.morale + 8, 0, 100);
    lootGold = Math.round((ctx.enemies.reduce((s, e) => s + e.gold, 0) * 0.8 + enemyPow * 6 * (1 + P.skills.trade * 0.03)) * (1 + perk(P, "lootB")));
    if (perk(P, "hunter") && ctx.enemies.some((e) => e.kind === "monster")) { P.goods.meat = (P.goods.meat || 0) + 3; lines.push("Myśliwy: oprawiasz bestie, +3 mięsa."); }
    { const pool = baseItems().filter((it) => it.tier <= (enemyPow > 30 ? 3 : 2) && it.slot !== "horse"); const n = Math.min(5, Math.floor(enemyPow / 12) + (chance(0.5) ? 1 : 0)); for (let i = 0; i < n; i++) if (chance(0.55)) { const id = qid(pick(pool).id, chance(0.6) ? 0 : chance(0.9) ? 1 : 2); ensureItem(id); lootItems.push(id); } }   // łupy z pola: zwykle zardzewiałe
    if (ctx.place && ctx.place.kind === "ruins") { lootGold += 300; P.skillPts++; lines.push("W ruinach znajdujesz starą księgę. +1 punkt drzewka umiejętności."); if (chance(0.15)) { const u = pick(UNIQUES.filter((x) => !WORLD.player.items.includes(x))); if (u) { lootItems.push(u); lines.push(`W krypcie leży coś niezwykłego: ${ITEMS[u].name}!`); } } else lootItems.push(pick(baseItems().filter((it) => it.tier >= 2 && it.tier <= 4 && it.slot !== "horse")).id); }
    P.gold += lootGold;
    // jeńcy
    for (const pr of r.prisoners) addTroops(p.prisoners, pr.type, pr.n);
    // usunięcie rozbitych oddziałów i pojmani lordowie
    for (const e of ctx.enemies) {
      if (e.lord !== undefined) {
        const L = lordById(w, e.lord);
        if (chance(0.5)) { L.captive = PLAYER_FACTION; lines.push(`${L.title} ${L.name} jest twoim jeńcem.`); chron(w, `${P.name} pojmał: ${L.title} ${L.name}.`, PAL.gold); L.relation -= 10; }
        else chron(w, `${P.name} rozbija armię: ${e.name}.`, PAL.gold);
      } else if (e.kind === "bandit" || e.kind === "undead" || e.kind === "monster") chron(w, `${P.name} rozbija: ${e.name} w pobliżu ${nearestSettlement(w, e.x, e.y).name}.`);
      removeParty(w, e);
      // zadania na bandytów
      for (const q of P.quests) if (!q.done && (q.kind === "bandits" || q.kind === "defend") && q.target === e.id) completeQuest(q, lines);
    }
    for (const a of ctx.allies) { const L = lordById(w, a.lord); if (L) { L.relation += 4; lines.push(`${L.title} ${L.name} docenia twoją pomoc (+4).`); } }
    if (ctx.place) {
      ctx.place.cleared = 20;
      for (const q of P.quests) if (!q.done && q.kind === "wolves" && q.target === ctx.place.id) completeQuest(q, lines);
      if (ctx.place.kind === "camp" || ctx.place.kind === "cemetery") { lootGold += 150; P.gold += 150; P.renown += 10; }
    }
    if (ctx.kind === "siege" && ctx.settlement && ctx.defend) { const s = ctx.settlement; s.siegeBy = []; s.siegeDays = 0; s.relation += 15; P.renown += 30; lines.push(`Oblężenie ${s.name} przełamane!`); chron(w, `${P.name} przełamuje oblężenie ${s.name}.`, PAL.gold); }
    else if (ctx.kind === "siege" && ctx.settlement) { siegeWon(ctx.settlement, lines); if (ctx.settlement.kind !== "village") sackNext = () => showSack(ctx.settlement); }
    if ((ctx as any).sally && ctx.settlement) { const s = ctx.settlement; for (const e of ctx.enemies) { e.siege = undefined; } s.siegeBy = []; s.siegeDays = 0; lines.push(`Nocny wypad rozbił obóz oblegających. ${s.name} wolne!`); P.renown += 25; chron(w, `${P.name} rozbija nocnym wypadem oblężenie ${s.name}.`, PAL.gold); }
    if (ctx.onWin) ctx.onWin(lines);
  } else {
    P.morale = clamp(P.morale - 15, 0, 100);
    // przegrana: wróg zachowuje resztę; bohater w niewoli, jeśli armia rozbita
    if (auto && healthyCount(p.troops) > 0) lines.push("Wycofujesz resztę armii z pola.");
    else if (!r.retreated || healthyCount(p.troops) === 0) {
      const captor = ctx.enemies[0];
      if (captor && captor.kind !== "monster" && captor.kind !== "undead") captivity(captor.faction, lines);
      else if (ctx.settlement) captivity(ctx.settlement.faction, lines);
      else { // bestie i nieumarli: budzisz się sam
        lines.push("Budzisz się wśród trupów. Twoi ludzie zginęli albo uciekli.");
        p.troops = p.troops.filter(() => chance(0.15));
      }
    } else lines.push("Wycofujesz się z pola. Część ludzi nie zdążyła uciec.");
    if (ctx.kind === "siege" && ctx.settlement && ctx.defend && ctx.enemies[0]) { const e0 = ctx.enemies[0]; captureSettlement(w, ctx.settlement, e0.faction, e0.lord ?? -1); ctx.settlement.siegeBy = []; ctx.settlement.siegeDays = 0; }
    if (ctx.kind === "siege" && ctx.settlement) { ctx.settlement.siegeBy = ctx.settlement.siegeBy.filter((id) => id !== p.id); p.siege = undefined; }
  }
  // bitwy z lordami zmieniają nastawienie frakcji
  if (auto) lines.unshift(r.win ? "Rozstrzygnięcie bez walki: twoi ludzie zwyciężają." : "Rozstrzygnięcie bez walki: bitwa przegrana.");
  showAftermath(r, lootGold, lootItems, lines, sackNext || undefined);
  G.battle = null;
}

function gainXp(P: PlayerState, xp: number, lines: string[]) {
  xp = Math.round(xp * (1 + perk(P, "xpB")));
  P.xp += xp;
  lines.push(`Doświadczenie: +${xp}.`);
  while (P.xp >= xpForLevel(P.level + 1)) {
    P.level++; P.attrPts += 1; P.skillPts += 1;
    lines.push(`Awans na poziom ${P.level}! +1 punkt atrybutu, +1 punkt drzewka (okno postaci, C).`);
    sfx.drum(1);
  }
}
function xpForLevel(l: number) { return Math.round(120 * Math.pow(l - 1, 1.45)); }

function captivity(byFaction: number, lines: string[]) {
  const w = WORLD, P = w.player, p = playerParty(w);
  P.captive = { by: byFaction, days: Math.round(rr(3, 7)) };
  lines.push(`Zostajesz pojmany przez: ${factionName(byFaction)}.`);
  const lostGold = Math.round(P.gold * 0.3); P.gold -= lostGold;
  if (lostGold) lines.push(`Zabrano ci ${lostGold} denarów.`);
  p.troops = []; p.prisoners = [];
  p.path = []; G.target = null;
  chron(w, `${P.name} trafia do niewoli (${factionName(byFaction)}).`, PAL.redL);
}
function releaseFromCaptivity(text: string) {
  const w = WORLD, P = w.player, p = playerParty(w);
  P.captive = null;
  const safe = w.settlements.filter((s) => s.kind === "town" && !playerAtWarWith(w, s.faction)).sort((a, b) => dist(p.x, p.y, a.cx * WCELL, a.cy * WCELL) - dist(p.x, p.y, b.cx * WCELL, b.cy * WCELL))[0] || w.settlements[0];
  p.x = safe.cx * WCELL + 10; p.y = safe.cy * WCELL + 16;
  P.hp = Math.max(P.hp, heroMaxHp(P) * 0.4);
  G.view.cam.x = p.x - W / 2; G.view.cam.y = p.y - H / 2;
  toast(text, PAL.gold);
  chron(w, `${P.name} odzyskuje wolność i trafia do ${safe.name}.`);
  closeScreen(); showMapHud(); refreshMapHud();
}

// Los zdobytego miasta: oszczędzić, złupić albo spalić.
function showSack(s: Settlement) {
  const w = WORLD, P = w.player;
  const loot = Math.round(200 + s.prosperity * (s.kind === "town" ? 9 : 5));
  const done = (txt: string) => { toast(txt, PAL.gold); showMapHud(); refreshMapHud(); autosave(); };
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("town", w.day, s.culture, isNight(w)), "scene-img")}</div>
    <h1>${s.name} zdobyte</h1><p>Twoi ludzie stoją na rynku z gołymi ostrzami. Mieszczanie patrzą z okien. Co rozkażesz?</p>
    <div class="choices">
      <button class="choice" data-a="spare"><span class="k">1</span>Oszczędź miasto <span class="muted">(relacja +15, honor +2)</span></button>
      <button class="choice" data-a="loot"><span class="k">2</span>Złup skarbiec i domy <span class="muted">(+${loot} denarów, dobrobyt −25, relacja −20, honor −2)</span></button>
      <button class="choice" data-a="burn"><span class="k">3</span>Spal, ku przestrodze <span class="muted">(+${Math.round(loot / 3)} denarów, dobrobyt w gruzach, relacja −50, honor −5, postrach)</span></button>
    </div></div>`, {
    spare: () => { s.relation += 15; P.honor += 2; chron(w, `${P.name} oszczędza mieszkańców ${s.name}.`, PAL.gold); done("Mieszkańcy odetchnęli. Zapamiętają to."); },
    loot: () => { P.gold += loot; s.prosperity = Math.max(5, s.prosperity - 25); s.relation -= 20; P.honor -= 2; P.morale = Math.min(100, P.morale + 10); chron(w, `${P.name} łupi ${s.name}.`, PAL.redL); done(`Łupy: ${loot} denarów. Ludzie są zadowoleni.`); },
    burn: () => { P.gold += Math.round(loot / 3); s.prosperity = 5; s.relation -= 50; P.honor -= 5; P.renown += 15; chron(w, `${P.name} pali ${s.name}. Łuna widoczna z daleka.`, PAL.redL); done("Miasto płonie. Wieść o tym rozejdzie się szybko."); },
  }, "dialog-scr");
}
function siegeWon(s: Settlement, lines: string[]) {
  const w = WORLD, P = w.player, p = playerParty(w);
  s.siegeBy = []; s.siegeDays = 0; p.siege = undefined;
  s.garrison = [];
  if (P.status === "wasal" && P.liege > 0) { captureSettlement(w, s, P.liege, -2); lines.push(`${s.name} jest twoim lennem z nadania władcy.`); }
  else if (P.status === "najemnik" && P.liege > 0) { const L = w.lords.find((l) => l.faction === P.liege && l.alive); captureSettlement(w, s, P.liege, L ? L.id : -1); P.gold += 800; lines.push(`Zdobywasz ${s.name} dla frakcji ${factionName(P.liege)}. Premia: 800 denarów.`); }
  else {
    if (!w.factions[PLAYER_FACTION]) {
      w.factions[PLAYER_FACTION] = { id: PLAYER_FACTION, war: {}, warDays: {}, truce: {}, relation: {}, gold: 0, alive: true, name: P.kingdom };
      for (const f of P.wars) w.factions[PLAYER_FACTION].war[f] = true;
      for (const f of [1, 2, 3, 4, 5]) { w.factions[PLAYER_FACTION].relation[f] = -10; w.factions[f].relation[PLAYER_FACTION] = -10; }
      w.factions[PLAYER_FACTION].war[5] = true; w.factions[5].war[PLAYER_FACTION] = true;
      for (const f of P.wars) w.factions[f].war[PLAYER_FACTION] = true;
      P.status = "król"; P.liege = 0;
      lines.push(`Powstaje ${P.kingdom}! Jesteś władcą.`);
      chron(w, `${P.name} ogłasza się władcą. Powstaje ${P.kingdom}.`, PAL.gold);
    }
    captureSettlement(w, s, PLAYER_FACTION, -2);
  }
  // twoi ludzie obsadzają mury
  const keep = Math.min(healthyCount(p.troops), 10);
  let moved = 0;
  for (const t of p.troops.slice()) { const n = Math.min(t.n - t.wounded, keep - moved); if (n > 0) { addTroops(s.garrison, t.type, n); removeTroops(p.troops, t.type, n); moved += n; } }
  if (moved) lines.push(`${moved} ludzi zostaje w załodze.`);
  P.renown += 40;
}

// ---------- Spotkania ----------
function partyLeaderLook(p: Party): Look {
  if (p.lord !== undefined) return lordById(WORLD, p.lord).look;
  const best = p.troops.slice().sort((a, b) => UNITS[b.type].tier - UNITS[a.type].tier)[0];
  const def = UNITS[best?.type || "b_bandit"];
  return troopLook(def, p.id, p.faction);
}
function partyDesc(p: Party) {
  const n = troopCount(p.troops), wd = p.troops.reduce((s, t) => s + t.wounded, 0);
  const comp = p.troops.slice().sort((a, b) => b.n - a.n).slice(0, 4).map((t) => `${t.n}× ${UNITS[t.type].name}`).join(", ");
  return `${n} ludzi${wd ? ` (${wd} rannych)` : ""}: ${comp}${p.troops.length > 4 ? "…" : ""}`;
}
function strengthWord(ratio: number) { return ratio > 2 ? "przytłaczająca przewaga twoja" : ratio > 1.2 ? "masz przewagę" : ratio > 0.8 ? "siły wyrównane" : ratio > 0.5 ? "wróg silniejszy" : "wróg dużo silniejszy"; }

function fleeAttempt(o: Party) {
  const w = WORLD, p = playerParty(w);
  const mine = partySpeed(w, p) * (1 + w.player.skills.tactics * 0.05), theirs = partySpeed(w, o);
  if (mine * rr(0.85, 1.25) * (1 + perk(w.player, "flee")) > theirs) { o.wait = 2; o.state = "idle"; o.path = []; G.encounterCooldown = 3; closeScreen(); toast("Udało się zgubić pościg.", PAL.moss); return true; }
  return false;
}
// Porzuć towary na drodze: zbóje rzucają się na łupy, a wy uciekacie.
function dropGoods(o: Party) {
  const w = WORLD, P = w.player;
  let n = 0; for (const k of Object.keys(P.goods)) { if (FOOD_KEYS.includes(k)) continue; n += P.goods[k] || 0; P.goods[k] = 0; }
  const g = Math.round(P.gold * 0.1); P.gold -= g; o.gold += g;
  o.wait = 4; o.state = "idle"; o.path = []; G.encounterCooldown = 4; closeScreen();
  toast(`Porzucasz ${n} worków towaru i ${g} denarów. Pościg rzuca się na łupy.`, PAL.ash);
}
function rearguard(o: Party) {
  const w = WORLD, p = playerParty(w);
  const n = Math.max(1, Math.ceil(troopCount(p.troops) * 0.2));
  const sorted = p.troops.slice().sort((a, b) => UNITS[a.type].tier - UNITS[b.type].tier);
  let left = n;
  for (const t of sorted) { const k = Math.min(left, t.n); removeTroops(p.troops, t.type, k); left -= k; if (left <= 0) break; }
  o.wait = 3; o.state = "idle"; o.path = [];
  G.encounterCooldown = 4;
  closeScreen();
  toast(`Straż tylna (${n} ludzi) zostaje, by kupić wam czas.`, PAL.redL);
  w.player.morale -= 8;
}

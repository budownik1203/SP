// Dane gry (Build B4): broń, frakcje, jednostki z drzewkami awansów, wygląd, przedmioty bohatera, umiejętności.

type Dir = "L" | "R" | "O" | "T";            // z lewej, z prawej, z góry, pchnięcie
type DmgType = "cut" | "pierce" | "blunt";
const DIR_NAME: Record<Dir, string> = { L: "z lewej", R: "z prawej", O: "z góry", T: "pchnięcie" };

interface Weapon {
  name: string;
  reach: number; len: number;
  dmg: Record<Dir, number>;
  type: Record<Dir, DmgType>;
  windup: number; strike: number; recover: number;
  blade: string; hilt: string;
  head?: string;            // obuch (buława, młot)
  axe?: boolean;            // topór: ostrze z boku
  claws?: boolean;          // pazury lub kły, bez broni
  staff?: boolean;          // kostur
  twoHanded?: boolean;
}
const cut4 = (l: number, o: number, t: number) => ({ L: l, R: l, O: o, T: t });
const TCUT: Record<Dir, DmgType> = { L: "cut", R: "cut", O: "cut", T: "pierce" };
const TBLUNT: Record<Dir, DmgType> = { L: "blunt", R: "blunt", O: "blunt", T: "blunt" };
const TPIERCE: Record<Dir, DmgType> = { L: "cut", R: "cut", O: "pierce", T: "pierce" };

const WEAPONS: Record<string, Weapon> = {
  sword: { name: "Miecz", reach: 21, len: 10, dmg: cut4(31, 42, 29), type: TCUT, windup: 0.42, strike: 0.17, recover: 0.4, blade: PAL.steelL, hilt: PAL.gold },
  longsword: { name: "Miecz długi", reach: 24, len: 13, dmg: cut4(36, 48, 33), type: TCUT, windup: 0.5, strike: 0.19, recover: 0.46, blade: PAL.steelL, hilt: PAL.goldD, twoHanded: true },
  mace: { name: "Buława", reach: 18, len: 8, dmg: cut4(29, 40, 16), type: TBLUNT, windup: 0.48, strike: 0.19, recover: 0.46, blade: PAL.wood, hilt: PAL.steelD, head: PAL.steel },
  armsword: { name: "Miecz", reach: 20, len: 9, dmg: cut4(25, 32, 23), type: TCUT, windup: 0.52, strike: 0.18, recover: 0.5, blade: PAL.steel, hilt: PAL.woodD },
  spear: { name: "Włócznia", reach: 27, len: 15, dmg: { L: 18, R: 18, O: 22, T: 30 }, type: { L: "blunt", R: "blunt", O: "pierce", T: "pierce" }, windup: 0.5, strike: 0.17, recover: 0.48, blade: PAL.wood, hilt: PAL.woodD, twoHanded: true },
  axe: { name: "Topór", reach: 19, len: 9, dmg: cut4(30, 38, 14), type: { L: "cut", R: "cut", O: "cut", T: "blunt" }, windup: 0.5, strike: 0.19, recover: 0.5, blade: PAL.wood, hilt: PAL.woodD, axe: true },
  greataxe: { name: "Wielki topór", reach: 24, len: 13, dmg: cut4(40, 52, 18), type: { L: "cut", R: "cut", O: "cut", T: "blunt" }, windup: 0.66, strike: 0.21, recover: 0.62, blade: PAL.woodD, hilt: PAL.woodD, axe: true, twoHanded: true },
  warhammer: { name: "Młot bojowy", reach: 20, len: 10, dmg: cut4(30, 44, 18), type: TBLUNT, windup: 0.56, strike: 0.2, recover: 0.52, blade: PAL.woodD, hilt: PAL.steelD, head: PAL.steelL },
  cavsword: { name: "Miecz jeździecki", reach: 24, len: 11, dmg: cut4(24, 30, 22), type: TCUT, windup: 0.48, strike: 0.16, recover: 0.58, blade: PAL.steel, hilt: PAL.goldD },
  dagger: { name: "Nóż", reach: 15, len: 5, dmg: cut4(14, 17, 16), type: TPIERCE, windup: 0.4, strike: 0.13, recover: 0.36, blade: PAL.steel, hilt: PAL.woodD },
  club: { name: "Pałka", reach: 17, len: 8, dmg: cut4(18, 24, 10), type: TBLUNT, windup: 0.46, strike: 0.18, recover: 0.44, blade: PAL.wood, hilt: PAL.woodD, head: PAL.woodD },
  rusty: { name: "Zardzewiały miecz", reach: 19, len: 9, dmg: cut4(27, 32, 23), type: TCUT, windup: 0.56, strike: 0.19, recover: 0.55, blade: PAL.ash, hilt: PAL.dirtD },
  bonedagger: { name: "Kościany nóż", reach: 15, len: 5, dmg: cut4(13, 16, 15), type: TPIERCE, windup: 0.45, strike: 0.15, recover: 0.42, blade: PAL.boneHi, hilt: PAL.dusk },
  great: { name: "Miecz Zguby", reach: 27, len: 15, dmg: cut4(42, 55, 36), type: TCUT, windup: 0.78, strike: 0.22, recover: 0.7, blade: PAL.slate, hilt: PAL.purpleL, twoHanded: true },
  claws: { name: "Pazury", reach: 15, len: 0, dmg: cut4(22, 26, 20), type: TCUT, windup: 0.36, strike: 0.13, recover: 0.38, blade: PAL.bone, hilt: PAL.bone, claws: true },
  fangs: { name: "Kły", reach: 14, len: 0, dmg: cut4(16, 18, 18), type: TPIERCE, windup: 0.32, strike: 0.12, recover: 0.4, blade: PAL.bone, hilt: PAL.bone, claws: true },
  staff: { name: "Kostur", reach: 20, len: 12, dmg: cut4(14, 20, 12), type: TBLUNT, windup: 0.5, strike: 0.18, recover: 0.5, blade: PAL.woodD, hilt: PAL.wood, staff: true, twoHanded: true },
};

interface Mount { hp: number; speed: number; accel: number; turn: number; undead?: boolean; }
// Kopia: długa, słaba w zwarciu; opuszczona w galopie zadaje ogromne obrażenia.
WEAPONS.lance = { name: "Kopia", reach: 30, len: 20, dmg: { L: 14, R: 14, O: 16, T: 34 }, type: { L: "blunt", R: "blunt", O: "pierce", T: "pierce" }, windup: 0.6, strike: 0.2, recover: 0.55, blade: PAL.wood, hilt: PAL.woodD, twoHanded: false };
// B8: wolniejsze, cięższe tempo walki (zamach, cios i powrót)
for (const k in WEAPONS) { const w = WEAPONS[k]; w.windup *= 1.22; w.strike *= 1.12; w.recover *= 1.25; }
const HORSE: Mount = { hp: 105, speed: 112, accel: 60, turn: 2.6 };
const WARHORSE: Mount = { hp: 150, speed: 106, accel: 55, turn: 2.4 };
const BONEHORSE: Mount = { hp: 95, speed: 110, accel: 62, turn: 2.6, undead: true };

// ---------- Frakcje ----------
type Culture = "aurelia" | "varus" | "dwarf" | "orc" | "undead" | "bandit" | "monster" | "merc";
interface Faction {
  id: number; name: string; short: string; culture: Culture; race: Race;
  col: string; shade: string; trim: string; pattern: Pattern;
  ruler: string; gov: string;
}
const FACTIONS: Record<number, Faction> = {
  1: { id: 1, name: "Korona Aureliańska", short: "Aurelia", culture: "aurelia", race: "human", col: PAL.red, shade: PAL.bloodD, trim: PAL.gold, pattern: "stripe", ruler: "Królowa Ilvena Aurelia", gov: "Monarchia" },
  2: { id: 2, name: "Legion Varusa", short: "Legion", culture: "varus", race: "human", col: PAL.steelD, shade: PAL.ink, trim: PAL.bone, pattern: "cross", ruler: "Uzurpator Kassian Varus", gov: "Dyktatura wojskowa" },
  3: { id: 3, name: "Twierdze Khazgrim", short: "Khazgrim", culture: "dwarf", race: "dwarf", col: PAL.goldD, shade: PAL.dirtD, trim: PAL.gold, pattern: "chevron", ruler: "Król Durgan Kamienna Brew", gov: "Rada klanów" },
  4: { id: 4, name: "Horda Ghrakka", short: "Horda", culture: "orc", race: "orc", col: PAL.moss, shade: PAL.grassD, trim: PAL.bloodL, pattern: "quarter", ruler: "Wódz Ghrakk Krwawy Kieł", gov: "Prawo siły" },
  5: { id: 5, name: "Martwe Królestwo Morvath", short: "Morvath", culture: "undead", race: "skel", col: PAL.purple, shade: PAL.dusk, trim: PAL.purpleL, pattern: "plain", ruler: "Upiorny Król Morvath", gov: "Nekrokracja" },
  6: { id: 6, name: "Bandyci", short: "Bandyci", culture: "bandit", race: "human", col: PAL.dirt, shade: PAL.dirtD, trim: PAL.dirtL, pattern: "plain", ruler: "", gov: "" },
  7: { id: 7, name: "Bestie", short: "Bestie", culture: "monster", race: "wolf", col: PAL.ash, shade: PAL.stone, trim: PAL.bone, pattern: "plain", ruler: "", gov: "" },
  9: { id: 9, name: "Twoje królestwo", short: "Ty", culture: "merc", race: "human", col: PAL.goldD, shade: PAL.ink, trim: PAL.gold, pattern: "chevron", ruler: "", gov: "Monarchia" },
};
const PLAYER_FACTION = 9;   // królestwo gracza, tworzone w trakcie gry

// ---------- Jednostki ----------
interface LookKit {
  race: Race; helms: Helm[]; bodies: BodyMat[]; tabard: boolean; patterns?: Pattern[];
  cape?: boolean; quiver?: boolean; scabbard?: boolean; hood?: [string, string][];
  tall?: boolean; skins?: [string, string][]; beard?: number[];
}
interface UnitDef {
  key: string;
  name: string;
  culture: Culture;
  tier: number;
  hp: number;
  speed: number;
  armor: Record<DmgType, number>;
  weapon: string;
  shield: boolean;
  shieldBlock: number;
  guard: number;
  react: number;
  bow?: { dmg: number; range: number; reload: number; spread: number; bolt?: boolean; axe?: boolean };
  undead?: boolean;
  poise?: boolean;
  radius: number;
  mount?: Mount;
  look: LookKit;
  up?: string[];          // awanse
  xp?: number;            // doświadczenie do awansu
  cost: number;           // rekrutacja
  wage: number;           // żołd dzienny
  ability?: string;       // umiejętność jednostki
  body?: BodyKind;
}
type BodyKind = string;

const ARM = (c: number, p: number, b: number) => ({ cut: c, pierce: p, blunt: b });
const H_SKIN: [string, string][] = [[PAL.skin, PAL.skinD], [PAL.skin, PAL.skinD], [PAL.skinD, PAL.dirt]];
const O_SKIN: [string, string][] = [[PAL.moss, PAL.grassD], [PAL.grassL, PAL.grass], [PAL.stone, PAL.slate]];

const UNITS: Record<string, UnitDef> = {};
function U(d: Partial<UnitDef> & { key: string; name: string }) {
  const base: UnitDef = { key: d.key, name: d.name, culture: "merc", tier: 1, hp: 90, speed: 44, armor: ARM(0.8, 0.85, 0.9), weapon: "armsword", shield: false, shieldBlock: 0, guard: 0.25, react: 0.38, radius: 6, look: { race: "human", helms: ["none"], bodies: ["gambeson"], tabard: false }, cost: 30, wage: 1 };
  UNITS[d.key] = Object.assign(base, d);
}
// bohater (wartości bazowe; ekwipunek je zmienia)
U({ key: "hero", name: "Ty", hp: 170, speed: 52, armor: ARM(0.55, 0.7, 0.85), weapon: "sword", shield: true, guard: 0, react: 0, look: { race: "human", helms: ["crest"], bodies: ["mail"], tabard: true }, cost: 0, wage: 0 });
U({ key: "companion", name: "Towarzysz", hp: 140, speed: 50, armor: ARM(0.6, 0.72, 0.85), weapon: "sword", shield: true, shieldBlock: 0.5, guard: 0.5, react: 0.28, look: { race: "human", helms: ["nasal"], bodies: ["mail"], tabard: true }, cost: 0, wage: 0 });

// ---------- Drzewka jednostek (jak w Mount & Blade): T1–T2 bez rozgałęzień, potem gałęzie aż do T5 ----------
// Wygląd i siła rosną z poziomem: łachmany i pałki na dole, kolczuga w środku, płyta dopiero na szczycie.
type URole = "levy" | "inf" | "shield" | "two" | "spear" | "archer" | "xbow" | "cav" | "thrower";
const GEAR: Record<string, { helms: Helm[][]; bodies: BodyMat[][] }> = {
  human: { helms: [["none", "cap", "hood"], ["cap", "kettle", "coif"], ["kettle", "nasal", "coif"], ["nasal", "great"], ["great", "crest"]], bodies: [["rags", "rags", "gambeson"], ["gambeson", "leather"], ["mail"], ["mail"], ["plate"]] },
  dwarf: { helms: [["none", "cap"], ["cap", "dwarf"], ["dwarf"], ["dwarf", "great"], ["dwarf"]], bodies: [["leather", "rags"], ["leather", "gambeson"], ["mail"], ["mail", "plate"], ["plate"]] },
  orc: { helms: [["none"], ["none", "orc"], ["orc", "none"], ["orc"], ["orc"]], bodies: [["rags"], ["rags", "leather"], ["leather"], ["leather", "mail"], ["mail", "plate"]] },
  skel: { helms: [["none"], ["none", "rustcap"], ["rustcap", "kettle"], ["kettle", "nasal"], ["great", "crest"]], bodies: [["bones"], ["rags", "bones"], ["mail"], ["mail"], ["plate"]] },
};
const TIER_COST = [20, 45, 90, 160, 260], TIER_WAGE = [1, 2, 3, 5, 8], TIER_XP = [60, 140, 240, 380, 0];
const ROLE_WEAPON: Record<URole, string[][]> = {
  levy: [["club", "spear", "dagger"], ["spear", "club"], ["spear"], ["spear"], ["spear"]],
  inf: [["club"], ["axe", "club"], ["armsword", "axe"], ["sword", "mace"], ["sword", "mace"]],
  shield: [["club"], ["axe"], ["armsword", "axe"], ["sword", "axe"], ["sword", "warhammer"]],
  two: [["club"], ["axe"], ["greataxe"], ["greataxe", "longsword"], ["longsword", "greataxe", "warhammer"]],
  spear: [["spear"], ["spear"], ["spear"], ["spear"], ["spear"]],
  archer: [["dagger"], ["dagger"], ["dagger", "axe"], ["armsword"], ["armsword", "sword"]],
  xbow: [["dagger"], ["dagger"], ["dagger", "axe"], ["armsword", "axe"], ["armsword", "warhammer"]],
  cav: [["club"], ["cavsword"], ["cavsword"], ["cavsword", "mace"], ["mace", "cavsword"]],
  thrower: [["club"], ["axe"], ["axe"], ["axe"], ["axe"]],
};
function TU(culture: Culture, race: Race, key: string, name: string, tier: number, role: URole, up?: string[], extra: Partial<UnitDef> = {}, kit: Partial<LookKit> = {}) {
  const t = tier - 1, g = GEAR[race] || GEAR.human;
  const ranged = role === "archer" || role === "xbow" || role === "thrower";
  const bodyTier = ranged ? Math.max(0, t - 1) : t;
  const wl = ROLE_WEAPON[role][t];
  const weapon = wl[hashInt(key.length * 7 + key.charCodeAt(2)) % wl.length];
  const undead = race === "skel";
  const tough = race === "dwarf" || race === "orc" ? 12 : undead ? -6 : 0;
  const ac = [0.93, 0.84, 0.72, 0.62, 0.5][bodyTier] - (race === "dwarf" ? 0.04 : 0);
  const armor = undead ? ARM(ac, ac * 0.55, 1.35 - t * 0.06) : ARM(ac, Math.min(0.96, ac + 0.1), Math.min(0.97, ac + 0.16));
  const shield = role === "shield" || role === "spear" && tier >= 2 || role === "cav" && tier <= 4 || role === "levy" && tier === 2;
  const d: Partial<UnitDef> & { key: string; name: string } = {
    key, name, culture, tier, hp: 70 + tier * 13 + tough, speed: race === "dwarf" ? 37 : race === "skel" ? 40 : role === "archer" || race === "orc" ? 46 : 44,
    armor, weapon, shield, shieldBlock: shield ? 0.28 + t * 0.07 : 0, guard: 0.14 + t * 0.08, react: 0.44 - t * 0.035, undead,
    poise: tier >= 5 && (role === "two" || role === "shield") || race === "dwarf" && tier >= 4,
    up, xp: TIER_XP[t], cost: undead ? Math.round(TIER_COST[t] * 0.6) : TIER_COST[t], wage: undead ? 0 : TIER_WAGE[t],
    look: { race, helms: ranged && t <= 2 ? ["hood", ...g.helms[t]] as Helm[] : g.helms[t], bodies: g.bodies[bodyTier], tabard: race !== "orc" && tier >= 2 && !(undead && tier < 4), cape: tier >= 5 || role === "cav" && tier >= 4, quiver: ranged && role !== "thrower", scabbard: tier >= 3 && !ranged, tall: tier >= 5 && race !== "dwarf", hood: race === "skel" ? [[PAL.dusk, PAL.ink], [PAL.purple, PAL.dusk]] : [[PAL.dirt, PAL.dirtD], [PAL.moss, PAL.grassD]], skins: race === "orc" ? O_SKIN : undefined, ...kit },
  };
  if (role === "archer") d.bow = { dmg: 18 + tier * 6, range: 190 + tier * 18, reload: 2.4 - tier * 0.07, spread: 0.1 - tier * 0.013 };
  if (role === "xbow") d.bow = { dmg: 26 + tier * 8, range: 190 + tier * 12, reload: 3.6, spread: 0.06 - tier * 0.007, bolt: true };
  if (role === "thrower") d.bow = { dmg: 22 + tier * 5, range: 110 + tier * 8, reload: 2.4, spread: 0.08, axe: true };
  if (role === "cav") { d.mount = undead ? BONEHORSE : tier >= 5 ? WARHORSE : HORSE; d.radius = 8; d.speed = 44; }
  U({ ...d, ...extra });
}

// Korona Aureliańska
TU("aurelia", "human", "a_recruit", "Rekrut", 1, "levy", ["a_militia"]);
TU("aurelia", "human", "a_militia", "Milicjant", 2, "levy", ["a_maa", "a_archer", "a_squire"]);
TU("aurelia", "human", "a_maa", "Zbrojny", 3, "shield", ["a_sergeant", "a_halberd"]);
TU("aurelia", "human", "a_sergeant", "Sierżant Korony", 4, "shield", ["a_guard"]);
TU("aurelia", "human", "a_guard", "Gwardzista Korony", 5, "shield");
TU("aurelia", "human", "a_halberd", "Pikinier", 4, "spear", ["a_champion"]);
TU("aurelia", "human", "a_champion", "Czempion Korony", 5, "two");
TU("aurelia", "human", "a_archer", "Łucznik", 3, "archer", ["a_longbow"]);
TU("aurelia", "human", "a_longbow", "Długi łucznik", 4, "archer", ["a_warbow"]);
TU("aurelia", "human", "a_warbow", "Łucznik Królewski", 5, "archer");
TU("aurelia", "human", "a_squire", "Giermek konny", 3, "cav", ["a_knight"]);
TU("aurelia", "human", "a_knight", "Rycerz", 4, "cav", ["a_paladin"], { weapon: "lance" });
TU("aurelia", "human", "a_paladin", "Rycerz Zakonny", 5, "cav");
U({ key: "a_priest", name: "Kapłan bojowy", culture: "aurelia", tier: 3, hp: 95, speed: 42, armor: ARM(0.75, 0.85, 0.85), weapon: "mace", shield: false, guard: 0.3, look: { race: "human", helms: ["mitre"], bodies: ["robe"], tabard: false, hood: [[PAL.bone, PAL.ash]] }, cost: 150, wage: 4, ability: "priest" });

// Legion Varusa
TU("varus", "human", "v_levy", "Poborowy", 1, "levy", ["v_conscript"]);
TU("varus", "human", "v_conscript", "Rekrut Legionu", 2, "spear", ["v_legion", "v_xbow", "v_rider"]);
TU("varus", "human", "v_legion", "Legionista", 3, "shield", ["v_veteran"]);
TU("varus", "human", "v_veteran", "Weteran Legionu", 4, "shield", ["v_praetor", "v_executor"]);
TU("varus", "human", "v_praetor", "Pretorianin", 5, "shield");
TU("varus", "human", "v_executor", "Kat Legionu", 5, "two");
TU("varus", "human", "v_xbow", "Kusznik", 3, "xbow", ["v_hxbow"]);
TU("varus", "human", "v_hxbow", "Ciężki kusznik", 4, "xbow", ["v_arbalest"]);
TU("varus", "human", "v_arbalest", "Arbaleciarz", 5, "xbow");
TU("varus", "human", "v_rider", "Jeździec Legionu", 3, "cav", ["v_cata"]);
TU("varus", "human", "v_cata", "Katafrakt", 4, "cav", ["v_clib"], { weapon: "lance" });
TU("varus", "human", "v_clib", "Klibanariusz", 5, "cav");
U({ key: "v_mage", name: "Mag ognia", culture: "varus", tier: 3, hp: 75, speed: 42, armor: ARM(0.9, 0.9, 0.95), weapon: "staff", look: { race: "human", helms: ["hood"], bodies: ["robe"], tabard: false, hood: [[PAL.redL, PAL.red]] }, cost: 170, wage: 5, ability: "mage" });

// Twierdze Khazgrim
TU("dwarf", "dwarf", "d_young", "Brodaty rekrut", 1, "levy", ["d_miner"]);
TU("dwarf", "dwarf", "d_miner", "Górnik", 2, "shield", ["d_shield", "d_axe", "d_xbow"]);
TU("dwarf", "dwarf", "d_shield", "Tarczownik", 3, "shield", ["d_ironguard"]);
TU("dwarf", "dwarf", "d_ironguard", "Żelazna Straż", 4, "shield", ["d_warden"]);
TU("dwarf", "dwarf", "d_warden", "Strażnik Głębi", 5, "shield");
TU("dwarf", "dwarf", "d_axe", "Topornik", 3, "two", ["d_longbeard"]);
TU("dwarf", "dwarf", "d_longbeard", "Długobrody", 4, "two", ["d_slayer"]);
TU("dwarf", "dwarf", "d_slayer", "Zabójca Olbrzymów", 5, "two", undefined, {}, { helms: ["none"], bodies: ["leather"] });
TU("dwarf", "dwarf", "d_xbow", "Kusznik krasnoludzki", 3, "xbow", ["d_rune"]);
TU("dwarf", "dwarf", "d_rune", "Strzelec runiczny", 4, "xbow", ["d_thunder"]);
TU("dwarf", "dwarf", "d_thunder", "Gromowładny", 5, "xbow");
U({ key: "d_runepriest", name: "Kapłan run", culture: "dwarf", tier: 3, hp: 115, speed: 36, armor: ARM(0.6, 0.7, 0.8), weapon: "warhammer", guard: 0.3, look: { race: "dwarf", helms: ["dwarf"], bodies: ["robe"], tabard: false, hood: [[PAL.goldD, PAL.dirtD]] }, cost: 160, wage: 4, ability: "priest" });

// Horda Ghrakka
TU("orc", "orc", "o_young", "Młody ork", 1, "levy", ["o_grunt"]);
TU("orc", "orc", "o_grunt", "Siepacz", 2, "inf", ["o_warrior", "o_thrower", "o_rider"]);
TU("orc", "orc", "o_warrior", "Wojownik orków", 3, "shield", ["o_blackfang"]);
TU("orc", "orc", "o_blackfang", "Czarny Kieł", 4, "two", ["o_berserk", "o_ironhide"]);
TU("orc", "orc", "o_berserk", "Krwawy berserker", 5, "two", undefined, { speed: 52 }, { helms: ["none"], bodies: ["rags"] });
TU("orc", "orc", "o_ironhide", "Żelazna Skóra", 5, "shield");
TU("orc", "orc", "o_thrower", "Miotacz toporów", 3, "thrower", ["o_hunter"]);
TU("orc", "orc", "o_hunter", "Łowca czaszek", 4, "archer", ["o_bowchief"]);
TU("orc", "orc", "o_bowchief", "Wódz łowców", 5, "archer");
TU("orc", "orc", "o_rider", "Jeździec Hordy", 3, "cav", ["o_raider"]);
TU("orc", "orc", "o_raider", "Łupieżca", 4, "cav", ["o_warrider"]);
TU("orc", "orc", "o_warrider", "Pancerny jeździec Hordy", 5, "cav");
U({ key: "o_shaman", name: "Szaman krwi", culture: "orc", tier: 3, hp: 105, speed: 44, armor: ARM(0.85, 0.9, 0.9), weapon: "staff", look: { race: "orc", helms: ["none"], bodies: ["robe"], tabard: false, skins: O_SKIN, hood: [[PAL.bloodD, PAL.black]] }, cost: 150, wage: 4, ability: "shaman" });

// Martwe Królestwo: od gołych kości do upiorów w zardzewiałej płycie
TU("undead", "skel", "u_skel", "Szkielet", 1, "levy", ["u_risen"], { weapon: "rusty" });
TU("undead", "skel", "u_risen", "Powstały", 2, "shield", ["u_warrior", "u_archer", "u_rider"], { weapon: "rusty" });
TU("undead", "skel", "u_warrior", "Szkielet wojownik", 3, "shield", ["u_legion"], { weapon: "rusty" });
TU("undead", "skel", "u_legion", "Kościany legionista", 4, "shield", ["u_wight", "u_reaper"]);
TU("undead", "skel", "u_wight", "Upiorny strażnik", 5, "shield", undefined, { react: 0.28 });
TU("undead", "skel", "u_reaper", "Żniwiarz", 5, "two");
TU("undead", "skel", "u_archer", "Szkielet łucznik", 3, "archer", ["u_marksman"], { weapon: "bonedagger" });
TU("undead", "skel", "u_marksman", "Kościany strzelec", 4, "archer", ["u_spectral"]);
TU("undead", "skel", "u_spectral", "Widmowy łucznik", 5, "archer");
TU("undead", "skel", "u_rider", "Upiorny jeździec", 3, "cav", ["u_blackrider"], { weapon: "rusty" });
TU("undead", "skel", "u_blackrider", "Czarny jeździec", 4, "cav", ["u_doomrider"], { weapon: "lance" });
TU("undead", "skel", "u_doomrider", "Jeździec Zguby", 5, "cav");
U({ key: "u_ghoul", name: "Ghul", culture: "undead", tier: 2, hp: 95, speed: 60, armor: ARM(1, 0.9, 0.9), weapon: "claws", guard: 0.1, react: 0.4, undead: true, look: { race: "ghoul", helms: ["none"], bodies: ["rags"], tabard: false, skins: [[PAL.ash, PAL.stone], [PAL.moss, PAL.grassD], [PAL.stone, PAL.slate]] }, cost: 30, wage: 0 });
U({ key: "u_necro", name: "Nekromanta", culture: "undead", tier: 3, hp: 80, speed: 42, armor: ARM(0.9, 0.9, 0.95), weapon: "staff", undead: false, look: { race: "human", helms: ["hood"], bodies: ["robe"], tabard: false, hood: [[PAL.purple, PAL.dusk]], skins: [[PAL.bone, PAL.ash]] }, cost: 160, wage: 5, ability: "necro" });
U({ key: "u_dk", name: "Rycerz Śmierci", culture: "undead", tier: 5, hp: 480, speed: 42, armor: ARM(0.45, 0.55, 0.8), weapon: "great", guard: 0.6, react: 0.24, undead: true, poise: true, radius: 8, look: { race: "dk", helms: ["none"], bodies: ["plate"], tabard: false }, cost: 0, wage: 0, ability: "deathtouch" });

// Bandyci, najemnicy, bestie
U({ key: "b_bandit", name: "Bandyta", culture: "bandit", tier: 1, hp: 75, speed: 46, armor: ARM(0.9, 0.9, 0.95), weapon: "club", look: { race: "human", helms: ["none", "cap", "hood"], bodies: ["rags", "leather"], tabard: false, hood: [[PAL.dirt, PAL.dirtD], [PAL.ink, PAL.black]] }, cost: 20, wage: 1 });
U({ key: "b_archer", name: "Łucznik bandytów", culture: "bandit", tier: 1, hp: 65, speed: 46, armor: ARM(0.9, 0.9, 0.95), weapon: "dagger", bow: { dmg: 24, range: 210, reload: 2.4, spread: 0.09 }, look: { race: "human", helms: ["hood"], bodies: ["leather"], tabard: false, quiver: true, hood: [[PAL.dirtD, PAL.black]] }, cost: 25, wage: 1 });
U({ key: "b_chief", name: "Herszt", culture: "bandit", tier: 2, hp: 120, speed: 46, armor: ARM(0.7, 0.8, 0.9), weapon: "axe", shield: true, shieldBlock: 0.35, guard: 0.35, look: { race: "human", helms: ["kettle", "none"], bodies: ["mail"], tabard: false }, cost: 60, wage: 2 });
U({ key: "m_sword", name: "Najemny miecznik", culture: "merc", tier: 2, hp: 100, armor: ARM(0.62, 0.78, 0.88), weapon: "armsword", shield: true, shieldBlock: 0.45, guard: 0.32, look: { race: "human", helms: ["nasal", "kettle"], bodies: ["mail"], tabard: true, patterns: ["quarter"], scabbard: true }, cost: 90, wage: 3 });
U({ key: "m_xbow", name: "Najemny kusznik", culture: "merc", tier: 2, hp: 80, armor: ARM(0.72, 0.82, 0.9), weapon: "dagger", bow: { dmg: 44, range: 220, reload: 3.4, spread: 0.035, bolt: true }, look: { race: "human", helms: ["kettle"], bodies: ["gambeson"], tabard: true, patterns: ["quarter"], quiver: true }, cost: 85, wage: 3 });
U({ key: "x_wolf", name: "Wilk", culture: "monster", tier: 1, hp: 60, speed: 70, armor: ARM(1, 1, 1), weapon: "fangs", guard: 0, react: 0.5, look: { race: "wolf", helms: ["none"], bodies: ["rags"], tabard: false, skins: [[PAL.stone, PAL.slate], [PAL.dirt, PAL.dirtD], [PAL.ash, PAL.stone]] }, cost: 0, wage: 0 });
U({ key: "x_dummy", name: "Tarcza strzelecka", culture: "monster", tier: 1, hp: 1, speed: 0, armor: ARM(1, 1, 1), weapon: "club", guard: 0, react: 9, look: { race: "human", helms: ["none"], bodies: ["rags"], tabard: false }, cost: 0, wage: 0 });
U({ key: "x_direwolf", name: "Wilk olbrzym", culture: "monster", tier: 3, hp: 170, speed: 66, armor: ARM(0.85, 0.85, 0.9), weapon: "fangs", guard: 0.1, react: 0.4, poise: true, look: { race: "wolf", helms: ["none"], bodies: ["rags"], tabard: false, skins: [[PAL.dirtD, PAL.black]] }, cost: 0, wage: 0 });
U({ key: "x_spirit", name: "Duch wilka", culture: "monster", tier: 2, hp: 70, speed: 72, armor: ARM(0.8, 0.6, 0.8), weapon: "fangs", guard: 0, react: 0.5, look: { race: "wolf", helms: ["none"], bodies: ["rags"], tabard: false, skins: [[PAL.boneHi, PAL.ash]] }, cost: 0, wage: 0 });

// Rekrutacja według kultury: wioski dają tier 1, miasta i zamki więcej.
const RECRUITS: Record<Culture, { village: string[]; town: string[]; special?: string }> = {
  aurelia: { village: ["a_recruit"], town: ["a_recruit", "a_militia"], special: "a_priest" },
  varus: { village: ["v_levy"], town: ["v_levy", "v_conscript"], special: "v_mage" },
  dwarf: { village: ["d_young"], town: ["d_young", "d_miner"], special: "d_runepriest" },
  orc: { village: ["o_young"], town: ["o_young", "o_grunt"], special: "o_shaman" },
  undead: { village: ["u_skel"], town: ["u_skel", "u_risen", "u_ghoul"], special: "u_necro" },
  bandit: { village: ["b_bandit"], town: ["b_bandit", "b_archer"] },
  monster: { village: ["x_wolf"], town: ["x_wolf"] },
  merc: { village: ["m_sword"], town: ["m_sword", "m_xbow"] },
};

// Wygląd jednostki z zestawu, wariantu i frakcji.
function troopLook(def: UnitDef, variant: number, faction: number): Look {
  const k = def.look;
  const F = FACTIONS[faction] || FACTIONS[6];
  const race = k.race;
  const skins = k.skins || (race === "orc" ? O_SKIN : race === "dwarf" ? [[PAL.skin, PAL.skinD], [PAL.skinD, PAL.dirt]] as [string, string][] : H_SKIN);
  const hair = race === "orc" ? PAL.black : vpick(variant, 2, [PAL.dirtD, PAL.dirt, PAL.black, PAL.ash, PAL.woodD, PAL.rust]);
  const beard = race === "dwarf" ? 3 : race === "orc" ? 0 : vpick(variant, 3, [0, 0, 1, 1, 2]);
  return {
    race, build: vpick(variant, 4, [0, 1, 1, 1, 2]), tall: !!k.tall || vrand(variant, 5) < 0.2,
    skin: vpick(variant, 6, skins), hair, beard, scar: vrand(variant, 7) < 0.25 ? vpick(variant, 8, [1, 2]) : 0,
    helm: vpick(variant, 9, k.helms), body: vpick(variant, 10, k.bodies),
    tabard: k.tabard ? { main: F.col, shade: F.shade, trim: F.trim, pattern: k.patterns ? vpick(variant, 11, k.patterns) : F.pattern } : null,
    cape: k.cape ? [F.col, F.shade] : undefined,
    hood: k.hood ? vpick(variant, 12, k.hood) : undefined,
    pants: vpick(variant, 13, [PAL.dirt, PAL.dirtD, PAL.slate, PAL.woodD]), boots: vpick(variant, 14, [PAL.woodD, PAL.dirtD, PAL.black]),
    quiver: k.quiver, scabbard: k.scabbard,
    dirt: 0.35 + vrand(variant, 15) * 0.55, blood: vrand(variant, 16) * 0.45,
    culture: def.culture === "merc" || def.culture === "bandit" ? def.culture : F.culture || def.culture,
    rust: vrand(variant, 17) * 0.55 * (1 - (def.tier || 1) / 6), dents: Math.floor(vrand(variant, 18) * (6 - (def.tier || 1))),
    seed: variant * 17 + def.key.length,
  };
}

// ---------- Przedmioty bohatera ----------
type ESlot = "head" | "body" | "hands" | "feet" | "weapon" | "shield" | "bow" | "horse";
interface Item {
  id: string; name: string; slot: ESlot; price: number; tier: number;
  armor?: number;                 // ile odejmuje od mnożnika obrażeń (suma pancerza)
  weapon?: string;                // klucz broni
  helm?: Helm; body?: BodyMat;    // wygląd
  bowDmg?: number;
  mount?: Mount;
  culture?: Culture;
  xbow?: boolean;
}
const ITEMS: Record<string, Item> = {};
function I(d: Item) { ITEMS[d.id] = d; }
I({ id: "cap", name: "Wełniana czapka", slot: "head", price: 10, tier: 1, armor: 0.02, helm: "cap" });
I({ id: "hood", name: "Kaptur", slot: "head", price: 15, tier: 1, armor: 0.03, helm: "hood" });
I({ id: "kettle", name: "Kapalin", slot: "head", price: 120, tier: 2, armor: 0.07, helm: "kettle" });
I({ id: "nasal", name: "Hełm z nosalem", slot: "head", price: 140, tier: 2, armor: 0.08, helm: "nasal" });
I({ id: "coif", name: "Czepiec kolczy", slot: "head", price: 110, tier: 2, armor: 0.06, helm: "coif" });
I({ id: "crest", name: "Hełm z kitą", slot: "head", price: 260, tier: 3, armor: 0.1, helm: "crest" });
I({ id: "great", name: "Hełm garnczkowy", slot: "head", price: 420, tier: 3, armor: 0.13, helm: "great" });
I({ id: "dwarfhelm", name: "Rogaty hełm runiczny", slot: "head", price: 380, tier: 3, armor: 0.12, helm: "dwarf", culture: "dwarf" });
I({ id: "robe", name: "Habit", slot: "body", price: 25, tier: 1, armor: 0.04, body: "robe" });
I({ id: "rags", name: "Łachmany", slot: "body", price: 5, tier: 1, armor: 0.02, body: "rags" });
I({ id: "gambeson", name: "Przeszywanica", slot: "body", price: 80, tier: 1, armor: 0.1, body: "gambeson" });
I({ id: "leather", name: "Kaftan skórzany", slot: "body", price: 110, tier: 1, armor: 0.12, body: "leather" });
I({ id: "mail", name: "Kolczuga", slot: "body", price: 380, tier: 2, armor: 0.2, body: "mail" });
I({ id: "plate", name: "Zbroja płytowa", slot: "body", price: 1200, tier: 3, armor: 0.3, body: "plate" });
I({ id: "gloves", name: "Skórzane rękawice", slot: "hands", price: 30, tier: 1, armor: 0.02 });
I({ id: "gauntlets", name: "Rękawice płytowe", slot: "hands", price: 260, tier: 3, armor: 0.05 });
I({ id: "boots", name: "Buty skórzane", slot: "feet", price: 30, tier: 1, armor: 0.02 });
I({ id: "greaves", name: "Nagolenniki", slot: "feet", price: 240, tier: 3, armor: 0.05 });
I({ id: "w_dagger", name: "Nóż", slot: "weapon", price: 10, tier: 1, weapon: "dagger" });
I({ id: "w_staff", name: "Kostur", slot: "weapon", price: 60, tier: 1, weapon: "staff" });
I({ id: "w_club", name: "Pałka", slot: "weapon", price: 15, tier: 1, weapon: "club" });
I({ id: "w_axe", name: "Topór", slot: "weapon", price: 90, tier: 1, weapon: "axe" });
I({ id: "w_armsword", name: "Miecz zbrojnego", slot: "weapon", price: 120, tier: 1, weapon: "armsword" });
I({ id: "w_sword", name: "Dobry miecz", slot: "weapon", price: 320, tier: 2, weapon: "sword" });
I({ id: "w_mace", name: "Buława", slot: "weapon", price: 260, tier: 2, weapon: "mace" });
I({ id: "w_lance", name: "Kopia", slot: "weapon", price: 220, tier: 2, weapon: "lance" });
I({ id: "w_spear", name: "Włócznia", slot: "weapon", price: 140, tier: 2, weapon: "spear" });
I({ id: "w_hammer", name: "Młot bojowy", slot: "weapon", price: 420, tier: 3, weapon: "warhammer" });
I({ id: "w_longsword", name: "Miecz długi", slot: "weapon", price: 650, tier: 3, weapon: "longsword" });
I({ id: "w_greataxe", name: "Wielki topór", slot: "weapon", price: 520, tier: 3, weapon: "greataxe" });
I({ id: "s_buckler", name: "Puklerz", slot: "shield", price: 40, tier: 1 });
I({ id: "s_heater", name: "Tarcza trójkątna", slot: "shield", price: 140, tier: 2 });
I({ id: "b_short", name: "Łuk krótki", slot: "bow", price: 60, tier: 1, bowDmg: 38 });
I({ id: "b_long", name: "Łuk długi", slot: "bow", price: 300, tier: 3, bowDmg: 52 });
I({ id: "h_nag", name: "Szkapa", slot: "horse", price: 150, tier: 1, mount: { hp: 90, speed: 100, accel: 55, turn: 2.6 } });
I({ id: "h_courser", name: "Rumak", slot: "horse", price: 600, tier: 2, mount: { hp: 130, speed: 118, accel: 66, turn: 2.8 } });
I({ id: "h_destrier", name: "Koń bojowy", slot: "horse", price: 1400, tier: 3, mount: { hp: 180, speed: 108, accel: 58, turn: 2.4 } });
// Przedmioty unikatowe (zamówienia u mistrza kowala, ruiny, długie zadania)
WEAPONS.ashblade = { ...WEAPONS.longsword, name: "Ostrze Popiołu", dmg: cut4(46, 60, 42), blade: PAL.ash, hilt: PAL.redL };
WEAPONS.dawnmace = { ...WEAPONS.mace, name: "Buława Świtu", dmg: cut4(38, 52, 22), head: PAL.gold };
I({ id: "u_ashblade", name: "Ostrze Popiołu", slot: "weapon", price: 4200, tier: 5, weapon: "ashblade" });
I({ id: "u_dawnmace", name: "Buława Świtu", slot: "weapon", price: 3600, tier: 5, weapon: "dawnmace" });
I({ id: "u_blackplate", name: "Zbroja Czarnego Rycerza", slot: "body", price: 5200, tier: 5, armor: 0.36, body: "plate" });
I({ id: "u_legate", name: "Hełm kassiańskiego legata", slot: "head", price: 2600, tier: 5, armor: 0.15, helm: "great" });
I({ id: "u_crowbow", name: "Łuk Wrony", slot: "bow", price: 3000, tier: 5, bowDmg: 66 });
function baseItems() { return Object.values(ITEMS).filter((it) => !it.id.includes("~") && it.tier < 5); }
const UNIQUES = ["u_ashblade", "u_dawnmace", "u_blackplate", "u_legate", "u_crowbow"];
// Jakość: zardzewiały / zwykły / dobry / mistrzowski. Id z sufiksem „~q”, tworzone w locie.
const QUAL: ({ n: string; k: number; p: number } | null)[] = [{ n: "Zardzewiały", k: 0.82, p: 0.45 }, null, { n: "Dobry", k: 1.12, p: 1.7 }, { n: "Mistrzowski", k: 1.26, p: 3 }];
function qualOf(id: string) { const m = id.split("~")[1]; return m ? Number(m) : 1; }
function baseOf(id: string) { return id.split("~")[0]; }
function qid(base: string, q: number) { return q === 1 ? base : `${base}~${q}`; }
function ensureItem(id: string): Item | null {
  if (!id) return null;
  if (ITEMS[id]) return ITEMS[id];
  const b = ITEMS[baseOf(id)], Q = QUAL[qualOf(id)];
  if (!b || !Q) return b || null;
  const it: Item = { ...b, id, name: `${Q.n} ${b.name.charAt(0).toLowerCase()}${b.name.slice(1)}`, price: Math.round(b.price * Q.p) };
  if (b.armor) it.armor = +(b.armor * Q.k).toFixed(3);
  if (b.bowDmg) it.bowDmg = Math.round(b.bowDmg * Q.k);
  if (b.mount) it.mount = { ...b.mount, hp: Math.round(b.mount.hp * Q.k), speed: Math.round(b.mount.speed * (0.92 + Q.k * 0.08)) };
  ITEMS[id] = it;
  return it;
}
I({ id: "x_light", name: "Kusza lekka", slot: "bow", price: 220, tier: 2, bowDmg: 56, xbow: true });
I({ id: "x_heavy", name: "Kusza ciężka", slot: "bow", price: 640, tier: 3, bowDmg: 78, xbow: true });
// Waga i wymagania przedmiotów
function itemWeight(it: Item | null): number {
  if (!it) return 0;
  if (it.slot === "horse") return 0;
  if (it.armor != null && (it.slot === "body" || it.slot === "head" || it.slot === "hands" || it.slot === "feet")) return +(it.armor * (it.slot === "body" ? 55 : it.slot === "head" ? 40 : 30)).toFixed(1);
  if (it.weapon) return WEAPONS[it.weapon]?.twoHanded ? 5 : 3;
  if (it.slot === "shield") return it.tier >= 2 ? 5 : 3;
  if (it.slot === "bow") return it.xbow ? 5 : 2;
  return 1;
}
function itemReq(it: Item | null): number {   // wymagana siła
  if (!it) return 0;
  if (it.slot === "body" && (it.armor || 0) >= 0.2) return 4 + Math.round((it.armor - 0.2) * 25);
  if (it.weapon && WEAPONS[it.weapon]?.twoHanded && it.tier >= 2) return 5 + it.tier;
  if (it.xbow && it.tier >= 3) return 6;
  return 0;
}
const SLOT_NAME: Record<ESlot, string> = { head: "Hełm", body: "Zbroja", hands: "Rękawice", feet: "Buty", weapon: "Broń", shield: "Tarcza", bow: "Łuk", horse: "Koń" };

// ---------- Umiejętności aktywne ----------
type Res = "faith" | "mana" | "fury" | "blood";
interface Ability { id: string; name: string; res: Res; cost: number; cd: number; desc: string; corrupt?: number; source: "drzewko" | "księga" | "wiara"; }
const ABILITIES: Record<string, Ability> = {
  smite: { id: "smite", name: "Smite", res: "faith", cost: 35, cd: 18, source: "wiara", desc: "Poziom 1: następny cios płonie świętym ogniem (podwójnie przeciw nieumarłym). Poziom 2: słup światła z nieba na obszar przy kursorze." },
  warcry: { id: "warcry", name: "Okrzyk bojowy", res: "fury", cost: 30, cd: 25, source: "drzewko", desc: "Twoi w pobliżu: +morale i +15% obrażeń na 10 s. Żywi wrogowie w pobliżu tracą morale i mogą się zachwiać." },
  bash: { id: "bash", name: "Szarża tarczą", res: "fury", cost: 20, cd: 10, source: "drzewko", desc: "Rzut do przodu z tarczą: przewraca i odrzuca wrogów na drodze." },
  whirl: { id: "whirl", name: "Wir ostrza", res: "fury", cost: 40, cd: 16, source: "drzewko", desc: "Obrót z bronią: trafia wszystkich wrogów dookoła." },
  fireball: { id: "fireball", name: "Kula ognia", res: "mana", cost: 35, cd: 12, corrupt: 4, source: "księga", desc: "Pocisk ognia w stronę kursora, wybuch podpala wrogów. Grozi spaczeniem." },
  heal: { id: "heal", name: "Modlitwa leczenia", res: "faith", cost: 30, cd: 20, source: "wiara", desc: "Leczy ciebie i twoich w pobliżu." },
  curse: { id: "curse", name: "Klątwa osłabienia", res: "mana", cost: 25, cd: 14, corrupt: 3, source: "księga", desc: "Wrogowie przy kursorze zadają mniej obrażeń i zwalniają na 8 s. Grozi spaczeniem." },
  blood: { id: "blood", name: "Krwawy rytuał", res: "blood", cost: 25, cd: 30, source: "księga", desc: "Płacisz zdrowiem: +40% obrażeń, szybkość i wysysanie życia na 10 s." },
  summon: { id: "summon", name: "Przyzwanie wilczych duchów", res: "mana", cost: 50, cd: 45, corrupt: 8, source: "księga", desc: "Przyzywa trzy wilcze duchy, które walczą 25 s. Mocno grozi spaczeniem." },
  focus: { id: "focus", name: "Skupienie", res: "fury", cost: 25, cd: 30, source: "drzewko", desc: "Świat zwalnia na 4 s, a ty poruszasz się normalnie." },
};
const RES_NAME: Record<Res, string> = { faith: "Wiara", mana: "Mana", fury: "Furia", blood: "Zdrowie" };

const HERO_LOADOUTS = [
  { name: "Broń biała", bow: false },
  { name: "Łuk", bow: true },
];

type Formation = "line" | "wall" | "loose" | "wedge" | "column" | "circle";
const FORMATION_NAME: Record<Formation, string> = { line: "Linia", wall: "Mur tarcz", loose: "Luźny szyk", wedge: "Klin", column: "Kolumna", circle: "Koło" };
const FORMATIONS: Formation[] = ["line", "wall", "loose", "wedge", "column", "circle"];
const FORMATION_SPACING: Record<Formation, number> = { line: 14, wall: 11, loose: 22, wedge: 14, column: 13, circle: 13 };

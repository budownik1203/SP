// Dane jednostek i broni. Docelowo trafią do plików JSON.

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
  head?: string;                                  // obuch (buława)
  claws?: boolean;                                // bez broni, pazury
}

// Czasy w sekundach. Build 0.3: wolniej i ciężej niż wcześniej.
const WEAPONS: Record<string, Weapon> = {
  sword: { name: "Miecz", reach: 21, len: 10, dmg: { L: 31, R: 31, O: 42, T: 29 }, type: { L: "cut", R: "cut", O: "cut", T: "pierce" }, windup: 0.42, strike: 0.17, recover: 0.4, blade: PAL.steelL, hilt: PAL.gold },
  mace: { name: "Buława", reach: 18, len: 8, dmg: { L: 29, R: 29, O: 40, T: 16 }, type: { L: "blunt", R: "blunt", O: "blunt", T: "blunt" }, windup: 0.48, strike: 0.19, recover: 0.46, blade: PAL.wood, hilt: PAL.steelD, head: PAL.steel },
  armsword: { name: "Miecz", reach: 20, len: 9, dmg: { L: 25, R: 25, O: 32, T: 23 }, type: { L: "cut", R: "cut", O: "cut", T: "pierce" }, windup: 0.52, strike: 0.18, recover: 0.5, blade: PAL.steel, hilt: PAL.woodD },
  cavsword: { name: "Miecz jeździecki", reach: 24, len: 11, dmg: { L: 24, R: 24, O: 30, T: 22 }, type: { L: "cut", R: "cut", O: "cut", T: "pierce" }, windup: 0.48, strike: 0.16, recover: 0.58, blade: PAL.steel, hilt: PAL.goldD },
  dagger: { name: "Nóż", reach: 15, len: 5, dmg: { L: 14, R: 14, O: 17, T: 16 }, type: { L: "cut", R: "cut", O: "pierce", T: "pierce" }, windup: 0.4, strike: 0.13, recover: 0.36, blade: PAL.steel, hilt: PAL.woodD },
  rusty: { name: "Zardzewiały miecz", reach: 19, len: 9, dmg: { L: 27, R: 27, O: 32, T: 23 }, type: { L: "cut", R: "cut", O: "cut", T: "pierce" }, windup: 0.56, strike: 0.19, recover: 0.55, blade: PAL.ash, hilt: PAL.dirtD },
  bonedagger: { name: "Kościany nóż", reach: 15, len: 5, dmg: { L: 13, R: 13, O: 16, T: 15 }, type: { L: "cut", R: "cut", O: "pierce", T: "pierce" }, windup: 0.45, strike: 0.15, recover: 0.42, blade: PAL.boneHi, hilt: PAL.dusk },
  great: { name: "Miecz Zguby", reach: 27, len: 15, dmg: { L: 42, R: 42, O: 55, T: 36 }, type: { L: "cut", R: "cut", O: "cut", T: "pierce" }, windup: 0.78, strike: 0.22, recover: 0.7, blade: PAL.slate, hilt: PAL.purpleL },
  claws: { name: "Pazury", reach: 15, len: 0, dmg: { L: 22, R: 22, O: 26, T: 20 }, type: { L: "cut", R: "cut", O: "cut", T: "pierce" }, windup: 0.36, strike: 0.13, recover: 0.38, blade: PAL.bone, hilt: PAL.bone, claws: true },
};

interface Mount { hp: number; speed: number; accel: number; turn: number; }

interface UnitDef {
  name: string;
  body: BodyKind;
  hp: number;
  speed: number;                   // piksele na sekundę
  armor: Record<DmgType, number>;  // mnożnik obrażeń
  weapon: string;
  shield: boolean;
  shieldBlock: number;             // szansa zasłonięcia tarczą (AI)
  guard: number;                   // szansa odczytania ciosu i postawienia gardy
  react: number;                   // czas reakcji gardy (s)
  bow?: { dmg: number; range: number; reload: number; spread: number };
  undead?: boolean;
  poise?: boolean;
  radius: number;
  mount?: Mount;
}

const HORSE: Mount = { hp: 105, speed: 112, accel: 60, turn: 2.6 };

const UNITS: Record<string, UnitDef> = {
  hero: { name: "Ty", body: "hero", hp: 170, speed: 52, armor: { cut: 0.55, pierce: 0.7, blunt: 0.85 }, weapon: "sword", shield: true, shieldBlock: 0, guard: 0, react: 0, radius: 5 },
  inf: { name: "Zbrojny", body: "inf", hp: 95, speed: 44, armor: { cut: 0.65, pierce: 0.8, blunt: 0.9 }, weapon: "armsword", shield: true, shieldBlock: 0.42, guard: 0.3, react: 0.34, radius: 5 },
  arch: { name: "Łucznik", body: "arch", hp: 70, speed: 46, armor: { cut: 0.85, pierce: 0.9, blunt: 0.95 }, weapon: "dagger", shield: false, shieldBlock: 0, guard: 0.15, react: 0.42, bow: { dmg: 30, range: 240, reload: 2.0, spread: 0.06 }, radius: 5 },
  cav: { name: "Jeździec", body: "inf", hp: 90, speed: 44, armor: { cut: 0.6, pierce: 0.75, blunt: 0.9 }, weapon: "cavsword", shield: true, shieldBlock: 0.35, guard: 0.25, react: 0.34, radius: 6, mount: HORSE },
  skel: { name: "Szkielet", body: "skel", hp: 104, speed: 40, armor: { cut: 0.85, pierce: 0.45, blunt: 1.4 }, weapon: "rusty", shield: false, shieldBlock: 0, guard: 0.42, react: 0.36, undead: true, radius: 5 },
  skelArch: { name: "Szkielet łucznik", body: "skelArch", hp: 62, speed: 40, armor: { cut: 0.85, pierce: 0.45, blunt: 1.4 }, weapon: "bonedagger", shield: false, shieldBlock: 0, guard: 0.15, react: 0.44, bow: { dmg: 26, range: 225, reload: 2.2, spread: 0.09 }, undead: true, radius: 5 },
  ghoul: { name: "Ghul", body: "ghoul", hp: 95, speed: 60, armor: { cut: 1, pierce: 0.9, blunt: 0.9 }, weapon: "claws", shield: false, shieldBlock: 0, guard: 0.1, react: 0.4, undead: true, radius: 5 },
  dk: { name: "Rycerz Śmierci", body: "dk", hp: 480, speed: 42, armor: { cut: 0.45, pierce: 0.55, blunt: 0.8 }, weapon: "great", shield: false, shieldBlock: 0, guard: 0.6, react: 0.24, undead: true, poise: true, radius: 7 },
};

const HERO_LOADOUTS = [
  { name: "Miecz i tarcza", weapon: "sword", shield: true, bow: false },
  { name: "Buława i tarcza", weapon: "mace", shield: true, bow: false },
  { name: "Łuk", weapon: "dagger", shield: false, bow: true },
];

type Formation = "line" | "wall" | "loose" | "wedge" | "column" | "circle";
const FORMATION_NAME: Record<Formation, string> = { line: "Linia", wall: "Mur tarcz", loose: "Luźny szyk", wedge: "Klin", column: "Kolumna", circle: "Koło" };
const FORMATIONS: Formation[] = ["line", "wall", "loose", "wedge", "column", "circle"];
const FORMATION_SPACING: Record<Formation, number> = { line: 12, wall: 9, loose: 20, wedge: 12, column: 11, circle: 11 };

// Drzewka umiejętności bohatera: pięć atrybutów, siedem drzewek z węzłami, wymaganiami i wykluczeniami.
// Umiejętności aktywne (1–3) zdobywa się wyłącznie przez odblokowanie węzłów.

type HAttr = "str" | "agi" | "end" | "int" | "cha";
const ATTRS: HAttr[] = ["str", "agi", "end", "int", "cha"];
const ATTR_INFO: Record<HAttr, { name: string; short: string; desc: string; col: string }> = {
  str: { name: "Siła", short: "SIŁ", desc: "Obrażenia w walce wręcz, trochę zdrowia. Drzewko: Oręż.", col: "#a3463a" },
  agi: { name: "Zręczność", short: "ZRĘ", desc: "Szybkość w bitwie, łuk, jazda, ucieczki. Drzewko: Łowiectwo.", col: "#8b8b52" },
  end: { name: "Kondycja", short: "KON", desc: "Zdrowie i odnowa wytrzymałości. Drzewko: Kondycja.", col: "#b07a3a" },
  int: { name: "Intelekt", short: "INT", desc: "Mana i jej odnowa, medycyna. Drzewka: Magia i Mrok.", col: "#8a64a6" },
  cha: { name: "Charyzma", short: "CHA", desc: "Wielkość armii, wiara, ceny. Drzewka: Dowództwo i Wiara.", col: "#b8933a" },
};

interface SkillNode {
  id: string; tree: string; name: string; desc: string; row: number; col: number;
  req: Partial<Record<HAttr, number>>; parents: string[];      // wystarczy jeden z rodziców
  excl?: string;                                               // wyklucza się z tym węzłem
  skills?: Record<string, number>; perks?: Record<string, number>; ability?: string; smite2?: boolean;
  icon: string;
}
interface SkillTree { id: string; name: string; attr: HAttr; excl?: string; desc: string; }
const STREES: SkillTree[] = [
  { id: "arms", name: "Oręż", attr: "str", desc: "Walka wręcz: siła ciosu i styl walki." },
  { id: "body", name: "Kondycja", attr: "end", desc: "Twarde ciało, długi oddech, furia." },
  { id: "hunt", name: "Łowiectwo", attr: "agi", desc: "Łuk, koń, tropy i bestie." },
  { id: "lead", name: "Dowództwo", attr: "cha", desc: "Armia, handel, taktyka i medycyna polowa." },
  { id: "faith", name: "Wiara", attr: "cha", excl: "dark", desc: "Modlitwa i święty ogień. Wyklucza Mrok." },
  { id: "magic", name: "Magia", attr: "int", desc: "Ogień i przepływ many. Każde zaklęcie grozi spaczeniem." },
  { id: "dark", name: "Mrok", attr: "int", excl: "faith", desc: "Klątwy, krew i duchy. Wyklucza Wiarę." },
];
const NODES: SkillNode[] = [
  // Oręż
  { id: "ps1", tree: "arms", name: "Silny cios", desc: "+6% obrażeń wręcz.", row: 0, col: 1, req: { str: 4 }, parents: [], skills: { powerstrike: 1 }, icon: "sword" },
  { id: "ps2", tree: "arms", name: "Ciężka ręka", desc: "+6% obrażeń wręcz, ciosy łatwiej przerywają wroga.", row: 1, col: 1, req: { str: 6 }, parents: ["ps1"], skills: { powerstrike: 1 }, icon: "sword" },
  { id: "shieldman", tree: "arms", name: "Tarczownik", desc: "Blok kosztuje o 40% mniej wytrzymałości. Daje Szarżę tarczą.", row: 2, col: 0, req: { str: 6, end: 5 }, parents: ["ps2"], excl: "cleaver", perks: { blockCost: -0.4 }, ability: "bash", icon: "shield" },
  { id: "cleaver", tree: "arms", name: "Rębacz", desc: "+15% obrażeń bronią dwuręczną. Daje Wir ostrza.", row: 2, col: 2, req: { str: 7 }, parents: ["ps2"], excl: "shieldman", perks: { twoHand: 0.15 }, ability: "whirl", icon: "axe" },
  { id: "ps3", tree: "arms", name: "Mistrz broni", desc: "+8% obrażeń wręcz.", row: 3, col: 1, req: { str: 9 }, parents: ["shieldman", "cleaver"], skills: { powerstrike: 1 }, icon: "crown" },
  // Kondycja
  { id: "if1", tree: "body", name: "Twarda skóra", desc: "+8 zdrowia.", row: 0, col: 1, req: { end: 4 }, parents: [], skills: { ironflesh: 1 }, icon: "heart" },
  { id: "wind", tree: "body", name: "Drugi oddech", desc: "Wytrzymałość odnawia się o 30% szybciej.", row: 1, col: 0, req: { end: 5 }, parents: ["if1"], perks: { stamina: 0.3 }, icon: "wind" },
  { id: "if2", tree: "body", name: "Żelazne ciało", desc: "+8 zdrowia.", row: 1, col: 2, req: { end: 6 }, parents: ["if1"], skills: { ironflesh: 1 }, icon: "heart" },
  { id: "rage", tree: "body", name: "Furia", desc: "Furia rośnie szybciej. Daje Okrzyk bojowy.", row: 2, col: 1, req: { end: 6, str: 5 }, parents: ["wind", "if2"], perks: { fury: 0.5 }, ability: "warcry", icon: "fire" },
  { id: "if3", tree: "body", name: "Nieugięty", desc: "+10 zdrowia, mniej zachwiań od ciosów.", row: 3, col: 1, req: { end: 9 }, parents: ["rage"], skills: { ironflesh: 1 }, perks: { poise: 1 }, icon: "crown" },
  // Łowiectwo
  { id: "ar1", tree: "hunt", name: "Strzelec", desc: "+5% obrażeń łukiem, celniej.", row: 0, col: 0, req: { agi: 4 }, parents: [], skills: { archery: 1 }, icon: "bow" },
  { id: "rd1", tree: "hunt", name: "Jeździec", desc: "Szybszy koń. Pozwala dosiadać lepszych koni.", row: 0, col: 2, req: { agi: 4 }, parents: [], skills: { riding: 1 }, icon: "horse" },
  { id: "tr1", tree: "hunt", name: "Tropiciel", desc: "Większy zasięg wzroku na mapie, szybszy marsz.", row: 1, col: 1, req: { agi: 5 }, parents: ["ar1", "rd1"], skills: { tracking: 2 }, icon: "eye" },
  { id: "ar2", tree: "hunt", name: "Sokole oko", desc: "+10% obrażeń łukiem. Daje Skupienie.", row: 2, col: 0, req: { agi: 7 }, parents: ["tr1"], skills: { archery: 2 }, ability: "focus", icon: "bow" },
  { id: "rd2", tree: "hunt", name: "Kawalerzysta", desc: "Jeszcze szybszy koń, konie bojowe.", row: 2, col: 2, req: { agi: 6 }, parents: ["tr1"], skills: { riding: 2 }, icon: "horse" },
  { id: "wolves", tree: "hunt", name: "Wilcza wataha", desc: "Daje Przyzwanie wilczych duchów.", row: 3, col: 1, req: { agi: 8, int: 5 }, parents: ["ar2", "rd2"], ability: "summon", icon: "wolf" },
  // Dowództwo
  { id: "ld1", tree: "lead", name: "Dowódca", desc: "+5 ludzi w armii, lepsze morale.", row: 0, col: 1, req: { cha: 4 }, parents: [], skills: { leadership: 1 }, icon: "banner" },
  { id: "tr", tree: "lead", name: "Kupiec", desc: "Lepsze ceny kupna i sprzedaży.", row: 1, col: 0, req: { cha: 5 }, parents: ["ld1"], skills: { trade: 2 }, icon: "coin" },
  { id: "med", tree: "lead", name: "Felczer", desc: "Ranni szybciej wracają, więcej rannych zamiast poległych.", row: 1, col: 2, req: { int: 5 }, parents: ["ld1"], skills: { medicine: 2 }, icon: "cross" },
  { id: "ld2", tree: "lead", name: "Wódz", desc: "+10 ludzi w armii. Daje Okrzyk bojowy.", row: 2, col: 1, req: { cha: 7 }, parents: ["tr", "med"], skills: { leadership: 2 }, ability: "warcry", icon: "banner" },
  { id: "tac", tree: "lead", name: "Taktyk", desc: "Łatwiejsze ucieczki i lepsze morale na start bitwy.", row: 3, col: 1, req: { cha: 8, int: 5 }, parents: ["ld2"], skills: { tactics: 2, leadership: 1 }, icon: "crown" },
  // Wiara
  { id: "pray", tree: "faith", name: "Pobożność", desc: "Wiara odnawia się szybciej.", row: 0, col: 1, req: { cha: 4 }, parents: [], perks: { faith: 0.5 }, icon: "cross" },
  { id: "smite", tree: "faith", name: "Smite", desc: "Daje Smite: następny cios płonie świętym ogniem.", row: 1, col: 0, req: { cha: 5 }, parents: ["pray"], ability: "smite", icon: "sun" },
  { id: "heal", tree: "faith", name: "Modlitwa leczenia", desc: "Daje Modlitwę leczenia.", row: 1, col: 2, req: { cha: 5, int: 4 }, parents: ["pray"], ability: "heal", skills: { medicine: 1 }, icon: "heart" },
  { id: "smite2", tree: "faith", name: "Słup światła", desc: "Smite poziom 2: słup świętego światła przy kursorze.", row: 3, col: 0, req: { cha: 8 }, parents: ["smite"], smite2: true, icon: "sun" },
  { id: "saint", tree: "faith", name: "Męczennik", desc: "Mniej spaczenia, więcej wiary z zabitych nieumarłych.", row: 3, col: 2, req: { cha: 7 }, parents: ["heal"], perks: { corruptRes: 0.5, faith: 0.5 }, icon: "crown" },
  // Magia
  { id: "flow", tree: "magic", name: "Przepływ many", desc: "Mana odnawia się szybciej.", row: 0, col: 1, req: { int: 4 }, parents: [], perks: { mana: 0.5 }, icon: "drop" },
  { id: "fire", tree: "magic", name: "Kula ognia", desc: "Daje Kulę ognia.", row: 1, col: 1, req: { int: 5 }, parents: ["flow"], ability: "fireball", icon: "fire" },
  { id: "herb", tree: "magic", name: "Zielarstwo", desc: "Medycyna: ranni wracają szybciej.", row: 2, col: 0, req: { int: 6 }, parents: ["fire"], skills: { medicine: 2 }, icon: "leaf" },
  { id: "pyro", tree: "magic", name: "Ognista dusza", desc: "+40% obrażeń Kuli ognia, mniejszy koszt many.", row: 2, col: 2, req: { int: 7 }, parents: ["fire"], perks: { fireDmg: 0.4 }, icon: "fire" },
  { id: "arch", tree: "magic", name: "Arcymag", desc: "Większa mana i mniej spaczenia.", row: 3, col: 1, req: { int: 9 }, parents: ["herb", "pyro"], perks: { mana: 0.5, corruptRes: 0.3 }, icon: "crown" },
  // Mrok
  { id: "curse", tree: "dark", name: "Klątwa", desc: "Daje Klątwę osłabienia.", row: 0, col: 1, req: { int: 4 }, parents: [], ability: "curse", icon: "skull" },
  { id: "blood", tree: "dark", name: "Krwawy rytuał", desc: "Daje Krwawy rytuał.", row: 1, col: 0, req: { int: 5, end: 5 }, parents: ["curse"], ability: "blood", icon: "drop" },
  { id: "pact", tree: "dark", name: "Pakt", desc: "Spaczenie rośnie wolniej.", row: 1, col: 2, req: { int: 6 }, parents: ["curse"], perks: { corruptRes: 0.4 }, icon: "skull" },
  { id: "spirits", tree: "dark", name: "Przyzwanie duchów", desc: "Daje Przyzwanie wilczych duchów.", row: 2, col: 1, req: { int: 7 }, parents: ["blood", "pact"], ability: "summon", icon: "wolf" },
  { id: "lich", tree: "dark", name: "Władca kości", desc: "Mana szybciej, nieumarli w armii nie dezerterują.", row: 3, col: 1, req: { int: 9 }, parents: ["spirits"], perks: { mana: 0.6 }, icon: "crown" },
];
const NODE = (id: string) => NODES.find((n) => n.id === id);

function treeExcluded(P: PlayerState, t: SkillTree) { return !!t.excl && P.nodes.some((id) => NODE(id).tree === t.excl); }
function nodeState(P: PlayerState, n: SkillNode): "have" | "open" | "locked" | "blocked" {
  if (P.nodes.includes(n.id)) return "have";
  const t = STREES.find((x) => x.id === n.tree);
  if (treeExcluded(P, t)) return "blocked";
  if (n.excl && P.nodes.includes(n.excl)) return "blocked";
  if (n.parents.length && !n.parents.some((p) => P.nodes.includes(p))) return "locked";
  for (const a in n.req) if (P.attr[a] < n.req[a as HAttr]) return "locked";
  return "open";
}
function nodeWhy(P: PlayerState, n: SkillNode): string {
  const st = nodeState(P, n);
  if (st === "have") return "Odblokowane";
  if (st === "blocked") return n.excl && P.nodes.includes(n.excl) ? `Wyklucza się z: ${NODE(n.excl).name}` : `Drzewko wyklucza się z: ${STREES.find((t) => t.id === STREES.find((x) => x.id === n.tree).excl).name}`;
  const miss: string[] = [];
  if (n.parents.length && !n.parents.some((p) => P.nodes.includes(p))) miss.push("najpierw: " + n.parents.map((p) => NODE(p).name).join(" lub "));
  for (const a in n.req) if (P.attr[a] < n.req[a as HAttr]) miss.push(`${ATTR_INFO[a as HAttr].name} ${n.req[a as HAttr]}`);
  if (st === "open" && P.skillPts <= 0) return "Brak punktów";
  return miss.length ? "Wymaga: " + miss.join(", ") : "Można odblokować";
}
function unlockNode(P: PlayerState, n: SkillNode, free = false) {
  if (nodeState(P, n) !== "open") return false;
  if (!free) { if (P.skillPts <= 0) return false; P.skillPts--; }
  P.nodes.push(n.id);
  applyNode(P, n);
  return true;
}
function applyNode(P: PlayerState, n: SkillNode) {
  if (n.skills) for (const k in n.skills) P.skills[k] = (P.skills[k] || 0) + n.skills[k];
  if (n.perks) for (const k in n.perks) P.perks[k] = (P.perks[k] || 0) + n.perks[k];
  if (n.ability && !P.learned.includes(n.ability)) { P.learned.push(n.ability); const free = P.abilities.indexOf(""); if (free >= 0) P.abilities[free] = n.ability; }
  if (n.smite2) P.abLevels.smite = 2;
  if (n.skills?.ironflesh) P.hp += 8;
}
function perk(P: PlayerState, k: string) { return P.perks?.[k] || 0; }

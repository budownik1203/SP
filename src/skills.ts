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
  { id: "arms", name: "Oręż", attr: "str", desc: "Walka wręcz: siła ciosu i styl walki. Tarcza albo broń dwuręczna." },
  { id: "body", name: "Kondycja", attr: "end", desc: "Twarde ciało, długi oddech, furia." },
  { id: "heavy", name: "Ciężki pancerz", attr: "end", excl: "light", desc: "Płyty i kolczugi: mniej ran, mniejsza kara za wagę. Wyklucza Lekki pancerz." },
  { id: "light", name: "Lekki pancerz", attr: "agi", excl: "heavy", desc: "Skóra i ruch: uniki, szybkość, cios z zaskoczenia. Wyklucza Ciężki pancerz." },
  { id: "hunt", name: "Łowiectwo", attr: "agi", desc: "Łuk albo kusza, koń, tropy i bestie." },
  { id: "lead", name: "Dowództwo", attr: "cha", desc: "Armia, handel, taktyka i medycyna polowa." },
  { id: "faith", name: "Wiara", attr: "cha", excl: "dark", desc: "Modlitwa i święty ogień. Wyklucza Mrok." },
  { id: "magic", name: "Magia", attr: "int", desc: "Ogień i przepływ many. Każde zaklęcie grozi spaczeniem." },
  { id: "dark", name: "Mrok", attr: "int", excl: "faith", desc: "Klątwy, krew i duchy. Wyklucza Wiarę." },
  { id: "smith", name: "Kowalstwo", attr: "str", desc: "Kuźnia: lepsza jakość, mniej materiału, rzadkie kruszce, naprawa w drodze i legendarne arcydzieła." },
];
type NX = Partial<SkillNode>;
const NODES: SkillNode[] = [];
function N(tree: string, id: string, name: string, desc: string, row: number, col: number, req: Partial<Record<HAttr, number>>, parents: string[], x: NX = {}) { NODES.push({ id, tree, name, desc, row, col, req, parents, icon: "star", ...x } as SkillNode); }
// ---- Oręż (siła) ----
N("arms", "ps1", "Silny cios", "+6% obrażeń wręcz.", 0, 1, { str: 4 }, [], { skills: { powerstrike: 1 }, icon: "sword" });
N("arms", "drill", "Musztra", "Wytrzymałość odnawia się o 10% szybciej.", 0, 0, { str: 4 }, [], { perks: { stamina: 0.1 }, icon: "wind" });
N("arms", "grip", "Pewny chwyt", "Blok kosztuje o 10% mniej wytrzymałości.", 1, 0, { str: 5 }, ["ps1", "drill"], { perks: { blockCost: -0.1 }, icon: "shield" });
N("arms", "ps2", "Ciężka ręka", "+6% obrażeń wręcz, ciosy łatwiej przerywają wroga.", 1, 1, { str: 6 }, ["ps1"], { skills: { powerstrike: 1 }, icon: "sword" });
N("arms", "quick", "Szybkie ręce", "Zamach o 6% szybszy.", 1, 2, { str: 5, agi: 5 }, ["ps1"], { perks: { swing: 0.06 }, icon: "wind" });
N("arms", "shieldman", "Tarczownik", "Blok kosztuje o 40% mniej. Daje Szarżę tarczą. Wyklucza Rębacza.", 2, 0, { str: 6, end: 5 }, ["ps2", "grip"], { excl: "cleaver", perks: { blockCost: -0.4 }, ability: "bash", icon: "shield" });
N("arms", "fencer", "Szermierz", "Idealny blok łatwiej trafić (dłuższe okno).", 2, 1, { str: 6, agi: 5 }, ["ps2", "quick"], { perks: { parry: 0.06 }, icon: "sword" });
N("arms", "cleaver", "Rębacz", "+15% obrażeń bronią dwuręczną. Daje Wir ostrza. Wyklucza Tarczownika.", 2, 2, { str: 7 }, ["ps2", "quick"], { excl: "shieldman", perks: { twoHand: 0.15 }, ability: "whirl", icon: "axe" });
N("arms", "wall", "Żywy mur", "Tarcza wytrzymuje dwa razy dłużej.", 3, 0, { str: 7, end: 6 }, ["shieldman"], { perks: { shieldHp: 1 }, icon: "shield" });
N("arms", "riposte", "Riposta", "Kontra po idealnym bloku zadaje +20% więcej.", 3, 1, { str: 7, agi: 6 }, ["fencer"], { perks: { counter: 0.2 }, icon: "sword" });
N("arms", "butcher", "Rzeźnik", "+10% obrażeń bronią dwuręczną.", 3, 2, { str: 8 }, ["cleaver"], { perks: { twoHand: 0.1 }, icon: "axe" });
N("arms", "bulwark", "Twierdza", "+3 pancerza.", 4, 0, { str: 8, end: 7 }, ["wall"], { perks: { armorB: 0.03 }, icon: "castle" });
N("arms", "ps3", "Mistrz broni", "+8% obrażeń wręcz.", 4, 1, { str: 9 }, ["shieldman", "cleaver", "riposte"], { skills: { powerstrike: 1 }, icon: "crown" });
N("arms", "frenzy", "Szał ostrzy", "+5% obrażeń wręcz, zamach o 5% szybszy.", 4, 2, { str: 8, agi: 6 }, ["butcher"], { perks: { meleeDmg: 0.05, swing: 0.05 }, icon: "fire" });
N("arms", "lancer", "Kopijnik", "+15% obrażeń z konia i kopią.", 5, 0, { str: 8, agi: 6 }, ["bulwark", "ps3"], { perks: { cavDmg: 0.15 }, icon: "horse" });
N("arms", "exec", "Egzekutor", "Ciosy w głowę zadają +25% więcej.", 5, 1, { str: 9 }, ["ps3"], { perks: { headDmg: 0.25 }, icon: "skull" });
N("arms", "breaker", "Łamacz tarcz", "Twoje ciosy niszczą tarcze dwa razy szybciej.", 5, 2, { str: 9 }, ["frenzy", "ps3"], { perks: { shieldBreak: 1 }, icon: "hammer" });
N("arms", "slayer", "Pogromca", "+6% obrażeń wręcz.", 6, 0, { str: 10 }, ["lancer", "exec"], { perks: { meleeDmg: 0.06 }, icon: "sword" });
N("arms", "legend", "Legenda pola bitwy", "+8% obrażeń, twoi ludzie zaczynają bitwę z +10 morale.", 6, 1, { str: 11, cha: 6 }, ["exec", "slayer", "reaper"], { perks: { meleeDmg: 0.08, moraleB: 10 }, icon: "crown" });
N("arms", "reaper", "Krwawy żniwiarz", "Każdy cios leczy cię o 5% zadanych obrażeń.", 6, 2, { str: 10, end: 7 }, ["breaker", "exec"], { perks: { lifeSteal: 0.05 }, icon: "drop" });
// ---- Kondycja (kondycja) ----
N("body", "if1", "Twarda skóra", "+8 zdrowia.", 0, 1, { end: 4 }, [], { skills: { ironflesh: 1 }, icon: "heart" });
N("body", "march", "Wędrowiec", "Drużyna maszeruje o 4% szybciej.", 0, 0, { end: 4 }, [], { perks: { mapSpeed: 0.04 }, icon: "wind" });
N("body", "glutton", "Żelazny żołądek", "Ludzie jedzą o 15% mniej.", 0, 2, { end: 4 }, [], { perks: { food: 0.15 }, icon: "food" });
N("body", "wind", "Drugi oddech", "Wytrzymałość odnawia się o 30% szybciej.", 1, 0, { end: 5 }, ["if1", "march"], { perks: { stamina: 0.3 }, icon: "wind" });
N("body", "if2", "Żelazne ciało", "+8 zdrowia.", 1, 1, { end: 6 }, ["if1"], { skills: { ironflesh: 1 }, icon: "heart" });
N("body", "thick", "Gruba krew", "Rany bohatera goją się o 30% szybciej.", 1, 2, { end: 5 }, ["if1", "glutton"], { perks: { heal: 0.3 }, icon: "drop" });
N("body", "runner", "Długi bieg", "Sprint i odskok kosztują o 25% mniej.", 2, 0, { end: 6, agi: 5 }, ["wind"], { perks: { dodgeCost: 0.25 }, icon: "wind" });
N("body", "rage", "Furia", "Furia rośnie szybciej. Daje Okrzyk bojowy.", 2, 1, { end: 6, str: 5 }, ["wind", "if2"], { perks: { fury: 0.5 }, ability: "warcry", icon: "fire" });
N("body", "if2b", "Byczy kark", "+10 zdrowia.", 2, 2, { end: 7 }, ["if2", "thick"], { perks: { maxHp: 10 }, icon: "heart" });
N("body", "pain", "Ból to nic", "Mniej zachwiań od ciosów.", 3, 0, { end: 7 }, ["runner", "rage"], { perks: { poise: 1 }, icon: "shield" });
N("body", "berserk", "Berserk", "Poniżej połowy zdrowia: +15% obrażeń.", 3, 1, { end: 7, str: 6 }, ["rage"], { perks: { berserk: 0.15 }, icon: "fire" });
N("body", "if3x", "Dąb", "+12 zdrowia.", 3, 2, { end: 8 }, ["if2b"], { perks: { maxHp: 12 }, icon: "heart" });
N("body", "if3", "Nieugięty", "+10 zdrowia, mniej zachwiań od ciosów.", 4, 1, { end: 9 }, ["rage", "pain", "if3x"], { skills: { ironflesh: 1 }, perks: { poise: 1 }, icon: "crown" });
N("body", "bear", "Niedźwiedzi uścisk", "Kopniak przewraca mocniej i rani.", 4, 0, { end: 8, str: 7 }, ["pain"], { perks: { kick: 1 }, icon: "hammer" });
N("body", "fast", "Szybka regeneracja", "Wytrzymałość +20% odnowy, rany goją się szybciej.", 4, 2, { end: 8 }, ["if3x"], { perks: { stamina: 0.2, heal: 0.2 }, icon: "leaf" });
N("body", "warlord", "Okrzyk wodza", "Okrzyk bojowy (G) częściej i mocniej.", 5, 1, { end: 9, cha: 6 }, ["if3"], { perks: { cryB: 0.4 }, icon: "banner" });
N("body", "unbreak", "Nie do zdarcia", "+15 zdrowia.", 5, 0, { end: 10 }, ["if3", "bear"], { perks: { maxHp: 15 }, icon: "heart" });
N("body", "second", "Ostatni oddech", "Raz na bitwę przeżywasz śmiertelny cios z 1 zdrowia.", 5, 2, { end: 10 }, ["if3", "fast"], { perks: { cheat: 1 }, icon: "skull" });
N("body", "titan", "Tytan", "+20 zdrowia, +2 pancerza.", 6, 1, { end: 12 }, ["unbreak", "second", "warlord"], { perks: { maxHp: 20, armorB: 0.02 }, icon: "crown" });
N("body", "tireless", "Niezmordowany", "Wytrzymałość +30% odnowy.", 6, 0, { end: 11 }, ["unbreak"], { perks: { stamina: 0.3 }, icon: "wind" });
// ---- Ciężki pancerz (kondycja) ----
N("heavy", "hv1", "Noszenie zbroi", "Kara za wagę zbroi o 20% mniejsza.", 0, 1, { end: 5 }, [], { perks: { weightRes: 0.2 }, icon: "shield" });
N("heavy", "hvmail", "Kolczuga", "+2 pancerza.", 1, 0, { end: 5 }, ["hv1"], { perks: { armorB: 0.02 }, icon: "chain" });
N("heavy", "hvplate", "Płyta", "+2 pancerza.", 1, 2, { end: 6, str: 5 }, ["hv1"], { perks: { armorB: 0.02 }, icon: "castle" });
N("heavy", "hv2", "Przywykły do ciężaru", "Kara za wagę o 20% mniejsza.", 1, 1, { end: 6 }, ["hv1"], { perks: { weightRes: 0.2 }, icon: "shield" });
N("heavy", "hvarr", "Strzały się ślizgają", "Strzały zadają ci o 15% mniej.", 2, 0, { end: 6 }, ["hvmail", "hv2"], { perks: { arrowRes: 0.15 }, icon: "bow" });
N("heavy", "hvdeflect", "Ześlizg ostrza", "Cięcia zadają ci o 10% mniej.", 2, 1, { end: 7 }, ["hv2"], { perks: { cutRes: 0.1 }, icon: "sword" });
N("heavy", "hvwall", "Opancerzony szereg", "Twoi ludzie w pobliżu tracą mniej morale.", 2, 2, { end: 6, cha: 5 }, ["hvplate", "hv2"], { perks: { moraleB: 5 }, icon: "banner" });
N("heavy", "hv3", "Żelazny rycerz", "+3 pancerza.", 3, 1, { end: 8 }, ["hvarr", "hvdeflect", "hvwall"], { perks: { armorB: 0.03 }, icon: "crown" });
N("heavy", "hvcrush", "Odporność na obuch", "Obuchy zadają ci o 15% mniej.", 3, 0, { end: 8 }, ["hvarr"], { perks: { bluntRes: 0.15 }, icon: "hammer" });
N("heavy", "hvhorse", "Koń w kropierzy", "Twój koń ma +30% zdrowia.", 3, 2, { end: 7, agi: 5 }, ["hvwall"], { perks: { horseB: 0.3 }, icon: "horse" });
N("heavy", "hv4", "Ciężar nie gra roli", "Kara za wagę o 30% mniejsza.", 4, 1, { end: 9 }, ["hv3"], { perks: { weightRes: 0.3 }, icon: "shield" });
N("heavy", "hvstand", "Nie ustąpię", "Mniej zachwiań, odepchnięcia słabsze.", 4, 0, { end: 9, str: 7 }, ["hvcrush", "hv3"], { perks: { poise: 1 }, icon: "castle" });
N("heavy", "hvtrample", "Taran w zbroi", "Szarża z konia tratuje mocniej.", 4, 2, { end: 9, agi: 6 }, ["hvhorse", "hv3"], { perks: { cavDmg: 0.1 }, icon: "horse" });
N("heavy", "hv5", "Stalowa skóra", "+3 pancerza.", 5, 1, { end: 10 }, ["hv4"], { perks: { armorB: 0.03 }, icon: "crown" });
N("heavy", "hvfear", "Groza w stali", "Wrogowie w pobliżu tracą morale, gdy zabijasz.", 5, 0, { end: 10, cha: 6 }, ["hvstand"], { perks: { terror: 1 }, icon: "skull" });
N("heavy", "hvsmith", "Własna kuźnia", "Ulepszanie i naprawa u kowala o 30% taniej.", 5, 2, { end: 8, int: 5 }, ["hvtrample", "hv4"], { perks: { smithB: 0.3 }, icon: "hammer" });
N("heavy", "hvcap", "Chodząca twierdza", "+4 pancerza, +20 zdrowia.", 6, 1, { end: 12 }, ["hv5", "hvfear", "hvsmith"], { perks: { armorB: 0.04, maxHp: 20 }, icon: "castle" });
N("heavy", "hvres", "Odporność na magię", "Klątwy i ogień zadają ci o 25% mniej.", 6, 0, { end: 11, int: 5 }, ["hvfear"], { perks: { magicRes: 0.25 }, icon: "eye" });
N("heavy", "hvlast", "Ostatni bastion", "Poniżej 30% zdrowia: +5 pancerza.", 6, 2, { end: 11 }, ["hvsmith"], { perks: { bastion: 0.05 }, icon: "shield" });
N("heavy", "hvbody", "Wołu kark", "+10 zdrowia.", 0, 0, { end: 5 }, [], { perks: { maxHp: 10 }, icon: "heart" });
// ---- Lekki pancerz (zręczność) ----
N("light", "lt1", "Lekki krok", "+4% szybkości w bitwie.", 0, 1, { agi: 5 }, [], { perks: { bspeed: 0.04 }, icon: "wind" });
N("light", "ltdodge", "Unik", "Odskok kosztuje o 30% mniej.", 1, 0, { agi: 5 }, ["lt1"], { perks: { dodgeCost: 0.3 }, icon: "wind" });
N("light", "lt2", "Zwinność", "+4% szybkości w bitwie.", 1, 1, { agi: 6 }, ["lt1"], { perks: { bspeed: 0.04 }, icon: "wind" });
N("light", "ltroll", "Przewrót", "Odskok dłuższy i dłużej nietykalny.", 1, 2, { agi: 6 }, ["lt1"], { perks: { dodgeLong: 1 }, icon: "wind" });
N("light", "ltback", "Cios w plecy", "Ciosy w plecy zadają +30%.", 2, 0, { agi: 6, str: 5 }, ["ltdodge", "lt2"], { perks: { backstab: 0.3 }, icon: "sword" });
N("light", "lt3", "Taniec ostrzy", "Zamach o 6% szybszy.", 2, 1, { agi: 7 }, ["lt2"], { perks: { swing: 0.06 }, icon: "sword" });
N("light", "ltquiet", "Cichy chód", "Drużyna rzadziej wpada w zasadzki, lepszy zwiad.", 2, 2, { agi: 6 }, ["ltroll", "lt2"], { perks: { sightB: 2 }, icon: "eye" });
N("light", "ltarrow", "Uskok przed strzałą", "15% szans, że strzała chybi.", 3, 0, { agi: 7 }, ["ltback"], { perks: { arrowDodge: 0.15 }, icon: "bow" });
N("light", "lt4", "Wiatr", "+5% szybkości w bitwie.", 3, 1, { agi: 8 }, ["lt3", "ltback"], { perks: { bspeed: 0.05 }, icon: "wind" });
N("light", "ltthief", "Lepkie palce", "+20% złota z łupów.", 3, 2, { agi: 7 }, ["ltquiet"], { perks: { lootB: 0.2 }, icon: "coin" });
N("light", "ltflow", "Płynny ruch", "Wytrzymałość +25% odnowy.", 4, 1, { agi: 8, end: 5 }, ["lt4"], { perks: { stamina: 0.25 }, icon: "leaf" });
N("light", "ltvital", "Punkty witalne", "Cios w głowę zadaje +20%.", 4, 0, { agi: 8 }, ["ltarrow", "lt4"], { perks: { headDmg: 0.2 }, icon: "skull" });
N("light", "ltscout", "Zwiadowca", "Większy zasięg wzroku na mapie.", 4, 2, { agi: 7 }, ["ltthief", "lt4"], { perks: { sightB: 2 }, skills: { tracking: 1 }, icon: "eye" });
N("light", "lt5", "Cień", "Uniki: 25% szans, że strzała chybi.", 5, 1, { agi: 10 }, ["ltflow"], { perks: { arrowDodge: 0.1 }, icon: "moon" });
N("light", "ltdance", "Tancerz", "Po udanym odskoku następny cios +25%.", 5, 0, { agi: 9 }, ["ltvital", "ltflow"], { perks: { dodgeStrike: 0.25 }, icon: "sword" });
N("light", "ltrun", "Uciekinier", "Ucieczki przed pościgiem znacznie łatwiejsze.", 5, 2, { agi: 9 }, ["ltscout"], { perks: { flee: 0.3 }, icon: "horse" });
N("light", "ltcap", "Nieuchwytny", "+6% szybkości, odskok nic nie kosztuje co drugi raz.", 6, 1, { agi: 12 }, ["lt5", "ltdance", "ltrun"], { perks: { bspeed: 0.06, dodgeCost: 0.3 }, icon: "crown" });
N("light", "ltduel", "Pojedynkowicz", "Na arenie i w pojedynkach +10% obrażeń.", 6, 0, { agi: 11 }, ["ltdance"], { perks: { meleeDmg: 0.05 }, icon: "sword" });
N("light", "ltmark", "Znaczony cel", "Strzały i bełty +10% obrażeń.", 6, 2, { agi: 11 }, ["ltrun"], { perks: { bowB: 0.1 }, icon: "bow" });
N("light", "ltgear", "Skórznie", "+1 pancerza bez kary za wagę.", 0, 0, { agi: 5 }, [], { perks: { armorB: 0.01 }, icon: "shield" });
// ---- Łowiectwo (zręczność): łuk albo kusza ----
N("hunt", "ar1", "Strzelec", "+5% obrażeń łukiem, celniej.", 0, 0, { agi: 4 }, [], { skills: { archery: 1 }, icon: "bow" });
N("hunt", "rd1", "Jeździec", "Szybszy koń. Pozwala dosiadać lepszych koni.", 0, 2, { agi: 4 }, [], { skills: { riding: 1 }, icon: "horse" });
N("hunt", "tr1", "Tropiciel", "Większy zasięg wzroku na mapie, szybszy marsz.", 1, 1, { agi: 5 }, ["ar1", "rd1"], { skills: { tracking: 2 }, icon: "eye" });
N("hunt", "bowman", "Łucznik", "+10% obrażeń łukiem, szybszy naciąg. Wyklucza Kusznika.", 1, 0, { agi: 6 }, ["ar1"], { excl: "xbowman", perks: { bowB: 0.1, draw: 0.15 }, icon: "bow" });
N("hunt", "rd1b", "Ujeżdżacz", "Koń ma +15% zdrowia.", 1, 2, { agi: 5 }, ["rd1"], { perks: { horseB: 0.15 }, icon: "horse" });
N("hunt", "ar2", "Sokole oko", "+10% obrażeń łukiem. Daje Skupienie.", 2, 0, { agi: 7 }, ["bowman", "tr1"], { skills: { archery: 2 }, ability: "focus", icon: "bow" });
N("hunt", "xbowman", "Kusznik", "+20% obrażeń kuszą, szybsze ładowanie. Wyklucza Łucznika.", 2, 1, { agi: 6, str: 5 }, ["tr1", "ar1"], { excl: "bowman", perks: { xbowB: 0.2, draw: 0.2 }, icon: "bow" });
N("hunt", "rd2", "Kawalerzysta", "Jeszcze szybszy koń, konie bojowe.", 2, 2, { agi: 6 }, ["tr1", "rd1b"], { skills: { riding: 2 }, icon: "horse" });
N("hunt", "quiver", "Pełny kołczan", "+10 strzał na bitwę.", 3, 0, { agi: 7 }, ["ar2"], { perks: { ammo: 10 }, icon: "bow" });
N("hunt", "pierce", "Przebicie", "Bełty i strzały ignorują część pancerza.", 3, 1, { agi: 8 }, ["xbowman", "ar2"], { perks: { pierce: 0.15 }, icon: "sword" });
N("hunt", "horsebow", "Łuk z siodła", "Strzelanie z konia bez kary do celności.", 3, 2, { agi: 8 }, ["rd2", "ar2"], { perks: { horseArch: 1 }, icon: "horse" });
N("hunt", "hunter", "Myśliwy", "Po bitwie z bestiami: mięso i skóry.", 4, 1, { agi: 7 }, ["tr1", "pierce"], { perks: { hunter: 1 }, skills: { tracking: 1 }, icon: "wolf" });
N("hunt", "ar3", "Mistrz łuku", "+10% obrażeń łukiem i kuszą.", 4, 0, { agi: 9 }, ["quiver", "pierce"], { perks: { bowB: 0.1, xbowB: 0.1 }, icon: "crown" });
N("hunt", "rd3", "Centaur", "Koń szybszy o 10%, cięcia z konia +10%.", 4, 2, { agi: 9 }, ["horsebow"], { perks: { horseSpd: 0.1, cavDmg: 0.1 }, icon: "horse" });
N("hunt", "wolves", "Wilcza wataha", "Daje Przyzwanie wilczych duchów.", 5, 1, { agi: 8, int: 5 }, ["hunter", "ar3", "rd3"], { ability: "summon", icon: "wolf" });
N("hunt", "headshot", "Strzał w oko", "Trafienie w głowę z łuku: +30%.", 5, 0, { agi: 10 }, ["ar3"], { perks: { headDmg: 0.15, bowB: 0.05 }, icon: "skull" });
N("hunt", "rider", "Jeździec stepów", "Drużyna konna maszeruje szybciej.", 5, 2, { agi: 9 }, ["rd3"], { perks: { mapSpeed: 0.06 }, icon: "horse" });
N("hunt", "apex", "Drapieżnik", "+10% obrażeń strzał i z konia.", 6, 1, { agi: 12 }, ["wolves", "headshot", "rider"], { perks: { bowB: 0.1, cavDmg: 0.1 }, icon: "crown" });
N("hunt", "volley", "Grad strzał", "Twoi strzelcy przeładowują o 15% szybciej.", 6, 0, { agi: 10, cha: 6 }, ["headshot"], { perks: { volleyB: 0.15 }, icon: "bow" });
N("hunt", "beastmaster", "Władca bestii", "Wilki ze Skupienia i Przyzwania silniejsze.", 6, 2, { agi: 10, int: 6 }, ["wolves", "rider"], { perks: { summonB: 0.3 }, icon: "wolf" });
// ---- Dowództwo (charyzma) ----
N("lead", "ld1", "Dowódca", "+5 ludzi w armii, lepsze morale.", 0, 1, { cha: 4 }, [], { skills: { leadership: 1 }, icon: "banner" });
N("lead", "pay", "Skrupulatny", "Żołd o 10% niższy.", 0, 0, { cha: 4 }, [], { perks: { wageB: 0.1 }, icon: "coin" });
N("lead", "trainer", "Instruktor", "Trening w obozie daje 50% więcej doświadczenia.", 0, 2, { cha: 4 }, [], { perks: { trainB: 0.5 }, icon: "sword" });
N("lead", "tr", "Kupiec", "Lepsze ceny kupna i sprzedaży.", 1, 0, { cha: 5 }, ["ld1", "pay"], { skills: { trade: 2 }, icon: "coin" });
N("lead", "ldx", "Werbownik", "+2 ochotników w każdej osadzie przy przychylności.", 1, 1, { cha: 5 }, ["ld1"], { perks: { recruitB: 2 }, icon: "man" });
N("lead", "med", "Felczer", "Ranni szybciej wracają, więcej rannych zamiast poległych.", 1, 2, { int: 5 }, ["ld1", "trainer"], { skills: { medicine: 2 }, icon: "cross" });
N("lead", "ld2", "Wódz", "+10 ludzi w armii. Daje Okrzyk bojowy.", 2, 1, { cha: 7 }, ["tr", "med", "ldx"], { skills: { leadership: 2 }, ability: "warcry", icon: "banner" });
N("lead", "haggle", "Targowanie", "Okup i sprzedaż jeńców +25%.", 2, 0, { cha: 6 }, ["tr"], { perks: { prisB: 0.25 }, icon: "chain" });
N("lead", "surgeon", "Chirurg", "Medycyna +2.", 2, 2, { int: 6 }, ["med"], { skills: { medicine: 2 }, icon: "cross" });
N("lead", "tac", "Taktyk", "Łatwiejsze ucieczki i lepsze morale na start bitwy.", 3, 1, { cha: 8, int: 5 }, ["ld2"], { skills: { tactics: 2, leadership: 1 }, icon: "crown" });
N("lead", "quarter", "Kwatermistrz", "Ludzie jedzą o 15% mniej, morale z jedzenia wyższe.", 3, 0, { cha: 6, int: 5 }, ["haggle", "ld2"], { perks: { food: 0.15 }, icon: "food" });
N("lead", "field", "Lazaret", "Po bitwie część poległych okazuje się tylko rannymi.", 3, 2, { int: 7 }, ["surgeon", "ld2"], { skills: { medicine: 2 }, icon: "heart" });
N("lead", "ld3", "Hetman", "+10 ludzi w armii.", 4, 1, { cha: 9 }, ["tac"], { skills: { leadership: 2 }, icon: "banner" });
N("lead", "logist", "Logistyk", "Drużyna maszeruje o 6% szybciej.", 4, 0, { cha: 8 }, ["quarter", "tac"], { perks: { mapSpeed: 0.06 }, icon: "wind" });
N("lead", "loyal", "Lojalność", "Kompani rzadziej się kłócą, nie odchodzą przez kłótnie.", 4, 2, { cha: 8 }, ["field", "tac"], { perks: { loyal: 1 }, icon: "heart" });
N("lead", "strategist", "Strateg", "Auto-bitwa liczy twoją taktykę podwójnie.", 5, 1, { cha: 9, int: 7 }, ["ld3"], { skills: { tactics: 2 }, icon: "scroll" });
N("lead", "banker", "Bankier", "Dochód z lenn +15%.", 5, 0, { cha: 9 }, ["logist"], { perks: { fiefB: 0.15 }, icon: "coin" });
N("lead", "envoy", "Dyplomata", "Relacje z lordami rosną o 25% szybciej.", 5, 2, { cha: 10 }, ["loyal"], { perks: { relB: 0.25 }, icon: "crown" });
N("lead", "king", "Urodzony władca", "+15 ludzi w armii, +10 morale na start bitwy.", 6, 1, { cha: 12 }, ["strategist", "banker", "envoy"], { skills: { leadership: 3 }, perks: { moraleB: 10 }, icon: "crown" });
N("lead", "drillmaster", "Musztrownik", "Awans jednostek tańszy o 25%.", 6, 0, { cha: 10 }, ["banker", "strategist"], { perks: { upB: 0.25 }, icon: "sword" });
// ---- Wiara (charyzma) ----
N("faith", "pray", "Pobożność", "Wiara odnawia się szybciej.", 0, 1, { cha: 4 }, [], { perks: { faith: 0.5 }, icon: "cross" });
N("faith", "pilgrim", "Pielgrzym", "Kapliczki dają więcej morale i wiary.", 0, 0, { cha: 4 }, [], { perks: { faith: 0.2 }, icon: "tent" });
N("faith", "chant", "Pieśń", "Morale na start bitwy +5.", 0, 2, { cha: 4 }, [], { perks: { moraleB: 5 }, icon: "mug" });
N("faith", "smite", "Smite", "Daje Smite: następny cios płonie świętym ogniem.", 1, 0, { cha: 5 }, ["pray", "pilgrim"], { ability: "smite", icon: "sun" });
N("faith", "ward", "Ochrona", "Klątwy i mrok zadają ci o 20% mniej.", 1, 1, { cha: 5 }, ["pray"], { perks: { magicRes: 0.2 }, icon: "shield" });
N("faith", "heal", "Modlitwa leczenia", "Daje Modlitwę leczenia.", 1, 2, { cha: 5, int: 4 }, ["pray", "chant"], { ability: "heal", skills: { medicine: 1 }, icon: "heart" });
N("faith", "zeal", "Gorliwość", "+10% obrażeń przeciw nieumarłym.", 2, 0, { cha: 6 }, ["smite"], { perks: { undeadB: 0.1 }, icon: "sun" });
N("faith", "pray2", "Żarliwość", "Wiara odnawia się jeszcze szybciej.", 2, 1, { cha: 6 }, ["ward", "smite", "heal"], { perks: { faith: 0.4 }, icon: "cross" });
N("faith", "mercy", "Miłosierdzie", "Leczenie mocniejsze o 30%.", 2, 2, { cha: 6, int: 5 }, ["heal"], { perks: { healB: 0.3 }, icon: "heart" });
N("faith", "smite2", "Słup światła", "Smite poziom 2: słup świętego światła przy kursorze.", 3, 0, { cha: 8 }, ["zeal"], { smite2: true, icon: "sun" });
N("faith", "templar", "Templariusz", "+3 pancerza w walce z nieumarłymi.", 3, 1, { cha: 7, str: 5 }, ["pray2"], { perks: { armorB: 0.02, undeadB: 0.05 }, icon: "shield" });
N("faith", "saint", "Męczennik", "Mniej spaczenia, więcej wiary z zabitych nieumarłych.", 3, 2, { cha: 7 }, ["mercy"], { perks: { corruptRes: 0.5, faith: 0.5 }, icon: "crown" });
N("faith", "exorcist", "Egzorcysta", "Nieumarli w pobliżu tracą siłę, gdy walczysz.", 4, 0, { cha: 8, int: 5 }, ["smite2", "templar"], { perks: { undeadB: 0.15 }, icon: "skull" });
N("faith", "pray3", "Łaska", "Wiara +30% odnowy, +10 zdrowia.", 4, 1, { cha: 8 }, ["templar"], { perks: { faith: 0.3, maxHp: 10 }, icon: "cross" });
N("faith", "relic", "Relikwia", "Raz na bitwę: śmiertelny cios zostawia cię z 1 zdrowia.", 4, 2, { cha: 8 }, ["saint", "templar"], { perks: { cheat: 1 }, icon: "star" });
N("faith", "crusade", "Krucjata", "Twoi ludzie +10% obrażeń przeciw nieumarłym.", 5, 1, { cha: 9 }, ["pray3", "exorcist"], { perks: { crusade: 0.1 }, icon: "banner" });
N("faith", "prophet", "Prorok", "Sława rośnie szybciej, bardowie śpiewają.", 5, 0, { cha: 9 }, ["exorcist"], { perks: { renownB: 0.2 }, icon: "crown" });
N("faith", "pure", "Czysta dusza", "Spaczenie rośnie dwa razy wolniej.", 5, 2, { cha: 9 }, ["relic"], { perks: { corruptRes: 0.3 }, icon: "drop" });
N("faith", "avatar", "Wcielenie światła", "Smite, leczenie i wiara mocniejsze o 25%.", 6, 1, { cha: 12 }, ["crusade", "prophet", "pure"], { perks: { faith: 0.5, healB: 0.25, undeadB: 0.1 }, icon: "sun" });
N("faith", "inquis", "Inkwizytor", "+15% obrażeń przeciw magom i nekromantom.", 6, 0, { cha: 10, str: 6 }, ["prophet"], { perks: { undeadB: 0.1 }, icon: "fire" });
// ---- Magia (intelekt) ----
N("magic", "flow", "Przepływ many", "Mana odnawia się szybciej.", 0, 1, { int: 4 }, [], { perks: { mana: 0.5 }, icon: "drop" });
N("magic", "scholar", "Uczony", "Doświadczenie +10%.", 0, 0, { int: 4 }, [], { perks: { xpB: 0.1 }, icon: "scroll" });
N("magic", "focusm", "Skupienie umysłu", "Spaczenie rośnie o 10% wolniej.", 0, 2, { int: 4 }, [], { perks: { corruptRes: 0.1 }, icon: "eye" });
N("magic", "fire", "Kula ognia", "Daje Kulę ognia.", 1, 1, { int: 5 }, ["flow"], { ability: "fireball", icon: "fire" });
N("magic", "lore", "Wiedza tajemna", "Doświadczenie +10%.", 1, 0, { int: 5 }, ["scholar", "flow"], { perks: { xpB: 0.1 }, icon: "scroll" });
N("magic", "flow2", "Studnia many", "Mana +40% odnowy.", 1, 2, { int: 6 }, ["flow", "focusm"], { perks: { mana: 0.4 }, icon: "drop" });
N("magic", "herb", "Zielarstwo", "Medycyna: ranni wracają szybciej.", 2, 0, { int: 6 }, ["fire", "lore"], { skills: { medicine: 2 }, icon: "leaf" });
N("magic", "burn", "Podpalacz", "Kula ognia podpala trafionych.", 2, 1, { int: 6 }, ["fire"], { perks: { fireDmg: 0.15 }, icon: "fire" });
N("magic", "pyro", "Ognista dusza", "+40% obrażeń Kuli ognia, mniejszy koszt many.", 2, 2, { int: 7 }, ["fire", "flow2"], { perks: { fireDmg: 0.4 }, icon: "fire" });
N("magic", "alch", "Alchemik", "Opatrunki leczą o 50% więcej.", 3, 0, { int: 7 }, ["herb"], { perks: { bandageB: 0.5 }, icon: "drop" });
N("magic", "shield", "Tarcza many", "Gdy mana > 50: +3 pancerza.", 3, 1, { int: 7 }, ["burn"], { perks: { manaShield: 0.03 }, icon: "shield" });
N("magic", "meteor", "Deszcz ognia", "Kula ognia ma większy zasięg wybuchu.", 3, 2, { int: 8 }, ["pyro"], { perks: { fireDmg: 0.2 }, icon: "fire" });
N("magic", "arch", "Arcymag", "Większa mana i mniej spaczenia.", 4, 1, { int: 9 }, ["herb", "pyro", "shield"], { perks: { mana: 0.5, corruptRes: 0.3 }, icon: "crown" });
N("magic", "seer", "Jasnowidz", "Zasięg wzroku na mapie +3.", 4, 0, { int: 8 }, ["alch"], { perks: { sightB: 3 }, icon: "eye" });
N("magic", "storm", "Burza", "Obrażenia ognia +20%.", 4, 2, { int: 9 }, ["meteor"], { perks: { fireDmg: 0.2 }, icon: "fire" });
N("magic", "sage", "Mędrzec", "Doświadczenie +15%, punkty drzewek łatwiej z ksiąg.", 5, 1, { int: 10 }, ["arch"], { perks: { xpB: 0.15 }, icon: "scroll" });
N("magic", "teleport", "Mgła", "Ucieczki przed pościgiem łatwiejsze.", 5, 0, { int: 9 }, ["seer"], { perks: { flee: 0.25 }, icon: "wind" });
N("magic", "phoenix", "Feniks", "Raz na bitwę: śmiertelny cios zostawia cię z 1 zdrowia.", 5, 2, { int: 10 }, ["storm"], { perks: { cheat: 1 }, icon: "fire" });
N("magic", "archon", "Archont", "Mana i ogień +30%, spaczenie −20%.", 6, 1, { int: 12 }, ["sage", "teleport", "phoenix"], { perks: { mana: 0.3, fireDmg: 0.3, corruptRes: 0.2 }, icon: "crown" });
N("magic", "runes", "Runy", "Twój pancerz +2.", 6, 0, { int: 10 }, ["sage"], { perks: { armorB: 0.02 }, icon: "star" });
// ---- Mrok (intelekt) ----
N("dark", "curse", "Klątwa", "Daje Klątwę osłabienia.", 0, 1, { int: 4 }, [], { ability: "curse", icon: "skull" });
N("dark", "whisper", "Szepty", "Plotki w karczmach zawsze coś ujawniają.", 0, 0, { int: 4 }, [], { perks: { sightB: 1 }, icon: "eye" });
N("dark", "fear", "Strach", "Wrogowie zaczynają bitwę z −5 morale.", 0, 2, { int: 4 }, [], { perks: { dread: 5 }, icon: "skull" });
N("dark", "blood", "Krwawy rytuał", "Daje Krwawy rytuał.", 1, 0, { int: 5, end: 5 }, ["curse", "whisper"], { ability: "blood", icon: "drop" });
N("dark", "hex", "Urok", "Klątwa trwa dłużej i obejmuje więcej wrogów.", 1, 1, { int: 5 }, ["curse"], { perks: { curseB: 0.3 }, icon: "eye" });
N("dark", "pact", "Pakt", "Spaczenie rośnie wolniej. Pozwala werbować nieumarłych.", 1, 2, { int: 6 }, ["curse", "fear"], { perks: { corruptRes: 0.4, undeadOk: 1 }, icon: "skull" });
N("dark", "leech", "Pijawka", "Każdy cios leczy o 4% obrażeń.", 2, 0, { int: 6 }, ["blood"], { perks: { lifeSteal: 0.04 }, icon: "drop" });
N("dark", "spirits", "Przyzwanie duchów", "Daje Przyzwanie wilczych duchów.", 2, 1, { int: 7 }, ["blood", "pact", "hex"], { ability: "summon", icon: "wolf" });
N("dark", "rot", "Zgnilizna", "Wrogowie w zasięgu klątwy tracą zdrowie.", 2, 2, { int: 7 }, ["pact"], { perks: { curseB: 0.2 }, icon: "skull" });
N("dark", "bone", "Kościana skóra", "+3 pancerza.", 3, 0, { int: 7, end: 6 }, ["leech"], { perks: { armorB: 0.03 }, icon: "skull" });
N("dark", "souls", "Zbieracz dusz", "Każde zabójstwo daje manę.", 3, 1, { int: 8 }, ["spirits"], { perks: { soulMana: 4 }, icon: "drop" });
N("dark", "plague", "Zaraza", "Wrogowie po bitwie mają więcej poległych zamiast rannych.", 3, 2, { int: 8 }, ["rot"], { perks: { plague: 1 }, icon: "skull" });
N("dark", "lich", "Władca kości", "Mana szybciej, nieumarli w armii nie dezerterują.", 4, 1, { int: 9 }, ["spirits", "souls"], { perks: { mana: 0.6 }, icon: "crown" });
N("dark", "vamp", "Wampir", "Każdy cios leczy o 6% obrażeń.", 4, 0, { int: 9, end: 6 }, ["bone"], { perks: { lifeSteal: 0.06 }, icon: "drop" });
N("dark", "dread", "Groza", "Wrogowie zaczynają bitwę z −10 morale.", 4, 2, { int: 9 }, ["plague"], { perks: { dread: 10 }, icon: "skull" });
N("dark", "necro", "Nekromanta", "Nieumarli w armii tańsi w żołdzie o 50%.", 5, 1, { int: 10 }, ["lich"], { perks: { undeadWage: 0.5 }, icon: "skull" });
N("dark", "deathless", "Bez śmierci", "Raz na bitwę: śmiertelny cios zostawia cię z 1 zdrowia.", 5, 0, { int: 10 }, ["vamp"], { perks: { cheat: 1 }, icon: "skull" });
N("dark", "shadow", "Cień Morvath", "Lordowie Morvath są wobec ciebie przychylniejsi.", 5, 2, { int: 10 }, ["dread"], { perks: { morvath: 1 }, icon: "moon" });
N("dark", "dlord", "Pan Mroku", "Mana, klątwy i kradzież życia +30%.", 6, 1, { int: 12 }, ["necro", "deathless", "shadow"], { perks: { mana: 0.3, curseB: 0.3, lifeSteal: 0.03 }, icon: "crown" });
N("dark", "rite", "Rytuał krwi", "Krwawy rytuał kosztuje mniej zdrowia.", 6, 0, { int: 11 }, ["deathless"], { perks: { bloodB: 0.3 }, icon: "drop" });
// ---- Kowalstwo (siła i intelekt) ----
N("smith", "sm1", "Czeladnik", "Kujesz dobrą jakość. +5% szans na udaną robotę.", 0, 1, { str: 4 }, [], { perks: { craftQ: 0.05 }, icon: "hammer" });
N("smith", "smeco", "Oszczędna ręka", "Przedmioty zużywają 10% mniej materiału.", 0, 0, { int: 4 }, [], { perks: { craftMat: 0.1 }, icon: "coin" });
N("smith", "smfast", "Rytm młota", "Kucie trwa o 15% krócej.", 0, 2, { str: 4 }, [], { perks: { craftTime: 0.15 }, icon: "wind" });
N("smith", "smrep", "Polowa kuźnia", "Naprawa w obozie o 10% wyżej, zestawy starczają na dłużej.", 1, 0, { str: 5 }, ["smeco", "sm1"], { perks: { repairCap: 0.1, kitB: 0.3 }, icon: "tent" });
N("smith", "smdis", "Rozbiórka", "Rozbierając sprzęt odzyskujesz o 20% więcej materiału.", 1, 1, { int: 5 }, ["sm1"], { perks: { dismantle: 0.2 }, icon: "hammer" });
N("smith", "smbar", "Targ u kowala", "Kowale liczą ci o 10% mniej.", 1, 2, { cha: 4, str: 4 }, ["smfast", "sm1"], { perks: { smithB: 0.1 }, icon: "coin" });
N("smith", "silverwork", "Srebrnik", "Umiesz kuć ze srebra: broń srebrna rani nieumarłych o 35% mocniej.", 2, 0, { int: 6 }, ["smrep", "smdis"], { perks: { silverwork: 1 }, icon: "star" });
N("smith", "smweap", "Płatnerz broni", "Wykuta broń +6% obrażeń.", 2, 1, { str: 6 }, ["smdis", "smbar"], { perks: { weaponsmith: 0.06 }, icon: "sword" });
N("smith", "smarm", "Płatnerz zbroi", "Wykuta zbroja +6% pancerza.", 2, 2, { str: 6, end: 5 }, ["smbar"], { perks: { armorer: 0.06 }, icon: "shield" });
N("smith", "dwarfwork", "Krasnoludzki sekret", "Umiesz kuć z rudy krasnoludów (+20% siły przedmiotu).", 3, 0, { str: 7, int: 6 }, ["silverwork"], { perks: { dwarfwork: 1 }, icon: "hammer" });
N("smith", "masterForge", "Mistrz kuźni", "Kujesz jakość mistrzowską.", 3, 1, { str: 7, int: 6 }, ["smweap", "smarm", "silverwork"], { perks: { masterForge: 1, craftQ: 0.05 }, icon: "crown" });
N("smith", "smbow", "Łuczarz", "Wykute łuki i kusze +8% siły.", 3, 2, { agi: 6, int: 5 }, ["smarm", "smweap"], { perks: { bowyer: 0.08 }, icon: "bow" });
N("smith", "smeco2", "Skąpiec kuźni", "Kolejne 10% mniej materiału.", 4, 0, { int: 7 }, ["dwarfwork"], { perks: { craftMat: 0.1 }, icon: "coin" });
N("smith", "smq2", "Pewna ręka", "+8% szans na udaną robotę.", 4, 1, { str: 8 }, ["masterForge"], { perks: { craftQ: 0.08 }, icon: "hammer" });
N("smith", "smfit", "Szyte na miarę", "Własny sprzęt leży lepiej: +2 pancerza.", 4, 2, { str: 7, end: 6 }, ["smbow", "masterForge"], { perks: { armorB: 0.02 }, icon: "shield" });
N("smith", "blackwork", "Czarna kuźnia", "Umiesz kuć z czarnej stali Morvatha. Moc za cenę spaczenia.", 5, 0, { int: 8 }, ["smeco2", "smq2"], { perks: { blackwork: 1 }, icon: "skull" });
N("smith", "smfast2", "Żar bez dymu", "Kucie o kolejne 20% krótsze.", 5, 1, { str: 9 }, ["smq2"], { perks: { craftTime: 0.2 }, icon: "fire" });
N("smith", "smweap2", "Ostrze z duszą", "Wykuta broń i zbroja kolejne +6%.", 5, 2, { str: 9 }, ["smfit", "smq2"], { perks: { weaponsmith: 0.06, armorer: 0.06 }, icon: "sword" });
N("smith", "legendForge", "Legendarny kowal", "Kujesz arcydzieła: przedmioty, o których śpiewają bardowie.", 6, 1, { str: 11, int: 8 }, ["smfast2", "blackwork", "smweap2"], { perks: { legendForge: 1, craftQ: 0.05 }, icon: "crown" });
N("smith", "smfame", "Sława kuźni", "Twoje wyroby sprzedają się drożej, kowale cię szanują.", 6, 0, { cha: 6 }, ["blackwork"], { perks: { smithB: 0.1, tradeB: 0.05 }, icon: "star" });
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
function perk(P: PlayerState, k: string) { return (P.perks?.[k] || 0) + equipFx(P, k) + traitFx(P, k); }

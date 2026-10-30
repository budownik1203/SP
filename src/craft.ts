// Rzemiosło i sprzęt (Build 0.20): materiały, wzory, kuźnia w mieście i we własnym zamku, nowe drzewko Kowalstwo,
// nazwy dla wykutej broni, rozbieranie sprzętu, zestawy naprawcze, przedmioty legendarne z wadami,
// barwy i godła oddziałów, sala trofeów.

// ---------- Materiały ----------
interface Mat { name: string; k: number; price: number; col: string; metal?: boolean; silver?: boolean; heavy?: boolean; good?: string; need?: string; }
const MATS: Record<string, Mat> = {
  iron: { name: "Żelazo", k: 1, price: 70, col: PAL.steel, metal: true, good: "iron" },
  steel: { name: "Stal", k: 1.12, price: 170, col: PAL.steelL, metal: true },
  silver: { name: "Srebro", k: 0.96, price: 260, col: "#cfcbc2", metal: true, silver: true, need: "silverwork" },
  dwarfore: { name: "Ruda krasnoludów", k: 1.2, price: 340, col: "#8a7a5a", metal: true, heavy: true, need: "dwarfwork" },
  blacksteel: { name: "Czarna stal Morvatha", k: 1.26, price: 420, col: "#2c2733", metal: true, need: "blackwork" },
  wood: { name: "Drewno", k: 1, price: 24, col: PAL.wood, good: "timber" },
  leather: { name: "Skóry", k: 1, price: 34, col: PAL.dirtL },
  bone: { name: "Kość i róg", k: 0.92, price: 16, col: PAL.bone },
};
function matHave(P: PlayerState, k: string) { const M = MATS[k]; return M.good ? Math.floor(P.goods[M.good] || 0) : Math.floor(((P as any).mats || {})[k] || 0); }
function matAdd(P: PlayerState, k: string, n: number) { const M = MATS[k]; if (M.good) P.goods[M.good] = Math.max(0, (P.goods[M.good] || 0) + n); else { const o = ((P as any).mats ||= {}); o[k] = Math.max(0, (o[k] || 0) + n); } }

// ---------- Wzory ----------
interface CPattern { id: string; base: string; name: string; metal: number; other: number; otherMat: string; hours: number; culture?: string; }
const PATTERNS: CPattern[] = [];
function PT(base: string, metal: number, other: number, otherMat: string, hours: number, culture?: string, name?: string) { PATTERNS.push({ id: base, base, name: name || ITEMS[base].name, metal, other, otherMat, hours, culture }); }
PT("w_dagger", 1, 1, "wood", 4); PT("w_axe", 2, 1, "wood", 8); PT("w_armsword", 3, 1, "leather", 10); PT("w_sword", 4, 1, "leather", 16); PT("w_mace", 4, 1, "wood", 14);
PT("w_spear", 2, 2, "wood", 8); PT("w_lance", 2, 3, "wood", 10); PT("w_hammer", 5, 1, "wood", 18); PT("w_longsword", 6, 1, "leather", 24); PT("w_greataxe", 6, 2, "wood", 22);
PT("kettle", 3, 1, "leather", 12); PT("nasal", 3, 1, "leather", 12); PT("coif", 3, 0, "leather", 14); PT("crest", 4, 1, "leather", 18); PT("great", 6, 1, "leather", 24);
PT("leather", 0, 5, "leather", 10); PT("mail", 8, 2, "leather", 36); PT("plate", 14, 3, "leather", 60); PT("gauntlets", 3, 1, "leather", 14); PT("greaves", 3, 1, "leather", 14);
PT("s_buckler", 2, 2, "wood", 6); PT("s_heater", 2, 4, "wood", 10); PT("b_short", 0, 4, "wood", 8); PT("b_long", 0, 6, "wood", 16); PT("x_light", 3, 3, "wood", 16); PT("x_heavy", 5, 4, "wood", 24);
// wzory kultur: inne kształty i własności, uczą ich kowale danej kultury albo rozebrany sprzęt
WEAPONS.aursword = { ...WEAPONS.sword, name: "Miecz aureliański", dmg: cut4(33, 44, 31), hilt: PAL.gold };
WEAPONS.gladius = { ...WEAPONS.armsword, name: "Gladius", reach: 18, dmg: cut4(26, 30, 36), windup: 0.38, recover: 0.36 };
WEAPONS.dwaxe = { ...WEAPONS.axe, name: "Topór krasnoludzki", dmg: cut4(34, 44, 16), windup: 0.52, head: PAL.steelL };
WEAPONS.cleaver = { ...WEAPONS.axe, name: "Tasak orków", reach: 20, dmg: cut4(38, 40, 10), windup: 0.56, recover: 0.56 };
WEAPONS.mvblade = { ...WEAPONS.longsword, name: "Ostrze nekropolii", dmg: cut4(38, 46, 36), blade: "#3a3442", hilt: PAL.purpleL };
I({ id: "w_aursword", name: "Miecz aureliański", slot: "weapon", price: 420, tier: 2, weapon: "aursword", culture: "aurelia" });
I({ id: "w_gladius", name: "Gladius", slot: "weapon", price: 300, tier: 2, weapon: "gladius", culture: "varus" });
I({ id: "w_dwaxe", name: "Topór krasnoludzki", slot: "weapon", price: 460, tier: 3, weapon: "dwaxe", culture: "dwarf" });
I({ id: "w_cleaver", name: "Tasak orków", slot: "weapon", price: 280, tier: 2, weapon: "cleaver", culture: "orc" });
I({ id: "w_mvblade", name: "Ostrze nekropolii", slot: "weapon", price: 700, tier: 3, weapon: "mvblade", culture: "undead" });
PT("w_aursword", 4, 1, "leather", 18, "aurelia"); PT("w_gladius", 3, 1, "wood", 12, "varus"); PT("w_dwaxe", 5, 1, "wood", 18, "dwarf"); PT("w_cleaver", 4, 2, "bone", 12, "orc"); PT("w_mvblade", 6, 2, "bone", 26, "undead");
const START_PATTERNS = ["w_dagger", "w_axe", "w_armsword", "w_spear", "leather", "s_buckler", "b_short", "kettle"];
function knownPatterns(P: PlayerState): string[] { return ((P as any).patterns ||= START_PATTERNS.slice()); }
function learnPattern(P: PlayerState, base: string) { const K = knownPatterns(P), pt = PATTERNS.find((x) => x.base === base); if (!pt || K.includes(base)) return false; K.push(base); return true; }

// ---------- Jakość i poziom kowala ----------
const CQUAL = [{ n: "Zwykła", k: 1, t: 1, m: 1 }, { n: "Dobra", k: 1.12, t: 1.5, m: 1.3 }, { n: "Mistrzowska", k: 1.26, t: 2.2, m: 1.7 }, { n: "Arcydzieło", k: 1.4, t: 3, m: 2.2 }];
function smithLevel(P: PlayerState) { return P.nodes.filter((id) => NODE(id)?.tree === "smith").length; }
function qualAllowed(P: PlayerState, q: number) { return q === 0 || (q === 1 && smithLevel(P) >= 1) || (q === 2 && perk(P, "masterForge") > 0) || (q === 3 && perk(P, "legendForge") > 0); }
function qualChance(P: PlayerState, q: number) { return clamp([1, 0.72, 0.5, 0.35][q] + smithLevel(P) * 0.03 + perk(P, "craftQ"), 0.1, 0.97); }

// Wykuty przedmiot: własna definicja zapisywana w stanie gracza (żeby przetrwała zapis gry).
interface Crafted { id: string; item: Item; wkey?: string; weapon?: Weapon; }
function registerCrafted(c: Crafted) { ITEMS[c.id] = c.item; if (c.wkey && c.weapon) WEAPONS[c.wkey] = c.weapon; }
function restoreCrafted(w: World) { for (const c of (((w.player as any).crafted || []) as Crafted[])) registerCrafted(c); }
function makeCrafted(P: PlayerState, pt: CPattern, mat: string, q: number, name: string): Crafted {
  const L = ((P as any).crafted ||= []) as Crafted[];
  const n = L.length + 1 + Math.floor(rnd() * 1000) * 100;
  const id = `c${n}`, base = ITEMS[pt.base], M = MATS[mat];
  const k = M.k * CQUAL[q].k * (1 + (base.slot === "weapon" ? perk(P, "weaponsmith") : base.slot === "bow" ? perk(P, "bowyer") : perk(P, "armorer")));
  const item: Item = { ...base, id, name, price: Math.round(base.price * k * (1 + q * 0.6)), tier: Math.min(4, base.tier + (q >= 2 ? 1 : 0)) };
  (item as any).crafted = { mat, q, by: P.name, pattern: pt.base };
  if (base.armor) item.armor = +(base.armor * k).toFixed(3);
  if (base.bowDmg) item.bowDmg = Math.round(base.bowDmg * k);
  let wkey: string | undefined, weapon: Weapon | undefined;
  if (base.weapon) {
    const W0 = WEAPONS[base.weapon];
    const dmg = { ...W0.dmg }; for (const d of Object.keys(dmg) as Dir[]) dmg[d] = Math.round(dmg[d] * k);
    wkey = "cw" + n;
    weapon = { ...W0, name, dmg, blade: M.metal ? M.col : W0.blade, windup: W0.windup * (M.heavy ? 1.05 : 1) * (q >= 2 ? 0.97 : 1) };
    if (M.silver) (weapon as any).silver = true;
    item.weapon = wkey;
  }
  if (M.silver) (item as any).fx = { undeadB: 0.35 };
  if (mat === "blacksteel") (item as any).fx = { meleeDmg: 0.04, corruptDay: 0.4 };
  const c: Crafted = { id, item, wkey, weapon };
  L.push(c); registerCrafted(c);
  return c;
}

// ---------- Ekran kuźni ----------
const FORGE = { pat: "", mat: "iron", q: 0 };
function forgeAvailable(w: World, s: Settlement) { return (s.kind === "town" && !playerAtWarWith(w, s.faction)) || (s.owner === -2 && s.kind !== "village"); }
function showForge(s: Settlement) {
  const w = WORLD, P = w.player;
  const K = knownPatterns(P);
  if (!FORGE.pat || !K.includes(FORGE.pat)) FORGE.pat = K[0];
  const pt = PATTERNS.find((x) => x.base === FORGE.pat)!;
  const base = ITEMS[pt.base];
  const metals = Object.keys(MATS).filter((k) => MATS[k].metal && (!MATS[k].need || perk(P, MATS[k].need) > 0));
  if (pt.metal === 0) FORGE.mat = pt.otherMat; else if (!metals.includes(FORGE.mat)) FORGE.mat = "iron";
  const own = s.owner === -2;
  const q = Math.min(FORGE.q, 3);
  const red = 1 - perk(P, "craftMat");
  const needMetal = Math.ceil(pt.metal * CQUAL[q].m * red), needOther = Math.ceil(pt.other * CQUAL[q].m * red);
  const hours = Math.round(pt.hours * CQUAL[q].t * (1 - perk(P, "craftTime")) * (own ? 0.85 : 1));
  const fee = own ? 0 : Math.round(15 + pt.hours * 2 * (1 - perk(P, "smithB")));
  const haveM = pt.metal ? matHave(P, FORGE.mat) : 99, haveO = pt.other ? matHave(P, pt.otherMat) : 99;
  const ok = haveM >= needMetal && haveO >= needOther && P.gold >= fee && qualAllowed(P, q);
  const preview = (() => { const M = MATS[pt.metal ? FORGE.mat : pt.otherMat]; const k = M.k * CQUAL[q].k; if (base.weapon) { const W0 = WEAPONS[base.weapon]; return `obrażenia ok. ${Math.round(((W0.dmg.L + W0.dmg.O + W0.dmg.T) / 3) * k)} (zwykły ${Math.round((W0.dmg.L + W0.dmg.O + W0.dmg.T) / 3)})${M.silver ? " · +35% przeciw nieumarłym" : ""}${FORGE.mat === "blacksteel" ? " · spaczenie" : ""}`; } if (base.armor) return `pancerz ${Math.round(base.armor * k * 100)} (zwykły ${Math.round(base.armor * 100)})`; if (base.bowDmg) return `siła ${Math.round(base.bowDmg * k)}`; return ""; })();
  const patList = PATTERNS.filter((x) => K.includes(x.base)).map((x) => `<button class="mini ${x.base === FORGE.pat ? "on" : ""}" data-a="fp" data-v="${x.base}">${x.name}${x.culture ? " ★" : ""}</button>`).join("");
  const matBtns = pt.metal ? metals.map((k) => `<button class="mini ${k === FORGE.mat ? "on" : ""}" data-a="fm" data-v="${k}">${MATS[k].name} (${matHave(P, k)})</button>`).join("") : `<span class="muted">${MATS[pt.otherMat].name}</span>`;
  const qBtns = CQUAL.map((Q, i) => `<button class="mini ${i === q ? "on" : ""}" data-a="fq" data-v="${i}" ${qualAllowed(P, i) ? "" : "disabled"} title="${qualAllowed(P, i) ? `szansa ${Math.round(qualChance(P, i) * 100)}%` : i === 1 ? "wymaga 1 węzła Kowalstwa" : i === 2 ? "wymaga węzła Mistrz kuźni" : "wymaga węzła Legendarny kowal"}">${Q.n}</button>`).join("");
  const stock = Object.keys(MATS).map((k) => `${MATS[k].name}: <b>${matHave(P, k)}</b>`).join(" · ");
  const defName = `${pt.metal && FORGE.mat !== "iron" ? MATS[FORGE.mat].name.split(" ")[0] + "owy " : ""}${base.name.charAt(0).toLowerCase() + base.name.slice(1)}`.replace(/^./, (c) => c.toUpperCase());
  showScr(`<div class="card frame forge">
    <h1>${ic("hammer")} Kuźnia ${own ? "w twoim zamku" : `w ${s.name}`}</h1>
    <p class="tip">Poziom kowalstwa: <b>${smithLevel(P)}</b> (drzewko Kowalstwo w oknie postaci). Wzory poznajesz, rozbierając sprzęt u kowala, z ksiąg i od kowali innych kultur.</p>
    <p class="muted">Masz: ${stock} · zestawy naprawcze: ${(P as any).kits || 0}</p>
    <h2>Wzór</h2><div class="fbar">${patList}</div>
    <h2>Materiał</h2><div class="fbar">${matBtns}</div>
    <h2>Jakość</h2><div class="fbar">${qBtns}</div>
    <div class="row"><span><b>${defName}</b> · ${preview}<br><span class="muted">potrzeba: ${pt.metal ? `${needMetal}× ${MATS[FORGE.mat].name} (masz ${haveM})` : ""}${pt.metal && pt.other ? ", " : ""}${pt.other ? `${needOther}× ${MATS[pt.otherMat].name} (masz ${haveO})` : ""} · czas ${hours} godz.${fee ? ` · opłata za kuźnię ${fee}` : ""}${q > 0 ? ` · szansa na tę jakość ${Math.round(qualChance(P, q) * 100)}%` : ""}</span></span></div>
    <label class="opt"><span>Nazwa (opcjonalnie)</span><input id="fname" maxlength="28" placeholder="${esc(defName)}"></label>
    <div class="btns"><button class="alt" data-a="back">Wróć</button><button data-a="forge" ${ok ? "" : "disabled"}>Kuj</button></div></div>`, {
    fp: (v) => { FORGE.pat = v; showForge(s); }, fm: (v) => { FORGE.mat = v; showForge(s); }, fq: (v) => { FORGE.q = Number(v); showForge(s); },
    back: () => { closeScreen(); enterSettlement(s); },
    forge: () => {
      const nm = ((document.getElementById("fname") as HTMLInputElement)?.value || "").trim().slice(0, 28) || defName;
      if (pt.metal) matAdd(P, FORGE.mat, -needMetal); if (pt.other) matAdd(P, pt.otherMat, -needOther); P.gold -= fee;
      let got = q; while (got > 0 && !chance(qualChance(P, got))) got--;
      const mat = pt.metal ? FORGE.mat : pt.otherMat;
      closeScreen(); sfx.hammer?.();
      G.waitHours = hours; G.camping = true; playerParty(w).state = "camp";
      pendingAfterWait = () => {
        const c = makeCrafted(P, pt, mat, got, got < q ? `${nm}` : nm);
        P.items.push(c.id);
        const L: string[] = []; gainXp(P, 20 + pt.hours * (1 + got), L);
        chron(w, `${P.name} wykuwa ${c.item.name} (${CQUAL[got].n.toLowerCase()} robota${MATS[mat].metal ? `, ${MATS[mat].name.toLowerCase()}` : ""}).`, PAL.gold);
        showScr(`<div class="dialog frame"><h1>${ic("hammer")} ${esc(c.item.name)}</h1><p>${got < q ? `Coś poszło nie tak przy hartowaniu. Wyszła robota ${CQUAL[got].n.toLowerCase()}, nie ${CQUAL[q].n.toLowerCase()}.` : `${CQUAL[got].n} robota. Ostygła stal dzwoni czysto.`}</p><p class="tip">${itemStat(c.item)}</p><p class="muted">${L.join(" ")}</p><div class="btns"><button data-a="ok">Dalej</button></div></div>`, { ok: () => { closeScreen(); showForge(s); } }, "dialog-scr");
      };
      toast(`Kujesz: ${nm} (${hours} godz.).`);
    },
  }, "forge-scr");
}

// Rozbiórka: odzysk części materiału i poznanie wzoru.
function dismantleItem(P: PlayerState, idx: number): string {
  const id = P.items[idx]; const it = ensureItem(id); if (!it) return "";
  const cr = (it as any).crafted;
  const b = cr ? cr.pattern : baseOf(id);
  const pt = PATTERNS.find((x) => x.base === b);
  P.items.splice(idx, 1);
  const back = 0.4 + perk(P, "dismantle");
  const lines: string[] = [];
  if (pt) {
    const mat = cr?.mat && MATS[cr.mat].metal ? cr.mat : "iron";
    if (pt.metal) { const n = Math.max(1, Math.floor(pt.metal * back)); matAdd(P, mat, n); lines.push(`${n}× ${MATS[mat].name}`); }
    if (pt.other) { const n = Math.floor(pt.other * back); if (n) { matAdd(P, pt.otherMat, n); lines.push(`${n}× ${MATS[pt.otherMat].name}`); } }
    if (learnPattern(P, b)) lines.push(`poznajesz wzór: ${pt.name}`);
  } else { matAdd(P, "iron", Math.max(1, it.tier)); lines.push(`${Math.max(1, it.tier)}× żelazo`); }
  return `Rozebrane: ${it.name}. Odzysk: ${lines.join(", ")}.`;
}

// Co sprzedaje kowal: materiały zależne od kultury i bogactwa, zestawy naprawcze, wzór kultury.
function smithMats(s: Settlement): string[] {
  const L = ["iron", "wood", "leather"];
  if (s.prosperity > 45 || s.culture === "dwarf") L.push("steel");
  if (s.culture === "aurelia" || s.culture === "varus") L.push("silver");
  if (s.culture === "dwarf") L.push("dwarfore");
  if (s.culture === "orc") L.push("bone");
  if (s.culture === "undead") L.push("blacksteel", "bone");
  return L;
}
function matPrice(s: Settlement, k: string, buy: boolean) { const M = MATS[k]; const cheap = (s.culture === "dwarf" && (k === "dwarfore" || k === "steel")) || (s.culture === "undead" && k === "blacksteel") || (s.culture === "orc" && k === "bone"); return Math.round(M.price * (cheap ? 0.75 : 1) * (buy ? 1 : 0.5)); }
function smithCraftHtml(s: Settlement): string {
  const w = WORLD, P = w.player;
  const mats = smithMats(s);
  const cpat = PATTERNS.find((x) => x.culture === s.culture && !knownPatterns(P).includes(x.base));
  const unk = PATTERNS.filter((x) => !x.culture && !knownPatterns(P).includes(x.base) && ITEMS[x.base].tier <= (s.prosperity > 60 ? 3 : 2));
  const teach = unk.length ? unk[hashInt(s.seed + Math.floor(w.day / 10)) % unk.length] : null;
  return `<h2>${ic("hammer")} Kuźnia i materiały</h2>
    <div class="row"><span>Sam wykuj broń albo zbroję z własnych materiałów.</span><button class="mini" data-a="forgeOpen">Otwórz kuźnię</button></div>
    <table class="tbl">${mats.map((k) => `<tr><td>${MATS[k].name}<br><span class="muted">masz ${matHave(P, k)}</span></td><td>${matPrice(s, k, true)}</td><td><button class="mini" data-a="matB" data-v="${k}" ${P.gold >= matPrice(s, k, true) ? "" : "disabled"}>Kup</button><button class="mini" data-a="matS" data-v="${k}" ${matHave(P, k) > 0 ? "" : "disabled"}>Sprzedaj</button></td></tr>`).join("")}
    <tr><td>Zestaw naprawczy<br><span class="muted">naprawa w obozie do ok. 70% · masz ${(P as any).kits || 0}</span></td><td>45</td><td><button class="mini" data-a="kitB" ${P.gold >= 45 ? "" : "disabled"}>Kup</button></td></tr></table>
    ${cpat ? `<div class="row"><span>${ic("star")} Kowal zna wzór swojej kultury: <b>${cpat.name}</b></span><button class="mini" data-a="teach" data-v="${cpat.base}" ${P.gold >= 400 ? "" : "disabled"}>Naucz się (400)</button></div>` : ""}
    ${teach ? `<div class="row"><span>Pokaże ci też wzór: <b>${teach.name}</b></span><button class="mini" data-a="teach" data-v="${teach.base}" ${P.gold >= Math.round(ITEMS[teach.base].price * 0.8) ? "" : "disabled"}>Naucz się (${Math.round(ITEMS[teach.base].price * 0.8)})</button></div>` : ""}`;
}
function smithCraftActs(s: Settlement, re: () => void): Acts {
  const P = WORLD.player;
  return {
    forgeOpen: () => showForge(s),
    matB: (k) => { const c = matPrice(s, k, true); if (P.gold < c) return; P.gold -= c; matAdd(P, k, 1); sfx.coin(); re(); },
    matS: (k) => { if (matHave(P, k) <= 0) return; matAdd(P, k, -1); P.gold += matPrice(s, k, false); sfx.coin(); re(); },
    kitB: () => { if (P.gold < 45) return; P.gold -= 45; (P as any).kits = ((P as any).kits || 0) + 1; sfx.coin(); re(); },
    teach: (b) => { const pt = PATTERNS.find((x) => x.base === b); if (!pt) return; const c = pt.culture ? 400 : Math.round(ITEMS[b].price * 0.8); if (P.gold < c) return; P.gold -= c; learnPattern(P, b); toast(`Nowy wzór: ${pt.name}.`, PAL.gold); re(); },
    dism: (v) => { const r = dismantleItem(P, Number(v)); if (r) toast(r, PAL.gold); sfx.hammer?.(); re(); },
  };
}

// Materiały z lenn (kopalnie, lasy) i z bestii.
function craftDaily(w: World) {
  const P = w.player as any;
  const F = (P.matsF ||= {});
  for (const s of w.settlements) if (s.owner === -2) {
    if (s.kind === "village") { F.wood = (F.wood || 0) + 0.25; F.leather = (F.leather || 0) + 0.2; }
    else { F.iron = (F.iron || 0) + (s.kind === "castle" ? 0.35 : 0.25); if (s.culture === "dwarf") F.dwarfore = (F.dwarfore || 0) + 0.12; if (s.culture === "undead") F.blacksteel = (F.blacksteel || 0) + 0.08; if (s.prosperity > 60) F.steel = (F.steel || 0) + 0.1; }
  }
  const got: string[] = [];
  for (const k of Object.keys(F)) { const n = Math.floor(F[k]); if (n > 0) { F[k] -= n; matAdd(w.player, k, n); got.push(`${n}× ${MATS[k].name}`); } }
  if (got.length && w.day % 7 === 0) addLogMsg(`Z twoich ziem przywieziono: ${got.join(", ")}.`, PAL.gold);
  // spaczenie od czarnej stali i legend
  const cd = equipFx(w.player, "corruptDay"); if (cd) w.player.corruption = Math.min(100, w.player.corruption + cd);
  const hd = equipFx(w.player, "honorDay"); if (hd) w.player.honor += hd;
}
function beastLoot(P: PlayerState, enemyFaction: number, kills: number, lines: string[]) {
  if (enemyFaction === 7) { const l = Math.max(1, Math.floor(kills * 0.6)), b = Math.floor(kills * 0.4); matAdd(P, "leather", l); if (b) matAdd(P, "bone", b); lines.push(`Skóry i kły bestii: ${l}× skóry${b ? `, ${b}× kość` : ""}.`); }
  if (enemyFaction === 5) { const b = Math.max(1, Math.floor(kills * 0.3)); matAdd(P, "bone", b); let t = `Kości nieumarłych: ${b}.`; if (chance(0.25)) { matAdd(P, "blacksteel", 1); t += " W popiele leży sztaba czarnej stali."; } lines.push(t); }
}

// ---------- Przedmioty legendarne: zalety i wady ----------
interface Legend { id: string; name: string; slot: ESlot; base: string; k: number; fx: Record<string, number>; text: string; }
const LEGENDS: Legend[] = [
  { id: "l_widow", name: "Wdowie Żądło", slot: "weapon", base: "w_sword", k: 1.3, fx: { lifeSteal: 0.08, heal: -0.3 }, text: "Pije krew wrogów, ale rany właściciela goją się wolniej." },
  { id: "l_oath", name: "Przysięga Ilveny", slot: "weapon", base: "w_longsword", k: 1.32, fx: { undeadB: 0.4, honorDay: 0.05 }, text: "Święte ostrze Korony. Wymaga honoru: kłamcom ciąży." },
  { id: "l_ghrakk", name: "Szczęka Ghrakka", slot: "weapon", base: "w_greataxe", k: 1.38, fx: { twoHand: 0.1, moraleB: -5 }, text: "Topór wodza hordy. Twoi ludzie boją się go bardziej niż wrogowie." },
  { id: "l_anvil", name: "Kowadło Przodków", slot: "weapon", base: "w_hammer", k: 1.34, fx: { shieldBreak: 1, swing: -0.08 }, text: "Kruszy tarcze jak skorupki, ale jest przeraźliwie ciężki." },
  { id: "l_mourn", name: "Żałobny Dzwon", slot: "weapon", base: "w_mace", k: 1.3, fx: { dread: 6, corruptDay: 0.2 }, text: "Każdy cios brzmi jak dzwon pogrzebowy. Mrok lgnie do właściciela." },
  { id: "l_needle", name: "Igła Kassii", slot: "weapon", base: "w_armsword", k: 1.35, fx: { headDmg: 0.3, armorB: -0.03 }, text: "Szybka i celna. Właściciel musi tańczyć, nie stać." },
  { id: "l_storm", name: "Grot Burzy", slot: "weapon", base: "w_lance", k: 1.4, fx: { cavDmg: 0.25, mapSpeed: -0.03 }, text: "Kopia, która sama szuka serc. Długa i niewygodna w marszu." },
  { id: "l_wolfspear", name: "Wilczy Kieł", slot: "weapon", base: "w_spear", k: 1.32, fx: { beastB: 0.4, sightB: 1 }, text: "Grot z kła wilkora. Bestie czują go z daleka." },
  { id: "l_ashcrown", name: "Korona z Popiołu", slot: "head", base: "great", k: 1.3, fx: { moraleB: 8, corruptDay: 0.3 }, text: "Hełm dawnego króla Morvatha. Ludzie idą za nim jak w transie." },
  { id: "l_raven", name: "Kaptur Kruka", slot: "head", base: "hood", k: 2.2, fx: { sightB: 2, backstab: 0.2, honorDay: -0.03 }, text: "Kaptur skrytobójcy. Widzi dalej, ale cień kradnie honor." },
  { id: "l_runehelm", name: "Hełm Runów Durgana", slot: "head", base: "dwarfhelm", k: 1.3, fx: { armorB: 0.03, mapSpeed: -0.02 }, text: "Ciężki, nieprzebity, krasnoludzki." },
  { id: "l_saint", name: "Hełm Świętego Wita", slot: "head", base: "crest", k: 1.3, fx: { faith: 0.3, undeadB: 0.15 }, text: "Błogosławiony. Modlitwy płyną z nim łatwiej." },
  { id: "l_bloodmail", name: "Krwawa Kolczuga", slot: "body", base: "mail", k: 1.35, fx: { berserk: 0.15, heal: -0.2 }, text: "Im bardziej krwawisz, tym mocniej bijesz. Rany jednak się jątrzą." },
  { id: "l_bastion", name: "Bastion Valmory", slot: "body", base: "plate", k: 1.25, fx: { armorB: 0.04, stamina: -0.15 }, text: "Najcięższa zbroja Korony. Oddech kończy się szybko." },
  { id: "l_shroud", name: "Całun Nekromanty", slot: "body", base: "robe", k: 3, fx: { mana: 0.4, corruptDay: 0.4 }, text: "Mana płynie z nim jak rzeka, a dusza gnije." },
  { id: "l_wolfhide", name: "Futro Wilkora", slot: "body", base: "leather", k: 1.6, fx: { beastB: 0.2, food: 0.1 }, text: "Ciepłe i twarde. Drużyna mniej marznie i mniej je." },
  { id: "l_ironfist", name: "Żelazne Pięści", slot: "hands", base: "gauntlets", k: 1.5, fx: { blockCost: -0.2, swing: -0.03 }, text: "Blok nic nie kosztuje, ale ręce są wolniejsze." },
  { id: "l_pilgrim", name: "Buty Pielgrzyma", slot: "feet", base: "boots", k: 2, fx: { mapSpeed: 0.06, armorB: -0.01 }, text: "Przeszły pół świata. Lekkie, ale cienkie." },
  { id: "l_wall", name: "Ściana Khazgrim", slot: "shield", base: "s_heater", k: 1.5, fx: { shieldHp: 1.5, swing: -0.04 }, text: "Tarcza, której nikt nie przebił. Ciągnie ramię w dół." },
  { id: "l_moonbow", name: "Łuk Księżyca", slot: "bow", base: "b_long", k: 1.3, fx: { bowB: 0.15, sightB: 1 }, text: "Strzały lecą cicho jak sowy. W nocy widać dalej." },
];
for (const L of LEGENDS) {
  const b = ITEMS[L.base];
  const it: Item = { ...b, id: L.id, name: L.name, price: Math.round(b.price * L.k * 6 + 1500), tier: 5 };
  if (b.armor) it.armor = +(b.armor * L.k).toFixed(3);
  if (b.bowDmg) it.bowDmg = Math.round(b.bowDmg * L.k);
  if (b.weapon) { const W0 = WEAPONS[b.weapon], dmg = { ...W0.dmg }; for (const d of Object.keys(dmg) as Dir[]) dmg[d] = Math.round(dmg[d] * L.k); WEAPONS["lw_" + L.id] = { ...W0, name: L.name, dmg, blade: L.fx.corruptDay ? "#3a3442" : L.fx.undeadB ? PAL.gold : W0.blade }; it.weapon = "lw_" + L.id; }
  (it as any).fx = L.fx; (it as any).legend = L.text;
  ITEMS[L.id] = it;
  UNIQUES.push(L.id);
}
// Zalety i wady założonych przedmiotów działają jak premie z drzewek.
function equipFx(P: PlayerState, k: string): number {
  let v = 0;
  for (const id of Object.values(P.equip || {})) { if (!id) continue; const it = ITEMS[id]; const fx = it && (it as any).fx; if (fx && fx[k]) v += fx[k]; }
  return v;
}
function legendNote(it: Item | null): string { if (!it) return ""; const t = (it as any).legend; const fx = (it as any).fx; if (!t && !fx) return ""; return `${t ? t + " " : ""}${fx ? Object.entries(fx).map(([k, v]) => `${FX_NAME[k] || k} ${(v as number) > 0 ? "+" : ""}${Math.abs(v as number) < 1 ? Math.round((v as number) * 100) + "%" : v}`).join(", ") : ""}`; }
const FX_NAME: Record<string, string> = { lifeSteal: "kradzież życia", heal: "leczenie", undeadB: "przeciw nieumarłym", honorDay: "honor dziennie", twoHand: "broń dwuręczna", moraleB: "morale", shieldBreak: "łamanie tarcz", swing: "szybkość zamachu", dread: "strach wrogów", corruptDay: "spaczenie dziennie", headDmg: "ciosy w głowę", armorB: "pancerz", cavDmg: "z konia", mapSpeed: "marsz", beastB: "przeciw bestiom", sightB: "wzrok", backstab: "cios w plecy", faith: "wiara", berserk: "szał", stamina: "wytrzymałość", mana: "mana", food: "jedzenie", blockCost: "koszt bloku", shieldHp: "wytrzymałość tarczy", bowB: "łuk", meleeDmg: "obrażenia" };

// ---------- Barwy oddziałów ----------
const PAINT_COLS = [PAL.red, PAL.bloodD, PAL.goldD, PAL.moss, PAL.grassD, PAL.steelD, PAL.slate, PAL.purple, PAL.dusk, PAL.bone, PAL.dirt, PAL.ink, PAL.waterL, PAL.rust];
const PAINT_TRIMS = [PAL.gold, PAL.bone, PAL.white, PAL.redL, PAL.black, PAL.steelL, PAL.purpleL, PAL.moss];
function squadPaint(P: PlayerState): Record<number, { main: string; trim: string; charge: string }> { return ((P as any).squadPaint ||= {}); }
function paintTab(): string {
  const P = WORLD.player, SP = squadPaint(P);
  const sw = (sq: number, k: "main" | "trim", list: string[]) => list.map((c) => `<button class="sw ${SP[sq]?.[k] === c ? "on" : ""}" style="background:${c}" data-a="pc" data-v="${sq}:${k}:${c}" title="${c}"></button>`).join("");
  const ch = (sq: number) => ["none", ...Object.keys(CHARGE_PIX)].map((c) => `<button class="mini ${(SP[sq]?.charge || "none") === c ? "on" : ""}" data-a="pc" data-v="${sq}:charge:${c}">${c === "none" ? "bez godła" : { star: "gwiazda", crown: "korona", skull: "czaszka", sword: "miecz", tower: "wieża", wolf: "wilk", cross: "krzyż", moon: "księżyc" }[c] || c}</button>`).join("");
  return `<p class="tip">Barwy tabardów, tarcz i chorągwi każdego oddziału w bitwie. Godło trafia na tarcze i proporce. Zostaw puste, by oddział nosił barwy twojej frakcji.</p>
    ${[1, 2, 3, 4, 5].map((sq) => `<div class="paintrow"><b style="color:${SQUAD_COLORS[sq]}">${SQUAD_NAMES[sq]}</b>${paintPreview(sq)}<div><div class="swatches">${sw(sq, "main", PAINT_COLS)}</div><div class="swatches">${sw(sq, "trim", PAINT_TRIMS)}</div><div class="fbar">${ch(sq)}</div><button class="mini" data-a="pclr" data-v="${sq}">Domyślne</button></div></div>`).join("")}`;
}
function paintPreview(sq: number) {
  const P = WORLD.player, p = playerParty(WORLD);
  const t = p.troops.find((x) => (((P as any).squadOf || {})[x.type] || squadOfUnit(UNITS[x.type])) === sq);
  const key = t ? t.type : sq === 2 ? "a_archer" : sq === 3 ? "a_knight" : "a_recruit";
  const L = paintedLook(troopLook(UNITS[key], 5, PLAYER_FACTION), sq);
  return pic(spritesFor(L, "paint:" + key + JSON.stringify(squadPaint(P)[sq] || {})).frames[0][0], "sprite", 2);
}
function squadOfUnit(d: UnitDef) { return d.mount ? 3 : d.bow ? 2 : 1; }
function paintedLook(L: Look, sq: number): Look { return applyPaint(L, squadPaint(WORLD.player)[sq]); }
function applyPaint(L: Look, S?: { main: string; trim: string; charge: string }): Look {
  if (!S || !L.tabard) return L;
  const sh = S.main === PAL.bone ? PAL.ash : PAL.ink;
  return { ...L, tabard: { ...L.tabard, main: S.main || L.tabard.main, shade: sh, trim: S.trim || L.tabard.trim }, cape: L.cape ? [S.main || L.cape[0], sh] : undefined, charge: S.charge && S.charge !== "none" ? S.charge : undefined } as Look;
}
function paintActs(re: () => void): Acts {
  const P = WORLD.player;
  return {
    pc: (v) => { const [sq, k, c] = v.split(":"); const SP = squadPaint(P); const o = (SP[Number(sq)] ||= { main: "", trim: "", charge: "none" }) as any; o[k] = c; re(); },
    pclr: (v) => { delete squadPaint(P)[Number(v)]; re(); },
  };
}

// ---------- Trofea ----------
interface Trophy { id: number; kind: "banner" | "weapon" | "head"; name: string; faction: number; lord?: number; day: number; }
function trophies(P: PlayerState): Trophy[] { return ((P as any).trophies ||= []); }
function addTrophy(P: PlayerState, t: Omit<Trophy, "id" | "day">) { const L = trophies(P); L.push({ ...t, id: (L.length ? L[L.length - 1].id : 0) + 1, day: WORLD.day }); }
function trophyBonus(P: PlayerState) { const hall = WORLD.settlements.some((s) => s.owner === -2 && s.kind !== "village"); return hall ? Math.min(12, trophies(P).length) : 0; }
function trophyHtml(s: Settlement): string {
  const P = WORLD.player, L = trophies(P);
  return `<h2>${ic("banner")} Sala trofeów</h2><p class="tip">Każde trofeum w sali dodaje +1 do morale na starcie bitwy i trochę sławy (do 12). Zwrot sztandaru jego panu poprawia relacje.</p>
    ${L.length ? `<table class="tbl">${L.map((t) => `<tr><td>${t.kind === "banner" ? ic("banner") : t.kind === "head" ? ic("skull") : ic("sword")} ${esc(t.name)}<br><span class="muted">dzień ${t.day}${t.faction ? ` · ${factionShort(t.faction)}` : ""}</span></td><td><button class="mini" data-a="trS" data-v="${t.id}">Sprzedaj (${t.kind === "banner" ? 120 : 60})</button>${t.kind === "banner" && t.lord !== undefined && lordById(WORLD, t.lord)?.alive ? `<button class="mini" data-a="trR" data-v="${t.id}">Odeślij ${lordById(WORLD, t.lord).name}</button>` : ""}</td></tr>`).join("")}</table>` : "<p class='muted'>Ściany są puste. Pokonaj lorda w bitwie, by zdobyć jego sztandar.</p>"}`;
}
function trophyActs(re: () => void): Acts {
  const w = WORLD, P = w.player;
  return {
    trS: (v) => { const L = trophies(P), t = L.find((x) => x.id === Number(v)); if (!t) return; (P as any).trophies = L.filter((x) => x !== t); P.gold += t.kind === "banner" ? 120 : 60; sfx.coin(); re(); },
    trR: (v) => { const L = trophies(P), t = L.find((x) => x.id === Number(v)); if (!t || t.lord === undefined) return; const lord = lordById(w, t.lord); (P as any).trophies = L.filter((x) => x !== t); if (lord) rel(lord, 12, "odesłałeś mu sztandar"); w.factions[t.faction] && (w.factions[t.faction].relation[PLAYER_FACTION] = (w.factions[t.faction].relation[PLAYER_FACTION] || 0) + 5); P.honor += 2; toast(`Sztandar wraca do ${lord?.name}. Gest zostanie zapamiętany.`, PAL.gold); re(); },
  };
}
// Po bitwie z lordem: jego sztandar, czasem broń legendarna (wielcy lordowie i władcy).
function lordSpoils(P: PlayerState, L: Lord, lines: string[], lootItems: string[]) {
  addTrophy(P, { kind: "banner", name: `Sztandar: ${L.title} ${L.name}`, faction: L.faction, lord: L.id });
  lines.push(`Zdobywasz sztandar: ${L.title} ${L.name}. Zawieś go w sali trofeów swojego zamku.`);
  if ((L.ruler || L.renown > 600) && chance(L.ruler ? 0.5 : 0.25)) {
    const free = LEGENDS.filter((x) => !P.items.includes(x.id) && !Object.values(P.equip).includes(x.id) && x.slot === "weapon");
    if (free.length) { const g = pick(free); lootItems.push(g.id); lines.push(`Przy pokonanym ${L.name} leży ${g.name}. Legenda: ${g.text}`); }
  }
}

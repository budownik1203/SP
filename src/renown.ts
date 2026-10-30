// Postać i reputacja (Build 0.26): cechy z czynów (z prawdziwymi efektami), przydomki nadawane przez lud,
// listy gończe z nagrodą i łowcami głów, trwałe rany po nokaucie i cyrulik w mieście.

// ---------- Czyny ----------
type Deed = "spared" | "slain" | "burned" | "looted" | "duels" | "sieges" | "freed" | "undead" | "beasts" | "caravans" | "quests" | "executed" | "fled";
function deeds(P: PlayerState): Record<Deed, number> { return ((P as any).deeds ||= {}); }
function addDeed(P: PlayerState, d: Deed, n = 1) { const D = deeds(P); D[d] = (D[d] || 0) + n; checkNick(P); }

// Cechy z czynów: każda ma działanie w grze (perki), nie tylko opis.
interface DeedTrait { id: string; name: string; desc: string; icon: string; bad?: boolean; need: (D: Record<Deed, number>, P: PlayerState) => boolean; fx: Record<string, number>; }
const DEED_TRAITS: DeedTrait[] = [
  { id: "merciful", name: "Łaskawy", desc: "Oszczędzałeś rannych wrogów. Wrogowie łatwiej się poddają, jeńcy tańsi w werbunku. Morale +3.", icon: "heart", need: (D) => (D.spared || 0) >= 5, fx: { moraleB: 3 } },
  { id: "butcher", name: "Bez litości", desc: "Dobijałeś rannych. Wrogowie tracą ducha na twój widok (−4 morale), honorowi się odwracają.", icon: "skull", bad: true, need: (D) => (D.slain || 0) >= 4, fx: { dread: 4 } },
  { id: "burner", name: "Pożoga", desc: "Paliłeś i łupiłeś wsie. Więcej łupów z grabieży, mniej ochotników w wioskach.", icon: "fire", bad: true, need: (D) => (D.burned || 0) + (D.looted || 0) >= 3, fx: { lootB: 0.15 } },
  { id: "duelist", name: "Pojedynkowicz", desc: "Wygrane pojedynki. Lepsze okno idealnego bloku (+30 ms).", icon: "sword", need: (D) => (D.duels || 0) >= 3, fx: { parry: 0.03 } },
  { id: "stormer", name: "Zdobywca grodów", desc: "Zdobyte twierdze. Machiny oblężnicze budują się szybciej, ludzie mniej się boją murów.", icon: "castle", need: (D) => (D.sieges || 0) >= 3, fx: { siegeB: 0.2 } },
  { id: "liberator", name: "Wyzwoliciel", desc: "Uwalniałeś porwanych i więźniów. Wioski kochają cię bardziej, rekrutów więcej.", icon: "chain", need: (D) => (D.freed || 0) >= 3, fx: { recruitB: 0.15 } },
  { id: "unmaker", name: "Pogromca Umarłych", desc: "Setki rozbitych nieumarłych. +10% obrażeń przeciw nieumarłym.", icon: "cross", need: (D) => (D.undead || 0) >= 150, fx: { undeadDmg: 0.1 } },
  { id: "hunter", name: "Łowca bestii", desc: "Wilki i potwory padają pod twoją ręką. Więcej trofeów i skór.", icon: "wolf", need: (D) => (D.beasts || 0) >= 30, fx: { beastB: 0.15 } },
  { id: "robber", name: "Rozbójnik", desc: "Napady na kupców. Karawany cię unikają, bandyci szanują.", icon: "coin", bad: true, need: (D) => (D.caravans || 0) >= 3, fx: {} },
  { id: "helper", name: "Dobry pan", desc: "Wiele wykonanych zleceń. Lepsze nagrody od rad i sołtysów (+10%).", icon: "scroll", need: (D) => (D.quests || 0) >= 12, fx: { questB: 0.1 } },
  { id: "headsman", name: "Kat", desc: "Ścinałeś pojmanych lordów. Lordowie boją się niewoli u ciebie.", icon: "axe", bad: true, need: (D) => (D.executed || 0) >= 2, fx: { dread: 3 } },
  { id: "coward", name: "Uciekinier", desc: "Często uciekałeś z pola. Ludzie mniej ci ufają (−3 morale), ale łatwiej się wymykasz.", icon: "wind", bad: true, need: (D) => (D.fled || 0) >= 5, fx: { moraleB: -3, fleeB: 0.1 } },
];
function deedTraits(P: PlayerState) { const D = deeds(P); return DEED_TRAITS.filter((t) => t.need(D, P)); }
function traitFx(P: PlayerState, k: string) { let v = 0; if (k === "moraleB" && hasRole(P, "szaman")) v += 4; if (k === "craftQ" && hasRole(P, "runokuj")) v += P.companions.some((c) => c.id === "thrain" && devoted(c)) ? 0.14 : 0.08; for (const t of deedTraits(P)) v += t.fx[k] || 0; for (const wd of woundsOf(P)) v += WOUNDS[wd]?.fx[k] || 0; return v; }

// ---------- Przydomek nadany przez lud ----------
const NICKS: [Deed | "renown" | "honor" | "dishonor", number, string][] = [
  ["undead", 300, "Pogromca Umarłych"], ["sieges", 6, "Zdobywca"], ["slain", 12, "Krwawy"], ["burned", 5, "Podpalacz"], ["spared", 15, "Łaskawy"],
  ["duels", 6, "Niezłomny"], ["freed", 8, "Wyzwoliciel"], ["beasts", 80, "Wilczy Kieł"], ["caravans", 6, "Zbój"], ["quests", 30, "Sprawiedliwy"],
  ["honor", 50, "Prawy"], ["dishonor", -40, "Przeklęty"], ["renown", 1200, "Wielki"],
];
function nickOf(P: PlayerState): string { return (P as any).nick || ""; }
function checkNick(P: PlayerState) {
  if (!WORLD) return;
  const D = deeds(P);
  // najsilniejszy czyn wygrywa (wynik względem progu)
  let best: [string, number] | null = null;
  for (const [k, need, name] of NICKS) {
    const v = k === "honor" ? P.honor : k === "dishonor" ? -P.honor : k === "renown" ? P.renown : D[k as Deed] || 0;
    const th = k === "dishonor" ? -need : need;
    const sc = v / th; if (sc >= 1 && (!best || sc > best[1])) best = [name, sc];
  }
  if (best && best[0] !== nickOf(P) && (!(P as any).nickSc || best[1] > (P as any).nickSc * 1.4)) {
    (P as any).nick = best[0]; (P as any).nickSc = best[1];
    chron(WORLD, `Lud zaczyna nazywać ${P.name}: „${best[0]}”.`, PAL.gold, "player");
    addLogMsg(`W karczmach mówią o tobie: ${P.name} ${best[0]}.`, PAL.gold);
  }
}
function heroTitle(P: PlayerState) { return nickOf(P) ? `${P.name} ${nickOf(P)}` : P.name; }

// ---------- Listy gończe ----------
function bounties(P: PlayerState): Record<number, number> { return ((P as any).bounty ||= {}); }
function addBounty(w: World, f: number, v: number, why: string) {
  if (f < 1 || f > 5 && f !== PLAYER_FACTION) return;
  const B = bounties(w.player); const old = B[f] || 0; B[f] = old + v;
  if (old < 300 && B[f] >= 300) { chron(w, `${factionName(f)} wyznacza nagrodę ${B[f]} denarów za głowę ${w.player.name} (${why}).`, PAL.redL, "player"); addLogMsg(`List gończy! ${factionShort(f)} płaci ${B[f]} den. za twoją głowę. Strzeż się łowców nagród.`, PAL.redL); }
}
function bountyDaily(w: World) {
  const P = w.player, B = bounties(P), p = playerParty(w);
  for (const k of Object.keys(B)) { const f = Number(k); B[f] = Math.max(0, B[f] - 3); if (B[f] <= 0) delete B[f]; }
  // łowcy nagród: przy wysokiej nagrodzie co jakiś czas wyrusza oddział
  const top = Object.entries(B).sort((a, b) => b[1] - a[1])[0];
  if (top && top[1] >= 300 && !w.parties.some((o) => (o as any).hunters) && chance(0.06 + top[1] / 20000)) {
    const n = Math.round(8 + top[1] / 60 + P.level);
    const ang = rr(0, 6.28), d = 22 * WCELL;
    const x = clamp(p.x + Math.cos(ang) * d, 20, WGW * WCELL - 20), y = clamp(p.y + Math.sin(ang) * d, 20, WGH * WCELL - 20);
    if (!passableCell(w, cellOf(x, y))) return;
    const troops: Troop[] = [{ type: "m_sword", n: Math.ceil(n * 0.5), wounded: 0, xp: 0 }, { type: "m_xbow", n: Math.ceil(n * 0.3), wounded: 0, xp: 0 }, { type: "b_chief", n: 1, wounded: 0, xp: 0 }];
    const hp: Party = { id: w.nextId++, kind: "bandit", name: "Łowcy nagród", faction: 6, x, y, troops, prisoners: [], gold: Math.round(top[1] * 0.3), path: [], state: "idle", wait: 0, speedK: 1.15 } as any;
    (hp as any).hunters = Number(top[0]); (hp as any).chase = w.pid;
    w.parties.push(hp);
    addLogMsg(`Ktoś widział zbrojnych pytających o ciebie w karczmie. Łowcy nagród idą twoim tropem.`, PAL.redL);
  }
}
// łowcy idą prosto na gracza (wywoływane z AI oddziałów); gdy go widzą, przejmuje zwykły pościg
function huntersThink(w: World, o: Party): boolean {
  if (!(o as any).hunters) return false;
  if (!bounties(w.player)[(o as any).hunters] || w.player.captive) { removeParty(w, o); return true; }
  const p = playerParty(w);
  if (dist(o.x, o.y, p.x, p.y) < sightRadius(w) * WCELL * 0.8) return false;
  if (o.wait <= 0 || !o.path.length) { o.wait = 2; o.state = "chase"; o.target = p.id; goTo(w, o, p.x, p.y); }
  return true;
}
function payBounty(w: World, f: number) {
  const P = w.player, B = bounties(P), c = Math.round((B[f] || 0) * 1.2);
  if (!c || P.gold < c) return;
  P.gold -= c; delete B[f]; const W2 = (P as any).wanted; if (W2) delete W2[f];
  for (const o of w.parties.filter((x) => (x as any).hunters === f)) removeParty(w, o);
  toast(`Płacisz grzywnę ${c} denarów. Listy gończe zdarte ze ścian.`, PAL.gold); sfx.coin();
}
function bountyRow(w: World, s: Settlement) {
  const P = w.player, b = bounties(P)[s.faction] || 0;
  if (b < 50) return "";
  return `<div class="row"><span>${ic("scroll")} Na ścianie wisi twój list gończy: <b class="bad">${b} den.</b></span><button class="mini" data-a="payB" ${P.gold >= Math.round(b * 1.2) ? "" : "disabled"}>Zapłać grzywnę (${Math.round(b * 1.2)})</button></div>`;
}
// strażnicy rozpoznają poszukiwanego przy wejściu do miasta
function guardsCheck(s: Settlement): boolean {
  const w = WORLD, P = w.player, b = bounties(P)[s.faction] || 0;
  if (b < 300 || s.kind === "village" || playerAtWarWith(w, s.faction)) return false;
  const key = `${s.id}:${Math.floor(w.day / 3)}`; if ((G as any).guardKey === key) return false; (G as any).guardKey = key;
  if (chance(0.45)) return false;
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("town", s.seed, s.culture, isNight(w)), "scene-img")}</div><h1>Straż w bramie</h1><p class="dlg">Sierżant patrzy na ciebie, potem na kartkę przybitą do bramy, potem znowu na ciebie. „Toż to ten z listu! ${b} denarów nagrody. Brać go!”</p>
    <div class="choices"><button class="choice" data-a="pay"><span class="key">1</span>Zapłać grzywnę na miejscu (${Math.round(b * 1.2)})</button><button class="choice" data-a="bribe"><span class="key">2</span>Wsuń sierżantowi sakiewkę (${Math.round(b * 0.4)}, szansa ${Math.round(clamp(0.3 + P.attr.cha * 0.05, 0, 0.8) * 100)}%)</button>
    <button class="choice danger" data-a="fight"><span class="key">3</span>Przebij się przez straż</button><button class="choice alt" data-a="run"><span class="key">4</span>Zawróć konia</button></div></div>`, {
    pay: () => { if (P.gold < Math.round(b * 1.2)) { toast("Nie masz tyle złota.", PAL.redL); return; } payBounty(w, s.faction); closeScreen(); enterSettlement(s, true); },
    bribe: () => { const c = Math.round(b * 0.4); if (P.gold < c) return; P.gold -= c; if (chance(clamp(0.3 + P.attr.cha * 0.05, 0, 0.8))) { toast("Sierżant chowa sakiewkę i nagle ma coś w oku.", PAL.gold); closeScreen(); enterSettlement(s, true); } else { toast("„Łapówka? Do lochu z nim!” Sakiewka przepada.", PAL.redL); guardFight(s); } },
    fight: () => guardFight(s),
    run: () => { closeScreen(); G.encounterCooldown = 3; },
  }, "dialog-scr");
  return true;
}
function guardFight(s: Settlement) {
  const w = WORLD, P = w.player;
  const g = s.garrison.filter((t) => t.n - t.wounded > 0).map((t) => ({ ...t, n: Math.min(t.n - t.wounded, 6), wounded: 0 })).slice(0, 3);
  if (!g.length) g.push({ type: RECRUITS[s.culture]?.town?.[1] || "m_sword", n: 6, wounded: 0, xp: 0 });
  addBounty(w, s.faction, 150, "napaść na straż");
  P.honor -= 2; s.relation -= 15;
  launchBattle({ kind: "field", enemies: [], allies: [], enemyTroops: g, title: `Straż ${s.name}`, settlement: s } as any, { terrain: "streets", maxPerSide: 30 });
}

// ---------- Trwałe rany ----------
const WOUNDS: Record<string, { name: string; desc: string; fx: Record<string, number>; cure: number }> = {
  eye: { name: "Wybite oko", desc: "Gorzej celujesz: łuk −15%. Nie da się wyleczyć, ale przepaska budzi respekt.", fx: { bowDmg: -0.15, dread: 2 }, cure: 0 },
  leg: { name: "Kulejąca noga", desc: "Wolniej w bitwie (−6%) i na mapie.", fx: { bspeed: -0.06, mapSpeed: -0.03 }, cure: 0.5 },
  arm: { name: "Źle zrośnięta ręka", desc: "Słabsze cięcia (−7%).", fx: { meleeDmg: -0.07 }, cure: 0.55 },
  lung: { name: "Przebite płuco", desc: "Szybciej się męczysz (−10% wytrzymałości).", fx: { stamina: -0.1 }, cure: 0.45 },
  hand: { name: "Pokiereszowane palce", desc: "Blok kosztuje więcej (+10%).", fx: { blockCost: 0.1 }, cure: 0.6 },
  face: { name: "Blizna przez twarz", desc: "Damy się odwracają, żołnierze szanują: +2 morale, gorszy handel.", fx: { moraleB: 2, tradeB: -0.05 }, cure: 0 },
  ribs: { name: "Połamane żebra", desc: "Mniej zdrowia (−12).", fx: { maxHp: -12 }, cure: 0.7 },
};
function woundsOf(P: PlayerState): string[] { return ((P as any).pwounds ||= []); }
function maybeWound(P: PlayerState, lines: string[]) {
  const have = woundsOf(P), left = Object.keys(WOUNDS).filter((k) => !have.includes(k));
  if (!left.length || !chance(0.22 - perk(P, "toughB"))) return;
  const k = pick(left); have.push(k);
  lines.push(`Trwała rana: ${WOUNDS[k].name}. ${WOUNDS[k].desc}`);
  chron(WORLD, `${P.name} odnosi ciężką ranę: ${WOUNDS[k].name.toLowerCase()}.`, PAL.redL, "player");
  if (k === "face") P.look.scar = 2;
}

// ---------- Cyrulik ----------
function barberHtml(w: World) {
  const P = w.player, ws = woundsOf(P);
  const heal = Math.max(0, heroMaxHp(P) - P.hp), hc = Math.round(heal * 1.5);
  return `<h2>${ic("drop")} Cyrulik</h2>
    <div class="row"><span>Opatrzenie ran (${Math.round(P.hp)}/${heroMaxHp(P)})</span><button class="mini" data-a="bHeal" ${heal > 0 && P.gold >= hc ? "" : "disabled"}>Szyj i bandażuj (${hc})</button></div>
    ${ws.map((k) => `<div class="row"><span>${WOUNDS[k].name} <span class="muted">${WOUNDS[k].desc}</span></span>${WOUNDS[k].cure ? `<button class="mini" data-a="bCure" data-v="${k}" ${P.gold >= 400 ? "" : "disabled"}>Nastaw (400, szansa ${Math.round(WOUNDS[k].cure * 100)}%)</button>` : "<span class='muted'>nieuleczalne</span>"}</div>`).join("")}
    <div class="row"><span>Brzytwa i nożyce</span><span>${["gładko", "krótka broda", "długa broda"].map((n, i) => `<button class="mini ${P.look.beard === i ? "on" : ""}" data-a="bBeard" data-v="${i}">${n}</button>`).join("")}</span></div>`;
}
function barberActs(w: World, re: () => void): Acts {
  const P = w.player;
  return {
    bHeal: () => { const c = Math.round(Math.max(0, heroMaxHp(P) - P.hp) * 1.5); if (P.gold < c) return; P.gold -= c; P.hp = heroMaxHp(P); toast("Cyrulik szyje, przypala i każe zacisnąć zęby. Jak nowy.", PAL.gold); re(); },
    bCure: (v) => { if (P.gold < 400) return; P.gold -= 400; const ws = woundsOf(P); if (chance(WOUNDS[v].cure)) { ws.splice(ws.indexOf(v), 1); toast(`Chrupnięcie, wrzask, kubek gorzałki. ${WOUNDS[v].name}: wyleczone!`, PAL.gold); } else { P.hp = Math.max(1, P.hp - 15); toast("Nie wyszło. Boli bardziej niż przedtem.", PAL.redL); } re(); },
    bBeard: (v) => { P.look.beard = Number(v); (P as any).stubble = 0; sfx.ui(); re(); },
  };
}

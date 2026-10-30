// Podróż i obóz (Build 0.19): zmęczenie, choroby, ekran obozu z zadaniami, rozmowy przy ognisku, warta i nocne napady,
// palisada przy dłuższym postoju, polowanie i zbieractwo zależne od krainy, przeszukiwanie pobojowisk, echa wydarzeń z drogi.

interface CampState { tasks: Record<string, string>; hero: string; since: number; fort: boolean; acc: Record<string, number>; talkDay: number; was: boolean; }
function CS(): CampState {
  const P = WORLD.player as any;
  return (P.camp ||= { tasks: {}, hero: "rest", since: 0, fort: false, acc: {}, talkDay: -1, was: false });
}
function fatigueOf(P: PlayerState) { return clamp((P as any).fatigue || 0, 0, 100); }
function addFatigue(P: PlayerState, v: number) { (P as any).fatigue = clamp(fatigueOf(P) + v, 0, 100); }
function sickList(P: PlayerState): { kind: string; n: number }[] { return ((P as any).sick ||= []); }
function sickCount(P: PlayerState) { return sickList(P).reduce((s, x) => s + x.n, 0); }
const DISEASES: Record<string, { name: string; death: number; text: string }> = {
  fever: { name: "gorączka bagienna", death: 0.02, text: "Komary z bagien przyniosły gorączkę." },
  plague: { name: "zaraza Morvatha", death: 0.05, text: "Szara ziemia Morvatha zatruwa oddech. Ludzie kaszlą krwią." },
  flux: { name: "czerwonka", death: 0.03, text: "Brudna woda w obozie. W latrynach kolejka." },
  frost: { name: "odmrożenia", death: 0.015, text: "Mróz kąsa palce i stopy." },
};
// Szybkość marszu przy zmęczeniu: od 50% zaczyna spadać, przy 100% o jedną trzecią.
function fatigueSpeedK(P: PlayerState) { const f = fatigueOf(P); return f <= 50 ? 1 : 1 - (f - 50) / 150; }

// Zadania w obozie: każdy kompan robi coś innego.
const CAMP_TASKS: [string, string, string][] = [
  ["rest", "Odpoczynek", "szybciej wraca do sił"],
  ["watch", "Warta", "chroni przed nocnym napadem"],
  ["hunt", "Polowanie", "mięso, zależnie od krainy i tropienia"],
  ["forage", "Zbieractwo", "zioła, grzyby, chrust (las i bagna)"],
  ["train", "Musztra rekrutów", "doświadczenie dla żołnierzy"],
  ["heal", "Opieka nad chorymi", "leczy rannych i chorych"],
  ["repair", "Naprawa sprzętu", "do ok. 70% stanu"],
  ["scout", "Zwiad", "odkrywa okolicę i wrogów"],
];
const HERO_TASKS: [string, string, string][] = [["rest", "Odpoczynek", "zdrowie i siły"], ["practice", "Ćwiczenia", "doświadczenie bohatera"], ["hunt", "Polowanie", "mięso"], ["watch", "Warta", "pilnujesz obozu"]];
function defaultTask(role: string) { return /medyk|kapłan/.test(role) ? "heal" : /zwiad|łuczn/.test(role) ? "hunt" : /inżynier/.test(role) ? "repair" : /rycerz|obrońca/.test(role) ? "train" : /rębajło/.test(role) ? "watch" : "rest"; }
function campTask(c: CompanionState) { const T = CS().tasks; return T[c.id] || (T[c.id] = defaultTask(c.role)); }
function campHasWatch(P: PlayerState) { return CS().hero === "watch" || P.companions.some((c) => !((c as any).away > WORLD.day) && campTask(c) === "watch") || (P as any).campMode === "guard"; }

// Zwierzyna i zbieractwo według terenu i krainy.
function gameAt(w: World, x: number, y: number) {
  const i = cellOf(x, y);
  if (w.blight[i]) return 0;
  const t = w.terr[i];
  const reg = regionOf(w, x / WCELL, y / WCELL);
  let g = t === T_FOREST ? 1.4 : t === T_SWAMP ? 0.9 : t === T_HILL ? 0.8 : t === T_MOUNT ? 0.4 : 0.7;
  if (reg === "steppe") g *= 0.9; if (reg === "north") g *= 0.85;
  if (season(w) === 3) g *= 0.55;
  return g;
}
function forageAt(w: World, x: number, y: number) {
  const i = cellOf(x, y); if (w.blight[i]) return 0;
  const t = w.terr[i];
  return (t === T_FOREST ? 1.2 : t === T_SWAMP ? 1 : 0.35) * (season(w) === 3 ? 0.3 : season(w) === 2 ? 1.3 : 1);
}

// Godzina po godzinie: zmęczenie w marszu, praca obozu, nocne napady, auto-obóz o zmroku, pobojowiska po drodze.
function campTick(w: World, hours: number, moving: boolean) {
  const P = w.player, p = playerParty(w), C = CS();
  if (!p || P.captive) return;
  const inTown = w.settlements.some((s) => dist(s.cx * WCELL + 4, s.cy * WCELL + 4, p.x, p.y) < 14);
  const night = isNight(w), win = season(w) === 3;
  if (moving) {
    let f = 0.75 + (night ? 0.6 : 0) + (w.rain ? 0.35 : 0) + (win ? 0.35 : 0) + ((w as any).storm ? 0.3 : 0);
    if (P.equip.horse) f -= 0.12;
    f *= 1 - P.skills.leadership * 0.03;
    addFatigue(P, f * hours);
    C.since = 0; C.fort = false;
  } else if (G.camping) {
    C.since += hours;
    const rest = (inTown ? 10 : 6) + (C.hero === "rest" ? 1.5 : 0) + (C.fort ? 1 : 0);
    addFatigue(P, -rest * hours);
    if (!inTown) campWork(w, hours);
    if (!C.fort && !inTown && C.since >= 24) { C.fort = true; toast("Obóz stoi od doby. Ludzie stawiają palisadę i porządne namioty.", PAL.gold); }
    if (!inTown && night && !campHasWatch(P) && chance(hours * 0.014 * (C.fort ? 0.25 : 1))) { nightAmbush(w); return; }
  } else addFatigue(P, -2 * hours);
  // koniec obozu: raport
  if (C.was && !G.camping) campReport(w);
  C.was = G.camping;
  // auto-obóz o zmroku: marsz staje, obóz do świtu, potem drużyna rusza dalej tą samą drogą
  if (moving && settings.autoCamp !== false && !inTown && w.hour >= 21 && w.hour < 22 && fatigueOf(P) >= 30) {
    if ((G as any).autoCampDay !== w.day) {
      (G as any).autoCampDay = w.day;
      const path = p.path.slice(), target = G.target;
      p.path = []; G.camping = true; p.state = "camp";
      G.waitHours = (24 - w.hour) + 5;
      pendingAfterWait = () => { if (path.length) { p.path = path; G.target = target; p.state = "move"; toast("Świt. Zwijacie obóz i ruszacie dalej."); } };
      toast(`Zapada zmrok, ludzie są zmęczeni (${Math.round(fatigueOf(P))}%). Obóz do świtu. Klik na mapie przerywa.`, PAL.bone);
      refreshMapHud();
    }
  }
  // pobojowisko po drodze
  if (!G.camping) checkBattlefield(w);
}

function campWork(w: World, hours: number) {
  const P = w.player, p = playerParty(w), C = CS(), A = C.acc;
  const add = (k: string, v: number) => { A[k] = (A[k] || 0) + v; };
  const workers = P.companions.filter((c) => !((c as any).away > w.day) && c.hp > c.maxHp * 0.25);
  const tasks = workers.map((c) => campTask(c));
  if (C.hero !== "rest" && C.hero !== "watch") tasks.push(C.hero === "practice" ? "practice" : C.hero);
  const night = isNight(w);
  for (const t of tasks) {
    if (t === "hunt" && !night) { const k = gameAt(w, p.x, p.y) * (0.32 + P.skills.tracking * 0.06); add("meatF", k * hours); }
    if (t === "forage" && !night) { const k = forageAt(w, p.x, p.y); add("herbF", k * 0.22 * hours); add("grainF", k * 0.2 * hours); }
    if (t === "train") { for (const tr of p.troops) tr.xp += 2.5 * Math.max(1, tr.n - tr.wounded) * hours * (1 + perk(P, "trainB")); add("trainH", hours); }
    if (t === "practice") add("xpF", hours * (4 + P.level));
    if (t === "heal") {
      for (const tr of p.troops) if (tr.wounded) { const h = Math.min(tr.wounded, Math.floor(rr(0, 1) + 0.08 * hours * tr.wounded + 0.04 * hours)); tr.wounded -= h; add("healed", h); }
      for (const s of sickList(P)) { const k = Math.min(s.n, Math.floor(rr(0, 1) + hours * 0.06 * (1 + ((P as any).herbs > 0 ? 1 : 0)) * Math.max(1, s.n))); if (k > 0) { s.n -= k; add("cured", k); if ((P as any).herbs > 0 && chance(0.3)) (P as any).herbs--; } }
    }
    if (t === "repair") { const cond = ((P as any).cond ||= {}) as Record<string, number>; const cap = workers.some((c) => c.role === "inżynier") ? 80 : 70; for (const sl of Object.keys(P.equip)) if (P.equip[sl as ESlot] && sl !== "horse" && (cond[sl] ?? 100) < cap) { cond[sl] = Math.min(cap, (cond[sl] ?? 100) + 0.6 * hours); add("repair", 0.6 * hours); } }
    if (t === "scout") { add("scoutH", hours); if (A.scoutH >= 4) { A.scoutH = 0; const r = 26; const cx = Math.floor(p.x / WCELL), cy = Math.floor(p.y / WCELL); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (dx * dx + dy * dy <= r * r) { const X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < WGW && Y < WGH) w.explored[cidx(X, Y)] = 1; } const foe = w.parties.find((o) => o !== p && hostile(w, p, o) && dist(o.x, o.y, p.x, p.y) < r * WCELL); if (foe && !A.warned) { A.warned = 1; toast(`Zwiadowcy: ${foe.name} (${troopCount(foe.troops)} ludzi) kręci się w okolicy.`, PAL.redL); } } }
  }
  // z ułamków robią się całe zdobycze
  const take = (f: string, key: string, into: (n: number) => void) => { const n = Math.floor(A[f] || 0); if (n > 0) { A[f] -= n; into(n); add(key, n); } };
  take("meatF", "meat", (n) => { P.goods.meat = (P.goods.meat || 0) + n; });
  take("grainF", "grain", (n) => { P.goods.grain = (P.goods.grain || 0) + n; });
  take("herbF", "herbs", (n) => { (P as any).herbs = ((P as any).herbs || 0) + n; });
  take("xpF", "xp", (n) => { const L: string[] = []; gainXp(P, n, L); L.filter((l) => /Awans/.test(l)).forEach((l) => toast(l, PAL.gold)); });
}
function campReport(w: World) {
  const C = CS(), A = C.acc, P = w.player;
  const parts: string[] = [];
  if (A.meat) parts.push(`upolowano ${A.meat} mięsa`);
  if (A.grain) parts.push(`zebrano ${A.grain} jadła z lasu`);
  if (A.herbs) parts.push(`${A.herbs} ziół`);
  if (A.healed) parts.push(`opatrzono ${A.healed} rannych`);
  if (A.cured) parts.push(`wyleczono ${A.cured} chorych`);
  if (A.repair) parts.push(`naprawiono sprzęt`);
  if (A.trainH) parts.push(`musztra ${Math.round(A.trainH)} godz.`);
  if (A.xp) parts.push(`ćwiczenia: +${A.xp} doświadczenia`);
  if (parts.length) addLogMsg(`Obóz zwinięty: ${parts.join(", ")}. Zmęczenie ${Math.round(fatigueOf(P))}%.`, PAL.gold);
  C.acc = {}; C.since = 0; C.fort = false;
}

// Nocny napad: bez warty zbóje albo bestie wpadają do obozu.
function nightAmbush(w: World) {
  const p = playerParty(w);
  let o = w.parties.filter((x) => (x.kind === "bandit" || x.kind === "monster" || x.kind === "undead") && dist(x.x, x.y, p.x, p.y) < 260).sort((a, b) => dist(a.x, a.y, p.x, p.y) - dist(b.x, b.y, p.x, p.y))[0];
  if (!o) { if (!chance(0.5)) return; o = spawnBandits(w, p.x + rr(-30, 30), p.y + rr(-30, 30), 6 + Math.floor(rr(0, 8))); if (!o) return; o.name = "Nocni napastnicy"; }
  o.x = p.x + rr(-8, 8); o.y = p.y + rr(-8, 8);
  toast("Nikt nie trzymał warty. Krzyk w ciemności, płonące namioty. Napad!", PAL.redL);
  sfx.drum?.(0.8);
  meetParty(o, true);
}

// Codziennie: choroby, skutki zmęczenia, grabieżcy pobojowisk.
function campDaily(w: World) {
  const P = w.player, p = playerParty(w);
  if (!p || P.captive) return;
  const inTown = w.settlements.some((s) => dist(s.cx * WCELL + 4, s.cy * WCELL + 4, p.x, p.y) < 14);
  const L = sickList(P), i = cellOf(p.x, p.y), n = healthyCount(p.troops);
  const infect = (kind: string, ch: number) => {
    if (!chance(ch) || n < 3) return;
    const k = Math.max(1, Math.round(n * rr(0.05, 0.14)));
    const e = L.find((x) => x.kind === kind); if (e) e.n += k; else L.push({ kind, n: k });
    addLogMsg(`${DISEASES[kind].text} Choruje ${k} ludzi (${DISEASES[kind].name}).`, PAL.redL);
  };
  const healer = P.companions.some((c) => /medyk|kapłan/.test(c.role)), med = P.skills.medicine * 0.1 + (healer ? 0.35 : 0);
  if (!inTown) {
    if (w.terr[i] === T_SWAMP) infect("fever", 0.25 * (1 - med));
    if (w.blight[i] && p.faction !== 5 && w.player.race !== "undead") infect("plague", 0.18 * (1 - med));
    if (CS().since >= 48 && !CS().fort) infect("flux", 0.15 * (1 - med));
    if (season(w) === 3 && fatigueOf(P) > 50) infect("frost", 0.2 * (1 - med));
  }
  // chorzy nie walczą (liczą się jako ranni), część umiera; w mieście zdrowieją szybko
  let total = L.reduce((s, x) => s + x.n, 0), died = 0;
  for (const s of L) {
    if (inTown) { s.n -= Math.ceil(s.n * 0.45); continue; }
    const d = Math.floor(s.n * DISEASES[s.kind].death * (1 - med) + rr(0, 0.6));
    if (d > 0) { died += d; s.n -= d; applyLosses(p.troops, d / Math.max(1, troopCount(p.troops))); }
    if (chance(0.25)) s.n = Math.max(0, s.n - 1);   // część wychodzi z choroby sama
  }
  (P as any).sick = L.filter((x) => x.n > 0);
  total = sickCount(P);
  if (died) addLogMsg(`Choroba zabiera ${died} ${died === 1 ? "człowieka" : "ludzi"}.`, PAL.redL);
  // chorzy liczą się jako ranni: rannych jest co najmniej tylu, ilu chorych
  let need = total - p.troops.reduce((s, t) => s + t.wounded, 0);
  for (const t of p.troops) { if (need <= 0) break; const k = Math.min(need, t.n - t.wounded); if (k > 0) { t.wounded += k; need -= k; } }
  // skrajne zmęczenie: dezercje
  if (fatigueOf(P) > 85) { P.morale -= 4; if (chance(0.5)) { addLogMsg("Ludzie padają z nóg. W nocy kilku zniknęło razem z kocami.", PAL.redL); desert(w, 0.04); } }
  // grabieżcy pobojowisk
  for (const sc of ((w as any).scars || []) as Scar[]) if (sc.kind === "battle" && w.day - sc.day < 3 && !(sc as any).looters && chance(0.25) && w.parties.filter((x) => x.kind === "bandit").length < 28) {
    (sc as any).looters = 1;
    const b = spawnBandits(w, sc.x + rr(-20, 20), sc.y + rr(-20, 20), 5 + Math.floor(rr(0, 7)));
    if (b) b.name = "Grabieżcy pobojowisk";
  }
}

// ---------- Pobojowisko ----------
function checkBattlefield(w: World) {
  const p = playerParty(w);
  if (screenOpen() || G.state !== "map") return;
  for (const sc of ((w as any).scars || []) as Scar[]) {
    if (sc.kind !== "battle" || (sc as any).seen || w.day - sc.day > 4 || dist(sc.x, sc.y, p.x, p.y) > 16) continue;
    (sc as any).seen = 1;
    showBattlefield(sc);
    return;
  }
}
function showBattlefield(sc: Scar) {
  const w = WORLD, P = w.player, p = playerParty(w);
  p.path = [];
  const age = Math.max(0, Math.round(w.day - sc.day));
  const fA = (sc as any).f1 || 0, fB = (sc as any).f2 || 0;
  const who = fA && fB ? `${factionShort(fA)} i ${factionShort(fB)}` : "nieznane wojska";
  const night = isNight(w);
  const search = () => {
    const hours = 3 + Math.floor(rr(0, 3));
    for (let h = 0; h < hours; h++) worldTick(w, 1);
    const lines: string[] = [];
    if (chance(night ? 0.42 : 0.25)) {   // hieny cmentarne
      closeScreen();
      const foes: Troop[] = []; addTroops(foes, "u_ghoul", 4 + Math.floor(rr(0, 5)));
      toast("Między trupami coś się rusza. Ghule żerują na pobojowisku!", PAL.redL);
      setTimeout(() => launchBattle({ kind: "field", enemies: [], allies: [], enemyTroops: foes, title: "Hieny cmentarne" }, { night: true, terrain: "plains" }), 60);
      return;
    }
    const loot = baseItems().filter((it) => it.tier <= 2 && (it.slot === "weapon" || it.slot === "body" || it.slot === "head" || it.slot === "shield"));
    const nItems = 1 + Math.floor(rr(0, 3));
    for (let k = 0; k < nItems && loot.length; k++) { const it = pick(loot); P.items.push(it.id); lines.push(`Zdobyczny sprzęt: ${it.name} (pogięty, do naprawy).`); }
    if (chance(0.55)) {
      const f = chance(0.5) ? fA : fB;
      const cul = FACTIONS[f]?.culture;
      const k = RECRUITS[cul]?.village?.[0];
      if (k && cul !== "undead" && troopCount(p.troops) + 2 < partyLimit(w)) { const n = 2 + Math.floor(rr(0, 4)); addTroops(p.troops, k, n); const t = p.troops.find((x) => x.type === k); if (t) t.wounded += n; lines.push(`${n} rannych (${UNITS[k].name}) prosi, by ich zabrać. Dołączają do ciebie.`); }
    }
    if (chance(0.45)) {
      const lords = w.lords.filter((L) => L.alive && L.party >= 0 && (L.faction === fA || L.faction === fB) && partyById(w, L.party));
      const L = lords.length ? pick(lords) : null;
      if (L) { const lp = partyById(w, L.party); const s = nearestSettlement(w, lp.x, lp.y); w.explored[cellOf(lp.x, lp.y)] = 1; lines.push(`List przy goniecu: ${L.title} ${L.name} ciągnie z ${troopCount(lp.troops)} ludźmi w okolice ${s.name}.`); }
    }
    if (chance(0.12)) { const g = 120 + Math.floor(rr(0, 230)); P.gold += g; lines.push(`Ciało rycerza z sygnetem rodu. Rodzina zapłaci okup: ${g} denarów.`); }
    else if (chance(0.6)) { const g = 10 + Math.floor(rr(0, 40)); P.gold += g; lines.push(`Sakiewki poległych: ${g} denarów.`); }
    P.honor -= 1;
    closeScreen();
    showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("battlefield", Math.round(sc.x + sc.y), FACTIONS[fA]?.culture || "aurelia", isNight(w), 0), "scene-img")}</div><h1>Łupy z pobojowiska</h1><p>${hours} godzin grzebania w błocie i krwi.</p><ul>${lines.map((l) => `<li>${l}</li>`).join("") || "<li>Nic, co warto zabrać.</li>"}</ul><div class="btns"><button data-a="ok">Dalej</button></div></div>`, { ok: () => { closeScreen(); refreshMapHud(); } }, "dialog-scr");
  };
  const bury = () => { for (let h = 0; h < 5; h++) worldTick(w, 1); P.honor += 2; P.morale -= 3; P.faith = Math.min(100, P.faith + 10); closeScreen(); toast("Kopiecie wspólny grób i odmawiacie modlitwę. Ludzie są ponurzy, ale bogowie patrzą łaskawie.", PAL.gold); refreshMapHud(); };
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("battlefield", Math.round(sc.x * 3 + sc.y), FACTIONS[fA]?.culture || "aurelia", night, 0), "scene-img")}</div>
    <h1>Pobojowisko</h1><p>${age ? `${age} ${age === 1 ? "dzień" : "dni"} temu` : "Dziś"} starły się tu ${who}. Wrony nie nadążają. Między ciałami leży porzucona broń, ktoś jeszcze jęczy.${night ? " Noc: łatwiej o ghule." : ""}</p>
    <div class="choices"><button class="choice" data-a="s"><span class="key">1</span>Przeszukaj pole (3–5 godzin; broń, ranni, listy, okup; ryzyko hien cmentarnych)</button>
    <button class="choice" data-a="b"><span class="key">2</span>Pochowaj poległych (5 godzin; honor +2, wiara, morale −3)</button>
    <button class="choice" data-a="x"><span class="key">3</span>Jedź dalej</button></div></div>`, { s: search, b: bury, x: () => { closeScreen(); } }, "dialog-scr");
}

// ---------- Ekran obozu ----------
function showCamp() {
  const w = WORLD, P = w.player, p = playerParty(w), C = CS();
  const night = isNight(w);
  const inTown = w.settlements.some((s) => dist(s.cx * WCELL + 4, s.cy * WCELL + 4, p.x, p.y) < 14);
  if (inTown) { toast("W osadzie odpoczywasz w karczmie (zakładka Odpocznij)."); return; }
  const cul = nearestSettlement(w, p.x, p.y).culture;
  const scene = drawScene("bivouac", Math.floor(p.x + p.y), cul, night, C.fort ? 1 : 0);
  const comps = P.companions.filter((c) => !((c as any).away > w.day));
  const sel = (id: string, cur: string, list: [string, string, string][]) => `<span class="ctask">${list.map(([k, n, tip]) => `<button class="mini ${cur === k ? "on" : ""}" data-a="t" data-v="${id}:${k}" title="${tip}">${n}</button>`).join("")}</span>`;
  const game = gameAt(w, p.x, p.y), forage = forageAt(w, p.x, p.y);
  const sick = sickList(P).filter((x) => x.n > 0);
  const watch = campHasWatch(P);
  const fat = Math.round(fatigueOf(P));
  const talkReady = C.talkDay !== w.day && comps.length > 0;
  const re = () => showCamp();
  const rest = (h: number) => { closeScreen(); G.camping = true; p.state = "camp"; p.path = []; G.waitHours = h; pendingAfterWait = null; refreshMapHud(); };
  showScr(`<div class="dialog frame camp-scr">
    <div class="scene">${pic(scene, "scene-img")}</div>
    <h1>${ic("tent")} Obóz${C.fort ? " z palisadą" : ""}</h1>
    <div class="campst"><span class="${fat > 70 ? "bad" : ""}">Zmęczenie <b>${fat}%</b></span><span class="${watch ? "" : "bad"}">${watch ? "Warta wystawiona" : "Brak warty: nocą grozi napad"}</span><span>Zwierzyna: ${game > 1.1 ? "obfita" : game > 0.6 ? "jest" : game > 0 ? "skąpa" : "brak (martwa ziemia)"}</span><span>Zioła: ${forage > 0.9 ? "dużo" : forage > 0.4 ? "trochę" : "mało"}</span><span>Zapas ziół: ${(P as any).herbs || 0}</span>${sick.length ? `<span class="bad">Chorzy: ${sick.map((s) => `${s.n} (${DISEASES[s.kind].name})`).join(", ")}</span>` : ""}${C.since ? `<span>Obóz stoi ${Math.round(C.since)} godz.${C.fort ? "" : " (palisada po dobie)"}</span>` : ""}</div>
    <h2>Zadania</h2>
    <div class="ctrow"><b>${esc(P.name)}</b>${sel("hero", C.hero, HERO_TASKS)}</div>
    ${comps.map((c) => `<div class="ctrow"><b>${esc(c.name)}</b> <span class="muted">${c.role}</span>${sel(c.id, campTask(c), CAMP_TASKS)}</div>`).join("") || `<p class="muted">Bez kompanów pracuje tylko twoja drużyna: odpoczynek i warta z szeregów (${P.companions.length ? "" : "zatrudnij kompanów w karczmach"}).</p>`}
    <div class="choices">
      <button class="choice" data-a="talk" ${talkReady ? "" : "disabled"}><span class="key">1</span>Usiądź przy ognisku i porozmawiaj${talkReady ? "" : " (raz na noc, potrzebni kompani)"}</button>
      <button class="choice" data-a="r4"><span class="key">2</span>Krótki postój: 4 godziny</button>
      <button class="choice" data-a="r8"><span class="key">3</span>Odpoczynek: 8 godzin</button>
      <button class="choice" data-a="rd"><span class="key">4</span>Do świtu</button>
      <button class="choice" data-a="ri"><span class="key">5</span>Zostańcie, aż każę ruszać</button>
      <button class="choice alt" data-a="x"><span class="key">6</span>${G.camping ? "Zwiń obóz" : "Zamknij"}</button>
    </div></div>`, {
    t: (v) => { const [id, k] = v.split(":"); if (id === "hero") C.hero = k; else C.tasks[id] = k; if (k === "watch") (P as any).campMode = "guard"; re(); },
    talk: () => { C.talkDay = w.day; campfireTalk(); },
    r4: () => rest(4), r8: () => rest(8),
    rd: () => { const h = w.hour < 6 ? 6 - w.hour : 24 - w.hour + 6; rest(h); },
    ri: () => { closeScreen(); G.camping = true; p.state = "camp"; p.path = []; G.waitHours = 0; refreshMapHud(); },
    x: () => { closeScreen(); if (G.camping) { G.camping = false; G.waitHours = 0; p.state = "idle"; toast("Zwijacie obóz."); } refreshMapHud(); },
  }, "dialog-scr");
}

// ---------- Rozmowy przy ognisku ----------
function campfireTalk() {
  const w = WORLD, P = w.player;
  const comps = P.companions.filter((c) => !((c as any).away > w.day));
  if (!comps.length) return;
  const a = pick(comps), b = comps.length > 1 ? pick(comps.filter((c) => c !== a)) : null;
  const bond = (c: CompanionState, v: number) => { const B = ((P as any).bond ||= {}); B[c.id] = clamp((B[c.id] || 0) + v, -100, 100); };
  const fn = (c: CompanionState) => c.name.split(" ")[0];
  const near = nearestSettlement(w, playerParty(w).x, playerParty(w).y);
  type T = { text: string; ch: [string, () => string][] };
  const T: T[] = [
    { text: `${fn(a)} grzebie patykiem w żarze. „Myślisz czasem o tym, ilu ludzi zabiliśmy? Ja przestałem liczyć po pierwszej zimie.”`, ch: [
      ["„Liczę każdego. Żeby nie zapomnieć, po co walczymy.” (honor +1)", () => { P.honor += 1; bond(a, 4); return `${fn(a)} kiwa głową. Długo milczy.`; }],
      ["„Liczą się żywi. Reszta to robota dla wron.”", () => { bond(a, /rycerz|kapłan/.test(a.role) ? -4 : 3); return `${fn(a)} parska śmiechem bez radości.`; }],
      ["„Śpij. Jutro długi marsz.”", () => "Ogień trzaska. Nikt już nic nie mówi."],
    ] },
    { text: `${fn(a)} wyjmuje zza pazuchy wytarty list. „Z domu. Pisze, że ojciec umarł. Mógłbym... nie, nieważne.”`, ch: [
      ["Daj mu 30 denarów dla rodziny (morale +4)", () => { if (P.gold < 30) return "Nie masz tyle przy sobie. Klepiesz go po ramieniu."; P.gold -= 30; P.morale = Math.min(100, P.morale + 4); bond(a, 8); return `${fn(a)} chowa monety. „Nie zapomnę ci tego.”`; }],
      ["„Wszyscy kogoś straciliśmy.”", () => { bond(a, 1); return "Kiwa głową i składa list."; }],
    ] },
    { text: `${b ? `${fn(a)} i ${fn(b)} kłócą się o to, kto lepiej walczył w ostatniej bitwie. Ludzie zaczynają stawiać zakłady.` : `${fn(a)} chwali się, że w ostatniej bitwie powalił trzech naraz.`}`, ch: [
      ["Pozwól im się zmierzyć na pięści (morale +6)", () => { P.morale = Math.min(100, P.morale + 6); if (b) { bond(a, 2); bond(b, 2); } return "Szybka bójka, dużo śmiechu, jeden wybity ząb. Obóz ożywa."; }],
      ["Przerwij kłótnię", () => { if (b) { bond(a, -1); bond(b, -1); } return "Rozchodzą się, mrucząc pod nosem."; }],
    ] },
    { text: `Weteran opowiada przy ognisku o dawnych wojnach: o królu, który oddał koronę za życie syna, i o zamku, który zjadł własną załogę.`, ch: [
      ["Słuchaj do końca (morale +3)", () => { P.morale = Math.min(100, P.morale + 3); return "Ludzie słuchają z otwartymi ustami. Nawet kucharz zapomina o kotle."; }],
      ["Zapytaj o okolicę", () => rumor(near, w.day)],
    ] },
    { text: `${fn(a)} mówi cicho: „Ludzie gadają, że za mało płacisz. Że idziemy na rzeź dla cudzej chwały.”`, ch: [
      ["Obiecaj premię po następnym zwycięstwie (morale +5)", () => { P.morale = Math.min(100, P.morale + 5); (P as any).promisedBonus = 1; return "Wieść rozchodzi się po obozie szybciej niż dym."; }],
      ["„Kto chce odejść, niech odchodzi teraz.”", () => { P.morale -= 2; if (chance(0.4)) desert(w, 0.03); return "Kilku zbiera manatki. Reszta zostaje z twardszymi minami."; }],
      ["Wypłać od ręki po 2 denary na głowę", () => { const c = troopCount(playerParty(w).troops) * 2; if (P.gold < c) return "Sakiewka za lekka. Musisz ich jakoś przekonać słowem."; P.gold -= c; P.morale = Math.min(100, P.morale + 10); return `Wydajesz ${c} denarów. Śpiewy do późnej nocy.`; }],
    ] },
    { text: `${fn(a)} patrzy w gwiazdy. „W ${near.name} miałem kiedyś dziewczynę. Albo ona miała mnie. Jak myślisz, czeka jeszcze?”`, ch: [
      ["„Wojna się kiedyś skończy.”", () => { bond(a, 3); return `${fn(a)} uśmiecha się pierwszy raz od tygodnia.`; }],
      ["„Nie czeka. Nikt na nas nie czeka.”", () => { bond(a, -3); P.morale -= 1; return "Odwraca się na bok i udaje, że śpi."; }],
    ] },
    { text: `Ktoś przyniósł z lasu dzban mocnej śliwowicy. ${fn(a)} już nalewa.`, ch: [
      ["Pij z ludźmi (morale +7, rano zmęczenie)", () => { P.morale = Math.min(100, P.morale + 7); addFatigue(P, 12); bond(a, 3); return "Śpiewy, przechwałki, ktoś wpada do ogniska. Rano będzie bolało."; }],
      ["Zabroń, rano marsz", () => { P.morale -= 2; return "Dzban ląduje w krzakach. Ktoś na pewno go jeszcze odnajdzie."; }],
    ] },
    { text: `${fn(a)} szepcze: „Widziałem w lesie światła. Nie pochodnie. Coś, co mrugało jak oczy.”`, ch: [
      ["Podwój wartę na tę noc", () => { (P as any).campMode = "guard"; return "Nikt nie śpi spokojnie, ale do świtu nic się nie dzieje."; }],
      ["„To błędne ogniki. Śpij.”", () => { if (chance(0.25)) { addLogMsg("Rano dwóch wartowników nie wróciło z obchodu.", PAL.redL); applyLosses(playerParty(w).troops, 2 / Math.max(1, troopCount(playerParty(w).troops))); } return "Śmiejesz się, ale sam długo patrzysz w ciemność."; }],
    ] },
    { text: `${b ? `${fn(b)} pyta ${fn(a)}, skąd ma tę bliznę. ${fn(a)} zaczyna opowieść, która z każdym zdaniem robi się bardziej nieprawdopodobna.` : `${fn(a)} opowiada, skąd ma bliznę na ramieniu. Historia rośnie z każdym łykiem.`}`, ch: [
      ["Śmiej się razem z nimi (morale +3)", () => { P.morale = Math.min(100, P.morale + 3); bond(a, 2); if (b) bond(b, 2); return "Obóz ryczy ze śmiechu."; }],
      ["Opowiedz swoją historię (sława +2)", () => { P.renown += 2; return "Ludzie słuchają w ciszy. Jutro ktoś opowie to w karczmie."; }],
    ] },
    { text: `${fn(a)} ostrzy broń w milczeniu. W końcu mówi: „Kiedyś cię zostawię. Nie dziś. Ale chcę, żebyś wiedział, że to nie z tchórzostwa.”`, ch: [
      ["„Jak przyjdzie czas, rozstaniemy się w zgodzie.”", () => { bond(a, 5); return `${fn(a)} podaje ci rękę. Uścisk jest mocny.`; }],
      ["„Odejdziesz, kiedy ci każę.”", () => { bond(a, -6); return `${fn(a)} wraca do ostrzenia. Szybciej niż przedtem.`; }],
    ] },
  ];
  const ev = pick(T);
  const acts: Acts = {};
  ev.ch.forEach(([, f], i) => { acts["c" + i] = () => { const r = f(); closeScreen(); if (r) toast(r, PAL.gold); showCamp(); }; });
  const cs = a;
  showScr(`<div class="dialog frame">${dialogHtml({ left: playerPortrait(), right: drawPortrait(cs.look, PAL.bone), title: "Przy ognisku", sub: `${cs.name} · ${cs.role}`, speech: ev.text, choices: ev.ch.map(([l], i) => ({ a: "c" + i, label: l })) })}</div>`, acts, "dialog-scr");
  grunt?.(cs.look.race === "orc" ? "orc" : cs.look.race === "dwarf" ? "dwarf" : "human");
}

// ---------- Echa wydarzeń: konsekwencje wracają po kilku dniach ----------
function addEcho(kind: string, days: number, data: any = {}) { const w = WORLD as any; (w.echoes ||= []).push({ kind, day: WORLD.day + days, data }); }
function dueEcho(): TEvent | null {
  const w = WORLD as any, P = WORLD.player, p = playerParty(WORLD);
  const L = (w.echoes || []) as { kind: string; day: number; data: any }[];
  const e = L.find((x) => x.day <= WORLD.day);
  if (!e) return null;
  w.echoes = L.filter((x) => x !== e);
  if (e.kind === "saved") return { id: "echo-saved", scene: "camp", title: "Znajoma twarz", text: "Na rozstajach czeka mężczyzna, którego kiedyś opatrzyłeś przy drodze. Teraz jest zdrowy i prowadzi muła.", ch: [
    { label: "Przyjmij podarunek", act: () => { const g = 40 + Math.floor(rr(0, 60)); P.gold += g; P.goods.meat = (P.goods.meat || 0) + 2; return `„Za to, że nie zostawiłeś mnie wronom.” ${g} denarów i suszone mięso.`; } },
    { label: "Poproś, by wskazał bezpieczną drogę", act: () => { const r = 30, cx = Math.floor(p.x / WCELL), cy = Math.floor(p.y / WCELL); for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) { const X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < WGW && Y < WGH) WORLD.explored[cidx(X, Y)] = 1; } return "Rysuje patykiem w błocie mapę okolicy: brody, kryjówki zbójców, studnie."; } },
  ] };
  if (e.kind === "robbed") return { id: "echo-robbed", scene: "camp", title: "Bracia ograbionego", text: "Drogę zastępuje kilku chłopów z widłami i kosami. Na przedzie stoi ten, którego ograbiłeś przy drodze. „To on!”", ch: [
    { label: "Oddaj dwa razy tyle (−60 denarów, honor +2)", need: () => P.gold >= 60, act: () => { P.gold -= 60; P.honor += 2; return "Biorą pieniądze i odchodzą, spluwając ci pod nogi."; } },
    { label: "Rozpędź ich (walka)", act: () => { const foes: Troop[] = []; addTroops(foes, "b_bandit", 6 + Math.floor(rr(0, 5))); P.honor -= 1; setTimeout(() => launchBattle({ kind: "field", enemies: [], allies: [], enemyTroops: foes, title: "Zemsta chłopów" }), 50); return "Widły przeciw stali."; } },
  ] };
  if (e.kind === "pilgrims") return { id: "echo-pilgrims", scene: "shrine", title: "Błogosławieństwo pielgrzymów", text: "Pielgrzymi, którym pomogłeś, wracają z kaplicy. Przynoszą poświęconą wodę i wieść: na drodze przed wami czają się zbóje.", ch: [
    { label: "Podziękuj (morale +5, wiara)", act: () => { P.morale = Math.min(100, P.morale + 5); P.faith = Math.min(100, P.faith + 15); const b = WORLD.parties.filter((o) => o.kind === "bandit").sort((x, y) => dist(x.x, x.y, p.x, p.y) - dist(y.x, y.y, p.x, p.y))[0]; if (b) WORLD.explored[cellOf(b.x, b.y)] = 1; return b ? `Zbóje (${b.name}) kryją się niedaleko. Widzisz ich na mapie.` : "Droga przed wami jest czysta."; } },
  ] };
  if (e.kind === "deserters") return { id: "echo-des", scene: "camp", title: "Pościg", text: "Konni z barwami lorda dopadają was na trakcie. „Szukamy dezerterów. Podobno przyjąłeś ich do siebie.”", ch: [
    { label: "Wydaj ich (relacja z frakcją +)", act: () => { const k = e.data?.type; const t = playerParty(WORLD).troops.find((x) => x.type === k); if (t) t.n = Math.max(0, t.n - (e.data?.n || 3)); playerParty(WORLD).troops = playerParty(WORLD).troops.filter((x) => x.n > 0); P.honor -= 1; return "Dezerterzy idą na szubienicę. Patrzą na ciebie, dopóki ich nie wyprowadzą."; } },
    { label: "Wyprzyj się (perswazja)", act: () => { if (chance(0.4 + P.attr.cha * 0.04)) return "Wierzą ci. Albo udają, że wierzą."; P.renown -= 3; return "Nie wierzą. Odjeżdżają, ale twoje imię trafi do raportu."; } },
  ] };
  return null;
}

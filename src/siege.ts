// Oblężenia (Build 0.22): ostrzał i trwałe zniszczenia murów, kapitulacja głodujących obrońców, wypady,
// podkop jako trzecia droga do twierdzy, walka w uliczkach po zdobyciu murów miasta, olej i kamienie z blanków.

function wallDmg(s: Settlement) { return clamp((s as any).wallDmg || 0, 0, 100); }
function addWallDmg(s: Settlement, v: number) { (s as any).wallDmg = clamp(wallDmg(s) + v, 0, 100); }
function wallWord(s: Settlement) { const d = wallDmg(s); return d >= 68 ? "mury w gruzach, dwie wyrwy" : d >= 34 ? "wyrwa w murze" : d >= 12 ? "mury nadkruszone" : "mury całe"; }

// Codziennie przy każdej osadzie z murami: naprawa, ostrzał AI, kapitulacja, wypady przeciw AI.
function siegeDaily(w: World, s: Settlement) {
  if (s.kind === "village") return;
  if (!s.siegeBy.length) { if (wallDmg(s) > 0) addWallDmg(s, -2); return; }   // naprawa trwa tygodnie
  const player = s.siegeBy.includes(w.pid);
  if (!player && s.siegeDays >= 3) addWallDmg(s, 5);   // AI stawia machiny i ostrzeliwuje mury
  const att = s.siegeBy.map((id) => partyById(w, id)).filter(Boolean) as Party[];
  const ap = att.reduce((a, p) => a + partyPower(w, p), 0), gp = troopPower(s.garrison);
  // kapitulacja: po wyczerpaniu zapasów i przy słabej załodze
  if (!player && s.faction !== 5 && s.siegeDays > siegeStores(s) + 3 && gp * 2 < ap && chance(0.3)) {
    const leader = att.sort((a, b) => partyPower(w, b) - partyPower(w, a))[0];
    chron(w, `Głodująca załoga ${s.name} otwiera bramy przed ${leader.name}.`, PAL.redL, "siege");
    s.garrison = s.garrison.map((t) => ({ ...t, n: Math.ceil(t.n * 0.3) }));
    captureSettlement(w, s, leader.faction, leader.lord ?? -1);
    fillGarrison(w, s, 8);
    for (const p of att) { p.siege = undefined; p.state = "idle"; p.wait = 0; }
    s.siegeBy = []; s.siegeDays = 0;
    return;
  }
  // wypad obrońców na obóz AI
  if (!player && gp * 1.4 > ap * 0.55 && chance(0.15)) {
    const tgt = pick(att);
    const k = gp / Math.max(1, gp + partyPower(w, tgt));
    applyLosses(tgt.troops, clamp(k * 0.35, 0.05, 0.4)); applyLosses(s.garrison, clamp((1 - k) * 0.25, 0.04, 0.3));
    chron(w, `Wypad z ${s.name}: obrońcy uderzają nocą na obóz ${tgt.name}.`, PAL.bone, "siege");
  }
}

// Gracz czeka dzień pod murami: ostrzał z machin, czasem wypad obrońców albo propozycja kapitulacji.
function playerSiegeDay(s: Settlement): boolean {
  const w = WORLD, P = w.player, p = playerParty(w), q = SW().q;
  let dmg = 0;
  if (q.treb >= 2) dmg += 10; if (q.cata >= 2) dmg += 7;
  if (dmg) { addWallDmg(s, dmg); if (chance(0.5)) applyLosses(s.garrison, 0.02); toast(`Ostrzał przez cały dzień: ${wallWord(s)}.`, PAL.gold); }
  if (q.mine > 0 && q.mine < ENGINES.find((e) => e.k === "mine")!.days && hasEngineer()) q.mine = Math.min(5, q.mine + 1);   // inżynier kopie dwa razy szybciej
  const gp = troopPower(s.garrison), mp = partyPower(w, p);
  // kapitulacja
  if (s.faction !== 5 && s.siegeDays > siegeStores(s) + 1 && gp < mp * 0.8 && chance(0.4)) { showCapitulation(s); return true; }
  // wypad
  if (gp > mp * 0.35 && troopCount(s.garrison) > 12 && chance(0.15)) { sallyAgainstPlayer(s); return true; }
  return false;
}
function showCapitulation(s: Settlement) {
  const w = WORLD, P = w.player;
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("siege", s.seed, s.culture, isNight(w)), "scene-img")}</div>
    <h1>Białe płótno na murach</h1><p>Z bramy ${s.name} wychodzi wychudzony herold. „Zapasy się skończyły. Kasztelan pyta o warunki: wolne wyjście dla załogi z bronią, a miasto jest twoje.”</p>
    <div class="choices"><button class="choice" data-a="ok"><span class="key">1</span>Przyjmij warunki (honor +2, bez szturmu)</button>
    <button class="choice" data-a="hard"><span class="key">2</span>Żądaj poddania bez broni (załoga trafia do niewoli, honor −1)</button>
    <button class="choice alt" data-a="no"><span class="key">3</span>Odrzuć: niech głodują dalej</button></div></div>`, {
    ok: () => { closeScreen(); const lines: string[] = []; P.honor += 2; s.relation += 10; chron(w, `${s.name} kapituluje przed ${P.name}. Załoga odchodzi z bronią.`, PAL.gold, "siege"); s.garrison = []; siegeWon(s, lines); lines.forEach((l) => toast(l, PAL.gold)); showSack(s); },
    hard: () => { closeScreen(); const lines: string[] = []; P.honor -= 1; const p = playerParty(w); for (const t of s.garrison) addTroops(p.prisoners, t.type, Math.max(0, t.n - t.wounded)); s.garrison = []; chron(w, `${s.name} poddaje się ${P.name} bez warunków.`, PAL.gold, "siege"); siegeWon(s, lines); lines.forEach((l) => toast(l, PAL.gold)); showSack(s); },
    no: () => { closeScreen(); enterSettlement(s); SET.tab = "siege"; renderSettlement(); },
  }, "dialog-scr");
}
function sallyAgainstPlayer(s: Settlement) {
  const w = WORLD;
  const sally: Troop[] = [];
  for (const t of s.garrison) { const n = Math.floor((t.n - t.wounded) * 0.45); if (n > 0) { addTroops(sally, t.type, n); removeTroops(s.garrison, t.type, n); } }
  if (troopCount(sally) < 4) { for (const t of sally) addTroops(s.garrison, t.type, t.n); return; }
  toast(`Wypad! Obrońcy ${s.name} uderzają nocą na wasz obóz.`, PAL.redL); sfx.horn?.(0.9);
  const ctx: any = { kind: "field", enemies: [], allies: [], enemyTroops: sally, title: `Wypad z ${s.name}` };
  ctx.after = (win: boolean) => {
    for (const t of sally) if (t.n > 0) addTroops(s.garrison, t.type, t.n);   // ocaleli wracają za mury
    if (!win) { const P = w.player as any; if (P.siegeWork) P.siegeWork.q = { ram: 0, tower: 0, treb: 0, cata: 0, mine: 0 }; toast("Obrońcy podpalili wasze machiny. Budowa od nowa.", PAL.redL); }
  };
  launchBattle(ctx, { night: true, terrain: "plains", campFort: true });
}

// Podkop: po wykopaniu nocą wchodzisz z małym oddziałem do środka twierdzy.
function mineAssault(s: Settlement) {
  const w = WORLD;
  const inner: Troop[] = [];
  for (const t of s.garrison) { const n = Math.ceil((t.n - t.wounded) * 0.4); if (n > 0) { addTroops(inner, t.type, n); removeTroops(s.garrison, t.type, n); } }
  toast("Ostatnie uderzenia kilofem. Ziemia się zapada, jesteście pod dziedzińcem!", PAL.gold);
  const ctx: any = { kind: "field", enemies: [], allies: [], enemyTroops: inner, title: `Podkop pod ${s.name}` };
  ctx.after = (win: boolean) => {
    for (const t of inner) if (t.n > 0) addTroops(s.garrison, t.type, t.n);
    if (win) { const lines: string[] = []; s.garrison = s.garrison.map((t) => ({ ...t, n: Math.floor(t.n * 0.2) })).filter((t) => t.n > 0); chron(w, `${w.player.name} zdobywa ${s.name} podkopem.`, PAL.gold, "siege"); siegeWon(s, lines); lines.forEach((l) => toast(l, PAL.gold)); setTimeout(() => showSack(s), 30); }
    else { SW().q.mine = 0; toast("Podkop zawalony. Obrońcy zasypali chodnik.", PAL.redL); }
  };
  launchBattle(ctx, { night: true, terrain: "streets", maxPerSide: 30 });
}

// Walka w uliczkach: po zdobyciu murów miasta reszta załogi i mieszczanie bronią się między domami.
function launchStreets(s: Settlement) {
  const w = WORLD;
  const def: Troop[] = s.garrison.filter((t) => t.n - t.wounded > 0).map((t) => ({ ...t, n: t.n - t.wounded, wounded: 0 }));
  s.garrison = [];
  const mil = RECRUITS[s.culture]?.village?.[0];
  if (mil && s.faction !== 5) addTroops(def, mil, 6 + Math.round(s.prosperity / 10));
  if (troopCount(def) < 3) { const lines: string[] = []; siegeWon(s, lines); lines.forEach((l) => toast(l, PAL.gold)); showSack(s); return; }
  toast(`Mury padły, ale ${s.name} się nie poddaje. Walka w uliczkach!`, PAL.redL); sfx.horn?.(1);
  launchBattle({ kind: "siege", enemies: [], allies: [], settlement: s, enemyTroops: def, title: `Uliczki ${s.name}`, streets: true } as any, { terrain: "streets", siegeDefender: undefined });
}

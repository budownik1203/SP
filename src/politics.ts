// Polityka: rzadsze i dłuższe wojny, sojusze, trybuty, śluby, wyprawy marszałków, rady nadające lenna,
// lojalność i zdrady lordów, zaraza Morvatha, historia siły frakcji i zdarzenia czekające na decyzję gracza.

interface FCampaign { marshal: number; target: number; gather: number; stage: "gather" | "march"; start: number; until: number; }
interface PendingEv { kind: "vote" | "summon" | "marshalOffer" | "ransomOffer" | "envoyBack" | "peaceOffer" | "rumor" | "rebellion" | "plotChoice"; f: number; s?: number; cands?: number[]; lord?: number; gold?: number; text?: string; ok?: boolean; day: number; }
interface Envoy { to: number; kind: "peace" | "alliance" | "tribute" | "marriage" | "nonaggr"; arrive: number; gold: number; }

const MAJOR = [1, 2, 3, 4];
function fst(w: World, f: number): FactionState & { ally?: Record<number, boolean>; camp?: FCampaign | null; lastCamp?: number; hist?: number[] } { return w.factions[f] as any; }
function pending(w: World): PendingEv[] { return ((w as any).pending ||= []); }
function envoys(w: World): Envoy[] { return ((w as any).envoys ||= []); }
function isAlly(w: World, a: number, b: number) { return !!fst(w, a)?.ally?.[b]; }
function setAlly(w: World, a: number, b: number, on: boolean, silent = false) {
  const A = fst(w, a), B = fst(w, b); if (!A || !B) return;
  (A.ally ||= {})[b] = on; (B.ally ||= {})[a] = on;
  if (!silent) chron(w, on ? `${factionName(a)} i ${factionName(b)} zawierają sojusz.` : `Sojusz ${factionName(a)} i ${factionName(b)} rozpada się.`, on ? PAL.gold : PAL.ash, on ? "peace" : "war");
}
function factionPower(w: World, f: number) {
  let s = 0;
  for (const p of w.parties) if (p.faction === f && p.kind === "lord") s += partyPower(w, p);
  for (const st of w.settlements) if (st.faction === f) s += troopPower(st.garrison) * 0.5;
  return Math.round(s);
}
function lordLoyal(L: Lord): number { const a = L as any; if (a.loyal === undefined) a.loyal = L.ruler ? 100 : Math.round(35 + (hashInt(L.id * 977 + 13) % 40)); return a.loyal; }
function addLoyal(L: Lord, d: number) { (L as any).loyal = clamp(lordLoyal(L) + d, 0, 100); }

function dailyPolitics(w: World) {
  const ag = w.diff?.aggro ?? 1;
  // historia siły co dzień (do wykresu w oknie frakcji)
  for (const f of [1, 2, 3, 4, 5, PLAYER_FACTION]) {
    const F = fst(w, f); if (!F) continue;
    const h = (F.hist ||= []); h.push(F.alive ? factionPower(w, f) : 0); if (h.length > 120) h.shift();
  }
  // wojny i pokój między głównymi frakcjami (Morvath walczy ze wszystkimi)
  for (const a of MAJOR) for (const b of MAJOR) if (a < b && w.factions[a].alive && w.factions[b].alive) {
    const fa = fst(w, a), fb = fst(w, b);
    if (fa.war[b]) {
      fa.warDays[b] = (fa.warDays[b] || 0) + 1; fb.warDays[a] = fa.warDays[b];
      fa.relation[b] = (fa.relation[b] || 0) - 0.15; fb.relation[a] = fa.relation[b];
      const d = fa.warDays[b];
      // słabsza strona płaci trybut za pokój
      if (d > 25 && chance(0.03)) {
        const pa = factionPower(w, a), pb = factionPower(w, b);
        const [weak, strong] = pa < pb ? [a, b] : [b, a];
        if (Math.min(pa, pb) < Math.max(pa, pb) * 0.55) {
          const g = Math.round(rr(600, 1500));
          fst(w, weak).gold -= g; fst(w, strong).gold += g;
          setWar(w, a, b, false, true);
          chron(w, `${factionName(weak)} płaci trybut (${g} denarów) i kupuje pokój od ${factionName(strong)}.`, PAL.moss, "peace");
          continue;
        }
      }
      if (d > 45 && chance(0.012 + (d - 45) * 0.0006)) setWar(w, a, b, false);
    } else {
      fa.truce[b] = Math.max(0, (fa.truce[b] || 0) - 1); fb.truce[a] = fa.truce[b];
      const rel0 = fa.relation[b] || 0;
      fa.relation[b] = rel0 + (isAlly(w, a, b) ? 0.1 : rel0 < 0 ? 0.03 : -0.01); fb.relation[a] = fa.relation[b];
      const wars = MAJOR.filter((x) => fa.war[x]).length;
      if (!isAlly(w, a, b) && fa.truce[b] <= 0 && wars < 2 && chance((0.003 + (rel0 < -10 ? 0.005 : 0)) * ag)) {
        setWar(w, a, b, true);
        // sojusznicy napadniętego dotrzymują słowa
        for (const c of MAJOR) if (c !== a && c !== b && isAlly(w, c, b) && !fst(w, c).war[a] && (fst(w, c).truce[a] || 0) <= 0 && chance(0.7)) { setWar(w, c, a, true, true); chron(w, `${factionName(c)} dotrzymuje sojuszu i staje do wojny przeciw ${factionName(a)}.`, PAL.redL, "war"); }
      }
      // sojusz: dobre relacje i wspólny wróg
      const common = MAJOR.some((x) => x !== a && x !== b && fa.war[x] && fb.war[x]);
      if (!isAlly(w, a, b) && rel0 > 12 && chance(common ? 0.008 : 0.002)) setAlly(w, a, b, true);
      if (isAlly(w, a, b) && rel0 < -5) setAlly(w, a, b, false);
      // ślub dynastyczny
      if (rel0 > 0 && chance(0.0015)) {
        const la = pick(w.lords.filter((l) => l.faction === a && l.alive)), lb = pick(w.lords.filter((l) => l.faction === b && l.alive));
        if (la && lb) { fa.relation[b] = rel0 + 25; fb.relation[a] = fa.relation[b]; chron(w, `Ślub: dom ${la.name} (${factionShort(a)}) łączy się z domem ${lb.name} (${factionShort(b)}). Dzwony biją w obu królestwach.`, PAL.gold, "peace"); }
      }
    }
  }
  // sojusznicy dołączają do trwających wojen
  for (const a of MAJOR) for (const b of MAJOR) if (a !== b && isAlly(w, a, b)) for (const x of MAJOR) if (x !== a && x !== b && fst(w, b).war[x] && !fst(w, a).war[x] && (fst(w, a).truce[x] || 0) <= 0 && chance(0.02)) { setWar(w, a, x, true, true); chron(w, `${factionName(a)} wspiera sojusznika (${factionShort(b)}) i wypowiada wojnę: ${factionName(x)}.`, PAL.redL, "war"); }
  coalitionDaily(w);
  wearinessDaily(w);
  rebelsDaily(w);
  campaignsDaily(w);
  loyaltyDaily(w);
  plagueDaily(w);
  envoysDaily(w);
  captiveLordsDaily(w);
}

// ---------- Wyprawy marszałków ----------
function enemyTargets(w: World, f: number) { return w.settlements.filter((s) => s.kind !== "village" && s.faction !== f && s.faction !== 6 && atWar(w, f, s.faction)); }
function campaignsDaily(w: World) {
  const P = w.player;
  for (const f of [1, 2, 3, 4, 5, PLAYER_FACTION]) {
    const F = fst(w, f); if (!F || !F.alive) continue;
    const C = F.camp;
    if (C) {
      const t = w.settlements[C.target];
      const mp = C.marshal === -2 ? playerParty(w) : partyById(w, lordById(w, C.marshal)?.party ?? -1);
      const done = t && t.faction === f;
      if (done) {
        chron(w, `Wyprawa ${factionShort(f)} zakończona sukcesem: ${t.name} zdobyte.`, PAL.gold, "siege");
        if (P.liege === f && P.status !== "król" && (C as any).joined) { P.renown += 40; P.gold += 500; addLogMsg(`Udział w zwycięskiej wyprawie: +40 sławy, +500 denarów.`, PAL.gold); }
        F.camp = null; F.lastCamp = w.day; continue;
      }
      if (!t || !mp || w.day > C.until || !atWar(w, f, t.faction)) {
        chron(w, `Wyprawa ${factionShort(f)}${t ? ` na ${t.name}` : ""} zostaje rozwiązana.`, PAL.ash, "siege");
        F.camp = null; F.lastCamp = w.day; continue;
      }
      if (C.stage === "gather" && w.day - C.start >= 4 && C.marshal !== -2) {
        C.stage = "march";
        const L = lordById(w, C.marshal);
        chron(w, `${L.title} ${L.name} prowadzi wyprawę ${factionShort(f)} na ${t.name}.`, PAL.redL, "siege");
      }
      // gracz w pobliżu marszałka = uczestnik
      if (P.liege === f && mp && mp.kind !== "player" && dist(mp.x, mp.y, playerParty(w).x, playerParty(w).y) < 90) (C as any).joined = true;
      continue;
    }
    if (f === PLAYER_FACTION) continue;
    if (w.day - (F.lastCamp || 0) < 14 || !chance(0.05 * (w.diff?.aggro ?? 1))) continue;
    const targets = enemyTargets(w, f); if (!targets.length) continue;
    const lords = w.lords.filter((l) => l.faction === f && l.alive && l.captive < 0 && partyById(w, l.party) && troopCount(partyById(w, l.party).troops) >= 30).sort((a, b) => b.renown - a.renown);
    if (lords.length < 2) continue;
    const m = lords.find((l) => !l.ruler) || lords[0];
    const mp = partyById(w, m.party);
    const tgt = targets.sort((a, b) => dist(mp.x, mp.y, a.cx * WCELL, a.cy * WCELL) * (1 + troopPower(a.garrison) / 60) - dist(mp.x, mp.y, b.cx * WCELL, b.cy * WCELL) * (1 + troopPower(b.garrison) / 60))[0];
    const own = w.settlements.filter((s) => s.faction === f && s.kind !== "village").sort((a, b) => dist(a.cx, a.cy, tgt.cx, tgt.cy) - dist(b.cx, b.cy, tgt.cx, tgt.cy))[0];
    // gracz jako wasal z dużą sławą może dostać buławę marszałka
    if (P.liege === f && P.status === "wasal" && P.renown >= 350 && chance(0.35)) { pending(w).push({ kind: "marshalOffer", f, s: tgt.id, day: w.day }); F.lastCamp = w.day; continue; }
    F.camp = { marshal: m.id, target: tgt.id, gather: own ? own.id : tgt.id, stage: "gather", start: w.day, until: w.day + 28 };
    chron(w, `${factionName(f)} ogłasza wyprawę. Marszałkiem zostaje ${m.title} ${m.name}. Lordowie zbierają się ${own ? `pod ${own.name}` : "w polu"}.`, PAL.gold, "siege");
    if (P.liege === f && P.status !== "król") pending(w).push({ kind: "summon", f, s: own ? own.id : tgt.id, lord: m.id, day: w.day });
  }
}
// Cel lorda w czasie wyprawy: marszałek prowadzi, reszta idzie za nim i oblega to samo.
function campaignGoal(w: World, p: Party, L: Lord): boolean {
  const F = fst(w, p.faction); const C = F?.camp; if (!C) return false;
  if (troopCount(p.troops) < 20) return false;
  const t = w.settlements[C.target]; if (!t) return false;
  if (C.marshal === L.id) {
    if (C.stage === "gather") { const g = w.settlements[C.gather]; goTo(w, p, g.cx * WCELL + rr(-10, 10), g.cy * WCELL + 18); p.state = "patrol"; p.wait = 8; return true; }
    p.state = "besiege"; p.target = t.id; goTo(w, p, t.cx * WCELL + 4, t.cy * WCELL + 14); p.wait = 40; return true;
  }
  const mp = C.marshal === -2 ? playerParty(w) : partyById(w, lordById(w, C.marshal)?.party ?? -1);
  if (!mp) return false;
  const msiege = mp.siege !== undefined ? mp.siege : C.marshal === -2 ? undefined : (mp.state === "besiege" ? mp.target : undefined);
  if (msiege !== undefined && w.settlements[msiege] && atWar(w, p.faction, w.settlements[msiege].faction)) {
    const s = w.settlements[msiege]; p.state = "besiege"; p.target = s.id; goTo(w, p, s.cx * WCELL + rr(-8, 12), s.cy * WCELL + 14); p.wait = 40; return true;
  }
  goTo(w, p, mp.x + rr(-16, 16), mp.y + rr(-16, 16)); p.state = "patrol"; p.wait = 4;
  return true;
}
// Gracz jako marszałek: lordowie frakcji ciągną za jego armią.
function playerStartCampaign(w: World, f: number, target: number) {
  const F = fst(w, f); if (!F) return;
  const t = w.settlements[target];
  F.camp = { marshal: -2, target, gather: target, stage: "march", start: w.day, until: w.day + 30 };
  chron(w, `${w.player.name} obejmuje buławę marszałka ${factionShort(f)} i prowadzi wyprawę na ${t.name}.`, PAL.gold, "siege");
  for (const p of w.parties) if (p.kind === "lord" && p.faction === f) p.wait = 0;
}

// ---------- Rada: komu nadać zdobyte lenno ----------
function councilVote(w: World, s: Settlement, f: number, conqueror: number) {
  const P = w.player;
  if (!(P.liege === f && P.status === "wasal") || s.kind === "village") return;
  const lords = w.lords.filter((l) => l.faction === f && l.alive && !l.ruler).sort((a, b) => b.renown - a.renown);
  const cands = [conqueror, ...lords.map((l) => l.id).filter((id) => id !== conqueror)].filter((id) => id >= 0).slice(0, 3);
  cands.push(-2);
  pending(w).push({ kind: "vote", f, s: s.id, cands, day: w.day });
}
function resolveVote(w: World, ev: PendingEv, vote: number) {
  const s = w.settlements[ev.s], P = w.player;
  if (!s || s.faction !== ev.f) return "Rada się rozeszła: miejsce znów w obcych rękach.";
  const ruler = w.lords.find((l) => l.faction === ev.f && l.ruler);
  const fiefs = (id: number) => w.settlements.filter((x) => x.kind !== "village" && (id === -2 ? x.owner === -2 : x.owner === id)).length;
  const score = (id: number) => {
    if (id === -2) return P.renown / 120 + (ruler ? ruler.relation / 20 : 0) - fiefs(-2) * 1.2 + (vote === -2 ? 2 : 0) + rr(0, 1.5);
    const L = lordById(w, id); return L.renown / 120 - fiefs(id) * 1.2 + (id === vote ? 3 : 0) + rr(0, 1.5);
  };
  const ranked = ev.cands.map((id) => [id, score(id)] as [number, number]).sort((a, b) => b[1] - a[1]);
  const win = ranked[0][0];
  s.owner = win; for (const v of w.settlements) if (v.bound === s.id) v.owner = win;
  for (const id of ev.cands) if (id >= 0 && id !== win) { const L = lordById(w, id); addLoyal(L, -6); }
  if (vote >= 0) { const L = lordById(w, vote); lordRel(w, L, win === vote ? 8 : 4, "poparłeś go w radzie"); }
  for (const id of ev.cands) if (id >= 0 && id !== vote) lordRel(w, lordById(w, id), -2, "głosowałeś przeciw niemu w radzie");
  const name = win === -2 ? P.name : `${lordById(w, win).title} ${lordById(w, win).name}`;
  chron(w, `Rada ${factionShort(ev.f)} nadaje ${s.name}: ${name}.`, PAL.gold, "lord");
  return win === -2 ? `Rada nadaje ci ${s.name}! To twoje lenno.` : `Rada nadaje ${s.name}: ${name}.`;
}

// ---------- Lojalność, zdrady, bunty ----------
function loyaltyDaily(w: World) {
  const P = w.player;
  for (const L of w.lords) {
    if (!L.alive || L.ruler || L.captive >= 0) continue;
    const hasFief = w.settlements.some((s) => s.owner === L.id && s.kind !== "village");
    const ownPow = factionPower(w, L.faction);
    const losing = MAJOR.some((x) => atWar(w, L.faction, x) && factionPower(w, x) > ownPow * 1.2);
    // urazy na dworze: pominięcie, kłótnia z władcą, spór o ziemię
    if (chance(0.004)) { addLoyal(L, -rr(10, 20)); if (chance(0.5)) chron(w, `${L.title} ${L.name} kłóci się z władcą ${factionShort(L.faction)} ${pick(["o nadanie ziemi", "o łupy z wojny", "o obrazę przy uczcie", "o swoje prawa do zamku"])}.`, PAL.ash, "lord"); }
    addLoyal(L, (hasFief ? 0.05 : -0.25) + (losing ? (L.personality === "chciwy" ? -0.45 : -0.25) : 0.03) + (L.personality === "honorowy" ? 0.06 : 0) - weariness(w, L.faction) * 0.15);
    const lo = lordLoyal(L);
    // plotki o niezadowoleniu: gracz może zareagować, zanim lord zdradzi
    const A = L as any;
    if (lo < 25 && !A.rumor) {
      A.rumor = w.day;
      chron(w, `Plotki: ${L.title} ${L.name} (${factionShort(L.faction)}) jest niezadowolony i szuka nowego pana.`, PAL.ash, "lord");
      if (L.faction === PLAYER_FACTION || (L.faction === P.liege && P.status !== "król")) pending(w).push({ kind: "rumor" as any, f: L.faction, lord: L.id, day: w.day });
    }
    if (lo >= 30) A.rumor = 0;
    if (lo >= 15 || !chance(0.02) || (A.rumor && w.day - A.rumor < 6)) continue;
    // bunt: lord z lennem przy bardzo niskiej lojalności podnosi własny sztandar
    if (lo < 10 && L.faction !== PLAYER_FACTION && MAJOR.includes(L.faction) && w.settlements.some((x) => x.owner === L.id && x.kind !== "village") && !rebelOf(w, L.faction)) { startRebellion(w, L); continue; }
    // zdrada: do gracza-króla, jeśli go lubi, inaczej do najsilniejszego wroga swojej korony
    let to = -1;
    if (P.status === "król" && fst(w, PLAYER_FACTION) && L.relation >= 25 && L.faction !== PLAYER_FACTION) to = PLAYER_FACTION;
    else {
      const enemies = MAJOR.filter((x) => x !== L.faction && atWar(w, L.faction, x) && w.factions[x].alive).sort((a, b) => factionPower(w, b) - factionPower(w, a));
      if (enemies.length) to = enemies[0];
      else if (L.personality === "okrutny" && L.faction !== 5) to = 5;
    }
    if (to < 0) continue;
    defectLord(w, L, to, lo < 8);
  }
  // wasale gracza-króla: niska relacja i lojalność = bunt
  if (P.status === "król") for (const L of w.lords) if (L.alive && L.faction === PLAYER_FACTION && L.relation < -15 && lordLoyal(L) < 25 && chance(0.02)) {
    const enemies = MAJOR.filter((x) => w.factions[x].alive && atWar(w, PLAYER_FACTION, x));
    if (enemies.length) defectLord(w, L, pick(enemies), true);
  }
}
function defectLord(w: World, L: Lord, to: number, rebel: boolean) {
  const from = L.faction;
  const fiefs = w.settlements.filter((s) => s.owner === L.id);
  L.faction = to; (L as any).loyal = 55;
  const p = partyById(w, L.party); if (p) { p.faction = to; p.siege = undefined; p.state = "idle"; p.wait = 0; }
  for (const s of fiefs) { s.faction = to; s.siegeBy = []; s.siegeDays = 0; for (const v of w.settlements) if (v.bound === s.id) { v.faction = to; } }
  if (fiefs.length) w.ownerVersion++;
  chron(w, rebel ? `Bunt! ${L.title} ${L.name} zrywa z ${factionName(from)} i przechodzi do ${factionName(to)}${fiefs.length ? ` razem z ${fiefs.map((s) => s.name).join(", ")}` : ""}.` : `Zdrada: ${L.title} ${L.name} porzuca ${factionName(from)} dla ${factionName(to)}${fiefs.length ? ` i oddaje ${fiefs.map((s) => s.name).join(", ")}` : ""}.`, PAL.redL, "lord");
  if (to === PLAYER_FACTION) addLogMsg(`${L.title} ${L.name} przysięga ci wierność!`, PAL.gold);
}

// ---------- Zaraza Morvatha ----------
function plagueDaily(w: World) {
  if (!w.factions[5]?.alive) return;
  const pl = w.diff?.plague ?? 1;
  const mor = w.settlements.filter((s) => s.faction === 5);
  // martwa ziemia wysysa okoliczne wioski
  for (const s of w.settlements) if (s.faction !== 5 && s.kind === "village" && w.blight[s.cy * WGW + s.cx]) s.prosperity = Math.max(5, s.prosperity - 0.3 * pl);
  // osaczony Upiorny Król wskrzesza legiony w ostatnich twierdzach
  const forts = mor.filter((s) => s.kind !== "village");
  if (forts.length && forts.length <= 2 && chance(0.12 * pl)) { const f0 = pick(forts); fillGarrison(w, f0, Math.round(20 * pl)); if (chance(0.3)) chron(w, `W ${f0.name} ziemia pęka: Upiorny Król wskrzesza poległych.`, PAL.purpleL, "plague"); }
  // wioski pod władzą żywego zamku bywają oczyszczane przez kapłanów
  for (const v of mor) if (v.kind === "village" && v.bound >= 0 && w.settlements[v.bound] && w.settlements[v.bound].faction !== 5 && chance(0.015 / pl)) {
    const B = w.settlements[v.bound]; v.faction = B.faction; v.owner = B.owner; w.ownerVersion++; recomputeBlight(w);
    chron(w, `Kapłani ${factionShort(B.faction)} oczyszczają ${v.name}. Ziemia znów rodzi.`, PAL.moss, "plague");
  }
  if (!mor.length || !chance(Math.min(0.4, (0.03 + w.day * 0.00015) * pl))) return;
  let best: Settlement | null = null, bd = 1e9;
  for (const v of w.settlements) {
    if (v.faction === 5 || v.kind !== "village" || v.siegeBy.length) continue;
    for (const m of mor) { const d = dist(v.cx, v.cy, m.cx, m.cy); if (d < bd && d < 38) { bd = d; best = v; } }
  }
  if (!best) return;
  const old = best.faction;
  best.faction = 5; best.owner = w.lords.find((l) => l.faction === 5 && l.alive)?.id ?? -1;
  best.prosperity = 10; best.raided = 0;
  w.ownerVersion++;
  recomputeBlight(w);
  chron(w, `Zaraza Morvatha pochłania wioskę ${best.name} (${factionShort(old)}). Zmarli wstają z grobów, żywi uciekają.`, PAL.purpleL, "plague");
}
// Martwa ziemia: komórki, których najbliższą osadą jest osada Morvatha.
function recomputeBlight(w: World) {
  const N = WGW * WGH;
  // granica martwej ziemi poszarpana: próbka najbliższej osady z przesuniętej komórki
  for (let i = 0; i < N; i++) {
    const x = i % WGW, y = Math.floor(i / WGW);
    const jx = clamp(Math.round(x + (vnoise(x, y, 7) - 0.5) * 12), 0, WGW - 1), jy = clamp(Math.round(y + (vnoise(x + 40, y, 7) - 0.5) * 12), 0, WGH - 1);
    const s = w.settlements[w.nearest[cidx(jx, jy)]];
    w.blight[i] = s && s.faction === 5 && w.terr[i] !== T_SEA ? 1 : 0;
  }
  WMAP = null;
}

// ---------- Posłowie gracza-króla ----------
function sendEnvoy(w: World, to: number, kind: Envoy["kind"], gold = 0) {
  const P = w.player;
  if (gold) P.gold -= gold;
  envoys(w).push({ to, kind, arrive: w.day + 2 + Math.floor(rr(0, 3)), gold });
  chron(w, `${P.name} wysyła posła do ${factionName(to)}.`, PAL.bone, "player");
}
function envoysDaily(w: World) {
  const P = w.player, E = envoys(w);
  for (const e of E.slice()) {
    if (w.day < e.arrive) continue;
    E.splice(E.indexOf(e), 1);
    const me = fst(w, PLAYER_FACTION), them = fst(w, e.to);
    if (!me || !them || !them.alive) continue;
    const rel0 = them.relation[PLAYER_FACTION] || 0;
    const ratio = factionPower(w, PLAYER_FACTION) / Math.max(1, factionPower(w, e.to));
    const ruler = w.lords.find((l) => l.faction === e.to && l.ruler);
    const rr0 = ruler ? ruler.relation : 0;
    let ok = false, text = "";
    if (e.kind === "peace") { const c = clamp(0.25 + rel0 / 100 + rr0 / 120 + (ratio - 1) * 0.25 + e.gold / 4000 + Math.min(0.2, (me.warDays[e.to] || 0) / 150), 0.05, 0.9); ok = chance(c); if (ok) setWar(w, PLAYER_FACTION, e.to, false); text = ok ? `${factionName(e.to)} przyjmuje pokój.` : `${factionName(e.to)} odrzuca pokój. Poseł wraca z niczym${e.gold ? ", złoto przepadło" : ""}.`; }
    if (e.kind === "alliance") { const c = clamp(0.1 + rel0 / 70 + rr0 / 100 + (ratio - 0.6) * 0.3, 0.02, 0.85); ok = !atWar(w, PLAYER_FACTION, e.to) && chance(c); if (ok) setAlly(w, PLAYER_FACTION, e.to, true); text = ok ? `${factionName(e.to)} zawiera z tobą sojusz.` : `${factionName(e.to)} nie chce sojuszu.`; }
    if (e.kind === "nonaggr") { const c = clamp(0.35 + rel0 / 80 + rr0 / 120, 0.05, 0.9); ok = !atWar(w, PLAYER_FACTION, e.to) && chance(c); if (ok) { me.truce[e.to] = 60; them.truce[PLAYER_FACTION] = 60; } text = ok ? `${factionName(e.to)} zgadza się na 60 dni rozejmu.` : `${factionName(e.to)} nie składa obietnic.`; }
    if (e.kind === "tribute") { const c = clamp(0.1 + (ratio - 1.2) * 0.5 + (atWar(w, PLAYER_FACTION, e.to) ? 0.15 : -0.1), 0.02, 0.8); ok = chance(c); const g = Math.round(400 + factionPower(w, e.to) * 0.8); if (ok) { P.gold += g; them.gold -= g; if (atWar(w, PLAYER_FACTION, e.to)) setWar(w, PLAYER_FACTION, e.to, false, true); } else { them.relation[PLAYER_FACTION] = rel0 - 8; } text = ok ? `${factionName(e.to)} płaci ci trybut: ${g} denarów${atWar(w, PLAYER_FACTION, e.to) ? "" : " i kupuje pokój"}.` : `${factionName(e.to)} śmieje się z żądania trybutu (relacja −8).`; }
    if (e.kind === "marriage") { const c = clamp(0.2 + rel0 / 60 + rr0 / 80 + P.renown / 2000, 0.05, 0.85); ok = !atWar(w, PLAYER_FACTION, e.to) && chance(c) && !(P as any).spouse; if (ok) { (P as any).spouse = `${pick(["Adela", "Brygida", "Mirela", "Ottokar", "Wencel", "Halina"])} z domu ${ruler ? ruler.name : factionShort(e.to)}`; them.relation[PLAYER_FACTION] = rel0 + 30; me.relation[e.to] = them.relation[PLAYER_FACTION]; if (ruler) lordRel(w, ruler, 20, "ślub z jego domem"); P.renown += 40; } text = ok ? `Ślub! ${(P as any).spouse} zostaje twoim małżonkiem. Relacje z ${factionShort(e.to)} rosną.` : `${factionName(e.to)} odmawia ręki.`; }
    pending(w).push({ kind: "envoyBack", f: e.to, text, ok, day: w.day });
    chron(w, text, ok ? PAL.moss : PAL.ash, "player");
    if (ok) them.relation[PLAYER_FACTION] = (them.relation[PLAYER_FACTION] || 0) + 5;
  }
  // wrogowie króla sami czasem proponują pokój
  if (P.status === "król" && fst(w, PLAYER_FACTION)) for (const f of MAJOR) if (atWar(w, PLAYER_FACTION, f) && (fst(w, PLAYER_FACTION).warDays[f] || 0) > 30 && chance(0.01)) {
    const ratio = factionPower(w, PLAYER_FACTION) / Math.max(1, factionPower(w, f));
    if (ratio > 0.9) pending(w).push({ kind: "peaceOffer", f, gold: ratio > 1.4 ? Math.round(300 + ratio * 200) : 0, day: w.day });
  }
  if (fst(w, PLAYER_FACTION)) for (const f of MAJOR) if (fst(w, PLAYER_FACTION).war[f]) { const F = fst(w, PLAYER_FACTION); F.warDays[f] = (F.warDays[f] || 0) + 1; }
}

// ---------- Lordowie w niewoli gracza ----------
function captiveLordsDaily(w: World) {
  for (const L of w.lords) if (L.alive && L.captive === PLAYER_FACTION && chance(0.08) && !pending(w).some((e) => e.kind === "ransomOffer" && e.lord === L.id)) {
    pending(w).push({ kind: "ransomOffer", f: L.faction, lord: L.id, gold: Math.round(300 + L.renown * (L.ruler ? 1.8 : 0.9)), day: w.day });
  }
}
function executeLord(w: World, L: Lord) {
  const P = w.player;
  L.alive = false; L.captive = -1;
  P.honor -= 15; P.renown += 20;
  for (const o of w.lords) if (o.alive && o.faction === L.faction) lordRel(w, o, o.ruler ? -35 : -20, `stracenie ${L.name}`);
  for (const o of w.lords) if (o.alive && o.faction !== L.faction && o.personality === "honorowy") lordRel(w, o, -6, "zabijasz jeńców");
  const fiefs = w.settlements.filter((s) => s.owner === L.id); const heir = w.lords.find((o) => o.alive && o.faction === L.faction && !o.ruler);
  for (const s of fiefs) s.owner = heir ? heir.id : -1;
  const F = fst(w, L.faction); if (F) F.relation[PLAYER_FACTION] = (F.relation[PLAYER_FACTION] || 0) - 30;
  chron(w, `${P.name} każe ściąć jeńca: ${L.title} ${L.name}. Wieść niesie się po wszystkich dworach.`, PAL.redL, "lord");
}

// ---------- Wątek główny: Popiół Morvatha ----------
// 0: odnajdź pustelnika w kapliczce · 1: zdobądź 3 relikwie z ruin · 2: zniszcz Upiornego Króla (jego armię lub stolicę).
function plotStart(w: World) {
  const P = w.player;
  const shrine = w.places.filter((p) => p.kind === "shrine").sort((a, b) => dist(a.cx, a.cy, playerParty(w).x / WCELL, playerParty(w).y / WCELL) - dist(b.cx, b.cy, playerParty(w).x / WCELL, playerParty(w).y / WCELL))[0];
  if (!shrine) return;
  w.plot.hermit = shrine.id; shrine.seen = true;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) { const cx = shrine.cx + dx, cy = shrine.cy + dy; if (cx >= 0 && cy >= 0 && cx < WGW && cy < WGH) w.explored[cy * WGW + cx] = 1; }
  P.quests.push({ id: w.questId++, kind: "plot" as any, giver: -1, target: shrine.id, amount: 0, reward: 0, day: w.day, days: 9999, text: `Popiół Morvatha: we śnie widziałeś starca przy kapliczce ${shrine.name}. Odszukaj go.`, done: false } as any);
  chron(w, `${P.name} śni o płonącym niebie i starcu przy kapliczce. Coś się zaczyna.`, PAL.purpleL, "player");
}
function plotQuest(w: World) { return w.player.quests.find((q) => (q.kind as string) === "plot" && !q.done); }
function plotAdvance(w: World, stage: number, text: string, target = -1) {
  const P = w.player, q = plotQuest(w);
  w.plot.stage = stage;
  if (q) { q.text = text; q.target = target; }
  chron(w, text, PAL.purpleL, "player");
}

function plotRef(w: World): { kind: "party" | "place" | "settlement"; id: number } | null {
  const P = w.plot; if (!P || P.done) return null;
  if (P.stage === 0 && P.hermit !== undefined) return { kind: "place", id: P.hermit };
  if (P.stage === 1) {
    const p = playerParty(w);
    const r = w.places.filter((pl) => pl.kind === "ruins" && pl.cleared <= 0 && !((w.plot as any).done_ruins || []).includes(pl.id)).sort((a, b) => dist(a.cx * WCELL, a.cy * WCELL, p.x, p.y) - dist(b.cx * WCELL, b.cy * WCELL, p.x, p.y))[0];
    return r ? { kind: "place", id: r.id } : null;
  }
  if (P.stage === 3) {
    const A = P as any;
    if (A.path === "crusade") { const cap = w.settlements.find((s) => s.faction === A.f && s.kind === "town" && s.capital) || w.settlements.find((s) => s.faction === A.f && s.kind === "town"); return cap ? { kind: "settlement", id: cap.id } : null; }
    if (A.path === "dark" && A.ritual !== undefined) return { kind: "place", id: A.ritual };
    return null;
  }
  if (P.stage === 2 || P.stage === 4) {
    const K = w.lords.find((l) => l.faction === 5 && l.ruler && l.alive);
    if (K && K.party >= 0 && partyById(w, K.party)) return { kind: "party", id: K.party };
    const cap = w.settlements.find((s) => s.faction === 5 && s.kind === "town") || w.settlements.find((s) => s.faction === 5 && s.kind === "castle");
    return cap ? { kind: "settlement", id: cap.id } : null;
  }
  return null;
}
// Zdarzenia wątku: odwiedziny pustelnika, relikwia z ruin, upadek Upiornego Króla.
function plotHermit(w: World): string | null {
  if (!w.plot || w.plot.stage !== 0) return null;
  plotAdvance(w, 1, "Popiół Morvatha: pustelnik mówi o trzech relikwiach Świtu ukrytych w ruinach. Oczyść ruiny i odnajdź je (0/3).");
  w.player.faith = 100;
  return "Starzec otwiera oczy, zanim się odezwiesz. „Śniłeś o płonącym niebie. Ja też. Upiorny Król rośnie, bo nikt nie pamięta, jak go spętano. Trzy relikwie Świtu leżą w ruinach dawnych świątyń. Przynieś je, a pokażę ci, jak złamać jego koronę.” Kładzie ci dłoń na czole: wiara wraca.";
}
function plotRuins(w: World, pl: SpecialPlace, lines: string[]) {
  if (!w.plot || w.plot.stage !== 1) return;
  const done: number[] = ((w.plot as any).done_ruins ||= []);
  if (done.includes(pl.id)) return;
  done.push(pl.id); w.plot.relics++;
  lines.push(`Wśród kości leży relikwia Świtu: ${["Popękany kielich", "Spalona księga", "Złoty gwóźdź"][w.plot.relics - 1] || "relikwia"} (${w.plot.relics}/3).`);
  if (w.plot.relics >= 3) {
    plotAdvance(w, 2, "Popiół Morvatha: trzy relikwie szepczą w jukach. Musisz zdecydować, komu je oddać.");
    lines.push("Trzecia relikwia. Kiedy kładziesz ją obok dwóch pozostałych, słyszysz szept. Coś chce, żebyś wybrał.");
    pending(w).push({ kind: "plotChoice" as any, f: 0, day: w.day });
  } else { const q = plotQuest(w); if (q) q.text = `Popiół Morvatha: oczyść ruiny i odnajdź relikwie Świtu (${w.plot.relics}/3).`; }
}
// Wybór po trzech relikwiach: krucjata z jedną z koron albo pakt z mrokiem.
const CRUSADE: Record<number, { who: string; scene: string; text: string; reward: string }> = {
  1: { who: "Królowa Ilvena i arcybiskup Aurelionu", scene: "town", text: "W katedrze Aurelionu arcybiskup namaszcza relikwie olejem i światłem. Królowa ogłasza świętą wojnę: dzwony biją w każdej wsi Korony.", reward: "Wiara wraca do pełna, dostajesz 20 zbrojnych kapłanów Zakonu i błogosławieństwo (+15% obrażeń przeciw nieumarłym)." },
  2: { who: "Uzurpator Kassian Varus", scene: "castle", text: "Varus ogląda relikwie jak mapę bitwy. „Wiara to dobra flaga. Legion ruszy, ale pod moim dowództwem.” Na naradzie legatów rozkłada mapę Morvath.", reward: "30 weteranów Legionu dołącza do ciebie, a Legion wyrusza na Morvath." },
  3: { who: "Król Durgan Kamienna Brew", scene: "smith", text: "W runicznej kuźni krasnoludzcy mistrzowie przetapiają gwóźdź i kielich w ostrze. Księga zostaje w archiwum klanu. „Kamień pamięta. My też.”", reward: "Dostajesz runiczny miecz wykuty z relikwii, a Khazgrim wyrusza na Morvath." },
  4: { who: "Wódz Ghrakk Krwawy Kieł", scene: "camp", text: "Szamani Hordy palą księgę w ognisku i mieszają popiół z krwią. Ghrakk śmieje się: „Martwi nie krzyczą. To nudne. Zabijemy ich drugi raz.”", reward: "30 orkowych wojowników dołącza do ciebie, a Horda wyrusza na Morvath." },
};
function plotChoose(w: World, path: "crusade" | "dark", f = 0) {
  const A = w.plot as any; A.path = path; A.f = f;
  if (path === "crusade") {
    const cap = w.settlements.find((s) => s.faction === f && s.kind === "town" && s.capital) || w.settlements.find((s) => s.faction === f && s.kind === "town");
    plotAdvance(w, 3, `Popiół Morvatha: zanieś relikwie do ${cap ? cap.name : "stolicy"} (${factionShort(f)}). ${CRUSADE[f].who} czeka.`, cap ? cap.id : -1);
  } else {
    const p = playerParty(w);
    const cem = w.places.filter((x) => x.kind === "cemetery").sort((a, b) => dist(a.cx * WCELL, a.cy * WCELL, p.x, p.y) - dist(b.cx * WCELL, b.cy * WCELL, p.x, p.y))[0];
    A.ritual = cem ? cem.id : undefined; if (cem) cem.seen = true;
    plotAdvance(w, 3, `Popiół Morvatha: szept prowadzi cię na ${cem ? cem.name : "cmentarz"}. Tam, o północy, możesz związać moc relikwii ze sobą.`, cem ? cem.id : -1);
  }
}
// Scena w stolicy (krucjata) albo na cmentarzu (pakt); zwraca tekst sceny albo null.
function plotScene(w: World, at: { settlement?: number; place?: number }): { title: string; text: string; scene: string; culture: string } | null {
  const A = w.plot as any; if (!A || A.stage !== 3) return null;
  const P = w.player, p = playerParty(w);
  if (A.path === "crusade" && at.settlement !== undefined) {
    const s = w.settlements[at.settlement]; if (!s || s.faction !== A.f || s.kind !== "town") return null;
    const C = CRUSADE[A.f];
    if (A.f === 1) { P.faith = 100; P.perks.undeadB = (P.perks.undeadB || 0) + 0.15; addTroops(p.troops, Object.keys(UNITS).find((k) => /priest|zakon|templar/i.test(k) && UNITS[k].culture === "aurelia") || "a_footman", 20); }
    if (A.f === 2) addTroops(p.troops, Object.keys(UNITS).filter((k) => UNITS[k].culture === "varus" && UNITS[k].tier === 3)[0] || "v_legionary", 30);
    if (A.f === 3) { const it = qid("w_sword", 3); ensureItem(it); P.items.push(it); P.perks.undeadB = (P.perks.undeadB || 0) + 0.1; }
    if (A.f === 4) addTroops(p.troops, Object.keys(UNITS).filter((k) => UNITS[k].culture === "orc" && UNITS[k].tier === 3)[0] || "o_warrior", 30);
    P.perks.undeadB = (P.perks.undeadB || 0) + 0.25;
    if (w.factions[A.f] && !w.factions[A.f].war[5]) setWar(w, A.f, 5, true, true);
    const F = fst(w, A.f); const mor = w.settlements.filter((x) => x.faction === 5 && x.kind !== "village");
    const L = w.lords.filter((l) => l.faction === A.f && l.alive && l.captive < 0 && partyById(w, l.party)).sort((a, b) => b.renown - a.renown)[0];
    if (F && L && mor.length) { F.camp = { marshal: L.id, target: mor[0].id, gather: s.id, stage: "gather", start: w.day, until: w.day + 40 }; chron(w, `${factionName(A.f)} ogłasza krucjatę przeciw Morvath. Marszałkiem zostaje ${L.title} ${L.name}.`, PAL.gold, "war"); }
    plotAdvance(w, 4, "Popiół Morvatha: krucjata ruszyła. Rozbij armię Upiornego Króla albo zdobądź jego stolicę.");
    return { title: "Krucjata", text: `${C.text}<br><br><b>${C.reward}</b> Relikwie są teraz błogosławione: bijesz nieumarłych mocniej.`, scene: C.scene, culture: FACTIONS[A.f].culture };
  }
  if (A.path === "dark" && at.place !== undefined && at.place === A.ritual) {
    P.corruption = Math.min(100, P.corruption + 40); P.mana = 100;
    P.perks.soulMana = (P.perks.soulMana || 0) + 0.3; P.perks.undeadOk = 1; P.perks.undeadB = (P.perks.undeadB || 0) + 0.15;
    A.truce = w.day + 60;
    plotAdvance(w, 4, "Popiół Morvatha: moc relikwii płynie w tobie. Zabierz Upiornemu Królowi koronę: rozbij go albo zdobądź jego stolicę.");
    return { title: "Pakt z mrokiem", text: "O północy kładziesz relikwie na płycie grobu. Kielich napełnia się czarną wodą, księga sama się otwiera, gwóźdź wbija się w twoją dłoń bez bólu. Ziemia wokół szarzeje. Słyszysz Upiornego Króla: „Złodziej.” Uśmiechasz się.<br><br><b>Spaczenie +40. Mana odnawia się z dusz poległych, możesz prowadzić nieumarłych, a przez 60 dni martwi omijają cię z daleka.</b>", scene: "cemetery", culture: "undead" };
  }
  return null;
}
function plotCheckKing(w: World, lines: string[]) {
  if (!w.plot || (w.plot.stage !== 2 && w.plot.stage !== 4) || w.plot.done) return;
  const K = w.lords.find((l) => l.faction === 5 && l.ruler);
  const capFallen = !w.settlements.some((s) => s.faction === 5 && s.kind === "town");
  if ((K && (!K.alive || K.captive >= 0 || K.party < 0)) || capFallen) {
    w.plot.done = true; w.plot.stage = 3;
    const q = plotQuest(w); if (q) { q.done = true; q.text = "Popiół Morvatha: Upiorny Król złamany."; }
    if (K) { K.alive = false; K.captive = -1; }
    const P = w.player; P.renown += 300; P.gold += 3000; P.skillPts += 3; P.honor += 10;
    (w.diff ||= { dmg: 1, enemy: 1, gold: 1, aggro: 1, plague: 1, xp: 1 }).plague *= 0.3;
    for (const p of w.parties.slice()) if (p.kind === "undead") removeParty(w, p);
    if ((w.plot as any).path === "dark") {
      P.honor -= 20; P.corruption = 100; P.perks.undeadOk = 1; P.perks.terror = (P.perks.terror || 0) + 0.3;
      lines.push("Zdzierasz koronę z rozsypującej się czaszki i wkładasz ją na własną głowę. Martwi klękają. Zaraza nie znika: teraz słucha ciebie. +300 sławy, +3000 denarów, +3 punkty drzewek, wróg drży na twój widok.");
      chron(w, `${P.name} odbiera koronę Upiornemu Królowi i sam staje się panem popiołu. Żywi szepczą jego imię ze strachem.`, PAL.purpleL, "player");
    } else {
      lines.push("Korona Upiornego Króla pęka z sykiem. Martwi padają tam, gdzie stali. Zaraza słabnie. +300 sławy, +3000 denarów, +3 punkty drzewek.");
      chron(w, `${P.name} łamie koronę Upiornego Króla. Popiół Morvatha opada. Pieśni o tym przetrwają wieki.`, PAL.gold, "player");
    }
  }
}


// ---------- Koalicje przeciw najsilniejszym ----------
function coalitionDaily(w: World) {
  const alive = MAJOR.filter((f) => w.factions[f].alive);
  if (alive.length < 3) return;
  const cnt = (f: number) => w.settlements.filter((s) => s.faction === f).length;
  const total = alive.reduce((a, f) => a + cnt(f), 0) || 1;
  const strong = alive.sort((a, b) => cnt(b) - cnt(a))[0];
  if (cnt(strong) / total < 0.32) return;
  const others = alive.filter((f) => f !== strong);
  for (const a of others) {
    const fa = fst(w, a);
    fa.relation[strong] = (fa.relation[strong] || 0) - 0.12; fst(w, strong).relation[a] = fa.relation[strong];
    for (const b of others) if (a < b && !fa.war[b] && !isAlly(w, a, b) && chance(0.015)) { setAlly(w, a, b, true, true); chron(w, `${factionName(a)} i ${factionName(b)} zawierają sojusz przeciw rosnącej potędze ${factionShort(strong)}.`, PAL.gold, "peace"); }
    if (!fa.war[strong] && (fa.truce[strong] || 0) <= 0 && chance(0.006)) { setWar(w, a, strong, true, true); chron(w, `${factionName(a)} wypowiada wojnę ${factionShort(strong)}: nikt nie może urosnąć zbyt wysoko.`, PAL.redL, "war"); }
  }
}
// ---------- Zmęczenie wojną: dużo zdobyczy = bunty w podbitych osadach, chęć pokoju ----------
const START_OWN: Record<number, number> = {};
function weariness(w: World, f: number) {
  if (!MAJOR.includes(f)) return 0;
  const base = START_OWN[f] ||= 17;
  const own = w.settlements.filter((s) => s.faction === f).length;
  const conq = w.settlements.filter((s) => s.faction === f && FACTION_OF_CULTURE[s.culture] !== f).length;
  return clamp((own - base) / base * 0.6 + conq / Math.max(1, own) * 0.8, 0, 1.5);
}
function wearinessDaily(w: World) {
  for (const f of MAJOR) {
    if (!w.factions[f].alive) continue;
    const W2 = weariness(w, f);
    if (W2 < 0.25) continue;
    // chętniej zawierają pokój
    for (const x of MAJOR) if (fst(w, f).war[x] && chance(0.004 * W2)) setWar(w, f, x, false);
    // powstanie w podbitej twierdzy: wraca do dawnych panów (jeśli żyją)
    const conq = w.settlements.filter((s) => s.faction === f && s.kind !== "village" && !s.siegeBy.length && FACTION_OF_CULTURE[s.culture] && FACTION_OF_CULTURE[s.culture] !== f && w.factions[FACTION_OF_CULTURE[s.culture]]?.alive);
    if (conq.length && chance(0.02 * W2)) {
      const s = pick(conq), back = FACTION_OF_CULTURE[s.culture];
      applyLosses(s.garrison, 0.6);
      const owner = w.lords.find((l) => l.faction === back && l.alive && !l.ruler);
      captureSettlement(w, s, back, owner ? owner.id : -1);
      fillGarrison(w, s, 12);
      chron(w, `Powstanie w ${s.name}! Mieszkańcy wyrzynają załogę ${factionShort(f)} i wracają pod sztandar ${factionShort(back)}.`, PAL.redL, "war");
    }
  }
}
// ---------- Bunty: frakcja buntowników z pretendentem, wojna domowa ----------
interface Rebels { id: number; from: number; lord: number; start: number; held?: number; }
function rebelsList(w: World): Rebels[] { return ((w as any).rebels ||= []); }
function rebelOf(w: World, from: number) { return rebelsList(w).find((r) => r.from === from && w.factions[r.id]?.alive); }
function isRebel(f: number) { return f >= 11 && f <= 15; }
function rebelFactionDef(w: World, r: Rebels) {
  const L = lordById(w, r.lord), O = FACTIONS[r.from];
  FACTIONS[r.id] = { id: r.id, name: `Bunt ${L ? L.name : ""} (${O.short})`, short: `Buntownicy ${O.short}`, culture: O.culture, race: O.race, col: PAL.rust, shade: PAL.dirtD, trim: O.col, pattern: "quarter", ruler: `Pretendent ${L ? L.name : ""}`, gov: "Wojna domowa" };
}
function restoreRebels(w: World) { for (const r of rebelsList(w)) rebelFactionDef(w, r); }
function startRebellion(w: World, L: Lord) {
  const from = L.faction, id = 10 + from;
  const r: Rebels = { id, from, lord: L.id, start: w.day };
  const list = rebelsList(w); const old = list.findIndex((x) => x.id === id); if (old >= 0) list.splice(old, 1);
  list.push(r);
  rebelFactionDef(w, r);
  w.factions[id] = { id, war: {}, warDays: {}, truce: {}, relation: {}, gold: 2000, alive: true, name: FACTIONS[id].name } as any;
  setWar(w, id, from, true, true);
  if (from !== 5) setWar(w, id, 5, true, true);
  // do buntu przyłączają się niezadowoleni lordowie tej samej korony
  const joiners = [L, ...w.lords.filter((o) => o !== L && o.alive && o.faction === from && !o.ruler && lordLoyal(o) < 30).slice(0, 2)];
  for (const o of joiners) {
    o.faction = id; (o as any).loyal = 70; (o as any).rumor = 0;
    const p = partyById(w, o.party); if (p) { p.faction = id; p.siege = undefined; p.state = "idle"; p.wait = 0; }
    for (const s of w.settlements) if (s.owner === o.id) { s.faction = id; s.siegeBy = []; s.siegeDays = 0; for (const v of w.settlements) if (v.bound === s.id) v.faction = id; }
  }
  w.ownerVersion++;
  chron(w, `Wojna domowa! ${L.title} ${L.name} ogłasza się pretendentem do tronu ${factionName(from)}.${joiners.length > 1 ? ` Dołączają: ${joiners.slice(1).map((o) => o.name).join(", ")}.` : ""}`, PAL.redL, "war");
  pending(w).push({ kind: "rebellion" as any, f: id, lord: L.id, day: w.day });
}
function rebelsDaily(w: World) {
  for (const r of rebelsList(w)) {
    const F = w.factions[r.id]; if (!F || !F.alive) continue;
    const own = w.settlements.filter((s) => s.faction === r.id && s.kind !== "village").length;
    if (!own) {
      F.alive = false;
      for (const o of w.lords) if (o.faction === r.id) { o.faction = r.from; (o as any).loyal = 40; const p = partyById(w, o.party); if (p) p.faction = r.from; }
      chron(w, `Bunt w ${factionName(r.from)} upada. Pretendent ${lordById(w, r.lord)?.name || ""} korzy się przed władcą.`, PAL.moss, "war");
      if (w.player.liege === r.id) { w.player.liege = r.from; w.player.status = "wasal"; addLogMsg("Bunt upadł. Wracasz pod dawną koronę, ale nikt tego nie zapomni.", PAL.redL); }
      continue;
    }
    // zwycięstwo buntowników: dłużej trzymają ponad połowę dawnych twierdz
    const fromOwn = w.settlements.filter((s) => s.faction === r.from && s.kind !== "village").length;
    if (own > fromOwn) { r.held = (r.held || 0) + 1; if (r.held >= 30) { setWar(w, r.id, r.from, false); FACTIONS[r.id].gov = "Monarchia"; FACTIONS[r.id].short = FACTIONS[r.id].name; chron(w, `Wojna domowa kończy się: ${factionName(r.id)} zostaje osobnym królestwem.`, PAL.gold, "peace"); r.held = -999; } }
    else if ((r.held || 0) > 0) r.held = 0;
  }
}

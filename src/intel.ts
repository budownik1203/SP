// Dyplomacja i wywiad (Build 0.25): szpiedzy w obcych twierdzach (raporty, sabotaż, zatrute studnie, podburzanie),
// intrygi wśród cudzych lordów, embargo, traktaty z warunkami (trybut, zakładnik, oddanie osady)
// oraz kompanie najemne na kontrakt z egzotycznym wojskiem.

interface Spy { id: number; s: number; arrive: number; cover: number; last: number; name: string; }
interface Treaty { f: number; tribute: number; hostage: number; until: number; }
interface TreatyEnvoy { f: number; tribute: number; hostage: boolean; cede: number; arrive: number; }
interface Contract { name: string; troops: Troop[]; until: number; renew: number; }
function spies(w: World): Spy[] { return ((w as any).spies ||= []); }
function treaties(w: World): Treaty[] { return ((w as any).treaties ||= []); }
function treatyEnvoys(w: World): TreatyEnvoy[] { return ((w as any).tenvoys ||= []); }
function embargo(w: World): Record<number, boolean> { return ((w as any).embargo ||= {}); }
function contracts(P: PlayerState): Contract[] { return ((P as any).contracts ||= []); }
function hostageHeld(w: World, f: number) { return treaties(w).some((t) => t.f === f && t.hostage >= 0 && t.until > w.day); }

const SPY_NAMES = ["Wróbel", "Kuna", "Szara Mysz", "Lis", "Cień", "Pliszka", "Jaskółka", "Ślepy Jan", "Wdowa Hela", "Mnich Bez Imienia"];

// ---------- Szpiedzy ----------
function sendSpy(w: World, s: Settlement) {
  const P = w.player; if (P.gold < 300 || spies(w).length >= 3) return;
  P.gold -= 300;
  const d = Math.ceil(Math.hypot(s.cx - playerParty(w).x / WCELL, s.cy - playerParty(w).y / WCELL) / 40) + 1;
  spies(w).push({ id: w.nextId++, s: s.id, arrive: w.day + d, cover: 100, last: w.day, name: pick(SPY_NAMES.filter((n) => !spies(w).some((x) => x.name === n))) || "Bezimienny" });
  toast(`Szpieg wyrusza do ${s.name} (${d} dni drogi).`, PAL.gold); sfx.coin();
}
function spyReport(w: World, sp: Spy): string {
  const s = w.settlements[sp.s], F = fst(w, s.faction);
  const camp = F?.camp ? `Marszałek zbiera wyprawę na ${w.settlements[F.camp.target]?.name}.` : "O wyprawach cisza.";
  const lords = w.parties.filter((o) => o.kind === "lord" && o.faction === s.faction && Math.hypot(o.x / WCELL - s.cx, o.y / WCELL - s.cy) < 40);
  return `${s.name}: załoga ${troopCount(s.garrison)} (${s.garrison.slice(0, 3).map((t) => `${t.n}× ${UNITS[t.type].name}`).join(", ")}), zapasy na ${siegeStores(s)} dni, ${wallWord(s)}. ${camp} W okolicy: ${lords.length ? lords.map((o) => `${o.name} (${troopCount(o.troops)})`).join(", ") : "nikt"}.`;
}
function spyCaught(w: World, sp: Spy, why: string) {
  const s = w.settlements[sp.s];
  spies(w).splice(spies(w).indexOf(sp), 1);
  const F = fst(w, s.faction); if (F) F.relation[PLAYER_FACTION] = (F.relation[PLAYER_FACTION] || 0) - 10;
  addLogMsg(`${sp.name} wpada w ${s.name}${why}. Wisi na bramie. (relacja z ${factionShort(s.faction)} −10)`, PAL.redL);
  chron(w, `W ${s.name} powieszono szpiega ${w.player.name}.`, PAL.redL, "player");
}
function spyAct(w: World, sp: Spy, act: "sabotage" | "poison" | "unrest") {
  const s = w.settlements[sp.s], P = w.player;
  const risk = act === "poison" ? 35 : act === "sabotage" ? 25 : 20;
  sp.cover -= risk;
  if (sp.cover < 0 && chance(0.6)) { spyCaught(w, sp, " na gorącym uczynku"); return; }
  if (act === "sabotage") { (s as any).sabot = w.day + 20; if (s.siegeDays > 0) s.siegeDays += 3; toast(`${sp.name} podpala spichlerz w ${s.name}. Zapasy topnieją.`, PAL.gold); }
  if (act === "poison") { for (const t of s.garrison) t.wounded = Math.min(t.n, t.wounded + Math.ceil(t.n * 0.2)); P.honor -= 1; toast(`Studnia w ${s.name} zatruta. Załoga choruje (honor −1).`, PAL.redL); }
  if (act === "unrest") { s.prosperity = Math.max(5, s.prosperity - 10); const L = s.owner >= 0 ? lordById(w, s.owner) : null; if (L) addLoyal(L, -6); toast(`${sp.name} podburza mieszczan przeciw panu ${s.name}.`, PAL.gold); }
}

// ---------- Intrygi ----------
function intrigue(w: World, L: Lord) {
  const P = w.player; if (P.gold < 400) return;
  P.gold -= 400;
  if (chance(0.25 - P.attr.cha * 0.01)) { lordRel(w, L, -10, "przyłapał cię na intrydze"); const F = fst(w, L.faction); if (F) F.relation[PLAYER_FACTION] = (F.relation[PLAYER_FACTION] || 0) - 5; toast(`${L.title} ${L.name} przechwytuje twoje listy. Intryga wyszła na jaw!`, PAL.redL); return; }
  addLoyal(L, -15);
  const lo = lordLoyal(L);
  toast(`Plotki i fałszywe listy robią swoje. Wierność ${L.name} wobec korony: ${lo}.`, PAL.gold);
  if (lo < 20 && P.status === "król" && L.relation >= 0 && chance(0.4)) { defectLord(w, L, PLAYER_FACTION, false); toast(`${L.title} ${L.name} porzuca swego władcę i przysięga tobie!`, PAL.gold); }
}

// ---------- Traktaty z warunkami ----------
function sendTreaty(w: World, f: number, tribute: number, hostage: boolean, cede: number) {
  treatyEnvoys(w).push({ f, tribute, hostage, cede, arrive: w.day + 2 + Math.floor(rr(0, 3)) });
  chron(w, `${w.player.name} wysyła posła z traktatem do ${factionName(f)}.`, PAL.bone, "player");
}
function treatyChance(w: World, e: { f: number; tribute: number; hostage: boolean; cede: number }) {
  const me = fst(w, PLAYER_FACTION), them = fst(w, e.f);
  const rel0 = them.relation[PLAYER_FACTION] || 0, ratio = factionPower(w, PLAYER_FACTION) / Math.max(1, factionPower(w, e.f));
  let c = 0.3 + rel0 / 100 + (ratio - 1) * 0.35 + Math.min(0.2, (me.warDays[e.f] || 0) / 150);
  c -= e.tribute / 400; if (e.hostage) c -= 0.12; if (e.cede >= 0) c -= w.settlements[e.cede].kind === "village" ? 0.15 : 0.35;
  return clamp(c, 0.02, 0.9);
}
function treatyDaily(w: World) {
  const P = w.player;
  for (const e of treatyEnvoys(w).slice()) {
    if (w.day < e.arrive) continue;
    treatyEnvoys(w).splice(treatyEnvoys(w).indexOf(e), 1);
    if (!fst(w, PLAYER_FACTION) || !fst(w, e.f)?.alive) continue;
    const ok = chance(treatyChance(w, e));
    let text = `${factionName(e.f)} odrzuca twoje warunki.`;
    if (ok) {
      setWar(w, PLAYER_FACTION, e.f, false, true);
      fst(w, PLAYER_FACTION).truce[e.f] = 90; fst(w, e.f).truce[PLAYER_FACTION] = 90;
      let hostage = -1;
      if (e.hostage) { const H = w.lords.filter((L) => L.alive && L.faction === e.f && !L.ruler && L.captive < 0).sort((a, b) => b.renown - a.renown)[0]; if (H) { hostage = H.id; H.captive = PLAYER_FACTION; const hp = partyById(w, H.party); if (hp) { hp.troops = []; } } }
      treaties(w).push({ f: e.f, tribute: e.tribute, hostage, until: w.day + 120 });
      if (e.cede >= 0) { const s = w.settlements[e.cede]; if (s.faction === e.f) captureSettlement(w, s, PLAYER_FACTION, -2); }
      text = `${factionName(e.f)} podpisuje traktat: pokój${e.tribute ? `, trybut ${e.tribute} den. co tydzień` : ""}${hostage >= 0 ? `, zakładnik: ${lordById(w, hostage).name}` : ""}${e.cede >= 0 ? `, oddaje ${w.settlements[e.cede].name}` : ""}.`;
      P.renown += 15;
    } else { const T = fst(w, e.f); T.relation[PLAYER_FACTION] = (T.relation[PLAYER_FACTION] || 0) - 3; }
    chron(w, text, ok ? PAL.moss : PAL.ash, "peace"); addLogMsg(text, ok ? PAL.gold : PAL.ash);
  }
  for (const t of treaties(w).slice()) {
    const F = fst(w, t.f);
    if (!F?.alive || t.until <= w.day || F.war[PLAYER_FACTION]) {
      treaties(w).splice(treaties(w).indexOf(t), 1);
      if (t.hostage >= 0) { const H = lordById(w, t.hostage); if (H && H.captive === PLAYER_FACTION) { H.captive = -1; lordRel(w, H, 10, "dobrze traktowany zakładnik"); addLogMsg(`Zakładnik ${H.name} wraca do domu. Traktat z ${factionShort(t.f)} wygasł.`, PAL.bone); } }
      continue;
    }
    if (t.tribute && (w.day - (t.until - 120)) % 7 === 0) { const g = Math.min(t.tribute, Math.max(0, F.gold)); F.gold -= g; P.gold += g; if (g) addLogMsg(`Trybut od ${factionShort(t.f)}: ${g} den.`, PAL.gold); }
  }
  // embargo: obca korona traci na handlu, twoje miasta trochę też
  for (const k of Object.keys(embargo(w))) { const f = Number(k); if (!embargo(w)[f]) continue; const F = fst(w, f); if (!F?.alive) { embargo(w)[f] = false; continue; } F.gold -= 45; F.relation[PLAYER_FACTION] = (F.relation[PLAYER_FACTION] || 0) - 0.15; for (const s of myLands(w)) if (s.kind === "town") s.prosperity = Math.max(5, s.prosperity - 0.04); }
}

// ---------- Szpiedzy, kontrakty: przebieg dnia ----------
function intelDaily(w: World) {
  const P = w.player;
  for (const sp of spies(w).slice()) {
    if (w.day < sp.arrive) continue;
    const s = w.settlements[sp.s];
    if (s.owner === -2 || s.faction === PLAYER_FACTION) { spies(w).splice(spies(w).indexOf(sp), 1); addLogMsg(`${sp.name} wraca: ${s.name} jest już twoje.`, PAL.bone); continue; }
    if (w.day === sp.arrive) addLogMsg(`${sp.name} dotarł do ${s.name} i wtapia się w tłum.`, PAL.bone);
    sp.cover -= rr(0.5, 2.5) + troopCount(s.garrison) / 120;
    if (sp.cover <= 0 && chance(0.25)) { spyCaught(w, sp, ""); continue; }
    if (w.day - sp.last >= 5) { sp.last = w.day; addLogMsg(`Raport (${sp.name}): ${spyReport(w, sp)}`, PAL.bone); for (let y = s.cy - 10; y <= s.cy + 10; y++) for (let x = s.cx - 10; x <= s.cx + 10; x++) if (x >= 0 && y >= 0 && x < WGW && y < WGH) w.explored[cidx(x, y)] = 1; }
  }
  // kontrakty kompanii najemnych
  const p = playerParty(w);
  for (const c of contracts(P).slice()) {
    if (c.until - w.day === 3) addLogMsg(`Kontrakt kompanii „${c.name}” kończy się za 3 dni. Przedłuż go w oknie Królestwa (U).`, PAL.gold);
    if (w.day < c.until) continue;
    contracts(P).splice(contracts(P).indexOf(c), 1);
    let gone = 0; for (const t of c.troops) { const have = p.troops.find((x) => x.type === t.type); const n = Math.min(t.n, have ? have.n : 0); if (n > 0) { removeTroops(p.troops, t.type, n); gone += n; } }
    addLogMsg(`Kontrakt wygasł. „${c.name}” zwija sztandar i odchodzi (${gone} ludzi).`, PAL.redL);
  }
}

// ---------- Kompanie najemne ----------
const MERC_COMPANIES: { name: string; desc: string; troops: [string, number][] }[] = [
  { name: "Szare Płaszcze", desc: "Weterani z Doliny. Miecz i kusza.", troops: [["m_sword", 8], ["m_xbow", 6]] },
  { name: "Synowie Topora", desc: "Krasnoludzcy topornicy na wygnaniu.", troops: [["d_axe", 8], ["d_longbeard", 3]] },
  { name: "Bractwo Głębi", desc: "Kusznicy runiczni spod gór.", troops: [["d_xbow", 7], ["d_rune", 3]] },
  { name: "Katafrakci Wschodu", desc: "Ciężka jazda, co służyła Legionowi.", troops: [["v_cata", 6], ["v_rider", 4]] },
  { name: "Czarne Kły", desc: "Orkowie od brudnej roboty.", troops: [["o_blackfang", 5], ["o_raider", 6]] },
  { name: "Łowcy Czaszek", desc: "Orkowi miotacze i łowcy.", troops: [["o_thrower", 6], ["o_hunter", 4]] },
  { name: "Kompania Szarej Róży", desc: "Łucznicy Korony bez pana.", troops: [["a_longbow", 8], ["a_maa", 5]] },
  { name: "Żelazna Kompania", desc: "Halabardnicy i pretorianie, drogo, ale warto.", troops: [["a_halberd", 6], ["v_praetor", 3]] },
];
function mercCompany(s: Settlement, wk: number) {
  const ch = hashInt(s.seed * 3 + wk);
  if (ch % 3 === 0) return null;
  const c = MERC_COMPANIES[(ch >>> 2) % MERC_COMPANIES.length];
  const troops: Troop[] = c.troops.filter(([k]) => UNITS[k]).map(([k, n]) => ({ type: k, n: n + ((ch >>> 5) % 3), wounded: 0, xp: 300 }));
  const full = troops.reduce((a, t) => a + UNITS[t.type].cost * t.n, 0);
  return { name: c.name, desc: c.desc, troops, price: Math.round(full * 0.55), renew: Math.round(full * 0.4) };
}
function hireCompany(w: World, s: Settlement, wk: number) {
  const P = w.player, p = playerParty(w), c = mercCompany(s, wk);
  if (!c || P.gold < c.price) return;
  P.gold -= c.price;
  for (const t of c.troops) addTroops(p.troops, t.type, t.n);
  for (const t of c.troops) { const x = p.troops.find((y) => y.type === t.type); if (x) x.xp = Math.max(x.xp, 300); }
  contracts(P).push({ name: c.name, troops: c.troops.map((t) => ({ ...t })), until: w.day + 30, renew: c.renew });
  (P as any)["comp" + s.id + "_" + wk] = 1;
  toast(`„${c.name}” staje pod twoim sztandarem na 30 dni.`, PAL.gold); chron(w, `${P.name} najmuje kompanię „${c.name}”.`); sfx.coin();
}

// ---------- Zakładka „Wywiad” w oknie Królestwa ----------
const IG = { target: -1, lord: -1, tf: -1, trib: 0, host: false, cede: -1 };
function intelHtml(w: World): string {
  const P = w.player, king = P.status === "król" && !!fst(w, PLAYER_FACTION);
  const known = w.settlements.filter((s) => s.kind !== "village" && s.faction !== PLAYER_FACTION && s.owner !== -2 && w.explored[cidx(s.cx, s.cy)] && !spies(w).some((x) => x.s === s.id)).sort((a, b) => a.name.localeCompare(b.name));
  if (!known.some((s) => s.id === IG.target)) IG.target = known[0]?.id ?? -1;
  const foreign = w.lords.filter((L) => L.alive && !L.ruler && L.faction !== PLAYER_FACTION && L.faction !== 5 && L.captive < 0).sort((a, b) => a.faction - b.faction || a.name.localeCompare(b.name));
  if (!foreign.some((L) => L.id === IG.lord)) IG.lord = foreign[0]?.id ?? -1;
  let h = `<h2>${ic("eye")} Szpiedzy (${spies(w).length}/3)</h2>`;
  h += spies(w).map((sp) => { const s = w.settlements[sp.s]; const there = w.day >= sp.arrive; return `<div class="row"><span><b>${sp.name}</b> w ${s.name} <span class="muted">(${factionShort(s.faction)})</span> · ${there ? `przykrywka ${Math.max(0, Math.round(sp.cover))}%` : `w drodze, ${sp.arrive - w.day} dni`}</span><span>${there ? `<button class="mini" data-a="spyR" data-v="${sp.id}">Raport</button><button class="mini" data-a="spyA" data-v="${sp.id}:sabotage">Spal spichlerz</button><button class="mini" data-a="spyA" data-v="${sp.id}:unrest">Podburzaj</button><button class="mini danger" data-a="spyA" data-v="${sp.id}:poison">Zatruj studnię</button>` : ""}<button class="mini" data-a="spyX" data-v="${sp.id}">Odwołaj</button></span></div>`; }).join("");
  h += `<div class="row"><span>Nowy szpieg do: <select id="ispy">${known.map((s) => `<option value="${s.id}" ${s.id === IG.target ? "selected" : ""}>${esc(s.name)} (${factionShort(s.faction)})</option>`).join("")}</select></span><button class="mini" data-a="spyGo" ${P.gold >= 300 && spies(w).length < 3 && IG.target >= 0 ? "" : "disabled"}>Wyślij (300)</button></div>
    <p class="tip">Szpieg co 5 dni przysyła raport: załoga, zapasy, mury, plany wypraw i lordowie w okolicy. Każda akcja zużywa przykrywkę; gdy spadnie do zera, szpiega mogą złapać.</p>`;
  h += `<h2>${ic("scroll")} Intrygi</h2><div class="row"><span>Siej niezgodę wokół: <select id="ilord">${foreign.map((L) => `<option value="${L.id}" ${L.id === IG.lord ? "selected" : ""}>${esc(L.title)} ${esc(L.name)} (${factionShort(L.faction)}, wierność ${lordLoyal(L)})</option>`).join("")}</select></span><button class="mini" data-a="intr" ${P.gold >= 400 && IG.lord >= 0 ? "" : "disabled"}>Fałszywe listy (400)</button></div>
    <p class="tip">Obniża wierność lorda wobec jego władcy o 15. Nielojalni lordowie buntują się albo zmieniają strony${king ? ", a przy niskiej wierności mogą przejść do ciebie" : ""}. Ryzyko wpadki ok. 20%.</p>`;
  if (king) h += treatyHtml(w);
  const cs = contracts(P);
  h += `<h2>${ic("banner")} Kompanie na kontrakcie</h2>${cs.length ? cs.map((c, i) => `<div class="row"><span><b>${esc(c.name)}</b>: ${c.troops.map((t) => `${t.n}× ${UNITS[t.type].name}`).join(", ")} · do dnia ${c.until} (${c.until - w.day} dni)</span><button class="mini" data-a="renew" data-v="${i}" ${P.gold >= c.renew ? "" : "disabled"}>Przedłuż o 30 dni (${c.renew})</button></div>`).join("") : "<p class='muted'>Kompanie najemne wynajmiesz w karczmach miast.</p>"}`;
  return h;
}
function treatyHtml(w: World): string {
  const P = w.player;
  const foes = MAJOR.filter((f) => fst(w, f)?.alive && atWar(w, PLAYER_FACTION, f) && !treatyEnvoys(w).some((e) => e.f === f));
  if (!foes.includes(IG.tf)) IG.tf = foes[0] ?? -1;
  let h = `<h2>${ic("crown")} Traktat pokojowy z warunkami</h2>`;
  if (IG.tf < 0) h += `<p class="muted">Z nikim nie toczysz wojny${treatyEnvoys(w).length ? " (poseł z traktatem w drodze)" : ""}.</p>`;
  else {
    const cedeOpts = w.settlements.filter((s) => s.faction === IG.tf && Math.min(...myLands(w).map((m) => Math.hypot(m.cx - s.cx, m.cy - s.cy)), 999) < 35).slice(0, 6);
    if (!cedeOpts.some((s) => s.id === IG.cede)) IG.cede = -1;
    const c = treatyChance(w, { f: IG.tf, tribute: IG.trib, hostage: IG.host, cede: IG.cede });
    h += `<div class="row"><span>Z: <select id="itf">${foes.map((f) => `<option value="${f}" ${f === IG.tf ? "selected" : ""}>${factionName(f)}</option>`).join("")}</select></span>
      <span>Trybut co tydzień: ${[0, 50, 100, 200].map((g) => `<button class="mini ${IG.trib === g ? "on" : ""}" data-a="itrib" data-v="${g}">${g || "bez"}</button>`).join("")}</span></div>
      <div class="row"><span><label><input type="checkbox" id="ihost" ${IG.host ? "checked" : ""}> Zakładnik (ich lord u ciebie: przez 120 dni nie wypowiedzą wojny)</label></span>
      <span>Oddanie osady: <select id="icede"><option value="-1">żadnej</option>${cedeOpts.map((s) => `<option value="${s.id}" ${s.id === IG.cede ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></span></div>
      <div class="row"><span>Szansa przyjęcia: <b class="${c < 0.25 ? "bad" : c > 0.55 ? "gold" : ""}">${Math.round(c * 100)}%</b></span><button class="mini" data-a="treaty">Wyślij posła z traktatem</button></div>`;
  }
  const T = treaties(w);
  if (T.length) h += T.map((t) => `<p class="muted">Traktat z ${factionShort(t.f)} do dnia ${t.until}${t.tribute ? `, trybut ${t.tribute}/tydz.` : ""}${t.hostage >= 0 ? `, zakładnik ${lordById(w, t.hostage)?.name}` : ""}.</p>`).join("");
  const others = MAJOR.filter((f) => fst(w, f)?.alive);
  h += `<h2>${ic("coin")} Embargo</h2><div class="row">${others.map((f) => `<button class="mini ${embargo(w)[f] ? "on" : ""}" data-a="emb" data-v="${f}">${factionShort(f)}${embargo(w)[f] ? ": embargo" : ""}</button>`).join("")}</div><p class="tip">Zamknięte trakty: korona pod embargiem traci 45 den. dziennie i powoli cię nienawidzi; twoje miasta też trochę tracą na handlu.</p>`;
  return h;
}
function intelActs(w: World, re: () => void): Acts {
  const P = w.player;
  return {
    spyGo: () => { if (IG.target >= 0) sendSpy(w, w.settlements[IG.target]); re(); },
    spyR: (v) => { const sp = spies(w).find((x) => x.id === Number(v)); if (sp) toast(spyReport(w, sp), PAL.bone); },
    spyA: (v) => { const [id, a] = v.split(":"); const sp = spies(w).find((x) => x.id === Number(id)); if (sp) spyAct(w, sp, a as any); re(); },
    spyX: (v) => { const i = spies(w).findIndex((x) => x.id === Number(v)); if (i >= 0) spies(w).splice(i, 1); re(); },
    intr: () => { const L = lordById(w, IG.lord); if (L) intrigue(w, L); re(); },
    itrib: (v) => { IG.trib = Number(v); re(); },
    treaty: () => { if (IG.tf < 0) return; sendTreaty(w, IG.tf, IG.trib, IG.host, IG.cede); toast("Poseł z traktatem wyrusza.", PAL.gold); re(); },
    emb: (v) => { const f = Number(v); embargo(w)[f] = !embargo(w)[f]; chron(w, embargo(w)[f] ? `${P.kingdom} zamyka trakty dla kupców ${factionShort(f)}.` : `${P.kingdom} znosi embargo na ${factionShort(f)}.`, PAL.bone, "player"); re(); },
    renew: (v) => { const c = contracts(P)[Number(v)]; if (!c || P.gold < c.renew) return; P.gold -= c.renew; c.until += 30; sfx.coin(); toast(`„${c.name}” zostaje na kolejne 30 dni.`, PAL.gold); re(); },
  };
}
function intelBind(re: () => void) {
  const bind = (id: string, f: (v: string, el: HTMLInputElement & HTMLSelectElement) => void) => { const e = document.getElementById(id) as any; if (e) e.onchange = () => { f(e.value, e); re(); }; };
  bind("ispy", (v) => { IG.target = Number(v); });
  bind("ilord", (v) => { IG.lord = Number(v); });
  bind("itf", (v) => { IG.tf = Number(v); IG.cede = -1; });
  bind("icede", (v) => { IG.cede = Number(v); });
  bind("ihost", (_v, e) => { IG.host = e.checked; });
}

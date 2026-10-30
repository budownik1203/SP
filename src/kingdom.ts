// Królestwo (Build 0.24): budowy w terenie (drogi, mosty, wieże strażnicze), koronacja, tytuły szlacheckie,
// przenoszenie załóg między lennami, dwór królewski i przegląd ziem. Okno „Królestwo” pod klawiszem U.

interface Work { id: number; k: "road" | "bridge" | "tower"; cells: number[]; cx: number; cy: number; days: number; done: boolean; name: string; warnDay?: number; }
interface Transfer { from: number; to: number; troops: Troop[]; days: number; }
function works(w: World): Work[] { return ((w as any).works ||= []); }
function transfers(w: World): Transfer[] { return ((w as any).transfers ||= []); }

const WORK_DEF = {
  road: { name: "Droga", desc: "Bity trakt przyspiesza marsz (twoich ludzi, kupców i wrogów)." },
  bridge: { name: "Most", desc: "Przeprawa przez rzekę w miejscu, gdzie nie było brodu." },
  tower: { name: "Wieża strażnicza", desc: "Odsłania okolicę i ostrzega, gdy wroga armia wejdzie w jej zasięg." },
};

// Czy miejsce leży na twojej ziemi (twoje lenno albo ziemia twojej korony).
function ownLand(w: World, cx: number, cy: number) {
  const s = w.settlements[w.nearest[cidx(clamp(cx, 0, WGW - 1), clamp(cy, 0, WGH - 1))]];
  return !!s && (s.owner === -2 || (w.player.status === "król" && s.faction === PLAYER_FACTION));
}
function myLands(w: World) { return w.settlements.filter((s) => s.owner === -2 || (w.player.status === "król" && s.faction === PLAYER_FACTION)); }
function playerCell(w: World) { const p = playerParty(w); return { cx: Math.floor(p.x / WCELL), cy: Math.floor(p.y / WCELL) }; }

// ---------- Plan budowy ----------
function planRoad(w: World, to: Settlement): { cells: number[]; cost: number; days: number } | null {
  const { cx, cy } = playerCell(w);
  const path = findPath(w, cidx(cx, cy), cidx(to.cx, to.cy), 45000);
  if (!path.length) return null;
  const cells = path.filter((i) => !w.road[i] && w.terr[i] !== T_RIVER);
  if (cells.length < 3) return null;
  return { cells, cost: 40 + cells.length * 7, days: Math.max(2, Math.ceil(cells.length / 7)) };
}
function planBridge(w: World): { cells: number[]; cost: number; days: number } | null {
  const { cx, cy } = playerCell(w);
  let best: number[] | null = null;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const cells: number[] = []; let x = cx, y = cy, ok = false;
    for (let k = 0; k < 9; k++) {
      x += dx; y += dy; if (x < 0 || y < 0 || x >= WGW || y >= WGH) break;
      const i = cidx(x, y), t = w.terr[i];
      if (t === T_RIVER) { if (w.road[i] === 2 || w.road[i] === 3) break; cells.push(i); continue; }
      if (t === T_SEA || t === T_MOUNT) break;
      ok = cells.length > 0; break;
    }
    if (ok && cells.length <= 5 && (!best || cells.length < best.length)) best = cells;
  }
  if (!best) return null;
  return { cells: best, cost: 250 + best.length * 90, days: 3 + best.length };
}
function canTower(w: World): string | null {
  const { cx, cy } = playerCell(w);
  if (w.terr[cidx(cx, cy)] === T_RIVER) return "Nie postawisz wieży w rzece.";
  if (w.settlements.some((s) => Math.abs(s.cx - cx) < 5 && Math.abs(s.cy - cy) < 5)) return "Za blisko osady: tam strzegą mury.";
  if (works(w).some((k) => k.k === "tower" && Math.hypot(k.cx - cx, k.cy - cy) < 22)) return "Inna wieża stoi zbyt blisko.";
  return null;
}
function startWork(w: World, k: Work["k"], cells: number[], cost: number, days: number, name: string) {
  const P = w.player; if (P.gold < cost) return;
  if (works(w).filter((x) => !x.done).length >= 3) { toast("Masz już trzy budowy naraz. Brakuje rąk do pracy.", PAL.redL); return; }
  const { cx, cy } = playerCell(w);
  P.gold -= cost;
  works(w).push({ id: w.nextId++, k, cells, cx, cy, days, done: false, name });
  sfx.hammer?.(); sfx.coin();
  toast(`${WORK_DEF[k].name}: robotnicy ruszają do pracy (${days} dni).`, PAL.gold);
}
function applyWork(w: World, wk: Work) {
  if (wk.k === "road") for (const i of wk.cells) { if (!w.road[i] && w.terr[i] !== T_RIVER) w.road[i] = 1; }
  if (wk.k === "bridge") for (const i of wk.cells) w.road[i] = 2;
  if (wk.k === "tower") { const r = 20; for (let y = wk.cy - r; y <= wk.cy + r; y++) for (let x = wk.cx - r; x <= wk.cx + r; x++) if (x >= 0 && y >= 0 && x < WGW && y < WGH && (x - wk.cx) ** 2 + (y - wk.cy) ** 2 < r * r) w.explored[cidx(x, y)] = 1; }
}
// po wczytaniu zapisu mapa jest generowana od nowa, więc drogi i mosty nakładamy ponownie
function restoreWorks(w: World) { for (const wk of works(w)) if (wk.done) applyWork(w, wk); }

// ---------- Codzienny przebieg ----------
function kingdomDaily(w: World) {
  const P = w.player;
  for (const wk of works(w)) {
    if (wk.done) continue;
    if (!ownLand(w, wk.cx, wk.cy) && chance(0.5)) continue;   // na utraconej ziemi robota stoi
    if (--wk.days <= 0) { wk.done = true; applyWork(w, wk); chron(w, `Ukończono: ${wk.name}.`, PAL.gold, "player"); addLogMsg(`Ukończono budowę: ${wk.name}.`, PAL.gold); }
  }
  // wieże ostrzegają przed wrogimi armiami
  for (const wk of works(w)) {
    if (!wk.done || wk.k !== "tower" || (wk.warnDay ?? -9) > w.day - 3) continue;
    const foe = w.parties.find((o) => o.kind === "lord" && playerAtWarWith(w, o.faction) && Math.hypot(o.x / WCELL - wk.cx, o.y / WCELL - wk.cy) < 18 && !((wk as any).seen === o.id && (wk.warnDay ?? -9) > w.day - 8));
    if (foe) { wk.warnDay = w.day; (wk as any).seen = foe.id; addLogMsg(`${wk.name}: na horyzoncie ${foe.name} (${troopCount(foe.troops)} ludzi)!`, PAL.redL); const fx = Math.floor(foe.x / WCELL), fy = Math.floor(foe.y / WCELL); for (let y = fy - 4; y <= fy + 4; y++) for (let x = fx - 4; x <= fx + 4; x++) if (x >= 0 && y >= 0 && x < WGW && y < WGH) w.explored[cidx(x, y)] = 1; }
  }
  // oddziały w drodze między lennami
  for (const t of transfers(w).slice()) {
    if (--t.days > 0) continue;
    transfers(w).splice(transfers(w).indexOf(t), 1);
    const to = w.settlements[t.to];
    const back = w.settlements[t.from];
    const dest = to && (to.owner === -2 || (P.status === "król" && to.faction === PLAYER_FACTION)) ? to : back && (back.owner === -2 || back.faction === PLAYER_FACTION) ? back : null;
    if (dest) { for (const x of t.troops) addTroops(dest.garrison, x.type, x.n); addLogMsg(`${troopCount(t.troops)} ludzi dociera do ${dest.name}.`, PAL.bone); }
    else addLogMsg(`Oddział w drodze nie ma dokąd wrócić i rozchodzi się po kraju.`, PAL.redL);
  }
  // tytuł z nadania: wasal awansuje, gdy ma lenna i sławę
  if (P.status === "wasal" && P.liege > 0) {
    const r = playerRank(P), want = rankEarned(w);
    if (want > r) { (P as any).rank = want; const name = RANKS[want]; P.renown += 20; chron(w, `${factionName(P.liege)} nadaje ${P.name} tytuł: ${name}.`, PAL.gold, "player"); addLogMsg(`Władca nadaje ci tytuł: ${name}! Większy poczet i dochód.`, PAL.gold); sfx.fanfare(); }
  }
}

// ---------- Tytuły ----------
const RANKS = ["Rycerz", "Baron", "Hrabia", "Książę"];
const RANKS_F = ["Rycerka", "Baronowa", "Hrabina", "Księżna"];
function femName(n: string) { const f = n.split(" ")[0]; return /a$/.test(f) && !["Nerva", "Borin", "Kassian"].includes(f); }
function playerRank(P: PlayerState): number { return (P as any).rank || 0; }
function rankEarned(w: World): number {
  const P = w.player, f = w.settlements.filter((s) => s.owner === -2), towns = f.filter((s) => s.kind === "town").length, castles = f.filter((s) => s.kind === "castle").length;
  if (towns >= 2 && P.renown >= 900) return 3;
  if ((towns >= 1 || castles >= 2) && P.renown >= 450) return 2;
  if (f.length >= 1 && P.renown >= 200) return 1;
  return 0;
}
function rankLimitBonus(P: PlayerState) { return P.status === "król" ? ((P as any).crowned ? 30 : 15) : playerRank(P) * 8; }
function rankIncomeMul(P: PlayerState) { return 1 + (P.status === "król" ? 0.1 : playerRank(P) * 0.06); }
function lordRank(L: Lord): number { return (L as any).rank || 0; }
function setLordRank(L: Lord, r: number) { (L as any).rank = r; L.title = (femName(L.name) ? RANKS_F : RANKS)[r]; }

// ---------- Koronacja ----------
function canCrown(w: World): string | null {
  const P = w.player;
  if (P.status !== "król") return "Najpierw musisz panować: zdobądź twierdzę na własny rachunek.";
  if ((P as any).crowned) return "Jesteś już koronowany.";
  if (!myLands(w).some((s) => s.kind === "town")) return "Koronacja wymaga miasta z katedrą. Zdobądź miasto.";
  if (P.gold < 1500) return "Uczta, korona i jałmużna kosztują 1500 denarów.";
  return null;
}
function showCoronation() {
  const w = WORLD, P = w.player;
  const town = myLands(w).filter((s) => s.kind === "town").sort((a, b) => b.prosperity - a.prosperity)[0];
  const crowns = [["iron", "Żelazna korona", "+honor: władca żołnierzy"], ["gold", "Złota korona", "+dochód z miast"], ["bone", "Korona z kości przodków", "postrach u wrogów"]];
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("town", town.seed, town.culture, false), "scene-img")}</div>
    <h1>Koronacja w ${town.name}</h1><p class="dlg">Dzwony biją od świtu. W katedrze pachnie woskiem i mokrą wełną. Biskup trzyma koronę nad twoją głową i czeka na słowo, jaką ją przyjmiesz.</p>
    <div class="choices">${crowns.map(([k, n, d], i) => `<button class="choice" data-a="c" data-v="${k}"><span class="key">${i + 1}</span>${n} <span class="muted">(${d})</span></button>`).join("")}
    <button class="choice alt" data-a="no"><span class="key">4</span>Jeszcze nie teraz</button></div></div>`, {
    c: (v) => {
      P.gold -= 1500; (P as any).crowned = v; P.renown += 80; P.honor += v === "iron" ? 3 : 1;
      for (const L of w.lords) if (L.alive && L.faction === PLAYER_FACTION) { addLoyal(L, 20); lordRel(w, L, 8, "koronacja"); }
      for (const s of myLands(w)) s.relation = Math.min(100, s.relation + 10);
      chron(w, `${P.name} zostaje koronowany w ${town.name}. ${P.kingdom} ma prawowitego władcę.`, PAL.gold, "player");
      sfx.fanfare(); sfx.bell(); MOOD_HOLD.m = "victory"; MOOD_HOLD.until = performance.now() + 40000;
      // wieść o koronacji kusi niezadowolonych lordów innych koron
      const cands = w.lords.filter((L) => L.alive && !L.ruler && L.faction !== PLAYER_FACTION && L.faction !== 5 && L.relation >= 15 && lordLoyal(L) < 45).sort((a, b) => b.relation - a.relation).slice(0, 2);
      const joined: string[] = [];
      for (const L of cands) if (chance(0.55)) { defectLord(w, L, PLAYER_FACTION, false); joined.push(`${L.title} ${L.name}`); }
      closeScreen();
      showScr(`<div class="dialog frame"><h1 class="gold">Niech żyje ${P.name}!</h1><p>Lud wiwatuje na placu, a beczki z piwem stoją otworem do nocy. Twoi lordowie klękają kolejno i całują pierścień.</p>
        ${joined.length ? `<p class="gold">Na wieść o koronacji przybywają z przysięgą: ${joined.join(", ")}.</p>` : ""}<p class="tip">Korona: większy poczet (+30), łatwiej przekonać lordów do zmiany stron, tytuły dla dworu.</p><div class="btns"><button data-a="ok">Dalej</button></div></div>`, { ok: () => { closeScreen(); refreshMapHud(); } }, "dialog-scr");
    },
    no: () => { closeScreen(); showKingdom(); },
  }, "dialog-scr");
}

// ---------- Okno królestwa ----------
const KG = { tab: "lands", from: -1, to: -1, unit: "", road: -1 };
function showKingdom() {
  const w = WORLD, P = w.player, king = P.status === "król";
  const tabs: [string, string][] = [["lands", "Ziemie"], ["works", "Budowy"], ["court", king ? "Dwór" : "Tytuł"], ["intel", "Wywiad i traktaty"]];
  const re = () => showKingdom();
  let body = "", acts: Acts = {};
  if (KG.tab === "lands") {
    const L = myLands(w);
    const inc = L.reduce((s, x) => s + (x.owner === -2 ? fiefIncome(w, x) : 0), 0);
    body = `<p>${ic("crown")} ${king ? `<b>${esc(P.kingdom)}</b>${(P as any).crowned ? " · koronowany" : " · bez koronacji"}` : P.status === "wasal" ? `Wasal: ${factionName(P.liege)} · tytuł: <b>${RANKS[playerRank(P)]}</b>` : "Nie masz ziem."} · ${L.length} osad · dochód z lenn ${inc} den./dzień</p>
      ${L.length ? `<table class="ktab"><tr><th>Osada</th><th>Pan</th><th>Załoga</th><th>Dobrobyt</th><th>Stan</th></tr>${L.map((s) => `<tr class="${s.siegeBy.length ? "bad" : ""}"><td>${ic(s.kind === "town" ? "town" : s.kind === "castle" ? "castle" : "home")} ${esc(s.name)}</td><td>${s.owner === -2 ? "ty" : s.owner >= 0 ? esc(lordById(w, s.owner).name) : "korona"}</td><td>${troopCount(s.garrison)}</td><td>${Math.round(s.prosperity)}</td><td>${s.siegeBy.length ? "oblężenie!" : s.raided ? "złupiona" : wallDmg(s) > 10 ? wallWord(s) : "spokój"}</td></tr>`).join("")}</table>` : ""}
      ${transferHtml(w)}`;
    acts = transferActs(w, re);
  } else if (KG.tab === "works") {
    const { cx, cy } = playerCell(w), own = ownLand(w, cx, cy);
    const near = w.settlements.filter((s) => Math.hypot(s.cx - cx, s.cy - cy) < 70 && Math.hypot(s.cx - cx, s.cy - cy) > 3).sort((a, b) => Math.hypot(a.cx - cx, a.cy - cy) - Math.hypot(b.cx - cx, b.cy - cy)).slice(0, 10);
    if (KG.road < 0 || !near.some((s) => s.id === KG.road)) KG.road = near[0]?.id ?? -1;
    let rp = own && KG.road >= 0 ? planRoad(w, w.settlements[KG.road]) : null;
    if (own && !rp && !(KG as any).picked) for (const s of near) { const r = planRoad(w, s); if (r) { KG.road = s.id; rp = r; break; } }
    const bp = own ? planBridge(w) : null, tw = own ? canTower(w) : "—";
    const list = works(w);
    body = `<p class="tip">Budujesz tam, gdzie stoi twoja armia. ${own ? "<span class='gold'>Jesteś na swojej ziemi.</span>" : "<span class='bad'>To nie twoja ziemia: przejdź na teren swoich lenn.</span>"}</p>
      <div class="engines">
        <div class="eng"><b>${ic("road")} ${WORK_DEF.road.name}</b><span class="muted">${WORK_DEF.road.desc}</span>
          <span>Dokąd: <select id="kroad">${near.map((s) => `<option value="${s.id}" ${s.id === KG.road ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></span>
          ${rp ? `<button class="mini" data-a="road" ${P.gold >= rp.cost ? "" : "disabled"}>Buduj: ${rp.cells.length} odcinków, ${rp.cost} den., ${rp.days} dni</button>` : `<span class="muted">${own ? "Brak drogi do wytyczenia (już jest albo rzeka po drodze)." : ""}</span>`}</div>
        <div class="eng"><b>${ic("bridge")} ${WORK_DEF.bridge.name}</b><span class="muted">${WORK_DEF.bridge.desc}</span>
          ${bp ? `<button class="mini" data-a="bridge" ${P.gold >= bp.cost ? "" : "disabled"}>Buduj: ${bp.cost} den., ${bp.days} dni</button>` : `<span class="muted">${own ? "Stań nad brzegiem rzeki." : ""}</span>`}</div>
        <div class="eng"><b>${ic("tower")} ${WORK_DEF.tower.name}</b><span class="muted">${WORK_DEF.tower.desc}</span>
          ${!tw ? `<button class="mini" data-a="tower" ${P.gold >= 500 ? "" : "disabled"}>Buduj: 500 den., 4 dni</button>` : `<span class="muted">${tw}</span>`}</div>
      </div>
      <h2>Twoje budowy</h2>${list.length ? list.map((k) => `<div class="row"><span>${esc(k.name)}</span><span class="${k.done ? "gold" : "muted"}">${k.done ? "gotowe" : `w budowie: ${k.days} dni`}</span></div>`).join("") : "<p class='muted'>Jeszcze nic nie zbudowałeś.</p>"}`;
    acts = {
      roadSel: () => {},
      road: () => { if (!rp) return; const s = w.settlements[KG.road]; startWork(w, "road", rp.cells, rp.cost, rp.days, `Trakt do ${s.name}`); re(); },
      bridge: () => { if (!bp) return; const ns = w.settlements[w.nearest[cidx(cx, cy)]]; startWork(w, "bridge", bp.cells, bp.cost, bp.days, `Most pod ${ns.name}`); re(); },
      tower: () => { if (tw) return; const s = w.settlements[w.nearest[cidx(cx, cy)]]; startWork(w, "tower", [], 500, 4, `Strażnica pod ${s.name}`); re(); },
    };
  } else if (KG.tab === "intel") {
    body = intelHtml(w); acts = intelActs(w, re);
  } else {
    body = king ? courtHtml(w) : titleHtml(w);
    acts = king ? courtActs(w, re) : {};
  }
  showScr(`<div class="card frame wide kingdom"><h1>${ic("crown")} Królestwo</h1><div class="fbar">${tabs.map(([k, n]) => `<button class="mini ${KG.tab === k ? "on" : ""}" data-a="ktab" data-v="${k}">${n}</button>`).join("")}</div>${body}<div class="btns"><button data-a="close">Zamknij (${keyName(KB("kingdom"))})</button></div></div>`, {
    ...acts,
    ktab: (v) => { KG.tab = v; (KG as any).picked = 0; re(); },
    close: () => closeScreen(),
  }, "win kingdom-scr");
  intelBind(re);
  const sel = document.getElementById("kroad") as HTMLSelectElement | null;
  if (sel) sel.onchange = () => { KG.road = Number(sel.value); (KG as any).picked = 1; re(); };
  for (const id of ["kfrom", "kto", "kunit"]) { const e = document.getElementById(id) as HTMLSelectElement | null; if (e) e.onchange = () => { if (id === "kfrom") { KG.from = Number(e.value); KG.unit = ""; } else if (id === "kto") KG.to = Number(e.value); else KG.unit = e.value; re(); }; }
}

// przenoszenie załóg
function transferHtml(w: World) {
  const L = myLands(w).filter((s) => s.kind !== "village");
  if (L.length < 2) return `<p class="tip">Z dwiema twierdzami możesz przerzucać ludzi między załogami.</p>`;
  if (!L.some((s) => s.id === KG.from)) KG.from = L.slice().sort((a, b) => troopCount(b.garrison) - troopCount(a.garrison))[0].id;
  if (!L.some((s) => s.id === KG.to) || KG.to === KG.from) KG.to = L.find((s) => s.id !== KG.from)!.id;
  const from = w.settlements[KG.from], to = w.settlements[KG.to];
  const g = from.garrison.filter((t) => t.n - t.wounded > 0);
  if (!g.some((t) => t.type === KG.unit)) KG.unit = g[0]?.type || "";
  const d = transferDays(from, to);
  const moving = transfers(w);
  return `<h2>${ic("man")} Przerzut załogi</h2><div class="row"><span>Z: <select id="kfrom">${L.map((s) => `<option value="${s.id}" ${s.id === KG.from ? "selected" : ""}>${esc(s.name)} (${troopCount(s.garrison)})</option>`).join("")}</select></span>
    <span>Do: <select id="kto">${L.filter((s) => s.id !== KG.from).map((s) => `<option value="${s.id}" ${s.id === KG.to ? "selected" : ""}>${esc(s.name)} (${troopCount(s.garrison)})</option>`).join("")}</select></span>
    <span>Kto: <select id="kunit">${g.map((t) => `<option value="${t.type}" ${t.type === KG.unit ? "selected" : ""}>${UNITS[t.type].name} (${t.n - t.wounded})</option>`).join("")}</select></span></div>
    <div class="row">${KG.unit ? `<button class="mini" data-a="tr" data-v="5">Wyślij 5</button><button class="mini" data-a="tr" data-v="half">Połowę</button><button class="mini" data-a="tr" data-v="all">Wszystkich</button><span class="muted">marsz: ${d} dni</span>` : "<span class='muted'>W tej załodze nie ma zdrowych ludzi.</span>"}</div>
    ${moving.length ? `<p class="muted">W drodze: ${moving.map((t) => `${troopCount(t.troops)} ludzi do ${w.settlements[t.to].name} (${t.days} dni)`).join(" · ")}</p>` : ""}`;
}
function transferDays(a: Settlement, b: Settlement) { return Math.max(1, Math.ceil(Math.hypot(a.cx - b.cx, a.cy - b.cy) / 28)); }
function transferActs(w: World, re: () => void): Acts {
  return {
    tr: (v) => {
      const from = w.settlements[KG.from], to = w.settlements[KG.to], t = from.garrison.find((x) => x.type === KG.unit); if (!t) return;
      const free = t.n - t.wounded, n = v === "all" ? free : v === "half" ? Math.ceil(free / 2) : Math.min(5, free);
      if (n <= 0) return;
      if (from.siegeBy.length) { toast("Twierdza jest oblężona. Nikt nie wyjdzie za bramę.", PAL.redL); return; }
      removeTroops(from.garrison, t.type, n);
      transfers(w).push({ from: from.id, to: to.id, troops: [{ type: t.type, n, wounded: 0, xp: 0 }], days: transferDays(from, to) });
      toast(`${n}× ${UNITS[t.type].name} wyrusza z ${from.name} do ${to.name}.`, PAL.gold); re();
    },
  };
}

// dwór królewski
function courtHtml(w: World) {
  const P = w.player, lords = w.lords.filter((L) => L.alive && L.faction === PLAYER_FACTION && !L.ruler);
  const feastCost = 250 + lords.length * 80, lastFeast = (P as any).feastDay ?? -99, feastOk = w.day - lastFeast >= 20;
  const cr = canCrown(w);
  return `${(P as any).crowned ? `<p class="gold">${ic("crown")} Korona: ${({ iron: "żelazna", gold: "złota", bone: "z kości przodków" } as any)[(P as any).crowned]}.</p>` : `<div class="row"><span>${ic("crown")} <b>Koronacja</b> · ${cr ? `<span class="muted">${cr}</span>` : "katedra czeka"}</span><button class="mini" data-a="crown" ${cr ? "disabled" : ""}>Koronuj się (1500)</button></div>`}
    <div class="row"><span>${ic("food")} <b>Uczta dla dworu</b> · wierność wszystkich +8 ${feastOk ? "" : `<span class="muted">(następna za ${20 - (w.day - lastFeast)} dni)</span>`}</span><button class="mini" data-a="feast" ${feastOk && P.gold >= feastCost && lords.length ? "" : "disabled"}>Wyprawa uczty (${feastCost})</button></div>
    <h2>Twoi lordowie</h2>${lords.length ? `<table class="ktab"><tr><th>Lord</th><th>Tytuł</th><th>Wierność</th><th>Relacja</th><th>Lenna</th><th></th></tr>${lords.map((L) => { const r = lordRank(L), cost = 400 * (r + 1), fiefs = w.settlements.filter((s) => s.owner === L.id).length; const dukes = lords.filter((x) => lordRank(x) === 3).length; const can = r < 3 && !(r === 2 && dukes >= 2) && (!(P as any).crowned ? r < 1 : true); return `<tr><td>${esc(L.name)}</td><td>${(femName(L.name) ? RANKS_F : RANKS)[r]}</td><td class="${lordLoyal(L) < 35 ? "bad" : ""}">${lordLoyal(L)}</td><td>${L.relation}</td><td>${fiefs}</td><td>${can ? `<button class="mini" data-a="grant" data-v="${L.id}" ${P.gold >= cost ? "" : "disabled"}>Nadaj: ${(femName(L.name) ? RANKS_F : RANKS)[r + 1]} (${cost})</button>` : ""}</td></tr>`; }).join("")}</table><p class="tip">Bez koronacji możesz nadawać tylko baronie. Książąt najwyżej dwóch.</p>` : "<p class='muted'>Nikt jeszcze nie przysiągł ci wierności. Przekonuj lordów w rozmowie albo koronuj się.</p>"}`;
}
function courtActs(w: World, re: () => void): Acts {
  const P = w.player;
  return {
    crown: () => { if (!canCrown(w)) showCoronation(); },
    feast: () => {
      const lords = w.lords.filter((L) => L.alive && L.faction === PLAYER_FACTION && !L.ruler), c = 250 + lords.length * 80;
      if (P.gold < c) return; P.gold -= c; (P as any).feastDay = w.day; P.morale = Math.min(100, P.morale + 5);
      for (const L of lords) { addLoyal(L, 8); lordRel(w, L, 3, "uczta na dworze"); }
      chron(w, `${P.name} wyprawia ucztę dla dworu.`, PAL.gold, "player"); sfx.coin(); toast("Wino, dziczyzna i pieśni do rana. Lordowie są zadowoleni.", PAL.gold); re();
    },
    grant: (v) => {
      const L = lordById(w, Number(v)); if (!L) return; const r = lordRank(L), cost = 400 * (r + 1); if (P.gold < cost || r >= 3) return;
      P.gold -= cost; setLordRank(L, r + 1); addLoyal(L, 15); lordRel(w, L, 10, "nadałeś mu tytuł");
      for (const o of w.lords) if (o !== L && o.alive && o.faction === PLAYER_FACTION && lordRank(o) <= r && chance(0.3)) addLoyal(o, -3);   // zazdrość
      chron(w, `${P.name} nadaje ${L.name} tytuł: ${L.title}.`, PAL.gold, "lord"); sfx.fanfare(); re();
    },
  };
}
function titleHtml(w: World) {
  const P = w.player, r = playerRank(P);
  const req = ["", "lenno i 200 sławy", "miasto albo dwa zamki i 450 sławy", "dwa miasta i 900 sławy"];
  return `<p>${P.status === "wasal" ? `Służysz władcy ${factionName(P.liege)}.` : "Nie jesteś niczyim wasalem."} Twój tytuł: <b>${RANKS[r]}</b>.</p>
    <table class="ktab"><tr><th>Tytuł</th><th>Wymaga</th><th>Daje</th></tr>${RANKS.map((n, i) => `<tr class="${i === r ? "gold" : ""}"><td>${n}</td><td>${req[i] || "pasowanie"}</td><td>poczet +${i * 8}, dochód +${i * 6}%</td></tr>`).join("")}</table>
    <p class="tip">Władca nadaje tytuł sam, gdy spełnisz warunki. Jako król korona daje +15 do pocztu, a po koronacji +30.</p>`;
}

// ---------- Rysowanie budów na mapie świata ----------
function drawWorks(w: World, g: CanvasRenderingContext2D, sx: number, sy: number, t: number) {
  for (const wk of works(w)) {
    if (wk.k === "tower") {
      const x = Math.round(wk.cx * WCELL + 4 - sx), y = Math.round(wk.cy * WCELL + 6 - sy);
      if (x < -20 || y < -30 || x > W + 20 || y > H + 20) continue;
      if (!w.explored[cidx(wk.cx, wk.cy)]) continue;
      g.fillStyle = "rgba(10,9,8,0.4)"; g.fillRect(x - 4, y, 10, 2);
      if (!wk.done) { g.fillStyle = PAL.wood; for (let k = 0; k < 4; k++) g.fillRect(x - 3 + k * 2, y - 8 + (k % 2) * 2, 1, 8); g.fillStyle = PAL.stone; g.fillRect(x - 3, y - 3, 7, 3); continue; }
      g.fillStyle = PAL.ink; g.fillRect(x - 3, y - 13, 7, 13);
      g.fillStyle = PAL.stone; g.fillRect(x - 2, y - 12, 5, 12); g.fillStyle = PAL.ash; g.fillRect(x - 2, y - 12, 1, 12);
      g.fillStyle = PAL.ink; g.fillRect(x - 3, y - 15, 1, 2); g.fillRect(x - 1, y - 15, 1, 2); g.fillRect(x + 1, y - 15, 1, 2); g.fillRect(x + 3, y - 15, 1, 2); g.fillRect(x, y - 8, 1, 2);
      g.fillStyle = PAL.wood; g.fillRect(x, y - 21, 1, 6);
      const fl = Math.floor(t * 3) % 2; g.fillStyle = PAL.gold; g.fillRect(x + 1, y - 21, 3 + fl, 2);
      continue;
    }
    for (let k = 0; k < wk.cells.length; k++) {
      const i = wk.cells[k], cx = i % WGW, cy = Math.floor(i / WGW);
      const x = cx * WCELL - sx, y = cy * WCELL - sy;
      if (x < -10 || y < -10 || x > W + 10 || y > H + 10 || !w.explored[i]) continue;
      if (wk.k === "bridge") {
        g.fillStyle = PAL.ink; g.fillRect(x, y + 2, WCELL, 5);
        g.fillStyle = wk.done ? PAL.wood : PAL.woodD; for (let q = 0; q < WCELL; q += 2) g.fillRect(x + q, y + 3, 1, 3);
        if (wk.done) { g.fillStyle = PAL.woodD; g.fillRect(x, y + 2, WCELL, 1); g.fillRect(x, y + 6, WCELL, 1); }
      } else {
        const n = wk.cells[k + 1]; if (n === undefined) continue;
        const nx = (n % WGW) * WCELL - sx, ny = Math.floor(n / WGW) * WCELL - sy;
        if (Math.abs(nx - x) > WCELL * 1.5 || Math.abs(ny - y) > WCELL * 1.5) continue;
        if (wk.done) { pxLine(g, x + 4, y + 5, nx + 4, ny + 5, "#1a1610"); pxLine(g, x + 4, y + 4, nx + 4, ny + 4, "#7a6648"); pxLine(g, x + 5, y + 4, nx + 5, ny + 4, PAL.dirtL); }
        else if (k % 2 === 0) { g.fillStyle = PAL.dirtL; g.fillRect(x + 4, y + 4, 1, 1); g.fillStyle = PAL.wood; g.fillRect(x + 4, y + 2, 1, 2); }   // paliki wytyczające trakt
      }
    }
  }
}

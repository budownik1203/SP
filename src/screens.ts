// Ekrany kampanii: tytuł, kreator bohatera, osady, spotkania, rozmowy z lordami, po bitwie, niewola, postać, ekwipunek, armia, frakcje, kronika, zapis.

const SAVE_AUTO = "sztandary-b5-auto", SAVE_SLOT = "sztandary-b5-slot1";

// ---------- Zapis ----------
function serializeWorld(w: World) {
  const o: any = { ...w };
  delete o.terr; delete o.road; delete o.nearest; delete o.blight;
  let ex = ""; for (let i = 0; i < w.explored.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (w.explored[i + k]) b |= 1 << k; ex += String.fromCharCode(b); }
  o.explored = btoa(ex);
  o.version = 4;
  o.parties = w.parties.map((p) => { const c: any = { ...p }; delete c.trail; delete c.trailD; return c; });
  return JSON.stringify(o);
}
function deserializeWorld(json: string): World {
  const o = JSON.parse(json);
  const savedSeed = _seed;
  const base = generateWorld(o.seed, o.player);
  _seed = savedSeed;
  const w: World = { ...base, ...o, terr: base.terr, road: base.road, nearest: base.nearest, blight: base.blight, explored: new Uint8Array(WGW * WGH) };
  const ex = atob(o.explored);
  for (let i = 0; i < ex.length; i++) { const b = ex.charCodeAt(i); for (let k = 0; k < 8; k++) if (b & (1 << k)) w.explored[i * 8 + k] = 1; }
  // nowi kompani (dodani w późniejszych buildach) trafiają do losowych karczm
  const known = new Set([...w.settlements.flatMap((s) => s.companions), ...w.player.companions.map((c) => c.id)]);
  const towns = w.settlements.filter((s) => s.kind === "town");
  for (const c of COMPANIONS) if (!known.has(c.id) && towns.length) towns[hashInt(c.id.length * 7 + c.name.length) % towns.length].companions.push(c.id);
  // przedmioty z jakością odtwarzamy z identyfikatorów
  for (const id of w.player.items) ensureItem(id);
  for (const id of Object.values(w.player.equip)) if (id) ensureItem(id as string);
  return w;
}
function autosave() { if (!WORLD) return; try { localStorage.setItem(SAVE_AUTO, serializeWorld(WORLD)); } catch (e) { /* brak miejsca */ } }
function saveSlot() { try { localStorage.setItem(SAVE_SLOT, serializeWorld(WORLD)); toast("Zapisano grę.", PAL.gold); } catch (e) { toast("Nie udało się zapisać gry.", PAL.redL); } }
function hasSave(k: string) { try { return !!localStorage.getItem(k); } catch (e) { return false; } }
function loadSave(k: string) {
  let json: string | null = null;
  try { json = localStorage.getItem(k); } catch (e) { /* brak */ }
  if (!json) { toast("Brak zapisu.", PAL.redL); return; }
  try {
    WORLD = deserializeWorld(json);
    WMAP = null; WBORDER = null; WBORDER_VER = -1; SICON.clear();
    renderWorldMap(WORLD);
    const p = playerParty(WORLD);
    G.view.cam.x = p.x - W / 2; G.view.cam.y = p.y - H / 2;
    G.state = "map"; G.battle = null; G.target = null; G.camping = false; G.waitHours = 0;
    closeScreen(); hideBattleHud(); showMapHud(); refreshMapHud();
    if (WORLD.player.captive) showCaptivity();
    toast("Wczytano grę. Dzień " + WORLD.day + ".", PAL.gold);
  } catch (e) { console.error(e); toast("Zapis jest uszkodzony.", PAL.redL); }
}

// ---------- Tytuł ----------
function showTitle() {
  G.state = "title";
  hideMapHud(); hideBattleHud();
  showScr(`<div class="title-card frame">
    <h1>Sztandary Popiołu</h1>
    <p class="tip"><span class="badge">${BUILD}</span> Mroczny sandbox wojenny: mapa świata, osady, lordowie, wojny i bitwy, w których sam stajesz w szeregu.</p>
    <div class="col-btns">
      <button data-a="new">Nowa gra</button>
      <button class="alt" data-a="cont" ${hasSave(SAVE_AUTO) ? "" : "disabled"}>Kontynuuj (autozapis)</button>
      <button class="alt" data-a="load" ${hasSave(SAVE_SLOT) ? "" : "disabled"}>Wczytaj zapis</button>
      <button class="alt" data-a="quick">Szybka bitwa</button>
      <button class="alt" data-a="opts">Ustawienia</button>
    </div>
    <p class="tip">Na mapie: LPM: idź lub wejdź · PPM: przesuń widok · Spacja: postój i obóz · C I P F K J: okna · H: wróć do armii · Esc: menu.<br>W bitwie: WASD, Shift: sprint, LPM: cios (kierunek z ruchu myszy, przytrzymaj = mocniej), PPM: blok (w ostatniej chwili = kontra), Spacja: odskok, F: kopniak, R: cios z góry / kopia, ŚPM: pchnięcie, Tab: łuk ↔ broń, E: zsiądź / dosiądź, 1–3: umiejętności, 4: opatrunek, Q: rozkazy.</p>
  </div>`, {
    new: () => showCreator(),
    cont: () => loadSave(SAVE_AUTO),
    load: () => loadSave(SAVE_SLOT),
    quick: () => showQuickBattle(),
    opts: () => showSettings(() => showTitle()),
  }, "title");
}

// ---------- Kreator ----------
const CRE = { name: "Wędrowiec", race: "human", origin: "merc", skin: 0, hair: 0, beard: 1, scar: 0, build: 1 };
function creatorLook(): Look {
  const R = RACES[CRE.race];
  const skins: [string, string][] = CRE.race === "orc" ? [[PAL.moss, PAL.grassD], [PAL.grassL, PAL.grass], [PAL.stone, PAL.slate]] : CRE.race === "undead" ? [[PAL.bone, PAL.ash], [PAL.boneHi, PAL.bone]] : [[PAL.skin, PAL.skinD], [PAL.skinD, PAL.dirt], [PAL.bone, PAL.skin]];
  const hairs = [PAL.dirtD, PAL.black, PAL.rust, PAL.ash, PAL.woodD, PAL.bone];
  const O = ORIGINS[CRE.origin];
  return {
    race: R.race, build: CRE.build, tall: CRE.race === "orc", skin: skins[CRE.skin % skins.length], hair: hairs[CRE.hair % hairs.length],
    beard: CRE.race === "dwarf" ? 3 : CRE.race === "orc" || CRE.race === "undead" ? 0 : CRE.beard % 3, scar: CRE.scar % 3,
    helm: O.equip.head ? ITEMS[O.equip.head].helm : "none", body: O.equip.body ? ITEMS[O.equip.body].body : "rags", tabard: null,
    cape: CRE.origin === "noble" ? [PAL.red, PAL.bloodD] : undefined, hood: CRE.origin === "mage" ? [PAL.purple, PAL.dusk] : CRE.origin === "hunter" ? [PAL.moss, PAL.grassD] : undefined,
    pants: PAL.dirt, boots: PAL.woodD, quiver: CRE.origin === "hunter", scabbard: true, dirt: 0.4, blood: 0.15, seed: 77,
  };
}
function showCreator() {
  G.state = "creator";
  const L = creatorLook();
  const portrait = drawPortrait(L, PAL.gold);
  const spr = spritesFor(L, "creator:" + JSON.stringify(CRE)).frames[0][0];
  const O = ORIGINS[CRE.origin], R = RACES[CRE.race];
  const raceBtns = Object.keys(RACES).map((k) => `<button class="chip ${CRE.race === k ? "on" : ""}" data-a="race" data-v="${k}">${RACES[k].name}</button>`).join("");
  const orBtns = Object.keys(ORIGINS).map((k) => `<button class="chip ${CRE.origin === k ? "on" : ""}" data-a="origin" data-v="${k}">${ORIGINS[k].name}</button>`).join("");
  const look = (lab: string, key: string) => `<div class="row"><span>${lab}</span><span><button class="mini" data-a="look" data-v="${key}:-1">‹</button><button class="mini" data-a="look" data-v="${key}:1">›</button></span></div>`;
  showScr(`<div class="creator frame">
    <h1>Twój bohater</h1>
    <div class="cre-grid">
      <div class="cre-left">
        ${pic(portrait, "portrait big")}
        ${pic(spr, "sprite", 3)}
        <label class="field">Imię <input data-in="name" maxlength="20" value="${esc(CRE.name)}"></label>
        <div class="looks">${look("Skóra", "skin")}${look("Włosy", "hair")}${CRE.race === "human" ? look("Broda", "beard") : ""}${look("Blizna", "scar")}${look("Budowa", "build")}</div>
      </div>
      <div class="cre-right">
        <h2>Rasa</h2><div class="chips">${raceBtns}</div><p class="tip">${R.desc}</p>
        <h2>Pochodzenie</h2><div class="chips">${orBtns}</div>
        <p>${O.desc}</p>
        <div class="cre-attrs">${ATTRS.map((k) => { const v = 4 + (O.attr[k] || 0) + (R.attr[k] || 0); return `<div class="attr"><span class="an" style="color:${ATTR_INFO[k].col}">${ATTR_INFO[k].name}</span><div class="bar"><i style="width:${(v / 15) * 100}%;background:${ATTR_INFO[k].col}"></i></div><b>${v}</b></div>`; }).join("")}</div>
        <p class="tip">Na start: ${ic(NODE(O.node).icon)} <b>${NODE(O.node).name}</b> i 2 punkty drzewek · ${O.hint}</p>
        <p class="tip">${ic("coin")} ${O.gold} · ludzie: ${O.troops.map(([t, n]) => `${n}× ${UNITS[t].name}`).join(", ")}</p>
        <p class="tip">Sprzęt (nędzny): ${Object.values(O.equip).map((i) => ITEMS[i].name).join(", ")}</p>
      </div>
    </div>
    <div class="btns"><button data-a="start">Ruszaj w świat</button><button class="alt" data-a="back">Wróć</button></div>
  </div>`, {
    race: (v) => { CRE.race = v; showCreator(); },
    origin: (v) => { CRE.origin = v; showCreator(); },
    look: (v) => { const [k, d] = v.split(":"); (CRE as any)[k] = ((CRE as any)[k] + Number(d) + 6) % 6; if (k === "build") CRE.build = CRE.build % 3; showCreator(); },
    name: (v) => { CRE.name = v.trim() || "Wędrowiec"; },
    start: () => { closeScreen(); startNewGame(newPlayer(CRE.name, CRE.race, CRE.origin, creatorLook())); },
    back: () => showTitle(),
  }, "creator-scr");
}

// ---------- Szybka bitwa ----------
const QB = { enemy: 5, terrain: "plains" as Terrain, size: 50, night: false, rain: false, fog: false, origin: "merc", mounted: false };
function showQuickBattle() {
  const terr: Terrain[] = ["plains", "forest", "hills", "swamp", "river", "bridge", "ravine", "village", "coast", "ruins", "siege"];
  showScr(`<div class="card frame">
    <h1>Szybka bitwa</h1>
    <div class="cols">
      <div><h2>Wróg</h2><div class="chips">${[1, 2, 3, 4, 5, 6].map((f) => `<button class="chip ${QB.enemy === f ? "on" : ""}" data-a="enemy" data-v="${f}">${FACTIONS[f].short}</button>`).join("")}</div>
      <h2>Teren</h2><div class="chips">${terr.map((t) => `<button class="chip ${QB.terrain === t ? "on" : ""}" data-a="terr" data-v="${t}">${TERRAIN_NAME[t]}</button>`).join("")}</div></div>
      <div><h2>Wielkość armii</h2><input type="range" min="20" max="160" step="10" value="${QB.size}" data-in="size"> <b id="qb-size">${QB.size}</b> na stronę
      <div class="menu"><label><input type="checkbox" data-in="night" ${QB.night ? "checked" : ""}> Noc</label><label><input type="checkbox" data-in="rain" ${QB.rain ? "checked" : ""}> Deszcz</label><label><input type="checkbox" data-in="fog" ${QB.fog ? "checked" : ""}> Mgła</label><label><input type="checkbox" data-in="mounted" ${QB.mounted ? "checked" : ""}> Bohater konno</label></div>
      <h2>Bohater</h2><div class="chips">${Object.keys(ORIGINS).map((k) => `<button class="chip ${QB.origin === k ? "on" : ""}" data-a="origin" data-v="${k}">${ORIGINS[k].name}</button>`).join("")}</div></div>
    </div>
    <div class="btns"><button data-a="go">Do boju</button><button class="alt" data-a="back">Wróć</button></div>
  </div>`, {
    enemy: (v) => { QB.enemy = Number(v); showQuickBattle(); }, terr: (v) => { QB.terrain = v as Terrain; showQuickBattle(); },
    size: (v) => { QB.size = Number(v); const e = document.getElementById("qb-size"); if (e) e.textContent = v; },
    night: (v) => { QB.night = !!v; }, rain: (v) => { QB.rain = !!v; }, fog: (v) => { QB.fog = !!v; }, mounted: (v) => { QB.mounted = !!v; },
    origin: (v) => { QB.origin = v; showQuickBattle(); },
    go: () => startQuickBattle(), back: () => showTitle(),
  }, "quick");
}
function startQuickBattle() {
  closeScreen();
  const P = newPlayer("Bohater", "human", QB.origin, (() => { const s = CRE.origin; CRE.origin = QB.origin; const l = creatorLook(); CRE.origin = s; return l; })());
  P.level = 5; P.attr.str += 2; P.skills.ironflesh += 2;
  if (QB.mounted && !P.equip.horse) P.equip.horse = "h_courser";
  if (!QB.mounted) P.equip.horse = null;
  const hero = heroCfgFromPlayer(P);
  hero.faith = 100; hero.mana = 100; hero.bandages = 3;
  const n = QB.size;
  const myF = QB.enemy === 1 ? 2 : 1;
  const mine = factionTroops(myF, n, 0.6).map((t) => ({ type: t.type, n: t.n }));
  let theirs: { type: string; n: number }[];
  if (QB.enemy === 6) theirs = [{ type: "b_bandit", n: Math.ceil(n * 0.7) }, { type: "b_archer", n: Math.floor(n * 0.3) }, { type: "b_chief", n: 2 }];
  else theirs = factionTroops(QB.enemy, n, 0.6).map((t) => ({ type: t.type, n: t.n }));
  if (QB.enemy === 5) theirs.push({ type: "u_dk", n: 1 });
  const cfg: BattleConfig = { terrain: QB.terrain, night: QB.night, rain: QB.rain, fog: QB.fog, player: { name: "Ty", faction: myF, troops: mine, hero }, enemy: { name: FACTIONS[QB.enemy].name, faction: QB.enemy, troops: theirs }, maxPerSide: settings.battleSize, siegeDefender: QB.terrain === "siege" ? 1 : undefined };
  G.ctx = { kind: "custom", enemies: [], allies: [], title: "Szybka bitwa" };
  G.battle = new Battle(cfg, input, sfx, settings);
  G.battle.heroDmg = 1.15;
  G.battle.phase = "fight";
  G.state = "battle";
  showBattleHud();
  G.battle.shout(FACTIONS[QB.enemy].name, PAL.gold);
  sfx.battleCry(1);
}

// ---------- HUD mapy ----------
function showMapHud() { const h = document.getElementById("maphud"); if (h) h.hidden = false; document.getElementById("build").hidden = true; refreshMapHud(); }
function hideMapHud() { const h = document.getElementById("maphud"); if (h) h.hidden = true; document.getElementById("build").hidden = false; const t = document.getElementById("tip"); if (t) t.hidden = true; }
function timeWord(h: number) { return h < 5 ? "noc" : h < 8 ? "świt" : h < 12 ? "ranek" : h < 17 ? "dzień" : h < 21 ? "zmierzch" : "noc"; }
function refreshMapHud() {
  const w = WORLD;
  if (!w) return;
  const P = w.player, p = playerParty(w);
  const n = troopCount(p.troops) + 1 + P.companions.length;
  const food = foodTotal(w), days = Math.floor(food / Math.max(1, Math.ceil(n / 8)));
  const el = document.getElementById("mh-top");
  if (!el) return;
  const status = P.status === "najemnik" ? `najemnik: ${factionShort(P.liege)} (${P.contractDays} dni)` : P.status === "wasal" ? `wasal: ${factionShort(P.liege)}` : P.status === "król" ? P.kingdom : "wolny";
  const hpK = P.hp / heroMaxHp(P);
  el.innerHTML = `<span class="hb" title="Dzień i pora">${ic(isNight(w) ? "moon" : "sun")} Dzień ${w.day} · ${SEASON_NAME[season(w)]} · ${String(Math.floor(w.hour)).padStart(2, "0")}:00 ${timeWord(w.hour)}${(w as any).storm ? " · burza" : ""}${w.rain ? ` ${ic("rain")} deszcz` : ""}${(w as any).fog ? ` ${ic("wind")} mgła` : ""}</span>
    <span class="hb" title="Złoto">${ic("coin")} <b class="gold">${P.gold}</b></span>
    <span class="hb" title="Ludzie / limit">${ic("man")} ${n}/${partyLimit(w)}${p.troops.some((t) => t.wounded) ? ` <span class="muted">(${p.troops.reduce((s, t) => s + t.wounded, 0)} rann.)</span>` : ""}</span>
    <span class="hb ${days < 2 ? "bad" : ""}" title="Jedzenie (dni zapasu)">${ic("food")} ${food} <span class="muted">(${days} dni)</span></span>
    <span class="hb ${P.morale < 35 ? "bad" : ""}" title="Morale">${ic("heart")} ${Math.round(P.morale)}</span>
    <span class="hb" title="Zdrowie bohatera"><span class="minibar"><i style="width:${hpK * 100}%"></i></span></span>
    ${P.attrPts || P.skillPts ? `<span class="hb gold pulse" title="Nowe punkty w oknie postaci (C)">${ic("star")} ${P.attrPts + P.skillPts} pkt</span>` : ""}
    <span class="hb muted">${ic("banner")} ${status}</span><span class="hb muted">${BUILD}</span>`;
  const qp = document.getElementById("mh-quest");
  if (qp) { const q = P.quests.find((x) => !x.done && !x.hide); const pos = q && questPos(w, q); qp.hidden = !q; if (q) qp.innerHTML = `${ic("scroll")} <span style="color:${QUEST_COL}">${esc(q.text.length > 60 ? q.text.slice(0, 58) + "…" : q.text)}</span><br><span class="muted">${q.days} dni${pos ? ` · ${Math.round(dist(pos.x, pos.y, playerParty(w).x, playerParty(w).y) / WCELL)} pól` : ""} · ${ic("coin")} ${q.reward}</span>`; }
  const sp = document.getElementById("mh-speed");
  const cm = (P as any).campMode || "rest";
  if (sp) sp.innerHTML = `${[1, 2, 4, 8].map((s) => `<button class="mini ${G.speed === s ? "on" : ""}" data-sp="${s}">×${s}</button>`).join("")}<button class="mini ${G.camping ? "on" : ""}" data-sp="camp">${ic("tent")} ${G.camping ? "Zwiń obóz" : "Obóz"}</button>${G.camping ? `<span class="campm">${[["rest", "Odpoczynek", "heart"], ["train", "Trening", "sword"], ["guard", "Wartownicy", "eye"]].map(([k, n, i]) => `<button class="mini ${cm === k ? "on" : ""}" data-sp="cm:${k}" title="${k === "rest" ? "rany goją się szybko" : k === "train" ? "żołnierze zbierają doświadczenie, zużywa zboże" : "nikt was nie zaskoczy"}">${ic(i)} ${n}</button>`).join("")}</span>` : ""}`;
}
function updateTip() {
  const tip = document.getElementById("tip");
  if (!tip) return;
  const hv = G.view.hover, w = WORLD;
  if (!hv || screenOpen()) { tip.hidden = true; return; }
  let html = "";
  if (hv.kind === "party") {
    const o = partyById(w, hv.id);
    if (!o) { tip.hidden = true; return; }
    const ratio = partyPower(w, playerParty(w)) / Math.max(0.1, partyPower(w, o));
    const st: Record<string, string> = { siege: "oblega", raid: "idzie grabić", besiege: "idzie na oblężenie", patrol: "patroluje", chase: "ściga", flee: "ucieka", rest: "wraca do domu", wander: "krąży" };
    html = `${QM.party.has(o.id) ? `<span style="color:${QUEST_COL}">◆ Cel zadania</span><br>` : ""}<b>${esc(o.name)}</b><br><span class="muted">${factionName(o.faction)}</span><br>${partyDesc(o)}<br>${hostile(w, playerParty(w), o) ? `<span class="bad">Wrogi</span> · ${strengthWord(ratio)}` : "Neutralny lub sojusznik"}${st[o.state] ? `<br><span class="muted">${st[o.state]}</span>` : ""}`;
  } else if (hv.kind === "settlement") {
    const s = w.settlements[hv.id];
    const owner = s.owner === -2 ? "ty" : s.owner >= 0 ? `${lordById(w, s.owner).title} ${lordById(w, s.owner).name}` : "korona";
    const kind = s.kind === "town" ? "Miasto" : s.kind === "castle" ? "Zamek" : "Wioska";
    html = `${QM.set.has(s.id) ? `<span style="color:${QUEST_COL}">◆ ${esc(QM.set.get(s.id).text)}</span><br>` : ""}<b>${s.name}</b> <span class="muted">${kind}</span><br>${factionName(s.faction)} · właściciel: ${owner}<br>Dobrobyt ${Math.round(s.prosperity)}${s.kind !== "village" ? ` · załoga ${troopCount(s.garrison)}` : ""}${s.siegeBy.length ? `<br><span class="bad">Oblężenie (${s.siegeDays} dni)</span>` : ""}${s.raided ? `<br><span class="bad">Spustoszona</span>` : ""}${s.tournament ? `<br><span class="gold">Turniej!</span>` : ""}${playerAtWarWith(w, s.faction) ? `<br><span class="bad">Wrogie</span>` : ""}`;
  } else {
    const pl = w.places[hv.id];
    const d: Record<string, string> = { ruins: "Ruiny pełne nieumarłych i skarbów.", lair: "Leże bestii.", shrine: "Miejsce modlitwy. Odnawia wiarę.", camp: "Obóz zbójców. Stąd wychodzą bandy.", cemetery: "Przeklęta ziemia. Umarli nie śpią." };
    html = `${QM.place.has(pl.id) ? `<span style="color:${QUEST_COL}">◆ Cel zadania</span><br>` : ""}<b>${pl.name}</b><br>${d[pl.kind]}${pl.cleared > 0 && pl.kind !== "shrine" ? `<br><span class="muted">Oczyszczone (${pl.cleared} dni)</span>` : ""}`;
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const wrap = document.getElementById("wrap").getBoundingClientRect();
  const sx = (input.mx / W) * wrap.width, sy = (input.my / H) * wrap.height;
  tip.style.left = Math.min(sx + 16, wrap.width - tip.offsetWidth - 8) + "px";
  tip.style.top = Math.min(sy + 12, wrap.height - tip.offsetHeight - 8) + "px";
}

// ---------- Osady ----------
const SET = { id: 0, tab: "main", bet: 0, kit: 0, quest: null as Quest | null, unit: "" };
function enterSettlement(s: Settlement) {
  const w = WORLD, P = w.player;
  playerParty(w).path = [];
  G.view.hover = null; const tipEl = document.getElementById("tip"); if (tipEl) tipEl.hidden = true;
  SET.id = s.id; SET.tab = "main"; SET.quest = null;
  // dostarczenie listu
  for (const q of P.quests) if (!q.done && q.kind === "letter" && q.target === s.id) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => toast(l, PAL.gold)); }
  autosave();
  if (s.kind !== "village") sfx.bell?.();
  renderSettlement();
}
function renderSettlement() {
  const w = WORLD, P = w.player, s = w.settlements[SET.id], p = playerParty(w);
  const hostileS = playerAtWarWith(w, s.faction);
  const mine = s.owner === -2;
  const kindName = s.kind === "town" ? "Miasto" : s.kind === "castle" ? "Zamek" : "Wioska";
  const owner = mine ? "Twoje lenno" : s.owner >= 0 ? `Pan: ${lordById(w, s.owner).title} ${lordById(w, s.owner).name}` : "Własność korony";
  const tabs: [string, string][] = [];
  if (hostileS) {
    if (s.kind === "village") { if (s.raided === 0) tabs.push(["raid", "Grab wioskę"]); }
    else tabs.push(["siege", s.siegeBy.includes(p.id) ? "Oblężenie" : "Oblegaj"]);
  } else {
    if (s.siegeBy.length && s.kind !== "village" && s.siegeBy.some((id) => { const o = partyById(w, id); return o && hostile(w, p, o); })) tabs.push(["defend", "Obrona murów"]);
    tabs.push(["main", s.kind === "village" ? "Wioska" : s.kind === "castle" ? "Dziedziniec" : "Plac"]);
    if (s.kind !== "castle") tabs.push(["recruit", "Rekrutacja"]);
    if (s.kind !== "castle") tabs.push(["market", s.kind === "village" ? "Kup żywność" : "Targ"]);
    if (s.kind === "town") { tabs.push(["smith", "Kowal"]); tabs.push(["tavern", "Karczma"]); tabs.push(["arena", s.tournament ? "Arena · turniej!" : "Arena"]); }
    if (s.kind !== "castle") tabs.push(["quest", s.kind === "village" ? "Sołtys" : "Rada miejska"]);
    if (s.kind === "castle") { tabs.push(["throne", "Sala tronowa"]); tabs.push(["armory", "Zbrojownia"]); tabs.push(["dungeon", "Lochy"]); }
    if (mine && s.kind !== "village") tabs.push(["manage", "Załoga"]);
    if (mine) tabs.push(["rule", "Zarząd"]);
    if (s.kind !== "village") tabs.push(["rest", "Odpocznij"]);
  }
  tabs.push(["leave", "Wyjdź"]);
  if (!tabs.some((t) => t[0] === SET.tab)) SET.tab = tabs[0][0];
  const sceneKind = SET.tab === "tavern" ? "tavern" : SET.tab === "smith" ? "smith" : SET.tab === "arena" ? "arena" : SET.tab === "siege" ? "siege" : s.kind;
  const wealth = s.prosperity < 35 ? 2 : s.prosperity > 72 ? 3 : 0;   // bieda / bogactwo widać na ilustracji
  const scene = drawScene(sceneKind, s.seed, s.culture, isNight(w), s.raided > 0 ? 1 : sceneKind === s.kind ? wealth : 0);
  const pane = settlementPane(s, hostileS);
  const wx2 = w.rain ? "rain" : season(w) === 3 ? "snow" : w.fog ? "fogs" : "";
  const HOT: Record<string, [string, string, number, number][]> = {
    town: [["recruit", "Rekrutacja", 10, 62], ["market", "Targ", 28, 82], ["smith", "Kowal", 42, 50], ["tavern", "Karczma", 61, 50], ["arena", "Arena", 86, 70], ["quest", "Ratusz", 50, 26]],
    castle: [["throne", "Sala tronowa", 50, 28], ["dungeon", "Lochy", 24, 70], ["armory", "Zbrojownia", 76, 70]],
    village: [["quest", "Sołtys", 36, 52], ["market", "Spichlerz", 70, 56], ["recruit", "Ochotnicy", 14, 78]],
  };
  const hots = SET.tab === "main" && !hostileS ? (HOT[s.kind] || []).filter(([k]) => tabs.some((t) => t[0] === k)).map(([k, n, x, y]) => `<button class="hot" data-a="tab" data-v="${k}" style="left:${x}%;top:${y}%">${ic(TAB_ICON[k] || "star")}<span>${n}</span></button>`).join("") : "";
  const stockSum = Object.values(s.stock).reduce((a, b) => a + b, 0);
  showScr(`<div class="settle">
    <div class="scene ${SET.tab === "main" ? "" : "small"} ${wx2}">${pic(scene, "scene-img")}${hots}</div>
    <div class="s-head"><h1>${s.name}</h1><span class="muted">${kindName} · ${factionName(s.faction)} · ${owner}</span>
      <span class="muted">Dobrobyt ${Math.round(s.prosperity)}${s.kind !== "village" ? ` · załoga ${troopCount(s.garrison)}` : ""} · dochód ok. ${fiefIncome(w, s)}/dzień · zapasy ${Math.round(stockSum)} · ochotnicy ${s.recruits} · nastawienie ${s.relation >= 0 ? "+" : ""}${Math.round(s.relation)}${s.raided ? " · <span class='bad'>spustoszona</span>" : ""}</span></div>
    <div class="s-tabs">${tabs.map(([k, n]) => `<button class="tab ${SET.tab === k ? "on" : ""}" data-a="tab" data-v="${k}">${ic(TAB_ICON[k] || "star")}${n}</button>`).join("")}</div>
    <div class="s-pane">${pane.html}</div>
    <div class="s-foot"><span><b class="gold">${P.gold}</b> denarów</span><span>${troopCount(p.troops) + 1 + P.companions.length}/${partyLimit(w)} ludzi</span><span>Jedzenie ${foodTotal(w)}</span></div>
  </div>`, {
    tab: (v) => { if (v === "leave") { closeScreen(); showMapHud(); return; } if (v === "rest") { restInSettlement(s); return; } if (v === "raid") { raidVillage(s); return; } SET.tab = v; if (v === "smith" || v === "armory") sfx.hammer?.(); if (v === "market") sfx.coin(); if (v === "tavern") sfx.drink?.(); renderSettlement(); },
    ...pane.acts,
  }, "settle-scr");
}

const TAB_ICON: Record<string, string> = { throne: "crown", armory: "sword", dungeon: "chain", rule: "scroll", main: "castle", recruit: "man", market: "coin", smith: "hammer", tavern: "mug", arena: "sword", quest: "scroll", manage: "shield", rest: "tent", leave: "wind", siege: "fire", raid: "fire" };
function recruitPool(s: Settlement): string[] {
  const w = WORLD, P = w.player;
  const cul = s.culture;
  if (cul === "undead" && P.race !== "undead" && P.liege !== 5) return [];
  const R = RECRUITS[cul];
  if (!R) return [];
  if (s.kind === "village") { const v = R.village.slice(); if (s.relation >= 20 || (s as any).build?.koszary) v.push(R.town[1] || R.town[0]); return [...new Set(v)]; }   // przychylna wioska daje lepszych
  const list = R.town.slice();
  if (R.special && s.relation >= 5) list.push(R.special);
  return list;
}

function settlementPane(s: Settlement, hostileS: boolean): { html: string; acts: Acts } {
  const w = WORLD, P = w.player, p = playerParty(w);
  const re = () => renderSettlement();
  switch (SET.tab) {
    case "main": {
      const lord = s.owner >= 0 ? lordById(w, s.owner) : null;
      const lordHere = lord && lord.party >= 0 && partyById(w, lord.party) && dist(partyById(w, lord.party).x, partyById(w, lord.party).y, s.cx * WCELL, s.cy * WCELL) < 30;
      const desc = s.kind === "town" ? `Ciasne uliczki, smród garbarni, szubienica na rynku. ${s.prosperity > 60 ? "Kupcy dobrze zarabiają." : "Ludzie chodzą głodni i spoglądają spode łba."}` : s.kind === "castle" ? "Zimne mury, warta przy bramie, wrony na blankach." : `Kilka chałup i pola. ${s.raided ? "Spalone strzechy jeszcze dymią." : "Chłopi patrzą na zbrojnych z obawą."}`;
      const rum = s.kind === "town" ? rumor(s) : "";
      // mieszkańcy z imionami: zagadnij, usłyszysz plotkę albo radę
      const ppl = residents(s);
      const harvest = s.kind === "village" ? (season(w) === 3 ? "zima, pola leżą odłogiem" : s.raided ? "spalone pola" : s.prosperity > 60 ? "dobre zbiory" : s.prosperity > 35 ? "przeciętne zbiory" : "nędzne zbiory") : "";
      return {
        html: `<p>${desc}</p>${rum ? `<p class="tip">Plotka: ${rum}</p>` : ""}
          ${harvest ? `<p class="tip">${ic("food")} ${harvest} · zboże w spichlerzu: ${Math.floor(s.stock.grain || 0)} · podatek dla pana: ok. ${fiefIncome(w, s) * 7}/tydzień</p>` : ""}
          <div class="ppl">${ppl.map((r, i) => `<button class="mini" data-a="chat" data-v="${i}">${ic("man")} ${r.name} <span class="muted">${r.role}</span></button>`).join("")}</div><p class="tip" id="chatline"></p>${lordHere ? `<div class="row"><span>${lord.title} ${lord.name} przebywa na zamku.</span><button class="mini" data-a="talkLord" data-v="${lord.id}">Rozmawiaj</button></div>` : ""}
          ${s.siegeBy.length ? `<p class="bad">Miasto jest oblężone!</p>` : ""}`,
        acts: { talkLord: (v) => showLordTalk(lordById(w, Number(v)), () => renderSettlement()), chat: (v) => { const r = ppl[Number(v)]; const e = document.getElementById("chatline"); if (e) e.textContent = `${r.name}: „${r.line}”`; grunt("human"); } },
      };
    }
    case "throne": {
      const lord = s.owner >= 0 ? lordById(w, s.owner) : null;
      const lordHere = lord && lord.party >= 0 && partyById(w, lord.party) && dist(partyById(w, lord.party).x, partyById(w, lord.party).y, s.cx * WCELL, s.cy * WCELL) < 30;
      return {
        html: `<p>Długa sala, dym z kominka, chorągwie ${factionName(s.faction)} na ścianach.</p>${lordHere ? `<div class="row"><span>${ic("crown")} Na tronie siedzi ${lord.title} ${lord.name}.</span><button class="mini" data-a="talkLord" data-v="${lord.id}">Podejdź</button></div>` : s.owner === -2 ? "<p>To twój tron. Rządca czeka na rozkazy w zakładce Zarząd.</p>" : `<p class="muted">Pana nie ma na zamku. Kasztelan mówi, że ${lord ? `${lord.title} ${lord.name} wyruszył z wojskiem` : "zamek należy do korony"}.</p>`}`,
        acts: { talkLord: (v) => showLordTalk(lordById(w, Number(v)), () => renderSettlement()) },
      };
    }
    case "dungeon": {
      const held = w.lords.filter((l) => l.alive && l.captive === (s.owner === -2 ? PLAYER_FACTION : s.faction));
      return {
        html: `<p>Wilgotne lochy, szczur, łańcuchy.</p>${held.length ? held.map((l) => `<div class="row"><span>${ic("chain")} ${l.title} ${l.name} (${factionShort(l.faction)}) · relacja ${l.relation}</span>${s.owner === -2 ? `<span><button class="mini" data-a="ransom" data-v="${l.id}">Okup ${300 + Math.round(l.renown)}</button><button class="mini" data-a="free" data-v="${l.id}">Uwolnij</button></span>` : `<button class="mini" data-a="bribe" data-v="${l.id}" ${P.gold >= 400 ? "" : "disabled"}>Przekup strażnika i uwolnij (400)</button>`}</div>`).join("") : "<p class='muted'>Lochy stoją puste.</p>"}`,
        acts: {
          ransom: (v) => { const L = lordById(w, Number(v)); P.gold += 300 + Math.round(L.renown); L.captive = -1; rel(L, -5); chron(w, `${L.title} ${L.name} wykupiony z niewoli u ${P.name}.`); sfx.coin(); re(); },
          free: (v) => { const L = lordById(w, Number(v)); L.captive = -1; rel(L, 15); P.honor += 3; chron(w, `${P.name} wypuszcza z niewoli: ${L.title} ${L.name}.`, PAL.moss); re(); },
          bribe: (v) => { const L = lordById(w, Number(v)); if (P.gold < 400) return; P.gold -= 400; L.captive = -1; rel(L, 20); s.relation -= 10; const ow = s.owner >= 0 ? lordById(w, s.owner) : null; if (ow) rel(ow, -10); chron(w, `${L.title} ${L.name} ucieka z lochów ${s.name}. Mówią, że pomógł mu ${P.name}.`, PAL.moss); re(); },
        },
      };
    }
    case "armory": {
      const list = baseItems().filter((it) => it.tier >= 2 && it.tier <= 4 && it.slot !== "horse" && (!it.culture || it.culture === s.culture) && hashInt(s.seed + it.id.length * 13 + Math.floor(w.day / 7)) % 3 === 0);
      return {
        html: `<p>Kasztelan sprzedaje to, co zostało po ostatniej kampanii. Wojskowy sprzęt, drożej niż u kowala.</p><table class="tbl">${list.map((it) => { const pr = Math.round(itemPrice(it, true, P.skills.trade) * 1.15); return `<tr><td>${itemName(it)}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)} ${cmpEquip(it)}</span></td><td>${pr}</td><td><button class="mini" data-a="buyA" data-v="${it.id}" ${P.gold >= pr ? "" : "disabled"}>Kup</button></td></tr>`; }).join("")}</table>`,
        acts: { buyA: (v) => { const it = ITEMS[v], pr = Math.round(itemPrice(it, true, P.skills.trade) * 1.15); if (P.gold < pr) return; P.gold -= pr; P.items.push(v); sfx.coin(); toast(`Kupiono: ${it.name}.`); re(); } },
      };
    }
    case "rule": {
      const S = s as any; const b = S.build || {};
      const avail = Object.entries(BUILDINGS).filter(([, d]) => d.kinds.includes(s.kind));
      const stewards = P.companions;
      return {
        html: `<p>${ic("coin")} Dochód: <b>${fiefIncome(w, s)}</b> denarów dziennie.</p>
          <div class="row"><span>Podatki:</span>${["niskie", "zwykłe", "wysokie"].map((n, i) => `<button class="mini ${(S.tax ?? 1) === i ? "on" : ""}" data-a="tax" data-v="${i}">${n}</button>`).join("")}<span class="muted">wysokie: +35% dochodu, ludzie się burzą</span></div>
          <div class="row"><span>Rządca:</span>${stewards.length ? stewards.map((c) => `<button class="mini ${S.steward === c.id ? "on" : ""}" data-a="stew" data-v="${c.id}">${c.name}</button>`).join("") : "<span class='muted'>brak kompanów</span>"}<span class="muted">+10% dochodu</span></div>
          <h2>Budowle</h2><div class="engines">${avail.map(([k, d]) => `<div class="eng ${b[k] ? "done" : ""}"><b>${d.name}</b><span class="muted">${d.desc}</span>${b[k] ? "<span class='gold'>Zbudowane</span>" : S.buildQ?.k === k ? `<span>W budowie: ${S.buildQ.days} dni</span>` : `<button class="mini" data-a="build" data-v="${k}" ${P.gold >= d.cost && !S.buildQ ? "" : "disabled"}>Buduj (${d.cost}, ${d.days} dni)</button>`}</div>`).join("")}</div>`,
        acts: {
          tax: (v) => { S.tax = Number(v); re(); },
          stew: (v) => { S.steward = S.steward === v ? null : v; re(); },
          build: (v) => { const d = BUILDINGS[v]; if (P.gold < d.cost || S.buildQ) return; P.gold -= d.cost; S.buildQ = { k: v, days: d.days }; sfx.hammer?.(); re(); },
        },
      };
    }
    case "recruit": {
      const pool = recruitPool(s);
      const room = partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length);
      const relMul = s.relation < -10 ? 0 : 1;
      const avail = Math.floor(s.recruits * relMul);
      if (!pool.includes(SET.unit)) SET.unit = pool[0] || "";
      const k = SET.unit, d = k ? UNITS[k] : null;
      const cost = (u: string) => UNITS[u].tier >= 2 ? Math.round(UNITS[u].cost * 1.3) : UNITS[u].cost;
      const ok = !!d && avail > 0 && room > 0 && P.gold >= cost(k);
      return {
        html: `<p>${ic("man")} Ochotnicy: <b>${avail}</b> · miejsce w armii: <b>${Math.max(0, room)}</b>${relMul === 0 ? " · <span class='bad'>Mieszkańcy nie chcą ci służyć.</span>" : ""}</p>
        ${pool.length ? `<div class="pgrid"><div class="ulist">${pool.map((u) => `<button class="urow ${u === k ? "on" : ""}" data-a="pickU" data-v="${u}">${unitThumb(u)}<span class="un"><b>${UNITS[u].name}</b>${tierStars(UNITS[u].tier)}</span><span class="uc">${ic("coin")}${cost(u)}</span></button>`).join("")}</div>
          <div class="udet"><div class="udet-top">${unitAnim(k, 3)}<div><h2>${d.name}</h2>${tierStars(d.tier)}<p class="tip">Koszt ${cost(k)} · żołd ${d.wage}/dzień</p>
            <button data-a="rec" data-v="${k}:1" ${ok ? "" : "disabled"}>Werbuj 1</button> <button class="alt" data-a="rec" data-v="${k}:5" ${ok ? "" : "disabled"}>Werbuj 5</button></div></div>
            ${unitStats(k)}<h2>Dokąd może awansować</h2>${unitTreeHtml(k)}</div></div>` : "<p class='muted'>Nikt tu nie chce iść z tobą.</p>"}`,
        acts: {
          pickU: (v) => { SET.unit = v; re(); },
          rec: (v) => { const [u, ns] = v.split(":"); const c = cost(u); const n = Math.min(Number(ns), avail, partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length), Math.floor(P.gold / c)); if (n <= 0) return; P.gold -= n * c; s.recruits -= n; addTroops(p.troops, u, n); sfx.coin(); re(); },
        },
      };
    }
    case "market": {
      const keys = s.kind === "village" ? FOOD_KEYS : GOOD_KEYS;
      // pamięć cen: zapisujemy, co widziałeś na tym targu
      const memo = ((P as any).priceMemo ||= {}) as Record<number, { day: number; sell: Record<string, number> }>;
      memo[s.id] = { day: w.day, sell: Object.fromEntries(keys.map((k) => [k, sellPrice(w, s, k)])) };
      const best = (k: string) => { let bp = 0, bs = -1, bd = 0; for (const [sid, m] of Object.entries(memo)) { const v = m.sell[k] || 0; if (Number(sid) !== s.id && v > bp) { bp = v; bs = Number(sid); bd = m.day; } } return bs >= 0 ? `<span class="muted" title="ostatnio widziane">${bp} w ${w.settlements[bs].name} (${w.day - bd} d.)</span>` : `<span class="muted">—</span>`; };
      const starving = (k: string) => k === "grain" && P.quests.some((q) => !q.done && q.kind === "grain" && q.giver === s.id);
      const row = (k: string, side: "buy" | "sell") => side === "buy"
        ? `<div class="mrow" draggable="true" data-drag="buy:${k}">${ic(GOODS[k].food ? "food" : "coin")}<span class="mn">${GOODS[k].name}</span><span class="muted">${Math.floor(s.stock[k])}</span><b>${starving(k) ? "—" : buyPrice(w, s, k)}</b><button class="mini" data-a="buy" data-v="${k}:1" ${starving(k) ? "disabled" : ""}>Kup</button><button class="mini" data-a="buy" data-v="${k}:5" ${starving(k) ? "disabled" : ""}>×5</button></div>`
        : `<div class="mrow" draggable="true" data-drag="sell:${k}">${ic(GOODS[k].food ? "food" : "coin")}<span class="mn">${GOODS[k].name}</span><span class="muted">${P.goods[k] || 0}</span><b>${sellPrice(w, s, k)}</b>${best(k)}<button class="mini" data-a="sell" data-v="${k}:1">Sprzedaj</button><button class="mini" data-a="sell" data-v="${k}:all">Wszystko</button></div>`;
      const mine = keys.filter((k) => (P.goods[k] || 0) > 0);
      const cars = ((P as any).caravans || []) as { from: number; to: number; gold: number; back: number }[];
      const canCar = s.kind === "town" && P.skills.trade >= 0;
      return {
        html: `<div class="market"><div class="mcol" data-drop="sell"><h2>${ic("coin")} Kupiec ${residents(s)[0].name}</h2>${keys.map((k) => row(k, "buy")).join("")}</div>
          <div class="mcol" data-drop="buy"><h2>${ic("food")} Twoje juki</h2>${mine.length ? mine.map((k) => row(k, "sell")).join("") : "<p class='muted'>Pusto. Przeciągnij towar tutaj, żeby kupić.</p>"}<p class="tip">Przeciągnij wiersz między kolumnami albo użyj przycisków. Obok ceny: najlepsza znana cena sprzedaży w innym mieście.</p></div></div>
          ${canCar ? `<h2>${ic("tent")} Karawany</h2><p class="tip">Wyślij wóz z towarem do odległego miasta. Wróci za ok. tydzień z zyskiem (handel ${P.skills.trade}), chyba że napadną go zbóje.</p><div class="row">${[400, 800, 1500].map((g) => `<button class="mini" data-a="car" data-v="${g}" ${P.gold >= g && cars.length < 3 ? "" : "disabled"}>Wyślij za ${g}</button>`).join("")}<span class="muted">w drodze: ${cars.length}/3</span></div>` : ""}`,
        acts: {
          buy: (v) => { const [k, ns] = v.split(":"); if (starving(k)) { toast("Głodują: zboża nie sprzedadzą. Przywieź je z innego miejsca.", PAL.redL); return; } let n = Number(ns); for (let i = 0; i < n; i++) { const pr = buyPrice(w, s, k); if (P.gold < pr || s.stock[k] < 1) break; P.gold -= pr; s.stock[k]--; P.goods[k] = (P.goods[k] || 0) + 1; } sfx.coin(); re(); },
          sell: (v) => { const [k, ns] = v.split(":"); let n = ns === "all" ? P.goods[k] || 0 : Number(ns); for (let i = 0; i < n && (P.goods[k] || 0) > 0; i++) { P.gold += sellPrice(w, s, k); s.stock[k]++; P.goods[k]--; } sfx.coin(); re(); },
          car: (v) => { const g = Number(v); if (P.gold < g) return; const to = pick(w.settlements.filter((x) => x.kind === "town" && x.id !== s.id && !playerAtWarWith(w, x.faction))); if (!to) return; P.gold -= g; ((P as any).caravans ||= []).push({ from: s.id, to: to.id, gold: g, back: w.day + 6 + Math.round(dist(s.cx, s.cy, to.cx, to.cy) / 25) }); toast(`Karawana rusza do ${to.name}.`, PAL.gold); re(); },
        },
      };
    }
    case "smith": {
      const forSale = smithItems(s);
      const smithName = residents(s)[1].name;
      const orders = (((P as any).orders || []) as { sid: number; id: string; day: number }[]);
      const ready = orders.filter((o) => o.sid === s.id && o.day <= w.day), pending = orders.filter((o) => o.sid === s.id && o.day > w.day);
      const owned = [...P.items.map((id, i) => ({ id, i, eq: false })), ...Object.entries(P.equip).filter(([, id]) => id).map(([sl, id]) => ({ id: id as string, i: -1, eq: true, sl }))];
      const upCost = (id: string) => { const it = ITEMS[baseOf(id)]; return Math.round(it.price * (qualOf(id) === 0 ? 0.35 : 0.7)); };
      return {
        html: `<p>Mistrz ${smithName} ociera pot z czoła. „Kupujesz, naprawiasz, czy zamawiasz coś porządnego?”</p>
          <div class="cols"><div><h2>Na sprzedaż</h2><table class="tbl">${forSale.map((id) => { const it = ITEMS[id]; const pr = itemPrice(it, true, P.skills.trade); return `<tr><td>${itemName(it)}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)}</span> ${cmpEquip(it)}</td><td>${pr}</td><td><button class="mini" data-a="buyI" data-v="${id}" ${P.gold >= pr ? "" : "disabled"}>Kup</button><button class="mini" data-a="order" data-v="${id}" ${P.gold >= it.price * 3 ? "" : "disabled"} title="mistrzowska robota, 5 dni">Zamów ★ ${it.price * 3}</button></td></tr>`; }).join("")}
          <tr><td>Opatrunki ×1<br><span class="muted">leczą w bitwie (klawisz 4)</span></td><td>30</td><td><button class="mini" data-a="band" ${P.gold >= 30 ? "" : "disabled"}>Kup</button></td></tr>
          ${P.equip.bow ? `<tr><td>Kołczan strzał<br><span class="muted">uzupełnia do 40</span></td><td>25</td><td><button class="mini" data-a="ammo" ${P.gold >= 25 ? "" : "disabled"}>Kup</button></td></tr>` : ""}</table>
          ${s.prosperity > 70 ? `<h2>${ic("star")} Arcydzieło na zamówienie</h2><p class="tip">Za 10 sztab żelaza i sporo złota ${smithName} wykuje coś, o czym śpiewają bardowie (12 dni).</p>${UNIQUES.filter((u) => !P.items.includes(u) && !Object.values(P.equip).includes(u)).slice(0, 2).map((u) => `<div class="row"><span>${itemName(ITEMS[u])} · ${itemStat(ITEMS[u])}</span><button class="mini" data-a="epic" data-v="${u}" ${P.gold >= ITEMS[u].price && (P.goods.iron || 0) >= 10 ? "" : "disabled"}>${ITEMS[u].price} + 10 żelaza</button></div>`).join("")}` : ""}
          ${ready.length || pending.length ? `<h2>Twoje zamówienia</h2>${ready.map((o) => `<div class="row"><span class="gold">Gotowe: ${ITEMS[o.id]?.name}</span><button class="mini" data-a="collect" data-v="${o.id}">Odbierz</button></div>`).join("")}${pending.map((o) => `<p class="muted">${ITEMS[o.id]?.name}: za ${o.day - w.day} dni</p>`).join("")}` : ""}</div>
          <div><h2>Twój dobytek</h2>${owned.length ? `<table class="tbl">${owned.map((o) => { const it = ITEMS[o.id]; if (!it) return ""; const q = qualOf(o.id), canUp = q < 2 && it.tier < 5; return `<tr><td>${itemName(it)}${o.eq ? " <span class='muted'>(na tobie)</span>" : ""}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)}</span></td><td>${canUp ? `<button class="mini" data-a="up" data-v="${o.eq ? "e:" + (o as any).sl : "i:" + o.i}" ${P.gold >= upCost(o.id) ? "" : "disabled"}>${q === 0 ? "Napraw" : "Ulepsz"} (${upCost(o.id)})</button>` : ""}${o.eq ? "" : `<button class="mini" data-a="sellI" data-v="${o.i}">Sprzedaj ${itemPrice(it, false, P.skills.trade)}</button><button class="mini" data-a="smelt" data-v="${o.i}" title="przetop na żelazo">Przetop</button>`}</td></tr>`; }).join("")}</table>` : "<p class='muted'>Nic w jukach.</p>"}<p class="tip">Zardzewiałe łupy sprzedasz taniej. Naprawa zrobi z nich zwykły sprzęt, ulepszenie: dobry. Mistrzowski tylko na zamówienie.</p></div></div>`,
        acts: {
          buyI: (v) => { const it = ITEMS[v]; const pr = itemPrice(it, true, P.skills.trade); if (P.gold < pr) return; P.gold -= pr; P.items.push(v); sfx.coin(); toast(`Kupiono: ${it.name}. Załóż w oknie Ekwipunek (I).`); re(); },
          sellI: (v) => { const i = Number(v), it = ITEMS[P.items[i]]; P.gold += itemPrice(it, false, P.skills.trade); P.items.splice(i, 1); sfx.coin(); re(); },
          smelt: (v) => { const i = Number(v), it = ITEMS[P.items[i]]; const n = Math.max(1, it.tier); P.items.splice(i, 1); P.goods.iron = (P.goods.iron || 0) + n; sfx.hammer(); toast(`Przetopione: +${n} żelaza.`); re(); },
          up: (v) => { const [kind, k] = v.split(":"); const id = kind === "e" ? P.equip[k as ESlot] : P.items[Number(k)]; const c = upCost(id); if (P.gold < c) return; const nid = qid(baseOf(id), qualOf(id) + 1); ensureItem(nid); P.gold -= c; if (kind === "e") P.equip[k as ESlot] = nid; else P.items[Number(k)] = nid; sfx.hammer(); toast(`${smithName}: gotowe. ${ITEMS[nid].name}.`, PAL.gold); re(); },
          order: (v) => { const it = ITEMS[v]; if (P.gold < it.price * 3) return; P.gold -= it.price * 3; const nid = qid(v, 3); ensureItem(nid); ((P as any).orders ||= []).push({ sid: s.id, id: nid, day: w.day + 5 }); sfx.hammer(); toast(`Zamówiono: ${ITEMS[nid].name}. Odbiór za 5 dni.`, PAL.gold); re(); },
          epic: (v) => { const it = ITEMS[v]; if (P.gold < it.price || (P.goods.iron || 0) < 10) return; P.gold -= it.price; P.goods.iron -= 10; ((P as any).orders ||= []).push({ sid: s.id, id: v, day: w.day + 12 }); chron(w, `${P.name} zamawia u mistrza ${smithName} w ${s.name}: ${it.name}.`, PAL.gold); re(); },
          collect: (v) => { const o = orders.find((x) => x.id === v && x.sid === s.id && x.day <= w.day); if (!o) return; (P as any).orders = orders.filter((x) => x !== o); ensureItem(v); P.items.push(v); sfx.coin(); toast(`Odbierasz: ${ITEMS[v].name}!`, PAL.gold); re(); },
          band: () => { P.gold -= 30; P.bandages++; sfx.coin(); re(); },
          ammo: () => { P.gold -= 25; P.ammo = 40; sfx.coin(); re(); },
        },
      };
    }
    case "tavern": {
      const mercN = Math.max(0, hashInt(s.seed + Math.floor(w.day / 4)) % 6 + 2 - ((w.player as any)["merc" + s.id + "_" + Math.floor(w.day / 4)] || 0));
      const mercType = hashInt(s.seed + Math.floor(w.day / 4)) % 2 ? "m_sword" : "m_xbow";
      const comps = s.companions.filter((id) => !P.companions.some((c) => c.id === id));
      const captiveLords = w.lords.filter((l) => l.captive === PLAYER_FACTION && l.alive);
      const room = partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length);
      const prisonerValue = (t: Troop) => Math.round(18 * Math.pow(UNITS[t.type].tier, 1.6));
      // kompania najemna: cały oddział do wynajęcia, raz na tydzień w mieście
      const wk = Math.floor(w.day / 7), ch = hashInt(s.seed * 3 + wk);
      const company = ch % 3 !== 0 && !(P as any)["comp" + s.id + "_" + wk] ? (() => { const nm = ["Czarne Wilki", "Kompania Szarej Róży", "Synowie Burzy", "Żelazna Kompania", "Kruki z Brodów"][ch % 5]; const tr: Troop[] = [{ type: "m_sword", n: 5 + (ch % 4), wounded: 0, xp: 0 }, { type: "m_xbow", n: 3 + (ch >>> 3) % 3, wounded: 0, xp: 0 }]; const elite = pick(["a_maa", "v_veteran", "d_ironguard", "o_blackfang"].filter((k) => UNITS[k])); tr.push({ type: elite, n: 2, wounded: 0, xp: 0 }); const price = Math.round(tr.reduce((a, t) => a + UNITS[t.type].cost * t.n, 0) * 1.1); return { name: nm, troops: tr, price }; })() : null;
      return {
        html: `<div class="cols"><div>
          <h2>Najemnicy</h2>${mercN > 0 ? `<div class="row"><span>${mercN}× ${UNITS[mercType].name} · ${Math.round(UNITS[mercType].cost * 1.2)} za głowę</span><button class="mini" data-a="merc" data-v="${mercN}:${mercType}" ${room > 0 && P.gold >= UNITS[mercType].cost * 1.2 ? "" : "disabled"}>Najmij</button></div>` : "<p class='muted'>Dziś nikt nie szuka roboty.</p>"}
          <h2>Kompani</h2>${comps.length ? comps.map((id) => { const c = COMPANIONS.find((x) => x.id === id); const cs = makeCompanion(id); return `<div class="comp">${pic(drawPortrait(cs.look, PAL.bone), "portrait")}<div><b>${c.name}</b> <span class="muted">${c.role}</span><br><span class="tip">${c.bio}</span><br><button class="mini" data-a="hire" data-v="${id}" ${P.companions.length < companionMax(P) ? "" : "disabled"}>Porozmawiaj · ${c.cost}, żołd ${c.wage}</button></div></div>`; }).join("") : "<p class='muted'>Nikogo ciekawego.</p>"}
          ${P.companions.length >= companionMax(P) ? "<p class='tip'>Więcej kompanów nie utrzymasz (limit rośnie z charyzmą).</p>" : ""}
        </div><div>
          ${company ? `<h2>${ic("banner")} Kompania najemna</h2><div class="row"><span><b>${company.name}</b>: ${company.troops.map((t) => `${t.n}× ${UNITS[t.type].name}`).join(", ")}</span><button class="mini" data-a="comp" ${P.gold >= company.price && room >= troopCount(company.troops) ? "" : "disabled"}>Najmij całą (${company.price})</button></div>` : ""}
          <h2>Plotki</h2><p class="tip">${rumor(s)}</p><p class="tip">${rumor(s, 7)}</p>
          <h2>${ic("mug")} Rozrywki</h2><div class="row"><span>Kości z bywalcami:</span>${[10, 50, 150].map((b) => `<button class="mini" data-a="dice" data-v="${b}" ${P.gold >= b ? "" : "disabled"}>o ${b}</button>`).join("")}</div>
          <div class="row"><span>Bard przy kominku</span><button class="mini" data-a="bard" ${P.gold >= 5 ? "" : "disabled"}>Posłuchaj (5)</button></div><p class="tip" id="bardline"></p>
          <button class="mini" data-a="drink" ${P.gold >= 40 ? "" : "disabled"}>Postaw kolejkę ludziom (40)</button>
          <h2>Handlarz okupem</h2>${p.prisoners.length ? `<table class="tbl">${p.prisoners.map((t, i) => `<tr><td>${t.n}× ${UNITS[t.type].name}</td><td>${prisonerValue(t)}/szt.</td><td><button class="mini" data-a="sellP" data-v="${i}">Sprzedaj</button></td></tr>`).join("")}</table>` : "<p class='muted'>Nie masz jeńców.</p>"}
          ${captiveLords.length ? `<h2>Pojmani lordowie</h2>${captiveLords.map((l) => `<div class="row"><span>${l.title} ${l.name} (${factionShort(l.faction)})</span><span><button class="mini" data-a="ransom" data-v="${l.id}">Okup ${300 + Math.round(l.renown)}</button><button class="mini" data-a="free" data-v="${l.id}">Uwolnij</button></span></div>`).join("")}` : ""}
        </div></div>`,
        acts: {
          merc: (v) => { const [ns, t] = v.split(":"); const pr = Math.round(UNITS[t].cost * 1.2); const n = Math.min(Number(ns), Math.floor(P.gold / pr), room); if (n <= 0) return; P.gold -= n * pr; addTroops(p.troops, t, n); (w.player as any)["merc" + s.id + "_" + Math.floor(w.day / 4)] = ((w.player as any)["merc" + s.id + "_" + Math.floor(w.day / 4)] || 0) + n; sfx.coin(); re(); },
          hire: (v) => hireTalk(s, v),
          hireNow: (v) => { const c = COMPANIONS.find((x) => x.id === v); if (P.gold < c.cost || P.companions.length >= companionMax(P)) return; P.gold -= c.cost; P.companions.push(makeCompanion(v)); s.companions = s.companions.filter((x) => x !== v); toast(`${c.name} dołącza do ciebie.`, PAL.gold); chron(w, `${c.name} przyłącza się do ${P.name}.`); re(); },
          comp: () => { if (!company || P.gold < company.price) return; P.gold -= company.price; for (const t of company.troops) addTroops(p.troops, t.type, t.n); (P as any)["comp" + s.id + "_" + wk] = 1; toast(`${company.name} staje pod twoim sztandarem.`, PAL.gold); chron(w, `${P.name} najmuje kompanię „${company.name}”.`); sfx.coin(); re(); },
          dice: (v) => showDice(s, Number(v)),
          bard: () => { P.gold -= 5; const mine = w.chronicle.filter((c) => c.text.includes(P.name)).slice(-3); const e = document.getElementById("bardline"); const song = mine.length ? `Bard śpiewa: „…a ${P.name} ${pick(mine).text.replace(P.name, "").replace(/^\s*/, "").toLowerCase()}…” Ludzie stukają kuflami.` : P.renown > 100 ? `Bard śpiewa o ${P.name}, choć myli fakty. Ludzie słuchają.` : "Bard śpiewa o dawnych królach. O tobie jeszcze nikt nie śpiewa."; if (e) e.textContent = song; if (mine.length && !(P as any)["bard" + s.id + "_" + wk]) { (P as any)["bard" + s.id + "_" + wk] = 1; P.renown += 2; s.relation += 1; } },
          drink: () => { P.gold -= 40; P.morale = Math.min(100, P.morale + 8); s.relation += 1; sfx.coin(); toast("Ludzie piją za twoje zdrowie. Morale rośnie."); re(); },
          sellP: (v) => { const t = p.prisoners[Number(v)]; P.gold += prisonerValue(t) * t.n; p.prisoners.splice(Number(v), 1); sfx.coin(); re(); },
          ransom: (v) => { const L = lordById(w, Number(v)); P.gold += 300 + Math.round(L.renown); L.captive = -1; L.relation -= 5; chron(w, `${L.title} ${L.name} wykupiony z niewoli u ${P.name}.`); sfx.coin(); re(); },
          free: (v) => { const L = lordById(w, Number(v)); L.captive = -1; L.relation += 15; P.honor += 3; chron(w, `${P.name} wypuszcza z niewoli: ${L.title} ${L.name}. Szlachetny gest.`, PAL.moss); re(); },
        },
      };
    }
    case "arena": {
      const tour = s.tournament > 0, night = isNight(w);
      const wins = (s as any).arenaWins || 0, champ = (s as any).champion === "player";
      // każde wyzwanie raz na kilka dni (bez farmienia złota), najwyżej 3 walki dziennie w jednym mieście
      const cd = ((s as any).arenaCd ||= {}) as Record<string, number>, today = ((s as any).arenaDay === w.day ? (s as any).arenaToday : 0) || 0;
      const card = (mode: string, title: string, desc: string, prize: string, pic2: string, fee = 0) => { const left = (cd[mode] || 0) - w.day; const ok = left <= 0 && today < 3 && P.gold >= fee; return `<div class="acard ${left > 0 ? "cool" : ""}"><div class="apic">${pic2}</div><b>${title}</b><span class="muted">${desc}</span><span class="gold">${prize}</span><button class="mini" data-a="pick" data-v="${mode}:${fee}" ${ok ? "" : "disabled"}>${left > 0 ? `Znów za ${left} d.` : today >= 3 ? "Dość na dziś" : fee ? `Wpisowe ${fee}` : "Walcz"}</button></div>`; };
      const kitRow = `<div class="row"><span>Zestaw:</span>${ARENA_KITS.map((k, i) => `<button class="mini ${SET.kit === i ? "on" : ""}" data-a="kit" data-v="${i}">${k.name}</button>`).join("")}</div>`;
      return {
        html: `<p>Piasek areny, krzyk tłumu. Walczy się do nokautu.${wins ? ` Twoje zwycięstwa tutaj: <b>${wins}</b>.` : ""}${champ ? ` <span class="gold">${ic("crown")} Mistrz areny ${s.name}</span>` : ` <span class="muted">(10 zwycięstw: tytuł mistrza areny)</span>`}</p>
          ${kitRow}
          <div class="row"><span>Zakład na siebie: <input type="number" min="0" max="${P.gold}" step="10" value="${SET.bet}" data-in="bet" class="num"></span><span class="muted">wygrana zwraca podwójnie</span></div>
          <div class="acards">
          ${card("duel", "Pojedynek", "jeden przeciwnik", "40 den.", unitThumb("a_maa"))}
          ${card("team3", "3 na 3", "ty i dwóch zawodników", "70 den.", unitThumb("m_sword") + unitThumb("m_sword"))}
          ${card("team5", "5 na 5", "przepychanka drużyn", "110 den.", unitThumb("v_legion") + unitThumb("o_warrior"))}
          ${card("waves", "Fale", "coraz silniejsi, bonus za serię bez ran", "160 den.", unitThumb("o_berserk"))}
          ${card("beasts", "Bestie", "wilki i wilk olbrzym", "130 den.", unitThumb("x_wolf") + unitThumb("x_direwolf"))}
          ${card("archery", "Łucznictwo", "12 strzał, 8 tarcz, kto więcej", "60 den.", unitThumb("x_dummy"))}
          ${card("joust", "Kopie", "3 przejazdy, punkty za trafienie", "90 den.", unitThumb("a_knight"))}
          ${night ? card("death", "Zaułek za areną", "nocą, prawdziwa broń, przeciwnik ginie", "300 den.", unitThumb("b_chief"), 60) : ""}
          </div>
          ${tour ? `<h2>${ic("banner")} Turniej (${s.tournament} dni)</h2><p>Drabinka 16 zawodników, wśród nich lordowie. Rundy: pieszo, łucznictwo, kopie i finał pieszo. Zwycięzca: 800 denarów, sława i +1 punkt drzewka.</p>
            <button class="mini" data-a="tour">Wejdź do turnieju</button>` : "<p class='muted'>Turniej obecnie się nie odbywa. Ogłoszenia pojawiają się na mapie.</p>"}`,
        acts: {
          bet: (v) => { SET.bet = clamp(Math.round(Number(v) || 0), 0, P.gold); },
          kit: (v) => { SET.kit = Number(v); re(); },
          pick: (v) => { const [mode, fee] = v.split(":"); const sw = s as any; if (sw.arenaDay !== w.day) { sw.arenaDay = w.day; sw.arenaToday = 0; } sw.arenaToday++; sw.arenaCd[mode] = w.day + (mode === "death" ? 5 : 3); const bet = clamp(SET.bet, 0, P.gold - (Number(fee) || 0)); P.gold -= (Number(fee) || 0) + bet; arenaFight(s, mode, false, 0, bet); },
          tour: () => { startTourney(s, 0); },
        },
      };
    }
    case "quest": {
      const q = SET.quest || (SET.quest = offerQuest(s));
      const active = P.quests.filter((x) => !x.done && x.giver === s.id);
      const grainQ = active.find((x) => x.kind === "grain"), cattleQ = active.find((x) => x.kind === "cattle"), milQ = active.find((x) => x.kind === "militia");
      const healthy = p.troops.reduce((a, t) => a + t.n - t.wounded, 0);
      return {
        html: `${active.length ? `<h2>Twoje zadania tutaj</h2>${active.map((x) => `<p>${x.text} <span class="muted">(${x.days} dni)</span></p>`).join("")}` : ""}
          ${grainQ ? `<div class="row"><span>Masz ${P.goods.grain || 0} zboża.</span><button class="mini" data-a="giveGrain" ${(P.goods.grain || 0) >= grainQ.amount ? "" : "disabled"}>Oddaj ${grainQ.amount} zboża</button></div>` : ""}
          ${cattleQ ? `<div class="row"><span>Masz ${P.goods.meat || 0} bydła (mięsa).</span><button class="mini" data-a="giveMeat" ${(P.goods.meat || 0) >= cattleQ.amount ? "" : "disabled"}>Oddaj ${cattleQ.amount}</button></div>` : ""}
          ${milQ ? `<div class="row"><span>Zdrowi żołnierze: ${healthy}/8.</span><button class="mini" data-a="train" ${healthy >= 8 ? "" : "disabled"}>Szkolcie chłopów (2 dni)</button></div>` : ""}
          ${active.length ? `<div class="row"><button class="mini danger" data-a="abandon" data-v="${active[0].id}">Porzuć zadanie (nastawienie −10)</button></div>` : ""}
          ${q && !active.length ? `<h2>Prośba</h2><p>${q.text}</p><p class="tip">Nagroda: ${q.reward} denarów · czas: ${q.days} dni</p><button class="mini" data-a="take">Przyjmij zadanie</button>` : !active.length ? "<p class='muted'>Nie mają dla ciebie roboty.</p>" : ""}`,
        acts: {
          take: () => { P.quests.push(q); SET.quest = null; toast("Nowe zadanie: " + q.text, PAL.gold); re(); },
          giveMeat: () => { P.goods.meat -= cattleQ.amount; const lines: string[] = []; completeQuest(cattleQ, lines); lines.forEach((l) => toast(l, PAL.gold)); re(); },
          train: () => { closeScreen(); G.waitHours = 48; G.camping = true; p.state = "camp"; pendingAfterWait = () => { const lines: string[] = []; s.garrison = s.garrison || []; addTroops(s.garrison, RECRUITS[s.culture]?.village[0] || "a_recruit", 6); for (const t of p.troops) t.xp += 20 * t.n; completeQuest(milQ, lines); lines.push("Chłopi umieją już trzymać włócznię. Twoi ludzie też się czegoś nauczyli."); lines.forEach((l) => toast(l, PAL.gold)); enterSettlement(s); }; },
          abandon: (v) => { const q2 = P.quests.find((x) => x.id === Number(v)); if (!q2) return; q2.done = true; q2.failed = true; s.relation -= 10; toast("Porzucasz zadanie. Ludzie są rozczarowani.", PAL.redL); re(); },
          giveGrain: () => { P.goods.grain -= grainQ.amount; s.stock.grain += grainQ.amount; const lines: string[] = []; completeQuest(grainQ, lines); lines.forEach((l) => toast(l, PAL.gold)); re(); },
        },
      };
    }
    case "manage": {
      return {
        html: `<div class="cols"><div><h2>Twoja armia</h2>${troopTable(p.troops, "toG")}</div><div><h2>Załoga</h2>${troopTable(s.garrison, "fromG")}</div></div><p class="tip">Załoga broni murów, gdy cię nie ma. Nie płacisz za nią żołdu z sakwy, utrzymuje ją lenno.</p>`,
        acts: {
          toG: (v) => { const [k, n] = v.split(":"); const t = p.troops.find((x) => x.type === k); const m = Math.min(n === "all" ? t.n - t.wounded : 1, t.n - t.wounded); if (m > 0) { removeTroops(p.troops, k, m); addTroops(s.garrison, k, m); } re(); },
          fromG: (v) => { const [k, n] = v.split(":"); const t = s.garrison.find((x) => x.type === k); const room = partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length); const m = Math.min(n === "all" ? t.n : 1, t.n, Math.max(0, room)); if (m > 0) { removeTroops(s.garrison, k, m); addTroops(p.troops, k, m); } re(); },
        },
      };
    }
    case "defend": {
      const bes = s.siegeBy.map((id) => partyById(w, id)).filter((o) => o && hostile(w, p, o));
      const n = bes.reduce((a, o) => a + troopCount(o.troops), 0);
      return {
        html: `<p class="bad">${s.name} jest oblężone od ${s.siegeDays} dni przez: ${bes.map((o) => o.name).join(", ")} (${n} ludzi).</p>
          <p>Możesz stanąć na murach razem z załogą (${troopCount(s.garrison)} ludzi). Obrońcy mają przewagę blanków, kamieni, balisty i wrzącego oleju.</p>
          <p class="${s.siegeDays > siegeStores(s) ? "bad" : "muted"}">${ic("food")} Zapasy: ${s.siegeDays > siegeStores(s) ? "skończyły się, załoga głoduje" : `na ok. ${siegeStores(s) - s.siegeDays} dni`}</p>
          <div class="btns"><button data-a="defendNow">Broń murów!</button>${isNight(w) ? `<button class="alt" data-a="sally">Nocny wypad na obóz wroga</button>` : `<button class="alt" disabled title="Tylko nocą">Nocny wypad (nocą)</button>`}</div>`,
        acts: {
          defendNow: () => launchBattle({ kind: "siege", defend: true, enemies: bes, allies: [], garrisonAlly: s.garrison, settlement: s, title: `Obrona: ${s.name}` }, { siegeDefender: 0, engines: { ram: chance(0.7), tower: chance(0.4) } }),
          sally: () => { const half = s.garrison.map((t) => ({ ...t, n: Math.ceil(t.n / 2) })); launchBattle({ kind: "field", enemies: bes, allies: [], garrisonAlly: half, settlement: s, title: `Wypad z ${s.name}`, sally: true } as any, { sally: true, night: true, terrain: "plains" }); },
        },
      };
    }
    case "siege": {
      const inSiege = s.siegeBy.includes(p.id);
      const def = troopCount(s.garrison);
      const lordsInside = w.parties.filter((o) => o.kind === "lord" && o.faction === s.faction && dist(o.x, o.y, s.cx * WCELL, s.cy * WCELL) < 20);
      return {
        html: `<p>${s.name} broni ${def} ludzi załogi${lordsInside.length ? ` i armie: ${lordsInside.map((l) => l.name).join(", ")}` : ""}.</p>
          ${inSiege ? `<p>Oblężenie trwa ${s.siegeDays} dni. ${s.siegeDays >= 1 ? "Drabiny gotowe, trzeba je donieść pod mur w bitwie." : "Ludzie zbijają drabiny (1 dzień)."} <span class="${s.siegeDays > siegeStores(s) ? "gold" : "muted"}">${s.siegeDays > siegeStores(s) ? "Obrońcy głodują." : `Zapasy obrońców: ok. ${siegeStores(s) - s.siegeDays} dni.`}</span></p>
            ${hasEngineer() ? `<p class="tip">${ic("hammer")} Inżynier w drużynie: możesz budować wieżę i trebusz. W bitwie T: strzał z trebusza w miejsce kursora.</p>` : `<p class="tip">${ic("hammer")} Bez inżyniera (kompan) zbudujesz tylko taran. Szukaj krasnoludzkiego sapera w karczmach.</p>`}
            <h2>Machiny oblężnicze</h2><div class="engines">${ENGINES.map((e) => { const st = SW().q[e.k]; const done = st >= e.days; const queued = SW().on[e.k]; return `<div class="eng ${done ? "done" : ""}"><b>${e.name}</b><span class="muted">${e.desc}</span><span>${done ? "<span class='gold'>Gotowe</span>" : `${st}/${e.days} dni`}</span>${done ? "" : e.k !== "ram" && !hasEngineer() ? `<button class="mini" disabled>Potrzebny inżynier</button>` : `<button class="mini ${queued ? "on" : ""}" data-a="eng" data-v="${e.k}">${queued ? "W budowie" : "Buduj"}</button>`}</div>`; }).join("")}</div>
            <p class="tip">Każdy dzień oczekiwania posuwa budowę zaznaczonych machin. Bez taranu brama ledwo drgnie.</p>
            <div class="btns"><button data-a="assault" ${s.siegeDays >= 1 ? "" : "disabled"}>Szturm!</button><button class="alt" data-a="waitDay">Czekaj dzień</button><button class="alt" data-a="lift">Odstąp</button></div>`
            : `<p>Oblężenie zablokuje dostawy i da czas na zbicie drabin. Obrońcy mają przewagę murów.</p><div class="btns"><button data-a="besiege">Rozpocznij oblężenie</button></div>`}
          <p class="tip">Twoja siła: ${Math.round(partyPower(w, p))} · obrońcy: ${Math.round(troopPower(s.garrison) * 1.6 + lordsInside.reduce((a, l) => a + partyPower(w, l), 0))} (z murami)</p>`,
        acts: {
          besiege: () => { s.siegeBy.push(p.id); p.siege = s.id; if (s.siegeBy.length === 1) s.siegeDays = 0; chron(w, `${P.name} oblega ${s.name}.`, PAL.redL); re(); },
          eng: (k) => { SW().on[k] = !SW().on[k]; re(); },
          waitDay: () => { closeScreen(); G.waitHours = 24; G.camping = true; p.state = "camp"; pendingAfterWait = () => { s.siegeDays = Math.max(s.siegeDays, 1); for (const e of ENGINES) if (SW().on[e.k] && SW().q[e.k] < e.days) { SW().q[e.k]++; if (SW().q[e.k] >= e.days) toast(`${e.name}: gotowe.`, PAL.gold); } enterSettlement(s); SET.tab = "siege"; renderSettlement(); }; },
          lift: () => { s.siegeBy = s.siegeBy.filter((id) => id !== p.id); p.siege = undefined; (P as any).siegeWork = null; closeScreen(); },
          assault: () => {
            const enemies = lordsInside;
            const q = SW().q;
            launchBattle({ kind: "siege", enemies, allies: nearbyAlliesOf(s), settlement: s, enemyTroops: s.garrison, title: `Szturm na ${s.name}` }, { engines: { ram: q.ram >= 1, tower: q.tower >= 2, trebuchet: q.treb >= 2 } });
          },
        },
      };
    }
  }
  return { html: "", acts: {} };
}
function hasEngineer() { return WORLD.player.companions.some((c) => c.role === "inżynier"); }
const ENGINES = [
  { k: "ram", name: "Taran", days: 1, desc: "Pchany pod bramę, rozbija ją w kilka uderzeń." },
  { k: "tower", name: "Wieża oblężnicza", days: 2, desc: "Podjeżdża pod mur i opuszcza pomost." },
  { k: "treb", name: "Trebusz", days: 2, desc: "Głazy rozbijają obrońców na murach i bramę." },
];
// Postęp budowy machin dla bieżącego oblężenia gracza.
function SW(): { sid: number; q: Record<string, number>; on: Record<string, boolean> } {
  const P = WORLD.player as any, sid = SET.id;
  if (!P.siegeWork || P.siegeWork.sid !== sid) P.siegeWork = { sid, q: { ram: 0, tower: 0, treb: 0 }, on: {} };
  return P.siegeWork;
}
function nearbyAlliesOf(s: Settlement): Party[] { const w = WORLD, p = playerParty(w); return w.parties.filter((o) => o.kind === "lord" && !hostile(w, p, o) && atWar(w, o.faction, s.faction) && dist(o.x, o.y, s.cx * WCELL, s.cy * WCELL) < 40); }
function troopTable(list: Troop[], act: string) {
  if (!list.length) return "<p class='muted'>Pusto.</p>";
  return `<table class="tbl">${list.map((t) => `<tr><td>${unitBadge(t.type)} ${UNITS[t.type].name}</td><td>${t.n}${t.wounded ? ` <span class="bad">(${t.wounded})</span>` : ""}</td><td><button class="mini" data-a="${act}" data-v="${t.type}:1">1</button><button class="mini" data-a="${act}" data-v="${t.type}:all">Wszyscy</button></td></tr>`).join("")}</table>`;
}
function unitBadge(k: string) { const d = UNITS[k]; const c = d.mount ? "cav" : d.bow ? "rng" : d.ability ? "spc" : "inf"; return `<span class="ub ${c}">${c === "cav" ? "J" : c === "rng" ? "S" : c === "spc" ? "M" : "P"}</span>`; }
function abilityWord(a: string) { return ({ priest: "leczy, pali nieumarłych", mage: "kule ognia", shaman: "okrzyk krwi", necro: "wskrzesza", deathtouch: "dotyk śmierci" } as any)[a] || a; }
function itemName(it: Item) { return `<b class="t${it.tier}">${it.name}</b>`; }
// Porównanie z tym, co masz na sobie: zielone lepiej, czerwone gorzej.
function cmpEquip(it: Item) {
  const P = WORLD.player, cur = P.equip[it.slot] ? ITEMS[P.equip[it.slot]] : null;
  if (!cur) return `<span class="gold">nowy slot</span>`;
  let d = 0, u = "";
  if (it.armor != null) { d = Math.round(((it.armor || 0) - (cur.armor || 0)) * 100); u = " panc."; }
  else if (it.weapon && cur.weapon) { const a = WEAPONS[it.weapon], c = WEAPONS[cur.weapon]; d = Math.round((a.dmg.L + a.dmg.O + a.dmg.T) / 3 - (c.dmg.L + c.dmg.O + c.dmg.T) / 3); u = " obr."; }
  else if (it.bowDmg) { d = it.bowDmg - (cur.bowDmg || 0); u = " obr."; }
  else if (it.mount && cur.mount) { d = it.mount.speed - cur.mount.speed; u = " szybk."; }
  return d === 0 ? `<span class="muted">= jak twoje</span>` : `<span class="${d > 0 ? "up" : "down"}">${d > 0 ? "▲ +" : "▼ "}${d}${u}</span>`;
}
// Mieszkańcy z imionami (stali dla osady, zmieniają się co tydzień).
function residents(s: Settlement) {
  const w = WORLD, h = hashInt(s.seed + Math.floor(w.day / 7));
  const first = ["Hanno", "Marta", "Bożej", "Greta", "Wilk", "Agnes", "Jurek", "Ulla", "Teobald", "Zofka", "Radko", "Ingeborg", "Mirosz", "Elka"];
  const roles = s.kind === "village" ? ["sołtys", "pastuch", "kowal wiejski", "wdowa", "stary żołnierz"] : s.kind === "castle" ? ["kasztelan", "giermek", "zbrojmistrz", "kapelan"] : ["kupiec", "kowal", "karczmarz", "żebrak", "strażnik miejski", "kapłanka", "rzeźnik"];
  const lines = [rumor(s), rumor(s, 3), `Ceny ${s.prosperity > 60 ? "wysokie, ale towar dobry" : "niskie, bo ludzie biedni"}.`, `Ostatnio ${s.raided ? "spalili nam pola" : s.siegeBy.length ? "wróg stoi pod murami" : "spokojnie, chwała bogom"}.`, `Do ${nearestSettlement(w, s.cx * WCELL + 200, s.cy * WCELL).name} droga wiedzie przez las. Uważaj na zbójów.`, `Najlepsze ${pick(["zboże", "piwo", "żelazo", "sukno"])} jest w ${pick(w.settlements.filter((x) => x.kind === "town")).name}.`];
  return [0, 1, 2].map((i) => ({ name: first[(h >>> (i * 4)) % first.length], role: roles[(h >>> (i * 3 + 1)) % roles.length], line: lines[(h + i * 7) % lines.length] || "Nic nie wiem." }));
}
function itemStat(it: Item) {
  if (it.armor) return `pancerz ${Math.round(it.armor * 100)}`;
  if (it.weapon) { const w = WEAPONS[it.weapon]; return `obr. ${w.dmg.L}/${w.dmg.O}/${w.dmg.T} · zasięg ${w.reach}`; }
  if (it.bowDmg) return `obr. ${it.bowDmg}`;
  if (it.mount) return `szybkość ${it.mount.speed} · zdrowie ${it.mount.hp}`;
  if (it.slot === "shield") return "blok tarczą";
  return "";
}
function rumor(s: Settlement, salt = 0): string {
  const w = WORLD;
  const h = hashInt(s.seed + w.day * 13 + salt);
  const k = h % 5;
  if (k === 0) { const L = w.lords[h % w.lords.length]; const p = partyById(w, L.party); return p ? `${L.title} ${L.name} (${factionShort(L.faction)}) był ostatnio widziany niedaleko ${nearestSettlement(w, p.x, p.y).name}.` : `${L.title} ${L.name} nie ma teraz armii.`; }
  if (k === 1) { const pl = w.places.filter((x) => x.kind !== "shrine")[h % w.places.filter((x) => x.kind !== "shrine").length]; if (pl) { pl.seen = true; w.explored[cidx(pl.cx, pl.cy)] = 1; return `Mówią o miejscu zwanym ${pl.name}, w okolicach ${nearestSettlement(w, pl.cx * WCELL, pl.cy * WCELL).name}.`; } }
  if (k === 2) { const t = w.settlements.filter((x) => x.kind === "town")[h % 10 % w.settlements.filter((x) => x.kind === "town").length]; const g = GOOD_KEYS[(h >>> 4) % GOOD_KEYS.length]; return `W ${t.name} ${GOODS[g].name.toLowerCase()} ${t.stock[g] < 20 ? "jest drogie, brakuje go" : "jest tanie, mają go w bród"}.`; }
  if (k === 3) { const wars: string[] = []; for (const a of [1, 2, 3, 4, 5]) for (const b of [1, 2, 3, 4, 5]) if (a < b && w.factions[a].war[b]) wars.push(`${factionShort(a)} z ${factionShort(b)}`); return wars.length ? `Wojna trwa: ${wars.slice(0, 3).join(", ")}.` : "Podobno wszędzie pokój. Nie potrwa długo."; }
  return pick(["Martwi wstają z grobów coraz bliżej traktu.", "Zbóje grasują przy brodach.", "Ktoś widział Rycerza Śmierci na północy.", "Krasnoludy płacą dobrze za żelazo i piwo.", "Orkowie napadają na karawany w nocy."]);
}

function restInSettlement(s: Settlement) {
  const w = WORLD, P = w.player;
  const per = s.owner === -2 ? 0 : Math.ceil((troopCount(playerParty(w).troops) + 1) / 4) + 5;
  const go = (d: number) => {
    const cost = per * d;
    if (P.gold < cost) { toast("Nie stać cię na nocleg.", PAL.redL); return; }
    P.gold -= cost; closeScreen();
    G.waitHours = 24 * d; G.camping = true; playerParty(w).state = "camp"; (P as any).campMode = "rest";
    toast(`Odpoczynek w ${s.name}: ${d} ${d === 1 ? "dzień" : "dni"}${cost ? ` (${cost} denarów)` : ""}.`);
    pendingAfterWait = () => enterSettlement(s);
  };
  showScr(`<div class="dialog frame"><h1>Odpoczynek w ${s.name}</h1><p>Ile dni zostajecie? Nocleg i strawa: ${per ? `${per} denarów za dzień` : "za darmo, to twoje lenno"}.</p>
    <div class="choices">${[1, 3, 7].map((d, i) => `<button class="choice" data-a="d${d}" ${P.gold >= per * d ? "" : "disabled"}><span class="key">${i + 1}</span>${d} ${d === 1 ? "dzień" : "dni"} (${per * d} den.)</button>`).join("")}<button class="choice" data-a="back"><span class="key">4</span>Wróć</button></div></div>`,
    { d1: () => go(1), d3: () => go(3), d7: () => go(7), back: () => renderSettlement() }, "dialog-scr");
}

// Napad na wioskę: najpierw wybór, czego chcesz, potem walka z milicją.
function raidVillage(s: Settlement) {
  const w = WORLD, P = w.player, p = playerParty(w);
  const mil = RECRUITS[s.culture]?.village[0] || "b_bandit";
  const n = Math.round(6 + s.prosperity / 8);
  const go = (mode: "loot" | "burn" | "press") => launchBattle({ kind: "field", enemies: [], allies: [], enemyTroops: [{ type: mil, n, wounded: 0, xp: 0 }], settlement: s, title: `Grabież: ${s.name}`, onWin: (lines) => {
    s.raided = 14;
    for (const L of w.lords) if (L.faction === s.faction) L.relation -= 3;
    if (mode === "loot") { const loot = Math.round(150 + s.prosperity * 4); s.prosperity = Math.max(5, s.prosperity - 15); P.gold += loot; P.goods.grain = (P.goods.grain || 0) + 10; P.goods.meat = (P.goods.meat || 0) + 4; P.honor -= 3; s.relation -= 20; lines.push(`Zabierasz zapasy: ${loot} denarów i żywność.`); }
    if (mode === "burn") { s.prosperity = Math.max(3, s.prosperity - 40); s.relation -= 40; P.honor -= 6; P.renown += 5; P.gold += 60; lines.push("Wioska płonie. Dym widać z daleka."); }
    if (mode === "press") { const k = Math.min(Math.max(3, s.recruits), partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length)); if (k > 0) addTroops(p.troops, mil, k); s.recruits = 0; s.relation -= 25; P.honor -= 3; s.prosperity = Math.max(5, s.prosperity - 10); lines.push(`Bierzesz ${Math.max(0, k)} chłopów w kamasze siłą.`); }
    chron(w, `${P.name} ${mode === "burn" ? "pali" : mode === "press" ? "bierze siłą chłopów z" : "pustoszy"} wioskę ${s.name}.`, PAL.redL);
  } });
  showScr(`<div class="dialog frame"><h1>Napaść na ${s.name}</h1><p>Chłopi chwytają widły. Czego chcesz od tej wioski? (wszystko obniży honor i nastawienie)</p>
    <div class="choices"><button class="choice" data-a="loot"><span class="key">1</span>Zabierz zapasy i pieniądze</button><button class="choice" data-a="burn"><span class="key">2</span>Spal wszystko, ku przestrodze</button><button class="choice" data-a="press"><span class="key">3</span>Weź chłopów siłą do armii</button><button class="choice" data-a="back"><span class="key">4</span>Jednak nie</button></div></div>`,
    { loot: () => go("loot"), burn: () => go("burn"), press: () => go("press"), back: () => renderSettlement() }, "dialog-scr");
}

// ---------- Zadania ----------
function offerQuest(s: Settlement): Quest | null {
  const w = WORLD, P = w.player;
  if (P.quests.some((q) => !q.done && q.giver === s.id)) return null;
  if ((s as any).questCd > w.day) return null;   // po wykonanym zadaniu chwila przerwy
  const h = hashInt(s.seed + w.day);
  const kinds: Quest["kind"][] = s.kind === "village" ? ["grain", "wolves", "bandits", "defend", "cattle", "militia"] : ["bandits", "letter", "bandits", "cattle"];
  let kind = kinds[h % kinds.length];
  if (kind === "grain" && s.stock.grain >= 10) kind = "wolves";   // o zboże proszą tylko, gdy naprawdę go brakuje
  const id = w.questId++;
  if (kind === "bandits") {
    const b = w.parties.filter((p) => p.kind === "bandit").sort((a, c) => dist(a.x, a.y, s.cx * WCELL, s.cy * WCELL) - dist(c.x, c.y, s.cx * WCELL, s.cy * WCELL))[0];
    if (!b) return null;
    b.quest = id;
    return { id, kind, giver: s.id, target: b.id, amount: 0, reward: 150 + troopCount(b.troops) * 15, days: 12, text: `Rozbij bandę „${b.name}” grasującą koło ${nearestSettlement(w, b.x, b.y).name}.`, done: false };
  }
  if (kind === "letter") {
    const t = pick(w.settlements.filter((x) => x.kind === "town" && x.id !== s.id && !playerAtWarWith(w, x.faction)));
    if (!t) return null;
    return { id, kind, giver: s.id, target: t.id, amount: 0, reward: Math.round(80 + dist(s.cx, s.cy, t.cx, t.cy) * 3), days: 15, text: `Zawieź zapieczętowany list do ${t.name}.`, done: false };
  }
  if (kind === "defend") {
    // banda idzie na wioskę: pojawia się w pobliżu i trzeba ją rozbić
    const at = { x: s.cx * WCELL + 4 + Math.round(rr(-90, 90)), y: s.cy * WCELL + 4 + Math.round(rr(-70, 70)) };
    const b = spawnBandits(w, at.x, at.y, 8 + (h % 8));
    if (!b) return null;
    b.quest = id;
    return { id, kind, giver: s.id, target: b.id, amount: 0, reward: 220 + troopCount(b.troops) * 14, days: 6, text: `Banda „${b.name}” szykuje napad na ${s.name}. Rozbij ją, zanim spali wioskę.`, done: false, item: chance(0.3) ? qid(pick(baseItems().filter((it) => it.tier === 2 && it.slot !== "horse")).id, 2) : undefined };
  }
  if (kind === "cattle") { const n = 5 + (h % 5); return { id, kind, giver: s.id, target: s.id, amount: n, reward: n * 45, days: 12, text: `Przyprowadź ${n} sztuk bydła (suszone mięso) do ${s.name}. Pomór wybił stado.`, done: false }; }
  if (kind === "militia") return { id, kind, giver: s.id, target: s.id, amount: 2, reward: 260, days: 10, text: `Wyszkol milicję w ${s.name}: zostań 2 dni z co najmniej 8 zdrowymi żołnierzami.`, done: false };
  if (kind === "grain") { const n = Math.max(6, Math.round(16 - s.stock.grain) + (h % 4)); return { id, kind, giver: s.id, target: s.id, amount: n, reward: n * 22, days: 10, text: `Przywieź ${n} worków zboża do ${s.name}. Ludzie głodują.`, done: false }; }
  const lair = w.places.filter((p) => p.kind === "lair" && p.cleared <= 0).sort((a, c) => dist(a.cx, a.cy, s.cx, s.cy) - dist(c.cx, c.cy, s.cx, s.cy))[0];
  if (!lair) return null;
  lair.seen = true; w.explored[cidx(lair.cx, lair.cy)] = 1;
  return { id, kind: "wolves", giver: s.id, target: lair.id, amount: 0, reward: 260, days: 14, text: `Wytęp bestie z miejsca ${lair.name}. Porywają bydło i dzieci.`, done: false };
}
function completeQuest(q: Quest, lines: string[]) {
  const w = WORLD, P = w.player;
  q.done = true; q.days = 0;
  P.gold += q.reward; P.renown += 8; P.honor += 1;
  const s = w.settlements[q.giver]; if (s) { s.relation += 8; (s as any).questCd = w.day + 7; }
  if (q.item) { ensureItem(q.item); P.items.push(q.item); lines.push(`W nagrodę dostajesz także: ${ITEMS[q.item]?.name}.`); }
  // łańcuch: kolejne zadania dla tego samego zleceniodawcy budują zaufanie
  const ck = q.giverLord != null ? "L" + q.giverLord : "S" + q.giver, chains = ((P as any).chains ||= {}) as Record<string, number>;
  chains[ck] = (chains[ck] || 0) + 1;
  if (q.giverLord != null) { const L = lordById(w, q.giverLord); if (L) { rel(L, 6); if (chains[ck] === 3) lines.push(`${L.title} ${L.name} ufa ci teraz. Zapytaj go o „zadanie zaufania”.`); } }
  gainXp(P, 60 + Math.round(q.reward / 5), lines);
  lines.push(`Zadanie wykonane: ${q.text} Nagroda: ${q.reward} denarów.`);
  chron(w, `${P.name} wykonuje zadanie dla ${s ? s.name : "ludzi"}.`, PAL.moss);
}

// ---------- Arena ----------
const ARENA_FOES = ["m_sword", "a_maa", "v_legion", "o_warrior", "d_shield", "v_veteran", "o_berserk", "a_guard", "a_knight", "d_warden"];
const ARENA_PRIZE: Record<string, number> = { duel: 40, team3: 70, team5: 110, waves: 160, beasts: 130, archery: 60, joust: 90, death: 300 };
const ARENA_KITS: { name: string; weapon?: string; shield?: boolean; bow?: number }[] = [
  { name: "Własny" }, { name: "Miecz i tarcza", weapon: "sword", shield: true }, { name: "Dwuręczny", weapon: "longsword", shield: false },
  { name: "Włócznia", weapon: "spear", shield: false }, { name: "Topór i tarcza", weapon: "axe", shield: true }, { name: "Łuk i nóż", weapon: "dagger", shield: false, bow: 42 },
];
const TOURNEY_NAMES = ["Gerd Żelazny", "Mirko z Valmory", "Hagen Rudy", "Sybil Ostrze", "Brom Krasnolud", "Ułan Kossa", "Rycerz Bez Herbu", "Draga Ork", "Ostap Wilczy", "Lena z Kassii", "Tybalt Szary", "Kurt Topór", "Wilk z Brodów", "Jasna Agata", "Orm Kamienny", "Szczerbaty Lech", "Ida z Marchii"];
const ROUND_NAME = ["1/8 finału", "ćwierćfinał", "półfinał", "finał"];
const ROUND_MODE = ["duel", "archery", "joust", "duel"];
function arenaFight(s: Settlement, mode: string, tournament: boolean, round: number, bet: number, foeKey?: string) {
  const w = WORLD, P = w.player;
  const tier = tournament ? round + 1 : Math.min(4, 1 + Math.floor(P.level / 3));
  const pool = ARENA_FOES.filter((k) => UNITS[k] && UNITS[k].tier <= tier + 1 && UNITS[k].tier >= Math.max(1, tier - 1));
  const foes: Troop[] = [];
  if (mode === "joust") addTroops(foes, foeKey && UNITS[foeKey]?.mount ? foeKey : pick(["a_knight", "v_cata", "a_knight"]), 1);
  else if (mode === "archery") { /* tarcze stawia bitwa */ addTroops(foes, "x_dummy", 1); }
  else if (mode === "beasts") { for (let i = 0; i < 4; i++) addTroops(foes, "x_wolf", 1); addTroops(foes, "x_direwolf", 1); }
  else if (mode === "waves") { const ws = ["b_bandit", "m_sword", "a_maa", "o_warrior", "v_veteran", "o_berserk", "a_guard"].filter((k) => UNITS[k]); for (const k of ws) addTroops(foes, k, 1); }
  else if (foeKey) addTroops(foes, foeKey, 1);
  else { const n = mode === "team3" ? 3 : mode === "team5" ? 5 : 1; for (let i = 0; i < n; i++) addTroops(foes, pick(pool.length ? pool : ["m_sword"]), 1); }
  const titles: Record<string, string> = { duel: "Arena: pojedynek", team3: "Arena: 3 na 3", team5: "Arena: 5 na 5", waves: "Arena: fala za falą", beasts: "Arena: bestie", archery: "Łucznictwo", joust: "Pojedynek na kopie", death: "Zaułek: walka na śmierć" };
  launchBattle({ kind: "arena", enemies: [], allies: [], enemyTroops: foes, settlement: s, arena: { tournament, round, bet, team: mode.startsWith("team"), mode, foe: foeKey, kit: tournament ? 0 : SET.kit } as any, title: tournament ? `Turniej: ${ROUND_NAME[round - 1]}` : titles[mode] });
}
// Turniej: drabinka 16 zawodników (w tym miejscowi lordowie), 4 rundy różnego rodzaju.
interface Tourney { sid: number; names: string[]; keys: string[]; lords: number[]; alive: boolean[]; out: number[]; round: number; bet: number; opp?: number; bets: Record<number, number>; }
let TOUR: Tourney | null = null;
function startTourney(s: Settlement, bet: number) {
  const w = WORLD;
  const lordsHere = w.lords.filter((l) => l.alive && l.faction === s.faction && !l.captive).slice(0, 4);
  const names = [w.player.name], keys = ["hero"], lords = [-1];
  for (const L of lordsHere) { names.push(`${L.title} ${L.name}`); keys.push(pick(["a_knight", "a_champion", "v_praetor", "d_warden"].filter((k) => UNITS[k]))); lords.push(L.id); }
  const pool = TOURNEY_NAMES.slice().sort(() => rnd() - 0.5);
  while (names.length < 16) { names.push(pool.pop() || "Nieznajomy"); keys.push(pick(ARENA_FOES.filter((k) => UNITS[k] && UNITS[k].tier >= 2))); lords.push(-1); }
  // tasowanie poza bohaterem
  const idx = [...Array(15).keys()].map((i) => i + 1).sort(() => rnd() - 0.5);
  const order = [0, ...idx];
  TOUR = { sid: s.id, names: order.map((i) => names[i]), keys: order.map((i) => keys[i]), lords: order.map((i) => lords[i]), alive: names.map(() => true), out: names.map(() => 0), round: 1, bet, bets: {} };
  showBracket();
}
function tourWinner(T: Tourney, g: number, size: number, r: number) { return [...Array(size).keys()].map((k) => g + k).find((k) => T.out[k] === 0 || T.out[k] > r); }
function showBracket() {
  const T = TOUR, w = WORLD, P = w.player, s = w.settlements[T.sid];
  const cols = [0, 1, 2, 3, 4].map((r) => { const size = 2 ** r; const res: number[] = []; for (let g = 0; g < 16; g += size) res.push(r >= T.round ? -1 : tourWinner(T, g, size, r) ?? -1); return res; });
  const cell = (k: number, r: number) => k < 0 ? `<div class="bk empty">?</div>` : `<div class="bk ${k === 0 ? "you" : ""} ${T.out[k] === r + 1 ? "out" : ""} ${T.lords[k] >= 0 ? "lord" : ""}">${k === 0 ? ic("star") : T.lords[k] >= 0 ? ic("crown") : ""}${esc(T.names[k])}${T.bets[k] ? ` <span class="gold">${T.bets[k]}</span>` : ""}</div>`;
  const block = 2 ** T.round;
  const opp = T.alive.map((a, i) => (a ? i : -1)).filter((i) => i > 0).find((i) => Math.floor(i / block) === 0);
  const mode = ROUND_MODE[T.round - 1];
  // zakłady na innych: pary tej rundy bez bohatera
  const pairs: [number, number][] = [];
  for (let g = block; g < 16; g += block) { const L = [...Array(block).keys()].map((k) => g + k).filter((k) => T.alive[k]); if (L.length === 2) pairs.push([L[0], L[1]]); }
  const betHtml = pairs.length ? `<h2>${ic("coin")} Zakłady na inne pary (50 den., wygrana ×2)</h2><div class="chips">${pairs.map(([a2, b2]) => [a2, b2].map((k) => `<button class="mini ${T.bets[k] ? "on" : ""}" data-a="bet" data-v="${k}" ${P.gold >= 50 && !T.bets[a2] && !T.bets[b2] ? "" : "disabled"}>${esc(T.names[k])}</button>`).join(" vs ")).join(" · ")}</div>` : "";
  showScr(`<div class="card frame wide"><h1>Turniej w ${s.name}</h1>
    <div class="bracket b16">${cols.map((c, r) => `<div class="bcol"><span class="muted">${["Zawodnicy", "Ćwierćfinał", "Półfinał", "Finał", "Zwycięzca"][r]}</span>${c.map((k) => cell(k, r)).join("")}</div>`).join("")}</div>
    <p>Runda ${T.round}: ${ROUND_NAME[T.round - 1]} · <b>${{ duel: "walka piesza", archery: "łucznictwo do tarcz", joust: "kopie, 3 przejazdy" }[mode]}</b> · przeciwnik: <b>${esc(T.names[opp])}</b>${mode === "duel" ? ` (${UNITS[T.keys[opp]].name})` : ""}${T.lords[opp] >= 0 ? " · <span class='gold'>lord: wygrana podniesie relację</span>" : ""}</p>
    ${betHtml}
    <div class="btns"><button data-a="go">Do walki!</button><button class="alt" data-a="quit">Wycofaj się</button></div></div>`, {
    bet: (v) => { const k = Number(v); if (P.gold < 50) return; P.gold -= 50; T.bets[k] = 50; showBracket(); },
    go: () => { T.opp = opp; arenaFight(s, mode, true, T.round, 0, mode === "duel" ? T.keys[opp] : undefined); },
    quit: () => { TOUR = null; enterSettlement(s); },
  } as any, "after-scr");
}
function tourneyAdvance(heroWon: boolean, lines: string[]) {
  const T = TOUR, w = WORLD, P = w.player;
  const block = 2 ** T.round;
  const kill = (k: number) => { T.alive[k] = false; T.out[k] = T.round; };
  if (heroWon) { kill(T.opp); if (T.lords[T.opp] >= 0) { const L = lordById(w, T.lords[T.opp]); if (L) { L.relation += 3; lines.push(`${L.title} ${L.name} docenia twoją rękę (+3 relacji).`); } } } else kill(0);
  for (let g = 0; g < 16; g += block) {
    if (g === 0) continue;
    const grp = [...Array(block).keys()].map((k) => g + k).filter((k) => T.alive[k]);
    if (grp.length === 2) {
      const [a, b] = grp; const pa = (UNITS[T.keys[a]]?.tier || 2) + (T.lords[a] >= 0 ? 1 : 0) + rr(0, 2.5), pb = (UNITS[T.keys[b]]?.tier || 2) + (T.lords[b] >= 0 ? 1 : 0) + rr(0, 2.5);
      const win = pa >= pb ? a : b, lose = win === a ? b : a; kill(lose);
      if (T.bets[win]) { P.gold += T.bets[win] * 2; lines.push(`Zakład na ${T.names[win]} wygrany: +${T.bets[win] * 2} denarów.`); delete T.bets[win]; }
      if (T.bets[lose]) { lines.push(`Zakład na ${T.names[lose]} przepadł.`); delete T.bets[lose]; }
    }
  }
  T.round++;
}
function arenaFinished(r: BattleResult) {
  const ctx = G.ctx, w = WORLD, P = w.player, s = ctx.settlement, A = ctx.arena as any;
  P.hp = Math.max(P.hp, heroMaxHp(P) * (A.mode === "death" ? 0.2 : 0.5));
  const crowd = G.battle?.crowdGold || 0;
  G.battle = null;
  const lines: string[] = [];
  const won = r.win && !r.heroKO;
  if (crowd) { P.gold += crowd; lines.push(`Tłum rzucił na piasek ${crowd} denarów i kwiaty.`); }
  if (A.tournament && TOUR) {
    tourneyAdvance(won, lines);
    if (!won) { lines.push(`Odpadasz z turnieju (${ROUND_NAME[A.round - 1]}).`); TOUR = null; showAftermath(r, 0, [], lines, () => enterSettlement(s)); return; }
    if (A.round >= 4) {
      const prize = 800;
      P.gold += prize; P.renown += 70; s.relation += 10; P.skillPts += 1;
      for (const L of w.lords) if (L.faction === s.faction) L.relation += 2;
      lines.push(`Wygrywasz turniej w ${s.name}! ${prize} denarów, wielka sława i +1 punkt drzewka.`);
      chron(w, `${P.name} wygrywa turniej w ${s.name}.`, PAL.gold);
      s.tournament = 0; TOUR = null;
      gainXp(P, 300, lines);
      showAftermath(r, 0, [], lines, () => enterSettlement(s)); return;
    }
    lines.push(`Wygrywasz! Następna runda: ${ROUND_NAME[A.round]}.`);
    showAftermath(r, 0, [], lines, () => showBracket());
    return;
  }
  if (won) {
    let prize = ARENA_PRIZE[A.mode || "duel"] || 40;
    if (A.mode === "waves" && r.heroHp >= heroMaxHp(P) * 0.75) { prize += 80; lines.push("Seria bez większych ran: premia 80 denarów!"); }
    P.gold += prize; P.renown += A.mode === "death" ? 8 : 2; lines.push(`Wygrana: ${prize} denarów.`);
    if (A.bet) { P.gold += A.bet * 2; lines.push(`Zakład na siebie: +${A.bet * 2} denarów.`); }
    gainXp(P, A.mode === "death" ? 80 : 30, lines); if (A.mode === "death") P.honor -= 1;
    const sw = s as any; sw.arenaWins = (sw.arenaWins || 0) + 1;
    if (sw.arenaWins >= 10 && sw.champion !== "player") { sw.champion = "player"; P.renown += 25; lines.push(`Tytuł: Mistrz areny ${s.name}! Ludzie wołają twoje imię na ulicach.`); chron(w, `${P.name} zostaje mistrzem areny ${s.name}.`, PAL.gold); }
  } else lines.push((A.mode === "death" ? "Ledwo uchodzisz z życiem. Ktoś wywlókł cię za próg." : "Leżysz na piasku. Tłum gwiżdże.") + (A.bet ? ` Zakład (${A.bet}) przepada.` : ""));
  showAftermath(r, 0, [], lines, () => enterSettlement(s));
}

// ---------- Miejsca specjalne ----------
function enterPlace(pl: SpecialPlace) {
  const w = WORLD, P = w.player;
  playerParty(w).path = [];
  const scene = drawScene(pl.kind, pl.id * 31 + 7, pl.kind === "cemetery" ? "undead" : "aurelia", isNight(w) || pl.kind === "cemetery");
  const desc: Record<string, string> = {
    ruins: "Kamienne kikuty dawnej świetności. Między nimi coś się porusza. Ruiny kryją skarby i stare księgi.",
    lair: "Smród padliny i ogryzione kości. Z ciemności błyskają ślepia.",
    shrine: "Cisza i zapach wosku. Pielgrzymi zostawiają tu monety i modlitwy.",
    camp: "Namioty, ognisko, wartownik drzemie na beczce. Banda czuje się tu bezpiecznie.",
    cemetery: "Zapadnięte groby, ziemia rusza się sama. Nieumarli strzegą tej ziemi.",
  };
  const acts: Acts = { leave: () => closeScreen() };
  let btns = "";
  if (pl.kind === "shrine") {
    btns += `<button data-a="pray" ${pl.cleared > 0 ? "disabled" : ""}>Módl się${pl.cleared > 0 ? ` (za ${pl.cleared} dni)` : ""}</button>`;
    const used = (P as any).shrines || ((P as any).shrines = []);
    const can = !used.includes(pl.id);
    btns += `<button class="alt" data-a="offer" ${P.gold >= 300 && can ? "" : "disabled"}>Złóż ofiarę (300): +1 punkt drzewka${can ? "" : " (już złożona)"}</button>`;
    acts.pray = () => { P.faith = 100; P.hp = Math.min(heroMaxHp(P), P.hp + heroMaxHp(P) * 0.3); P.morale = Math.min(100, P.morale + 5); P.corruption = Math.max(0, P.corruption - 10); pl.cleared = 3; sfx.heal(); toast("Wiara odnowiona, spaczenie słabnie.", PAL.gold); enterPlace(pl); };
    acts.offer = () => { P.gold -= 300; P.skillPts++; used.push(pl.id); sfx.smite(); toast("Ofiara przyjęta: +1 punkt drzewka umiejętności.", PAL.gold); enterPlace(pl); };
  } else if (pl.cleared > 0) btns += `<p class="muted">Pusto. Coś tu wróci za ${pl.cleared} dni.</p>`;
  else {
    btns += `<button data-a="attack">Atakuj</button>`;
    acts.attack = () => {
      const troops: Troop[] = [];
      const lvl = 1 + w.day / 20;
      if (pl.kind === "camp") { addTroops(troops, "b_bandit", Math.round(12 * lvl)); addTroops(troops, "b_archer", Math.round(6 * lvl)); addTroops(troops, "b_chief", 2); }
      else if (pl.kind === "lair") { addTroops(troops, "x_wolf", Math.round(10 * lvl)); addTroops(troops, "x_spirit", Math.round(2 * lvl)); }
      else if (pl.kind === "cemetery") { addTroops(troops, "u_skel", Math.round(14 * lvl)); addTroops(troops, "u_ghoul", Math.round(6 * lvl)); addTroops(troops, "u_archer", Math.round(4 * lvl)); addTroops(troops, "u_necro", 1); }
      else { addTroops(troops, "u_warrior", Math.round(8 * lvl)); addTroops(troops, "u_skel", Math.round(8 * lvl)); addTroops(troops, "u_archer", Math.round(4 * lvl)); addTroops(troops, "u_wight", 2); }
      launchBattle({ kind: "place", enemies: [], allies: [], enemyTroops: troops, place: pl, title: pl.name });
    };
  }
  showScr(`<div class="dialog frame"><div class="scene">${pic(scene, "scene-img")}</div><h1>${pl.name}</h1><p>${desc[pl.kind]}</p><div class="btns">${btns}<button class="alt" data-a="leave">Odejdź</button></div></div>`, acts, "place-scr");
}

// ---------- Spotkanie z oddziałem ----------
function say2(t: string) { const e = document.getElementById("bubble"); if (e) { e.dataset.full = t; typeBubble(); } }
// Zmiana relacji z widocznym skutkiem.
function rel(L: Lord, d: number) { L.relation += d; if (d) toast(`${d > 0 ? "+" : ""}${d} relacji: ${L.title} ${L.name}`, d > 0 ? PAL.moss : PAL.redL); }
function meetParty(o: Party, ambushed: boolean) {
  const w = WORLD, P = w.player, p = playerParty(w);
  p.path = [];
  const host = hostile(w, p, o);
  const L = o.lord !== undefined ? lordById(w, o.lord) : null;
  const look = partyLeaderLook(o);
  const portrait = drawPortrait(look, host ? PAL.redL : PAL.bone);
  const helpers = host ? nearbyEnemyHelpers(w, o) : [];
  const allies = host ? nearbyAllies(w, o) : [];
  const myPow = partyPower(w, p) + allies.reduce((s, a) => s + partyPower(w, a), 0), theirPow = partyPower(w, o) + helpers.reduce((s, a) => s + partyPower(w, a), 0);
  const greet = host
    ? (o.kind === "bandit" ? (ambushed ? "„Sakiewka albo życie, wędrowcze!”" : "Zbóje sięgają po broń.") : o.kind === "monster" ? "Wilki krążą, warcząc." : o.kind === "undead" ? "Martwi suną ku wam bez słowa." : L ? `„${P.name}! Twoja głowa ozdobi mój pal.” · ${L.title} ${L.name}` : `${o.name} szykuje się do walki.`)
    : (L ? `„Witaj, ${P.name}.” · ${L.title} ${L.name}, ${factionName(L.faction)}` : o.kind === "caravan" ? "Kupcy kiwają głowami, strażnicy trzymają dłonie na rękojeściach." : o.kind === "villagers" ? "Chłopi zerkają nerwowo na twoje miecze." : `${o.name}.`);
  const acts: Acts = {
    fight: () => launchBattle({ kind: "field", enemies: [o, ...helpers], allies, title: o.name }),
    auto: () => autoResolve({ kind: "field", enemies: [o, ...helpers], allies, title: o.name }),
    flee: () => { if (!fleeAttempt(o)) { toast("Nie udało się uciec!", PAL.redL); meetParty(o, true); } },
    rear: () => rearguard(o),
    leave: () => { closeScreen(); G.encounterCooldown = 1; },
    pay: () => { const n = Math.round(P.gold * 0.25); P.gold -= n; o.gold += n; o.wait = 4; o.state = "idle"; o.path = []; G.encounterCooldown = 4; toast(`Płacisz ${n} denarów. Zbóje odchodzą.`); closeScreen(); },
    talk: () => { if (L) showLordTalk(L, () => meetParty(o, false)); },
    attackNeutral: () => {
      showScr(`<div class="dialog frame"><h1>Napaść?</h1><p>Atak na ${o.name} oznacza wojnę z frakcją ${factionName(o.faction)}${P.liege > 0 ? " i złamanie przysięgi" : ""}.</p><div class="btns"><button data-a="yes">Do ataku</button><button class="alt" data-a="no">Jednak nie</button></div></div>`, {
        yes: () => { playerDeclareWar(w, o.faction); launchBattle({ kind: "field", enemies: [o, ...nearbyEnemyHelpers(w, o)], allies: nearbyAllies(w, o), title: o.name }); },
        no: () => meetParty(o, false),
      }, "dialog-scr");
    },
    drop: () => dropGoods(o),
    intim: () => {
      const k = myPow / Math.max(1, theirPow), ch2 = clamp(0.2 + P.renown / 700 + (k - 1) * 0.35, 0.05, 0.9);
      if (chance(ch2)) { (o as any).cowed = true; say2(`„Dobra, dobra… nie szukamy guza.” Zbóje opuszczają broń. (szansa ${Math.round(ch2 * 100)}%)`); o.wait = 6; o.state = "flee"; G.encounterCooldown = 6; setTimeout(() => meetParty(o, false), 900); }
      else { say2(`„Ha! Wielki mi pan!” Zastraszanie nie działa. (szansa ${Math.round(ch2 * 100)}%)`); for (const t of o.troops) t.xp = (t.xp || 0) + 1; }
    },
    bluff: () => {
      const ch2 = clamp(0.1 + P.attr.cha * 0.06, 0.1, 0.75);
      if (chance(ch2)) { say2(`„Za wzgórzem stoi moja jazda.” Zbóje spoglądają po sobie i się wycofują. (charyzma, ${Math.round(ch2 * 100)}%)`); o.wait = 5; o.state = "flee"; G.encounterCooldown = 5; setTimeout(() => closeScreen(), 1400); }
      else { say2(`Ktoś parska śmiechem. Blef się nie udał. (${Math.round(ch2 * 100)}%)`); }
    },
    bribe: () => { const c = 10 * troopCount(o.troops); if (P.gold < c) return; P.gold -= c; o.gold += c; o.wait = 5; o.state = "idle"; o.path = []; G.encounterCooldown = 5; toast(`Płacisz ${c} denarów. Zbóje odchodzą zadowoleni.`); closeScreen(); },
    recruit: () => {
      const room = partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length), n = Math.min(room, troopCount(o.troops));
      if (n <= 0) { say2("„Nie zmieścimy się u ciebie, wodzu.”"); return; }
      let left = n; for (const t of o.troops.slice()) { const k2 = Math.min(left, t.n); addTroops(p.troops, t.type, k2); left -= k2; if (left <= 0) break; }
      P.honor -= 1; removeParty(w, o); toast(`${n} zbójów przechodzi pod twój sztandar (honor −1).`, PAL.gold); closeScreen(); refreshMapHud();
    },
    surrender: () => { // wróg poddaje się bez walki
      const lines: string[] = [];
      for (const t of o.troops) addTroops(p.prisoners, t.type, Math.floor(t.n * 0.6));
      P.gold += o.gold; P.renown += 5;
      lines.push(`${o.name} składa broń. Bierzesz jeńców i ${o.gold} denarów.`);
      removeParty(w, o);
      lines.forEach((l) => toast(l, PAL.gold)); closeScreen();
    },
  };
  const ch: Choice[] = [];
  if (host) {
    ch.push({ a: "fight", label: "Do ataku!", cls: "danger" });
    ch.push({ a: "auto", label: `Niech dowódcy to rozstrzygną (bez twojego udziału, taktyka ${P.skills.tactics})` });
    if (o.kind === "caravan" || o.kind === "villagers" || (o.kind === "bandit" && myPow > theirPow * 3)) ch.push({ a: "surrender", label: "Złóżcie broń, a darujemy wam życie." });
    if (L) ch.push({ a: "talk", label: "Porozmawiajmy, zanim poleje się krew." });
    if (o.kind === "bandit" && ambushed && P.gold > 20) ch.push({ a: "pay", label: `Weźcie ${Math.round(P.gold * 0.25)} denarów i odejdźcie.` });
    if (o.kind === "bandit") {
      if ((o as any).cowed && P.attr.cha >= 5) ch.push({ a: "recruit", label: `Przyłączcie się do mnie. Będzie żołd. (charyzma ${P.attr.cha})` });
      else ch.push({ a: "intim", label: `Zastrasz ich: „Zejdźcie mi z drogi.” (sława, przewaga)` });
      ch.push({ a: "bluff", label: `Blef: „Moi ludzie otaczają las.” (charyzma ${P.attr.cha})` });
      if (P.gold >= 10 * troopCount(o.troops)) ch.push({ a: "bribe", label: `Przekup: ${10 * troopCount(o.troops)} denarów za spokój.` });
    }
    if (ambushed) { ch.push({ a: "flee", label: "Uciekamy! (próba ucieczki)" }); if (troopCount(p.troops) > 3) ch.push({ a: "rear", label: "Zostawiam straż tylną, reszta za mną." }); if (Object.keys(P.goods).some((k) => !FOOD_KEYS.includes(k) && (P.goods[k] || 0) > 0)) ch.push({ a: "drop", label: "Porzućcie wozy z towarem i w nogi!" }); }
    else ch.push({ a: "leave", label: "Odejdź" });
  } else {
    if (L) ch.push({ a: "talk", label: "Chcę z tobą pomówić." });
    ch.push({ a: "attackNeutral", label: "Napadnij na nich", cls: "danger" });
    ch.push({ a: "leave", label: "Bywaj." });
  }
  const comp = o.troops.slice().sort((x, y) => UNITS[y.type].tier - UNITS[x.type].tier).slice(0, 6).map((t) => `<span class="tchip" title="${UNITS[t.type].name}">${unitThumb(t.type)}<b>${t.n}</b></span>`).join("");
  const ratio = myPow / Math.max(0.1, myPow + theirPow);
  const info = `<div class="comp-row">${comp}</div>
    ${host ? `<div class="pow"><span>Ty ${Math.round(myPow)}</span><div class="powbar"><i style="width:${ratio * 100}%"></i></div><span>${Math.round(theirPow)} Wróg</span></div><p class="tip">${strengthWord(myPow / Math.max(0.1, theirPow))}</p>` : ""}
    ${helpers.length ? `<p class="bad">Na pomoc idą: ${helpers.map((h) => h.name).join(", ")}.</p>` : ""}
    ${allies.length ? `<p class="gold">Sojusznicy w pobliżu: ${allies.map((h) => h.name).join(", ")}.</p>` : ""}
    ${host ? `<p class="tip">${ic(isNight(w) ? "moon" : "sun")} Teren: <b>${TERRAIN_NAME[battleTerrainAt(w, p.x, p.y)]}</b> · ${isNight(w) ? "noc (gorsza widoczność)" : "dzień"} · ${w.rain ? "deszcz (łuki słabsze)" : w.fog ? "mgła (widać na 20 kroków)" : season(w) === 3 ? "zima, śnieg" : "pogodnie"}</p>` : ""}`;
  showScr(`<div class="dialog frame">${dialogHtml({ left: playerPortrait(), right: portrait, title: esc(o.name), sub: `${factionName(o.faction)} · ${troopCount(o.troops)} ludzi`, speech: greet.replace(/<[^>]+>/g, ""), info, choices: ch })}</div>`, acts, "dialog-scr");
  grunt(o.kind === "monster" ? "wolf" : o.kind === "undead" || o.faction === 5 ? "undead" : look.race);
}

// ---------- Rozmowa z lordem ----------
function showLordTalk(L: Lord, back: () => void) {
  const w = WORLD, P = w.player;
  const F = w.factions[L.faction];
  const portrait = drawPortrait(L.look, factionCol(L.faction)[0]);
  const relWord = L.relation > 30 ? "przyjazny" : L.relation > 5 ? "życzliwy" : L.relation > -10 ? "obojętny" : L.relation > -30 ? "chłodny" : "wrogi";
  const wars = Object.keys(F.war).filter((k) => F.war[Number(k)]).map(Number);
  const opts: string[] = [];
  const acts: Acts = { back: () => back() };
  const say = (t: string) => { const e = document.getElementById("bubble"); if (e) { e.dataset.full = t; typeBubble(); } };
  if (P.liege === 0 && P.status !== "król" && wars.length && !playerAtWarWith(w, L.faction)) {
    opts.push(`<button class="alt" data-a="merc">Szukam służby jako najemnik</button>`);
    acts.merc = () => { if (troopCount(playerParty(w).troops) < 8) { say("„Wróć, gdy będziesz miał więcej niż garstkę obdartusów.”"); return; } P.liege = L.faction; P.status = "najemnik"; P.contractDays = 30; chron(w, `${P.name} zaciąga się jako najemnik: ${factionName(L.faction)}.`, PAL.gold); toast(`Kontrakt na 30 dni. Wrogowie: ${wars.map(factionShort).join(", ")}.`, PAL.gold); refreshMapHud(); showLordTalk(L, back); };
  }
  if (L.ruler && P.status !== "król" && P.liege !== L.faction || (L.ruler && P.status === "najemnik" && P.liege === L.faction)) {
    opts.push(`<button class="alt" data-a="vassal">Chcę złożyć przysięgę wasalną</button>`);
    acts.vassal = () => {
      if (P.renown < 120) { say(`„Kim ty jesteś? Wróć, gdy twoje imię będzie coś znaczyć.” (sława ${P.renown}/120)`); return; }
      if (L.relation < -5) { say("„Nie ufam ci.”"); return; }
      if (playerAtWarWith(w, L.faction) && P.liege !== L.faction) { say("„Najpierw przestań mordować moich ludzi.”"); return; }
      if (P.liege > 0 && P.liege !== L.faction) leaveLiege(w, false);
      P.liege = L.faction; P.status = "wasal"; P.wars = [];
      const fief = w.settlements.find((s) => s.faction === L.faction && s.kind === "village" && s.owner !== -2) || null;
      if (fief) { fief.owner = -2; }
      chron(w, `${P.name} składa przysięgę: ${L.title} ${L.name}, ${factionName(L.faction)}.`, PAL.gold);
      say(`„Powstań, ${P.name}. Od dziś służysz koronie.${fief ? ` Na utrzymanie dostajesz ${fief.name}.` : ""}”`);
      rel(L, 10); refreshMapHud();
    };
  }
  if (L.ruler && P.liege === L.faction && P.status === "wasal") {
    opts.push(`<button class="alt" data-a="unvassal">Zwolnij mnie z przysięgi</button>`);
    acts.unvassal = () => { leaveLiege(w, false); rel(L, -15); chron(w, `${P.name} zrzeka się przysięgi wobec ${factionName(L.faction)}.`); say("„Idź więc. Ale nie wracaj z mieczem.”"); refreshMapHud(); };
  }
  if (L.ruler && playerAtWarWith(w, L.faction) && (P.status === "król" || P.liege === 0) && L.faction !== 5) {
    const price = 400 + Math.round(P.renown);
    opts.push(`<button class="alt" data-a="peace">Zaproponuj pokój (${price} denarów)</button>`);
    acts.peace = () => {
      if (P.gold < price) { say("„Pokój kosztuje. Nie masz tyle.”"); return; }
      if (L.relation < -40 && chance(0.6)) { say("„Prędzej zgniję, niż podam ci rękę.”"); return; }
      P.gold -= price;
      if (P.status === "król") setWar(w, PLAYER_FACTION, L.faction, false); else { P.wars = P.wars.filter((f) => f !== L.faction); chron(w, `${P.name} zawiera pokój z ${factionName(L.faction)}.`, PAL.moss); }
      rel(L, 10); say("„Niech będzie. Na razie.”"); refreshMapHud();
    };
  }
  if (P.status === "król" && !L.ruler && L.faction !== PLAYER_FACTION && L.faction !== 5) {
    opts.push(`<button class="alt" data-a="defect">Przyłącz się do mojego królestwa</button>`);
    acts.defect = () => {
      const chanceOk = (L.relation - 20) / 60 + (L.personality === "chciwy" ? 0.2 : L.personality === "honorowy" ? -0.3 : 0) + P.renown / 2000;
      if (L.relation < 20 || !chance(clamp(chanceOk, 0.05, 0.85))) { say("„Nie zdradzę swego władcy.”"); rel(L, -3); return; }
      const old = L.faction;
      L.faction = PLAYER_FACTION;
      const party = partyById(w, L.party); if (party) party.faction = PLAYER_FACTION;
      for (const s of w.settlements) if (s.owner === L.id) captureSettlement(w, s, PLAYER_FACTION, L.id);
      chron(w, `${L.title} ${L.name} porzuca ${factionName(old)} i przysięga wierność: ${P.kingdom}!`, PAL.gold);
      say("„Twoja sprawa jest i moją sprawą, panie.”");
    };
  }
  if (!playerAtWarWith(w, L.faction)) {
    opts.push(`<button class="alt" data-a="gift">Podaruj 200 denarów</button>`);
    acts.gift = () => { if (P.gold < 200) return; P.gold -= 200; rel(L, L.personality === "chciwy" ? 8 : 4); say("„Hojność zostanie zapamiętana.”"); };
  }
  // pamięć rozmów: lord pamięta, ile razy i kiedy rozmawialiście
  const LM = L as any; const met = LM.talks || 0, since = met ? w.day - (LM.lastTalk || 0) : -1;
  if (!LM.talkedToday || LM.talkedToday !== w.day) { LM.talks = met + 1; LM.lastTalk = w.day; LM.talkedToday = w.day; }
  const base = L.personality === "okrutny" ? "Mów szybko, nie lubię czekać." : L.personality === "chciwy" ? "Co mi przynosisz?" : L.personality === "ostrożny" ? "Słucham. Ostrożnie dobieraj słowa." : "Słucham cię.";
  const mem = met === 0 ? `Nie znamy się. ${base}` : since === 0 ? `Znowu ty? ${base}` : since > 40 ? `${P.name}! Kopę lat. ${base}` : L.relation > 30 ? `Miło cię widzieć, przyjacielu. ${base}` : base;
  const line = `„${mem}”`;
  // zadania od lordów
  const myQ = P.quests.find((q) => !q.done && q.giverLord === L.id);
  const persuadeQ = P.quests.find((q) => !q.done && q.kind === "persuade" && q.target === L.id);
  if (persuadeQ) {
    const giver = lordById(w, persuadeQ.giverLord);
    opts.push(`<button class="alt" data-a="persuade">Przychodzę od ${giver ? giver.name : "twego władcy"}. Posłuchaj mnie. (charyzma ${P.attr.cha})</button>`);
    acts.persuade = () => { if ((L as any).persDay === w.day) { say("„Już mówiłem. Wróć jutro.”"); return; } (L as any).persDay = w.day; const ch2 = clamp(0.25 + P.attr.cha * 0.06 + L.relation / 120, 0.1, 0.9); if (chance(ch2)) { const lines: string[] = []; completeQuest(persuadeQ, lines); lines.forEach((l) => toast(l, PAL.gold)); say(`„Niech będzie. Powiedz mu, że dotrzymam słowa.” (${Math.round(ch2 * 100)}%)`); } else { rel(L, -2); say(`„Nie przekonałeś mnie.” (${Math.round(ch2 * 100)}%)`); } };
  }
  if (!playerAtWarWith(w, L.faction) && L.relation >= -5 && !myQ && L.faction !== 5) {
    const trust = (((P as any).chains || {})["L" + L.id] || 0) >= 3 && !(L as any).trustGiven;
    opts.push(`<button class="alt" data-a="lquest">${trust ? "Mówiłeś o zadaniu zaufania…" : "Masz dla mnie jakąś robotę?"}</button>`);
    acts.lquest = () => { const q = offerLordQuest(L, trust); if (!q) { say("„Nie teraz. Wróć za kilka dni.”"); return; } if (trust) (L as any).trustGiven = true; P.quests.push(q); toast("Nowe zadanie: " + q.text, PAL.gold); say(`„${q.text} Nagroda: ${q.reward} denarów${q.item ? ` i ${ITEMS[q.item].name}` : ""}.”`); };
  }
  // tematy rozmowy
  opts.push(`<button class="alt" data-a="rumor">Co słychać w okolicy?</button>`);
  acts.rumor = () => { const s2 = nearestSettlement(w, partyById(w, L.party)?.x ?? 0, partyById(w, L.party)?.y ?? 0); say(`„${rumor(s2) || "Cicho. Za cicho."}”`); };
  opts.push(`<button class="alt" data-a="war">Jak idzie wojna?</button>`);
  acts.war = () => { const ws = wars.filter((f) => f !== 5); const mine = w.settlements.filter((s2) => s2.faction === L.faction).length; say(ws.length ? `„Walczymy z: ${ws.map(factionShort).join(", ")}. Trzymamy ${mine} osad. ${mine > 8 ? "Idzie nam dobrze." : "Potrzeba nam mieczy."}”` : `„Pokój, na razie. Trzymamy ${mine} osad. Ale Morvath nie śpi.”`); };
  if (!(P as any).spouse) {
    opts.push(`<button class="alt" data-a="marry">Szukam małżeństwa w twoim rodzie</button>`);
    acts.marry = () => {
      if (L.relation < 35) { say(`„Najpierw zdobądź moje zaufanie.” (relacja ${L.relation}/35)`); return; }
      if (P.renown < 250) { say(`„Moja krew nie wyjdzie za kogoś bez imienia.” (sława ${P.renown}/250)`); return; }
      const nm = pick(["Adela", "Brunhilda", "Ewelina", "Ingrid", "Jagna", "Ottokar", "Radomir", "Wit"]);
      (P as any).spouse = `${nm} z rodu ${L.name}`; rel(L, 20); P.renown += 30;
      chron(w, `${P.name} zawiera małżeństwo: ${(P as any).spouse}.`, PAL.gold);
      say(`„Niech więc będzie. ${nm} będzie twoja. Nasze rody są odtąd jednym.”`);
    };
  }
  const ch: Choice[] = opts.map((h) => { const m = h.match(/data-a="([^"]+)"[^>]*>([^<]+)</); return { a: m[1], label: m[2] }; });
  ch.push({ a: "back", label: "Żegnaj." });
  const relBar = `<div class="pow rel"><span>Wrogość</span><div class="powbar"><i style="width:${clamp((L.relation + 100) / 2, 0, 100)}%"></i></div><span>Przyjaźń</span></div>`;
  const lp = partyById(w, L.party);
  const info = `${relBar}<p class="tip">${factionName(L.faction)}${L.ruler ? " · władca" : ""} · ${L.personality} · nastawienie ${relWord} (${L.relation})${lp ? ` · armia: ${troopCount(lp.troops)}` : ""} · sława ${L.renown}</p>`;
  showScr(`<div class="dialog frame">${dialogHtml({ left: playerPortrait(), right: portrait, title: `${L.title} ${L.name}`, speech: line, info, choices: ch })}</div>`, acts, "dialog-scr");
  grunt(L.look.race);
}

// ---------- Po bitwie ----------
// Wykres liczebności obu stron w czasie bitwy.
function lossChart(tl: { t: number; a: number; b: number }[]) {
  if (!tl || tl.length < 2) return "";
  const W2 = 320, H2 = 70, T = tl[tl.length - 1].t || 1, M = Math.max(1, ...tl.map((p) => Math.max(p.a, p.b)));
  const path = (k: "a" | "b") => tl.map((p, i) => `${i ? "L" : "M"}${(p.t / T * W2).toFixed(1)},${(H2 - p[k] / M * (H2 - 6) - 3).toFixed(1)}`).join(" ");
  return `<div class="chart"><svg viewBox="0 0 ${W2} ${H2}" preserveAspectRatio="none"><path d="${path("b")}" class="cb"/><path d="${path("a")}" class="ca"/></svg><div class="muted chl"><span class="ally">— twoi</span> <span class="foe">— wróg</span> · ${Math.round(T)} s</div></div>`;
}
function readyTroops() {
  const pp = playerParty(WORLD);
  return pp ? pp.troops.filter((t) => { const d = UNITS[t.type]; return d && d.up && d.up.length && t.xp >= (d.xp || 100 * d.tier) && t.n - t.wounded > 0; }) : [];
}
// Awansuj wszystkich: każdy gotowy żołnierz idzie pierwszą ścieżką, dopóki starcza złota.
function promoteAll() {
  const w = WORLD, P = w.player, p = playerParty(w);
  let done = 0, cost = 0;
  for (const t of readyTroops()) {
    const d = UNITS[t.type], to = d.up[0], need = d.xp || 100 * d.tier, c = upCost(t.type, to);
    let k = t.n - t.wounded;
    while (k-- > 0 && t.xp >= need && P.gold >= c) { P.gold -= c; cost += c; t.xp -= need; removeTroops(p.troops, t.type, 1); addTroops(p.troops, to, 1); done++; if (!p.troops.includes(t)) break; }
  }
  if (done) { sfx.coin(); toast(`Awansowano ${done} żołnierzy za ${cost} denarów.`, PAL.gold); } else toast("Brak złota na awanse.", PAL.redL);
  return done;
}
function showAftermath(r: BattleResult, gold: number, items: string[], lines: string[], next?: () => void) {
  const w = WORLD, P = w.player;
  const cas = (list: Casualty[]) => list.length ? `<div class="casl">${list.filter((c) => UNITS[c.type]).map((c) => `<div class="cas">${unitThumb(c.type)}<div><b>${UNITS[c.type].name}</b><br><span class="bad">${c.killed} pol.</span> <span class="muted">${c.wounded} rann.</span></div></div>`).join("")}</div>` : "<p class='muted'>Bez strat.</p>";
  const ready = readyTroops();
  const promo = ready.length ? `<h2>${ic("star")} Gotowi do awansu</h2><div class="casl">${ready.map((t) => `<div class="cas promo">${unitThumb(t.type)}<div><b>${UNITS[t.type].name}</b><br><span class="gold">${Math.min(t.n - t.wounded, Math.floor(t.xp / (UNITS[t.type].xp || 100 * UNITS[t.type].tier)))}× → ${UNITS[t.type].up.map((u) => UNITS[u]?.name).join(" / ")}</span></div></div>`).join("")}</div>` : "";
  const kills = r.theirs.reduce((s, c) => s + c.killed, 0), lost = r.ours.reduce((s, c) => s + c.killed, 0);
  const title = r.win ? (r.heroKO ? "Zwycięstwo, choć padłeś" : "Zwycięstwo") : r.retreated ? "Odwrót" : "Klęska";
  const best = r.best && UNITS[r.best.type] ? `<div class="cas best">${unitThumb(r.best.type)}<div><span class="muted">Najlepszy żołnierz bitwy</span><br><b>${esc(r.best.name)}</b> · ${r.best.kills} zabitych</div></div>` : "";
  // okno łupów: zaznacz, co bierzesz; reszta zostaje na polu
  const loot = items.length ? `<h2>${ic("coin")} Łupy</h2><p>${gold ? `${gold} denarów trafia do sakwy.` : ""}</p><div class="casl">${items.map((id, i) => { const it = ITEMS[id]; return it ? `<label class="cas loot"><input type="checkbox" class="loot" data-i="${i}" checked>${ic(SLOT_IC[it.slot] || "star")}<div>${itemName(it)}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)} · ${it.price} den.</span></div></label>` : ""; }).join("")}</div>` : gold ? `<h2>${ic("coin")} Łupy</h2><p>${gold} denarów.</p>` : "";
  const share = gold >= 20 && r.win && !G.ctx?.arena ? `<button class="alt" data-a="share">Podziel łupy z ludźmi (−${Math.round(gold * 0.3)} den., +morale)</button>` : "";
  const take = () => { document.querySelectorAll<HTMLInputElement>("#ui input.loot").forEach((c) => { if (c.checked) P.items.push(items[Number(c.dataset.i)]); }); items = []; };
  showScr(`<div class="card frame after">
    <h1 class="${r.win ? "gold" : "bad"}">${title}</h1>
    <div class="astats"><div>${ic("skull")}<b>${kills}</b><span>wrogów poległo</span></div><div>${ic("sword")}<b>${r.heroKills}</b><span>twoje zabójstwa</span></div><div>${ic("drop")}<b>${lost}</b><span>twoich poległych</span></div><div>${ic("sun")}<b>${Math.round(r.time)} s</b><span>czas bitwy</span></div></div>
    <div class="cols"><div>${lossChart(r.timeline || [])}</div><div>${best}</div></div>
    <div class="cols"><div><h2>Twoje straty</h2>${cas(r.ours)}${r.allies.length ? `<h2>Sojusznicy</h2>${cas(r.allies)}` : ""}</div>
    <div><h2>Straty wroga</h2>${cas(r.theirs)}</div></div>
    ${loot}
    ${r.prisoners.length ? `<p>${ic("chain")} Jeńcy: ${r.prisoners.map((p) => `${p.n}× ${UNITS[p.type].name}`).join(", ")}</p>` : ""}
    ${promo}
    ${lines.map((l) => `<p class="${/relac|\+\d|−\d|-\d/.test(l) ? "rel" : ""}">${l}</p>`).join("")}
    <div class="btns"><button data-a="next">Dalej</button>${ready.length ? `<button class="alt" data-a="promo">Awansuj wszystkich</button><button class="alt" data-a="army">Armia</button>` : ""}${share}</div></div>`, {
    army: () => { take(); closeScreen(); G.state = "map"; showMapHud(); showParty(); },
    promo: () => { take(); promoteAll(); showAftermath(r, gold, [], lines, next); },
    share: () => { take(); const g2 = Math.round(gold * 0.3); P.gold -= g2; P.morale = Math.min(100, P.morale + 10 + Math.round(g2 / 20)); toast(`Ludzie dostają ${g2} denarów. Morale rośnie.`, PAL.gold); showAftermath(r, 0, [], lines.concat([`Podzieliłeś łupy: −${g2} denarów, morale w górę.`]), next); },
    next: () => {
      take();
      closeScreen();
      G.state = "map";
      showMapHud(); refreshMapHud();
      if (next) { next(); return; }
      if (P.captive) { showCaptivity(); return; }
      showMapHud(); refreshMapHud(); autosave();
    },
  }, "after-scr");
  G.state = "map";
}

// ---------- Niewola ----------
function showCaptivity() {
  const w = WORLD, P = w.player;
  hideMapHud();
  const c = P.captive;
  const ransom = 200 + P.level * 60 + Math.round(P.renown / 2);
  const esc2 = clamp(0.15 + P.attr.agi * 0.025, 0.1, 0.6);
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene("captive", w.day, "aurelia", true), "scene-img")}</div>
    <h1>Niewola</h1><p>Trzymają cię ludzie frakcji ${factionName(c.by)}. Łańcuch obciera kostki, strażnik ziewa. Do wypuszczenia: ok. ${c.days} dni.</p>
    <div class="btns"><button data-a="escape">Spróbuj uciec (${Math.round(esc2 * 100)}%)</button><button class="alt" data-a="ransom" ${P.gold >= ransom ? "" : "disabled"}>Zapłać okup (${ransom})</button><button class="alt" data-a="wait">Czekaj dzień</button></div></div>`, {
    escape: () => { passDay(); if (chance(esc2)) releaseFromCaptivity("Uciekasz nocą przez rów z gnojem. Wolny!"); else { P.hp = Math.max(1, P.hp - 15); c.days++; toast("Złapali cię. Kij spadł na plecy.", PAL.redL); showCaptivity(); } },
    ransom: () => { P.gold -= ransom; releaseFromCaptivity("Okup zapłacony. Wypuszczają cię za bramę."); },
    wait: () => { passDay(); c.days--; if (c.days <= 0) releaseFromCaptivity("Puszczają cię wolno. Nie jesteś wart chleba, który zjadasz."); else showCaptivity(); },
  }, "dialog-scr");
}
function passDay() { const w = WORLD; for (let i = 0; i < 24; i++) worldTick(w, 1); }

// ---------- Okna postaci ----------
const CH = { tree: "", node: "" };
function showCharacter() {
  const w = WORLD, P = w.player;
  const portrait = drawPortrait(heroCfgFromPlayer(P).look, PAL.gold);
  const O = ORIGINS[P.origin];
  const nextXp = xpForLevel(P.level + 1), prevXp = xpForLevel(P.level);
  if (!CH.tree) CH.tree = NODE(O.node).tree;
  const tree = STREES.find((t) => t.id === CH.tree);
  const attrs = ATTRS.map((k) => { const A = ATTR_INFO[k]; return `<div class="attr" title="${A.desc}"><span class="an" style="color:${A.col}">${A.name}</span><div class="bar"><i style="width:${(P.attr[k] / 15) * 100}%;background:${A.col}"></i></div><b>${P.attr[k]}</b><button class="mini" data-a="attr" data-v="${k}" ${P.attrPts ? "" : "disabled"}>+</button></div>`; }).join("");
  const slots = [0, 1, 2].map((i) => { const a = P.abilities[i]; const A = a ? ABILITIES[a] : null; return `<div class="aslot ${A ? "res-" + A.res : "empty"}"><span class="key">${i + 1}</span>${A ? `<b>${A.name}${a === "smite" && P.abLevels.smite > 1 ? " II" : ""}</b><span class="muted">${RES_NAME[A.res]} ${A.cost} · ${A.cd} s</span>` : `<span class="muted">pusty: odblokuj w drzewku</span>`}</div>`; }).join("");
  const learned = P.learned.map((a) => `<div class="lchip"><span>${ABILITIES[a].name}</span>${[0, 1, 2].map((i) => `<button class="mini ${P.abilities[i] === a ? "on" : ""}" data-a="slot" data-v="${a}:${i}">${i + 1}</button>`).join("")}</div>`).join("");
  const tabs = STREES.map((t) => { const blocked = treeExcluded(P, t); const have = NODES.filter((n) => n.tree === t.id && P.nodes.includes(n.id)).length, all = NODES.filter((n) => n.tree === t.id).length; return `<button class="ttab ${t.id === CH.tree ? "on" : ""} ${blocked ? "blocked" : ""}" data-a="tree" data-v="${t.id}">${ic(NODES.find((n) => n.tree === t.id && n.row === 0).icon)}<span>${t.name}</span><small>${have}/${all}</small></button>`; }).join("");
  const nodes = NODES.filter((n) => n.tree === CH.tree);
  const lines = nodes.flatMap((n) => n.parents.map((pid) => { const p0 = NODE(pid); const lit = P.nodes.includes(pid) && P.nodes.includes(n.id); return `<line x1="${(p0.col + 0.5) * 100}" y1="${(p0.row + 0.5) * 100}" x2="${(n.col + 0.5) * 100}" y2="${(n.row + 0.5) * 100}" class="${lit ? "lit" : ""}"/>`; })).join("")
    + nodes.filter((n) => n.excl && n.tree === CH.tree && NODE(n.excl).tree === CH.tree && n.id < n.excl).map((n) => { const m = NODE(n.excl); return `<line x1="${(n.col + 0.5) * 100 + 30}" y1="${(n.row + 0.5) * 100}" x2="${(m.col + 0.5) * 100 - 30}" y2="${(m.row + 0.5) * 100}" class="excl"/>`; }).join("");
  const nodeHtml = nodes.map((n) => { const st = nodeState(P, n); return `<button class="node ${st} ${CH.node === n.id ? "sel" : ""}" style="left:${((n.col + 0.5) / 3) * 100}%;top:${((n.row + 0.5) / 4) * 100}%" data-a="node" data-v="${n.id}" title="${esc(n.name)}">${ic(n.icon, "big")}<span>${n.name}</span>${n.ability ? `<i class="abmark">umiejętność</i>` : ""}</button>`; }).join("");
  const sel = CH.node ? NODE(CH.node) : null;
  const selHtml = sel ? (() => { const st = nodeState(P, sel); const A = sel.ability ? ABILITIES[sel.ability] : null; return `<div class="ninfo"><h2>${sel.name}</h2><p>${sel.desc}</p>${A ? `<p class="tip"><b>${A.name}:</b> ${A.desc} (${RES_NAME[A.res]} ${A.cost}, odnowienie ${A.cd} s${A.corrupt ? `, spaczenie +${A.corrupt}` : ""})</p>` : ""}<p class="${st === "open" ? "gold" : st === "have" ? "muted" : "bad"}">${nodeWhy(P, sel)}</p>${st === "open" ? `<button data-a="unlock" data-v="${sel.id}" ${P.skillPts > 0 ? "" : "disabled"}>Odblokuj (1 punkt)</button>` : ""}</div>`; })() : `<div class="ninfo"><p class="tip">${tree.desc}${tree.excl ? "" : ""} Kliknij węzeł, by zobaczyć szczegóły.</p></div>`;
  showScr(`<div class="card frame wide char">
    <div class="char-grid">
      <div class="char-left">
        <div class="char-top">${pic(portrait, "portrait big")}<div><h1>${esc(P.name)}</h1><p class="muted">${RACES[P.race].name} · ${O.name} · poziom ${P.level}</p>${barHtml(P.xp - prevXp, nextXp - prevXp, "xp", `${P.xp}/${nextXp}`)}</div></div>
        <p class="tip">Zdrowie ${Math.round(P.hp)}/${heroMaxHp(P)} · sława ${P.renown} · honor ${P.honor} · zabici ${P.kills}<br>Wiara ${Math.round(P.faith)} · mana ${Math.round(P.mana)} · <span class="${P.corruption > 50 ? "bad" : ""}">spaczenie ${Math.round(P.corruption)}</span></p>
        <h2>Atrybuty ${P.attrPts ? `<span class="gold">+${P.attrPts}</span>` : ""}</h2>${attrs}
        <h2>Umiejętności aktywne</h2>${slots}
        ${learned ? `<div class="learned">${learned}</div>` : ""}
      </div>
      <div class="char-right">
        <div class="ttabs">${tabs}</div>
        <div class="thead"><b>${tree.name}</b> <span class="muted">(${ATTR_INFO[tree.attr].name})</span> ${treeExcluded(P, tree) ? `<span class="bad">zablokowane: wybrałeś ${STREES.find((t) => t.id === tree.excl).name}</span>` : tree.excl ? `<span class="muted">wyklucza: ${STREES.find((t) => t.id === tree.excl).name}</span>` : ""}<span class="pts">Punkty: <b class="gold">${P.skillPts}</b></span></div>
        <div class="tview"><svg viewBox="0 0 300 400" preserveAspectRatio="none">${lines}</svg>${nodeHtml}</div>
        ${selHtml}
      </div>
    </div>
    <div class="btns"><button data-a="close">Zamknij (C)</button></div></div>`, {
    attr: (k) => { if (P.attrPts <= 0) return; P.attr[k]++; P.attrPts--; P.hp = Math.min(heroMaxHp(P), P.hp + (k === "end" ? 7 : k === "str" ? 3 : 0)); showCharacter(); },
    tree: (v) => { CH.tree = v; CH.node = ""; showCharacter(); },
    node: (v) => { CH.node = v; showCharacter(); },
    unlock: (v) => { const n = NODE(v); if (unlockNode(P, n)) { sfx.drum(0.8); toast(`Odblokowano: ${n.name}${n.ability ? ` (umiejętność: ${ABILITIES[n.ability].name})` : ""}`, PAL.gold); } showCharacter(); },
    slot: (v) => { const [a, i] = v.split(":"); const idx = Number(i); const prev = P.abilities.indexOf(a); if (prev >= 0) P.abilities[prev] = P.abilities[idx] || ""; P.abilities[idx] = a; showCharacter(); },
    close: () => closeScreen(),
  }, "char-scr");
}

const SLOT_IC: Record<ESlot, string> = { head: "crown", body: "shield", hands: "hammer", feet: "wind", weapon: "sword", shield: "shield", bow: "bow", horse: "horse" };
function showInventory() {
  const w = WORLD, P = w.player;
  const H2 = heroCfgFromPlayer(P);
  const portrait = drawPortrait(H2.look, PAL.gold);
  const spr = spritesFor(H2.look, "inv:" + JSON.stringify(P.equip)).frames[0][0];
  const slots: ESlot[] = ["head", "body", "hands", "feet", "weapon", "shield", "bow", "horse"];
  showScr(`<div class="card frame wide">
    <h1>Ekwipunek</h1>
    <div class="inv">
      <div class="doll">${pic(portrait, "portrait big")}${pic(spr, "sprite", 4)}
        <p class="tip">Pancerz: ${Math.round(H2.armor * 100)} · Broń: ${WEAPONS[H2.weapon].name}${H2.bowDmg ? ` · Łuk ${H2.bowDmg}` : ""}${H2.mount ? ` · Koń ${Math.round(H2.mount.speed)}` : ""}</p></div>
      <div class="slots">${slots.map((s) => { const id = P.equip[s]; const it = id ? ITEMS[id] : null; return `<div class="slot"><span class="muted">${ic(SLOT_IC[s])} ${SLOT_NAME[s]}</span><span>${it ? `${itemName(it)} <span class="muted">${itemStat(it)}</span>` : "<span class='muted'>—</span>"}</span>${it ? `<button class="mini" data-a="off" data-v="${s}">Zdejmij</button>` : ""}</div>`; }).join("")}</div>
      <div class="bag"><h2>Juki</h2>${P.items.length ? P.items.map((id, i) => { const it = ITEMS[id]; return `<div class="slot"><span>${itemName(it)}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)}</span></span><button class="mini" data-a="on" data-v="${i}">Załóż</button></div>`; }).join("") : "<p class='muted'>Puste.</p>"}
        <h2>Towary</h2>${GOOD_KEYS.filter((k) => P.goods[k]).map((k) => `<div class="row"><span>${GOODS[k].name}</span><span>${P.goods[k]}</span></div>`).join("") || "<p class='muted'>Brak.</p>"}
        <p>Opatrunki: ${P.bandages}${P.equip.bow ? ` · Strzały: ${P.ammo}` : ""}</p></div>
    </div>
    <div class="btns"><button data-a="close">Zamknij (I)</button></div></div>`, {
    off: (s) => { const id = P.equip[s as ESlot]; if (!id) return; P.items.push(id); P.equip[s as ESlot] = null; showInventory(); },
    on: (v) => { const i = Number(v), id = P.items[i], it = ITEMS[id]; if (it.slot === "horse" && P.skills.riding < it.tier - 1) { toast(`Za słaba jazda konna (potrzeba ${it.tier - 1}).`, PAL.redL); return; } const prev = P.equip[it.slot]; P.equip[it.slot] = id; P.items.splice(i, 1); if (prev) P.items.push(prev); if (it.slot === "weapon" && WEAPONS[it.weapon].twoHanded && P.equip.shield) { P.items.push(P.equip.shield); P.equip.shield = null; } if (it.slot === "shield" && P.equip.weapon && WEAPONS[ITEMS[P.equip.weapon].weapon].twoHanded) { toast("Broń dwuręczna: tarcza zostaje w jukach.", PAL.ash); P.items.push(id); P.equip.shield = null; } showInventory(); },
    close: () => closeScreen(),
  }, "inv-scr");
}

const PS = { sel: "", tab: "troops" };
function upCost(from: string, to: string) { return Math.max(10, Math.round((UNITS[to].cost - UNITS[from].cost) * 0.5)); }
function showParty() {
  const w = WORLD, P = w.player, p = playerParty(w);
  const list = p.troops.slice().sort((a, b) => UNITS[b.type].tier - UNITS[a.type].tier);
  if (!list.some((t) => t.type === PS.sel)) PS.sel = list[0]?.type || "";
  const rows = list.map((t) => {
    const d = UNITS[t.type], need = d.xp || 100 * d.tier;
    const ready = d.up && d.up.length ? Math.min(t.n - t.wounded, Math.floor(t.xp / need)) : 0;
    return `<button class="urow ${PS.sel === t.type ? "on" : ""}" data-a="sel" data-v="${t.type}">${unitThumb(t.type)}<span class="un"><b>${d.name}</b>${tierStars(d.tier)}</span><span class="uc">${t.n}${t.wounded ? `<i class="bad">-${t.wounded}</i>` : ""}</span>${ready ? `<span class="upok" title="Gotowi do awansu">▲${ready}</span>` : ""}</button>`;
  }).join("") || "<p class='muted'>Nikt za tobą nie idzie.</p>";
  const t = list.find((x) => x.type === PS.sel);
  let detail = "";
  if (t) {
    const d = UNITS[t.type], need = d.xp || 100 * d.tier;
    const ready = d.up && d.up.length ? Math.min(t.n - t.wounded, Math.floor(t.xp / need)) : 0;
    const ups = (d.up || []).map((u) => { const c = upCost(t.type, u); return `<div class="upc">${pic(unitCanvas(u, 0, 0), "uthumb", 2)}<div><b>${UNITS[u].name}</b> ${tierStars(UNITS[u].tier)}<br><span class="muted">${UNITS[u].mount ? "jazda" : UNITS[u].bow ? "strzelec" : "piechota"} · ${c} denarów</span><br><button class="mini" data-a="up" data-v="${t.type}:${u}:1" ${ready > 0 && P.gold >= c ? "" : "disabled"}>Awansuj 1</button><button class="mini" data-a="up" data-v="${t.type}:${u}:all" ${ready > 0 && P.gold >= c ? "" : "disabled"}>Wszystkich (${ready})</button></div></div>`; }).join("");
    detail = `<div class="udet">
      <div class="udet-top">${unitAnim(t.type, 3)}<div><h2>${d.name}</h2>${tierStars(d.tier)}<p>${t.n} w armii${t.wounded ? `, <span class="bad">${t.wounded} rannych</span>` : ""}</p>
        ${d.up && d.up.length ? barHtml(t.xp % need, need, "xp", `doświadczenie ${t.xp % need}/${need}`) : "<p class='muted'>Najwyższy stopień.</p>"}</div></div>
      ${unitStats(t.type)}
      ${ups ? `<h2>Awans ${ready ? `<span class="gold">(${ready} gotowych)</span>` : ""}</h2><div class="ups">${ups}</div>` : ""}
      <h2>Drzewko jednostki</h2>${unitTreeHtml(t.type, "sel")}
      <button class="mini danger" data-a="dismiss" data-v="${t.type}">Zwolnij jednego</button>
    </div>`;
  }
  const tabs = [["troops", "Oddziały"], ["comp", `Kompani (${P.companions.length}/${companionMax(P)})`], ["pris", `Jeńcy (${troopCount(p.prisoners)})`]].map(([k, n]) => `<button class="tab ${PS.tab === k ? "on" : ""}" data-a="tab" data-v="${k}">${n}</button>`).join("");
  let body = "";
  if (PS.tab === "troops") body = `<div class="pgrid"><div class="ulist">${rows}</div>${detail}</div>`;
  else if (PS.tab === "comp") body = P.companions.length ? P.companions.map((c) => `<div class="comp big">${pic(drawPortrait(c.look, PAL.bone), "portrait big")}<div>${pic(spritesFor(c.look, "comp:" + c.id).frames[0][0], "sprite", 2)}</div><div><b>${c.name}</b> <span class="muted">${c.role}</span>${barHtml(c.hp, c.maxHp, "hpb", `${Math.round(c.hp)}/${c.maxHp}`)}<p class="tip">${c.bio}</p>${(c as any).away > w.day ? `<p class="gold">Na misji (${{ scout: "zwiad", trade: "handel", recruit: "werbunek" }[(c as any).mission] || "misja"}), wróci za ${(c as any).away - w.day} dni.</p>` : `Dowodzi: ${[1, 2, 3, 4, 5].map((s2) => `<button class="mini ${c.squad === s2 ? "on" : ""}" data-a="sq" data-v="${c.id}:${s2}">${SQUAD_NAMES[s2]}</button>`).join("")}<br>Wyślij: <button class="mini" data-a="mis" data-v="${c.id}:scout">Zwiad (3 dni)</button><button class="mini" data-a="mis" data-v="${c.id}:trade">Handel (5 dni)</button><button class="mini" data-a="mis" data-v="${c.id}:recruit">Werbunek (4 dni)</button>`} <button class="mini danger" data-a="fire" data-v="${c.id}">Odpraw</button>${COMP_TRAITS[c.id] ? `<p class="tip">Lubi: ${COMP_TRAITS[c.id].likes.map((x) => COMPANIONS.find((y) => y.id === x)?.name.split(" ")[0]).join(", ") || "nikogo szczególnie"} · nie znosi: ${COMP_TRAITS[c.id].hates.map((x) => COMPANIONS.find((y) => y.id === x)?.name.split(" ")[0]).join(", ") || "nikogo"}</p>` : ""}</div></div>`).join("") : "<p class='muted'>Brak kompanów. Szukaj ich w karczmach.</p>";
  else body = p.prisoners.length ? `<div class="comp-row">${p.prisoners.map((t2) => `<span class="tchip">${unitThumb(t2.type)}<b>${t2.n}</b><small>${UNITS[t2.type].name}</small></span>`).join("")}</div><button class="mini" data-a="freeP">Uwolnij wszystkich (+honor)</button>${(p as any).willing > 0 ? `<button class="mini" data-a="recP">Zwerbuj chętnych (${(p as any).willing})</button>` : `<span class="muted"> po 3 dniach w niewoli część jeńców zechce ci służyć</span>`}<p class="tip">Sprzedasz ich handlarzowi okupu w karczmie. Czasem sami przechodzą na twoją stronę.</p>` : "<p class='muted'>Nie masz jeńców.</p>";
  showScr(`<div class="card frame wide party">
    <div class="phead"><h1>Armia</h1><span>${ic("man")} ${troopCount(p.troops) + 1 + P.companions.length}/${partyLimit(w)}</span><span>${ic("coin")} żołd ${partyWages(w)}/dzień</span><span>${ic("heart")} morale ${Math.round(P.morale)}</span><span>${ic("horse")} szybkość ${partySpeed(w, p).toFixed(1)}</span></div>
    <div class="s-tabs">${tabs}</div>${body}
    <div class="btns"><button data-a="close">Zamknij (P)</button></div></div>`, {
    tab: (v) => { PS.tab = v; showParty(); },
    sel: (v) => { if (p.troops.some((x) => x.type === v)) PS.sel = v; showParty(); },
    up: (v) => { const [from, to, n] = v.split(":"); const d = UNITS[from], tr = p.troops.find((x) => x.type === from); if (!tr) return; const need = d.xp || 100 * d.tier, c = upCost(from, to); let k = n === "all" ? 999 : 1, done = 0; while (k-- > 0 && tr.xp >= need && P.gold >= c && tr.n - tr.wounded > 0) { P.gold -= c; tr.xp -= need; removeTroops(p.troops, from, 1); addTroops(p.troops, to, 1); done++; if (!p.troops.includes(tr)) break; } if (done) { sfx.coin(); toast(`${done}× ${d.name} → ${UNITS[to].name}`, PAL.gold); PS.sel = to; } showParty(); },
    dismiss: (k) => { removeTroops(p.troops, k, 1); showParty(); },
    sq: (v) => { const [id, s2] = v.split(":"); const c = P.companions.find((x) => x.id === id); c.squad = Number(s2); showParty(); },
    fire: (id) => { const c = P.companions.find((x) => x.id === id); P.companions = P.companions.filter((x) => x.id !== id); const t2 = pick(w.settlements.filter((s2) => s2.kind === "town")); t2.companions.push(id); toast(`${c.name} odchodzi. Może kiedyś spotkacie się w ${t2.name}.`); showParty(); },
    mis: (v) => { const [id, m] = v.split(":"); const c = P.companions.find((x) => x.id === id) as any; if (!c) return; c.mission = m; c.away = w.day + (m === "scout" ? 3 : m === "trade" ? 5 : 4); toast(`${c.name} wyrusza na misję.`, PAL.gold); showParty(); },
    recP: () => { const pa = p as any; let n = Math.min(pa.willing || 0, partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length)); const got = n; for (const t of p.prisoners.slice()) { const k = Math.min(n, t.n); if (k <= 0) break; removeTroops(p.prisoners, t.type, k); addTroops(p.troops, t.type, k); n -= k; } pa.willing = 0; toast(`${got} jeńców przechodzi pod twój sztandar.`, PAL.gold); showParty(); },
    freeP: () => { p.prisoners = []; P.honor += 1; showParty(); },
    close: () => closeScreen(),
  }, "party-scr");
}

function showFactions() {
  const w = WORLD, P = w.player;
  const ids = [1, 2, 3, 4, 5, ...(w.factions[PLAYER_FACTION] ? [PLAYER_FACTION] : [])];
  showScr(`<div class="card frame wide">
    <h1>Frakcje i dyplomacja</h1>
    <p>Twój status: <b>${P.status}</b>${P.liege > 0 ? ` · służysz: ${factionName(P.liege)}` : ""}${P.wars.length && P.liege === 0 ? ` · twoje wojny: ${P.wars.map(factionShort).join(", ")}` : ""}</p>
    <table class="tbl wide"><tr><th>Frakcja</th><th>Władca</th><th>Osady</th><th>Lordowie</th><th>Wojny</th><th>Z tobą</th>${P.status === "król" ? "<th></th>" : ""}</tr>
    ${ids.map((f) => { const F = w.factions[f]; if (!F) return ""; const wars = Object.keys(F.war).filter((k) => F.war[Number(k)]).map((k) => factionShort(Number(k))); const lords = w.lords.filter((l) => l.faction === f && l.alive).length; const set = w.settlements.filter((s) => s.faction === f).length; const atw = f !== PLAYER_FACTION && playerAtWarWith(w, f);
      return `<tr class="${F.alive ? "" : "muted"}"><td><span class="sw" style="background:${factionCol(f)[0]}"></span>${factionName(f)}</td><td>${f === PLAYER_FACTION ? P.name : FACTIONS[f].ruler}</td><td>${set}</td><td>${lords}</td><td>${wars.join(", ") || "pokój"}</td><td>${f === PLAYER_FACTION ? "—" : atw ? "<span class='bad'>wojna</span>" : "pokój"}</td>${P.status === "król" && f !== PLAYER_FACTION ? `<td>${atw ? "<span class='muted'>pokój: porozmawiaj z władcą</span>" : `<button class="mini danger" data-a="war" data-v="${f}">Wypowiedz wojnę</button>`}</td>` : P.status === "król" ? "<td></td>" : ""}</tr>`; }).join("")}
    </table>
    <h2>Lordowie</h2><div class="lords">${w.lords.filter((l) => l.alive).map((l) => { const p = partyById(w, l.party); return `<div class="lord"><span class="sw" style="background:${factionCol(l.faction)[0]}"></span>${l.title} ${l.name} <span class="muted">${l.relation >= 0 ? "+" : ""}${l.relation}${l.captive >= 0 ? " · w niewoli" : p ? ` · ${troopCount(p.troops)} ludzi` : " · bez armii"}</span></div>`; }).join("")}</div>
    <div class="btns"><button data-a="close">Zamknij (F)</button></div></div>`, {
    war: (v) => { setWar(w, PLAYER_FACTION, Number(v), true); showFactions(); refreshMapHud(); },
    close: () => closeScreen(),
  }, "fac-scr");
}

function showChronicle() {
  const w = WORLD;
  showScr(`<div class="card frame wide"><h1>Kronika</h1><div class="chron">${w.chronicle.slice().reverse().map((c) => `<p><span class="muted">Dzień ${c.day}</span> <span style="${c.col ? `color:${c.col}` : ""}">${esc(c.text)}</span></p>`).join("")}</div><div class="btns"><button data-a="close">Zamknij (K)</button></div></div>`, { close: () => closeScreen() }, "chron-scr");
}
function showQuests() {
  const w = WORLD, P = w.player;
  const act = P.quests.filter((q) => !q.done);
  const icon: Record<string, string> = { bandits: "sword", letter: "scroll", grain: "food", wolves: "wolf", defend: "shield", cattle: "food", militia: "man", capture: "castle", persuade: "crown" };
  const done = P.quests.filter((q) => q.done).slice(-6).reverse();
  showScr(`<div class="card frame"><h1>Zadania</h1>${act.length ? act.map((q) => { const pos = questPos(w, q); const gl = q.giverLord != null ? lordById(w, q.giverLord) : null; return `<div class="quest">${ic(icon[q.kind] || "scroll", "big")}<div><div class="qtop"><span class="gold">${ic("coin")} ${q.reward}${q.item ? ` + ${ITEMS[q.item]?.name}` : ""}</span><span class="${q.days <= 3 ? "bad" : "muted"}">${ic("sun")} ${q.days} dni</span></div><b style="color:${QUEST_COL}">${q.text}</b><br><span class="muted">Zleca: ${gl ? `${gl.title} ${gl.name}` : w.settlements[q.giver]?.name || "?"}</span><br>${pos ? `<button class="mini" data-a="show" data-v="${q.id}">Pokaż na mapie (${Math.round(dist(pos.x, pos.y, playerParty(w).x, playerParty(w).y) / WCELL)} pól)</button> <button class="mini" data-a="go" data-v="${q.id}">Idź tam</button>` : `<span class="tip">Cel jeszcze nieznany. Szukaj w okolicy lub pytaj w karczmach.</span>`} <button class="mini ${q.hide ? "" : "on"}" data-a="mark" data-v="${q.id}">${q.hide ? "Znacznik: wył." : "Znacznik: wł."}</button> <button class="mini danger" data-a="drop" data-v="${q.id}">Porzuć</button></div></div>`; }).join("") : "<p class='muted'>Brak zadań. Rady miast, sołtysi wiosek i lordowie mają robotę.</p>"}
    ${done.length ? `<h2>Ostatnio</h2>${done.map((q) => `<p class="${q.failed ? "bad" : "muted"}">${q.failed ? "✗" : "✓"} ${q.text}</p>`).join("")}` : ""}
    <p class="tip">Cele zadań mają na mapie złotą nazwę, znacznik i strzałkę przy krawędzi ekranu z odległością.</p><div class="btns"><button data-a="close">Zamknij (J)</button></div></div>`, {
    mark: (v) => { const q = P.quests.find((x) => x.id === Number(v)); if (q) q.hide = !q.hide; showQuests(); },
    drop: (v) => { const q = P.quests.find((x) => x.id === Number(v)); if (!q) return; q.done = true; q.failed = true; const s2 = w.settlements[q.giver]; if (s2) s2.relation -= 10; if (q.giverLord != null) { const L = lordById(w, q.giverLord); if (L) rel(L, -8); } toast("Porzucasz zadanie.", PAL.redL); showQuests(); },
    show: (v) => { const q = P.quests.find((x) => x.id === Number(v)); const pos = q && questPos(w, q); if (!pos) return; closeScreen(); G.view.cam.x = pos.x - W / 2; G.view.cam.y = pos.y - H / 2; G.pan.t = G.view.time + 3; },
    go: (v) => { const q = P.quests.find((x) => x.id === Number(v)); const pos = q && questPos(w, q); if (!pos) return; closeScreen(); const p = playerParty(w); const r = questRef(w, q); if (r) G.target = { kind: r.kind as any, id: r.id }; goTo(w, p, pos.x, pos.y); },
    close: () => closeScreen(),
  }, "quest-scr");
}

function showPauseMenu() {
  showScr(`<div class="card frame small"><h1>Menu</h1><div class="col-btns">
    <button data-a="resume">Wróć do gry</button>
    ${G.state === "map" && WORLD ? `<button class="alt" data-a="save">Zapisz grę</button>` : ""}
    <button class="alt" data-a="load" ${hasSave(SAVE_SLOT) ? "" : "disabled"}>Wczytaj zapis</button>
    <button class="alt" data-a="loadAuto" ${hasSave(SAVE_AUTO) ? "" : "disabled"}>Wczytaj autozapis</button>
    <button class="alt" data-a="opts">Ustawienia</button>
    ${G.state === "battle" && G.battle && G.battle.phase === "fight" && G.ctx.kind !== "custom" && G.ctx.kind !== "arena" ? `<button class="alt danger" data-a="retreat">Zarządź odwrót</button>` : ""}
    <button class="alt" data-a="title">Menu główne</button></div>
    <p class="tip">${BUILD}</p></div>`, {
    resume: () => { closeScreen(); if (G.battle) G.battle.paused = false; },
    save: () => { saveSlot(); closeScreen(); },
    load: () => loadSave(SAVE_SLOT), loadAuto: () => loadSave(SAVE_AUTO),
    opts: () => showSettings(() => showPauseMenu()),
    retreat: () => { closeScreen(); G.battle.paused = false; G.battle.retreat(); },
    title: () => { if (WORLD && G.state === "map") autosave(); G.battle = null; closeScreen(); showTitle(); },
  }, "pause-scr");
  if (G.battle) G.battle.paused = true;
}

const SETT = { tab: "game" };
function showSettings(back: () => void) {
  const S = settings;
  const chk = (k: keyof Settings, label: string, tip = "") => `<label class="opt"><input type="checkbox" data-in="b:${k}" ${S[k] ? "checked" : ""}><span>${label}${tip ? `<small>${tip}</small>` : ""}</span></label>`;
  const sel = (k: keyof Settings, label: string, opts: [string | number, string][]) => `<label class="opt"><span>${label}</span><select data-in="s:${k}">${opts.map(([v, n]) => `<option value="${v}" ${String(S[k]) === String(v) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`;
  const rng = (k: keyof Settings, label: string, min: number, max: number, step: number) => `<label class="opt"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${S[k]}" data-in="r:${k}"><b id="rv-${k}">${Math.round((S[k] as number) * 100)}%</b></label>`;
  const tabs: [string, string, string][] = [["game", "Rozgrywka", "star"], ["map", "Mapa", "eye"], ["battle", "Bitwa", "sword"], ["sound", "Dźwięk", "mug"], ["view", "Obraz", "sun"]];
  let body = "";
  if (SETT.tab === "game") body = sel("autosaveDays", "Autozapis", [[1, "codziennie"], [2, "co 2 dni"], [5, "co 5 dni"], [0, "wyłączony"]]) + chk("pauseOnEvent", "Wstrzymaj marsz, gdy pojawi się groźny wróg") + chk("toastsOn", "Wydarzenia z kroniki jako komunikaty na mapie");
  if (SETT.tab === "map") body = chk("questMarkers", "Znaczniki celów zadań", "złota nazwa i znacznik nad celem") + chk("questArrows", "Strzałki do celów poza ekranem", "z odległością w polach") + sel("partyNames", "Nazwy oddziałów", [["hover", "po najechaniu"], ["lords", "lordowie zawsze"], ["all", "wszystkie"]]) + chk("borders", "Granice frakcji (B)") + chk("typeText", "Tekst dialogów pisany litera po literze", "klik pomija") + chk("voices", "Mruknięcia postaci w rozmowach");
  if (SETT.tab === "battle") body = sel("battleSize", "Wielkość bitew (na stronę)", [[60, "60"], [100, "100"], [150, "150"]]) + chk("deploy", "Rozstawienie oddziałów przed bitwą") + sel("atkMode", "Kierunek ciosu", [["mouse", "ruch myszy względem postaci"], ["screen", "ruch myszy na ekranie"], ["keys", "na zmianę L/P, R z góry, ŚPM pchnięcie"]]) + sel("horseMode", "Sterowanie koniem", [["dir", "WSAD = kierunek jazdy"], ["tank", "W/S tempo, A/D skręt"]]) + chk("damageNumbers", "Liczby obrażeń") + chk("dmgHeroOnly", "Liczby tylko dla ciosów bohatera") + chk("gore", "Odcinanie kończyn i głów") + chk("outline", "Obrys wrogów w tłumie") + chk("tells", "Ostrzeżenia o ciosach wroga (strzałki)") + chk("dirHint", "Znacznik kierunku twojego ciosu") + chk("killSlow", "Zwolnienie czasu przy zabójstwie") + sel("hpBars", "Paski zdrowia", [["near", "w pobliżu, gdy ranni"], ["all", "zawsze"], ["off", "wyłączone"]]) + chk("minimap", "Minimapa w rogu", "w trybie Q zawsze mapa taktyczna") + chk("fewLog", "Mniej komunikatów w dzienniku walki") + rng("shake", "Wstrząsy kamery", 0, 1.5, 0.1) + rng("blood", "Ilość krwi", 0, 2, 0.1);
  if (SETT.tab === "sound") body = chk("music", "Muzyka (M)") + rng("volume", "Głośność ogólna", 0, 1, 0.05) + rng("musicVol", "Głośność muzyki", 0, 1, 0.05);
  if (SETT.tab === "view") body = sel("uiScale", "Wielkość okien i napisów", [[0.85, "mała"], [1, "normalna"], [1.15, "duża"], [1.3, "bardzo duża"]]) + `<div class="opt"><span>Pełny ekran (F11)</span><button class="mini" data-a="fs">${document.fullscreenElement ? "Wyjdź" : "Włącz"}</button></div>`;
  const apply = (k: string, val: any) => {
    (S as any)[k] = val;
    if (k === "music" && sfx.musicOn !== S.music) sfx.toggleMusic();
    if (k === "volume") sfx.setVolume(S.volume);
    if (k === "musicVol") sfx.setMusicVolume(S.musicVol);
    if (k === "uiScale") applyUiScale();
    saveSettings();
  };
  showScr(`<div class="card frame settings"><h1>Ustawienia</h1>
    <div class="s-tabs">${tabs.map(([k, n, i]) => `<button class="tab ${SETT.tab === k ? "on" : ""}" data-a="tab" data-v="${k}">${ic(i)}${n}</button>`).join("")}</div>
    <div class="opts">${body}</div>
    <div class="btns"><button class="alt" data-a="reset">Przywróć domyślne</button><button data-a="back">Gotowe</button></div></div>`, {
    tab: (v) => { SETT.tab = v; showSettings(back); },
    "b:damageNumbers": (v) => apply("damageNumbers", !!v), "b:minimap": (v) => apply("minimap", !!v), "b:fewLog": (v) => apply("fewLog", !!v), "b:dmgHeroOnly": (v) => apply("dmgHeroOnly", !!v), "b:gore": (v) => apply("gore", !!v), "b:outline": (v) => apply("outline", !!v), "s:atkMode": (v) => apply("atkMode", v), "b:typeText": (v) => apply("typeText", !!v), "b:voices": (v) => apply("voices", !!v), "b:borders": (v) => apply("borders", !!v), "b:deploy": (v) => apply("deploy", !!v), "s:horseMode": (v) => apply("horseMode", v), "b:gesture": (v) => apply("gesture", !!v), "b:music": (v) => apply("music", !!v), "b:tells": (v) => apply("tells", !!v), "b:dirHint": (v) => apply("dirHint", !!v),
    "b:killSlow": (v) => apply("killSlow", !!v), "b:questMarkers": (v) => apply("questMarkers", !!v), "b:questArrows": (v) => apply("questArrows", !!v), "b:toastsOn": (v) => apply("toastsOn", !!v), "b:pauseOnEvent": (v) => apply("pauseOnEvent", !!v),
    "s:autosaveDays": (v) => apply("autosaveDays", Number(v)), "s:partyNames": (v) => apply("partyNames", v), "s:battleSize": (v) => apply("battleSize", Number(v)), "s:hpBars": (v) => apply("hpBars", v), "s:uiScale": (v) => apply("uiScale", Number(v)),
    "r:shake": (v) => { apply("shake", Number(v)); const e = document.getElementById("rv-shake"); if (e) e.textContent = Math.round(Number(v) * 100) + "%"; },
    "r:blood": (v) => { apply("blood", Number(v)); const e = document.getElementById("rv-blood"); if (e) e.textContent = Math.round(Number(v) * 100) + "%"; },
    "r:volume": (v) => { apply("volume", Number(v)); const e = document.getElementById("rv-volume"); if (e) e.textContent = Math.round(Number(v) * 100) + "%"; },
    "r:musicVol": (v) => { apply("musicVol", Number(v)); const e = document.getElementById("rv-musicVol"); if (e) e.textContent = Math.round(Number(v) * 100) + "%"; },
    fs: () => { toggleFullscreen(); setTimeout(() => showSettings(back), 300); },
    reset: () => { Object.assign(S, { damageNumbers: true, gesture: false, music: true, volume: 0.8, battleSize: 100, musicVol: 0.6, shake: 1, killSlow: true, blood: 1, hpBars: "near", tells: false, atkMode: "mouse", horseMode: "dir", gore: true, dmgHeroOnly: true, outline: true, dirHint: true, questMarkers: true, questArrows: true, partyNames: "lords", autosaveDays: 2, uiScale: 1, toastsOn: true, pauseOnEvent: true, fewLog: true, minimap: true }); sfx.setVolume(S.volume); sfx.setMusicVolume(S.musicVol); applyUiScale(); saveSettings(); showSettings(back); },
    back: () => back(),
  }, "set-scr");
}

// ---------- Zdarzenia w podróży ----------
interface TEvent { id: string; scene: string; title: string; text: string; when?: (w: World) => boolean; ch: { label: string; act: () => string | void; need?: () => boolean }[]; }
function travelEvents(): TEvent[] {
  const w = WORLD, P = w.player, p = playerParty(w);
  const near = nearestSettlement(w, p.x, p.y);
  const food = () => FOOD_KEYS.find((k) => (P.goods[k] || 0) > 0);
  return [
    { id: "wounded", scene: "camp", title: "Ranny wędrowiec", text: "Przy drodze leży mężczyzna z przestrzeloną nogą. Bandyci zabrali mu wszystko poza życiem.", ch: [
      { label: "Opatrz go i daj jedzenie (−1 żywność, honor +1)", need: () => !!food(), act: () => { P.goods[food()]--; P.honor += 1; near.relation += 3; return `Wędrowiec błogosławi cię. W ${near.name} usłyszą o tym (relacja +3).`; } },
      { label: "Przeszukaj go — może coś jednak ukrył (honor −2)", act: () => { P.honor -= 2; const g = rr(5, 30) | 0; P.gold += g; return `Znajdujesz ${g} denarów zaszytych w bucie. Patrzy na ciebie bez słowa.`; } },
      { label: "Jedź dalej", act: () => "Zostawiasz go wroną." },
    ] },
    { id: "cart", scene: "camp", title: "Porzucony wóz", text: "Przewrócony wóz kupiecki, koło złamane, woźnica zniknął. Plandeka jeszcze się rusza na wietrze.", ch: [
      { label: "Przeszukaj wóz", act: () => { if (chance(0.35)) { const b = w.parties.find((o) => o.kind === "bandit" && dist(o.x, o.y, p.x, p.y) < 200); if (b) { setTimeout(() => meetParty(b, true), 50); return "To pułapka! Z krzaków wypadają zbóje."; } } const k = pick(GOOD_KEYS); P.goods[k] = (P.goods[k] || 0) + 3; return `Ładunek ocalał: 3× ${GOODS[k].name}.`; } },
      { label: "Omiń szerokim łukiem", act: () => "Lepiej nie kusić losu." },
    ] },
    { id: "deserters", scene: "camp", title: "Dezerterzy", text: "Kilku obdartych żołnierzy z obciętymi naszywkami prosi, by przyjąć ich na służbę. Za żołd i miskę strawy.", when: () => troopCount(p.troops) + 4 < partyLimit(w), ch: [
      { label: "Przyjmij ich (honor −1)", act: () => { const f = pick([1, 2, 3, 4]); const k = RECRUITS[FACTIONS[f].culture]?.town?.[1] || "m_sword"; addTroops(p.troops, k, 3 + (rr(0, 3) | 0)); P.honor -= 1; return `Dołączają do ciebie jako ${UNITS[k].name}.`; } },
      { label: "Odpraw ich", act: () => "Odchodzą, klnąc pod nosem." },
    ] },
    { id: "shrine", scene: "shrine", title: "Kapliczka przy drodze", text: "Mała kapliczka, świeczki, kilka monet na kamieniu. Ktoś modlił się tu niedawno.", ch: [
      { label: "Pomódl się z ludźmi (morale +8)", act: () => { P.morale = Math.min(100, P.morale + 8); return "Ludzie ruszają dalej spokojniejsi."; } },
      { label: "Zabierz ofiary (+monety, honor −3, spaczenie)", act: () => { const g = rr(10, 40) | 0; P.gold += g; P.honor -= 3; (P as any).corruption = Math.min(100, ((P as any).corruption || 0) + 4); return `Zgarniasz ${g} denarów. Świece gasną same.`; } },
      { label: "Jedź dalej", act: () => "" },
    ] },
    { id: "peasants", scene: "village", title: "Uciekinierzy", text: "Rodzina z wózkiem ucieka drogą. Za nimi, na wzgórzu, dym. „Bandyci! Spalili nam stodołę!”", ch: [
      { label: "Rozdaj im jedzenie (−2 żywność, relacja +6)", need: () => FOOD_KEYS.reduce((a, k) => a + (P.goods[k] || 0), 0) >= 2, act: () => { let n = 2; for (const k of FOOD_KEYS) while (n > 0 && (P.goods[k] || 0) > 0) { P.goods[k]--; n--; } near.relation += 6; P.honor += 1; return `Dziękują ze łzami. ${near.name} zapamięta (relacja +6).`; } },
      { label: "Ruszaj za bandytami", act: () => { const b = w.parties.filter((o) => o.kind === "bandit").sort((a, c) => dist(a.x, a.y, p.x, p.y) - dist(c.x, c.y, p.x, p.y))[0]; if (b) { G.target = { kind: "party", id: b.id }; goTo(w, p, b.x, b.y); return `Ślad prowadzi do bandy „${b.name}”. Ruszacie w pościg.`; } return "Ślad się urywa."; } },
      { label: "Nie nasza sprawa", act: () => "" },
    ] },
    { id: "trader", scene: "town", title: "Wędrowny handlarz", text: "Handlarz z mułem objuczonym workami zaczepia was na rozstajach. „Zboże, mięso, tanio, ostatnia okazja!”", ch: [
      { label: "Kup 5 zboża za 40 denarów", need: () => P.gold >= 40, act: () => { P.gold -= 40; P.goods.grain = (P.goods.grain || 0) + 5; return "Muł wyraźnie lżejszy."; } },
      { label: "Kup 3 suszonego mięsa za 55 denarów", need: () => P.gold >= 55, act: () => { P.gold -= 55; P.goods.meat = (P.goods.meat || 0) + 3; return "Ludzie się ucieszą."; } },
      { label: "Podziękuj", act: () => "" },
    ] },
    { id: "storm", scene: "camp", title: "Ulewa", text: "Niebo czernieje, lunęło jak z cebra. Droga zamienia się w błoto.", when: () => w.rain, ch: [
      { label: "Przeczekajcie pod drzewami (4 godziny)", act: () => { for (let i = 0; i < 4; i++) worldTick(w, 1); return "Przemoknięci, ale zdrowi."; } },
      { label: "Maszerujcie dalej (część ludzi zachoruje)", act: () => { for (const t of p.troops) t.wounded = Math.min(t.n, t.wounded + Math.ceil(t.n * 0.08)); P.morale -= 4; return "Kaszel w szeregach. Kilku ludzi słania się na nogach."; } },
    ] },
    { id: "wolves", scene: "lair", title: "Wycie w lesie", text: "Nocą za drzewami błyskają ślepia. Konie się płoszą.", when: () => isNight(w), ch: [
      { label: "Zapalcie pochodnie i trzymajcie wartę", act: () => { P.morale -= 2; return "Do świtu nikt nie zmrużył oka, ale wilki odeszły."; } },
      { label: "Na nie! (walka z wilkami)", act: () => { const foes: Troop[] = []; addTroops(foes, "x_wolf", 4 + (rr(0, 4) | 0)); setTimeout(() => launchBattle({ kind: "field", enemies: [], allies: [], enemyTroops: foes, title: "Wilki" }), 50); return "Ludzie dobywają broni."; } },
    ] },
    { id: "whispers", scene: "cemetery", title: "Szepty w szarej ziemi", text: "Na skażonej ziemi Morvath mgła układa się w twarze. Ktoś szepcze twoje imię.", when: () => !!w.blight[cellOf(p.x, p.y)], ch: [
      { label: "Odpowiedz szeptom (spaczenie +8, mana)", act: () => { (P as any).corruption = Math.min(100, ((P as any).corruption || 0) + 8); P.renown += 2; return "Głos obiecuje moc. Coś w tobie się zmienia."; } },
      { label: "Każ ludziom się modlić i odejdźcie", act: () => { P.morale -= 3; return "Szepty milkną, ale nikt nie śpi spokojnie."; } },
    ] },
  ];
}
function maybeTravelEvent(hours: number) {
  const w = WORLD;
  if (screenOpen() || G.state !== "map" || (w as any).evCd > w.day * 24 + w.hour) return;
  if (!chance(hours * 0.035)) return;
  const list = travelEvents().filter((e) => !e.when || e.when(w));
  const ev = pick(list);
  (w as any).evCd = w.day * 24 + w.hour + 30;
  const acts: Acts = {};
  ev.ch.forEach((c, i) => { acts["e" + i] = () => { const r = c.act(); closeScreen(); if (r) toast(r, PAL.gold); refreshMapHud(); }; });
  showScr(`<div class="dialog frame"><div class="scene">${pic(drawScene(ev.scene, w.day * 7 + ev.id.length, nearestSettlement(w, playerParty(w).x, playerParty(w).y).culture, isNight(w)), "scene-img")}</div>
    <h1>${ev.title}</h1><p>${ev.text}</p>
    <div class="choices">${ev.ch.map((c, i) => `<button class="choice" data-a="e${i}" ${c.need && !c.need() ? "disabled" : ""}><span class="key">${i + 1}</span>${c.label}</button>`).join("")}</div></div>`, acts, "dialog-scr");
  sfx.page?.();
}

// Rozmowa przed przyjęciem kompana: kilka pytań, potem decyzja.
function hireTalk(s: Settlement, id: string) {
  const w = WORLD, P = w.player, c = COMPANIONS.find((x) => x.id === id), cs = makeCompanion(id);
  const T = COMP_TRAITS[id];
  const ask = (t: string) => say2(t);
  const ch: Choice[] = [
    { a: "who", label: "Kim jesteś i skąd przychodzisz?" },
    { a: "why", label: "Czemu miałbyś mi służyć?" },
    { a: "others", label: "Jak ci się układa z innymi?" },
    { a: "hire", label: `Przyjmuję cię (${c.cost} denarów, żołd ${c.wage}/dzień)`, disabled: P.gold < c.cost || P.companions.length >= companionMax(P) },
    { a: "no", label: "Może innym razem." },
  ];
  showScr(`<div class="dialog frame">${dialogHtml({ left: playerPortrait(), right: drawPortrait(cs.look, PAL.bone), title: c.name, sub: c.role, speech: `„${c.bio}”`, choices: ch })}</div>`, {
    who: () => ask(`„${c.bio} Reszty dowiesz się przy ognisku, jeśli przeżyjemy.”`),
    why: () => ask(c.role === "kupcowa" ? "„Za procent od zysków. I za ochronę moich wozów.”" : c.role === "kapłanka" || c.role === "medyk" ? "„Bo ktoś musi łatać tych, których wy porąbiecie.”" : c.role === "rycerz" ? "„Za szansę na odzyskanie honoru. I za pełny brzuch.”" : `„Za żołd, ${P.name}. Za dobry żołd i dobrą walkę.”`),
    others: () => ask(T ? `„${T.likes.length ? `Z ${T.likes.map((x) => COMPANIONS.find((y) => y.id === x)?.name).join(" i ")} dogadam się.` : "Lubię mało kogo."} ${T.hates.length ? `Ale ${T.hates.map((x) => COMPANIONS.find((y) => y.id === x)?.name).join(" ani ")} niech się do mnie nie zbliżają.` : ""}”` : "„Nie wadzę nikomu.”"),
    hire: () => { if (P.gold < c.cost || P.companions.length >= companionMax(P)) return; P.gold -= c.cost; P.companions.push(cs); s.companions = s.companions.filter((x) => x !== id); toast(`${c.name} dołącza do ciebie.`, PAL.gold); chron(w, `${c.name} przyłącza się do ${P.name}.`); SET.tab = "tavern"; renderSettlement(); },
    no: () => { SET.tab = "tavern"; renderSettlement(); },
  }, "dialog-scr");
  grunt(c.race);
}
// Kości: twoje dwie kostki widać, przeciwnik pokazuje jedną. Sprawdź albo podbij (blef).
function showDice(s: Settlement, bet: number) {
  const w = WORLD, P = w.player;
  if (P.gold < bet) return;
  const d = () => 1 + Math.floor(rnd() * 6);
  const mine = [d(), d()], his = [d(), d()];
  const face = (n: number) => ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"][n - 1];
  const settle = (mult: number, folded = false) => {
    const a = mine[0] + mine[1], b = his[0] + his[1];
    let msg: string;
    if (folded) { P.gold += bet; msg = `Przeciwnik rzuca kości na stół i odchodzi. Wygrywasz ${bet}.`; }
    else if (a > b) { P.gold += bet * mult; msg = `${face(his[0])}${face(his[1])} (${b}) przeciw twoim ${a}. Wygrywasz ${bet * mult}!`; }
    else if (a < b) { P.gold -= bet * mult; msg = `${face(his[0])}${face(his[1])} (${b}) przeciw twoim ${a}. Tracisz ${bet * mult}.`; }
    else msg = `Remis (${a}). Każdy zabiera swoje.`;
    sfx.coin(); toast(msg, a >= b || folded ? PAL.gold : PAL.redL); SET.tab = "tavern"; renderSettlement();
  };
  const foldCh = clamp(0.3 + P.attr.cha * 0.03 + (mine[0] + mine[1] >= 9 ? 0.1 : -0.05), 0.15, 0.7);
  showScr(`<div class="dialog frame"><h1>Kości o ${bet}</h1>
    <p class="dice">Twoje: <b>${face(mine[0])} ${face(mine[1])}</b> (${mine[0] + mine[1]}) · przeciwnik pokazuje: <b>${face(his[0])} ?</b></p>
    <div class="choices"><button class="choice" data-a="check"><span class="key">1</span>Sprawdzam</button><button class="choice" data-a="raise" ${P.gold >= bet * 2 ? "" : "disabled"}><span class="key">2</span>Podbijam do ${bet * 2} (blef? spasuje z szansą ~${Math.round(foldCh * 100)}%)</button><button class="choice" data-a="fold"><span class="key">3</span>Pasuję (tracisz połowę: ${Math.round(bet / 2)})</button></div></div>`, {
    check: () => settle(1),
    raise: () => { if (chance(foldCh)) settle(1, true); else settle(2); },
    fold: () => { P.gold -= Math.round(bet / 2); toast(`Pasujesz. −${Math.round(bet / 2)}.`, PAL.ash); SET.tab = "tavern"; renderSettlement(); },
  }, "dialog-scr");
  sfx.drink?.();
}

// Zadania lordów: wojskowe (zdobądź zamek, rozbij bandę) i polityczne (przekonaj innego lorda).
function offerLordQuest(L: Lord, trust = false): Quest | null {
  const w = WORLD, P = w.player, id = w.questId++;
  const home = w.settlements.find((s) => s.owner === L.id) || nearestSettlement(w, partyById(w, L.party)?.x ?? 0, partyById(w, L.party)?.y ?? 0);
  const F = w.factions[L.faction];
  const enemies = Object.keys(F.war).filter((k) => F.war[Number(k)]).map(Number);
  const roll = trust ? 0 : hashInt(L.id * 7 + w.day) % 3;
  if (trust || roll === 0) {
    const tgt = w.settlements.filter((s) => s.kind === "castle" && enemies.includes(s.faction)).sort((a, b) => dist(a.cx, a.cy, home.cx, home.cy) - dist(b.cx, b.cy, home.cx, home.cy))[0];
    if (tgt) return { id, kind: "capture", giver: home.id, giverLord: L.id, target: tgt.id, amount: 0, reward: trust ? 2500 : 1500, days: 40, text: `Zdobądź ${tgt.name} dla ${factionName(L.faction)}.`, done: false, item: trust ? pick(UNIQUES) : undefined };
  }
  if (roll === 1) {
    const other = w.lords.filter((l) => l.alive && l.faction === L.faction && l.id !== L.id && l.captive < 0 && l.party >= 0)[hashInt(L.id + w.day) % 5];
    if (other) return { id, kind: "persuade", giver: home.id, giverLord: L.id, target: other.id, amount: 0, reward: 500, days: 20, text: `Przekonaj ${other.title} ${other.name}, by poparł ${L.name} na radzie.`, done: false };
  }
  const b = w.parties.filter((p) => p.kind === "bandit").sort((a, c) => troopCount(c.troops) - troopCount(a.troops))[0];
  if (!b) return null;
  b.quest = id;
  return { id, kind: "bandits", giver: home.id, giverLord: L.id, target: b.id, amount: 0, reward: 300 + troopCount(b.troops) * 18, days: 15, text: `Wytęp bandę „${b.name}”, która nęka ziemie ${L.name}.`, done: false, item: chance(0.4) ? qid(pick(baseItems().filter((it) => it.tier === 3 && it.slot !== "horse")).id, 2) : undefined };
}

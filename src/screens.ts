// Ekrany kampanii: tytuł, kreator bohatera, osady, spotkania, rozmowy z lordami, po bitwie, niewola, postać, ekwipunek, armia, frakcje, kronika, zapis.

const SAVE_AUTO = "sztandary-b4-auto", SAVE_SLOT = "sztandary-b4-slot1";

// ---------- Zapis ----------
function serializeWorld(w: World) {
  const o: any = { ...w };
  delete o.terr; delete o.road; delete o.nearest; delete o.blight;
  let ex = ""; for (let i = 0; i < w.explored.length; i += 8) { let b = 0; for (let k = 0; k < 8; k++) if (w.explored[i + k]) b |= 1 << k; ex += String.fromCharCode(b); }
  o.explored = btoa(ex);
  o.version = 4;
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
  // terytoria według aktualnych właścicieli
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
    <p class="tip">Na mapie: LPM: idź lub wejdź · PPM: przesuń widok · Spacja: postój i obóz · C I P F K J: okna · H: wróć do armii · Esc: menu.<br>W bitwie: WASD, LPM: cięcie, E: z góry, Spacja: pchnięcie, PPM: blok, 1–3: umiejętności, 4: opatrunek, Q: rozkazy.</p>
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
        <p class="tip">Umiejętności aktywne: ${O.abilities.map((a) => `<b>${ABILITIES[a].name}</b>`).join(", ")} · Złoto: ${O.gold} · Ludzie: ${O.troops.map(([t, n]) => `${n}× ${UNITS[t].name}`).join(", ")}</p>
        <p class="tip">Sprzęt: ${Object.values(O.equip).map((i) => ITEMS[i].name).join(", ")}</p>
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
const QB = { enemy: 5, terrain: "plains" as Terrain, size: 50, night: false, rain: false, origin: "merc", mounted: false };
function showQuickBattle() {
  const terr: Terrain[] = ["plains", "forest", "hills", "swamp", "river", "coast", "ruins", "siege"];
  showScr(`<div class="card frame">
    <h1>Szybka bitwa</h1>
    <div class="cols">
      <div><h2>Wróg</h2><div class="chips">${[1, 2, 3, 4, 5, 6].map((f) => `<button class="chip ${QB.enemy === f ? "on" : ""}" data-a="enemy" data-v="${f}">${FACTIONS[f].short}</button>`).join("")}</div>
      <h2>Teren</h2><div class="chips">${terr.map((t) => `<button class="chip ${QB.terrain === t ? "on" : ""}" data-a="terr" data-v="${t}">${TERRAIN_NAME[t]}</button>`).join("")}</div></div>
      <div><h2>Wielkość armii</h2><input type="range" min="20" max="160" step="10" value="${QB.size}" data-in="size"> <b id="qb-size">${QB.size}</b> na stronę
      <div class="menu"><label><input type="checkbox" data-in="night" ${QB.night ? "checked" : ""}> Noc</label><label><input type="checkbox" data-in="rain" ${QB.rain ? "checked" : ""}> Deszcz</label><label><input type="checkbox" data-in="mounted" ${QB.mounted ? "checked" : ""}> Bohater konno</label></div>
      <h2>Bohater</h2><div class="chips">${Object.keys(ORIGINS).map((k) => `<button class="chip ${QB.origin === k ? "on" : ""}" data-a="origin" data-v="${k}">${ORIGINS[k].name}</button>`).join("")}</div></div>
    </div>
    <div class="btns"><button data-a="go">Do boju</button><button class="alt" data-a="back">Wróć</button></div>
  </div>`, {
    enemy: (v) => { QB.enemy = Number(v); showQuickBattle(); }, terr: (v) => { QB.terrain = v as Terrain; showQuickBattle(); },
    size: (v) => { QB.size = Number(v); const e = document.getElementById("qb-size"); if (e) e.textContent = v; },
    night: (v) => { QB.night = !!v; }, rain: (v) => { QB.rain = !!v; }, mounted: (v) => { QB.mounted = !!v; },
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
  const cfg: BattleConfig = { terrain: QB.terrain, night: QB.night, rain: QB.rain, player: { name: "Ty", faction: myF, troops: mine, hero }, enemy: { name: FACTIONS[QB.enemy].name, faction: QB.enemy, troops: theirs }, maxPerSide: settings.battleSize, siegeDefender: QB.terrain === "siege" ? 1 : undefined };
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
  el.innerHTML = `<span title="Dzień i pora">Dzień ${w.day} · ${String(Math.floor(w.hour)).padStart(2, "0")}:00 ${timeWord(w.hour)}${w.rain ? " · deszcz" : ""}</span>
    <span title="Złoto"><b class="gold">${P.gold}</b> denarów</span>
    <span title="Ludzie / limit">${n}/${partyLimit(w)} ludzi${p.troops.some((t) => t.wounded) ? ` <span class="muted">(${p.troops.reduce((s, t) => s + t.wounded, 0)} rann.)</span>` : ""}</span>
    <span title="Jedzenie" class="${days < 2 ? "bad" : ""}">Jedzenie: ${food} (${days} dni)</span>
    <span title="Morale" class="${P.morale < 35 ? "bad" : ""}">Morale ${Math.round(P.morale)}</span>
    <span class="muted">${status}</span><span class="muted">${BUILD}</span>`;
  const sp = document.getElementById("mh-speed");
  if (sp) sp.innerHTML = `${[1, 2, 4].map((s) => `<button class="mini ${G.speed === s ? "on" : ""}" data-sp="${s}">×${s}</button>`).join("")}<button class="mini ${G.camping ? "on" : ""}" data-sp="camp">${G.camping ? "Zwiń obóz" : "Obóz"}</button>`;
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
    html = `<b>${esc(o.name)}</b><br><span class="muted">${factionName(o.faction)}</span><br>${partyDesc(o)}<br>${hostile(w, playerParty(w), o) ? `<span class="bad">Wrogi</span> · ${strengthWord(ratio)}` : "Neutralny lub sojusznik"}${st[o.state] ? `<br><span class="muted">${st[o.state]}</span>` : ""}`;
  } else if (hv.kind === "settlement") {
    const s = w.settlements[hv.id];
    const owner = s.owner === -2 ? "ty" : s.owner >= 0 ? `${lordById(w, s.owner).title} ${lordById(w, s.owner).name}` : "korona";
    const kind = s.kind === "town" ? "Miasto" : s.kind === "castle" ? "Zamek" : "Wioska";
    html = `<b>${s.name}</b> <span class="muted">${kind}</span><br>${factionName(s.faction)} · właściciel: ${owner}<br>Dobrobyt ${Math.round(s.prosperity)}${s.kind !== "village" ? ` · załoga ${troopCount(s.garrison)}` : ""}${s.siegeBy.length ? `<br><span class="bad">Oblężenie (${s.siegeDays} dni)</span>` : ""}${s.raided ? `<br><span class="bad">Spustoszona</span>` : ""}${s.tournament ? `<br><span class="gold">Turniej!</span>` : ""}${playerAtWarWith(w, s.faction) ? `<br><span class="bad">Wrogie</span>` : ""}`;
  } else {
    const pl = w.places[hv.id];
    const d: Record<string, string> = { ruins: "Ruiny pełne nieumarłych i skarbów.", lair: "Leże bestii.", shrine: "Miejsce modlitwy. Odnawia wiarę.", camp: "Obóz zbójców. Stąd wychodzą bandy.", cemetery: "Przeklęta ziemia. Umarli nie śpią." };
    html = `<b>${pl.name}</b><br>${d[pl.kind]}${pl.cleared > 0 && pl.kind !== "shrine" ? `<br><span class="muted">Oczyszczone (${pl.cleared} dni)</span>` : ""}`;
  }
  tip.innerHTML = html;
  tip.hidden = false;
  const wrap = document.getElementById("wrap").getBoundingClientRect();
  const sx = (input.mx / W) * wrap.width, sy = (input.my / H) * wrap.height;
  tip.style.left = Math.min(sx + 16, wrap.width - tip.offsetWidth - 8) + "px";
  tip.style.top = Math.min(sy + 12, wrap.height - tip.offsetHeight - 8) + "px";
}

// ---------- Osady ----------
const SET = { id: 0, tab: "main", bet: 50, quest: null as Quest | null };
function enterSettlement(s: Settlement) {
  const w = WORLD, P = w.player;
  playerParty(w).path = [];
  SET.id = s.id; SET.tab = "main"; SET.quest = null;
  // dostarczenie listu
  for (const q of P.quests) if (!q.done && q.kind === "letter" && q.target === s.id) { const lines: string[] = []; completeQuest(q, lines); lines.forEach((l) => toast(l, PAL.gold)); }
  autosave();
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
    tabs.push(["main", s.kind === "village" ? "Wioska" : s.kind === "castle" ? "Dziedziniec" : "Plac"]);
    if (s.kind !== "castle") tabs.push(["recruit", "Rekrutacja"]);
    if (s.kind !== "castle") tabs.push(["market", s.kind === "village" ? "Kup żywność" : "Targ"]);
    if (s.kind === "town") { tabs.push(["smith", "Kowal"]); tabs.push(["tavern", "Karczma"]); tabs.push(["arena", s.tournament ? "Arena · turniej!" : "Arena"]); }
    if (s.kind !== "castle") tabs.push(["quest", s.kind === "village" ? "Sołtys" : "Rada miejska"]);
    if (mine && s.kind !== "village") tabs.push(["manage", "Załoga"]);
    if (s.kind !== "village") tabs.push(["rest", "Odpocznij"]);
  }
  tabs.push(["leave", "Wyjdź"]);
  if (!tabs.some((t) => t[0] === SET.tab)) SET.tab = tabs[0][0];
  const sceneKind = SET.tab === "tavern" ? "tavern" : SET.tab === "smith" ? "smith" : SET.tab === "arena" ? "arena" : SET.tab === "siege" ? "siege" : s.kind;
  const scene = drawScene(sceneKind, s.seed, s.culture, isNight(w), s.raided > 0 ? 1 : 0);
  const pane = settlementPane(s, hostileS);
  showScr(`<div class="settle">
    <div class="scene">${pic(scene, "scene-img")}</div>
    <div class="s-head"><h1>${s.name}</h1><span class="muted">${kindName} · ${factionName(s.faction)} · ${owner}</span>
      <span class="muted">Dobrobyt ${Math.round(s.prosperity)}${s.kind !== "village" ? ` · załoga ${troopCount(s.garrison)}` : ""} · nastawienie ${s.relation >= 0 ? "+" : ""}${Math.round(s.relation)}${s.raided ? " · <span class='bad'>spustoszona</span>" : ""}</span></div>
    <div class="s-tabs">${tabs.map(([k, n]) => `<button class="tab ${SET.tab === k ? "on" : ""}" data-a="tab" data-v="${k}">${n}</button>`).join("")}</div>
    <div class="s-pane">${pane.html}</div>
    <div class="s-foot"><span><b class="gold">${P.gold}</b> denarów</span><span>${troopCount(p.troops) + 1 + P.companions.length}/${partyLimit(w)} ludzi</span><span>Jedzenie ${foodTotal(w)}</span></div>
  </div>`, {
    tab: (v) => { if (v === "leave") { closeScreen(); refreshMapHud(); return; } if (v === "rest") { restInSettlement(s); return; } if (v === "raid") { raidVillage(s); return; } SET.tab = v; renderSettlement(); },
    ...pane.acts,
  }, "settle-scr");
}

function recruitPool(s: Settlement): string[] {
  const w = WORLD, P = w.player;
  const cul = s.culture;
  if (cul === "undead" && P.race !== "undead" && P.liege !== 5) return [];
  const R = RECRUITS[cul];
  if (!R) return [];
  if (s.kind === "village") return R.village.slice();
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
      return {
        html: `<p>${desc}</p>${rum ? `<p class="tip">Plotka: ${rum}</p>` : ""}${lordHere ? `<div class="row"><span>${lord.title} ${lord.name} przebywa na zamku.</span><button class="mini" data-a="talkLord" data-v="${lord.id}">Rozmawiaj</button></div>` : ""}
          ${s.siegeBy.length ? `<p class="bad">Miasto jest oblężone!</p>` : ""}`,
        acts: { talkLord: (v) => showLordTalk(lordById(w, Number(v)), () => renderSettlement()) },
      };
    }
    case "recruit": {
      const pool = recruitPool(s);
      const room = partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length);
      const relMul = s.relation < -10 ? 0 : 1;
      const avail = Math.floor(s.recruits * relMul);
      return {
        html: `<p>Ochotnicy: <b>${avail}</b> · Miejsce w armii: <b>${Math.max(0, room)}</b>${relMul === 0 ? " · <span class='bad'>Mieszkańcy nie chcą ci służyć.</span>" : ""}</p>
        <table class="tbl"><tr><th>Jednostka</th><th>Tier</th><th>Koszt</th><th>Żołd</th><th></th></tr>
        ${pool.map((k) => { const d = UNITS[k]; const ok = avail > 0 && room > 0 && P.gold >= d.cost; return `<tr><td>${unitBadge(k)} ${d.name}${d.ability ? ` <span class="gold">(${abilityWord(d.ability)})</span>` : ""}</td><td>${d.tier}</td><td>${d.cost}</td><td>${d.wage}/dzień</td><td><button class="mini" data-a="rec" data-v="${k}:1" ${ok ? "" : "disabled"}>+1</button><button class="mini" data-a="rec" data-v="${k}:5" ${ok ? "" : "disabled"}>+5</button></td></tr>`; }).join("")}
        </table>${pool.length === 0 ? "<p class='muted'>Nikt tu nie chce iść z tobą.</p>" : ""}`,
        acts: { rec: (v) => { const [k, ns] = v.split(":"); const d = UNITS[k]; let n = Math.min(Number(ns), avail, partyLimit(w) - (troopCount(p.troops) + 1 + P.companions.length), Math.floor(P.gold / d.cost)); if (n <= 0) return; P.gold -= n * d.cost; s.recruits -= n; addTroops(p.troops, k, n); sfx.coin(); re(); } },
      };
    }
    case "market": {
      const keys = s.kind === "village" ? FOOD_KEYS : GOOD_KEYS;
      return {
        html: `<table class="tbl"><tr><th>Towar</th><th>Zapas</th><th>Kupno</th><th>Sprzedaż</th><th>Masz</th><th></th></tr>
        ${keys.map((k) => `<tr><td>${GOODS[k].name}${GOODS[k].food ? " <span class='muted'>(żywność)</span>" : ""}</td><td>${Math.floor(s.stock[k])}</td><td>${buyPrice(w, s, k)}</td><td>${sellPrice(w, s, k)}</td><td>${P.goods[k] || 0}</td>
          <td><button class="mini" data-a="buy" data-v="${k}:1">Kup</button><button class="mini" data-a="buy" data-v="${k}:5">×5</button><button class="mini" data-a="sell" data-v="${k}:1" ${(P.goods[k] || 0) > 0 ? "" : "disabled"}>Sprzedaj</button><button class="mini" data-a="sell" data-v="${k}:all" ${(P.goods[k] || 0) > 0 ? "" : "disabled"}>Wszystko</button></td></tr>`).join("")}</table>
        <p class="tip">Ceny zależą od zapasów. Karawany i wojna je zmieniają. Kupuj tam, gdzie towaru jest dużo, sprzedawaj tam, gdzie go brak.</p>`,
        acts: {
          buy: (v) => { const [k, ns] = v.split(":"); let n = Number(ns); for (let i = 0; i < n; i++) { const pr = buyPrice(w, s, k); if (P.gold < pr || s.stock[k] < 1) break; P.gold -= pr; s.stock[k]--; P.goods[k] = (P.goods[k] || 0) + 1; } sfx.coin(); re(); },
          sell: (v) => { const [k, ns] = v.split(":"); let n = ns === "all" ? P.goods[k] || 0 : Number(ns); for (let i = 0; i < n && (P.goods[k] || 0) > 0; i++) { P.gold += sellPrice(w, s, k); s.stock[k]++; P.goods[k]--; } sfx.coin(); re(); },
        },
      };
    }
    case "smith": {
      const forSale = smithItems(s);
      return {
        html: `<div class="cols"><div><h2>Na sprzedaż</h2><table class="tbl">${forSale.map((id) => { const it = ITEMS[id]; const pr = itemPrice(it, true, P.skills.trade); return `<tr><td>${itemName(it)}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)}</span></td><td>${pr}</td><td><button class="mini" data-a="buyI" data-v="${id}" ${P.gold >= pr ? "" : "disabled"}>Kup</button></td></tr>`; }).join("")}
          <tr><td>Opatrunki ×1<br><span class="muted">leczą w bitwie (klawisz 4)</span></td><td>30</td><td><button class="mini" data-a="band" ${P.gold >= 30 ? "" : "disabled"}>Kup</button></td></tr>
          ${P.equip.bow ? `<tr><td>Kołczan strzał<br><span class="muted">uzupełnia do 40</span></td><td>25</td><td><button class="mini" data-a="ammo" ${P.gold >= 25 ? "" : "disabled"}>Kup</button></td></tr>` : ""}</table></div>
          <div><h2>Twój dobytek</h2>${P.items.length ? `<table class="tbl">${P.items.map((id, i) => { const it = ITEMS[id]; return `<tr><td>${itemName(it)}<br><span class="muted">${SLOT_NAME[it.slot]} · ${itemStat(it)}</span></td><td>${itemPrice(it, false, P.skills.trade)}</td><td><button class="mini" data-a="sellI" data-v="${i}">Sprzedaj</button></td></tr>`; }).join("")}</table>` : "<p class='muted'>Nic w jukach. Zakładany sprzęt zmieniasz w oknie Ekwipunek (I).</p>"}</div></div>`,
        acts: {
          buyI: (v) => { const it = ITEMS[v]; const pr = itemPrice(it, true, P.skills.trade); if (P.gold < pr) return; P.gold -= pr; P.items.push(v); sfx.coin(); toast(`Kupiono: ${it.name}. Załóż w oknie Ekwipunek (I).`); re(); },
          sellI: (v) => { const i = Number(v), it = ITEMS[P.items[i]]; P.gold += itemPrice(it, false, P.skills.trade); P.items.splice(i, 1); sfx.coin(); re(); },
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
      return {
        html: `<div class="cols"><div>
          <h2>Najemnicy</h2>${mercN > 0 ? `<div class="row"><span>${mercN}× ${UNITS[mercType].name} · ${Math.round(UNITS[mercType].cost * 1.2)} za głowę</span><button class="mini" data-a="merc" data-v="${mercN}:${mercType}" ${room > 0 && P.gold >= UNITS[mercType].cost * 1.2 ? "" : "disabled"}>Najmij</button></div>` : "<p class='muted'>Dziś nikt nie szuka roboty.</p>"}
          <h2>Kompani</h2>${comps.length ? comps.map((id) => { const c = COMPANIONS.find((x) => x.id === id); const cs = makeCompanion(id); return `<div class="comp">${pic(drawPortrait(cs.look, PAL.bone), "portrait")}<div><b>${c.name}</b> <span class="muted">${c.role}</span><br><span class="tip">${c.bio}</span><br><button class="mini" data-a="hire" data-v="${id}" ${P.gold >= c.cost && P.companions.length < 3 ? "" : "disabled"}>Przyjmij (${c.cost}, żołd ${c.wage})</button></div></div>`; }).join("") : "<p class='muted'>Nikogo ciekawego.</p>"}
          ${P.companions.length >= 3 ? "<p class='tip'>Masz już trzech kompanów.</p>" : ""}
        </div><div>
          <h2>Plotki</h2><p class="tip">${rumor(s)}</p><p class="tip">${rumor(s, 7)}</p>
          <button class="mini" data-a="drink" ${P.gold >= 40 ? "" : "disabled"}>Postaw kolejkę ludziom (40)</button>
          <h2>Handlarz okupem</h2>${p.prisoners.length ? `<table class="tbl">${p.prisoners.map((t, i) => `<tr><td>${t.n}× ${UNITS[t.type].name}</td><td>${prisonerValue(t)}/szt.</td><td><button class="mini" data-a="sellP" data-v="${i}">Sprzedaj</button></td></tr>`).join("")}</table>` : "<p class='muted'>Nie masz jeńców.</p>"}
          ${captiveLords.length ? `<h2>Pojmani lordowie</h2>${captiveLords.map((l) => `<div class="row"><span>${l.title} ${l.name} (${factionShort(l.faction)})</span><span><button class="mini" data-a="ransom" data-v="${l.id}">Okup ${300 + Math.round(l.renown)}</button><button class="mini" data-a="free" data-v="${l.id}">Uwolnij</button></span></div>`).join("")}` : ""}
        </div></div>`,
        acts: {
          merc: (v) => { const [ns, t] = v.split(":"); const pr = Math.round(UNITS[t].cost * 1.2); const n = Math.min(Number(ns), Math.floor(P.gold / pr), room); if (n <= 0) return; P.gold -= n * pr; addTroops(p.troops, t, n); (w.player as any)["merc" + s.id + "_" + Math.floor(w.day / 4)] = ((w.player as any)["merc" + s.id + "_" + Math.floor(w.day / 4)] || 0) + n; sfx.coin(); re(); },
          hire: (v) => { const c = COMPANIONS.find((x) => x.id === v); if (P.gold < c.cost || P.companions.length >= 3) return; P.gold -= c.cost; P.companions.push(makeCompanion(v)); s.companions = s.companions.filter((x) => x !== v); toast(`${c.name} dołącza do ciebie.`, PAL.gold); chron(w, `${c.name} przyłącza się do ${P.name}.`); re(); },
          drink: () => { P.gold -= 40; P.morale = Math.min(100, P.morale + 8); s.relation += 1; sfx.coin(); toast("Ludzie piją za twoje zdrowie. Morale rośnie."); re(); },
          sellP: (v) => { const t = p.prisoners[Number(v)]; P.gold += prisonerValue(t) * t.n; p.prisoners.splice(Number(v), 1); sfx.coin(); re(); },
          ransom: (v) => { const L = lordById(w, Number(v)); P.gold += 300 + Math.round(L.renown); L.captive = -1; L.relation -= 5; chron(w, `${L.title} ${L.name} wykupiony z niewoli u ${P.name}.`); sfx.coin(); re(); },
          free: (v) => { const L = lordById(w, Number(v)); L.captive = -1; L.relation += 15; P.honor += 3; chron(w, `${P.name} wypuszcza z niewoli: ${L.title} ${L.name}. Szlachetny gest.`, PAL.moss); re(); },
        },
      };
    }
    case "arena": {
      const tour = s.tournament > 0;
      return {
        html: `<p>Piasek areny, krzyk tłumu. Walczy się do nokautu, nikt tu nie ginie… zwykle.</p>
          <div class="row"><span>Pojedynek: jeden przeciwnik</span><button class="mini" data-a="fight" data-v="duel">Walcz (nagroda 40)</button></div>
          <div class="row"><span>Walka drużynowa: 3 na 3</span><button class="mini" data-a="fight" data-v="team">Walcz (nagroda 70)</button></div>
          ${tour ? `<h2>Turniej (${s.tournament} dni)</h2><p>Cztery rundy pojedynków z coraz lepszymi wojownikami. Zwycięzca: 600 denarów i sława.</p>
            <div class="row"><span>Zakład na siebie: <input type="number" min="0" max="${P.gold}" step="10" value="${SET.bet}" data-in="bet" class="num"></span><button class="mini" data-a="tour">Wejdź do turnieju</button></div>` : "<p class='muted'>Turniej obecnie się nie odbywa.</p>"}
          <p class="tip">Na arenie walczysz swoim sprzętem, ale bez konia, armii i kompanów.</p>`,
        acts: {
          bet: (v) => { SET.bet = clamp(Math.round(Number(v) || 0), 0, P.gold); },
          fight: (v) => arenaFight(s, v === "team", false, 0, 0),
          tour: () => { const bet = clamp(SET.bet, 0, P.gold); P.gold -= bet; arenaFight(s, false, true, 1, bet); },
        },
      };
    }
    case "quest": {
      const q = SET.quest || (SET.quest = offerQuest(s));
      const active = P.quests.filter((x) => !x.done && x.giver === s.id);
      const grainQ = active.find((x) => x.kind === "grain");
      return {
        html: `${active.length ? `<h2>Twoje zadania tutaj</h2>${active.map((x) => `<p>${x.text} <span class="muted">(${x.days} dni)</span></p>`).join("")}` : ""}
          ${grainQ ? `<div class="row"><span>Masz ${P.goods.grain || 0} zboża.</span><button class="mini" data-a="giveGrain" ${(P.goods.grain || 0) >= grainQ.amount ? "" : "disabled"}>Oddaj ${grainQ.amount} zboża</button></div>` : ""}
          ${q && !active.length ? `<h2>Prośba</h2><p>${q.text}</p><p class="tip">Nagroda: ${q.reward} denarów · czas: ${q.days} dni</p><button class="mini" data-a="take">Przyjmij zadanie</button>` : !active.length ? "<p class='muted'>Nie mają dla ciebie roboty.</p>" : ""}`,
        acts: {
          take: () => { P.quests.push(q); SET.quest = null; toast("Nowe zadanie: " + q.text, PAL.gold); re(); },
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
    case "siege": {
      const inSiege = s.siegeBy.includes(p.id);
      const def = troopCount(s.garrison);
      const lordsInside = w.parties.filter((o) => o.kind === "lord" && o.faction === s.faction && dist(o.x, o.y, s.cx * WCELL, s.cy * WCELL) < 20);
      return {
        html: `<p>${s.name} broni ${def} ludzi załogi${lordsInside.length ? ` i armie: ${lordsInside.map((l) => l.name).join(", ")}` : ""}.</p>
          ${inSiege ? `<p>Oblężenie trwa ${s.siegeDays} dni. ${s.siegeDays >= 1 ? "Drabiny gotowe." : "Ludzie zbijają drabiny (1 dzień)."}</p>
            <div class="btns"><button data-a="assault" ${s.siegeDays >= 1 ? "" : "disabled"}>Szturm!</button><button class="alt" data-a="waitDay">Czekaj dzień</button><button class="alt" data-a="lift">Odstąp</button></div>`
            : `<p>Oblężenie zablokuje dostawy i da czas na zbicie drabin. Obrońcy mają przewagę murów.</p><div class="btns"><button data-a="besiege">Rozpocznij oblężenie</button></div>`}
          <p class="tip">Twoja siła: ${Math.round(partyPower(w, p))} · obrońcy: ${Math.round(troopPower(s.garrison) * 1.6 + lordsInside.reduce((a, l) => a + partyPower(w, l), 0))} (z murami)</p>`,
        acts: {
          besiege: () => { s.siegeBy.push(p.id); p.siege = s.id; if (s.siegeBy.length === 1) s.siegeDays = 0; chron(w, `${P.name} oblega ${s.name}.`, PAL.redL); re(); },
          waitDay: () => { closeScreen(); G.waitHours = 24; G.camping = true; p.state = "camp"; pendingAfterWait = () => { s.siegeDays = Math.max(s.siegeDays, 1); enterSettlement(s); SET.tab = "siege"; renderSettlement(); }; },
          lift: () => { s.siegeBy = s.siegeBy.filter((id) => id !== p.id); p.siege = undefined; closeScreen(); },
          assault: () => {
            const enemies = lordsInside;
            launchBattle({ kind: "siege", enemies, allies: nearbyAlliesOf(s), settlement: s, enemyTroops: s.garrison, title: `Szturm na ${s.name}` });
          },
        },
      };
    }
  }
  return { html: "", acts: {} };
}
function nearbyAlliesOf(s: Settlement): Party[] { const w = WORLD, p = playerParty(w); return w.parties.filter((o) => o.kind === "lord" && !hostile(w, p, o) && atWar(w, o.faction, s.faction) && dist(o.x, o.y, s.cx * WCELL, s.cy * WCELL) < 40); }
function troopTable(list: Troop[], act: string) {
  if (!list.length) return "<p class='muted'>Pusto.</p>";
  return `<table class="tbl">${list.map((t) => `<tr><td>${unitBadge(t.type)} ${UNITS[t.type].name}</td><td>${t.n}${t.wounded ? ` <span class="bad">(${t.wounded})</span>` : ""}</td><td><button class="mini" data-a="${act}" data-v="${t.type}:1">1</button><button class="mini" data-a="${act}" data-v="${t.type}:all">Wszyscy</button></td></tr>`).join("")}</table>`;
}
function unitBadge(k: string) { const d = UNITS[k]; const c = d.mount ? "cav" : d.bow ? "rng" : d.ability ? "spc" : "inf"; return `<span class="ub ${c}">${c === "cav" ? "J" : c === "rng" ? "S" : c === "spc" ? "M" : "P"}</span>`; }
function abilityWord(a: string) { return ({ priest: "leczy, pali nieumarłych", mage: "kule ognia", shaman: "okrzyk krwi", necro: "wskrzesza", deathtouch: "dotyk śmierci" } as any)[a] || a; }
function itemName(it: Item) { return `<b class="t${it.tier}">${it.name}</b>`; }
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
  if (k === 2) { const t = w.settlements.filter((x) => x.kind === "town")[h % 10 % w.settlements.filter((x) => x.kind === "town").length]; const g = GOOD_KEYS[(h >> 4) % GOOD_KEYS.length]; return `W ${t.name} ${GOODS[g].name.toLowerCase()} ${t.stock[g] < 20 ? "jest drogie, brakuje go" : "jest tanie, mają go w bród"}.`; }
  if (k === 3) { const wars: string[] = []; for (const a of [1, 2, 3, 4, 5]) for (const b of [1, 2, 3, 4, 5]) if (a < b && w.factions[a].war[b]) wars.push(`${factionShort(a)} z ${factionShort(b)}`); return wars.length ? `Wojna trwa: ${wars.slice(0, 3).join(", ")}.` : "Podobno wszędzie pokój. Nie potrwa długo."; }
  return pick(["Martwi wstają z grobów coraz bliżej traktu.", "Zbóje grasują przy brodach.", "Ktoś widział Rycerza Śmierci na północy.", "Krasnoludy płacą dobrze za żelazo i piwo.", "Orkowie napadają na karawany w nocy."]);
}

function restInSettlement(s: Settlement) {
  const w = WORLD, P = w.player;
  const cost = s.owner === -2 ? 0 : Math.ceil((troopCount(playerParty(w).troops) + 1) / 4) + 5;
  if (P.gold < cost) { toast("Nie stać cię na nocleg.", PAL.redL); return; }
  P.gold -= cost;
  closeScreen();
  G.waitHours = 24; G.camping = true; playerParty(w).state = "camp";
  toast(`Odpoczynek w ${s.name}${cost ? ` (${cost} denarów)` : ""}. Rany goją się szybciej.`);
  pendingAfterWait = () => enterSettlement(s);
}

function raidVillage(s: Settlement) {
  const w = WORLD, P = w.player;
  const mil = RECRUITS[s.culture]?.village[0] || "b_bandit";
  const n = Math.round(6 + s.prosperity / 8);
  launchBattle({ kind: "field", enemies: [], allies: [], enemyTroops: [{ type: mil, n, wounded: 0, xp: 0 }], settlement: s, title: `Grabież: ${s.name}`, onWin: (lines) => {
    s.raided = 14; s.prosperity = Math.max(5, s.prosperity - 25);
    const loot = Math.round(150 + s.prosperity * 4);
    P.gold += loot; P.goods.grain = (P.goods.grain || 0) + 10; P.goods.meat = (P.goods.meat || 0) + 4; P.honor -= 4; s.relation -= 30;
    for (const L of w.lords) if (L.faction === s.faction) L.relation -= 3;
    lines.push(`Łupy z wioski: ${loot} denarów i żywność. Honor spada.`);
    chron(w, `${P.name} pustoszy wioskę ${s.name}.`, PAL.redL);
  } });
}

// ---------- Zadania ----------
function offerQuest(s: Settlement): Quest | null {
  const w = WORLD, P = w.player;
  if (P.quests.some((q) => !q.done && q.giver === s.id)) return null;
  const h = hashInt(s.seed + w.day);
  const kinds: Quest["kind"][] = s.kind === "village" ? ["grain", "wolves", "bandits"] : ["bandits", "letter", "bandits"];
  const kind = kinds[h % kinds.length];
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
  if (kind === "grain") { const n = 8 + (h % 10); return { id, kind, giver: s.id, target: s.id, amount: n, reward: n * 22, days: 10, text: `Przywieź ${n} worków zboża do ${s.name}. Ludzie głodują.`, done: false }; }
  const lair = w.places.filter((p) => p.kind === "lair" && p.cleared <= 0).sort((a, c) => dist(a.cx, a.cy, s.cx, s.cy) - dist(c.cx, c.cy, s.cx, s.cy))[0];
  if (!lair) return null;
  lair.seen = true; w.explored[cidx(lair.cx, lair.cy)] = 1;
  return { id, kind: "wolves", giver: s.id, target: lair.id, amount: 0, reward: 260, days: 14, text: `Wytęp bestie z miejsca ${lair.name}. Porywają bydło i dzieci.`, done: false };
}
function completeQuest(q: Quest, lines: string[]) {
  const w = WORLD, P = w.player;
  q.done = true; q.days = 0;
  P.gold += q.reward; P.renown += 8; P.honor += 1;
  const s = w.settlements[q.giver]; if (s) s.relation += 8;
  gainXp(P, 60 + Math.round(q.reward / 5), lines);
  lines.push(`Zadanie wykonane: ${q.text} Nagroda: ${q.reward} denarów.`);
  chron(w, `${P.name} wykonuje zadanie dla ${s ? s.name : "ludzi"}.`, PAL.moss);
}

// ---------- Arena ----------
const ARENA_FOES = ["m_sword", "a_maa", "v_legion", "o_warrior", "d_shield", "v_veteran", "o_berserk", "a_guard", "a_knight", "d_warden"];
function arenaFight(s: Settlement, team: boolean, tournament: boolean, round: number, bet: number) {
  const w = WORLD, P = w.player;
  const tier = tournament ? round + 1 : Math.min(3, 1 + Math.floor(P.level / 4));
  const pool = ARENA_FOES.filter((k) => UNITS[k] && UNITS[k].tier <= tier + 1 && UNITS[k].tier >= Math.max(1, tier - 1));
  const foes: Troop[] = [];
  const n = team ? 3 : 1;
  for (let i = 0; i < n; i++) addTroops(foes, pick(pool.length ? pool : ["m_sword"]), 1);
  launchBattle({ kind: "arena", enemies: [], allies: [], enemyTroops: foes, settlement: s, arena: { tournament, round, bet, team }, title: tournament ? `Turniej: runda ${round}` : team ? "Arena: drużyny" : "Arena: pojedynek" });
}
function arenaFinished(r: BattleResult) {
  const ctx = G.ctx, w = WORLD, P = w.player, s = ctx.settlement, A = ctx.arena;
  P.hp = Math.max(P.hp, heroMaxHp(P) * 0.5);
  G.battle = null;
  const lines: string[] = [];
  if (r.win && !r.heroKO) {
    if (A.tournament) {
      if (A.round >= 4) {
        const prize = 600 + A.bet * 3;
        P.gold += prize; P.renown += 60; s.relation += 10;
        for (const L of w.lords) if (L.faction === s.faction) L.relation += 2;
        lines.push(`Wygrywasz turniej w ${s.name}! Nagroda: ${prize} denarów i wielka sława.`);
        chron(w, `${P.name} wygrywa turniej w ${s.name}.`, PAL.gold);
        s.tournament = 0;
        gainXp(P, 250, lines);
      } else {
        lines.push(`Runda ${A.round} wygrana. Następny przeciwnik będzie lepszy.`);
        showAftermath(r, 0, [], lines, () => arenaFight(s, false, true, A.round + 1, A.bet));
        return;
      }
    } else { const prize = A.team ? 70 : 40; P.gold += prize; P.renown += 2; lines.push(`Wygrana na arenie: ${prize} denarów.`); gainXp(P, 30, lines); }
  } else {
    lines.push(A.tournament ? `Odpadasz z turnieju w rundzie ${A.round}.${A.bet ? ` Zakład (${A.bet}) przepada.` : ""}` : "Leżysz na piasku. Tłum gwiżdże.");
  }
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
    const canLearn = ["smite", "heal"].filter((a) => !P.learned.includes(a));
    const canUp = P.learned.includes("smite") && (P.abLevels.smite || 1) < 2;
    btns += `<button class="alt" data-a="offer" ${P.gold >= 300 && (canLearn.length || canUp) ? "" : "disabled"}>Złóż ofiarę (300): ${canUp && P.level >= 5 ? "Smite poziom 2" : canLearn.length ? ABILITIES[canLearn[0]].name : "nic więcej"}</button>`;
    acts.pray = () => { P.faith = 100; P.hp = Math.min(heroMaxHp(P), P.hp + heroMaxHp(P) * 0.3); P.morale = Math.min(100, P.morale + 5); P.corruption = Math.max(0, P.corruption - 10); pl.cleared = 3; sfx.heal(); toast("Wiara odnowiona, spaczenie słabnie.", PAL.gold); enterPlace(pl); };
    acts.offer = () => {
      if (canUp && P.level >= 5) { P.abLevels.smite = 2; P.gold -= 300; toast("Smite poziom 2: słup świętego światła!", PAL.gold); }
      else if (canLearn.length) { P.learned.push(canLearn[0]); P.gold -= 300; const free = P.abilities.indexOf(""); if (free >= 0) P.abilities[free] = canLearn[0]; toast(`Nowa umiejętność: ${ABILITIES[canLearn[0]].name}.`, PAL.gold); }
      else if (canUp) { toast("Potrzebujesz 5. poziomu, by pojąć tę moc.", PAL.ash); return; }
      sfx.smite(); enterPlace(pl);
    };
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
    surrender: () => { // wróg poddaje się bez walki
      const lines: string[] = [];
      for (const t of o.troops) addTroops(p.prisoners, t.type, Math.floor(t.n * 0.6));
      P.gold += o.gold; P.renown += 5;
      lines.push(`${o.name} składa broń. Bierzesz jeńców i ${o.gold} denarów.`);
      removeParty(w, o);
      lines.forEach((l) => toast(l, PAL.gold)); closeScreen();
    },
  };
  let btns = "";
  if (host) {
    btns += `<button data-a="fight">Do ataku!</button>`;
    if (o.kind === "caravan" || o.kind === "villagers" || (o.kind === "bandit" && myPow > theirPow * 3)) btns += `<button class="alt" data-a="surrender">Zażądaj kapitulacji</button>`;
    if (L) btns += `<button class="alt" data-a="talk">Rozmawiaj</button>`;
    if (o.kind === "bandit" && ambushed && P.gold > 20) btns += `<button class="alt" data-a="pay">Zapłać (${Math.round(P.gold * 0.25)})</button>`;
    if (ambushed) { btns += `<button class="alt" data-a="flee">Uciekaj</button>`; if (troopCount(p.troops) > 3) btns += `<button class="alt" data-a="rear">Zostaw straż tylną</button>`; }
    else btns += `<button class="alt" data-a="leave">Odejdź</button>`;
  } else {
    if (L) btns += `<button data-a="talk">Rozmawiaj</button>`;
    btns += `<button class="alt danger" data-a="attackNeutral">Atakuj</button><button class="alt" data-a="leave">Odejdź</button>`;
  }
  showScr(`<div class="dialog frame meet">
    <div class="meet-top">${pic(portrait, "portrait big")}<div><h1>${esc(o.name)}</h1><p class="muted">${factionName(o.faction)}</p><p>${greet}</p></div></div>
    <p>${partyDesc(o)}</p>
    ${helpers.length ? `<p class="bad">Na pomoc idą: ${helpers.map((h) => h.name).join(", ")}.</p>` : ""}
    ${allies.length ? `<p class="gold">Twoi sojusznicy w pobliżu: ${allies.map((h) => h.name).join(", ")}.</p>` : ""}
    ${host ? `<p class="tip">Siła: twoja ${Math.round(myPow)} · wroga ${Math.round(theirPow)} · ${strengthWord(myPow / Math.max(0.1, theirPow))}</p>` : ""}
    <div class="btns">${btns}</div></div>`, acts, "dialog-scr");
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
  const say = (t: string) => { const e = document.getElementById("lord-say"); if (e) e.textContent = t; };
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
      L.relation += 10; refreshMapHud();
    };
  }
  if (L.ruler && P.liege === L.faction && P.status === "wasal") {
    opts.push(`<button class="alt" data-a="unvassal">Zwolnij mnie z przysięgi</button>`);
    acts.unvassal = () => { leaveLiege(w, false); L.relation -= 15; chron(w, `${P.name} zrzeka się przysięgi wobec ${factionName(L.faction)}.`); say("„Idź więc. Ale nie wracaj z mieczem.”"); refreshMapHud(); };
  }
  if (L.ruler && playerAtWarWith(w, L.faction) && (P.status === "król" || P.liege === 0) && L.faction !== 5) {
    const price = 400 + Math.round(P.renown);
    opts.push(`<button class="alt" data-a="peace">Zaproponuj pokój (${price} denarów)</button>`);
    acts.peace = () => {
      if (P.gold < price) { say("„Pokój kosztuje. Nie masz tyle.”"); return; }
      if (L.relation < -40 && chance(0.6)) { say("„Prędzej zgniję, niż podam ci rękę.”"); return; }
      P.gold -= price;
      if (P.status === "król") setWar(w, PLAYER_FACTION, L.faction, false); else { P.wars = P.wars.filter((f) => f !== L.faction); chron(w, `${P.name} zawiera pokój z ${factionName(L.faction)}.`, PAL.moss); }
      L.relation += 10; say("„Niech będzie. Na razie.”"); refreshMapHud();
    };
  }
  if (P.status === "król" && !L.ruler && L.faction !== PLAYER_FACTION && L.faction !== 5) {
    opts.push(`<button class="alt" data-a="defect">Przyłącz się do mojego królestwa</button>`);
    acts.defect = () => {
      const chanceOk = (L.relation - 20) / 60 + (L.personality === "chciwy" ? 0.2 : L.personality === "honorowy" ? -0.3 : 0) + P.renown / 2000;
      if (L.relation < 20 || !chance(clamp(chanceOk, 0.05, 0.85))) { say("„Nie zdradzę swego władcy.”"); L.relation -= 3; return; }
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
    acts.gift = () => { if (P.gold < 200) return; P.gold -= 200; L.relation += L.personality === "chciwy" ? 8 : 4; say("„Hojność zostanie zapamiętana.”"); };
  }
  const line = L.personality === "okrutny" ? "„Mów szybko, nie lubię czekać.”" : L.personality === "chciwy" ? "„Co mi przynosisz?”" : L.personality === "ostrożny" ? "„Słucham. Ostrożnie dobieraj słowa.”" : "„Słucham cię.”";
  showScr(`<div class="dialog frame meet">
    <div class="meet-top">${pic(portrait, "portrait big")}<div><h1>${L.title} ${L.name}</h1><p class="muted">${factionName(L.faction)}${L.ruler ? " · władca" : ""} · ${L.personality}</p><p>Nastawienie: ${relWord} (${L.relation})</p></div></div>
    <p id="lord-say">${line}</p>
    <div class="col-btns">${opts.join("")}<button class="alt" data-a="back">Żegnaj</button></div></div>`, acts, "dialog-scr");
}

// ---------- Po bitwie ----------
function showAftermath(r: BattleResult, gold: number, items: string[], lines: string[], next?: () => void) {
  const w = WORLD, P = w.player;
  const cas = (list: Casualty[]) => list.length ? `<table class="tbl">${list.map((c) => `<tr><td>${UNITS[c.type].name}</td><td class="bad">${c.killed} pol.</td><td class="muted">${c.wounded} rann.</td></tr>`).join("")}</table>` : "<p class='muted'>Bez strat.</p>";
  const title = r.win ? (r.heroKO ? "Zwycięstwo, choć padłeś" : "Zwycięstwo") : r.retreated ? "Odwrót" : "Klęska";
  showScr(`<div class="card frame after">
    <h1 class="${r.win ? "gold" : "bad"}">${title}</h1>
    <p class="tip">Czas bitwy: ${Math.round(r.time)} s · zabitych wrogów: ${r.enemyKilled} · twoje zabójstwa: ${r.heroKills}</p>
    <div class="cols"><div><h2>Twoje straty</h2>${cas(r.ours)}${r.allies.length ? `<h2>Sojusznicy</h2>${cas(r.allies)}` : ""}</div>
    <div><h2>Straty wroga</h2>${cas(r.theirs)}</div></div>
    ${gold || items.length ? `<h2>Łupy</h2><p>${gold ? `${gold} denarów` : ""}${items.length ? `${gold ? " · " : ""}${items.map((i) => ITEMS[i].name).join(", ")}` : ""}</p>` : ""}
    ${r.prisoners.length ? `<p>Jeńcy: ${r.prisoners.map((p) => `${p.n}× ${UNITS[p.type].name}`).join(", ")}</p>` : ""}
    ${lines.map((l) => `<p>${l}</p>`).join("")}
    <div class="btns"><button data-a="next">Dalej</button></div></div>`, {
    next: () => {
      closeScreen();
      G.state = "map";
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
function showCharacter() {
  const w = WORLD, P = w.player;
  const portrait = drawPortrait(heroCfgFromPlayer(P).look, PAL.gold);
  const O = ORIGINS[P.origin];
  const techAvail = Math.floor(P.level / 3) - P.learned.filter((a) => ABILITIES[a].source === "drzewko" && !O.abilities.includes(a)).length;
  const tech = ["warcry", "bash", "whirl", "focus"].filter((a) => !P.learned.includes(a));
  const nextXp = xpForLevel(P.level + 1), prevXp = xpForLevel(P.level);
  showScr(`<div class="card frame wide">
    <div class="char-top">${pic(portrait, "portrait big")}<div><h1>${esc(P.name)}</h1><p class="muted">${RACES[P.race].name} · ${O.name} · poziom ${P.level}</p>
      ${barHtml(P.xp - prevXp, nextXp - prevXp, "xp", `${P.xp}/${nextXp} PD`)}
      <p>Zdrowie ${Math.round(P.hp)}/${heroMaxHp(P)} · Sława ${P.renown} · Honor ${P.honor} · Zabici ${P.kills} · Wygrane bitwy ${P.battlesWon}</p>
      <p>Wiara ${Math.round(P.faith)} · Mana ${Math.round(P.mana)} · <span class="${P.corruption > 50 ? "bad" : ""}">Spaczenie ${Math.round(P.corruption)}</span></p></div></div>
    <div class="cols">
      <div><h2>Atrybuty ${P.attrPts ? `<span class="gold">(${P.attrPts} pkt)</span>` : ""}</h2>
        ${Object.keys(ATTR_NAME).map((k) => `<div class="row"><span>${ATTR_NAME[k]}</span><span>${P.attr[k]} <button class="mini" data-a="attr" data-v="${k}" ${P.attrPts ? "" : "disabled"}>+</button></span></div>`).join("")}
        <p class="tip">Siła: obrażenia i zdrowie · Zręczność: ucieczka z niewoli · Intelekt: mana · Charyzma: wiara i większa armia.</p>
        <h2>Umiejętności ${P.skillPts ? `<span class="gold">(${P.skillPts} pkt)</span>` : ""}</h2>
        ${Object.keys(SKILL_NAME).map((k) => `<div class="row"><span>${SKILL_NAME[k]}</span><span>${P.skills[k]} <button class="mini" data-a="skill" data-v="${k}" ${P.skillPts && P.skills[k] < 10 ? "" : "disabled"}>+</button></span></div>`).join("")}
      </div>
      <div><h2>Umiejętności aktywne (klawisze 1–3)</h2>
        ${[0, 1, 2].map((i) => `<div class="row"><span><span class="key">${i + 1}</span>${P.abilities[i] ? ABILITIES[P.abilities[i]].name + (P.abilities[i] === "smite" ? ` (poz. ${P.abLevels.smite || 1})` : "") : "<span class='muted'>pusty</span>"}</span></div>`).join("")}
        <h2>Poznane</h2>
        ${P.learned.map((a) => { const A = ABILITIES[a]; return `<div class="abl"><b>${A.name}</b> <span class="muted">${RES_NAME[A.res]} ${A.cost} · odnowienie ${A.cd} s${A.corrupt ? ` · spaczenie +${A.corrupt}` : ""}</span><br><span class="tip">${A.desc}</span><br>${[0, 1, 2].map((i) => `<button class="mini" data-a="slot" data-v="${a}:${i}">Slot ${i + 1}</button>`).join("")}</div>`; }).join("")}
        ${techAvail > 0 && tech.length ? `<h2 class="gold">Nowa technika do wyboru</h2>${tech.map((a) => `<div class="row"><span>${ABILITIES[a].name}</span><button class="mini" data-a="learn" data-v="${a}">Poznaj</button></div>`).join("")}` : ""}
        <p class="tip">Modlitwy (Smite, Leczenie) dają kapliczki. Zaklęcia z ksiąg znajdziesz w ruinach. Techniki bojowe poznajesz co 3 poziomy.</p>
      </div>
    </div>
    <div class="btns"><button data-a="close">Zamknij (C)</button></div></div>`, {
    attr: (k) => { if (P.attrPts <= 0) return; P.attr[k]++; P.attrPts--; if (k === "str") P.hp += 4; showCharacter(); },
    skill: (k) => { if (P.skillPts <= 0) return; P.skills[k]++; P.skillPts--; if (k === "ironflesh") P.hp += 6; showCharacter(); },
    slot: (v) => { const [a, i] = v.split(":"); const idx = Number(i); const prev = P.abilities.indexOf(a); if (prev >= 0) P.abilities[prev] = P.abilities[idx] || ""; P.abilities[idx] = a; showCharacter(); },
    learn: (a) => { P.learned.push(a); const free = P.abilities.indexOf(""); if (free >= 0) P.abilities[free] = a; showCharacter(); },
    close: () => closeScreen(),
  }, "char-scr");
}

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
      <div class="slots">${slots.map((s) => { const id = P.equip[s]; const it = id ? ITEMS[id] : null; return `<div class="slot"><span class="muted">${SLOT_NAME[s]}</span><span>${it ? `${itemName(it)} <span class="muted">${itemStat(it)}</span>` : "<span class='muted'>—</span>"}</span>${it ? `<button class="mini" data-a="off" data-v="${s}">Zdejmij</button>` : ""}</div>`; }).join("")}</div>
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

function showParty() {
  const w = WORLD, P = w.player, p = playerParty(w);
  const rows = p.troops.slice().sort((a, b) => UNITS[b.type].tier - UNITS[a.type].tier).map((t) => {
    const d = UNITS[t.type];
    const need = d.xp || 100 * d.tier;
    const can = d.up && d.up.length ? Math.min(t.n - t.wounded, Math.floor(t.xp / need)) : 0;
    const ups = (d.up || []).map((u) => { const cost = Math.max(10, Math.round((UNITS[u].cost - d.cost) * 0.5)); return `<button class="mini" data-a="up" data-v="${t.type}:${u}" ${can > 0 && P.gold >= cost ? "" : "disabled"}>→ ${UNITS[u].name} (${cost})</button>`; }).join("");
    return `<tr><td>${unitBadge(t.type)} ${d.name} <span class="muted">T${d.tier}</span></td><td>${t.n}${t.wounded ? ` <span class="bad">(${t.wounded} rann.)</span>` : ""}</td><td>${d.up && d.up.length ? `${can} gotowych` : "<span class='muted'>szczyt</span>"}</td><td>${ups}</td><td><button class="mini" data-a="dismiss" data-v="${t.type}">Zwolnij 1</button></td></tr>`;
  }).join("");
  showScr(`<div class="card frame wide">
    <h1>Armia</h1>
    <p>Ludzie: ${troopCount(p.troops) + 1 + P.companions.length}/${partyLimit(w)} · Żołd: ${partyWages(w)}/dzień (wypłata co 7 dni) · Morale ${Math.round(P.morale)} · Szybkość ${partySpeed(w, p).toFixed(1)}</p>
    <table class="tbl wide">${rows || "<tr><td class='muted'>Nikt za tobą nie idzie.</td></tr>"}</table>
    <h2>Kompani</h2>${P.companions.length ? P.companions.map((c) => `<div class="comp">${pic(drawPortrait(c.look, PAL.bone), "portrait")}<div><b>${c.name}</b> <span class="muted">${c.role} · zdrowie ${Math.round(c.hp)}/${c.maxHp}</span><br>Dowodzi w bitwie: ${[1, 2, 3].map((s) => `<button class="mini ${c.squad === s ? "on" : ""}" data-a="sq" data-v="${c.id}:${s}">${SQUAD_NAMES[s]}</button>`).join("")} <button class="mini" data-a="fire" data-v="${c.id}">Odpraw</button></div></div>`).join("") : "<p class='muted'>Brak. Szukaj w karczmach.</p>"}
    ${p.prisoners.length ? `<h2>Jeńcy</h2><p>${p.prisoners.map((t) => `${t.n}× ${UNITS[t.type].name}`).join(", ")} <button class="mini" data-a="freeP">Uwolnij wszystkich</button></p><p class="tip">Sprzedasz ich handlarzowi okupu w karczmie. Czasem sami przechodzą na twoją stronę.</p>` : ""}
    <p class="tip">Żołnierze zdobywają doświadczenie w bitwach. Awans kosztuje złoto i daje lepszą broń i pancerz. P: piechota, S: strzelcy, J: jazda, M: magowie i kapłani.</p>
    <div class="btns"><button data-a="close">Zamknij (P)</button></div></div>`, {
    up: (v) => { const [from, to] = v.split(":"); const d = UNITS[from], t = p.troops.find((x) => x.type === from); const need = d.xp || 100 * d.tier; const cost = Math.max(10, Math.round((UNITS[to].cost - d.cost) * 0.5)); if (!t || t.xp < need || P.gold < cost) return; P.gold -= cost; t.xp -= need; removeTroops(p.troops, from, 1); addTroops(p.troops, to, 1); sfx.coin(); showParty(); },
    dismiss: (k) => { removeTroops(p.troops, k, 1); showParty(); },
    sq: (v) => { const [id, s] = v.split(":"); const c = P.companions.find((x) => x.id === id); c.squad = Number(s); showParty(); },
    fire: (id) => { const c = P.companions.find((x) => x.id === id); P.companions = P.companions.filter((x) => x.id !== id); const t = pick(w.settlements.filter((s) => s.kind === "town")); t.companions.push(id); toast(`${c.name} odchodzi. Może kiedyś spotkacie się w ${t.name}.`); showParty(); },
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
  showScr(`<div class="card frame"><h1>Zadania</h1>${act.length ? act.map((q) => `<p>${q.text}<br><span class="muted">Zleca: ${w.settlements[q.giver]?.name || "?"} · nagroda ${q.reward} · zostało ${q.days} dni</span></p>`).join("") : "<p class='muted'>Brak zadań. Rady miast i sołtysi wiosek mają robotę.</p>"}<div class="btns"><button data-a="close">Zamknij (J)</button></div></div>`, { close: () => closeScreen() }, "quest-scr");
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

function showSettings(back: () => void) {
  showScr(`<div class="card frame small"><h1>Ustawienia</h1><div class="menu">
    <label><input type="checkbox" data-in="dmg" ${settings.damageNumbers ? "checked" : ""}> Liczby obrażeń</label>
    <label><input type="checkbox" data-in="gesture" ${settings.gesture ? "checked" : ""}> Kierunek ciosu ruchem myszy</label>
    <label><input type="checkbox" data-in="music" ${settings.music ? "checked" : ""}> Muzyka</label>
    <label>Głośność <input type="range" min="0" max="100" value="${Math.round(settings.volume * 100)}" data-in="vol"></label>
    <label>Wielkość bitew (na stronę) <select data-in="size">${[60, 100, 150].map((n) => `<option value="${n}" ${settings.battleSize === n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
  </div>
  <div class="btns"><button class="alt" data-a="fs">${document.fullscreenElement ? "Wyjdź z pełnego ekranu" : "Pełny ekran"}</button><button data-a="back">Gotowe</button></div></div>`, {
    dmg: (v) => { settings.damageNumbers = !!v; saveSettings(); },
    gesture: (v) => { settings.gesture = !!v; saveSettings(); },
    music: (v) => { settings.music = !!v; if (sfx.musicOn !== settings.music) sfx.toggleMusic(); saveSettings(); },
    vol: (v) => { settings.volume = Number(v) / 100; sfx.setVolume(settings.volume); saveSettings(); },
    size: (v) => { settings.battleSize = Number(v); saveSettings(); },
    fs: () => { toggleFullscreen(); setTimeout(() => showSettings(back), 300); },
    back: () => back(),
  }, "set-scr");
}

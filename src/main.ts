// Start gry: płótno, skalowanie, przybliżenie, pętla, HUD bitwy i mapy, klawisze, ustawienia, pełny ekran.

const BUILD = "Build 0.26";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = W; canvas.height = H;
let ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const input = new Input();
input.attach(canvas);
const sfx = new Sfx();
buildSprites();

const MOOD_HOLD = { m: "", until: 0 };
const settings: Settings = { autoCamp: true,
  damageNumbers: true, gesture: false, music: true, volume: 0.8, battleSize: 100,
  musicVol: 0.6, shake: 1, killSlow: true, blood: 1, hpBars: "near", tells: false, dirHint: true,
  questMarkers: true, questArrows: true, partyNames: "lords", autosaveDays: 2, uiScale: 1, toastsOn: true, pauseOnEvent: true, fewLog: true, minimap: true,
  atkMode: "mouse", horseMode: "dir", deploy: true, borders: true, typeText: true, voices: true, gore: true, dmgHeroOnly: true, outline: true,
  fxVol: 1, voiceVol: 1, uiVol: 0.8, keys: {}, seenTips: [], loadScreens: true, mapText: 1, density: 1,
};
try {
  const s = JSON.parse(localStorage.getItem("sztandary-settings") || "null");
  if (s) { Object.assign(settings, s); if (!s.ver || s.ver < 9) { settings.tells = false; settings.atkMode = s.gesture ? "screen" : "mouse"; settings.dmgHeroOnly = true; } }
  if (s && (!s.ver || s.ver < 10) && settings.uiScale === 1) settings.uiScale = 1.15;   // B14: większa czcionka domyślnie
  if (!s) settings.uiScale = 1.15;
  if (settings.keys && settings.keys.dodge === "Space") delete settings.keys.dodge;   // B23: Spacja to pauza taktyczna
  (settings as any).ver = 10;
} catch (e) { /* bez zapisu ustawień */ }
function saveSettings() { try { localStorage.setItem("sztandary-settings", JSON.stringify(settings)); } catch (e) { /* ignoruj */ } }
sfx.volume = settings.volume;
sfx.musicVol = settings.musicVol;
sfx.busVol = { fx: settings.fxVol ?? 1, voice: settings.voiceVol ?? 1, ui: settings.uiVol ?? 0.8 };
applyUiScale();
function applyUiScale() { document.getElementById("wrap").style.setProperty("--uis", String(settings.uiScale)); }
sfx.musicOn = settings.music;
sfxUi = () => sfx.ui();
toastStamp = () => WORLD ? [WORLD.day, Math.floor(WORLD.hour)] : [0, 0];
seenTip = (id) => (settings.seenTips || []).includes(id);
markTip = (id) => { (settings.seenTips ||= []).push(id); saveSettings(); };
// przypisywanie klawiszy: następny wciśnięty klawisz trafia do czekającej akcji
let KEYWAIT = "";
let KEYBACK: (() => void) | null = null;
addEventListener("keydown", (e) => {
  if (!KEYWAIT) return;
  e.preventDefault(); e.stopImmediatePropagation();
  if (e.code !== "Escape") { (settings.keys ||= {})[KEYWAIT] = e.code; saveSettings(); }
  KEYWAIT = "";
  if (KEYBACK) showSettings(KEYBACK);
}, true);
addLogMsg = (t, c) => { if (G.state === "map") toast(t, c); };
// drobne starcia (napady na chłopów, karawany, zbójów) zostają w kronice, ale nie zalewają ekranu
const MINOR_EV = /napad na chłopów|złupili karawanę|rozgromił:|odbudowuje się|wraca z niewoli|ogłoszono turniej/;
onChronicle = (t, c) => { if (G.state === "map" && WORLD && settings.toastsOn && !(MINOR_EV.test(t) && !t.includes(WORLD.player.name))) { const p = playerParty(WORLD); if (p) toast(t, c || PAL.bone); } };

let zoomIdx = 1;
const $ = (id: string) => document.getElementById(id);
document.title = "Sztandary Popiołu · " + BUILD;
for (const e of Array.from(document.querySelectorAll("[data-ic]"))) (e as HTMLElement).innerHTML = ic((e as HTMLElement).dataset.ic);
$("build").textContent = BUILD;

let RES_READY = false;
function fit() {
  // gra wypełnia całe okno; proporcje obrazu idą za oknem, a piksele gry skalują się płynnie
  const iw = innerWidth, ih = innerHeight;
  ASPECT = clamp(ih / iw, 0.42, 0.8);
  const wrap = $("wrap");
  const ww = Math.min(iw, Math.round(ih / ASPECT)), wh = Math.min(ih, Math.round(ww * ASPECT));
  wrap.style.width = ww + "px";
  wrap.style.height = wh + "px";
  wrap.style.setProperty("--s", String(Math.max(1, Math.min(ww / 480, wh / 270))));
  for (const z of ZOOMS) z[1] = Math.round(z[0] * ASPECT);
  if (RES_READY) { for (const z of MAPZ) z[1] = Math.round(z[0] * ASPECT); const want = Math.round(W * ASPECT); if (want !== H) setRes(W, want); }
}
addEventListener("resize", fit);
document.addEventListener("fullscreenchange", fit);
fit();
function toggleFullscreen() {
  try {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  } catch (e) { toast("Pełny ekran niedostępny w tym oknie.", PAL.ash); }
}

// Mapa świata: płynne przybliżanie kółkiem (wiele stopni, przejście klatka po klatce).
const MAPZ: [number, number][] = []; for (let wd = 320; wd <= 1600; wd += 32) MAPZ.push([wd, Math.round(wd * ASPECT)]);
// domyślne przybliżenie zależy od ekranu: ok. 2,4 piksela ekranu na piksel gry na mapie, ok. 1,6 w bitwie (dużo jednostek, kamera dalej)
const wantMapW = clamp(Math.round($("wrap").clientWidth / 2.4 / 32) * 32, 480, 1120);
let mapZ = Math.max(0, MAPZ.findIndex((z) => z[0] >= wantMapW)), mapZT = mapZ;
zoomIdx = ZOOMS.reduce((bi, z, i) => Math.abs(z[0] - $("wrap").clientWidth / 1.6) < Math.abs(ZOOMS[bi][0] - $("wrap").clientWidth / 1.6) ? i : bi, 3);
function setRes(nw: number, nh: number) {
  if (nw === W && nh === H) return;
  const cam = G.state === "battle" && G.battle ? G.battle.cam : G.view.cam;
  const cx = cam.x + W / 2, cy = cam.y + H / 2;
  [W, H] = [nw, nh];
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  cam.x = cx - W / 2; cam.y = cy - H / 2;
  if (G.battle) G.battle.makeOverlays();
}
RES_READY = true;
setRes(MAPZ[mapZ][0], MAPZ[mapZ][1]);
function setZoom(i: number) {
  i = clamp(i, 0, ZOOMS.length - 1);
  if (i === zoomIdx) return;
  const cam = G.state === "battle" && G.battle ? G.battle.cam : G.view.cam;
  const cx = cam.x + W / 2, cy = cam.y + H / 2;
  zoomIdx = i;
  [W, H] = ZOOMS[i];
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  cam.x = cx - W / 2; cam.y = cy - H / 2;
  if (G.battle) G.battle.makeOverlays();
}

// ---------- HUD bitwy ----------
const AB_ICON: Record<string, string> = { faith: "cross", mana: "eye", fury: "fire" };
// Minimapa w rogu; w trybie rozkazów (Q) powiększona do mapy taktycznej z numerami oddziałów.
let miniBig = false, miniWant = false;   // mapa taktyczna rozwijana na żądanie (klik w minimapę lub klawisz N)
function drawMini(b: Battle) {
  const cv = $("mini") as HTMLCanvasElement; if (!cv) return;
  if (settings.minimap === false && !b.cmdOpen) { cv.hidden = true; return; }
  cv.hidden = false;
  const big = miniWant && b.phase !== "end";
  if (big !== miniBig) { miniBig = big; cv.className = big ? "big" : ""; $("minitog").textContent = big ? "× zwiń mapę (N)" : "⤢ mapa (N)"; }
  const M = b.map, Wc = big ? 240 : 96, Hc = Math.round(Wc * M.h / M.w);
  if (cv.width !== Wc || cv.height !== Hc) { cv.width = Wc; cv.height = Hc; }
  const g = cv.getContext("2d"), k = Wc / M.w;
  g.clearRect(0, 0, Wc, Hc);
  // teren: pomniejszony obraz pola bitwy (las, wzgórza, rzeka) + przeszkody
  if (M.ground) { g.globalAlpha = big ? 0.95 : 0.7; g.imageSmoothingEnabled = true; g.drawImage(M.ground, 0, 0, M.w, M.h, 0, 0, Wc, Hc); g.globalAlpha = 1; }
  for (const o of M.obstacles || []) { g.fillStyle = (o as any).cover ? "rgba(90,74,52,.8)" : "rgba(20,32,16,.8)"; const r2 = Math.max(1.5, ((o as any).r || 4) * k); g.fillRect(o.x * k - r2 / 2, o.y * k - r2, r2, r2); }
  if (M.wall) { g.fillStyle = "#8a8070"; g.fillRect(M.wall.x0 * k, 0, Math.max(2, (M.wall.x1 - M.wall.x0) * k), Hc); }
  for (const u of b.units) {
    if (!u.active || (u.team === 1 && (u.hidden || (b.hero && !b.isVisibleTo(u, b.hero))))) continue;
    g.fillStyle = u.hero ? "#ffd75e" : u.team === 0 ? (u.squad >= 11 ? "#7fc4e8" : SQUAD_COLORS[u.squad] || "#8fd06a") : "#e0503c";
    const s = u.hero ? 3 : big ? 2 : 1.5;
    g.fillRect(u.x * k - s / 2, u.y * k - s / 2, s, s);
  }
  if (big) {
    g.font = "bold 9px monospace"; g.textAlign = "center";
    for (const sq of b.liveSquads()) { const L = b.squadUnits(sq); if (!L.length) continue; const cx = L.reduce((s, u) => s + u.x, 0) / L.length * k, cy = L.reduce((s, u) => s + u.y, 0) / L.length * k; g.fillStyle = "#000"; g.fillText(String(sq), cx + 1, cy - 4); g.fillStyle = SQUAD_COLORS[sq]; g.fillText(String(sq), cx, cy - 5); }
  }
  g.strokeStyle = "rgba(255,255,255,.5)"; g.strokeRect(b.cam.x * k + 0.5, b.cam.y * k + 0.5, W * k, H * k);
}
const MODE_NAME: Record<string, string> = { hold: "stoją", follow: "za tobą", charge: "szarża", flank: "oskrzydla", ambush: "zasadzka" };
function showBattleHud() { $("bhud").hidden = false; endShown = false; endT = 0; }
function hideBattleHud() { $("bhud").hidden = true; $("cmd").hidden = true; }
let hudT = 0, endShown = false, endT = 0, cmdKey = "";

function battleHud(dt: number) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.08;
  const b = G.battle, h = b.hero, H2 = b.heroCfg;
  if (h) {
    const hpK = clamp(h.hp / h.maxHp, 0, 1);
    $("hp-fill").style.width = hpK * 100 + "%";
    $("hp-fill").className = hpK < 0.3 ? "low" : "";
    $("hp-txt").textContent = `${Math.max(0, Math.round(h.hp))} / ${Math.round(h.maxHp)}`;
    $("st-fill").style.width = clamp(h.stamina, 0, 100) + "%";
    $("horse-row").hidden = !h.mounted;
    if (h.mounted) $("horse-fill").style.width = clamp(h.horseHp / h.horseMax, 0, 1) * 100 + "%";
    $("hero-name").textContent = h.name || "Bohater";
    $("weapon").textContent = h.usingBow ? `Łuk · strzały: ${h.ammo}` : WEAPONS[h.weaponKey].name + (h.hasShield ? " i tarcza" : "");
    const hint = h.mounted && h.weaponKey === "lance" ? (h.couched ? " · Kopia opuszczona!" : " · R: opuść kopię w galopie") : !h.hasShield && !h.usingBow ? " · PPM: blok bronią" : "";
    const ammoTxt = h.usingBow && h.ammo < b.heroAmmoMax ? ` · zbieraj strzały z ziemi` : "";
    $("dir").textContent = (!h.active ? "Ogłuszony" : h.usingBow ? "Przytrzymaj LPM, by naciągnąć" : b.thrustMode && !h.mounted ? `Tryb: PCHNIĘCIE (R)${h.state === "windup" && h.hold > 0.5 ? " · NAŁADOWANY" : ""}` : b.atkMode() !== "keys" ? `Cios: ${DIR_NAME[h.state === "windup" ? h.dir : b.loadDir === "T" && !h.mounted ? h.nextSide : b.loadDir]}${h.state === "windup" && h.hold > 0.5 ? " · NAŁADOWANY" : ""}${h.counterT > 0 ? " · KONTRA!" : ""}` : `Następne cięcie: ${DIR_NAME[h.nextSide]}`) + (h.active ? hint + ammoTxt : "");
    // zasoby: tylko te, których używają umiejętności
    const used = new Set(H2.abilities.filter(Boolean).map((a) => ABILITIES[a].res));
    $("res").innerHTML = (["faith", "mana", "fury"] as Res[]).filter((r) => used.has(r)).map((r) => `<div class="lbl"><span>${RES_NAME[r]}</span><span>${Math.round((H2 as any)[r])}</span></div><div class="bar res-${r}"><i style="width:${clamp((H2 as any)[r], 0, 100)}%"></i></div>`).join("")
      + (H2.corruption > 0 ? `<div class="lbl"><span class="${H2.corruption > 50 ? "bad" : "muted"}">Spaczenie ${Math.round(H2.corruption)}</span></div>` : "");
    // umiejętności
    $("abil").hidden = b.cmdOpen || !!b.cfg.arena && false;
    $("abil").innerHTML = H2.abilities.map((a, i) => {
      if (!a) return `<div class="ab empty"><span class="key">${i + 1}</span><span class="muted">—</span></div>`;
      const A = ABILITIES[a], cd = b.cds[a] || 0, why = abilityReady(b, a);
      return `<div class="ab ${why ? "off" : "ready"} res-${A.res}" title="${why || ""}"><span class="key">${i + 1}</span>${ic(AB_ICON[A.res] || "star")}<span class="an">${A.name}${a === "smite" && (H2.abLevels.smite || 1) > 1 ? " II" : ""}</span><span class="ac">${abilityCost(b, a)} ${RES_NAME[A.res].toLowerCase()}</span>${cd > 0 ? `<i class="cd" style="height:${(cd / A.cd) * 100}%"></i><b class="cdt">${Math.ceil(cd)}</b>` : ""}</div>`;
    }).join("") + `<div class="ab ${H2.bandages > 0 ? "ready" : "off"}"><span class="key">4</span><span class="an">Opatrunek</span><span class="ac">zostało ${H2.bandages}</span></div>`;
  }
  const ours = b.units.filter((u) => u.team === 0 && u.active).length + b.reserves[0].length;
  const foes = b.units.filter((u) => u.team === 1 && u.active && !u.hidden).length;
  // pasek przewagi: siła = suma hp żywych, ważona poziomem
  const pw = (t: number) => b.units.reduce((s, u) => s + (u.team === t && u.active && !(t === 1 && u.hidden) ? u.hp * (1 + (UNITS[u.key]?.tier || 2) * 0.25) : 0), 0) + b.reserves[t].length * 60;
  const p0 = pw(0), p1 = pw(1), adv = p0 + p1 > 0 ? p0 / (p0 + p1) : 0.5;
  $("adv").style.width = Math.round(adv * 100) + "%";
  $("adv-t").textContent = adv > 0.65 ? "Przewaga" : adv < 0.35 ? "W opałach" : "Wyrównana";
  drawMini(b);
  $("ours").textContent = String(ours) + (b.reserves[0].length ? ` (+${b.reserves[0].length})` : "");
  $("foes").textContent = String(foes) + (b.reserves[1].length ? ` (+${b.reserves[1].length})` : "");
  $("foe-name").textContent = b.cfg.enemy.name;
  $("groups").innerHTML = b.liveSquads().map((sq) => {
    const o = b.orders[sq], n = b.squadUnits(sq).length, m = Math.round(b.squadMorale(sq));
    if (!o) return "";
    const sel = b.selected.includes(sq) ? " sel" : "";
    const offU = b.units.find((u) => u.team === 0 && u.squad === sq && u.officer && u.active);
    const off = offU ? (offU.companion ? ` · ${offU.name}` : " ⚑") : "";
    const su = b.squadUnits(sq)[0];
    const sic = !su ? "man" : su.mounted ? "horse" : su.bowDmg > 0 ? "bow" : su.hasShield ? "shield" : "sword";
    return `<div class="grp${sel}"><span class="key">${sq}</span>${ic(sic)}<span class="gname" style="color:${SQUAD_COLORS[sq]}">${SQUAD_NAMES[sq]}${off}</span> <b>${n}</b> · ${MODE_NAME[o.mode]} · ${FORMATION_NAME[o.formation]}<span class="mbar" title="Morale ${m}%"><i style="width:${m}%" class="${m < 25 ? "bad" : m < 45 ? "warn" : ""}"></i></span></div>`;
  }).join("");
  $("log").innerHTML = b.log.map((l) => `<div class="${l.big ? "big" : ""}" style="opacity:${clamp(l.t, 0, 1)};${l.col ? `color:${l.col}` : ""}">${l.text}${l.n > 1 ? ` <span class="cnt">×${l.n}</span>` : ""}</div>`).join("");
  if (b.banner) { $("banner").textContent = b.banner.text; $("banner").style.color = b.banner.col; $("banner").hidden = false; $("banner").style.opacity = String(clamp(b.banner.t * 2, 0, 1)); }
  else $("banner").hidden = true;
  $("slow").hidden = !b.cmdOpen;
  $("slow").textContent = b.phase === "deploy" ? "Rozstawienie: czas stoi" : b.tacPause ? "PAUZA TAKTYCZNA: czas stoi · Spacja wznawia" : b.cmdOpen ? "Tryb rozkazów: czas zwolniony" : "";
  $("startfight").hidden = b.phase !== "deploy";
  if (b.focusT > 0) { $("slow").hidden = false; $("slow").textContent = "Skupienie"; }
}

function renderCmd() {
  const b = G.battle;
  const el = $("cmd");
  el.hidden = !b || !b.cmdOpen;
  if (!b || !b.cmdOpen) { cmdKey = ""; return; }
  const items = b.cmdMenu();
  const key = b.cmdLevel + "|" + b.selected.join(",") + "|" + items.map((i) => i.label + (i.on ? "*" : "")).join(";");
  if (key === cmdKey) return;
  cmdKey = key;
  const titles: Record<string, string> = { groups: "Wybierz oddział", orders: "Rozkaz", formation: "Formacja", more: "Więcej rozkazów", target: "Cel ataku", assign: "Przenieś zaznaczonych do" };
  const crumb = b.cmdLevel === "groups" || b.cmdLevel === "assign" ? "" : b.groupName(b.selected);
  const foot = b.cmdLevel === "target" ? "Możesz też kliknąć wroga · Q: zamknij" : b.cmdLevel === "assign" ? "Shift + klik: dodaj lub usuń żołnierza" : "PPM: przeciągnij linię frontu · LPM: ramka zaznacza żołnierzy · Q: zamknij";
  el.innerHTML = `<div class="head"><span>${titles[b.cmdLevel]}</span><span class="crumb">${crumb}</span></div>`
    + items.map((i) => `<button data-n="${i.n}" class="${i.on ? "on" : ""}${i.dim ? " dim" : ""}"><span class="key">${i.n}</span>${i.label}</button>`).join("")
    + (b.cmdLevel !== "groups" ? `<button data-n="0"><span class="key">0</span>Wstecz</button>` : "")
    + `<div class="foot">${foot}</div>`;
}
// mapa taktyczna: klik = oddziały idą w to miejsce, PPM = szarża
$("mini").addEventListener("mousedown", (e) => {
  e.stopPropagation(); e.preventDefault();
  const b = G.battle; if (!b) return;
  if (!miniBig) { miniWant = true; return; }            // mała minimapa: klik rozwija
  if (!b.cmdOpen) b.toggleCmd(true);
  const r = (e.target as HTMLElement).getBoundingClientRect();
  const wx = (e.clientX - r.left) / r.width * b.map.w, wy = (e.clientY - r.top) / r.height * b.map.h;
  if (!b.selected.length) b.selected = b.liveSquads();
  if (e.button === 2) b.orderMode(b.selected, "charge"); else b.orderHere(b.selected, wx, wy);
  b.sfx.ui();
});
$("mini").addEventListener("contextmenu", (e) => e.preventDefault());
$("minitog").addEventListener("mousedown", (e) => { e.stopPropagation(); e.preventDefault(); miniWant = !miniWant; });
$("startfight").addEventListener("mousedown", (e) => { e.stopPropagation(); G.battle?.startFight(); });
$("cmd").addEventListener("mousedown", (e) => {
  e.stopPropagation();
  const bt = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
  if (!bt || !G.battle) return;
  const n = Number(bt.dataset.n);
  if (n === 0) G.battle.cmdBack(); else G.battle.cmdChoose(n);
  cmdKey = "";
});

// Koniec bitwy: chwila na oddech, potem podsumowanie.
function battleEndCheck(dt: number) {
  const b = G.battle;
  if (b.phase !== "end") return;
  endT += dt;
  if (endT < 2.2 || endShown) return;
  endShown = true;
  if (G.ctx.kind === "escape") { hideBattleHud(); G.ctx.onEnd?.(G.battle.result.win); return; }
  if (G.ctx.kind === "custom") {
    hideBattleHud();
    const r = b.result;
    showScr(`<div class="card frame small"><h1 class="${r.win ? "gold" : "bad"}">${r.win ? "Zwycięstwo" : "Klęska"}</h1><p>Czas: ${Math.round(r.time)} s · twoje zabójstwa: ${r.heroKills} · zabitych wrogów: ${r.enemyKilled}</p>
      <p>Twoje straty: ${r.ours.reduce((s, c) => s + c.killed, 0)} poległych, ${r.ours.reduce((s, c) => s + c.wounded, 0)} rannych.</p>
      <div class="btns"><button data-a="again">Jeszcze raz</button><button class="alt" data-a="setup">Zmień ustawienia</button><button class="alt" data-a="menu">Menu</button></div></div>`, {
      again: () => startQuickBattle(), setup: () => { G.battle = null; showQuickBattle(); }, menu: () => { G.battle = null; showTitle(); },
    }, "end-scr");
    return;
  }
  battleFinished();
}

// ---------- HUD mapy: przyciski ----------
$("maphud").addEventListener("mousedown", (e) => e.stopPropagation());
$("maphud").addEventListener("click", (e) => {
  if ((e.target as HTMLElement).closest("#mh-quest")) { openWin("quest"); return; }
  const t = (e.target as HTMLElement).closest("[data-sp],[data-win]") as HTMLElement | null;
  if (!t) return;
  sfx.ui();
  if (t.dataset.sp) {
    if (t.dataset.sp.startsWith("cm:")) { (WORLD.player as any).campMode = t.dataset.sp.slice(3); refreshMapHud(); return; }
    if (t.dataset.sp === "camp") { const pp = playerParty(WORLD); pp.path = []; if (!G.camping) { G.camping = true; pp.state = "camp"; } showCamp(); return; }
    if (t.dataset.sp === "uncamp") { G.camping = false; G.waitHours = 0; playerParty(WORLD).state = "idle"; toast("Zwijacie obóz."); }
    else G.speed = Number(t.dataset.sp);
    refreshMapHud();
  }
  if (t.dataset.win) openWin(t.dataset.win);
});
function openWin(k: string) {
  if (!WORLD || WORLD.player.captive) return;
  const cur = SCREEN ? SCREEN.el.className.replace(" fresh", "") : "";
  const map: Record<string, [string, () => void]> = { char: ["char-scr", showCharacter], inv: ["inv-scr", showInventory], party: ["party-scr", showParty], fac: ["fac-scr", showFactions], chron: ["chron-scr", showChronicle], quest: ["quest-scr", showQuests] };
  map.log = ["log-scr", showLog]; map.kingdom = ["kingdom-scr", showKingdom]; map.help = ["help-scr", showHelp];
  const [cls, fn] = map[k];
  if (cur === "win " + cls) { closeScreen(); return; }
  if (SCREEN && !["char-scr", "inv-scr", "party-scr", "fac-scr", "chron-scr", "quest-scr", "log-scr", "help-scr", "kingdom-scr"].some((c) => cur === "win " + c)) return;   // nie przerywaj osady ani rozmowy
  sfx.open();
  fn();
}

canvas.addEventListener("mousedown", () => sfx.init());
addEventListener("keydown", () => sfx.init(), { once: true });

// ---------- Pętla ----------
let last = performance.now();
let mapHudT = 0;
let lastErr = 0;
function frame(now: number) {
  try { frameInner(now); } catch (e) {
    console.error(e);
    // błąd nie może zatrzymać pętli gry: zgłoś i graj dalej
    if (now - lastErr > 3000) { lastErr = now; toast("Wystąpił błąd gry (zapisany w konsoli). Gra działa dalej.", PAL.redL); }
    try { input.endFrame(); } catch (e2) { /* nic */ }
  }
  requestAnimationFrame(frame);
}
function frameInner(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const typing = document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "SELECT");
  if (typing) input.pressed.clear();
  if (input.hit(KB("music"))) { settings.music = sfx.toggleMusic(); saveSettings(); toast(settings.music ? "Muzyka: włączona" : "Muzyka: wyłączona"); }
  if (input.hit("F11")) toggleFullscreen();
  if (G.state === "battle" && G.battle) {
    const b = G.battle;
    if (input.hit("Escape")) { if (b.cmdOpen) b.toggleCmd(false); else if (screenOpen()) { closeScreen(); b.paused = false; } else showPauseMenu(); }
    if (input.hit("KeyP") && !b.cmdOpen) { if (screenOpen()) { closeScreen(); b.paused = false; } else showPauseMenu(); }
    const zi = b.map.w <= 640 ? Math.min(zoomIdx, 2) : b.tacView ? ZOOMS.length - 1 : zoomIdx;   // arena jest mała
    if (W !== ZOOMS[zi][0] || H !== ZOOMS[zi][1]) setRes(ZOOMS[zi][0], ZOOMS[zi][1]);
    if (input.wheel) setZoom(zoomIdx + input.wheel);
    if (input.hit(KB("mini"))) miniWant = !miniWant;
    if (screenOpen() && b.phase === "fight") b.paused = true;
    b.update(dt);
    renderBattle(b, ctx);
    if (!$("bhud").hidden) { battleHud(dt); renderCmd(); }
    battleEndCheck(dt);
  } else if (G.state === "map" && WORLD) {
    if (input.hit("Escape")) { if (screenOpen()) { const c = SCREEN.el.className; if (!/after-scr|dialog-scr/.test(c) || /place-scr/.test(c)) closeScreen(); } else showPauseMenu(); }
    // dialogi: odpowiedzi klawiszami 1–9
    if (screenOpen()) {
      const bs = Array.from(SCREEN.el.querySelectorAll("button.choice")) as HTMLButtonElement[];
      for (let n = 1; n <= 9; n++) if (input.hit("Digit" + n)) { const bt = bs[n - 1]; if (bt && !bt.disabled) bt.click(); }
      // strzałki + Enter w dialogach
      if (bs.length && (input.hit("ArrowDown") || input.hit("ArrowUp"))) {
        let i = bs.findIndex((b) => b.classList.contains("focus")); bs.forEach((b) => b.classList.remove("focus"));
        i = (i + (input.hit("ArrowDown") ? 1 : -1) + bs.length) % bs.length; bs[i].classList.add("focus");
      }
      if (bs.length && input.hit("Enter")) { const f = bs.find((b) => b.classList.contains("focus")); if (f && !f.disabled) f.click(); }
    }
    if (!screenOpen() || /char-scr|inv-scr|party-scr|fac-scr|chron-scr|quest-scr|log-scr|help-scr/.test(SCREEN.el.className)) {
      if (input.hit(KB("char"))) openWin("char"); if (input.hit(KB("inv"))) openWin("inv"); if (input.hit(KB("party"))) openWin("party");
      if (input.hit(KB("fac"))) openWin("fac"); if (input.hit(KB("chron"))) openWin("chron"); if (input.hit(KB("quest"))) openWin("quest"); if (input.hit(KB("log"))) openWin("log"); if (input.hit(KB("kingdom"))) openWin("kingdom");
    }
    if (input.wheel && !screenOpen()) mapZT = clamp(mapZT + input.wheel * 3, 0, MAPZ.length - 1);
    if (mapZ !== mapZT) mapZ += Math.sign(mapZT - mapZ);
    if (W !== MAPZ[mapZ][0] || H !== MAPZ[mapZ][1]) setRes(MAPZ[mapZ][0], MAPZ[mapZ][1]);
    if (input.hit(KB("help")) && !screenOpen()) showHelp();
    if (input.hit(KB("overview")) && !screenOpen()) G.view.overview = !G.view.overview;
    if (input.hit(KB("borders")) && !screenOpen()) { settings.borders = settings.borders === false; saveSettings(); toast(settings.borders ? "Granice: widoczne" : "Granice: ukryte"); }
    if (!screenOpen()) mapUpdate(dt); else G.view.time += dt;
    renderWorld(WORLD, G.view, ctx);
    mapHudT -= dt;
    if (mapHudT <= 0) { mapHudT = 0.5; if ($("maphud").hidden && !screenOpen() && !WORLD.player.captive) showMapHud(); else if (!$("maphud").hidden) refreshMapHud(); }
    mapSound(dt);
  } else {
    // tło menu: mapa świata albo ciemność z popiołem
    ctx.fillStyle = PAL.black; ctx.fillRect(0, 0, W, H);
    titleBg(dt);
    sfx.setMood("title");
    sfx.tick(dt, 0, false);
  }
  input.endFrame();
}

// Dźwięk mapy: nastrój zależy od regionu, pory dnia i miejsca w osadzie; tło: ptaki, rzeka, kroki.
let ambWater = 0, ambT = 0, ambWind = 0, ambBell = false, ambWolves = false;
const MUSIC_CYCLE = { t: 150, on: true };
function mapSound(dt: number) {
  const w = WORLD, p = playerParty(w);
  ambT -= dt;
  if (ambT <= 0) {
    ambT = 0.5;
    const cx = Math.floor(p.x / WCELL), cy = Math.floor(p.y / WCELL);
    let n = 0;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) { const t = terrAt(w, cx + dx, cy + dy); if (t === T_RIVER || t === T_SEA || t === T_BEACH) n++; }
    ambWater = clamp(n / 18, 0, 1);
    // wiatr: góry, północ, zima, pustkowia; dzwony z bliskich miast; wilki nocą w lasach
    let hi = 0, fo = 0; for (let dy = -5; dy <= 5; dy += 2) for (let dx = -5; dx <= 5; dx += 2) { const t = terrAt(w, cx + dx, cy + dy); if (t === T_MOUNT || t === T_HILL) hi++; if (t === T_FOREST) fo++; }
    ambWind = clamp(hi / 18 + (cy < WGH * 0.3 ? 0.25 : 0) + (season(w) === 3 ? 0.3 : 0) + (w.blight[cellOf(p.x, p.y)] ? 0.3 : 0) + ((w as any).storm ? 0.4 : 0), 0, 1);
    ambBell = !isNight(w) && w.settlements.some((s) => s.kind !== "village" && dist(s.cx * WCELL, s.cy * WCELL, p.x, p.y) < 70);
    ambWolves = isNight(w) && fo > 6;
  }
  let mood = "";
  const cls = SCREEN ? SCREEN.el.className : "";
  if (/settle-scr/.test(cls)) {
    const s = w.settlements[SET.id];
    mood = SET.tab === "tavern" ? "tavern" : SET.tab === "market" || SET.tab === "smith" ? "market" : s && s.kind !== "village" && (SET.tab === "main" || SET.tab === "throne" || SET.tab === "rule" || SET.tab === "dungeon") && s.kind === "castle" ? "castle" : SET.tab === "throne" ? "castle" : "";
  }
  // sytuacje: pościg, oblężenie, zwycięstwo i lament po bitwie, cisza we mgle i na pobojowisku, przerwy w muzyce
  const now = performance.now();
  if (!mood && MOOD_HOLD.until > now) mood = MOOD_HOLD.m;
  if (!mood && /settle-scr/.test(cls) && SET.tab === "siege") mood = "siege";
  if (!mood && (p.state === "siege" || w.settlements.some((s) => s.siegeBy.includes(p.id)))) mood = "siege";
  if (!mood && w.parties.some((o) => o.state === "chase" && o.target === p.id && dist(o.x, o.y, p.x, p.y) < 150 && hostile(w, p, o))) mood = "chase";
  const nearField = ((w as any).scars || []).some((sc: any) => sc.kind === "battle" && w.day - sc.day < 3 && dist(sc.x, sc.y, p.x, p.y) < 60);
  if (!mood && (w.fog || nearField)) mood = "pause";
  if (!mood) { MUSIC_CYCLE.t -= dt; if (MUSIC_CYCLE.t <= 0) { MUSIC_CYCLE.on = !MUSIC_CYCLE.on; MUSIC_CYCLE.t = MUSIC_CYCLE.on ? rr(110, 180) : rr(30, 60); } if (!MUSIC_CYCLE.on) mood = "pause"; }
  if (!mood) {
    if (isNight(w)) mood = "night";
    else {
      const s = nearestSettlement(w, p.x, p.y);
      const blight = w.blight[cellOf(p.x, p.y)] > 0;
      const cul = blight ? "undead" : s ? FACTIONS[s.faction]?.culture : "";
      mood = cul === "aurelia" ? "map_aurelia" : cul === "varus" ? "map_varus" : cul === "dwarf" ? "map_dwarf" : cul === "orc" ? "map_orc" : cul === "undead" ? "map_undead" : "map_wild";
    }
  }
  sfx.setMood(mood);
  const day = !isNight(w);
  sfx.tick(dt, 0, w.rain, { day, water: /settle-scr/.test(cls) ? 0 : ambWater, moving: !screenOpen() && p.path.length > 0 && !G.camping, mounted: !!w.player.equip.horse, winter: season(w) === 3, wind: /settle-scr/.test(cls) ? ambWind * 0.3 : ambWind, bell: ambBell, wolves: ambWolves, crows: nearField });
}

// Tło ekranu tytułowego: płonący horyzont, sztandary i popiół.
const TB = { t: 0, ash: Array.from({ length: 140 }, () => ({ x: rr(0, 640), y: rr(0, 360), s: rr(6, 18), p: rr(0.3, 1) })) };
function titleBg(dt: number) {
  TB.t += dt;
  const g = ctx;
  for (let y = 0; y < H; y++) { const k = y / H; g.fillStyle = k < 0.55 ? (k < 0.3 ? PAL.black : PAL.ink) : k < 0.7 ? PAL.dusk : PAL.black; g.fillRect(0, y, W, 1); }
  g.fillStyle = PAL.bloodD; g.globalAlpha = 0.5; g.fillRect(0, Math.round(H * 0.62), W, 6); g.globalAlpha = 1;
  for (let x = 0; x < W; x++) { const hh = Math.round(H * 0.66 + vnoise(x, 0, 40) * 18); g.fillStyle = PAL.black; g.fillRect(x, hh, 1, H - hh); }
  for (let k = 0; k < 7; k++) {
    const x = Math.round(W * (0.12 + k * 0.13)), base = Math.round(H * 0.7 + vnoise(x, 0, 40) * 10);
    g.fillStyle = PAL.black; g.fillRect(x, base - 46, 2, 46);
    const wave = Math.sin(TB.t * 2 + k) * 2;
    g.fillStyle = k % 2 ? PAL.red : PAL.purple; for (let j = 0; j < 14; j++) g.fillRect(x + 2, base - 46 + j, 12 + Math.round(Math.sin(TB.t * 3 + j * 0.4 + k) * 1.5 + wave * (j / 14)), 1);
  }
  for (const a of TB.ash) { const x = ((a.x + TB.t * a.s * 0.6) % W + W) % W, y = ((a.y + TB.t * a.s) % H + H) % H; g.globalAlpha = 0.3 + a.p * 0.5; g.fillStyle = a.p > 0.8 ? PAL.gold : PAL.ash; g.fillRect(Math.round(x), Math.round(y), 1, 1); }
  g.globalAlpha = 1;
}

showTitle();
requestAnimationFrame(frame);
(window as any).__game = () => ({ G, WORLD, battle: G.battle });
(window as any).__battle = () => G.battle;
(window as any).__meet = (o: Party) => meetParty(o, false);
function spriteSheet(keys: string[], scale = 3): string {
  const cols = 9, cw = SPR_W, ch = SPR_H;
  const [c, g] = mkCanvas(cols * cw, keys.length * ch);
  g.fillStyle = PAL.grass; g.fillRect(0, 0, c.width, c.height);
  keys.forEach((k, r) => { const fac = FACTION_OF_CULTURE[UNITS[k].culture] || 6; const L = troopLook(UNITS[k], 3 + r, fac); const s = spritesFor(L, "sheet:" + k + r);
    [[0, 0], [0, 2], [0, 4], [2, 0], [2, 1], [2, 2], [2, 3], [1, 0], [2, 6]].forEach(([d, f], i) => g.drawImage(s.frames[d][f], i * cw, r * ch)); });
  const [o, g2] = mkCanvas(c.width * scale, c.height * scale); g2.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL();
}
(window as any).__T2 = { launchStreets, mineAssault, sallyAgainstPlayer, showCapitulation, playerSiegeDay };
(window as any).__T3 = { meetParty, commanderDuel, igniteAt, placeTrap, orderDismount, trapsAllowed, siegeWon, showKingdom, kingdomDaily, planRoad, planBridge, works, partyLimit, serializeWorld, deserializeWorld, KG, sendSpy, intelDaily, treatyDaily, sendTreaty, hireCompany, mercCompany, intrigue, spies, treaties, contracts, spyAct, IG, setWar, playerDeclareWar, addDeed, addBounty, bountyDaily, maybeWound, deedTraits, enterSettlement, perk, companionQuestsDaily, makeCompanion, ennoble, gearUp, completeQuest, pquestDo };
(window as any).__T = { spriteSheet, worldTick, serializeWorld, deserializeWorld, launchBattle, arenaFight, enterSettlement, castHeroAbility, meetParty, showCharacter, showInventory, showParty, showFactions, showChronicle, enterPlace, showCaptivity, captivity, troopCount, partyPower, startQuickBattle, QB, UNITS, unitCanvas, rumor, renderSettlement, SET, startTourney, autoResolve, showAftermath, playerParty, maybeTravelEvent, showLordTalk, showQuests, offerQuest, offerLordQuest, ensureItem, qid, showDice, respecNodes, makeCompanion, startEscape, showPending, pending, dailyPolitics, factionPower, showHelp, showLog, showSaves, startPrologue, interrogate, rearguard, acceptQuest, plotRuins, plotChoose, startRebellion, mapImage: () => { if (!WMAP) renderWorldMap(WORLD); const [c, g] = mkCanvas(WMAP.width, WMAP.height); g.drawImage(WMAP, 0, 0); if (WBORDER) g.drawImage(WBORDER, 0, 0); g.font = "10px monospace"; for (const s of WORLD.settlements) { g.fillStyle = "#000"; g.fillRect(s.cx * WCELL - 2, s.cy * WCELL - 2, 12, 12); g.fillStyle = factionCol(s.faction)[0]; g.fillRect(s.cx * WCELL, s.cy * WCELL, 8, 8); g.fillStyle = "#fff"; g.fillText(s.name, s.cx * WCELL + 10, s.cy * WCELL + 8); } for (const p of WORLD.places) { g.fillStyle = "#f0f"; g.fillRect(p.cx * WCELL, p.cy * WCELL, 6, 6); } return c.toDataURL(); } };

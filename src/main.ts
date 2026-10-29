// Start gry: płótno, skalowanie, przybliżenie, pętla, HUD bitwy i mapy, klawisze, ustawienia, pełny ekran.

const BUILD = "Build 0.12";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = W; canvas.height = H;
let ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const input = new Input();
input.attach(canvas);
const sfx = new Sfx();
buildSprites();

const settings: Settings = {
  damageNumbers: true, gesture: false, music: true, volume: 0.8, battleSize: 100,
  musicVol: 0.6, shake: 1, killSlow: true, blood: 1, hpBars: "near", tells: false, dirHint: true,
  questMarkers: true, questArrows: true, partyNames: "lords", autosaveDays: 2, uiScale: 1, toastsOn: true, pauseOnEvent: true, fewLog: true, minimap: true,
  atkMode: "mouse", horseMode: "dir", deploy: true, borders: true, typeText: true, voices: true, gore: true, dmgHeroOnly: true, outline: true,
};
try {
  const s = JSON.parse(localStorage.getItem("sztandary-settings") || "null");
  if (s) { Object.assign(settings, s); if (!s.ver || s.ver < 9) { settings.tells = false; settings.atkMode = s.gesture ? "screen" : "mouse"; settings.dmgHeroOnly = true; } }
  (settings as any).ver = 9;
} catch (e) { /* bez zapisu ustawień */ }
function saveSettings() { try { localStorage.setItem("sztandary-settings", JSON.stringify(settings)); } catch (e) { /* ignoruj */ } }
sfx.volume = settings.volume;
sfx.musicVol = settings.musicVol;
applyUiScale();
function applyUiScale() { document.getElementById("wrap").style.setProperty("--uis", String(settings.uiScale)); }
sfx.musicOn = settings.music;
sfxUi = () => sfx.ui();
addLogMsg = (t, c) => { if (G.state === "map") toast(t, c); };
onChronicle = (t, c) => { if (G.state === "map" && WORLD && settings.toastsOn) { const p = playerParty(WORLD); if (p) toast(t, c || PAL.bone); } };

let zoomIdx = 1;
const $ = (id: string) => document.getElementById(id);
document.title = "Sztandary Popiołu · " + BUILD;
for (const e of Array.from(document.querySelectorAll("[data-ic]"))) (e as HTMLElement).innerHTML = ic((e as HTMLElement).dataset.ic);
$("build").textContent = BUILD;

function fit() {
  const fs = !!document.fullscreenElement;
  const s = Math.max(1, Math.min(innerWidth / 480, innerHeight / 270));
  const scale = s >= 2 && !fs ? Math.floor(s) : s;
  const wrap = $("wrap");
  wrap.style.width = 480 * scale + "px";
  wrap.style.height = 270 * scale + "px";
  wrap.style.setProperty("--s", String(scale));
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
const MAPZ: [number, number][] = []; for (let wd = 320; wd <= 1120; wd += 32) MAPZ.push([wd, Math.round(wd * 9 / 16)]);
let mapZ = MAPZ.findIndex((z) => z[0] === 480), mapZT = mapZ;
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
    $("dir").textContent = (!h.active ? "Ogłuszony" : h.usingBow ? "Przytrzymaj LPM, by naciągnąć" : b.atkMode() !== "keys" ? `Cios: ${DIR_NAME[h.state === "windup" ? h.dir : b.loadDir]}${h.state === "windup" && h.hold > 0.5 ? " · NAŁADOWANY" : ""}${h.counterT > 0 ? " · KONTRA!" : ""}` : `Następne cięcie: ${DIR_NAME[h.nextSide]}`) + (h.active ? hint + ammoTxt : "");
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
  $("slow").textContent = b.phase === "deploy" ? "Rozstawienie: czas stoi" : b.cmdOpen ? "Tryb rozkazów: czas zwolniony" : "";
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
    if (t.dataset.sp === "camp") { G.camping = !G.camping; playerParty(WORLD).path = []; playerParty(WORLD).state = G.camping ? "camp" : "idle"; }
    else G.speed = Number(t.dataset.sp);
    refreshMapHud();
  }
  if (t.dataset.win) openWin(t.dataset.win);
});
function openWin(k: string) {
  if (!WORLD || WORLD.player.captive) return;
  const cur = SCREEN ? SCREEN.el.className : "";
  const map: Record<string, [string, () => void]> = { char: ["char-scr", showCharacter], inv: ["inv-scr", showInventory], party: ["party-scr", showParty], fac: ["fac-scr", showFactions], chron: ["chron-scr", showChronicle], quest: ["quest-scr", showQuests] };
  const [cls, fn] = map[k];
  if (cur === "win " + cls) { closeScreen(); return; }
  if (SCREEN && !["char-scr", "inv-scr", "party-scr", "fac-scr", "chron-scr", "quest-scr"].some((c) => cur === "win " + c)) return;   // nie przerywaj osady ani rozmowy
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
  if (input.hit("KeyM")) { settings.music = sfx.toggleMusic(); saveSettings(); toast(settings.music ? "Muzyka: włączona" : "Muzyka: wyłączona"); }
  if (input.hit("F11")) toggleFullscreen();
  if (G.state === "battle" && G.battle) {
    const b = G.battle;
    if (input.hit("Escape")) { if (b.cmdOpen) b.toggleCmd(false); else if (screenOpen()) { closeScreen(); b.paused = false; } else showPauseMenu(); }
    if (input.hit("KeyP") && !b.cmdOpen) { if (screenOpen()) { closeScreen(); b.paused = false; } else showPauseMenu(); }
    if (W !== ZOOMS[zoomIdx][0]) setRes(ZOOMS[zoomIdx][0], ZOOMS[zoomIdx][1]);
    if (input.wheel) setZoom(zoomIdx + input.wheel);
    if (input.hit("KeyN")) miniWant = !miniWant;
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
    if (!screenOpen() || /char-scr|inv-scr|party-scr|fac-scr|chron-scr|quest-scr/.test(SCREEN.el.className)) {
      if (input.hit("KeyC")) openWin("char"); if (input.hit("KeyI")) openWin("inv"); if (input.hit("KeyP")) openWin("party");
      if (input.hit("KeyF")) openWin("fac"); if (input.hit("KeyK")) openWin("chron"); if (input.hit("KeyJ")) openWin("quest");
    }
    if (input.wheel && !screenOpen()) mapZT = clamp(mapZT + input.wheel * 3, 0, MAPZ.length - 1);
    if (mapZ !== mapZT) mapZ += Math.sign(mapZT - mapZ);
    if (W !== MAPZ[mapZ][0]) setRes(MAPZ[mapZ][0], MAPZ[mapZ][1]);
    if (input.hit("Tab") && !screenOpen()) G.view.overview = !G.view.overview;
    if (input.hit("KeyB") && !screenOpen()) { settings.borders = settings.borders === false; saveSettings(); toast(settings.borders ? "Granice: widoczne" : "Granice: ukryte"); }
    if (!screenOpen()) mapUpdate(dt); else G.view.time += dt;
    renderWorld(WORLD, G.view, ctx);
    mapHudT -= dt;
    if (mapHudT <= 0) { mapHudT = 0.5; if ($("maphud").hidden && !screenOpen() && !WORLD.player.captive) showMapHud(); else if (!$("maphud").hidden) refreshMapHud(); }
    sfx.tick(dt, 0, WORLD.rain);
  } else {
    // tło menu: mapa świata albo ciemność z popiołem
    ctx.fillStyle = PAL.black; ctx.fillRect(0, 0, W, H);
    titleBg(dt);
    sfx.tick(dt, 0, false);
  }
  input.endFrame();
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
(window as any).__T = { worldTick, serializeWorld, deserializeWorld, launchBattle, arenaFight, enterSettlement, castHeroAbility, meetParty, showCharacter, showInventory, showParty, showFactions, showChronicle, enterPlace, showCaptivity, captivity, troopCount, partyPower, startQuickBattle, QB, UNITS, unitCanvas, rumor, renderSettlement, SET, startTourney, autoResolve, showAftermath, playerParty, maybeTravelEvent, showLordTalk, showQuests, offerQuest, offerLordQuest, ensureItem, qid, showDice };

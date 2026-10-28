// Start gry: płótno, skalowanie, przybliżenie, interfejs (HUD), ustawienia i pętla.

const BUILD = "Build 0.3";

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = W; canvas.height = H;
let ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const input = new Input();
input.attach(canvas);
const sfx = new Sfx();
buildSprites();

const settings: Settings = { damageNumbers: true, gesture: false };
try {
  const s = JSON.parse(localStorage.getItem("sztandary-settings") || "null");
  if (s) Object.assign(settings, s);
} catch (e) { /* bez zapisu ustawień */ }
const saveSettings = () => { try { localStorage.setItem("sztandary-settings", JSON.stringify(settings)); } catch (e) { /* ignoruj */ } };

let heroMounted = false;
let battle = new Battle(input, sfx, settings, heroMounted);
let zoomIdx = 1;

const $ = (id: string) => document.getElementById(id);
const ui = {
  hp: $("hp-fill"), hpTxt: $("hp-txt"), st: $("st-fill"), horse: $("horse-row"), horseFill: $("horse-fill"),
  weapon: $("weapon"), dir: $("dir"),
  ours: $("ours"), foes: $("foes"), groups: $("groups"),
  log: $("log"), banner: $("banner"), deploy: $("deploy"), end: $("end"),
  endTitle: $("end-title"), endText: $("end-text"), pause: $("pause"), slow: $("slow"),
  cmd: $("cmd"), build: $("build"),
  optNumbers: $("opt-numbers") as HTMLInputElement, optGesture: $("opt-gesture") as HTMLInputElement, optMusic: $("opt-music") as HTMLInputElement,
};
ui.build.textContent = BUILD;
$("build-badge").textContent = BUILD;
document.title = "Sztandary Popiołu · " + BUILD;

ui.optNumbers.checked = settings.damageNumbers;
ui.optGesture.checked = settings.gesture;
ui.optNumbers.addEventListener("change", () => { settings.damageNumbers = ui.optNumbers.checked; saveSettings(); });
ui.optGesture.addEventListener("change", () => { settings.gesture = ui.optGesture.checked; saveSettings(); });
ui.optMusic.addEventListener("change", () => { if (sfx.musicOn !== ui.optMusic.checked) sfx.toggleMusic(); });
$("resume-btn").addEventListener("click", () => { battle.paused = false; });
$("restart-btn").addEventListener("click", () => restart());

ui.cmd.addEventListener("mousedown", (e) => {
  e.stopPropagation();
  const b = (e.target as HTMLElement).closest("button") as HTMLButtonElement | null;
  if (!b) return;
  const n = Number(b.dataset.n);
  if (n === 0) battle.cmdBack(); else battle.cmdChoose(n);
  cmdKey = "";
});
let cmdKey = "";
function renderCmd() {
  const b = battle;
  ui.cmd.hidden = !b.cmdOpen;
  if (!b.cmdOpen) { cmdKey = ""; return; }
  const items = b.cmdMenu();
  const key = b.cmdLevel + "|" + b.selected.join(",") + "|" + items.map((i) => i.label + (i.on ? "*" : "")).join(";");
  if (key === cmdKey) return;
  cmdKey = key;
  const titles: Record<string, string> = { groups: "Wybierz oddział", orders: "Rozkaz", formation: "Formacja", more: "Więcej rozkazów", target: "Cel ataku", assign: "Przenieś zaznaczonych do" };
  const crumb = b.cmdLevel === "groups" || b.cmdLevel === "assign" ? "" : b.groupName(b.selected);
  const foot = b.cmdLevel === "target" ? "Możesz też kliknąć wroga · Q: zamknij"
    : b.cmdLevel === "assign" ? "Shift + klik: dodaj lub usuń żołnierza"
    : "PPM: przeciągnij linię frontu · LPM: ramka zaznacza żołnierzy · Q: zamknij";
  ui.cmd.innerHTML = `<div class="head"><span>${titles[b.cmdLevel]}</span><span class="crumb">${crumb}</span></div>`
    + items.map((i) => `<button data-n="${i.n}" class="${i.on ? "on" : ""}${i.dim ? " dim" : ""}"><span class="key">${i.n}</span>${i.label}</button>`).join("")
    + (b.cmdLevel !== "groups" ? `<button data-n="0"><span class="key">0</span>Wstecz</button>` : "")
    + `<div class="foot">${foot}</div>`;
}

function fit() {
  const s = Math.max(1, Math.min(innerWidth / 480, innerHeight / 270));
  const scale = s >= 2 ? Math.floor(s) : s;
  const wrap = $("wrap");
  wrap.style.width = 480 * scale + "px";
  wrap.style.height = 270 * scale + "px";
  wrap.style.setProperty("--s", String(scale));
}
addEventListener("resize", fit);
fit();

function setZoom(i: number) {
  i = clamp(i, 0, ZOOMS.length - 1);
  if (i === zoomIdx) return;
  const cx = battle.cam.x + W / 2, cy = battle.cam.y + H / 2;
  zoomIdx = i;
  [W, H] = ZOOMS[i];
  canvas.width = W; canvas.height = H;
  ctx = canvas.getContext("2d"); ctx.imageSmoothingEnabled = false;
  battle.cam.x = clamp(cx - W / 2, 0, WW - W); battle.cam.y = clamp(cy - H / 2, 0, WH - H);
  battle.makeOverlays();
}

function start(mounted: boolean) {
  sfx.init();
  if (mounted !== heroMounted) { heroMounted = mounted; UID = 1; battle = new Battle(input, sfx, settings, heroMounted); }
  if (battle.phase === "deploy") { battle.phase = "fight"; sfx.battleCry(1); battle.say("Do boju! Nieumarli nadchodzą ze wschodu.", undefined, true); }
  ui.deploy.hidden = true;
}
$("start-btn").addEventListener("click", () => start(false));
$("start-horse-btn").addEventListener("click", () => start(true));
$("again-btn").addEventListener("click", () => restart());
canvas.addEventListener("mousedown", () => sfx.init());

function restart() {
  UID = 1;
  battle = new Battle(input, sfx, settings, heroMounted);
  battle.phase = "fight";
  ui.end.hidden = true; ui.deploy.hidden = true;
  sfx.init(); sfx.battleCry(1);
  battle.say("Nowa bitwa. Do boju!", undefined, true);
}

const MODE_NAME: Record<string, string> = { hold: "stoją", follow: "za tobą", charge: "szarża", flank: "oskrzydla", ambush: "zasadzka" };
let hudT = 0;
function hud(dt: number) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.08;
  const b = battle, h = b.hero;
  const hpK = clamp(h.hp / h.def.hp, 0, 1);
  ui.hp.style.width = hpK * 100 + "%";
  ui.hp.className = hpK < 0.3 ? "low" : "";
  ui.hpTxt.textContent = `${Math.max(0, Math.round(h.hp))} / ${h.def.hp}`;
  ui.st.style.width = clamp(h.stamina, 0, 100) + "%";
  ui.horse.hidden = !h.mounted;
  if (h.mounted) ui.horseFill.style.width = clamp(h.horseHp / h.horseMax, 0, 1) * 100 + "%";
  const L = HERO_LOADOUTS[h.loadout];
  ui.weapon.textContent = L.bow ? `${L.name} · strzały: ${h.ammo}` : L.name;
  ui.dir.textContent = !h.active ? "Ogłuszony" : L.bow ? "Przytrzymaj LPM, by naciągnąć"
    : settings.gesture ? `Cios: ${DIR_NAME[h.state === "windup" ? h.dir : b.loadDir]}` : `Następne cięcie: ${DIR_NAME[h.nextSide]}`;
  ui.ours.textContent = String(b.units.filter((u) => u.team === 0 && u.active).length);
  ui.foes.textContent = String(b.units.filter((u) => u.team === 1 && u.active && !u.hidden).length);
  ui.groups.innerHTML = b.liveSquads().map((sq) => {
    const o = b.orders[sq], n = b.squadUnits(sq).length, m = Math.round(b.squadMorale(sq));
    const sel = b.selected.includes(sq) ? " sel" : "";
    const off = b.units.some((u) => u.team === 0 && u.squad === sq && u.officer && u.active) ? " ⚑" : "";
    const extra = o.targetSquad != null ? ` · cel: ${ENEMY_SQUADS[o.targetSquad]}` : "";
    return `<div class="grp${sel}"><span class="key">${sq}</span><span class="gname" style="color:${SQUAD_COLORS[sq]}">${SQUAD_NAMES[sq]}${off}</span> <b>${n}</b> · ${MODE_NAME[o.mode]} · ${FORMATION_NAME[o.formation]}${extra}`
      + `<span class="mbar" title="Morale ${m}%"><i style="width:${m}%" class="${m < 25 ? "bad" : m < 45 ? "warn" : ""}"></i></span></div>`;
  }).join("");
  ui.log.innerHTML = b.log.map((l) => `<div class="${l.big ? "big" : ""}" style="opacity:${clamp(l.t, 0, 1)};${l.col ? `color:${l.col}` : ""}">${l.text}${l.n > 1 ? ` <span class="cnt">×${l.n}</span>` : ""}</div>`).join("");
  if (b.banner) { ui.banner.textContent = b.banner.text; ui.banner.style.color = b.banner.col; ui.banner.hidden = false; ui.banner.style.opacity = String(clamp(b.banner.t * 2, 0, 1)); }
  else ui.banner.hidden = true;
  ui.pause.hidden = !b.paused;
  ui.optMusic.checked = sfx.musicOn;
  ui.slow.hidden = !b.cmdOpen;
  if (b.phase === "end" && ui.end.hidden) {
    ui.end.hidden = false;
    const lost = b.units.filter((u) => u.team === 0 && !u.hero && u.state === "dead").length;
    const fled = b.units.filter((u) => u.team === 0 && u.state === "fled").length;
    ui.endTitle.textContent = b.result === "win" ? "Zwycięstwo" : "Klęska";
    ui.endText.textContent = `Czas bitwy: ${Math.floor(b.time / 60)}:${String(Math.floor(b.time % 60)).padStart(2, "0")} · Twoje zabójstwa: ${h.kills} · Straty: ${lost} poległych, ${fled} uciekło`
      + (b.dk.state === "dead" ? " · Rycerz Śmierci pokonany" : "");
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (input.hit("Enter") && battle.phase === "deploy") start(false);
  if (input.hit("KeyR") && (battle.phase === "end" || battle.paused)) restart();
  if (input.hit("KeyM")) { battle.say(sfx.toggleMusic() ? "Muzyka: włączona" : "Muzyka: wyłączona"); }
  if (battle.phase === "fight") {
    if (input.hit("Escape")) { if (battle.cmdOpen) battle.toggleCmd(false); else battle.paused = !battle.paused; }
    if (input.hit("KeyP")) battle.paused = !battle.paused;
  }
  if (input.wheel) setZoom(zoomIdx + input.wheel);
  battle.update(dt);
  battle.render(ctx);
  hud(dt);
  renderCmd();
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as any).__battle = () => battle;

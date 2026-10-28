// Start gry: płótno, skalowanie, interfejs (HUD) i pętla.

const canvas = document.getElementById("game") as HTMLCanvasElement;
canvas.width = W; canvas.height = H;
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

const input = new Input();
input.attach(canvas);
const sfx = new Sfx();
buildSprites();
let battle = new Battle(input, sfx);

const $ = (id: string) => document.getElementById(id);
const ui = {
  hp: $("hp-fill"), st: $("st-fill"), weapon: $("weapon"), dir: $("dir"),
  ours: $("ours"), foes: $("foes"), morale: $("morale"), groups: $("groups"),
  log: $("log"), banner: $("banner"), deploy: $("deploy"), end: $("end"),
  endTitle: $("end-title"), endText: $("end-text"), pause: $("pause"), slow: $("slow"),
};

function fit() {
  const s = Math.max(1, Math.min(innerWidth / W, innerHeight / H));
  const scale = s >= 2 ? Math.floor(s) : s;
  const wrap = $("wrap");
  wrap.style.width = W * scale + "px";
  wrap.style.height = H * scale + "px";
  wrap.style.setProperty("--s", String(scale));
}
addEventListener("resize", fit);
fit();

function start() {
  sfx.init();
  if (battle.phase === "deploy") { battle.phase = "fight"; sfx.shout(1); battle.say("Do boju! Nieumarli nadchodzą ze wschodu."); }
  ui.deploy.hidden = true;
}
$("start-btn").addEventListener("click", start);
$("again-btn").addEventListener("click", () => restart());
canvas.addEventListener("mousedown", () => sfx.init());

function restart() {
  UID = 1;
  battle = new Battle(input, sfx);
  battle.phase = "fight";
  ui.end.hidden = true; ui.deploy.hidden = true;
  sfx.init(); sfx.shout(1);
  battle.say("Nowa bitwa. Do boju!");
}

let hudT = 0;
function hud(dt: number) {
  hudT -= dt;
  if (hudT > 0) return;
  hudT = 0.08;
  const b = battle, h = b.hero;
  ui.hp.style.width = clamp((h.hp / h.def.hp) * 100, 0, 100) + "%";
  ui.st.style.width = clamp(h.stamina, 0, 100) + "%";
  const L = HERO_LOADOUTS[h.loadout];
  ui.weapon.textContent = L.bow ? `${L.name} · strzały: ${h.ammo}` : L.name;
  ui.dir.textContent = L.bow ? "Przytrzymaj LPM, by naciągnąć" : `Cios: ${DIR_NAME[h.state === "windup" ? h.dir : b.loadDir]}`;
  const ours = b.units.filter((u) => u.team === 0 && u.active).length;
  const foes = b.units.filter((u) => u.team === 1 && u.active).length;
  const troops = b.units.filter((u) => u.team === 0 && u.active && !u.hero);
  const morale = troops.length ? Math.round(troops.reduce((s, u) => s + clamp(u.morale, 0, 100), 0) / troops.length) : 0;
  ui.ours.textContent = String(ours);
  ui.foes.textContent = String(foes);
  ui.morale.textContent = morale + "%";
  ui.morale.className = morale < 40 ? "bad" : "";
  const modeName = { hold: "stoją", follow: "za tobą", charge: "szarża" };
  ui.groups.innerHTML = (["inf", "arch"] as const).map((gk, i) => {
    const o = b.orders[gk];
    const n = b.units.filter((u) => u.team === 0 && u.group === gk && u.active).length;
    const sel = b.selected.includes(gk) ? " sel" : "";
    const extra = gk === "arch" ? (o.fire ? " · strzelają" : " · ogień wstrzymany") : "";
    return `<div class="grp${sel}"><span class="key">${i + 1}</span>${gk === "inf" ? "Piechota" : "Łucznicy"} <b>${n}</b> · ${modeName[o.mode]} · ${FORMATION_NAME[o.formation]}${extra}</div>`;
  }).join("");
  ui.log.innerHTML = b.log.map((l) => `<div style="opacity:${clamp(l.t, 0, 1)};${l.col ? `color:${l.col}` : ""}">${l.text}</div>`).join("");
  if (b.banner) { ui.banner.textContent = b.banner.text; ui.banner.style.color = b.banner.col; ui.banner.hidden = false; ui.banner.style.opacity = String(clamp(b.banner.t * 2, 0, 1)); }
  else ui.banner.hidden = true;
  ui.pause.hidden = !b.paused;
  ui.slow.hidden = !b.slowmo;
  if (b.phase === "end" && ui.end.hidden) {
    ui.end.hidden = false;
    const lost = b.units.filter((u) => u.team === 0 && !u.hero && !u.active).length;
    const fled = b.units.filter((u) => u.team === 0 && u.state === "fled").length;
    ui.endTitle.textContent = b.result === "win" ? "Zwycięstwo" : "Klęska";
    ui.endText.textContent = `Czas bitwy: ${Math.floor(b.time / 60)}:${String(Math.floor(b.time % 60)).padStart(2, "0")} · Twoje zabójstwa: ${h.kills} · Straty: ${lost - fled} poległych, ${fled} uciekło`
      + (b.dk.state === "dead" ? " · Rycerz Śmierci pokonany" : "");
  }
}

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (input.hit("Enter") && battle.phase === "deploy") start();
  if (input.hit("KeyR") && battle.phase !== "deploy") restart();
  battle.update(dt);
  battle.render(ctx);
  hud(dt);
  input.endFrame();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
(window as any).__battle = () => battle;

// Nowe mechaniki bitwy (Build 0.23): pojedynek dowódców, ranni na polu (oszczędź albo dobij),
// pułapki przed bitwą w obronie, zsiadanie i dosiadanie koni na rozkaz. Pauza taktyczna, pogoda, ogień i widok
// taktyczny są w battle.ts.

// ---------- Pojedynek dowódców ----------
const LORD_UNIT: Record<number, string> = { 1: "a_paladin", 2: "v_praetor", 3: "d_warden", 4: "o_ironhide", 5: "u_wight" };
function commanderDuel(o: Party, defensive = false) {
  const w = WORLD, P = w.player;
  const L = o.lord !== undefined ? lordById(w, o.lord) : null;
  if (!L) return;
  const key = L.ruler && L.faction === 5 ? "u_dk" : LORD_UNIT[L.faction] || "m_sword";
  const hero = heroCfgFromPlayer(P);
  const cfg: BattleConfig = { terrain: battleTerrainAt(w, playerParty(w).x, playerParty(w).y) as Terrain, night: isNight(w), rain: w.rain, arena: { kind: "duel" }, player: { name: P.name, faction: (P as any).crest || P.status === "król" ? PLAYER_FACTION : P.liege || 9, troops: [], hero }, enemy: { name: `${L.title} ${L.name}`, faction: L.faction, troops: [{ type: key, n: 1 }] }, maxPerSide: 1, title: "Pojedynek dowódców", deploy: false, dmgTaken: w.diff?.dmg };
  G.ctx = { kind: "escape", enemies: [], allies: [], title: "Pojedynek", onEnd: (win) => {
    const r = G.battle?.result;
    G.battle = null; G.state = "map";
    if (r) P.hp = Math.max(1, Math.round(r.heroHp));
    if (win) { P.renown += 15; lordRel(w, L, -3, "upokorzyłeś go w pojedynku"); (G as any).duelMod = { team1: -30, team0: 10 }; toast(`${L.title} ${L.name} leży w błocie. Jego ludzie tracą ducha!`, PAL.gold); }
    else { (G as any).duelMod = { team0: -20, team1: 10 }; toast(`Przegrywasz pojedynek. Twoi ludzie widzieli, jak padasz.`, PAL.redL); }
    showMapHud();
    setTimeout(() => launchBattle({ kind: "field", enemies: [o, ...nearbyEnemyHelpers(w, o)], allies: nearbyAllies(w, o), title: o.name }, { defensive }), 300);
  } };
  closeScreen();
  const b = new Battle(cfg, input, sfx, settings);
  G.battle = b; b.phase = "fight"; G.state = "battle";
  const foe = b.units.find((u) => u.team === 1); if (foe) { foe.name = `${L.title} ${L.name}`; foe.commander = true; foe.maxHp = foe.hp = Math.round(foe.maxHp * 1.6); }
  hideMapHud(); showBattleHud();
  b.say(`${L.title} ${L.name} przyjmuje wyzwanie. Obie armie patrzą.`, PAL.gold, true);
  b.shout("Pojedynek!", PAL.gold);
  sfx.horn?.(0.8);
}

// ---------- Ranni wrogowie na polu ----------
// Po wygranej jeńcy to ranni wrogowie z pola. Gracz decyduje: opatrzyć ich (jeńcy zostają, honor) albo dobić.
function woundedChoiceHtml(r: BattleResult) {
  const n = r.prisoners.reduce((s, p) => s + p.n, 0);
  if (!r.win || n <= 0 || (r as any).woundedDone || G.ctx?.kind === "arena") return "";
  return `<div class="woundedq"><p>${ic("drop")} Na polu jęczy <b>${n}</b> rannych wrogów. Co z nimi?</p><div class="btns"><button class="alt" data-a="wSpare">Opatrzcie ich (jeńcy, honor +1)</button><button class="alt danger" data-a="wKill">Dobijcie (honor −2, postrach +3 sławy)</button></div></div>`;
}
function woundedSpare(r: BattleResult): string {
  const P = WORLD.player; (r as any).woundedDone = 1; P.honor += 1;
  return "Opatrujecie rannych wrogów i bierzecie ich do niewoli (honor +1).";
}
function woundedKill(r: BattleResult): string {
  const w = WORLD, P = w.player, p = playerParty(w);
  (r as any).woundedDone = 1;
  for (const pr of r.prisoners) removeTroops(p.prisoners, pr.type, Math.min(pr.n, p.prisoners.find((t) => t.type === pr.type)?.n || 0));
  const n = r.prisoners.reduce((s, q) => s + q.n, 0);
  r.prisoners = []; P.honor -= 2; P.renown += 3;
  for (const L of w.lords) if (L.alive && (L as any).personality === "honorowy" && chance(0.2)) lordRel(w, L, -1, "dobijałeś rannych");
  return `Mizerykordie idą w ruch. ${n} rannych nie wstanie już nigdy (honor −2).`;
}

// ---------- Pułapki przed bitwą w obronie ----------
interface Trap { x: number; y: number; kind: "stakes" | "ditch"; hp: number; }
function trapsAllowed(b: Battle) { return !!b.cfg.defensive && b.phase === "deploy" && !b.cfg.arena && b.cfg.terrain !== "siege"; }
function trapStock(b: Battle) { const eng = WORLD?.player?.companions?.some((c) => c.role === "inżynier") ? 3 : 0; return { stakes: 4 + eng, ditch: 2 + Math.floor(eng / 2) }; }
function placeTrap(b: Battle, kind: "stakes" | "ditch", x: number, y: number) {
  const T = ((b as any).traps ||= []) as Trap[];
  const used = T.filter((t) => t.kind === kind).length, max = trapStock(b)[kind];
  if (used >= max) { b.say(kind === "stakes" ? "Nie ma już zaostrzonych pali." : "Ludzie nie zdążą wykopać kolejnego rowu.", PAL.ash); return; }
  if (x > b.mw * 0.5) { b.say("Pułapki tylko po twojej stronie pola.", PAL.ash); return; }
  T.push({ x, y, kind, hp: kind === "stakes" ? 6 : 999 });
  if (kind === "ditch") for (let yy = y - 40; yy <= y + 40; yy += CELL) for (let xx = x - 8; xx <= x + 8; xx += CELL) { const cx = Math.floor(xx / CELL), cy = Math.floor(yy / CELL); if (cx >= 0 && cy >= 0 && cx < b.map.gw && cy < b.map.gh && b.map.grid[cy * b.map.gw + cx] !== 2) b.map.grid[cy * b.map.gw + cx] = 5; }
  // ślad na ziemi
  const g = b.dg;
  if (kind === "ditch") {
    const X = Math.round(x), Y = Math.round(y);
    g.fillStyle = PAL.dirt; g.fillRect(X - 9, Y - 41, 4, 82);   // wał z wykopanej ziemi po stronie obrońców
    g.fillStyle = PAL.dirtD; g.fillRect(X - 5, Y - 40, 11, 80); g.fillStyle = PAL.ink; g.fillRect(X - 3, Y - 38, 7, 76);
    for (let i = 0; i < 40; i++) { g.fillStyle = chance(0.5) ? PAL.dirt : PAL.dirtD; g.fillRect(X - 11 + Math.floor(rr(0, 6)), Y - 40 + Math.floor(rr(0, 80)), 1, 1); }
  }
  b.say(kind === "stakes" ? `Pale wbite (${used + 1}/${max}).` : `Rów wykopany (${used + 1}/${max}).`, PAL.gold);
  b.sfx.hammer?.();
}
// pale ranią i zatrzymują tych, którzy na nie wbiegną (szczególnie konnicę)
function updateTraps(b: Battle, dt: number) {
  const T = ((b as any).traps || []) as Trap[];
  for (const t of T) {
    if (t.kind !== "stakes" || t.hp <= 0) continue;
    for (const u of b.units) {
      if (!u.active || Math.abs(u.x - t.x) > 10 || Math.abs(u.y - t.y) > 34) continue;
      if (u.team === 0 && !u.mounted) continue;   // swoi przechodzą ostrożnie
      const sp = Math.hypot(u.vx, u.vy);
      if (sp < 20 && !u.mounted) continue;
      b.damage(u, u.mounted ? 55 : 22, null, false, "pierce", true);
      if (u.mounted && u.active) { u.horseHp -= 60; u.rspeed = 0; }
      u.vx *= -0.3; u.vy *= -0.3;
      t.hp--;
      if (t.hp <= 0) b.say("Pale połamane.", PAL.ash);
      break;
    }
  }
}
function drawTraps(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  for (const t of ((b as any).traps || []) as Trap[]) {
    if (t.kind !== "stakes") continue;
    const x = Math.round(t.x - sx), y = Math.round(t.y - sy);
    for (let k = -32; k <= 32; k += 8) { if (t.hp <= 0 && k % 16) continue; g.fillStyle = PAL.ink; g.fillRect(x - 1, y + k - 7, 3, 9); g.fillStyle = PAL.wood; g.fillRect(x, y + k - 7, 1, 8); g.fillStyle = PAL.bone; g.fillRect(x + 1, y + k - 8, 1, 2); g.fillRect(x + 2, y + k - 9, 1, 1); }
  }
}

// ---------- Zsiadanie i dosiadanie koni na rozkaz ----------
function orderDismount(b: Battle, gs: number[]) {
  let down = 0, up = 0;
  for (const g of gs) for (const u of b.squadUnits(g)) {
    if (u.mounted && u.horse) { (u as any).savedMount = { def: u.mountDef, hp: u.horseHp, max: u.horseMax, horse: u.horse }; u.mounted = false; u.rspeed = 0; down++; }
    else if (!u.mounted && (u as any).savedMount) { const s = (u as any).savedMount; u.mounted = true; u.mountDef = s.def; u.horseHp = s.hp; u.horseMax = s.max; u.horse = s.horse; (u as any).savedMount = null; up++; }
  }
  if (down) { b.say(`Zsiadać z koni! (${down})`, PAL.gold); b.sfx.neigh?.(0.6, 0); }
  else if (up) { b.say(`Na koń! (${up})`, PAL.gold); b.sfx.hoof?.(0.6, 0); }
  else b.say("W tym oddziale nikt nie ma konia.", PAL.ash);
}

// ---------- Ogień, który się rozprzestrzenia ----------
// Komórki 16 px. Płonie trawa, zboże, las i chaty; deszcz gasi, śnieg i błoto prawie nie palą się wcale.
interface Flame { cx: number; cy: number; life: number; heat: number; }
const FCELL = 16;
function fuelAt(b: Battle, x: number, y: number): number {
  if (!b.passable(x, y)) return 0;
  let f = ({ forest: 1, plains: 0.55, hills: 0.5, village: 0.7, streets: 0.65, swamp: 0.15, ruins: 0.3, siege: 0.25, arena: 0, snow: 0.1 } as Record<string, number>)[b.cfg.terrain] ?? 0.4;
  if ((b.cfg.season ?? 1) === 3) f *= 0.25; else if ((b.cfg.season ?? 1) === 1) f *= 1.25;   // zima i lato
  if (b.cfg.rain) f *= 0.08;
  for (const o of b.map.obstacles) if (Math.abs(o.x - x) < 14 && Math.abs(o.y - y) < 12) { f += o.tall === false ? 0.15 : 0.6; break; }
  const burnt = ((b as any).burnt ||= new Set<number>()) as Set<number>;
  if (burnt.has(Math.floor(y / FCELL) * 4096 + Math.floor(x / FCELL))) return 0;
  return Math.min(1.4, f);
}
function igniteAt(b: Battle, x: number, y: number, heat = 1) {
  if (b.cfg.arena) return;
  const F = ((b as any).flames ||= []) as Flame[];
  if (F.length > 140) return;
  const cx = Math.floor(x / FCELL), cy = Math.floor(y / FCELL);
  if (F.some((f) => f.cx === cx && f.cy === cy)) return;
  const fu = fuelAt(b, cx * FCELL + 8, cy * FCELL + 8);
  if (fu * heat < 0.25) return;
  F.push({ cx, cy, life: 6 + fu * 10, heat: fu });
  if (!(b as any).fireSaid) { (b as any).fireSaid = 1; b.say(b.cfg.terrain === "forest" ? "Las płonie!" : "Ogień rozlewa się po polu!", PAL.redL, true); }
}
function updateFire(b: Battle, dt: number) {
  const F = ((b as any).flames || []) as Flame[];
  if (!F.length) return;
  const burnt = ((b as any).burnt ||= new Set<number>()) as Set<number>;
  const add: [number, number][] = [];
  for (const f of F) {
    f.life -= dt * (b.cfg.rain ? 4 : 1);
    const x = f.cx * FCELL + 8, y = f.cy * FCELL + 8;
    // rozprzestrzenianie: wiatr lekko pcha w prawo
    if (chance(dt * 0.6 * f.heat)) { const d = pick([[1, 0], [1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1]]); add.push([x + d[0] * FCELL, y + d[1] * FCELL]); }
    // ludzie w ogniu się palą i uciekają
    for (const u of b.units) if (u.active && Math.abs(u.x - x) < 9 && Math.abs(u.y - y) < 8) { u.burnT = Math.max(u.burnT, 1.8); if (!u.def.undead) u.morale -= dt * 12; if (u.mounted) u.horseHp -= dt * 25; }
    if (chance(dt * 9)) b.parts.push({ x: x + rr(-7, 7), y: y + rr(-6, 6), z: rr(1, 8), vx: rr(-4, 8), vy: rr(-3, 3), vz: rr(15, 40), life: rr(0.3, 0.7), max: 0.7, col: pick([PAL.gold, PAL.redL, PAL.bloodL]), kind: "fire" });
    if (chance(dt * 2.5)) b.parts.push({ x: x + rr(-6, 6), y, z: rr(10, 20), vx: rr(4, 12), vy: rr(-2, 2), vz: rr(8, 16), life: rr(1.4, 2.6), max: 2.6, col: pick([PAL.ink, PAL.dusk, PAL.stone]), kind: "smoke" });
    if (f.life <= 0) {   // zgliszcza
      burnt.add(f.cy * 4096 + f.cx);
      for (let i = 0; i < 28; i++) { b.dg.fillStyle = chance(0.7) ? PAL.ink : PAL.dusk; b.dg.fillRect(Math.round(x + rr(-8, 8)), Math.round(y + rr(-7, 7)), 1, 1); }
      for (const o of b.map.obstacles) if (Math.abs(o.x - x) < 12 && Math.abs(o.y - y) < 10 && o.tall !== false && !(o as any).charred && o.img) { (o as any).charred = 1; o.img = silhouette(o.img, "#2a2420"); o.cover = false; }
    }
  }
  (b as any).flames = F.filter((f) => f.life > 0);
  for (const [x, y] of add) igniteAt(b, x, y, 0.9);
  if (chance(dt * 0.5)) { const f = pick(F); if (f) { const s = b.vol(f.cx * FCELL); b.sfx.fireCrackle(s.v * 0.4, s.pan); } }
}
function drawFire(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  for (const f of ((b as any).flames || []) as Flame[]) {
    const x = f.cx * FCELL - sx, y = f.cy * FCELL - sy;
    if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
    g.globalAlpha = 0.18; g.fillStyle = PAL.redL; g.fillRect(x - 2, y - 2, FCELL + 4, FCELL + 2); g.globalAlpha = 1;
    for (let i = 0; i < 16; i++) {
      const h = hashInt(f.cx * 31 + f.cy * 17 + i * 7 + Math.floor(b.real * 9));
      const px = x + (h % 16), py = y + ((h >>> 5) % 14), ht = 2 + ((h >>> 9) % 5);
      g.fillStyle = PAL.redL; g.fillRect(px, py - ht, 1, ht + 1);
      g.fillStyle = (h & 3) ? PAL.gold : PAL.boneHi; g.fillRect(px, py - ht, 1, 1);
    }
  }
}

// ---------- Pogoda zmienia się w trakcie bitwy ----------
function updateWeather(b: Battle, dt: number) {
  const W2 = b as any;
  if (!W2.fireInit) { W2.fireInit = 1; for (const p of ((b.map as any).burning || []) as V[]) if (chance(0.5)) igniteAt(b, p.x + rr(-10, 10), p.y + 22, 1.3); }   // płonące chaty zajmują trawę
  if (b.cfg.arena || b.cfg.terrain === "streets") return;
  if (W2.wxT === undefined) W2.wxT = rr(70, 200) / (chance(0.55) ? 1 : 3);   // nie w każdej bitwie
  W2.wxT -= dt;
  if (W2.wxT > 0 || W2.wxDone) return;
  W2.wxDone = 1;
  if (b.fogged) { b.fogged = false; b.say("Mgła się podnosi. Widać całe pole!", PAL.bone, true); return; }
  if (b.cfg.rain) { if (chance(0.5)) { b.cfg.rain = false; b.say("Deszcz ustaje. Cięciwy znów schną.", PAL.bone, true); } return; }
  if ((b.cfg.season ?? 1) === 3) { (b.cfg as any).snowfall = true; b.say("Zaczyna sypać śnieg.", PAL.bone, true); return; }
  if (chance(0.6)) { b.cfg.rain = true; b.sfx.thunder(0.6); b.say("Grzmot. Zaczyna lać. Łucznicy klną, ogień gaśnie.", PAL.bone, true); }
  else if (!b.cfg.night) { b.fogged = true; b.say("Od rzeki nadciąga mgła.", PAL.bone, true); }
}

// ---------- Widok taktyczny: chorągwie oddziałów nad mapą ----------
function drawTacView(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  const sq = new Map<string, { x: number; y: number; n: number; team: number; s: number }>();
  for (const u of b.units) {
    if (!u.active || u.hero) continue;
    if (u.team === 1 && !(b.hero ? b.isVisibleTo(u, b.hero) : true)) continue;
    const k = `${u.team}:${u.squad}`; const e = sq.get(k) || { x: 0, y: 0, n: 0, team: u.team, s: u.squad };
    e.x += u.x; e.y += u.y; e.n++; sq.set(k, e);
  }
  for (const e of sq.values()) {
    const x = Math.round(e.x / e.n - sx), y = Math.round(e.y / e.n - sy) - 34;
    const col = e.team === 0 ? SQUAD_COLORS[e.s] || PAL.bone : e.team === 2 ? PAL.moss : PAL.redL;
    g.fillStyle = PAL.ink; g.fillRect(x - 9, y - 6, 19, 11);
    g.fillStyle = col; g.fillRect(x - 8, y - 5, 17, 9);
    g.fillStyle = PAL.ink; g.fillRect(x, y + 5, 1, 8);
    pxSmall(g, String(e.n), x + 1, y + 2, PAL.ink);
  }
  if (b.hero?.active) { const x = Math.round(b.hero.x - sx), y = Math.round(b.hero.y - sy) - 30; g.fillStyle = PAL.gold; g.fillRect(x - 2, y - 2, 5, 5); g.fillStyle = PAL.ink; g.fillRect(x, y, 1, 1); }
}

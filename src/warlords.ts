// Lordowie i bestie w bitwie (Build 0.32): lord jest większy, ma gwardię i chorążego, zachowuje się według
// charakteru (honorowy wyzywa bohatera, okrutny budzi postrach, ostrożny trzyma się z tyłu, chciwy ucieka);
// wilki olbrzymy skaczą i obalają.

type LordTrait = "honorowy" | "chciwy" | "okrutny" | "ostrożny";
const TRAIT_SAY: Record<LordTrait, string> = { honorowy: "wychodzi przed szereg i szuka ciebie wzrokiem", chciwy: "trzyma się z tyłu, za plecami swoich", okrutny: "każe wznieść pale i obiecuje, że jeńców nie będzie", ostrożny: "stoi za łucznikami i czeka" };
function lordTrait(b: Battle): LordTrait | null { return ((b.cfg as any).lordTrait as LordTrait) || null; }
// przygotowanie: gwardia, chorąży, rozkazy dowódcy według charakteru
function setupLord(b: Battle) {
  const tr = lordTrait(b); const c = b.commanders.find((u) => u.team === 1); if (!c || !tr) return;
  (c as any).big = true; c.maxHp = c.hp = Math.round(c.maxHp * 1.25);
  const guards = b.units.filter((u) => u.team === 1 && u !== c && !u.mounted === !c.mounted && !u.def.bow && !u.def.ability).sort((p, q) => q.def.tier - p.def.tier).slice(0, 6);
  guards.forEach((g, i) => { (g as any).guard = true; g.squad = 5; g.x = c.x + rr(-20, 20); g.y = c.y + rr(-20, 20); if (i === 0) g.bearer = true; });
  const o = b.eorders[5]; if (!o) return;
  if (tr === "honorowy" || tr === "okrutny") o.mode = "charge";
  else { o.mode = "hold"; o.ax = Math.min(b.mw - 40, o.ax + 70); }
  b.say(`${(b.cfg.enemy.name || "Lord")} ${TRAIT_SAY[tr]}.`, PAL.bone, true);
}
function lordAI(b: Battle, u: Unit, dt: number): boolean {
  const h = b.hero, U = u as any;
  if (u.def.key === "x_direwolf") return beastLeap(b, u, dt);
  if (u.team !== 1) return false;
  if (u.commander) {
    const tr = lordTrait(b); if (!tr) return false;
    if (tr === "honorowy" && h?.active && !U.challenged && dist(u.x, u.y, h.x, h.y) < 150) { U.challenged = 1; (b as any).duelT = b.time + 15; u.target = h; b.say(`${b.cfg.enemy.name}: „Ty i ja. Nikt się nie wtrąca!”`, PAL.gold, true); b.shout("Pojedynek!", PAL.gold); }
    if (tr === "honorowy" && ((b as any).duelT || 0) > b.time && h?.active) u.target = h;
    if (tr === "okrutny") for (const x of b.units) if (x.active && x.team === 0 && !x.hero && !x.def.undead && Math.abs(x.x - u.x) < 70 && Math.abs(x.y - u.y) < 60) x.morale -= dt * 3;
    if (tr === "chciwy" && u.hp < u.maxHp * 0.45 && !u.fleeing) { u.fleeing = true; b.say(`${b.cfg.enemy.name} rzuca się do ucieczki!`, PAL.gold, true); for (const x of b.units) if (x.active && x.team === 1 && !x.def.undead) x.morale -= 15; }
    return false;
  }
  if (U.guard) {
    const c = b.commanders.find((x) => x.team === 1 && x.active);
    if (!c) { U.guard = false; return false; }
    const duel = ((b as any).duelT || 0) > b.time;
    if (duel && h && (!u.target || u.target === h || !u.target.active)) { u.target = null; u.retarget = 0.5; u.moving = false; u.vx *= 0.8; u.vy *= 0.8; u.wantFace = Math.atan2(h.y - u.y, h.x - u.x); return true; }   // gwardia patrzy, nie wtrąca się
    if (!duel && h?.active && dist(h.x, h.y, c.x, c.y) < 75) { u.target = h; return false; }
    const far = dist(u.x, u.y, c.x, c.y) > 45, busy = u.target && u.target.active && dist(u.x, u.y, u.target.x, u.target.y) < 36;
    if (far && !busy && u.state === "idle") { b.steer(u, c.x + rr(-12, 12), c.y + rr(-12, 12), u.def.speed, dt); return true; }
  }
  return false;
}
// padający sztandar łamie ducha
function bearerFalls(b: Battle, d: Unit) {
  if (!d.bearer || d.team !== 1 || !(d as any).guard) return;
  b.floater(d.x, d.y - 40, "SZTANDAR PADA", PAL.gold, true); b.say("Chorąży lorda pada. Sztandar w błocie!", PAL.gold, true);
  for (const x of b.units) if (x.active && x.team === 1 && !x.def.undead && dist(x.x, x.y, d.x, d.y) < 160) x.morale -= 14;
}
// wilk olbrzym: skok i obalenie
function beastLeap(b: Battle, u: Unit, dt: number): boolean {
  const U = u as any, t = u.target;
  if (U.leapT > 0) {
    U.leapT -= dt;
    if (t && t.active && dist(u.x, u.y, t.x, t.y) < 12 && !U.leapHit) {
      U.leapHit = 1; b.damage(t, 18, u, false, "pierce", true);
      if (t.active && !t.mounted) { b.stagger(t, t.hero ? 0.8 : 1.3); b.floater(t.x, t.y - 34, "OBALONY", PAL.redL, t.hero); }
      if (t.mounted && chance(0.3)) b.dismount(t);
    }
    return U.leapT > 0;
  }
  if (!t || !t.active || (U.leapCd || 0) > b.time) return false;
  const d = dist(u.x, u.y, t.x, t.y);
  if (d < 35 || d > 80 || u.state !== "idle") return false;
  U.leapCd = b.time + rr(5, 8); U.leapT = 0.35; U.leapHit = 0;
  const a = Math.atan2(t.y - u.y, t.x - u.x); u.vx = Math.cos(a) * 230; u.vy = Math.sin(a) * 230; u.face = u.wantFace = a;
  const s = b.vol(u.x); b.sfx.trample(s.v * 0.6, s.pan); b.dust(u.x, u.y, 4);
  return true;
}

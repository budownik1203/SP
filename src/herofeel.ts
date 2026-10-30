// Walka bohaterem (Build 0.29): mniej ociężałości. Bez kierunków ciosu: LPM prowadzi płynną serię zależną od broni,
// przytrzymanie LPM to mocniejszy cios, R przełącza pchnięcie i cięcie. Bufor ciosu, przerwanie zamachu, miękkie
// przyciąganie do wroga przy kursorze, rozpęd biegu, garda wroga pęka od serii, kara za otoczenie.

type WClass = "sword" | "dagger" | "axe" | "blunt" | "spear" | "two" | "claws" | "staff" | "lance";
function wclass(w: Weapon): WClass {
  if (w.name === "Kopia") return "lance";
  if (w.claws) return "claws";
  if (w.staff) return "staff";
  if (w.axe) return "axe";
  if (w.head) return "blunt";
  if (w.len <= 8) return "dagger";
  if (w.dmg.T >= w.dmg.L * 1.15 && w.len >= 13) return "spear";
  if (w.twoHanded) return "two";
  return "sword";
}
const WCLASS_NAME: Record<WClass, string> = { sword: "miecz", dagger: "nóż", axe: "topór", blunt: "obuch", spear: "włócznia", two: "dwuręczna", claws: "pazury", staff: "kostur", lance: "kopia" };
// serie: cięcia (i pchnięcia w trybie R tam, gdzie broń kole)
const SERIES_CUT: Record<WClass, Dir[]> = { sword: ["R", "L", "O"], dagger: ["R", "L", "R", "L"], axe: ["R", "O"], blunt: ["O", "R"], spear: ["T", "R", "T"], two: ["R", "L", "O"], claws: ["R", "L", "R"], staff: ["R", "L", "O"], lance: ["R", "L"] };
const SERIES_THRUST: Partial<Record<WClass, Dir[]>> = { sword: ["T", "T", "R"], dagger: ["T", "T", "T", "T"], spear: ["T", "T", "T"], two: ["T", "R", "T"] };
function seriesOf(b: Battle, h: Unit): Dir[] {
  const c = wclass(h.w);
  return (b.thrustMode && SERIES_THRUST[c]) || SERIES_CUT[c];
}
function hx(h: Unit): any { return h as any; }
// kierunek następnego ciosu w serii (seria wygasa po chwili bez ataku)
function seriesNext(b: Battle, h: Unit): { dir: Dir; i: number; n: number } {
  const s = seriesOf(b, h), H = hx(h);
  if (b.time - (H.lastAtkT ?? -9) > 0.9 && h.state === "idle") H.comboI = 0;
  const i = (H.comboI || 0) % s.length;
  return { dir: s[i], i, n: s.length };
}
// miękkie przyciąganie: wróg najbliżej kursora, jeśli jest w zasięgu zamachu
function softTarget(b: Battle, h: Unit, wx: number, wy: number): Unit | null {
  let best: Unit | null = null, bd = 1e9;
  const reach = h.w.reach + 26;
  for (const u of b.units) {
    if (!u.active || u.team === h.team || u.state === "down") continue;
    const dh = dist(h.x, h.y, u.x, u.y); if (dh > reach + 14) continue;
    const dc = dist(wx, wy, u.x, u.y - 10); if (dc > 46) continue;
    const sc = dc + dh * 0.35; if (sc < bd) { bd = sc; best = u; }
  }
  return best;
}
function heroStartSeries(b: Battle, h: Unit, wx: number, wy: number) {
  const H = hx(h), nx = seriesNext(b, h);
  let d = nx.dir;
  if (h.mounted) d = angDiff(h.heading, h.wantFace) < 0 ? "L" : "R";
  H.soft = softTarget(b, h, wx, wy);
  H.runSp = Math.hypot(h.vx, h.vy);
  H.seriesI = nx.i; H.seriesN = nx.n;
  b.startWindup(h, d); h.key2 = "mouse";
  H.comboI = nx.i + 1; H.lastAtkT = b.time;
  if (nx.i === nx.n - 1) { h.stamina -= 6 * (1 - masteryK(b, h) * 0.5); h.staminaWait = 0.8; }   // koniec serii kosztuje więcej
}
// po ostatnim ciosie serii chwila oddechu (mistrzostwo ją skraca)
function seriesCooldown(b: Battle, h: Unit) { const H = hx(h); return H.seriesI === (H.seriesN || 1) - 1 ? 0.42 * (1 - masteryK(b, h) * 0.5) : 0.04; }
function masteryK(b: Battle, h: Unit) { return clamp(b.P("mastery_" + wclass(h.w)), 0, 1); }

// obrót: bohater obraca się szybciej niż piechota, w trakcie zamachu też
function heroTurnRate(u: Unit): number {
  switch (u.state) { case "windup": return 5; case "strike": return 2; case "recover": return 4.2; case "stagger": return 0.8; case "kick": return 2.2; default: return u.mounted ? 6 : 10; }
}
// rozpęd: cios z biegu mocniejszy
function momentumK(h: Unit) { const sp = hx(h).runSp || 0; return 1 + clamp((sp - 45) / 120, 0, 0.35); }
// otoczony bohater
function surroundCount(b: Battle, h: Unit) { let n = 0; for (const u of b.units) if (u.active && u.team !== h.team && !u.fleeing && Math.abs(u.x - h.x) < 34 && Math.abs(u.y - h.y) < 30) n++; return n; }
function heroSurroundTick(b: Battle, h: Unit, dt: number) {
  const H = hx(h); H.surT = (H.surT || 0) - dt;
  if (H.surT > 0) return;
  H.surT = 0.4; H.surN = surroundCount(b, h);
  if (H.surN >= 3 && b.time - (H.surSaid ?? -9) > 6) { H.surSaid = b.time; b.say("Otaczają cię! Ciosy w plecy bolą bardziej.", PAL.redL, true); }
}
function backHitK(b: Battle, d: Unit, a: Unit) {
  if (!d.hero || (hx(d).surN || 0) < 3) return 1;
  return Math.abs(angDiff(d.face, Math.atan2(a.y - d.y, a.x - d.x))) > 1.7 ? 1.3 : 1;
}
// garda wroga pęka od serii: dwa zablokowane ciosy bohatera z rzędu, trzeci przechodzi
function guardBreaks(b: Battle, d: Unit): boolean {
  const D = hx(d);
  if (b.time - (D.ghT ?? -9) > 1.8) D.gh = 0;
  D.gh = (D.gh || 0) + 1; D.ghT = b.time;
  if (D.gh >= 3) { D.gh = 0; return true; }
  return false;
}

// ---------- B30: koniec serii, ciężki cios przez kilku, uderzenie tarczą, zaparta włócznia ----------
function isSeriesEnd(h: Unit) { const H = hx(h); return h.hero && H.seriesN > 1 && H.seriesI === H.seriesN - 1 && h.key2 === "mouse"; }
// skromny koniec serii zależny od klasy broni (bez efektownych finiszerów: te są umiejętnościami)
function seriesEndMods(b: Battle, a: Unit, d: Unit, dir: Dir): { dmgK: number; armIgnore: number; after: (() => void) | null; label: string } {
  const c = wclass(a.w);
  switch (c) {
    case "sword": return dir === "T" ? { dmgK: 1.15, armIgnore: 0.25, after: null, label: "PRZEBICIE" } : { dmgK: 1.1, armIgnore: 0, after: null, label: "" };
    case "dagger": return { dmgK: 1, armIgnore: 0.45, after: null, label: "W SZCZELINĘ" };
    case "axe": return { dmgK: 1.1, armIgnore: 0, after: null, label: "" };
    case "blunt": return { dmgK: 1.1, armIgnore: 0.1, after: () => { if (d.active && !d.def.undead) { b.stagger(d, d.def.poise ? 0.7 : 1.15); hx(d).dented = 1; b.floater(d.x, d.y - 38, "OGŁUSZONY", PAL.gold, true); } }, label: "" };
    case "spear": return { dmgK: 1.05, armIgnore: 0.1, after: () => { if (d.active) { b.push(d, a.x, a.y, 110); slamCheck(b, d, a.x, a.y); } }, label: "" };
    case "two": return { dmgK: 1.15, armIgnore: 0, after: () => { if (d.active && !d.def.poise) { b.stagger(d, 1.0); b.floater(d.x, d.y - 38, "POWALONY", PAL.gold, true); } }, label: "" };
    default: return { dmgK: 1.05, armIgnore: 0, after: null, label: "" };
  }
}
// ile celów zmieści się w ciężkim zamachu: zależy od zasięgu broni
function cleaveCount(a: Unit): number {
  if (!a.hero || a.mounted) return 1;
  const heavy = a.hold > 0.5 || (isSeriesEnd(a) && wclass(a.w) === "two");
  if (!heavy || a.dir === "T") return 1;
  return a.w.reach >= 24 ? 3 : a.w.reach >= 18 ? 2 : 1;
}
// uderzenie tarczą: przytrzymany blok + LPM
function shieldBash(b: Battle, h: Unit) {
  const H = hx(h);
  if ((H.bashCd ?? 0) > b.time || h.stamina < 14) return;
  H.bashCd = b.time + 0.7; h.stamina -= 14; h.staminaWait = 0.7;
  h.vx += Math.cos(h.face) * 60; h.vy += Math.sin(h.face) * 60;
  let hit = false;
  for (const u of b.units) {
    if (u.team === h.team || !u.active || u.mounted) continue;
    if (dist(h.x, h.y, u.x, u.y) > 20 + u.radius || Math.abs(angDiff(h.face, Math.atan2(u.y - h.y, u.x - h.x))) > 0.8) continue;
    hit = true;
    b.push(u, h.x, h.y, u.def.poise ? 60 : 130); slamCheck(b, u, h.x, h.y);
    if (u.state === "windup" || u.state === "strike") { b.stagger(u, 0.8); b.floater(u.x, u.y - 34, "PRZERWANY", PAL.gold, true); }
    else b.stagger(u, u.def.poise ? 0.3 : 0.6);
    b.damage(u, 6, h, false, "blunt", false);
    breakPosture(b, u, 25);
  }
  const s = b.vol(h.x); b.sfx.thunk(s.v, s.pan); if (hit) { b.hitstop = Math.max(b.hitstop, 0.07); b.kickCam(Math.cos(h.face), Math.sin(h.face), 1.2); }
  b.dust(h.x + Math.cos(h.face) * 8, h.y + Math.sin(h.face) * 6, 3);
}
// zaparta broń drzewcowa zatrzymuje szarżującego jeźdźca i zrzuca go z konia
function braceTick(b: Battle, dt: number) {
  const B = b as any; B.braceT = (B.braceT || 0) - dt; if (B.braceT > 0) return; B.braceT = 0.12;
  for (const u of b.units) {
    if (!u.active || u.mounted || wclass(u.w) !== "spear") continue;
    const still = u.hero ? !u.moving && (u.state === "idle" || u.blocking) : (u.state === "idle" && !u.moving && (b.inFormation(u) || chance(0.5)));
    if (!still) continue;
    for (const r of b.units) {
      if (!r.active || !r.mounted || r.team === u.team || r.rspeed < r.maxRide * 0.45) continue;
      const d = dist(u.x, u.y, r.x, r.y); if (d > u.w.reach + 10) continue;
      if (Math.abs(angDiff(u.face, Math.atan2(r.y - u.y, r.x - u.x))) > 0.7) continue;
      if ((hx(r).braceHitT ?? -9) > b.time - 1.5) continue;
      hx(r).braceHitT = b.time;
      const s = b.vol(r.x); b.sfx.thunk(s.v, s.pan); b.sfx.neigh?.(s.v, s.pan);
      r.horseHp -= 90 + r.rspeed * 0.4; r.rspeed *= 0.15;
      b.damage(r, 25 + r.rspeed * 0.1, u, false, "pierce", true);
      if (r.active && r.mounted && r.horseHp <= 0) b.dismount(r);
      if (r.active && r.mounted && chance(0.45)) { b.dismount(r); }
      if (r.active && !r.mounted) { b.stagger(r, r.hero ? 0.8 : 1.3); b.floater(r.x, r.y - 34, "ZRZUCONY Z KONIA", PAL.gold, u.hero || r.hero); }
      if (u.hero || r.hero) { b.hitstop = Math.max(b.hitstop, 0.1); b.shake(2); }
      break;
    }
  }
}
// ---------- postawa elit, oficerów i lordów (pasek, który łamią bloki, ciężkie ciosy, kopniaki) ----------
function hasPosture(u: Unit) { return !u.hero && (u.commander || u.def.tier >= 5 || !!u.def.ability); }
function breakPosture(b: Battle, u: Unit, v: number) {
  if (!hasPosture(u) || !u.active) return;
  const U = hx(u); U.post = Math.min(100, (U.post || 0) + v); U.postT = b.time;
  if (U.post >= 100) { U.post = 0; b.stagger(u, 1.4); b.floater(u.x, u.y - 40, "POSTAWA ZŁAMANA", PAL.gold, true); const s = b.vol(u.x); b.sfx.clang(s.v, s.pan); b.sparks(u.x, u.y - 14, 16, PAL.gold); }
}
function postureTick(b: Battle, dt: number) { for (const u of b.units) { const U = hx(u); if (U.post > 0 && b.time - (U.postT || 0) > 1.5) U.post = Math.max(0, U.post - dt * 18); } }
function drawPosture(b: Battle, g: CanvasRenderingContext2D, u: Unit, x: number, y: number) {
  const p = hx(u).post || 0; if (p <= 1 || !hasPosture(u)) return;
  const w = 14, f = Math.round(w * p / 100);
  g.fillStyle = PAL.ink; g.fillRect(x - w / 2 - 1, y - 1, w + 2, 3);
  g.fillStyle = p > 75 ? PAL.gold : PAL.bone; g.fillRect(x - w / 2, y, f, 1);
}

// ---------- B31: obrona i czucie trafienia ----------
// idealny unik: odskok trafiony w ostatniej chwili spowalnia czas i daje kontrę
function perfectDodge(b: Battle, d: Unit) {
  if (!d.hero) return;
  const D = hx(d); if ((D.pdT ?? -9) > b.time - 1) return; D.pdT = b.time;
  b.slowT = Math.max(b.slowT, 0.45); d.counterT = 0.9; d.stamina = Math.min(100, d.stamina + 10);
  b.floater(d.x, d.y - 34, "IDEALNY UNIK", PAL.gold, true); b.sfx.parry();
}
// ciosy nie do zablokowania: lordowie, dowódcy i potwory czasem biorą zamach, którego nie da się sparować
function rollUnblockable(u: Unit) { hx(u).unblock = !u.hero && (u.commander || u.def.culture === "monster" && u.def.tier >= 3 || u.def.tier >= 6) && chance(0.22); }
function isUnblockable(u: Unit) { return !!hx(u).unblock; }
// zapowiedzi ciosów elit i oficerów (zawsze widoczne, niezależnie od ustawienia „podpowiedzi”)
function drawTelegraphs(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  const h = b.hero; if (!h || !h.active) return;
  for (const u of b.units) {
    if (!u.active || u.team === 0 || u.state !== "windup" || u.target !== h) continue;
    if (!hasPosture(u) && !isUnblockable(u)) continue;
    if (dist(u.x, u.y, h.x, h.y) > 80) continue;
    const x = Math.round(u.x - sx), y = Math.round(u.y - sy - u.spr.h - (u.mounted ? 14 : 2));
    const blink = Math.floor(b.real * 12) % 2 === 0;
    const col = isUnblockable(u) ? PAL.redL : PAL.gold;
    g.fillStyle = PAL.ink; g.fillRect(x - 2, y - 7, 5, 7);
    g.fillStyle = blink ? col : PAL.bone; g.fillRect(x - 1, y - 6, 3, 3); g.fillRect(x, y - 2, 1, 1);
    if (isUnblockable(u)) { g.globalAlpha = 0.5; g.fillStyle = PAL.redL; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.28 + b.real * 3; g.fillRect(Math.round(x + Math.cos(a) * 9), Math.round(u.y - sy - 10 + Math.sin(a) * 5), 1, 1); } g.globalAlpha = 1; }
  }
}
// parowanie odbija strzały w stronę strzelca
function deflectArrow(b: Battle, u: Unit, ar: Arrow): boolean {
  if (!u.hero || !u.blocking || b.time - u.blockStart > b.parryWindow() + 0.1) return false;
  const src = ar.src; const a = src && src.active ? Math.atan2(src.y - 12 - (u.y - 12), src.x - u.x) : Math.atan2(-ar.vy, -ar.vx);
  b.fire(u, a + rr(-0.05, 0.05), 300, ar.dmg * 0.8, src ? dist(u.x, u.y, src.x, src.y) + 10 : 200, ar.kind === "bolt" ? "bolt" : "arrow");
  b.floater(u.x, u.y - 34, "ODBITA", PAL.gold, true); b.sfx.parry(); b.sparks(u.x, u.y - 14, 8, PAL.gold);
  return true;
}
// uderzenie o przeszkodę albo innego żołnierza po mocnym odrzucie
function slamCheck(b: Battle, d: Unit, fromX: number, fromY: number) {
  if (!d.active || d.mounted) return;
  const a = Math.atan2(d.y - fromY, d.x - fromX), bx = d.x + Math.cos(a) * 12, by = d.y + Math.sin(a) * 10;
  let hitWhat = "";
  if (!b.passable(bx, by)) hitWhat = "wall";
  else if (b.map.obstacles.some((o) => o.tall !== false && Math.abs(o.x - bx) < 7 && Math.abs(o.y - by) < 5)) hitWhat = "tree";
  const other = b.units.find((o) => o !== d && o.active && !o.mounted && Math.abs(o.x - bx) < 7 && Math.abs(o.y - by) < 6);
  if (!hitWhat && other) hitWhat = "unit";
  if (!hitWhat) return;
  b.damage(d, 12, null, false, "blunt", true);
  if (!d.active) return;
  b.stagger(d, 1.0);
  b.floater(d.x, d.y - 38, hitWhat === "unit" ? "WPADA NA SWOICH" : "O PRZESZKODĘ", PAL.gold, true);
  if (other && hitWhat === "unit") { b.stagger(other, 0.5); b.push(other, d.x, d.y, 50); }
  const s = b.vol(d.x); b.sfx.thunk(s.v, s.pan); b.dust(bx, by, 4);
}
// egzekucja: F przy ogłuszonym wrogu
function tryExecute(b: Battle, h: Unit): boolean {
  let t: Unit | null = null, td = 1e9;
  for (const u of b.units) {
    if (!u.active || u.team === h.team || u.mounted || u.state !== "stagger" || u.hold - u.t < 0.25 || u.hold < 0.9) continue;
    const d = dist(h.x, h.y, u.x, u.y); if (d < 22 + u.radius && d < td) { td = d; t = u; }
  }
  if (!t) return false;
  h.state = "kick"; h.t = 0.1; h.hitDone = true; h.stamina = Math.min(100, h.stamina + 15);
  h.face = h.wantFace = Math.atan2(t.y - h.y, t.x - h.x);
  b.hitstop = Math.max(b.hitstop, 0.16); b.shake(2.5); b.kickCam(Math.cos(h.face), Math.sin(h.face), 1.8);
  b.floater(t.x, t.y - 40, "EGZEKUCJA", PAL.redL, true);
  b.damage(t, 9999, h, true, "cut", true);
  for (const u of b.units) if (u.active && u.team === t.team && !u.def.undead && dist(u.x, u.y, t.x, t.y) < 90) u.morale -= 10;
  return true;
}
// licznik serii zabójstw bohatera
function heroKillStreak(b: Battle, h: Unit, d: Unit) {
  const H = hx(h); H.streak = b.time - (H.lastKillT ?? -9) < 4 ? (H.streak || 0) + 1 : 1; H.lastKillT = b.time;
  if (H.streak >= 3) b.floater(h.x, h.y - 46, `×${H.streak}`, PAL.gold, true);
  if (H.streak % 5 === 0) { b.say(`Seria ×${H.streak}! Twoi ludzie nabierają ducha.`, PAL.gold, true); for (const u of b.units) if (u.active && u.team === 0 && !u.hero && dist(u.x, u.y, h.x, h.y) < 130) u.morale = Math.min(100, u.morale + 6); b.sfx.battleCry(0.6); }
}
// trafienie krytyczne bohatera
function critRoll(b: Battle, a: Unit, d: Unit, angFromD: number): number {
  if (!a.hero) return 1;
  const c = 0.07 + (angFromD > 2.1 ? 0.12 : 0) + (d.state === "stagger" ? 0.15 : 0);
  if (!chance(c)) return 1;
  b.floater(d.x, d.y - 48, "KRYTYK", PAL.gold, true); b.sparks(d.x, d.y - 14, 12, PAL.gold); b.sfx.clang(1, 0); b.hitstop = Math.max(b.hitstop, 0.1);
  return 1.5;
}

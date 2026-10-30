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
  return seriesWithMastery(b, h, (b.thrustMode && SERIES_THRUST[c]) || SERIES_CUT[c]);
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

// ---------- B31: mistrzostwo broni, ruch specjalny broni, broń rzucana, szał ----------
// Mistrzostwo: poziom 0–5 dla każdej klasy broni, rośnie od trafień, ćwiczeń w obozie i nauczycieli.
function masteryXp(P: PlayerState): Record<string, number> { return ((P as any).mastery ||= {}); }
function masteryLevel(P: PlayerState, c: string) { return Math.min(5, Math.floor(Math.sqrt((masteryXp(P)[c] || 0) / 60))); }
function addMastery(P: PlayerState, c: string, v: number, lines?: string[]) {
  const before = masteryLevel(P, c); masteryXp(P)[c] = (masteryXp(P)[c] || 0) + v; const after = masteryLevel(P, c);
  if (after > before && lines) lines.push(`Mistrzostwo (${WCLASS_NAME[c as WClass] || c}): poziom ${after}.${after === 2 ? " Odblokowany ruch specjalny broni (klawisz 5)." : after === 4 ? " Seria dłuższa o jeden cios." : ""}`);
}
// wpięcie do bitwy: perki mastery_<klasa> = poziom/5 (używane przez seriesCooldown, zamach, parowanie)
function masteryPk(P: PlayerState, pk: Record<string, number>) { for (const c of Object.keys(WCLASS_NAME)) pk["mastery_" + c] = masteryLevel(P, c) / 5; }
function masteryHit(b: Battle, h: Unit) { const B = b as any; const c = wclass(h.w); (B.mastHits ||= {})[c] = (B.mastHits[c] || 0) + 1; }
// dłuższa seria od poziomu 4 (powtarza pierwszy cios)
function seriesWithMastery(b: Battle, h: Unit, s: Dir[]) { return masteryK(b, h) >= 0.8 ? [...s, s[0]] : s; }

// Ruch specjalny klasy broni (umiejętność pod klawiszem 5, od 2. poziomu mistrzostwa)
const SPECIALS: Record<string, { name: string; cost: number; cd: number; desc: string }> = {
  sword: { name: "Wypad", cost: 18, cd: 9, desc: "Długie pchnięcie z wypadu: dwa razy dalszy zasięg, przebija część pancerza." },
  dagger: { name: "Cios w plecy", cost: 16, cd: 10, desc: "Doskok za plecy najbliższego wroga i pewne trafienie krytyczne." },
  axe: { name: "Rozłupanie", cost: 18, cd: 10, desc: "Rąbnięcie, które rozbija tarczę i ogłusza." },
  blunt: { name: "Cios w hełm", cost: 18, cd: 10, desc: "Ogłusza na 2 s i mocno łamie postawę." },
  spear: { name: "Podcięcie", cost: 16, cd: 9, desc: "Zamach drzewcem po nogach: przewraca wrogów przed tobą." },
  two: { name: "Młyniec", cost: 24, cd: 12, desc: "Obrót z bronią: trafia wszystkich dookoła." },
  claws: { name: "Rozdarcie", cost: 12, cd: 8, desc: "Seria pazurów." }, staff: { name: "Zamiatanie", cost: 12, cd: 8, desc: "Odrzuca wrogów kosturem." }, lance: { name: "—", cost: 99, cd: 99, desc: "" },
};
function hitArc(b: Battle, h: Unit, arc: number, reach: number, fn: (u: Unit) => void, max = 9) {
  const list = b.units.filter((u) => u.active && u.team !== h.team && dist(h.x, h.y, u.x, u.y) <= reach + u.radius && Math.abs(angDiff(h.face, Math.atan2(u.y - h.y, u.x - h.x))) <= arc).sort((p, q) => dist(h.x, h.y, p.x, p.y) - dist(h.x, h.y, q.x, q.y)).slice(0, max);
  for (const u of list) fn(u);
  return list.length;
}
function weaponSpecial(b: Battle) {
  const h = b.hero, H = b.heroCfg; if (!h || !h.active || !H || h.mounted || h.usingBow) return;
  const c = wclass(h.w), lv = Math.round(masteryK(b, h) * 5), S = SPECIALS[c];
  if (lv < 2) { b.say(`Ruch specjalny (${WCLASS_NAME[c]}) odblokujesz na 2. poziomie mistrzostwa tej broni.`, PAL.ash); return; }
  if ((b.cds["sp_" + c] || 0) > 0) { b.say(`${S.name}: jeszcze ${Math.ceil(b.cds["sp_" + c])} s`, PAL.ash); return; }
  if (h.stamina < S.cost) { b.say("Za mało tchu", PAL.ash); return; }
  if (h.state !== "idle" && h.state !== "recover") return;
  h.stamina -= S.cost; h.staminaWait = 0.8; b.cds["sp_" + c] = S.cd;
  const w = h.w, base = (w.dmg.L + w.dmg.T) / 2 * b.heroDmg;
  b.shout(S.name, PAL.gold); const s = b.vol(h.x); b.sfx.swing(s.v, s.pan, 1.4);
  h.state = "recover"; h.t = 0;
  switch (c) {
    case "sword": h.vx += Math.cos(h.face) * 110; h.vy += Math.sin(h.face) * 110; hitArc(b, h, 0.35, w.reach * 2, (u) => b.damage(u, base * 1.5 * Math.pow(Math.max(0.2, u.arm.pierce), -0.3) * u.arm.pierce, h, false, "pierce", true), 2); break;
    case "dagger": { const t = b.units.filter((u) => u.active && u.team !== h.team && dist(h.x, h.y, u.x, u.y) < 60).sort((p, q) => dist(h.x, h.y, p.x, p.y) - dist(h.x, h.y, q.x, q.y))[0]; if (!t) break; h.x = t.x - Math.cos(t.face) * 12; h.y = t.y - Math.sin(t.face) * 10; h.face = h.wantFace = Math.atan2(t.y - h.y, t.x - h.x); b.dust(h.x, h.y, 5); b.floater(t.x, t.y - 48, "KRYTYK", PAL.gold, true); b.damage(t, base * 2.4 * t.arm.pierce, h, false, "pierce", true); break; }
    case "axe": hitArc(b, h, 0.7, w.reach + 4, (u) => { if (u.hasShield) { b.shieldWear(u, 999); } b.damage(u, base * 1.3 * u.arm.cut, h, false, "cut", true); if (u.active) b.stagger(u, 1.0); }, 1); break;
    case "blunt": hitArc(b, h, 0.7, w.reach + 4, (u) => { b.damage(u, base * 1.2 * u.arm.blunt, h, true, "blunt", true); if (u.active) { b.stagger(u, 2); breakPosture(b, u, 60); } }, 1); break;
    case "spear": hitArc(b, h, 1.0, w.reach + 2, (u) => { if (u.mounted) return; b.damage(u, base * 0.6 * u.arm.blunt, h, false, "blunt", false); if (u.active) { b.stagger(u, 1.3); u.legT = 4; b.floater(u.x, u.y - 34, "PODCIĘTY", PAL.gold, true); } }, 4); break;
    case "two": case "staff": case "claws": hitArc(b, h, 3.2, w.reach + 4, (u) => { b.damage(u, base * (c === "two" ? 1.1 : 0.7) * u.arm.cut, h, false, "cut", true); if (u.active) b.push(u, h.x, h.y, 90); }, 8); b.parts.push({ x: h.x, y: h.y, z: 10, vx: 9, vy: 0, vz: 0, life: 0.4, max: 0.4, col: PAL.steelL, kind: "ring" }); break;
  }
  b.hitstop = Math.max(b.hitstop, 0.08); b.kickCam(Math.cos(h.face), Math.sin(h.face), 1.3);
}

// Broń rzucana zamiast drugiej broni: noże, toporki, oszczepy. Zapas na bitwę + podnoszenie z ziemi.
const THROWN: Record<string, { name: string; n: number; dmg: number; kind: Arrow["kind"]; speed: number; range: number }> = {
  knives: { name: "Noże do rzucania", n: 5, dmg: 28, kind: "arrow", speed: 300, range: 150 },
  axes: { name: "Toporki do rzucania", n: 3, dmg: 46, kind: "axe", speed: 240, range: 130 },
  javelins: { name: "Oszczepy", n: 2, dmg: 64, kind: "bolt", speed: 270, range: 190 },
};
I({ id: "t_knives", name: "Noże do rzucania", slot: "weapon", price: 90, tier: 1, weapon: "dagger" } as any); (ITEMS.t_knives as any).thrown = "knives";
I({ id: "t_axes", name: "Toporki do rzucania", slot: "weapon", price: 160, tier: 2, weapon: "axe" } as any); (ITEMS.t_axes as any).thrown = "axes";
I({ id: "t_javelins", name: "Oszczepy", slot: "weapon", price: 140, tier: 2, weapon: "spear" } as any); (ITEMS.t_javelins as any).thrown = "javelins";
function thrownOf(P: PlayerState): string | null { const id = (P as any).weapon2; const it = id ? ITEMS[id] : null; return it ? (it as any).thrown || null : null; }
function heroThrow(b: Battle) {
  const h = b.hero, B = b as any; if (!h || !h.active || h.usingBow || h.mounted && !B.thr) return;
  const T = B.thr as { k: string; n: number; max: number } | undefined;
  if (!T) { b.say("Brak broni do rzucania (załóż ją zamiast drugiej broni).", PAL.ash); return; }
  if (T.n <= 0) { b.say("Nie masz już czym rzucić. Podnieś z ziemi.", PAL.ash); return; }
  if ((B.thrCd || 0) > b.time || (h.state !== "idle" && h.state !== "recover")) return;
  const D = THROWN[T.k]; T.n--; B.thrCd = b.time + 0.7; h.stamina -= 8; h.staminaWait = 0.5;
  const wx = b.cam.x + b.input.mx, wy = b.cam.y + b.input.my;
  const a = Math.atan2(wy - (h.y - 12), wx - h.x);
  b.fire(h, a + rr(-0.04, 0.04), D.speed, D.dmg * b.heroDmg, Math.min(D.range, dist(h.x, h.y, wx, wy) + 20), D.kind);
  (b.arrows[b.arrows.length - 1] as any).thrown = T.k;
  h.state = "recover"; h.t = 0.15;
  b.floater(h.x, h.y - 40, `${D.name}: ${T.n}`, PAL.bone, true);
}
// rzucone, które spadły na ziemię, można podnieść (także toporki wrogich miotaczy, gdy rzucasz toporkami)
function throwTick(b: Battle) {
  const B = b as any, h = b.hero, T = B.thr as { k: string; n: number; max: number } | undefined;
  if (!T || !h) return;
  const G = (B.gThrown ||= []) as { x: number; y: number }[];
  for (const ar of b.arrows) { const A = ar as any; if (!ar.done || A.gtDone) continue; A.gtDone = 1; if (A.thrown === T.k || (T.k === "axes" && ar.kind === "axe" && ar.team !== 0)) G.push({ x: ar.x, y: ar.y + 12 }); }
  if (T.n >= T.max + 3) return;
  for (let i = G.length - 1; i >= 0; i--) if (Math.abs(G[i].x - h.x) < 10 && Math.abs(G[i].y - h.y) < 10) { G.splice(i, 1); T.n++; b.floater(h.x, h.y - 30, `+1 ${THROWN[T.k].name.toLowerCase()}`, PAL.bone, true); break; }
}

// Szał jako umiejętność (uczą go mistrzowie broni)
ABILITIES.rage = { id: "rage", name: "Szał", res: "fury", cost: 50, cd: 40, source: "mistrz broni", desc: "6 s zawziętości: szybciej i mocniej, bez ogłuszeń; twoi w pobliżu wpadają w szał, wrogowie tracą ducha." } as any;
function castRage(b: Battle) {
  const h = b.hero; if (!h) return;
  (h as any).rageT = b.time + 6; h.buffT = 6; h.buffDmg = 1.25;
  b.sfx.battleCry(1); b.shake(3);
  for (const u of b.units) { if (!u.active) continue; const d = dist(u.x, u.y, h.x, h.y); if (u.team === 0 && !u.hero && d < 120) { u.morale = Math.min(100, u.morale + 15); u.buffT = 6; u.buffDmg = 1.15; } if (u.team !== 0 && d < 90 && !u.def.undead) u.morale -= 12; }
}
function raging(b: Battle, h: Unit) { return ((h as any).rageT || 0) > b.time; }

// Mistrz broni w mieście lub zamku: lekcje (mistrzostwo za złoto) i nauka szału
function masterHtml(w: World, s: Settlement) {
  const P = w.player, c = wclass(WEAPONS[ITEMS[P.equip.weapon || "w_dagger"]?.weapon || "dagger"]);
  const lv = masteryLevel(P, c), cost = 120 + lv * 140;
  const rows = Object.keys(SPECIALS).filter((k) => !["claws", "staff", "lance"].includes(k)).map((k) => `${WCLASS_NAME[k as WClass]} ${masteryLevel(P, k)}`).join(" · ");
  return `<h2>${ic("sword")} Mistrz broni</h2><p class="tip">Mistrzostwo: ${rows}. Twoja broń: ${WCLASS_NAME[c]} (poziom ${lv}/5).</p>
    <div class="row"><span>Lekcja szermierki (${WCLASS_NAME[c]})</span><button class="mini" data-a="mLesson" ${lv < 5 && P.gold >= cost ? "" : "disabled"}>Ćwicz z mistrzem (${cost}, 1 dzień)</button></div>
    ${P.learned.includes("rage") ? "" : `<div class="row"><span>Szał: ${ABILITIES.rage.desc}</span><button class="mini" data-a="mRage" ${P.gold >= 600 ? "" : "disabled"}>Naucz się (600)</button></div>`}`;
}
function masterActs(w: World, s: Settlement, re: () => void): Acts {
  const P = w.player;
  return {
    mLesson: () => { const c = wclass(WEAPONS[ITEMS[P.equip.weapon || "w_dagger"]?.weapon || "dagger"]); const cost = 120 + masteryLevel(P, c) * 140; if (P.gold < cost) return; P.gold -= cost; const lines: string[] = []; addMastery(P, c, 150, lines); passDay(); toast(lines[0] || `Cały dzień z mistrzem. ${WCLASS_NAME[c]}: postęp.`, PAL.gold); re(); },
    mRage: () => { if (P.gold < 600) return; P.gold -= 600; P.learned.push("rage"); const free = P.abilities.indexOf(""); if (free >= 0) P.abilities[free] = "rage"; toast("Mistrz uczy cię wpadać w szał. Umiejętność Szał (przypisz ją w oknie postaci).", PAL.gold); re(); },
  };
}

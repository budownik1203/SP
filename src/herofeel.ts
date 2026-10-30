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

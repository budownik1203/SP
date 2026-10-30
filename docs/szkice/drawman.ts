// ---------- Wymiary ras (Build 0.17: płótno 32×40, stopy w wierszu 38) ----------
const SPR_W = 32, SPR_H = 40, ANK = 36;
// Chód w 6 klatkach (1–6), 0 to postój. Krok w bok i podskok w fazie przenoszenia nogi.
const WALK_ST = [0, 0, 1, 2, 0, -1, -2];
function walkBob(f: number) { return f === 1 || f === 4 ? -1 : 0; }
interface Frame { cx: number; headTop: number; headW: number; headH: number; top: number; bot: number; hw: number; legW: number; legGap: number; }
function frameOf(L: Look): Frame {
  const t = L.tall ? -1 : 0;
  if (L.race === "dwarf") return { cx: 16, headTop: 12, headW: 8, headH: 8, top: 21, bot: 31, hw: 7 + (L.build === 2 ? 1 : 0), legW: 4, legGap: 1 };
  if (L.race === "orc") return { cx: 16, headTop: 5, headW: 8, headH: 8, top: 14, bot: 27, hw: 7 + (L.build === 2 ? 1 : 0), legW: 4, legGap: 1 };
  return { cx: 16, headTop: 6 + t, headW: 6, headH: 8, top: 15 + t, bot: 28 + t, hw: [5, 6, 7][L.build], legW: L.build === 2 ? 4 : 3, legGap: L.build === 2 ? 2 : 1 };
}

// ---------- Materiały ----------
function matColor(L: Look, x: number, y: number, top: number, shadeRight = false): string {
  switch (L.body) {
    case "mail": {   // kolczuga: rzędy kółek przesunięte co wiersz, błysk co kilka oczek
      const row = (y - top) % 2, k = (x + row) % 2;
      if (k === 0 && (x * 3 + y * 5) % 7 === 0) return PAL.steelL;
      return k === 0 ? PAL.steel : PAL.steelD;
    }
    case "plate": {
      if ((y - top) % 4 === 3) return PAL.steelD;
      return shadeRight ? PAL.steelD : PAL.steel;
    }
    case "leather": return (y - top) % 5 === 4 ? PAL.woodD : (x + y) % 6 === 0 ? PAL.dirtL : PAL.dirt;
    case "gambeson": return x % 3 === 0 ? PAL.ash : (y - top) % 4 === 2 && x % 3 === 1 ? PAL.ash : PAL.bone;   // pikowanie
    case "rags": return (x * 7 + y * 3) % 5 === 0 ? PAL.dirtD : (x * 5 + y) % 11 === 0 ? PAL.woodD : PAL.dirt;
    case "robe": return L.hood ? L.hood[0] : PAL.dusk;
    default: return PAL.bone;
  }
}
const STEEL_SET = new Set([PAL.steel, PAL.steelD, PAL.steelL]);

// ---------- Ludzie, krasnoludy, orkowie ----------
function drawMan(L: Look, dir: number, frame: number, headless = false, noArms = false): HTMLCanvasElement {
  const P = new Pix(SPR_W, SPR_H);
  const F = frameOf(L);
  const { cx, top, bot, hw } = F;
  const bob = walkBob(frame);
  const ht = F.headTop + bob, tp = top + bob, bt = bot + bob;
  const seed = L.seed;
  const orc = L.race === "orc", dwarf = L.race === "dwarf";
  const robe = L.body === "robe";
  const cul = L.culture || "";
  const wear = clamp((L.dirt || 0) * 0.7 + (L.rust || 0) * 0.5, 0, 1);
  // długość płaszcza zależy od kultury: legion krótki, Aurelia do kostek
  const capeEnd = cul === "varus" ? bt + 3 : cul === "aurelia" ? ANK + 1 : bt + 7;

  // peleryna z tyłu (widok z przodu i z boku)
  if (L.cape && dir !== 1) {
    if (dir === 0) { for (let y = tp + 1; y <= capeEnd - 1; y++) { P.p(cx - hw - 2, y, L.cape[1]); P.p(cx + hw + 1, y, L.cape[1]); } }
    else for (let y = tp; y <= capeEnd; y++) { const ragged = y > capeEnd - 2 && vrand(seed, y * 3) < 0.5; P.r(cx - hw, y, 3, 1, ragged ? null : y % 4 === 0 ? L.cape[1] : L.cape[0]); }
  }
  // kołczan na plecach (widok z boku: za plecami)
  if (L.quiver && dir === 2) { P.r(cx - 6, tp - 2, 3, 11, PAL.woodD); P.r(cx - 6, tp + 2, 3, 1, PAL.dirtL); P.r(cx - 6, tp - 3, 3, 1, PAL.bone); P.p(cx - 5, tp - 4, PAL.white); P.p(cx - 6, tp - 4, PAL.redL); }

  // ---- nogi ----
  const legTop = bt + 1;
  if (!robe) {
    if (dir === 2) {
      const st = WALK_ST[frame];
      const legs = [{ x: cx - 2 - st, c: PAL.dirtD, b: PAL.black }, { x: cx - 1 + st, c: L.pants, b: L.boots }];
      for (const lg of legs) {
        P.r(lg.x, legTop, F.legW - 1, ANK - legTop, lg.c);
        P.p(lg.x, legTop + Math.floor((ANK - legTop) / 2), PAL.dirtD);                 // kolano
        P.r(lg.x, ANK, F.legW, 3, lg.b); P.p(lg.x + F.legW, 38, lg.b);
        P.r(lg.x, ANK, F.legW, 1, PAL.dirtD);                                          // cholewa
      }
    } else {
      for (let side = 0; side < 2; side++) {
        const lift = ((frame === 1 || frame === 2) && side === 0) || ((frame === 4 || frame === 5) && side === 1) ? 1 : 0;
        const x0 = side === 0 ? cx - F.legGap - F.legW : cx + F.legGap;
        P.r(x0, legTop, F.legW, ANK - legTop - lift, L.pants);
        P.r(x0 + (side === 0 ? 0 : F.legW - 1), legTop, 1, ANK - legTop - lift, side === 0 ? L.pants : PAL.dirtD);
        // owijacze / przeszycia na łydce
        if (!dwarf) for (let y = legTop + 3; y < ANK - lift; y += 2) P.p(x0 + (y % 4 === 0 ? 0 : F.legW - 1), y, PAL.dirtD);
        P.r(x0 - (side === 0 ? 1 : 0), ANK - lift, F.legW + 1, 3, L.boots);
        P.r(x0 - (side === 0 ? 1 : 0), ANK - lift, F.legW + 1, 1, PAL.dirtD);
        P.p(x0 + (side === 0 ? 0 : F.legW - 1), ANK + 1 - lift, PAL.goldD);            // sprzączka buta
        if (L.body === "plate") { P.p(x0 + 1, legTop + 3, PAL.steelL); P.r(x0, legTop + 4, F.legW, 1, PAL.steel); P.r(x0, legTop + 5, F.legW, 1, PAL.steelD); }   // nakolanniki
      }
    }
  }

  // ---- tułów ----
  const tw = dir === 2 ? hw - 1 : hw;
  const bx0 = dir === 2 ? cx - tw : cx - hw;
  const bx1 = dir === 2 ? cx + tw - 1 : cx + hw - 1;
  const bodyBot = robe ? 38 : bt;
  for (let y = tp; y <= bodyBot; y++) for (let x = bx0; x <= bx1; x++) {
    if (y === tp && (x === bx0 || x === bx1)) continue;
    if (robe && y > 36 && vrand(seed, x * 11 + y) < 0.3) continue;
    P.p(x, y, matColor(L, x, y, tp, x === bx1));
  }
  // nity i krawędzie płyt
  if (L.body === "plate") {
    for (let y = tp + 1; y < bodyBot; y++) P.p(bx0 + 1, y, PAL.steelL);
    P.p(cx - 1, tp + 2, PAL.steelL); P.p(cx, tp + 6, PAL.boneHi);
    for (let y = tp + 3; y < bodyBot; y += 4) { P.p(bx0 + 2, y, PAL.boneHi); P.p(bx1 - 1, y, PAL.steelL); }
    if (dir !== 1) P.r(cx, tp + 1, 1, bodyBot - tp - 2, PAL.steelD);                     // grzbiet napierśnika
  }
  if (L.body === "mail" && dir !== 1) P.r(bx0, bodyBot, bx1 - bx0 + 1, 1, PAL.steelD);   // obrąbek kolczugi
  if (L.body === "leather") {
    for (let y = tp + 2; y < bodyBot; y += 5) { P.p(bx0 + 1, y, PAL.goldD); P.p(bx1 - 1, y, PAL.goldD); }   // nity na skórze
    P.r(bx0, tp, bx1 - bx0 + 1, 1, PAL.woodD);
  }
  if (L.body === "rags") { P.r(bx0 + 1, tp + 4, 2, 2, PAL.woodD); P.p(bx1 - 2, tp + 9, PAL.dirtL); P.p(bx1 - 1, tp + 9, PAL.dirtL); }   // łaty
  if (orc && L.body === "leather") { P.line(bx0, tp + 1, bx1, tp + 9, PAL.woodD); P.r(cx - 1, tp + 4, 3, 3, PAL.bone); P.p(cx, tp + 5, PAL.black); }   // pas krzyżowy z czaszką
  if (robe) { for (let y = tp; y <= 38; y++) { P.p(bx0 - 1, y, L.hood ? L.hood[1] : PAL.ink); } P.r(bx0, tp + 9, bx1 - bx0 + 1, 1, PAL.bone); P.p(cx, tp + 10, PAL.bone); P.p(cx, tp + 12, PAL.bone); }   // sznur z frędzlem
  // naramienniki: kształt zależny od kultury
  if (dir !== 2) {
    const sh = L.body === "plate" ? PAL.steelL : matColor(L, bx0, tp, tp), sh2 = L.body === "plate" ? PAL.steel : matColor(L, bx1, tp, tp, true);
    const big = L.body === "plate" || cul === "varus" ? 3 : 2;
    P.r(bx0 - 1, tp, 2, big, sh); P.r(bx1, tp, 2, big, sh2);
    if (cul === "varus" && L.body !== "rags") { for (let k = 0; k < 3; k++) { P.p(bx0 - 1, tp + k * 2, PAL.steelL); P.p(bx1 + 1, tp + k * 2, PAL.steelD); } }   // segmenty jak lorica
  }
  // futrzany kołnierz orków i krasnoludów
  if ((orc || dwarf) && L.body !== "robe" && dir !== 1) {
    const fur = orc ? PAL.dirtL : PAL.woodD;
    for (let x = bx0 - 1; x <= bx1 + 1; x++) { P.p(x, tp - 1 + (x % 2), fur); if (x % 3 === 0) P.p(x, tp + 1, orc ? PAL.bone : PAL.dirtL); }
  }

  // tabard: postrzępiony dół, wzór herbu, brud i krew
  if (L.tabard && !robe) {
    const T = L.tabard;
    const tx0 = dir === 2 ? cx - tw + 1 : cx - hw + 1, tx1 = dir === 2 ? cx + tw - 2 : cx + hw - 2;
    const ty0 = tp + 1, ty1 = bt + (cul === "aurelia" ? 5 : 3);
    const mid = Math.floor((ty0 + ty1) / 2) - 1;
    for (let y = ty0; y <= ty1; y++) for (let x = tx0; x <= tx1; x++) {
      if (y >= ty1 - 1 && vrand(seed, x * 37 + y) < (y === ty1 ? 0.45 : 0.18) + wear * 0.15) continue;   // poszarpany brzeg
      let c = x === tx1 ? T.shade : T.main;
      if (dir !== 1) {
        const rx = x - cx + 0.5;
        if (T.pattern === "stripe" && Math.abs(rx) < 1) c = T.trim;
        if (T.pattern === "quarter" && ((x < cx) !== (y < mid))) c = T.trim;
        if (T.pattern === "chevron" && Math.floor(Math.abs(rx)) === y - ty0 - 1) c = T.trim;
        if (T.pattern === "cross" && (Math.abs(rx) < 1 || y === ty0 + 4)) c = T.trim;
      }
      // przetarcia: wypłowiałe plamy na starym płótnie
      if (wear > 0.3 && vrand(seed, x * 53 + y * 7) < wear * 0.12) c = PAL.dirtL;
      P.p(x, y, c);
    }
    if (cul === "aurelia" && dir !== 1) P.r(tx0, ty0, tx1 - tx0 + 1, 1, T.trim);       // złota lamówka
  }
  // pas, klamra, sakwa, rzemień przez pierś
  if (!robe) {
    const belt = tp + Math.round((bt - tp) * 0.62);
    P.r(bx0, belt, bx1 - bx0 + 1, 1, PAL.woodD);
    if (dir !== 1) { P.r(cx - 1, belt, 2, 1, PAL.goldD); P.p(cx - 1, belt, PAL.gold); }
    if (dir === 0) { P.r(bx1 - 2, belt + 1, 3, 3, PAL.dirtL); P.r(bx1 - 2, belt + 1, 3, 1, PAL.dirt); P.p(bx1 - 1, belt + 2, PAL.goldD); }   // sakwa z klamerką
    if (dir === 0 && bx0 + 2 < bx1 - 3) P.p(bx0 + 1, belt + 1, PAL.bone);              // nóż przy pasie
    if (L.quiver && dir !== 2) { P.line(bx0, tp, bx1, belt - 1, PAL.woodD); P.p(cx, Math.round((tp + belt) / 2), PAL.goldD); }
  }
  // pochwa miecza
  if (L.scabbard && !robe) {
    if (dir === 0) { P.line(bx0 - 1, tp + 10, bx0 - 3, tp + 18, PAL.woodD); P.p(bx0 - 3, tp + 18, PAL.steel); P.p(bx0 - 2, tp + 13, PAL.goldD); }
    if (dir === 2) { P.line(cx - 2, tp + 10, cx - 7, tp + 17, PAL.woodD); P.p(cx - 7, tp + 17, PAL.steel); P.p(cx - 4, tp + 13, PAL.goldD); }
  }

  // ---- ręce ----
  const sleeve = (x: number, y: number) => L.body === "robe" ? (L.hood ? L.hood[0] : PAL.dusk) : matColor(L, x, y, tp);
  const glove = L.body === "plate" || L.body === "mail" ? PAL.dirtD : L.skin[0];
  const armLen = dwarf ? 8 : orc ? 12 : 10;
  const swing = frame === 0 ? 0 : WALK_ST[frame] > 0 ? 1 : WALK_ST[frame] < 0 ? -1 : 0;
  if (noArms) { /* ręce rysuje bitwa, zgodnie z ruchem broni */ }
  else if (dir === 2) {
    for (let y = tp + 1; y < tp + 1 + armLen; y++) P.r(cx - 1 + (y > tp + 4 ? swing : 0), y, 2, 1, sleeve(cx, y));
    P.r(cx - 1 + swing, tp + 1 + armLen, 2, 2, orc ? L.skin[0] : glove);
  } else {
    for (let y = tp + 1; y < tp + 1 + armLen; y++) { P.r(bx0 - 2, y, 2, 1, sleeve(bx0 - 2, y)); P.r(bx1 + 1, y, 2, 1, sleeve(bx1 + 1, y)); }
    P.r(bx0 - 2, tp + 1 + armLen - swing, 2, 2, orc ? L.skin[0] : glove); P.r(bx1 + 1, tp + 1 + armLen + swing, 2, 2, orc ? L.skin[0] : glove);
    if (L.body === "mail" || L.body === "plate") { P.r(bx0 - 2, tp + armLen - 1, 2, 1, PAL.dirtD); P.r(bx1 + 1, tp + armLen - 1, 2, 1, PAL.dirtD); }   // mankiety rękawic
  }
  if (L.quiver && dir === 1) { P.r(cx + 2, tp - 3, 3, 12, PAL.woodD); P.r(cx + 2, tp + 1, 3, 1, PAL.dirtL); P.r(cx + 2, tp - 3, 3, 1, PAL.bone); P.p(cx + 3, tp - 4, PAL.white); P.p(cx + 4, tp - 4, PAL.redL); }
  if (L.cape && dir === 1) for (let y = tp; y <= capeEnd; y++) for (let x = cx - hw; x <= cx + hw - 1; x++) {
    if (y > capeEnd - 2 && vrand(seed, x * 13 + y) < 0.4 + wear * 0.2) continue;
    let c = x === cx + hw - 1 || x === cx - hw ? L.cape[1] : (x - cx) % 3 === 0 ? L.cape[1] : L.cape[0];   // fałdy
    if (wear > 0.25 && vrand(seed, x * 71 + y * 5) < wear * 0.1) c = PAL.dirtL;                      // przetarcia
    if (y === capeEnd && cul === "aurelia") c = L.tabard ? L.tabard.trim : PAL.gold;
    P.p(x, y, c);
  }
  if (L.cape && dir !== 1) { P.p(cx - hw + 1, tp, PAL.goldD); if (dir === 0) P.p(cx + hw - 2, tp, PAL.goldD); }   // zapinka płaszcza

  // ---- głowa ----
  if (!headless) drawHead(P, L, F, dir, ht);
  else { P.r(cx - 1, tp - 1, 2, 1, PAL.bloodL); P.r(cx - 2, tp, 4, 1, PAL.blood); }

  weatherPix(P, L, cx, hw, tp, bt);
  return P.toCanvas();
}

// Brud, krew, rdza i wgniecenia: nakładane na gotową postać.
function weatherPix(P: Pix, L: Look, cx: number, hw: number, tp: number, bt: number) {
  const seed = L.seed;
  // błoto od dołu: gęste przy stopach, rzadsze wyżej, w grudkach
  for (let i = 0; i < 70 * L.dirt; i++) {
    const x = Math.floor(vrand(seed, 300 + i) * SPR_W), y = 39 - Math.floor(Math.pow(vrand(seed, 400 + i), 1.8) * 16);
    const c = vrand(seed, 500 + i) < 0.5 ? PAL.dirtD : PAL.dirt;
    P.over(x, y, c); if (vrand(seed, 520 + i) < 0.4) P.over(x + 1, y, c);
  }
  // krew: plamy (2–3 piksele) i zacieki w dół
  for (let i = 0; i < 7 * L.blood; i++) {
    const x = cx - hw + Math.floor(vrand(seed, 600 + i) * hw * 2), y = tp + Math.floor(vrand(seed, 700 + i) * (bt - tp + 4));
    const c = vrand(seed, 800 + i) < 0.6 ? PAL.bloodD : PAL.blood;
    P.over(x, y, c); P.over(x + 1, y, c); if (vrand(seed, 820 + i) < 0.5) P.over(x, y - 1, PAL.bloodD);
    const drip = Math.floor(vrand(seed, 840 + i) * 4);
    for (let k = 1; k <= drip; k++) P.over(x, y + k, PAL.bloodD);
  }
  // rdza na stali (skupiska), wgniecenia na płycie i hełmie
  const rust = L.rust || 0;
  if (rust > 0.05) for (let y = 0; y < SPR_H; y++) for (let x = 0; x < SPR_W; x++) {
    const c = P.get(x, y);
    if (!c || !STEEL_SET.has(c)) continue;
    const blob = vrand(seed + ((x >> 1) * 31 + (y >> 1) * 17), 900);
    if (blob < rust * 0.45) P.p(x, y, blob < rust * 0.18 ? "#4a2716" : PAL.rust);
  }
  for (let i = 0; i < (L.dents || 0); i++) {
    for (let tries = 0; tries < 12; tries++) {
      const x = Math.floor(vrand(seed, 950 + i * 13 + tries) * SPR_W), y = Math.floor(vrand(seed, 970 + i * 13 + tries) * SPR_H);
      const c = P.get(x, y);
      if (c && STEEL_SET.has(c) && P.get(x + 1, y + 1)) { P.p(x, y, PAL.ink); P.p(x + 1, y + 1, PAL.steelL); break; }
    }
  }
}

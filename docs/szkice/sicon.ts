// Ikony osad (Build 0.17): większe, z detalami (łaty na dachach, płoty, stogi, śmietniska, szubienice),
// zależne od dobrobytu (bieda: dziury i ruiny, bogactwo: kamień i chorągwie), od kultury
// (krasnoludy w skale, orkowie w namiotach z kości, nieumarli w czarnym kamieniu) i ze śladami oblężenia i grabieży.
function settlementIcon(s: Settlement, w: World): HTMLCanvasElement {
  const wealth = s.prosperity < 35 ? 0 : s.prosperity > 72 ? 2 : 1;
  const sieged = s.siegeBy.length > 0, raided = s.raided > 0;
  const key = [s.id, s.faction, raided ? 1 : 0, sieged ? 1 : 0, wealth, s.culture].join(":");
  let c = SICON.get(key);
  if (c) return c;
  const [col, , trim] = factionCol(s.faction);
  const cul = s.culture;
  const undead = cul === "undead", dwarf = cul === "dwarf", orc = cul === "orc";
  const big = s.kind === "town", W2 = big ? 48 : s.kind === "castle" ? 38 : 36, H2 = big ? 42 : s.kind === "castle" ? 38 : 26;
  const P = new Pix(W2, H2);
  const hs = (k: number) => hashInt(s.seed * 7 + k * 131);
  const rich = wealth === 2, poor = wealth === 0;
  const wallC = undead ? PAL.slate : dwarf ? PAL.stone : rich ? PAL.ash : PAL.stone;
  const wallD = undead ? PAL.dusk : PAL.slate;
  const burnt = (x: number, y: number, w2: number, h2: number) => { for (let yy = y; yy < y + h2; yy++) for (let xx = x; xx < x + w2; xx++) if (P.has(xx, yy) && hashInt(xx * 31 + yy * 17 + s.seed) % 3 !== 0) P.p(xx, yy, hashInt(xx + yy * 7) % 4 ? PAL.black : PAL.dusk); };

  // --- budynki ---
  const house = (x: number, y: number, w2: number, h2: number, k: number) => {
    if (orc) {   // namiot ze skór na kościanych tyczkach
      for (let r = 0; r < h2 + 2; r++) { const half = Math.floor((r * (w2 + 1)) / (h2 + 2) / 2); P.r(x + Math.floor(w2 / 2) - half, y - 2 + r, half * 2 + 1, 1, r % 3 === 0 ? PAL.dirt : PAL.dirtL); }
      P.p(x + Math.floor(w2 / 2), y - 3, PAL.boneHi); P.p(x + Math.floor(w2 / 2) - 1, y - 4, PAL.bone); P.p(x + Math.floor(w2 / 2) + 1, y - 4, PAL.bone);
      P.r(x + Math.floor(w2 / 2), y + h2 - 2, 1, 2, PAL.ink);
      if (hs(k) % 2) P.p(x + 1, y + h2 - 1, PAL.bone);   // czaszka przy wejściu
      return;
    }
    const stoneH = rich || undead;
    const wallCol = stoneH ? (undead ? PAL.stone : PAL.ash) : PAL.bone;
    P.r(x, y, w2, h2, wallCol); P.r(x + w2 - 1, y, 1, h2, stoneH ? PAL.slate : PAL.dirtL);
    if (!stoneH) { P.r(x, y, w2, 1, PAL.woodD); P.r(x, y + h2 - 1, w2, 1, PAL.woodD); P.r(x + Math.floor(w2 / 2), y, 1, h2, PAL.woodD); }   // mur pruski
    else if (!undead) for (let yy = y + 1; yy < y + h2; yy += 2) P.p(x + (yy % 4 === 1 ? 1 : 2), yy, PAL.stone);
    const thatch = s.kind === "village" && !rich;
    const roof = undead ? PAL.slate : thatch ? PAL.goldD : PAL.red, roofD = undead ? PAL.dusk : thatch ? PAL.dirt : PAL.bloodD;
    for (let r = 0; r < 4; r++) P.r(x - 1 + r, y - 1 - r, w2 + 2 - r * 2, 1, r === 3 ? roofD : r % 2 ? roof : thatch ? PAL.dirtL : roof);
    if (thatch) for (let xx = x; xx < x + w2; xx += 2) P.p(xx, y - 1, PAL.dirt);   // strzecha
    if (hs(k) % 3 === 0) P.r(x + 1 + (hs(k) >>> 3) % Math.max(1, w2 - 3), y - 2, 2, 1, thatch ? PAL.wood : PAL.rust);   // łata na dachu
    if (poor && hs(k + 5) % 2 === 0) { P.p(x + 1 + (hs(k) >>> 5) % Math.max(1, w2 - 2), y - 2, PAL.ink); P.p(x + 2 + (hs(k) >>> 5) % Math.max(1, w2 - 3), y - 3, PAL.ink); }   // dziura w dachu
    P.r(x + 1, y + h2 - 3, 1, 3, PAL.ink);   // drzwi
    if (w2 > 4) P.p(x + w2 - 3, y + 1, undead ? PAL.purpleL : PAL.goldD);   // okienko
    if (h2 > 4 && !undead && hs(k + 2) % 2 === 0) { P.r(x + w2 - 2, y - 5, 1, 2, PAL.slate); }   // komin
  };
  const fence = (x: number, y: number, len: number) => { P.r(x, y, len, 1, PAL.woodD); for (let xx = x; xx < x + len; xx += 2) P.r(xx, y - 1, 1, 3, poor && hashInt(xx * 3 + s.seed) % 3 === 0 ? null : PAL.wood); };
  const stack = (x: number, y: number) => { P.r(x, y - 2, 4, 3, PAL.goldD); P.r(x + 1, y - 3, 2, 1, PAL.gold); P.p(x + 3, y - 1, PAL.dirt); P.r(x, y + 1, 4, 1, PAL.dirtD); };
  const midden = (x: number, y: number) => { P.r(x, y - 1, 4, 2, PAL.dirtD); P.p(x + 1, y - 2, PAL.dirt); P.p(x + 2, y - 1, PAL.bone); P.p(x, y, PAL.moss); };
  const gallows = (x: number, y: number) => { P.r(x, y - 9, 1, 10, PAL.woodD); P.r(x, y - 9, 5, 1, PAL.woodD); P.p(x + 1, y - 8, PAL.woodD); P.r(x + 4, y - 8, 1, 2, PAL.ink); P.r(x + 3, y - 6, 3, 3, PAL.dirt); P.r(x + 4, y - 3, 1, 2, PAL.dirtD); };
  const tower = (x: number, y: number, h2: number) => {
    P.r(x, y, 5, h2, wallC); P.r(x + 4, y, 1, h2, wallD); P.r(x, y, 1, h2, undead ? PAL.slate : PAL.bone);
    P.r(x - 1, y - 1, 7, 1, wallC); P.p(x - 1, y - 2, wallC); P.p(x + 2, y - 2, wallC); P.p(x + 5, y - 2, wallC);
    P.p(x + 2, y + 3, PAL.ink); P.p(x + 2, y + 4, PAL.ink);
    if (rich) { P.r(x - 1, y - 6, 7, 1, PAL.red); P.r(x, y - 7, 5, 1, PAL.red); P.r(x + 1, y - 8, 3, 1, PAL.bloodD); P.p(x + 2, y - 9, PAL.gold); }   // stożkowy dach
    if (poor && hashInt(x + s.seed) % 2 === 0) { P.p(x + 1, y - 2, null); P.p(x + 5, y - 1, null); P.r(x + 3, y + 1, 2, 2, PAL.ink); }   // wykruszony mur
  };
  const banner = (x: number, y: number, len = 6) => { P.r(x, y, 1, len + 3, PAL.woodD); P.r(x + 1, y, 3, len, col); P.p(x + 2, y + 1, trim); P.p(x + 1, y + len, col); P.p(x + 3, y + len, col); };
  const flag = (x: number, y: number) => { P.r(x, y, 1, 8, PAL.woodD); P.r(x + 1, y, 5, 3, col); P.r(x + 1, y + 3, 4, 1, col); P.p(x + 3, y + 1, trim); };

  if (s.kind === "village") {
    if (dwarf) {   // osada wykuta w skale: drzwi w zboczu, kominy z dymem
      for (let y = 4; y < 22; y++) { const half = Math.min(17, 4 + (y - 4) * 1.1); P.r(18 - half, y, half * 2, 1, (y + Math.floor(half)) % 5 === 0 ? PAL.slate : y < 8 ? PAL.ash : PAL.stone); }
      for (const dx of [8, 16, 25]) { P.r(dx, 15, 3, 6, PAL.ink); P.p(dx + 1, 14, PAL.ink); P.r(dx - 1, 14, 1, 7, PAL.goldD); P.p(dx + 3, 17, PAL.gold); }
      P.r(12, 7, 1, 3, PAL.slate); P.r(22, 9, 1, 3, PAL.slate);
      P.r(2, 22, 32, 1, PAL.dirtD); stack(29, 21);
    } else if (orc) {
      house(3, 12, 8, 7, 1); house(14, 10, 9, 8, 2); house(25, 13, 7, 6, 3);
      P.r(11, 20, 1, 4, PAL.wood); P.r(10, 19, 3, 2, PAL.bone); P.p(11, 20, PAL.black);   // pal z czaszką
      midden(28, 22); P.r(0, 23, 36, 1, PAL.dirtD);
    } else {
      P.r(1, 17, 12, 5, poor ? PAL.dirtD : PAL.dirtL); for (let x = 1; x < 13; x += 2) P.r(x, 17, 1, 5, poor ? PAL.ink : PAL.moss);   // zagon
      house(14, 13, 6, 5, 1); house(22, 15, 6, 5, 2); house(8, 9, 6, 5, 3);
      if (rich) house(28, 10, 5, 5, 4);
      fence(0, 23, 20); stack(30, 21); if (!rich) midden(2, 14);
      P.r(0, 24, 36, 1, PAL.woodD);
      flag(31, 1);
    }
    if (raided) { burnt(6, 4, 30, 18); P.r(10, 20, 3, 1, PAL.redL); }
  } else if (s.kind === "castle") {
    if (dwarf) {   // twierdza w skale: brama w zboczu, żelazne wrota, runy
      for (let y = 6; y < 36; y++) { const half = Math.min(19, 5 + (y - 6) * 0.9); P.r(19 - half, y, half * 2, 1, (y * 3 + Math.floor(half)) % 7 === 0 ? PAL.slate : y < 12 ? PAL.ash : PAL.stone); }
      P.r(13, 22, 12, 14, PAL.slate); P.r(14, 23, 10, 13, sieged ? PAL.ink : PAL.steelD); for (let x = 15; x < 24; x += 3) P.r(x, 23, 1, 13, PAL.steel); P.r(13, 21, 12, 1, PAL.gold);
      P.p(9, 18, PAL.gold); P.p(29, 18, PAL.gold); P.p(19, 15, PAL.goldD);
      tower(3, 14, 22); tower(30, 14, 22);
      flag(18, 0);
    } else if (orc) {   // obóz-warownia: palisada z zaostrzonych pali i kości
      for (let x = 1; x < 37; x += 2) { const h3 = 12 + (hashInt(x + s.seed) % 3); P.r(x, 34 - h3, 2, h3, x % 4 === 1 ? PAL.wood : PAL.woodD); P.p(x, 33 - h3, PAL.bone); }
      house(10, 12, 9, 8, 1); house(21, 10, 10, 9, 2);
      P.r(16, 26, 6, 8, PAL.ink); P.r(15, 25, 8, 1, PAL.bone); P.p(16, 24, PAL.boneHi); P.p(21, 24, PAL.boneHi);
      banner(4, 6, 7); banner(33, 6, 7);
    } else {
      P.r(4, 16, 30, 18, wallC); P.r(4, 33, 30, 1, wallD); P.r(4, 16, 1, 18, undead ? PAL.slate : PAL.bone);
      for (let y = 18; y < 33; y += 3) for (let x = 6 + (y % 2) * 2; x < 33; x += 5) P.p(x, y, wallD);   // spoiny kamieni
      for (let x = 4; x < 34; x += 2) P.p(x, 15, wallC);
      tower(1, 12, 22); tower(32, 12, 22);
      P.r(12, 5, 14, 22, wallC); P.r(25, 5, 1, 22, wallD); P.r(12, 5, 1, 22, undead ? PAL.slate : PAL.bone); for (let x = 12; x < 26; x += 2) P.p(x, 4, wallC);
      P.p(15, 10, PAL.ink); P.p(15, 11, PAL.ink); P.p(21, 10, PAL.ink); P.p(21, 11, PAL.ink);
      // brama: wyłamana przy oblężeniu
      if (sieged) { P.r(16, 26, 6, 8, PAL.ink); P.p(16, 30, PAL.wood); P.p(21, 28, PAL.wood); P.r(14, 33, 3, 1, PAL.woodD); P.r(21, 34, 3, 1, PAL.woodD); }
      else { P.r(16, 26, 6, 8, PAL.woodD); P.r(16, 26, 6, 1, PAL.ink); for (let x = 17; x < 22; x += 2) P.r(x, 27, 1, 7, PAL.wood); P.r(16, 29, 6, 1, PAL.steelD); }
      if (rich || s.owner === -2) { banner(5, 17, 8); banner(29, 17, 8); }
      if (undead) { P.p(15, 10, PAL.purpleL); P.p(21, 10, PAL.purpleL); P.r(2, 35, 3, 2, PAL.bone); }
      flag(18, 0);
    }
    if (sieged) { burnt(2, 14, 12, 10); burnt(24, 20, 10, 9); }
    if (poor && !dwarf && !orc) { P.r(8, 16, 3, 3, null); P.r(28, 22, 2, 4, PAL.ink); }   // wyrwy w murze
  } else {   // miasto
    if (orc) {
      for (let x = 1; x < 47; x += 2) { const h3 = 11 + (hashInt(x + s.seed) % 4); P.r(x, 40 - h3, 2, h3, x % 4 === 1 ? PAL.wood : PAL.woodD); P.p(x, 39 - h3, PAL.bone); }
      house(5, 15, 9, 8, 1); house(16, 11, 11, 10, 2); house(29, 14, 9, 8, 3); house(38, 18, 7, 6, 4);
      P.r(21, 32, 6, 8, PAL.ink); P.r(20, 31, 8, 1, PAL.bone);
      gallows(40, 30); banner(3, 4, 8); banner(43, 4, 8);
    } else if (dwarf) {
      for (let y = 4; y < 40; y++) { const half = Math.min(24, 6 + (y - 4) * 0.9); P.r(24 - half, y, half * 2, 1, (y * 5 + Math.floor(half)) % 9 === 0 ? PAL.slate : y < 10 ? PAL.ash : PAL.stone); }
      for (const [dx, dy] of [[10, 26], [18, 20], [30, 22], [36, 28]]) { P.r(dx, dy, 3, 5, PAL.ink); P.r(dx - 1, dy - 1, 5, 1, PAL.goldD); P.p(dx + 1, dy + 1, PAL.gold); }
      P.r(18, 31, 12, 9, PAL.slate); P.r(19, 32, 10, 8, sieged ? PAL.ink : PAL.steelD); P.r(18, 30, 12, 1, PAL.gold);
      for (const cx2 of [14, 26, 34]) P.r(cx2, 6 + (cx2 % 5), 1, 4, PAL.slate);
      tower(3, 20, 19); tower(40, 20, 19);
      flag(23, 0);
    } else {
      P.r(1, 22, 46, 18, wallC); P.r(1, 39, 46, 1, wallD); P.r(1, 22, 1, 18, undead ? PAL.slate : PAL.bone);
      for (let y = 24; y < 39; y += 3) for (let x = 3 + (y % 2) * 2; x < 46; x += 5) P.p(x, y, wallD);
      for (let x = 1; x < 47; x += 2) P.p(x, 21, wallC);
      house(6, 15, 6, 6, 1); house(13, 12, 5, 7, 2); house(25, 13, 7, 6, 3); house(34, 15, 5, 5, 4); house(19, 16, 4, 5, 5);
      if (rich) { house(39, 12, 5, 5, 6); P.r(29, 3, 4, 10, PAL.ash); P.r(28, 2, 6, 1, PAL.ash); P.p(30, 1, PAL.gold); P.p(31, 0, PAL.gold); }   // kamienice i dzwonnica
      tower(0, 18, 21); tower(42, 18, 21); tower(21, 19, 20);
      if (sieged) { P.r(21, 31, 6, 9, PAL.ink); P.p(21, 35, PAL.wood); P.r(19, 39, 3, 1, PAL.woodD); P.r(27, 38, 2, 1, PAL.woodD); }
      else { P.r(21, 31, 6, 9, PAL.woodD); for (let x = 22; x < 27; x += 2) P.r(x, 32, 1, 8, PAL.wood); P.r(21, 34, 6, 1, PAL.steelD); }
      gallows(37, 30);
      if (!rich) midden(7, 38);
      if (s.capital) { P.r(16, 1, 6, 17, wallC); P.r(21, 1, 1, 17, wallD); P.p(18, 5, PAL.ink); P.p(18, 9, PAL.ink); for (let x = 16; x < 22; x += 2) P.p(x, 0, wallC); }
      if (rich || s.capital) { banner(3, 23, 9); banner(43, 23, 9); }
      if (undead) { P.p(8, 18, PAL.purpleL); P.p(27, 16, PAL.purpleL); P.p(36, 18, PAL.purpleL); }
    }
    if (sieged) { burnt(4, 12, 12, 10); burnt(30, 10, 12, 12); burnt(10, 26, 8, 6); }
    if (poor && !orc && !dwarf) { P.r(10, 22, 3, 3, null); P.r(36, 26, 2, 3, PAL.ink); }
    if (raided) burnt(4, 10, 40, 14);
  }
  c = P.toCanvas(true, true);
  SICON.set(key, c);
  return c;
}


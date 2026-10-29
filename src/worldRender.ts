// Rysowanie mapy świata: teren malowany raz, osady jako budynki, miejsca specjalne, oddziały, granice, mgła wojny, noc i pogoda.

let WMAP: HTMLCanvasElement = null as any;
let WBORDER: HTMLCanvasElement = null as any;
let WBORDER_VER = -1;
let WFOG: HTMLCanvasElement = null as any;
let QM: ReturnType<typeof questMarks> = { set: new Map(), party: new Map(), place: new Map() };
const SICON = new Map<string, HTMLCanvasElement>();
const PICON = new Map<string, HTMLCanvasElement>();

function rgbOf(c: string) { return [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)]; }

// Kolor mapy: paleta zależna od terenu i regionu, cieniowanie rzeźby (światło z północnego zachodu), głębia wody.
function mapElev(w: World) {
  const E = new Float32Array(WGW * WGH);
  const ev = [0, 0.22, 0.27, 0.55, 1, 0.16, 0.12, 0.1];
  for (let i = 0; i < E.length; i++) E[i] = ev[w.terr[i]] + (w.terr[i] === T_MOUNT ? vnoise(i % WGW, Math.floor(i / WGW), 3) * 0.5 : 0);
  for (let pass = 0; pass < 4; pass++) {
    const T = E.slice();
    for (let y = 1; y < WGH - 1; y++) for (let x = 1; x < WGW - 1; x++) { const i = cidx(x, y); E[i] = (T[i] * 4 + T[i - 1] + T[i + 1] + T[i - WGW] + T[i + WGW]) / 8; }
  }
  return E;
}
function seaDist(w: World) {
  const D = new Uint8Array(WGW * WGH).fill(255);
  const q: number[] = [];
  for (let i = 0; i < D.length; i++) if (w.terr[i] !== T_SEA) { D[i] = 0; q.push(i); }
  for (let h = 0; h < q.length; h++) { const i = q[h], x = i % WGW, y = Math.floor(i / WGW); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= WGW || Y >= WGH) continue; const n = cidx(X, Y); if (D[n] > D[i] + 1) { D[n] = D[i] + 1; q.push(n); } } }
  return D;
}
function renderWorldMap(w: World) {
  const PW = WGW * WCELL, PH = WGH * WCELL;
  const [cv, g] = mkCanvas(PW, PH);
  const im = g.createImageData(PW, PH);
  const C = (c: string) => rgbOf(c);
  const grass = [C(PAL.grass), C(PAL.grassL), C(PAL.moss), C("#5c5a36")];
  const lush = [C("#22301a"), C("#2f3d20"), C("#46502c"), C("#5d6634")];
  const north = [C("#212a20"), C("#2d3828"), C("#404a35"), C("#545c43")];
  const steppe = [C("#3a3320"), C("#4f4429"), C("#655634"), C("#7a6a40")];
  const ashG = [C(PAL.dusk), C(PAL.slate), C(PAL.stone), C(PAL.ash)];
  const dirt = [C(PAL.dirtD), C(PAL.dirt), C(PAL.dirtL)];
  const deepW = [C("#0e1418"), C("#141d22"), C("#1b2a2f")], shallowW = [C("#22383a"), C("#2c4746"), C("#3c5a55")];
  const riverW = [C("#2a4444"), C("#355452"), C("#4b6e66")];
  const stone = [C(PAL.slate), C(PAL.stone), C(PAL.ash), C(PAL.bone)];
  const sand = [C("#5b4a32"), C("#6f5c3d"), C("#867049")];
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const E = mapElev(w), SD = seaDist(w);
  const elev = (px: number, py: number) => {
    const fx = px / WCELL - 0.5, fy = py / WCELL - 0.5, x0 = clamp(Math.floor(fx), 0, WGW - 2), y0 = clamp(Math.floor(fy), 0, WGH - 2), ax = clamp(fx - x0, 0, 1), ay = clamp(fy - y0, 0, 1);
    const i = cidx(x0, y0);
    return lerp(lerp(E[i], E[i + 1], ax), lerp(E[i + WGW], E[i + WGW + 1], ax), ay) + vnoise(px, py, 6) * 0.05 + vnoise(px + 70, py, 17) * 0.06;
  };
  // granice regionów poszarpane szumem i ditheringiem, bez prostych linii
  const regionPal = (cx: number, cy: number, x = 0, y = 0, th = 0.5) => {
    const jx = cx + (vnoise(cx * 1.3, cy * 1.3, 9) - 0.5) * 16 + (th - 0.5) * 3, jy = cy + (vnoise(cx * 1.3 + 77, cy * 1.3, 9) - 0.5) * 16 + (th - 0.5) * 3;
    return steppeAt(jx, jy) ? steppe : jx < 76 * MS && jy > 40 * MS ? lush : jy < 40 * MS && jx < 160 * MS ? north : grass;
  };
  for (let y = 0; y < PH; y++) for (let x = 0; x < PW; x++) {
    const cx = x >> 3, cy = y >> 3, i = cidx(cx, cy);
    const t = w.terr[i];
    const th = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    const n = vnoise(x, y, 24) * 0.6 + vnoise(x + 99, y, 7) * 0.4;
    const bl = w.blight[i];
    let col: number[];
    switch (t) {
      case T_SEA: {
        const d = SD[i] + vnoise(x, y, 10) * 1.5 - 0.6;
        const pal = d < 2.2 ? shallowW : deepW;
        col = pal[clamp(Math.floor((d < 2.2 ? 2.2 - d : 1.2 + vnoise(x * 0.5, y * 0.5, 30) - (d - 2.2) * 0.12) + th * 0.6 - 0.3), 0, 2)];
        if (d < 1.1 && n + th * 0.3 > 0.95) col = C(PAL.bone);    // piana przy brzegu
        break;
      }
      case T_RIVER: {
        // koryto: wąski kanał przez środek komórki, łączony z sąsiednią wodą; reszta to brzeg
        const lx = x & 7, ly = y & 7;
        const wat = (dx: number, dy: number) => { const tt = terrAt(w, cx + dx, cy + dy); return tt === T_RIVER || tt === T_SEA; };
        const m = 1.6 + (vnoise(x, y, 5) - 0.5) * 1.2;
        let inW = Math.abs(lx - 3.5) < m + 0.6 && Math.abs(ly - 3.5) < m + 0.6;
        if (!inW && Math.abs(ly - 3.5) < m && ((lx > 3 && wat(1, 0)) || (lx < 4 && wat(-1, 0)))) inW = true;
        if (!inW && Math.abs(lx - 3.5) < m && ((ly > 3 && wat(0, 1)) || (ly < 4 && wat(0, -1)))) inW = true;
        if (!inW && wat(1, 1) && wat(1, 0) && wat(0, 1) && lx > 3 && ly > 3) inW = true;
        if (inW) col = riverW[clamp(Math.floor(n * 1.8 + th * 0.9 - 0.2), 0, 2)];
        else { const pal = bl ? ashG : regionPal(cx, cy, x, y, th); col = pal[clamp(Math.floor(n * 2.2 + (th - 0.5) * 0.8) + 1, 0, 3)]; (col as any).bank = 1; }
        break;
      }
      case T_BEACH: col = sand[clamp(Math.floor(n * 2 + th - 0.5), 0, 2)]; break;
      case T_MOUNT: col = (bl ? ashG : stone)[clamp(Math.floor(n * 2.5 + th - 0.6), 0, 2)]; break;
      case T_HILL: { const pal = bl ? ashG : regionPal(cx, cy, x, y, th); col = pal[clamp(Math.floor(n * 2.4 + th - 0.2), 0, 3)]; break; }
      case T_SWAMP: col = (n + th * 0.5) > 0.82 ? riverW[0] : (n > 0.5 ? (bl ? ashG[0] : grass[0]) : dirt[0]); break;
      case T_FOREST: col = (bl ? ashG : regionPal(cx, cy, x, y, th))[clamp(Math.floor(n * 1.8 + th - 0.6), 0, 1)]; break;
      default: {
        const pal = bl ? ashG : regionPal(cx, cy, x, y, th);
        col = pal[clamp(Math.floor(n * 2.2 + (th - 0.5) * 0.8), 0, 2)];
        if (vnoise(x + 400, y, 30) > (steppeAt(cx, cy) ? 0.6 : 0.74) && th > 0.4) col = dirt[n > 0.55 ? 1 : 0];
      }
    }
    // cieniowanie rzeźby
    if (t !== T_SEA && t !== T_RIVER) {
      const sh = (elev(x, y) - elev(x - 3, y - 3)) * (t === T_MOUNT ? 5 : 7);
      const k2 = clamp(1 + sh + (th - 0.5) * 0.04, 0.62, 1.4);
      col = [Math.min(255, col[0] * k2), Math.min(255, col[1] * k2), Math.min(255, col[2] * k2)];
    } else if (t === T_RIVER && !(col as any).bank) {
      if (((x + y * 3 + Math.floor(n * 10)) % 23) === 0) col = C("#6f8f84");   // połysk
    }
    const k = (y * PW + x) * 4;
    im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
  }
  // ciemna linia brzegu wokół koryt rzecznych
  const D2 = im.data, isW = (px: number, py: number) => { if (px < 0 || py < 0 || px >= PW || py >= PH) return false; const t2 = w.terr[cidx(px >> 3, py >> 3)]; if (t2 === T_SEA) return true; if (t2 !== T_RIVER) return false; const k3 = (py * PW + px) * 4; return D2[k3 + 2] > D2[k3] + 8; };
  const ink = C(PAL.ink);
  for (let cy = 0; cy < WGH; cy++) for (let cx = 0; cx < WGW; cx++) {
    if (w.terr[cidx(cx, cy)] !== T_RIVER) continue;
    for (let py = cy * 8 - 1; py <= cy * 8 + 8; py++) for (let px = cx * 8 - 1; px <= cx * 8 + 8; px++) {
      if (px < 0 || py < 0 || px >= PW || py >= PH || isW(px, py)) continue;
      if (isW(px + 1, py) || isW(px - 1, py) || isW(px, py + 1) || isW(px, py - 1)) { const k3 = (py * PW + px) * 4; D2[k3] = ink[0]; D2[k3 + 1] = ink[1]; D2[k3 + 2] = ink[2]; }
    }
  }
  g.putImageData(im, 0, 0);
  // pola uprawne wokół wiosek i miast żywych
  for (const st of w.settlements) {
    if (st.culture === "undead" || st.kind === "castle") continue;
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const cx = st.cx + dx, cy = st.cy + dy; if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) continue;
      const i = cidx(clamp(cx, 0, WGW - 1), clamp(cy, 0, WGH - 1)); if (w.terr[i] !== T_PLAIN || w.road[i]) continue;
      const h = hashInt(i * 31 + 7); if (h % 3 === 0) continue;
      const x = cx * WCELL, y = cy * WCELL, orc = st.culture === "orc";
      const base = orc ? (h % 2 ? "#4a3b24" : "#3d3221") : h % 4 === 0 ? "#6a5a2e" : h % 4 === 1 ? "#4b4a26" : h % 4 === 2 ? "#3d3a1e" : "#57502a";
      g.fillStyle = base; g.fillRect(x, y, WCELL, WCELL);
      g.fillStyle = "rgba(10,9,8,0.28)"; for (let r = 1; r < WCELL; r += 2) g.fillRect(x, y + r, WCELL, 1);   // bruzdy
      g.fillStyle = "rgba(10,9,8,0.45)"; g.fillRect(x, y, WCELL, 1); g.fillRect(x, y, 1, WCELL);             // miedze
    }
  }
  // drogi
  for (let i = 0; i < w.road.length; i++) {
    if (w.road[i] !== 1 && w.road[i] !== 2) continue;
    const cx = i % WGW, cy = Math.floor(i / WGW), x = cx * WCELL + 4, y = cy * WCELL + 4;
    for (const [dx, dy] of [[1, 0], [0, 1], [1, 1], [-1, 1]]) {
      const j = cidx(cx + dx, cy + dy);
      if (cx + dx < 0 || cx + dx >= WGW || cy + dy >= WGH) continue;
      if (w.road[j] === 1 || w.road[j] === 2) {
        if (dx && dy && (w.road[cidx(cx + dx, cy)] || w.road[cidx(cx, cy + dy)])) continue;
        const bridge = w.road[i] === 2 || w.road[j] === 2;
        pxLine(g, x, y + 1, x + dx * WCELL, y + 1 + dy * WCELL, "#1a1610");
        pxLine(g, x + 1, y + 1, x + 1 + dx * WCELL, y + 1 + dy * WCELL, "#1a1610");
        pxLine(g, x, y, x + dx * WCELL, y + dy * WCELL, bridge ? PAL.wood : "#7a6648");
        pxLine(g, x + 1, y, x + 1 + dx * WCELL, y + dy * WCELL, bridge ? PAL.woodD : PAL.dirtL);
        if (bridge) { g.fillStyle = PAL.woodD; g.fillRect(x - 1, y - 1, 1, 3); g.fillRect(x + 2, y - 1, 1, 3); }
      }
    }
  }
  // brody
  for (let i = 0; i < w.road.length; i++) if (w.road[i] === 3) {
    const x = (i % WGW) * WCELL, y = Math.floor(i / WGW) * WCELL;
    for (let k = 0; k < 7; k++) { g.fillStyle = k % 2 ? PAL.stone : PAL.ash; g.fillRect(x + 1 + ((k * 3) % 6), y + 1 + ((k * 5) % 6), 2, 1); }
  }
  // detale: drzewa, góry, wzgórza, trzciny, fale
  const tree = (x: number, y: number, dead: boolean, dark: boolean) => {
    if (dead) { g.fillStyle = PAL.woodD; g.fillRect(x, y - 5, 1, 6); g.fillRect(x - 2, y - 4, 2, 1); g.fillRect(x + 1, y - 3, 2, 1); g.fillStyle = PAL.ink; g.fillRect(x - 1, y + 1, 3, 1); return; }
    g.fillStyle = PAL.ink; g.fillRect(x - 3, y - 6, 7, 7); g.fillRect(x - 2, y - 8, 5, 2);
    g.fillStyle = dark ? PAL.grassD : PAL.grass; g.fillRect(x - 2, y - 6, 5, 5); g.fillRect(x - 1, y - 7, 3, 1);
    g.fillStyle = dark ? PAL.grass : PAL.grassL; g.fillRect(x - 2, y - 6, 2, 2); g.fillRect(x - 1, y - 7, 1, 1);
    g.fillStyle = PAL.woodD; g.fillRect(x, y - 1, 1, 2);
    g.fillStyle = "rgba(10,9,8,0.4)"; g.fillRect(x - 2, y + 1, 6, 1);
  };
  for (let cy = 0; cy < WGH; cy++) for (let cx = 0; cx < WGW; cx++) {
    const i = cidx(cx, cy), t = w.terr[i], x = cx * WCELL, y = cy * WCELL, h = hashInt(i * 7 + w.seed);
    if (w.road[i]) continue;
    if (t === T_FOREST) {
      const bl = !!w.blight[i];
      tree(x + 2 + (h % 3), y + 6, bl && h % 3 > 0, (h >>> 4) % 2 === 0);
      if ((h >>> 8) % 3 > 0) tree(x + 5 + ((h >>> 2) % 3), y + 3 + ((h >>> 6) % 3), bl && (h >>> 3) % 3 > 0, true);
      if ((h >>> 11) % 2 === 0) tree(x + 1 + ((h >>> 13) % 5), y + 9 + ((h >>> 15) % 2), bl && (h >>> 5) % 2 > 0, (h >>> 9) % 2 === 0);
    } else if (t === T_MOUNT) {
      const hiE = E[i] > 0.62 && h % 4 !== 0;
      if (!hiE && h % 5 < 2) { g.fillStyle = PAL.ash; g.fillRect(x + 2, y + 5, 4, 1); g.fillRect(x + 3, y + 4, 2, 1); g.fillStyle = PAL.slate; g.fillRect(x + 4, y + 5, 2, 1); }
      else {
        const px = x + 4 + (h % 3) - 1, py = y + 7, hh = (hiE ? 12 : 8) + (h % (hiE ? 8 : 4));
        g.fillStyle = "rgba(10,9,8,0.35)"; for (let k = 0; k < 6; k++) g.fillRect(px + 2 + k, py - 2 + Math.floor(k / 2), 4, 1);   // cień na wschód
        for (let k = 0; k < hh; k++) {
          const half = Math.floor((k * 7) / hh);
          g.fillStyle = PAL.ash; g.fillRect(px - half, py - hh + k, half, 1);
          g.fillStyle = PAL.slate; g.fillRect(px, py - hh + k, half + 1, 1);
        }
        if (hiE) { g.fillStyle = PAL.boneHi; g.fillRect(px - 1, py - hh, 2, 2); g.fillStyle = PAL.bone; g.fillRect(px - 2, py - hh + 2, 2, 1); g.fillRect(px, py - hh + 2, 2, 1); g.fillRect(px - 3, py - hh + 3, 1, 1); }
        else { g.fillStyle = PAL.ash; g.fillRect(px - 1, py - hh, 2, 1); }
        g.fillStyle = PAL.ink; g.fillRect(px - 7, py, 15, 1);
      }
    } else if (t === T_HILL && h % 4 === 0) {
      g.fillStyle = w.blight[i] ? PAL.stone : PAL.moss; g.fillRect(x + 1, y + 4, 5, 1); g.fillRect(x + 2, y + 3, 3, 1);
      g.fillStyle = PAL.grassD; g.fillRect(x + 3, y + 4, 4, 1);
    } else if (t === T_SWAMP && h % 3 === 0) {
      g.fillStyle = PAL.moss; g.fillRect(x + 2, y + 2, 1, 3); g.fillRect(x + 4, y + 3, 1, 2);
      g.fillStyle = PAL.dirtL; g.fillRect(x + 2, y + 1, 1, 1);
    } else if (t === T_SEA && h % 9 === 0) {
      g.fillStyle = PAL.waterL; g.fillRect(x + 1, y + 3, 3, 1); g.fillRect(x + 4, y + 2, 2, 1);
    } else if (t === T_PLAIN && h % 9 === 0 && w.blight[i]) {
      tree(x + 3 + (h % 3), y + 6, true, false);
    } else if (t === T_PLAIN && h % 31 === 0 && w.blight[i]) {
      g.fillStyle = PAL.bone; g.fillRect(x + 3, y + 4, 2, 1); g.fillRect(x + 2, y + 3, 1, 1);
    }
  }
  // cień linii brzegowej
  for (let cy = 1; cy < WGH; cy++) for (let cx = 0; cx < WGW; cx++) {
    const i = cidx(cx, cy);
    if ((w.terr[i] === T_SEA || w.terr[i] === T_RIVER) && w.terr[cidx(cx, cy - 1)] !== T_SEA && w.terr[cidx(cx, cy - 1)] !== T_RIVER) { g.fillStyle = PAL.ink; g.fillRect(cx * WCELL, cy * WCELL, WCELL, 1); }
  }
  WMAP = cv;
  WFOG = mkCanvas(WGW, WGH)[0];
}

function renderBorders(w: World) {
  const PW = WGW * WCELL, PH = WGH * WCELL;
  if (!WBORDER) WBORDER = mkCanvas(PW, PH)[0];
  const g = WBORDER.getContext("2d");
  g.clearRect(0, 0, PW, PH);
  const fac = (i: number) => { const t = w.terr[i]; if (t === T_SEA) return -1; return w.settlements[w.nearest[i]].faction; };
  for (let cy = 0; cy < WGH - 1; cy++) for (let cx = 0; cx < WGW - 1; cx++) {
    const i = cidx(cx, cy), f = fac(i);
    if (f < 0) continue;
    const r = fac(cidx(cx + 1, cy)), d = fac(cidx(cx, cy + 1));
    const col = factionCol(f)[0];
    g.fillStyle = col;
    if (r >= 0 && r !== f) for (let k = 0; k < WCELL; k += 2) g.fillRect(cx * WCELL + 7, cy * WCELL + k, 1, 1);
    if (d >= 0 && d !== f) for (let k = 0; k < WCELL; k += 2) g.fillRect(cx * WCELL + k, cy * WCELL + 7, 1, 1);
  }
  // delikatne zabarwienie terytoriów
  g.globalAlpha = 0.06;
  for (let cy = 0; cy < WGH; cy++) for (let cx = 0; cx < WGW; cx++) { const f = fac(cidx(cx, cy)); if (f < 0) continue; g.fillStyle = factionCol(f)[0]; g.fillRect(cx * WCELL, cy * WCELL, WCELL, WCELL); }
  g.globalAlpha = 1;
  WBORDER_VER = w.ownerVersion;
}

function settlementIcon(s: Settlement, w: World): HTMLCanvasElement {
  const key = s.id + ":" + s.faction + ":" + (s.raided > 0 ? 1 : 0);
  let c = SICON.get(key);
  if (c) return c;
  const [col, shade, trim] = factionCol(s.faction);
  const undead = s.culture === "undead", dwarf = s.culture === "dwarf", orc = s.culture === "orc";
  const roof = undead ? PAL.slate : orc ? PAL.dirt : dwarf ? PAL.stone : PAL.red;
  const roofD = undead ? PAL.dusk : orc ? PAL.dirtD : dwarf ? PAL.slate : PAL.bloodD;
  const wall = undead ? PAL.stone : orc ? PAL.wood : PAL.ash;
  const P = new Pix(s.kind === "town" ? 34 : s.kind === "castle" ? 26 : 26, s.kind === "village" ? 18 : 28);
  const house = (x: number, y: number, w2: number, h2: number) => {
    P.r(x, y, w2, h2, orc ? PAL.wood : PAL.bone); P.r(x + w2 - 1, y, 1, h2, PAL.dirt);
    for (let k = 0; k < 3; k++) P.r(x - 1 + k, y - 1 - k, w2 + 2 - k * 2, 1, k === 2 ? roofD : roof);
    P.p(x + 1, y + h2 - 2, PAL.ink);
    if (orc) { P.p(x + Math.floor(w2 / 2), y - 4, PAL.bone); }
  };
  const tower = (x: number, y: number, h2: number) => {
    P.r(x, y, 4, h2, wall); P.r(x + 3, y, 1, h2, PAL.slate);
    P.r(x - 1, y - 1, 6, 1, wall); P.p(x - 1, y - 2, wall); P.p(x + 1, y - 2, wall); P.p(x + 4, y - 2, wall);
    P.p(x + 1, y + 2, PAL.ink);
  };
  const flag = (x: number, y: number) => { P.r(x, y, 1, 7, PAL.woodD); P.r(x + 1, y, 4, 3, col); P.r(x + 1, y + 3, 3, 1, col); P.p(x + 2, y + 1, trim); };
  if (s.kind === "village") {
    P.r(1, 12, 10, 4, s.raided ? PAL.dirtD : PAL.dirtL); for (let x = 1; x < 11; x += 2) P.r(x, 12, 1, 4, s.raided ? PAL.ink : PAL.moss);
    house(12, 9, 5, 4); house(18, 11, 5, 4); house(7, 6, 5, 4);
    P.r(0, 16, 25, 1, PAL.woodD);
    flag(21, 1);
    if (s.raided) { P.r(12, 8, 6, 2, PAL.ink); P.r(18, 10, 5, 2, PAL.ink); }
  } else if (s.kind === "castle") {
    P.r(3, 12, 20, 12, wall); P.r(3, 23, 20, 1, PAL.slate);
    for (let x = 3; x < 23; x += 2) P.p(x, 11, wall);
    tower(1, 9, 15); tower(20, 9, 15);
    P.r(9, 4, 8, 16, wall); P.r(16, 4, 1, 16, PAL.slate); for (let x = 9; x < 17; x += 2) P.p(x, 3, wall);
    P.r(12, 18, 3, 6, PAL.ink); P.p(11, 8, PAL.ink); P.p(14, 8, PAL.ink);
    flag(12, 0);
  } else {
    P.r(1, 14, 32, 12, wall); P.r(1, 25, 32, 1, PAL.slate); for (let x = 1; x < 33; x += 2) P.p(x, 13, wall);
    tower(0, 11, 15); tower(29, 11, 15); tower(14, 12, 14);
    house(5, 8, 5, 5); house(11, 6, 4, 5); house(20, 7, 6, 5); house(25, 9, 4, 4);
    P.r(15, 21, 3, 5, PAL.ink);
    if (s.capital) { P.r(16, 1, 5, 12, wall); P.r(20, 1, 1, 12, PAL.slate); P.p(18, 4, PAL.ink); flag(18, -6 + 6); }
    else flag(16, 3);
    if (undead) { P.p(6, 3, PAL.purpleL); P.p(26, 4, PAL.purpleL); }
  }
  c = P.toCanvas(true, true);
  SICON.set(key, c);
  return c;
}

function placeIcon(kind: SpecialPlace["kind"], cleared: boolean): HTMLCanvasElement {
  const key = kind + cleared;
  let c = PICON.get(key);
  if (c) return c;
  const P = new Pix(16, 14);
  if (kind === "ruins") { P.r(2, 4, 3, 9, PAL.ash); P.r(2, 3, 4, 1, PAL.stone); P.r(9, 7, 3, 6, PAL.ash); P.r(8, 6, 5, 1, PAL.stone); P.r(5, 11, 4, 2, PAL.stone); P.r(13, 10, 2, 3, PAL.slate); }
  else if (kind === "lair") { P.r(1, 6, 14, 7, PAL.slate); P.r(2, 5, 12, 1, PAL.stone); P.r(5, 8, 6, 5, PAL.black); P.p(6, 12, PAL.bone); P.p(9, 11, PAL.bone); P.p(2, 12, PAL.bone); }
  else if (kind === "shrine") { P.r(6, 2, 4, 11, PAL.stone); P.r(5, 12, 6, 1, PAL.slate); P.r(7, 4, 2, 1, PAL.gold); P.r(7.5, 3, 1, 3, PAL.gold); P.p(4, 11, PAL.moss); P.p(11, 11, PAL.moss); }
  else if (kind === "camp") { for (let k = 0; k < 6; k++) P.r(2 + k, 12 - k * 1.3, 8 - k * 2 + 2, 1, k > 3 ? PAL.dirtD : PAL.dirt); P.r(11, 10, 3, 2, PAL.woodD); P.p(12, 9, PAL.gold); P.p(12, 8, PAL.redL); P.r(1, 12, 14, 1, PAL.dirtD); }
  else { for (const [x, h2] of [[2, 6], [6, 8], [11, 6]]) { P.r(x, 13 - h2, 3, h2, PAL.stone); P.r(x, 13 - h2, 3, 1, PAL.ash); } P.r(8, 2, 1, 4, PAL.woodD); P.r(7, 3, 3, 1, PAL.woodD); P.p(13, 3, PAL.ink); }
  if (cleared) { for (let y = 0; y < 14; y++) for (let x = 0; x < 16; x++) if ((x + y) % 2) P.p(x, y, undefined as any); }
  c = P.toCanvas(true, true);
  PICON.set(key, c);
  return c;
}

// ---------- Cele zadań: inny kolor nazwy, znacznik nad celem i strzałka przy krawędzi ekranu ----------
const QUEST_COL = "#e9c45e";
function questMarks(w: World) {
  const m = { set: new Map<number, Quest>(), party: new Map<number, Quest>(), place: new Map<number, Quest>() };
  for (const q of w.player.quests) if (!q.done) {
    if (q.hide) continue;
    const r = questRef(w, q); if (!r) continue;
    if (r.kind === "party") m.party.set(r.id, q); else if (r.kind === "place") m.place.set(r.id, q); else m.set.set(r.id, q);
  }
  return m;
}
// Gdzie leży cel zadania: oddział, miejsce albo osada.
function questRef(w: World, q: Quest): { kind: "party" | "place" | "settlement"; id: number } | null {
  if ((q.kind as string) === "plot") return plotRef(w);
  if ((q.kind as string) === "rescue") return { kind: "settlement", id: q.target };
  if (q.kind === "bandits" || q.kind === "defend") return { kind: "party", id: q.target };
  if (q.kind === "persuade") { const L = lordById(w, q.target); return L && L.party >= 0 ? { kind: "party", id: L.party } : null; }
  if (q.kind === "wolves") return { kind: "place", id: q.target };
  if (q.kind === "grain" || q.kind === "cattle" || q.kind === "militia") return { kind: "settlement", id: q.giver };
  return { kind: "settlement", id: q.target };
}
function questPos(w: World, q: Quest): V | null {
  const r = questRef(w, q);
  if ((q.kind as string) === "plot") { if (!r) return null; if (r.kind === "place") { const pl = w.places[r.id]; return pl ? { x: pl.cx * WCELL + 4, y: pl.cy * WCELL + 4 } : null; } if (r.kind === "party") { const p = partyById(w, r.id); return p ? { x: p.x, y: p.y } : null; } }
  if (r && r.kind === "party") { const p = partyById(w, r.id); return p && partyVisible(w, p) ? { x: p.x, y: p.y } : null; }
  if (q.kind === "bandits") { const p = partyById(w, q.target); return p && partyVisible(w, p) ? { x: p.x, y: p.y } : null; }
  if (q.kind === "wolves") { const pl = w.places[q.target]; return pl && w.explored[cidx(pl.cx, pl.cy)] ? { x: pl.cx * WCELL + 4, y: pl.cy * WCELL + 4 } : null; }
  const s = w.settlements[r && r.kind === "settlement" ? r.id : q.target];
  return s ? { x: s.cx * WCELL + 4, y: s.cy * WCELL + 4 } : null;
}
function questPin(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const by = Math.round(y - 4 + Math.sin(t * 4) * 1.5);
  g.fillStyle = PAL.ink; g.fillRect(x - 2, by - 8, 5, 10);
  g.fillStyle = QUEST_COL; g.fillRect(x - 1, by - 7, 3, 5); g.fillRect(x - 1, by - 1, 3, 2);
}
function questArrows(w: World, g: CanvasRenderingContext2D, sx: number, sy: number, t: number) {
  for (const q of w.player.quests) {
    if (q.done) continue;
    const p = questPos(w, q);
    if (!p) continue;
    const x = p.x - sx, y = p.y - sy;
    if (x > 6 && y > 18 && x < W - 6 && y < H - 14) continue;
    const cx = W / 2, cy = H / 2, a = Math.atan2(y - cy, x - cx);
    const k = Math.min((W / 2 - 14) / Math.max(1e-3, Math.abs(Math.cos(a))), (H / 2 - 20) / Math.max(1e-3, Math.abs(Math.sin(a))));
    const ax = Math.round(cx + Math.cos(a) * k), ay = Math.round(cy + Math.sin(a) * k);
    const pulse = 1 + Math.sin(t * 5) * 0.5;
    g.fillStyle = PAL.ink;
    for (let i = -1; i <= 5; i++) for (let j = -3; j <= 3; j++) if (Math.abs(j) <= (5 - i) * 0.7) g.fillRect(Math.round(ax + Math.cos(a) * i - Math.sin(a) * j), Math.round(ay + Math.sin(a) * i + Math.cos(a) * j), 1, 1);
    g.fillStyle = QUEST_COL;
    for (let i = 0; i <= 4; i++) for (let j = -2; j <= 2; j++) if (Math.abs(j) <= (4 - i) * 0.6) g.fillRect(Math.round(ax + Math.cos(a) * (i + pulse) - Math.sin(a) * j), Math.round(ay + Math.sin(a) * (i + pulse) + Math.cos(a) * j), 1, 1);
    const d = Math.round(dist(p.x, p.y, sx + W / 2, sy + H / 2) / WCELL);
    wText(g, d + "", Math.round(ax - Math.cos(a) * 9 - 4), Math.round(ay - Math.sin(a) * 9 - 2), QUEST_COL);
  }
}

interface WorldView { cam: V; hover: { kind: string; id: number } | null; time: number; overview?: boolean; }

function cellVisible(w: World, cx: number, cy: number) {
  const p = playerParty(w);
  if (!p) return false;
  const r = sightRadius(w, p);
  if ((cx - p.x / WCELL) ** 2 + (cy - p.y / WCELL) ** 2 < r * r) return true;
  return false;
}

function updateExplored(w: World) {
  const p = playerParty(w);
  if (!p) return;
  const r = Math.ceil(sightRadius(w, p)), pcx = p.x / WCELL, pcy = p.y / WCELL;
  for (let y = Math.floor(pcy - r); y <= pcy + r; y++) for (let x = Math.floor(pcx - r); x <= pcx + r; x++) {
    if (x < 0 || y < 0 || x >= WGW || y >= WGH) continue;
    if ((x - pcx) ** 2 + (y - pcy) ** 2 < r * r) w.explored[cidx(x, y)] = 1;
  }
  // własne osady widzą okolicę
  for (const s of w.settlements) if (s.owner === -2 || (w.player.liege > 0 && s.faction === w.player.liege)) {
    for (let y = s.cy - 5; y <= s.cy + 5; y++) for (let x = s.cx - 5; x <= s.cx + 5; x++) if (x >= 0 && y >= 0 && x < WGW && y < WGH) w.explored[cidx(x, y)] = 1;
  }
}

function partyVisible(w: World, p: Party) {
  if (p.kind === "player") return true;
  const pp = playerParty(w);
  if (!pp) return false;
  const r = sightRadius(w, pp) * WCELL;
  if (dist(p.x, p.y, pp.x, pp.y) < r) return true;
  // lennicy i sojusznicy widzą swoich
  for (const s of w.settlements) if (s.owner === -2 && dist(p.x, p.y, s.cx * WCELL, s.cy * WCELL) < 44) return true;
  return false;
}

// Widok całego świata (Tab): mapa w skali, osady, armie lordów w zasięgu wzroku, ty.
function renderOverview(w: World, v: WorldView, g: CanvasRenderingContext2D) {
  const PW = WGW * WCELL, PH = WGH * WCELL, k = Math.min(W / PW, (H - 14) / PH), ox = Math.round((W - PW * k) / 2), oy = Math.round((H - PH * k) / 2) + 6;
  g.fillStyle = PAL.black; g.fillRect(0, 0, W, H);
  g.imageSmoothingEnabled = true; g.drawImage(WMAP, 0, 0, PW, PH, ox, oy, PW * k, PH * k);
  if (settings.borders !== false) g.drawImage(WBORDER, 0, 0, PW, PH, ox, oy, PW * k, PH * k);
  // nieodkryte ciemne
  const fg = WFOG.getContext("2d"), fim = fg.createImageData(WGW, WGH);
  for (let i = 0; i < WGW * WGH; i++) { fim.data[i * 4 + 3] = w.explored[i] ? 0 : 235; }
  fg.putImageData(fim, 0, 0); g.drawImage(WFOG, 0, 0, WGW, WGH, ox, oy, PW * k, PH * k);
  g.imageSmoothingEnabled = false;
  g.globalAlpha = 0.55;
  for (const [nm, rx, ry] of MAP_REGIONS) if (w.explored[cidx(rx, ry)]) wText(g, nm, Math.round(ox + rx * WCELL * k - nm.length * 2), Math.round(oy + ry * WCELL * k), /Morze|Zatoka|Jezioro/.test(nm) ? "#8fb0a8" : PAL.bone);
  g.globalAlpha = 1;
  for (const s of w.settlements) {
    if (!w.explored[cidx(s.cx, s.cy)]) continue;
    const x = Math.round(ox + (s.cx * WCELL + 4) * k), y = Math.round(oy + (s.cy * WCELL + 4) * k);
    const [fc] = factionCol(s.faction);
    g.fillStyle = PAL.ink; g.fillRect(x - 2, y - 2, s.kind === "village" ? 3 : 5, s.kind === "village" ? 3 : 5);
    g.fillStyle = s.owner === -2 ? PAL.gold : fc; g.fillRect(x - 1, y - 1, s.kind === "village" ? 1 : 3, s.kind === "village" ? 1 : 3);
    if (s.kind !== "village") wText(g, s.name, x - s.name.length * 2, y + 3, s.siegeBy.length ? PAL.redL : PAL.boneHi);
  }
  for (const o of w.parties) if (o.kind === "lord" && partyVisible(w, o)) { g.fillStyle = factionCol(o.faction)[0]; g.fillRect(Math.round(ox + o.x * k), Math.round(oy + o.y * k), 2, 2); }
  const pp = playerParty(w);
  if (pp) { const x = Math.round(ox + pp.x * k), y = Math.round(oy + pp.y * k), bl = Math.floor(v.time * 3) % 2; g.fillStyle = bl ? PAL.white : PAL.gold; g.fillRect(x - 1, y - 3, 3, 7); g.fillRect(x - 3, y - 1, 7, 3); }
  const vx = Math.round(ox + v.cam.x * k), vy = Math.round(oy + v.cam.y * k);
  g.strokeStyle = "rgba(255,255,255,.45)"; g.strokeRect(vx + 0.5, vy + 0.5, Math.round(W * k), Math.round(H * k));
  wText(g, `ŚWIAT · ${SEASON_NAME[season(w)].toUpperCase()} · TAB: WRÓĆ · KLIK: POKAŻ MIEJSCE`, 4, H - 22, PAL.gold);
  (v as any).ovK = { k, ox, oy };
}
let MAPZ_LAST_W = 480;
function renderWorld(w: World, v: WorldView, g: CanvasRenderingContext2D) {
  if (!WMAP) renderWorldMap(w);
  if (WBORDER_VER !== w.ownerVersion) renderBorders(w);
  if (v.overview) { renderOverview(w, v, g); return; }
  MAPZ_LAST_W = W;
  const PW = WGW * WCELL, PH = WGH * WCELL;
  QM = questMarks(w);
  const sx = Math.round(clamp(v.cam.x, 0, PW - W)), sy = Math.round(clamp(v.cam.y, 0, PH - H));
  v.cam.x = sx; v.cam.y = sy;
  g.fillStyle = PAL.black; g.fillRect(0, 0, W, H);
  g.drawImage(WMAP, sx, sy, W, H, 0, 0, W, H);
  if (settings.borders !== false) g.drawImage(WBORDER, sx, sy, W, H, 0, 0, W, H);
  const vis = (x: number, y: number, m = 40) => x > sx - m && x < sx + W + m && y > sy - m && y < sy + H + m;
  const t = v.time;
  // fale morza (animacja)
  g.fillStyle = PAL.waterL;
  for (let k = 0; k < 40; k++) {
    const hx = hashInt(k * 13 + 7) % W, hy = hashInt(k * 31 + 3) % H;
    const wx = sx + hx, wy = sy + hy;
    const i = cellOf(wx, wy);
    if (w.terr[i] !== T_SEA) continue;
    const ph = (t * 0.6 + k * 0.37) % 1;
    if (ph < 0.5) g.fillRect(hx + Math.round(ph * 6), hy, 2, 1);
  }
  // nazwy krain przy oddaleniu
  if (W >= 700) {
    const al = clamp((W - 700) / 300, 0.25, 0.6);
    g.globalAlpha = al;
    for (const [nm, rx, ry] of MAP_REGIONS) {
      const x = rx * WCELL - sx, y = ry * WCELL - sy;
      if (x < -120 || x > W + 120 || y < -20 || y > H + 20 || !w.explored[cidx(rx, ry)]) continue;
      wTextBig(g, nm.toUpperCase().split("").join(" "), Math.round(x), Math.round(y), /Morze|Zatoka|Jezioro/.test(nm) ? "#8fb0a8" : PAL.boneHi, 2);
    }
    g.globalAlpha = 1;
  }
  type D = { y: number; draw: () => void };
  const list: D[] = [];
  // miejsca specjalne
  for (const p of w.places) {
    const x = p.cx * WCELL + 4, y = p.cy * WCELL + 4;
    if (!vis(x, y) || !w.explored[cidx(p.cx, p.cy)]) continue;
    p.seen = true;
    list.push({ y, draw: () => {
      const img = placeIcon(p.kind, p.cleared > 0);
      g.drawImage(img, Math.round(x - sx - img.width / 2), Math.round(y - sy - img.height + 3));
      if (p.kind === "camp" && p.cleared <= 0) { g.fillStyle = Math.floor(t * 8) % 2 ? PAL.gold : PAL.redL; g.fillRect(Math.round(x - sx + 4), Math.round(y - sy - 5), 1, 1); }
      if (p.kind === "shrine") { g.globalAlpha = 0.4 + Math.sin(t * 3) * 0.2; g.fillStyle = PAL.gold; g.fillRect(Math.round(x - sx - 1), Math.round(y - sy - 12), 2, 2); g.globalAlpha = 1; }
      const qm = settings.questMarkers && QM.place.has(p.id);
      if (qm || (v.hover?.kind === "place" && v.hover.id === p.id)) { wText(g, p.name, Math.round(x - sx - (p.name.length * 4) / 2), Math.round(y - sy + 6), qm ? QUEST_COL : PAL.bone); }
      if (qm) questPin(g, Math.round(x - sx), Math.round(y - sy - 12), t);
    } });
  }
  // osady
  for (const s of w.settlements) {
    const x = s.cx * WCELL + 4, y = s.cy * WCELL + 4;
    if (!vis(x, y, 50) || !w.explored[cidx(s.cx, s.cy)]) continue;
    list.push({ y: y + 6, draw: () => {
      const img = settlementIcon(s, w);
      const ix = Math.round(x - sx - img.width / 2), iy = Math.round(y - sy - img.height + 8);
      g.fillStyle = "rgba(10,9,8,0.35)"; g.fillRect(ix + 2, iy + img.height - 2, img.width - 2, 3);
      g.drawImage(img, ix, iy);
      if (s.siegeBy.length) { // dym i ogień oblężenia
        for (let k = 0; k < 6; k++) { const ph = (t * 0.5 + k / 6) % 1; g.globalAlpha = (1 - ph) * 0.6; g.fillStyle = k % 2 ? PAL.ash : PAL.stone; g.fillRect(Math.round(x - sx - 6 + k * 2 + Math.sin(ph * 6) * 2), Math.round(iy - ph * 14), 2, 2); }
        g.globalAlpha = 1; g.fillStyle = Math.floor(t * 6) % 2 ? PAL.gold : PAL.redL; g.fillRect(Math.round(x - sx - 4), Math.round(iy + 6), 2, 2);
      }
      if (s.raided > 0) { for (let k = 0; k < 3; k++) { const ph = (t * 0.4 + k / 3) % 1; g.globalAlpha = (1 - ph) * 0.5; g.fillStyle = PAL.ash; g.fillRect(Math.round(x - sx + k * 4 - 4), Math.round(iy + 4 - ph * 12), 2, 2); } g.globalAlpha = 1; }
      if (s.tournament > 0) { g.fillStyle = PAL.gold; g.fillRect(ix + img.width - 3, iy - 2, 2, 2); }
      // dym z kominów i powiewające flagi
      if (!s.raided && !s.siegeBy.length) for (let k = 0; k < (s.kind === "village" ? 2 : 3); k++) {
        const hh = hashInt(s.seed + k * 17), bx2 = ix + 3 + (hh % Math.max(4, img.width - 6)), by2 = iy + 4 + ((hh >>> 4) % 4);
        for (let j = 0; j < 3; j++) { const ph = (t * 0.35 + j / 3 + k * 0.21) % 1; g.globalAlpha = (1 - ph) * 0.35; g.fillStyle = PAL.ash; g.fillRect(Math.round(bx2 + Math.sin(ph * 5 + k) * 2 + ph * 3), Math.round(by2 - ph * 11), 1 + (ph > 0.5 ? 1 : 0), 1); }
        g.globalAlpha = 1;
      }
      if (s.kind !== "village") {
        const [fc, , ft] = factionCol(s.faction), fx2 = ix + Math.round(img.width / 2), fy2 = iy - 6;
        g.fillStyle = PAL.ink; g.fillRect(fx2, fy2, 1, 8);
        const wv = Math.floor(t * 4 + s.id) % 3;
        g.fillStyle = fc; g.fillRect(fx2 + 1, fy2 + (wv === 1 ? 1 : 0), 5, 2); g.fillRect(fx2 + 1, fy2 + 2, wv === 2 ? 3 : 4, 1);
        g.fillStyle = ft || PAL.bone; g.fillRect(fx2 + 2, fy2 + 1, 1, 1);
      }
      const label = s.name;
      const qm = settings.questMarkers && QM.set.has(s.id);
      const lcol2 = qm ? QUEST_COL : s.owner === -2 ? PAL.gold : playerAtWarWith(w, s.faction) ? PAL.redL : PAL.boneHi;
      g.globalAlpha = qm ? 1 : 0.92;
      if (s.kind === "village") { const lw = label.length * 4 + 2; wText(g, label, Math.round(x - sx - lw / 2 + 4), iy + img.height + 2, lcol2); crestAt(g, s.faction, Math.round(x - sx - lw / 2 - 5), iy + img.height + 1); }
      else { const bw = wTextBig(g, label, Math.round(x - sx + 5), iy + img.height + 1, lcol2, 2); crestAt(g, s.faction, Math.round(x - sx + 5 - bw / 2 - 9), iy + img.height + 4); }
      g.globalAlpha = 1;
      if (qm) questPin(g, Math.round(x - sx), iy - 2, t);
    } });
  }
  // oddziały
  const pp = playerParty(w);
  for (const p of w.parties) {
    if (!vis(p.x, p.y) || !partyVisible(w, p)) continue;
    if (p.kind === "player" && w.player.captive) continue;
    list.push({ y: p.y, draw: () => drawPartyFig(w, g, p, sx, sy, t, v.hover?.kind === "party" && v.hover.id === p.id) });
  }
  list.sort((a, b) => a.y - b.y);
  for (const d of list) d.draw();
  // ścieżka gracza
  if (pp && pp.path.length) {
    g.fillStyle = PAL.boneHi;
    for (let k = 0; k < pp.path.length; k += 2) { const c = pp.path[k]; const x = (c % WGW) * WCELL + 4 - sx, y = Math.floor(c / WGW) * WCELL + 4 - sy; g.globalAlpha = 0.5; g.fillRect(x, y, 1, 1); }
    g.globalAlpha = 1;
    const c = pp.path[pp.path.length - 1], x = (c % WGW) * WCELL + 4 - sx, y = Math.floor(c / WGW) * WCELL + 4 - sy;
    g.fillStyle = PAL.gold; g.fillRect(x - 2, y, 5, 1); g.fillRect(x, y - 2, 1, 5);
    // czas dotarcia
    const hrs = pp.path.length / Math.max(0.5, partySpeed(w, pp));
    const eta = hrs < 1 ? "<1 H" : hrs < 24 ? `${Math.round(hrs)} H` : `${Math.floor(hrs / 24)} D ${Math.round(hrs % 24)} H`;
    g.fillStyle = "rgba(10,9,8,0.6)"; g.fillRect(x + 4, y - 9, eta.length * 4 + 3, 8);
    wText(g, eta, x + 6, y - 7, PAL.gold);
  }
  // tropy: ślady innych oddziałów (umiejętność tropienia)
  const trk = w.player.skills.tracking;
  if (trk > 0 && pp) {
    const now = w.day * 24 + w.hour, rr2 = (6 + trk * 4) * WCELL, maxAge = 12 + trk * 10;
    for (const o of w.parties) {
      const tr = (o as any).trail as number[][]; if (!tr || o === pp || partyVisible(w, o)) continue;
      for (const [tx, ty, th] of tr) {
        const age = now - th; if (age > maxAge || dist(tx, ty, pp.x, pp.y) > rr2 || !vis(tx, ty)) continue;
        g.globalAlpha = 0.65 * (1 - age / maxAge); g.fillStyle = o.kind === "bandit" ? PAL.redL : o.kind === "lord" ? factionCol(o.faction)[0] : PAL.dirtL;
        g.fillRect(Math.round(tx - sx), Math.round(ty - sy), 1, 1); g.fillRect(Math.round(tx - sx) + 2, Math.round(ty - sy) + 1, 1, 1);
      }
    }
    g.globalAlpha = 1;
  }
  // mgła wojny
  updateExplored(w);
  const fg = WFOG.getContext("2d");
  const fim = fg.createImageData(WGW, WGH);
  const r = sightRadius(w, pp), pcx = pp ? pp.x / WCELL : 0, pcy = pp ? pp.y / WCELL : 0;
  for (let y = 0; y < WGH; y++) for (let x = 0; x < WGW; x++) {
    const i = cidx(x, y), k = i * 4;
    const d2 = (x - pcx) ** 2 + (y - pcy) ** 2;
    let a = 0;
    if (!w.explored[i]) a = 255;
    else if (d2 > r * r) a = 60;
    else a = clamp((Math.sqrt(d2) - r + 2) * 30, 0, 60);
    fim.data[k] = 10; fim.data[k + 1] = 9; fim.data[k + 2] = 8; fim.data[k + 3] = a;
  }
  fg.putImageData(fim, 0, 0);
  g.save();
  g.imageSmoothingEnabled = true;
  g.drawImage(WFOG, sx / WCELL, sy / WCELL, W / WCELL, H / WCELL, 0, 0, W, H);
  g.restore();
  // pora dnia
  const h = w.hour;
  let dark = 0, warm = 0;
  const sm = (a: number) => a * a * (3 - 2 * a);   // płynne przejścia świtu i zmierzchu
  if (h < 4.5 || h >= 21.5) dark = 0.7;
  else if (h < 7.5) { const k = sm((h - 4.5) / 3); dark = 0.7 * (1 - k); warm = 0.18 * Math.sin(k * Math.PI); }
  else if (h >= 17.5) { const k = sm((h - 17.5) / 4); dark = 0.7 * k; warm = 0.24 * Math.sin(k * Math.PI); }
  g.globalCompositeOperation = "multiply";
  g.fillStyle = "#ece4d2"; g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  if (warm > 0) { g.fillStyle = `rgba(140,70,30,${warm})`; g.fillRect(0, 0, W, H); }
  if (dark > 0) {
    g.fillStyle = `rgba(6,8,16,${dark})`; g.fillRect(0, 0, W, H);
    // światła w osadach
    g.globalCompositeOperation = "lighter";
    for (const s of w.settlements) {
      const x = s.cx * WCELL + 4 - sx, y = s.cy * WCELL - sy;
      if (x < -30 || y < -30 || x > W + 30 || y > H + 30 || !w.explored[cidx(s.cx, s.cy)]) continue;
      const gr = g.createRadialGradient(x, y, 0, x, y, s.kind === "village" ? 14 : 24);
      gr.addColorStop(0, `rgba(170,110,40,${0.35 * dark / 0.6})`); gr.addColorStop(1, "rgba(170,110,40,0)");
      g.fillStyle = gr; g.fillRect(x - 26, y - 26, 52, 52);
      g.fillStyle = `rgba(200,150,60,${dark})`;
      for (let k = 0; k < (s.kind === "village" ? 2 : 5); k++) { const hh = hashInt(s.seed + k); g.fillRect(Math.round(x - 8 + (hh % 16)), Math.round(y - 6 + ((hh >>> 5) % 10)), 1, 1); }
    }
    if (pp) { const x = pp.x - sx, y = pp.y - sy; const gr = g.createRadialGradient(x, y - 4, 0, x, y - 4, 12); gr.addColorStop(0, `rgba(170,110,40,${0.3 * dark / 0.6})`); gr.addColorStop(1, "rgba(170,110,40,0)"); g.fillStyle = gr; g.fillRect(x - 14, y - 18, 28, 28); }
    g.globalCompositeOperation = "source-over";
  }
  // zaraza Morvath: szary welon i fioletowe drobiny nad skażoną ziemią
  for (let cy = Math.floor(sy / WCELL); cy < Math.ceil((sy + H) / WCELL); cy++) for (let cx = Math.floor(sx / WCELL); cx < Math.ceil((sx + W) / WCELL); cx++) {
    if (cx < 0 || cy < 0 || cx >= WGW || cy >= WGH) continue;
    const i = cidx(cx, cy); if (!w.blight[i] || !w.explored[i]) continue;
    const hh = hashInt(i * 31);
    g.globalAlpha = 0.1 + Math.sin(t * 0.8 + (hh % 60) * 0.1) * 0.04; g.fillStyle = "#3a2f45"; g.fillRect(cx * WCELL - sx, cy * WCELL - sy, WCELL, WCELL);
    if (hh % 7 === 0) { const ph = (t * 0.25 + (hh % 100) / 100) % 1; g.globalAlpha = Math.sin(ph * Math.PI) * 0.7; g.fillStyle = PAL.purpleL; g.fillRect(cx * WCELL - sx + (hh % 8), cy * WCELL - sy + 6 - Math.round(ph * 10), 1, 1); }
  }
  g.globalAlpha = 1;
  // pora roku: zima bieli ziemię i sypie śniegiem
  const sea = season(w);
  if (sea === 3) {
    g.globalAlpha = 0.11; g.fillStyle = "#dfe6ea"; g.fillRect(0, 0, W, H); g.globalAlpha = 1;
    g.fillStyle = "rgba(235,240,245,0.75)";
    for (let i = 0; i < 90; i++) { const s2 = hashInt(i * 11 + 5); const x = ((s2 % 997) * 3 + Math.sin(t + i) * 8 - t * 8) % W, y = (((s2 >>> 10) % 400) + t * 22) % H; g.fillRect(Math.round((x + W) % W), Math.round(y), 1, 1); }
  } else if (sea === 2) { g.globalAlpha = 0.06; g.fillStyle = "#8a5a20"; g.fillRect(0, 0, W, H); g.globalAlpha = 1; }
  // mgła: wolno płynące pasy
  if (w.fog) for (let k = 0; k < 7; k++) { const fy = ((hashInt(k * 53) % H) + t * 2) % (H + 40) - 20; g.globalAlpha = 0.16; g.fillStyle = "#c9ccc8"; g.beginPath(); g.ellipse(((hashInt(k * 9) % W) + t * 5 * (k % 2 ? 1 : -1)) % (W + 200) - 100, fy, 140, 18, 0, 0, Math.PI * 2); g.fill(); g.globalAlpha = 1; }
  // burza: błyskawice
  if ((w as any).storm) { const fl = Math.sin(t * 0.7) > 0.995 || (Math.floor(t * 10) % 97 === 0); if (fl) { g.globalAlpha = 0.35; g.fillStyle = "#e8ecff"; g.fillRect(0, 0, W, H); g.globalAlpha = 1; if (!(w as any).thunderT || t - (w as any).thunderT > 2) { (w as any).thunderT = t; sfx.explode?.(0.35, rr(-0.5, 0.5)); } } }
  // deszcz
  if (w.rain) {
    g.fillStyle = "rgba(160,170,170,0.28)";
    for (let i = 0; i < 110; i++) { const s = hashInt(i * 7 + 1); const x = ((s % 997) * 3 - t * 40) % W, y = (((s >>> 10) % 400) + t * 200) % H; g.fillRect(Math.round((x + W) % W), Math.round(y), 1, 3); }
  }
  if (settings.questMarkers && settings.questArrows) questArrows(w, g, sx, sy, t);
  // chmury cienia
  g.globalAlpha = 0.08;
  g.fillStyle = PAL.ink;
  for (let k = 0; k < 5; k++) { const cx = ((hashInt(k * 77) % (PW + 400)) + t * 6) % (PW + 400) - 200 - sx, cy = (hashInt(k * 191) % PH) - sy; g.beginPath(); g.ellipse(cx, cy, 90, 40, 0, 0, Math.PI * 2); g.fill(); }
  g.globalAlpha = 1;
}

function drawPartyFig(w: World, g: CanvasRenderingContext2D, p: Party, sx: number, sy: number, t: number, hover: boolean) {
  const [col, , trim] = p.kind === "player" ? [PAL.gold, PAL.goldD, PAL.white] : factionCol(p.faction);
  const mounted = p.kind === "lord" ? p.troops.some((x) => UNITS[x.type]?.mount) : p.kind === "player" ? !!w.player.equip.horse : false;
  const undead = p.faction === 5 || p.kind === "undead";
  let figs: HTMLCanvasElement[];
  if (p.kind === "monster") figs = [spritesFor({ ...troopLook(UNITS.x_wolf, 1, 7) }, "mapwolf").frames[2][0], spritesFor({ ...troopLook(UNITS.x_wolf, 1, 7) }, "mapwolf").frames[2][1]];
  else figs = mapFigure(col, trim, mounted, undead);
  const moving = p.path.length > 0;
  const img = figs[moving ? Math.floor(p.anim) % 2 : 0];
  const x = Math.round(p.x - sx), y = Math.round(p.y - sy);
  g.fillStyle = "rgba(10,9,8,0.45)"; g.fillRect(x - 5, y, 11, 2);
  if (p.kind === "monster") g.drawImage(img, x - 12, y - 26, 24, 32);
  else {
    const flip = p.path.length && ((p.path[0] % WGW) * WCELL + 4) < p.x;
    if (flip) { g.save(); g.translate(x + Math.ceil(img.width / 2), y - img.height + 2); g.scale(-1, 1); g.drawImage(img, 0, 0); g.restore(); }
    else g.drawImage(img, x - Math.floor(img.width / 2), y - img.height + 2);
  }
  if (p.kind === "player" && G.camping) {   // obóz: namioty i ognisko
    for (const [dx, dy] of [[-9, -2], [8, -3], [-2, 5]]) { const tx = x + dx, ty = y + dy; g.fillStyle = PAL.ink; g.fillRect(tx - 4, ty - 5, 9, 6); g.fillStyle = PAL.dirtL; g.fillRect(tx - 3, ty - 4, 7, 4); g.fillRect(tx - 1, ty - 6, 3, 2); g.fillStyle = PAL.dirtD; g.fillRect(tx, ty - 3, 1, 3); }
    g.fillStyle = Math.floor(t * 8) % 2 ? PAL.gold : PAL.redL; g.fillRect(x + 1, y + 3, 2, 2); g.fillStyle = PAL.woodD; g.fillRect(x, y + 5, 4, 1);
    for (let j = 0; j < 3; j++) { const ph = (t * 0.5 + j / 3) % 1; g.globalAlpha = (1 - ph) * 0.4; g.fillStyle = PAL.ash; g.fillRect(x + 2 + Math.round(Math.sin(ph * 6) * 2), y + 1 - Math.round(ph * 12), 1, 1); }
    g.globalAlpha = 1;
  }
  if (p.kind === "caravan") { g.fillStyle = PAL.wood; g.fillRect(x + 4, y - 5, 6, 4); g.fillStyle = PAL.bone; g.fillRect(x + 4, y - 7, 6, 2); g.fillStyle = PAL.ink; g.fillRect(x + 5, y - 1, 1, 1); g.fillRect(x + 8, y - 1, 1, 1); }
  if (p.state === "siege") { g.fillStyle = Math.floor(t * 4) % 2 ? PAL.gold : PAL.redL; g.fillRect(x - 6, y - 2, 1, 1); }
  const qm = settings.questMarkers && QM.party.has(p.id);
  const mode = settings.partyNames || "lords";
  const n = troopCount(p.troops) + (p.kind === "player" ? 1 + w.player.companions.length : 0);
  const lcol = qm ? QUEST_COL : p.kind === "player" ? PAL.gold : hostile(w, playerParty(w), p) ? PAL.redL : PAL.boneHi;
  const nearTown = w.settlements.some((s2) => dist(s2.cx * WCELL + 4, s2.cy * WCELL + 4, p.x, p.y) < 22);
  const named = qm || hover || (mode === "all" && !nearTown) || (mode === "lords" && p.kind === "lord" && !nearTown);
  if (p.kind === "lord" || p.kind === "player") {   // proporzec nad armią
    const [fc, , ft] = p.kind === "player" ? [PAL.gold, PAL.goldD, PAL.red] : factionCol(p.faction), bx = x + 5, by = y - 22;
    g.fillStyle = PAL.ink; g.fillRect(bx, by, 1, 14);
    const wv = Math.floor(t * 4 + p.id) % 3;
    g.fillStyle = PAL.ink; g.fillRect(bx + 1, by - 1, 7, 6);
    g.fillStyle = fc; g.fillRect(bx + 1, by + (wv === 1 ? 1 : 0), 6, 4); g.fillStyle = ft || PAL.bone; g.fillRect(bx + 3, by + 1, 2, 2);
  }
  // liczebność: plakietka
  if (p.kind !== "caravan" && p.kind !== "villagers") { const txt = String(n), bw2 = txt.length * 4 + 3; g.fillStyle = "rgba(10,9,8,0.75)"; g.fillRect(x - Math.round(bw2 / 2), y + 3, bw2, 7); wText(g, txt, x - Math.round(bw2 / 2) + 2, y + 4, lcol); }
  if (p.kind !== "player" && named) { const txt = p.name; wText(g, txt.toUpperCase(), x - Math.round(txt.length * 2), y - 27, lcol); }
  if (qm) questPin(g, x, y - 28, t);
  if (hover) { g.fillStyle = PAL.white; g.fillRect(x - 7, y + 3, 15, 1); }
}

// Mała czcionka mapy: korzysta z pikselowego fontu bitwy (wielkie litery).
function wText(g: CanvasRenderingContext2D, t: string, x: number, y: number, col: string) { pxText(g, t.toUpperCase(), x, y, col); }

// Większy napis (×2) z pamięci podręcznej: nazwy miast i zamków.
const BIGTXT = new Map<string, HTMLCanvasElement>();
function wTextBig(g: CanvasRenderingContext2D, t: string, cx: number, y: number, col: string, k = 2) {
  const key = t + col + k;
  let c = BIGTXT.get(key);
  if (!c) {
    const tw = t.length * 4 + 2;
    const [s1, g1] = mkCanvas(tw + 2, 9);
    pxText(g1, t.toUpperCase(), 2, 2, PAL.ink); pxText(g1, t.toUpperCase(), 1, 1, col);
    const [s2, g2] = mkCanvas((tw + 2) * k, 9 * k); g2.imageSmoothingEnabled = false; g2.drawImage(s1, 0, 0, s2.width, s2.height);
    c = s2; BIGTXT.set(key, c);
  }
  g.drawImage(c, Math.round(cx - c.width / 2), y);
  return c.width;
}
// Mały herb frakcji przy nazwie.
function crestAt(g: CanvasRenderingContext2D, f: number, x: number, y: number) {
  const [c1, c2, c3] = factionCol(f);
  g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, 8, 9);
  g.fillStyle = c1; g.fillRect(x, y, 6, 6); g.fillRect(x + 1, y + 6, 4, 1);
  g.fillStyle = c3 || PAL.bone; g.fillRect(x + 2, y + 1, 2, 4); g.fillRect(x + 1, y + 2, 4, 1);
  void c2;
}

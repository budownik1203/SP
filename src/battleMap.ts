// Mapa bitwy: teren według miejsca starcia (równina, las, wzgórza, bagno, rzeka, wybrzeże, ruiny), oblężenie i arena.
// Siatka komórek 8 px: 0 zwykła, 1 wolna (bagno, bród), 2 zablokowana (głęboka woda, mur), 5 drabina, 6 brama.

type Terrain = "plains" | "forest" | "hills" | "swamp" | "river" | "coast" | "ruins" | "arena" | "siege" | "village" | "bridge" | "ravine" | "streets";
const TERRAIN_NAME: Record<Terrain, string> = { plains: "Równina", forest: "Gęsty las", hills: "Wzgórza", swamp: "Bagno", river: "Przeprawa przez rzekę", coast: "Wybrzeże", ruins: "Ruiny", arena: "Arena", siege: "Oblężenie", village: "Wioska", bridge: "Most", ravine: "Wąwóz", streets: "Uliczki miasta" };
const CELL = 8;

interface Area { x: number; y: number; r: number; }
interface Obstacle { x: number; y: number; r: number; img: HTMLCanvasElement; tall?: boolean; cover?: boolean; }
interface Barrier { x0: number; x1: number; crossings: { y: number; h: number; gate?: boolean }[]; }
interface Light { x: number; y: number; r: number; flicker: number; }

interface BattleMap {
  w: number; h: number;
  grid: Uint8Array; gw: number; gh: number;
  ground: HTMLCanvasElement;
  obstacles: Obstacle[];
  hills: Area[];
  forests: Area[];
  barrier: Barrier | null;
  lights: Light[];
  wall: { x0: number; x1: number; gateY: number; gateHp: number; gateMax: number; ladders: number[]; broken: boolean } | null;
  arenaR?: number;
}

interface MapOpts { season: number; region: string; rain: boolean; fort?: boolean; }
function makeBattleMap(t: Terrain, night: boolean, opt: MapOpts = { season: 1, region: "grass", rain: false }): BattleMap {
  const w = t === "arena" ? 640 : 1600, h = t === "arena" ? 400 : 1000;
  const gw = Math.ceil(w / CELL), gh = Math.ceil(h / CELL);
  const M: BattleMap = { w, h, grid: new Uint8Array(gw * gh), gw, gh, ground: null, obstacles: [], hills: [], forests: [], barrier: null, lights: [], wall: null };
  const setCell = (x: number, y: number, v: number) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); if (cx >= 0 && cy >= 0 && cx < gw && cy < gh) M.grid[cy * gw + cx] = v; };
  const cellAt = (x: number, y: number) => { const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL); return cx < 0 || cy < 0 || cx >= gw || cy >= gh ? 2 : M.grid[cy * gw + cx]; };

  // ---- układ terenu ----
  if (t === "hills") M.hills = [{ x: 560, y: 330, r: 150 }, { x: 1060, y: 680, r: 160 }, { x: 820, y: 220, r: 110 }, { x: 300, y: 760, r: 110 }];
  else if (t !== "arena" && t !== "siege" && t !== "ravine") M.hills = [{ x: rr(500, 1100), y: chance(0.5) ? 260 : 760, r: rr(90, 130) }];
  if (t === "forest") M.forests = [{ x: 800, y: 500, r: 300 }, { x: 330, y: 230, r: 220 }, { x: 1270, y: 780, r: 230 }, { x: 1250, y: 220, r: 170 }, { x: 330, y: 800, r: 170 }];
  else if (t === "plains" || t === "hills" || t === "ruins" || t === "village") M.forests = [{ x: rr(600, 1000), y: chance(0.5) ? 860 : 150, r: rr(90, 130) }];
  else if (t === "swamp") M.forests = [{ x: 800, y: 180, r: 140 }];
  const clearings: Area[] = t === "forest" ? [{ x: 800, y: 500, r: 90 }, { x: rr(450, 650), y: rr(300, 700), r: 60 }, { x: rr(950, 1150), y: rr(300, 700), r: 60 }] : [];

  // woda
  const riverX = (y: number) => 800 + Math.sin(y / 140) * 40;
  if (t === "river" || t === "bridge") {
    const fords = t === "bridge" ? [] : [rr(160, 330), rr(680, 860)], bridge = rr(420, 580);
    for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) {
      if (Math.abs(x - riverX(y)) < 30) {
        const ford = fords.some((f) => Math.abs(y - f) < 30), br = Math.abs(y - bridge) < 18;
        setCell(x, y, br ? 0 : ford ? 1 : 2);
      }
    }
    M.barrier = { x0: 770, x1: 830, crossings: [...fords.map((f) => ({ y: f, h: 26 })), { y: bridge, h: t === "bridge" ? 12 : 14 }] };
  }
  // wąwóz: strome zbocza z góry i z dołu, przejście środkiem
  if (t === "ravine") for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) { const top = 250 + Math.sin(x / 170) * 50 + vnoise(x, 0, 60) * 40, bot = 750 + Math.sin(x / 150 + 2) * 50 - vnoise(x, 9, 60) * 40; if (y < top || y > bot) setCell(x, y, 2); }
  if (t === "coast") for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) { const sea = 150 + Math.sin(x / 90) * 20; if (y < sea) setCell(x, y, 2); else if (y < sea + 20) setCell(x, y, 1); }
  if (t === "swamp") for (let i = 0; i < 26; i++) {
    const px = rr(200, 1400), py = rr(100, 900), r = rr(20, 55);
    for (let y = py - r; y < py + r; y += CELL) for (let x = px - r; x < px + r; x += CELL) if (dist(x, y, px, py) < r * (0.8 + vnoise(x, y, 20) * 0.4)) setCell(x, y, 1);
  }
  // mury oblężenia: obrońcy po prawej
  if (t === "siege") {
    const x0 = 1040, x1 = 1064, gateY = 500;
    const ladders = [200, 360, 640, 800];
    M.wall = { x0, x1, gateY, gateHp: 700, gateMax: 700, ladders, broken: false };
    for (let y = 0; y < h; y += CELL) {
      const nearLadder = ladders.some((l) => Math.abs(y - l) < 8);
      const gate = Math.abs(y - gateY) < 20;
      setCell(x0, y, gate ? 6 : nearLadder ? 5 : 2);           // zewnętrzne lico muru
      for (let x = x0 + CELL; x <= x1; x += CELL) setCell(x, y, gate ? 6 : 0);   // korona muru
    }
    M.barrier = { x0, x1: x1 + CELL, crossings: [...ladders.map((l) => ({ y: l, h: 6 })), { y: gateY, h: 16, gate: true }] };
  }
  if (t === "arena") {
    M.arenaR = 170;
    for (let y = 0; y < h; y += CELL) for (let x = 0; x < w; x += CELL) if (Math.hypot((x - w / 2) / 1.45, y - h / 2) > M.arenaR) setCell(x, y, 2);
  }

  // ---- malowanie gruntu ----
  const [g, gc] = mkCanvas(w, h);
  const im = gc.createImageData(w, h);
  const rgb = (c: string) => [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
  const grass = [PAL.grassD, PAL.grass, PAL.grassL, PAL.moss].map(rgb);
  const dirt = [PAL.dirtD, PAL.dirt, PAL.dirtL].map(rgb);
  const stone = [PAL.slate, PAL.stone, PAL.ash].map(rgb);
  const water = [PAL.water, PAL.waterL, PAL.ink].map(rgb);
  const sand = [PAL.dirtL, PAL.bone, PAL.dirt].map(rgb);
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const grassSet = new Set(grass), dirtSet = new Set(dirt);
  const winter = opt.season === 3;
  const snow = ["#aca798", "#918d81", "#77746a"].map(rgb), slush = rgb("#5e584b"), ice = rgb("#6f7c7d");
  const autumn = ["#5a4626", "#4a3a1f"].map(rgb), steppe = ["#5d5532", "#4b4529"].map(rgb), ashC = ["#5b5651", "#45413c"].map(rgb);
  const off = rnd() * 1000;
  const roadAt = (x: number) => h / 2 + Math.sin((x + off) / 200) * 70 + Math.sin(x / 61) * 8;
  const heightAt = (x: number, y: number) => { let hh = 0; for (const hl of M.hills) { const d = dist(x, y, hl.x, hl.y) / hl.r; if (d < 1) hh = Math.max(hh, (1 - d * d) * (1 - d * d)); } return hh; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const n = vnoise(x + off, y, 80) * 0.62 + vnoise(x, y + off, 22) * 0.38;
    const th = (bayer[(y & 3) * 4 + (x & 3)] + 0.5) / 16;
    const cell = cellAt(x, y);
    let col: number[];
    if (t === "arena") {
      const r = Math.hypot((x - w / 2) / 1.45, y - h / 2);
      if (r > M.arenaR + 14) col = stone[clamp(Math.floor(n * 2 + th - 0.5), 0, 1)];
      else if (r > M.arenaR) col = (Math.floor(x / 6) + Math.floor(y / 4)) % 2 ? stone[1] : stone[0];
      else col = sand[clamp(Math.floor(n * 1.6 + (th - 0.5) * 0.8), 0, 2) === 1 ? 0 : 2];
    } else if (cell === 2 && t === "ravine") { const edge = cellAt(x, y - 10) !== 2 || cellAt(x, y + 10) !== 2; col = edge ? stone[th > 0.5 ? 0 : 1] : stone[clamp(Math.floor(n * 2.5 + th - 0.6), 0, 2)]; if (edge && th < 0.3) col = [10, 9, 8]; }
    else if (cell === 2 && t !== "siege") col = water[(n + th * 0.3) > 0.62 ? 1 : 0];
    else if (cell === 1 && (t === "swamp" || t === "river" || t === "coast")) col = (n + th * 0.5) > 0.7 ? water[1] : (n > 0.45 ? water[0] : dirt[0]);
    else {
      const hgt = heightAt(x, y);
      const sl = hgt > 0 ? (heightAt(x - 3, y - 3) - heightAt(x + 3, y + 3)) * 6 : 0;
      const forest = M.forests.some((f) => dist(x, y, f.x, f.y) < f.r + vnoise(x, y, 20) * 20);
      const rd = t === "siege" || t === "river" || t === "bridge" ? 999 : Math.abs(y - roadAt(x)) - 14 - vnoise(x, y, 14) * 9;
      if (t === "siege" && x > 1064) col = (Math.floor(x / 5) + Math.floor(y / 4) * 3) % 4 === 0 ? stone[0] : (n > 0.5 ? stone[1] : dirt[1]);
      else if (rd < 0) { col = dirt[clamp(Math.floor(n * 2.2 + (th - 0.5) * 0.9), 0, 2)]; if (Math.abs(Math.abs(y - roadAt(x)) - 6) < 1.2 && hashN(x >> 2, 7) > 0.2) col = dirt[0]; }
      else if (rd < 3) col = th < 0.5 ? dirt[0] : grass[0];
      else {
        const lv = n * 2.4 + (th - 0.5) * 0.8 + sl * 1.2 + hgt * 0.4 - (forest ? 1 : 0) - (t === "swamp" ? 0.6 : 0);
        col = grass[clamp(Math.floor(lv), 0, 2)];
        // błotniste, wydeptane łaty: brudniej
        if (vnoise(x + 500, y, 34) > 0.68 && th > 0.35) col = dirt[n > 0.55 ? 1 : 0];
        if (vnoise(x + 300, y, 40) > 0.8 && th > 0.75) col = grass[3];
        if (hgt > 0.05 && Math.abs(((hgt * 5) % 1) - 0.5) < 0.04 && th < 0.5) col = grass[0];
        if (t === "coast" && y < 200 + Math.sin(x / 90) * 20) col = sand[th > 0.5 ? 0 : 2];
      }
    }
    // pora roku i kraina: zimą śnieg z błotem, jesienią rdzawa trawa, w stepie wypalona, w krainie popiołu szara
    if (t !== "arena" && !(t === "siege" && x > 1040)) {
      const isGrass = grassSet.has(col), isDirt = dirtSet.has(col);
      if (winter) {
        const sn = vnoise(x + 77, y, 26) * 0.7 + th * 0.3;
        if (isGrass && sn > 0.33) col = snow[sn > 0.66 ? 0 : sn > 0.46 ? 1 : 2];
        else if (isDirt && sn > 0.55) col = slush;
        else if (cell === 2 && t !== "ravine" && sn > 0.5) col = ice;
      } else if (opt.season === 2 && isGrass && vnoise(x, y + 300, 30) + th * 0.3 > 0.72) col = autumn[th > 0.5 ? 0 : 1];
      else if (opt.region === "steppe" && isGrass && vnoise(x + 40, y, 36) + th * 0.25 > 0.62) col = steppe[th > 0.5 ? 0 : 1];
      if (opt.region === "ash" && (isGrass || isDirt) && vnoise(x + 900, y, 28) + th * 0.3 > 0.55) col = ashC[th > 0.6 ? 0 : 1];
    }
    const k = (y * w + x) * 4;
    im.data[k] = col[0]; im.data[k + 1] = col[1]; im.data[k + 2] = col[2]; im.data[k + 3] = 255;
  }
  gc.putImageData(im, 0, 0);
  if (t !== "arena") {
    for (let i = 0; i < w * h / 1000; i++) { const x = rr(0, w) | 0, y = rr(0, h) | 0; if (cellAt(x, y) === 0 && !(t === "siege" && x > 1040) && (!winter || chance(0.15))) gc.drawImage(pick(TUFTS), x, y); }
    for (let i = 0; i < w * h / 4000; i++) { gc.fillStyle = chance(0.5) ? PAL.stone : PAL.slate; const x = rr(0, w) | 0, y = rr(0, h) | 0; gc.fillRect(x, y, 2, 1); }
    for (const f of M.forests) for (let i = 0; i < f.r * 5; i++) { const a = rr(0, 6.28), r = Math.sqrt(rnd()) * f.r; gc.fillStyle = pick([PAL.woodD, PAL.dirtD, PAL.grassD]); gc.fillRect((f.x + Math.cos(a) * r) | 0, (f.y + Math.sin(a) * r) | 0, 1, 1); }
  }
  // bogatsza faktura: kamienie, gruz, korzenie, kałuże, liście
  if (t !== "arena") {
    const free = (x: number, y: number) => cellAt(x, y) === 0 && !(t === "siege" && x > 1040);
    for (let i = 0; i < w * h / 5000; i++) {   // kamienie z blaskiem i cieniem
      const x = rr(0, w) | 0, y = rr(0, h) | 0; if (!free(x, y)) continue;
      const big = chance(0.3);
      gc.fillStyle = PAL.ink; gc.fillRect(x, y + 1, big ? 4 : 3, 1);
      gc.fillStyle = PAL.stone; gc.fillRect(x, y - (big ? 1 : 0), big ? 4 : 3, big ? 2 : 1);
      gc.fillStyle = winter ? "#c4bfb1" : PAL.ash; gc.fillRect(x, y - (big ? 1 : 0), 1, 1);
    }
    if (t === "ruins" || t === "village" || t === "siege") for (let i = 0; i < w * h / 2500; i++) {   // gruz i odłamki cegieł
      const x = rr(0, w) | 0, y = rr(0, h) | 0; if (!free(x, y)) continue;
      gc.fillStyle = pick([PAL.stone, PAL.slate, PAL.dirtL, PAL.rust]); gc.fillRect(x, y, chance(0.5) ? 2 : 1, 1);
    }
    for (const f of M.forests) for (let i = 0; i < f.r / 6; i++) {   // korzenie wychodzące spod drzew
      const a = rr(0, 6.28), r0 = f.r * rr(0.8, 1.05);
      let x = f.x + Math.cos(a) * r0, y = f.y + Math.sin(a) * r0;
      gc.fillStyle = PAL.woodD;
      for (let k = 0; k < 10; k++) { if (free(x, y)) gc.fillRect(x | 0, y | 0, 1, 1); x += Math.cos(a) * 1.4 + rr(-0.8, 0.8); y += Math.sin(a) * 0.9 + rr(-0.6, 0.6); }
    }
    const puddles = (opt.rain ? 34 : opt.season === 2 ? 22 : winter ? 6 : 10) * (t === "swamp" ? 2 : 1);
    for (let i = 0; i < puddles; i++) {   // kałuże z odbiciem nieba
      const px = rr(40, w - 40), py = rr(40, h - 40); if (!free(px, py)) continue;
      const rx = rr(4, 11), ry = rx * 0.45;
      for (let y = -ry - 1; y <= ry + 1; y++) for (let x = -rx - 1; x <= rx + 1; x++) {
        const d = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        if (d > 1.3) continue;
        gc.fillStyle = d > 1 ? PAL.dirtD : winter ? (d < 0.3 ? "#8f9a9b" : "#6f7c7d") : y < -ry * 0.3 && d < 0.5 ? PAL.waterL : PAL.water;
        gc.fillRect((px + x) | 0, (py + y) | 0, 1, 1);
      }
    }
    if (opt.season === 2 || (t === "forest" && !winter)) for (let i = 0; i < w * h / (opt.season === 2 ? 700 : 3000); i++) {   // opadłe liście
      const x = rr(0, w) | 0, y = rr(0, h) | 0; if (!free(x, y)) continue;
      gc.fillStyle = pick([PAL.rust, PAL.goldD, PAL.redL, PAL.dirtL]); gc.fillRect(x, y, 1, 1);
    }
    if (winter) for (let i = 0; i < w * h / 900; i++) { const x = rr(0, w) | 0, y = rr(0, h) | 0; if (free(x, y)) { gc.fillStyle = "#d6d0c2"; gc.fillRect(x, y, 1, 1); } }
  }
  // most
  if ((t === "river" || t === "bridge") && M.barrier) {
    const by = M.barrier.crossings[M.barrier.crossings.length - 1].y;
    for (let x = 750; x < 850; x++) for (let y = by - 14; y < by + 14; y++) { gc.fillStyle = (x % 6 === 0) ? PAL.woodD : (y === by - 14 || y === by + 13) ? PAL.woodD : PAL.wood; gc.fillRect(x, y, 1, 1); }
  }
  // mury
  if (M.wall) drawWalls(gc, M);
  M.ground = g;

  // ---- przeszkody i rekwizyty ----
  const tryPlace = (x: number, y: number, r: number, img: HTMLCanvasElement, gap: number, tall = true) => {
    if (cellAt(x, y) !== 0) return false;
    if (M.obstacles.some((o) => o.r && dist(o.x, o.y, x, y) < o.r + r + gap)) return false;
    M.obstacles.push({ x, y, r, img, tall }); return true;
  };
  if (t !== "arena") {
    for (const f of M.forests) for (let i = 0; i < f.r * (t === "forest" ? 0.9 : 0.5); i++) { const a = rr(0, 6.28), r = Math.sqrt(rnd()) * f.r; if (clearings.some((c) => dist(c.x, c.y, f.x + Math.cos(a) * r, f.y + Math.sin(a) * r) < c.r)) continue; tryPlace(f.x + Math.cos(a) * r, f.y + Math.sin(a) * r, 6, t === "swamp" ? pick(DEADTREES) : pick([TREES[0], TREES[1], TREES[2], TREES[2], DEADTREES[0]]), 10); }
    const centerFree = (x: number, y: number) => y > 300 && y < 700 && x > 250 && x < 1350;
    for (let i = 0; i < (t === "streets" ? 0 : 90); i++) {
      const x = rr(20, w - 20), y = rr(20, h - 15);
      if (centerFree(x, y) && !chance(0.08)) continue;
      if (t === "siege" && x > 900) continue;
      tryPlace(x, y, 6, chance(0.75) ? (t === "swamp" || chance(0.3) ? pick(DEADTREES) : pick(TREES)) : pick(ROCKS), 18);
    }
    if (t === "ruins") {
      for (let i = 0; i < 18; i++) tryPlace(rr(300, 1300), rr(150, 850), 7, pick(ROCKS), 12);
      // murki: osłona przed strzałami
      for (let i = 0; i < 26; i++) { const x = rr(420, 1180), y = rr(200, 800); if (tryPlace(x, y, 9, lowWall(i), 6)) M.obstacles[M.obstacles.length - 1].cover = true; }
    }
    if (t === "streets") {   // uliczki: kwartały domów z wąskimi przejściami, barykady z wozów, kilka pożarów
      let k = 0; const burn: V[] = [];
      for (let bx = 520; bx <= 1300; bx += 66) for (let by = 120; by <= 900; by += 56) {
        if (Math.abs(by - roadAt(bx)) < 34 || (bx - 520) % 198 === 132) continue;   // główna ulica i przecznice
        if (tryPlace(bx + rr(-4, 4), by + rr(-3, 3), 13, chance(0.15) ? burntHouse() : PROPS.house, 1)) { const o = M.obstacles[M.obstacles.length - 1]; if (o.img !== PROPS.house) burn.push({ x: o.x, y: o.y - 18 }); }
      }
      for (let i = 0; i < 10; i++) { const x = rr(620, 1200), y = chance(0.5) ? rr(470, 530) : rr(150, 850); if (tryPlace(x, y, 8, fence(k++), 4)) M.obstacles[M.obstacles.length - 1].cover = true; }
      (M as any).burning = burn;
    }
    if (t === "village") {
      for (let i = 0; i < 16; i++) tryPlace(rr(560, 1040) + (i % 2 ? 0 : rr(-40, 40)), rr(260, 740), 13, PROPS.house, 20);
      // kilka chat płonie: dym i zgliszcza
      const burnt = M.obstacles.filter((o) => o.img === PROPS.house).slice(0, 3 + Math.floor(rnd() * 3));
      for (const o of burnt) o.img = burntHouse();
      (M as any).burning = burnt.map((o) => ({ x: o.x, y: o.y - 18 }));
      for (let i = 0; i < 14; i++) { const x = rr(520, 1080), y = rr(240, 760); if (tryPlace(x, y, 8, fence(i), 4)) M.obstacles[M.obstacles.length - 1].cover = true; }
    }
    if (t === "ravine") for (let i = 0; i < 40; i++) { const x = rr(40, w - 40), y = chance(0.5) ? rr(240, 330) : rr(670, 760); tryPlace(x, y, 8, pick(ROCKS), 10); }
    if (t === "ruins" || t === "swamp" || chance(0.4)) for (let i = 0; i < 10; i++) tryPlace(rr(200, 1400), rr(100, 900), 0, PROPS.grave, 4, false);
    // makabra przy drodze: pale z czaszkami, szubienica
    for (let i = 0; i < 5; i++) { const x = rr(150, 1450); tryPlace(x, roadAt(x) + (chance(0.5) ? -26 : 26), 0, PROPS.pike, 6, false); }
    if (chance(0.6)) { const x = rr(200, 1400); tryPlace(x, roadAt(x) - 40, 5, PROPS.gallows, 10); }
    for (let i = 0; i < 70; i++) { const x = rr(0, w), y = rr(0, h); if (cellAt(x, y) === 0) M.obstacles.push({ x, y, r: 0, img: BUSH, tall: false }); }
  }
  if (opt.fort && t !== "siege" && t !== "arena") {   // obóz z palisadą: płot wokół twoich pozycji, przejścia w środku i na skrzydłach
    let k = 0;
    for (let y = 300; y <= 700; y += 21) { if (Math.abs(y - 500) < 24 || Math.abs(y - 360) < 12 || Math.abs(y - 640) < 12) continue; M.obstacles = M.obstacles.filter((o) => dist(o.x, o.y, 480, y) > 14); M.obstacles.push({ x: 480, y, r: 8, img: fence(k++), tall: false, cover: true }); }
    for (let x = 300; x < 480; x += 21) for (const y of [300, 700]) { M.obstacles = M.obstacles.filter((o) => dist(o.x, o.y, x, y) > 14); M.obstacles.push({ x, y, r: 8, img: fence(k++), tall: false, cover: true }); }
    M.obstacles.push({ x: 330, y: 450, r: 0, img: PROPS.fire, tall: false });
  }
  if (t === "siege") {
    for (let i = 0; i < 6; i++) tryPlace(rr(1180, 1540), rr(80, 920), 10, PROPS.house || ROCKS[0], 30);
    (M as any).burning = [{ x: rr(1200, 1500), y: rr(150, 400) }, { x: rr(1200, 1500), y: rr(600, 850) }];   // pożary w mieście za murem
  }
  // światła w nocy: ogniska w obozach i pochodnie
  if (night) {
    for (let i = 0; i < 6; i++) { const x = rr(100, w - 100), y = rr(100, h - 100); if (cellAt(x, y) !== 0) continue; M.obstacles.push({ x, y, r: 0, img: PROPS.fire, tall: false }); M.lights.push({ x, y: y - 3, r: 70, flicker: rnd() * 6 }); }
    if (M.wall) for (let y = 100; y < h; y += 160) M.lights.push({ x: M.wall.x0 + 12, y, r: 60, flicker: rnd() * 6 });
  }
  return M;
}

let BURNT: HTMLCanvasElement | null = null;
function burntHouse() {
  if (BURNT) return BURNT;
  const src = PROPS.house, [c, g] = mkCanvas(src.width, src.height);
  g.drawImage(src, 0, 0);
  g.globalCompositeOperation = "source-atop"; g.fillStyle = "rgba(20,16,12,0.6)"; g.fillRect(0, 0, c.width, c.height);
  g.globalCompositeOperation = "destination-out"; g.fillRect(8, 2, 5, 4); g.fillRect(15, 5, 4, 3);   // dziury w dachu
  g.globalCompositeOperation = "source-over"; g.fillStyle = PAL.redL; g.fillRect(9, 7, 1, 1); g.fillRect(16, 9, 1, 1); g.fillStyle = PAL.gold; g.fillRect(10, 8, 1, 1);
  BURNT = c; return c;
}
// Niski murek z kamieni (ruiny) i płot (wioska): osłaniają przed strzałami.
const LOWWALL: HTMLCanvasElement[] = [];
function lowWall(i: number) {
  if (!LOWWALL[i % 4]) { const P = new Pix(22, 10); for (let y = 2; y < 10; y++) for (let x = 0; x < 22; x++) if (y > 2 + ((x * 7 + i) % 3) && !(y < 5 && (x + i) % 9 === 0)) P.p(x, y, ((x >> 2) + y) % 3 === 0 ? PAL.slate : (x + y) % 5 === 0 ? PAL.ash : PAL.stone); P.r(0, 9, 22, 1, PAL.slate); LOWWALL[i % 4] = P.toCanvas(); }
  return LOWWALL[i % 4];
}
const FENCES: HTMLCanvasElement[] = [];
function fence(i: number) {
  if (!FENCES[i % 3]) { const P = new Pix(20, 10); for (let x = 0; x < 20; x += 4) P.r(x, 1 + (x % 8 === 0 ? 0 : 1), 1, 9, PAL.woodD); P.r(0, 3, 20, 1, PAL.wood); P.r(0, 6, 20, 1, PAL.wood); FENCES[i % 3] = P.toCanvas(); }
  return FENCES[i % 3];
}

function drawWalls(gc: CanvasRenderingContext2D, M: BattleMap) {
  const W2 = M.wall;
  for (let y = 0; y < M.h; y++) for (let x = W2.x0; x <= W2.x1 + 4; x++) {
    const gate = Math.abs(y - W2.gateY) < 20;
    if (gate && x < W2.x1) continue;
    const brick = ((Math.floor(y / 5) % 2 ? x + 3 : x) % 8 === 0) || y % 5 === 0;
    gc.fillStyle = x <= W2.x0 + 2 ? PAL.ash : x >= W2.x1 ? PAL.slate : brick ? PAL.slate : PAL.stone;
    gc.fillRect(x, y, 1, 1);
  }
  // blanki
  for (let y = 0; y < M.h; y += 10) { gc.fillStyle = PAL.ash; gc.fillRect(W2.x0 - 3, y, 4, 6); gc.fillStyle = PAL.slate; gc.fillRect(W2.x0 - 3, y + 6, 4, 1); }
  // wieże
  for (const ty of [80, 300, 700, 920]) { gc.fillStyle = PAL.slate; gc.fillRect(W2.x0 - 8, ty - 22, W2.x1 - W2.x0 + 16, 44); gc.fillStyle = PAL.stone; gc.fillRect(W2.x0 - 6, ty - 20, W2.x1 - W2.x0 + 12, 40); gc.fillStyle = PAL.ash; gc.fillRect(W2.x0 - 6, ty - 20, 2, 40); }
}

// Brama i drabiny rysowane co klatkę (zmieniają stan).
function drawSiegeDynamic(g: CanvasRenderingContext2D, M: BattleMap, sx: number, sy: number) {
  const W2 = M.wall;
  if (!W2) return;
  const gx = W2.x0 - sx, gy = W2.gateY - sy;
  if (!W2.broken) {
    g.fillStyle = PAL.woodD; g.fillRect(gx, gy - 20, 12, 40);
    g.fillStyle = PAL.wood; for (let y = -18; y < 20; y += 4) g.fillRect(gx + 1, gy + y, 10, 2);
    g.fillStyle = PAL.steelD; g.fillRect(gx, gy - 12, 12, 2); g.fillRect(gx, gy + 10, 12, 2);
    const k = 1 - W2.gateHp / W2.gateMax;
    g.fillStyle = PAL.black; for (let i = 0; i < k * 12; i++) g.fillRect(gx + ((i * 5) % 10), gy - 16 + ((i * 11) % 32), 2, 1);
  } else {
    g.fillStyle = PAL.woodD; g.fillRect(gx - 4, gy + 8, 10, 3); g.fillRect(gx + 4, gy - 14, 3, 9); g.fillRect(gx - 8, gy - 4, 8, 2);
  }
  const pl = (W2 as any).placed as boolean[] | undefined;
  for (const br of ((W2 as any).breaches || []) as number[]) {   // wyrwy w murze
    const by = br - sy, bx = W2.x0 - sx;
    g.fillStyle = PAL.black; g.fillRect(bx - 2, by - 10, W2.x1 - W2.x0 + 4, 20);
    g.fillStyle = PAL.stone; for (let i = 0; i < 14; i++) g.fillRect(bx - 6 + ((i * 7) % 26), by - 9 + ((i * 5) % 18), 3, 2);
    g.fillStyle = PAL.ash; for (let i = 0; i < 8; i++) g.fillRect(bx - 8 + ((i * 11) % 30), by - 6 + ((i * 3) % 14), 2, 2);
  }
  for (let li = 0; li < W2.ladders.length; li++) {
    if (pl && !pl[li]) continue;
    const ly = W2.ladders[li];
    const lx = W2.x0 - sx - 10, y0 = ly - sy;
    g.fillStyle = PAL.wood; g.fillRect(lx, y0 - 5, 14, 1); g.fillRect(lx, y0 + 5, 14, 1);
    g.fillStyle = PAL.woodD; for (let x = 1; x < 14; x += 3) g.fillRect(lx + x, y0 - 5, 1, 11);
  }
}

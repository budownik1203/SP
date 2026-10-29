// Rysowanie bitwy: grunt, trupy, jednostki z ekwipunkiem, konie, pociski, cząsteczki, światło nocne, deszcz, mgła i popiół.

function renderBattle(b: Battle, g: CanvasRenderingContext2D) {
  const sx = Math.round(b.cam.x + b.shakeX + rr(-1, 1) * b.rumble * 0.5), sy = Math.round(b.cam.y + b.shakeY + rr(-1, 1) * b.rumble * 0.5);
  g.fillStyle = PAL.black; g.fillRect(0, 0, W, H);
  const M = b.map;
  const gx = clamp(sx, 0, Math.max(0, b.mw - W)), gy = clamp(sy, 0, Math.max(0, b.mh - H));
  const cw = Math.min(W, b.mw), ch = Math.min(H, b.mh);
  g.drawImage(M.ground, gx, gy, cw, ch, gx - sx, gy - sy, cw, ch);
  g.drawImage(b.decals, gx, gy, cw, ch, gx - sx, gy - sy, cw, ch);
  if (M.wall) drawSiegeDynamic(g, M, sx, sy);
  const vis = (x: number, y: number, m = 40) => x > sx - m && x < sx + W + m && y > sy - m && y < sy + H + m;

  for (const c of b.corpses) if (vis(c.x, c.y)) drawCorpse(g, c, sx, sy);

  // znaczniki rozkazów i podgląd szyków
  if (b.phase !== "end" && b.heroUp) for (const k of Object.keys(b.orders)) {
    const sq = Number(k), o = b.orders[sq];
    if (o.mode !== "hold" || !b.squadUnits(sq).length) continue;
    const fx = Math.round(o.ax - sx), fy = Math.round(o.ay - sy);
    g.globalAlpha = b.selected.includes(sq) || b.cmdOpen ? 0.9 : 0.3;
    g.fillStyle = PAL.ink; g.fillRect(fx - 1, fy - 12, 3, 13);
    g.fillStyle = PAL.wood; g.fillRect(fx, fy - 11, 1, 11);
    g.fillStyle = SQUAD_COLORS[sq]; g.fillRect(fx + 1, fy - 11, 6, 4);
    g.fillStyle = PAL.ink; g.fillRect(fx + 3, fy - 10, 1, 2);
    g.globalAlpha = 1;
  }
  const drawSlots = (slots: Slot[], col: string, alpha: number) => {
    g.globalAlpha = alpha;
    for (const s of slots) {
      const x = Math.round(s.x - sx), y = Math.round(s.y - sy);
      g.fillStyle = PAL.ink; g.fillRect(x - 2, y - 1, 5, 3);
      g.fillStyle = col; g.fillRect(x - 1, y, 3, 1);
      g.fillRect(Math.round(x + Math.cos(s.face) * 3), Math.round(y + Math.sin(s.face) * 3), 1, 1);
    }
    g.globalAlpha = 1;
  };
  for (const p of b.preview) drawSlots(p.slots, p.col, clamp(p.t, 0, 1));
  if (b.drag) {
    pxLine(g, b.drag.sx - sx, b.drag.sy - sy, b.drag.ex - sx, b.drag.ey - sy, PAL.gold);
    for (const p of b.dragPlan(b.drag)) drawSlots(p.slots, SQUAD_COLORS[p.g], 0.95);
  }
  // celownik słupa światła
  for (const f of b.fx) if (f.kind === "beam" && f.t < f.max) {
    const r = 46 * (0.4 + (f.t / f.max) * 0.6);
    g.fillStyle = PAL.gold; g.globalAlpha = 0.7;
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2 + b.real; g.fillRect(Math.round(f.x - sx + Math.cos(a) * r), Math.round(f.y - sy + Math.sin(a) * r * 0.6), 1, 1); }
    g.globalAlpha = 1;
  }

  // sortowanie po głębokości: jednostki, drzewa, rekwizyty
  type D = { y: number; draw: () => void };
  const list: D[] = [];
  for (const o of M.obstacles) if (vis(o.x, o.y, 60)) list.push({ y: o.y - (o.tall === false ? 20 : 0), draw: () => {
    // drzewa zasłaniające bohatera robią się półprzezroczyste
    const h = b.hero;
    const fade = o.tall !== false && h && h.alive && h.y < o.y && h.y > o.y - o.img.height && Math.abs(h.x - o.x) < o.img.width / 2;
    if (fade) g.globalAlpha = 0.45;
    g.drawImage(o.img, Math.round(o.x - sx - o.img.width / 2), Math.round(o.y - sy - o.img.height + 3));
    g.globalAlpha = 1;
  } });
  for (const u of b.units) if (u.alive && vis(u.x, u.y) && !(u.hidden && u.team === 1)) list.push({ y: u.y, draw: () => drawUnit(b, g, u, sx, sy) });
  list.sort((a, c) => a.y - c.y);
  for (const d of list) d.draw();

  // pociski
  for (const ar of b.arrows) {
    if (!vis(ar.x, ar.y)) continue;
    const p = clamp(ar.travel / ar.dist, 0, 1);
    if (ar.kind === "fire") {
      const x = Math.round(ar.x - sx), y = Math.round(ar.y - sy);
      g.fillStyle = PAL.bloodL; g.fillRect(x - 2, y - 2, 5, 5);
      g.fillStyle = PAL.gold; g.fillRect(x - 1, y - 1, 3, 3);
      g.fillStyle = PAL.white; g.fillRect(x, y, 1, 1);
      continue;
    }
    const lift = ar.kind === "bolt" ? Math.sin(p * Math.PI) * Math.min(10, ar.dist * 0.05) : Math.sin(p * Math.PI) * Math.min(26, ar.dist * 0.12);
    const a = Math.atan2(ar.vy - Math.cos(p * Math.PI) * 40, ar.vx);
    const x = ar.x - sx, y = ar.y - sy - lift;
    g.fillStyle = "rgba(10,9,8,0.35)"; g.fillRect(Math.round(ar.x - sx), Math.round(ar.y - sy + 9), 2, 1);
    if (ar.kind === "axe") {
      const r = b.real * 20;
      g.fillStyle = PAL.wood; g.fillRect(Math.round(x + Math.cos(r) * 2), Math.round(y + Math.sin(r) * 2), 1, 1); g.fillRect(Math.round(x), Math.round(y), 1, 1);
      g.fillStyle = PAL.steelL; g.fillRect(Math.round(x - Math.cos(r) * 2), Math.round(y - Math.sin(r) * 2), 2, 2);
      continue;
    }
    const len = ar.kind === "bolt" ? 4 : 6;
    pxLine(g, x, y, x - Math.cos(a) * len, y - Math.sin(a) * len, PAL.wood);
    g.fillStyle = PAL.steelL; g.fillRect(Math.round(x), Math.round(y), 1, 1);
    g.fillStyle = PAL.white; g.fillRect(Math.round(x - Math.cos(a) * len), Math.round(y - Math.sin(a) * len), 1, 1);
  }
  // cząsteczki
  for (const p of b.parts) {
    if (!vis(p.x, p.y, 60)) continue;
    const px = Math.round(p.x - sx), py = Math.round(p.y - sy - p.z);
    if (p.kind === "flash") { g.fillStyle = PAL.white; g.fillRect(px - 3, py, 7, 1); g.fillRect(px, py - 3, 1, 7); g.fillRect(px - 1, py - 1, 3, 3); continue; }
    if (p.kind === "ring") {
      const k = 1 - p.life / p.max, r = Math.round((2 + k * 6) * p.vx);
      g.globalAlpha = 1 - k; g.fillStyle = p.col;
      const n = Math.max(12, r);
      for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; g.fillRect(Math.round(px + Math.cos(a) * r), Math.round(py + Math.sin(a) * r * 0.7), 1, 1); }
      g.globalAlpha = 1; continue;
    }
    if (p.kind === "beam") {
      const k = p.life / p.max;
      g.globalAlpha = k; g.fillStyle = PAL.boneHi; g.fillRect(px - 6, 0, 13, py); g.fillStyle = PAL.white; g.fillRect(px - 3, 0, 7, py);
      g.globalAlpha = 1; continue;
    }
    if ((p.kind === "head" || p.kind === "limb")) {
      g.fillStyle = "rgba(10,9,8,0.4)"; g.fillRect(Math.round(p.x - sx) - 2, Math.round(p.y - sy), 5, 1);
      if (p.kind === "head" && p.img) { g.save(); g.translate(px, py - 3); g.rotate(p.rot); g.drawImage(p.img, -5, -5); g.restore(); }
      else { g.save(); g.translate(px, py - 1); g.rotate(p.rot); g.fillStyle = p.col; g.fillRect(-3, -1, 6, 2); g.fillStyle = PAL.bloodL; g.fillRect(2, -1, 1, 2); g.restore(); }
      continue;
    }
    g.globalAlpha = p.kind === "dust" || p.kind === "soul" || p.kind === "fire" || p.kind === "holy" ? clamp((p.life / p.max) * 1.5, 0, 1) : 1;
    g.fillStyle = p.col;
    g.fillRect(px, py, p.kind === "fire" && p.life > p.max * 0.5 ? 2 : 1, p.kind === "blood" && p.vz < 0 ? 2 : 1);
  }
  g.globalAlpha = 1;

  drawTells(b, g, sx, sy);
  for (const f of b.floaters) { g.globalAlpha = clamp(f.t * 2, 0, 1); pxText(g, f.text, Math.round(f.x - sx - textW(f.text) / 2), Math.round(f.y - sy), f.col); }
  g.globalAlpha = 1;

  // mgła i popiół
  g.save();
  g.imageSmoothingEnabled = true;
  const fogK = b.cfg.night ? 0.7 : b.cfg.terrain === "swamp" ? 1.8 : 1;
  for (const [alpha, spd, par, scl] of [[0.12, 5, 0.6, 1.5], [0.07, 11, 0.9, 2.2]]) {
    g.globalAlpha = alpha * fogK;
    const fw = W * scl, fh = H * scl;
    const fo = (((b.real * spd + sx * par) % fw) + fw) % fw, foy = (((sy * par) % fh) + fh) % fh;
    for (const ox of [0, fw]) for (const oy of [0, fh]) g.drawImage(b.fog, ox - fo, oy - foy, fw, fh);
  }
  g.restore();
  if (!b.cfg.rain) for (const a of b.ash) {
    const ax = (((a.x - sx * a.p * 0.5 + b.real * a.s * 0.8) % W) + W) % W;
    const ay = (((a.y - sy * a.p * 0.5 + b.real * a.s) % H) + H) % H;
    g.globalAlpha = 0.3 + a.p * 0.4; g.fillStyle = a.c;
    g.fillRect(Math.round(ax + Math.sin(b.real + a.x) * 2), Math.round(ay), 1, a.p > 0.85 ? 2 : 1);
  }
  g.globalAlpha = 1;

  // tonowanie: brudna, chłodna noc lub szare popołudnie
  g.globalCompositeOperation = "multiply";
  g.fillStyle = b.cmdOpen ? "#9a9488" : b.cfg.rain ? "#c4c4bc" : "#e2dac8";
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  if (b.cfg.night) drawNight(b, g, sx, sy);
  if (b.cfg.rain) drawRain(b, g, sx, sy);
  if (b.vignette.width !== W) b.makeOverlays();
  g.drawImage(b.vignette, 0, 0);
  if (b.focusT > 0) { g.fillStyle = `rgba(70,60,40,${clamp(b.focusT, 0, 1) * 0.25})`; g.fillRect(0, 0, W, H); }
  if (b.hurtFlash > 0) { g.fillStyle = `rgba(94,23,22,${b.hurtFlash})`; g.fillRect(0, 0, W, H); }
  // poświata Rycerza Śmierci
  for (const c of b.commanders) if (c.active && c.def.undead && !c.decay && vis(c.x, c.y)) {
    g.globalCompositeOperation = "lighter";
    const gr = g.createRadialGradient(c.x - sx, c.y - sy - 12, 2, c.x - sx, c.y - sy - 12, 32);
    gr.addColorStop(0, "rgba(134,94,163,0.28)"); gr.addColorStop(1, "rgba(134,94,163,0)");
    g.fillStyle = gr; g.fillRect(c.x - sx - 34, c.y - sy - 46, 68, 68);
    g.globalCompositeOperation = "source-over";
  }
  if (b.cmdOpen) for (const u of b.units) {
    if (u.team !== 0 || u.hero || !u.active) continue;
    if (!b.selected.includes(u.squad) && !u.picked) continue;
    const x = Math.round(u.x - sx), y = Math.round(u.y - sy);
    g.fillStyle = u.picked ? PAL.white : SQUAD_COLORS[u.squad] || PAL.bone;
    g.fillRect(x - 3, y + 1, 7, 1); g.fillRect(x - 4, y, 1, 1); g.fillRect(x + 4, y, 1, 1);
  }
  if (b.box) {
    const x0 = Math.round(Math.min(b.box.sx, b.box.ex) - sx), y0 = Math.round(Math.min(b.box.sy, b.box.ey) - sy);
    const bw = Math.round(Math.abs(b.box.ex - b.box.sx)), bh = Math.round(Math.abs(b.box.ey - b.box.sy));
    g.fillStyle = "rgba(222,215,198,0.12)"; g.fillRect(x0, y0, bw, bh);
    g.fillStyle = PAL.white; g.fillRect(x0, y0, bw, 1); g.fillRect(x0, y0 + bh, bw, 1); g.fillRect(x0, y0, 1, bh); g.fillRect(x0 + bw, y0, 1, bh);
  }
  if (b.phase === "fight") drawCrosshair(b, g);
}

// Noc: ciemna warstwa z wyciętymi światłami (ogniska, pochodnie, ogień, magia).
function drawNight(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  if (!b.light || b.light.width !== W || b.light.height !== H) b.light = mkCanvas(W, H)[0];
  const L = b.light, lg = L.getContext("2d");
  lg.globalCompositeOperation = "source-over";
  lg.clearRect(0, 0, W, H);
  lg.fillStyle = "rgba(6,8,14,0.72)";
  lg.fillRect(0, 0, W, H);
  lg.globalCompositeOperation = "destination-out";
  const hole = (x: number, y: number, r: number, k = 1) => {
    if (x < -r || y < -r || x > W + r || y > H + r) return;
    const gr = lg.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, `rgba(0,0,0,${0.95 * k})`); gr.addColorStop(0.5, `rgba(0,0,0,${0.6 * k})`); gr.addColorStop(1, "rgba(0,0,0,0)");
    lg.fillStyle = gr; lg.fillRect(x - r, y - r, r * 2, r * 2);
  };
  const fl = (s: number) => 1 + Math.sin(b.real * 9 + s) * 0.06 + Math.sin(b.real * 23 + s * 3) * 0.04;
  for (const l of b.map.lights) hole(l.x - sx, l.y - sy, l.r * fl(l.flicker));
  for (const u of b.units) if (u.alive && u.torch && !u.hidden) hole(u.x - sx, u.y - sy - 14, 46 * fl(u.id));
  if (b.hero && b.hero.alive) hole(b.hero.x - sx, b.hero.y - sy - 8, 64, 0.8);
  for (const p of b.parts) if (p.kind === "fire" || p.kind === "holy") hole(p.x - sx, p.y - sy - p.z, 14, 0.4);
  for (const ar of b.arrows) if (ar.kind === "fire") hole(ar.x - sx, ar.y - sy, 40);
  for (const f of b.fx) if (f.kind === "beam") hole(f.x - sx, f.y - sy, 70);
  g.drawImage(L, 0, 0);
  // ciepła poświata ognia
  g.globalCompositeOperation = "lighter";
  const glow = (x: number, y: number, r: number) => {
    if (x < -r || y < -r || x > W + r || y > H + r) return;
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, "rgba(162,110,40,0.22)"); gr.addColorStop(1, "rgba(162,110,40,0)");
    g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  };
  for (const l of b.map.lights) glow(l.x - sx, l.y - sy, l.r * 0.7 * fl(l.flicker));
  for (const u of b.units) if (u.alive && u.torch && !u.hidden) glow(u.x - sx, u.y - sy - 14, 26 * fl(u.id));
  g.globalCompositeOperation = "source-over";
}

function drawRain(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  g.fillStyle = "rgba(20,26,30,0.18)"; g.fillRect(0, 0, W, H);
  g.fillStyle = "rgba(170,180,180,0.35)";
  const n = 160;
  for (let i = 0; i < n; i++) {
    const s = hashInt(i * 7 + 3);
    const sp = 260 + (s % 120);
    const x = ((((s % 997) * 7 - sx * 0.8 - b.real * 60) % W) + W) % W;
    const y = ((((s >>> 10) % 600) - sy * 0.8 + b.real * sp) % H + H) % H;
    g.fillRect(Math.round(x), Math.round(y), 1, 4);
    g.fillRect(Math.round(x) - 1, Math.round(y) + 4, 1, 1);
  }
  // rozpryski
  g.fillStyle = "rgba(170,180,180,0.4)";
  for (let i = 0; i < 20; i++) { const s = hashInt(i * 31 + Math.floor(b.real * 12)); g.fillRect(s % W, (s >>> 12) % H, 1, 1); g.fillRect((s % W) + 2, (s >>> 12) % H, 1, 1); }
}

function drawCrosshair(b: Battle, g: CanvasRenderingContext2D) {
  const mx = Math.round(b.input.mx), my = Math.round(b.input.my), h = b.hero;
  if (h && h.active && h.usingBow && !b.cmdOpen) {
    const d = dist(h.x - b.cam.x, h.y - 9 - b.cam.y, mx, my);
    const r = Math.max(2, Math.round(b.bowSpread() * d));
    g.fillStyle = h.drawT >= 0.98 ? PAL.gold : PAL.white;
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; g.fillRect(Math.round(mx + Math.cos(a) * r), Math.round(my + Math.sin(a) * r), 1, 1); }
    g.fillRect(mx, my, 1, 1);
    return;
  }
  const col = b.cmdOpen ? PAL.gold : PAL.white;
  const c = (x: number, y: number, dx: number, dy: number) => {
    g.fillStyle = PAL.ink; g.fillRect(x - 1, y - 1, 3, 3); g.fillRect(x + dx - 1, y - 1, 3, 3); g.fillRect(x - 1, y + dy - 1, 3, 3);
    g.fillStyle = col; g.fillRect(x, y, 1, 1); g.fillRect(x + dx, y, 1, 1); g.fillRect(x, y + dy, 1, 1);
  };
  c(mx - 4, my - 4, 1, 1); c(mx + 4, my - 4, -1, 1); c(mx - 4, my + 4, 1, -1); c(mx + 4, my + 4, -1, -1);
  g.fillStyle = col; g.fillRect(mx, my, 1, 1);
}

function drawCorpse(g: CanvasRenderingContext2D, c: Corpse, sx: number, sy: number) {
  if (c.bones && c.t >= 1) { g.drawImage(BONES, Math.round(c.x - sx - 7), Math.round(c.y - sy - 5)); return; }
  const img = c.img;
  if (c.horse) {
    g.save(); g.translate(Math.round(c.x - sx), Math.round(c.y - sy));
    if (c.flip) g.scale(-1, 1);
    g.drawImage(img, -Math.round(img.width / 2), -Math.round(img.height * 0.4), img.width, Math.round(img.height * 0.6));
    g.restore();
    return;
  }
  const e = 1 - Math.pow(1 - c.t, 3);
  const ang = c.rot * (Math.PI / 2) * (e + Math.sin(e * Math.PI) * 0.12);
  g.save();
  g.translate(Math.round(c.x - sx), Math.round(c.y - sy - 1));
  g.rotate(ang);
  if (c.flip) g.scale(-1, 1);
  g.drawImage(img, -Math.round(img.width / 2), -img.height + 4);
  g.restore();
}

function weaponAngle(b: Battle, u: Unit): { a: number; ext: number } {
  const f = u.face, w = u.w;
  const big = w.twoHanded && !w.staff && w.type.T !== "pierce" ? 1.18 : 1;   // broń dwuręczna: zamach zza barku
  const side = (d: Dir) => (d === "L" ? -1 : 1);
  const easeOut = (p: number) => 1 - Math.pow(1 - p, 3);
  const easeIn = (p: number) => p * p;
  switch (u.state) {
    case "windup": {
      const full = u.hero ? w.windup * 0.8 : w.windup;
      const e = easeOut(clamp(u.t / full, 0, 1));
      if (u.dir === "O") return { a: f + angDiff(f, -Math.PI / 2 - (big > 1 ? 0.7 : 0.3) * Math.sign(Math.cos(f) || 1)) * e, ext: -2 * e };
      if (u.dir === "T") return { a: f, ext: -7 * e };
      return { a: f + 0.9 + angDiff(f + 0.9, f + side(u.dir) * 2.3 * big) * e, ext: -1 * e };
    }
    case "strike": {
      const p = easeIn(clamp(u.t / w.strike, 0, 1));
      if (u.dir === "O") { const from = -Math.PI / 2 - 0.3 * Math.sign(Math.cos(f)); return { a: from + angDiff(from, f + 0.25) * p, ext: 3 * p }; }
      if (u.dir === "T") return { a: f, ext: lerp(-7, 9, p) };
      return { a: f + side(u.dir) * lerp(2.3, -1.7, p), ext: 1 };
    }
    case "recover": {
      const p = clamp(u.t / w.recover, 0, 1);
      if (u.dir === "T") return { a: f, ext: lerp(9, 0, p) };
      const end = u.dir === "O" ? f + 0.25 : f + side(u.dir) * -1.7;
      return { a: end + angDiff(end, f + 0.9) * easeOut(p), ext: 0 };
    }
    case "kick": return { a: f + 1.3, ext: 0 };
    case "stagger": return { a: f + 1.8, ext: -1 };
    default: return { a: f + 0.9 + Math.sin(b.real * 1.5 + u.id) * 0.05, ext: 0 };
  }
}

function drawUnit(b: Battle, g: CanvasRenderingContext2D, u: Unit, sx: number, sy: number) {
  if (u.state === "down") { drawCorpse(g, { x: u.x, y: u.y, img: u.spr.frames[0][0], flip: false, rot: 1, undead: false, bones: false, t: 1, pooled: true }, sx, sy); return; }
  const alpha = u.hidden ? 0.45 : u.lifeT > 0 && u.lifeT < 9000 ? 0.75 + Math.sin(b.real * 8) * 0.1 : 1;
  g.globalAlpha = alpha;
  const [dirI, flip] = b.dirIndex(u.face);
  const moving = Math.hypot(u.vx, u.vy) > 8;
  const frame = moving && !u.mounted ? [1, 2, 3, 2][Math.floor(u.anim) % 4] : 0;
  const img = (u.spr.bare || u.spr.frames)[dirI][frame];
  let lean = 0;
  if (u.state === "windup") lean = -2; else if (u.state === "strike") lean = 2; else if (u.state === "recover") lean = u.t < 0.12 ? 1 : 0;
  const c = Math.cos(u.face), s = Math.sin(u.face);
  const bx = Math.round(u.x - sx), by = Math.round(u.y - sy);
  const x = Math.round(u.x - sx + c * lean), y = Math.round(u.y - sy + s * lean * 0.6);

  g.fillStyle = "rgba(10,9,8,0.5)";
  const sw = u.mounted ? 12 : u.spr.w > 24 ? 7 : 5;
  g.fillRect(bx - sw, by - 1, sw * 2 + 1, 2); g.fillRect(bx - sw + 1, by - 2, sw * 2 - 1, 1);
  if (u.hero) { g.fillStyle = PAL.gold; g.fillRect(bx - 2, by + 1, 5, 1); }
  if (u.companion) { g.fillStyle = PAL.boneHi; g.fillRect(bx - 1, by + 1, 3, 1); }

  let riderY = 0;
  if (u.mounted && u.horse) {
    const [hd, hflip] = b.dirIndex(u.heading);
    const hf = u.rspeed > 10 ? Math.floor(u.anim) % 4 : 0;
    const himg = u.horse.frames[hd][hf];
    const hx = bx - Math.floor(himg.width / 2), hy = by - himg.height + 2 + (u.rspeed > 60 && hf % 2 ? -1 : 0);
    if (hflip) { g.save(); g.translate(hx + himg.width, hy); g.scale(-1, 1); g.drawImage(himg, 0, 0); g.restore(); } else g.drawImage(himg, hx, hy);
    if (u.horseHp < u.horseMax * 0.6) { g.fillStyle = PAL.blood; g.fillRect(bx + (hflip ? 3 : -4), by - 10, 1, 2); g.fillRect(bx + (hflip ? -2 : 2), by - 12, 1, 1); }
    riderY = hd === 2 ? -11 : -9;
  }

  const handY = u.spr.h > 32 ? -16 : -13;
  const hand = { x: x + c * 4, y: y + handY + s * 2 + riderY + (frame === 2 ? -1 : 0) };
  const wa = weaponAngle(b, u);
  const rigged = !!(u.spr.rig && u.spr.bare);
  const off = u.state === "stagger" ? Math.round(Math.sin(u.t * 50)) : 0;
  // ruch ciała: zamach z góry unosi, cios opuszcza; cięcia skręcają tułów
  let bodyDy = 0, bodyDx = 0;
  if (rigged) {
    if (u.dir === "O") bodyDy = u.state === "windup" ? -1 : u.state === "strike" ? 1 : 0;
    if ((u.dir === "L" || u.dir === "R") && (u.state === "windup" || u.state === "strike") && dirI !== 2) bodyDx = (u.dir === "L" ? -1 : 1) * (u.state === "windup" ? 1 : -1);
  }
  const ix = x - Math.floor(img.width / 2) + off + bodyDx, iy = y - img.height + 2 + riderY + bodyDy;
  const pose = rigged ? computePose(b, u, x + off + bodyDx, iy + u.spr.rig.sy + (frame === 2 ? -1 : 0), dirI, wa, moving) : null;
  if (pose) drawPoseLayer(b, g, u, pose, true);
  else if (dirI === 1) drawGear(b, g, u, hand, wa);
  const srcH = u.mounted ? Math.round(img.height * 0.66) : img.height;    // jeździec: górna część postaci
  const draw = (im: HTMLCanvasElement) => {
    if (flip) { g.save(); g.translate(ix + im.width, iy); g.scale(-1, 1); g.drawImage(im, 0, 0, im.width, srcH, 0, 0, im.width, srcH); g.restore(); }
    else g.drawImage(im, 0, 0, im.width, srcH, ix, iy, im.width, srcH);
  };
  draw(img);
  if (!u.def.undead && u.hp < u.maxHp) {   // rany na ciele
    const n = Math.floor((1 - u.hp / u.maxHp) * 8);
    g.fillStyle = PAL.blood;
    for (let i = 0; i < n; i++) { const hs = hashInt(u.id * 13 + i); g.fillRect(ix + 8 + (hs % 8), iy + 12 + ((hs >>> 4) % 8), 1, (hs >>> 8) % 3 === 0 ? 2 : 1); }
  }
  if (u.flash > 0) { g.globalAlpha = alpha * clamp(u.flash / 0.08, 0, 1) * 0.8; draw((u.spr.bareWhite || u.spr.white)[dirI][frame]); g.globalAlpha = alpha; }
  if (u.decay || u.cursedT > 0) { g.globalAlpha = 0.22 + Math.sin(b.real * 6 + u.id) * 0.08; g.fillStyle = PAL.purple; g.fillRect(ix + 7, iy + 4, img.width - 14, srcH - 6); g.globalAlpha = alpha; }
  if (u.burnT > 0 && chance(0.5)) { g.fillStyle = pick([PAL.gold, PAL.redL]); g.fillRect(ix + 8 + Math.floor(rnd() * 8), iy + 6 + Math.floor(rnd() * 14), 1, 2); }
  if (u.bloodRiteT > 0) { g.globalAlpha = 0.25; g.fillStyle = PAL.bloodL; g.fillRect(ix + 7, iy + 4, img.width - 14, srcH - 6); g.globalAlpha = alpha; }
  if (pose) drawPoseLayer(b, g, u, pose, false);
  else if (dirI !== 1) drawGear(b, g, u, hand, wa);
  if (u.smiteT > 0) { const hp = pose ? pose.main : hand; g.fillStyle = PAL.gold; g.fillRect(Math.round(hp.x + rr(-3, 3)), Math.round(hp.y + rr(-6, 0)), 1, 1); }
  // pochodnia
  if (u.torch && !u.mounted) {
    const tx = Math.round(x - c * 3 + (flip ? 3 : -3)), ty = y - 20 + riderY;
    g.fillStyle = PAL.woodD; g.fillRect(tx, ty, 1, 7);
    g.fillStyle = PAL.redL; g.fillRect(tx - 1, ty - 2, 3, 2);
    g.fillStyle = PAL.gold; g.fillRect(tx, ty - 3 - (Math.floor(b.real * 10 + u.id) % 2), 1, 2);
  }
  if (u.officer && u.team === 0) {   // proporzec na plecach
    const px = ix + (flip ? 15 : 8), py = iy - 4;
    g.fillStyle = PAL.ink; g.fillRect(px - 1, py - 1, 3, 13);
    g.fillStyle = PAL.wood; g.fillRect(px, py, 1, 12);
    g.fillStyle = SQUAD_COLORS[u.squad] || PAL.bone; g.fillRect(px + (flip ? -5 : 1), py, 5, 3); g.fillRect(px + (flip ? -4 : 1), py + 3, 3, 1);
  }
  if (u.fleeing) {   // biała flaga nad uciekającym
    const px = bx, py = iy - 8;
    g.fillStyle = PAL.ink; g.fillRect(px - 1, py - 1, 7, 6);
    g.fillStyle = PAL.white; g.fillRect(px, py, 5, 3);
    g.fillStyle = PAL.wood; g.fillRect(px - 1, py, 1, 6);
  }
  g.globalAlpha = 1;
  const h = b.hero;
  const near = h ? dist(u.x, u.y, h.x, h.y) < 120 : true;
  if (!u.hero && u.hp < u.maxHp && (near || u.commander)) {
    const w = u.commander ? 18 : 10, k = clamp(u.hp / u.maxHp, 0, 1);
    const hx = bx - Math.round(w / 2), hy = iy + 2;
    g.fillStyle = PAL.ink; g.fillRect(hx - 1, hy - 1, w + 2, 4);
    g.fillStyle = u.team === 0 ? PAL.redL : u.commander ? PAL.purpleL : PAL.bone;
    g.fillRect(hx, hy, Math.ceil(w * k), 2);
  }
  if ((u.companion || u.commander) && near) { const nm = u.companion ? u.name : ""; if (nm) { g.globalAlpha = 0.8; pxSmall(g, nm.toUpperCase(), bx, iy - 4, PAL.boneHi); g.globalAlpha = 1; } }
}

function drawGear(b: Battle, g: CanvasRenderingContext2D, u: Unit, hand: V, wa: { a: number; ext: number }) {
  const w = u.w;
  const meleeOnly = u.team === 0 && b.orders[u.squad]?.meleeOnly;
  if (u.usingBow && u.bowDmg > 0 && (u.hero || (u.state === "idle" && u.ammo > 0 && !meleeOnly && u.target && dist(u.x, u.y, u.target.x, u.target.y) > 30))) {
    const a = u.face;
    const bx = hand.x + Math.cos(a) * 3, by = hand.y + Math.sin(a) * 3;
    const px = -Math.sin(a), py = Math.cos(a);
    const xbow = !!u.def.bow?.bolt;
    const pull = u.hero ? u.drawT * 4 : clamp(1 - u.reload / 1.2, 0, 1) * 3;
    if (xbow) {
      pxLine(g, bx - Math.cos(a) * 4, by - Math.sin(a) * 4, bx + Math.cos(a) * 5, by + Math.sin(a) * 5, PAL.woodD);
      pxLine(g, bx + Math.cos(a) * 4 + px * 4, by + Math.sin(a) * 4 + py * 4, bx + Math.cos(a) * 4 - px * 4, by + Math.sin(a) * 4 - py * 4, PAL.steel);
      return;
    }
    if (u.def.bow?.axe) { g.fillStyle = PAL.steelL; g.fillRect(Math.round(bx), Math.round(by - 2), 2, 2); g.fillStyle = PAL.wood; g.fillRect(Math.round(bx), Math.round(by), 1, 3); return; }
    for (let i = -6; i <= 6; i++) {
      const bend = (1 - (i * i) / 36) * 2.5;
      g.fillStyle = Math.abs(i) > 4 ? PAL.woodD : PAL.wood;
      g.fillRect(Math.round(bx + px * i + Math.cos(a) * bend), Math.round(by + py * i + Math.sin(a) * bend), 1, 1);
    }
    pxLine(g, bx + px * 6, by + py * 6, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, PAL.bone);
    pxLine(g, bx - px * 6, by - py * 6, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, PAL.bone);
    if (pull > 1) { pxLine(g, bx - Math.cos(a) * pull, by - Math.sin(a) * pull, bx + Math.cos(a) * 6, by + Math.sin(a) * 6, PAL.wood); g.fillStyle = PAL.steelL; g.fillRect(Math.round(bx + Math.cos(a) * 6), Math.round(by + Math.sin(a) * 6), 1, 1); }
    return;
  }
  if (u.hasShield) {
    const blockingNow = u.hero ? u.blocking : u.state === "idle" && u.guardT > 0;
    const a = blockingNow ? u.face : u.face - 1.5;
    const r = blockingNow ? 6 : 5;
    const sxp = Math.round(hand.x - Math.cos(u.face) * 3 + Math.cos(a) * r), syp = Math.round(hand.y + 2 + Math.sin(a) * r);
    const F = FACTIONS[u.look?.tabard ? 0 : 0];
    const main = u.look.tabard ? u.look.tabard.main : u.team === 0 ? PAL.red : PAL.dusk;
    const trim = u.look.tabard ? u.look.tabard.trim : PAL.bone;
    void F;
    g.fillStyle = PAL.ink; g.fillRect(sxp - 4, syp - 5, 9, 10); g.fillRect(sxp - 3, syp + 5, 7, 1);
    g.fillStyle = main; g.fillRect(sxp - 3, syp - 4, 7, 8); g.fillRect(sxp - 2, syp + 4, 5, 1);
    g.fillStyle = PAL.woodD; g.fillRect(sxp + 2, syp - 4, 1, 8);
    g.fillStyle = PAL.steel; g.fillRect(sxp - 3, syp - 4, 7, 1);
    g.fillStyle = trim; g.fillRect(sxp, syp - 3, 1, 6); g.fillRect(sxp - 2, syp - 1, 5, 1);
    g.fillStyle = PAL.steelL; g.fillRect(sxp, syp - 1, 1, 1);
    if (hashInt(u.id) % 3 === 0) { g.fillStyle = PAL.dirtD; g.fillRect(sxp - 3, syp + 2, 2, 2); }
  }
  if (w.claws) {
    if (u.state === "strike" || u.state === "windup") {
      const ex = Math.cos(wa.a), ey = Math.sin(wa.a);
      for (let i = 0; i < 3; i++) pxLine(g, hand.x + ex * 2 - ey * (i - 1), hand.y + ey * 2 + ex * (i - 1), hand.x + ex * 5 - ey * (i - 1), hand.y + ey * 5 + ex * (i - 1), PAL.boneHi);
    }
    return;
  }
  const ex = Math.cos(wa.a), ey = Math.sin(wa.a);
  const bx = hand.x + Math.cos(u.face) * wa.ext, by = hand.y + Math.sin(u.face) * wa.ext;
  const len = w.len + 2;
  const tipx = bx + ex * len, tipy = by + ey * len;
  if (u.state === "strike" && u.dir !== "T") {
    u.trail.push(wa.a);
    if (u.trail.length > 6) u.trail.shift();
    g.globalAlpha = 0.4;
    g.fillStyle = u.smiteT > 0 ? PAL.gold : u.hero ? PAL.white : PAL.boneHi;
    for (let i = 1; i < u.trail.length; i++) {
      const a0 = u.trail[i - 1], a1 = u.trail[i];
      for (let k = 0; k <= 4; k++) { const aa = a0 + angDiff(a0, a1) * (k / 4); for (let r = len * 0.45; r <= len + 1; r += 1) g.fillRect(Math.round(bx + Math.cos(aa) * r), Math.round(by + Math.sin(aa) * r), 1, 1); }
    }
    g.globalAlpha = 1;
  }
  if (w.staff) {
    pxLine(g, bx - ex * 4, by - ey * 4, tipx, tipy, PAL.woodD);
    g.fillStyle = u.def.ability === "necro" ? PAL.purpleL : u.def.ability === "mage" ? PAL.redL : PAL.bone;
    g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 2, 2);
    return;
  }
  g.fillStyle = PAL.ink;
  pxLine(g, bx + ex * 2 + 0.6, by + ey * 2 + 0.6, tipx + 0.6, tipy + 0.6, PAL.black);
  pxLine(g, bx + ex * 2, by + ey * 2, tipx, tipy, w.blade);
  if (w.len >= 9 && !w.axe && !w.head) pxLine(g, bx + ex * 3 + 0.5, by + ey * 3 + 0.5, bx + ex * (len - 2) + 0.5, by + ey * (len - 2) + 0.5, w.blade === PAL.steelL ? PAL.steel : PAL.steelD);
  if (u.bloodT > 0) { g.fillStyle = PAL.blood; for (let i = 0; i < 4; i++) g.fillRect(Math.round(bx + ex * (len - i * 2 - 1)), Math.round(by + ey * (len - i * 2 - 1)), 1, 1); }
  if (w.head) {
    g.fillStyle = PAL.ink; g.fillRect(Math.round(tipx) - 2, Math.round(tipy) - 2, 5, 5);
    g.fillStyle = w.head; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 3, 3);
    g.fillStyle = PAL.steelL; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 1, 1);
  }
  if (w.axe) {
    const px = -ey, py = ex;
    for (let i = 0; i < 4; i++) { g.fillStyle = i === 3 ? PAL.steelL : PAL.steel; pxLine(g, tipx - ex * i, tipy - ey * i, tipx - ex * i + px * (w.twoHanded ? 5 : 4), tipy - ey * i + py * (w.twoHanded ? 5 : 4), i === 0 ? PAL.steelL : PAL.steel); }
  }
  if (!w.axe && !w.head && w.blade !== PAL.wood && w.blade !== PAL.woodD) {
    g.fillStyle = w.hilt;
    g.fillRect(Math.round(bx + ex * 2 - ey * 1.5), Math.round(by + ey * 2 + ex * 1.5), 1, 1);
    g.fillRect(Math.round(bx + ex * 2 + ey * 1.5), Math.round(by + ey * 2 - ex * 1.5), 1, 1);
  }
  if (w.blade === PAL.wood && !w.axe && !w.head) { g.fillStyle = PAL.steelL; g.fillRect(Math.round(tipx), Math.round(tipy), 2, 1); g.fillRect(Math.round(tipx + ex), Math.round(tipy + ey), 1, 1); }
  g.fillStyle = PAL.woodD; g.fillRect(Math.round(bx), Math.round(by), 1, 1);
}

// Tylko ciosy wymierzone w bohatera i garda przeciwnika, na którego patrzysz.
function drawTells(b: Battle, g: CanvasRenderingContext2D, sx: number, sy: number) {
  const h = b.hero;
  if (!h || !h.active || b.cmdOpen) return;
  let focus: Unit | null = null, fd = 1e9;
  for (const u of b.units) {
    if (!u.active || u.team === 0 || u.hidden) continue;
    const d = dist(u.x, u.y, h.x, h.y);
    if (d < 44 && Math.abs(angDiff(h.face, Math.atan2(u.y - h.y, u.x - h.x))) < 0.8 && d < fd) { fd = d; focus = u; }
    const top = u.y - sy - u.spr.h - (u.mounted ? 12 : 0) + 2;
    if (u.state === "windup" && u.target === h && d < 60) dirGlyph(g, u.dir, Math.round(u.x - sx), Math.round(top), PAL.bloodL, true);
  }
  if (focus && focus.guard && focus.state !== "windup") dirGlyph(g, focus.guard, Math.round(focus.x - sx), Math.round(focus.y - sy - focus.spr.h + 2), PAL.steelL, false);
  if (focus && !h.usingBow && h.state === "idle" && !b.settings.gesture && !h.mounted) {
    const side = h.nextSide === "L" ? -1 : 1;
    const px = Math.round(h.x - sx + Math.cos(h.face + side * 1.4) * 10), py = Math.round(h.y - sy - 12 + Math.sin(h.face + side * 1.4) * 6);
    g.fillStyle = PAL.ink; g.fillRect(px - 1, py - 1, 3, 3);
    g.fillStyle = PAL.goldD; g.fillRect(px, py, 1, 1);
  }
  if (b.settings.gesture && !h.usingBow) dirGlyph(g, h.state === "windup" ? h.dir : b.loadDir, Math.round(h.x - sx), Math.round(h.y - sy - 34), h.state === "windup" ? PAL.gold : PAL.goldD, h.state === "windup");
}

function dirGlyph(g: CanvasRenderingContext2D, d: Dir, x: number, y: number, col: string, attack: boolean) {
  const shapes: Record<Dir, number[][]> = attack ? {
    L: [[-3, 0], [-2, 0], [-1, 0], [0, 0], [1, 0], [2, 0], [1, -1], [1, 1], [0, -2], [0, 2]],
    R: [[3, 0], [2, 0], [1, 0], [0, 0], [-1, 0], [-2, 0], [-1, -1], [-1, 1], [0, -2], [0, 2]],
    O: [[0, -3], [0, -2], [0, -1], [0, 0], [0, 1], [-1, 0], [1, 0], [-2, -1], [2, -1]],
    T: [[-1, -1], [0, -1], [1, -1], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1], [0, -3], [0, 3], [-3, 0], [3, 0]],
  } : {
    L: [[-5, -3], [-5, -2], [-5, -1], [-5, 0], [-5, 1], [-5, 2]],
    R: [[5, -3], [5, -2], [5, -1], [5, 0], [5, 1], [5, 2]],
    O: [[-3, -3], [-2, -3], [-1, -3], [0, -3], [1, -3], [2, -3], [3, -3]],
    T: [[-1, 0], [0, 0], [1, 0], [0, -1], [0, 1]],
  };
  g.fillStyle = PAL.ink;
  for (const [px, py] of shapes[d]) { g.fillRect(x + px - 1, y + py, 3, 1); g.fillRect(x + px, y + py - 1, 1, 3); }
  g.fillStyle = col;
  for (const [px, py] of shapes[d]) g.fillRect(x + px, y + py, 1, 1);
}

// Mała pikselowa czcionka 3×5 (cyfry i wielkie litery z polskimi znakami).
const FONT: Record<string, string> = {
  "0": "111101101101111", "1": "010110010010111", "2": "111001111100111", "3": "111001111001111", "4": "101101111001001",
  "5": "111100111001111", "6": "111100111101111", "7": "111001010010010", "8": "111101111101111", "9": "111101111001111",
  A: "010101111101101", Ą: "010101111101111", B: "110101110101110", C: "011100100100011", Ć: "011100100100011", D: "110101101101110",
  E: "111100110100111", Ę: "111100110100111", F: "111100110100100", G: "011100101101011", H: "101101111101101", I: "111010010010111",
  J: "001001001101010", K: "101101110101101", L: "100100100100111", Ł: "100110100100111", M: "101111111101101", N: "110101101101101",
  Ń: "110101101101101", O: "010101101101010", Ó: "010101101101010", P: "110101110100100", R: "110101110101101", S: "011100010001110",
  Ś: "011100010001110", T: "111010010010010", U: "101101101101111", W: "101101111111101", Y: "101101010010010", Z: "111001010100111",
  Ż: "111001010100111", Ź: "111001010100111", " ": "000000000000000", "!": "010010010000010", "+": "000010111010000", "-": "000000111000000",
};
function textW(t: string) { return t.length * 4 - 1; }
function pxText(g: CanvasRenderingContext2D, t: string, x: number, y: number, col: string) {
  for (let pass = 0; pass < 2; pass++) {
    g.fillStyle = pass === 0 ? PAL.ink : col;
    for (let i = 0; i < t.length; i++) {
      const f = FONT[t[i]] || FONT[" "];
      for (let k = 0; k < 15; k++) if (f[k] === "1") {
        const px = x + i * 4 + (k % 3), py = y + Math.floor(k / 3);
        if (pass === 0) g.fillRect(px - 1, py - 1, 3, 3); else g.fillRect(px, py, 1, 1);
      }
    }
  }
}
function pxSmall(g: CanvasRenderingContext2D, t: string, cx: number, y: number, col: string) { pxText(g, t, Math.round(cx - textW(t) / 2), y - 5, col); }


// ---------- Ramiona i broń zgodne z ruchem ----------
// Dłoń porusza się po łuku wokół barku, broń wychodzi z dłoni. Styl zależy od broni:
// jednoręczna (dłoń i tarcza), dwuręczna (obie dłonie na rękojeści), drzewcowa (dwa chwyty na drzewcu),
// łuk (ręka wyciągnięta, druga naciąga cięciwę), kusza (przy piersi).
type WStyle = "one" | "two" | "pole" | "bow" | "xbow";
interface Pose { style: WStyle; main: V; off: V; shM: V; shO: V; base: V; a: number; len: number; mainBack: boolean; offBack: boolean; gearBack: boolean; shield: V | null; blocking: boolean; pull: number; }

function bowVisible(b: Battle, u: Unit) {
  const meleeOnly = u.team === 0 && b.orders[u.squad]?.meleeOnly;
  return u.usingBow && u.bowDmg > 0 && (u.hero || (u.state === "idle" && u.ammo > 0 && !meleeOnly && !!u.target && dist(u.x, u.y, u.target.x, u.target.y) > 30));
}
function weaponStyle(b: Battle, u: Unit): WStyle {
  if (bowVisible(b, u) && !u.def.bow?.axe) return u.def.bow?.bolt ? "xbow" : "bow";
  const w = u.w;
  if (w.staff || (w.len >= 14 && w.type.T === "pierce" && !w.axe)) return "pole";
  if (w.twoHanded) return "two";
  return "one";
}
function computePose(b: Battle, u: Unit, x: number, shY: number, dirI: number, wa: { a: number; ext: number }, moving: boolean): Pose {
  const R = u.spr.rig, f = u.face;
  const fx = Math.cos(f), fy = Math.sin(f);
  const rvx = Math.cos(f + Math.PI / 2), rvy = Math.sin(f + Math.PI / 2);
  const side = dirI === 2;
  const sw = R.sx * (side ? 0.35 : 1);
  const fwd = side ? 2 : 0;   // z boku bark jest z przodu tułowia, żeby ramię było widać
  const shM = { x: x + rvx * sw + fx * fwd, y: shY + rvy * sw * 0.5 }, shO = { x: x - rvx * sw - fx * 1, y: shY - rvy * sw * 0.5 };
  const chest = { x: x + fx * 1, y: shY + 2 + fy * 1 };
  const style = weaponStyle(b, u);
  const L = R.arm;
  const v = (a: number, k: number) => ({ x: Math.cos(a) * k, y: Math.sin(a) * k * 0.8 });
  const add = (p: V, q: V, k = 1) => ({ x: p.x + q.x * k, y: p.y + q.y * k });
  const swing = moving && u.state === "idle" ? Math.sin(u.anim * Math.PI) * 1.5 : 0;
  const facingUp = fy < -0.3;
  const blocking = u.hero ? u.blocking : u.state === "idle" && u.guardT > 0;
  const len = u.w.len + 2;
  let main: V, off: V, base: V, a = wa.a, pull = 0, shield: V | null = null;
  if (style === "bow") {
    pull = u.hero ? u.drawT : clamp(1 - u.reload / 1.2, 0, 1);
    off = add(chest, { x: fx, y: fy * 0.8 }, L * 0.95);
    main = add(off, { x: -fx, y: -fy * 0.8 }, 2 + pull * 5);
    base = off; a = f;
  } else if (style === "xbow") {
    main = add(chest, { x: fx, y: fy * 0.8 }, 3); off = add(main, { x: fx, y: fy * 0.8 }, 3);
    base = main; a = f;
  } else if (style === "pole") {
    const strikeO = u.dir === "O" && (u.state === "windup" || u.state === "strike");
    a = strikeO ? wa.a : f + angDiff(f, wa.a) * (u.state === "idle" ? 0.3 : 0.45);
    const push = wa.ext * 0.8;
    off = add(add(chest, v(a, 1)), { x: fx, y: fy * 0.8 }, push);
    main = add(off, v(a, 5));
    base = add(off, v(a, -6));
  } else if (style === "two") {
    const mid = { x: (shM.x + shO.x) / 2, y: (shM.y + shO.y) / 2 };
    main = add(add(mid, v(a, L * 0.75)), { x: fx, y: fy * 0.8 }, wa.ext * 0.6);
    off = add(main, v(a, -3));
    base = add(off, v(a, -1));
  } else {
    main = add(add(shM, v(a, L * 0.95)), { x: fx, y: fy * 0.8 }, wa.ext * 0.7);
    base = main;
    if (u.hasShield) shield = blocking ? add(chest, { x: fx, y: fy * 0.8 }, 6) : add(shO, { x: fx * 2 - rvx * 1, y: L * 0.55 + fy });
    off = shield ? shield : add(shO, { x: fx * 0.5, y: L * 0.85 + swing });
  }
  const mainBack = facingUp || (side && rvy < 0 && style === "one");
  const offBack = facingUp || (side && rvy > 0 && style === "one");
  return { style, main, off, shM, shO, base, a, len, mainBack, offBack, gearBack: facingUp, shield, blocking, pull };
}
function thick(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string, ink = true) {
  if (ink) for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]]) pxLine(g, x0 + dx, y0 + dy, x1 + dx, y1 + dy, PAL.ink);
  pxLine(g, x0, y0, x1, y1, col); pxLine(g, x0 + 1, y0, x1 + 1, y1, col);
}
function armLine(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, col: string) {
  for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 1], [1, 1]]) pxLine(g, x0 + dx, y0 + dy, x1 + dx, y1 + dy, PAL.ink);   // obrys
  pxLine(g, x0, y0, x1, y1, col); pxLine(g, x0 + 1, y0, x1 + 1, y1, col);
}
function drawArm(g: CanvasRenderingContext2D, R: Rig, sh: V, hand: V) {
  const mx = (sh.x + hand.x) / 2, my = (sh.y + hand.y) / 2;
  const d = dist(sh.x, sh.y, hand.x, hand.y);
  const bend = Math.max(0, R.arm - d) * 0.6;          // im bliżej dłoń, tym mocniej zgięty łokieć
  const ex = mx + (hand.x > sh.x ? 0.5 : -0.5) * bend, ey = my + bend * 0.8 + 0.5;
  armLine(g, sh.x, sh.y, ex, ey, R.sleeve);
  armLine(g, ex, ey, hand.x, hand.y, R.sleeve);
  g.fillStyle = R.sleeveD; g.fillRect(Math.round(ex), Math.round(ey), 2, 1);   // łokieć
  g.fillStyle = PAL.ink; g.fillRect(Math.round(hand.x) - 1, Math.round(hand.y), 4, 3);
  g.fillStyle = R.hand; g.fillRect(Math.round(hand.x), Math.round(hand.y) - 1, 2, 3);
}
function drawPoseLayer(b: Battle, g: CanvasRenderingContext2D, u: Unit, P: Pose, back: boolean) {
  const R = u.spr.rig;
  const gearHere = P.gearBack === back;
  // ręka bez broni (tarcza lub swobodna)
  if (P.offBack === back) {
    if (P.style === "one") drawArm(g, R, P.shO, P.off);
    if (P.shield && !(P.blocking && back)) drawShieldAt(g, u, P.shield, P.blocking, u.face);
  }
  if (P.shield && P.blocking && !back && P.offBack) drawShieldAt(g, u, P.shield, true, u.face);
  // broń
  if (gearHere) {
    if (P.style === "bow") drawBowAt(g, u, P.off, P.main, P.pull);
    else if (P.style === "xbow") drawXbowAt(g, u, P.main);
    else drawWeaponAt(b, g, u, P.base, P.a, P.len + (P.style === "pole" ? 6 : P.style === "two" ? 2 : 0));
  }
  // ręce trzymające broń
  if (P.mainBack === back) {
    drawArm(g, R, P.shM, P.main);
    if (P.style !== "one") drawArm(g, R, P.shO, P.off);
  }
}
function drawShieldAt(g: CanvasRenderingContext2D, u: Unit, p: V, blocking: boolean, face: number) {
  const sxp = Math.round(p.x), syp = Math.round(p.y);
  const main = u.look.tabard ? u.look.tabard.main : u.team === 0 ? PAL.red : PAL.dusk;
  const trim = u.look.tabard ? u.look.tabard.trim : PAL.bone;
  const big = blocking ? 1 : 0;
  g.fillStyle = PAL.ink; g.fillRect(sxp - 4 - big, syp - 5 - big, 9 + big * 2, 10 + big * 2); g.fillRect(sxp - 3, syp + 5 + big, 7, 1);
  g.fillStyle = main; g.fillRect(sxp - 3 - big, syp - 4 - big, 7 + big * 2, 8 + big * 2); g.fillRect(sxp - 2, syp + 4 + big, 5, 1);
  g.fillStyle = PAL.steel; g.fillRect(sxp - 3 - big, syp - 4 - big, 7 + big * 2, 1);
  g.fillStyle = trim; g.fillRect(sxp, syp - 3, 1, 6); g.fillRect(sxp - 2, syp - 1, 5, 1);
  g.fillStyle = PAL.steelL; g.fillRect(sxp, syp - 1, 1, 1);
  if (hashInt(u.id) % 3 === 0) { g.fillStyle = PAL.dirtD; g.fillRect(sxp - 3, syp + 2, 2, 2); }
  void face;
}
function drawBowAt(g: CanvasRenderingContext2D, u: Unit, front: V, back: V, pull: number) {
  const a = u.face, px = -Math.sin(a), py = Math.cos(a);
  const bx = front.x, by = front.y;
  for (let i = -6; i <= 6; i++) {
    const bend = (1 - (i * i) / 36) * (2 + pull * 1.5);
    g.fillStyle = Math.abs(i) > 4 ? PAL.woodD : PAL.wood;
    g.fillRect(Math.round(bx + px * i + Math.cos(a) * bend), Math.round(by + py * i + Math.sin(a) * bend), 1, 1);
  }
  pxLine(g, bx + px * 6, by + py * 6, back.x, back.y, PAL.bone);
  pxLine(g, bx - px * 6, by - py * 6, back.x, back.y, PAL.bone);
  if (pull > 0.15) { pxLine(g, back.x, back.y, bx + Math.cos(a) * 6, by + Math.sin(a) * 6, PAL.wood); g.fillStyle = PAL.steelL; g.fillRect(Math.round(bx + Math.cos(a) * 6), Math.round(by + Math.sin(a) * 6), 1, 1); }
}
function drawXbowAt(g: CanvasRenderingContext2D, u: Unit, p: V) {
  const a = u.face, c = Math.cos(a), s2 = Math.sin(a), px = -s2, py = c;
  thick(g, p.x - c * 2, p.y - s2 * 2, p.x + c * 7, p.y + s2 * 7, PAL.woodD);
  pxLine(g, p.x + c * 6 + px * 5, p.y + s2 * 6 + py * 5, p.x + c * 6 - px * 5, p.y + s2 * 6 - py * 5, PAL.steel);
  pxLine(g, p.x + c * 6 + px * 5, p.y + s2 * 6 + py * 5, p.x + c * 2, p.y + s2 * 2, PAL.bone);
  pxLine(g, p.x + c * 6 - px * 5, p.y + s2 * 6 - py * 5, p.x + c * 2, p.y + s2 * 2, PAL.bone);
}
function drawWeaponAt(b: Battle, g: CanvasRenderingContext2D, u: Unit, base: V, a: number, len: number) {
  const w = u.w;
  if (w.claws) return;
  const ex = Math.cos(a), ey = Math.sin(a);
  const bx = base.x, by = base.y;
  const tipx = bx + ex * len, tipy = by + ey * len;
  if (u.state === "strike" && u.dir !== "T") {
    u.trail.push(a);
    if (u.trail.length > 6) u.trail.shift();
    g.globalAlpha = 0.4;
    g.fillStyle = u.smiteT > 0 ? PAL.gold : u.hero ? PAL.white : PAL.boneHi;
    for (let i = 1; i < u.trail.length; i++) {
      const a0 = u.trail[i - 1], a1 = u.trail[i];
      for (let k = 0; k <= 4; k++) { const aa = a0 + angDiff(a0, a1) * (k / 4); for (let r = len * 0.45; r <= len + 1; r += 1) g.fillRect(Math.round(bx + Math.cos(aa) * r), Math.round(by + Math.sin(aa) * r), 1, 1); }
    }
    g.globalAlpha = 1;
  } else if (u.state !== "strike") u.trail.length = 0;
  if (w.staff) {
    thick(g, bx, by, tipx, tipy, PAL.woodD, true);
    g.fillStyle = u.def.ability === "necro" ? PAL.purpleL : u.def.ability === "mage" ? PAL.redL : PAL.bone;
    g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 3, 3);
    return;
  }
  const shaft = w.blade === PAL.wood || w.blade === PAL.woodD;
  pxLine(g, bx + 0.6, by + 0.6, tipx + 0.6, tipy + 0.6, PAL.black);
  pxLine(g, bx, by, tipx, tipy, w.blade);
  if (!shaft && w.len >= 9 && !w.axe && !w.head) pxLine(g, bx + ex * 3 + 0.5, by + ey * 3 + 0.5, bx + ex * (len - 2) + 0.5, by + ey * (len - 2) + 0.5, w.blade === PAL.steelL ? PAL.steel : PAL.steelD);
  if (u.bloodT > 0) { g.fillStyle = PAL.blood; for (let i = 0; i < 4; i++) g.fillRect(Math.round(bx + ex * (len - i * 2 - 1)), Math.round(by + ey * (len - i * 2 - 1)), 1, 1); }
  if (w.head) {
    g.fillStyle = PAL.ink; g.fillRect(Math.round(tipx) - 2, Math.round(tipy) - 2, 5, 5);
    g.fillStyle = w.head; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 3, 3);
    g.fillStyle = PAL.steelL; g.fillRect(Math.round(tipx) - 1, Math.round(tipy) - 1, 1, 1);
  }
  if (w.axe) { const px = -ey, py = ex; for (let i = 0; i < 4; i++) pxLine(g, tipx - ex * i, tipy - ey * i, tipx - ex * i + px * (w.twoHanded ? 5 : 4), tipy - ey * i + py * (w.twoHanded ? 5 : 4), i === 0 ? PAL.steelL : PAL.steel); }
  if (!shaft && !w.axe && !w.head) {   // jelec
    g.fillStyle = w.hilt;
    g.fillRect(Math.round(bx + ex * 1 - ey * 2), Math.round(by + ey * 1 + ex * 2), 1, 1);
    g.fillRect(Math.round(bx + ex * 1 + ey * 2), Math.round(by + ey * 1 - ex * 2), 1, 1);
    g.fillRect(Math.round(bx + ex - ey), Math.round(by + ey + ex), 1, 1); g.fillRect(Math.round(bx + ex + ey), Math.round(by + ey - ex), 1, 1);
  }
  if (shaft && !w.axe && !w.head) { g.fillStyle = PAL.steelL; g.fillRect(Math.round(tipx), Math.round(tipy), 2, 1); g.fillRect(Math.round(tipx + ex), Math.round(tipy + ey), 1, 1); g.fillStyle = PAL.steel; g.fillRect(Math.round(tipx - ex), Math.round(tipy - ey), 1, 1); }
}

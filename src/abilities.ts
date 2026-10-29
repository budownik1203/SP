// Umiejętności aktywne bohatera (klawisze 1–3, 4 = opatrunek) i umiejętności jednostek (kapłani, magowie, szamani, nekromanci, Rycerz Śmierci).

interface AbilityFx { kind: "beam" | "bash" | "spin"; x: number; y: number; t: number; max: number; src: Unit; hit?: Set<number>; level?: number; }

function abilityReady(b: Battle, id: string): string | null {
  const H = b.heroCfg, h = b.hero, A = ABILITIES[id];
  if (!H || !h || !A) return "Brak umiejętności";
  if ((b.cds[id] || 0) > 0) return `${A.name}: jeszcze ${Math.ceil(b.cds[id])} s`;
  const cost = abilityCost(b, id);
  if (A.res === "blood") { if (h.hp <= cost + 5) return "Za mało zdrowia"; }
  else if ((H as any)[A.res] < cost) return `Za mało: ${RES_NAME[A.res].toLowerCase()}`;
  if (h.state === "stagger" || h.state === "down") return "Nie teraz";
  return null;
}
function abilityCost(b: Battle, id: string) { const A = ABILITIES[id]; return id === "smite" && (b.heroCfg?.abLevels.smite || 1) >= 2 ? 50 : A.cost; }

function castHeroAbility(b: Battle, slot: number) {
  const H = b.heroCfg, h = b.hero;
  if (!H || !h || !h.active) return;
  const id = H.abilities[slot];
  if (!id) { b.say(`Pusty slot ${slot + 1}`); return; }
  const why = abilityReady(b, id);
  if (why) { b.say(why, PAL.ash); b.sfx.ui(); return; }
  const A = ABILITIES[id], cost = abilityCost(b, id);
  if (A.res === "blood") h.hp -= cost; else (H as any)[A.res] -= cost;
  b.cds[id] = A.cd;
  if (A.corrupt) {
    H.corruption = Math.min(100, H.corruption + A.corrupt * b.corruptMul);
    if (H.corruption > 60 && chance(0.25)) { b.say("Spaczenie pali ci żyły!", PAL.purpleL); h.hp -= 8; b.hurtFlash = 0.3; }
  }
  const wx = b.cam.x + b.input.mx, wy = b.cam.y + b.input.my;
  const s = b.vol(h.x);
  b.lastAbility = id;
  b.shout(A.name, A.res === "faith" ? PAL.gold : A.res === "mana" ? PAL.purpleL : PAL.redL);
  switch (id) {
    case "smite": {
      if ((H.abLevels.smite || 1) >= 2) {
        // poziom 2: słup świętego światła przy kursorze
        const d = dist(h.x, h.y, wx, wy), k = d > 200 ? 200 / d : 1;
        b.fx.push({ kind: "beam", x: h.x + (wx - h.x) * k, y: h.y + (wy - h.y) * k, t: 0, max: 0.6, src: h, level: 2 });
        b.sfx.smite();
      } else { h.smiteT = 8; b.holyBurst(h.x, h.y, 14); b.sfx.smite(); b.say("Ostrze płonie świętym ogniem. Uderz!", PAL.gold); }
      break;
    }
    case "warcry": {
      b.sfx.battleCry(1); b.sfx.shout(1); b.shake(3);
      b.parts.push({ x: h.x, y: h.y, z: 14, vx: 4, vy: 0, vz: 0, life: 0.5, max: 0.5, col: PAL.redL, kind: "ring" });
      for (const u of b.units) {
        if (!u.active) continue;
        const d = dist(u.x, u.y, h.x, h.y);
        if (u.team === 0 && d < 130) { u.morale = Math.min(100, u.morale + 30); u.buffT = 10; u.buffDmg = 1.15; if (u.fleeing) u.fleeing = false; }
        if (u.team === 1 && d < 100 && !u.def.undead) { u.morale -= 22; if (chance(0.35) && !u.def.poise) b.stagger(u, 0.8); }
      }
      break;
    }
    case "bash": {
      const a = h.wantFace;
      h.vx = Math.cos(a) * 230; h.vy = Math.sin(a) * 230; h.face = a;
      if (h.mounted) h.rspeed = h.maxRide;
      b.fx.push({ kind: "bash", x: 0, y: 0, t: 0, max: 0.35, src: h, hit: new Set() });
      b.sfx.shout(0.8); b.dust(h.x, h.y, 8);
      break;
    }
    case "whirl": {
      b.fx.push({ kind: "spin", x: 0, y: 0, t: 0, max: 0.45, src: h, hit: new Set() });
      b.sfx.swing(1, 0, 1.6);
      break;
    }
    case "fireball": {
      const a = Math.atan2(wy - (h.y - 12), wx - h.x);
      b.fire(h, a, 240, 55 * b.fireMul, clamp(dist(h.x, h.y, wx, wy), 30, 320), "fire");
      break;
    }
    case "heal": {
      b.sfx.heal();
      h.hp = Math.min(h.maxHp, h.hp + h.maxHp * 0.4);
      for (const u of b.units) if (u.team === 0 && u.active && dist(u.x, u.y, h.x, h.y) < 110) { u.hp = Math.min(u.maxHp, u.hp + 35); b.holyBurst(u.x, u.y, 4); }
      b.holyBurst(h.x, h.y, 20);
      break;
    }
    case "curse": {
      b.sfx.curse(s.v, s.pan);
      let n = 0;
      for (const u of b.units) if (u.team === 1 && u.active && dist(u.x, u.y, wx, wy) < 65) { u.cursedT = 8; n++; for (let i = 0; i < 4; i++) b.parts.push({ x: u.x + rr(-4, 4), y: u.y, z: rr(4, 20), vx: rr(-6, 6), vy: rr(-6, 6), vz: rr(5, 20), life: 1, max: 1, col: PAL.purpleL, kind: "soul" }); }
      b.parts.push({ x: wx, y: wy, z: 0, vx: 9, vy: 0, vz: 0, life: 0.6, max: 0.6, col: PAL.purpleL, kind: "ring" });
      b.say(`Klątwa spada na ${n} wrogów.`, PAL.purpleL);
      break;
    }
    case "blood": {
      h.bloodRiteT = 10; b.sfx.scream(0.6, 0); b.blood(h.x, h.y - 10, 18, null, true); b.hurtFlash = 0.4;
      break;
    }
    case "summon": {
      b.sfx.howl(1, 0);
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const u = new Unit(i === 0 ? "x_spirit" : "x_wolf", 0, 20, h.x + Math.cos(a) * 20, h.y + Math.sin(a) * 20, 7);
        u.lifeT = 25; u.morale = 100;
        b.units.push(u);
        for (let k = 0; k < 10; k++) b.parts.push({ x: u.x, y: u.y, z: rr(2, 16), vx: rr(-10, 10), vy: rr(-10, 10), vz: rr(10, 40), life: 1, max: 1, col: PAL.boneHi, kind: "soul" });
      }
      break;
    }
    case "focus": b.focusT = 4; b.sfx.wail(); break;
  }
}

function useBandage(b: Battle) {
  const H = b.heroCfg, h = b.hero;
  if (!H || !h || !h.active) return;
  if (H.bandages <= 0) { b.say("Nie masz opatrunków.", PAL.ash); return; }
  if (h.hp >= h.maxHp) { b.say("Nie jesteś ranny."); return; }
  if (h.state !== "idle") return;
  H.bandages--;
  h.hp = Math.min(h.maxHp, h.hp + 30 + H.medicine * 3);
  b.stagger(h, 0.9);
  b.say(`Opatrunek. Zostało: ${H.bandages}`, PAL.bone);
  b.sfx.page();
}

function updateAbilityFx(b: Battle, dt: number) {
  for (const f of b.fx) {
    f.t += dt;
    const h = f.src;
    if (f.kind === "beam") {
      if (chance(dt * 60)) b.parts.push({ x: f.x + rr(-14, 14), y: f.y + rr(-8, 8), z: rr(0, 40), vx: 0, vy: 0, vz: rr(30, 90), life: 0.4, max: 0.4, col: pick([PAL.gold, PAL.boneHi]), kind: "holy" });
      if (f.t >= f.max && !f.hit) {
        f.hit = new Set();
        b.parts.push({ x: f.x, y: f.y, z: 0, vx: 0, vy: 0, vz: 0, life: 0.5, max: 0.5, col: PAL.gold, kind: "beam" });
        b.parts.push({ x: f.x, y: f.y, z: 0, vx: 10, vy: 0, vz: 0, life: 0.5, max: 0.5, col: PAL.boneHi, kind: "ring" });
        b.holyBurst(f.x, f.y, 40);
        b.sfx.explode(1, 0); b.shake(5); b.hitstop = Math.max(b.hitstop, 0.12);
        let n = 0;
        for (const u of b.units) if (u.team !== h.team && u.active && dist(u.x, u.y, f.x, f.y) < 46) {
          const dmg = u.def.undead ? 140 : 55;
          b.damage(u, dmg * (1 - dist(u.x, u.y, f.x, f.y) / 92), h, false, "blunt", true); n++;
        }
        if (n) b.say(`Słup światła uderza: ${n} trafionych.`, PAL.gold);
      }
    } else if (f.kind === "bash") {
      for (const u of b.units) if (u.team !== h.team && u.active && !f.hit.has(u.id) && dist(u.x, u.y, h.x, h.y) < 16 + u.radius) {
        f.hit.add(u.id);
        b.sfx.kick();
        if (!u.def.poise || chance(0.3)) b.stagger(u, 1.3);
        b.push(u, h.x, h.y, 150);
        b.damage(u, 14, h, false, "blunt", true);
        b.hitstop = Math.max(b.hitstop, 0.07); b.kickCam(Math.cos(h.face), Math.sin(h.face), 1.5);
      }
    } else if (f.kind === "spin") {
      h.face = h.wantFace + (f.t / f.max) * Math.PI * 2;
      if (chance(dt * 40)) b.sparks(h.x + Math.cos(h.face) * 14, h.y - 12 + Math.sin(h.face) * 10, 1, PAL.steelL);
      for (const u of b.units) {
        if (u.team === h.team || !u.active || f.hit.has(u.id)) continue;
        const d = dist(u.x, u.y, h.x, h.y);
        if (d > h.w.reach + 10 + u.radius) continue;
        if (Math.abs(angDiff(h.face, Math.atan2(u.y - h.y, u.x - h.x))) > 0.7) continue;
        f.hit.add(u.id);
        b.damage(u, h.w.dmg.L * 0.9 * u.arm[h.w.type.L], h, false, h.w.type.L, true);
        b.hitstop = Math.max(b.hitstop, 0.05);
      }
    }
  }
  b.fx = b.fx.filter((f) => f.t < f.max + (f.kind === "beam" ? 0.1 : 0));
}

function explodeFire(b: Battle, x: number, y: number, dmg: number, src: Unit) {
  const s = b.vol(x);
  b.sfx.explode(s.v, s.pan);
  b.shake(src.hero ? 4 : 2);
  for (let i = 0; i < 40; i++) { const a = rr(0, 6.28), sp = rr(20, 110); b.parts.push({ x, y, z: rr(2, 10), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp * 0.7, vz: rr(20, 90), life: rr(0.3, 0.8), max: 0.8, col: pick([PAL.gold, PAL.redL, PAL.bloodL, PAL.boneHi]), kind: "fire" }); }
  b.parts.push({ x, y, z: 0, vx: 7, vy: 0, vz: 0, life: 0.35, max: 0.35, col: PAL.gold, kind: "ring" });
  // osmalenie gruntu
  for (let i = 0; i < 70; i++) { const a = rr(0, 6.28), r = Math.sqrt(rnd()) * 18; b.dg.fillStyle = chance(0.7) ? PAL.ink : PAL.dusk; b.dg.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r * 0.7), 1, 1); }
  const R = 34;
  for (const u of b.units) {
    if (!u.active) continue;
    const d = dist(u.x, u.y, x, y);
    if (d > R) continue;
    const k = (1 - (d / R) * 0.5) * (u.team === src.team ? 0.5 : 1);
    if (u.hero && u === src) continue;
    u.burnT = 3;
    b.damage(u, dmg * k * (u.arm.cut * 0.5 + 0.5), src, false, "blunt", true);
    if (u.active && !u.def.poise) b.push(u, x, y, 90);
  }
}

// Umiejętności jednostek: zwykłe AI z czasem odnowienia na jednostce.
function unitAbilityAI(b: Battle, u: Unit, dt: number) {
  u.abilityT -= dt;
  if (u.abilityT > 0) return;
  const ab = u.def.ability;
  const foes = (r: number, x = u.x, y = u.y) => b.units.filter((e) => e.team !== u.team && e.active && !e.hidden && dist(e.x, e.y, x, y) < r);
  const friends = (r: number) => b.units.filter((e) => e.team === u.team && e.active && dist(e.x, e.y, u.x, u.y) < r);
  const s = b.vol(u.x);
  if (ab === "priest") {
    const hurt = friends(90).filter((f) => f.hp < f.maxHp * 0.7);
    const undead = foes(70).filter((e) => e.def.undead);
    if (undead.length >= 2) {
      u.abilityT = rr(9, 12);
      for (const e of undead) b.damage(e, 30, u, false, "blunt", false);
      b.holyBurst(u.x, u.y - 6, 20); b.sfx.smite();
      b.parts.push({ x: u.x, y: u.y, z: 8, vx: 7, vy: 0, vz: 0, life: 0.5, max: 0.5, col: PAL.gold, kind: "ring" });
      return;
    }
    if (hurt.length >= 2) {
      u.abilityT = rr(8, 11);
      for (const f of hurt) { f.hp = Math.min(f.maxHp, f.hp + 22); b.holyBurst(f.x, f.y, 3); }
      b.sfx.heal();
      return;
    }
    u.abilityT = 1;
  } else if (ab === "mage") {
    const t = u.target;
    if (t && t.active && dist(u.x, u.y, t.x, t.y) < 230 && dist(u.x, u.y, t.x, t.y) > 50) {
      // nie strzelaj, jeśli swoi stoją przy celu
      let safe = true;
      for (const f of b.units) if (f.team === u.team && f.active && f !== u && dist(f.x, f.y, t.x, t.y) < 36) { safe = false; break; }
      if (safe) {
        u.abilityT = rr(9, 13);
        const a = Math.atan2(t.y - (u.y - 12), t.x - u.x);
        b.fire(u, a, 220, 40, dist(u.x, u.y, t.x, t.y), "fire");
        return;
      }
    }
    u.abilityT = 0.8;
  } else if (ab === "shaman") {
    const near = foes(120);
    if (near.length) {
      u.abilityT = rr(12, 16);
      b.sfx.drum(s.v); b.sfx.battleCry(s.v * 0.7);
      for (const f of friends(110)) { f.buffT = 9; f.buffDmg = 1.25; f.morale = Math.min(100, f.morale + 20); }
      b.parts.push({ x: u.x, y: u.y, z: 8, vx: 8, vy: 0, vz: 0, life: 0.5, max: 0.5, col: PAL.bloodL, kind: "ring" });
      return;
    }
    u.abilityT = 1;
  } else if (ab === "necro") {
    // podnosi poległych (nie nieumarłych) w pobliżu jako szkielety
    const raised = b.units.filter((x) => x.team === u.team && x.key === "u_skel" && x.lifeT > 0).length;
    const corpses = b.corpses.filter((c) => !c.undead && !c.horse && c.t >= 1 && dist(c.x, c.y, u.x, u.y) < 130);
    if (corpses.length && raised < 14) {
      u.abilityT = rr(7, 10);
      b.sfx.curse(s.v, s.pan);
      const n = Math.min(2, corpses.length);
      for (let i = 0; i < n; i++) {
        const c = corpses[i];
        b.corpses.splice(b.corpses.indexOf(c), 1);
        const z = new Unit("u_skel", u.team, u.team === 1 ? 1 : 20, c.x, c.y, u.team === 1 ? 5 : 9);
        z.lifeT = 9999; z.hp = z.maxHp * 0.7;
        b.units.push(z);
        for (let k = 0; k < 14; k++) b.parts.push({ x: c.x, y: c.y, z: rr(0, 16), vx: rr(-8, 8), vy: rr(-8, 8), vz: rr(10, 40), life: 1, max: 1, col: pick([PAL.purpleL, PAL.purple]), kind: "soul" });
      }
      if (u.team === 1 && b.hero && dist(u.x, u.y, b.hero.x, b.hero.y) < 260) b.say("Nekromanta podnosi poległych!", PAL.purpleL);
      return;
    }
    // klątwa na bohatera lub najbliższego
    const near = foes(150);
    if (near.length) { u.abilityT = rr(10, 14); const t = near[0]; t.cursedT = 6; b.sfx.curse(s.v, s.pan); for (let i = 0; i < 6; i++) b.parts.push({ x: t.x, y: t.y, z: rr(4, 20), vx: rr(-6, 6), vy: rr(-6, 6), vz: rr(5, 20), life: 1, max: 1, col: PAL.purpleL, kind: "soul" }); return; }
    u.abilityT = 1.5;
  } else if (ab === "deathtouch") {
    const t = u.target;
    if (t && t.active && dist(u.x, u.y, t.x, t.y) < 30) {
      u.abilityT = rr(7, 10);
      b.sfx.wail();
      b.damage(t, 45, u, false, "blunt", true);
      u.hp = Math.min(u.maxHp, u.hp + 40);
      for (let i = 0; i < 18; i++) b.parts.push({ x: t.x, y: t.y, z: rr(4, 24), vx: (u.x - t.x) * 1.5 + rr(-10, 10), vy: (u.y - t.y) * 1.5 + rr(-10, 10), vz: rr(5, 20), life: 0.8, max: 0.8, col: pick([PAL.purpleL, PAL.purple]), kind: "soul" });
      if (t.hero) b.say("Dotyk śmierci wysysa z ciebie życie!", PAL.purpleL, true);
      return;
    }
    u.abilityT = 0.5;
  } else u.abilityT = 5;
}

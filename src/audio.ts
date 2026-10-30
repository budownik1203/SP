// Dźwięk generowany w całości kodem: efekty walki z pogłosem, tło (wiatr, wrony, zgiełk) i muzyka (lutnia i burdon).

class Sfx {
  ctx: AudioContext | null = null;
  master: GainNode;
  fx: GainNode;
  rev: GainNode;
  musicBus: GainNode;
  noiseBuf: AudioBuffer;
  last: Record<string, number> = {};
  dinGain: GainNode | null = null;
  musicOn = true;
  intensity = 0;
  private plucks = new Map<number, AudioBuffer>();
  private nextNote = 0;
  private phrase: number[] = [];
  private noteStep = 0;
  private crowT = 8;
  rainGain: GainNode | null = null;
  volume = 1;
  musicVol = 0.6;
  voiceBus: GainNode; uiBus: GainNode;
  busVol = { fx: 1, voice: 1, ui: 1 };
  setBus(k: "fx" | "voice" | "ui", v: number) { this.busVol[k] = v; if (!this.ctx) return; const n = k === "fx" ? this.fx : k === "voice" ? this.voiceBus : this.uiBus; n.gain.setTargetAtTime((k === "fx" ? 0.85 : 0.85) * v, this.ctx.currentTime, 0.1); }
  setMusicVolume(v: number) { this.musicVol = v; if (this.ctx && this.musicOn) this.musicBus.gain.setTargetAtTime(0.5 * v / 0.6, this.ctx.currentTime, 0.2); }

  init() {
    if (this.ctx) { if (this.ctx.state === "suspended") this.ctx.resume(); return; }
    try {
      const c = new AudioContext();
      this.ctx = c;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4;
      this.master = c.createGain(); this.master.gain.value = 0.8 * this.volume;
      this.master.connect(comp); comp.connect(c.destination);
      this.fx = c.createGain(); this.fx.gain.value = 0.85 * this.busVol.fx; this.fx.connect(this.master);
      this.voiceBus = c.createGain(); this.voiceBus.gain.value = 0.85 * this.busVol.voice; this.voiceBus.connect(this.master);
      this.uiBus = c.createGain(); this.uiBus.gain.value = 0.85 * this.busVol.ui; this.uiBus.connect(this.master);
      // pogłos: odpowiedź impulsowa z zanikającego szumu
      const conv = c.createConvolver();
      const len = Math.floor(c.sampleRate * 1.7);
      const ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = ir.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
      }
      conv.buffer = ir;
      this.rev = c.createGain(); this.rev.gain.value = 0.28;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 3200;
      this.rev.connect(lp); lp.connect(conv); conv.connect(this.master);
      this.musicBus = c.createGain(); this.musicBus.gain.value = this.musicOn ? 0.5 * this.musicVol / 0.6 : 0; this.musicBus.connect(this.master);
      const mrev = c.createGain(); mrev.gain.value = 0.35; this.musicBus.connect(mrev); mrev.connect(this.rev);

      const nl = c.sampleRate * 2;
      this.noiseBuf = c.createBuffer(1, nl, c.sampleRate);
      const nd = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
      this.startAmbience();
      this.startMusic();
      this.nextNote = c.currentTime + 1.2;
    } catch (e) { this.ctx = null; }
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    if (this.ctx) this.musicBus.gain.setTargetAtTime(this.musicOn ? 0.5 * this.musicVol / 0.6 : 0, this.ctx.currentTime, 0.3);
    return this.musicOn;
  }

  spatial(x: number, cam: V): { v: number; pan: number } {
    const dx = x - (cam.x + W / 2);
    return { v: clamp(1 - Math.abs(dx) / 520, 0.12, 1), pan: clamp(dx / 300, -0.9, 0.9) };
  }

  private ok(name: string, gapMs: number) {
    if (!this.ctx) return false;
    const now = performance.now();
    if (this.last[name] && now - this.last[name] < gapMs) return false;
    this.last[name] = now;
    return true;
  }

  // wyjście z panoramą i wysyłką na pogłos
  private out(pan: number, wet = 0.3, bus?: AudioNode): AudioNode {
    const c = this.ctx;
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    p.connect(bus || this.fx);
    if (wet > 0) { const s = c.createGain(); s.gain.value = wet; p.connect(s); s.connect(this.rev); }
    return p;
  }
  private env(g: GainNode, peak: number, dur: number, at = 0, attack = 0.003) {
    const t = this.ctx.currentTime + at;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }
  private noise(dest: AudioNode, dur: number, f0: number, f1: number, q: number, peak: number, type: BiquadFilterType = "bandpass", at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(30, f1), t + dur);
    const g = c.createGain(); this.env(g, peak, dur, at);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 1.5); s.stop(t + dur + 0.05);
  }
  private tone(dest: AudioNode, f0: number, f1: number, dur: number, type: OscillatorType, peak: number, at = 0, attack = 0.003) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = c.createGain(); this.env(g, peak, dur, at, attack);
    o.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  private crunch(dest: AudioNode, dur: number, peak: number, freq: number) {
    const c = this.ctx, t = c.currentTime;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const ws = c.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 6); }
    ws.curve = curve;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = freq; f.Q.value = 1.2;
    const g = c.createGain(); this.env(g, peak, dur);
    s.connect(ws); ws.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }

  // ---- Efekty walki ----
  swing(v = 1, pan = 0, weight = 1) {
    if (!this.ok("swing", 35)) return;
    const o = this.out(pan, 0.1);
    const c = this.ctx, t = c.currentTime, dur = 0.16 + weight * 0.08;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.Q.value = 1.6;
    f.frequency.setValueAtTime(350 / weight, t); f.frequency.exponentialRampToValueAtTime(1900 / weight, t + dur * 0.55);
    f.frequency.exponentialRampToValueAtTime(500 / weight, t + dur);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32 * v, t + dur * 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(o); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // Trafienie w ciało. heavy: zamach z góry, wzmocniony cios albo obuch.
  hit(v = 1, pan = 0, type: DmgType = "cut", heavy = false) {
    if (!this.ok("hit", 25)) return;
    const o = this.out(pan, 0.22);
    const k = heavy ? 1.5 : 1.15, p = rr(0.82, 1.2);   // każdy cios brzmi trochę inaczej
    this.tone(o, 95 * (heavy ? 0.8 : 1) * p, 38 * p, heavy ? 0.34 : 0.2, "sine", 0.95 * v * k);   // uderzenie w dół
    this.tone(o, 240 * p, 90 * p, 0.07, "triangle", 0.4 * v);                                    // stuk
    this.noise(o, 0.12 * rr(0.8, 1.3), 1600 * p, 350, 0.9, 0.6 * v * k, "lowpass");              // mięso
    if (type === "cut") this.noise(o, 0.06, 3800 * p, 2200, 2.5, 0.32 * v, "bandpass");          // cięcie
    if (type === "pierce") this.noise(o, 0.05, 2600 * p, 900, 3, 0.3 * v, "bandpass");
    if (type === "blunt" || heavy) this.crunch(o, heavy ? 0.22 : 0.14, 0.4 * v, 700);
  }
  bone(v = 1, pan = 0, heavy = false) {
    if (!this.ok("bone", 25)) return;
    const o = this.out(pan, 0.25);
    for (let i = 0; i < (heavy ? 5 : 3); i++) this.noise(o, 0.03, rr(2200, 3600), 1500, 6, 0.5 * v, "bandpass", i * rr(0.012, 0.025));
    this.tone(o, 520, 300, 0.07, "square", 0.07 * v);
    this.tone(o, 120, 50, 0.14, "sine", (heavy ? 0.8 : 0.5) * v);
    if (heavy) this.crunch(o, 0.18, 0.45 * v, 1800);
  }
  // Metal o metal: składowe nieharmoniczne jak w dzwonie.
  clang(v = 1, pan = 0, pitch = 1) {
    if (!this.ok("clang", 30)) return;
    const o = this.out(pan, 0.5);
    const b = rr(560, 760) * pitch;
    const partials = [[1, 0.9, 0.28], [2.32, 0.6, 0.18], [4.25, 0.4, 0.1], [6.63, 0.25, 0.07], [9.1, 0.15, 0.04]];
    for (const [r, d, gk] of partials) this.tone(o, b * r, b * r * 0.995, d, "sine", gk * v);
    this.noise(o, 0.05, 6500, 4000, 1, 0.45 * v, "highpass");
    this.tone(o, 160, 70, 0.08, "sine", 0.4 * v);
  }
  parry() {
    if (!this.ctx) return;
    this.last.clang = 0;
    this.clang(1.25, 0, 1.35);
    const o = this.out(0, 0.6);
    this.tone(o, 2900, 2850, 0.9, "sine", 0.12);
    this.noise(o, 0.12, 8000, 5000, 1, 0.35, "highpass");
  }
  thunk(v = 1, pan = 0) {
    if (!this.ok("thunk", 25)) return;
    const o = this.out(pan, 0.2);
    this.tone(o, 190, 110, 0.14, "triangle", 0.5 * v);
    this.tone(o, 85, 45, 0.18, "sine", 0.6 * v);
    this.noise(o, 0.09, 700, 400, 2, 0.4 * v, "bandpass");
  }
  kick() {
    if (!this.ok("kick", 40)) return;
    const o = this.out(0, 0.15);
    this.tone(o, 110, 38, 0.18, "sine", 1);
    this.noise(o, 0.1, 600, 150, 1, 0.5, "lowpass");
    this.noise(o, 0.05, 1500, 700, 1, 0.2, "bandpass");
  }
  bow(v = 1, pan = 0) {
    if (!this.ok("bow", 25)) return;
    const o = this.out(pan, 0.15);
    this.tone(o, 300, 230, 0.22, "triangle", 0.25 * v);
    this.tone(o, 150, 120, 0.12, "sine", 0.25 * v);
    this.noise(o, 0.07, 3200, 1200, 2, 0.15 * v, "bandpass");
  }
  arrowHit(v = 1, pan = 0) {
    if (!this.ok("arrow", 25)) return;
    const o = this.out(pan, 0.15);
    this.noise(o, 0.04, 3000, 1500, 2, 0.3 * v, "bandpass");
    this.tone(o, 130, 60, 0.08, "sine", 0.35 * v);
  }
  death(v = 1, pan = 0, undead = false) {
    if (!this.ok("death", 90)) return;
    const o = this.out(pan, 0.35);
    if (undead) {
      for (let i = 0; i < 7; i++) this.noise(o, 0.025, rr(1800, 3400), 1200, 6, 0.35 * v, "bandpass", i * rr(0.02, 0.05));
      this.tone(o, 90, 40, 0.3, "sine", 0.35 * v, 0.1);
      return;
    }
    const c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator(); osc.type = "sawtooth";
    const f0 = rr(150, 210);
    osc.frequency.setValueAtTime(f0, t); osc.frequency.linearRampToValueAtTime(f0 * 1.1, t + 0.1); osc.frequency.exponentialRampToValueAtTime(f0 * 0.45, t + 0.7);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rr(650, 900); bp.Q.value = 4;
    const g = c.createGain(); this.env(g, 0.13 * v, 0.75, 0, 0.04);
    osc.connect(bp); bp.connect(g); g.connect(o); osc.start(t); osc.stop(t + 0.8);
    this.tone(o, 80, 40, 0.3, "sine", 0.5 * v, 0.25);                                          // upadek
    this.noise(o, 0.2, 500, 200, 1, 0.3 * v, "lowpass", 0.25);
  }
  shout(v = 1) {
    if (!this.ok("shout", 350)) return;
    const c = this.ctx, t = c.currentTime;
    const o = this.out(0, 0.4, this.voiceBus);
    for (let i = 0; i < 6; i++) {
      const osc = c.createOscillator(); osc.type = "sawtooth";
      const f0 = rr(105, 175), d = i * 0.025;
      osc.frequency.setValueAtTime(f0, t + d); osc.frequency.linearRampToValueAtTime(f0 * 1.4, t + d + 0.22);
      osc.frequency.linearRampToValueAtTime(f0 * 1.15, t + d + 0.75);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = rr(550, 950); bp.Q.value = 3.5;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t + d);
      g.gain.exponentialRampToValueAtTime(0.045 * v, t + d + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.85);
      osc.connect(bp); bp.connect(g); g.connect(o); osc.start(t + d); osc.stop(t + d + 0.9);
    }
  }
  wail() {
    if (!this.ctx) return;
    const o = this.out(0, 0.8);
    this.tone(o, 460, 95, 1.9, "sawtooth", 0.06, 0, 0.3);
    this.tone(o, 690, 140, 1.7, "sine", 0.08, 0.1, 0.3);
    this.tone(o, 55, 40, 2.0, "sine", 0.35, 0, 0.2);
  }
  ui() { if (!this.ok("ui", 40)) return; const o = this.out(0, 0.05, this.uiBus); this.tone(o, 900, 700, 0.05, "square", 0.035); this.noise(o, 0.03, 2500, 1800, 2, 0.05, "bandpass"); }
  // Odgłos otwieranego okna: szelest pergaminu.
  open() { if (!this.ok("open", 150)) return; const o = this.out(0, 0.1, this.uiBus); this.noise(o, 0.22, 1800, 3800, 0.8, 0.07, "bandpass"); this.noise(o, 0.12, 5000, 2500, 1, 0.03, "highpass", 0.1); }
  // Fanfara na awans: trąby w D-dur.
  fanfare() {
    if (!this.ok("fanfare", 1500)) return;
    const o = this.out(0, 0.7, this.uiBus), c = this.ctx;
    const notes: [number, number, number][] = [[293.66, 0, 0.18], [369.99, 0.18, 0.18], [440, 0.36, 0.18], [587.33, 0.54, 0.9], [440, 0.54, 0.9], [369.99, 0.54, 0.9]];
    for (const [f, at, d] of notes) {
      const t = c.currentTime + at;
      const osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.setValueAtTime(f * 0.97, t); osc.frequency.linearRampToValueAtTime(f, t + 0.05);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(800, t); lp.frequency.linearRampToValueAtTime(2600, t + 0.1);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.setValueAtTime(0.09, t + d * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.25);
      osc.connect(lp); lp.connect(g); g.connect(o); osc.start(t); osc.stop(t + d + 0.3);
    }
    this.tone(o, 73.4, 73.4, 1.4, "sine", 0.3, 0.54, 0.02);
  }

  // Głos: krótki samogłoskowy dźwięk przez dwa formanty.
  private voice(dest: AudioNode, f0: number, f1: number, dur: number, peak: number, formants: number[], at = 0) {
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const mix = c.createGain(); mix.gain.value = 1;
    for (const fq of formants) {
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fq; bp.Q.value = 5;
      o.connect(bp); bp.connect(mix);
    }
    const g = c.createGain(); this.env(g, peak, dur, at, 0.02);
    mix.connect(g); g.connect(dest);
    o.start(t); o.stop(t + dur + 0.05);
  }
  // Głosy ras: ork niżej i chrapliwie, krasnolud niżej i krócej, nieumarły grzechocze.
  private rp(cul = "") { return cul === "orc" ? 0.66 : cul === "dwarf" ? 0.8 : cul === "monster" ? 1.25 : cul === "varus" ? 0.95 : cul === "aurelia" ? 1.06 : 1; }
  private rf(cul = "") { return cul === "orc" ? 0.78 : cul === "dwarf" ? 0.9 : 1; }
  private rattle(o: AudioNode, v: number, n = 5) { for (let i = 0; i < n; i++) this.noise(o, 0.025, rr(1600, 3200), 1100, 6, 0.3 * v, "bandpass", i * rr(0.02, 0.05)); }
  pain(v = 1, pan = 0, cul = "") {
    if (!this.ok("pain", 140)) return;
    const o = this.out(pan, 0.25, this.voiceBus);
    if (cul === "undead") { this.rattle(o, v * 0.7, 3); return; }
    const f = rr(120, 190) * this.rp(cul), k = this.rf(cul);
    this.voice(o, f * 1.15, f * 0.8, rr(0.18, 0.3), 0.18 * v, [rr(500, 750) * k, rr(1000, 1300) * k]);
    if (cul === "orc") this.noise(o, 0.2, 400, 200, 2, 0.08 * v, "bandpass");
  }

  scream(v = 1, pan = 0, cul = "") {
    if (!this.ok("scream", 200)) return;
    const o = this.out(pan, 0.4, this.voiceBus);
    if (cul === "undead") { this.rattle(o, v); this.tone(o, 120, 60, 0.6, "sawtooth", 0.05 * v); return; }
    const f = rr(170, 240) * this.rp(cul), k = this.rf(cul);
    this.voice(o, f, f * 0.5, rr(0.5, 0.8) * (cul === "dwarf" ? 0.7 : 1), 0.16 * v, [rr(650, 850) * k, rr(1100, 1400) * k]);
  }

  battleCry(v = 1, cul = "") {
    if (!this.ok("cry", 900)) return;
    const o = this.out(0, 0.5, this.voiceBus);
    if (cul === "undead") { for (let i = 0; i < 6; i++) this.voice(o, rr(60, 80), rr(45, 55), rr(1.2, 1.8), 0.04 * v, [rr(300, 420), rr(650, 800)], rr(0, 0.4)); this.rattle(o, v, 8); return; }
    const r = this.rp(cul), k = this.rf(cul);
    for (let i = 0; i < 9; i++) {
      const f = rr(100, 170) * r, d = rr(0, 0.25);
      this.voice(o, f, f * rr(1.1, 1.35), rr(0.8, 1.3), 0.05 * v, [rr(600, 800) * k, rr(1050, 1250) * k], d);
    }
    this.tone(o, 70 * r, 50 * r, 0.6, "sine", 0.2 * v);
    if (cul === "orc") for (let i = 0; i < 4; i++) this.noise(o, 0.5, 500, 250, 1.5, 0.12 * v, "bandpass", i * 0.08);
  }

  moan(v = 1, pan = 0) {
    if (!this.ok("moan", 700)) return;
    const o = this.out(pan, 0.6, this.voiceBus);
    const f = rr(70, 110);
    this.voice(o, f, f * 0.7, rr(1, 1.6), 0.09 * v, [rr(300, 450), rr(700, 900)]);
  }

  step(v = 1, heavy = 1) {
    if (!this.ok("step", 90)) return;
    const o = this.out(0, 0.05);
    this.tone(o, 90 * heavy, 50, 0.08, "sine", 0.18 * v);
    this.noise(o, 0.06, 900, 300, 1, 0.07 * v, "lowpass");
    if (chance(0.6)) this.noise(o, 0.05, 6000, 4000, 4, 0.025 * v, "bandpass", 0.01);   // brzęk kolczugi
  }
  hoof(v = 1, pan = 0) {
    if (!this.ok("hoof", 55)) return;
    const o = this.out(pan, 0.1);
    this.tone(o, 140, 60, 0.07, "sine", 0.3 * v);
    this.noise(o, 0.05, 1200, 500, 2, 0.12 * v, "bandpass");
  }
  neigh(v = 1, pan = 0) {
    if (!this.ok("neigh", 1500)) return;
    const o = this.out(pan, 0.5);
    const c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator(); osc.type = "sawtooth";
    osc.frequency.setValueAtTime(700, t); osc.frequency.linearRampToValueAtTime(950, t + 0.15); osc.frequency.linearRampToValueAtTime(500, t + 0.8);
    const lfo = c.createOscillator(); lfo.frequency.value = 22; const lg = c.createGain(); lg.gain.value = 60; lfo.connect(lg); lg.connect(osc.frequency);
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1500; bp.Q.value = 2;
    const g = c.createGain(); this.env(g, 0.08 * v, 0.85, 0, 0.03);
    osc.connect(bp); bp.connect(g); g.connect(o); osc.start(t); lfo.start(t); osc.stop(t + 0.9); lfo.stop(t + 0.9);
  }
  trample(v = 1, pan = 0) {
    if (!this.ok("trample", 60)) return;
    const o = this.out(pan, 0.3);
    this.tone(o, 80, 30, 0.35, "sine", 0.9 * v);
    this.crunch(o, 0.2, 0.35 * v, 500);
  }

  // ---- Tło ----
  private startAmbience() {
    const c = this.ctx;
    const wind = c.createBufferSource(); wind.buffer = this.noiseBuf; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = "lowpass"; wf.frequency.value = 420;
    const wg = c.createGain(); wg.gain.value = 0.06;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 0.035; lfo.connect(lg); lg.connect(wg.gain);
    const lfo2 = c.createOscillator(); lfo2.frequency.value = 0.11;
    const lg2 = c.createGain(); lg2.gain.value = 180; lfo2.connect(lg2); lg2.connect(wf.frequency);
    wind.connect(wf); wf.connect(wg); wg.connect(this.master);
    wind.start(); lfo.start(); lfo2.start();
    // zgiełk bitwy zależny od natężenia walki
    const din = c.createBufferSource(); din.buffer = this.noiseBuf; din.loop = true; din.playbackRate.value = 0.7;
    const df = c.createBiquadFilter(); df.type = "bandpass"; df.frequency.value = 380; df.Q.value = 0.6;
    this.dinGain = c.createGain(); this.dinGain.gain.value = 0;
    din.connect(df); df.connect(this.dinGain); this.dinGain.connect(this.master);
    din.start();
    // deszcz: szum wysokich częstotliwości
    const rn = c.createBufferSource(); rn.buffer = this.noiseBuf; rn.loop = true;
    const rf = c.createBiquadFilter(); rf.type = "highpass"; rf.frequency.value = 2200;
    this.rainGain = c.createGain(); this.rainGain.gain.value = 0;
    rn.connect(rf); rf.connect(this.rainGain); this.rainGain.connect(this.master); rn.start();
  }

  // ---- Umiejętności ----
  smite() {
    if (!this.ok("smite", 80)) return;
    const o = this.out(0, 0.7);
    this.tone(o, 880, 1320, 0.6, "triangle", 0.25, 0, 0.01);
    this.tone(o, 660, 990, 0.7, "sine", 0.2, 0.02, 0.01);
    this.noise(o, 0.5, 4000, 1200, 0.8, 0.3);
    this.tone(o, 90, 40, 0.5, "sine", 0.8);
  }
  fireball(v = 1, pan = 0) {
    if (!this.ok("fireball", 60)) return;
    const o = this.out(pan, 0.4);
    this.noise(o, 0.45, 300, 1600, 1, 0.5 * v);
  }
  explode(v = 1, pan = 0) {
    if (!this.ok("explode", 60)) return;
    const o = this.out(pan, 0.6);
    this.tone(o, 110, 30, 0.7, "sine", 1 * v);
    this.crunch(o, 0.5, 0.6 * v, 700);
    this.noise(o, 0.9, 1800, 200, 0.7, 0.5 * v, "lowpass");
  }
  // Wiara: jasne dzwony i chór w dur. Mrok: tryton, pulsujący dół i odwrócony szum.
  heal() {
    if (!this.ok("heal", 100)) return;
    const o = this.out(0, 0.8);
    [293.66, 369.99, 440, 587.33].forEach((f, i) => this.tone(o, f, f, 1.2, "sine", 0.12, i * 0.08, 0.05));
    for (const [r, g2] of [[1, 0.08], [2.76, 0.04], [5.4, 0.02]]) this.tone(o, 880 * r, 880 * r, 1.4, "sine", g2, 0.3);
  }

  curse(v = 1, pan = 0) {
    if (!this.ok("curse", 100)) return;
    const o = this.out(pan, 0.8), c = this.ctx, t = c.currentTime;
    this.tone(o, 160, 90, 1.1, "sawtooth", 0.1 * v, 0, 0.05);
    this.tone(o, 226, 127, 1.1, "sawtooth", 0.08 * v, 0, 0.05);                 // tryton
    const s2 = c.createBufferSource(); s2.buffer = this.noiseBuf;
    const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.setValueAtTime(200, t); f.frequency.exponentialRampToValueAtTime(900, t + 0.9); f.Q.value = 3;
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25 * v, t + 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + 1);
    s2.connect(f); f.connect(g); g.connect(o); s2.start(t); s2.stop(t + 1.05);
    this.tone(o, 45, 35, 1.2, "sine", 0.4 * v, 0, 0.2);
  }

  howl(v = 1, pan = 0) {
    if (!this.ok("howl", 200)) return;
    const o = this.out(pan, 0.8), c = this.ctx, t = c.currentTime;
    const osc = c.createOscillator(); osc.type = "triangle";
    osc.frequency.setValueAtTime(380, t); osc.frequency.linearRampToValueAtTime(620, t + 0.4); osc.frequency.linearRampToValueAtTime(420, t + 1.4);
    const g = c.createGain(); this.env(g, 0.18 * v, 1.5, 0, 0.2);
    osc.connect(g); g.connect(o); osc.start(t); osc.stop(t + 1.6);
  }
  horn(v = 1) {
    if (!this.ok("horn", 500)) return;
    const o = this.out(0, 0.9), c = this.ctx, t = c.currentTime;
    for (const [f, d] of [[146.8, 0], [220, 0.02]]) {
      const osc = c.createOscillator(); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(f * 0.94, t + d); osc.frequency.linearRampToValueAtTime(f, t + d + 0.25);
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 * v, t + 0.2); g.gain.setValueAtTime(0.16 * v, t + 1.1); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.6);
      osc.connect(lp); lp.connect(g); g.connect(o); osc.start(t); osc.stop(t + 1.7);
    }
  }
  hammer() { if (!this.ok("hammer", 200)) return; const o = this.out(0, 0.3); for (let i = 0; i < 3; i++) { this.tone(o, 1400, 1300, 0.08, "square", 0.05, i * 0.28); this.noise(o, 0.05, 5000, 3000, 2, 0.2, "highpass", i * 0.28); } }
  drink() { if (!this.ok("drink", 300)) return; const o = this.out(0, 0.3); this.noise(o, 0.6, 500, 300, 0.7, 0.12, "lowpass"); this.tone(o, 900, 1200, 0.05, "sine", 0.05, 0.2); }
  bell() { if (!this.ok("bell", 2000)) return; const o = this.out(0, 0.8); for (const [r, g2] of [[1, 0.2], [2.76, 0.1], [5.4, 0.05]]) this.tone(o, 330 * r, 330 * r * 0.998, 1.6, "sine", g2); }
  // Krótkie mruknięcie w dialogu, inne dla ras.
  grunt(kind = "human") {
    if (!this.ok("grunt", 300)) return;
    const o = this.out(0, 0.4, this.voiceBus);
    const f = kind === "orc" ? 90 : kind === "dwarf" ? 120 : kind === "undead" || kind === "skel" ? 70 : kind === "wolf" ? 220 : rr(140, 190);
    if (kind === "undead" || kind === "skel") { this.noise(o, 0.5, 600, 200, 2, 0.25, "bandpass"); this.tone(o, f, f * 0.7, 0.5, "sawtooth", 0.06); return; }
    if (kind === "wolf") { this.tone(o, f, f * 0.6, 0.35, "sawtooth", 0.08); this.noise(o, 0.3, 900, 400, 3, 0.15, "bandpass"); return; }
    this.tone(o, f, f * rr(0.8, 0.95), 0.18, "sawtooth", 0.07); this.tone(o, f * 2.1, f * 1.8, 0.16, "triangle", 0.04, 0.02);
    this.noise(o, 0.12, 700, 300, 2, 0.08, "bandpass");
  }
  coin() { if (!this.ok("coin", 60)) return; const o = this.out(0, 0.2, this.uiBus); this.tone(o, 1800, 1700, 0.12, "square", 0.04); this.tone(o, 2400, 2300, 0.15, "square", 0.03, 0.06); }
  page() { if (!this.ok("page", 60)) return; const o = this.out(0, 0.1, this.uiBus); this.noise(o, 0.12, 3000, 1500, 1, 0.08); }
  drum(v = 1) { if (!this.ok("drum", 120)) return; const o = this.out(0, 0.5); this.tone(o, 70, 40, 0.4, "sine", 0.7 * v); this.noise(o, 0.1, 300, 100, 1, 0.2 * v); }
  private crow() {
    const o = this.out(rr(-0.8, 0.8), 0.6);
    const n = 2 + Math.floor(rnd() * 2);
    for (let i = 0; i < n; i++) {
      const c = this.ctx, t = c.currentTime + i * 0.32;
      const osc = c.createOscillator(); osc.type = "sawtooth";
      osc.frequency.setValueAtTime(620, t); osc.frequency.exponentialRampToValueAtTime(430, t + 0.2);
      const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = 1300; bp.Q.value = 5;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.connect(bp); bp.connect(g); g.connect(o); osc.start(t); osc.stop(t + 0.25);
    }
  }

  // ---- Muzyka: nastroje (lutnia, bębny, chór, burdon) ----
  // Nastrój zależy od miejsca: region mapy, noc, karczma, targ, zamek, bitwa z daną rasą, cisza przed bitwą.
  mood = "title";
  private moodNext = "";
  private moodAt = 0;
  private moodGain: GainNode;
  private drone: OscillatorNode[] = [];
  private droneGain: GainNode;
  private choir: OscillatorNode[] = [];
  private choirGain: GainNode;
  private beatN = 0;
  private chordAt = 0;
  private M: MoodDef = MOODS.title;
  private amb = { birdT: 3, stepT: 0, bellT: 10, wolfT: 15, riverGain: null as GainNode | null };
  private windGain: GainNode | null = null;
  // dzwon z odległego miasta: głęboki, z pogłosem
  private townBell() { const o = this.out(rr(-0.6, 0.6), 0.25); const n = 2 + Math.floor(rnd() * 3); for (let i = 0; i < n; i++) for (const [r, g2] of [[1, 0.12], [2.4, 0.05], [0.5, 0.06]]) this.tone(o, 196 * r, 196 * r * 0.998, 2.4, "sine", g2, i * 1.3); }
  // Pieśń barda: prosta melodia na lutni, nuta po nucie (stopnie skali).
  bardTune(notes: number[], beat = 0.32) { if (!this.ctx) return; const c = this.ctx, root = 196, mode = MODES.mixo; notes.forEach((n, i) => { const oct = Math.floor(n / 7), d = ((n % 7) + 7) % 7; const hz = root * Math.pow(2, oct + mode[d] / 12); this.pluck(hz, c.currentTime + 0.1 + i * beat, 0.25, 0); if (i % 4 === 0) this.pluck(hz / 2, c.currentTime + 0.1 + i * beat + 0.01, 0.12, 0); }); }
  setMood(m: string) {
    if (!MOODS[m]) m = "map_wild";
    if (m === this.mood && !this.moodNext) return;
    if (m === this.moodNext) return;
    this.moodNext = m;
    if (!this.ctx) { this.mood = m; this.M = MOODS[m]; this.moodNext = ""; return; }
    const c = this.ctx;
    // przed bitwą: szybkie wyciszenie (cisza), poza tym łagodne przejście
    const fast = m === "silence" || this.mood === "silence", slow = MOODS[m].slow || MOODS[this.mood]?.slow || !MOODS[m].battle;
    this.moodGain.gain.setTargetAtTime(0, c.currentTime, fast ? 0.15 : slow ? 1.1 : 0.5);   // płynne przejścia: na mapie wolno, w bitwie szybciej
    this.moodAt = c.currentTime + (fast ? 0.4 : slow ? 3.2 : 1.4);
  }
  private applyMood() {
    const c = this.ctx, M = MOODS[this.moodNext];
    this.mood = this.moodNext; this.moodNext = ""; this.M = M;
    const r = M.root / 2;
    [r, r * 1.5, r * 1.003].forEach((hz, i) => this.drone[i].frequency.setTargetAtTime(hz, c.currentTime, 0.3));
    this.droneGain.gain.setTargetAtTime(M.drone, c.currentTime, 0.5);
    this.choirGain.gain.setTargetAtTime(M.choir * 0.05, c.currentTime, 0.8);
    this.moodGain.gain.setTargetAtTime(M.silent ? 0 : 0.72, c.currentTime, M.slow ? 1.5 : 0.6);   // muzyka cicho w tle
    if (this.organGain) this.organGain.gain.setTargetAtTime(0, c.currentTime, 0.4);
    this.chordAt = 0; this.phrase = []; this.noteStep = 0; this.nextNote = Math.max(this.nextNote, c.currentTime + 0.3);
  }
  private startMusic() {
    const c = this.ctx;
    this.moodGain = c.createGain(); this.moodGain.gain.value = 1; this.moodGain.connect(this.musicBus);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 340; f.Q.value = 2;
    this.droneGain = c.createGain(); this.droneGain.gain.value = this.M.drone;
    for (const [hz, det] of [[73.42, 0], [110, 3], [73.42, -4]]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz; o.detune.value = det;
      o.connect(f); o.start(); this.drone.push(o);
    }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    f.connect(this.droneGain); this.droneGain.connect(this.moodGain);
    // chór: trzy głosy, każdy z dwóch rozstrojonych pił przez formanty „aaa”
    this.choirGain = c.createGain(); this.choirGain.gain.value = this.M.choir * 0.05;
    const mix = c.createGain(); mix.gain.value = 1;
    for (const fq of [650, 1080, 2400]) { const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fq; bp.Q.value = fq > 2000 ? 8 : 4; mix.connect(bp); bp.connect(this.choirGain); }
    const vib = c.createOscillator(); vib.frequency.value = 5.2; const vg = c.createGain(); vg.gain.value = 3; vib.connect(vg); vib.start();
    for (let i = 0; i < 6; i++) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = 147; o.detune.value = i % 2 ? 9 : -9;
      vg.connect(o.detune); o.connect(mix); o.start(); this.choir.push(o);
    }
    this.choirGain.connect(this.moodGain);
    const cs = c.createGain(); cs.gain.value = 0.5; this.choirGain.connect(cs); cs.connect(this.rev);
    // szum rzeki (tło mapy)
    const rn = c.createBufferSource(); rn.buffer = this.noiseBuf; rn.loop = true; rn.playbackRate.value = 0.5;
    const rf = c.createBiquadFilter(); rf.type = "bandpass"; rf.frequency.value = 700; rf.Q.value = 0.4;
    const rg = c.createGain(); rg.gain.value = 0; rn.connect(rf); rf.connect(rg); rg.connect(this.master); rn.start();
    const rl = c.createOscillator(); rl.frequency.value = 0.3; const rlg = c.createGain(); rlg.gain.value = 250; rl.connect(rlg); rlg.connect(rf.frequency); rl.start();
    this.amb.riverGain = rg;
  }
  private pluckBuf(freq: number) {
    const key = Math.round(freq * 10);
    let b = this.plucks.get(key);
    if (b) return b;
    const sr = this.ctx.sampleRate, len = Math.floor(sr * 2.2);
    b = this.ctx.createBuffer(1, len, sr);
    const d = b.getChannelData(0);
    const N = Math.max(2, Math.round(sr / freq));
    const ring = new Float32Array(N);
    let prev = 0;
    for (let i = 0; i < N; i++) { const r = Math.random() * 2 - 1; prev = prev * 0.5 + r * 0.5; ring[i] = prev; }
    for (let i = 0; i < len; i++) {
      const j = i % N;
      d[i] = ring[j];
      ring[j] = 0.4985 * (ring[j] + ring[(j + 1) % N]);
    }
    this.plucks.set(key, b);
    return b;
  }
  private pluck(freq: number, at: number, vol: number, pan = -0.2) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.pluckBuf(freq);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 1600 + this.M.bright * 1600;
    const g = c.createGain(); g.gain.value = vol;
    const p = c.createStereoPanner(); p.pan.value = pan;
    s.connect(f); f.connect(g); g.connect(p); p.connect(this.moodGain);
    s.start(at); s.stop(at + 2.2);
  }
  private mdrum(at: number, heavy: boolean, v: number, snare = false) {
    const c = this.ctx;
    if (snare) {
      const s = c.createBufferSource(); s.buffer = this.noiseBuf;
      const f = c.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 1800; f.Q.value = 0.8;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.18 * v, at + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, at + 0.14);
      s.connect(f); f.connect(g); g.connect(this.moodGain); s.start(at, Math.random()); s.stop(at + 0.16);
      return;
    }
    const o = c.createOscillator(); o.type = "sine";
    const f0 = heavy ? 62 : 95;
    o.frequency.setValueAtTime(f0 * 1.6, at); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, at + (heavy ? 0.45 : 0.25));
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime((heavy ? 0.75 : 0.45) * v, at + 0.006); g.gain.exponentialRampToValueAtTime(0.0001, at + (heavy ? 0.55 : 0.3));
    o.connect(g); g.connect(this.moodGain); o.start(at); o.stop(at + 0.6);
    if (heavy) { const s = c.createBufferSource(); s.buffer = this.noiseBuf; const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 400; const g2 = c.createGain(); g2.gain.setValueAtTime(0.0001, at); g2.gain.exponentialRampToValueAtTime(0.2 * v, at + 0.005); g2.gain.exponentialRampToValueAtTime(0.0001, at + 0.2); s.connect(f); f.connect(g2); g2.connect(this.moodGain); s.start(at, Math.random()); s.stop(at + 0.25); }
  }
  // ---- Instrumenty frakcji ----
  private organGain: GainNode | null = null;
  private bellNote(hz: number, at: number, v: number) {
    const c = this.ctx;
    for (const [r, g0, d] of [[1, 0.09, 2.2], [2.76, 0.04, 1.4], [5.4, 0.02, 0.8], [0.5, 0.05, 2.6]] as [number, number, number][]) {
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = hz * r;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(g0 * v, at + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, at + d);
      o.connect(g); g.connect(this.moodGain); const s = c.createGain(); s.gain.value = 0.4; g.connect(s); s.connect(this.rev); o.start(at); o.stop(at + d + 0.1);
    }
  }
  private hornNote(hz: number, at: number, dur: number, v: number) {
    const c = this.ctx;
    for (const det of [0, 6]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(hz * 0.97, at); o.frequency.linearRampToValueAtTime(hz, at + 0.12); o.detune.value = det;
      const lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.setValueAtTime(300, at); lp.frequency.linearRampToValueAtTime(700 + this.M.bright * 500, at + 0.25);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.05 * v, at + 0.22); g.gain.setValueAtTime(0.05 * v, at + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(lp); lp.connect(g); g.connect(this.moodGain); o.start(at); o.stop(at + dur + 0.05);
    }
  }
  private organChord(hzs: number[], at: number, dur: number, v: number) {
    const c = this.ctx;
    if (!this.organGain) { this.organGain = c.createGain(); this.organGain.connect(this.moodGain); const s = c.createGain(); s.gain.value = 0.6; this.organGain.connect(s); s.connect(this.rev); }
    this.organGain.gain.setTargetAtTime(1, at, 0.05);
    for (const hz of hzs) for (const [h, g0] of [[1, 0.025], [2, 0.012], [3, 0.006], [0.5, 0.015]] as [number, number][]) {
      const o = c.createOscillator(); o.type = "sine"; o.frequency.value = hz * h;
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(g0 * v, at + 0.35); g.gain.setValueAtTime(g0 * v, at + dur - 0.4); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g); g.connect(this.organGain); o.start(at); o.stop(at + dur + 0.05);
    }
  }
  private throatHum(hz: number, at: number, dur: number, v: number) {   // gardłowe głosy orków
    const c = this.ctx;
    const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.setValueAtTime(hz, at); o.frequency.linearRampToValueAtTime(hz * 0.94, at + dur);
    const mix = c.createGain(); mix.gain.value = 1; o.connect(mix);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); g.gain.exponentialRampToValueAtTime(0.06 * v, at + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    for (const fq of [400, 900]) { const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.frequency.value = fq; bp.Q.value = 6; mix.connect(bp); bp.connect(g); }
    g.connect(this.moodGain); o.start(at); o.stop(at + dur + 0.05);
  }
  private whisperAt(at: number, v: number) {   // szepty Morvatha
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.noiseBuf;
    const bp = c.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 9; bp.frequency.setValueAtTime(rr(1800, 2600), at); bp.frequency.linearRampToValueAtTime(rr(900, 1500), at + 0.9);
    const g = c.createGain(); g.gain.setValueAtTime(0.0001, at); for (let i = 0; i < 5; i++) { g.gain.exponentialRampToValueAtTime(0.03 * v * rr(0.5, 1), at + 0.1 + i * 0.18); g.gain.exponentialRampToValueAtTime(0.002, at + 0.18 + i * 0.18); }
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.1);
    const p = c.createStereoPanner(); p.pan.value = rr(-0.9, 0.9);
    s.connect(bp); bp.connect(g); g.connect(p); p.connect(this.moodGain); const r = c.createGain(); r.gain.value = 0.7; g.connect(r); r.connect(this.rev);
    s.start(at, Math.random() * 2); s.stop(at + 1.2);
  }
  private scaleHz(i: number) { const M = this.M, n = M.mode.length; const oct = Math.floor(i / n), deg = ((i % n) + n) % n; return M.root * Math.pow(2, oct + M.mode[deg] / 12); }
  private makePhrase() {
    const n = 8, top = this.M.mode.length * 2 - 1;
    if (this.M.motif && chance(0.45)) {   // motyw frakcji, czasem przesunięty o tercję albo z wariacją
      const sh = pick([0, 0, 2, 4]); return this.M.motif.map((d, i) => i > 0 && i < 7 && chance(0.15) ? clamp(d + sh + pick([-1, 1]), 0, top) : clamp(d + sh, 0, top));
    }
    const out: number[] = [];
    let idx = pick([0, 2, 4]);
    for (let i = 0; i < n; i++) {
      if (i > 0) idx = clamp(idx + pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]), 0, top);
      out.push(chance(this.M.rest) && i % 2 === 1 ? -1 : idx);
    }
    out[n - 1] = pick([0, 2, 4]);
    return out;
  }
  private setChord(at: number) {
    const deg = pick([0, 0, 3, 4, 5, 2]), n = this.M.mode.length;
    const notes = [deg, deg + 2, deg + 4].map((d) => this.scaleHz(d) / (this.M.root > 180 ? 2 : 1));
    notes.forEach((hz, i) => { this.choir[i * 2].frequency.setTargetAtTime(hz, at, 0.25); this.choir[i * 2 + 1].frequency.setTargetAtTime(hz, at, 0.25); });
    void n;
  }

  setVolume(v: number) { this.volume = v; if (this.ctx) this.master.gain.setTargetAtTime(0.8 * v, this.ctx.currentTime, 0.1); }
  tick(dt: number, intensity: number, rain = false, amb?: { day?: boolean; water?: number; moving?: boolean; mounted?: boolean; winter?: boolean; wind?: number; bell?: boolean; wolves?: boolean; crows?: boolean }) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (this.moodNext && c.currentTime >= this.moodAt) this.applyMood();
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(rain ? 0.07 : 0, c.currentTime, 0.8);
    this.intensity = lerp(this.intensity, intensity, clamp(dt * 1.5, 0, 1));
    if (this.dinGain) this.dinGain.gain.setTargetAtTime(this.intensity * 0.09, c.currentTime, 0.4);
    this.crowT -= dt;
    if (this.crowT <= 0) { this.crowT = rr(9, 22); if (this.intensity < 0.4 && (!amb || !amb.day || chance(0.4))) this.crow(); }
    // tło mapy: ptaki za dnia, rzeka w pobliżu wody, kroki maszerującej drużyny
    if (this.amb.riverGain) this.amb.riverGain.gain.setTargetAtTime(amb ? clamp(amb.water || 0, 0, 1) * 0.06 : 0, c.currentTime, 0.6);
    if (this.ctx && !this.windGain) {   // wiatr: szum z wolno falującym filtrem
      const wn = c.createBufferSource(); wn.buffer = this.noiseBuf; wn.loop = true; wn.playbackRate.value = 0.35;
      const wf = c.createBiquadFilter(); wf.type = "bandpass"; wf.frequency.value = 420; wf.Q.value = 0.7;
      this.windGain = c.createGain(); this.windGain.gain.value = 0; wn.connect(wf); wf.connect(this.windGain); this.windGain.connect(this.master); wn.start();
      const wl = c.createOscillator(); wl.frequency.value = 0.11; const wlg = c.createGain(); wlg.gain.value = 260; wl.connect(wlg); wlg.connect(wf.frequency); wl.start();
    }
    if (this.windGain) this.windGain.gain.setTargetAtTime(amb ? (amb.wind || 0) * 0.05 : 0, c.currentTime, 1.2);
    if (amb) {
      this.amb.bellT -= dt; if (amb.bell && this.amb.bellT <= 0) { this.amb.bellT = rr(35, 80); this.townBell(); }
      this.amb.wolfT -= dt; if (amb.wolves && this.amb.wolfT <= 0) { this.amb.wolfT = rr(20, 50); this.howl(0.25, rr(-0.8, 0.8)); }
      if (amb.crows && this.crowT > 5) this.crowT = rr(2, 5);
      this.amb.birdT -= dt;
      if (this.amb.birdT <= 0) { this.amb.birdT = rr(2.5, 7); if (amb.day && !rain && !amb.winter) this.bird(); }
      if (amb.moving) { this.amb.stepT -= dt; if (this.amb.stepT <= 0) { this.amb.stepT = amb.mounted ? 0.32 : 0.45; if (amb.mounted) this.hoof(0.25, rr(-0.2, 0.2)); else this.step(0.45, rr(0.9, 1.1)); } }
    }
    if (!this.musicOn || this.M.silent) { this.nextNote = Math.max(this.nextNote, c.currentTime + 0.5); return; }
    const M = this.M;
    const beat = M.beat * (M.battle ? 1 - this.intensity * 0.18 : 1);
    while (this.nextNote < c.currentTime + 0.25) {
      const at = this.nextNote;
      // bębny: wzór na 8 uderzeń, w bitwie gęstnieje z natężeniem walki
      const dv = M.drum * (M.battle ? 0.45 + this.intensity * 0.9 : 1);
      if (dv > 0.02) {
        const b = this.beatN % 8;
        const pat = M.heavy ? [1, 0, 0, 1, 1, 0, 1, 0] : [1, 0, 2, 0, 1, 0, 2, 0];
        const fill = M.battle && this.intensity > 0.55 && chance(this.intensity * 0.6);
        if (pat[b] === 1) this.mdrum(at, !!M.heavy, dv);
        else if (pat[b] === 2) this.mdrum(at, false, dv * 0.8, true);
        else if (fill) this.mdrum(at, !!M.heavy, dv * 0.5, !M.heavy);
        if (M.battle && this.intensity > 0.75 && b % 2 === 1) this.mdrum(at + beat / 2, false, dv * 0.4, true);
      }
      if (M.choir > 0 && (this.beatN % 8 === 0 || !this.chordAt)) { this.setChord(at); this.chordAt = at; }
      if (this.beatN % 8 === 0) {   // instrumenty frakcji na początku taktu
        if (M.horn && chance(M.horn)) { this.hornNote(this.scaleHz(0) / 2, at, beat * 3.5, 1); if (chance(0.5)) this.hornNote(this.scaleHz(4) / 2, at + beat * 4, beat * 3, 0.8); }
        if (M.organ && chance(M.organ)) { const d = pick([0, 3, 4, 5]); this.organChord([this.scaleHz(d) / 2, this.scaleHz(d + 2) / 2, this.scaleHz(d + 4) / 2], at, beat * 8, 1); }
        if (M.whisper && chance(M.whisper)) this.whisperAt(at + beat * rr(0, 4), 1);
      }
      if (M.throat && M.heavy && this.beatN % 4 === 0 && chance(M.throat)) this.throatHum(this.scaleHz(0) / 2, at, beat * 1.6, 1);
      this.beatN++;
      if (this.noteStep >= this.phrase.length) {
        this.phrase = this.makePhrase(); this.noteStep = 0;
        if (chance(0.35)) { this.nextNote += beat * 4; this.beatN += 3; continue; }   // oddech między frazami
      }
      const n = this.phrase[this.noteStep++];
      const long = this.noteStep === this.phrase.length;
      if (n >= 0 && M.bell && (this.noteStep === 1 || long) && chance(M.bell)) this.bellNote(this.scaleHz(n) * 2, at, 1);
      if (n >= 0 && chance(M.lute)) {
        this.pluck(this.scaleHz(n), at, 0.22 * M.luteVol);
        if (long || chance(0.18)) this.pluck(this.scaleHz(n - 4) / (n >= 4 ? 1 : 2), at + 0.012, 0.13 * M.luteVol);
        if (M.tavern && chance(0.4)) this.pluck(this.scaleHz(n + 2), at + beat / 2, 0.12, 0.25);
      }
      this.nextNote += beat * (long ? 3 : chance(0.15) ? 0.5 : 1);
    }
  }
  private bird() {
    const o = this.out(rr(-0.8, 0.8), 0.3);
    const f = rr(2600, 4200), n = 2 + Math.floor(rnd() * 4);
    for (let i = 0; i < n; i++) this.tone(o, f * rr(0.9, 1.1), f * rr(1.1, 1.4), 0.06, "sine", 0.025, i * rr(0.08, 0.14), 0.01);
  }

}

interface MoodDef { root: number; mode: number[]; beat: number; lute: number; luteVol: number; rest: number; drum: number; heavy?: boolean; choir: number; drone: number; bright: number; battle?: boolean; tavern?: boolean; silent?: boolean;
  motif?: number[]; bell?: number; horn?: number; organ?: number; throat?: number; whisper?: number; slow?: boolean; }
const MODES = { dorian: [0, 2, 3, 5, 7, 9, 10], phryg: [0, 1, 3, 5, 7, 8, 10], aeol: [0, 2, 3, 5, 7, 8, 10], mixo: [0, 2, 4, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11], penta: [0, 3, 5, 7, 10] };
// Motywy frakcji (stopnie skali): wracają w melodii na mapie i w bitwie.
const MOTIF = { aurelia: [0, 2, 4, 5, 4, 2, 3, 0], varus: [0, 0, 4, 4, 3, 2, 1, 0], dwarf: [0, 4, 3, 2, 0, -1, 0, 0], orc: [0, 0, 2, 0, 3, 2, 0, 0], undead: [0, 1, 0, -1, 0, 3, 1, 0] };
const MOODS: Record<string, MoodDef> = {
  title: { root: 146.83, mode: MODES.dorian, beat: 0.42, lute: 0.9, luteVol: 1, rest: 0.25, drum: 0, choir: 0.35, drone: 0.05, bright: 0.3, bell: 0.15 },
  // Aurelia: dzwony i chór; Legion: bębny i rogi; krasnoludy: niskie rogi; orkowie: bębny i gardłowe głosy; Morvath: organy i szepty
  map_aurelia: { root: 146.83, mode: MODES.dorian, beat: 0.34, lute: 1, luteVol: 1, rest: 0.22, drum: 0, choir: 0.22, drone: 0.05, bright: 0.5, motif: MOTIF.aurelia, bell: 0.35 },
  map_varus: { root: 110, mode: MODES.aeol, beat: 0.32, lute: 0.8, luteVol: 1, rest: 0.2, drum: 0.24, choir: 0.06, drone: 0.05, bright: 0.4, motif: MOTIF.varus, horn: 0.35 },
  map_dwarf: { root: 98, mode: MODES.aeol, beat: 0.4, lute: 0.55, luteVol: 1.1, rest: 0.3, drum: 0.28, heavy: true, choir: 0.3, drone: 0.06, bright: 0.2, motif: MOTIF.dwarf, horn: 0.45 },
  map_orc: { root: 82.4, mode: MODES.penta, beat: 0.3, lute: 0.4, luteVol: 1.2, rest: 0.35, drum: 0.55, heavy: true, choir: 0, drone: 0.06, bright: 0.2, motif: MOTIF.orc, throat: 0.5 },
  map_undead: { root: 82.4, mode: MODES.phryg, beat: 0.55, lute: 0.25, luteVol: 1, rest: 0.45, drum: 0.08, heavy: true, choir: 0.4, drone: 0.08, bright: 0, motif: MOTIF.undead, organ: 0.7, whisper: 0.4 },
  map_wild: { root: 146.83, mode: MODES.aeol, beat: 0.36, lute: 0.8, luteVol: 1, rest: 0.3, drum: 0, choir: 0.05, drone: 0.05, bright: 0.3 },
  night: { root: 110, mode: MODES.aeol, beat: 0.62, lute: 0.35, luteVol: 0.7, rest: 0.55, drum: 0, choir: 0.2, drone: 0.04, bright: 0, slow: true },
  tavern: { root: 196, mode: MODES.mixo, beat: 0.22, lute: 1, luteVol: 1, rest: 0.1, drum: 0.35, choir: 0, drone: 0.02, bright: 0.8, tavern: true },
  market: { root: 146.83, mode: MODES.mixo, beat: 0.28, lute: 0.9, luteVol: 1, rest: 0.18, drum: 0.2, choir: 0, drone: 0.03, bright: 0.7, bell: 0.12 },
  castle: { root: 146.83, mode: MODES.dorian, beat: 0.5, lute: 0.35, luteVol: 0.8, rest: 0.3, drum: 0.1, heavy: true, choir: 0.5, drone: 0.07, bright: 0.3, horn: 0.25, organ: 0.25 },
  battle_human: { root: 146.83, mode: MODES.aeol, beat: 0.28, lute: 0.5, luteVol: 1, rest: 0.25, drum: 0.6, choir: 0.2, drone: 0.05, bright: 0.4, battle: true },
  battle_aurelia: { root: 146.83, mode: MODES.dorian, beat: 0.28, lute: 0.5, luteVol: 1, rest: 0.25, drum: 0.55, choir: 0.35, drone: 0.05, bright: 0.45, battle: true, motif: MOTIF.aurelia, bell: 0.25 },
  battle_varus: { root: 110, mode: MODES.aeol, beat: 0.27, lute: 0.4, luteVol: 1, rest: 0.22, drum: 0.75, choir: 0.15, drone: 0.05, bright: 0.35, battle: true, motif: MOTIF.varus, horn: 0.45 },
  battle_orc: { root: 82.4, mode: MODES.penta, beat: 0.26, lute: 0.3, luteVol: 1, rest: 0.3, drum: 0.85, heavy: true, choir: 0, drone: 0.07, bright: 0.2, battle: true, motif: MOTIF.orc, throat: 0.6 },
  battle_undead: { root: 82.4, mode: MODES.phryg, beat: 0.34, lute: 0.2, luteVol: 1, rest: 0.4, drum: 0.55, heavy: true, choir: 0.6, drone: 0.08, bright: 0, battle: true, motif: MOTIF.undead, organ: 0.6, whisper: 0.5 },
  battle_dwarf: { root: 98, mode: MODES.aeol, beat: 0.3, lute: 0.4, luteVol: 1, rest: 0.25, drum: 0.7, heavy: true, choir: 0.35, drone: 0.06, bright: 0.2, battle: true, motif: MOTIF.dwarf, horn: 0.5 },
  battle_beast: { root: 110, mode: MODES.harm, beat: 0.27, lute: 0.45, luteVol: 1, rest: 0.3, drum: 0.65, choir: 0.1, drone: 0.06, bright: 0.3, battle: true },
  // sytuacje na mapie
  chase: { root: 110, mode: MODES.harm, beat: 0.22, lute: 0.6, luteVol: 0.9, rest: 0.2, drum: 0.6, choir: 0.05, drone: 0.06, bright: 0.3, horn: 0.2 },
  siege: { root: 98, mode: MODES.aeol, beat: 0.46, lute: 0.3, luteVol: 0.8, rest: 0.35, drum: 0.45, heavy: true, choir: 0.35, drone: 0.08, bright: 0.1, horn: 0.3 },
  lament: { root: 110, mode: MODES.phryg, beat: 0.7, lute: 0.6, luteVol: 0.8, rest: 0.45, drum: 0, choir: 0.45, drone: 0.05, bright: 0, slow: true },
  victory: { root: 146.83, mode: MODES.mixo, beat: 0.3, lute: 0.9, luteVol: 1, rest: 0.15, drum: 0.35, choir: 0.3, drone: 0.04, bright: 0.7, bell: 0.3, horn: 0.3 },
  pause: { root: 73.4, mode: MODES.aeol, beat: 1, lute: 0, luteVol: 0, rest: 1, drum: 0, choir: 0, drone: 0, bright: 0, silent: true, slow: true },
  silence: { root: 73.4, mode: MODES.aeol, beat: 1, lute: 0, luteVol: 0, rest: 1, drum: 0, choir: 0, drone: 0, bright: 0, silent: true },
};

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
      this.fx = c.createGain(); this.fx.gain.value = 0.85; this.fx.connect(this.master);
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
      this.startDrone();
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
  private out(pan: number, wet = 0.3): AudioNode {
    const c = this.ctx;
    const p = c.createStereoPanner(); p.pan.value = clamp(pan, -1, 1);
    p.connect(this.fx);
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
    const o = this.out(0, 0.4);
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
  ui() { if (!this.ok("ui", 40)) return; const o = this.out(0, 0.05); this.tone(o, 900, 700, 0.05, "square", 0.04); }

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
  pain(v = 1, pan = 0) {
    if (!this.ok("pain", 140)) return;
    const o = this.out(pan, 0.25);
    const f = rr(120, 190);
    this.voice(o, f * 1.15, f * 0.8, rr(0.18, 0.3), 0.18 * v, [rr(500, 750), rr(1000, 1300)]);
  }
  scream(v = 1, pan = 0) {
    if (!this.ok("scream", 200)) return;
    const o = this.out(pan, 0.4);
    const f = rr(170, 240);
    this.voice(o, f, f * 0.5, rr(0.5, 0.8), 0.16 * v, [rr(650, 850), rr(1100, 1400)]);
  }
  battleCry(v = 1) {
    if (!this.ok("cry", 900)) return;
    const o = this.out(0, 0.5);
    for (let i = 0; i < 9; i++) {
      const f = rr(100, 170), d = rr(0, 0.25);
      this.voice(o, f, f * rr(1.1, 1.35), rr(0.8, 1.3), 0.05 * v, [rr(600, 800), rr(1050, 1250)], d);
    }
    this.tone(o, 70, 50, 0.6, "sine", 0.2 * v);
  }
  moan(v = 1, pan = 0) {
    if (!this.ok("moan", 700)) return;
    const o = this.out(pan, 0.6);
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
  heal() {
    if (!this.ok("heal", 100)) return;
    const o = this.out(0, 0.8);
    [293.66, 369.99, 440, 587.33].forEach((f, i) => this.tone(o, f, f, 1.2, "sine", 0.12, i * 0.08, 0.05));
  }
  curse(v = 1, pan = 0) {
    if (!this.ok("curse", 100)) return;
    const o = this.out(pan, 0.8);
    this.tone(o, 160, 90, 1.1, "sawtooth", 0.12 * v, 0, 0.05);
    this.tone(o, 170, 95, 1.1, "sawtooth", 0.1 * v, 0, 0.05);
    this.noise(o, 1, 600, 200, 3, 0.2 * v);
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
    const o = this.out(0, 0.4);
    const f = kind === "orc" ? 90 : kind === "dwarf" ? 120 : kind === "undead" || kind === "skel" ? 70 : kind === "wolf" ? 220 : rr(140, 190);
    if (kind === "undead" || kind === "skel") { this.noise(o, 0.5, 600, 200, 2, 0.25, "bandpass"); this.tone(o, f, f * 0.7, 0.5, "sawtooth", 0.06); return; }
    if (kind === "wolf") { this.tone(o, f, f * 0.6, 0.35, "sawtooth", 0.08); this.noise(o, 0.3, 900, 400, 3, 0.15, "bandpass"); return; }
    this.tone(o, f, f * rr(0.8, 0.95), 0.18, "sawtooth", 0.07); this.tone(o, f * 2.1, f * 1.8, 0.16, "triangle", 0.04, 0.02);
    this.noise(o, 0.12, 700, 300, 2, 0.08, "bandpass");
  }
  coin() { if (!this.ok("coin", 60)) return; const o = this.out(0, 0.2); this.tone(o, 1800, 1700, 0.12, "square", 0.04); this.tone(o, 2400, 2300, 0.15, "square", 0.03, 0.06); }
  page() { if (!this.ok("page", 60)) return; const o = this.out(0, 0.1); this.noise(o, 0.12, 3000, 1500, 1, 0.08); }
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

  // ---- Muzyka: burdon i lutnia (synteza Karplusa-Stronga) ----
  private startDrone() {
    const c = this.ctx;
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 340; f.Q.value = 2;
    const g = c.createGain(); g.gain.value = 0.05;
    for (const [hz, det] of [[73.42, 0], [110, 3], [73.42, -4]]) {
      const o = c.createOscillator(); o.type = "sawtooth"; o.frequency.value = hz; o.detune.value = det;
      o.connect(f); o.start();
    }
    const lfo = c.createOscillator(); lfo.frequency.value = 0.05;
    const lg = c.createGain(); lg.gain.value = 120; lfo.connect(lg); lg.connect(f.frequency); lfo.start();
    f.connect(g); g.connect(this.musicBus);
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
  private pluck(freq: number, at: number, vol: number) {
    const c = this.ctx;
    const s = c.createBufferSource(); s.buffer = this.pluckBuf(freq);
    const f = c.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 2400;
    const g = c.createGain(); g.gain.value = vol;
    const p = c.createStereoPanner(); p.pan.value = -0.2;
    s.connect(f); f.connect(g); g.connect(p); p.connect(this.musicBus);
    s.start(at); s.stop(at + 2.2);
  }
  private makePhrase() {
    // D dorycki: D E F G A B C D E F G A
    const n = 8;
    const out: number[] = [];
    let idx = pick([0, 4, 7]);
    for (let i = 0; i < n; i++) {
      if (i > 0) idx = clamp(idx + pick([-2, -1, -1, 1, 1, 2, 0, 3, -3]), 0, 11);
      out.push(chance(0.22) && i % 2 === 1 ? -1 : idx);
    }
    out[n - 1] = pick([0, 4, 7]);
    return out;
  }

  setVolume(v: number) { this.volume = v; if (this.ctx) this.master.gain.setTargetAtTime(0.8 * v, this.ctx.currentTime, 0.1); }
  tick(dt: number, intensity: number, rain = false) {
    if (!this.ctx) return;
    const c = this.ctx;
    if (this.rainGain) this.rainGain.gain.setTargetAtTime(rain ? 0.07 : 0, c.currentTime, 0.8);
    this.intensity = lerp(this.intensity, intensity, clamp(dt * 1.5, 0, 1));
    if (this.dinGain) this.dinGain.gain.setTargetAtTime(this.intensity * 0.09, c.currentTime, 0.4);
    this.crowT -= dt;
    if (this.crowT <= 0) { this.crowT = rr(9, 22); if (this.intensity < 0.4) this.crow(); }
    if (!this.musicOn) { this.nextNote = Math.max(this.nextNote, c.currentTime + 0.5); return; }
    const scale = [146.83, 164.81, 174.61, 196, 220, 246.94, 261.63, 293.66, 329.63, 349.23, 392, 440];
    const beat = 0.34;
    while (this.nextNote < c.currentTime + 0.25) {
      if (this.noteStep >= this.phrase.length) {
        this.phrase = this.makePhrase(); this.noteStep = 0;
        if (chance(0.35)) { this.nextNote += beat * 4; continue; }   // oddech między frazami
      }
      const n = this.phrase[this.noteStep++];
      const long = this.noteStep === this.phrase.length;
      if (n >= 0) {
        this.pluck(scale[n], this.nextNote, 0.22);
        if (long || chance(0.18)) this.pluck(scale[Math.max(0, n - 4)] / (n >= 4 ? 1 : 2), this.nextNote + 0.012, 0.13);
      }
      this.nextNote += beat * (long ? 3 : chance(0.15) ? 0.5 : 1);
    }
  }
}

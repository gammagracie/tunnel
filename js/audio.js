// Lumen Rail audio engine.
// Everything is synthesized with Web Audio. Each ride segment declares a
// "profile" — per-layer levels — and the engine crossfades between them.
//
// Layers (each has .gain you can fade, so any layer can later be replaced by
// a sample player that decodes a recording into the same gain node):
//   drone  — low detuned saw bed
//   pad    — slow chord washes (Am / F / C / G)
//   bells  — sparse pentatonic plucks with echo
//   chant  — formant-filtered voice-like swells
//   wind   — filtered noise (outdoors / speed)
// Plus a rail hum tied to ride speed.

const CHORDS = [
  [45, 57, 60, 64],   // Am
  [41, 53, 57, 60],   // F
  [36, 48, 55, 60],   // C
  [43, 55, 59, 62],   // G
];
const PENTA = [57, 60, 62, 64, 67, 69, 72, 76];
const VOWELS = {
  a: [[800, 1.0], [1150, 0.5], [2900, 0.12]],
  o: [[450, 1.0], [800, 0.6], [2830, 0.08]],
  u: [[325, 1.0], [700, 0.4], [2700, 0.06]],
  e: [[400, 1.0], [1700, 0.4], [2600, 0.15]],
};
const midi = (n) => 440 * Math.pow(2, (n - 69) / 12);

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.profile = { drone: 0.3, pad: 0.4, bells: 0.2, chant: 0, wind: 0.3, bright: 0.8 };
    this.chordIndex = 0;
    this.timers = [];
  }

  start() {
    if (this.started) return;
    this.started = true;
    const ctx = this.ctx = new (window.AudioContext || window.webkitAudioContext)();

    this.master = ctx.createGain();
    this.master.gain.value = 0.0;
    this.tone = ctx.createBiquadFilter();            // global brightness
    this.tone.type = 'lowpass';
    this.tone.frequency.value = 3000;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20; comp.ratio.value = 6;
    this.master.connect(this.tone).connect(comp).connect(ctx.destination);

    // reverb-ish: feedback delays, stereo
    this.wet = ctx.createGain(); this.wet.gain.value = 0.4;
    const dL = ctx.createDelay(2); dL.delayTime.value = 0.31;
    const dR = ctx.createDelay(2); dR.delayTime.value = 0.43;
    const fbL = ctx.createGain(); fbL.gain.value = 0.42;
    const fbR = ctx.createGain(); fbR.gain.value = 0.42;
    const pL = ctx.createStereoPanner(); pL.pan.value = -0.6;
    const pR = ctx.createStereoPanner(); pR.pan.value = 0.6;
    this.wet.connect(dL); this.wet.connect(dR);
    dL.connect(fbL).connect(dR); dR.connect(fbR).connect(dL);
    dL.connect(pL).connect(this.master); dR.connect(pR).connect(this.master);

    this.layers = {
      drone: this._makeLayerGain(0),
      pad: this._makeLayerGain(0),
      bells: this._makeLayerGain(0),
      chant: this._makeLayerGain(0),
      wind: this._makeLayerGain(0),
    };

    this._buildDrone();
    this._buildWind();
    this._buildHum();
    this._buildChant();
    this._startPads();
    this._startBells();
    this._startChantCycle();

    // fade master in
    this.master.gain.linearRampToValueAtTime(0.85, ctx.currentTime + 3);
    this.setProfile(this.profile, 1.5);
  }

  _makeLayerGain(v) {
    const g = this.ctx.createGain();
    g.gain.value = v;
    g.connect(this.master);
    g.connect(this.wet);
    return g;
  }

  _buildDrone() {
    const { ctx } = this;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.7;
    f.connect(this.layers.drone);
    for (const [note, det, lvl] of [[33, -6, 0.5], [45, 5, 0.35], [45, -9, 0.35], [52, 3, 0.15]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = midi(note);
      o.detune.value = det;
      const g = ctx.createGain(); g.gain.value = lvl * 0.14;
      o.connect(g).connect(f);
      o.start();
    }
    const sub = ctx.createOscillator();
    sub.type = 'sine'; sub.frequency.value = midi(33);
    const sg = ctx.createGain(); sg.gain.value = 0.16;
    sub.connect(sg).connect(this.layers.drone);
    sub.start();
    // slow filter breathing
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.05;
    const lg = ctx.createGain(); lg.gain.value = 140;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
  }

  _noiseBuffer() {
    if (this._noise) return this._noise;
    const len = this.ctx.sampleRate * 2;
    const b = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this._noise = b;
    return b;
  }

  _buildWind() {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuffer(); src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.45;
    const g = ctx.createGain(); g.gain.value = 0.16;
    src.connect(f).connect(g).connect(this.layers.wind);
    src.start();
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.09;
    const lg = ctx.createGain(); lg.gain.value = 260;
    lfo.connect(lg).connect(f.frequency);
    lfo.start();
    this.windFilter = f;
  }

  _buildHum() {
    // rail hum: quiet sine + noise through narrow bandpass; pitch rises with speed
    const { ctx } = this;
    this.humGain = ctx.createGain(); this.humGain.gain.value = 0.0;
    this.humGain.connect(this.master);
    this.humOsc = ctx.createOscillator();
    this.humOsc.type = 'triangle'; this.humOsc.frequency.value = 55;
    const og = ctx.createGain(); og.gain.value = 0.35;
    this.humOsc.connect(og).connect(this.humGain);
    this.humOsc.start();
    const n = ctx.createBufferSource();
    n.buffer = this._noiseBuffer(); n.loop = true;
    this.humFilter = ctx.createBiquadFilter();
    this.humFilter.type = 'bandpass'; this.humFilter.frequency.value = 140; this.humFilter.Q.value = 8;
    const ng = ctx.createGain(); ng.gain.value = 0.5;
    n.connect(this.humFilter).connect(ng).connect(this.humGain);
    n.start();
  }

  _buildChant() {
    const { ctx } = this;
    this.chantEnv = ctx.createGain(); this.chantEnv.gain.value = 0;
    this.chantEnv.connect(this.layers.chant);
    this.chantOsc = ctx.createOscillator();
    this.chantOsc.type = 'sawtooth';
    this.chantOsc.frequency.value = midi(45);
    // vibrato
    const vib = ctx.createOscillator(); vib.frequency.value = 4.6;
    const vg = ctx.createGain(); vg.gain.value = 3.5;
    vib.connect(vg).connect(this.chantOsc.frequency);
    vib.start();
    this.formants = [];
    for (let i = 0; i < 3; i++) {
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass'; f.Q.value = 9;
      const g = ctx.createGain();
      this.chantOsc.connect(f).connect(g).connect(this.chantEnv);
      this.formants.push({ f, g });
    }
    // breath
    const n = ctx.createBufferSource();
    n.buffer = this._noiseBuffer(); n.loop = true;
    const bf = ctx.createBiquadFilter();
    bf.type = 'bandpass'; bf.frequency.value = 1400; bf.Q.value = 1.2;
    const bg = ctx.createGain(); bg.gain.value = 0.02;
    n.connect(bf).connect(bg).connect(this.chantEnv);
    n.start();
    this.chantOsc.start();
    this._setVowel('o', 0.1);
  }

  _setVowel(name, t) {
    const now = this.ctx.currentTime;
    VOWELS[name].forEach(([freq, amp], i) => {
      const { f, g } = this.formants[i];
      f.frequency.linearRampToValueAtTime(freq, now + t);
      g.gain.linearRampToValueAtTime(amp * 0.35, now + t);
    });
  }

  _startChantCycle() {
    const cycle = () => {
      if (!this.started) return;
      const chord = CHORDS[this.chordIndex];
      const note = chord[1 + Math.floor(Math.random() * (chord.length - 1))] - 12;
      const vowels = Object.keys(VOWELS);
      this._setVowel(vowels[Math.floor(Math.random() * vowels.length)], 2.5);
      const now = this.ctx.currentTime;
      this.chantOsc.frequency.cancelScheduledValues(now);
      this.chantOsc.frequency.setTargetAtTime(midi(note), now, 0.5);
      const e = this.chantEnv.gain;
      e.cancelScheduledValues(now);
      e.setValueAtTime(e.value, now);
      e.linearRampToValueAtTime(0.9, now + 3.2);
      e.linearRampToValueAtTime(0.12, now + 7.0);
      this.timers.push(setTimeout(cycle, 7000 + Math.random() * 2500));
    };
    this.timers.push(setTimeout(cycle, 1500));
  }

  _startPads() {
    const playChord = () => {
      if (!this.started) return;
      this.chordIndex = (this.chordIndex + 1) % CHORDS.length;
      const chord = CHORDS[this.chordIndex];
      const { ctx } = this;
      const now = ctx.currentTime;
      for (const note of chord.slice(1)) {
        for (const det of [-5, 4]) {
          const o = ctx.createOscillator();
          o.type = 'triangle';
          o.frequency.value = midi(note);
          o.detune.value = det;
          const g = ctx.createGain();
          g.gain.setValueAtTime(0, now);
          g.gain.linearRampToValueAtTime(0.055, now + 5);
          g.gain.setValueAtTime(0.055, now + 11);
          g.gain.linearRampToValueAtTime(0, now + 17);
          o.connect(g).connect(this.layers.pad);
          o.start(now);
          o.stop(now + 17.5);
        }
      }
      this.timers.push(setTimeout(playChord, 16000));
    };
    playChord();
  }

  _startBells() {
    const ping = () => {
      if (!this.started) return;
      const { ctx } = this;
      const now = ctx.currentTime;
      const note = PENTA[Math.floor(Math.random() * PENTA.length)];
      const o = ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = midi(note);
      const h = ctx.createOscillator();
      h.type = 'sine';
      h.frequency.value = midi(note) * 2.76;           // inharmonic shimmer
      const hg = ctx.createGain(); hg.gain.value = 0.18;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0, now);
      g.gain.linearRampToValueAtTime(0.22, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0004, now + 3.4);
      o.connect(g); h.connect(hg).connect(g);
      g.connect(this.layers.bells);
      o.start(now); h.start(now);
      o.stop(now + 3.6); h.stop(now + 3.6);
      this.timers.push(setTimeout(ping, 1800 + Math.random() * 4800));
    };
    this.timers.push(setTimeout(ping, 2500));
  }

  // Crossfade to a segment's mix. profile: {drone,pad,bells,chant,wind,bright}
  setProfile(p, fade = 1.2) {
    this.profile = p;
    if (!this.started) return;
    const now = this.ctx.currentTime;
    for (const k of ['drone', 'pad', 'bells', 'chant', 'wind']) {
      const g = this.layers[k].gain;
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(p[k] ?? 0, now + fade);
    }
    const cutoff = 900 + (p.bright ?? 0.8) * 5200;
    this.tone.frequency.setTargetAtTime(cutoff, now, fade * 0.6);
  }

  // speed: ride units/sec (2..30)
  setSpeed(v) {
    if (!this.started) return;
    const now = this.ctx.currentTime;
    const n = Math.min(1, v / 30);
    this.humGain.gain.setTargetAtTime(0.02 + n * 0.1, now, 0.4);
    this.humOsc.frequency.setTargetAtTime(42 + n * 70, now, 0.4);
    this.humFilter.frequency.setTargetAtTime(110 + n * 240, now, 0.4);
  }

  setMuted(m) {
    if (!this.started) return;
    this.master.gain.setTargetAtTime(m ? 0 : 0.85, this.ctx.currentTime, 0.3);
  }
}

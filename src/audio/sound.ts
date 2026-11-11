// All game audio: the lounge music and synthesised sound effects. Nothing is downloaded.
// Browsers only allow audio after the player interacts, so everything starts on the first
// tap/click/key press (`unlock`).

import { storage } from '../save/storage';
import { LoungeMusic, makeNoise } from './music';

const LOOKAHEAD = 0.4; // seconds of music kept queued
const MUSIC_MENU = 0.55;
const MUSIC_GAME = 0.28;
const CUSTOM_MUSIC = '/audio/music.mp3';

export class Sound {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private music!: LoungeMusic;
  private noise!: AudioBuffer;
  private rollGain!: GainNode;
  private rollFilter!: BiquadFilterNode;
  private rumbleGain!: GainNode;
  private musicLevel = MUSIC_MENU;
  private lastClack = 0;

  musicOn = storage.setting('music', true);
  sfxOn = storage.setting('sfx', true);

  /** Call from any user gesture. Safe to call many times. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    // Gentle limiter so stacked effects never clip
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -10;
    comp.ratio.value = 6;
    this.master.connect(comp).connect(ctx.destination);
    this.musicBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus.connect(this.master);
    this.applyLevels(true);
    this.noise = makeNoise(ctx, 2);

    // Continuous rolling sound: brown noise rumble, loudness follows the ball's speed
    const roll = ctx.createBufferSource();
    roll.buffer = makeNoise(ctx, 3, true);
    roll.loop = true;
    this.rollFilter = ctx.createBiquadFilter();
    this.rollFilter.type = 'lowpass';
    this.rollFilter.frequency.value = 300;
    this.rollGain = ctx.createGain();
    this.rollGain.gain.value = 0;
    roll.connect(this.rollFilter).connect(this.rollGain).connect(this.sfxBus);
    roll.start();
    const rumble = ctx.createOscillator();
    rumble.frequency.value = 48;
    this.rumbleGain = ctx.createGain();
    this.rumbleGain.gain.value = 0;
    rumble.connect(this.rumbleGain).connect(this.sfxBus);
    rumble.start();

    void this.startMusic(ctx);

    // Go quiet when the tab is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) void ctx.suspend();
      else void ctx.resume();
    });
    void ctx.resume();
  }

  /**
   * Plays `public/audio/music.mp3` if one has been added to the project; otherwise the
   * built-in "Tomato Lounge" tune composed in code.
   */
  private async startMusic(ctx: AudioContext) {
    try {
      const res = await fetch(CUSTOM_MUSIC, { method: 'HEAD' });
      const type = res.headers.get('content-type') ?? '';
      if (res.ok && type.startsWith('audio')) {
        const el = new Audio(CUSTOM_MUSIC);
        el.loop = true;
        ctx.createMediaElementSource(el).connect(this.musicBus);
        await el.play();
        return;
      }
    } catch {
      // No custom track (or it couldn't play): fall back to the built-in tune
    }
    this.music = new LoungeMusic(ctx, this.musicBus);
    this.music.start();
    window.setInterval(() => this.music.schedule(ctx.currentTime + LOOKAHEAD), 60);
    this.music.schedule(ctx.currentTime + LOOKAHEAD);
  }

  private applyLevels(instant = false) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const set = (p: AudioParam, v: number) => (instant ? p.setValueAtTime(v, t) : p.setTargetAtTime(v, t, 0.4));
    set(this.musicBus.gain, this.musicOn ? this.musicLevel : 0);
    set(this.sfxBus.gain, this.sfxOn ? 0.9 : 0);
  }

  /** Louder music in the menus, softer during play. */
  setMusicMood(mood: 'menu' | 'game') {
    this.musicLevel = mood === 'menu' ? MUSIC_MENU : MUSIC_GAME;
    this.applyLevels();
  }

  toggleMusic() {
    this.musicOn = !this.musicOn;
    storage.saveSetting('music', this.musicOn);
    this.applyLevels();
    return this.musicOn;
  }

  toggleSfx() {
    this.sfxOn = !this.sfxOn;
    storage.saveSetting('sfx', this.sfxOn);
    this.applyLevels();
    return this.sfxOn;
  }

  // ---------- Effects ----------

  private get ready() {
    return this.ctx !== null && this.sfxOn;
  }

  private tone(t: number, type: OscillatorType, f0: number, f1: number, peak: number, decay: number, dest: AudioNode = this.sfxBus) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + decay);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.004, decay / 3);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + decay * 2 + 0.05);
  }

  private burst(t: number, type: BiquadFilterType, f0: number, f1: number, q: number, peak: number, decay: number, attack = 0.003) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) filt.frequency.exponentialRampToValueAtTime(f1, t + decay);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(0.0001, t + attack, decay / 3);
    src.connect(filt).connect(g).connect(this.sfxBus);
    src.start(t, Math.random());
    src.stop(t + attack + decay * 2 + 0.05);
  }

  /** Ball rolling: `speed` in m/s, quieter in the gutter, silent when 0. */
  setRoll(speed: number, inGutter: boolean) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const level = Math.min(1, speed / 9);
    this.rollGain.gain.setTargetAtTime(level * (inGutter ? 0.22 : 0.3), t, 0.05);
    this.rumbleGain.gain.setTargetAtTime(level * (inGutter ? 0.03 : 0.07), t, 0.05);
    this.rollFilter.frequency.setTargetAtTime(inGutter ? 900 : 220 + 260 * level, t, 0.05);
  }

  /** The ball leaving Dave's hand and landing on the lane. */
  release() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.burst(t, 'bandpass', 500, 1600, 1.2, 0.12, 0.2, 0.08);
    this.tone(t + 0.08, 'sine', 110, 60, 0.5, 0.18);
    this.burst(t + 0.08, 'lowpass', 500, 300, 0.7, 0.3, 0.08);
  }

  /** Ball meets pin: a deep thud plus a juicy squelch. */
  ballHit(strength: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 130, 55, 0.6 * strength, 0.22);
    this.burst(t, 'lowpass', 800, 300, 0.7, 0.4 * strength, 0.09);
    this.squelch(strength);
  }

  squelch(strength: number) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.burst(t, 'bandpass', 2600, 420, 3, 0.35 * strength, 0.22, 0.01);
    this.tone(t + 0.01, 'sine', 320, 70, 0.25 * strength, 0.2);
    this.tone(t + 0.04, 'triangle', 180, 90, 0.12 * strength, 0.15);
  }

  /** Pin-on-pin or pin-on-floor clatter. */
  clack(strength: number) {
    if (!this.ready) return;
    const now = this.ctx!.currentTime;
    // Small random delay so a crowd of clacks sounds like a crash, not a single click
    const t = Math.max(now, this.lastClack + 0.008) + Math.random() * 0.01;
    this.lastClack = t;
    const s = Math.min(1, strength);
    this.tone(t, 'sine', 1100 + Math.random() * 600, 900, 0.22 * s, 0.07);
    this.tone(t, 'triangle', 420 + Math.random() * 120, 380, 0.16 * s, 0.05);
    this.burst(t, 'bandpass', 2600, 2000, 1.2, 0.25 * s, 0.045);
  }

  gutter() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 150, 90, 0.4, 0.3);
    this.burst(t, 'bandpass', 700, 650, 9, 0.35, 0.4);
  }

  /** Big crowd roar with a couple of whistles. */
  cheer() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.05;
    for (let i = 0; i < 14; i++) {
      const start = t + Math.random() * 0.25;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 450 + Math.random() * 1300;
      bp.Q.value = 3 + Math.random() * 3;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.22, start + 0.25);
      g.gain.setTargetAtTime(0.0001, start + 0.6 + Math.random() * 0.5, 0.45);
      // Voices wobble in loudness like people shouting
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      lfo.frequency.value = 4 + Math.random() * 7;
      depth.gain.value = 0.1;
      lfo.connect(depth).connect(g.gain);
      src.connect(bp).connect(g).connect(this.sfxBus);
      src.start(start, Math.random());
      lfo.start(start);
      src.stop(start + 2.8);
      lfo.stop(start + 2.8);
    }
    for (const dt of [0.15, 0.55]) {
      const w = t + dt;
      const o = ctx.createOscillator();
      o.frequency.setValueAtTime(1700, w);
      o.frequency.linearRampToValueAtTime(2700, w + 0.18);
      o.frequency.linearRampToValueAtTime(2100, w + 0.42);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, w);
      g.gain.linearRampToValueAtTime(0.12, w + 0.03);
      g.gain.setTargetAtTime(0.0001, w + 0.4, 0.04);
      o.connect(g).connect(this.sfxBus);
      o.start(w);
      o.stop(w + 0.7);
    }
    this.applause(1.8, 0.8);
  }

  /** Ripple of clapping. */
  applause(seconds = 1.4, level = 0.6) {
    if (!this.ready) return;
    const t = this.ctx!.currentTime + 0.05;
    const claps = Math.round(seconds * 70);
    for (let i = 0; i < claps; i++) {
      const at = t + Math.pow(Math.random(), 1.6) * seconds;
      const fade = 1 - (at - t) / seconds;
      this.burst(at, 'bandpass', 1400 + Math.random() * 1600, 1200, 1.5, 0.4 * level * fade, 0.03);
    }
  }

  /** "Awww" from the crowd. */
  groan() {
    if (!this.ready) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime + 0.05;
    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.value = 750;
    formant.Q.value = 1.2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    formant.connect(lp).connect(this.sfxBus);
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      const f = 170 + Math.random() * 110;
      const start = t + Math.random() * 0.12;
      o.frequency.setValueAtTime(f, start);
      o.frequency.exponentialRampToValueAtTime(f * 0.72, start + 1.3);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, start);
      g.gain.linearRampToValueAtTime(0.14, start + 0.18);
      g.gain.setTargetAtTime(0.0001, start + 0.9, 0.25);
      o.connect(g).connect(formant);
      o.start(start);
      o.stop(start + 2);
    }
  }

  /** Pinsetter machinery: a mechanical whirr while the sweep runs. */
  pinsetter() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.burst(t, 'lowpass', 260, 180, 0.8, 0.3, 1.6, 0.25);
    this.tone(t, 'square', 55, 52, 0.025, 1.6);
    this.tone(t + 1.4, 'sine', 220, 120, 0.12, 0.12); // clunk as the pins land
  }

  click() {
    if (!this.ready) return;
    const t = this.ctx!.currentTime;
    this.tone(t, 'sine', 1400, 900, 0.12, 0.04);
  }
}

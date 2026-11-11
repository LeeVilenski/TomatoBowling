// "Tomato Lounge": an original swing tune generated live with the Web Audio API.
// Walking bass, electric-piano comping, brushed drums and a vibraphone melody over a
// 16-bar form in F. Everything is scheduled a little ahead of time so it stays in time.

const BPM = 112;
const BEAT = 60 / BPM;
const SWING = 2 / 3; // swung eighth notes land two-thirds of the way through the beat

type Quality = 'maj7' | 'dom7' | 'm7' | 'm6';
interface Chord {
  root: number; // MIDI note
  q: Quality;
  beats: number;
}

const C = (root: number, q: Quality, beats = 4): Chord => ({ root, q, beats });
// MIDI: F2=41 G2=43 A2=45 Bb2=46 C3=48 D3=50 E3=52
const FORM: Chord[] = [
  // A section: I - VI - ii - V turnaround in F
  C(41, 'maj7'), C(50, 'dom7'), C(43, 'm7'), C(48, 'dom7'),
  C(45, 'm7'), C(50, 'dom7'), C(43, 'm7', 2), C(48, 'dom7', 2), C(41, 'maj7', 2), C(48, 'dom7', 2),
  // B section: up to the IV, minor iv, back home
  C(46, 'maj7'), C(46, 'm6'), C(45, 'm7'), C(50, 'dom7'),
  C(43, 'm7'), C(48, 'dom7'), C(41, 'maj7', 2), C(50, 'dom7', 2), C(43, 'm7', 2), C(48, 'dom7', 2),
];
export const FORM_BEATS = FORM.reduce((a, c) => a + c.beats, 0);
export const LOOP_SECONDS = FORM_BEATS * BEAT;

const TONES: Record<Quality, number[]> = {
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  m6: [0, 3, 7, 9],
};
// Rootless piano voicings (3rd, 7th, 9th, 5th/13th) — the classic lounge sound
const VOICING: Record<Quality, number[]> = {
  maj7: [4, 7, 11, 14],
  dom7: [4, 9, 10, 14],
  m7: [3, 7, 10, 14],
  m6: [3, 7, 9, 14],
};

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Tiny seeded random so the "improvised" parts repeat identically every loop. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

interface Note {
  beat: number; // from the start of the form
  midi: number;
  dur: number; // beats
  vel: number;
}

/** Writes out every note of the 16-bar form once. */
function compose() {
  const bass: Note[] = [];
  const piano: { beat: number; notes: number[]; dur: number; vel: number }[] = [];
  const melody: Note[] = [];
  const rand = seeded(7);
  let beat = 0;

  FORM.forEach((ch, idx) => {
    const next = FORM[(idx + 1) % FORM.length];
    const tones = TONES[ch.q].map((t) => ch.root + t);

    // Walking bass: root, chord tones, then a chromatic step into the next chord
    for (let b = 0; b < ch.beats; b++) {
      let n: number;
      if (b === 0) n = ch.root;
      else if (b === ch.beats - 1) n = next.root + (rand() < 0.5 ? 1 : -1);
      else n = tones[1 + Math.floor(rand() * 3)];
      if (n > 52) n -= 12;
      bass.push({ beat: beat + b, midi: n, dur: 0.9, vel: b === 0 ? 1 : 0.8 });
    }

    // Piano comping: the "Charleston" rhythm (on 1, and the swung "and" of 2)
    const voicing = VOICING[ch.q].map((v) => {
      let m = ch.root + v + 12;
      while (m > 70) m -= 12;
      while (m < 55) m += 12;
      return m;
    });
    piano.push({ beat, notes: voicing, dur: 0.6, vel: 0.9 });
    if (ch.beats === 4) piano.push({ beat: beat + 1 + SWING, notes: voicing, dur: 1.1, vel: 0.7 });
    else piano.push({ beat: beat + 1 + SWING, notes: voicing, dur: 0.3, vel: 0.55 });

    // Vibraphone melody: a short phrase every other bar, leaving space in between
    if (ch.beats === 4 && idx % 2 === 0) {
      const pool = tones.map((t) => t + 24).concat(tones.map((t) => t + 36)).filter((m) => m >= 65 && m <= 81).sort((a, b) => a - b);
      const rhythms = [
        [0, 1, 1 + SWING, 2],
        [0, SWING, 1 + SWING, 3],
        [0.0, 1, 2, 2 + SWING],
        [SWING, 1 + SWING, 2, 3],
      ];
      const rhythm = rhythms[Math.floor(rand() * rhythms.length)];
      let i = Math.floor(rand() * pool.length);
      rhythm.forEach((r, k) => {
        i = Math.max(0, Math.min(pool.length - 1, i + (rand() < 0.5 ? -1 : 1)));
        const last = k === rhythm.length - 1;
        melody.push({ beat: beat + r, midi: pool[i], dur: last ? 2.2 : 0.8, vel: last ? 0.9 : 0.75 });
      });
    }
    beat += ch.beats;
  });
  return { bass, piano, melody };
}

const SCORE = compose();

/** Plays the tune into `out`. Call `schedule(until)` regularly to keep notes queued. */
export class LoungeMusic {
  private noise: AudioBuffer;
  private formStart = 0;
  private scheduledUntil = 0; // in beats since formStart (across loops)

  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
  ) {
    this.noise = makeNoise(ctx, 1.5);
  }

  start(at = this.ctx.currentTime + 0.05) {
    this.formStart = at;
    this.scheduledUntil = 0;
  }

  /** Queue every note that starts before `untilTime` (seconds, context clock). */
  schedule(untilTime: number) {
    const untilBeat = (untilTime - this.formStart) / BEAT;
    while (this.scheduledUntil < untilBeat) {
      const from = this.scheduledUntil;
      const to = Math.min(untilBeat, Math.floor(from) + 1);
      this.queueRange(from, to);
      this.scheduledUntil = to;
    }
  }

  private queueRange(fromBeat: number, toBeat: number) {
    const loop = Math.floor(fromBeat / FORM_BEATS);
    const offset = loop * FORM_BEATS;
    const inRange = (b: number) => b + offset >= fromBeat && b + offset < toBeat;
    const time = (b: number) => this.formStart + (b + offset) * BEAT;

    for (const n of SCORE.bass) if (inRange(n.beat)) this.bass(time(n.beat), freq(n.midi), n.dur * BEAT, n.vel);
    for (const c of SCORE.piano) if (inRange(c.beat)) this.epiano(time(c.beat), c.notes.map(freq), c.dur * BEAT, c.vel);
    for (const n of SCORE.melody) if (inRange(n.beat)) this.vibes(time(n.beat), freq(n.midi), n.dur * BEAT, n.vel);

    // Drums: ride "ding, ding-da-ding, ding-da" plus brushes on 2 and 4
    // Counted in whole triplets so rounding never puts a hit on the wrong beat
    for (let k = Math.ceil(fromBeat * 3 - 1e-6); k < toBeat * 3 - 1e-6; k++) {
      const inBeat = k % 3; // 0, 1, 2 (triplet position within the beat)
      const beatNo = Math.floor(k / 3) % 4;
      const t = this.formStart + (k / 3) * BEAT;
      if (inBeat === 0) {
        this.ride(t, beatNo % 2 === 0 ? 1 : 0.8);
        if (beatNo === 1 || beatNo === 3) {
          this.brush(t);
          this.hat(t);
        }
      } else if (inBeat === 2 && (beatNo === 1 || beatNo === 3)) {
        this.ride(t, 0.55);
      }
    }
  }

  // ---------- Instruments ----------

  private env(t: number, peak: number, attack: number, decay: number, sustain: number, release: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * sustain, t + attack, decay / 3);
    g.gain.setTargetAtTime(0.0001, t + attack + decay + release, release / 4);
    return g;
  }

  private bass(t: number, f: number, dur: number, vel: number) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    const g = this.env(t, 0.42 * vel, 0.008, dur * 0.7, 0.35, 0.12);
    for (const [type, mul, level] of [
      ['triangle', 1, 1],
      ['sine', 2, 0.25],
    ] as const) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      const lvl = this.ctx.createGain();
      lvl.gain.value = level;
      o.connect(lvl).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    }
    lp.connect(g).connect(this.out);
  }

  /** Rhodes-style electric piano: FM with a bell-like attack. */
  private epiano(t: number, freqs: number[], dur: number, vel: number) {
    const bus = this.env(t, 0.07 * vel, 0.006, 0.5, 0.45, dur + 0.25);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    bus.connect(lp).connect(this.out);
    for (const f of freqs) {
      const car = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      car.frequency.value = f;
      mod.frequency.value = f;
      modGain.gain.setValueAtTime(f * 1.4, t);
      modGain.gain.setTargetAtTime(f * 0.15, t, 0.12);
      mod.connect(modGain).connect(car.frequency);
      car.connect(bus);
      const end = t + dur + 1.2;
      car.start(t);
      mod.start(t);
      car.stop(end);
      mod.stop(end);
    }
  }

  /** Vibraphone: soft sine with a shimmer of tremolo. */
  private vibes(t: number, f: number, dur: number, vel: number) {
    const g = this.env(t, 0.11 * vel, 0.004, 0.25, 0.55, dur + 0.6);
    const trem = this.ctx.createGain();
    trem.gain.value = 0.8;
    const lfo = this.ctx.createOscillator();
    const lfoDepth = this.ctx.createGain();
    lfo.frequency.value = 5.5;
    lfoDepth.gain.value = 0.2;
    lfo.connect(lfoDepth).connect(trem.gain);
    const end = t + dur + 2;
    for (const [mul, level] of [
      [1, 1],
      [4, 0.12],
    ]) {
      const o = this.ctx.createOscillator();
      o.frequency.value = f * mul;
      const lvl = this.ctx.createGain();
      lvl.gain.value = level;
      o.connect(lvl).connect(trem);
      o.start(t);
      o.stop(end);
    }
    lfo.start(t);
    lfo.stop(end);
    trem.connect(g).connect(this.out);
  }

  private noiseHit(t: number, type: BiquadFilterType, f: number, q: number, peak: number, decay: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const filt = this.ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = f;
    filt.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.003);
    g.gain.setTargetAtTime(0.0001, t + 0.003, decay / 3);
    src.connect(filt).connect(g).connect(this.out);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay * 2 + 0.05);
  }

  private ride(t: number, vel: number) {
    this.noiseHit(t, 'highpass', 6500, 0.7, 0.05 * vel, 0.32);
    this.noiseHit(t, 'bandpass', 4200, 6, 0.03 * vel, 0.5);
  }

  private hat(t: number) {
    this.noiseHit(t, 'highpass', 8000, 0.7, 0.025, 0.04);
  }

  private brush(t: number) {
    this.noiseHit(t, 'bandpass', 2800, 0.6, 0.035, 0.16);
  }
}

export function makeNoise(ctx: BaseAudioContext, seconds: number, brown = false): AudioBuffer {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < d.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      d[i] = last * 3.5;
    } else {
      d[i] = white;
    }
  }
  return buf;
}

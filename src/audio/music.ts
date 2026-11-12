// Original music for Tomato Dave's Ten-pin, generated live with the Web Audio API.
// Each track is written out once as a list of notes ("events") for one loop, then played
// on simple synthesised instruments, scheduled a little ahead of time so it stays in time.
//
//   lounge — "Tomato Lounge": swing with walking bass, Rhodes and vibraphone (Tomato Dave's)
//   chip   — "Packet Loss": 8-bit chiptune with fast arpeggios (Server Room Lanes)
//   disco  — "Disco Dave": four-on-the-floor, octave bass and string pads (Disco Inferno)
//   bossa  — "Bossa Marinara": bossa nova guitar, rim clave and flute (Rooftop at Sunset)
//   golden — "Golden Glory": a grand big-band swing in B♭ for the career final (The Golden Pin)

export type TrackId = 'lounge' | 'chip' | 'disco' | 'bossa' | 'golden';

type Inst =
  | 'bass' | 'epiano' | 'vibes' | 'ride' | 'hat' | 'brush'
  | 'kick' | 'snare' | 'clap' | 'openhat' | 'shaker' | 'rim'
  | 'pluck' | 'pad' | 'flute' | 'square' | 'tri' | 'chipnoise';

interface Ev {
  beat: number;
  inst: Inst;
  midi?: number;
  notes?: number[];
  dur: number; // beats
  vel: number;
}

interface Track {
  id: TrackId;
  name: string;
  bpm: number;
  beats: number; // length of one loop
  level: number; // overall loudness of this track
  events: Ev[];
}

type Quality = 'maj7' | 'dom7' | 'm7' | 'm6' | 'hd' | 'maj' | 'min';
interface Chord {
  root: number; // MIDI note (bass register)
  q: Quality;
  beats: number;
}
const C = (root: number, q: Quality, beats = 4): Chord => ({ root, q, beats });

const TONES: Record<Quality, number[]> = {
  maj7: [0, 4, 7, 11],
  dom7: [0, 4, 7, 10],
  m7: [0, 3, 7, 10],
  m6: [0, 3, 7, 9],
  hd: [0, 3, 6, 10], // half-diminished (m7♭5)
  maj: [0, 4, 7, 12],
  min: [0, 3, 7, 12],
};
// Rootless jazz voicings (3rd, 7th, 9th...) for the piano and guitar
const VOICING: Record<Quality, number[]> = {
  maj7: [4, 7, 11, 14],
  dom7: [4, 9, 10, 14],
  m7: [3, 7, 10, 14],
  m6: [3, 7, 9, 14],
  hd: [3, 6, 10, 12],
  maj: [4, 7, 12, 16],
  min: [3, 7, 12, 15],
};

const SWING = 2 / 3;

/** Tiny seeded random so "improvised" parts repeat identically every loop. */
function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function voice(ch: Chord, lo: number, hi: number) {
  return VOICING[ch.q].map((v) => {
    let m = ch.root + v + 12;
    while (m > hi) m -= 12;
    while (m < lo) m += 12;
    return m;
  });
}

/** A short melodic phrase over a chord, stepping between chord tones in a range. */
function phrase(ch: Chord, start: number, rhythm: number[], rand: () => number, lo: number, hi: number, inst: Inst, out: Ev[], lastDur = 2) {
  const tones = TONES[ch.q];
  const pool: number[] = [];
  for (let o = 0; o < 5; o++) for (const t of tones) {
    const m = ch.root + t + o * 12;
    if (m >= lo && m <= hi && !pool.includes(m)) pool.push(m);
  }
  pool.sort((a, b) => a - b);
  let i = Math.floor(rand() * pool.length);
  rhythm.forEach((r, k) => {
    i = Math.max(0, Math.min(pool.length - 1, i + (rand() < 0.5 ? -1 : 1)));
    const last = k === rhythm.length - 1;
    out.push({ beat: start + r, inst, midi: pool[i], dur: last ? lastDur : 0.8, vel: last ? 0.9 : 0.75 });
  });
}

// ---------- Track 1: Tomato Lounge (swing in F) ----------
function lounge(): Track {
  const form = [
    C(41, 'maj7'), C(50, 'dom7'), C(43, 'm7'), C(48, 'dom7'),
    C(45, 'm7'), C(50, 'dom7'), C(43, 'm7', 2), C(48, 'dom7', 2), C(41, 'maj7', 2), C(48, 'dom7', 2),
    C(46, 'maj7'), C(46, 'm6'), C(45, 'm7'), C(50, 'dom7'),
    C(43, 'm7'), C(48, 'dom7'), C(41, 'maj7', 2), C(50, 'dom7', 2), C(43, 'm7', 2), C(48, 'dom7', 2),
  ];
  const ev: Ev[] = [];
  const rand = seeded(7);
  let beat = 0;
  form.forEach((ch, idx) => {
    const next = form[(idx + 1) % form.length];
    const tones = TONES[ch.q].map((t) => ch.root + t);
    for (let b = 0; b < ch.beats; b++) {
      let n = b === 0 ? ch.root : b === ch.beats - 1 ? next.root + (rand() < 0.5 ? 1 : -1) : tones[1 + Math.floor(rand() * 3)];
      if (n > 52) n -= 12;
      ev.push({ beat: beat + b, inst: 'bass', midi: n, dur: 0.9, vel: b === 0 ? 1 : 0.8 });
    }
    const v = voice(ch, 55, 70);
    ev.push({ beat, inst: 'epiano', notes: v, dur: 0.6, vel: 0.9 });
    ev.push({ beat: beat + 1 + SWING, inst: 'epiano', notes: v, dur: ch.beats === 4 ? 1.1 : 0.3, vel: ch.beats === 4 ? 0.7 : 0.55 });
    if (ch.beats === 4 && idx % 2 === 0) {
      const rhythms = [[0, 1, 1 + SWING, 2], [0, SWING, 1 + SWING, 3], [0, 1, 2, 2 + SWING], [SWING, 1 + SWING, 2, 3]];
      phrase(ch, beat, rhythms[Math.floor(rand() * 4)], rand, 65, 81, 'vibes', ev, 2.2);
    }
    beat += ch.beats;
  });
  for (let k = 0; k < beat * 3; k++) {
    const pos = k % 3;
    const b = Math.floor(k / 3);
    const t = k / 3;
    if (pos === 0) {
      ev.push({ beat: t, inst: 'ride', dur: 0.5, vel: b % 2 === 0 ? 1 : 0.8 });
      if (b % 2 === 1) {
        ev.push({ beat: t, inst: 'brush', dur: 0.3, vel: 1 });
        ev.push({ beat: t, inst: 'hat', dur: 0.1, vel: 1 });
      }
    } else if (pos === 2 && b % 2 === 1) ev.push({ beat: t, inst: 'ride', dur: 0.5, vel: 0.55 });
  }
  return { id: 'lounge', name: 'Tomato Lounge', bpm: 112, beats: beat, level: 1, events: ev };
}

// ---------- Track 2: Packet Loss (chiptune in C minor) ----------
function chip(): Track {
  // MIDI: C3=48 Ab2=44 Bb2=46 G2=43 F2=41 Eb3=51
  const form = [C(48, 'min'), C(44, 'maj'), C(46, 'maj'), C(43, 'maj'), C(48, 'min'), C(44, 'maj'), C(41, 'min'), C(43, 'maj')];
  const ev: Ev[] = [];
  const rand = seeded(42);
  let beat = 0;
  for (let pass = 0; pass < 2; pass++) {
    form.forEach((ch, idx) => {
      const tones = TONES[ch.q];
      // Fast arpeggio: up and down the chord in sixteenth notes
      const arp = [0, 1, 2, 3, 2, 1].map((i) => ch.root + 24 + tones[i % tones.length]);
      for (let s = 0; s < 16; s++) ev.push({ beat: beat + s / 4, inst: 'square', midi: arp[s % arp.length], dur: 0.2, vel: s % 4 === 0 ? 0.75 : 0.5 });
      // Triangle bass: root and fifth
      for (let e = 0; e < 8; e++) ev.push({ beat: beat + e / 2, inst: 'tri', midi: ch.root - 12 + (e % 4 === 3 ? 7 : 0), dur: 0.45, vel: 1 });
      // Lead melody on the second time through
      if (pass === 1 && idx % 2 === 0) phrase(ch, beat, [0, 0.5, 1, 1.5, 2.5], rand, 67, 84, 'square', ev, 1.4);
      // Noise drums: kick on 1 and 3, snare on 2 and 4, hats on eighths
      for (let b = 0; b < 4; b++) {
        ev.push({ beat: beat + b, inst: b % 2 === 0 ? 'kick' : 'chipnoise', dur: 0.3, vel: 1 });
        ev.push({ beat: beat + b + 0.5, inst: 'hat', dur: 0.1, vel: 0.7 });
      }
      beat += 4;
    });
  }
  return { id: 'chip', name: 'Packet Loss', bpm: 140, beats: beat, level: 1, events: ev };
}

// ---------- Track 3: Disco Dave (disco in A minor) ----------
function disco(): Track {
  // MIDI: A2=45 D3=50 F2=41 E2=40 C3=48 G2=43
  const form = [C(45, 'm7'), C(45, 'm7'), C(50, 'm7'), C(50, 'm7'), C(41, 'maj7'), C(40, 'dom7'), C(45, 'm7'), C(40, 'dom7')];
  const ev: Ev[] = [];
  const rand = seeded(1977);
  let beat = 0;
  for (let pass = 0; pass < 2; pass++) {
    form.forEach((ch, idx) => {
      // Octave-jumping bass on every eighth
      for (let e = 0; e < 8; e++) ev.push({ beat: beat + e / 2, inst: 'bass', midi: ch.root + (e % 2 ? 12 : 0), dur: 0.4, vel: e % 2 ? 0.75 : 1 });
      // Strings pad across the bar, piano stabs on the off-beats
      ev.push({ beat, inst: 'pad', notes: voice(ch, 57, 74), dur: 4, vel: 0.8 });
      for (const b of [1.5, 3.5]) ev.push({ beat: beat + b, inst: 'epiano', notes: voice(ch, 60, 76), dur: 0.25, vel: 0.8 });
      if (pass === 1 && idx % 2 === 0) phrase(ch, beat, [0, 0.5, 1.5, 2, 3], rand, 69, 86, 'flute', ev, 1.5);
      for (let b = 0; b < 4; b++) {
        ev.push({ beat: beat + b, inst: 'kick', dur: 0.3, vel: 1 });
        if (b % 2 === 1) ev.push({ beat: beat + b, inst: 'clap', dur: 0.3, vel: 1 });
        ev.push({ beat: beat + b + 0.5, inst: 'openhat', dur: 0.3, vel: 0.9 });
        for (const s of [0.25, 0.75]) ev.push({ beat: beat + b + s, inst: 'hat', dur: 0.05, vel: 0.5 });
      }
      beat += 4;
    });
  }
  return { id: 'disco', name: 'Disco Dave', bpm: 118, beats: beat, level: 0.8, events: ev };
}

// ---------- Track 4: Bossa Marinara (bossa nova in A minor) ----------
function bossa(): Track {
  // MIDI: A2=45 D3=50 G2=43 C3=48 F#2=42 B2=47 E2=40
  const form = [
    C(45, 'm7'), C(50, 'dom7'), C(43, 'maj7'), C(48, 'maj7'),
    C(42, 'hd'), C(47, 'dom7'), C(40, 'm7'), C(40, 'dom7'),
    C(45, 'm7'), C(50, 'dom7'), C(43, 'maj7'), C(48, 'maj7'),
    C(42, 'hd'), C(47, 'dom7'), C(40, 'm7'), C(47, 'dom7'),
  ];
  const ev: Ev[] = [];
  const rand = seeded(1958);
  let beat = 0;
  form.forEach((ch, idx) => {
    const fifth = ch.root + (ch.q === 'hd' ? 6 : 7);
    // Bossa bass: root and fifth in the classic long-short pattern
    for (const [b, n] of [[0, ch.root], [1.5, fifth - 12], [2, ch.root], [3.5, fifth - 12]] as const) {
      ev.push({ beat: beat + b, inst: 'bass', midi: n < 36 ? n + 12 : n, dur: b % 2 === 0 ? 1.4 : 0.45, vel: b % 2 === 0 ? 1 : 0.8 });
    }
    // Nylon-guitar comping in a syncopated pattern that alternates every bar
    const hits = idx % 2 === 0 ? [0, 1.5, 2.5] : [0.5, 2, 3];
    for (const h of hits) ev.push({ beat: beat + h, inst: 'pluck', notes: voice(ch, 55, 70), dur: 0.9, vel: 0.85 });
    if (idx % 2 === 0) phrase(ch, beat, [0, 1, 1.5, 2.5], rand, 67, 84, 'flute', ev, 2.5);
    // Rim-click clave, soft shaker, gentle kick
    const clave = idx % 2 === 0 ? [0, 1.5, 3] : [1, 2.5];
    for (const c of clave) ev.push({ beat: beat + c, inst: 'rim', dur: 0.1, vel: 1 });
    for (let e = 0; e < 8; e++) ev.push({ beat: beat + e / 2, inst: 'shaker', dur: 0.1, vel: e % 2 ? 0.6 : 1 });
    for (const k of [0, 2]) ev.push({ beat: beat + k, inst: 'kick', dur: 0.3, vel: 0.5 });
    beat += 4;
  });
  return { id: 'bossa', name: 'Bossa Marinara', bpm: 128, beats: beat, level: 0.9, events: ev };
}

// ---------- Track 5: Golden Glory (big-band swing in B♭) ----------
function golden(): Track {
  // MIDI: B♭2=46 G2=43 C3=48 F2=41 E♭3=51 D3=50
  // A rising, triumphant form: I – VI7 – ii – V, then up to IV, a turnaround and a big finish
  const form = [
    C(46, 'maj7'), C(43, 'dom7'), C(48, 'm7'), C(41, 'dom7'),
    C(50, 'm7'), C(43, 'dom7'), C(48, 'm7'), C(41, 'dom7'),
    C(51, 'maj7'), C(51, 'm6'), C(46, 'maj7', 2), C(43, 'dom7', 2), C(48, 'm7', 2), C(41, 'dom7', 2),
    C(46, 'maj7'), C(43, 'dom7'), C(48, 'm7'), C(41, 'dom7'),
  ];
  const ev: Ev[] = [];
  const rand = seeded(2024);
  let beat = 0;
  form.forEach((ch, idx) => {
    const next = form[(idx + 1) % form.length];
    const tones = TONES[ch.q].map((t) => ch.root + t);
    // Walking bass
    for (let b = 0; b < ch.beats; b++) {
      let n = b === 0 ? ch.root : b === ch.beats - 1 ? next.root + (rand() < 0.5 ? 1 : -1) : tones[1 + Math.floor(rand() * 3)];
      if (n > 52) n -= 12;
      ev.push({ beat: beat + b, inst: 'bass', midi: n, dur: 0.9, vel: b === 0 ? 1 : 0.85 });
    }
    // Big "horn section" hits on the pad: on the one and pushed ahead of three
    const v = voice(ch, 58, 76);
    ev.push({ beat, inst: 'pad', notes: v, dur: ch.beats === 4 ? 1.4 : 0.9, vel: 0.9 });
    if (ch.beats === 4) ev.push({ beat: beat + 2 + SWING, inst: 'pad', notes: v, dur: 0.9, vel: 0.8 });
    ev.push({ beat: beat + 1 + SWING, inst: 'epiano', notes: voice(ch, 55, 70), dur: 0.4, vel: 0.6 });
    // A soaring flute line over every other bar, vibes answering
    if (ch.beats === 4 && idx % 2 === 0) phrase(ch, beat, [0, 1, 1 + SWING, 2, 3], rand, 70, 89, 'flute', ev, 1.8);
    else if (ch.beats === 4) phrase(ch, beat, [SWING, 1 + SWING, 2 + SWING], rand, 67, 84, 'vibes', ev, 1.2);
    beat += ch.beats;
  });
  // Swing ride, hi-hat on two and four, a kick on the one and a snare fill at the end
  for (let k = 0; k < beat * 3; k++) {
    const pos = k % 3;
    const b = Math.floor(k / 3);
    const t = k / 3;
    if (pos === 0) {
      ev.push({ beat: t, inst: 'ride', dur: 0.5, vel: b % 2 === 0 ? 1 : 0.85 });
      if (b % 2 === 1) ev.push({ beat: t, inst: 'hat', dur: 0.1, vel: 1 });
      if (b % 4 === 0) ev.push({ beat: t, inst: 'kick', dur: 0.3, vel: 0.7 });
    } else if (pos === 2 && b % 2 === 1) ev.push({ beat: t, inst: 'ride', dur: 0.5, vel: 0.6 });
  }
  for (const f of [beat - 1, beat - 1 + SWING, beat - 0.5, beat - 0.5 + 1 / 6]) ev.push({ beat: f, inst: 'snare', dur: 0.2, vel: 0.8 });
  return { id: 'golden', name: 'Golden Glory', bpm: 132, beats: beat, level: 0.85, events: ev };
}

const TRACKS: Record<TrackId, Track> = { lounge: lounge(), chip: chip(), disco: disco(), bossa: bossa(), golden: golden() };
export const TRACK_NAMES: Record<TrackId, string> = Object.fromEntries(Object.values(TRACKS).map((t) => [t.id, t.name])) as Record<TrackId, string>;

export function loopSeconds(id: TrackId) {
  return (TRACKS[id].beats * 60) / TRACKS[id].bpm;
}

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

/** Plays one track at a time into `out`, with a short crossfade when the track changes. */
export class MusicPlayer {
  private noise: AudioBuffer;
  private track: Track | null = null;
  private bus: GainNode | null = null;
  private start = 0;
  private scheduledUntil = 0; // beats since `start`

  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
  ) {
    this.noise = makeNoise(ctx, 1.5);
  }

  get current(): TrackId | null {
    return this.track?.id ?? null;
  }

  play(id: TrackId, at = this.ctx.currentTime + 0.05) {
    if (this.track?.id === id) return;
    // Fade the old track out; notes already queued ring out underneath
    if (this.bus) {
      const old = this.bus;
      old.gain.setTargetAtTime(0, this.ctx.currentTime, 0.25);
      setTimeout(() => old.disconnect(), 2500);
    }
    this.track = TRACKS[id];
    this.bus = this.ctx.createGain();
    this.bus.gain.value = this.track.level;
    this.bus.connect(this.out);
    this.start = at;
    this.scheduledUntil = 0;
  }

  /** Queue every note that starts before `untilTime` (seconds, context clock). */
  schedule(untilTime: number) {
    if (!this.track || !this.bus) return;
    const beatSec = 60 / this.track.bpm;
    const untilBeat = (untilTime - this.start) / beatSec;
    while (this.scheduledUntil < untilBeat) {
      const from = this.scheduledUntil;
      const to = Math.min(untilBeat, Math.floor(from) + 1);
      const loop = Math.floor(from / this.track.beats) * this.track.beats;
      for (const e of this.track.events) {
        const b = e.beat + loop;
        if (b >= from - 1e-6 && b < to - 1e-6) this.playEvent(e, this.start + b * beatSec, beatSec);
      }
      this.scheduledUntil = to;
    }
  }

  // ---------- Instruments ----------

  private playEvent(e: Ev, t: number, beatSec: number) {
    const dur = e.dur * beatSec;
    const f = e.midi !== undefined ? freq(e.midi) : 0;
    switch (e.inst) {
      case 'bass': return this.bass(t, f, dur, e.vel);
      case 'epiano': return this.epiano(t, e.notes!.map(freq), dur, e.vel);
      case 'vibes': return this.vibes(t, f, dur, e.vel);
      case 'pluck': return this.pluck(t, e.notes!.map(freq), dur, e.vel);
      case 'pad': return this.pad(t, e.notes!.map(freq), dur, e.vel);
      case 'flute': return this.flute(t, f, dur, e.vel);
      case 'square': return this.osc(t, 'square', f, dur, 0.035 * e.vel, 0.003, 1800);
      case 'tri': return this.osc(t, 'triangle', f, dur, 0.22 * e.vel, 0.004, 4000);
      case 'ride': this.noiseHit(t, 'highpass', 6500, 0.7, 0.05 * e.vel, 0.32); return this.noiseHit(t, 'bandpass', 4200, 6, 0.03 * e.vel, 0.5);
      case 'hat': return this.noiseHit(t, 'highpass', 8000, 0.7, 0.025 * e.vel, 0.04);
      case 'openhat': return this.noiseHit(t, 'highpass', 7000, 0.7, 0.03 * e.vel, 0.22);
      case 'shaker': return this.noiseHit(t, 'bandpass', 6000, 1.5, 0.02 * e.vel, 0.06);
      case 'brush': return this.noiseHit(t, 'bandpass', 2800, 0.6, 0.035 * e.vel, 0.16);
      case 'snare':
      case 'chipnoise': this.noiseHit(t, 'highpass', 1500, 0.7, 0.09 * e.vel, 0.12); return this.osc(t, 'triangle', 190, 0.06, 0.08 * e.vel, 0.002, 3000);
      case 'clap': for (const d of [0, 0.012, 0.024]) this.noiseHit(t + d, 'bandpass', 1300, 1.2, 0.08 * e.vel, d === 0.024 ? 0.14 : 0.02); return;
      case 'rim': this.osc(t, 'triangle', 1700, 0.03, 0.08 * e.vel, 0.001, 6000); return this.noiseHit(t, 'bandpass', 2500, 4, 0.04 * e.vel, 0.03);
      case 'kick': return this.kick(t, e.vel);
    }
  }

  private env(t: number, peak: number, attack: number, decay: number, sustain: number, release: number) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(peak, t + attack);
    g.gain.setTargetAtTime(peak * sustain, t + attack, decay / 3);
    g.gain.setTargetAtTime(0.0001, t + attack + decay + release, release / 4);
    g.connect(this.bus!);
    return g;
  }

  private osc(t: number, type: OscillatorType, f: number, dur: number, peak: number, attack: number, cutoff: number) {
    const o = this.ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const lp = this.ctx.createBiquadFilter();
    lp.frequency.value = cutoff;
    const g = this.env(t, peak, attack, dur * 0.8, 0.6, 0.05);
    o.connect(lp).connect(g);
    o.start(t);
    o.stop(t + dur + 0.3);
  }

  private bass(t: number, f: number, dur: number, vel: number) {
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.connect(this.env(t, 0.42 * vel, 0.008, dur * 0.7, 0.35, 0.12));
    for (const [type, mul, level] of [['triangle', 1, 1], ['sine', 2, 0.25]] as const) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.value = f * mul;
      const lvl = this.ctx.createGain();
      lvl.gain.value = level;
      o.connect(lvl).connect(lp);
      o.start(t);
      o.stop(t + dur + 0.6);
    }
  }

  /** Rhodes-style electric piano: FM with a bell-like attack. */
  private epiano(t: number, freqs: number[], dur: number, vel: number) {
    const bus = this.env(t, 0.07 * vel, 0.006, 0.5, 0.45, dur + 0.25);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2600;
    lp.connect(bus);
    for (const f of freqs) {
      const car = this.ctx.createOscillator();
      const mod = this.ctx.createOscillator();
      const modGain = this.ctx.createGain();
      car.frequency.value = f;
      mod.frequency.value = f;
      modGain.gain.setValueAtTime(f * 1.4, t);
      modGain.gain.setTargetAtTime(f * 0.15, t, 0.12);
      mod.connect(modGain).connect(car.frequency);
      car.connect(lp);
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
    const depth = this.ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = 0.2;
    lfo.connect(depth).connect(trem.gain);
    const end = t + dur + 2;
    for (const [mul, level] of [[1, 1], [4, 0.12]]) {
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
    trem.connect(g);
  }

  /** Nylon-string guitar: a quick strum of plucked notes. */
  private pluck(t: number, freqs: number[], dur: number, vel: number) {
    freqs.forEach((f, i) => {
      const at = t + i * 0.012;
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.frequency.setValueAtTime(3200, at);
      lp.frequency.exponentialRampToValueAtTime(700, at + 0.3);
      o.connect(lp).connect(this.env(at, 0.055 * vel, 0.003, 0.2, 0.25, dur));
      o.start(at);
      o.stop(at + dur + 0.6);
    });
  }

  /** Lush string pad: detuned sawtooths, softly filtered. */
  private pad(t: number, freqs: number[], dur: number, vel: number) {
    const lp = this.ctx.createBiquadFilter();
    lp.frequency.value = 1500;
    lp.connect(this.env(t, 0.03 * vel, 0.35, dur * 0.5, 0.8, 0.4));
    for (const f of freqs) {
      for (const detune of [-7, 7]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        o.detune.value = detune;
        o.connect(lp);
        o.start(t);
        o.stop(t + dur + 1);
      }
    }
  }

  /** Breathy flute: sine with gentle vibrato and a puff of noise. */
  private flute(t: number, f: number, dur: number, vel: number) {
    const o = this.ctx.createOscillator();
    o.frequency.value = f;
    const vib = this.ctx.createOscillator();
    const vibDepth = this.ctx.createGain();
    vib.frequency.value = 5;
    vibDepth.gain.value = f * 0.006;
    vib.connect(vibDepth).connect(o.frequency);
    o.connect(this.env(t, 0.09 * vel, 0.05, 0.3, 0.8, dur));
    o.start(t);
    vib.start(t);
    o.stop(t + dur + 0.8);
    vib.stop(t + dur + 0.8);
    this.noiseHit(t, 'bandpass', f * 2, 2, 0.015 * vel, 0.08);
  }

  private kick(t: number, vel: number) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.5 * vel, t + 0.003);
    g.gain.setTargetAtTime(0.0001, t + 0.003, 0.08);
    o.connect(g).connect(this.bus!);
    o.start(t);
    o.stop(t + 0.4);
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
    src.connect(filt).connect(g).connect(this.bus!);
    src.start(t, Math.random() * 0.5);
    src.stop(t + decay * 2 + 0.05);
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

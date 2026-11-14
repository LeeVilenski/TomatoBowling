// The overhead monitor: a live scoreboard drawn on a canvas, with little animations after
// strikes, spares, splits, turkeys, gutter balls and more, like the screens at a real
// bowling alley. Each moment has a few different animations, picked at random.
import * as THREE from 'three';
import { position, scoreFrames } from '../game/scoring';

export interface ScoreTheme {
  bg: string;
  panel: string;
  grid: string;
  ink: string;
  dim: string;
  accent: string;
  accent2: string;
  font: string;
}

export const SCORE_THEMES: Record<string, ScoreTheme> = {
  classic: { bg: '#100818', panel: '#1d1029', grid: '#4a2e66', ink: '#fff4e6', dim: '#b9a6c9', accent: '#ff4a3a', accent2: '#ffd23a', font: '"Trebuchet MS", "Arial Black", sans-serif' },
  server: { bg: '#020a05', panel: '#06160c', grid: '#1d5c33', ink: '#c8ffd9', dim: '#5fae7a', accent: '#3cff7a', accent2: '#36c8ff', font: '"Courier New", monospace' },
  disco: { bg: '#12041a', panel: '#22082e', grid: '#6a1f7a', ink: '#fff0fb', dim: '#d9a6d6', accent: '#ff3cc7', accent2: '#ffe03c', font: '"Trebuchet MS", "Arial Black", sans-serif' },
  rooftop: { bg: '#1e0f1c', panel: '#311626', grid: '#7a3a4c', ink: '#fff2e2', dim: '#e6b9a6', accent: '#ff8a4c', accent2: '#ffe08a', font: '"Trebuchet MS", "Arial Black", sans-serif' },
};

export interface ScorePlayer {
  name: string;
  rolls: number[];
}

/** The moments the scoreboard celebrates (or commiserates). */
export type ScoreAnimation = 'strike' | 'spare' | 'gutter' | 'turkey' | 'double' | 'split' | 'splitPickup' | 'miss' | 'nine';

/** Every animation for each moment, and how long it runs (seconds). */
export const ANIMATIONS: Record<ScoreAnimation, Record<string, number>> = {
  strike: { roll: 2.6, terminal: 2.8, fireworks: 2.8, splat: 2.4 },
  spare: { pair: 1.6, hotfix: 2.0, pinball: 2.0 },
  gutter: { droop: 2.6, bsod: 2.8, tumbleweed: 2.8 },
  turkey: { strut: 3.0, feathers: 3.0 },
  double: { highfive: 2.2, crosses: 2.2 },
  split: { crack: 2.4, merge: 2.6 },
  splitPickup: { confetti: 3.0, bridge: 3.0 },
  miss: { ping: 2.4, taunt: 2.2 },
  nine: { wobble: 2.4 },
};

const WORDS: Record<ScoreAnimation, string> = {
  strike: 'STRIKE!',
  spare: 'SPARE!',
  gutter: 'GUTTER BALL',
  turkey: 'TURKEY!',
  double: 'DOUBLE!',
  split: 'SPLIT!',
  splitPickup: 'SPLIT PICKED UP!',
  miss: 'MISSED!',
  nine: 'SO CLOSE...',
};

interface Anim {
  kind: ScoreAnimation;
  variant: string;
  length: number;
  label: string;
  sub: string;
  t: number;
  pins: { vx: number; vy: number; spin: number }[];
  /** Random numbers fixed for this showing (where sparks fly, confetti falls...). */
  r: number[];
}

type View =
  | { kind: 'idle' }
  | { kind: 'scores'; players: ScorePlayer[]; current: number; frames: number }
  | { kind: 'practice'; note: string };

const W = 1024;
const H = 512;
const TAU = Math.PI * 2;

export class Scoreboard {
  readonly texture: THREE.CanvasTexture;
  readonly g: CanvasRenderingContext2D;
  theme = SCORE_THEMES.classic;
  private view: View = { kind: 'idle' };
  private anim: Anim | null = null;
  /** The last animation shown for each moment, so the same one doesn't play twice running. */
  private lastVariant = new Map<ScoreAnimation, string>();
  rng: () => number = Math.random;
  private dirty = true;
  private sinceDraw = 0;

  constructor() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = H;
    this.g = c.getContext('2d')!;
    this.texture = new THREE.CanvasTexture(c);
    this.texture.colorSpace = THREE.SRGBColorSpace;
    this.texture.anisotropy = 4;
  }

  /** True while an animation is playing. */
  get animating() {
    return this.anim !== null;
  }

  setTheme(id: string) {
    this.theme = SCORE_THEMES[id] ?? SCORE_THEMES.classic;
    this.dirty = true;
  }

  showIdle() {
    this.view = { kind: 'idle' };
    this.dirty = true;
  }

  /** `frames`: the match length (10, or fewer in career mode's early matches). */
  showScores(players: ScorePlayer[], current: number, frames = 10) {
    this.view = { kind: 'scores', players: players.map((p) => ({ name: p.name, rolls: [...p.rolls] })), current, frames };
    this.dirty = true;
  }

  showPractice(note: string) {
    this.view = { kind: 'practice', note };
    this.dirty = true;
  }

  /**
   * Play an animation, then go back to the scores. `label` overrides the big word (e.g.
   * "HAMBONE!"), `sub` the line under it (for a split, the pins left, like "7-10").
   * `variant` picks one of the moment's animations; otherwise it's random (never the same twice running).
   */
  play(kind: ScoreAnimation, label?: string, sub = '', variant?: string) {
    const options = Object.keys(ANIMATIONS[kind]);
    if (!variant || !options.includes(variant)) {
      const last = this.lastVariant.get(kind);
      const pool = options.length > 1 ? options.filter((v) => v !== last) : options;
      variant = pool[Math.floor(this.rng() * pool.length)];
    }
    this.lastVariant.set(kind, variant);
    const rnd = this.rng;
    // Each pin gets its own flight for a scatter
    const pins = Array.from({ length: 10 }, () => ({ vx: 120 + rnd() * 420, vy: -260 - rnd() * 380, spin: (rnd() - 0.5) * 14 }));
    const r = Array.from({ length: 160 }, () => rnd());
    this.anim = { kind, variant, length: ANIMATIONS[kind][variant], label: label ?? WORDS[kind], sub, t: 0, pins, r };
    this.dirty = true;
  }

  /** The animation playing now, if any (for checks). */
  get playing(): { kind: ScoreAnimation; variant: string } | null {
    return this.anim ? { kind: this.anim.kind, variant: this.anim.variant } : null;
  }

  stopAnimation() {
    if (!this.anim) return;
    this.anim = null;
    this.dirty = true;
  }

  update(dt: number) {
    if (this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= this.anim.length) this.anim = null;
      this.dirty = true;
    }
    this.sinceDraw += dt;
    // Animations redraw at ~30 fps; a still scoreboard only when it changes
    if (!this.dirty || this.sinceDraw < 1 / 30) return;
    this.sinceDraw = 0;
    this.dirty = false;
    this.draw();
    this.texture.needsUpdate = true;
  }

  // ---------------------------------------------------------------- drawing

  private draw() {
    const g = this.g;
    const th = this.theme;
    g.save();
    g.fillStyle = th.bg;
    g.fillRect(0, 0, W, H);
    if (this.anim) this.drawAnimation(this.anim);
    else if (this.view.kind === 'idle') this.drawIdle();
    else if (this.view.kind === 'practice') this.drawPractice(this.view.note);
    else this.drawScores(this.view.players, this.view.current, this.view.frames);
    // Scanlines, for that monitor look
    g.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    g.restore();
  }

  /** Draws text; `maxWidth` squeezes it to fit (e.g. long player names). */
  text(s: string, x: number, y: number, size: number, colour: string, align: CanvasTextAlign = 'center', weight = 900, maxWidth?: number) {
    const g = this.g;
    g.font = `${weight} ${size}px ${this.theme.font}`;
    g.textAlign = align;
    g.textBaseline = 'middle';
    g.fillStyle = colour;
    g.fillText(s, x, y, maxWidth);
  }

  private drawIdle() {
    const th = this.theme;
    tomato(this.g, W / 2, 150, 70, 0);
    this.text("TOMATO DAVE'S", W / 2, 290, 84, th.accent);
    this.text('LANE 7  ·  GOOD LUCK!', W / 2, 390, 52, th.accent2, 'center', 700);
  }

  private drawPractice(note: string) {
    const th = this.theme;
    this.text('PRACTICE', W / 2, 150, 110, th.accent);
    this.text(note, W / 2, 320, 72, th.ink, 'center', 700);
    this.text('throw as much as you like', W / 2, 420, 38, th.dim, 'center', 700);
  }

  private drawScores(players: ScorePlayer[], current: number, count: number) {
    const g = this.g;
    const th = this.theme;
    const solo = players.length === 1;
    const top = 26;
    const rowH = Math.min(solo ? 300 : 230, (H - top - 20) / players.length);
    const left = solo ? 30 : 150;
    const right = W - (solo ? 30 : 150);
    const frameW = (right - left) / count;
    const markH = rowH * 0.42;

    if (solo) {
      // Big total and frame above the card
      const { total } = scoreFrames(players[0].rolls, count);
      const frame = currentFrame(players[0].rolls, count);
      this.text(frame > count ? 'FINAL' : `FRAME ${frame}`, left, top + 60, 64, th.accent2, 'left');
      this.text(String(total), right, top + 60, 110, th.accent, 'right');
    }

    players.forEach((p, i) => {
      const y = solo ? top + 150 : top + i * rowH;
      const h = solo ? rowH : rowH - 10;
      const active = i === current;
      const { frames, total } = scoreFrames(p.rolls, count);
      const now = currentFrame(p.rolls, count) - 1;
      if (!solo) {
        // Name on the left, total on the right
        g.fillStyle = active ? th.accent : th.panel;
        g.fillRect(10, y, left - 20, h);
        this.text(p.name.toUpperCase(), left / 2, y + h / 2, Math.min(34, h * 0.32), active ? th.bg : th.ink, 'center', 800, left - 36);
        g.fillStyle = th.panel;
        g.fillRect(right + 10, y, W - right - 20, h);
        this.text(String(total), (right + W) / 2, y + h / 2, Math.min(70, h * 0.55), active ? th.accent : th.ink);
      }
      for (let f = 0; f < count; f++) {
        const x = left + f * frameW;
        const isNow = active && f === now;
        g.fillStyle = isNow ? th.grid : th.panel;
        g.fillRect(x + 2, y, frameW - 4, h);
        g.strokeStyle = th.grid;
        g.lineWidth = 3;
        g.strokeRect(x + 2, y, frameW - 4, h);
        // Mark boxes along the top, split from the running total below
        const boxes = frames[f].boxes;
        const boxW = (frameW - 4) / boxes.length;
        g.beginPath();
        g.moveTo(x + 2, y + markH);
        g.lineTo(x + frameW - 2, y + markH);
        for (let b = 1; b < boxes.length; b++) {
          g.moveTo(x + 2 + b * boxW, y);
          g.lineTo(x + 2 + b * boxW, y + markH);
        }
        g.stroke();
        boxes.forEach((m, b) => {
          if (m) this.text(m, x + 2 + (b + 0.5) * boxW, y + markH / 2 + 2, Math.min(44, markH * 0.75), m === 'X' || m === '/' ? th.accent : th.ink, 'center', 800);
        });
        const t = frames[f].total;
        if (t !== null) this.text(String(t), x + frameW / 2, y + markH + (h - markH) / 2, Math.min(52, (h - markH) * 0.62), th.ink, 'center', 800);
      }
    });
  }

  private drawAnimation(a: Anim) {
    const { t, label, sub } = a;
    const th = this.theme;
    const g = this.g;
    const draw = VARIANTS[`${a.kind}.${a.variant}`];
    if (draw) return draw(this, a);
    if (a.kind === 'strike') {
      // The tomato rolls in and the pins scatter, then the word bounces in
      const hitAt = 0.55;
      const pinX = 690;
      const ballX = Math.min(-80 + (t / hitAt) * (pinX - 60 + 80), 900);
      tomato(g, t < hitAt ? ballX : pinX - 60 + (t - hitAt) * 260, 360, 46, t * 9);
      this.pinRack(pinX, 360, t < hitAt ? 0 : t - hitAt);
      if (t > hitAt) {
        juiceBurst(g, pinX, 330, t - hitAt);
        this.bigWord(label, t - hitAt - 0.1, th.accent, th.accent2);
      }
    } else if (a.kind === 'spare') {
      this.pinRack(700, 360, t < 0.35 ? 0 : t - 0.35, [6, 9]);
      tomato(g, Math.min(-60 + t * 2200, 760), 360, 40, t * 9);
      this.bigWord(label, t - 0.3, th.accent2, th.accent);
    } else if (a.kind === 'gutter') {
      // A sad little roll that drifts into the gutter, and the letters droop
      g.fillStyle = th.panel;
      g.fillRect(0, 430, W, 40);
      const x = 60 + Math.min(t, 1.6) * 520;
      const y = 340 + Math.max(0, (t - 0.7) * 1.4) ** 2 * 90;
      tomato(g, x, Math.min(y, 440), 40, t * 4, true);
      const word = label;
      g.font = `900 120px ${th.font}`;
      const widths = [...word].map((ch) => g.measureText(ch).width);
      let cx = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
      [...word].forEach((ch, i) => {
        const drop = Math.max(0, t - 0.9 - i * 0.07);
        const dy = drop * drop * 260;
        const rot = Math.min(0.5, drop * 0.9) * (i % 2 ? 1 : -1);
        g.save();
        g.translate(cx + widths[i] / 2, 150 + dy);
        g.rotate(rot);
        g.globalAlpha = Math.max(0, 1 - drop * 0.6);
        this.text(ch, 0, 0, 120, th.dim);
        g.restore();
        cx += widths[i];
      });
      if (t > 1.2) this.text('...saucy.', W / 2, 300, 52, th.ink, 'center', 700);
    } else {
      // Turkey: a strutting tomato-turkey under a bouncing headline
      const strut = Math.sin(t * 9) * 10;
      turkey(g, 230 + Math.min(t, 1.2) * 120, 330 + Math.abs(strut) * 0.6, t);
      // Letters spaced by their real widths, each bouncing a beat after the last
      const size = Math.min(110, 560 / (label.length * 0.62));
      g.font = `900 ${size}px ${th.font}`;
      const widths = [...label].map((ch) => g.measureText(ch).width + size * 0.06);
      let cx = 660 - widths.reduce((a, b) => a + b, 0) / 2;
      [...label].forEach((ch, i) => {
        const bounce = Math.abs(Math.sin(t * 6 + i * 0.6)) * 26;
        this.text(ch, cx + widths[i] / 2, 170 - bounce, size, i % 2 ? th.accent2 : th.accent);
        cx += widths[i];
      });
      if (sub) this.text(sub, 660, 420, 44, th.ink, 'center', 700);
    }
  }

  /** A headline that pops in with a little overshoot and wobble. Long words are squeezed to fit. */
  bigWord(word: string, t: number, fill: string, shadow: string, y = 175, size = 130) {
    if (t <= 0) return;
    const g = this.g;
    const k = Math.min(1, t / 0.35);
    const pop = 1 + Math.sin(k * Math.PI) * 0.25 * (1 - k) + (1 - k) * -0.6;
    const wobble = Math.sin(t * 8) * 0.04 * Math.max(0, 1 - t / 1.5);
    g.save();
    g.translate(W / 2, y);
    g.rotate(wobble);
    g.scale(Math.max(0.01, pop), Math.max(0.01, pop));
    this.text(word, 6, 6, size, shadow, 'center', 900, W - 80);
    this.text(word, 0, 0, size, fill, 'center', 900, W - 80);
    g.restore();
  }

  /** Terminal-style text, left-aligned. `chars` types it out a letter at a time. */
  mono(s: string, x: number, y: number, size: number, colour: string, chars = Infinity) {
    const g = this.g;
    g.font = `700 ${size}px "Courier New", monospace`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = colour;
    g.fillText(s.slice(0, Math.max(0, Math.floor(chars))), x, y);
  }

  /** A terminal window filling most of the screen. */
  terminal(title: string) {
    const g = this.g;
    const th = this.theme;
    g.fillStyle = '#05070a';
    g.fillRect(60, 40, W - 120, H - 80);
    g.fillStyle = th.grid;
    g.fillRect(60, 40, W - 120, 38);
    for (const [i, c] of ['#ff5f57', '#febc2e', '#28c840'].entries()) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(88 + i * 26, 59, 8, 0, TAU);
      g.fill();
    }
    this.mono(title, 180, 60, 22, th.ink);
  }

  /** The 10-pin triangle seen from the side-ish; after `t` > 0 the pins go flying. */
  pinRack(x: number, y: number, t: number, only?: number[]) {
    const g = this.g;
    const anim = this.anim;
    const spots = [0, 1, 1, 2, 2, 2, 3, 3, 3, 3].map((row, i) => {
      const inRow = i - [0, 1, 3, 6][row];
      return { x: x + row * 46, y: y - 50 + (inRow - row / 2) * 34 + row * 8 };
    });
    spots.forEach((s, i) => {
      if (only && !only.includes(i)) return;
      const f = anim?.pins[i] ?? { vx: 0, vy: 0, spin: 0 };
      const px = s.x + f.vx * t;
      const py = s.y + f.vy * t + 900 * t * t;
      if (py > H + 60) return;
      drawPin(g, px, py, 1, f.spin * t);
    });
  }
}

// ---------------------------------------------------------------- the animations

const ease = (k: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, k)), 3);
const FAN = ['#ffd23a', '#ff8a2a', '#3fae3a', '#ff4a3a'];

/** Each animation by "moment.variant" (the originals are drawn in Scoreboard.drawAnimation). */
const VARIANTS: Record<string, (sb: Scoreboard, a: Anim) => void> = {
  /** A terminal deletes all ten pins. */
  'strike.terminal'(sb, { t, label, r }) {
    const th = sb.theme;
    const g = sb.g;
    sb.terminal('dave@lane7: ~');
    sb.mono('$ sudo rm -rf /lane/pins/*', 100, 120, 34, th.accent2, t * 34);
    if (t > 0.85) {
      const k = Math.min(1, (t - 0.85) / 0.6);
      const done = Math.floor(k * 10);
      sb.mono(`removing pins [${'#'.repeat(done)}${'.'.repeat(10 - done)}] ${done}/10`, 100, 180, 30, th.ink);
      // The pins being deleted, one by one
      for (let i = 0; i < 10; i++) {
        const x = 150 + i * 75;
        if (i >= done) drawPin(g, x, 262, 1.1, 0);
        else {
          const f = Math.min(1, (t - 0.85 - (i / 10) * 0.6) * 4);
          g.globalAlpha = Math.max(0, 1 - f);
          drawPin(g, x, 262 - f * 30, 1.1, (r[i] - 0.5) * f * 2);
          g.globalAlpha = 1;
        }
      }
    }
    if (t > 1.5) sb.mono('10 pins deleted. 0 bugs found.', 100, 330, 30, th.dim, (t - 1.5) * 50);
    if (t > 1.7) sb.bigWord(label, t - 1.7, th.accent, th.accent2, 410, 100);
  },

  /** Rockets go up and burst behind the word. */
  'strike.fireworks'(sb, { t, label, r }) {
    const th = sb.theme;
    const g = sb.g;
    const colours = [th.accent, th.accent2, th.ink, '#3fae3a', '#36c8ff'];
    for (let n = 0; n < 5; n++) {
      const start = n * 0.28;
      const x = 140 + n * 186 + (r[n] - 0.5) * 60;
      const topY = 110 + r[n + 5] * 120;
      const lt = t - start;
      if (lt < 0) continue;
      if (lt < 0.45) {
        // The rocket climbing, with a little trail
        const y = H - (H - topY) * ease(lt / 0.45);
        g.fillStyle = th.accent2;
        g.fillRect(x - 3, y, 6, 22);
        g.fillStyle = 'rgba(255, 200, 80, 0.5)';
        g.fillRect(x - 2, y + 22, 4, 30);
        continue;
      }
      const bt = lt - 0.45;
      const fade = Math.max(0, 1 - bt / 1.3);
      if (fade <= 0) continue;
      g.globalAlpha = fade;
      g.fillStyle = colours[n % colours.length];
      for (let i = 0; i < 28; i++) {
        const ang = (i / 28) * TAU + r[n + 10];
        const d = ease(bt / 0.9) * (90 + r[(n * 28 + i) % 160] * 50);
        g.beginPath();
        g.arc(x + Math.cos(ang) * d, topY + Math.sin(ang) * d + bt * bt * 60, 5 * fade + 1, 0, TAU);
        g.fill();
      }
      g.globalAlpha = 1;
    }
    tomato(g, W / 2, 400, 46, Math.sin(t * 6) * 0.3);
    sb.bigWord(label, t - 0.6, th.accent, th.accent2, 260);
  },

  /** A tomato flies right at the screen and splats across it. */
  'strike.splat'(sb, { t, label, r }) {
    const th = sb.theme;
    const g = sb.g;
    const hit = 0.5;
    if (t < hit) {
      const k = t / hit;
      tomato(g, W / 2, H / 2 + 40 - k * 40, 20 + k * k * 330, k * 3);
      return;
    }
    const st = t - hit;
    g.fillStyle = '#c81d12';
    for (let i = 0; i < 16; i++) {
      // Big blobs that spread a little, each with a drip running down
      const x = r[i] * W;
      const y = r[i + 16] * H * 0.8;
      const rad = (30 + r[i + 32] * 70) * (0.6 + ease(st / 0.15) * 0.4);
      g.beginPath();
      g.arc(x, y, rad, 0, TAU);
      g.fill();
      const drip = Math.min(H, st * (60 + r[i + 48] * 120));
      g.fillRect(x - rad * 0.18, y, rad * 0.36, drip);
      g.beginPath();
      g.arc(x, y + drip, rad * 0.18, 0, TAU);
      g.fill();
    }
    // Seeds
    g.fillStyle = '#ffd98a';
    for (let i = 0; i < 30; i++) {
      g.beginPath();
      g.ellipse(r[i + 64] * W, r[i + 96] * H, 6, 3.5, r[i + 128] * TAU, 0, TAU);
      g.fill();
    }
    sb.bigWord(label, st - 0.15, th.ink, '#5a0a06', H / 2);
  },

  /** "Applying hotfix": a progress bar fills, then SPARE! */
  'spare.hotfix'(sb, { t, label, sub }) {
    const th = sb.theme;
    const g = sb.g;
    sb.mono('APPLYING HOTFIX...', 180, 110, 40, th.ink, t * 40);
    const k = ease(Math.min(1, t / 0.9));
    g.strokeStyle = th.grid;
    g.lineWidth = 6;
    g.strokeRect(180, 160, W - 360, 56);
    g.fillStyle = th.accent2;
    g.fillRect(186, 166, (W - 372) * k, 44);
    sb.text(`${Math.round(k * 100)}%`, W / 2, 188, 34, th.bg);
    if (t > 0.95) sb.bigWord(label, t - 0.95, th.accent2, th.accent, 340);
    if (sub && t > 1.2) sb.text(sub, W / 2, 450, 40, th.dim, 'center', 700);
  },

  /** The tomato pinballs off three pins. */
  'spare.pinball'(sb, { t, label, pins }) {
    const th = sb.theme;
    const g = sb.g;
    const stops = [
      { x: -60, y: 300 },
      { x: 300, y: 380 },
      { x: 500, y: 250 },
      { x: 720, y: 390 },
      { x: 1100, y: 280 },
    ];
    const seg = 0.22;
    const leg = Math.min(stops.length - 2, Math.floor(t / seg));
    const f = Math.min(1, (t - leg * seg) / seg);
    const a = stops[leg];
    const b = stops[leg + 1];
    for (let i = 1; i <= 3; i++) {
      const hitAt = i * seg;
      const p = stops[i];
      const ft = Math.max(0, t - hitAt);
      const fl = pins[i];
      const y = p.y + fl.vy * 0.6 * ft + 900 * ft * ft;
      if (y < H + 60) drawPin(g, p.x + (i % 2 ? 1 : -1) * fl.vx * 0.5 * ft, y, 1.3, fl.spin * ft);
      if (ft > 0 && ft < 0.6) {
        g.globalAlpha = 1 - ft / 0.6;
        sb.text('+1', p.x, p.y - 70 - ft * 80, 44, th.accent2);
        g.globalAlpha = 1;
      }
    }
    tomato(g, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, 38, t * 10);
    sb.bigWord(label, t - 0.8, th.accent2, th.accent, 130);
  },

  /** A blue screen: the ball ran into a problem. */
  'gutter.bsod'(sb, { t, label }) {
    const g = sb.g;
    const blue = '#1f5fd6';
    g.fillStyle = blue;
    g.fillRect(0, 0, W, H);
    const white = '#ffffff';
    g.font = `300 150px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillStyle = white;
    g.fillText(':(', 90, 120);
    const say = (s: string, y: number, size: number, from: number) => {
      if (t < from) return;
      g.font = `400 ${size}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
      g.fillText(s, 90, y);
    };
    say('Your ball ran into a problem and', 250, 40, 0.3);
    say('rolled into the gutter.', 300, 40, 0.3);
    say(`${t < 1.8 ? Math.min(100, Math.floor(t * 30)) : 0}% pins collected`, 370, 34, 0.8);
    say(`Stop code: ${label.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_|_$/g, '')}`, 440, 28, 1.3);
  },

  /** A tumbleweed rolls across the empty lane. */
  'gutter.tumbleweed'(sb, { t, label, r }) {
    const th = sb.theme;
    const g = sb.g;
    g.fillStyle = th.panel;
    g.fillRect(0, 400, W, H - 400);
    g.strokeStyle = th.grid;
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 400);
    g.lineTo(W, 400);
    g.stroke();
    // The tumbleweed: a ball of scribbles, rolling and hopping
    const x = -80 + t * 400;
    const y = 360 - Math.abs(Math.sin(t * 5)) * 60;
    g.save();
    g.translate(x, y - 20);
    g.rotate(t * 7);
    g.lineWidth = 3;
    g.lineCap = 'round';
    // Twiggy scribbles: loops of different sizes, off-centre, in two browns
    for (let i = 0; i < 22; i++) {
      g.strokeStyle = i % 2 ? '#b08a4a' : '#8a6630';
      g.beginPath();
      g.ellipse((r[i] - 0.5) * 30, (r[i + 40] - 0.5) * 30, 30 + r[i + 80] * 34, 12 + r[i + 120] * 30, r[i + 60] * TAU, 0, TAU * (0.6 + r[i + 100] * 0.4));
      g.stroke();
    }
    g.restore();
    g.globalAlpha = Math.min(1, t / 0.6);
    sb.text(label, W / 2, 150, 110, th.dim);
    g.globalAlpha = 1;
    for (let i = 0; i < 3; i++) {
      const at = 1.0 + i * 0.45;
      if (t > at && t < at + 0.6) sb.text('*chirp*', 180 + r[i + 20] * 660, 250 + r[i + 30] * 90, 34, th.ink, 'center', 400);
    }
  },

  /** Feathers drift down while the word bounces. */
  'turkey.feathers'(sb, { t, label, sub, r }) {
    const th = sb.theme;
    const g = sb.g;
    for (let i = 0; i < 26; i++) {
      const x = r[i] * W + Math.sin(t * 2.5 + i) * 40;
      const y = -60 + ((t * (120 + r[i + 26] * 140) + r[i + 52] * H) % (H + 120));
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(t * 3 + i) * 0.7);
      g.fillStyle = FAN[i % FAN.length];
      g.beginPath();
      g.ellipse(0, 0, 10, 34, 0, 0, TAU);
      g.fill();
      g.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, -30);
      g.lineTo(0, 38);
      g.stroke();
      g.restore();
    }
    g.save();
    g.translate(W / 2, 400 + Math.abs(Math.sin(t * 9)) * 5);
    g.scale(0.7, 0.7);
    turkey(g, 0, 0, t);
    g.restore();
    const size = Math.min(120, 900 / (label.length * 0.62));
    g.font = `900 ${size}px ${th.font}`;
    const widths = [...label].map((ch) => g.measureText(ch).width + size * 0.06);
    let cx = W / 2 - widths.reduce((a, b) => a + b, 0) / 2;
    [...label].forEach((ch, i) => {
      const bounce = Math.abs(Math.sin(t * 6 + i * 0.6)) * 26;
      sb.text(ch, cx + widths[i] / 2, 120 - bounce, size, i % 2 ? th.accent2 : th.accent);
      cx += widths[i];
    });
    if (sub) sb.text(sub, W / 2, 215, 40, th.ink, 'center', 700);
  },

  /** Two tomatoes leap in and high-five. */
  'double.highfive'(sb, { t, label }) {
    const th = sb.theme;
    const g = sb.g;
    const meet = 0.55;
    const k = Math.min(1, t / meet);
    const back = Math.max(0, t - meet - 0.25);
    for (const side of [-1, 1]) {
      // Leap in to meet in the middle, up high, then drop back down
      const x = W / 2 + side * (420 - ease(k) * 362 + back * 220);
      const y = 400 - Math.sin((k * Math.PI) / 2) * 160 + back * back * 700;
      tomato(g, x, Math.min(y, 410), 56, side * t * 4);
    }
    if (t > meet) {
      // The clap
      const ct = t - meet;
      g.strokeStyle = th.accent2;
      g.lineWidth = 6;
      for (let i = 0; i < 10; i++) {
        const ang = (i / 10) * TAU;
        const d0 = 30 + ct * 260;
        g.globalAlpha = Math.max(0, 1 - ct * 2);
        g.beginPath();
        g.moveTo(W / 2 + Math.cos(ang) * d0, 240 + Math.sin(ang) * d0);
        g.lineTo(W / 2 + Math.cos(ang) * (d0 + 40), 240 + Math.sin(ang) * (d0 + 40));
        g.stroke();
      }
      g.globalAlpha = 1;
      sb.bigWord(label, ct - 0.1, th.accent, th.accent2, 120, 120);
    }
  },

  /** Two big X's slam onto the screen. */
  'double.crosses'(sb, { t, label }) {
    const th = sb.theme;
    const g = sb.g;
    const shake = (at: number) => (t > at && t < at + 0.2 ? (Math.sin(t * 90) * 10 * (at + 0.2 - t)) / 0.2 : 0);
    g.save();
    g.translate(shake(0.3) + shake(0.65), 0);
    for (const [i, at] of [0.15, 0.5].entries()) {
      const k = (t - at) / 0.15;
      if (k < 0) continue;
      const sc = k < 1 ? 3 - 2 * k : 1;
      g.save();
      g.translate(W / 2 + (i ? 170 : -170), 210);
      g.rotate((1 - Math.min(1, k)) * 0.8);
      g.scale(sc, sc);
      g.globalAlpha = Math.min(1, k);
      sb.text('X', 8, 8, 260, th.accent2);
      sb.text('X', 0, 0, 260, th.accent);
      g.restore();
    }
    g.restore();
    g.globalAlpha = 1;
    if (t > 0.8) sb.bigWord(label, t - 0.8, th.ink, th.accent, 430, 90);
  },

  /** The word cracks in two and the halves drift apart, like the pins. */
  'split.crack'(sb, { t, label, sub }) {
    const th = sb.theme;
    const g = sb.g;
    const gap = ease((t - 0.5) / 0.8) * 160;
    const jag = [0, 30, -22, 26, -18, 24, 0];
    const crack = (side: number) => {
      g.beginPath();
      g.moveTo(W / 2, 40);
      jag.forEach((dx, i) => g.lineTo(W / 2 + dx, 60 + i * 50));
      g.lineTo(W / 2, 400);
      g.lineTo(side < 0 ? 0 : W, 400);
      g.lineTo(side < 0 ? 0 : W, 40);
      g.closePath();
    };
    for (const side of [-1, 1]) {
      g.save();
      g.translate(side * gap, 0);
      crack(side);
      g.clip();
      sb.text(label, W / 2 + 6, 186, 170, th.accent);
      sb.text(label, W / 2, 180, 170, th.accent2);
      g.restore();
      // The two pins left standing, edging apart
      drawPin(g, W / 2 + side * (180 + gap * 1.4), 380, 1.6, Math.sin(t * 5 + side) * 0.06);
    }
    if (t > 0.5 && t < 0.8) {
      g.strokeStyle = th.ink;
      g.lineWidth = 4;
      g.beginPath();
      jag.forEach((dx, i) => (i ? g.lineTo(W / 2 + dx, 60 + i * 50) : g.moveTo(W / 2, 60)));
      g.stroke();
    }
    if (t > 1.2) sb.text(sub ? `the ${sub}... you've got this` : "you've got this", W / 2, 470, 34, th.dim, 'center', 700);
  },

  /** A merge conflict between the two pins. */
  'split.merge'(sb, { t, sub }) {
    const th = sb.theme;
    const [a, b] = sub ? [sub.split('-')[0], sub.split('-').slice(-1)[0]] : ['left', 'right'];
    sb.terminal('dave@lane7: ~/pins (main|MERGING)');
    sb.mono('$ git merge the-rest-of-the-pins', 100, 120, 30, th.accent2, t * 40);
    const lines: [string, string][] = [
      ['CONFLICT (content): Merge conflict in lane.7', th.accent],
      [`<<<<<<< pin ${a}`, th.ink],
      ['        🍅 ?', th.dim],
      ['=======', th.ink],
      [`>>>>>>> pin ${b}`, th.ink],
    ];
    lines.forEach(([s, c], i) => {
      if (t > 0.8 + i * 0.18) sb.mono(s, 100, 180 + i * 46, 28, c);
    });
    if (t > 1.9) sb.mono('Automatic merge failed; fix it by hand.', 100, 420, 26, th.accent2, (t - 1.9) * 60);
  },

  /** Confetti everywhere: a split picked up. */
  'splitPickup.confetti'(sb, { t, label, sub, r }) {
    const th = sb.theme;
    const g = sb.g;
    const colours = [th.accent, th.accent2, th.ink, '#3fae3a', '#36c8ff', '#ff3cc7'];
    for (let i = 0; i < 70; i++) {
      const x = r[i] * W + Math.sin(t * 3 + i) * 30;
      const y = -30 + ((t * (160 + r[i + 70] * 220) + r[(i * 7) % 160] * 300) % (H + 60));
      g.save();
      g.translate(x, y);
      g.rotate(t * (3 + r[i] * 5) + i);
      g.fillStyle = colours[i % colours.length];
      g.fillRect(-7, -4, 14, 8);
      g.restore();
    }
    const words = label.split(' ');
    const first = words.length > 2 ? words.slice(0, -2).join(' ') : label;
    const rest = words.length > 2 ? words.slice(-2).join(' ') : '';
    sb.bigWord(first, t - 0.1, th.accent2, th.accent, rest ? 140 : 220, 150);
    if (rest) sb.bigWord(rest, t - 0.35, th.accent, th.accent2, 290, 110);
    if (sub && t > 0.9) sb.text(`the ${sub}!`, W / 2, 430, 52, th.ink, 'center', 800);
  },

  /** A pin skids across and takes out the other one. */
  'splitPickup.bridge'(sb, { t, label, sub, pins }) {
    const th = sb.theme;
    const g = sb.g;
    const leftX = 160;
    const rightX = W - 160;
    const y = 400;
    // The tomato clips the right-hand pin...
    const hit1 = 0.35;
    tomato(g, Math.min(rightX - 40, -60 + (t / hit1) * (rightX - 40 + 60)) + Math.max(0, t - hit1) * 300, y + 10, 38, t * 9);
    // ...which skids all the way across to the left-hand one
    const hit2 = 1.0;
    const k = Math.min(1, Math.max(0, (t - hit1) / (hit2 - hit1)));
    const after = Math.max(0, t - hit2);
    const p1x = rightX - ease(k) * (rightX - leftX - 40) - after * 120;
    drawPin(g, p1x, y - after * 200 + after * after * 900, 1.4, -k * 6 - after * 8);
    const p2 = pins[0];
    drawPin(g, leftX - after * p2.vx * 0.6, y + p2.vy * 0.6 * after + 900 * after * after, 1.4, -after * 10);
    if (t > hit2) juiceBurst(g, leftX, y - 30, after);
    sb.bigWord(label, t - hit2, th.accent2, th.accent, 150, 100);
    if (sub && t > 1.4) sb.text(`the ${sub}!`, W / 2, 270, 52, th.ink, 'center', 800);
  },

  /** A radar sweep that finds nothing. */
  'miss.ping'(sb, { t, label, sub }) {
    const th = sb.theme;
    const g = sb.g;
    const cx = 230;
    const cy = H / 2;
    g.strokeStyle = th.grid;
    g.lineWidth = 3;
    for (const rad of [60, 120, 180]) {
      g.beginPath();
      g.arc(cx, cy, rad, 0, TAU);
      g.stroke();
    }
    const ang = t * 4;
    g.strokeStyle = th.accent2;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(cx, cy);
    g.lineTo(cx + Math.cos(ang) * 180, cy + Math.sin(ang) * 180);
    g.stroke();
    const pin = sub || 'pin';
    sb.mono(`PING ${pin}`, 460, 120, 34, th.ink, t * 30);
    for (let i = 0; i < 3; i++) if (t > 0.6 + i * 0.35) sb.mono('Request timed out.', 460, 180 + i * 50, 28, th.dim);
    if (t > 1.7) sb.text(label, 700, 400, 90, th.accent);
  },

  /** The pin that got away hops about and blows a raspberry. */
  'miss.taunt'(sb, { t, label }) {
    const th = sb.theme;
    const g = sb.g;
    const hop = Math.abs(Math.sin(t * 7)) * 50;
    const x = W / 2 + Math.sin(t * 3.5) * 200;
    const y = 360 - hop;
    drawPin(g, x, y, 2.2, Math.sin(t * 7) * 0.15);
    // A face on its head
    g.fillStyle = '#1a0a06';
    g.beginPath();
    g.arc(x - 7, y - 50, 3.5, 0, TAU);
    g.arc(x + 7, y - 50, 3.5, 0, TAU);
    g.fill();
    g.fillStyle = '#ff5a7a';
    g.beginPath();
    g.ellipse(x, y - 38, 5, 7 + Math.sin(t * 20) * 2, 0, 0, Math.PI);
    g.fill();
    if (t > 0.4) sb.text('NYAH!', x + 120, y - 110, 40, th.accent2, 'center', 900);
    sb.text(label, W / 2, 110, 110, th.dim);
  },

  /** Nine down: the last pin wobbles, nearly goes... and doesn't. */
  'nine.wobble'(sb, { t, label, sub }) {
    const th = sb.theme;
    const g = sb.g;
    // A big rock that dies away, with one heart-stopping lean in the middle
    const lean = Math.sin(t * 9) * 0.25 * Math.exp(-t * 1.2) + Math.exp(-Math.pow((t - 0.9) * 5, 2)) * 0.45;
    g.save();
    g.translate(W / 2, 470);
    g.rotate(lean);
    drawPin(g, 0, -90, 3, 0);
    g.restore();
    g.fillStyle = th.panel;
    g.fillRect(0, 470, W, H - 470);
    sb.text(label, W / 2, 110, 100, th.accent2);
    if (t > 1.3) sb.text(sub || '9 pins', W / 2, 220, 48, th.ink, 'center', 700);
  },
};

/** 1-based frame the player is on (11 once they've finished). */
function currentFrame(rolls: number[], count = 10) {
  return position(rolls, count).frame + 1;
}

function tomato(g: CanvasRenderingContext2D, x: number, y: number, r: number, spin: number, sad = false) {
  g.save();
  g.translate(x, y);
  g.fillStyle = '#e0261b';
  g.beginPath();
  g.arc(0, 0, r, 0, TAU);
  g.fill();
  g.fillStyle = 'rgba(255, 255, 255, 0.35)';
  g.beginPath();
  g.ellipse(-r * 0.35, -r * 0.4, r * 0.28, r * 0.16, -0.5, 0, TAU);
  g.fill();
  // Leafy top, turning as it rolls
  g.rotate(spin);
  g.fillStyle = '#3fae3a';
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    g.beginPath();
    g.ellipse(Math.cos(a) * r * 0.22, -r * 0.75 + Math.sin(a) * r * 0.12, r * 0.24, r * 0.08, a, 0, TAU);
    g.fill();
  }
  g.rotate(-spin);
  if (sad) {
    g.fillStyle = '#2a0a06';
    g.beginPath();
    g.arc(-r * 0.3, -r * 0.05, r * 0.08, 0, TAU);
    g.arc(r * 0.3, -r * 0.05, r * 0.08, 0, TAU);
    g.fill();
    g.strokeStyle = '#2a0a06';
    g.lineWidth = r * 0.08;
    g.beginPath();
    g.arc(0, r * 0.45, r * 0.25, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  }
  g.restore();
}

function drawPin(g: CanvasRenderingContext2D, x: number, y: number, s: number, rot: number) {
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  g.scale(s, s);
  g.fillStyle = '#f7f4ee';
  g.beginPath();
  g.ellipse(0, 14, 15, 24, 0, 0, TAU); // belly
  g.ellipse(0, -22, 8, 9, 0, 0, TAU); // head
  g.fill();
  g.fillRect(-5, -20, 10, 22); // neck
  g.fillStyle = '#d0201a';
  g.fillRect(-6, -12, 12, 3);
  g.fillRect(-6, -7, 12, 3);
  g.restore();
}

function juiceBurst(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const n = 26;
  g.fillStyle = '#e0261b';
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + i;
    const d = t * (260 + (i % 5) * 70);
    const r = Math.max(0, 9 - t * 6) * (0.6 + (i % 3) * 0.3);
    if (r <= 0) continue;
    g.beginPath();
    g.arc(x + Math.cos(a) * d, y + Math.sin(a) * d * 0.7 + t * t * 300, r, 0, TAU);
    g.fill();
  }
}

/** A tomato dressed as a turkey: tail fan, little head and wattle, strutting legs. */
function turkey(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  g.save();
  g.translate(x, y);
  const fan = ['#ffd23a', '#ff8a2a', '#3fae3a', '#ff4a3a', '#ffd23a', '#ff8a2a', '#3fae3a'];
  fan.forEach((c, i) => {
    const a = -Math.PI / 2 + (i - (fan.length - 1) / 2) * 0.32 + Math.sin(t * 5) * 0.04;
    g.fillStyle = c;
    g.beginPath();
    g.ellipse(Math.cos(a) * 90 - 10, Math.sin(a) * 90 + 10, 30, 70, a + Math.PI / 2, 0, TAU);
    g.fill();
  });
  // Legs, stepping
  g.strokeStyle = '#ffb02e';
  g.lineWidth = 8;
  const step = Math.sin(t * 9) * 12;
  for (const [lx, d] of [[-18, step], [18, -step]] as const) {
    g.beginPath();
    g.moveTo(lx, 50);
    g.lineTo(lx + d, 105);
    g.lineTo(lx + d + 16, 105);
    g.stroke();
  }
  tomato(g, 0, 20, 62, 0);
  // Head and wattle
  g.fillStyle = '#c8281e';
  g.beginPath();
  g.arc(62, -38, 24, 0, TAU);
  g.fill();
  g.fillStyle = '#ffd23a';
  g.beginPath();
  g.moveTo(84, -42);
  g.lineTo(104, -34);
  g.lineTo(84, -28);
  g.fill();
  g.fillStyle = '#ff2a5a';
  g.beginPath();
  g.ellipse(86, -18, 7, 14, 0.2, 0, TAU);
  g.fill();
  g.fillStyle = '#1a0a06';
  g.beginPath();
  g.arc(68, -44, 5, 0, TAU);
  g.fill();
  g.restore();
}

/** An overhead monitor showing the scoreboard, hung on a rod from `hangTo` (a height in metres) or on a gantry. */
export function scoreMonitor(screen: THREE.Texture, hangTo: number | null) {
  const mon = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#111111', roughness: 0.8 });
  const rod = new THREE.MeshStandardMaterial({ color: '#222222', roughness: 0.6 });
  mon.add(new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.66, 0.07), body));
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.6), new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }));
  face.position.z = 0.037; // faces the bowler (towards +z)
  mon.add(face);
  if (hangTo !== null) {
    const len = hangTo - 3.3;
    const r = new THREE.Mesh(new THREE.BoxGeometry(0.03, len, 0.03), rod);
    r.position.y = len / 2 + 0.3;
    mon.add(r);
  }
  mon.position.set(0, 3.3, -1.2);
  mon.rotation.x = 0.18; // tilted down towards the bowler
  return mon;
}

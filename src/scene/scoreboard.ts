// The overhead monitor: a live scoreboard drawn on a canvas, with little animations after
// strikes, spares, turkeys and gutter balls, like the screens at a real bowling alley.
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

export type ScoreAnimation = 'strike' | 'spare' | 'gutter' | 'turkey';

/** How long each animation runs (seconds). */
export const ANIMATION_LENGTH: Record<ScoreAnimation, number> = { strike: 2.6, spare: 1.6, gutter: 2.6, turkey: 3.0 };

type View =
  | { kind: 'idle' }
  | { kind: 'scores'; players: ScorePlayer[]; current: number; frames: number }
  | { kind: 'practice'; note: string };

const W = 1024;
const H = 512;
const TAU = Math.PI * 2;

export class Scoreboard {
  readonly texture: THREE.CanvasTexture;
  private g: CanvasRenderingContext2D;
  private theme = SCORE_THEMES.classic;
  private view: View = { kind: 'idle' };
  private anim: { kind: ScoreAnimation; label: string; sub: string; t: number; pins: { vx: number; vy: number; spin: number }[] } | null = null;
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

  /** Play an animation, then go back to the scores. `label` overrides the big word (e.g. "HAMBONE!"), `sub` the line under it. */
  play(kind: ScoreAnimation, label?: string, sub = '') {
    const words: Record<ScoreAnimation, string> = { strike: 'STRIKE!', spare: 'SPARE!', gutter: 'GUTTER BALL', turkey: 'TURKEY!' };
    // Each pin gets its own flight for the strike's scatter
    const pins = Array.from({ length: 10 }, () => ({ vx: 120 + Math.random() * 420, vy: -260 - Math.random() * 380, spin: (Math.random() - 0.5) * 14 }));
    this.anim = { kind, label: label ?? words[kind], sub, t: 0, pins };
    this.dirty = true;
  }

  stopAnimation() {
    if (!this.anim) return;
    this.anim = null;
    this.dirty = true;
  }

  update(dt: number) {
    if (this.anim) {
      this.anim.t += dt;
      if (this.anim.t >= ANIMATION_LENGTH[this.anim.kind]) this.anim = null;
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
    if (this.anim) this.drawAnimation(this.anim.kind, this.anim.t, this.anim.label, this.anim.sub);
    else if (this.view.kind === 'idle') this.drawIdle();
    else if (this.view.kind === 'practice') this.drawPractice(this.view.note);
    else this.drawScores(this.view.players, this.view.current, this.view.frames);
    // Scanlines, for that monitor look
    g.fillStyle = 'rgba(0, 0, 0, 0.12)';
    for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 2);
    g.restore();
  }

  /** Draws text; `maxWidth` squeezes it to fit (e.g. long player names). */
  private text(s: string, x: number, y: number, size: number, colour: string, align: CanvasTextAlign = 'center', weight = 900, maxWidth?: number) {
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

  private drawAnimation(kind: ScoreAnimation, t: number, label: string, sub: string) {
    const th = this.theme;
    const g = this.g;
    if (kind === 'strike') {
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
    } else if (kind === 'spare') {
      this.pinRack(700, 360, t < 0.35 ? 0 : t - 0.35, [6, 9]);
      tomato(g, Math.min(-60 + t * 2200, 760), 360, 40, t * 9);
      this.bigWord(label, t - 0.3, th.accent2, th.accent);
    } else if (kind === 'gutter') {
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

  /** A headline that pops in with a little overshoot and wobble. */
  private bigWord(word: string, t: number, fill: string, shadow: string) {
    if (t <= 0) return;
    const g = this.g;
    const k = Math.min(1, t / 0.35);
    const pop = 1 + Math.sin(k * Math.PI) * 0.25 * (1 - k) + (1 - k) * -0.6;
    const wobble = Math.sin(t * 8) * 0.04 * Math.max(0, 1 - t / 1.5);
    g.save();
    g.translate(W / 2, 175);
    g.rotate(wobble);
    g.scale(Math.max(0.01, pop), Math.max(0.01, pop));
    this.text(word, 6, 6, 130, shadow);
    this.text(word, 0, 0, 130, fill);
    g.restore();
  }

  /** The 10-pin triangle seen from the side-ish; after `t` > 0 the pins go flying. */
  private pinRack(x: number, y: number, t: number, only?: number[]) {
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

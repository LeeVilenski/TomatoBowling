import * as THREE from 'three';

export type Expression = 'neutral' | 'focused' | 'happy' | 'ecstatic' | 'sad' | 'confused' | 'meh';

const SIZE = 256;
const INK = '#2a1206';

/** How a face is drawn. Dave's look is the default; rivals change a few things. */
export interface FaceStyle {
  /** Colour of the eyelids (the head's own colour). */
  lid: string;
  /** Nose colour, or null for no nose (a doughnut has a hole there instead). */
  nose: string | null;
  moustache: boolean;
  /** Eyelashes. */
  lashes: boolean;
  /** A bead of sweat when things go badly. */
  sweat: boolean;
  /** Where the eyes sit (canvas px, 0–256), how far apart, and where the mouth is. */
  eyeY: number;
  eyeGap: number;
  mouthY: number;
}

export const DAVE_FACE: FaceStyle = { lid: '#c8281e', nose: '#b81d14', moustache: true, lashes: false, sweat: false, eyeY: 100, eyeGap: 80, mouthY: 196 };

/** Draws a face (eyes, brows, nose, moustache, mouth) on a transparent canvas. */
function drawFace(g: CanvasRenderingContext2D, e: Expression, f: FaceStyle) {
  g.clearRect(0, 0, SIZE, SIZE);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const eyeY = f.eyeY;
  const eyes: [number, number][] = [
    [128 - f.eyeGap / 2, eyeY],
    [128 + f.eyeGap / 2, eyeY],
  ];

  // Eyes
  for (const [x, y] of eyes) {
    if (e === 'ecstatic') {
      // Happy closed eyes: ^ ^
      g.strokeStyle = INK;
      g.lineWidth = 9;
      g.beginPath();
      g.moveTo(x - 18, y + 8);
      g.quadraticCurveTo(x, y - 18, x + 18, y + 8);
      g.stroke();
      continue;
    }
    const lid = e === 'meh' ? 0.45 : e === 'focused' ? 0.6 : 1;
    g.fillStyle = '#fffaf2';
    g.beginPath();
    g.ellipse(x, y, 20, 26 * lid, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 4;
    g.stroke();
    const look = e === 'sad' ? 8 : e === 'confused' ? -6 : 2;
    g.fillStyle = INK;
    g.beginPath();
    g.arc(x + (e === 'confused' ? 5 : 0), y + look * lid, 10 * Math.max(lid, 0.6), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(x + 4, y + look * lid - 4, 3, 0, Math.PI * 2);
    g.fill();
    if (lid < 1) {
      // Heavy upper lid
      g.fillStyle = f.lid;
      g.fillRect(x - 24, y - 34, 48, 34 - 26 * lid + 4);
      g.strokeStyle = INK;
      g.beginPath();
      g.moveTo(x - 20, y - 26 * lid + 2);
      g.lineTo(x + 20, y - 26 * lid + 2);
      g.stroke();
    }
  }

  if (f.lashes && e !== 'ecstatic') {
    // Three flicks of lashes on the outer side of each eye
    g.strokeStyle = INK;
    g.lineWidth = 4;
    eyes.forEach(([x, y], i) => {
      const out = i === 0 ? -1 : 1;
      for (let k = 0; k < 3; k++) {
        const a = -Math.PI / 2 + out * (0.5 + k * 0.35);
        g.beginPath();
        g.moveTo(x + Math.cos(a) * 20, y + Math.sin(a) * 24);
        g.lineTo(x + Math.cos(a) * 31, y + Math.sin(a) * 34);
        g.stroke();
      }
    });
  }

  // Eyebrows
  g.strokeStyle = INK;
  g.lineWidth = 8;
  const brow = (x: number, tilt: number, lift: number) => {
    g.beginPath();
    g.moveTo(x - 20, eyeY - 38 - lift + tilt);
    g.lineTo(x + 20, eyeY - 38 - lift - tilt);
    g.stroke();
  };
  const brows: Record<Expression, [number, number, number, number]> = {
    // [left tilt, left lift, right tilt, right lift]
    neutral: [0, 0, 0, 0],
    focused: [-6, -6, 6, -6],
    happy: [2, 6, -2, 6],
    ecstatic: [3, 12, -3, 12],
    sad: [8, 2, -8, 2],
    confused: [0, -2, -8, 14],
    meh: [0, -4, 0, -4],
  };
  const [lt, ll, rt, rl] = brows[e];
  brow(eyes[0][0], lt, ll);
  brow(eyes[1][0], rt, rl);

  // A little nose: gives the face some structure (nose, moustache, mouth)
  const noseY = (eyeY + f.mouthY) / 2 - 14;
  if (f.nose) {
    g.fillStyle = f.nose;
    g.beginPath();
    g.ellipse(128, noseY, 13, 10, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(255, 220, 200, 0.55)';
    g.beginPath();
    g.ellipse(124, noseY - 4, 4, 3, 0, 0, Math.PI * 2);
    g.fill();
  }

  if (f.sweat && (e === 'sad' || e === 'confused' || e === 'focused')) {
    // A nervous bead of brine on the brow
    const sx = eyes[1][0] + 30;
    const sy = eyeY - 44;
    g.fillStyle = '#9fd8ff';
    g.beginPath();
    g.moveTo(sx, sy - 14);
    g.quadraticCurveTo(sx + 10, sy + 2, sx, sy + 8);
    g.quadraticCurveTo(sx - 10, sy + 2, sx, sy - 14);
    g.fill();
    g.strokeStyle = INK;
    g.lineWidth = 2.5;
    g.stroke();
  }

  // Mouth, below the moustache. Open mouths are dark inside with teeth, so they read as a
  // mouth rather than a pair of lips.
  const my = f.mouthY;
  g.strokeStyle = INK;
  g.lineWidth = 5;
  if (e === 'ecstatic' || e === 'happy') {
    const open = e === 'ecstatic' ? 30 : 16;
    const w = e === 'ecstatic' ? 30 : 24;
    g.save();
    g.beginPath();
    g.moveTo(128 - w, my - 4);
    g.quadraticCurveTo(128, my + open * 1.7, 128 + w, my - 4);
    g.closePath();
    g.fillStyle = '#2a0805';
    g.fill();
    g.clip();
    g.fillStyle = '#fffaf0';
    g.fillRect(128 - w, my - 6, w * 2, 8); // top teeth
    if (e === 'ecstatic') {
      g.fillStyle = '#ff7f8a';
      g.beginPath();
      g.ellipse(128, my + open * 0.95, 14, 9, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.restore();
    g.beginPath();
    g.moveTo(128 - w, my - 4);
    g.quadraticCurveTo(128, my + open * 1.7, 128 + w, my - 4);
    g.closePath();
    g.stroke();
  } else {
    g.beginPath();
    if (e === 'sad') {
      g.moveTo(110, my + 10);
      g.quadraticCurveTo(128, my - 6, 146, my + 10);
    } else if (e === 'confused') {
      g.moveTo(110, my + 2);
      g.bezierCurveTo(120, my - 6, 134, my + 10, 146, my - 2);
    } else if (e === 'focused') {
      g.moveTo(114, my);
      g.lineTo(142, my);
    } else {
      g.moveTo(112, my);
      g.quadraticCurveTo(128, my + (e === 'meh' ? 0 : 8), 144, my);
    }
    g.stroke();
    if (e === 'focused') {
      // Tongue poking out of the corner in concentration
      g.fillStyle = '#ff7f8a';
      g.beginPath();
      g.ellipse(138, my + 6, 7, 6, 0, 0, Math.PI);
      g.fill();
    }
  }

  if (!f.moustache) return;
  // Bushy handlebar moustache with curled tips, drawn as a mass of hair strokes
  const stache = (dir: 1 | -1) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      // Runs out from the middle, drooping slightly, then curls up at the tip
      const x = 128 + dir * (6 + t * 64);
      const y = my - 38 + Math.sin(t * Math.PI) * 6 - Math.pow(Math.max(0, t - 0.7) / 0.3, 2) * 22;
      pts.push([x, y]);
    }
    return pts;
  };
  for (const dir of [1, -1] as const) {
    const path = stache(dir);
    // Thick base, tapering towards the curled tip
    path.forEach(([x, y], i) => {
      const t = i / (path.length - 1);
      const r = 12 * (1 - t) + 2.5;
      g.fillStyle = '#4a2610';
      g.beginPath();
      g.ellipse(x, y, r * 1.15, r, 0, 0, Math.PI * 2);
      g.fill();
    });
    // Hair strokes on top
    g.strokeStyle = '#6e3c19';
    g.lineWidth = 1.6;
    for (let i = 0; i < path.length - 2; i += 1) {
      const [x, y] = path[i];
      const t = i / (path.length - 1);
      const r = 10 * (1 - t) + 2;
      for (const off of [-0.6, 0, 0.6]) {
        g.beginPath();
        g.moveTo(x - dir * 2, y + off * r);
        g.lineTo(x + dir * 6, y + off * r + 2);
        g.stroke();
      }
    }
  }
}

/** One texture per expression, drawn once and reused. */
export function createFaceTextures(style: FaceStyle = DAVE_FACE): Record<Expression, THREE.CanvasTexture> {
  const all: Expression[] = ['neutral', 'focused', 'happy', 'ecstatic', 'sad', 'confused', 'meh'];
  const out = {} as Record<Expression, THREE.CanvasTexture>;
  for (const e of all) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE * 2; // drawn at double resolution so close-ups stay crisp
    const g = c.getContext('2d')!;
    g.scale(2, 2);
    drawFace(g, e, style);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    out[e] = tex;
  }
  return out;
}

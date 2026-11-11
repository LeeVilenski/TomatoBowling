import * as THREE from 'three';

export type Expression = 'neutral' | 'focused' | 'happy' | 'ecstatic' | 'sad' | 'confused' | 'meh';

const SIZE = 256;
const INK = '#2a1206';

/** Draws Dave's face (eyes, brows, moustache, mouth) on a transparent canvas. */
function drawFace(g: CanvasRenderingContext2D, e: Expression) {
  g.clearRect(0, 0, SIZE, SIZE);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const eyeY = 100;
  const eyes: [number, number][] = [
    [88, eyeY],
    [168, eyeY],
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
      g.fillStyle = '#c8281e';
      g.fillRect(x - 24, y - 34, 48, 34 - 26 * lid + 4);
      g.strokeStyle = INK;
      g.beginPath();
      g.moveTo(x - 20, y - 26 * lid + 2);
      g.lineTo(x + 20, y - 26 * lid + 2);
      g.stroke();
    }
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
  g.fillStyle = '#b81d14';
  g.beginPath();
  g.ellipse(128, 134, 13, 10, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(255, 220, 200, 0.55)';
  g.beginPath();
  g.ellipse(124, 130, 4, 3, 0, 0, Math.PI * 2);
  g.fill();

  // Mouth, below the moustache. Open mouths are dark inside with teeth, so they read as a
  // mouth rather than a pair of lips.
  const my = 196;
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

  // Bushy handlebar moustache with curled tips, drawn as a mass of hair strokes
  const stache = (dir: 1 | -1) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 20; i++) {
      const t = i / 20;
      // Runs out from the middle, drooping slightly, then curls up at the tip
      const x = 128 + dir * (6 + t * 64);
      const y = 158 + Math.sin(t * Math.PI) * 6 - Math.pow(Math.max(0, t - 0.7) / 0.3, 2) * 22;
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
export function createFaceTextures(): Record<Expression, THREE.CanvasTexture> {
  const all: Expression[] = ['neutral', 'focused', 'happy', 'ecstatic', 'sad', 'confused', 'meh'];
  const out = {} as Record<Expression, THREE.CanvasTexture>;
  for (const e of all) {
    const c = document.createElement('canvas');
    c.width = c.height = SIZE * 2; // drawn at double resolution so close-ups stay crisp
    const g = c.getContext('2d')!;
    g.scale(2, 2);
    drawFace(g, e);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    out[e] = tex;
  }
  return out;
}

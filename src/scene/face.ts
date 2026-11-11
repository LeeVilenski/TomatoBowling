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

  // Mouth (under the moustache)
  const my = 186;
  g.strokeStyle = INK;
  g.lineWidth = 7;
  g.beginPath();
  if (e === 'ecstatic' || e === 'happy') {
    const open = e === 'ecstatic' ? 34 : 18;
    g.fillStyle = '#5a0f0a';
    g.moveTo(96, my - 6);
    g.quadraticCurveTo(128, my + open * 1.6, 160, my - 6);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (e === 'sad') {
    g.moveTo(102, my + 14);
    g.quadraticCurveTo(128, my - 12, 154, my + 14);
    g.stroke();
  } else if (e === 'confused') {
    g.moveTo(104, my + 4);
    g.bezierCurveTo(116, my - 6, 134, my + 14, 152, my);
    g.stroke();
  } else if (e === 'focused') {
    g.moveTo(110, my + 2);
    g.lineTo(146, my + 2);
    g.stroke();
    // Tongue poking out in concentration
    g.fillStyle = '#ff7f8a';
    g.beginPath();
    g.ellipse(140, my + 10, 9, 8, 0, 0, Math.PI);
    g.fill();
  } else {
    g.moveTo(106, my + 2);
    g.quadraticCurveTo(128, my + (e === 'meh' ? 2 : 10), 150, my + 2);
    g.stroke();
  }

  // Handlebar moustache
  g.fillStyle = '#3b1d0c';
  g.beginPath();
  g.moveTo(128, 160);
  g.bezierCurveTo(108, 150, 84, 158, 76, 176);
  g.bezierCurveTo(70, 164, 60, 160, 54, 166);
  g.bezierCurveTo(66, 180, 98, 186, 128, 172);
  g.bezierCurveTo(158, 186, 190, 180, 202, 166);
  g.bezierCurveTo(196, 160, 186, 164, 180, 176);
  g.bezierCurveTo(172, 158, 148, 150, 128, 160);
  g.fill();
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

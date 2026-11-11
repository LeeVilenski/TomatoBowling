import * as THREE from 'three';
import { DECK_END_Z, OUTER_HALF, pinSpots } from '../game/dimensions';
import { PinSet } from './models';

const NEIGHBOUR_X = OUTER_HALF * 2 + 0.34; // centre of the lanes either side

export function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Glowing two-line neon sign. */
export function neonSign(title: string, sub: string, titleColour: string, subColour: string) {
  const tex = canvasTexture(1024, 360, (g) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const glow = (text: string, y: number, size: number, colour: string, blur: number) => {
      g.font = `italic 900 ${size}px "Trebuchet MS", "Arial Black", sans-serif`;
      g.shadowColor = colour;
      for (const b of [blur * 2, blur, blur / 2]) {
        g.shadowBlur = b;
        g.fillStyle = colour;
        g.fillText(text, 512, y);
      }
      g.shadowBlur = 0;
      g.fillStyle = '#fff4ee';
      g.globalAlpha = 0.85;
      g.fillText(text, 512, y);
      g.globalAlpha = 1;
    };
    // Shrink long titles to fit
    g.font = `italic 900 130px "Trebuchet MS", "Arial Black", sans-serif`;
    const size = Math.min(130, Math.floor((130 * 960) / g.measureText(title).width));
    glow(title, 140, size, titleColour, 28);
    glow(sub, 280, 72, subColour, 22);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.98),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  return sign;
}

/** Front panel of the masking unit above the pins. */
export function maskingPanel(text: string, top: string, bottom: string, stripe: string, emblem: string) {
  const tex = canvasTexture(1024, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, top);
    grd.addColorStop(1, bottom);
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = stripe;
    g.fillRect(0, 214, 1024, 26);
    // Tomato emblems
    for (const x of [150, 874]) {
      g.fillStyle = emblem;
      g.beginPath();
      g.arc(x, 112, 62, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2f8f2a';
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        g.beginPath();
        g.ellipse(x + Math.cos(a) * 22, 56 + Math.sin(a) * 12, 24, 9, a, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.fillStyle = '#fff4e6';
    g.font = 'italic 900 92px "Trebuchet MS", "Arial Black", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 512, 112);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(OUTER_HALF * 2 + 0.6, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }));
}

/** Carpet behind the approach: dark purple with retro confetti shapes. */
export function carpet() {
  const tex = canvasTexture(256, 256, (g) => {
    g.fillStyle = '#2a1640';
    g.fillRect(0, 0, 256, 256);
    const colours = ['#ff4a3a', '#3fae3a', '#ffd23a', '#36b5ff'];
    for (let i = 0; i < 40; i++) {
      g.fillStyle = colours[i % 4];
      g.globalAlpha = 0.6;
      const x = (i * 97) % 256;
      const y = (i * 61) % 256;
      if (i % 3 === 0) {
        g.beginPath();
        g.arc(x, y, 6, 0, Math.PI * 2);
        g.fill();
      } else {
        g.save();
        g.translate(x, y);
        g.rotate(i);
        g.fillRect(-10, -2, 20, 4);
        g.restore();
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 5);
  return tex;
}

/** Parts of the alley every venue shares: neighbouring lanes' pins and masking units, and a face light for Dave. */
export function buildDecor(scene: THREE.Scene) {
  // The neighbouring lanes' pins never move, and are all drawn together
  const spots = pinSpots();
  const neighbours = new PinSet(spots.length * 2, { shadows: false, moving: false });
  const upright = new THREE.Quaternion();
  [-1, 1].forEach((side, k) =>
    spots.forEach((s, i) => neighbours.set(k * spots.length + i, new THREE.Vector3(s.x + side * NEIGHBOUR_X, 0, s.z), upright)),
  );
  neighbours.commit();
  scene.add(neighbours.group);
  for (const side of [-1, 1]) {
    const mask = new THREE.Mesh(
      new THREE.BoxGeometry(OUTER_HALF * 2 + 0.3, 0.55, 0.08),
      new THREE.MeshStandardMaterial({ color: '#8e1d14', roughness: 0.7 }),
    );
    mask.position.set(side * NEIGHBOUR_X, 0.95, DECK_END_Z + 0.4);
    scene.add(mask);
  }

  // Light on Dave's front, for the reaction shots from down the lane
  // (a narrow spotlight, so it doesn't glare off the shiny lanes)
  const faceLight = new THREE.SpotLight('#ffe6cc', 14, 9, 0.32, 0.6, 1.2);
  faceLight.position.set(1.2, 3.2, -3);
  faceLight.target.position.set(0, 1.1, 0.6);
  scene.add(faceLight, faceLight.target);
}

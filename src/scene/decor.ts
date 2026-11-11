import * as THREE from 'three';
import { DECK_END_Z, OUTER_HALF, pinSpots } from '../game/dimensions';
import { createPinMesh } from './models';

const NEIGHBOUR_X = OUTER_HALF * 2 + 0.34; // centre of the lanes either side

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Glowing "Tomato Dave's Ten-pin" neon sign. */
function neonSign() {
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
    glow("Tomato Dave's", 140, 130, '#ff3b2f', 28);
    glow('★ TEN-PIN ★', 280, 80, '#54e04a', 22);
  });
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 0.98),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false }),
  );
  return sign;
}

/** Front panel of the masking unit above the pins. */
function maskingPanel() {
  const tex = canvasTexture(1024, 256, (g) => {
    const grd = g.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#d8301f');
    grd.addColorStop(1, '#9e1c12');
    g.fillStyle = grd;
    g.fillRect(0, 0, 1024, 256);
    g.fillStyle = '#3fae3a';
    g.fillRect(0, 214, 1024, 26);
    // Tomato emblems
    for (const x of [150, 874]) {
      g.fillStyle = '#ff5a40';
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
    g.fillText('LANE 7', 512, 112);
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(OUTER_HALF * 2 + 0.6, 0.55), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }));
}

/** Carpet behind the approach: dark purple with retro confetti shapes. */
function carpet() {
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

/** Ball return between this lane and the next, with spare tomatoes waiting on the rail. */
function ballReturn() {
  const g = new THREE.Group();
  const body = new THREE.MeshStandardMaterial({ color: '#3a2350', roughness: 0.5, flatShading: true });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c9c9d4', metalness: 0.8, roughness: 0.25 });
  const hood = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.7), body);
  hood.position.set(0, 0.45, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.7, 12, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#e0261b', roughness: 0.4 }));
  cap.rotation.x = Math.PI / 2;
  cap.rotation.z = Math.PI / 2;
  cap.position.set(0, 0.67, 0);
  const cabinet = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.55, 2.0), body);
  cabinet.position.set(0, 0.27, 1.35);
  g.add(hood, cap, cabinet);
  for (const x of [-0.08, 0.08]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.0, 6), chrome);
    rail.rotation.x = Math.PI / 2;
    rail.position.set(x, 0.6, 1.35);
    g.add(rail);
  }
  const balls = ['#ff7a1a', '#7ccf3a', '#ffd23a', '#e0261b'];
  balls.forEach((c, i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: c, roughness: 0.2 }));
    b.position.set(0, 0.7, 0.75 + i * 0.24);
    b.castShadow = true;
    g.add(b);
  });
  g.traverse((o) => (o.receiveShadow = true));
  return g;
}

export function buildDecor(scene: THREE.Scene) {
  // Neon sign above the masking unit, and a branded front panel
  const sign = neonSign();
  sign.position.set(0, 1.72, DECK_END_Z + 0.32);
  scene.add(sign);
  const panel = maskingPanel();
  panel.position.set(0, 0.95, DECK_END_Z + 0.445);
  scene.add(panel);

  // Static pins on the neighbouring lanes
  for (const side of [-1, 1]) {
    for (const s of pinSpots()) {
      const pin = createPinMesh();
      pin.traverse((o) => (o.castShadow = false));
      pin.position.set(s.x + side * NEIGHBOUR_X, 0, s.z);
      scene.add(pin);
    }
    // Neighbouring masking units
    const mask = new THREE.Mesh(
      new THREE.BoxGeometry(OUTER_HALF * 2 + 0.3, 0.55, 0.08),
      new THREE.MeshStandardMaterial({ color: '#8e1d14', roughness: 0.7 }),
    );
    mask.position.set(side * NEIGHBOUR_X, 0.95, DECK_END_Z + 0.4);
    scene.add(mask);
  }

  // Ball return on the right-hand side of the approach
  const ret = ballReturn();
  ret.position.set(OUTER_HALF + 0.55, 0, 1.6);
  scene.add(ret);

  // Ceiling lights running down the lanes
  const lightMat = new THREE.MeshBasicMaterial({ color: '#ffe9c4', toneMapped: false });
  const lightGeo = new THREE.BoxGeometry(0.5, 0.04, 0.14);
  for (let z = -6; z > DECK_END_Z; z -= 3.2) {
    for (const x of [-NEIGHBOUR_X / 2, NEIGHBOUR_X / 2]) {
      const l = new THREE.Mesh(lightGeo, lightMat);
      l.position.set(x, 3.4, z);
      scene.add(l);
    }
  }

  // Light on Dave's front, for the reaction shots from down the lane
  // (a narrow spotlight, so it doesn't glare off the shiny lanes)
  const faceLight = new THREE.SpotLight('#ffe6cc', 14, 9, 0.32, 0.6, 1.2);
  faceLight.position.set(1.2, 3.2, -3);
  faceLight.target.position.set(0, 1.1, 0.6);
  scene.add(faceLight, faceLight.target);

  // Behind the bowler: carpeted floor, a bench and a striped wall
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(14, 7),
    new THREE.MeshStandardMaterial({ map: carpet(), roughness: 0.95 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.005, 4.5 + 3.5);
  floor.receiveShadow = true;
  scene.add(floor);
  const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.45, 0.6), new THREE.MeshStandardMaterial({ color: '#c8281e', roughness: 0.5, flatShading: true }));
  bench.position.set(-0.4, 0.22, 6.2);
  const back = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.55, 0.15), bench.material);
  back.position.set(-0.4, 0.6, 6.5);
  scene.add(bench, back);
  const wallTex = canvasTexture(512, 256, (g) => {
    g.fillStyle = '#2a1838';
    g.fillRect(0, 0, 512, 256);
    const stripes = ['#c8281e', '#ffd23a', '#3fae3a'];
    stripes.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, 120 + i * 22, 512, 14);
    });
  });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(14, 4), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.9 }));
  wall.position.set(0, 2, 8.5);
  wall.rotation.y = Math.PI;
  scene.add(wall);
}

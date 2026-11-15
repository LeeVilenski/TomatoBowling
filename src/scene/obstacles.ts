import * as THREE from 'three';
import type { Obstacle } from '../game/challenges';
import { OBSTACLE_HALF } from '../game/challenges';
import { canvasTexture } from './decor';

// The Skills Challenge's junk on the lane: broken keyboards wedged up on their edge, and dead
// mice trailing their cables. Each matches its physics block (see OBSTACLE_HALF).

let keysTex: THREE.Texture | null = null;
/** A grubby keyboard face with a few keys missing. */
function keyboardFace() {
  keysTex ??= canvasTexture(512, 176, (c) => {
    c.fillStyle = '#b8ad88';
    c.fillRect(0, 0, 512, 176);
    let seed = 7;
    const rand = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const rows = [14, 14, 13, 12, 9];
    rows.forEach((n, r) => {
      const w = 470 / 14.5;
      let x = 14 + r * 6;
      for (let k = 0; k < n; k++) {
        const kw = r === 4 && k === 4 ? w * 5 : w - 4; // space bar
        if (rand() < 0.1) {
          c.fillStyle = '#2a2618'; // key missing
        } else {
          c.fillStyle = rand() < 0.15 ? '#8f8466' : '#ddd4b4';
        }
        c.fillRect(x, 12 + r * 32, kw, 26);
        x += kw + 4;
      }
    });
    // Grime, and a crack across the case
    c.fillStyle = 'rgba(50, 40, 20, 0.25)';
    for (let i = 0; i < 300; i++) c.fillRect(rand() * 512, rand() * 176, 3, 3);
    c.strokeStyle = '#2a2618';
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(300, 0);
    c.lineTo(320, 60);
    c.lineTo(305, 110);
    c.lineTo(330, 176);
    c.stroke();
  });
  return keysTex;
}

const caseMat = new THREE.MeshStandardMaterial({ color: '#b8ad88', roughness: 0.75 });
const cableMat = new THREE.MeshStandardMaterial({ color: '#1c1c1a', roughness: 0.7 });
const mouseMat = new THREE.MeshStandardMaterial({ color: '#cfc6a6', roughness: 0.6 });
const buttonMat = new THREE.MeshStandardMaterial({ color: '#a89e7e', roughness: 0.6 });

function keyboard(): THREE.Object3D {
  const [hx, hy, hz] = OBSTACLE_HALF.keyboard;
  const face = new THREE.MeshStandardMaterial({ map: keyboardFace(), roughness: 0.75 });
  // Keys face the bowler (+z)
  const m = new THREE.Mesh(new THREE.BoxGeometry(hx * 2, hy * 2, hz * 2), [caseMat, caseMat, caseMat, caseMat, face, caseMat]);
  m.position.y = hy;
  m.castShadow = true;
  const g = new THREE.Group();
  g.add(m);
  // Its cable, ripped out and lying on the lane
  const pts = [new THREE.Vector3(0.12, hy * 2, 0), new THREE.Vector3(0.2, 0.2, -0.05), new THREE.Vector3(0.3, 0.01, -0.15), new THREE.Vector3(0.45, 0.01, -0.12)];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.005, 5), cableMat));
  return g;
}

function mouse(): THREE.Object3D {
  const [hx, hy, hz] = OBSTACLE_HALF.mouse;
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), mouseMat);
  body.scale.set(hx, hy * 2, hz);
  body.castShadow = true;
  g.add(body);
  for (const side of [-1, 1]) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(hx * 0.8, 0.006, hz * 0.6), buttonMat);
    b.position.set((side * hx) / 2.3, hy * 1.75, hz * 0.5);
    b.rotation.x = -0.3;
    g.add(b);
  }
  // The tail, trailing back towards the bowler and curling off
  const pts = [new THREE.Vector3(0, 0.01, hz), new THREE.Vector3(0.03, 0.006, hz + 0.15), new THREE.Vector3(-0.06, 0.006, hz + 0.3), new THREE.Vector3(0.02, 0.006, hz + 0.45)];
  g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, 0.004, 5), cableMat));
  return g;
}

/** Shows a shot's obstacles on the lane (replacing any already there). */
export class ObstacleView {
  readonly group = new THREE.Group();

  show(list: Obstacle[]) {
    this.clear();
    for (const o of list) {
      const m = o.kind === 'keyboard' ? keyboard() : mouse();
      m.position.set(o.x, 0, o.z);
      m.rotation.y = o.angle ?? 0;
      this.group.add(m);
    }
  }

  clear() {
    for (const c of [...this.group.children]) {
      this.group.remove(c);
      c.traverse((o) => {
        if (o instanceof THREE.Mesh) o.geometry.dispose();
      });
    }
  }
}

// Heads for the computer rivals, worn on Dave's body. Each is built from simple shapes,
// like Dave's tomato, with a curved patch on the front that shows its face texture.
// Coordinates are relative to the top of the neck; the character faces -Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FaceStyle } from './face';
import { DAVE_FACE } from './face';

export type HeadId = 'tomato' | 'pickle' | 'donut' | 'sandwich' | 'carrot';

export interface HeadSpec {
  /** The face drawn on it. */
  face: FaceStyle;
  /** Height of the top of the head (where the speech bubble hangs). */
  top: number;
  /** Neck colour. */
  neck: string;
  /**
   * An ellipsoid that encloses the head, used to check hands never go through it:
   * centre (y) and radii (x, y, z).
   */
  bounds: { y: number; rx: number; ry: number; rz: number };
}

export const HEADS: Record<HeadId, HeadSpec> = {
  tomato: { face: DAVE_FACE, top: 0.46, neck: '#3f8f2a', bounds: { y: 0.2024, rx: 0.23, ry: 0.2024, rz: 0.23 } },
  pickle: {
    face: { lid: '#5f8f2e', nose: '#4d7a22', moustache: false, lashes: false, sweat: true, eyeY: 96, eyeGap: 72, mouthY: 190 },
    top: 0.62,
    neck: '#4d7a22',
    bounds: { y: 0.3, rx: 0.16, ry: 0.31, rz: 0.16 },
  },
  donut: {
    // Eyes on the iced upper ring, mouth on the lower ring: no nose, there's a hole there
    face: { lid: '#ff7fb6', nose: null, moustache: false, lashes: true, sweat: false, eyeY: 70, eyeGap: 82, mouthY: 214 },
    top: 0.52,
    neck: '#d99a52',
    bounds: { y: 0.26, rx: 0.25, ry: 0.25, rz: 0.12 },
  },
  sandwich: {
    // Eyes on the top slice, mouth on the bottom one (the lettuce frill runs between)
    face: { lid: '#e9c48a', nose: null, moustache: false, lashes: true, sweat: false, eyeY: 84, eyeGap: 80, mouthY: 196 },
    top: 0.3,
    neck: '#e9c48a',
    bounds: { y: 0.14, rx: 0.24, ry: 0.17, rz: 0.2 },
  },
  carrot: {
    face: { lid: '#e8741c', nose: '#c85a10', moustache: false, lashes: false, sweat: false, eyeY: 96, eyeGap: 76, mouthY: 196 },
    top: 0.78,
    neck: '#2f8f2a',
    bounds: { y: 0.3, rx: 0.19, ry: 0.32, rz: 0.19 },
  },
};

const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, ...extra });

function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

/**
 * A patch for the face texture, `w` × `h` metres, bent round a cylinder of radius `bend`
 * (or flat) so it hugs a curved head. It faces -Z, the way the character looks.
 */
export function facePatch(w: number, h: number, bend: number | null, material: THREE.Material) {
  const geo = new THREE.PlaneGeometry(w, h, 24, 1);
  if (bend) {
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const a = x / bend;
      pos.setXYZ(i, Math.sin(a) * bend, pos.getY(i), -bend * (1 - Math.cos(a)));
    }
    geo.computeVertexNormals();
  }
  geo.rotateY(Math.PI); // face -Z
  const m = new THREE.Mesh(geo, material);
  m.renderOrder = 1;
  return m;
}

/** Scatters little bumps over a surface: points from `place`, each a small sphere. */
function bumps(group: THREE.Group, count: number, r: number, mat: THREE.Material, place: (i: number) => THREE.Vector3) {
  const geo = new THREE.SphereGeometry(r, 8, 6);
  for (let i = 0; i < count; i++) group.add(mesh(geo, mat, ...place(i).toArray()));
}

/** Pseudo-random but repeatable, so a head looks the same every time it's built. */
function seeded(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
}

/** Builds a rival head. Returns its group and the patch its face texture goes on. */
export function buildHead(id: Exclude<HeadId, 'tomato'>, faceMat: THREE.Material): { group: THREE.Group; face: THREE.Mesh } {
  const g = new THREE.Group();
  const rand = seeded(id.length * 977);
  let face: THREE.Mesh;

  if (id === 'pickle') {
    // A warty green pickle, with a slight lean
    const skin = std('#5f8f2e', { roughness: 0.45 });
    const body = new THREE.Group();
    body.add(mesh(new THREE.CapsuleGeometry(0.135, 0.3, 10, 24), skin, 0, 0.3, 0));
    bumps(body, 34, 0.014, std('#4d7a22', { roughness: 0.5 }), () => {
      const a = rand() * Math.PI * 2;
      const y = 0.06 + rand() * 0.48;
      // Keep the face clear of warts
      const front = Math.abs(a - Math.PI * 1.5) < 0.7 && y > 0.2 && y < 0.48;
      const ang = front ? a + Math.PI : a;
      return new THREE.Vector3(Math.cos(ang) * 0.133, y, Math.sin(ang) * 0.133);
    });
    face = facePatch(0.28, 0.28, 0.14, faceMat);
    face.position.set(0, 0.35, -0.139);
    body.add(face);
    body.rotation.z = 0.08;
    g.add(body);
  } else if (id === 'donut') {
    // Standing on its edge, facing forward: dough, a pink glaze on the front, sprinkles
    const ring = new THREE.Group();
    ring.position.y = 0.26;
    ring.add(mesh(new THREE.TorusGeometry(0.155, 0.095, 20, 44), std('#d99a52', { roughness: 0.7 })));
    const glaze = mesh(new THREE.TorusGeometry(0.155, 0.1, 20, 44), std('#ff7fb6', { roughness: 0.3 }));
    // Squashed and pushed forward so the icing covers the front of the dough
    glaze.scale.z = 0.55;
    glaze.position.z = -0.05;
    ring.add(glaze);
    const colours = ['#ffffff', '#ffd23a', '#36c8ff', '#3fae3a', '#ff3b2f'].map((c) => std(c, { roughness: 0.4 }));
    const sprinkle = new THREE.BoxGeometry(0.03, 0.007, 0.007);
    for (let i = 0; i < 40; i++) {
      const a = rand() * Math.PI * 2;
      const r = 0.155 + (rand() - 0.5) * 0.14;
      // Not on the eyes or mouth
      const sy = Math.sin(a) * r;
      if (Math.abs(Math.cos(a) * r) < 0.12 && (Math.abs(sy - 0.12) < 0.06 || Math.abs(sy + 0.17) < 0.05)) continue;
      const s = mesh(sprinkle, colours[i % colours.length], Math.cos(a) * r, sy, -0.106);
      s.rotation.z = rand() * Math.PI;
      ring.add(s);
    }
    face = facePatch(0.5, 0.5, null, faceMat);
    face.position.set(0, 0, -0.112);
    ring.add(face);
    g.add(ring);
  } else if (id === 'sandwich') {
    // Bread, cheese, tomato, lettuce, bread
    const bread = std('#e9c48a', { roughness: 0.85 });
    const crust = std('#b9783a', { roughness: 0.8 });
    const slice = (y: number, h: number) => {
      const s = new THREE.Group();
      s.add(mesh(new RoundedBoxGeometry(0.38, h, 0.32, 3, 0.03), crust, 0, y, 0));
      // Lighter crumb on the front
      s.add(mesh(new RoundedBoxGeometry(0.34, h - 0.02, 0.01, 2, 0.004), bread, 0, y, -0.16));
      return s;
    };
    g.add(slice(0.045, 0.08));
    const cheese = mesh(new THREE.BoxGeometry(0.4, 0.014, 0.34), std('#ffcf3a', { roughness: 0.4 }), 0.01, 0.092, 0);
    cheese.rotation.z = -0.05;
    g.add(cheese);
    for (const x of [-0.08, 0.09]) g.add(mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.022, 24), std('#e0261b', { roughness: 0.35 }), x, 0.11, -0.06));
    // Lettuce: a frilly green layer poking out all round
    const frill = new THREE.Shape();
    const n = 28;
    for (let i = 0; i <= n; i++) {
      const a = (i / n) * Math.PI * 2;
      const r = 0.21 + (i % 2 ? 0.025 : 0);
      if (i === 0) frill.moveTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.9);
      else frill.lineTo(Math.cos(a) * r * 1.05, Math.sin(a) * r * 0.9);
    }
    const lettuce = mesh(new THREE.ExtrudeGeometry(frill, { depth: 0.014, bevelEnabled: false }), std('#5fbf3a', { roughness: 0.5, side: THREE.DoubleSide }), 0, 0.14, 0);
    lettuce.rotation.x = Math.PI / 2;
    g.add(lettuce);
    g.add(slice(0.2, 0.1));
    face = facePatch(0.34, 0.34, null, faceMat);
    face.position.set(0, 0.14, -0.172);
    g.add(face);
  } else {
    // A carrot, point down into the collar, ridged, with fronds on top
    const geo = new THREE.ConeGeometry(0.17, 0.48, 28, 12);
    geo.rotateX(Math.PI); // point down
    const pos = geo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const ridge = 1 + 0.035 * Math.sin(v.y * 70);
      pos.setXYZ(i, v.x * ridge, v.y, v.z * ridge);
    }
    geo.computeVertexNormals();
    g.add(mesh(geo, std('#ea7a1e', { roughness: 0.55 }), 0, 0.26, 0));
    const leaf = std('#2f8f2a', { roughness: 0.6 });
    const frond = new THREE.ConeGeometry(0.018, 0.26, 6);
    for (let i = 0; i < 7; i++) {
      const f = mesh(frond, leaf, 0, 0.6, 0);
      const a = (i / 7) * Math.PI * 2;
      f.position.x = Math.cos(a) * 0.04;
      f.position.z = Math.sin(a) * 0.04;
      f.rotation.set(Math.sin(a) * 0.45, 0, -Math.cos(a) * 0.45);
      g.add(f);
    }
    // On the sloping front of the cone, tipped to match it
    face = facePatch(0.3, 0.3, 0.15, faceMat);
    face.position.set(0, 0.38, -0.142);
    face.rotation.x = -0.34; // top tipped forward, like the cone's surface
    g.add(face);
  }
  return { group: g, face };
}

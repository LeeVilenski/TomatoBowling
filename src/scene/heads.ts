// Heads for the computer rivals, worn on Dave's body. Each is built from simple shapes,
// like Dave's tomato, with a curved patch on the front that shows its face texture.
// Coordinates are relative to the top of the neck; the character faces -Z.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { FaceStyle } from './face';
import { DAVE_FACE } from './face';

import type { RivalHead } from '../game/rivals';

export type HeadId = 'tomato' | RivalHead;

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

/** A face for a rival: Dave's layout, no moustache, in the head's own colours. */
const face = (lid: string, nose: string | null, extra: Partial<FaceStyle> = {}): FaceStyle => ({
  lid,
  nose,
  moustache: false,
  lashes: false,
  sweat: false,
  eyeY: 96,
  eyeGap: 76,
  mouthY: 194,
  ...extra,
});

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
  // Server Room Lanes
  crisp: { face: face('#e8b84a', '#c98a2e'), top: 0.46, neck: '#e8b84a', bounds: { y: 0.22, rx: 0.21, ry: 0.21, rz: 0.08 } },
  cookie: { face: face('#c58a4a', '#8a5a2b', { lashes: true }), top: 0.44, neck: '#c58a4a', bounds: { y: 0.22, rx: 0.2, ry: 0.2, rz: 0.06 } },
  wafer: { face: face('#e8c98a', '#c9a26b', { eyeGap: 70 }), top: 0.42, neck: '#e8c98a', bounds: { y: 0.2, rx: 0.15, ry: 0.2, rz: 0.08 } },
  brie: { face: face('#f6e3a1', '#e0c070', { eyeY: 104, eyeGap: 64, mouthY: 196, lashes: true }), top: 0.4, neck: '#f4efe2', bounds: { y: 0.16, rx: 0.19, ry: 0.2, rz: 0.1 } },
  // Disco Inferno
  jelly: { face: face('#e8344a', null), top: 0.36, neck: '#e8344a', bounds: { y: 0.16, rx: 0.2, ry: 0.18, rz: 0.2 } },
  mango: { face: face('#f2a33a', '#d9802a', { lashes: true }), top: 0.5, neck: '#3fae3a', bounds: { y: 0.22, rx: 0.18, ry: 0.22, rz: 0.17 } },
  lemon: { face: face('#f5d020', '#d9b010'), top: 0.32, neck: '#f5d020', bounds: { y: 0.15, rx: 0.23, ry: 0.15, rz: 0.15 } },
  aubergine: { face: face('#4a1e5a', '#6a2e7a', { lashes: true, eyeY: 92 }), top: 0.58, neck: '#3f8f2a', bounds: { y: 0.22, rx: 0.19, ry: 0.26, rz: 0.19 } },
  // Rooftop at Sunset
  egg: { face: face('#fbf7ee', null, { eyeY: 78, mouthY: 200, eyeGap: 88 }), top: 0.44, neck: '#fbf7ee', bounds: { y: 0.2, rx: 0.23, ry: 0.21, rz: 0.11 } },
  lolly: { face: face('#ff5a3a', null, { eyeY: 90, eyeGap: 68 }), top: 0.44, neck: '#d9b382', bounds: { y: 0.22, rx: 0.13, ry: 0.2, rz: 0.07 } },
  kiwi: { face: face('#7cc43a', null), top: 0.42, neck: '#8a5a2b', bounds: { y: 0.19, rx: 0.18, ry: 0.2, rz: 0.18 } },
  potato: { face: face('#a8784a', '#8a5a2b', { moustache: true }), top: 0.5, neck: '#a8784a', bounds: { y: 0.23, rx: 0.22, ry: 0.24, rz: 0.2 } },
  // The Golden Pin
  pumpkin: { face: face('#e8771a', '#b8560f', { moustache: true }), top: 0.66, neck: '#3f6b2a', bounds: { y: 0.2, rx: 0.24, ry: 0.21, rz: 0.24 } },
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
  } else if (id === 'carrot') {
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
  } else {
    face = buildMore(id, g, faceMat, rand);
  }
  return { group: g, face };
}

/** An ellipsoid: a sphere stretched to radii (rx, ry, rz). */
function ellipsoid(rx: number, ry: number, rz: number, mat: THREE.Material, segments = 32) {
  const m = mesh(new THREE.SphereGeometry(1, segments, Math.round(segments * 0.7)), mat);
  m.scale.set(rx, ry, rz);
  return m;
}

/** A flat canvas-drawn texture. */
function drawn(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d')!);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** The career heads beyond the home ladder. */
function buildMore(id: HeadId, g: THREE.Group, faceMat: THREE.Material, rand: () => number): THREE.Mesh {
  let face: THREE.Mesh;
  switch (id) {
    case 'crisp': {
      // A wavy crisp standing on its edge, with a few darker toasty spots
      const geo = new THREE.CylinderGeometry(0.2, 0.2, 0.025, 40, 1);
      geo.rotateX(Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const y = pos.getY(i);
        pos.setZ(i, pos.getZ(i) + 0.06 * ((x / 0.2) ** 2 - (y / 0.2) ** 2) * 0.5 + 0.012 * Math.sin(x * 40));
      }
      geo.computeVertexNormals();
      const crisp = mesh(geo, std('#e8b84a', { roughness: 0.45 }), 0, 0.22, 0);
      g.add(crisp);
      const spot = std('#b8782a', { roughness: 0.6 });
      for (const [x, y] of [[-0.12, 0.08], [0.13, -0.05], [-0.06, -0.12], [0.1, 0.12]]) {
        const d = mesh(new THREE.CircleGeometry(0.02, 12), spot, x, 0.22 + y, -0.02);
        d.rotation.y = Math.PI;
        g.add(d);
      }
      face = facePatch(0.3, 0.3, null, faceMat);
      face.position.set(0, 0.22, -0.03);
      break;
    }
    case 'cookie': {
      // A thick round cookie facing forward, studded with chocolate chips
      const geo = new THREE.CylinderGeometry(0.19, 0.19, 0.06, 40);
      geo.rotateX(Math.PI / 2);
      g.add(mesh(geo, std('#c58a4a', { roughness: 0.85 }), 0, 0.22, 0));
      const chip = std('#4a2a14', { roughness: 0.6 });
      const chipGeo = new THREE.DodecahedronGeometry(0.018);
      for (let i = 0; i < 14; i++) {
        const a = rand() * Math.PI * 2;
        const r = 0.05 + rand() * 0.12;
        const x = Math.cos(a) * r;
        const y = Math.sin(a) * r;
        // Not on the eyes or mouth
        if (Math.abs(x) < 0.1 && (Math.abs(y - 0.05) < 0.05 || Math.abs(y + 0.08) < 0.04)) continue;
        g.add(mesh(chipGeo, chip, x, 0.22 + y, -0.032));
      }
      face = facePatch(0.32, 0.32, null, faceMat);
      face.position.set(0, 0.22, -0.034);
      break;
    }
    case 'wafer': {
      // A wafer biscuit: a rounded block with a criss-cross grid pressed into it
      const grid = drawn(128, 128, (c) => {
        c.fillStyle = '#e8c98a';
        c.fillRect(0, 0, 128, 128);
        c.strokeStyle = '#c9a26b';
        c.lineWidth = 3;
        for (let i = 0; i <= 128; i += 16) {
          c.beginPath();
          c.moveTo(i, 0);
          c.lineTo(i, 128);
          c.moveTo(0, i);
          c.lineTo(128, i);
          c.stroke();
        }
      });
      g.add(mesh(new RoundedBoxGeometry(0.26, 0.36, 0.12, 3, 0.03), std('#ffffff', { map: grid, roughness: 0.8 }), 0, 0.2, 0));
      face = facePatch(0.26, 0.26, null, faceMat);
      face.position.set(0, 0.2, -0.062);
      break;
    }
    case 'brie': {
      // A wedge of brie, point up, with a white rind on the back
      const tri = new THREE.Shape();
      tri.moveTo(-0.17, 0);
      tri.lineTo(0.17, 0);
      tri.lineTo(0, 0.36);
      tri.lineTo(-0.17, 0);
      const wedge = new THREE.ExtrudeGeometry(tri, { depth: 0.16, bevelEnabled: true, bevelSize: 0.01, bevelThickness: 0.01, bevelSegments: 2 });
      wedge.translate(0, 0, -0.08);
      g.add(mesh(wedge, std('#f6e3a1', { roughness: 0.55 }), 0, 0.02, 0));
      g.add(mesh(new RoundedBoxGeometry(0.36, 0.06, 0.18, 2, 0.02), std('#f4efe2', { roughness: 0.9 }), 0, 0.02, 0));
      face = facePatch(0.24, 0.24, null, faceMat);
      face.position.set(0, 0.15, -0.092);
      break;
    }
    case 'jelly': {
      // A glossy, slightly see-through jelly from a fancy mould
      const prof = [[0.17, 0], [0.185, 0.03], [0.16, 0.09], [0.175, 0.15], [0.145, 0.23], [0.12, 0.28], [0.06, 0.31], [0, 0.32]].map(([r, y]) => new THREE.Vector2(r, y));
      const mat = std('#e8344a', { roughness: 0.12, transparent: true, opacity: 0.88 });
      g.add(mesh(new THREE.LatheGeometry(prof, 36), mat));
      face = facePatch(0.24, 0.24, 0.17, faceMat);
      face.position.set(0, 0.15, -0.168);
      break;
    }
    case 'mango': {
      // A mango, green at the bottom ripening to red at the top, with a stalk and leaf
      const geo = new THREE.SphereGeometry(1, 32, 22);
      const pos = geo.attributes.position;
      const colours = new Float32Array(pos.count * 3);
      const lo = new THREE.Color('#7cb83a');
      const mid = new THREE.Color('#f2a33a');
      const hi = new THREE.Color('#e8442a');
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        const t = (pos.getY(i) + 1) / 2 + pos.getX(i) * 0.15;
        if (t < 0.5) c.copy(lo).lerp(mid, t * 2);
        else c.copy(mid).lerp(hi, (t - 0.5) * 2);
        colours.set([c.r, c.g, c.b], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
      const body = mesh(geo, std('#ffffff', { vertexColors: true, roughness: 0.4 }), 0, 0.22, 0);
      body.scale.set(0.17, 0.21, 0.16);
      body.rotation.z = -0.15;
      g.add(body);
      g.add(mesh(new THREE.CylinderGeometry(0.008, 0.012, 0.05, 6), std('#5a3a1e'), 0.03, 0.44, 0));
      const leaf = mesh(new THREE.SphereGeometry(1, 10, 6), std('#3fae3a', { roughness: 0.5 }), 0.07, 0.46, 0);
      leaf.scale.set(0.06, 0.012, 0.025);
      leaf.rotation.z = 0.4;
      g.add(leaf);
      face = facePatch(0.26, 0.26, 0.17, faceMat);
      face.position.set(0, 0.23, -0.16);
      break;
    }
    case 'lemon': {
      // A lemon lying on its side: pointed at both ends, lightly dimpled
      const prof: THREE.Vector2[] = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        prof.push(new THREE.Vector2(0.145 * Math.pow(Math.sin(Math.PI * t), 0.75) + (t < 0.04 || t > 0.96 ? 0.012 : 0), -0.22 + t * 0.44));
      }
      const geo = new THREE.LatheGeometry(prof, 32);
      geo.rotateZ(Math.PI / 2);
      const pos = geo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const k = 1 + 0.012 * Math.sin(pos.getX(i) * 90) * Math.sin(pos.getZ(i) * 80);
        pos.setXYZ(i, pos.getX(i), pos.getY(i) * k, pos.getZ(i) * k);
      }
      geo.computeVertexNormals();
      g.add(mesh(geo, std('#f5d020', { roughness: 0.45 }), 0, 0.15, 0));
      face = facePatch(0.24, 0.24, 0.15, faceMat);
      face.position.set(0, 0.15, -0.14);
      break;
    }
    case 'aubergine': {
      // A glossy aubergine: a fat bulb at the bottom, narrowing up to a green cap
      const prof = [[0.0, 0], [0.12, 0.02], [0.175, 0.1], [0.17, 0.2], [0.13, 0.3], [0.1, 0.38], [0.08, 0.43], [0.0, 0.45]].map(([r, y]) => new THREE.Vector2(r, y));
      g.add(mesh(new THREE.LatheGeometry(new THREE.SplineCurve(prof).getPoints(30), 36), std('#4a1e5a', { roughness: 0.2, metalness: 0.1 })));
      const cap = std('#3f8f2a', { roughness: 0.6 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const leaf = mesh(new THREE.ConeGeometry(0.035, 0.11, 6), cap, Math.cos(a) * 0.06, 0.42, Math.sin(a) * 0.06);
        leaf.rotation.set(Math.sin(a) * 1.9, 0, -Math.cos(a) * 1.9);
        g.add(leaf);
      }
      g.add(mesh(new THREE.CylinderGeometry(0.015, 0.025, 0.09, 8), cap, 0, 0.5, 0));
      face = facePatch(0.26, 0.26, 0.17, faceMat);
      face.position.set(0, 0.17, -0.17);
      break;
    }
    case 'egg': {
      // A fried egg standing up: a wobbly white with a round yolk for a nose
      const white = new THREE.Shape();
      for (let i = 0; i <= 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        const r = 0.2 + 0.025 * Math.sin(a * 3) + 0.015 * Math.sin(a * 7);
        const x = Math.cos(a) * r * 1.05;
        const y = Math.sin(a) * r;
        if (i === 0) white.moveTo(x, y);
        else white.lineTo(x, y);
      }
      const geo = new THREE.ExtrudeGeometry(white, { depth: 0.03, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 3 });
      geo.translate(0, 0, -0.015);
      g.add(mesh(geo, std('#fbf7ee', { roughness: 0.35 }), 0, 0.2, 0));
      const yolk = mesh(new THREE.SphereGeometry(0.07, 24, 16), std('#ffb52e', { roughness: 0.25 }), 0.0, 0.205, -0.03);
      yolk.scale.z = 0.6;
      g.add(yolk);
      face = facePatch(0.36, 0.36, null, faceMat);
      face.position.set(0, 0.2, -0.035);
      break;
    }
    case 'lolly': {
      // A three-stripe ice lolly; the neck below is its stick
      const bands = ['#ff5a3a', '#ffa83a', '#ffe14a'];
      bands.forEach((col, i) => g.add(mesh(new RoundedBoxGeometry(0.22, 0.13, 0.09, 3, 0.035), std(col, { roughness: 0.3 }), 0, 0.32 - i * 0.115, 0)));
      face = facePatch(0.22, 0.22, null, faceMat);
      face.position.set(0, 0.26, -0.047);
      break;
    }
    case 'kiwi': {
      // A kiwi, fuzzy brown, cut to show the green inside (where the face is)
      g.add(ellipsoid(0.17, 0.19, 0.155, std('#8a5a2b', { roughness: 0.95 })).translateY(0.19));
      const inside = drawn(256, 256, (c) => {
        const grad = c.createRadialGradient(128, 128, 10, 128, 128, 128);
        grad.addColorStop(0, '#f4f6d8');
        grad.addColorStop(0.25, '#b6e05a');
        grad.addColorStop(1, '#5fa52c');
        c.fillStyle = grad;
        c.beginPath();
        c.arc(128, 128, 126, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = '#1a1206';
        for (let i = 0; i < 26; i++) {
          const a = (i / 26) * Math.PI * 2;
          c.beginPath();
          c.ellipse(128 + Math.cos(a) * 52, 128 + Math.sin(a) * 52, 5, 2.5, a, 0, Math.PI * 2);
          c.fill();
        }
      });
      // Sits just in front of the brown skin, like the cut face of a halved kiwi
      const cut = mesh(new THREE.CircleGeometry(0.15, 40), new THREE.MeshStandardMaterial({ map: inside, roughness: 0.5 }), 0, 0.19, -0.157);
      cut.scale.y = 1.1;
      cut.rotation.y = Math.PI;
      g.add(cut);
      face = facePatch(0.28, 0.28, null, faceMat);
      face.position.set(0, 0.19, -0.16);
      break;
    }
    case 'potato': {
      // A big lumpy potato with dark little eyes in its skin
      const geo = new THREE.SphereGeometry(1, 36, 26);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const k = 1 + 0.06 * Math.sin(v.x * 4 + 1) * Math.sin(v.y * 3) + 0.04 * Math.sin(v.z * 5 + v.y * 2);
        pos.setXYZ(i, v.x * k, v.y * k, v.z * k);
      }
      geo.computeVertexNormals();
      const spud = mesh(geo, std('#a8784a', { roughness: 0.9 }), 0, 0.23, 0);
      spud.scale.set(0.2, 0.23, 0.18);
      g.add(spud);
      bumps(g, 10, 0.01, std('#5a3a1e'), () => {
        const a = rand() * Math.PI * 2;
        const y = (rand() - 0.5) * 0.3;
        const ang = Math.abs(a - Math.PI * 1.5) < 0.8 ? a + Math.PI : a;
        return new THREE.Vector3(Math.cos(ang) * 0.19, 0.23 + y, Math.sin(ang) * 0.17);
      });
      face = facePatch(0.3, 0.3, 0.2, faceMat);
      face.position.set(0, 0.24, -0.19);
      break;
    }
    default: {
      // The Pumpkin King: a deep-ribbed pumpkin, a curly stalk, and a golden crown
      const R = 0.23;
      const geo = new THREE.SphereGeometry(R, 48, 32);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const lon = Math.atan2(v.z, v.x);
        const lat = Math.abs(v.y) / R;
        v.multiplyScalar(1 - 0.09 * Math.pow(Math.abs(Math.cos(lon * 4)), 3) * (1 - lat * lat));
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      const body = mesh(geo, std('#e8771a', { roughness: 0.45 }), 0, 0.2, 0);
      body.scale.y = 0.88;
      g.add(body);
      g.add(mesh(new THREE.CylinderGeometry(0.02, 0.03, 0.07, 8), std('#3f6b2a'), 0, 0.42, 0));
      const gold = std('#d4a017', { metalness: 0.85, roughness: 0.25 });
      g.add(mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.06, 28, 1, true), gold, 0, 0.44, 0));
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        g.add(mesh(new THREE.ConeGeometry(0.025, 0.07, 8), gold, Math.cos(a) * 0.12, 0.505, Math.sin(a) * 0.12));
      }
      g.add(mesh(new THREE.SphereGeometry(0.022, 12, 8), std('#c8281e', { roughness: 0.15, metalness: 0.2 }), 0, 0.45, -0.128));
      face = facePatch(0.3, 0.3, 0.23, faceMat);
      face.position.set(0, 0.2, -0.205);
      break;
    }
  }
  g.add(face);
  return face;
}

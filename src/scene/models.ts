import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BALL_RADIUS, PIN_PROFILE } from '../game/dimensions';
import { RIVAL_BALLS } from './rivalBalls';

/** Pin geometry and materials, built once and shared by every pin in the alley. */
let pinParts: { body: THREE.BufferGeometry; stripes: THREE.BufferGeometry; white: THREE.Material; red: THREE.Material } | null = null;
function getPinParts() {
  if (pinParts) return pinParts;
  // Smooth curve through the profile points so the pin's outline isn't faceted
  const curve = new THREE.SplineCurve(PIN_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)));
  const pts = curve.getPoints(60).map((p) => new THREE.Vector2(Math.max(0, p.x), p.y));
  const rings = [
    [0.247, 0.0234],
    [0.262, 0.0238],
  ].map(([y, r]) => new THREE.CylinderGeometry(r + 0.0012, r + 0.0012, 0.008, 40, 1, true).translate(0, y, 0));
  pinParts = {
    body: new THREE.LatheGeometry(pts, 40),
    stripes: mergeGeometries(rings)!,
    white: new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.25 }),
    red: new THREE.MeshStandardMaterial({ color: '#d0201a', roughness: 0.3 }),
  };
  return pinParts;
}

const HIDDEN = new THREE.Matrix4().makeScale(0, 0, 0);
const ONE = new THREE.Vector3(1, 1, 1);

/**
 * A set of pins drawn together (two draw calls for any number of pins, instead of two or
 * three per pin). Move pins with `set`, then call `commit` once per frame.
 */
export class PinSet {
  readonly group = new THREE.Group();
  private body: THREE.InstancedMesh;
  private stripes: THREE.InstancedMesh;
  private m = new THREE.Matrix4();
  private p = new THREE.Vector3();
  private q = new THREE.Quaternion();

  constructor(
    readonly count: number,
    { shadows = true, moving = true } = {},
  ) {
    const parts = getPinParts();
    this.body = new THREE.InstancedMesh(parts.body, parts.white, count);
    this.stripes = new THREE.InstancedMesh(parts.stripes, parts.red, count);
    for (const mesh of [this.body, this.stripes]) {
      mesh.castShadow = shadows;
      mesh.receiveShadow = true;
      // Moving pins fly all over the deck, so don't let a stale bounding sphere cull them
      mesh.frustumCulled = !moving;
      if (moving) mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(mesh);
    }
  }

  /** Accepts plain {x, y, z} / {x, y, z, w} objects, like the ones the physics engine returns. */
  set(i: number, pos: THREE.Vector3Like, quat: THREE.QuaternionLike, visible = true) {
    if (visible) this.m.compose(this.p.copy(pos), this.q.set(quat.x, quat.y, quat.z, quat.w), ONE);
    const m = visible ? this.m : HIDDEN;
    this.body.setMatrixAt(i, m);
    this.stripes.setMatrixAt(i, m);
  }

  /** Upload this frame's pin positions. */
  commit() {
    this.body.instanceMatrix.needsUpdate = true;
    this.stripes.instanceMatrix.needsUpdate = true;
    if (this.body.frustumCulled) {
      this.body.computeBoundingSphere();
      this.stripes.computeBoundingSphere();
    }
  }
}


/**
 * One layer of paint on a ball, drawn onto a wrap-around texture (left to right is once
 * round the ball, top to bottom is pole to pole). Layers are painted in order.
 */
export type BallLayer =
  | { fill: string }
  /** Colours from the top of the ball to the bottom. */
  | { gradient: string[] }
  /** Equal bands from top to bottom (like layers of a cake); `wobble` makes them wavy, and '' leaves a band unpainted. */
  | { bands: string[]; wobble?: number }
  /** Stripes that spiral round the ball, like a lollipop. */
  | { swirl: string[]; turns?: number }
  /** Icing over the top of the ball down to `to` (0 top, 1 bottom), with drips. */
  | { drip: string; to: number }
  /** A grid of lines: `cells` squares round the equator. */
  | { grid: string; cells: number; width?: number }
  /** Thin wandering lines, like the veins in blue cheese or marble. */
  | { veins: string; count?: number; width?: number }
  /** Little dots scattered between `from` and `to` (0 top, 1 bottom). `size` is a fraction of the ball's height. */
  | { speckle: string[]; count: number; size: number; from?: number; to?: number }
  /** Big round spots at [round, down, size, colour] (round and down are 0–1). */
  | { spots: [number, number, number, string][] }
  /** Lines from pole to pole, like the ribs of a pumpkin. */
  | { ribs: string; count: number; width?: number };

export interface BallStyle {
  colour: string;
  radius: number;
  roughness: number;
  metalness: number;
  /** Leaves on top (a tomato, a pumpkin...). Without them it's a bowling ball, with finger holes. */
  leaf?: string;
  stripes?: [string, string, string];
  glow?: string;
  /** Painted pattern, for the computer rivals' balls. */
  paint?: BallLayer[];
  /** How many pairs of grooves down the sides (a tomato has 3). Defaults to 3 with leaves, none without. */
  lobes?: number;
  lobeDepth?: number;
}

/** The tomato balls players can unlock (the cherry tomato is a little smaller), and the rivals' balls. */
export const BALL_STYLES: Record<string, BallStyle> = {
  classic: { colour: '#e0261b', radius: BALL_RADIUS, roughness: 0.18, metalness: 0.05, leaf: '#2f8f2a' },
  cherry: { colour: '#ff3418', radius: 0.095, roughness: 0.12, metalness: 0.05, leaf: '#2f8f2a' },
  green: { colour: '#7cc43a', radius: BALL_RADIUS, roughness: 0.25, metalness: 0.0, leaf: '#1f6b1c' },
  heirloom: { colour: '#e0261b', radius: BALL_RADIUS, roughness: 0.2, metalness: 0.05, leaf: '#2f8f2a', stripes: ['#d9361a', '#ffb02e', '#8bbf3a'] },
  golden: { colour: '#ffcc3a', radius: BALL_RADIUS, roughness: 0.2, metalness: 0.7, leaf: '#c99a1e', glow: '#4a3300' },
  // Career rewards
  circuit: { colour: '#1f6b34', radius: BALL_RADIUS, roughness: 0.3, metalness: 0.35, leaf: '#d4a017', stripes: ['#1a5a2c', '#d4a017', '#0f3d1e'], glow: '#06200e' },
  sunset: { colour: '#ff8a4c', radius: BALL_RADIUS, roughness: 0.18, metalness: 0.1, leaf: '#2f8f2a', stripes: ['#ff8a4c', '#c8406a', '#ffd23a'] },
  // The computer rivals' own strike and spare balls (not for Dave)
  ...RIVAL_BALLS,
};

/** Small, seedable random numbers, so a ball's speckles land in the same places every time. */
function seeded(text: string) {
  let seed = 2166136261;
  for (const ch of text) seed = Math.imul(seed ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
}

const TEX_W = 1024;
const TEX_H = 512;

/** Paints a ball's layers onto a canvas, ready to wrap round a sphere. */
export function paintBall(layers: BallLayer[], seedText: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = TEX_W;
  canvas.height = TEX_H;
  const ctx = canvas.getContext('2d')!;
  const rand = seeded(seedText);
  const rgb = (c: string) => new THREE.Color(c).convertLinearToSRGB();
  /** Colours each pixel the function picks (null leaves it as it is). */
  const perPixel = (pick: (u: number, v: number) => THREE.Color | null) => {
    const img = ctx.getImageData(0, 0, TEX_W, TEX_H);
    for (let y = 0; y < TEX_H; y++) {
      for (let x = 0; x < TEX_W; x++) {
        const c = pick(x / TEX_W, y / TEX_H);
        if (!c) continue;
        const i = (y * TEX_W + x) * 4;
        img.data[i] = c.r * 255;
        img.data[i + 1] = c.g * 255;
        img.data[i + 2] = c.b * 255;
        img.data[i + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  };
  /** A round dot on the ball: stretched sideways towards the poles, where the texture is squashed, and wrapped round the seam. */
  const dot = (u: number, v: number, size: number, colour: string) => {
    const lat = (0.5 - v) * Math.PI;
    const ry = size * TEX_H;
    const rx = Math.min(ry / Math.max(Math.cos(lat), 0.12), TEX_W / 2);
    ctx.fillStyle = colour;
    for (const shift of [-TEX_W, 0, TEX_W]) {
      ctx.beginPath();
      ctx.ellipse(u * TEX_W + shift, v * TEX_H, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  for (const layer of layers) {
    if ('fill' in layer) {
      ctx.fillStyle = layer.fill;
      ctx.fillRect(0, 0, TEX_W, TEX_H);
    } else if ('gradient' in layer) {
      const g = ctx.createLinearGradient(0, 0, 0, TEX_H);
      layer.gradient.forEach((c, i) => g.addColorStop(i / (layer.gradient.length - 1), c));
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, TEX_W, TEX_H);
    } else if ('bands' in layer) {
      const cols = layer.bands.map((c) => (c ? rgb(c) : null));
      const wobble = layer.wobble ?? 0;
      perPixel((u, v) => {
        const w = v + wobble * 0.04 * Math.sin(u * Math.PI * 2 * 4 + v * 9);
        return cols[Math.max(0, Math.min(cols.length - 1, Math.floor(w * cols.length)))];
      });
    } else if ('swirl' in layer) {
      const cols = layer.swirl.map(rgb);
      const turns = layer.turns ?? 2;
      perPixel((u, v) => cols[Math.floor((((u * turns + v * 1.5) % 1) + 1) % 1 * cols.length) % cols.length]);
    } else if ('drip' in layer) {
      const col = rgb(layer.drip);
      const drips = Array.from({ length: 9 }, () => ({ at: rand(), w: 0.02 + rand() * 0.035, len: 0.04 + rand() * 0.12 }));
      perPixel((u, v) => {
        let edge = layer.to + 0.015 * Math.sin(u * Math.PI * 2 * 11);
        for (const d of drips) {
          const du = Math.min(Math.abs(u - d.at), 1 - Math.abs(u - d.at)) / d.w;
          if (du < 1) edge += d.len * Math.sqrt(1 - du * du);
        }
        return v < edge ? col : null;
      });
    } else if ('grid' in layer) {
      ctx.fillStyle = layer.grid;
      const step = TEX_W / layer.cells;
      const lw = layer.width ?? 6;
      for (let x = 0; x < TEX_W; x += step) ctx.fillRect(x - lw / 2, 0, lw, TEX_H);
      for (let y = step / 2; y < TEX_H; y += step / 2) ctx.fillRect(0, y - lw / 4, TEX_W, lw / 2);
    } else if ('veins' in layer) {
      ctx.strokeStyle = layer.veins;
      ctx.lineCap = 'round';
      for (let n = 0; n < (layer.count ?? 14); n++) {
        let x = rand() * TEX_W;
        let y = TEX_H * (0.15 + rand() * 0.7);
        let dir = rand() * Math.PI * 2;
        ctx.lineWidth = (layer.width ?? 4) * (0.5 + rand());
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let s = 0; s < 40; s++) {
          dir += (rand() - 0.5) * 0.9;
          x += Math.cos(dir) * 9;
          y += Math.sin(dir) * 6;
          ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    } else if ('speckle' in layer) {
      const from = layer.from ?? 0.04;
      const to = layer.to ?? 0.96;
      for (let n = 0; n < layer.count; n++) {
        // Spread evenly over the surface, not bunched at the poles
        const v = Math.acos(1 - 2 * (from + rand() * (to - from))) / Math.PI;
        dot(rand(), v, layer.size * (0.6 + rand() * 0.7), layer.speckle[Math.floor(rand() * layer.speckle.length)]);
      }
    } else if ('spots' in layer) {
      for (const [u, v, size, colour] of layer.spots) dot(u, v, size, colour);
    } else if ('ribs' in layer) {
      ctx.fillStyle = layer.ribs;
      const lw = layer.width ?? 10;
      for (let i = 0; i < layer.count; i++) ctx.fillRect(((i + 0.5) / layer.count) * TEX_W - lw / 2, 0, lw, TEX_H);
    }
  }
  return canvas;
}

/**
 * A ball: by default a tomato (soft lobes, a leafy top and a stalk). Rivals' balls without
 * leaves are proper bowling balls, with finger holes, painted in their own colours.
 */
export function createTomatoBall(styleId = 'classic'): THREE.Group {
  const style = BALL_STYLES[styleId] ?? BALL_STYLES.classic;
  const r = style.radius;
  const geo = new THREE.SphereGeometry(r, 64, 40);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  // Gentle vertical grooves like a tomato, without changing the round silhouette much
  const lobes = style.lobes ?? (style.leaf ? 3 : 0);
  if (lobes) {
    const depth = style.lobeDepth ?? 0.035;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const lon = Math.atan2(v.z, v.x);
      const lat = Math.abs(v.y) / r;
      const groove = 1 - depth * Math.pow(Math.abs(Math.cos(lon * lobes)), 6) * (1 - lat);
      v.multiplyScalar(groove);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    geo.computeVertexNormals();
  }

  if (style.stripes) {
    // Heirloom tomatoes have streaky, multicoloured skins
    const colours = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const lon = Math.atan2(v.z, v.x);
      const band = Math.sin(lon * 9 + Math.sin(v.y * 40) * 0.8);
      c.set(style.stripes[band > 0.35 ? 1 : band < -0.5 ? 2 : 0]);
      colours.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colours, 3));
  }

  let map: THREE.Texture | null = null;
  if (style.paint && typeof document !== 'undefined') {
    map = new THREE.CanvasTexture(paintBall(style.paint, styleId));
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
  }

  const ball = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: style.stripes || map ? '#ffffff' : style.colour,
      map,
      vertexColors: !!style.stripes,
      roughness: style.roughness,
      metalness: style.metalness,
      emissive: style.glow ?? '#000000',
    }),
  );
  ball.castShadow = true;

  const group = new THREE.Group();
  group.add(ball);

  if (!style.leaf) {
    // A proper bowling ball: two finger holes and a thumb hole
    const holeMat = new THREE.MeshStandardMaterial({ color: '#151210', roughness: 1 });
    const holes: [number, number, number, number][] = [
      [0.1, 1, -0.3, 0.0105],
      [-0.1, 1, -0.3, 0.0105],
      [0, 1, 0.3, 0.0125],
    ];
    const out = new THREE.Vector3(0, 0, 1);
    for (const [x, y, z, size] of holes) {
      const dir = new THREE.Vector3(x, y, z).normalize();
      const hole = new THREE.Mesh(new THREE.CircleGeometry(size, 20), holeMat);
      hole.position.copy(dir).multiplyScalar(r + 0.0008);
      hole.quaternion.setFromUnitVectors(out, dir);
      group.add(hole);
    }
    return group;
  }

  // Leafy star on top
  const leafMat = new THREE.MeshStandardMaterial({ color: style.leaf, roughness: 0.6, side: THREE.DoubleSide, metalness: style.metalness * 0.6 });
  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.012, 0.025, 0, 0.05);
  leafShape.quadraticCurveTo(-0.012, 0.025, 0, 0);
  const leafGeo = new THREE.ShapeGeometry(leafShape);
  for (let i = 0; i < 5; i++) {
    const leaf = new THREE.Mesh(leafGeo, leafMat);
    const pivot = new THREE.Group();
    pivot.position.y = r - 0.002;
    pivot.rotation.y = (i / 5) * Math.PI * 2;
    leaf.rotation.x = -Math.PI / 2 - 0.2; // lie almost flat, drooping over the top
    pivot.add(leaf);
    group.add(pivot);
  }

  const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.006, 0.022, 8), leafMat);
  stalk.position.y = r + 0.008;
  group.add(stalk);

  return group;
}

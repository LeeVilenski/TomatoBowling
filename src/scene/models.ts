import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { BALL_RADIUS, PIN_PROFILE } from '../game/dimensions';

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

export interface BallStyle {
  colour: string;
  radius: number;
  roughness: number;
  metalness: number;
  leaf: string;
  stripes?: [string, string, string];
  glow?: string;
}

/** The tomato balls players can unlock. The cherry tomato is a little smaller. */
export const BALL_STYLES: Record<string, BallStyle> = {
  classic: { colour: '#e0261b', radius: BALL_RADIUS, roughness: 0.18, metalness: 0.05, leaf: '#2f8f2a' },
  cherry: { colour: '#ff3418', radius: 0.095, roughness: 0.12, metalness: 0.05, leaf: '#2f8f2a' },
  green: { colour: '#7cc43a', radius: BALL_RADIUS, roughness: 0.25, metalness: 0.0, leaf: '#1f6b1c' },
  heirloom: { colour: '#e0261b', radius: BALL_RADIUS, roughness: 0.2, metalness: 0.05, leaf: '#2f8f2a', stripes: ['#d9361a', '#ffb02e', '#8bbf3a'] },
  golden: { colour: '#ffcc3a', radius: BALL_RADIUS, roughness: 0.2, metalness: 0.7, leaf: '#c99a1e', glow: '#4a3300' },
  // Career rewards
  circuit: { colour: '#1f6b34', radius: BALL_RADIUS, roughness: 0.3, metalness: 0.35, leaf: '#d4a017', stripes: ['#1a5a2c', '#d4a017', '#0f3d1e'], glow: '#06200e' },
  sunset: { colour: '#ff8a4c', radius: BALL_RADIUS, roughness: 0.18, metalness: 0.1, leaf: '#2f8f2a', stripes: ['#ff8a4c', '#c8406a', '#ffd23a'] },
};

/** A bowling ball made to look like a tomato: soft lobes, a leafy top and a stalk. */
export function createTomatoBall(styleId = 'classic'): THREE.Group {
  const style = BALL_STYLES[styleId] ?? BALL_STYLES.classic;
  const r = style.radius;
  const geo = new THREE.SphereGeometry(r, 64, 40);
  // Gentle vertical grooves like a tomato, without changing the round silhouette much
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const lon = Math.atan2(v.z, v.x);
    const lat = Math.abs(v.y) / r;
    const groove = 1 - 0.035 * Math.pow(Math.abs(Math.cos(lon * 3)), 6) * (1 - lat);
    v.multiplyScalar(groove);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();

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

  const ball = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({
      color: style.stripes ? '#ffffff' : style.colour,
      vertexColors: !!style.stripes,
      roughness: style.roughness,
      metalness: style.metalness,
      emissive: style.glow ?? '#000000',
    }),
  );
  ball.castShadow = true;

  const group = new THREE.Group();
  group.add(ball);

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

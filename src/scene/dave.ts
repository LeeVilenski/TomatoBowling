import * as THREE from 'three';
import type { ReactionKind } from '../game/reactions';
import { createFaceTextures, type Expression } from './face';
import { buildHead, HEADS, type HeadId } from './heads';

// Tomato Dave: a man in a suit with a tomato for a head, built from simple shapes.
// He faces -Z (down the lane). All animation is procedural: each state produces a target
// pose (a set of joint angles) and the body eases towards it.

interface Limb {
  fwd: number; // swing forward (+) / back (-)
  out: number; // raise out to the side (which sign is "out" depends on the arm and how raised it is; dave.test.ts checks the hands stay clear of the head)
  bend: number; // elbow/knee bend
  /** Arms: turning the arm in towards the chest (folding arms, clapping). */
  roll?: number;
}

interface Pose {
  drop: number; // hips lowered (crouch), metres
  lean: number; // torso lean forward, radians
  twist: number; // torso twist
  nod: number; // head tipped forward
  tilt: number; // head tilted sideways
  slide: number; // whole body moved forward, metres
  jump: number; // whole body raised, metres
  armR: Limb;
  armL: Limb;
  legR: Limb;
  legL: Limb;
}

type State = 'idle' | 'charge' | 'swing' | 'follow' | 'react' | 'wave' | 'walk' | 'wait' | 'watch';

/** Little things to do while waiting for a turn, cycled through every few seconds. */
const FIDGETS = ['sway', 'arms', 'tap', 'look', 'hips'] as const;
type Fidget = (typeof FIDGETS)[number];

const WALK_SPEED = 1.3; // m/s
/** How far an arm turns in to fold across the chest or clap. */
const ROLL_IN = 0.9;
const TURN_RATE = 7; // how quickly he turns to face a new direction

const limb = (fwd = 0, out = 0, bend = 0, roll = 0): Limb => ({ fwd, out, bend, roll });
const basePose = (): Pose => ({
  drop: 0,
  lean: 0,
  twist: 0,
  nod: 0,
  tilt: 0,
  slide: 0,
  jump: 0,
  armR: limb(),
  armL: limb(),
  legR: limb(),
  legL: limb(),
});

const smooth = (a: number, b: number, t: number) => a + (b - a) * Math.min(1, Math.max(0, t));
const ease = (t: number) => {
  const c = Math.min(1, Math.max(0, t));
  return c * c * (3 - 2 * c);
};

// Swing timings (seconds)
const QUICK_BACKSWING = 0.14;
const QUICK_RELEASE = 0.36;
const CHARGED_RELEASE = 0.22;
const FOLLOW_TIME = 0.45;

export const DAVE_COLOURS = {
  suit: '#1f2a4d',
  shirt: '#f4f1ea',
  tie: '#c8281e',
  skin: '#f0c29a',
  shoe: '#1a1210',
};

interface Outfit {
  suit: string;
  pattern?: 'pinstripe' | 'tracksuit';
  tie?: string;
  bowTie?: boolean;
  shirt: boolean;
  shoes: string;
}

/** Tracksuit colours: tomato-leaf green with cream and tomato-red trim. */
const TRACK = { green: '#1d6b34', dark: '#134a24', cream: '#f3ecd8', red: '#d6281c' };

export const OUTFITS: Record<string, Outfit> = {
  navy: { suit: DAVE_COLOURS.suit, tie: DAVE_COLOURS.tie, shirt: true, shoes: DAVE_COLOURS.shoe },
  tuxedo: { suit: '#121216', bowTie: true, shirt: true, shoes: '#0a0a0a' },
  pinstripe: { suit: '#3a3d48', pattern: 'pinstripe', tie: '#e0b02e', shirt: true, shoes: '#5a2e14' },
  tracksuit: { suit: TRACK.green, pattern: 'tracksuit', shirt: false, shoes: '#f4f4f4' },
  // The champion's prize for topping the Tomato Dave's ladder
  blazer: { suit: '#7a1414', bowTie: true, shirt: true, shoes: '#0a0a0a' },
  glitter: { suit: '#9b3cc7', tie: '#ffe03c', shirt: true, shoes: '#f4f4f4' },
  goldsuit: { suit: '#d4a017', tie: '#7a1414', shirt: true, shoes: '#3a2210' },
  // Computer rivals' colours (they bowl in Dave's body until they get heads of their own)
  'rival-pickle': { suit: '#5c7a2a', tie: '#e8d44d', shirt: true, shoes: '#3a2a12' },
  'rival-donut': { suit: '#e06fa3', tie: '#7a3b1e', shirt: true, shoes: '#f4f4f4' },
  'rival-sandy': { suit: '#c9a26b', tie: '#3fae3a', shirt: true, shoes: '#5a2e14' },
  'rival-carl': { suit: '#e07a1f', tie: '#2f8f2a', shirt: true, shoes: '#1a1210' },
  'rival-chip': { suit: '#2a3b4f', tie: '#36c8ff', shirt: true, shoes: '#111111' },
  'rival-cookie': { suit: '#7a4a24', tie: '#f4efe2', shirt: true, shoes: '#3a2210' },
  'rival-wafer': { suit: '#c9b08a', tie: '#3a5a8a', shirt: true, shoes: '#5a2e14' },
  'rival-brie': { suit: '#f4efe2', tie: '#1a3a6b', shirt: true, shoes: '#1a1210' },
  'rival-jelly': { suit: '#ff3cc7', tie: '#ffe03c', shirt: true, shoes: '#f4f4f4' },
  'rival-mango': { suit: '#2a8a6b', tie: '#ffa83a', shirt: true, shoes: '#1a1210' },
  'rival-lemon': { suit: '#3a2a6b', bowTie: true, shirt: true, shoes: '#f4f4f4' },
  'rival-annie': { suit: '#c0c0d0', tie: '#7a2a8a', shirt: true, shoes: '#2a0a2e' },
  'rival-sunny': { suit: '#ff9a3a', tie: '#fbf7ee', shirt: true, shoes: '#5a2e14' },
  'rival-lolly': { suit: '#36a6d9', tie: '#ff5a3a', shirt: true, shoes: '#f4f4f4' },
  'rival-kiwi': { suit: '#2f5a1e', tie: '#b6e05a', shirt: true, shoes: '#3a2210' },
  'rival-russet': { suit: '#4a3a2a', tie: '#c8281e', shirt: true, shoes: '#1a1210' },
  'rival-pumpkin': { suit: '#2a1040', bowTie: true, shirt: true, shoes: '#0a0a0a' },
};

type Fabric = 'limb' | 'body';
const patterns = new Map<string, THREE.CanvasTexture>();
/**
 * Fabric textures. Cylinders wrap u around from the back (u 0) through Dave's right (0.25),
 * front (0.5) and left (0.75); the top of the canvas is the top of the part.
 * Limbs are turned so that u 0.25 always faces outwards.
 */
function patternTexture(kind: 'pinstripe' | 'tracksuit', fabric: Fabric) {
  const key = kind === 'pinstripe' ? kind : `${kind}-${fabric}`;
  const cached = patterns.get(key);
  if (cached) return cached;
  const c = document.createElement('canvas');
  const g = c.getContext('2d')!;
  if (kind === 'pinstripe') {
    c.width = 256;
    c.height = 32;
    g.fillStyle = '#3a3d48';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = 'rgba(235, 235, 245, 0.75)';
    for (let x = 0; x < 256; x += 14) g.fillRect(x, 0, 1.5, 32);
  } else if (fabric === 'limb') {
    // Plain green with a cream-red-cream racing stripe down the outside
    c.width = 256;
    c.height = 64;
    g.fillStyle = TRACK.green;
    g.fillRect(0, 0, 256, 64);
    const x = 64;
    g.fillStyle = TRACK.cream;
    g.fillRect(x - 11, 0, 22, 64);
    g.fillStyle = TRACK.red;
    g.fillRect(x - 3.5, 0, 7, 64);
  } else {
    // Jacket: cream shoulder yoke with a red piping line, a zip down the front,
    // stripes down each side and a ribbed hem.
    c.width = 512;
    c.height = 256;
    g.fillStyle = TRACK.green;
    g.fillRect(0, 0, 512, 256);
    const yoke = 70;
    g.fillStyle = TRACK.cream;
    g.fillRect(0, 0, 512, yoke);
    g.fillStyle = TRACK.red;
    g.fillRect(0, yoke, 512, 7);
    const hem = 236;
    for (const u of [0.25, 0.75]) {
      g.fillStyle = TRACK.cream;
      g.fillRect(u * 512 - 15, yoke + 7, 30, hem - yoke - 7);
      g.fillStyle = TRACK.red;
      g.fillRect(u * 512 - 5, yoke + 7, 10, hem - yoke - 7);
    }
    g.fillStyle = TRACK.dark;
    g.fillRect(0, hem, 512, 256 - hem);
    g.fillStyle = 'rgba(255, 255, 255, 0.12)';
    for (let x = 0; x < 512; x += 6) g.fillRect(x, hem, 2, 256 - hem);
    // Zip: a dark tape with silver teeth
    g.fillStyle = TRACK.dark;
    g.fillRect(256 - 5, 0, 10, 256);
    g.fillStyle = '#c9ccd2';
    for (let y = 0; y < 256; y += 5) g.fillRect(256 - 2, y, 4, 2.5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  patterns.set(key, tex);
  return tex;
}

export class Dave {
  readonly root = new THREE.Group();
  /** Where the ball sits in his right hand. */
  readonly handAnchor = new THREE.Group();
  readonly headTop = new THREE.Group();

  private hips = new THREE.Group();
  private spine = new THREE.Group();
  private headPivot = new THREE.Group();
  private arms: Record<'R' | 'L', { shoulder: THREE.Group; elbow: THREE.Group }>;
  private legs: Record<'R' | 'L', { hip: THREE.Group; knee: THREE.Group }>;
  private faceMat: THREE.MeshBasicMaterial;
  private headMat: THREE.MeshStandardMaterial;
  private faces = createFaceTextures();
  /** Dave's tomato, and any rival heads built so far (rivals bowl in Dave's body). */
  private headGroups = new Map<HeadId, { group: THREE.Group; faceMat: THREE.MeshBasicMaterial; faces: Record<Expression, THREE.Texture> }>();
  private headId: HeadId = 'tomato';
  private neckMat!: THREE.MeshStandardMaterial;
  private suitMat!: THREE.MeshStandardMaterial;
  /** Arms and legs, and the jacket: these take the outfit's fabric texture. */
  private limbMat!: THREE.MeshStandardMaterial;
  private jacketMat!: THREE.MeshStandardMaterial;
  private shoulderMat!: THREE.MeshStandardMaterial;
  private cuffMat!: THREE.MeshStandardMaterial;
  /** Collar, ankle bands and zip pull, shown with the tracksuit. */
  private trackBits: THREE.Object3D[] = [];
  private shoeMat!: THREE.MeshStandardMaterial;
  private tieMat!: THREE.MeshStandardMaterial;
  private shirtFront!: THREE.Mesh;
  private tie = new THREE.Group();
  private bowTie = new THREE.Group();
  private buttons = new THREE.Group();

  private pose = basePose();
  private state: State = 'idle';
  private time = 0;
  private reaction: ReactionKind = 'meh';
  private swingFromCharge = false;
  private chargePower = 0;
  private releaseAt = 0;
  private onRelease: (() => void) | null = null;
  private base = new THREE.Vector3();
  /** Which way he faces (radians about the vertical; 0 is down the lane). */
  private yaw = 0;
  private wantYaw = 0;
  /** Where he's walking to, what to do when he gets there, and which way to face. */
  private walk: { x: number; z: number; then: 'idle' | 'wait'; face: number; onArrive?: () => void } | null = null;
  private stride = 0;
  private fidget: Fidget = 'sway';
  private fidgetTime = 0;
  /** What he's watching the other bowler do. */
  private watching: ReactionKind = 'meh';
  /** -1..1: leaning after the ball as it rolls ("body English"). */
  private english = 0;
  private blinkIn = 2 + Math.random() * 3;
  private blinkFor = 0;
  private headRed = new THREE.Color('#e0261b');
  private headDark = new THREE.Color('#8a1610');
  private blush = 0;

  constructor(suitColour = DAVE_COLOURS.suit) {
    const flat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
    const suit = flat(suitColour);
    this.suitMat = suit;
    const limb = flat(suitColour);
    this.limbMat = limb;
    this.jacketMat = flat(suitColour);
    this.shoulderMat = flat(suitColour);
    const shoeMat = flat(DAVE_COLOURS.shoe, { roughness: 0.3 });
    this.shoeMat = shoeMat;
    const skin = flat(DAVE_COLOURS.skin);
    const shirt = flat(DAVE_COLOURS.shirt);
    this.cuffMat = flat(DAVE_COLOURS.shirt);
    const rib = flat(TRACK.dark, { roughness: 0.9 });
    // Turns a limb part so its texture's u 0.25 faces outwards (see patternTexture).
    const outward = (m: THREE.Mesh, side: 1 | -1) => {
      const sphere = m.geometry instanceof THREE.SphereGeometry;
      m.rotation.y = sphere ? (side * Math.PI) / 2 : side === 1 ? 0 : Math.PI;
      return m;
    };
    const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, y = 0, x = 0, z = 0) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.castShadow = true;
      return m;
    };

    this.root.add(this.hips);

    // Legs: thigh, knee, shin, shoe
    const makeLeg = (side: 1 | -1) => {
      const hip = new THREE.Group();
      hip.position.set(0.1 * side, 0, 0);
      hip.add(outward(mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.46, 24), limb, -0.23), side));
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      knee.add(outward(mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.44, 24), limb, -0.22), side));
      // Ribbed ankle band (tracksuit only)
      const ankle = mesh(new THREE.CylinderGeometry(0.069, 0.069, 0.05, 20), rib, -0.415);
      this.trackBits.push(ankle);
      knee.add(ankle);
      const shoe = mesh(new THREE.CapsuleGeometry(0.055, 0.17, 6, 14), shoeMat, -0.465, 0, -0.05);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.05, 1, 0.65);
      knee.add(shoe);
      // Rounded knee so the leg doesn't show a seam when it bends
      knee.add(outward(mesh(new THREE.SphereGeometry(0.074, 24, 14), limb, 0), side));
      hip.add(knee);
      this.hips.add(hip);
      return { hip, knee };
    };
    this.legs = { R: makeLeg(1), L: makeLeg(-1) };
    // Pelvis fills the gap between the jacket and the legs
    const pelvis = mesh(new THREE.CylinderGeometry(0.19, 0.17, 0.16, 20), suit, -0.04);
    pelvis.scale.z = 0.72;
    this.hips.add(pelvis);

    // Torso: jacket, shirt, tie, buttons
    this.hips.add(this.spine);
    // Its caps take the plain shoulder fabric: a wrapped texture smears across them.
    const jacket = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.6, 32), [this.jacketMat, this.shoulderMat, this.shoulderMat]);
    jacket.position.y = 0.3;
    jacket.castShadow = true;
    jacket.scale.z = 0.72;
    this.spine.add(jacket);
    const vShape = new THREE.Shape();
    vShape.moveTo(-0.085, 0.6);
    vShape.lineTo(0.085, 0.6);
    vShape.lineTo(0, 0.3);
    vShape.closePath();
    const shirtFront = new THREE.Mesh(new THREE.ShapeGeometry(vShape), shirt);
    shirtFront.position.z = -0.156;
    shirtFront.rotation.y = Math.PI;
    this.spine.add(shirtFront);
    this.shirtFront = shirtFront;
    this.tieMat = flat(DAVE_COLOURS.tie);
    this.tie.add(mesh(new THREE.BoxGeometry(0.045, 0.24, 0.02), this.tieMat, 0.44, 0, -0.16));
    this.tie.add(mesh(new THREE.BoxGeometry(0.055, 0.04, 0.03), this.tieMat, 0.575, 0, -0.158));
    this.spine.add(this.tie);
    // Bow tie for the tuxedo: two little wedges and a knot
    const bowMat = flat('#111111', { roughness: 0.4 });
    for (const side of [-1, 1]) {
      const wing = mesh(new THREE.ConeGeometry(0.035, 0.06, 4), bowMat, 0.575, side * 0.035, -0.16);
      wing.rotation.z = (side * Math.PI) / 2;
      this.bowTie.add(wing);
    }
    this.bowTie.add(mesh(new THREE.BoxGeometry(0.022, 0.025, 0.025), bowMat, 0.575, 0, -0.165));
    this.bowTie.visible = false;
    this.spine.add(this.bowTie);
    for (const y of [0.24, 0.13]) this.buttons.add(mesh(new THREE.SphereGeometry(0.014, 10, 8), flat('#d9c27a'), y, 0, -0.14));
    this.spine.add(this.buttons);
    // Shoulders
    for (const side of [1, -1]) this.spine.add(mesh(new THREE.SphereGeometry(0.075, 18, 14), this.shoulderMat, 0.55, 0.2 * side));
    // Tracksuit: stand-up collar and a zip pull
    const collarMat = flat(TRACK.cream, { roughness: 0.8 });
    const collar = mesh(new THREE.CylinderGeometry(0.085, 0.11, 0.06, 24, 1, true), collarMat, 0.62);
    collar.scale.z = 0.85;
    (collar.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
    const zipPull = mesh(new THREE.BoxGeometry(0.02, 0.035, 0.008), flat('#c9ccd2', { metalness: 0.6, roughness: 0.3 }), 0.56, 0, -0.16);
    this.trackBits.push(collar, zipPull);
    this.spine.add(collar, zipPull);
    for (const part of this.trackBits) part.visible = false;

    // Arms: upper arm, elbow, forearm, cuff, hand
    const makeArm = (side: 1 | -1) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.25 * side, 0.55, 0);
      shoulder.rotation.order = 'ZXY';
      shoulder.add(outward(mesh(new THREE.CylinderGeometry(0.066, 0.06, 0.3, 24), limb, -0.15), side));
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      elbow.add(outward(mesh(new THREE.SphereGeometry(0.062, 24, 12), limb, 0), side));
      elbow.add(outward(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.26, 24), limb, -0.13), side));
      elbow.add(mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.035, 20), this.cuffMat, -0.265));
      elbow.add(mesh(new THREE.SphereGeometry(0.055, 18, 14), skin, -0.32));
      shoulder.add(elbow);
      this.spine.add(shoulder);
      return { shoulder, elbow };
    };
    this.arms = { R: makeArm(1), L: makeArm(-1) };
    this.handAnchor.position.set(0, -0.36, -0.03);
    this.arms.R.elbow.add(this.handAnchor);

    // Neck (a green stalk) and the tomato head
    this.neckMat = flat('#3f8f2a');
    this.spine.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 18), this.neckMat, 0.63));
    this.headPivot.position.y = 0.66;
    this.spine.add(this.headPivot);
    const tomato = new THREE.Group();
    this.headPivot.add(tomato);
    const R = 0.23;
    const headGeo = new THREE.SphereGeometry(R, 48, 32);
    const pos = headGeo.attributes.position;
    const v = new THREE.Vector3();
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      const lon = Math.atan2(v.z, v.x);
      const lat = Math.abs(v.y) / R;
      v.multiplyScalar(1 - 0.05 * Math.pow(Math.abs(Math.cos(lon * 3)), 4) * (1 - lat));
      pos.setXYZ(i, v.x, v.y, v.z);
    }
    headGeo.computeVertexNormals();
    this.headMat = new THREE.MeshStandardMaterial({ color: this.headRed, roughness: 0.25 });
    const head = mesh(headGeo, this.headMat, R * 0.88);
    head.scale.y = 0.88;
    tomato.add(head);

    // Face: a patch on the front of the head showing the current expression
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.faces.neutral, transparent: true, depthWrite: false });
    const facePatch = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.005, 48, 32, Math.PI * 1.5 - 0.85, 1.7, 0.75, 1.35),
      this.faceMat,
    );
    facePatch.position.y = R * 0.88;
    facePatch.scale.y = 0.88;
    tomato.add(facePatch);

    // Leafy top and stalk
    const leafMat = new THREE.MeshStandardMaterial({ color: '#2f8f2a', roughness: 0.6, side: THREE.DoubleSide, flatShading: true });
    const leafShape = new THREE.Shape();
    leafShape.moveTo(0, 0);
    leafShape.quadraticCurveTo(0.03, 0.06, 0, 0.12);
    leafShape.quadraticCurveTo(-0.03, 0.06, 0, 0);
    const leafGeo = new THREE.ShapeGeometry(leafShape);
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.position.y = R * 0.88 * 2 - 0.01;
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      const leaf = new THREE.Mesh(leafGeo, leafMat);
      leaf.rotation.x = -Math.PI / 2 - 0.35;
      leaf.castShadow = true;
      pivot.add(leaf);
      tomato.add(pivot);
    }
    tomato.add(mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.07, 6), leafMat, R * 0.88 * 2 + 0.03));
    this.headTop.position.y = R * 2;
    this.headPivot.add(this.headTop);
    this.headGroups.set('tomato', { group: tomato, faceMat: this.faceMat, faces: this.faces });
  }

  /** Changes Dave's outfit: 'navy', 'tuxedo', 'pinstripe' or 'tracksuit'. */
  setOutfit(id: string) {
    const o = OUTFITS[id] ?? OUTFITS.navy;
    const track = o.pattern === 'tracksuit';
    // Pinstripe covers everything; the tracksuit's trim goes on the limbs and jacket only.
    const fabric: [THREE.MeshStandardMaterial, THREE.CanvasTexture | null][] = [
      [this.suitMat, o.pattern === 'pinstripe' ? patternTexture('pinstripe', 'body') : null],
      [this.shoulderMat, o.pattern === 'pinstripe' ? patternTexture('pinstripe', 'body') : null],
      [this.limbMat, o.pattern ? patternTexture(o.pattern, 'limb') : null],
      [this.jacketMat, o.pattern ? patternTexture(o.pattern, 'body') : null],
    ];
    for (const [mat, map] of fabric) {
      mat.map = map;
      mat.color.set(map ? '#ffffff' : o.suit);
      mat.roughness = track ? 0.55 : 0.7;
      mat.needsUpdate = true;
    }
    if (track) this.shoulderMat.color.set(TRACK.cream);
    this.cuffMat.color.set(track ? TRACK.dark : DAVE_COLOURS.shirt);
    for (const part of this.trackBits) part.visible = track;
    this.tie.visible = !!o.tie;
    if (o.tie) this.tieMat.color.set(o.tie);
    this.bowTie.visible = !!o.bowTie;
    this.shirtFront.visible = o.shirt;
    this.buttons.visible = o.shirt;
    this.shoeMat.color.set(o.shoes);
  }

  // ---------- Commands ----------

  /** Which head is on the body: Dave's tomato, or a rival's. */
  setHead(id: HeadId) {
    if (id === this.headId) return;
    let head = this.headGroups.get(id);
    if (!head) {
      const spec = HEADS[id];
      const faces = createFaceTextures(spec.face);
      const faceMat = new THREE.MeshBasicMaterial({ map: faces.neutral, transparent: true, depthWrite: false });
      const built = buildHead(id as Exclude<HeadId, 'tomato'>, faceMat);
      head = { group: built.group, faceMat, faces };
      this.headPivot.add(built.group);
      this.headGroups.set(id, head);
    }
    this.headGroups.get(this.headId)!.group.visible = false;
    head.group.visible = true;
    this.headId = id;
    this.headTop.position.y = HEADS[id].top;
    this.neckMat.color.set(HEADS[id].neck);
  }

  /** The head being worn, and the shape enclosing it (for tests). */
  get head() {
    return { id: this.headId, pivot: this.headPivot, bounds: HEADS[this.headId].bounds };
  }

  /** Where he stands (feet), before any slide or jump. Ignored while he's walking somewhere. */
  setStance(x: number, z: number) {
    if (this.state === 'walk') return;
    this.base.set(x, 0, z);
  }

  /** Put him somewhere straight away, facing `yaw` (0 = down the lane). */
  place(x: number, z: number, yaw = 0) {
    this.walk = null;
    this.base.set(x, 0, z);
    this.yaw = this.wantYaw = yaw;
    if (this.state === 'walk') this.setState('idle');
  }

  /**
   * Walk to (x, z), then turn to face `face` and either get ready to bowl ('idle') or
   * wait for a turn ('wait'). `onArrive` fires when he's there.
   */
  walkTo(x: number, z: number, opts: { face?: number; then?: 'idle' | 'wait'; onArrive?: () => void } = {}) {
    this.walk = { x, z, then: opts.then ?? 'idle', face: opts.face ?? 0, onArrive: opts.onArrive };
    this.setState('walk');
  }

  /** Turn on the spot to face `yaw` (0 = down the lane). */
  faceTo(yaw: number) {
    this.wantYaw = yaw;
  }

  get walking() {
    return this.state === 'walk';
  }

  /** Stand by while someone else bowls, fidgeting now and then. */
  wait() {
    this.setState('wait');
    this.fidgetTime = 0;
  }

  /** React, from the side, to the other bowler's ball. */
  watch(kind: ReactionKind) {
    if (this.state !== 'wait' && this.state !== 'watch') return;
    this.watching = kind;
    this.setState('watch');
  }

  /** Lean after the rolling ball: -1 (it's heading left) to 1 (right). */
  setEnglish(v: number) {
    this.english = Math.max(-1, Math.min(1, v));
  }

  idle() {
    this.setState('idle');
  }

  wave() {
    this.setState('wave');
  }

  /** Backswing follows the power meter while the player holds to charge. */
  charge(power: number) {
    if (this.state !== 'charge') this.setState('charge');
    this.chargePower = power;
  }

  /** Swing through and let go. `onRelease` fires at the moment the ball leaves his hand. */
  swing(onRelease: () => void) {
    this.swingFromCharge = this.state === 'charge';
    this.releaseAt = this.swingFromCharge ? CHARGED_RELEASE : QUICK_RELEASE;
    this.onRelease = onRelease;
    this.setState('swing');
  }

  react(kind: ReactionKind) {
    this.reaction = kind;
    this.setState('react');
  }

  get isSwinging() {
    return this.state === 'swing';
  }

  private setState(s: State) {
    this.state = s;
    this.time = 0;
  }

  // ---------- Animation ----------

  update(dt: number) {
    this.time += dt;
    this.stepWalk(dt);
    // Turn smoothly towards wherever he wants to face (the short way round)
    let d = this.wantYaw - this.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    this.yaw += d * Math.min(1, dt * TURN_RATE);
    // Fidgets change every few seconds while waiting; a watched reaction lasts a moment
    if (this.state === 'wait') {
      this.fidgetTime += dt;
      if (this.fidgetTime > 3.5) {
        this.fidgetTime = 0;
        const others = FIDGETS.filter((f) => f !== this.fidget);
        this.fidget = others[Math.floor(Math.random() * others.length)];
      }
    } else if (this.state === 'watch' && this.time > 2.6) this.wait();
    // Blink every few seconds
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blinkFor = 0.13;
      this.blinkIn = 2 + Math.random() * 4;
    }
    this.blinkFor = Math.max(0, this.blinkFor - dt);
    const t = this.time;
    const target = this.targetPose(t);

    // Fire the release exactly once, at the bottom of the swing
    if (this.state === 'swing' && t >= this.releaseAt && this.onRelease) {
      const cb = this.onRelease;
      this.onRelease = null;
      cb();
    }
    if (this.state === 'swing' && t >= this.releaseAt + FOLLOW_TIME) this.setState('follow');

    // Fast during the swing so the timing is exact; softer otherwise
    const k = this.state === 'swing' ? 1 : 1 - Math.exp(-dt * 10);
    this.blend(target, k);
    this.apply();

    // Expression and colour
    const head = this.headGroups.get(this.headId)!;
    const expr = this.expression();
    // Blinks show on the calmer expressions (not mid-celebration, with eyes already shut)
    head.faceMat.map = head.faces[this.blinkFor > 0 && expr !== 'ecstatic' ? 'blink' : expr];
    const wantBlush = this.state === 'react' && this.reaction === 'gutter' ? 1 : 0;
    this.blush = smooth(this.blush, wantBlush, dt * 2);
    this.headMat.color.copy(this.headRed).lerp(this.headDark, this.blush);
  }

  /** Moves him along a walk, and turns him to face where he's going. */
  private stepWalk(dt: number) {
    const w = this.walk;
    if (this.state !== 'walk' || !w) return;
    const dx = w.x - this.base.x;
    const dz = w.z - this.base.z;
    const dist = Math.hypot(dx, dz);
    const step = WALK_SPEED * dt;
    if (dist <= step) {
      this.base.set(w.x, 0, w.z);
      this.wantYaw = w.face;
      this.walk = null;
      if (w.then === 'wait') this.wait();
      else this.setState('idle');
      w.onArrive?.();
      return;
    }
    this.base.x += (dx / dist) * step;
    this.base.z += (dz / dist) * step;
    this.stride += step;
    // Facing the way he's walking (he faces -Z when yaw is 0)
    this.wantYaw = Math.atan2(-dx, -dz);
  }

  private expression(): Expression {
    switch (this.state) {
      case 'charge':
      case 'swing':
        return 'focused';
      case 'wave':
        return 'happy';
      case 'watch':
        return ({ strike: 'happy', spare: 'happy', good: 'neutral', meh: 'meh', gutter: 'confused', split: 'confused', miss: 'meh' } as const)[
          this.watching
        ];
      case 'react':
        return ({ strike: 'ecstatic', spare: 'happy', good: 'happy', meh: 'meh', gutter: 'sad', split: 'confused', miss: 'meh' } as const)[
          this.reaction
        ];
      default:
        return 'neutral';
    }
  }

  private targetPose(t: number): Pose {
    const p = basePose();
    const holding = () => {
      // Ball cradled at his right side, left hand steadying it
      p.armR = limb(0.45, -0.1, 1.0);
      p.armL = limb(0.55, -0.35, 1.25);
      p.lean = 0.08;
    };

    switch (this.state) {
      case 'idle': {
        holding();
        p.drop = 0.01 + 0.01 * Math.sin(t * 2.1);
        p.nod = 0.03 * Math.sin(t * 1.3);
        p.twist = 0.03 * Math.sin(t * 0.8);
        break;
      }
      case 'charge': {
        const w = this.chargePower;
        p.armR = limb(0.4 - w * 2.0, 0.05, 0.15 * (1 - w));
        p.armL = limb(0.3, -0.7, 0.4);
        p.lean = 0.2 + w * 0.15;
        p.drop = 0.05 + w * 0.06;
        p.legL = limb(0.15, 0, -0.25);
        p.legR = limb(-0.1, 0, -0.15);
        break;
      }
      case 'swing': {
        const back = this.swingFromCharge ? 0.4 - this.chargePower * 2.0 : -1.4;
        const startForward = this.swingFromCharge ? 0 : QUICK_BACKSWING;
        let arm: number;
        if (t < startForward) arm = smooth(0.45, back, ease(t / startForward));
        else if (t < this.releaseAt) arm = smooth(back, 0.05, ease((t - startForward) / (this.releaseAt - startForward)));
        else arm = smooth(0.05, 2.3, ease((t - this.releaseAt) / FOLLOW_TIME));
        const crouch = ease(t / this.releaseAt);
        const rise = ease((t - this.releaseAt) / FOLLOW_TIME);
        p.armR = limb(arm, 0.05, t < this.releaseAt ? 0.05 : 0.3 * rise);
        p.armL = limb(0.35, -1.1, 0.3);
        p.lean = 0.25 + 0.45 * crouch - 0.15 * rise;
        p.drop = 0.06 + 0.24 * crouch - 0.06 * rise;
        p.slide = 0.35 * ease(t / (this.releaseAt + 0.1));
        // Left leg slides forward and bends; right leg trails behind
        p.legL = limb(0.75 * crouch, 0, -0.9 * crouch);
        p.legR = limb(-0.7 * crouch, 0.05, -0.35 * crouch);
        break;
      }
      case 'follow': {
        // Holding the follow-through, then leaning after the ball as it rolls
        const e = this.english * Math.min(1, t / 0.6);
        p.armR = limb(2.2, 0.05, 0.35);
        p.armL = limb(0.35, -1.0 - e * 0.4, 0.3);
        p.lean = 0.45;
        p.drop = 0.22;
        p.slide = 0.35;
        p.twist = -e * 0.3;
        p.tilt = e * 0.25;
        p.legL = limb(0.7, 0, -0.85);
        p.legR = limb(-0.65, 0.05, -0.3);
        break;
      }
      case 'walk': {
        // Legs stepping in turn, arms swinging against them
        const phase = (this.stride / 0.62) * Math.PI * 2;
        const s = Math.sin(phase);
        p.legL = limb(0.42 * s, 0, -0.5 * Math.max(0, -Math.cos(phase)));
        p.legR = limb(-0.42 * s, 0, -0.5 * Math.max(0, Math.cos(phase)));
        p.armL = limb(-0.35 * s, -0.12, 0.25);
        p.armR = limb(0.35 * s, -0.12, 0.25);
        p.drop = 0.02 + 0.015 * Math.abs(Math.cos(phase));
        p.lean = 0.05;
        break;
      }
      case 'wait':
        this.waitPose(p, t);
        break;
      case 'watch':
        this.watchPose(p, t);
        break;
      case 'wave': {
        p.armR = limb(0.2, 2.5, 0.6 + 0.45 * Math.sin(t * 9));
        p.armL = limb(0.1, -0.15, 0.2);
        p.tilt = 0.12;
        p.drop = 0.01 * Math.sin(t * 2);
        break;
      }
      case 'react':
        this.reactionPose(p, t);
        break;
    }
    return p;
  }

  private reactionPose(p: Pose, t: number) {
    const pump = Math.sin(t * 10);
    switch (this.reaction) {
      case 'strike':
        // Jump and pump both fists
        p.jump = t < 1.2 ? 0.14 * Math.abs(Math.sin(t * 5.2)) : 0;
        // Arms up in a V so the fists pump beside his head, not through it. (Once an arm
        // is raised, a *negative* `out` swings it away from the head, for either arm.)
        p.armR = limb(2.8, -0.5, 0.6 + 0.5 * pump);
        p.armL = limb(2.8, -0.5, 0.6 - 0.5 * pump);
        p.nod = -0.25;
        p.legL = limb(0.15, 0, -0.3 * Math.abs(pump));
        p.legR = limb(0.15, 0, -0.3 * Math.abs(pump));
        break;
      case 'spare':
        // Thumbs up and a nod
        p.armR = limb(1.4, 0.2, 1.3);
        p.armL = limb(0.1, -0.15, 0.2);
        p.nod = 0.15 * Math.max(0, Math.sin(t * 6));
        break;
      case 'good':
        // One-armed fist pump
        p.armR = limb(2.6, -0.55, 0.8 + 0.4 * pump);
        p.armL = limb(0.2, -0.2, 0.3);
        p.drop = 0.04;
        break;
      case 'meh':
      case 'miss':
        // Shrug
        p.armR = limb(0.4, 0.55, 1.5);
        p.armL = limb(0.4, -0.55, 1.5);
        p.tilt = 0.18;
        p.drop = -0.02 * Math.abs(Math.sin(t * 3));
        break;
      case 'gutter':
        // Slump
        p.lean = 0.45;
        p.nod = 0.5;
        p.drop = 0.06;
        p.armR = limb(0.25, 0.05, 0.1);
        p.armL = limb(0.25, -0.05, 0.1);
        p.legL = limb(0.1, 0, -0.2);
        p.legR = limb(0.1, 0, -0.2);
        break;
      case 'split':
        // Scratch his tomato
        // (hand at the side of his head, where you can see it; head tipped away from it)
        p.armR = limb(1.7, 1.45, 1.7 + 0.15 * pump);
        p.armL = limb(0.3, -0.2, 0.8);
        p.tilt = 0.2;
        p.nod = -0.1;
        break;
    }
  }

  /** Standing by for a turn: one of a few fidgets, changing every few seconds. */
  private waitPose(p: Pose, t: number) {
    p.armR = limb(0.05, 0.12, 0.15);
    p.armL = limb(0.05, 0.12, 0.15);
    p.drop = 0.01 + 0.008 * Math.sin(t * 1.7);
    switch (this.fidget) {
      case 'sway':
        // Shifting weight from foot to foot
        p.twist = 0.06 * Math.sin(t * 0.9);
        p.tilt = 0.05 * Math.sin(t * 0.9);
        p.legL = limb(0.05 + 0.05 * Math.sin(t * 0.9), 0.04, -0.05);
        p.legR = limb(0.05 - 0.05 * Math.sin(t * 0.9), 0.04, -0.05);
        break;
      case 'arms':
        // Arms folded across the chest
        p.armR = limb(0.35, -0.1, 1.65, ROLL_IN);
        p.armL = limb(0.3, -0.1, 1.7, ROLL_IN);
        p.tilt = 0.08;
        break;
      case 'tap':
        // Hands in pockets (near enough), tapping a foot
        p.armR = limb(-0.1, 0.18, 0.5);
        p.armL = limb(-0.1, 0.18, 0.5);
        p.legR = limb(0.15, 0.05, -0.25 - 0.2 * Math.max(0, Math.sin(t * 7)));
        break;
      case 'look':
        // Looking round the alley
        p.twist = 0.45 * Math.sin(t * 0.7);
        p.nod = -0.05;
        break;
      case 'hips':
        // Hands on hips, rocking on his heels
        p.armR = limb(0.1, 0.65, 1.5);
        p.armL = limb(0.1, 0.65, 1.5);
        p.lean = -0.04 + 0.04 * Math.sin(t * 2.2);
        break;
    }
  }

  /** Reacting from the side to the other bowler's ball. */
  private watchPose(p: Pose, t: number) {
    switch (this.watching) {
      case 'strike':
      case 'spare': {
        // Applause: hands together in front of the chest
        const clap = 0.25 * Math.abs(Math.sin(t * 11));
        p.armR = limb(0.85, -0.15, 1.05, ROLL_IN - clap);
        p.armL = limb(0.85, -0.15, 1.05, ROLL_IN - clap);
        p.nod = 0.06 * Math.sin(t * 5);
        break;
      }
      case 'gutter':
      case 'miss':
        // Hands on hips, shaking his head
        p.armR = limb(0.1, 0.65, 1.5);
        p.armL = limb(0.1, 0.65, 1.5);
        p.tilt = 0.18 * Math.sin(t * 6);
        p.nod = 0.1;
        break;
      case 'split':
        // A sharp intake of breath: leaning back, hands up
        p.armR = limb(0.9, 0.4, 1.6);
        p.armL = limb(0.9, 0.4, 1.6);
        p.lean = -0.12;
        break;
      default:
        // A polite nod
        p.armR = limb(0.05, 0.12, 0.15);
        p.armL = limb(0.05, 0.12, 0.15);
        p.nod = 0.12 * Math.max(0, Math.sin(t * 4));
        break;
    }
  }

  private blend(target: Pose, k: number) {
    const p = this.pose;
    for (const key of ['drop', 'lean', 'twist', 'nod', 'tilt', 'slide', 'jump'] as const) p[key] = smooth(p[key], target[key], k);
    for (const key of ['armR', 'armL', 'legR', 'legL'] as const) {
      p[key].fwd = smooth(p[key].fwd, target[key].fwd, k);
      p[key].out = smooth(p[key].out, target[key].out, k);
      p[key].bend = smooth(p[key].bend, target[key].bend, k);
      p[key].roll = smooth(p[key].roll ?? 0, target[key].roll ?? 0, k);
    }
  }

  private apply() {
    const p = this.pose;
    // The slide goes the way he's facing
    this.root.position.set(this.base.x - Math.sin(this.yaw) * p.slide, this.base.y + p.jump, this.base.z - Math.cos(this.yaw) * p.slide);
    this.root.rotation.y = this.yaw;
    this.hips.position.y = 0.95 - p.drop;
    this.spine.rotation.set(-p.lean, p.twist, 0);
    this.headPivot.rotation.set(-p.nod, 0, p.tilt);
    for (const side of ['R', 'L'] as const) {
      const sign = side === 'R' ? 1 : -1;
      const a = side === 'R' ? p.armR : p.armL;
      // Arms stay roughly upright relative to the ground even when he leans
      this.arms[side].shoulder.rotation.set(a.fwd - p.lean * 0.5, (a.roll ?? 0) * sign, a.out * sign);
      this.arms[side].elbow.rotation.x = a.bend;
      const l = side === 'R' ? p.legR : p.legL;
      // Lower the hips → bend the knees automatically to keep feet on the floor
      const squat = Math.min(1, p.drop / 0.3);
      this.legs[side].hip.rotation.set(l.fwd + squat * 0.5, 0, l.out * sign);
      this.legs[side].knee.rotation.x = l.bend - squat * 0.9;
    }
  }

  /** World position of the ball held in his right hand. */
  handWorldPosition(out: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    return this.handAnchor.getWorldPosition(out);
  }

  headWorldPosition(out: THREE.Vector3) {
    this.root.updateMatrixWorld(true);
    return this.headTop.getWorldPosition(out);
  }
}

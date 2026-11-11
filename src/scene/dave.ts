import * as THREE from 'three';
import type { ReactionKind } from '../game/reactions';
import { createFaceTextures, type Expression } from './face';

// Tomato Dave: a man in a suit with a tomato for a head, built from simple shapes.
// He faces -Z (down the lane). All animation is procedural: each state produces a target
// pose (a set of joint angles) and the body eases towards it.

interface Limb {
  fwd: number; // swing forward (+) / back (-)
  out: number; // raise out to the side (which sign is "out" depends on the arm and how raised it is; dave.test.ts checks the hands stay clear of the head)
  bend: number; // elbow/knee bend
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

type State = 'idle' | 'charge' | 'swing' | 'follow' | 'react' | 'wave';

const limb = (fwd = 0, out = 0, bend = 0): Limb => ({ fwd, out, bend });
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

export const OUTFITS: Record<string, Outfit> = {
  navy: { suit: DAVE_COLOURS.suit, tie: DAVE_COLOURS.tie, shirt: true, shoes: DAVE_COLOURS.shoe },
  tuxedo: { suit: '#121216', bowTie: true, shirt: true, shoes: '#0a0a0a' },
  pinstripe: { suit: '#3a3d48', pattern: 'pinstripe', tie: '#e0b02e', shirt: true, shoes: '#5a2e14' },
  tracksuit: { suit: '#2f8f2a', pattern: 'tracksuit', shirt: false, shoes: '#f4f4f4' },
};

const patterns = new Map<string, THREE.CanvasTexture>();
/** Fabric textures that wrap around the arms, legs and body. */
function patternTexture(kind: 'pinstripe' | 'tracksuit') {
  const cached = patterns.get(kind);
  if (cached) return cached;
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 32;
  const g = c.getContext('2d')!;
  if (kind === 'pinstripe') {
    g.fillStyle = '#3a3d48';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = 'rgba(235, 235, 245, 0.75)';
    for (let x = 0; x < 256; x += 14) g.fillRect(x, 0, 1.5, 32);
  } else {
    // Tomato-green tracksuit with white stripes down each side
    g.fillStyle = '#2f8f2a';
    g.fillRect(0, 0, 256, 32);
    g.fillStyle = '#ffffff';
    for (const u of [0.25, 0.75]) {
      g.fillRect(u * 256 - 10, 0, 6, 32);
      g.fillRect(u * 256 + 4, 0, 6, 32);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  patterns.set(kind, tex);
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
  private suitMat!: THREE.MeshStandardMaterial;
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
  private headRed = new THREE.Color('#e0261b');
  private headDark = new THREE.Color('#8a1610');
  private blush = 0;

  constructor(suitColour = DAVE_COLOURS.suit) {
    const flat = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...extra });
    const suit = flat(suitColour);
    this.suitMat = suit;
    const shoeMat = flat(DAVE_COLOURS.shoe, { roughness: 0.3 });
    this.shoeMat = shoeMat;
    const skin = flat(DAVE_COLOURS.skin);
    const shirt = flat(DAVE_COLOURS.shirt);
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
      hip.add(mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.46, 18), suit, -0.23));
      const knee = new THREE.Group();
      knee.position.y = -0.46;
      knee.add(mesh(new THREE.CylinderGeometry(0.075, 0.065, 0.44, 18), suit, -0.22));
      const shoe = mesh(new THREE.CapsuleGeometry(0.055, 0.17, 6, 14), shoeMat, -0.465, 0, -0.05);
      shoe.rotation.x = Math.PI / 2;
      shoe.scale.set(1.05, 1, 0.65);
      knee.add(shoe);
      // Rounded knee so the leg doesn't show a seam when it bends
      knee.add(mesh(new THREE.SphereGeometry(0.074, 18, 14), suit, 0));
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
    const jacket = mesh(new THREE.CylinderGeometry(0.22, 0.19, 0.6, 20), suit, 0.3);
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
    for (const side of [1, -1]) this.spine.add(mesh(new THREE.SphereGeometry(0.075, 18, 14), suit, 0.55, 0.2 * side));

    // Arms: upper arm, elbow, forearm, cuff, hand
    const makeArm = (side: 1 | -1) => {
      const shoulder = new THREE.Group();
      shoulder.position.set(0.25 * side, 0.55, 0);
      shoulder.rotation.order = 'ZXY';
      shoulder.add(mesh(new THREE.CylinderGeometry(0.066, 0.06, 0.3, 18), suit, -0.15));
      const elbow = new THREE.Group();
      elbow.position.y = -0.3;
      elbow.add(mesh(new THREE.SphereGeometry(0.062, 16, 12), suit, 0));
      elbow.add(mesh(new THREE.CylinderGeometry(0.058, 0.052, 0.26, 18), suit, -0.13));
      elbow.add(mesh(new THREE.CylinderGeometry(0.054, 0.054, 0.035, 20), shirt, -0.265));
      elbow.add(mesh(new THREE.SphereGeometry(0.055, 18, 14), skin, -0.32));
      shoulder.add(elbow);
      this.spine.add(shoulder);
      return { shoulder, elbow };
    };
    this.arms = { R: makeArm(1), L: makeArm(-1) };
    this.handAnchor.position.set(0, -0.36, -0.03);
    this.arms.R.elbow.add(this.handAnchor);

    // Neck (a green stalk) and the tomato head
    this.spine.add(mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 18), flat('#3f8f2a'), 0.63));
    this.headPivot.position.y = 0.66;
    this.spine.add(this.headPivot);
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
    this.headPivot.add(head);

    // Face: a patch on the front of the head showing the current expression
    this.faceMat = new THREE.MeshBasicMaterial({ map: this.faces.neutral, transparent: true, depthWrite: false });
    const facePatch = new THREE.Mesh(
      new THREE.SphereGeometry(R * 1.005, 48, 32, Math.PI * 1.5 - 0.85, 1.7, 0.75, 1.35),
      this.faceMat,
    );
    facePatch.position.y = R * 0.88;
    facePatch.scale.y = 0.88;
    this.headPivot.add(facePatch);

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
      this.headPivot.add(pivot);
    }
    this.headPivot.add(mesh(new THREE.CylinderGeometry(0.012, 0.018, 0.07, 6), leafMat, R * 0.88 * 2 + 0.03));
    this.headTop.position.y = R * 2;
    this.headPivot.add(this.headTop);
  }

  /** Changes Dave's outfit: 'navy', 'tuxedo', 'pinstripe' or 'tracksuit'. */
  setOutfit(id: string) {
    const o = OUTFITS[id] ?? OUTFITS.navy;
    this.suitMat.map = o.pattern ? patternTexture(o.pattern) : null;
    this.suitMat.color.set(o.pattern ? '#ffffff' : o.suit);
    this.suitMat.needsUpdate = true;
    this.tie.visible = !!o.tie;
    if (o.tie) this.tieMat.color.set(o.tie);
    this.bowTie.visible = !!o.bowTie;
    this.shirtFront.visible = o.shirt;
    this.buttons.visible = o.shirt;
    this.shoeMat.color.set(o.shoes);
  }

  // ---------- Commands ----------

  /** Where he stands (feet), before any slide or jump. */
  setStance(x: number, z: number) {
    this.base.set(x, 0, z);
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
    this.faceMat.map = this.faces[this.expression()];
    const wantBlush = this.state === 'react' && this.reaction === 'gutter' ? 1 : 0;
    this.blush = smooth(this.blush, wantBlush, dt * 2);
    this.headMat.color.copy(this.headRed).lerp(this.headDark, this.blush);
  }

  private expression(): Expression {
    switch (this.state) {
      case 'charge':
      case 'swing':
        return 'focused';
      case 'wave':
        return 'happy';
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
        p.armR = limb(2.2, 0.05, 0.35);
        p.armL = limb(0.35, -1.0, 0.3);
        p.lean = 0.45;
        p.drop = 0.22;
        p.slide = 0.35;
        p.legL = limb(0.7, 0, -0.85);
        p.legR = limb(-0.65, 0.05, -0.3);
        break;
      }
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
        p.armR = limb(2.6, -0.45, 0.8 + 0.4 * pump);
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

  private blend(target: Pose, k: number) {
    const p = this.pose;
    for (const key of ['drop', 'lean', 'twist', 'nod', 'tilt', 'slide', 'jump'] as const) p[key] = smooth(p[key], target[key], k);
    for (const key of ['armR', 'armL', 'legR', 'legL'] as const) {
      p[key].fwd = smooth(p[key].fwd, target[key].fwd, k);
      p[key].out = smooth(p[key].out, target[key].out, k);
      p[key].bend = smooth(p[key].bend, target[key].bend, k);
    }
  }

  private apply() {
    const p = this.pose;
    this.root.position.set(this.base.x, this.base.y + p.jump, this.base.z - p.slide);
    this.hips.position.y = 0.95 - p.drop;
    this.spine.rotation.set(-p.lean, p.twist, 0);
    this.headPivot.rotation.set(-p.nod, 0, p.tilt);
    for (const side of ['R', 'L'] as const) {
      const sign = side === 'R' ? 1 : -1;
      const a = side === 'R' ? p.armR : p.armL;
      // Arms stay roughly upright relative to the ground even when he leans
      this.arms[side].shoulder.rotation.set(a.fwd - p.lean * 0.5, 0, a.out * sign);
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

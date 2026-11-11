// Where the camera sits for each moment of the game, and how it moves between shots.
import * as THREE from 'three';
import { HEAD_PIN_Z, PIT_END_Z } from '../game/dimensions';

const clamp = THREE.MathUtils.clamp;

export type Shot =
  /** Menus: Dave framed in the top half of the screen, above the menu card. */
  | 'menu'
  /** Face-on shot of Dave from down the lane, for his reaction. */
  | 'dave'
  /** Over Dave's shoulder while lining up. */
  | 'aim'
  /** Chasing the ball down the lane. */
  | 'follow'
  /** Looking at the pins after a throw. */
  | 'pins'
  /** Replay: a camera inside the pinsetter, looking back up the lane. */
  | 'replay';

export interface ShotInput {
  shot: Shot;
  /** Where Dave stands (aim shot) and where he is now (menu and reaction shots). */
  standX: number;
  aimX: number;
  daveZ: number;
  dave: THREE.Vector3;
  ball: { x: number; y: number; z: number };
}

// Replay camera: high up in the pinsetter, against the back wall, looking down over the
// whole pin deck and up the lane. (The masking unit is hidden while it plays.)
const REPLAY_POS = new THREE.Vector3(0, 1.75, PIT_END_Z + 0.1);
/** Where it looks while the ball is still coming: up the lane, with every pin in the bottom of the frame. */
const REPLAY_LOOK_LANE = new THREE.Vector3(0, 0, HEAD_PIN_Z + 0.9);
/** Where it settles as the ball arrives: the deck and the pit, where the pins fly. */
const REPLAY_LOOK_DECK = new THREE.Vector3(0, 0, HEAD_PIN_Z - 0.45);
const REPLAY_FOV = 62;
/** Narrow screens need a wider view to fit the deck across. */
const REPLAY_FOV_PORTRAIT = 84;

export class CameraRig {
  private pos = new THREE.Vector3(0.35, 1.5, 2.4);
  private look = new THREE.Vector3(0, 0, -16);
  private wantPos = new THREE.Vector3();
  private wantLook = new THREE.Vector3();
  private lastShot: Shot | null = null;
  private baseFov = 55;
  private shake = 0;

  constructor(private camera: THREE.PerspectiveCamera) {}

  get portrait() {
    return this.camera.aspect < 0.8;
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height;
    // Portrait phones need a wider view to see the lane
    this.baseFov = this.portrait ? 68 : 55;
    this.camera.fov = this.baseFov;
    this.camera.updateProjectionMatrix();
  }

  /** A short jolt, e.g. when the ball smashes into the pins on the replay. */
  bump(amount: number) {
    this.shake = Math.max(this.shake, amount);
  }

  update(dt: number, s: ShotInput) {
    const portrait = this.portrait;
    const { dave, ball } = s;
    let fov = this.baseFov;
    switch (s.shot) {
      case 'menu':
        // Menu card sits low on the screen; frame Dave in the top half above it
        this.wantPos.set(dave.x + 0.5, 1.2, dave.z - (portrait ? 4.6 : 3.4));
        this.wantLook.set(dave.x, portrait ? 0.15 : 0.55, dave.z);
        break;
      case 'dave':
        this.wantPos.set(dave.x + 0.35, 1.35, dave.z - (portrait ? 3.6 : 2.7));
        this.wantLook.set(dave.x, portrait ? 1.15 : 1.4, dave.z);
        break;
      case 'aim':
        // Over Dave's right shoulder, far enough back that Dave looks his real size next to the lane
        if (portrait) {
          this.wantPos.set(s.standX + 0.6, 2.3, s.daveZ + 3.3);
          this.wantLook.set(s.aimX * 0.4, 0.1, -10);
        } else {
          this.wantPos.set(s.standX + 0.65, 1.95, s.daveZ + 2.6);
          this.wantLook.set(s.aimX * 0.4, 0.05, -14);
        }
        break;
      case 'follow': {
        const z = Math.max(ball.z + 3.2, HEAD_PIN_Z + 4.2);
        this.wantPos.set(ball.x * 0.5, THREE.MathUtils.lerp(0.75, 1.4, clamp(z / 2, 0, 1)), z);
        this.wantLook.set(ball.x * 0.5, 0.1, Math.max(ball.z - 6, HEAD_PIN_Z - 0.4));
        break;
      }
      case 'pins':
        this.wantPos.set(0, 0.85, HEAD_PIN_Z + 3.6);
        this.wantLook.set(0, 0.15, HEAD_PIN_Z - 0.4);
        break;
      case 'replay': {
        // A fixed camera that tilts down onto the deck as the ball arrives, and pushes in a touch
        this.wantPos.copy(REPLAY_POS);
        const near = clamp((HEAD_PIN_Z + 6 - ball.z) / 6, 0, 1); // 0 far away → 1 at the pins
        const k = near * near * (3 - 2 * near);
        this.wantLook.copy(REPLAY_LOOK_LANE).lerp(REPLAY_LOOK_DECK, k);
        fov = (portrait ? REPLAY_FOV_PORTRAIT : REPLAY_FOV) - 8 * k;
        break;
      }
    }

    // Cut (rather than glide) when switching to or from the reaction and replay shots
    const cutShots: (Shot | null)[] = ['dave', 'replay'];
    const cut = s.shot !== this.lastShot && (cutShots.includes(s.shot) || cutShots.includes(this.lastShot));
    this.lastShot = s.shot;
    const rate = s.shot === 'follow' ? 6 : s.shot === 'replay' ? 10 : 3;
    const k = cut ? 1 : 1 - Math.exp(-dt * rate);
    this.pos.lerp(this.wantPos, k);
    this.look.lerp(this.wantLook, k);
    this.camera.position.copy(this.pos);
    if (this.shake > 0) {
      this.camera.position.x += (Math.random() - 0.5) * this.shake;
      this.camera.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 0.15);
    }
    this.camera.lookAt(this.look);

    const newFov = cut ? fov : THREE.MathUtils.lerp(this.camera.fov, fov, 1 - Math.exp(-dt * 12));
    if (Math.abs(newFov - this.camera.fov) > 0.01) {
      this.camera.fov = newFov;
      this.camera.updateProjectionMatrix();
    }
  }
}

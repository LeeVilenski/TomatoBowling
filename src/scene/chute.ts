import * as THREE from 'three';
import { DECK_END_Z, OUTER_HALF } from '../game/dimensions';

// The ball return: a trough along the capping between this lane and the next, ending in a
// hood and a short rack by the foul line. After each throw the tomato rolls home along it.

const X = OUTER_HALF + 0.19; // centre of the capping strip on the right
const FLOOR_Y = 0.07; // trough floor height
const START_Z = DECK_END_Z + 0.6;
const HOOD_Z = 0.35;
const RACK_END_Z = 1.25;

// Timeline (seconds, matches the 2.1 s pinsetter cycle)
const APPEAR = 0.15;
const ARRIVE = 1.55;
const SETTLE = 1.95;

export class ReturnChute {
  readonly group = new THREE.Group();

  constructor() {
    const metal = new THREE.MeshStandardMaterial({ color: '#2e2a36', metalness: 0.6, roughness: 0.35 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#d4d4de', metalness: 0.9, roughness: 0.2 });
    const len = HOOD_Z - START_Z;
    const midZ = (HOOD_Z + START_Z) / 2;

    // Trough: a floor and two low walls with chrome rails on top
    const floor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, len), metal);
    floor.position.set(X, FLOOR_Y - 0.01, midZ);
    this.group.add(floor);
    for (const side of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, len), metal);
      wall.position.set(X + side * 0.14, FLOOR_Y + 0.045, midZ);
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, len, 10), chrome);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(X + side * 0.14, FLOOR_Y + 0.105, midZ);
      this.group.add(wall, rail);
    }

    // Hood the ball pops out of, and a short rack where it waits
    const body = new THREE.MeshStandardMaterial({ color: '#3a2350', roughness: 0.45 });
    const hood = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.3, 28, 1, false, 0, Math.PI), new THREE.MeshStandardMaterial({ color: '#e0261b', roughness: 0.3, metalness: 0.2 }));
    hood.rotation.z = Math.PI / 2;
    hood.rotation.y = Math.PI / 2;
    hood.position.set(X, 0.3, HOOD_Z + 0.12);
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), body);
    base.position.set(X, 0.15, HOOD_Z + 0.12);
    const rackBase = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.26, RACK_END_Z - HOOD_Z - 0.3), body);
    rackBase.position.set(X, 0.13, (HOOD_Z + 0.37 + RACK_END_Z) / 2);
    this.group.add(hood, base, rackBase);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, RACK_END_Z - HOOD_Z - 0.3, 10), chrome);
      rail.rotation.x = Math.PI / 2;
      rail.position.set(X + side * 0.07, 0.3, (HOOD_Z + 0.37 + RACK_END_Z) / 2);
      this.group.add(rail);
    }
    this.group.traverse((o) => {
      o.castShadow = false;
      o.receiveShadow = true;
    });
  }

  /**
   * Where the returning ball is `t` seconds into the pinsetter cycle, or null while it's
   * still out of sight in the machinery. Also rolls it so it spins as it travels.
   */
  ballAt(t: number, radius: number, out: THREE.Object3D): boolean {
    if (t < APPEAR) return false;
    let z: number;
    let y = FLOOR_Y + radius;
    if (t < ARRIVE) {
      // Rolls back down the trough, quick at first, slowing as it nears the hood
      const k = (t - APPEAR) / (ARRIVE - APPEAR);
      const eased = 1 - Math.pow(1 - k, 2);
      z = START_Z + (HOOD_Z - START_Z) * eased;
    } else {
      // Up through the hood and out onto the rack
      const k = Math.min(1, (t - ARRIVE) / (SETTLE - ARRIVE));
      z = HOOD_Z + (RACK_END_Z - 0.3 - HOOD_Z) * k;
      y = FLOOR_Y + radius + Math.sin(k * Math.PI) * 0.25 + k * 0.2;
    }
    out.position.set(X, y, z);
    out.rotation.set((z - START_Z) / radius, 0, 0);
    return true;
  }
}

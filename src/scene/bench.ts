import * as THREE from 'three';

/** Height of the top of the seat cushion, metres (Dave's sitting pose is built for this). */
export const SEAT_TOP = 0.44;

/**
 * The bowlers' bench behind the approach, where whoever isn't bowling sits and watches:
 * a red vinyl settee on chrome legs, like the ones in old alleys. Its origin is the spot a
 * figure sits on (`sitAt`/`walkTo(..., 'sit')` at the same x, z), at the right end, with the
 * seat facing the lanes (-z).
 */
export function buildBench(): THREE.Group {
  const g = new THREE.Group();
  const vinyl = new THREE.MeshStandardMaterial({ color: '#b3261e', roughness: 0.45 });
  const piping = new THREE.MeshStandardMaterial({ color: '#f2e6c9', roughness: 0.5 });
  const chrome = new THREE.MeshStandardMaterial({ color: '#c8ccd2', metalness: 0.85, roughness: 0.25 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.x = rx;
    m.castShadow = true;
    m.receiveShadow = true;
    g.add(m);
    return m;
  };
  const LEN = 1.7;
  // The sitting spot is near the right-hand end (the sitter's right), where the camera sees
  // it beside the bowler when it turns round to look at them
  const MID_X = -(LEN / 2 - 0.4);
  // Seat cushion: runs from just in front of the hips to the backrest
  const seatDepth = 0.42;
  const seatZ = 0.05;
  add(new THREE.BoxGeometry(LEN, 0.12, seatDepth), vinyl, MID_X, SEAT_TOP - 0.06, seatZ);
  add(new THREE.BoxGeometry(LEN + 0.01, 0.025, 0.025), piping, MID_X, SEAT_TOP - 0.005, seatZ - seatDepth / 2);
  // Backrest, tipped back a little, with buttoned panels
  const back = add(new THREE.BoxGeometry(LEN, 0.5, 0.12), vinyl, MID_X, SEAT_TOP + 0.3, seatZ + seatDepth / 2 + 0.02, -0.12);
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), piping);
    b.position.set(-LEN / 2 + (LEN / 4) * (i + 0.5), 0.03, -0.062);
    back.add(b);
  }
  // Base and chrome legs
  add(new THREE.BoxGeometry(LEN - 0.1, 0.06, seatDepth - 0.08), chrome, MID_X, SEAT_TOP - 0.15, seatZ);
  for (const x of [-LEN / 2 + 0.12, LEN / 2 - 0.12])
    for (const z of [-seatDepth / 2 + 0.08, seatDepth / 2 - 0.05]) add(new THREE.CylinderGeometry(0.022, 0.03, SEAT_TOP - 0.15, 12), chrome, MID_X + x, (SEAT_TOP - 0.15) / 2, seatZ + z);
  // Armrests at the ends
  for (const side of [-1, 1]) {
    add(new THREE.BoxGeometry(0.08, 0.2, seatDepth), vinyl, MID_X + side * (LEN / 2 + 0.04), SEAT_TOP + 0.04, seatZ);
  }
  return g;
}

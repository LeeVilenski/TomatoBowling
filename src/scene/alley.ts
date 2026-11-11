import * as THREE from 'three';
import {
  APPROACH_START_Z,
  DECK_END_Z,
  GUTTER_WIDTH,
  LANE_HALF,
  LANE_WIDTH,
  OUTER_HALF,
  PIT_DEPTH,
  PIT_END_Z,
  gutterPlates,
} from '../game/dimensions';

const BOARDS = 39;

/**
 * Wooden boards: a small texture that repeats down the lane. The boards run lengthways, so
 * one strip of pixels per row is all it needs, and it stays sharp at any distance.
 */
function boardsTexture(lengthM: number): THREE.CanvasTexture {
  const w = 1024;
  const h = 64;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const boardW = w / BOARDS;
  for (let i = 0; i < BOARDS; i++) {
    const t = (i * 37) % 7;
    g.fillStyle = `hsl(${32 + t}, ${55 + t * 2}%, ${62 - t * 1.5}%)`;
    g.fillRect(i * boardW, 0, boardW + 1, h);
    // A little grain within each board
    for (let k = 0; k < 6; k++) {
      g.fillStyle = `rgba(90, 50, 15, ${0.04 + ((i * 13 + k * 7) % 5) * 0.012})`;
      g.fillRect(i * boardW + ((k * 5 + i) % Math.floor(boardW)), 0, 1, h);
    }
    g.fillStyle = 'rgba(80,45,15,0.3)';
    g.fillRect(i * boardW, 0, 1, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, lengthM / 2);
  tex.anisotropy = 16;
  return tex;
}

/** Foul line, targeting arrows and guide dots, drawn as real shapes so they stay crisp. */
function laneMarkings(centreX: number): THREE.Group {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#7a1d12', roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const flat = (geo: THREE.BufferGeometry, x: number, z: number) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(centreX + x, 0.0012, z);
    m.receiveShadow = true;
    g.add(m);
  };
  const boardW = LANE_WIDTH / BOARDS;
  const boardX = (board: number) => LANE_HALF - (board - 0.5) * boardW; // board 1 is on the right

  const foul = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH, 0.02), new THREE.MeshStandardMaterial({ color: '#2a1608', polygonOffset: true, polygonOffsetFactor: -2 }));
  foul.rotation.x = -Math.PI / 2;
  foul.position.set(centreX, 0.0012, 0);
  g.add(foul);

  // Arrows ~15 ft out in a V, each pointing down the lane
  const arrow = new THREE.Shape();
  arrow.moveTo(0, 0.12);
  arrow.lineTo(-0.017, -0.035);
  arrow.lineTo(0.017, -0.035);
  arrow.closePath();
  const arrowGeo = new THREE.ShapeGeometry(arrow);
  for (const board of [5, 10, 15, 20, 25, 30, 35]) {
    const fromCentre = Math.abs(board - 20) / 5;
    flat(arrowGeo, boardX(board), -4.57 - fromCentre * 0.3);
  }
  // Guide dots ~7 ft out
  const dotGeo = new THREE.CircleGeometry(0.011, 20);
  for (const board of [3, 5, 8, 11, 14, 26, 29, 32, 35, 37]) flat(dotGeo, boardX(board), -2.13);
  return g;
}

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

export function buildAlley(scene: THREE.Scene) {
  scene.background = new THREE.Color('#1b1026');
  scene.fog = new THREE.Fog('#1b1026', 18, 40);

  // Lane surface (approach + lane + deck)
  const laneLen = APPROACH_START_Z - DECK_END_Z;
  const laneMat = new THREE.MeshStandardMaterial({
    map: boardsTexture(laneLen),
    roughness: 0.25,
    metalness: 0.0,
  });
  const lane = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH, laneLen), laneMat);
  lane.rotation.x = -Math.PI / 2;
  lane.position.set(0, 0, (APPROACH_START_Z + DECK_END_Z) / 2);
  lane.receiveShadow = true;
  scene.add(lane);
  scene.add(laneMarkings(0));

  // Gutters
  const gutterMat = new THREE.MeshStandardMaterial({ color: '#3a3d46', roughness: 0.5, metalness: 0.4 });
  const gutterLen = -DECK_END_Z;
  for (const plate of gutterPlates()) {
    const m = box(plate.halfWidth * 2, 0.02, gutterLen, gutterMat, plate.x, plate.y - 0.01, DECK_END_Z / 2);
    m.rotation.z = plate.angle;
    scene.add(m);
  }
  const edgeMat = new THREE.MeshStandardMaterial({ color: '#5a3a1e', roughness: 0.6 });
  for (const side of [-1, 1]) {
    scene.add(box(0.04, 0.2, gutterLen, gutterMat, side * (OUTER_HALF + 0.02), -0.05, DECK_END_Z / 2));
    // Side face of the lane, visible from inside the gutter
    scene.add(box(0.01, 0.12, gutterLen, edgeMat, side * (LANE_HALF + 0.005), -0.06, DECK_END_Z / 2));
  }

  // Approach floor beside the gutters
  const approachMat = new THREE.MeshStandardMaterial({ color: '#b98a55', roughness: 0.35 });
  for (const side of [-1, 1]) {
    scene.add(box(GUTTER_WIDTH, 0.02, APPROACH_START_Z, approachMat, side * (LANE_HALF + GUTTER_WIDTH / 2), -0.01, APPROACH_START_Z / 2));
  }

  // Neighbouring lanes (decoration only) and capping between them
  const capMat = new THREE.MeshStandardMaterial({ color: '#2b1f3a', roughness: 0.6 });
  for (const side of [-1, 1]) {
    scene.add(box(0.3, 0.12, laneLen, capMat, side * (OUTER_HALF + 0.19), 0.0, (APPROACH_START_Z + DECK_END_Z) / 2));
    const n = new THREE.Mesh(new THREE.PlaneGeometry(LANE_WIDTH, laneLen), laneMat);
    n.rotation.x = -Math.PI / 2;
    n.position.set(side * (OUTER_HALF * 2 + 0.34), -0.001, (APPROACH_START_Z + DECK_END_Z) / 2);
    scene.add(laneMarkings(side * (OUTER_HALF * 2 + 0.34)));
    n.receiveShadow = true;
    scene.add(n);
  }

  // Kickbacks, pit and back cushion
  const kickMat = new THREE.MeshStandardMaterial({ color: '#241a33', roughness: 0.8 });
  const kickStart = DECK_END_Z + 1.6;
  const kickLen = kickStart - PIT_END_Z;
  for (const side of [-1, 1]) {
    scene.add(box(0.06, 1.0, kickLen, kickMat, side * (OUTER_HALF + 0.03), 0.2, (kickStart + PIT_END_Z) / 2));
  }
  const pitMat = new THREE.MeshStandardMaterial({ color: '#0d0912', roughness: 1 });
  scene.add(box(OUTER_HALF * 2, 0.02, DECK_END_Z - PIT_END_Z, pitMat, 0, -PIT_DEPTH, (DECK_END_Z + PIT_END_Z) / 2));
  scene.add(box(OUTER_HALF * 2 + 0.12, 1.2, 0.1, pitMat, 0, 0, PIT_END_Z - 0.05));

  // Masking unit above the pins: a red panel with a tomato-ish stripe
  const maskMat = new THREE.MeshStandardMaterial({ color: '#c8281e', roughness: 0.6, emissive: '#3a0805' });
  scene.add(box(OUTER_HALF * 2 + 0.6, 0.55, 0.08, maskMat, 0, 0.95, DECK_END_Z + 0.4));
  const stripeMat = new THREE.MeshStandardMaterial({ color: '#3fae3a', emissive: '#0c2a0a' });
  scene.add(box(OUTER_HALF * 2 + 0.6, 0.06, 0.09, stripeMat, 0, 0.72, DECK_END_Z + 0.4));

  // Back wall and floor of the room
  const wallMat = new THREE.MeshStandardMaterial({ color: '#2a1838', roughness: 0.9 });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), wallMat);
  wall.position.set(0, 3, PIT_END_Z - 0.2);
  scene.add(wall);

  // Lighting
  scene.add(new THREE.HemisphereLight('#fff3e0', '#2a1838', 1.1));
  const key = new THREE.DirectionalLight('#ffffff', 1.6);
  key.position.set(1.5, 6, -14);
  key.target.position.set(0, 0, -18.8);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const sc = key.shadow.camera;
  sc.left = -1.5;
  sc.right = 1.5;
  sc.top = 2.5;
  sc.bottom = -2.5;
  sc.near = 1;
  sc.far = 15;
  key.shadow.bias = -0.0005;
  scene.add(key, key.target);

  // A soft light along the lane so the ball is lit on the way down
  const fill = new THREE.DirectionalLight('#ffe2c4', 0.6);
  fill.position.set(-2, 4, 3);
  fill.target.position.set(0, 0, -8);
  scene.add(fill, fill.target);
  return { keyLight: key };
}

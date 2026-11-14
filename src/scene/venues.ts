import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { TrackId } from '../audio/music';
import { DECK_END_Z, OUTER_HALF, PIN_PROFILE, PIT_END_Z } from '../game/dimensions';
import { canvasTexture, carpet, maskingPanel, maskingPart, neonSign } from './decor';
import { scoreMonitor } from './scoreboard';

// The places Tomato Dave can bowl. The lanes are the same everywhere; each venue adds its
// own walls, ceiling, lights, signs, music and a few moving effects.

export type VenueId = 'classic' | 'server' | 'disco' | 'rooftop' | 'golden' | 'mem';

export interface VenueInfo {
  id: VenueId;
  name: string;
  track: TrackId;
}

export const VENUES: VenueInfo[] = [
  { id: 'classic', name: "Tomato Dave's", track: 'lounge' },
  { id: 'server', name: 'Server Room Lanes', track: 'chip' },
  { id: 'disco', name: 'Disco Inferno', track: 'disco' },
  { id: 'rooftop', name: 'Rooftop at Sunset', track: 'bossa' },
  // Career mode's final; open for free play once you've reached it
  { id: 'golden', name: 'The Golden Pin', track: 'golden' },
  // The IT engineers' den: opens once you're champion of Server Room Lanes
  { id: 'mem', name: 'MEM', track: 'mem' },
];

interface Lighting {
  hemi: THREE.HemisphereLight;
  key: THREE.DirectionalLight;
  fill: THREE.DirectionalLight;
}

interface Built {
  group: THREE.Group;
  /** Called every frame while this venue is showing. */
  update: (t: number) => void;
  /** Sets background, fog and light colours. */
  apply: (scene: THREE.Scene, l: Lighting) => void;
}

// Room dimensions shared by the indoor venues
const WALL_X = 3.3;
const CEIL_Y = 3.9;
const FRONT_Z = 8.5; // wall behind the bowler
const BACK_Z = PIT_END_Z - 0.25; // wall behind the pins
const ROOM_LEN = FRONT_Z - BACK_Z;
const MID_Z = (FRONT_Z + BACK_Z) / 2;
const NEIGHBOUR_X = OUTER_HALF * 2 + 0.34;

const basic = (color: string) => new THREE.MeshBasicMaterial({ color, toneMapped: false });
const std = (color: string, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });

function plane(w: number, h: number, mat: THREE.Material, pos: [number, number, number], rot: [number, number, number] = [0, 0, 0]) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  m.position.set(...pos);
  m.rotation.set(...rot);
  m.receiveShadow = true;
  return m;
}

function boxAt(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

/** Walls, ceiling and floor strips for an indoor venue. */
function room(g: THREE.Group, wall: THREE.Material, ceiling: THREE.Material, back: THREE.Material, floor: THREE.Material) {
  g.add(plane(ROOM_LEN, CEIL_Y, wall, [-WALL_X, CEIL_Y / 2, MID_Z], [0, Math.PI / 2, 0]));
  g.add(plane(ROOM_LEN, CEIL_Y, wall, [WALL_X, CEIL_Y / 2, MID_Z], [0, -Math.PI / 2, 0]));
  g.add(plane(WALL_X * 2, ROOM_LEN, ceiling, [0, CEIL_Y, MID_Z], [Math.PI / 2, 0, 0]));
  g.add(plane(WALL_X * 2, CEIL_Y + 1, back, [0, CEIL_Y / 2 - 0.5, BACK_Z]));
  g.add(plane(WALL_X * 2, CEIL_Y, back, [0, CEIL_Y / 2, FRONT_Z], [0, Math.PI, 0]));
  // Floor beside the outer lanes, and behind the bowler
  for (const side of [-1, 1]) g.add(plane(0.7, ROOM_LEN, floor, [side * (WALL_X - 0.35), 0.001, MID_Z], [-Math.PI / 2, 0, 0]));
  g.add(plane(WALL_X * 2, FRONT_Z - 4.5, floor, [0, -0.004, (FRONT_Z + 4.5) / 2], [-Math.PI / 2, 0, 0]));
}

/** Sign above the pins and the branded masking-unit panel. */
function signage(g: THREE.Group, title: string, sub: string, tc: string, sc: string, lane: string, top: string, bottom: string, stripe: string, emblem: string) {
  const sign = neonSign(title, sub, tc, sc);
  sign.position.set(0, 1.72, DECK_END_Z + 0.32);
  const panel = maskingPanel(lane, top, bottom, stripe, emblem);
  // Just in front of the alley's own masking unit (front face at +0.445), so its green
  // stripe can't flicker through
  panel.position.set(0, 0.95, DECK_END_Z + 0.46);
  g.add(maskingPart(sign), maskingPart(panel));
  return { sign, panel };
}

/** Glowing strips along both edges of our lane's capping. */
function laneGlow(g: THREE.Group, colour: string) {
  const mat = basic(colour);
  const len = 4.5 - DECK_END_Z;
  for (const side of [-1, 1]) {
    for (const edge of [-1, 1]) {
      const strip = boxAt(0.015, 0.012, len, mat, side * (OUTER_HALF + 0.19) + edge * 0.15, 0.066, (4.5 + DECK_END_Z) / 2);
      g.add(strip);
    }
  }
}

// ---------------------------------------------------------------- Tomato Dave's
function classic(scores: THREE.Texture): Built {
  const g = new THREE.Group();
  // Wall mural drawn to scale: one 512px tile covers the full wall height (3.9 m)
  const mural = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#2a1838';
    c.fillRect(0, 0, 512, 512);
    // Wainscot stripes at about waist-to-shoulder height
    ['#c8281e', '#ffd23a', '#3fae3a'].forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(0, 300 + i * 20, 512, 13);
    });
    c.fillStyle = '#21122c';
    c.fillRect(0, 362, 512, 150);
    // A row of little tomatoes and pins above the stripes
    for (let x = 32; x < 512; x += 128) {
      c.fillStyle = '#e0261b';
      c.beginPath();
      c.arc(x, 240, 20, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#3fae3a';
      c.fillRect(x - 3, 214, 6, 8);
      c.fillStyle = '#f4efe4';
      c.beginPath();
      c.ellipse(x + 64, 244, 9, 20, 0, 0, Math.PI * 2);
      c.ellipse(x + 64, 218, 6, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#d0201a';
      c.fillRect(x + 58, 226, 12, 3);
    }
  });
  mural.wrapS = THREE.RepeatWrapping;
  mural.repeat.set(ROOM_LEN / CEIL_Y, 1);
  const ceiling = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#160c20';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#2a1838';
    c.lineWidth = 4;
    c.strokeRect(0, 0, 256, 256);
  });
  ceiling.wrapS = ceiling.wrapT = THREE.RepeatWrapping;
  ceiling.repeat.set(4, 18);
  const wallTex = canvasTexture(512, 256, (c) => {
    c.fillStyle = '#2a1838';
    c.fillRect(0, 0, 512, 256);
    ['#c8281e', '#ffd23a', '#3fae3a'].forEach((col, i) => {
      c.fillStyle = col;
      c.fillRect(0, 120 + i * 22, 512, 14);
    });
  });
  room(g, std('#ffffff', { map: mural }), std('#ffffff', { map: ceiling }), std('#ffffff', { map: wallTex }), std('#ffffff', { map: carpet(), roughness: 0.95 }));
  signage(g, "Tomato Dave's", '★ TEN-PIN ★', '#ff3b2f', '#54e04a', 'LANE 7', '#d8301f', '#9e1c12', '#3fae3a', '#ff5a40');
  laneGlow(g, '#ffb347');

  // Recessed light panels in rows down the ceiling
  const panelMat = basic('#ffe9c4');
  for (let z = -4; z > DECK_END_Z; z -= 3.2) for (const x of [-NEIGHBOUR_X / 2, NEIGHBOUR_X / 2]) g.add(boxAt(0.6, 0.03, 0.18, panelMat, x, CEIL_Y - 0.02, z));
  // Overhead monitors above the approach, as in every real alley
  const screen = canvasTexture(512, 256, (c) => {
    c.fillStyle = '#100818';
    c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#ff4a3a';
    c.font = 'italic 900 64px "Trebuchet MS", sans-serif';
    c.textAlign = 'center';
    c.fillText("TOMATO DAVE'S", 256, 110);
    c.fillStyle = '#ffd23a';
    c.font = '700 40px "Trebuchet MS", sans-serif';
    c.fillText('LANE 7  ·  GOOD LUCK!', 256, 180);
  });
  // Ours shows the live scoreboard; the neighbours' just wish everyone luck
  g.add(scoreMonitor(scores, CEIL_Y));
  for (const x of [-NEIGHBOUR_X, NEIGHBOUR_X]) {
    const mon = new THREE.Group();
    mon.add(boxAt(0.95, 0.56, 0.06, std('#111'), 0, 0, 0));
    // Screen faces the bowler (towards +z)
    const face = plane(0.9, 0.5, new THREE.MeshBasicMaterial({ map: screen, toneMapped: false }), [0, 0, 0.032]);
    mon.add(face);
    mon.add(boxAt(0.03, CEIL_Y - 3.3, 0.03, std('#222'), 0, (CEIL_Y - 3.3) / 2 + 0.28, 0));
    mon.position.set(x, 3.3, -1.2);
    mon.rotation.x = 0.18; // tilted down towards the bowler
    g.add(mon);
  }
  // Bench behind the bowler
  const benchMat = std('#c8281e', { roughness: 0.5 });
  g.add(boxAt(2.6, 0.45, 0.6, benchMat, -0.4, 0.22, 6.2), boxAt(2.6, 0.55, 0.15, benchMat, -0.4, 0.6, 6.5));

  return {
    group: g,
    update: () => {},
    apply: (scene, l) => {
      scene.background = new THREE.Color('#1b1026');
      scene.fog = new THREE.Fog('#1b1026', 22, 45);
      l.hemi.color.set('#fff3e0');
      l.hemi.groundColor.set('#2a1838');
      l.hemi.intensity = 1.1;
      l.key.color.set('#ffffff');
      l.key.intensity = 1.6;
      l.fill.color.set('#ffe2c4');
    },
  };
}

// ---------------------------------------------------------------- Server Room Lanes
function server(scores: THREE.Texture): Built {
  const g = new THREE.Group();
  const floorTex = canvasTexture(128, 128, (c) => {
    c.fillStyle = '#3a3f4a';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = '#22262e';
    c.lineWidth = 4;
    c.strokeRect(0, 0, 128, 128);
    c.fillStyle = '#2b2f38';
    for (let x = 16; x < 128; x += 16) for (let y = 16; y < 128; y += 16) c.fillRect(x - 2, y - 2, 4, 4);
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(10, 30);
  const ceilTex = canvasTexture(64, 64, (c) => {
    c.fillStyle = '#0b0f17';
    c.fillRect(0, 0, 64, 64);
    c.strokeStyle = '#1a2130';
    c.strokeRect(0, 0, 64, 64);
  });
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set(10, 40);
  room(g, std('#0c111b'), std('#ffffff', { map: ceilTex }), std('#0c111b'), std('#ffffff', { map: floorTex }));
  signage(g, 'SERVER ROOM LANES', '★ 99.9% UPTIME ★', '#36c8ff', '#54e04a', 'LANE 404', '#0f2438', '#08121e', '#36c8ff', '#36c8ff');
  laneGlow(g, '#36c8ff');

  // Rows of server racks down both walls, and behind the bowler
  const rackTex = canvasTexture(128, 256, (c) => {
    c.fillStyle = '#1b1f27';
    c.fillRect(0, 0, 128, 256);
    for (let y = 8; y < 256; y += 20) {
      c.fillStyle = '#262b35';
      c.fillRect(8, y, 112, 15);
      c.fillStyle = '#11141a';
      for (let x = 14; x < 110; x += 6) c.fillRect(x, y + 4, 3, 7);
    }
  });
  const rackMat = std('#ffffff', { map: rackTex, metalness: 0.4, roughness: 0.5 });
  const rackGeo = new THREE.BoxGeometry(0.85, 2.3, 0.75);
  const spots: [number, number, number][] = [];
  for (let z = 7.6; z > BACK_Z + 0.5; z -= 0.8) for (const side of [-1, 1]) spots.push([side * (WALL_X - 0.45), 1.15, z]);
  for (let x = -2.6; x <= 2.6; x += 0.9) spots.push([x, 1.15, FRONT_Z - 0.45]);
  const racks = new THREE.InstancedMesh(rackGeo, rackMat, spots.length);
  const m = new THREE.Matrix4();
  spots.forEach((p, i) => racks.setMatrixAt(i, m.makeTranslation(...p)));
  g.add(racks);

  // Blinking status LEDs on the rack fronts
  const ledSpots: THREE.Vector3[] = [];
  for (const [x, , z] of spots) {
    const facing = z > FRONT_Z - 1 ? new THREE.Vector3(0, 0, -1) : new THREE.Vector3(-Math.sign(x), 0, 0);
    for (let row = 0; row < 8; row++) for (let col = 0; col < 3; col++) {
      const across = (col - 1) * 0.18;
      const y = 0.4 + row * 0.24;
      const front = facing.clone().multiplyScalar(0.38);
      ledSpots.push(new THREE.Vector3(x + front.x + (facing.z ? across : 0), y, z + front.z + (facing.x ? across : 0)));
    }
  }
  const leds = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.018, 0.03), basic('#ffffff'), ledSpots.length);
  const ledColours = ['#36ff6a', '#36ff6a', '#36ff6a', '#ffb02e', '#36c8ff', '#1a2b22'].map((c) => new THREE.Color(c));
  ledSpots.forEach((p, i) => {
    leds.setMatrixAt(i, m.makeTranslation(p.x, p.y, p.z));
    leds.setColorAt(i, ledColours[i % ledColours.length]);
  });
  g.add(leds);

  // Cable trays and cool blue light strips overhead
  const tray = std('#c9a227', { metalness: 0.5, roughness: 0.4 });
  for (const x of [-2.4, -1.0, 1.0, 2.4]) g.add(boxAt(0.3, 0.05, ROOM_LEN, tray, x, CEIL_Y - 0.35, MID_Z));
  const strip = basic('#7fd8ff');
  for (const x of [-NEIGHBOUR_X / 2, NEIGHBOUR_X / 2]) g.add(boxAt(0.06, 0.03, ROOM_LEN - 2, strip, x, CEIL_Y - 0.03, MID_Z));

  g.add(scoreMonitor(scores, CEIL_Y));

  // A big terminal screen behind the pins
  const term = canvasTexture(512, 256, (c) => {
    c.fillStyle = '#020a05';
    c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#3cff7a';
    c.font = '22px "Courier New", monospace';
    const lines = ['$ ssh dave@lane404', '> bowling.service ... active', '> pins: 10/10 online', '> tomato.exe running', '> latency: 0.0001 ms', '$ sudo strike --now', '█'];
    lines.forEach((l, i) => c.fillText(l, 18, 34 + i * 32));
  });
  g.add(plane(2.6, 1.3, new THREE.MeshBasicMaterial({ map: term, toneMapped: false }), [0, 2.85, BACK_Z + 0.05]));

  let last = 0;
  return {
    group: g,
    update: (t) => {
      // Flicker a handful of LEDs a few times a second
      if (t - last < 0.09) return;
      last = t;
      for (let n = 0; n < 40; n++) {
        const i = Math.floor(Math.random() * ledSpots.length);
        leds.setColorAt(i, ledColours[Math.floor(Math.random() * ledColours.length)]);
      }
      leds.instanceColor!.needsUpdate = true;
    },
    apply: (scene, l) => {
      scene.background = new THREE.Color('#05080f');
      scene.fog = new THREE.Fog('#05080f', 20, 42);
      l.hemi.color.set('#bfe4ff');
      l.hemi.groundColor.set('#0b1622');
      l.hemi.intensity = 0.9;
      l.key.color.set('#e6f4ff');
      l.key.intensity = 1.5;
      l.fill.color.set('#9fd6ff');
    },
  };
}

// ---------------------------------------------------------------- Disco Inferno
function disco(scores: THREE.Texture): Built {
  const g = new THREE.Group();
  const wallTex = canvasTexture(512, 256, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, 256);
    grd.addColorStop(0, '#2a0838');
    grd.addColorStop(1, '#5a0f5c');
    c.fillStyle = grd;
    c.fillRect(0, 0, 512, 256);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = ['#ffd23a', '#ff3cc7', '#3cf0ff'][i % 3];
      const x = (i * 131) % 512;
      const y = (i * 71) % 220 + 18;
      c.beginPath();
      for (let k = 0; k < 10; k++) {
        const r = k % 2 ? 3 : 8;
        const a = (k / 10) * Math.PI * 2;
        c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      }
      c.fill();
    }
  });
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.repeat.set(6, 1);
  room(g, std('#ffffff', { map: wallTex }), std('#08020c'), std('#ffffff', { map: wallTex }), std('#1a0a24'));
  signage(g, 'DISCO INFERNO', '★ BOOGIE & BOWL ★', '#ff3cc7', '#ffe03c', 'LANE 54', '#2a0a2e', '#120414', '#ffd23a', '#ff3cc7');
  laneGlow(g, '#ff3cc7');

  g.add(scoreMonitor(scores, CEIL_Y));

  // Mirror ball
  const ball = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 3),
    new THREE.MeshStandardMaterial({ color: '#e8e8f0', metalness: 1, roughness: 0.08, flatShading: true, envMapIntensity: 3 }),
  );
  ball.position.set(0, 3.1, -7);
  g.add(ball, boxAt(0.01, CEIL_Y - 3.5, 0.01, basic('#555'), 0, (CEIL_Y + 3.5) / 2, -7));

  // Coloured spotlights sweeping over the lanes
  const beams = (['#ff3cc7', '#3cf0ff', '#ffe03c'] as const).map((colour, i) => {
    const s = new THREE.SpotLight(colour, 40, 30, 0.22, 0.5, 1);
    s.position.set((i - 1) * 2.2, CEIL_Y - 0.1, -3 - i * 4);
    g.add(s, s.target);
    g.add(boxAt(0.18, 0.18, 0.18, basic(colour), s.position.x, CEIL_Y - 0.1, s.position.z));
    return s;
  });

  // Twinkling lights all over the ceiling
  const starCount = 260;
  const starPos = new Float32Array(starCount * 3);
  const starCol = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) starPos.set([(Math.random() - 0.5) * WALL_X * 2, CEIL_Y - 0.02, BACK_Z + Math.random() * ROOM_LEN], i * 3);
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('color', new THREE.BufferAttribute(starCol, 3));
  g.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 0.05, vertexColors: true, toneMapped: false })));

  // Light-up dance floor behind the bowler
  const tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(0.58, 0.02, 0.58), basic('#ffffff'), 10 * 6);
  const m = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) tiles.setMatrixAt(i, m.makeTranslation(-2.7 + (i % 10) * 0.6, 0.005, 4.85 + Math.floor(i / 10) * 0.6));
  g.add(tiles);
  const palette = ['#ff3cc7', '#3cf0ff', '#ffe03c', '#7c3cff', '#3cff8a'].map((c) => new THREE.Color(c));
  const dim = new THREE.Color('#200a28');
  const tmp = new THREE.Color();

  let lastTiles = -1;
  return {
    group: g,
    update: (t) => {
      ball.rotation.y = t * 0.5;
      beams.forEach((s, i) => {
        const a = t * (0.6 + i * 0.2) + i * 2;
        s.target.position.set(Math.sin(a) * 2.5, 0, s.position.z - 4 + Math.cos(a * 0.7) * 5);
      });
      const step = Math.floor(t * 2.5);
      if (step !== lastTiles) {
        lastTiles = step;
        for (let i = 0; i < 60; i++) {
          const on = (i + step) % 3 === 0 || ((i * 7 + step) % 5 === 0);
          tiles.setColorAt(i, on ? palette[(i + step) % palette.length] : dim);
        }
        tiles.instanceColor!.needsUpdate = true;
        for (let i = 0; i < starCount; i++) {
          const k = Math.random() < 0.4 ? 1 : 0.15;
          tmp.copy(palette[(i + step) % palette.length]).multiplyScalar(k);
          starCol.set([tmp.r, tmp.g, tmp.b], i * 3);
        }
        starGeo.attributes.color.needsUpdate = true;
      }
    },
    apply: (scene, l) => {
      scene.background = new THREE.Color('#12031c');
      scene.fog = new THREE.Fog('#12031c', 20, 42);
      l.hemi.color.set('#ffc6f2');
      l.hemi.groundColor.set('#2a0838');
      l.hemi.intensity = 0.8;
      l.key.color.set('#ffe6ff');
      l.key.intensity = 1.3;
      l.fill.color.set('#ff9bdc');
    },
  };
}

// ---------------------------------------------------------------- Rooftop at Sunset

/**
 * Scales a box's texture coordinates to its real size, so a tiling texture keeps the same
 * scale on every face (tw × th metres per tile) instead of stretching to fit.
 */
function tileBoxUVs(geo: THREE.BoxGeometry, w: number, h: number, d: number, tw: number, th: number, offU = 0, offV = 0) {
  const uv = geo.attributes.uv as THREE.BufferAttribute;
  // Face order is +x, -x, +y, -y, +z, -z, four corners each
  const span = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let i = 0; i < uv.count; i++) {
    const [su, sv] = span[Math.floor(i / 4)];
    uv.setXY(i, (uv.getX(i) * su) / tw + offU, (uv.getY(i) * sv) / th + offV);
  }
  return geo;
}

function tiledBox(w: number, h: number, d: number, mat: THREE.Material | THREE.Material[], x: number, y: number, z: number, tw: number, th: number) {
  const m = new THREE.Mesh(tileBoxUVs(new THREE.BoxGeometry(w, h, d), w, h, d, tw, th), mat);
  m.position.set(x, y, z);
  m.receiveShadow = true;
  return m;
}

/** Brick wall texture; one tile is 4 bricks across and 8 courses up (0.92 m × 0.6 m). */
function brickTexture(base: [number, number, number], mortar: string) {
  const rand = seeded(5);
  const tex = canvasTexture(256, 256, (c) => {
    c.fillStyle = mortar;
    c.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row++) {
      const shift = row % 2 ? 32 : 0;
      for (let k = -1; k < 4; k++) {
        const [h, s, l] = base;
        c.fillStyle = `hsl(${h + (rand() - 0.5) * 8}, ${s}%, ${l + (rand() - 0.5) * 9}%)`;
        c.fillRect(k * 64 + shift + 2, row * 32 + 2, 60, 28);
      }
    }
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function seeded(seed: number) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

interface Facade {
  /** Wall colour and the colours of unlit glass */
  wall: string;
  glass: string[];
  /** Window size within each 2 m bay × 3.5 m floor, in pixels of a 32 × 32 cell */
  winW: number;
  winH: number;
  /** Horizontal band (spandrel) colour drawn between floors, if any */
  band?: string;
}

const FACADES: Facade[] = [
  // Glass office tower: big windows, thin mullions, catching the sunset
  { wall: '#3b4256', glass: ['#6a5a86', '#8a6a8e', '#c98a7e', '#4f5878'], winW: 28, winH: 24, band: '#2c3242' },
  // Old brick block: small punched windows
  { wall: '#7a4636', glass: ['#3a2c3a', '#4a3848', '#6e5068'], winW: 12, winH: 18 },
  // Pale concrete apartments with deep floor bands
  { wall: '#b49c8e', glass: ['#4e4258', '#665470', '#8f6f80'], winW: 20, winH: 16, band: '#8e786e' },
  // Dark stone
  { wall: '#4e3c44', glass: ['#2e2434', '#5a4660', '#7a5a70'], winW: 16, winH: 20 },
];

const BAY = 2; // metres per window bay
const FLOOR = 3.5; // metres per storey
const TILE_BAYS = 8;
const TILE_FLOORS = 8;

/**
 * A facade texture (8 bays × 8 floors per tile), plus a matching glow map with only the
 * lit windows in it, so the walls take the sunset light and only the windows shine.
 */
function facadeTextures(f: Facade, seed: number) {
  const rand = seeded(seed);
  const lit: boolean[] = [];
  const shades: string[] = [];
  for (let i = 0; i < TILE_BAYS * TILE_FLOORS; i++) {
    lit.push(rand() < 0.28);
    shades.push(f.glass[Math.floor(rand() * f.glass.length)]);
  }
  const cell = 32;
  const draw = (glow: boolean) => (c: CanvasRenderingContext2D) => {
    c.fillStyle = glow ? '#000000' : f.wall;
    c.fillRect(0, 0, 256, 256);
    for (let fl = 0; fl < TILE_FLOORS; fl++) {
      if (!glow && f.band) {
        c.fillStyle = f.band;
        c.fillRect(0, fl * cell + cell - 5, 256, 5);
      }
      for (let b = 0; b < TILE_BAYS; b++) {
        const i = fl * TILE_BAYS + b;
        const x = b * cell + (cell - f.winW) / 2;
        const y = fl * cell + (cell - 5 - f.winH) / 2;
        if (glow) {
          if (!lit[i]) continue;
          c.fillStyle = rand() < 0.2 ? '#cfe4ff' : '#ffc777';
        } else {
          c.fillStyle = lit[i] ? '#ffd79a' : shades[i];
        }
        c.fillRect(x, y, f.winW, f.winH);
      }
    }
  };
  const map = canvasTexture(256, 256, draw(false));
  const glowMap = canvasTexture(256, 256, draw(true));
  for (const t of [map, glowMap]) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return { map, glowMap };
}

function rooftop(scores: THREE.Texture): Built {
  const g = new THREE.Group();
  const deckTex = canvasTexture(256, 64, (c) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = `hsl(25, 40%, ${30 + (i % 3) * 4}%)`;
      c.fillRect(0, i * 8, 256, 7);
    }
  });
  deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
  deckTex.repeat.set(4, 20);
  const deck = std('#ffffff', { map: deckTex });
  const dark = std('#120c14', { roughness: 1 });
  const steel = std('#3a2a33', { metalness: 0.6, roughness: 0.4 });

  // The lanes run into a small brick pinsetter house at the far end of the roof. Its front
  // wall carries the sign and the masking units; inside it is dark, like any pit area.
  const ROOF_HALF = WALL_X + 3.2;
  const ROOF_FRONT = FRONT_Z + 3;
  const ROOF_BACK = BACK_Z - 3;
  const DECK_Y = -0.02;
  const HOUSE_HALF = WALL_X + 0.1;
  const HOUSE_FRONT = DECK_END_Z + 0.3; // just behind the sign
  const HOUSE_TOP = 3.6;
  const MASK_TOP = 0.95 + 0.55 / 2;
  const MASK_EDGE = NEIGHBOUR_X + OUTER_HALF + 0.15; // outer end of the neighbours' masking units

  // Decking over the open roof, out to the parapets, just under the lanes. It leaves a gap
  // only for our own gutters and pit, which have their own floors.
  const inner = OUTER_HALF + 0.04;
  const strip = (x1: number, x2: number, z1: number, z2: number, mat: THREE.Material, y = DECK_Y) => {
    for (const side of [-1, 1]) g.add(plane(x2 - x1, z1 - z2, mat, [side * (x1 + x2) / 2, y, (z1 + z2) / 2], [-Math.PI / 2, 0, 0]));
  };
  strip(HOUSE_HALF, ROOF_HALF, ROOF_FRONT, ROOF_BACK, deck);
  strip(inner, HOUSE_HALF, ROOF_FRONT, HOUSE_FRONT, deck);
  strip(inner, HOUSE_HALF, HOUSE_FRONT, ROOF_BACK, dark, -0.012);
  g.add(plane(inner * 2, ROOF_FRONT - 4.5, deck, [0, DECK_Y, (ROOF_FRONT + 4.5) / 2], [-Math.PI / 2, 0, 0]));
  g.add(plane(inner * 2, PIT_END_Z - 0.1 - ROOF_BACK, dark, [0, -0.012, (PIT_END_Z - 0.1 + ROOF_BACK) / 2], [-Math.PI / 2, 0, 0]));

  const brick = brickTexture([12, 42, 30], '#3a2524');
  const brickMat = std('#ffffff', { map: brick, roughness: 0.95 });
  const trim = std('#d9c3a8', { roughness: 0.7 });
  const BW = 0.92;
  const BH = 0.6;
  const wallT = 0.25;
  const houseLen = HOUSE_FRONT - ROOF_BACK;
  const houseMid = (HOUSE_FRONT + ROOF_BACK) / 2;
  // Front wall above the masking units, and down to the roof either side of them
  g.add(tiledBox(HOUSE_HALF * 2, HOUSE_TOP - MASK_TOP, wallT, brickMat, 0, (HOUSE_TOP + MASK_TOP) / 2, HOUSE_FRONT - wallT / 2, BW, BH));
  for (const side of [-1, 1]) {
    const w = HOUSE_HALF - MASK_EDGE;
    g.add(tiledBox(w, MASK_TOP, wallT, brickMat, side * (MASK_EDGE + w / 2), MASK_TOP / 2, HOUSE_FRONT - wallT / 2, BW, BH));
    // Side walls back to the end of the roof
    g.add(tiledBox(wallT, HOUSE_TOP, houseLen, brickMat, side * (HOUSE_HALF - wallT / 2), HOUSE_TOP / 2, houseMid, BW, BH));
  }
  // Dark back wall inside, behind the neighbours' pins, and a dark ceiling over them
  g.add(boxAt(HOUSE_HALF * 2, MASK_TOP, 0.05, dark, 0, MASK_TOP / 2, PIT_END_Z - 0.2));
  g.add(boxAt(HOUSE_HALF * 2, 0.04, HOUSE_FRONT - wallT - (PIT_END_Z - 0.2), dark, 0, 1.28, (HOUSE_FRONT - wallT + PIT_END_Z - 0.2) / 2));
  // Flat roof with a stone coping that overhangs the walls a little
  g.add(boxAt(HOUSE_HALF * 2, 0.1, houseLen, std('#4a3a40'), 0, HOUSE_TOP - 0.05, houseMid));
  g.add(boxAt(HOUSE_HALF * 2 + 0.16, 0.14, 0.34, trim, 0, HOUSE_TOP + 0.07, HOUSE_FRONT - 0.1));
  for (const side of [-1, 1]) g.add(boxAt(0.34, 0.14, houseLen, trim, side * (HOUSE_HALF - 0.1), HOUSE_TOP + 0.07, houseMid));
  // A painted band under the coping, and a sill line where the wall meets the masking units
  g.add(boxAt(HOUSE_HALF * 2 + 0.02, 0.1, 0.02, trim, 0, HOUSE_TOP - 0.25, HOUSE_FRONT + 0.005));
  for (const side of [-1, 1]) g.add(boxAt(HOUSE_HALF - MASK_EDGE + 0.02, 0.08, 0.04, trim, side * (MASK_EDGE + (HOUSE_HALF - MASK_EDGE) / 2), MASK_TOP, HOUSE_FRONT + 0.01));
  // Wall lamps either side of the sign
  const lampGlow = basic('#ffe0a0');
  for (const side of [-1, 1]) {
    const x = side * 2.45;
    g.add(boxAt(0.05, 0.25, 0.08, steel, x, 2.1, HOUSE_FRONT + 0.04));
    g.add(boxAt(0.16, 0.1, 0.22, steel, x, 2.28, HOUSE_FRONT + 0.12));
    g.add(boxAt(0.12, 0.02, 0.16, lampGlow, x, 2.225, HOUSE_FRONT + 0.14));
  }
  // Rooftop kit on the pinsetter house: a timber water tank on legs and an air-con unit
  const timber = std('#6b4a35', { roughness: 0.9 });
  const tankX = -1.6;
  const tankZ = HOUSE_FRONT - 1.6;
  for (const [dx, dz] of [[-0.45, -0.45], [0.45, -0.45], [-0.45, 0.45], [0.45, 0.45]]) {
    g.add(boxAt(0.07, 0.9, 0.07, steel, tankX + dx, HOUSE_TOP + 0.45, tankZ + dz));
  }
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 1.2, 20), timber);
  tank.position.set(tankX, HOUSE_TOP + 1.5, tankZ);
  const tankRoof = new THREE.Mesh(new THREE.ConeGeometry(0.82, 0.45, 20), std('#3a2a2a'));
  tankRoof.position.set(tankX, HOUSE_TOP + 2.32, tankZ);
  g.add(tank, tankRoof);
  for (const y of [0.25, 0.75]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.76, 0.02, 6, 24), steel);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.set(tankX, HOUSE_TOP + 0.9 + y, tankZ);
    g.add(hoop);
  }
  g.add(boxAt(1.1, 0.7, 0.8, std('#9a9aa0', { metalness: 0.3, roughness: 0.5 }), 1.7, HOUSE_TOP + 0.35, HOUSE_FRONT - 1.2));
  const fan = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.02, 16), std('#2a2a30'));
  fan.position.set(1.7, HOUSE_TOP + 0.71, HOUSE_FRONT - 1.2);
  g.add(fan);

  // No ceiling up here: the scoreboard hangs from a slim gantry across the lanes
  const GANTRY_Y = 3.8;
  for (const side of [-1, 1]) g.add(boxAt(0.08, GANTRY_Y, 0.08, steel, side * (WALL_X - 0.2), GANTRY_Y / 2, -1.2));
  g.add(boxAt((WALL_X - 0.2) * 2 + 0.08, 0.08, 0.08, steel, 0, GANTRY_Y, -1.2));
  g.add(scoreMonitor(scores, GANTRY_Y));

  // Low parapet walls around the open roof (the pinsetter house closes the far end), with
  // potted plants
  const concrete = std('#6e5a6a');
  const PARAPET_LEN = ROOF_FRONT - ROOF_BACK;
  for (const side of [-1, 1]) g.add(boxAt(0.25, 1, PARAPET_LEN, concrete, side * ROOF_HALF, 0.5, (ROOF_FRONT + ROOF_BACK) / 2));
  g.add(boxAt(ROOF_HALF * 2, 1, 0.25, concrete, 0, 0.5, ROOF_FRONT));
  g.add(boxAt((ROOF_HALF - HOUSE_HALF), 1, 0.25, concrete, -(ROOF_HALF + HOUSE_HALF) / 2, 0.5, ROOF_BACK));
  g.add(boxAt((ROOF_HALF - HOUSE_HALF), 1, 0.25, concrete, (ROOF_HALF + HOUSE_HALF) / 2, 0.5, ROOF_BACK));
  const coping = std('#8a7684');
  for (const side of [-1, 1]) g.add(boxAt(0.35, 0.06, PARAPET_LEN, coping, side * ROOF_HALF, 1.03, (ROOF_FRONT + ROOF_BACK) / 2));
  g.add(boxAt(ROOF_HALF * 2 + 0.1, 0.06, 0.35, coping, 0, 1.03, ROOF_FRONT));
  const pot = std('#b5653a');
  const leaf = std('#3f8f3a');
  for (const [x, z] of [[-4.6, 7], [4.6, 7], [-4.6, 0], [4.6, 0], [-4.6, -8], [4.6, -8], [2, 10.6], [-2.5, 10.6]]) {
    g.add(boxAt(0.5, 0.5, 0.5, pot, x, 0.25, z));
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), leaf);
    bush.position.set(x, 0.85, z);
    g.add(bush);
  }

  // City skyline all around: towers with storey-sized windows, flat roofs, setbacks, water
  // tanks and masts. Most roofs sit below ours, a few stand taller, so it feels high up.
  const facades = FACADES.map((f, i) => {
    const { map, glowMap } = facadeTextures(f, 17 + i * 31);
    return new THREE.MeshStandardMaterial({ map, emissive: '#ffffff', emissiveMap: glowMap, emissiveIntensity: 0.9, roughness: 0.85 });
  });
  const roofMat = std('#3b3440', { roughness: 1 });
  const kitMat = std('#5a5058', { roughness: 0.9 });
  const tankMat = std('#5e4636', { roughness: 0.9 });
  const beacons: THREE.Vector3[] = [];
  const rand = seeded(11);
  const GROUND = -44;
  const TW = TILE_BAYS * BAY;
  const TH = TILE_FLOORS * FLOOR;
  const tower = (w: number, d: number, bottom: number, top: number, x: number, z: number, side: THREE.Material) => {
    const h = top - bottom;
    // Line the floors up across a building's blocks, and start each on a random tile spot
    const offU = Math.floor(rand() * TILE_BAYS) / TILE_BAYS;
    const offV = (bottom - GROUND) / TH;
    const m = tiledBox(w, h, d, [side, side, roofMat, roofMat, side, side], x, (top + bottom) / 2, z, TW, TH);
    tileBoxUVs(m.geometry as THREE.BoxGeometry, w, h, d, TW, TH, offU, offV);
    m.receiveShadow = false;
    g.add(m);
  };
  for (let i = 0; i < 64; i++) {
    const a = ((i + rand() * 0.6) / 64) * Math.PI * 2;
    const dist = 55 + rand() * 85;
    // Widths and depths in whole window bays, so windows don't get cut at the corners
    const w = BAY * (4 + Math.floor(rand() * 7));
    const d = BAY * (4 + Math.floor(rand() * 7));
    const tall = rand() < 0.18;
    // Whole storeys too: the roof sits on a floor line
    const floors = Math.round(((tall ? 10 + rand() * 30 : -14 + rand() * 20) - GROUND) / FLOOR);
    const top = GROUND + floors * FLOOR;
    const x = Math.sin(a) * dist;
    const z = -Math.cos(a) * dist - 10;
    const side = facades[Math.floor(rand() * facades.length)];
    tower(w, d, GROUND, top, x, z, side);
    let roof = top;
    if (tall && rand() < 0.7) {
      // A setback crown on the tall ones
      const sw = Math.max(BAY * 2, w - BAY * 2);
      const sd = Math.max(BAY * 2, d - BAY * 2);
      const extra = FLOOR * (2 + Math.floor(rand() * 5));
      tower(sw, sd, top, top + extra, x, z, side);
      roof = top + extra;
    }
    if (tall && rand() < 0.6) {
      const mast = boxAt(0.4, 8, 0.4, kitMat, x, roof + 4, z);
      g.add(mast);
      beacons.push(new THREE.Vector3(x, roof + 8.2, z));
    } else if (rand() < 0.5) {
      // Water tank or plant room on the roof
      const tx = x + (rand() - 0.5) * (w - 4);
      const tz = z + (rand() - 0.5) * (d - 4);
      if (rand() < 0.5) {
        const t = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 3, 12), tankMat);
        t.position.set(tx, roof + 3.2, tz);
        const legs = boxAt(2.4, 1.7, 2.4, kitMat, tx, roof + 0.85, tz);
        g.add(t, legs);
      } else {
        g.add(boxAt(3 + rand() * 3, 2.5, 3 + rand() * 3, kitMat, tx, roof + 1.25, tz));
      }
    }
  }
  // Red aviation beacons on the masts, blinking together
  const beaconMat = basic('#ff3a2a');
  const beaconMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.45, 8, 6), beaconMat, Math.max(1, beacons.length));
  const bm = new THREE.Matrix4();
  beacons.forEach((b, i) => beaconMesh.setMatrixAt(i, bm.makeTranslation(b.x, b.y, b.z)));
  beaconMesh.count = beacons.length;
  g.add(beaconMesh);

  // The setting sun
  const sun = new THREE.Mesh(new THREE.CircleGeometry(9, 48), basic('#ffb35c'));
  sun.position.set(-18, 4, -140);
  g.add(sun);

  // Festoon string lights criss-crossing above the lanes
  const bulbs: THREE.Vector3[] = [];
  const wire: number[] = [];
  for (let z = 4; z > DECK_END_Z; z -= 3) {
    for (let k = 0; k <= 22; k++) {
      const x = -WALL_X + (k / 22) * WALL_X * 2;
      const y = 3.3 - 0.55 * (1 - Math.pow(x / WALL_X, 2));
      bulbs.push(new THREE.Vector3(x, y - 0.06, z));
      if (k > 0) wire.push(bulbs[bulbs.length - 2].x, bulbs[bulbs.length - 2].y + 0.06, z, x, y, z);
    }
  }
  const bulbMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 10, 8), basic('#ffe2a6'), bulbs.length);
  const m = new THREE.Matrix4();
  bulbs.forEach((b, i) => bulbMesh.setMatrixAt(i, m.makeTranslation(b.x, b.y, b.z)));
  g.add(bulbMesh);
  const wireGeo = new THREE.BufferGeometry();
  wireGeo.setAttribute('position', new THREE.Float32BufferAttribute(wire, 3));
  g.add(new THREE.LineSegments(wireGeo, new THREE.LineBasicMaterial({ color: '#2a1c1c' })));
  // Posts holding the lights up
  for (let z = 4; z > DECK_END_Z; z -= 6) for (const side of [-1, 1]) g.add(boxAt(0.08, 3.4, 0.08, std('#3a2a2a'), side * WALL_X, 1.7, z));

  signage(g, 'ROOFTOP ROLL', '★ SUNSET SESSION ★', '#ffb347', '#ff6f91', 'LANE 1', '#ff8a4c', '#c8406a', '#ffd23a', '#ffe08a');

  const sky = canvasTexture(16, 512, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#1d1b4a');
    grd.addColorStop(0.45, '#7a3f8e');
    grd.addColorStop(0.75, '#ff7a59');
    grd.addColorStop(1, '#ffc46b');
    c.fillStyle = grd;
    c.fillRect(0, 0, 16, 512);
  });

  return {
    group: g,
    update: (t) => {
      // Bulbs flicker gently
      (bulbMesh.material as THREE.MeshBasicMaterial).color.setHSL(0.11, 1, 0.8 + Math.sin(t * 3) * 0.03);
      // Aviation beacons: a short red flash every 1.5 s
      beaconMat.color.set(t % 1.5 < 0.35 ? '#ff3a2a' : '#3a0a08');
    },
    apply: (scene, l) => {
      scene.background = sky;
      scene.fog = new THREE.Fog('#d77a6a', 30, 175);
      l.hemi.color.set('#ffc28a');
      l.hemi.groundColor.set('#40284a');
      l.hemi.intensity = 1.25;
      l.key.color.set('#ffd2a0');
      l.key.intensity = 1.7;
      l.fill.color.set('#ff9a7a');
    },
  };
}

// ---------------------------------------------------------------- The Golden Pin
function golden(scores: THREE.Texture): Built {
  const g = new THREE.Group();
  const gold = std('#d4a017', { metalness: 0.85, roughness: 0.28 });
  // Red velvet walls with a gold rail and wainscot
  const velvet = canvasTexture(512, 512, (c) => {
    const grd = c.createLinearGradient(0, 0, 0, 512);
    grd.addColorStop(0, '#3a0a0e');
    grd.addColorStop(0.55, '#6e1018');
    grd.addColorStop(0.7, '#4a0a10');
    c.fillStyle = grd;
    c.fillRect(0, 0, 512, 512);
    // Velvet pile: soft vertical folds
    for (let x = 0; x < 512; x += 16) {
      c.fillStyle = `rgba(0, 0, 0, ${0.08 + 0.08 * Math.sin(x / 9)})`;
      c.fillRect(x, 0, 8, 512);
    }
    c.fillStyle = '#d4a017';
    c.fillRect(0, 352, 512, 10);
    c.fillStyle = '#2a0608';
    c.fillRect(0, 362, 512, 150);
    c.fillStyle = '#b8860f';
    for (let x = 16; x < 512; x += 64) c.fillRect(x, 380, 32, 112);
  });
  velvet.wrapS = THREE.RepeatWrapping;
  velvet.repeat.set(8, 1);
  // Coffered ceiling: dark panels framed in gold
  const coffers = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#c99a1e';
    c.fillRect(0, 0, 256, 256);
    c.fillStyle = '#2a0a12';
    c.fillRect(14, 14, 228, 228);
    c.strokeStyle = '#8a6a12';
    c.lineWidth = 6;
    c.strokeRect(34, 34, 188, 188);
  });
  coffers.wrapS = coffers.wrapT = THREE.RepeatWrapping;
  coffers.repeat.set(4, 20);
  // Red carpet with a gold diamond pattern
  const rug = canvasTexture(256, 256, (c) => {
    c.fillStyle = '#7a1018';
    c.fillRect(0, 0, 256, 256);
    c.strokeStyle = '#d4a017';
    c.lineWidth = 4;
    for (let i = -256; i < 512; i += 64) {
      c.beginPath();
      c.moveTo(i, 0);
      c.lineTo(i + 256, 256);
      c.moveTo(i + 256, 0);
      c.lineTo(i, 256);
      c.stroke();
    }
  });
  rug.wrapS = rug.wrapT = THREE.RepeatWrapping;
  rug.repeat.set(4, 10);
  room(g, std('#ffffff', { map: velvet, roughness: 0.95 }), std('#ffffff', { map: coffers, roughness: 0.6 }), std('#ffffff', { map: velvet, roughness: 0.95 }), std('#ffffff', { map: rug, roughness: 0.95 }));
  signage(g, 'THE GOLDEN PIN', '★ INVITATIONAL ★', '#ffd23a', '#fff4e6', 'LANE 1', '#d4a017', '#8a6a12', '#7a1018', '#fff1b0');
  laneGlow(g, '#ffd23a');
  g.add(scoreMonitor(scores, CEIL_Y));

  // Gold columns down both walls
  const columnGeo = new THREE.CylinderGeometry(0.14, 0.16, CEIL_Y, 18);
  for (let z = 6; z > BACK_Z + 1; z -= 3.2) {
    for (const side of [-1, 1]) {
      const col = new THREE.Mesh(columnGeo, gold);
      col.position.set(side * (WALL_X - 0.16), CEIL_Y / 2, z);
      g.add(col);
    }
  }

  // A giant golden pin on the back wall, above the sign
  const pinPts = PIN_PROFILE.map(([r, y]) => new THREE.Vector2(r * 4, y * 4));
  const trophy = new THREE.Mesh(new THREE.LatheGeometry(new THREE.SplineCurve(pinPts).getPoints(40), 32), gold);
  trophy.position.set(0, 2.25, BACK_Z + 0.4);
  g.add(trophy);

  // Chandeliers: gold rings hung with glowing bulbs
  const bulb = basic('#fff1c4');
  const bulbGeo = new THREE.SphereGeometry(0.045, 10, 8);
  const chandeliers = [-3, -9, -15].map((z) => {
    const c = new THREE.Group();
    c.position.set(0, CEIL_Y - 0.9, z);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.025, 8, 40), gold);
    ring.rotation.x = Math.PI / 2;
    c.add(ring, boxAt(0.02, 0.9, 0.02, gold, 0, 0.45, 0));
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      const b = new THREE.Mesh(bulbGeo, bulb);
      b.position.set(Math.cos(a) * 0.45, 0.05, Math.sin(a) * 0.45);
      c.add(b);
    }
    g.add(c);
    return c;
  });
  const glow = new THREE.PointLight('#ffd89a', 6, 9, 1.6);
  glow.position.set(0, CEIL_Y - 1, -9);
  g.add(glow);

  return {
    group: g,
    update: (t) => {
      // A gentle sway, as if a door had just opened somewhere
      chandeliers.forEach((c, i) => (c.rotation.z = Math.sin(t * 0.6 + i) * 0.02));
      trophy.rotation.y = t * 0.3;
    },
    apply: (scene, l) => {
      scene.background = new THREE.Color('#1a0608');
      scene.fog = new THREE.Fog('#1a0608', 20, 42);
      l.hemi.color.set('#ffe2b0');
      l.hemi.groundColor.set('#3a0a0e');
      l.hemi.intensity = 1.0;
      l.key.color.set('#fff0d0');
      l.key.intensity = 1.6;
      l.fill.color.set('#ffcf8a');
    },
  };
}

// ---------------------------------------------------------------- MEM
// The IT engineers' den: a damp basement alley lined with grubby computer desks, dead
// hardware piled everywhere and skips dumped on the neighbouring lanes. Nobody wants to be
// here; the engineers are here anyway.

/** Merges a group's static meshes into one mesh per material, so hundreds of props cost a handful of draw calls. */
function bake(src: THREE.Object3D): THREE.Group {
  src.updateMatrixWorld(true);
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  src.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    let geo = (o.geometry as THREE.BufferGeometry).clone().applyMatrix4(o.matrixWorld);
    if (geo.index) geo = geo.toNonIndexed();
    for (const name of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(name)) geo.deleteAttribute(name);
    const mat = o.material as THREE.Material;
    byMat.set(mat, [...(byMat.get(mat) ?? []), geo]);
  });
  const out = new THREE.Group();
  for (const [mat, geos] of byMat) {
    const mesh = new THREE.Mesh(mergeGeometries(geos), mat);
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

/** A small screen picture for the old monitors (256 × 192). */
function screenTexture(draw: (c: CanvasRenderingContext2D) => void) {
  return canvasTexture(256, 192, (c) => {
    draw(c);
    // Scanlines and a dusty vignette
    c.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let y = 0; y < 192; y += 3) c.fillRect(0, y, 256, 1);
    const v = c.createRadialGradient(128, 96, 40, 128, 96, 160);
    v.addColorStop(0, 'rgba(0, 0, 0, 0)');
    v.addColorStop(1, 'rgba(20, 18, 8, 0.65)');
    c.fillStyle = v;
    c.fillRect(0, 0, 256, 192);
  });
}

function textLines(c: CanvasRenderingContext2D, lines: string[], colour: string, x: number, y: number, size: number, gap: number) {
  c.fillStyle = colour;
  c.font = `${size}px "Courier New", monospace`;
  lines.forEach((l, i) => c.fillText(l, x, y + i * gap));
}

/** A paper notice taped to the wall. */
function notice(lines: string[], ink: string, paper = '#d9d0ad') {
  return canvasTexture(256, 320, (c) => {
    c.fillStyle = paper;
    c.fillRect(0, 0, 256, 320);
    // Damp, curling and sun-faded
    const stain = c.createRadialGradient(200, 270, 5, 200, 270, 120);
    stain.addColorStop(0, 'rgba(120, 90, 30, 0.45)');
    stain.addColorStop(1, 'rgba(120, 90, 30, 0)');
    c.fillStyle = stain;
    c.fillRect(0, 0, 256, 320);
    c.fillStyle = 'rgba(230, 230, 200, 0.55)';
    for (const [x, y] of [[-6, -6], [222, -6], [-6, 296], [222, 296]]) c.fillRect(x, y, 40, 30); // tape
    c.fillStyle = ink;
    c.textAlign = 'center';
    let size = 46;
    c.font = `900 ${size}px "Arial Black", "Trebuchet MS", sans-serif`;
    const widest = Math.max(...lines.map((l) => c.measureText(l).width));
    size = Math.min(46, Math.floor((46 * 220) / widest));
    c.font = `900 ${size}px "Arial Black", "Trebuchet MS", sans-serif`;
    const top = 160 - ((lines.length - 1) * size * 1.15) / 2 + size / 3;
    lines.forEach((l, i) => c.fillText(l, 128, top + i * size * 1.15));
  });
}

/** A skip: a steel bin that flares out at the top, with sloped ends. Origin on the floor. */
function skipBody(w: number, h: number, d: number) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    if (p.getY(i) > 0) {
      p.setX(i, p.getX(i) * 1.06);
      p.setZ(i, p.getZ(i) * 1.35);
    }
  }
  geo.translate(0, h / 2, 0);
  geo.computeVertexNormals();
  return geo;
}

function mem(scores: THREE.Texture): Built {
  const g = new THREE.Group();
  const props = new THREE.Group(); // everything that never moves, baked at the end
  const rand = seeded(404);
  const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];

  // ---- The room: breeze blocks painted a sickly yellow-green, damp coming through ----
  const wallTex = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#7c7752';
    c.fillRect(0, 0, 512, 512);
    // Breeze-block courses
    c.strokeStyle = 'rgba(40, 38, 22, 0.45)';
    c.lineWidth = 2;
    for (let row = 0; row < 16; row++) {
      const y = row * 32;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(512, y);
      c.stroke();
      for (let x = (row % 2) * 64; x < 512; x += 128) {
        c.beginPath();
        c.moveTo(x, y);
        c.lineTo(x, y + 32);
        c.stroke();
      }
    }
    // Damp streaks running down from the ceiling
    for (let i = 0; i < 9; i++) {
      const x = 20 + rand() * 470;
      const w = 12 + rand() * 40;
      const len = 120 + rand() * 260;
      const grd = c.createLinearGradient(0, 0, 0, len);
      grd.addColorStop(0, 'rgba(60, 50, 20, 0.6)');
      grd.addColorStop(1, 'rgba(60, 50, 20, 0)');
      c.fillStyle = grd;
      c.fillRect(x, 0, w, len);
    }
    // Black mould blooms in the top corners
    for (let i = 0; i < 6; i++) {
      const x = rand() * 512;
      const y = rand() * 90;
      const r = 20 + rand() * 50;
      const m = c.createRadialGradient(x, y, 2, x, y, r);
      m.addColorStop(0, 'rgba(18, 22, 10, 0.75)');
      m.addColorStop(1, 'rgba(18, 22, 10, 0)');
      c.fillStyle = m;
      c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    // Peeling paint: patches of the grey block underneath
    for (let i = 0; i < 5; i++) {
      const x = rand() * 512;
      const y = 140 + rand() * 210;
      const r = 10 + rand() * 14;
      let ang = 0;
      let rad = r;
      c.fillStyle = 'rgba(118, 116, 104, 0.85)';
      c.beginPath();
      for (let k = 0; k < 24; k++) {
        ang = (k / 24) * Math.PI * 2;
        rad = Math.max(r * 0.5, Math.min(r * 1.5, rad + (rand() - 0.5) * r * 0.5)); // ragged, not starry
        c.lineTo(x + Math.cos(ang) * rad * 1.5, y + Math.sin(ang) * rad);
      }
      c.fill();
      // The curled edge of the paint, catching a little light
      c.strokeStyle = 'rgba(160, 156, 112, 0.6)';
      c.lineWidth = 1.5;
      c.stroke();
    }
    // A scuffed brown dado below waist height, and grime creeping up from the floor
    c.fillStyle = '#3e3a28';
    c.fillRect(0, 400, 512, 112);
    c.fillStyle = '#2a271a';
    c.fillRect(0, 396, 512, 6);
    const grime = c.createLinearGradient(0, 330, 0, 512);
    grime.addColorStop(0, 'rgba(25, 22, 10, 0)');
    grime.addColorStop(1, 'rgba(25, 22, 10, 0.7)');
    c.fillStyle = grime;
    c.fillRect(0, 330, 512, 182);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = `rgba(20, 18, 8, ${0.2 + rand() * 0.3})`;
      c.fillRect(rand() * 512, 404 + rand() * 100, 4 + rand() * 30, 2 + rand() * 4);
    }
  });
  wallTex.wrapS = THREE.RepeatWrapping;
  wallTex.repeat.set(ROOM_LEN / CEIL_Y, 1);
  const endTex = wallTex.clone();
  endTex.repeat.set((WALL_X * 2) / CEIL_Y, 1);
  endTex.needsUpdate = true;

  // Suspended ceiling: stained tiles, a few missing (8 × 8 tiles of 0.6 m per repeat)
  const ceilTex = canvasTexture(512, 512, (c) => {
    c.fillStyle = '#9a9478';
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
      const r = rand();
      if (r < 0.07) {
        c.fillStyle = '#0c0b07'; // missing tile: just the dark void and some cables
        c.fillRect(i * 64, j * 64, 64, 64);
        c.strokeStyle = '#3a3a30';
        c.lineWidth = 3;
        c.beginPath();
        c.moveTo(i * 64, j * 64 + 20 + rand() * 30);
        c.quadraticCurveTo(i * 64 + 32, j * 64 + 60, i * 64 + 64, j * 64 + 10 + rand() * 40);
        c.stroke();
        continue;
      }
      if (r < 0.45) {
        // Water stain rings
        const x = i * 64 + 16 + rand() * 32;
        const y = j * 64 + 16 + rand() * 32;
        const s = c.createRadialGradient(x, y, 2, x, y, 18 + rand() * 26);
        s.addColorStop(0, 'rgba(110, 80, 30, 0.55)');
        s.addColorStop(0.8, 'rgba(90, 60, 20, 0.35)');
        s.addColorStop(1, 'rgba(90, 60, 20, 0)');
        c.fillStyle = s;
        c.fillRect(i * 64, j * 64, 64, 64);
      }
      // Speckled tile texture
      c.fillStyle = 'rgba(60, 58, 44, 0.25)';
      for (let k = 0; k < 30; k++) c.fillRect(i * 64 + rand() * 64, j * 64 + rand() * 64, 2, 2);
    }
    c.strokeStyle = '#4a4636';
    c.lineWidth = 4;
    for (let k = 0; k <= 512; k += 64) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k, 512);
      c.moveTo(0, k);
      c.lineTo(512, k);
      c.stroke();
    }
  });
  ceilTex.wrapS = ceilTex.wrapT = THREE.RepeatWrapping;
  ceilTex.repeat.set((WALL_X * 2) / 4.8, ROOM_LEN / 4.8);

  // Mismatched, stained carpet tiles
  const floorTex = canvasTexture(256, 256, (c) => {
    const greys = ['#4a4838', '#3e3d30', '#55513c', '#46402e', '#3a3b34'];
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      c.fillStyle = pick(greys);
      c.fillRect(i * 64, j * 64, 64, 64);
      c.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let k = 0; k < 60; k++) c.fillRect(i * 64 + rand() * 64, j * 64 + rand() * 64, 2, 2);
    }
    for (let k = 0; k < 5; k++) {
      const x = rand() * 256;
      const y = rand() * 256;
      const s = c.createRadialGradient(x, y, 2, x, y, 14 + rand() * 24);
      s.addColorStop(0, 'rgba(40, 24, 8, 0.7)'); // coffee, mostly
      s.addColorStop(1, 'rgba(40, 24, 8, 0)');
      c.fillStyle = s;
      c.fillRect(x - 40, y - 40, 80, 80);
    }
    c.strokeStyle = 'rgba(15, 14, 8, 0.6)';
    c.lineWidth = 2;
    for (let k = 0; k <= 256; k += 64) {
      c.beginPath();
      c.moveTo(k, 0);
      c.lineTo(k, 256);
      c.moveTo(0, k);
      c.lineTo(256, k);
      c.stroke();
    }
  });
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(5, 18);
  room(
    g,
    std('#ffffff', { map: wallTex, roughness: 0.95 }),
    std('#ffffff', { map: ceilTex, roughness: 1 }),
    std('#ffffff', { map: endTex, roughness: 0.95 }),
    std('#ffffff', { map: floorTex, roughness: 1 }),
  );
  // A rotten-tomato emblem on a nicotine-stained panel; the sign has seen better days
  const { sign } = signage(g, 'MEM', '★ OUT OF MEMORY ★', '#a6ff3a', '#ffb02e', 'LANE 0', '#6e6a4c', '#3a3826', '#8a5a1c', '#7a4a26');
  const signMat = sign.material as THREE.MeshBasicMaterial;
  g.add(scoreMonitor(scores, CEIL_Y));

  // ---- Shared props ----
  const beige = std('#c4b78e', { roughness: 0.7 });
  const beigeDirty = std('#a39570', { roughness: 0.8 });
  const darkPlastic = std('#2b2a26', { roughness: 0.6 });
  const metal = std('#5d5c52', { metalness: 0.5, roughness: 0.6 });
  const rust = std('#6a3c1e', { roughness: 1 });
  const laminate = std('#5e5040', { roughness: 0.85 });
  const fabric = std('#2f3640', { roughness: 1 });
  const cardboard = std('#9a7448', { roughness: 1 });
  const paper = std('#d4ccb0', { roughness: 1 });
  const mug = std('#d8d2c0', { roughness: 0.5 });
  const can = std('#4caa2c', { metalness: 0.6, roughness: 0.35 });
  const cable = std('#1c1c1a', { roughness: 0.7 });
  const cableColours = [cable, std('#2a4a8a'), std('#c8b42a'), std('#7a7a72')];

  // Monitor pictures: every crash an engineer has ever seen. Each kind flickers on its own.
  const screens = [
    screenTexture((c) => {
      c.fillStyle = '#031006';
      c.fillRect(0, 0, 256, 192);
      textLines(c, ['$ make', 'cc -O2 tomato.c', 'Segmentation fault', '  (core dumped)', '$ make', 'Segmentation fault', '$ _'], '#46e86a', 12, 26, 17, 24);
    }),
    screenTexture((c) => {
      c.fillStyle = '#1a2fa8';
      c.fillRect(0, 0, 256, 192);
      textLines(c, ['FATAL EXCEPTION', '', 'MEMORY_NOT_FOUND', 'at 0x000DAVE', '', 'press any key', '(there is no key)'], '#e8ecff', 12, 28, 16, 22);
    }),
    screenTexture((c) => {
      c.fillStyle = '#050505';
      c.fillRect(0, 0, 256, 192);
      c.strokeStyle = '#9a9a9a';
      c.lineWidth = 3;
      c.strokeRect(58, 72, 140, 48);
      textLines(c, ['NO SIGNAL'], '#c8c8c8', 78, 103, 20, 0);
    }),
    screenTexture((c) => {
      c.fillStyle = '#4a6a6a';
      c.fillRect(0, 0, 256, 192);
      c.fillStyle = '#c8c4b8';
      c.fillRect(30, 40, 196, 112);
      c.fillStyle = '#20206a';
      c.fillRect(30, 40, 196, 20);
      textLines(c, ['Error'], '#ffffff', 36, 55, 14, 0);
      textLines(c, ['Out of memory.', 'Close some', 'programs?'], '#111111', 44, 84, 15, 18);
      c.strokeStyle = '#111';
      c.strokeRect(160, 124, 52, 20);
      textLines(c, ['OK'], '#111111', 176, 139, 14, 0);
    }),
    screenTexture((c) => {
      c.fillStyle = '#0d0a02';
      c.fillRect(0, 0, 256, 192);
      textLines(c, ['TICKET QUEUE', '', 'OPEN:    4,096', 'URGENT:  4,095', 'CLOSED:      0', '', 'ON CALL: YOU'], '#ffb000', 14, 28, 17, 23);
    }),
    screenTexture((c) => {
      const img = c.createImageData(256, 192);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.random() * 180;
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      c.putImageData(img, 0, 0);
    }),
  ].map((map) => new THREE.MeshBasicMaterial({ map, toneMapped: false }));
  const deadScreen = std('#0d0f0c', { roughness: 0.2, metalness: 0.3 });
  const screenGeo = new THREE.PlaneGeometry(0.31, 0.24);

  /** A chunky old CRT monitor, front facing +z, sitting on y = 0. */
  const crt = (screen: THREE.Material, body = beige) => {
    const m = new THREE.Group();
    m.add(boxAt(0.4, 0.34, 0.3, body, 0, 0.19, 0));
    m.add(boxAt(0.3, 0.26, 0.22, body, 0, 0.18, -0.25));
    m.add(boxAt(0.2, 0.03, 0.2, body, 0, 0.015, -0.05));
    const s = new THREE.Mesh(screenGeo, screen);
    s.position.set(0, 0.2, 0.152);
    m.add(s);
    return m;
  };
  /** A beige tower PC, front facing +z. */
  const tower = (body = beige) => {
    const t = new THREE.Group();
    t.add(boxAt(0.19, 0.42, 0.44, body, 0, 0.21, 0));
    t.add(boxAt(0.13, 0.035, 0.01, darkPlastic, 0, 0.34, 0.222));
    t.add(boxAt(0.13, 0.035, 0.01, darkPlastic, 0, 0.29, 0.222));
    return t;
  };
  const keyboard = () => boxAt(0.44, 0.03, 0.15, beigeDirty, 0, 0.015, 0);
  /** An office chair facing +z; `tipped` lays it on its side. */
  const chair = (tipped: boolean) => {
    const c = new THREE.Group();
    c.add(boxAt(0.46, 0.08, 0.44, fabric, 0, 0.47, 0));
    c.add(boxAt(0.42, 0.5, 0.06, fabric, 0, 0.8, -0.22));
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.4, 8), metal);
    pole.position.y = 0.24;
    c.add(pole);
    for (const a of [0, Math.PI / 2.5, (2 * Math.PI) / 2.5, (3 * Math.PI) / 2.5, (4 * Math.PI) / 2.5]) {
      const leg = boxAt(0.3, 0.03, 0.04, darkPlastic, Math.cos(a) * 0.15, 0.04, Math.sin(a) * 0.15);
      leg.rotation.y = -a;
      c.add(leg);
    }
    if (tipped) {
      const wrap = new THREE.Group();
      c.rotation.z = Math.PI / 2;
      c.position.set(0.47, 0.23, 0);
      wrap.add(c);
      return wrap;
    }
    return c;
  };
  const cylAt = (r: number, h: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 12), mat);
    m.position.set(x, y + h / 2, z);
    return m;
  };
  /** A tangle of cable lying on the floor (or wherever it's dropped). */
  const tangle = (x: number, y: number, z: number, size: number, loops = 6) => {
    const t = new THREE.Group();
    for (let k = 0; k < loops; k++) {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i < 7; i++) pts.push(new THREE.Vector3((rand() - 0.5) * size, rand() * size * 0.35, (rand() - 0.5) * size));
      const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts, true), 40, 0.012, 5, true), pick(cableColours));
      t.add(tube);
    }
    t.position.set(x, y, z);
    return t;
  };
  /** Old hardware for the piles and the skips: a random CRT, tower, keyboard, printer or box. */
  const junk = () => {
    const r = rand();
    if (r < 0.3) return crt(rand() < 0.5 ? deadScreen : screens[5], rand() < 0.5 ? beige : beigeDirty);
    if (r < 0.5) return tower(rand() < 0.5 ? beige : beigeDirty);
    if (r < 0.62) return keyboard();
    if (r < 0.75) {
      const p = new THREE.Group(); // a laser printer that never worked
      p.add(boxAt(0.42, 0.24, 0.38, beigeDirty, 0, 0.12, 0), boxAt(0.3, 0.02, 0.2, paper, 0, 0.25, 0.04));
      return p;
    }
    if (r < 0.88) {
      const b = new THREE.Group();
      b.add(boxAt(0.4, 0.3, 0.32, cardboard, 0, 0.15, 0));
      return b;
    }
    const rack = new THREE.Group(); // a 1U server, pulled out and abandoned
    rack.add(boxAt(0.48, 0.05, 0.5, metal, 0, 0.025, 0));
    return rack;
  };
  const scatter = (o: THREE.Object3D, x: number, y: number, z: number, tilt = 0.5) => {
    o.position.set(x, y, z);
    o.rotation.set((rand() - 0.5) * tilt, rand() * Math.PI * 2, (rand() - 0.5) * tilt);
    return o;
  };

  // ---- Skips: two dumped on the neighbouring lanes, two in the corners behind the bowler ----
  const skipTex = canvasTexture(256, 128, (c) => {
    c.fillStyle = '#c4961a';
    c.fillRect(0, 0, 256, 128);
    for (let i = 0; i < 26; i++) {
      // Rust bleeding down from the rim and dents
      const x = rand() * 256;
      const grd = c.createLinearGradient(0, 0, 0, 40 + rand() * 80);
      grd.addColorStop(0, 'rgba(110, 50, 15, 0.8)');
      grd.addColorStop(1, 'rgba(110, 50, 15, 0)');
      c.fillStyle = grd;
      c.fillRect(x, 0, 3 + rand() * 12, 128);
    }
    c.fillStyle = 'rgba(30, 24, 10, 0.4)';
    c.fillRect(0, 100, 256, 28);
    c.fillStyle = '#1e1a10';
    c.font = '900 26px "Arial Black", sans-serif';
    c.textAlign = 'center';
    c.fillText('NO HOT ASHES', 128, 70);
  });
  const skipMat = std('#ffffff', { map: skipTex, metalness: 0.3, roughness: 0.75 });
  const skip = (x: number, z: number, turn: number, len: number) => {
    const s = new THREE.Group();
    const w = 1.0;
    const h = 0.8;
    s.add(new THREE.Mesh(skipBody(w, h, len), skipMat));
    // Rim and the lugs the lorry lifts it by
    s.add(boxAt(w * 1.06 + 0.06, 0.06, 0.05, rust, 0, h, (len * 1.35) / 2));
    s.add(boxAt(w * 1.06 + 0.06, 0.06, 0.05, rust, 0, h, (-len * 1.35) / 2));
    for (const side of [-1, 1]) {
      s.add(boxAt(0.05, 0.06, len * 1.35, rust, (side * w * 1.06) / 2, h, 0));
      s.add(boxAt(0.08, 0.14, 0.08, rust, (side * w) / 2 + side * 0.03, 0.55, 0));
    }
    // Filled to overflowing
    s.add(boxAt(w, 0.02, len * 1.25, std('#26231a', { roughness: 1 }), 0, h - 0.06, 0));
    const count = Math.round(len * 5);
    for (let k = 0; k < count; k++) s.add(scatter(junk(), (rand() - 0.5) * (w - 0.3), h - 0.12 + rand() * 0.25, (rand() - 0.5) * (len * 1.2 - 0.3), 1.6));
    s.add(tangle(0, h, 0, 0.6, 4));
    s.position.set(x, 0, z);
    s.rotation.y = turn;
    props.add(s);
  };
  const SKIP_GAPS: Record<number, number> = { [-1]: -6.6, [1]: -11.2 };
  skip(-(WALL_X - 0.62), SKIP_GAPS[-1], 0.04, 2.0);
  skip(WALL_X - 0.62, SKIP_GAPS[1], -0.05, 2.0);
  skip(-2.15, 7.45, Math.PI / 2 + 0.06, 1.5);
  skip(2.2, 7.35, Math.PI / 2 - 0.08, 1.5);

  // ---- Computer desks down both walls ----
  for (const side of [-1, 1]) {
    for (let z = 3.7; z > -16.8; z -= 1.55) {
      if (Math.abs(z - SKIP_GAPS[side]) < 1.9) continue;
      const desk = new THREE.Group();
      // Desk-local frame: +z points away from the wall (towards the lanes), x runs along the wall
      desk.add(boxAt(1.4, 0.04, 0.66, laminate, 0, 0.72, 0.33));
      for (const end of [-0.67, 0.67]) desk.add(boxAt(0.03, 0.7, 0.62, laminate, end, 0.35, 0.33));
      desk.add(boxAt(1.3, 0.4, 0.02, laminate, 0, 0.45, 0.04));
      // One or two monitors, facing the chair (and us)
      const two = rand() < 0.35;
      const screenFor = () => (rand() < 0.2 ? deadScreen : pick(screens.slice(0, 5)));
      for (const off of two ? [-0.33, 0.3] : [(rand() - 0.5) * 0.4]) {
        const m = crt(screenFor(), rand() < 0.6 ? beige : beigeDirty);
        m.position.set(off, 0.74, 0.27);
        m.rotation.y = (rand() - 0.5) * 0.4;
        desk.add(m);
      }
      const kb = keyboard();
      kb.position.set((rand() - 0.5) * 0.2, 0.74, 0.54);
      kb.rotation.y = (rand() - 0.5) * 0.3;
      desk.add(kb);
      // Tower on the floor beside the desk, or on the desk
      const tw = tower(rand() < 0.5 ? beige : beigeDirty);
      if (rand() < 0.7) tw.position.set(0.45, 0, 0.3);
      else tw.position.set(0.55, 0.74, 0.25);
      tw.rotation.y = (rand() - 0.5) * 0.3;
      desk.add(tw);
      // Clutter: cold coffee, energy drinks, pizza boxes, paperwork that will never be filed
      for (let k = 0; k < 2 + Math.floor(rand() * 3); k++) {
        const x = (rand() - 0.5) * 1.2;
        const zz = 0.45 + rand() * 0.18;
        const r = rand();
        if (r < 0.35) desk.add(cylAt(0.04, 0.09, mug, x, 0.74, zz));
        else if (r < 0.65) {
          const c = cylAt(0.033, 0.12, can, x, 0.74, zz);
          if (rand() < 0.4) {
            c.rotation.z = Math.PI / 2; // empty, knocked over
            c.position.y = 0.775;
          }
          desk.add(c);
        } else if (r < 0.85) {
          for (let p = 0; p < 1 + Math.floor(rand() * 4); p++) {
            const b = boxAt(0.36, 0.04, 0.36, cardboard, x * 0.5, 0.76 + p * 0.042, 0.4);
            b.rotation.y = (rand() - 0.5) * 0.4;
            desk.add(b);
          }
        } else desk.add(boxAt(0.22, 0.03 + rand() * 0.12, 0.3, paper, x, 0.74 + 0.03, 0.4));
      }
      // Cables spilling down the back of the desk
      if (rand() < 0.6) desk.add(tangle((rand() - 0.5) * 0.8, 0.02, 0.15, 0.5, 3));
      // The chair, pushed back or knocked over (sometimes long gone)
      const r = rand();
      if (r < 0.85) {
        const ch = chair(r < 0.22);
        ch.position.set((rand() - 0.5) * 0.4, 0, 0.95 + rand() * 0.15);
        ch.rotation.y += Math.PI + (rand() - 0.5) * 0.9; // facing the desk
        desk.add(ch);
      }
      desk.position.set(side * WALL_X, 0, z);
      desk.rotation.y = -side * (Math.PI / 2);
      props.add(desk);
    }
  }

  // ---- Notices taped to the walls above the desks ----
  const notices: [string[], string, number][] = [
    [['HAVE YOU', 'TRIED TURNING', 'IT OFF AND', 'ON AGAIN?'], '#1e1a10', 2.7],
    [['RTFM'], '#8a1a10', -1.9],
    [["IT'S", 'ALWAYS', 'DNS'], '#1e1a10', -5.2],
    [['DO NOT', 'UNPLUG', '(PROD)'], '#a01810', -9.6],
    [['CHANGE', 'FREEZE', 'IN EFFECT'], '#1a2a6a', -13.4],
    [['WORKS ON', 'MY MACHINE'], '#1e1a10', 0.6],
    [['ON CALL', 'ROTA:', 'YOU', 'YOU', 'YOU'], '#1e1a10', -3.9],
    [['WHO TOOK', 'MY MUG?'], '#8a1a10', -8.0],
    [['BACKUPS', 'TESTED:', 'NEVER'], '#1e1a10', -14.6],
  ];
  notices.forEach(([lines, ink, z], i) => {
    const side = i % 2 ? 1 : -1;
    const p = plane(0.5, 0.62, std('#ffffff', { map: notice(lines, ink), roughness: 1 }), [side * (WALL_X - 0.012), 1.75 + rand() * 0.5, z], [0, -side * (Math.PI / 2), 0]);
    p.rotation.z = (rand() - 0.5) * 0.25;
    props.add(p);
  });

  // ---- Old hardware piled up behind the bowler ----
  // Towers of dead CRTs against the back wall, between the skips
  for (const x of [-0.75, -0.25, 0.3, 0.8]) {
    const n = 2 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const m = crt(deadScreen, rand() < 0.5 ? beige : beigeDirty);
      m.position.set(x + (rand() - 0.5) * 0.08, k * 0.38, 8.1 + (rand() - 0.5) * 0.1);
      m.rotation.y = Math.PI + (rand() - 0.5) * 0.3;
      props.add(m);
    }
  }
  // A server rack that fell over, leaning on the wall, and a heap beside it
  const deadRack = boxAt(0.6, 2.0, 0.7, std('#1e2026', { metalness: 0.4, roughness: 0.6 }), 0, 1.0, 0);
  const rackPivot = new THREE.Group();
  rackPivot.add(deadRack);
  deadRack.position.x = -0.3; // pivot on its outer bottom edge, so it leans back onto the wall
  rackPivot.position.set(3.1, 0, 5.4);
  rackPivot.rotation.z = -0.12;
  props.add(rackPivot);
  for (let k = 0; k < 9; k++) props.add(scatter(junk(), 1.95 + rand() * 0.6, 0, 4.9 + rand() * 1.2));
  props.add(tangle(2.0, 0.02, 6.3, 0.9, 8));
  // Boxes of "spare" cables and a stack of pizza boxes on the other side
  const boxLabel = canvasTexture(256, 192, (c) => {
    c.fillStyle = '#9a7448';
    c.fillRect(0, 0, 256, 192);
    c.fillStyle = '#1e1a10';
    c.font = '900 34px "Arial Black", sans-serif';
    c.textAlign = 'center';
    c.fillText('CABLES', 128, 80);
    c.font = '700 26px "Trebuchet MS", sans-serif';
    c.fillText('(MISC.) (OLD)', 128, 124);
    c.fillText('(SCART?)', 128, 160);
  });
  const labelled = [std('#ffffff', { map: boxLabel, roughness: 1 }), cardboard];
  for (const [x, y, z, ry] of [[-2.75, 0, 5.0, 0.1], [-2.7, 0.42, 5.05, -0.15], [-2.2, 0, 5.2, 0.4]] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.45), [cardboard, cardboard, cardboard, cardboard, labelled[0], cardboard]);
    b.position.set(x, y + 0.21, z);
    b.rotation.y = ry;
    g.add(b); // multi-material, so kept out of the bake
  }
  for (let p = 0; p < 7; p++) {
    const b = boxAt(0.38, 0.045, 0.38, cardboard, -1.95 + (rand() - 0.5) * 0.04, 0.023 + p * 0.046, 6.15);
    b.rotation.y = (rand() - 0.5) * 0.3;
    props.add(b);
  }
  // A leak in the ceiling tile above a bucket (see the drip below)
  const BUCKET: [number, number] = [-1.75, 4.85];
  const bucket = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.13, 0.3, 16, 1, true), std('#2a5a9a', { roughness: 0.6, side: THREE.DoubleSide }));
  bucket.position.set(BUCKET[0], 0.15, BUCKET[1]);
  props.add(bucket, cylAt(0.15, 0.01, std('#3a3a22', { roughness: 0.2 }), BUCKET[0], 0.2, BUCKET[1]));
  props.add(plane(0.6, 0.6, std('#2a2412', { roughness: 0.15, transparent: true, opacity: 0.6 }), [BUCKET[0] + 0.15, 0.004, BUCKET[1] + 0.1], [-Math.PI / 2, 0, 0]));

  // ---- Fluorescent tubes: most a grim green-white, two flickering, one dead, one hanging loose ----
  const tubeOn = basic('#dfeec8');
  const tubeDead = std('#4a4c44');
  const flickerMats = [basic('#dfeec8'), basic('#dfeec8')];
  const housing = std('#8a8672', { roughness: 0.8 });
  let n = 0;
  for (let z = 3.2; z > DECK_END_Z + 1; z -= 3.3) {
    for (const x of [-1.35, 1.35]) {
      const fit = new THREE.Group();
      fit.add(boxAt(0.24, 0.06, 1.3, housing, 0, 0, 0));
      const mat = n === 3 ? flickerMats[0] : n === 8 ? flickerMats[1] : n === 5 ? tubeDead : tubeOn;
      for (const dx of [-0.05, 0.05]) fit.add(boxAt(0.04, 0.035, 1.2, mat, dx, -0.04, 0));
      fit.position.set(x, CEIL_Y - 0.04, z);
      if (n === 6) {
        // One end has come down and dangles on its wires
        fit.position.y -= 0.22;
        fit.rotation.x = 0.36;
      }
      props.add(fit);
      n++;
    }
  }

  // Cables hanging out of the gaps in the ceiling, swaying in the draught
  const hanging: THREE.Group[] = [];
  for (const [x, z, drop] of [[0.6, -3.5, 1.0], [-2.2, 1.5, 1.3], [2.1, -8.5, 1.1], [-0.8, -12.5, 0.8]] as const) {
    const h = new THREE.Group();
    for (let k = 0; k < 3; k++) {
      const pts = [new THREE.Vector3(0, 0, 0), new THREE.Vector3((rand() - 0.5) * 0.3, -drop * 0.6, (rand() - 0.5) * 0.3), new THREE.Vector3((rand() - 0.5) * 0.5, -drop, (rand() - 0.5) * 0.4), new THREE.Vector3((rand() - 0.5) * 0.6, -drop * 0.7, (rand() - 0.5) * 0.6)];
      h.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.011, 5), pick(cableColours)));
    }
    h.add(boxAt(0.64, 0.01, 0.64, basic('#0a0906'), 0, -0.005, 0)); // the hole the tile fell out of
    h.position.set(x, CEIL_Y - 0.005, z);
    g.add(h);
    hanging.push(h);
  }

  // ---- Behind the pins: a projector screen stuck on a firmware update since nobody knows when ----
  const fwCanvas = document.createElement('canvas');
  fwCanvas.width = 512;
  fwCanvas.height = 256;
  const fwTex = new THREE.CanvasTexture(fwCanvas);
  fwTex.colorSpace = THREE.SRGBColorSpace;
  const drawFirmware = (spin: number) => {
    const c = fwCanvas.getContext('2d')!;
    c.fillStyle = '#16180f';
    c.fillRect(0, 0, 512, 256);
    c.fillStyle = '#c8cfa0';
    c.font = '700 30px "Courier New", monospace';
    c.textAlign = 'center';
    c.fillText('UPDATING FIRMWARE...', 256, 64);
    c.strokeStyle = '#c8cfa0';
    c.lineWidth = 3;
    c.strokeRect(56, 100, 400, 34);
    c.fillStyle = '#9ad040';
    c.fillRect(62, 106, 388 * 0.99, 22);
    c.fillStyle = '#c8cfa0';
    c.font = '700 24px "Courier New", monospace';
    c.fillText('99%   DO NOT POWER OFF', 256, 176);
    c.font = '18px "Courier New", monospace';
    c.fillStyle = '#7a8060';
    c.fillText('started: 3 years ago', 256, 222);
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + spin;
      c.fillStyle = `rgba(200, 207, 160, ${((k + 1) / 8) * 0.9})`;
      c.beginPath();
      c.arc(460 + Math.cos(a) * 14, 60 + Math.sin(a) * 14, 3, 0, Math.PI * 2);
      c.fill();
    }
    fwTex.needsUpdate = true;
  };
  drawFirmware(0);
  const fwMat = new THREE.MeshBasicMaterial({ map: fwTex, toneMapped: false });
  g.add(plane(2.6, 1.3, fwMat, [0, 2.85, BACK_Z + 0.05]));
  g.add(boxAt(2.8, 0.06, 0.1, housing, 0, 3.53, BACK_Z + 0.08));

  // The neighbouring lanes are closed: hazard tape across them (it's where the skips went)
  const tape = canvasTexture(256, 16, (c) => {
    for (let x = -16; x < 256; x += 32) {
      c.fillStyle = '#e8c21a';
      c.fillRect(x, 0, 32, 16);
      c.fillStyle = '#16140c';
      c.beginPath();
      c.moveTo(x + 16, 0);
      c.lineTo(x + 32, 0);
      c.lineTo(x + 16, 16);
      c.lineTo(x, 16);
      c.fill();
    }
  });
  const tapeMat = std('#ffffff', { map: tape, roughness: 0.6, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    for (const z of [-0.4, -15.5]) {
      // Strung between two traffic cones, sagging in the middle
      const x0 = side * (NEIGHBOUR_X - 0.62);
      const x1 = side * (WALL_X - 0.05);
      const t = plane(Math.abs(x1 - x0), 0.06, tapeMat, [(x0 + x1) / 2, 0.62, z]);
      t.rotation.z = side * 0.04;
      props.add(t);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.65, 12), std('#d8541a', { roughness: 0.7 }));
      cone.position.set(x0, 0.325, z);
      props.add(cone, boxAt(0.26, 0.03, 0.26, std('#1e1c18'), x0, 0.015, z));
    }
  }

  g.add(bake(props));

  // The drip from the ceiling into the bucket
  const drip = new THREE.Mesh(new THREE.SphereGeometry(0.014, 8, 6), std('#a8b0a0', { roughness: 0.1, metalness: 0.2 }));
  g.add(drip);

  let lights: Lighting | null = null;
  const HEMI = 0.68;
  let lastSpin = -1;
  let lastFlicker = -1;
  return {
    group: g,
    update: (t) => {
      // Drip: falls from the stain on the ceiling, plops into the bucket, again and again
      const cycle = t % 1.7;
      const fall = Math.min(cycle, 0.85);
      drip.position.set(BUCKET[0], CEIL_Y - 0.02 - 4.9 * fall * fall, BUCKET[1]);
      drip.visible = cycle < 0.85;
      // Hanging cables sway a little
      hanging.forEach((h, i) => (h.rotation.z = Math.sin(t * 0.8 + i * 1.7) * 0.06));
      if (Math.floor(t * 4) !== lastSpin) {
        lastSpin = Math.floor(t * 4);
        drawFirmware(lastSpin * 0.6);
      }
      if (t - lastFlicker < 0.05) return;
      lastFlicker = t;
      // Two tubes stutter in bursts; the room dims a touch with the worst of them
      flickerMats.forEach((m, i) => {
        const burst = (t + i * 2.3) % (i ? 5.3 : 3.7) < 0.9;
        const on = !burst || Math.random() < 0.45;
        m.color.set(on ? '#dfeec8' : '#3a3c34');
        if (i === 0 && lights) lights.hemi.intensity = on ? HEMI : HEMI * 0.82;
      });
      // The sign keeps cutting out
      signMat.opacity = (t % 6.1) < 0.7 && Math.random() < 0.6 ? 0.25 : 1;
      // Monitors flicker and roll now and then
      screens.forEach((s, i) => s.color.setScalar(Math.random() < 0.06 ? 0.55 : 0.85 + Math.sin(t * 9 + i) * 0.08));
    },
    apply: (scene, l) => {
      lights = l;
      scene.background = new THREE.Color('#0e0f09');
      scene.fog = new THREE.Fog('#16170e', 14, 40);
      l.hemi.color.set('#dfe6b8');
      l.hemi.groundColor.set('#2a2616');
      l.hemi.intensity = HEMI;
      l.key.color.set('#eef2d6');
      l.key.intensity = 1.15;
      l.fill.color.set('#aab07a');
    },
  };
}

const BUILDERS: Record<VenueId, (scores: THREE.Texture) => Built> = { classic, server, disco, rooftop, golden, mem };

/** Builds venues on first use and swaps between them. */
export class VenueManager {
  private built = new Map<VenueId, Built>();
  private currentId: VenueId | null = null;
  private time = 0;

  constructor(
    private scene: THREE.Scene,
    private lights: Lighting,
    /** The live scoreboard, shown on each venue's overhead monitor. */
    private scores: THREE.Texture,
  ) {}

  get current(): VenueInfo {
    return VENUES.find((v) => v.id === this.currentId) ?? VENUES[0];
  }

  select(id: VenueId) {
    if (id === this.currentId) return;
    if (this.currentId) this.built.get(this.currentId)!.group.visible = false;
    let b = this.built.get(id);
    if (!b) {
      b = BUILDERS[id](this.scores);
      this.built.set(id, b);
      this.scene.add(b.group);
    }
    b.group.visible = true;
    b.apply(this.scene, this.lights);
    this.currentId = id;
  }

  update(dt: number) {
    this.time += dt;
    if (this.currentId) this.built.get(this.currentId)!.update(this.time);
  }
}

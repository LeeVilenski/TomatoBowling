import * as THREE from 'three';
import type { TrackId } from '../audio/music';
import { DECK_END_Z, OUTER_HALF, PIT_END_Z } from '../game/dimensions';
import { canvasTexture, carpet, maskingPanel, neonSign } from './decor';

// The places Tomato Dave can bowl. The lanes are the same everywhere; each venue adds its
// own walls, ceiling, lights, signs, music and a few moving effects.

export type VenueId = 'classic' | 'server' | 'disco' | 'rooftop';

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
  panel.position.set(0, 0.95, DECK_END_Z + 0.445);
  g.add(sign, panel);
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
function classic(): Built {
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
  for (const x of [0, -NEIGHBOUR_X, NEIGHBOUR_X]) {
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
function server(): Built {
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
function disco(): Built {
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
function rooftop(): Built {
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
  for (const side of [-1, 1]) g.add(plane(4, ROOM_LEN + 6, deck, [side * (WALL_X + 1.3), 0.001, MID_Z], [-Math.PI / 2, 0, 0]));
  g.add(plane(WALL_X * 2 + 6, FRONT_Z - 4.5 + 3, deck, [0, -0.004, (FRONT_Z + 4.5) / 2 + 1.5], [-Math.PI / 2, 0, 0]));

  // Low parapet walls around the roof, with potted plants
  const concrete = std('#6e5a6a');
  for (const side of [-1, 1]) g.add(boxAt(0.25, 1, ROOM_LEN + 6, concrete, side * (WALL_X + 3.2), 0.5, MID_Z));
  g.add(boxAt(WALL_X * 2 + 6.6, 1, 0.25, concrete, 0, 0.5, FRONT_Z + 3));
  const pot = std('#b5653a');
  const leaf = std('#3f8f3a');
  for (const [x, z] of [[-4.6, 7], [4.6, 7], [-4.6, 0], [4.6, 0], [-4.6, -8], [4.6, -8], [2, 10.6], [-2.5, 10.6]]) {
    g.add(boxAt(0.5, 0.5, 0.5, pot, x, 0.25, z));
    const bush = new THREE.Mesh(new THREE.SphereGeometry(0.42, 18, 12), leaf);
    bush.position.set(x, 0.85, z);
    g.add(bush);
  }

  // City skyline all around, with lit windows
  const windows = canvasTexture(64, 128, (c) => {
    c.fillStyle = '#231a33';
    c.fillRect(0, 0, 64, 128);
    for (let y = 4; y < 128; y += 10) for (let x = 4; x < 64; x += 10) {
      c.fillStyle = Math.random() < 0.35 ? '#ffcf7a' : '#1a1326';
      c.fillRect(x, y, 5, 6);
    }
  });
  windows.wrapS = windows.wrapT = THREE.RepeatWrapping;
  const towerMat = new THREE.MeshStandardMaterial({ map: windows, emissive: '#ffffff', emissiveMap: windows, emissiveIntensity: 0.6, roughness: 0.9 });
  const rand = (() => {
    let s = 11;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  })();
  for (let i = 0; i < 70; i++) {
    const a = (i / 70) * Math.PI * 2;
    const dist = 70 + rand() * 70;
    const w = 7 + rand() * 12;
    const h = 20 + rand() * 40;
    const tower = new THREE.Mesh(new THREE.BoxGeometry(w, h, w), towerMat);
    // Most tops sit below our roof, a few stand taller, so it feels high up
    tower.position.set(Math.sin(a) * dist, h / 2 - 36, -Math.cos(a) * dist - 10);
    g.add(tower);
  }
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
    },
    apply: (scene, l) => {
      scene.background = sky;
      scene.fog = new THREE.Fog('#d77a6a', 45, 190);
      l.hemi.color.set('#ffc28a');
      l.hemi.groundColor.set('#40284a');
      l.hemi.intensity = 1.25;
      l.key.color.set('#ffd2a0');
      l.key.intensity = 1.7;
      l.fill.color.set('#ff9a7a');
    },
  };
}

const BUILDERS: Record<VenueId, () => Built> = { classic, server, disco, rooftop };

/** Builds venues on first use and swaps between them. */
export class VenueManager {
  private built = new Map<VenueId, Built>();
  private currentId: VenueId | null = null;
  private time = 0;

  constructor(
    private scene: THREE.Scene,
    private lights: Lighting,
  ) {}

  get current(): VenueInfo {
    return VENUES.find((v) => v.id === this.currentId) ?? VENUES[0];
  }

  select(id: VenueId) {
    if (id === this.currentId) return;
    if (this.currentId) this.built.get(this.currentId)!.group.visible = false;
    let b = this.built.get(id);
    if (!b) {
      b = BUILDERS[id]();
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

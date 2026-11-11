// Real-world bowling measurements, in metres.
// The lane runs along -Z. The foul line is at z = 0 and the lane surface is at y = 0.

export const LANE_WIDTH = 1.054;
export const LANE_HALF = LANE_WIDTH / 2;
export const GUTTER_WIDTH = 0.235;
export const OUTER_HALF = LANE_HALF + GUTTER_WIDTH; // edge of the gutters

export const HEAD_PIN_Z = -18.29; // 60 ft from the foul line
export const PIN_SPACING = 0.3048; // 12 in between pin centres
export const ROW_DEPTH = PIN_SPACING * Math.cos(Math.PI / 6);
export const DECK_END_Z = HEAD_PIN_Z - 3 * ROW_DEPTH - 0.2;
export const PIT_DEPTH = 0.6;
export const PIT_END_Z = DECK_END_Z - 1.1;
export const APPROACH_START_Z = 4.5;

export const BALL_RADIUS = 0.109;
export const BALL_MASS = 6.5;
export const PIN_MASS = 1.5;
export const PIN_HEIGHT = 0.381;

// Pin outline as [radius, height] pairs from base to top (based on the USBC spec).
export const PIN_PROFILE: [number, number][] = [
  [0.0, 0.0],
  [0.0258, 0.0],
  [0.036, 0.02],
  [0.05, 0.05],
  [0.0585, 0.09],
  [0.0605, 0.114],
  [0.058, 0.145],
  [0.05, 0.18],
  [0.035, 0.215],
  [0.0228, 0.238],
  [0.024, 0.27],
  [0.03, 0.31],
  [0.0323, 0.343],
  [0.029, 0.362],
  [0.019, 0.376],
  [0.0, PIN_HEIGHT],
];

/** Pin spots, numbered 1–10 the standard way (1 = head pin). */
export function pinSpots(): { x: number; z: number }[] {
  const spots: { x: number; z: number }[] = [];
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i <= row; i++) {
      spots.push({
        x: (i - row / 2) * PIN_SPACING,
        z: HEAD_PIN_Z - row * ROW_DEPTH,
      });
    }
  }
  return spots;
}

// Gutters are a shallow V so a ball that drops in sits low in the middle,
// clear of the lane edge and the pins (like a real rounded gutter).
const GUTTER_ANGLE = (25 * Math.PI) / 180;
const GUTTER_VERTEX_Y = -0.16;

export interface Plate {
  x: number;
  y: number;
  halfWidth: number;
  angle: number; // rotation about the Z axis
}

/** The two sloped plates that make up each gutter (4 plates total). */
export function gutterPlates(): Plate[] {
  const half = GUTTER_WIDTH / 2;
  const plates: Plate[] = [];
  for (const side of [-1, 1]) {
    const centre = side * (LANE_HALF + half);
    for (const s of [-1, 1]) {
      plates.push({
        x: centre + (s * half) / 2,
        y: GUTTER_VERTEX_Y + (Math.tan(GUTTER_ANGLE) * half) / 2,
        halfWidth: half / 2 / Math.cos(GUTTER_ANGLE),
        angle: s * GUTTER_ANGLE,
      });
    }
  }
  return plates;
}

/** Fixed physics step (seconds). */
export const PHYSICS_DT = 1 / 120;

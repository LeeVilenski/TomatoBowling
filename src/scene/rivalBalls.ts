// The computer rivals' balls: each brings a strike ball (thrown at a full rack) and a spare
// ball (for whatever's left), painted to match who they are. Keyed `<rival id>-strike` and
// `<rival id>-spare`; their names are in src/game/rivals.ts. All are regulation size, so
// the rivals' tuning (`npm run check:rivals`) holds whichever one they're throwing.
import { BALL_RADIUS } from '../game/dimensions';
import type { BallLayer, BallStyle } from './models';

const ball = (paint: BallLayer[], more: Partial<BallStyle> = {}): BallStyle => ({
  colour: '#ffffff',
  radius: BALL_RADIUS,
  roughness: 0.2,
  metalness: 0.05,
  paint,
  ...more,
});

export const RIVAL_BALLS: Record<string, BallStyle> = {
  // ---------------------------------------------------------------- Tomato Dave's
  // Pickle Pete: a warty gherkin, and a jar of brine
  'pickle-strike': ball(
    [{ gradient: ['#3f6b1f', '#56852a', '#3a6119'] }, { speckle: ['#8db24a', '#a3c45c'], count: 260, size: 0.012 }, { speckle: ['#2c4d14'], count: 80, size: 0.008 }],
    { roughness: 0.35 },
  ),
  'pickle-spare': ball([{ gradient: ['#d6dc8a', '#bfcd6a', '#a9bb52'] }, { speckle: ['#4c7a22', '#6a9a30'], count: 120, size: 0.006 }, { bands: ['#c9a227', '#c9a227', '', '', '', '', '', '', ''] }], {
    roughness: 0.04,
    metalness: 0.15,
  }),
  // Donut Dana: pink glaze with sprinkles, and chocolate glaze
  'donut-strike': ball([
    { fill: '#d9a05b' },
    { drip: '#ff8fc4', to: 0.5 },
    { speckle: ['#ffffff', '#ffd23a', '#4fc3ff', '#7ee05a', '#ff5252'], count: 220, size: 0.009, from: 0, to: 0.52 },
  ]),
  'donut-spare': ball([{ fill: '#d9a05b' }, { drip: '#5a2f17', to: 0.52 }, { speckle: ['#ffffff', '#f5e6c8'], count: 160, size: 0.007, from: 0, to: 0.52 }], {
    roughness: 0.15,
  }),
  // Sandy Wich: a stacked club sandwich, and a toasted crust
  'sandy-strike': ball([{ bands: ['#e8c48a', '#7cc43a', '#e0261b', '#ffd23a', '#f2a3a0', '#7cc43a', '#e8c48a'], wobble: 1 }], { roughness: 0.5 }),
  'sandy-spare': ball([{ gradient: ['#b8742e', '#9a5a1e', '#b8742e'] }, { speckle: ['#e0b070', '#6e3a12'], count: 300, size: 0.006 }], { roughness: 0.7 }),
  // Carrot Carl: a carrot (leaves and all), and a purple heritage carrot
  'carl-strike': ball([{ gradient: ['#ff8a1c', '#f26b0f', '#e85d04'] }, { bands: ['', '#e05a06', '', '', '#e05a06', '', '', '#e05a06', '', '', '#e05a06', ''] }], {
    leaf: '#3c8f2a',
    lobes: 0,
  }),
  'carl-spare': ball([{ gradient: ['#5b1e6b', '#7a2a8c', '#5b1e6b'] }, { spots: [[0.25, 0.5, 0.06, '#ff9a2e'], [0.75, 0.5, 0.06, '#ff9a2e']] }], {
    leaf: '#3c8f2a',
    lobes: 0,
  }),

  // ---------------------------------------------------------------- Server Room Lanes
  // Micro Chip: a ready salted crisp, and a floppy disk
  'chip-strike': ball([{ gradient: ['#f4c542', '#e8b032', '#d99a22'] }, { speckle: ['#fff8e0', '#ffffff'], count: 400, size: 0.004 }, { speckle: ['#b8781a'], count: 40, size: 0.014 }], {
    roughness: 0.3,
  }),
  'chip-spare': ball([{ fill: '#20252e' }, { bands: ['#20252e', '#20252e', '#b9c2cc', '#20252e', '#20252e'] }, { grid: '#2d3440', cells: 12, width: 3 }], {
    roughness: 0.35,
    metalness: 0.4,
  }),
  // Cookie Kate: chocolate chip, and double chocolate
  'cookie-strike': ball([{ fill: '#d39a55' }, { speckle: ['#c58a48', '#e0ac68'], count: 200, size: 0.012 }, { speckle: ['#3d2010', '#4f2a14'], count: 70, size: 0.02 }], {
    roughness: 0.75,
  }),
  'cookie-spare': ball([{ fill: '#4a2614' }, { speckle: ['#5a301a'], count: 160, size: 0.012 }, { speckle: ['#fff3dc', '#f2e2c0'], count: 70, size: 0.018 }], {
    roughness: 0.7,
  }),
  // Wafer Walt: a golden waffle, and an iridescent silicon wafer
  'wafer-strike': ball([{ fill: '#e3a64a' }, { grid: '#a8661f', cells: 14, width: 10 }], { roughness: 0.55 }),
  'wafer-spare': ball([{ gradient: ['#6b5cff', '#3fb8ff', '#b06bff', '#3fffc8', '#6b5cff'] }, { grid: 'rgba(230,240,255,0.55)', cells: 22, width: 3 }], {
    roughness: 0.12,
    metalness: 0.75,
  }),
  // Byte-sized Brie: a wheel of brie, and blue cheese
  'brie-strike': ball([{ fill: '#f6f0dc' }, { speckle: ['#ebe1c0', '#fffaf0'], count: 300, size: 0.01 }, { bands: ['', '', '#f0d478', '#f0d478', '', ''], wobble: 0.3 }, { speckle: ['#fff3c4', '#e2c262'], count: 60, size: 0.008, from: 0.36, to: 0.64 }], {
    roughness: 0.8,
  }),
  'brie-spare': ball([{ fill: '#efe8cf' }, { veins: '#3d6b7a', count: 22, width: 4 }, { speckle: ['#2f5868', '#4c8090'], count: 120, size: 0.008 }], { roughness: 0.7 }),

  // ---------------------------------------------------------------- Disco Inferno
  // Jelly Jive: a glossy red jelly, and a rainbow jelly
  'jelly-strike': ball([{ gradient: ['#ff5a6a', '#e01e3c', '#a30d26'] }], { roughness: 0.02, glow: '#3a0008' }),
  'jelly-spare': ball([{ bands: ['#ff4f6d', '#ff9f43', '#ffe14d', '#5ce07a', '#4fb3ff', '#a66bff'], wobble: 1.5 }], { roughness: 0.03, glow: '#140a14' }),
  // Mango Tango: a ripening mango, and a sorbet swirl
  'mango-strike': ball([{ gradient: ['#e8442e', '#ff8c1a', '#ffc23a', '#8bbf3a'] }, { speckle: ['#ffe39a'], count: 90, size: 0.004 }], { roughness: 0.25 }),
  'mango-spare': ball([{ swirl: ['#ffb02e', '#ff7a1c', '#ffd86a'], turns: 3 }], { roughness: 0.3 }),
  // Lemon Twist: a lemon twist, and a lime
  'lemon-strike': ball([{ swirl: ['#ffe14d', '#fff7c2'], turns: 2 }], { roughness: 0.25 }),
  'lemon-spare': ball([{ gradient: ['#5fb32c', '#7fcf3a', '#5fb32c'] }, { speckle: ['#9be05a', '#4a9a20'], count: 350, size: 0.005 }], { roughness: 0.35 }),
  // Aubergine Annie: glittery aubergine, and a mirror ball
  'annie-strike': ball([{ gradient: ['#4a1458', '#2e0a3a', '#4a1458'] }, { speckle: ['#ff9ef0', '#e6c2ff', '#ffffff'], count: 500, size: 0.0035 }], {
    roughness: 0.15,
    metalness: 0.45,
  }),
  'annie-spare': ball([{ fill: '#e8ecf2' }, { speckle: ['#ffffff', '#b8c4d4', '#d8e0ea', '#a0acbc'], count: 900, size: 0.016 }, { grid: '#5a6270', cells: 30, width: 3 }], {
    roughness: 0.05,
    metalness: 1,
  }),

  // ---------------------------------------------------------------- Rooftop at Sunset
  // Sunny Side: a fried egg, and scrambled
  'sunny-strike': ball([{ fill: '#fbf8ef' }, { spots: [[0.25, 0.5, 0.2, '#ffc61a'], [0.75, 0.5, 0.2, '#ffc61a']] }], { roughness: 0.12 }),
  'sunny-spare': ball([{ fill: '#ffe066' }, { speckle: ['#fff3b0', '#f5c832', '#ffffff'], count: 260, size: 0.02 }], { roughness: 0.5 }),
  // Ice Lolly Lou: a swirly lollipop, and a rocket lolly
  'lolly-strike': ball([{ swirl: ['#ff5aa5', '#ffffff', '#4fc3ff', '#ffffff'], turns: 3 }], { roughness: 0.08 }),
  'lolly-spare': ball([{ bands: ['#e8262b', '#e8262b', '#fff7ea', '#fff7ea', '#2a6fd6', '#2a6fd6'] }], { roughness: 0.1 }),
  // Kiwi Kai: fuzzy kiwi skin, and a kiwi slice
  'kiwi-strike': ball([{ fill: '#7d6a3a' }, { speckle: ['#958250', '#5e5028', '#a8955e'], count: 1400, size: 0.005 }], { roughness: 0.95 }),
  'kiwi-spare': ball([{ gradient: ['#f4f2d0', '#8fd13a', '#6fbf2a', '#8fd13a', '#f4f2d0'] }, { speckle: ['#141414'], count: 140, size: 0.006, from: 0.32, to: 0.68 }], {
    roughness: 0.15,
  }),
  // Big Russet: a russet potato with eyes, and a hash brown
  'russet-strike': ball([{ fill: '#a6774a' }, { speckle: ['#8a5f38', '#b88a5c'], count: 300, size: 0.012 }, { speckle: ['#5e3c1e'], count: 18, size: 0.012 }], {
    roughness: 0.9,
  }),
  'russet-spare': ball([{ fill: '#d9932e' }, { veins: '#9a5214', count: 30, width: 3 }, { speckle: ['#f2c063', '#7a3e0e'], count: 260, size: 0.007 }], {
    roughness: 0.6,
  }),

  // ---------------------------------------------------------------- The Golden Pin
  // The Pumpkin King: a glowing jack-o'-lantern, and the royal orb
  'pumpkin-strike': ball([{ fill: '#f26b0f' }, { ribs: '#c24f08', count: 10, width: 14 }], {
    leaf: '#4d6b1c',
    lobes: 5,
    lobeDepth: 0.06,
    roughness: 0.35,
    glow: '#3a1400',
  }),
  'pumpkin-spare': ball([
      { fill: '#e8b830' },
      { bands: ['', '', '', '#5a189a', '', '', ''] },
      { spots: [[0, 0.5, 0.045, '#e63946'], [0.25, 0.5, 0.045, '#2a9d8f'], [0.5, 0.5, 0.045, '#e63946'], [0.75, 0.5, 0.045, '#2a9d8f']] },
    ], {
    roughness: 0.2,
    metalness: 0.85,
    glow: '#2a1d00',
  }),
};

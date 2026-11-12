// Career mode's rules: the ladder of rivals at each venue, what unlocks what, stars for a
// match, and the save. No graphics here, so it's all unit tested.
import type { LaneConditions } from './physics';
import type { RivalId } from './rivals';
import { position, scoreFrames } from './scoring';

export interface Rung {
  rival: RivalId;
  /** Match length: quick 5-frame matches against early rivals, a full game against champions. */
  frames: number;
  champion?: boolean;
}

/** Each career venue changes one thing about how its lane plays. */
export interface LaneRule {
  name: string;
  emoji: string;
  blurb: string;
  /** Where the oil ends (see LaneConditions). */
  oilEnd?: number;
  /** How springy the pins are. */
  pinBounce?: number;
  /** A breeze up to this strength (m/s²), blowing a new way each frame. */
  breeze?: number;
}

export interface Ladder {
  /** Also the venue it's played at. */
  id: 'classic' | 'server' | 'disco' | 'rooftop' | 'golden';
  name: string;
  emoji: string;
  rule: LaneRule | null;
  /** Bottom rung first; the champion is last. */
  rungs: Rung[];
  /** The Wardrobe item for becoming this venue's champion. */
  reward: string;
}

/** Tomato Dave's, bottom rung first. */
export const HOME_LADDER: Rung[] = [
  { rival: 'pickle', frames: 5 },
  { rival: 'donut', frames: 5 },
  { rival: 'sandy', frames: 5 },
  { rival: 'carl', frames: 10, champion: true },
];

const full = (rivals: RivalId[]): Rung[] => rivals.map((rival, i) => ({ rival, frames: 10, champion: i === rivals.length - 1 }));

/** The whole career, venue by venue. Each ladder opens once you're the previous venue's champion. */
export const LADDERS: Ladder[] = [
  { id: 'classic', name: "Tomato Dave's", emoji: '🍅', rule: null, rungs: HOME_LADDER, reward: 'blazer' },
  {
    id: 'server',
    name: 'Server Room Lanes',
    emoji: '🖥️',
    rule: { name: 'Long oil', emoji: '🛢️', blurb: 'The oil runs further down the lane, so the hook comes late and small.', oilEnd: -15 },
    rungs: full(['chip', 'cookie', 'wafer', 'brie']),
    reward: 'circuit',
  },
  {
    id: 'disco',
    name: 'Disco Inferno',
    emoji: '🪩',
    rule: { name: 'Bouncy pins', emoji: '🎳', blurb: 'Extra-springy pins: more of them fly, and more of them fly back.', pinBounce: 0.62 },
    rungs: full(['jelly', 'mango', 'lemon', 'annie']),
    reward: 'glitter',
  },
  {
    id: 'rooftop',
    name: 'Rooftop at Sunset',
    emoji: '🌇',
    rule: { name: 'Breezy', emoji: '🌬️', blurb: 'A breeze blows across the lane, a different way each frame. Check it before you throw.', breeze: 0.07 },
    rungs: full(['sunny', 'lolly', 'kiwi', 'russet']),
    reward: 'sunset',
  },
  {
    id: 'golden',
    name: 'The Golden Pin',
    emoji: '🏆',
    rule: { name: 'Dry lanes', emoji: '🏜️', blurb: 'Hardly any oil: the ball grips early and hooks hard.', oilEnd: -8.5 },
    rungs: full(['pumpkin']),
    reward: 'goldsuit',
  },
];

/** Which ladder a rival belongs to. */
export function ladderOf(rival: RivalId): Ladder {
  return LADDERS.find((l) => l.rungs.some((r) => r.rival === rival)) ?? LADDERS[0];
}

/** A ladder is open once you're champion of the one before it. */
export function isLadderOpen(save: CareerSave, index: number): boolean {
  return index === 0 || isChampion(save, LADDERS[index - 1].rungs);
}

/**
 * The lane for a match at this ladder's venue. With a breeze, call it again each frame:
 * `random` picks the new wind (0–1), rounded so it's easy to read.
 */
export function laneFor(ladder: Ladder, standard: LaneConditions, random: () => number = Math.random): LaneConditions {
  const r = ladder.rule;
  const lane = { ...standard };
  if (r?.oilEnd !== undefined) lane.oilEnd = r.oilEnd;
  if (r?.pinBounce !== undefined) lane.pinBounce = r.pinBounce;
  if (r?.breeze) {
    // Rounded to make it easy to read, but never quite still: up here there's always a breeze
    const raw = random() * 2 - 1;
    lane.wind = Math.round(raw * r.breeze * 100) / 100 || (raw < 0 ? -0.01 : 0.01);
  }
  return lane;
}

export interface RungRecord {
  wins: number;
  losses: number;
  ties: number;
  /** Best stars earned against this rival (0–3). */
  stars: number;
}

export interface CareerSave {
  version: 1;
  results: Partial<Record<RivalId, RungRecord>>;
  /**
   * A match left part-way through, to pick up later: every ball so far, in the order
   * they were bowled (replaying them through a Match puts it back exactly where it was).
   */
  inProgress?: { rival: RivalId; frames: number; log: number[] };
  /** Your numbers across every career match (added after launch, so older saves start at zero). */
  stats?: CareerStats;
}

export interface CareerStats {
  matches: number;
  wins: number;
  /** Full 10-frame games: how many, total score (for the average), best score. */
  games10: number;
  pins10: number;
  best10: number;
  /** Best in a 5-frame match. */
  best5: number;
  strikes: number;
  /** First balls at a full rack. */
  strikeChances: number;
  spares: number;
  /** Balls at a leave (pins left standing). */
  spareChances: number;
  splitsConverted: number;
}

export const NO_STATS: CareerStats = {
  matches: 0, wins: 0, games10: 0, pins10: 0, best10: 0, best5: 0,
  strikes: 0, strikeChances: 0, spares: 0, spareChances: 0, splitsConverted: 0,
};

export const NEW_CAREER: CareerSave = { version: 1, results: {} };

/** Tidies up whatever was in storage into a valid save (or a new career). */
export function loadCareer(raw: unknown): CareerSave {
  const s = raw as Partial<CareerSave> | null;
  if (!s || s.version !== 1 || typeof s.results !== 'object' || s.results === null) return { ...NEW_CAREER, results: {} };
  return { version: 1, results: { ...s.results }, inProgress: s.inProgress, stats: s.stats ? { ...NO_STATS, ...s.stats } : undefined };
}

export const beaten = (save: CareerSave, rival: RivalId) => (save.results[rival]?.wins ?? 0) > 0;

/** A rung is open once you've beaten the one below it. */
export function isUnlocked(save: CareerSave, index: number, ladder = HOME_LADDER): boolean {
  return index === 0 || beaten(save, ladder[index - 1].rival);
}

/** The lowest rung you haven't beaten yet, or -1 if you've beaten the lot. */
export function nextRung(save: CareerSave, ladder = HOME_LADDER): number {
  return ladder.findIndex((r) => !beaten(save, r.rival));
}

export const isChampion = (save: CareerSave, ladder = HOME_LADDER) => nextRung(save, ladder) === -1;

/** The marks a player bowled, in order ('X', '/', '-', or a number). */
function marks(rolls: number[], frames: number): string[] {
  return scoreFrames(rolls, frames).frames.flatMap((f) => f.boxes.filter((b) => b !== ''));
}

/** Three strikes in a row anywhere in the game. */
export function hadTurkey(rolls: number[], frames: number): boolean {
  let run = 0;
  for (const m of marks(rolls, frames)) {
    run = m === 'X' ? run + 1 : 0;
    if (run >= 3) return true;
  }
  return false;
}

/** Every frame a strike or a spare. */
export function noOpenFrames(rolls: number[], frames: number): boolean {
  return scoreFrames(rolls, frames).frames.every((f) => f.boxes.some((b) => b === 'X' || b === '/'));
}

export interface StarResult {
  stars: number;
  won: boolean;
  /** Won by 3+ pins a frame (15 in a 5-frame match, 30 in a full game). */
  bigWin: boolean;
  /** A turkey, or not a single open frame. */
  flair: boolean;
}

/** Stars for a finished match: one for the win, one for a big win, one for some flair. */
export function starsFor(you: number[], them: number[], frames: number): StarResult {
  const mine = scoreFrames(you, frames).total;
  const theirs = scoreFrames(them, frames).total;
  const won = mine > theirs;
  const bigWin = won && mine - theirs >= 3 * frames;
  const flair = won && (hadTurkey(you, frames) || noOpenFrames(you, frames));
  return { stars: won ? 1 + Number(bigWin) + Number(flair) : 0, won, bigWin, flair };
}

/** The save after a finished match (the in-progress match is cleared). */
export function recordResult(save: CareerSave, rival: RivalId, you: number, them: number, stars: number): CareerSave {
  const r: RungRecord = { wins: 0, losses: 0, ties: 0, stars: 0, ...save.results[rival] };
  if (you > them) r.wins++;
  else if (you < them) r.losses++;
  else r.ties++;
  r.stars = Math.max(r.stars, stars);
  return { version: 1, results: { ...save.results, [rival]: r }, stats: save.stats };
}

/** Strikes and spares in one game, and how many chances there were at each. */
export function ballStats(rolls: number[], frames: number) {
  const out = { strikes: 0, strikeChances: 0, spares: 0, spareChances: 0 };
  for (let i = 0; i < rolls.length; i++) {
    const pos = position(rolls.slice(0, i), frames);
    if (pos.fresh) {
      out.strikeChances++;
      if (rolls[i] === 10) out.strikes++;
    } else {
      out.spareChances++;
      if (rolls[i] === pos.standing) out.spares++;
    }
  }
  return out;
}

/** Adds a finished match to your career numbers. */
export function addMatchStats(save: CareerSave, rolls: number[], frames: number, won: boolean, splitsConverted: number): CareerSave {
  const s = { ...NO_STATS, ...save.stats };
  const score = scoreFrames(rolls, frames).total;
  const balls = ballStats(rolls, frames);
  s.matches++;
  if (won) s.wins++;
  if (frames === 10) {
    s.games10++;
    s.pins10 += score;
    s.best10 = Math.max(s.best10, score);
  } else s.best5 = Math.max(s.best5, score);
  s.strikes += balls.strikes;
  s.strikeChances += balls.strikeChances;
  s.spares += balls.spares;
  s.spareChances += balls.spareChances;
  s.splitsConverted += splitsConverted;
  return { ...save, stats: s };
}

/** Total stars across a ladder (out of 3 per rung). */
export function totalStars(save: CareerSave, ladder = HOME_LADDER): number {
  return ladder.reduce((n, r) => n + (save.results[r.rival]?.stars ?? 0), 0);
}

/** Rivals you can play in a quick vs CPU match: everyone at the venues you've reached. */
export function metRivals(save: CareerSave): RivalId[] {
  return LADDERS.flatMap((l, i) => (isLadderOpen(save, i) ? l.rungs.map((r) => r.rival) : []));
}

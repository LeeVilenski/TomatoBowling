// Career mode's rules: the ladder of rivals at each venue, what unlocks what, stars for a
// match, and the save. No graphics here, so it's all unit tested.
import type { RivalId } from './rivals';
import { scoreFrames } from './scoring';

export interface Rung {
  rival: RivalId;
  /** Match length: quick 5-frame matches against early rivals, a full game against champions. */
  frames: number;
  champion?: boolean;
}

/** Tomato Dave's, bottom rung first. */
export const HOME_LADDER: Rung[] = [
  { rival: 'pickle', frames: 5 },
  { rival: 'donut', frames: 5 },
  { rival: 'sandy', frames: 5 },
  { rival: 'carl', frames: 10, champion: true },
];

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
}

export const NEW_CAREER: CareerSave = { version: 1, results: {} };

/** Tidies up whatever was in storage into a valid save (or a new career). */
export function loadCareer(raw: unknown): CareerSave {
  const s = raw as Partial<CareerSave> | null;
  if (!s || s.version !== 1 || typeof s.results !== 'object' || s.results === null) return { ...NEW_CAREER, results: {} };
  return { version: 1, results: { ...s.results }, inProgress: s.inProgress };
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
  return { version: 1, results: { ...save.results, [rival]: r } };
}

/** Total stars across a ladder (out of 3 per rung). */
export function totalStars(save: CareerSave, ladder = HOME_LADDER): number {
  return ladder.reduce((n, r) => n + (save.results[r.rival]?.stars ?? 0), 0);
}

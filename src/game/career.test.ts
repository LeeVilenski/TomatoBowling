import { describe, expect, it } from 'vitest';
import { STANDARD_LANE } from './physics';
import { RIVALS } from './rivals';
import {
  HOME_LADDER,
  isLadderOpen,
  LADDERS,
  ladderOf,
  laneFor,
  metRivals,
  hadTurkey,
  isChampion,
  isUnlocked,
  loadCareer,
  NEW_CAREER,
  nextRung,
  noOpenFrames,
  recordResult,
  starsFor,
  totalStars,
} from './career';
import { Match } from './match';

const open5 = [9, 0, 9, 0, 9, 0, 9, 0, 9, 0]; // 45, all open
const spares5 = [9, 1, 9, 1, 9, 1, 9, 1, 9, 1, 9]; // 5-frame game of spares: 95
const turkey5 = [10, 10, 10, 3, 4, 9, 0]; // a turkey, then open frames

describe('the ladder', () => {
  it('runs Pickle, Donut, Sandy, then the champion Carl, in a full game', () => {
    expect(HOME_LADDER.map((r) => r.rival)).toEqual(['pickle', 'donut', 'sandy', 'carl']);
    expect(HOME_LADDER.map((r) => r.frames)).toEqual([5, 5, 5, 10]);
    expect(HOME_LADDER[3].champion).toBe(true);
  });

  it('opens one rung at a time as you beat each rival', () => {
    let save = NEW_CAREER;
    expect([0, 1, 2, 3].map((i) => isUnlocked(save, i))).toEqual([true, false, false, false]);
    save = recordResult(save, 'pickle', 40, 60, 0); // a loss opens nothing
    expect(isUnlocked(save, 1)).toBe(false);
    save = recordResult(save, 'pickle', 70, 60, 1);
    expect(isUnlocked(save, 1)).toBe(true);
    expect(nextRung(save)).toBe(1);
    for (const r of ['donut', 'sandy'] as const) save = recordResult(save, r, 100, 90, 1);
    expect(isChampion(save)).toBe(false);
    save = recordResult(save, 'carl', 160, 150, 1);
    expect(isChampion(save)).toBe(true);
    expect(nextRung(save)).toBe(-1);
  });

  it('keeps your record and your best stars', () => {
    let save = recordResult(NEW_CAREER, 'pickle', 90, 40, 3);
    save = recordResult(save, 'pickle', 30, 50, 0);
    save = recordResult(save, 'pickle', 50, 50, 0);
    expect(save.results.pickle).toEqual({ wins: 1, losses: 1, ties: 1, stars: 3 });
    expect(totalStars(save)).toBe(3);
  });

  it('finishing a match clears the one in progress', () => {
    const save = { ...NEW_CAREER, inProgress: { rival: 'pickle' as const, frames: 5, log: [9, 0] } };
    expect(recordResult(save, 'pickle', 60, 50, 1).inProgress).toBeUndefined();
  });

  it('copes with a missing or broken save', () => {
    expect(loadCareer(null)).toEqual(NEW_CAREER);
    expect(loadCareer({ version: 99 })).toEqual(NEW_CAREER);
    expect(loadCareer('nonsense')).toEqual(NEW_CAREER);
  });
});

describe('stars', () => {
  it('spots turkeys and clean games', () => {
    expect(hadTurkey(turkey5, 5)).toBe(true);
    expect(hadTurkey(spares5, 5)).toBe(false);
    expect(hadTurkey([10, 10, 9, 1, 10, 10, 5, 4], 5)).toBe(false); // strikes, but never three in a row
    expect(noOpenFrames(spares5, 5)).toBe(true);
    expect(noOpenFrames(turkey5, 5)).toBe(false);
  });

  it('gives none for a loss, one for a narrow win, more for a big or stylish one', () => {
    expect(starsFor(open5, spares5, 5)).toMatchObject({ stars: 0, won: false });
    expect(starsFor([9, 0, 9, 0, 9, 0, 9, 0, 9, 1, 1], open5, 5).stars).toBe(1); // 46 v 45
    expect(starsFor(spares5, open5, 5)).toEqual({ stars: 3, won: true, bigWin: true, flair: true }); // 95 v 45, all spares
    expect(starsFor(turkey5, [9, 0, 9, 0, 9, 0, 9, 0, 9, 0], 5)).toMatchObject({ stars: 3, flair: true });
  });

  it('a big win means 3 pins a frame: 15 in a 5-frame match, 30 in a full game', () => {
    expect(starsFor([9, 0, 9, 0, 9, 0, 9, 0, 9, 0], [6, 0, 6, 0, 6, 0, 6, 0, 6, 0], 5).bigWin).toBe(true); // by 15
    expect(starsFor([9, 0, 9, 0, 9, 0, 9, 0, 9, 0], [6, 0, 6, 0, 6, 0, 6, 0, 7, 0], 5).bigWin).toBe(false); // by 14
  });
});

describe('resuming a match', () => {
  it('replaying the saved balls puts the match back exactly where it was', () => {
    const live = new Match(['You', 'Pickle Pete'], 5);
    const log: number[] = [];
    for (const pins of [10, 3, 4, 9, 1, 2, 2]) {
      live.recordRoll(pins);
      log.push(pins);
    }
    const resumed = new Match(['You', 'Pickle Pete'], 5);
    for (const pins of log) resumed.recordRoll(pins);
    expect(resumed.players.map((p) => p.rolls)).toEqual(live.players.map((p) => p.rolls));
    expect(resumed.current).toBe(live.current);
    expect(resumed.position).toEqual(live.position);
  });
});

describe('the whole career', () => {
  it('has five venues, every rival in exactly one, each topped by a champion', () => {
    expect(LADDERS.map((l) => l.id)).toEqual(['classic', 'server', 'disco', 'rooftop', 'golden']);
    const all = LADDERS.flatMap((l) => l.rungs.map((r) => r.rival));
    expect(new Set(all).size).toBe(RIVALS.length);
    expect(all.sort()).toEqual(RIVALS.map((r) => r.id).sort());
    for (const l of LADDERS) expect(l.rungs[l.rungs.length - 1].champion).toBe(true);
    // Full games from the second venue on
    expect(LADDERS.slice(1).every((l) => l.rungs.every((r) => r.frames === 10))).toBe(true);
    expect(ladderOf('pumpkin').id).toBe('golden');
  });

  it('opens each venue once you are champion of the one before', () => {
    let save = NEW_CAREER;
    expect(LADDERS.map((_, i) => isLadderOpen(save, i))).toEqual([true, false, false, false, false]);
    for (const r of HOME_LADDER) save = recordResult(save, r.rival, 100, 90, 1);
    expect(isLadderOpen(save, 1)).toBe(true);
    expect(isLadderOpen(save, 2)).toBe(false);
    expect(metRivals(save)).toEqual(['pickle', 'donut', 'sandy', 'carl', 'chip', 'cookie', 'wafer', 'brie']);
  });

  it('plays each venue under its own lane rule', () => {
    const [classic, server, disco, rooftop, golden] = LADDERS;
    expect(laneFor(classic, STANDARD_LANE)).toEqual(STANDARD_LANE);
    expect(laneFor(server, STANDARD_LANE).oilEnd).toBeLessThan(STANDARD_LANE.oilEnd); // oil runs further
    expect(laneFor(golden, STANDARD_LANE).oilEnd).toBeGreaterThan(STANDARD_LANE.oilEnd); // dry lanes
    expect(laneFor(disco, STANDARD_LANE).pinBounce).toBeGreaterThan(STANDARD_LANE.pinBounce);
    const winds = [0, 0.25, 0.5, 0.99].map((r) => laneFor(rooftop, STANDARD_LANE, () => r).wind);
    expect(winds[0]).toBeLessThan(0);
    expect(winds[3]).toBeGreaterThan(0);
    expect(Math.max(...winds.map(Math.abs))).toBeLessThanOrEqual(rooftop.rule!.breeze!);
    expect(winds.every((w) => w !== 0)).toBe(true); // never perfectly still up there
  });
});

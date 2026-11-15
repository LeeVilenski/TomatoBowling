import { describe, expect, it } from 'vitest';
import { allShotsMade, CHALLENGES, GOES, isShotOpen, loadSkills, mirror, NEW_SKILLS, OBSTACLE_HALF, recordScore, skillsStars, starsFor } from './challenges';
import { LANE_HALF, PIT_END_Z } from './dimensions';

describe('skills challenge', () => {
  it(`every challenge is ${GOES} shots, each with pins and junk on the lane`, () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      expect(c.goes).toHaveLength(GOES);
      for (const go of c.goes) {
        expect(go.pins.length).toBeGreaterThan(0);
        expect(go.pins.every((p) => p >= 1 && p <= 10)).toBe(true);
        expect(go.obstacles.length).toBeGreaterThan(0);
        for (const o of go.obstacles) {
          expect(o.z).toBeLessThan(-1);
          expect(o.z).toBeGreaterThan(PIT_END_Z);
          expect(Math.abs(o.x)).toBeLessThan(LANE_HALF + OBSTACLE_HALF.keyboard[0]);
        }
      }
    }
  });

  it('no challenge repeats the same shot', () => {
    for (const c of CHALLENGES) expect(new Set(c.goes.map((g) => JSON.stringify(g))).size).toBe(GOES);
  });

  it('mirrors a shot across the lane: the 7 becomes the 10', () => {
    const m = mirror({ pins: [4, 7], obstacles: [{ kind: 'keyboard', x: -0.3, z: -13, angle: 0.5 }] });
    expect(m.pins).toEqual([6, 10]);
    expect(m.obstacles[0]).toMatchObject({ x: 0.3, z: -13, angle: -0.5 });
    expect(mirror(mirror({ pins: [2, 8], obstacles: [] })).pins).toEqual([2, 8]);
  });

  it('stars: 3 of 5 for one, 4 for two, 5 for three', () => {
    expect([0, 1, 2, 3, 4, 5].map(starsFor)).toEqual([0, 0, 0, 1, 2, 3]);
  });

  it('opens one challenge at a time and keeps your best', () => {
    expect(isShotOpen(NEW_SKILLS, 0)).toBe(true);
    let s = recordScore(NEW_SKILLS, CHALLENGES[0].id, 2);
    expect(isShotOpen(s, 1)).toBe(false);
    s = recordScore(s, CHALLENGES[0].id, 4);
    s = recordScore(s, CHALLENGES[0].id, 1);
    expect(s.best[CHALLENGES[0].id]).toBe(4);
    expect(isShotOpen(s, 1)).toBe(true);
    expect(skillsStars(s)).toBe(2);
  });

  it('is complete once every challenge has a star', () => {
    let s = NEW_SKILLS;
    for (const c of CHALLENGES.slice(0, -1)) s = recordScore(s, c.id, 5);
    expect(allShotsMade(s)).toBe(false);
    s = recordScore(s, CHALLENGES[CHALLENGES.length - 1].id, 3);
    expect(allShotsMade(s)).toBe(true);
  });

  it('tidies a saved game: unknown challenges dropped, scores kept in range', () => {
    expect(loadSkills({ best: { hello: 9, nope: 2, mousetrap: -1 } })).toEqual({ best: { hello: 5, mousetrap: 0 } });
    // Saves from the first version (three goes, stars only) start afresh
    expect(loadSkills({ stars: { hello: 3 } } as never)).toEqual({ best: {} });
  });
});

import { describe, expect, it } from 'vitest';
import { allShotsMade, ATTEMPTS, CHALLENGES, isShotOpen, loadSkills, NEW_SKILLS, OBSTACLE_HALF, recordShot, skillsStars, starsForAttempt } from './challenges';
import { LANE_HALF, PIT_END_Z } from './dimensions';

describe('skills challenge', () => {
  it('every shot has pins, junk on the lane and a unique id', () => {
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(CHALLENGES.length);
    for (const c of CHALLENGES) {
      expect(c.pins.length).toBeGreaterThan(0);
      expect(c.pins.every((p) => p >= 1 && p <= 10)).toBe(true);
      expect(c.obstacles.length).toBeGreaterThan(0);
      for (const o of c.obstacles) {
        // On the lane, past the foul line and short of the pit
        expect(o.z).toBeLessThan(-1);
        expect(o.z).toBeGreaterThan(PIT_END_Z);
        expect(Math.abs(o.x)).toBeLessThan(LANE_HALF + OBSTACLE_HALF.keyboard[0]);
      }
    }
  });

  it('fewer goes earn more stars', () => {
    expect([1, 2, 3].map(starsForAttempt)).toEqual([3, 2, 1]);
    expect(starsForAttempt(ATTEMPTS + 1)).toBe(0);
  });

  it('opens one shot at a time and keeps your best stars', () => {
    expect(isShotOpen(NEW_SKILLS, 0)).toBe(true);
    expect(isShotOpen(NEW_SKILLS, 1)).toBe(false);
    let s = recordShot(NEW_SKILLS, CHALLENGES[0].id, 3);
    expect(isShotOpen(s, 1)).toBe(true);
    s = recordShot(s, CHALLENGES[0].id, 1);
    s = recordShot(s, CHALLENGES[0].id, 2);
    expect(s.stars[CHALLENGES[0].id]).toBe(3);
    expect(skillsStars(s)).toBe(3);
  });

  it('is complete once every shot is made', () => {
    let s = NEW_SKILLS;
    for (const c of CHALLENGES.slice(0, -1)) s = recordShot(s, c.id, 2);
    expect(allShotsMade(s)).toBe(false);
    s = recordShot(s, CHALLENGES[CHALLENGES.length - 1].id, 3);
    expect(allShotsMade(s)).toBe(true);
  });

  it('tidies a saved game: unknown shots dropped, stars kept in range', () => {
    expect(loadSkills({ stars: { hello: 7, nope: 2, mousetrap: -1 } })).toEqual({ stars: { hello: 3, mousetrap: 0 } });
    expect(loadSkills(null)).toEqual({ stars: {} });
  });
});

import { describe, expect, it } from 'vitest';
import { BALL_STATS, ballEffects, ballStats } from './balls';
import { ITEMS } from './unlocks';

describe('ball stats', () => {
  it('every ball Dave can unlock has stats from 1 to 5, and a look', async () => {
    const { BALL_STYLES } = await import('../scene/models');
    for (const item of ITEMS.filter((i) => i.kind === 'ball')) {
      const s = BALL_STATS[item.id];
      expect(s, item.name).toBeDefined();
      for (const v of [s.power, s.spin, s.aim]) expect(v >= 1 && v <= 5 && Number.isInteger(v), item.name).toBe(true);
      expect(BALL_STYLES[item.id], item.name).toBeDefined();
    }
  });

  it('the Classic Tomato and the rivals’ balls bowl exactly as standard', () => {
    for (const id of ['classic', 'pickle-strike', 'anything-else']) {
      const fx = ballEffects(id);
      expect(fx.speed).toBe(1);
      expect(fx.mass).toBe(1);
      expect(fx.spin).toBe(1);
      expect(fx.pinAction).toBe(1);
      expect(fx.reach).toBe(1);
      expect(fx.truePath).toBe(false);
    }
  });

  it('more stars do more', () => {
    expect(ballEffects('beefsteak').speed).toBeGreaterThan(ballEffects('classic').speed);
    expect(ballEffects('beefsteak').mass).toBeGreaterThan(1);
    expect(ballEffects('plum').spin).toBeGreaterThan(ballEffects('classic').spin);
    expect(ballEffects('tomatillo').throughPins).toBe(true);
    expect(ballEffects('beefsteak').reach).toBeLessThan(1);
    expect(ballStats('golden').aim).toBe(5);
  });

  it('later unlocks are no worse overall than the Classic', () => {
    const total = (id: string) => {
      const s = ballStats(id);
      return s.power + s.spin + s.aim;
    };
    for (const item of ITEMS.filter((i) => i.kind === 'ball')) expect(total(item.id), item.name).toBeGreaterThanOrEqual(total('classic'));
  });
});

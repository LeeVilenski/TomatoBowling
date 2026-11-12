import { describe, expect, it } from 'vitest';
import { pickLine, pickVsLine } from './reactions';
import { RIVALS } from './rivals';

describe('rivals', () => {
  it('each has something to say about every kind of ball', () => {
    for (const r of RIVALS) {
      for (const [kind, lines] of Object.entries(r.lines)) expect(lines.length, `${r.name}: ${kind}`).toBeGreaterThan(1);
    }
  });

  it("speak their own lines, and don't repeat themselves back to back", () => {
    const carl = RIVALS.find((r) => r.id === 'carl')!;
    let last = '';
    for (let i = 0; i < 20; i++) {
      const line = pickLine('strike', Math.random, carl.lines, carl.id);
      expect(carl.lines.strike).toContain(line);
      expect(line).not.toBe(last);
      last = line;
    }
  });
});

describe('trash talk', () => {
  it('every rival has three intros and something to say win or lose', () => {
    for (const r of RIVALS) {
      expect(r.intro.length, r.name).toBeGreaterThanOrEqual(3);
      expect(r.win.length, r.name).toBeGreaterThanOrEqual(2);
      expect(r.lose.length, r.name).toBeGreaterThanOrEqual(2);
    }
  });

  it("Dave sometimes talks back to the rival after a big ball", () => {
    expect(pickVsLine('strike', 'Carrot Carl', () => 0)).toBe('Your move, Carrot Carl.');
    expect(pickVsLine('strike', 'Carrot Carl', () => 0.9)).toBeNull(); // most of the time, his usual lines
    expect(pickVsLine('gutter', 'Carrot Carl', () => 0)).toBeNull(); // no gloating after a gutter ball
  });
});

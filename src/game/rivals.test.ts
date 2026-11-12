import { describe, expect, it } from 'vitest';
import { pickLine } from './reactions';
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

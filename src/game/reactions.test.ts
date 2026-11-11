import { describe, expect, it } from 'vitest';
import { classifyThrow, CommentPacer, isSplit, pickLine, streakName } from './reactions';

describe('isSplit', () => {
  it('recognises classic splits', () => {
    expect(isSplit([7, 10])).toBe(true);
    expect(isSplit([4, 6])).toBe(true);
    expect(isSplit([4, 6, 7, 10])).toBe(true);
    expect(isSplit([2, 7])).toBe(true);
    expect(isSplit([3, 10, 7])).toBe(true);
  });

  it('connected leaves are not splits', () => {
    expect(isSplit([2, 4, 5, 8])).toBe(false); // bucket
    expect(isSplit([3, 6, 10])).toBe(false);
    expect(isSplit([9, 10])).toBe(false);
    expect(isSplit([10])).toBe(false);
  });

  it('is never a split while the head pin stands', () => {
    expect(isSplit([1, 7, 10])).toBe(false);
  });
});

describe('classifyThrow', () => {
  it('sorts throws into reactions', () => {
    expect(classifyThrow(10, 10, true, [])).toBe('strike');
    expect(classifyThrow(3, 3, false, [])).toBe('spare');
    expect(classifyThrow(10, 10, false, [])).toBe('spare'); // gutter then all ten
    expect(classifyThrow(0, 10, true, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe('gutter');
    expect(classifyThrow(0, 3, false, [4, 7, 8])).toBe('miss');
    expect(classifyThrow(8, 10, true, [7, 10])).toBe('split');
    expect(classifyThrow(8, 10, true, [9, 10])).toBe('good');
    expect(classifyThrow(4, 10, true, [1, 2, 4, 7, 8, 9])).toBe('meh');
  });
});

describe('pickLine', () => {
  it('does not repeat the previous line', () => {
    let last = '';
    for (let i = 0; i < 30; i++) {
      const line = pickLine('strike');
      expect(line).not.toBe(last);
      last = line;
    }
  });
});

describe('CommentPacer', () => {
  it('always comments on the big moments', () => {
    const pacer = new CommentPacer(() => 0.99); // would never pick an ordinary ball
    for (const kind of ['strike', 'spare', 'split', 'gutter', 'miss'] as const) expect(pacer.shouldComment(kind)).toBe(true);
  });

  it('comments on some ordinary balls, but never stays quiet for more than two in a row', () => {
    const pacer = new CommentPacer(() => 0.99);
    const said = Array.from({ length: 9 }, () => pacer.shouldComment('meh'));
    expect(said).toEqual([false, false, true, false, false, true, false, false, true]);
    const chatty = new CommentPacer(() => 0.1);
    expect(chatty.shouldComment('good')).toBe(true);
  });
});

describe('streakName', () => {
  it('names runs of three or more strikes', () => {
    expect(streakName(2)).toBeNull();
    expect(streakName(3)).toBe('TURKEY!');
    expect(streakName(4)).toBe('HAMBONE!');
    expect(streakName(7)).toBe('7-BAGGER!');
  });
});

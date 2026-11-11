import { describe, expect, it } from 'vitest';
import { maxPossible, position, scoreFrames, splitFrames } from './scoring';

const repeat = (n: number, ...rolls: number[]) => Array.from({ length: n }, () => rolls).flat();

describe('scoreFrames', () => {
  it('perfect game is 300', () => {
    const r = scoreFrames(repeat(12, 10));
    expect(r.total).toBe(300);
    expect(r.frames.map((f) => f.total)).toEqual([30, 60, 90, 120, 150, 180, 210, 240, 270, 300]);
    expect(r.frames[0].boxes).toEqual(['', 'X']);
    expect(r.frames[9].boxes).toEqual(['X', 'X', 'X']);
  });

  it('gutter game is 0', () => {
    const r = scoreFrames(repeat(20, 0));
    expect(r.total).toBe(0);
    expect(r.frames[0].boxes).toEqual(['-', '-']);
    expect(r.frames[9].boxes).toEqual(['-', '-', '']);
  });

  it('all 9s is 90', () => {
    expect(scoreFrames(repeat(10, 9, 0)).total).toBe(90);
  });

  it('all 5-spares is 150', () => {
    const r = scoreFrames(repeat(21, 5));
    expect(r.total).toBe(150);
    expect(r.frames[0].boxes).toEqual(['5', '/']);
    expect(r.frames[9].boxes).toEqual(['5', '/', '5']);
  });

  it('a spare scores the next ball as a bonus', () => {
    const r = scoreFrames([7, 3, 4, 2]);
    expect(r.frames[0].total).toBe(14);
    expect(r.frames[1].total).toBe(20);
  });

  it('a strike scores the next two balls as a bonus', () => {
    const r = scoreFrames([10, 3, 4]);
    expect(r.frames[0].total).toBe(17);
    expect(r.frames[1].total).toBe(24);
  });

  it('leaves frames blank while bonus balls are pending', () => {
    const r = scoreFrames([10, 10]);
    expect(r.frames[0].total).toBeNull();
    expect(r.frames[1].total).toBeNull();
    expect(r.total).toBe(0);
    const s = scoreFrames([3, 7]);
    expect(s.frames[0].total).toBeNull();
  });

  it('a frame waiting on a bonus hides the frames after it', () => {
    const r = scoreFrames([10, 3]);
    expect(r.frames[0].total).toBeNull();
    expect(r.frames[1].total).toBeNull();
  });

  it('10th frame: strike then a split leftover is marked correctly', () => {
    const r = scoreFrames([...repeat(9, 0, 0), 10, 7, 3]);
    expect(r.frames[9].boxes).toEqual(['X', '7', '/']);
    expect(r.total).toBe(20);
  });

  it('10th frame: two strikes then a count', () => {
    const r = scoreFrames([...repeat(9, 0, 0), 10, 10, 6]);
    expect(r.frames[9].boxes).toEqual(['X', 'X', '6']);
    expect(r.total).toBe(26);
  });

  it('10th frame: spare then strike', () => {
    const r = scoreFrames([...repeat(9, 0, 0), 6, 4, 10]);
    expect(r.frames[9].boxes).toEqual(['6', '/', 'X']);
    expect(r.total).toBe(20);
  });

  it('a gutter then all 10 is a spare, not a strike', () => {
    const r = scoreFrames([0, 10, 5, 0]);
    expect(r.frames[0].boxes).toEqual(['-', '/']);
    expect(r.frames[0].total).toBe(15);
    const tenth = scoreFrames([...repeat(9, 0, 0), 0, 10, 10]);
    expect(tenth.frames[9].boxes).toEqual(['-', '/', 'X']);
    expect(tenth.total).toBe(20);
  });

  it('a sample game scores 168 (worked out by hand)', () => {
    // X 7/ 72 9/ X X X 23 6/ 7/3
    const rolls = [10, 7, 3, 7, 2, 9, 1, 10, 10, 10, 2, 3, 6, 4, 7, 3, 3];
    expect(scoreFrames(rolls).total).toBe(168);
  });
});

describe('position', () => {
  it('starts at frame 1, ball 1, full rack', () => {
    expect(position([])).toEqual({ frame: 0, ball: 0, standing: 10, fresh: true, complete: false });
  });

  it('second ball faces the leftover pins', () => {
    expect(position([7])).toEqual({ frame: 0, ball: 1, standing: 3, fresh: false, complete: false });
  });

  it('a strike moves straight to the next frame', () => {
    expect(position([10])).toEqual({ frame: 1, ball: 0, standing: 10, fresh: true, complete: false });
  });

  it('10th frame gives fresh racks after strikes and spares', () => {
    const nine = repeat(9, 0, 0);
    expect(position([...nine, 10]).standing).toBe(10);
    expect(position([...nine, 10, 4]).standing).toBe(6);
    expect(position([...nine, 10, 10]).standing).toBe(10);
    expect(position([...nine, 3, 7]).standing).toBe(10);
    expect(position([...nine, 3, 7]).ball).toBe(2);
  });

  it('game ends after an open 10th, or after the third ball', () => {
    const nine = repeat(9, 0, 0);
    expect(position([...nine, 3, 4]).complete).toBe(true);
    expect(position([...nine, 3, 7]).complete).toBe(false);
    expect(position([...nine, 3, 7, 5]).complete).toBe(true);
    expect(position(repeat(12, 10)).complete).toBe(true);
  });
});

describe('helpers', () => {
  it('splitFrames groups rolls', () => {
    expect(splitFrames([10, 7, 3, 4])).toEqual([[10], [7, 3], [4]]);
  });

  it('maxPossible from a fresh game is 300', () => {
    expect(maxPossible([])).toBe(300);
    expect(maxPossible(repeat(9, 0, 0))).toBe(30);
  });
});

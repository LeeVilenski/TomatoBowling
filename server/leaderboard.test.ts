import { describe, expect, it } from 'vitest';
import { checkGame, checkName, getScores, MemoryStore, postScore, RATE_LIMIT } from './leaderboard';

const perfect = Array(12).fill(10);
const allNines = Array.from({ length: 10 }, () => [9, 0]).flat();

describe('checkName', () => {
  it('accepts normal names and tidies spaces', () => {
    expect(checkName('  Tomato   Dave ')).toEqual({ ok: true, name: 'Tomato Dave' });
    expect(checkName('Sue2024')).toEqual({ ok: true, name: 'Sue2024' });
  });

  it('rejects empty, long, odd-character and rude names', () => {
    expect(checkName('').ok).toBe(false);
    expect(checkName('   ').ok).toBe(false);
    expect(checkName('ThirteenChars').ok).toBe(false);
    expect(checkName('<script>').ok).toBe(false);
    expect(checkName('Sh1t head').ok).toBe(false);
    expect(checkName(42).ok).toBe(false);
  });

  it('does not block innocent names that contain rude-looking letters', () => {
    expect(checkName('Scunthorpe').ok).toBe(true);
    expect(checkName('Assassin').ok).toBe(true);
  });
});

describe('checkGame', () => {
  it('accepts real finished games', () => {
    expect(checkGame(perfect, 300)).toEqual({ ok: true, score: 300 });
    expect(checkGame(allNines, 90)).toEqual({ ok: true, score: 90 });
  });

  it('rejects a score that does not match the throws', () => {
    expect(checkGame(allNines, 300).ok).toBe(false);
  });

  it('rejects impossible or unfinished games', () => {
    expect(checkGame([...allNines.slice(0, 18), 8, 5], 98).ok).toBe(false); // 13 pins in a frame
    expect(checkGame(allNines.slice(0, 18), 81).ok).toBe(false); // unfinished
    expect(checkGame([...perfect, 10], 300).ok).toBe(false); // extra ball
    expect(checkGame([...allNines.slice(0, 19), 1.5], 90).ok).toBe(false);
    expect(checkGame('lots of strikes', 300).ok).toBe(false);
  });
});

describe('postScore / getScores', () => {
  it('stores scores in order and reports the rank', async () => {
    const store = new MemoryStore();
    const a = await postScore(store, { name: 'Ann', score: 90, rolls: allNines }, '1.1.1.1');
    expect(a).toMatchObject({ status: 201, body: { rank: 1 } });
    const b = await postScore(store, { name: 'Bob', score: 300, rolls: perfect }, '2.2.2.2');
    expect(b).toMatchObject({ status: 201, body: { rank: 1 } });
    const top = (await getScores(store)).body as { scores: { name: string }[] };
    expect(top.scores.map((s) => s.name)).toEqual(['Bob', 'Ann']);
  });

  it('gives a clear error for a bad name or a fake score', async () => {
    const store = new MemoryStore();
    expect((await postScore(store, { name: '', score: 90, rolls: allNines }, 'x')).status).toBe(400);
    expect((await postScore(store, { name: 'Ann', score: 299, rolls: perfect }, 'x')).status).toBe(400);
    expect(store.entries).toHaveLength(0);
  });

  it('limits submissions per IP address', async () => {
    const store = new MemoryStore();
    for (let i = 0; i < RATE_LIMIT; i++) {
      expect((await postScore(store, { name: 'Ann', score: 90, rolls: allNines }, '9.9.9.9')).status).toBe(201);
    }
    expect((await postScore(store, { name: 'Ann', score: 90, rolls: allNines }, '9.9.9.9')).status).toBe(429);
    expect((await postScore(store, { name: 'Bob', score: 90, rolls: allNines }, '8.8.8.8')).status).toBe(201);
  });
});

import { describe, expect, it } from 'vitest';
import { Match } from './match';

describe('Match', () => {
  it('single player: a full game of strikes ends after 12 balls', () => {
    const m = new Match(['Dave']);
    for (let i = 0; i < 11; i++) expect(m.recordRoll(10).gameOver).toBe(false);
    const last = m.recordRoll(10);
    expect(last.gameOver).toBe(true);
    expect(m.totals()).toEqual([300]);
  });

  it('asks for a cleared rack on the second ball and a fresh one after the frame', () => {
    const m = new Match(['Dave']);
    const first = m.recordRoll(7);
    expect(first).toMatchObject({ mark: '7', frameDone: false, freshRack: false });
    const second = m.recordRoll(3);
    expect(second).toMatchObject({ mark: '/', frameDone: true, freshRack: true });
  });

  it('players alternate after each frame', () => {
    const m = new Match(['A', 'B']);
    expect(m.player.name).toBe('A');
    m.recordRoll(3);
    expect(m.player.name).toBe('A');
    const r = m.recordRoll(4);
    expect(r.playerChanged).toBe(true);
    expect(m.player.name).toBe('B');
    expect(m.recordRoll(10).playerChanged).toBe(true);
    expect(m.player.name).toBe('A');
  });

  it('a 10th-frame strike gets bonus balls before the turn passes', () => {
    const m = new Match(['A', 'B']);
    for (let f = 0; f < 9; f++) {
      m.recordRoll(0);
      m.recordRoll(0); // A
      m.recordRoll(0);
      m.recordRoll(0); // B
    }
    expect(m.player.name).toBe('A');
    expect(m.recordRoll(10)).toMatchObject({ playerChanged: false, freshRack: true });
    expect(m.recordRoll(4)).toMatchObject({ playerChanged: false, freshRack: false });
    expect(m.recordRoll(6)).toMatchObject({ mark: '/', playerChanged: true, gameOver: false });
    expect(m.player.name).toBe('B');
    m.recordRoll(1);
    const end = m.recordRoll(1);
    expect(end.gameOver).toBe(true);
    expect(m.totals()).toEqual([20, 2]);
    expect(m.leaders()).toEqual([0]);
  });

  it('calls a gutter then all ten a spare', () => {
    const m = new Match(['A']);
    m.recordRoll(0);
    expect(m.recordRoll(10).mark).toBe('/');
  });

  it('never records more pins than were standing', () => {
    const m = new Match(['A']);
    m.recordRoll(8);
    m.recordRoll(5);
    expect(m.players[0].rolls).toEqual([8, 2]);
  });

  it('reports ties', () => {
    const m = new Match(['A', 'B']);
    for (let i = 0; i < 40; i++) m.recordRoll(0);
    expect(m.gameOver).toBe(true);
    expect(m.leaders()).toEqual([0, 1]);
  });
});

describe('a shorter match', () => {
  it('alternates players and ends after the last frame', () => {
    const m = new Match(['You', 'Pickle Pete'], 5);
    for (let f = 0; f < 4; f++) {
      expect(m.recordRoll(10).playerChanged).toBe(true); // you: strike
      m.recordRoll(3);
      expect(m.recordRoll(4).playerChanged).toBe(true); // Pete: open frame
    }
    expect(m.position.frame).toBe(4);
    m.recordRoll(10);
    m.recordRoll(10);
    const out = m.recordRoll(10); // you: three in the last frame
    expect(out.playerChanged).toBe(true);
    m.recordRoll(1);
    expect(m.recordRoll(1).gameOver).toBe(true);
    expect(m.totals()).toEqual([150, 7 * 4 + 2]);
  });
});

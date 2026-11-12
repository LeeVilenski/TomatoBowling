import { FRAMES, mark, position, scoreFrames } from './scoring';

export interface Player {
  name: string;
  rolls: number[];
}

export interface RollOutcome {
  /** How this ball reads on the scorecard: 'X', '/', '-' or a number. */
  mark: string;
  /** The player finished their frame with this ball. */
  frameDone: boolean;
  /** It's now someone else's turn (only with 2+ players). */
  playerChanged: boolean;
  /** The next ball needs a full rack of 10 pins. */
  freshRack: boolean;
  gameOver: boolean;
}

/** A game for 1–4 players taking turns frame by frame. */
export class Match {
  readonly players: Player[];
  current = 0;

  /** `frames`: 10 for a standard game; career mode's early matches are shorter. */
  constructor(
    names: string[],
    readonly frames = FRAMES,
  ) {
    if (names.length < 1 || names.length > 4) throw new Error('1 to 4 players');
    if (frames < 1 || frames > FRAMES) throw new Error('1 to 10 frames');
    this.players = names.map((name) => ({ name, rolls: [] }));
  }

  get player() {
    return this.players[this.current];
  }

  /** Where the current player is: frame, ball and pins standing. */
  get position() {
    return position(this.player.rolls, this.frames);
  }

  get gameOver() {
    return this.players.every((p) => position(p.rolls, this.frames).complete);
  }

  /** Records `pins` knocked down by the current player and moves the game on. */
  recordRoll(pins: number): RollOutcome {
    const before = position(this.player.rolls, this.frames);
    if (before.complete) throw new Error('This player has finished');
    const clamped = Math.max(0, Math.min(before.standing, Math.round(pins)));
    this.player.rolls.push(clamped);
    const after = position(this.player.rolls, this.frames);
    const frameDone = after.complete || after.frame !== before.frame;

    let playerChanged = false;
    if (frameDone && this.players.length > 1) {
      // Next player who still has frames left
      for (let step = 1; step <= this.players.length; step++) {
        const next = (this.current + step) % this.players.length;
        if (!position(this.players[next].rolls, this.frames).complete) {
          playerChanged = next !== this.current;
          this.current = next;
          break;
        }
      }
    }
    const gameOver = this.gameOver;
    return {
      mark: mark(clamped, before.standing, before.fresh),
      frameDone,
      playerChanged,
      freshRack: gameOver || frameDone || position(this.player.rolls, this.frames).standing === 10,
      gameOver,
    };
  }

  totals() {
    return this.players.map((p) => scoreFrames(p.rolls, this.frames).total);
  }

  /** Indices of the player(s) with the highest score. */
  leaders(): number[] {
    const t = this.totals();
    const best = Math.max(...t);
    return t.flatMap((v, i) => (v === best ? [i] : []));
  }
}

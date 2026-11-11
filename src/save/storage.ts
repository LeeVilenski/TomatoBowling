// Small saved settings and records, kept in the browser. Every access is guarded because
// storage can be unavailable (private browsing, blocked cookies).

const PREFIX = 'tomato-dave:';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // Not saved; the game still works
  }
}

export const storage = {
  bestScore: () => read<number>('best-score', 0),
  /** Saves the score if it's a new best. Returns true when it is. */
  submitScore(score: number): boolean {
    if (score <= read<number>('best-score', 0)) return false;
    write('best-score', score);
    return true;
  },
  playerNames: () => read<string[]>('player-names', ['Player 1', 'Player 2']),
  savePlayerNames: (names: string[]) => write('player-names', names),
  nickname: () => read<string>('nickname', ''),
  saveNickname: (name: string) => write('nickname', name),
  setting: (name: string, fallback: boolean) => read<boolean>('setting-' + name, fallback),
  saveSetting: (name: string, value: boolean) => write('setting-' + name, value),
};

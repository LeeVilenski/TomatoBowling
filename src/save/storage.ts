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
  progress: <T>(fallback: T) => read<T>('progress', fallback),
  saveProgress: (p: unknown) => write('progress', p),
  equipped: () => read<{ ball: string; suit: string }>('equipped', { ball: 'classic', suit: 'navy' }),
  saveEquipped: (e: { ball: string; suit: string }) => write('equipped', e),
  flag: (name: string) => read<boolean>('flag-' + name, false),
  setFlag: (name: string) => write('flag-' + name, true),
  /** Career mode's save (checked and tidied by loadCareer). */
  career: () => read<unknown>('career', null),
  saveCareer: (c: unknown) => write('career', c),
  /** Your wins, losses and ties against each computer rival. */
  vsRecord: () => read<Record<string, { w: number; l: number; t: number }>>('vs-record', {}),
  saveVsRecord: (r: Record<string, { w: number; l: number; t: number }>) => write('vs-record', r),
  count: (name: string) => read<number>('count-' + name, 0),
  saveCount: (name: string, n: number) => write('count-' + name, n),
  text: (name: string, fallback: string) => read<string>('setting-' + name, fallback),
  saveText: (name: string, value: string) => write('setting-' + name, value),
  saveNickname: (name: string) => write('nickname', name),
  setting: (name: string, fallback: boolean) => read<boolean>('setting-' + name, fallback),
  saveSetting: (name: string, value: boolean) => write('setting-' + name, value),
};

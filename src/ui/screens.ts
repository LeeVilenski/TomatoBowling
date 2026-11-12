// The overlay screens (each is a <section> in index.html with the same id).

export const SCREENS = ['menu', 'setup', 'rivals', 'career', 'careerstats', 'matchintro', 'credits', 'pass', 'pause', 'gameover', 'leaderboard', 'wardrobe', 'tutorial'] as const;
export type ScreenId = (typeof SCREENS)[number];

/** Screens shown during a game: the HUD stays up behind them. */
export const IN_GAME_SCREENS: readonly (ScreenId | null)[] = [null, 'pass', 'pause', 'tutorial'];

/** Screens where the camera swings round to show off Dave. */
export const MENU_SHOT_SCREENS: readonly (ScreenId | null)[] = ['menu', 'gameover', 'leaderboard', 'setup', 'rivals', 'career', 'careerstats', 'matchintro', 'credits', 'wardrobe'];

export const $ = (id: string) => document.getElementById(id)!;
export const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Leaderboard rules, kept separate from Vercel and Redis so they can be unit tested.
import { englishDataset, englishRecommendedTransformers, RegExpMatcher } from 'obscenity';
import { position, scoreFrames } from '../src/game/scoring.js';

export const TOP_N = 50;
export const KEEP = 1000; // entries kept in storage
export const RATE_LIMIT = 5; // submissions per IP...
export const RATE_WINDOW = 60 * 60; // ...per hour (seconds)
export const NAME_MAX = 12;

export interface Entry {
  name: string;
  score: number;
  date: string; // ISO date (day only)
}

/** Where scores are kept. Redis in production, an in-memory map in tests. */
export interface LeaderboardStore {
  top(n: number): Promise<Entry[]>;
  /** Adds an entry and returns its 1-based rank. */
  add(entry: Entry): Promise<number>;
  /** Counts a hit against `key` within a window of `seconds`, returning the new count. */
  hit(key: string, seconds: number): Promise<number>;
}

const matcher = new RegExpMatcher({ ...englishDataset.build(), ...englishRecommendedTransformers });

export type NameCheck = { ok: true; name: string } | { ok: false; error: string };

export function checkName(raw: unknown): NameCheck {
  if (typeof raw !== 'string') return { ok: false, error: 'Please enter a name.' };
  const name = raw.trim().replace(/\s+/g, ' ');
  if (name.length === 0) return { ok: false, error: 'Please enter a name.' };
  if (name.length > NAME_MAX) return { ok: false, error: `Names can be up to ${NAME_MAX} characters.` };
  if (!/^[A-Za-z0-9 ]+$/.test(name)) return { ok: false, error: 'Letters, numbers and spaces only.' };
  if (matcher.hasMatch(name)) return { ok: false, error: "Let's keep it family-friendly. Try another name." };
  return { ok: true, name };
}

export type GameCheck = { ok: true; score: number } | { ok: false; error: string };

/**
 * Replays the throws ball by ball: every roll must be a whole number of pins that were
 * actually standing, and the game must be finished. Returns the true score.
 */
export function checkGame(rolls: unknown, claimed: unknown): GameCheck {
  const bad = { ok: false as const, error: "That game doesn't add up." };
  if (!Array.isArray(rolls) || rolls.length < 11 || rolls.length > 21) return bad;
  const played: number[] = [];
  for (const r of rolls) {
    if (typeof r !== 'number' || !Number.isInteger(r) || r < 0) return bad;
    const pos = position(played);
    if (pos.complete || r > pos.standing) return bad;
    played.push(r);
  }
  if (!position(played).complete) return bad;
  const score = scoreFrames(played).total;
  if (score !== claimed) return bad;
  return { ok: true, score };
}

export interface ApiResult {
  status: number;
  body: unknown;
}

export async function getScores(store: LeaderboardStore): Promise<ApiResult> {
  return { status: 200, body: { scores: await store.top(TOP_N) } };
}

export async function postScore(store: LeaderboardStore, body: unknown, ip: string, now = new Date()): Promise<ApiResult> {
  const b = (body ?? {}) as { name?: unknown; score?: unknown; rolls?: unknown };
  const name = checkName(b.name);
  if (!name.ok) return { status: 400, body: { error: name.error } };
  const game = checkGame(b.rolls, b.score);
  if (!game.ok) return { status: 400, body: { error: game.error } };

  const hits = await store.hit(`rate:${ip}`, RATE_WINDOW);
  if (hits > RATE_LIMIT) return { status: 429, body: { error: 'Too many scores from here. Try again in an hour.' } };

  const entry: Entry = { name: name.name, score: game.score, date: now.toISOString().slice(0, 10) };
  const rank = await store.add(entry);
  // The fresh top list comes back too, so the game can show it straight away
  // (GET responses are cached for a few seconds and might not include this entry yet)
  return { status: 201, body: { rank, entry, scores: await store.top(TOP_N) } };
}

/** Simple in-memory store for tests and local development. */
export class MemoryStore implements LeaderboardStore {
  entries: Entry[] = [];
  private hits = new Map<string, number>();

  async top(n: number) {
    return this.entries.slice(0, n);
  }

  async add(entry: Entry) {
    // Equal scores: the earlier entry stays ahead
    let i = this.entries.findIndex((e) => e.score < entry.score);
    if (i === -1) i = this.entries.length;
    this.entries.splice(i, 0, entry);
    this.entries.length = Math.min(this.entries.length, KEEP);
    return i + 1;
  }

  async hit(key: string) {
    const n = (this.hits.get(key) ?? 0) + 1;
    this.hits.set(key, n);
    return n;
  }
}

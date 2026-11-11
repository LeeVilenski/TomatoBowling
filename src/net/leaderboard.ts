// Talks to the /api/scores Vercel function. Every failure turns into a friendly message.

export interface LeaderboardEntry {
  name: string;
  score: number;
  date: string;
}

export class LeaderboardError extends Error {
  /** True when the server is unreachable or not set up (as opposed to a rejected name). */
  constructor(
    message: string,
    readonly offline: boolean,
  ) {
    super(message);
  }
}

const OFFLINE = 'Leaderboard offline — try again later.';

async function call<T>(init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  let res: Response;
  try {
    res = await fetch('/api/scores', { ...init, signal: ctrl.signal });
  } catch {
    throw new LeaderboardError(OFFLINE, true);
  } finally {
    clearTimeout(timer);
  }
  let body: { error?: string } & T;
  try {
    body = await res.json();
  } catch {
    // e.g. the local dev server, which has no API and answers with the web page
    throw new LeaderboardError(OFFLINE, true);
  }
  if (!res.ok) throw new LeaderboardError(body.error ?? OFFLINE, res.status >= 500);
  return body;
}

export async function fetchTopScores(): Promise<LeaderboardEntry[]> {
  const body = await call<{ scores: LeaderboardEntry[] }>();
  return body.scores;
}

export async function submitScore(name: string, score: number, rolls: number[]): Promise<{ rank: number; entry: LeaderboardEntry }> {
  return call({
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, score, rolls }),
  });
}

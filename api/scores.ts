// Vercel Function: GET /api/scores (top 50) and POST /api/scores (submit a finished game).
// Scores live in Upstash Redis, connected through the Vercel Marketplace.
import { Redis } from '@upstash/redis';
import { getScores, KEEP, postScore, type Entry, type LeaderboardStore } from '../server/leaderboard.js';

const KEY = 'tomato-dave:scores';

/**
 * Redis orders equal scores by member text, which would put newer entries first. So each
 * stored score carries a tiny time-based tie-breaker: score - milliseconds/1e13. Earlier entries
 * lose less, so they stay ahead; the shown score is rounded back to a whole number. (Entries
 * stored before this have no tie-breaker, and they are older, so they rank ahead too.)
 */
export const storedScore = (score: number, at: Date) => score - at.getTime() / 1e13;
const MAX_BODY = 2000; // bytes; a full game is well under this

class RedisStore implements LeaderboardStore {
  constructor(private redis: Redis) {}

  async top(n: number): Promise<Entry[]> {
    const raw = await this.redis.zrange<(string | number)[]>(KEY, 0, n - 1, { rev: true, withScores: true });
    const out: Entry[] = [];
    for (let i = 0; i < raw.length; i += 2) {
      const [date, name] = String(raw[i]).split('|');
      out.push({ name, date, score: Math.round(Number(raw[i + 1])) });
    }
    return out;
  }

  async add(entry: Entry) {
    // Members must be unique, so each one carries a random suffix
    const member = `${entry.date}|${entry.name}|${Math.random().toString(36).slice(2, 10)}`;
    await this.redis.zadd(KEY, { score: storedScore(entry.score, new Date()), member });
    const rank = await this.redis.zrevrank(KEY, member);
    await this.redis.zremrangebyrank(KEY, 0, -(KEEP + 1));
    return (rank ?? 0) + 1;
  }

  async hit(key: string, seconds: number) {
    const k = `tomato-dave:${key}`;
    const count = await this.redis.incr(k);
    if (count === 1) await this.redis.expire(k, seconds);
    return count;
  }
}

function store(): LeaderboardStore | null {
  // Vercel's Upstash integration sets KV_REST_API_*; a direct Upstash setup uses UPSTASH_REDIS_REST_*
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new RedisStore(new Redis({ url, token }));
}

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });

const notSetUp = () => json(503, { error: 'The leaderboard is not set up yet.' });

export async function GET() {
  const s = store();
  if (!s) return notSetUp();
  try {
    const r = await getScores(s);
    // Short cache so a busy leaderboard doesn't hit Redis on every view
    return json(r.status, r.body, { 'cache-control': 'public, s-maxage=10, stale-while-revalidate=30' });
  } catch (err) {
    console.error('leaderboard read failed', err);
    return json(502, { error: 'The leaderboard is having a moment. Try again soon.' });
  }
}

export async function POST(request: Request) {
  const s = store();
  if (!s) return notSetUp();
  const text = await request.text();
  if (text.length > MAX_BODY) return json(413, { error: 'Too much data.' });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { error: 'Bad request.' });
  }
  const ip = (request.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
  try {
    const r = await postScore(s, body, ip);
    return json(r.status, r.body);
  } catch (err) {
    console.error('leaderboard write failed', err);
    return json(502, { error: 'The leaderboard is having a moment. Try again soon.' });
  }
}

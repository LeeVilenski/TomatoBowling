// Runs the real /api/scores function against a tiny stand-in for Upstash's REST API.
// Usage: npm run check:api
import http from 'node:http';

type Z = { member: string; score: number }[];
const zsets = new Map<string, Z>();
const counters = new Map<string, number>();

const sorted = (key: string) => (zsets.get(key) ?? []).slice().sort((a, b) => b.score - a.score || (a.member < b.member ? 1 : -1));

function run(cmd: (string | number)[]): unknown {
  const [name, key, ...args] = cmd.map(String);
  switch (name.toLowerCase()) {
    case 'zadd': {
      const z = zsets.get(key) ?? [];
      z.push({ score: Number(args[0]), member: args[1] });
      zsets.set(key, z);
      return 1;
    }
    case 'zrange': {
      const rev = args.map((a) => a.toLowerCase()).includes('rev');
      const withScores = args.map((a) => a.toLowerCase()).includes('withscores');
      let list = sorted(key);
      if (!rev) list = list.reverse();
      const slice = list.slice(Number(args[0]), Number(args[1]) === -1 ? undefined : Number(args[1]) + 1);
      return withScores ? slice.flatMap((e) => [e.member, String(e.score)]) : slice.map((e) => e.member);
    }
    case 'zrevrank': {
      const i = sorted(key).findIndex((e) => e.member === args[0]);
      return i === -1 ? null : i;
    }
    case 'zremrangebyrank': {
      const stop = Number(args[1]);
      const asc = sorted(key).reverse();
      const end = stop < 0 ? asc.length + stop : stop;
      const removed = asc.slice(0, Math.max(0, end + 1));
      zsets.set(key, (zsets.get(key) ?? []).filter((e) => !removed.includes(e)));
      return removed.length;
    }
    case 'incr': {
      const n = (counters.get(key) ?? 0) + 1;
      counters.set(key, n);
      return n;
    }
    case 'expire':
      return 1;
    default:
      throw new Error('unsupported ' + name);
  }
}

const encode = (v: unknown): unknown =>
  typeof v === 'string' ? Buffer.from(v).toString('base64') : Array.isArray(v) ? v.map(encode) : v;

const server = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const b64 = String(req.headers['upstash-encoding'] ?? '').toLowerCase() === 'base64';
    const parsed = JSON.parse(body);
    const pipeline = req.url?.startsWith('/pipeline') || req.url?.startsWith('/multi-exec');
    const answer = (c: (string | number)[]) => {
      const r = run(c);
      return { result: b64 ? encode(r) : r };
    };
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify(pipeline ? parsed.map(answer) : answer(parsed)));
  });
});

async function main() {
  await new Promise<void>((r) => server.listen(8799, r));
  process.env.KV_REST_API_URL = 'http://localhost:8799';
  process.env.KV_REST_API_TOKEN = 'test-token';
  const api = await import('../api/scores.js');

  let failed = false;
  const check = (ok: boolean, msg: string) => {
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
    if (!ok) failed = true;
  };
  const post = (body: unknown, ip = '1.2.3.4') =>
    api.POST(new Request('http://x/api/scores', { method: 'POST', body: JSON.stringify(body), headers: { 'x-forwarded-for': ip } }));

  const nines = Array.from({ length: 10 }, () => [9, 0]).flat();
  let r = await post({ name: 'Ann', score: 90, rolls: nines });
  check(r.status === 201, `submit 90 → ${r.status} ${JSON.stringify(await r.json())}`);
  r = await post({ name: 'Tomato Dave', score: 300, rolls: Array(12).fill(10) }, '5.6.7.8');
  const top = await r.json();
  check(r.status === 201 && top.rank === 1, `submit 300 → rank ${top.rank}`);
  r = await post({ name: 'Cheater', score: 300, rolls: nines });
  check(r.status === 400, `fake score rejected → ${r.status} ${JSON.stringify(await r.json())}`);
  r = await api.POST(new Request('http://x/api/scores', { method: 'POST', body: 'not json' }));
  check(r.status === 400, `garbage body rejected → ${r.status}`);

  r = await api.GET();
  const list = await r.json();
  check(r.status === 200 && list.scores.length === 2, `top list: ${JSON.stringify(list.scores)}`);
  check(list.scores[0].name === 'Tomato Dave' && list.scores[0].score === 300 && list.scores[1].score === 90, 'ordered best first, names and scores intact');

  for (let i = 0; i < 4; i++) await post({ name: 'Ann', score: 90, rolls: nines });
  r = await post({ name: 'Ann', score: 90, rolls: nines });
  check(r.status === 429, `6th submission in an hour is rate limited → ${r.status}`);

  delete process.env.KV_REST_API_URL;
  r = await api.GET();
  check(r.status === 503, `without a database it says "not set up" → ${r.status}`);

  server.close();
  process.exit(failed ? 1 : 0);
}
main();

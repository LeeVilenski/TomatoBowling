// The Wardrobe screen: pick Dave's strike ball, spare ball and suit.
import { ITEMS, unlockedIds, type Item, type Progress } from '../game/unlocks';
import { AIM_LINES, BALL_STATS, STAT_NAMES, ballStats, type BallStats } from '../game/balls';
import { $ } from './screens';

export interface Equipped {
  /** The strike ball, bowled at a full rack. */
  ball: string;
  /** The spare ball, for whatever's left standing (can be the same as the strike ball). */
  spare: string;
  suit: string;
}

/** Each row of the wardrobe: which slot it fills, and which kind of item goes in it. */
const ROWS = [
  { slot: 'ball', kind: 'ball', box: 'wr-balls' },
  { slot: 'spare', kind: 'ball', box: 'wr-spares' },
  { slot: 'suit', kind: 'suit', box: 'wr-suits' },
] as const;

const SWATCHES: Record<string, string> = {
  classic: 'radial-gradient(circle at 35% 30%, #ff6a55, #c81d12)',
  cherry: 'radial-gradient(circle at 35% 30%, #ff7a5c, #e0261b)',
  green: 'radial-gradient(circle at 35% 30%, #b6ea6c, #5ea52c)',
  heirloom: 'repeating-linear-gradient(100deg, #d9361a 0 6px, #ffb02e 6px 10px, #8bbf3a 10px 13px)',
  golden: 'radial-gradient(circle at 35% 30%, #fff1b0, #d4a017)',
  tomatillo: 'radial-gradient(circle at 35% 30%, #d6f08f, #7fa83a)',
  beefsteak: 'radial-gradient(circle at 35% 30%, #ff5a45, #9c140c)',
  plum: 'radial-gradient(circle at 35% 30%, #e8405a, #7a0a1c)',
  sundried: 'radial-gradient(circle at 35% 30%, #b8442a, #5a1208)',
  krim: 'radial-gradient(circle at 35% 30%, #7a3a3a, #2a0c10)',
  discoball: 'repeating-conic-gradient(#e8eaf6 0 10deg, #9aa0c0 10deg 20deg)',
  navy: '#1f2a4d',
  tuxedo: 'linear-gradient(90deg, #121216 40%, #fff 40% 60%, #121216 60%)',
  pinstripe: 'repeating-linear-gradient(90deg, #3a3d48 0 5px, #c9c9d4 5px 6px)',
  circuit: 'repeating-linear-gradient(45deg, #1f6b34 0 6px, #d4a017 6px 7px, #0f3d1e 7px 12px)',
  sunset: 'linear-gradient(180deg, #ffd23a, #ff8a4c 50%, #c8406a)',
  glitter: 'radial-gradient(circle at 30% 30%, #fff 0 2px, transparent 3px), radial-gradient(circle at 70% 60%, #fff 0 2px, transparent 3px), #9b3cc7',
  goldsuit: 'linear-gradient(90deg, #d4a017 40%, #7a1414 40% 60%, #d4a017 60%)',
  blazer: 'linear-gradient(90deg, #7a1414 38%, #d4a017 38% 42%, #fff 42% 58%, #d4a017 58% 62%, #7a1414 62%)',
  tracksuit:
    'linear-gradient(#f3ecd8 0 32%, #d6281c 32% 38%, transparent 38%), linear-gradient(90deg, #1d6b34 22%, #f3ecd8 22% 28%, #d6281c 28% 32%, #f3ecd8 32% 38%, #1d6b34 38% 62%, #f3ecd8 62% 68%, #d6281c 68% 72%, #f3ecd8 72% 78%, #1d6b34 78%)',
};

export function renderWardrobe(progress: Progress, equipped: Equipped, equip: (e: Equipped) => void) {
  const owned = unlockedIds(progress);
  for (const { slot, kind, box: boxId } of ROWS) {
    const box = $(boxId);
    box.innerHTML = '';
    for (const item of ITEMS.filter((i) => i.kind === kind)) {
      const have = owned.has(item.id);
      const on = equipped[slot] === item.id;
      const b = document.createElement('button');
      b.className = `chip${on ? ' on' : ''}${have ? '' : ' locked'}`;
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `<span class="swatch${kind === 'suit' ? ' suit' : ''}" style="background:${SWATCHES[item.id]}"></span><span>${item.name}</span>${
        kind === 'ball' ? statPips(ballStats(item.id)) : ''
      }${have ? '' : `<span class="how">${item.how}</span>`}`;
      if (kind === 'ball') b.title = ballSummary(item);
      b.addEventListener('click', () => {
        if (!have) {
          $('wr-hint').textContent = `🔒 ${item.name}: ${item.how}.${kind === 'ball' ? ` ${ballSummary(item)}` : ''}`;
          return;
        }
        const next = { ...equipped, [slot]: item.id };
        equip(next);
        renderWardrobe(progress, next, equip);
        $('wr-hint').textContent = kind === 'ball' ? `${item.name}: ${ballSummary(item)}` : '';
      });
      box.append(b);
    }
  }
}

/** Three little rows of pips: power, spin and aim line, out of five. */
function statPips(s: BallStats): string {
  const rows = (Object.keys(STAT_NAMES) as (keyof BallStats)[]).map((k) => {
    const pips = Array.from({ length: 5 }, (_, i) => `<i${i < s[k] ? ' class="on"' : ''}></i>`).join('');
    return `<span class="stat"><b>${STAT_NAMES[k][0]}</b>${pips}</span>`;
  });
  return `<span class="stats" aria-label="Power ${s.power}, spin ${s.spin}, aim line ${s.aim} out of 5">${rows.join('')}</span>`;
}

/** How a ball plays, in a sentence or two. */
function ballSummary(item: Item): string {
  const s = ballStats(item.id);
  const blurb = BALL_STATS[item.id]?.blurb ?? '';
  return `${blurb} Power ${s.power}/5 · Spin ${s.spin}/5 · Aim line ${s.aim}/5 (${AIM_LINES[s.aim]}).`;
}

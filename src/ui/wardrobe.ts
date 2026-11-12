// The Wardrobe screen: pick a tomato ball and a suit for Dave.
import { ITEMS, unlockedIds, type Progress } from '../game/unlocks';
import { $ } from './screens';

export interface Equipped {
  ball: string;
  suit: string;
}

const SWATCHES: Record<string, string> = {
  classic: 'radial-gradient(circle at 35% 30%, #ff6a55, #c81d12)',
  cherry: 'radial-gradient(circle at 35% 30%, #ff7a5c, #e0261b)',
  green: 'radial-gradient(circle at 35% 30%, #b6ea6c, #5ea52c)',
  heirloom: 'repeating-linear-gradient(100deg, #d9361a 0 6px, #ffb02e 6px 10px, #8bbf3a 10px 13px)',
  golden: 'radial-gradient(circle at 35% 30%, #fff1b0, #d4a017)',
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
  for (const kind of ['ball', 'suit'] as const) {
    const box = $(kind === 'ball' ? 'wr-balls' : 'wr-suits');
    box.innerHTML = '';
    for (const item of ITEMS.filter((i) => i.kind === kind)) {
      const have = owned.has(item.id);
      const on = equipped[kind] === item.id;
      const b = document.createElement('button');
      b.className = `chip${on ? ' on' : ''}${have ? '' : ' locked'}`;
      b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `<span class="swatch${kind === 'suit' ? ' suit' : ''}" style="background:${SWATCHES[item.id]}"></span><span>${item.name}</span>${
        have ? '' : `<span class="how">${item.how}</span>`
      }`;
      b.addEventListener('click', () => {
        if (!have) {
          $('wr-hint').textContent = `🔒 ${item.name}: ${item.how}.`;
          return;
        }
        const next = { ...equipped, [kind]: item.id };
        equip(next);
        $('wr-hint').textContent = '';
        renderWardrobe(progress, next, equip);
      });
      box.append(b);
    }
  }
}

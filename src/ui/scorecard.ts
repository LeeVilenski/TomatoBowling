import type { Match } from '../game/match';
import { position, scoreFrames } from '../game/scoring';

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** Draws the classic bowling scorecard: one row per player, the current player highlighted. */
export function renderScorecard(el: HTMLElement, match: Match | null) {
  if (!match) {
    el.innerHTML = '';
    return;
  }
  const rows = match.players.map((p, i) => {
    const { frames, total } = scoreFrames(p.rolls);
    const pos = position(p.rolls);
    const isCurrent = i === match.current && !match.gameOver;
    const cells = frames
      .map((f, fi) => {
        const balls = f.boxes.map((b) => `<span class="${b === 'X' || b === '/' ? 'x' : ''}">${b}</span>`).join('');
        const now = isCurrent && pos.frame === fi ? ' now' : '';
        return `<div class="sc-frame${now}"><div class="sc-balls">${balls}</div><div class="sc-ft">${f.total ?? ''}</div></div>`;
      })
      .join('');
    return `<div class="sc-row${isCurrent || match.players.length === 1 ? ' current' : ''}">
      <div class="sc-name" title="${esc(p.name)}">${esc(p.name)}</div>${cells}<div class="sc-total">${total}</div></div>`;
  });

  // Summary line of everyone else, shown on narrow screens instead of their full rows
  const others =
    match.players.length > 1
      ? `<div class="sc-others">${match.players
          .map((p, i) => (i === match.current ? '' : `<span>${esc(p.name)} <b>${scoreFrames(p.rolls).total}</b></span>`))
          .join('')}</div>`
      : '';
  el.innerHTML = rows.join('') + others;
}

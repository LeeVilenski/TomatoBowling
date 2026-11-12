// The game-over submission form and the online leaderboard screen.
import { fetchTopScores, LeaderboardError, submitScore, type LeaderboardEntry } from '../net/leaderboard';
import { storage } from '../save/storage';
import { $, escapeHtml } from './screens';

/** One score waiting to be sent, with its own row on the game-over screen. */
interface Entry {
  score: number;
  rolls: number[];
  input: HTMLInputElement;
  button: HTMLButtonElement;
  msg: HTMLElement;
  sent: boolean;
}

export class LeaderboardScreen {
  private form = $('submit-form') as HTMLFormElement;
  private list = $('lb-entries');
  private entries: Entry[] = [];
  /** The list returned with this device's latest submission, and where that entry sits in it. */
  private fresh: { scores: LeaderboardEntry[]; index: number } | null = null;

  /** `show` opens the leaderboard screen itself. */
  constructor(private show: () => void) {
    this.form.addEventListener('submit', (e) => e.preventDefault());
    $('lb-view').addEventListener('click', () => void this.open());
  }

  /**
   * Offer to submit finished scores: one for a solo game, one per player in pass-and-play.
   * `name` prefills the box (a solo game uses the nickname saved on this device).
   */
  offer(players: { name?: string; score: number; rolls: number[] }[]) {
    this.list.innerHTML = '';
    this.entries = players.map((p) => {
      const row = document.createElement('div');
      row.className = 'lb-entry';
      row.innerHTML = `<div class="player-input">${
        players.length > 1 ? `<span class="lb-pts">${p.score}</span>` : ''
      }<input maxlength="12" autocomplete="nickname" placeholder="Your name" aria-label="Name for score ${p.score}" /><button type="button" class="primary">Submit</button></div><p class="small lb-msg" aria-live="polite"></p>`;
      const entry: Entry = {
        score: p.score,
        rolls: p.rolls,
        input: row.querySelector('input')!,
        button: row.querySelector('button')!,
        msg: row.querySelector('.lb-msg')!,
        sent: false,
      };
      entry.input.value = p.name ?? storage.nickname();
      entry.button.addEventListener('click', () => void this.submit(entry));
      // Enter in a name box sends that row's score.
      entry.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          void this.submit(entry);
        }
      });
      this.list.appendChild(row);
      return entry;
    });
    $('lb-prompt').textContent =
      players.length > 1 ? 'Add your scores to the online leaderboard' : 'Add your score to the online leaderboard';
    this.form.hidden = false;
    $('lb-view').hidden = true;
  }

  /** No submissions for this game (e.g. career matches, which aren't comparable). */
  hide() {
    this.entries = [];
    this.list.innerHTML = '';
    this.form.hidden = true;
  }

  private setMsg(entry: Entry, text: string, kind: '' | 'error' | 'good' = '') {
    entry.msg.textContent = text;
    entry.msg.className = 'small lb-msg ' + kind;
  }

  private async submit(entry: Entry) {
    if (entry.sent || entry.button.disabled) return;
    const name = entry.input.value.trim();
    if (!name) {
      this.setMsg(entry, 'Please enter a name.', 'error');
      return;
    }
    entry.button.disabled = true;
    entry.button.textContent = 'Sending…';
    this.setMsg(entry, '');
    try {
      const res = await submitScore(name, entry.score, entry.rolls);
      if (this.entries.length === 1) storage.saveNickname(res.entry.name);
      this.fresh = { scores: res.scores, index: res.rank - 1 };
      entry.sent = true;
      entry.input.disabled = true;
      entry.button.textContent = 'Sent ✓';
      $('lb-view').hidden = false;
      const who = this.entries.length > 1 ? `${res.entry.name} is` : "You're";
      this.setMsg(
        entry,
        res.rank <= 50 ? `${who} #${res.rank} on the leaderboard! 🍅` : `Submitted! ${who} #${res.rank} — keep bowling to reach the top 50.`,
        'good',
      );
    } catch (err) {
      entry.button.disabled = false;
      entry.button.textContent = 'Submit';
      this.setMsg(entry, err instanceof LeaderboardError ? err.message : 'Something went wrong. Try again.', 'error');
    }
  }

  async open() {
    this.show();
    const list = $('lb-list');
    const status = $('lb-status');
    const best = storage.bestScore();
    $('lb-best').textContent = best > 0 ? `Your best on this device: ${best}` : '';
    list.innerHTML = '';

    // Straight after submitting, show the list that came back with the submission: the
    // regular one is cached for a few seconds and may not have the new score in it yet.
    const fresh = this.fresh;
    this.fresh = null;
    let scores: LeaderboardEntry[];
    let mine = -1;
    if (fresh) {
      scores = fresh.scores;
      mine = fresh.index;
    } else {
      status.textContent = 'Loading…';
      try {
        scores = await fetchTopScores();
      } catch (err) {
        status.textContent = err instanceof LeaderboardError ? err.message : 'Leaderboard offline — try again later.';
        return;
      }
    }
    status.textContent = scores.length ? 'Top 50 of all time' : 'No scores yet — be the first!';
    list.innerHTML = scores
      .map(
        (s, i) =>
          `<li class="${i === mine ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(s.name)}</span><span class="pts">${s.score}</span></li>`,
      )
      .join('');
  }
}

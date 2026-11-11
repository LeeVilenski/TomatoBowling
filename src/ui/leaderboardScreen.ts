// The game-over submission form and the online leaderboard screen.
import { fetchTopScores, LeaderboardError, submitScore, type LeaderboardEntry } from '../net/leaderboard';
import { storage } from '../save/storage';
import { $, escapeHtml } from './screens';

export class LeaderboardScreen {
  private form = $('submit-form') as HTMLFormElement;
  private nameInput = $('lb-name') as HTMLInputElement;
  private submitBtn = $('lb-submit') as HTMLButtonElement;
  private msg = $('lb-msg');
  private pending: { score: number; rolls: number[] } | null = null;
  /** The list returned with this device's latest submission, and where that entry sits in it. */
  private fresh: { scores: LeaderboardEntry[]; index: number } | null = null;

  /** `show` opens the leaderboard screen itself. */
  constructor(private show: () => void) {
    this.form.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.submit();
    });
    $('lb-view').addEventListener('click', () => void this.open());
  }

  /** Offer to submit a finished single-player game. */
  offer(score: number, rolls: number[]) {
    this.pending = { score, rolls };
    this.form.hidden = false;
    this.nameInput.disabled = false;
    this.submitBtn.disabled = false;
    this.submitBtn.textContent = 'Submit';
    this.nameInput.value = storage.nickname();
    this.setMsg('');
    $('lb-view').hidden = true;
  }

  hideForm() {
    this.form.hidden = true;
  }

  private setMsg(text: string, kind: '' | 'error' | 'good' = '') {
    this.msg.textContent = text;
    this.msg.className = 'small ' + kind;
  }

  private async submit() {
    const pending = this.pending;
    if (!pending) return;
    const name = this.nameInput.value.trim();
    if (!name) {
      this.setMsg('Please enter a name.', 'error');
      return;
    }
    this.submitBtn.disabled = true;
    this.submitBtn.textContent = 'Sending…';
    this.setMsg('');
    try {
      const res = await submitScore(name, pending.score, pending.rolls);
      storage.saveNickname(res.entry.name);
      this.fresh = { scores: res.scores, index: res.rank - 1 };
      this.pending = null;
      this.nameInput.disabled = true;
      this.submitBtn.textContent = 'Sent ✓';
      $('lb-view').hidden = false;
      this.setMsg(
        res.rank <= 50 ? `You're #${res.rank} on the leaderboard! 🍅` : `Submitted! You're #${res.rank} — keep bowling to reach the top 50.`,
        'good',
      );
    } catch (err) {
      this.submitBtn.disabled = false;
      this.submitBtn.textContent = 'Submit';
      this.setMsg(err instanceof LeaderboardError ? err.message : 'Something went wrong. Try again.', 'error');
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

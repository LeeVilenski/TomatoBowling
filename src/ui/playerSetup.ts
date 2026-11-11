// Pass & Play setup: 2–4 named players.
import { storage } from '../save/storage';
import { $ } from './screens';

const MAX_PLAYERS = 4;
const NAME_MAX = 12;

export class PlayerSetup {
  private list = $('player-list');
  private addBtn = $('add-player') as HTMLButtonElement;

  constructor(onStart: (names: string[]) => void) {
    this.addBtn.addEventListener('click', () => {
      const names = this.names();
      if (names.length < MAX_PLAYERS) this.render([...names, `Player ${names.length + 1}`]);
    });
    $('start-pass').addEventListener('click', () => {
      const names = this.names();
      storage.savePlayerNames(names);
      onStart(names);
    });
  }

  /** Fill the form with the names used last time. */
  load() {
    const saved = storage.playerNames();
    this.render(saved.length >= 2 && saved.length <= MAX_PLAYERS ? saved : ['Player 1', 'Player 2']);
  }

  private names() {
    return Array.from(this.list.querySelectorAll('input')).map((inp, i) => inp.value.trim().slice(0, NAME_MAX) || `Player ${i + 1}`);
  }

  private render(names: string[]) {
    this.list.innerHTML = '';
    names.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'player-input';
      const input = document.createElement('input');
      input.value = name;
      input.maxLength = NAME_MAX;
      input.placeholder = `Player ${i + 1}`;
      input.setAttribute('aria-label', `Player ${i + 1} name`);
      row.append(input);
      if (names.length > 2) {
        const remove = document.createElement('button');
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove player ${i + 1}`);
        remove.addEventListener('click', () => this.render(this.names().filter((_, j) => j !== i)));
        row.append(remove);
      }
      this.list.append(row);
    });
    this.addBtn.hidden = names.length >= MAX_PLAYERS;
  }
}

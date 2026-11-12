// Plays the production build in a real (headless) browser: a few throws, a pause, a replay.
// Usage: npm run build && npm run check:browser
import { spawn } from 'node:child_process';
import { chromium, type Page } from 'playwright';

const PORT = 4179;
const URL = `http://localhost:${PORT}/`;

type Game = {
  phase: string;
  screen: string | null;
  replay: { end: number } | null;
  match: { players: { rolls: number[] }[]; recordRoll(pins: number): unknown; frames: number } | null;
  physics: { ball: { translation(): { z: number } } };
  scene: { traverse(fn: (o: { visible: boolean; userData: Record<string, unknown> }) => void): void };
  controls: { pause(): void; advance(): void; replay(): void; fastForward(): void; canAim(): boolean };
  startGame(mode: string): void;
  startCpu(id: string): void;
  startCareerMatch(ladder: number, rung: number, log?: number[]): void;
  lane: { wind: number; oilEnd: number };
  showScreen(id: string | null): void;
  career: { results: Record<string, { wins: number } | undefined>; inProgress?: unknown };
  throwBall(x?: number, aim?: number, power?: number, spin?: number): void;
};
declare const window: { __game: Game };

let failed = false;
const check = (ok: boolean, msg: string) => {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${msg}`);
  if (!ok) failed = true;
};

const phase = (page: Page) => page.evaluate(() => window.__game.phase);
const waitPhase = (page: Page, ...phases: string[]) =>
  page.waitForFunction((p) => p.includes(window.__game.phase), phases, { timeout: 60_000 });

async function main() {
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    // Software WebGL, so this works on machines without a GPU (like CI)
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 400 } });
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.addInitScript(() => {
      try {
        localStorage.setItem('tomato-dave:flag-tutorial-seen', 'true');
      } catch {
        // e.g. the browser's own error page while the server is still starting
      }
    });

    for (let i = 0; ; i++) {
      try {
        await page.goto(URL);
        break;
      } catch (err) {
        if (i > 30) throw err;
        await new Promise((r) => setTimeout(r, 500));
      }
    }
    await page.waitForFunction(() => window.__game, null, { timeout: 60_000 });
    check(await page.isVisible('#menu'), 'loads to the main menu');

    await page.evaluate(() => window.__game.startGame('single'));
    check((await phase(page)) === 'aiming', 'a game starts, ready to throw');

    // Throw, then pause mid-roll: nothing should move behind the pause screen
    await page.evaluate(() => window.__game.throwBall(0.06, 0, 0.6, -0.3));
    await page.waitForFunction(() => window.__game.physics.ball.translation().z < -1.5, null, { timeout: 30_000 });
    const before = await page.evaluate(() => {
      window.__game.controls.pause();
      return window.__game.physics.ball.translation().z;
    });
    await page.waitForTimeout(1000);
    const after = await page.evaluate(() => window.__game.physics.ball.translation().z);
    check(before === after && (await phase(page)) === 'rolling', `pause freezes the throw (ball z ${before.toFixed(2)} → ${after.toFixed(2)})`);
    await page.evaluate(() => window.__game.controls.pause());

    await waitPhase(page, 'result');
    const rolls = await page.evaluate(() => window.__game.match!.players[0].rolls);
    check(rolls.length === 1, `the throw is scored (${rolls.join()})`);

    // Replay from the pinsetter camera. Strikes replay on their own; anything else has a button.
    if (rolls[0] === 10) {
      await waitPhase(page, 'replay');
      check(true, 'a strike replays automatically');
    } else {
      check(await page.isVisible('#replay-btn'), 'replay button appears after the throw');
    }
    // The replay camera peeks out from inside the pinsetter: the masking unit stays put
    const maskingShown = () =>
      page.evaluate(() => {
        let shown = 0;
        window.__game.scene.traverse((o) => {
          if (o.userData.masking && o.visible) shown++;
        });
        return shown;
      });
    const maskingBefore = await maskingShown();
    if ((await phase(page)) !== 'replay') await page.evaluate(() => window.__game.controls.replay());
    check((await phase(page)) === 'replay' && (await page.isVisible('#replay-badge')), 'replay starts');
    check(maskingBefore > 0 && (await maskingShown()) === maskingBefore, 'the masking unit stays in place during the replay');
    await waitPhase(page, 'result', 'sweeping', 'aiming');
    check(!(await page.isVisible('#replay-badge')), 'replay finishes and hands back to the game');

    // On to the next ball
    await page.evaluate(() => window.__game.controls.advance());
    await waitPhase(page, 'aiming');
    await page.evaluate(() => window.__game.throwBall(-0.1, 0.2, 0.9, 0));
    await waitPhase(page, 'result');
    const rolls2 = await page.evaluate(() => window.__game.match!.players[0].rolls);
    check(rolls2.length === 2 || rolls[0] === 10, `second ball is scored (${rolls2.join()})`);

    // vs CPU: after your frame, the rival bowls its own, then it's your turn again
    await page.evaluate(() => window.__game.startCpu('pickle'));
    await page.evaluate(() => {
      const m = window.__game.match!;
      m.recordRoll(9);
      m.recordRoll(0); // your frame, scored straight away
    });
    check(!(await page.evaluate(() => window.__game.controls.canAim())), "your controls are locked on the rival's turn");
    await page.waitForFunction(() => window.__game.match!.players[1].rolls.length > 0, null, { timeout: 120_000 });
    const rivalRolls = await page.evaluate(() => window.__game.match!.players[1].rolls);
    check(rivalRolls.length > 0, `the rival bowls a real ball (${rivalRolls.join()})`);

    // Career: finish a match against Pickle Pete (one ball left: his, bowled for real)
    await page.evaluate(() => window.__game.startCareerMatch(0, 0, [10, 3, 4, 10, 3, 4, 10, 3, 4, 10, 3, 4, 10, 10, 10, 3]));
    check((await page.evaluate(() => window.__game.match!.frames)) === 5, 'early career rivals play 5-frame matches');
    await page.waitForFunction(() => window.__game.screen === 'gameover', null, { timeout: 180_000 });
    check(await page.isVisible('#go-career'), 'the career result card appears');
    check((await page.textContent('.career-stars'))?.includes('⭐') ?? false, 'it awards stars');
    const save = await page.evaluate(() => window.__game.career);
    check(save.results.pickle?.wins === 1 && !save.inProgress, 'the win is saved and the match is no longer in progress');
    await page.click('#go-career [data-go="career"]');
    const open = await page.$$eval('#ladder .rung:not(.locked)', (els) => els.length);
    check(open === 2, `beating Pickle Pete unlocks Donut Dana (${open} rungs open)`);

    // Later venues play under their own lane rule: on the Rooftop, a breeze each frame
    await page.evaluate(() => window.__game.startCareerMatch(3, 0));
    const lane = await page.evaluate(() => window.__game.lane);
    check((await page.textContent('#venue-name'))?.includes('Rooftop') ?? false, 'a Rooftop career match is played at the Rooftop');
    check(lane.wind !== 0 && (await page.isVisible('#wind')), `and the breeze is blowing (${lane.wind}) and shown`);
    await page.evaluate(() => window.__game.showScreen('menu'));
    check((await page.evaluate(() => window.__game.lane.wind)) === 0 && !(await page.isVisible('#wind')), 'back at the menu, the lane is back to normal');

    check(errors.length === 0, `no errors in the console${errors.length ? ': ' + errors.join(' | ') : ''}`);
  } finally {
    await browser.close();
    server.kill();
  }
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

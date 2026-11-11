import * as THREE from 'three';
import './style.css';
import { BALL_RADIUS, HEAD_PIN_Z, LANE_HALF, OUTER_HALF } from './game/dimensions';
import { BowlingPhysics, PHYSICS_DT } from './game/physics';
import { Match, type RollOutcome } from './game/match';
import { Pinsetter, type PinsetterMode } from './game/pinsetter';
import { mark } from './game/scoring';
import { storage } from './save/storage';
import { renderScorecard } from './ui/scorecard';
import { attachControls, type ControlTarget } from './input/controls';
import type { SwipeThrow } from './input/swipe';
import { buildAlley } from './scene/alley';
import { createPinMesh, createTomatoBall } from './scene/models';
import { Dave } from './scene/dave';
import { buildDecor } from './scene/decor';
import { Juice } from './scene/juice';
import { classifyThrow, pickLine, type ReactionKind } from './game/reactions';
import { SpeechBubble } from './ui/speech';
import { Sound } from './audio/sound';
import { fetchTopScores, LeaderboardError, submitScore, type LeaderboardEntry } from './net/leaderboard';

type Phase = 'aiming' | 'charging' | 'swinging' | 'rolling' | 'settling' | 'result' | 'sweeping';

const MAX_X = LANE_HALF - BALL_RADIUS - 0.03;
const MAX_ANGLE = (4 * Math.PI) / 180;
const ARROWS_Z = -4.57; // the targeting arrows, 15 ft down the lane
const BALL_START_Z = -0.3;
// Aiming exactly where you swipe is far too twitchy on a phone (the lane is ~60 px wide at
// the arrows), so the swipe's slant is scaled down: ~10° of slant ≈ 3 boards at the arrows.
const AIM_SENSITIVITY = 0.2;
const MIN_SPEED = 3; // a gentle roll (~7 mph)
const MAX_SPEED = 11;
const CHARGE_HALF_CYCLE = 0.8; // seconds for the power meter to go from empty to full
const REACTION_AT = 1.1; // seconds of looking at the pins before cutting to Dave's reaction
const RESULT_PAUSE = 3.6; // seconds before the pinsetter runs on its own
// Where Dave stands relative to the ball: the ball sits in his right hand
const DAVE_OFFSET_X = 0.3;
const DAVE_Z = 0.62;
const BALL_IN_HAND = new THREE.Vector3(0, -0.075, 0);

const clamp = THREE.MathUtils.clamp;
const $ = (id: string) => document.getElementById(id)!;
const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

async function start() {
  const canvas = $('game') as HTMLCanvasElement;
  const status = $('status');
  const readout = $('readout');
  const powerMeter = $('power');
  const powerFill = $('power-fill');
  const spinValue = $('spin-value');
  const scorecardEl = $('scorecard');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 60);
  buildAlley(scene);

  const physics = await BowlingPhysics.create();

  const pinMeshes = physics.pins.map(() => {
    const m = createPinMesh();
    scene.add(m);
    return m;
  });
  const ballMesh = createTomatoBall();
  scene.add(ballMesh);
  buildDecor(scene);
  const dave = new Dave();
  scene.add(dave.root);
  const juice = new Juice(scene);
  const speech = new SpeechBubble($('speech'));
  const sound = new Sound();
  // Browsers only allow audio after the player interacts with the page
  const unlockAudio = () => sound.unlock();
  window.addEventListener('pointerdown', unlockAudio, true);
  window.addEventListener('keydown', unlockAudio, true);

  const sweepBar = new THREE.Mesh(
    new THREE.BoxGeometry(OUTER_HALF * 2 + 0.1, 0.1, 0.04),
    new THREE.MeshStandardMaterial({ color: '#2d2f36', metalness: 0.6, roughness: 0.4 }),
  );
  sweepBar.castShadow = true;
  scene.add(sweepBar);
  const pinsetter = new Pinsetter(physics, sweepBar);

  // Aim guide: dashed line showing roughly where the ball will go, including the hook
  const AIM_POINTS = 40;
  const aimGeo = new THREE.BufferGeometry().setFromPoints(Array.from({ length: AIM_POINTS }, () => new THREE.Vector3()));
  const aimLine = new THREE.Line(
    aimGeo,
    new THREE.LineDashedMaterial({ color: '#ffe066', dashSize: 0.18, gapSize: 0.12, transparent: true, opacity: 0.8 }),
  );
  scene.add(aimLine);

  // ---- Throw state ----
  let phase: Phase = 'aiming';
  let aimX = 0;
  let aim = 0; // -1..1
  let spin = 0; // -1..1 (keyboard / mouse spin setting)
  let power = 0;
  let chargeStart = 0;
  let settleTime = 0;
  let resultTime = 0;
  let downBefore = 0;
  let lastThrow = { speed: 0, spin: 0, knocked: 0 };
  let reaction: ReactionKind = 'meh';
  let reactionShown = false;
  const splashed = new Set<number>();
  let releaseBlend = 0; // eases the ball from Dave's hand down onto the lane
  let inGutter = false;
  const releaseFrom = new THREE.Vector3();

  // ---- Game mode state ----
  type Mode = 'single' | 'pass' | 'practice';
  let mode: Mode = 'single';
  let match: Match | null = null;
  let outcome: RollOutcome | null = null;
  let practiceBall: 1 | 2 = 1;
  let practiceRack: number[] | null = null; // a spare setup being practised, or null for full racks
  let nextSetter: PinsetterMode = 'rerack';
  let openScreen: string | null = null;

  const setStatus = (text: string) => (status.textContent = text);
  const spinLabel = (v: number) => (Math.abs(v) < 0.005 ? 'none' : `${v < 0 ? '◀' : '▶'} ${Math.round(Math.abs(v) * 100)}%`);

  /** `thrownSpin` shows the spin of a swipe throw instead of the keyboard/mouse setting. */
  function updateReadout(thrownSpin?: number) {
    let where: string;
    if (mode === 'practice') {
      where = practiceRack ? 'Spare practice' : `Practice · Ball ${practiceBall}`;
    } else if (match) {
      const pos = match.position;
      where = `${match.players.length > 1 ? match.player.name + ' · ' : ''}Frame ${Math.min(pos.frame + 1, 10)} · Ball ${pos.ball + 1}`;
    } else {
      where = '';
    }
    readout.textContent = `${where} · Spin ${spinLabel(thrownSpin ?? spin)}`;
    spinValue.textContent = spinLabel(spin);
  }

  function showPower(p: number, visible: boolean) {
    powerMeter.classList.toggle('visible', visible);
    powerFill.style.transform = `scaleY(${p})`;
  }

  function launch(p: number, aimValue: number, spinValue: number) {
    const speed = MIN_SPEED + p * (MAX_SPEED - MIN_SPEED);
    downBefore = physics.pinsDown();
    physics.throwBall({ x: aimX, angle: aimValue * MAX_ANGLE, speed, spin: spinValue });
    lastThrow = { speed, spin: spinValue, knocked: 0 };
    splashed.clear();
    sound.release();
    inGutter = false;
    releaseFrom.copy(ballMesh.position);
    releaseBlend = 1;
    phase = 'rolling';
    settleTime = 0;
    setStatus(`Rolling… ${speed.toFixed(1)} m/s · spin ${spinLabel(spinValue)}`);
    updateReadout(spinValue);
  }

  function resultMessage(m: string, knocked: number, firstBall: boolean) {
    if (m === 'X') return 'STRIKE! 🍅';
    if (m === '/') return 'Spare! 🍅';
    if (m === '-') return firstBall ? 'Gutter… saucy.' : 'Missed!';
    return `${knocked} pin${knocked === 1 ? '' : 's'}`;
  }

  function finishThrow() {
    const totalDown = physics.pinsDown();
    const knocked = totalDown - downBefore;
    const standingBefore = 10 - downBefore;
    lastThrow.knocked = knocked;
    phase = 'result';
    resultTime = 0;
    reactionShown = false;
    const fresh = mode === 'practice' ? !practiceRack && practiceBall === 1 : (match?.position.fresh ?? true);
    reaction = classifyThrow(knocked, standingBefore, fresh, physics.standingPins());
    if (reaction === 'strike') sound.cheer();
    else if (reaction === 'spare') sound.applause(1.6, 0.8);
    else if (reaction === 'good') sound.applause(1, 0.45);
    else if (reaction === 'gutter' || reaction === 'miss') sound.groan();
    if (reaction === 'strike') {
      // Extra-juicy strike
      juice.splash(new THREE.Vector3(0, 0.25, HEAD_PIN_Z - 0.35), 1.5, new THREE.Vector3(0, 0, -1));
    }

    if (mode === 'practice') {
      if (practiceRack) {
        setStatus(knocked === standingBefore ? 'Picked it up! 🍅' : `Missed — ${standingBefore - knocked} left`);
        nextSetter = 'rerack';
      } else if (practiceBall === 1) {
        setStatus(resultMessage(mark(knocked, 10, true), knocked, true));
        nextSetter = knocked === 10 ? 'rerack' : 'clear';
      } else {
        setStatus(resultMessage(mark(knocked, standingBefore, false), knocked, false));
        nextSetter = 'rerack';
      }
      return;
    }

    if (!match) return;
    const firstBall = match.position.ball === 0;
    outcome = match.recordRoll(knocked);
    renderScorecard(scorecardEl, match);
    setStatus(resultMessage(outcome.mark, knocked, firstBall));
    nextSetter = outcome.freshRack ? 'rerack' : 'clear';
  }

  function runPinsetter(setterMode: PinsetterMode) {
    phase = 'sweeping';
    dave.idle();
    speech.hide();
    sound.pinsetter();
    physics.holdBall(aimX);
    setStatus(setterMode === 'clear' ? 'Clearing the deadwood…' : 'Setting the pins…');
    const rack = setterMode === 'rerack' && mode === 'practice' && practiceRack ? practiceRack : undefined;
    pinsetter.start(setterMode, () => afterPinsetter(setterMode), rack);
  }

  /** What happens once the pins are set: next ball, next player, or the end of the game. */
  function afterPinsetter(setterMode: PinsetterMode) {
    aim = 0; // each ball starts aimed straight down the lane
    phase = 'aiming';
    if (mode === 'practice') {
      practiceBall = setterMode === 'clear' ? 2 : 1;
      setStatus(practiceRack ? 'Pick up the spare!' : practiceBall === 1 ? 'Line up and throw!' : 'Second ball — pick up the spare!');
      updateReadout();
      return;
    }
    if (!match) return;
    const done = outcome;
    outcome = null;
    if (done?.gameOver) {
      showGameOver();
      return;
    }
    if (done?.playerChanged && mode === 'pass') {
      $('pass-name').textContent = match.player.name;
      $('pass-score').textContent = `Score so far: ${match.totals()[match.current]}`;
      showScreen('pass');
    }
    setTurnStatus();
  }

  function setTurnStatus() {
    if (!match) return;
    const pos = match.position;
    const who = mode === 'pass' ? `${match.player.name}, ` : '';
    const say = (text: string) => setStatus(who ? who + text : text.charAt(0).toUpperCase() + text.slice(1));
    if (pos.frame === 9 && pos.ball === 2) say('bonus ball!');
    else if (pos.ball === 0) say(pos.frame === 9 ? 'final frame!' : 'line up and throw!');
    else say(pos.standing === 10 ? 'bonus ball!' : 'pick up the spare!');
    updateReadout();
    renderScorecard(scorecardEl, match);
  }

  // ---- Screens ----
  const screens = ['menu', 'setup', 'pass', 'pause', 'gameover', 'leaderboard'];
  function showScreen(id: string | null) {
    openScreen = id;
    sound.setMusicMood(id === null || id === 'pass' ? 'game' : 'menu');
    for (const s of screens) ($(s) as HTMLElement).hidden = s !== id;
    const inGame = id === null || id === 'pass' || id === 'pause';
    $('hud').hidden = !inGame;
    $('pause-btn').hidden = id !== null;
    $('hint').hidden = id !== null;
    $('spin').hidden = id !== null;
    $('practice-panel').hidden = !(id === null && mode === 'practice');
    if (id === 'menu') {
      dave.wave();
      speech.hide();
      const best = storage.bestScore();
      $('menu-best').textContent = best > 0 ? `Your best: ${best}` : '';
    }
  }

  /** Clears the lane and starts a new game in the chosen mode. */
  function startGame(newMode: Mode, names: string[] = ['You']) {
    mode = newMode;
    match = newMode === 'practice' ? null : new Match(names);
    outcome = null;
    practiceBall = 1;
    practiceRack = null;
    spin = 0;
    aim = 0;
    aimX = 0;
    physics.resetPins();
    physics.holdBall(aimX);
    pinsetter.cancel();
    phase = 'aiming';
    dave.idle();
    speech.hide();
    renderScorecard(scorecardEl, match);
    updatePracticeButtons();
    showScreen(null);
    if (match) setTurnStatus();
    else {
      setStatus('Practice: throw as much as you like');
      updateReadout();
    }
  }

  function showGameOver() {
    if (!match) return;
    const totals = match.totals();
    const top = Math.max(...totals);
    dave.react(top >= 150 ? 'strike' : top >= 90 ? 'good' : 'meh');
    const body = $('go-body');
    if (match.players.length === 1) {
      const score = totals[0];
      const best = storage.bestScore();
      const isBest = storage.submitScore(score);
      $('go-title').textContent = score === 300 ? 'PERFECT GAME!' : 'Game over';
      body.innerHTML = `<div class="big-score">${score}</div><p class="small">${
        isBest ? (best > 0 ? '🍅 New personal best!' : '🍅 First game in the books!') : `Your best: ${best}`
      }</p>`;
      offerSubmission(score, [...match.players[0].rolls]);
    } else {
      const leaders = match.leaders();
      const order = match.players.map((p, i) => ({ name: p.name, score: totals[i], i })).sort((a, b) => b.score - a.score);
      ($('submit-form') as HTMLFormElement).hidden = true;
      $('go-title').textContent = leaders.length > 1 ? "It's a tie!" : `${match.players[leaders[0]].name} wins!`;
      body.innerHTML = `<ul class="results">${order
        .map((r) => `<li class="${leaders.includes(r.i) ? 'win' : ''}"><span>${escapeHtml(r.name)}</span><span>${r.score}</span></li>`)
        .join('')}</ul>`;
    }
    showScreen('gameover');
  }

  // ---- Online leaderboard ----
  let mine: LeaderboardEntry | null = null; // the score this device just submitted, to highlight it
  const form = $('submit-form') as HTMLFormElement;
  const nameInput = $('lb-name') as HTMLInputElement;
  const submitBtn = $('lb-submit') as HTMLButtonElement;
  const lbMsg = $('lb-msg');
  let pending: { score: number; rolls: number[] } | null = null;

  function setLbMsg(text: string, kind: '' | 'error' | 'good' = '') {
    lbMsg.textContent = text;
    lbMsg.className = 'small ' + kind;
  }

  function offerSubmission(score: number, rolls: number[]) {
    pending = { score, rolls };
    form.hidden = false;
    nameInput.disabled = false;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Submit';
    nameInput.value = storage.nickname();
    setLbMsg('');
    $('lb-view').hidden = true;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!pending) return;
    const name = nameInput.value.trim();
    if (!name) {
      setLbMsg('Please enter a name.', 'error');
      return;
    }
    submitBtn.disabled = true;
    submitBtn.textContent = 'Sending…';
    setLbMsg('');
    try {
      const res = await submitScore(name, pending.score, pending.rolls);
      storage.saveNickname(res.entry.name);
      mine = res.entry;
      pending = null;
      nameInput.disabled = true;
      submitBtn.textContent = 'Sent ✓';
      $('lb-view').hidden = false;
      setLbMsg(res.rank <= 50 ? `You're #${res.rank} on the leaderboard! 🍅` : `Submitted! You're #${res.rank} — keep bowling to reach the top 50.`, 'good');
    } catch (err) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit';
      setLbMsg(err instanceof LeaderboardError ? err.message : 'Something went wrong. Try again.', 'error');
    }
  });

  $('lb-view').addEventListener('click', () => void openLeaderboard());

  async function openLeaderboard() {
    showScreen('leaderboard');
    const list = $('lb-list');
    const status = $('lb-status');
    const best = storage.bestScore();
    $('lb-best').textContent = best > 0 ? `Your best on this device: ${best}` : '';
    list.innerHTML = '';
    status.textContent = 'Loading…';
    try {
      const scores = await fetchTopScores();
      status.textContent = scores.length ? 'Top 50 of all time' : 'No scores yet — be the first!';
      let highlighted = false;
      list.innerHTML = scores
        .map((s, i) => {
          const me = !highlighted && mine !== null && s.name === mine.name && s.score === mine.score && s.date === mine.date;
          if (me) highlighted = true;
          return `<li class="${me ? 'me' : ''}"><span class="rank">${i + 1}</span><span class="who">${escapeHtml(s.name)}</span><span class="pts">${s.score}</span></li>`;
        })
        .join('');
    } catch (err) {
      status.textContent = err instanceof LeaderboardError ? err.message : 'Leaderboard offline — try again later.';
    }
  }

  // Practice spare setups
  const practiceButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('#practice-panel [data-rack]'));
  function updatePracticeButtons() {
    const key = practiceRack ? practiceRack.join(',') : '';
    for (const b of practiceButtons) b.classList.toggle('on', b.dataset.rack === key);
  }
  for (const b of practiceButtons) {
    b.addEventListener('click', () => {
      if (phase !== 'aiming' && phase !== 'result') return;
      practiceRack = b.dataset.rack ? b.dataset.rack.split(',').map(Number) : null;
      practiceBall = 1;
      updatePracticeButtons();
      runPinsetter('rerack');
    });
  }

  /**
   * Turns an on-screen swipe direction into an aim: follow the swipe's line from the ball
   * up to the targeting arrows and aim the ball over that spot, like a real bowler.
   */
  const toScreen = (x: number, z: number) => {
    const v = new THREE.Vector3(x, 0, z).project(camera);
    return { x: ((v.x + 1) / 2) * window.innerWidth, y: ((1 - v.y) / 2) * window.innerHeight };
  };
  function swipeDirectionToAim(direction: number) {
    const ball = toScreen(aimX, BALL_START_Z);
    const arrow = toScreen(aimX, ARROWS_Z);
    const pxPerMetre = toScreen(aimX + 1, ARROWS_Z).x - arrow.x;
    // Measured relative to the lane's own direction on screen (the camera sits a little to
    // one side, so straight down the lane isn't exactly straight up the screen)
    const targetX = arrow.x + Math.tan(direction) * (ball.y - arrow.y) * AIM_SENSITIVITY;
    const sideways = (targetX - arrow.x) / pxPerMetre;
    const angle = Math.atan2(sideways, BALL_START_Z - ARROWS_Z);
    return clamp(angle / MAX_ANGLE, -1, 1);
  }

  const controls: ControlTarget = {
    canAim: () => openScreen === null && (phase === 'aiming' || phase === 'charging'),
    isCharging: () => phase === 'charging',
    moveBy(delta) {
      if (phase !== 'aiming') return;
      aimX = clamp(aimX + delta * MAX_X, -MAX_X, MAX_X);
      physics.holdBall(aimX);
    },
    setPosition(v) {
      if (phase !== 'aiming') return;
      aimX = clamp(v, -1, 1) * MAX_X;
      physics.holdBall(aimX);
    },
    nudgeAim(delta) {
      if (phase !== 'aiming' && phase !== 'charging') return;
      aim = clamp(aim + delta, -1, 1);
    },
    nudgeSpin(delta) {
      if (phase !== 'aiming' && phase !== 'charging') return;
      spin = clamp(Math.round((spin + delta) * 10) / 10, -1, 1);
      updateReadout();
    },
    startCharge() {
      if (phase !== 'aiming') return;
      phase = 'charging';
      chargeStart = performance.now();
      power = 0;
      setStatus('Release to throw!');
    },
    releaseCharge() {
      if (phase !== 'charging') return;
      const held = (performance.now() - chargeStart) / 1000;
      power = 0.5 - 0.5 * Math.cos((Math.PI * held) / CHARGE_HALF_CYCLE);
      showPower(power, false);
      const p = power;
      phase = 'swinging';
      dave.swing(() => launch(p, aim, spin));
    },
    cancelCharge() {
      if (phase !== 'charging') return;
      phase = 'aiming';
      dave.idle();
      showPower(0, false);
      setStatus('Line up and throw!');
    },
    swipeThrow(t: SwipeThrow) {
      if (phase !== 'aiming') return;
      showPower(t.power, true);
      setTimeout(() => showPower(t.power, false), 700);
      aim = swipeDirectionToAim(t.direction);
      phase = 'swinging';
      dave.swing(() => launch(t.power, aim, t.spin));
    },
    swipePreview(direction) {
      if (openScreen === null && phase === 'aiming') aim = swipeDirectionToAim(direction);
    },
    advance() {
      if (openScreen === 'pass') showScreen(null);
      else if (openScreen === null && phase === 'result') {
        if (resultTime < REACTION_AT) resultTime = REACTION_AT;
        else runPinsetter(nextSetter);
      }
    },
    rerack() {
      // Only in practice: in a real game the pinsetter follows the rules
      if (mode === 'practice' && openScreen === null && (phase === 'aiming' || phase === 'result')) runPinsetter('rerack');
    },
    pause() {
      if (openScreen === null && phase !== 'charging') showScreen('pause');
      else if (openScreen === 'pause') showScreen(null);
    },
  };
  const input = attachControls(canvas, $('trail') as HTMLCanvasElement, controls);

  // On-screen spin buttons (mouse users; touch players curve their swipe instead)
  $('spin-left').addEventListener('click', () => controls.nudgeSpin(-0.1));
  $('spin-right').addEventListener('click', () => controls.nudgeSpin(0.1));

  // ---- Music / sound toggles (menu and pause screens) ----
  const toggleButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-toggle]'));
  function refreshToggles() {
    for (const b of toggleButtons) {
      const on = b.dataset.toggle === 'music' ? sound.musicOn : sound.sfxOn;
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('b')!.textContent = on ? 'On' : 'Off';
    }
  }
  for (const b of toggleButtons) {
    b.addEventListener('click', () => {
      sound.unlock();
      if (b.dataset.toggle === 'music') sound.toggleMusic();
      else sound.toggleSfx();
      refreshToggles();
    });
  }
  refreshToggles();
  // A soft click for every menu button
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.card button, #practice-panel button, #spin button, #pause-btn')) sound.click();
  });

  // ---- Screen buttons ----
  document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.go!;
      if (go === 'single') startGame('single');
      else if (go === 'practice') startGame('practice');
      else if (go === 'setup') openSetup();
      else if (go === 'menu') showScreen('menu');
      else if (go === 'leaderboard') void openLeaderboard();
    }),
  );
  $('pause-btn').addEventListener('click', () => controls.pause());
  $('resume').addEventListener('click', () => showScreen(null));
  $('restart').addEventListener('click', () => startGame(mode, match?.players.map((p) => p.name)));
  $('play-again').addEventListener('click', () => startGame(mode, match?.players.map((p) => p.name)));
  $('pass-ready').addEventListener('click', () => showScreen(null));

  // Pass & Play setup: 2–4 named players
  const playerList = $('player-list');
  function renderPlayers(names: string[]) {
    playerList.innerHTML = '';
    names.forEach((name, i) => {
      const row = document.createElement('div');
      row.className = 'player-input';
      const input = document.createElement('input');
      input.value = name;
      input.maxLength = 12;
      input.placeholder = `Player ${i + 1}`;
      input.setAttribute('aria-label', `Player ${i + 1} name`);
      row.append(input);
      if (names.length > 2) {
        const remove = document.createElement('button');
        remove.textContent = '×';
        remove.setAttribute('aria-label', `Remove player ${i + 1}`);
        remove.addEventListener('click', () => renderPlayers(currentNames().filter((_, j) => j !== i)));
        row.append(remove);
      }
      playerList.append(row);
    });
    ($('add-player') as HTMLButtonElement).hidden = names.length >= 4;
  }
  const currentNames = () =>
    Array.from(playerList.querySelectorAll('input')).map((inp, i) => inp.value.trim().slice(0, 12) || `Player ${i + 1}`);
  function openSetup() {
    const saved = storage.playerNames();
    renderPlayers(saved.length >= 2 && saved.length <= 4 ? saved : ['Player 1', 'Player 2']);
    showScreen('setup');
  }
  $('add-player').addEventListener('click', () => {
    const names = currentNames();
    if (names.length < 4) renderPlayers([...names, `Player ${names.length + 1}`]);
  });
  $('start-pass').addEventListener('click', () => {
    const names = currentNames();
    storage.savePlayerNames(names);
    startGame('pass', names);
  });

  // ---- Resize ----
  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Portrait phones need a wider view to see the lane
    camera.fov = camera.aspect < 0.8 ? 68 : 55;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- Camera ----
  const camPos = new THREE.Vector3(0.35, 1.5, 2.4);
  const camLook = new THREE.Vector3(0, 0, -16);
  const wantPos = new THREE.Vector3();
  const wantLook = new THREE.Vector3();

  const davePos = new THREE.Vector3();
  function updateCamera(dt: number) {
    const b = physics.ball.translation();
    const portrait = camera.aspect < 0.8;
    const dx = aimX - DAVE_OFFSET_X;
    davePos.copy(dave.root.position);
    const menuShot = openScreen === 'menu' || openScreen === 'gameover' || openScreen === 'leaderboard' || openScreen === 'setup';
    const showDave = menuShot || (phase === 'result' && resultTime >= REACTION_AT);

    if (openScreen === 'menu' || openScreen === 'gameover' || openScreen === 'leaderboard' || openScreen === 'setup') {
      // Menu card sits low on the screen; frame Dave in the top half above it
      wantPos.set(davePos.x + 0.5, 1.2, davePos.z - (portrait ? 4.6 : 3.4));
      wantLook.set(davePos.x, portrait ? 0.15 : 0.55, davePos.z);
    } else if (showDave) {
      // Face-on shot of Dave from down the lane
      wantPos.set(davePos.x + 0.35, 1.35, davePos.z - (portrait ? 3.6 : 2.7));
      wantLook.set(davePos.x, portrait ? 1.15 : 1.4, davePos.z);
    } else if (phase === 'aiming' || phase === 'charging' || phase === 'swinging' || phase === 'sweeping') {
      // Over Dave's right shoulder
      if (portrait) {
        wantPos.set(dx + 0.7, 2.15, DAVE_Z + 2.3);
        wantLook.set(aimX * 0.4, 0, -9.5);
      } else {
        wantPos.set(dx + 0.75, 1.75, DAVE_Z + 1.7);
        wantLook.set(aimX * 0.4, 0, -14);
      }
    } else if (phase === 'rolling' || phase === 'settling') {
      const z = Math.max(b.z + 3.2, HEAD_PIN_Z + 4.2);
      wantPos.set(b.x * 0.5, THREE.MathUtils.lerp(0.75, 1.4, clamp(z / 2, 0, 1)), z);
      wantLook.set(b.x * 0.5, 0.1, Math.max(b.z - 6, HEAD_PIN_Z - 0.4));
    } else {
      wantPos.set(0, 0.85, HEAD_PIN_Z + 3.6);
      wantLook.set(0, 0.15, HEAD_PIN_Z - 0.4);
    }
    // Cut (rather than glide) when switching to or from the reaction shot
    const cut = showDave !== lastShowDave;
    lastShowDave = showDave;
    const k = cut ? 1 : 1 - Math.exp(-dt * (phase === 'rolling' ? 6 : 3));
    camPos.lerp(wantPos, k);
    camLook.lerp(wantLook, k);
    camera.position.copy(camPos);
    camera.lookAt(camLook);
  }
  let lastShowDave = false;

  // ---- Per-frame updates ----
  const tmp = new THREE.Vector3();
  function updateAimLine() {
    aimLine.visible = phase === 'aiming' || phase === 'charging';
    if (!aimLine.visible) return;
    const p = physics.ball.translation();
    const angle = aim * MAX_ANGLE;
    const length = -HEAD_PIN_Z;
    const pos = aimGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < AIM_POINTS; i++) {
      const d = (i / (AIM_POINTS - 1)) * length;
      // Rough hook preview at a medium throw: almost nothing in the oil, then it bends late
      const hook = spin * 0.37 * Math.pow(d / length, 3);
      tmp.set(p.x + Math.sin(angle) * d + hook, 0.005, p.z - BALL_RADIUS - Math.cos(angle) * d);
      pos.setXYZ(i, tmp.x, tmp.y, tmp.z);
    }
    pos.needsUpdate = true;
    aimLine.computeLineDistances();
  }

  function syncMeshes() {
    physics.pins.forEach((pin, i) => {
      const p = pin.translation();
      const q = pin.rotation();
      pinMeshes[i].visible = !physics.isPinRemoved(i);
      pinMeshes[i].position.set(p.x, p.y, p.z);
      pinMeshes[i].quaternion.set(q.x, q.y, q.z, q.w);
    });
    const held = phase === 'aiming' || phase === 'charging' || phase === 'swinging' || phase === 'sweeping';
    if (held) {
      dave.handWorldPosition(ballMesh.position).add(BALL_IN_HAND);
      ballMesh.quaternion.identity();
    } else {
      const p = physics.ball.translation();
      const q = physics.ball.rotation();
      ballMesh.position.set(p.x, p.y, p.z);
      if (releaseBlend > 0) ballMesh.position.lerp(releaseFrom, releaseBlend * releaseBlend);
      ballMesh.quaternion.set(q.x, q.y, q.z, q.w);
    }
  }

  // ---- Sound from the physics: rolling, gutter, and pins clattering ----
  const prevPinVel = physics.pins.map(() => new THREE.Vector3());
  const pinVel = new THREE.Vector3();
  function updateSounds() {
    const live = phase === 'rolling' || phase === 'settling';
    const b = physics.ball.translation();
    const v = physics.ball.linvel();
    const onLane = live && b.y > -0.25 && b.z > HEAD_PIN_Z - 1.2;
    const nowInGutter = Math.abs(b.x) > LANE_HALF + 0.02 && b.y < 0.05;
    if (onLane && nowInGutter && !inGutter) sound.gutter();
    inGutter = nowInGutter;
    sound.setRoll(onLane ? Math.hypot(v.x, v.z) : 0, nowInGutter);

    let clacks = 0;
    physics.pins.forEach((pin, i) => {
      const lv = pin.linvel();
      pinVel.set(lv.x, lv.y, lv.z);
      const jolt = pinVel.distanceTo(prevPinVel[i]);
      prevPinVel[i].copy(pinVel);
      if (live && jolt > 0.7 && clacks < 6 && !physics.isPinRemoved(i)) {
        clacks++;
        sound.clack(jolt / 3);
      }
    });
  }

  const splashAt = new THREE.Vector3();
  const splashDir = new THREE.Vector3();
  function updateJuice() {
    if (phase !== 'rolling' && phase !== 'settling') return;
    for (const pin of physics.ballPinContacts()) {
      if (splashed.has(pin)) continue;
      splashed.add(pin);
      const b = physics.ball.translation();
      const v = physics.ball.linvel();
      const pp = physics.pins[pin].translation();
      splashAt.set((b.x + pp.x) / 2, 0.14, (b.z + pp.z) / 2);
      splashDir.set(v.x, 0, v.z).normalize();
      const strength = clamp(Math.hypot(v.x, v.z) / 9, 0.25, 1) * (splashed.size === 1 ? 1 : 0.6);
      juice.splash(splashAt, strength, splashDir);
      sound.ballHit(strength);
    }
  }

  function updatePhase(dt: number) {
    if (phase === 'charging') {
      // Uses the real clock so the meter moves at the same pace on slow devices
      const held = (performance.now() - chargeStart) / 1000;
      power = 0.5 - 0.5 * Math.cos((Math.PI * held) / CHARGE_HALF_CYCLE);
      showPower(power, true);
      dave.charge(power);
    } else if (phase === 'rolling') {
      const b = physics.ball.translation();
      const v = physics.ball.linvel();
      const stalled = Math.hypot(v.x, v.z) < 0.2;
      if (b.z < HEAD_PIN_Z + 0.5 || b.y < -0.2 || stalled) {
        phase = 'settling';
        settleTime = 0;
      }
    } else if (phase === 'settling') {
      settleTime += dt;
      if ((settleTime > 2 && physics.isSettled()) || settleTime > 6) finishThrow();
    } else if (phase === 'result' && openScreen === null) {
      resultTime += dt;
      if (resultTime >= REACTION_AT && !reactionShown) {
        reactionShown = true;
        dave.react(reaction);
        speech.show(pickLine(reaction));
      }
      if (resultTime > RESULT_PAUSE) runPinsetter(nextSetter);
    }
  }

  // ---- Main loop (fixed physics step) ----
  let acc = 0;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    acc += dt;
    let steps = 0;
    while (acc >= PHYSICS_DT && steps < 12) {
      pinsetter.update(PHYSICS_DT);
      physics.step();
      acc -= PHYSICS_DT;
      steps++;
    }
    if (steps === 12) acc = 0;

    updatePhase(dt);
    if (phase === 'aiming' || phase === 'charging' || phase === 'sweeping') dave.setStance(aimX - DAVE_OFFSET_X, DAVE_Z);
    dave.update(dt);
    releaseBlend = Math.max(0, releaseBlend - dt / 0.15);
    syncMeshes();
    updateJuice();
    juice.update(dt);
    updateSounds();
    updateAimLine();
    updateCamera(dt);
    input.update(dt);
    renderer.render(scene, camera);
    speech.update(dave, camera);
    requestAnimationFrame(frame);
  }

  // Small hook for automated testing in the browser console
  (window as unknown as { __game: unknown }).__game = {
    physics,
    controls,
    throwBall: (x = 0, aimValue = 0, p = 0.5, s = 0) => {
      aimX = x;
      physics.holdBall(aimX);
      launch(p, aimValue, s);
    },
    get phase() {
      return phase;
    },
    sound,
    get mode() {
      return mode;
    },
    get match() {
      return match;
    },
    get screen() {
      return openScreen;
    },
    startGame,
    get lastThrow() {
      return lastThrow;
    },
  };

  physics.holdBall(aimX);
  showScreen('menu');
  $('loading').remove();
  requestAnimationFrame(frame);
}

start().catch((err) => {
  console.error(err);
  const el = document.getElementById('loading');
  if (el) el.textContent = 'Sorry, the game failed to load. Try refreshing.';
});

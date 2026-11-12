import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import './style.css';
import { BALL_RADIUS, HEAD_PIN_Z, LANE_HALF, MAX_AIM_ANGLE, MAX_START_X, MAX_THROW_SPEED, MIN_THROW_SPEED, OUTER_HALF } from './game/dimensions';
import { BowlingPhysics, PHYSICS_DT, STANDARD_LANE, type LaneConditions } from './game/physics';
import { Match, type RollOutcome } from './game/match';
import { Pinsetter, type PinsetterMode } from './game/pinsetter';
import { ReplayRecorder, type Replay, type ReplayEvent } from './game/replay';
import { mark } from './game/scoring';
import { storage } from './save/storage';
import { renderScorecard } from './ui/scorecard';
import { attachControls, type ControlTarget } from './input/controls';
import type { SwipeThrow } from './input/swipe';
import { buildAlley } from './scene/alley';
import { CameraRig, type Shot } from './scene/cameraRig';
import { BALL_STYLES, createTomatoBall, PinSet } from './scene/models';
import { GameTracker, mergeProgress, NEW_PROGRESS, newlyUnlocked, unlockedIds, type Item, type Progress } from './game/unlocks';
import { Dave } from './scene/dave';
import { buildDecor } from './scene/decor';
import { ReturnChute } from './scene/chute';
import { VENUES, VenueManager, type VenueId } from './scene/venues';
import { Juice } from './scene/juice';
import { chooseTarget, humanise, planThrow, pressureFor } from './game/ai';
import { RIVALS, rivalById, type Rival } from './game/rivals';
import { addMatchStats, isChampion, isLadderOpen, isUnlocked, LADDERS, ladderOf, laneFor, loadCareer, metRivals, NO_STATS, nextRung, recordResult, starsFor, totalStars, type Ladder, type LaneRule, type Rung } from './game/career';
import { FRAMES } from './game/scoring';
import type { ThrowParams } from './game/physics';
import { PathRibbon } from './scene/pathRibbon';
import { Scoreboard, type ScoreAnimation } from './scene/scoreboard';
import { classifyThrow, CommentPacer, pickLine, pickVsLine, streakName, type ReactionKind } from './game/reactions';
import { SpeechBubble } from './ui/speech';
import { Sound } from './audio/sound';
import { LeaderboardScreen } from './ui/leaderboardScreen';
import { PlayerSetup } from './ui/playerSetup';
import { renderWardrobe, type Equipped } from './ui/wardrobe';
import { $, escapeHtml, IN_GAME_SCREENS, MENU_SHOT_SCREENS, SCREENS, type ScreenId } from './ui/screens';

type Phase = 'aiming' | 'charging' | 'swinging' | 'rolling' | 'settling' | 'result' | 'replay' | 'sweeping';

const MAX_X = MAX_START_X;
const MAX_ANGLE = MAX_AIM_ANGLE;
const ARROWS_Z = -4.57; // the targeting arrows, 15 ft down the lane
const BALL_START_Z = -0.3;
// Aiming exactly where you swipe is far too twitchy on a phone (the lane is ~60 px wide at
// the arrows), so the swipe's slant is scaled down: ~10° of slant ≈ 3 boards at the arrows.
const AIM_SENSITIVITY = 0.2;
const MIN_SPEED = MIN_THROW_SPEED;
const MAX_SPEED = MAX_THROW_SPEED;
const CHARGE_HALF_CYCLE = 0.8; // seconds for the power meter to go from empty to full
const REACTION_AT = 1.1; // seconds of looking at the pins before cutting to Dave's reaction
const RESULT_PAUSE = 3.6; // seconds before the pinsetter runs on its own (when Dave comments)
const QUIET_PAUSE = 1.6; // ...and when he lets the ball pass without a word
const AUTO_REPLAY_AT = 0.9; // strikes replay automatically, this long after the result
const AUTO_REPLAY_AFTER_BANNER = 2.1; // ...or after the turkey banner has had its moment
const HINT_THROWS = 5; // the controls hint fades once someone has thrown this many balls
const CPU_THINK = 1.0; // seconds a computer bowler takes to size up the pins
const CPU_LINE_UP = 0.7; // ...and to line up once it has decided
const FAST = 3; // fast forward speed
// Where Dave stands relative to the ball: the ball sits in his right hand
const DAVE_OFFSET_X = 0.3;
const DAVE_Z = 0.62;
const BALL_IN_HAND = new THREE.Vector3(0, -0.075, 0);

const clamp = THREE.MathUtils.clamp;

/** Frees the GPU memory held by a model's geometry and materials. */
function disposeModel(root: THREE.Object3D) {
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return;
    o.geometry.dispose();
    for (const m of Array.isArray(o.material) ? o.material : [o.material]) m.dispose();
  });
}

async function start() {
  // Start fetching and compiling the physics engine straight away; the scene is built meanwhile
  const physicsReady = BowlingPhysics.create();
  const canvas = $('game') as HTMLCanvasElement;
  const status = $('status');
  const powerMeter = $('power');
  const powerFill = $('power-fill');
  const spinValue = $('spin-value');
  const scorecardEl = $('scorecard');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  // Soft studio reflections so the shiny ball, pins and lane catch some light
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();
  scene.environmentIntensity = 0.18;
  // Far plane reaches past the rooftop skyline (towers up to ~150 m out); anything nearer
  // would slice the closest towers into stray boxes behind the sign
  const camera = new THREE.PerspectiveCamera(55, 1, 0.05, 220);
  const rig = new CameraRig(camera);
  const { keyLight, hemi, fill } = buildAlley(scene);
  const scoreboard = new Scoreboard();
  const venues = new VenueManager(scene, { hemi, key: keyLight, fill }, scoreboard.texture);
  const chute = new ReturnChute();
  scene.add(chute.group);

  const physics = await physicsReady;
  const bodies = [physics.ball, ...physics.pins];

  const pinSet = new PinSet(physics.pins.length);
  scene.add(pinSet.group);
  let ballMesh = createTomatoBall();
  scene.add(ballMesh);
  buildDecor(scene);
  const dave = new Dave();
  scene.add(dave.root);

  // ---- Unlockables: progress, and the ball and suit Dave is using ----
  let progress: Progress = mergeProgress(NEW_PROGRESS, storage.progress<Partial<Progress>>({}));
  let equipped: Equipped = storage.equipped();
  let speedBonus = 1;
  function equip({ ball, suit }: Equipped) {
    const owned = unlockedIds(progress);
    if (!owned.has(ball)) ball = 'classic';
    if (!owned.has(suit)) suit = 'navy';
    if (ball !== equipped.ball || !ballMesh.userData.style) {
      scene.remove(ballMesh);
      disposeModel(ballMesh);
      ballMesh = createTomatoBall(ball);
      ballMesh.userData.style = ball;
      scene.add(ballMesh);
    }
    equipped = { ball, suit };
    storage.saveEquipped(equipped);
    physics.setBallRadius(BALL_STYLES[ball].radius);
    speedBonus = ball === 'cherry' ? 1.06 : 1; // the little cherry tomato flies a bit faster
    dave.setOutfit(suit);
  }
  equip(equipped);

  // ---- Graphics quality: Low drops shadows and renders at a lower resolution ----
  // Only very modest devices start on Low (most phones report 6+ cores)
  const lowEndGuess =
    (navigator.hardwareConcurrency ?? 8) <= 2 || ((navigator as unknown as { deviceMemory?: number }).deviceMemory ?? 8) <= 2;
  let quality = storage.text('quality', lowEndGuess ? 'low' : 'high');
  function applyQuality() {
    // Low still renders at 1.5× on sharp screens so edges don't look jagged
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, quality === 'low' ? 1.5 : 2));
    keyLight.castShadow = quality !== 'low';
  }
  applyQuality();
  const juice = new Juice(scene);
  const speech = new SpeechBubble($('speech'));
  const sound = new Sound();
  // Career mode's save (read early: it decides which venues are open)
  let career = loadCareer(storage.career());
  // Venue: where Dave bowls (each has its own look and music)
  /**
   * Shows a venue. `remember` makes it the venue for free play (career matches visit their
   * own venue without changing that).
   */
  function selectVenue(id: VenueId, remember = true) {
    venues.select(id);
    scoreboard.setTheme(id);
    sound.setTrack(venues.current.track);
    if (remember) {
      preferredVenue = id;
      storage.saveText('venue', id);
    }
    $('venue-name').textContent = `📍 ${venues.current.name}`;
  }
  /** Venues you can pick for free play: the Golden Pin once you've reached the career final. */
  const venueOpen = (id: VenueId) => id !== 'golden' || isLadderOpen(career, LADDERS.findIndex((l) => l.id === 'golden'));
  const savedVenue = storage.text('venue', 'classic') as VenueId;
  let preferredVenue: VenueId = 'classic';
  selectVenue(VENUES.some((v) => v.id === savedVenue) && venueOpen(savedVenue) ? savedVenue : 'classic');
  const stepVenue = (dir: number) => {
    const open = VENUES.filter((v) => venueOpen(v.id));
    const i = open.findIndex((v) => v.id === venues.current.id);
    selectVenue(open[(i + dir + open.length) % open.length].id);
  };
  $('venue-prev').addEventListener('click', () => stepVenue(-1));
  $('venue-next').addEventListener('click', () => stepVenue(1));
  $('venue-name').addEventListener('click', () => stepVenue(1));
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

  // Aim guide: dashed line on the lane showing where the ball will go, including the hook
  const AIM_POINTS = 40;
  const aimLine = new PathRibbon(AIM_POINTS, '#ffe066', 0.03, 0.85);
  const aimPoints = Array.from({ length: AIM_POINTS }, () => ({ x: 0, z: 0 }));
  scene.add(aimLine.mesh);

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
  let daveComments = true; // whether Dave reacts to this ball (see CommentPacer)
  let autoReplay = false; // strikes play their replay on their own
  let autoReplayAt = AUTO_REPLAY_AT;
  // The overhead scoreboard's animation for this ball, played while the pinsetter runs
  let pendingAnim: { kind: ScoreAnimation; label?: string; sub?: string; glance: boolean } | null = null;
  let monitorGlance = false; // the camera looks up at the monitor while it plays
  let practiceStreak = 0;
  const banner = $('banner');
  let bannerTimer: number | undefined;
  function showBanner(text: string) {
    banner.textContent = text;
    banner.hidden = false;
    // Restart the animation even if the banner was already showing
    banner.classList.remove('show');
    void banner.offsetWidth;
    banner.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => (banner.hidden = true), 2200);
  }
  const pacer = new CommentPacer();
  const rivalPacer = new CommentPacer();
  /** Who's reacting to this ball: a computer rival, or null for Dave. */
  let speaker: Rival | null = null;
  // The controls hint fades away once the player has the hang of it
  let throwsMade = storage.count('throws');
  const hint = $('hint');
  hint.classList.toggle('faded', throwsMade >= HINT_THROWS);
  const splashed = new Set<number>();
  let releaseBlend = 0; // eases the ball from Dave's hand down onto the lane
  let inGutter = false;
  let timeScale = 1; // FAST while fast-forwarding a throw
  const ffBtn = $('ff-btn') as HTMLButtonElement;
  function setFastForward(on: boolean) {
    timeScale = on ? FAST : 1;
    ffBtn.setAttribute('aria-pressed', String(on));
    ffBtn.textContent = on ? `⏩ ${FAST}× speed` : '⏩ Fast forward';
  }
  ffBtn.addEventListener('click', () => controls.fastForward());
  const releaseFrom = new THREE.Vector3();

  // ---- Replay of the last throw ----
  const recorder = new ReplayRecorder();
  let lastReplay: Replay | null = null;
  let replayT = 0;
  const replayBtn = $('replay-btn') as HTMLButtonElement;
  const replayBadge = $('replay-badge');
  replayBtn.addEventListener('click', () => controls.replay());

  // ---- Game mode state ----
  type Mode = 'single' | 'pass' | 'practice' | 'cpu';
  let mode: Mode = 'single';
  // vs CPU: the rival is always player 2
  let rival: Rival | null = null;
  // Career mode: the rung being played (null outside career), the save, and every ball
  // bowled in this match in order (saved so a match can be picked up later)
  let careerRung: Rung | null = null;
  /** The venue ladder the career match belongs to (null outside career). */
  let careerLadder: Ladder | null = null;
  let matchLog: number[] = [];
  let cpuTimer = 0;
  let cpuThrow: ThrowParams | null = null;
  /** Rushing through the rival's turn (the ⏩ Skip button): quick rolls, no pauses. */
  let rushing = false;
  const skipBtn = $('skip-btn') as HTMLButtonElement;
  skipBtn.addEventListener('click', () => {
    rushing = true;
    if (phase === 'rolling' || phase === 'settling') setFastForward(true);
  });
  const cpuTurn = () => mode === 'cpu' && rival !== null && match !== null && match.current === 1 && !match.gameOver;
  let match: Match | null = null;
  let outcome: RollOutcome | null = null;
  let practiceBall: 1 | 2 = 1;
  let practiceRack: number[] | null = null; // a spare setup being practised, or null for full racks
  let nextSetter: PinsetterMode = 'rerack';
  let openScreen: ScreenId | null = null;

  const setStatus = (text: string) => (status.textContent = text);
  const spinLabel = (v: number) => (Math.abs(v) < 0.005 ? 'none' : `${v < 0 ? '◀' : '▶'} ${Math.round(Math.abs(v) * 100)}%`);

  /** The spin setting on the mouse/keyboard spin panel. */
  function updateSpinLabel() {
    spinValue.textContent = spinLabel(spin);
  }

  function showPower(p: number, visible: boolean) {
    powerMeter.classList.toggle('visible', visible);
    powerFill.style.transform = `scaleY(${p})`;
  }

  /** `exactSpeed` (m/s) is for computer bowlers, which choose a speed rather than a power. */
  function launch(p: number, aimValue: number, spinValue: number, exactSpeed?: number) {
    const speed = exactSpeed ?? (MIN_SPEED + p * (MAX_SPEED - MIN_SPEED)) * speedBonus;
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
    lastReplay = null;
    recorder.start();
    if (rushing) setFastForward(true);
    if (throwsMade < HINT_THROWS && !cpuTurn()) {
      throwsMade++;
      storage.saveCount('throws', throwsMade);
      if (throwsMade >= HINT_THROWS) hint.classList.add('faded');
    }
    setStatus(`${cpuTurn() && rival ? `${rival.name} rolls` : 'Rolling'}… ${speed.toFixed(1)} m/s · spin ${spinLabel(spinValue)}`);
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
    lastReplay = recorder.stop();
    setFastForward(false);
    phase = 'result';
    resultTime = 0;
    reactionShown = false;
    const fresh = mode === 'practice' ? !practiceRack && practiceBall === 1 : (match?.position.fresh ?? true);
    reaction = classifyThrow(knocked, standingBefore, fresh, physics.standingPins());
    // A computer rival's ball: the rival has its own say (at the same pace as Dave), and
    // there's no automatic replay (the button's there)
    const rivalBall = cpuTurn();
    speaker = rivalBall ? rival : null;
    daveComments = rivalBall ? !rushing && rivalPacer.shouldComment(reaction) : pacer.shouldComment(reaction);
    autoReplay = !rivalBall && reaction === 'strike' && lastReplay !== null;
    autoReplayAt = AUTO_REPLAY_AT;
    if (reaction === 'strike') {
      sound.cheer();
      buzz([40, 60, 90]);
      // Extra-juicy strike
      juice.splash(new THREE.Vector3(0, 0.25, HEAD_PIN_Z - 0.35), 1.5, new THREE.Vector3(0, 0, -1));
    } else if (reaction === 'spare') sound.applause(1.6, 0.8);
    else if (reaction === 'good') sound.applause(1, 0.45);
    else if (reaction === 'gutter' || reaction === 'miss') sound.groan();

    if (mode === 'practice') {
      practiceStreak = reaction === 'strike' ? practiceStreak + 1 : fresh ? 0 : practiceStreak;
      celebrate(reaction, practiceStreak);
      if (practiceRack) {
        setStatus(knocked === standingBefore ? 'Picked it up! 🍅' : `Missed — ${standingBefore - knocked} left`);
        nextSetter = 'rerack';
      } else if (practiceBall === 1) {
        setStatus(resultMessage(mark(knocked, 10, true), knocked, true));
        scoreboard.showPractice(knocked === 10 ? 'STRIKE!' : `${knocked} pin${knocked === 1 ? '' : 's'}`);
        nextSetter = knocked === 10 ? 'rerack' : 'clear';
      } else {
        setStatus(resultMessage(mark(knocked, standingBefore, false), knocked, false));
        nextSetter = 'rerack';
      }
      return;
    }

    if (!match) return;
    const firstBall = match.position.ball === 0;
    const tracker = trackers[match.current];
    const progressMade = tracker.record(reaction === 'strike' || reaction === 'spare' || reaction === 'split' ? reaction : 'other');
    // A rival's strikes and splits don't unlock anything for you
    if (!rivalBall) gainProgress(progressMade);
    celebrate(reaction, tracker.streak, !rivalBall);
    outcome = match.recordRoll(knocked);
    matchLog.push(knocked);
    renderScorecard(scorecardEl, match);
    scoreboard.showScores(match.players, match.players.indexOf(match.player), match.frames);
    const said = resultMessage(outcome.mark, knocked, firstBall);
    setStatus(rivalBall && rival ? `${rival.name}: ${said}` : said);
    nextSetter = outcome.freshRack ? 'rerack' : 'clear';
  }

  /** The turkey banner, and which animation the overhead scoreboard plays for this ball. */
  function celebrate(kind: ReactionKind, streak: number, banner = true) {
    const run = kind === 'strike' ? streakName(streak) : null;
    if (run) {
      if (banner) showBanner(run);
      autoReplayAt = AUTO_REPLAY_AFTER_BANNER;
      pendingAnim = { kind: 'turkey', label: run, sub: `${streak} strikes in a row!`, glance: true };
    } else if (kind === 'strike') pendingAnim = { kind: 'strike', glance: true };
    else if (kind === 'gutter') pendingAnim = { kind: 'gutter', glance: true };
    else if (kind === 'spare') pendingAnim = { kind: 'spare', glance: false };
    else pendingAnim = null;
  }

  function runPinsetter(setterMode: PinsetterMode) {
    if (rushing) setFastForward(true);
    if (pendingAnim) {
      scoreboard.play(pendingAnim.kind, pendingAnim.label, pendingAnim.sub);
      monitorGlance = pendingAnim.glance && !rushing;
      pendingAnim = null;
    }
    phase = 'sweeping';
    dave.idle();
    speech.hide();
    sound.pinsetter();
    physics.holdBall(aimX);
    setStatus(setterMode === 'clear' ? 'Clearing the cache…' : 'Rebooting the rack…');
    const rack = setterMode === 'rerack' && mode === 'practice' && practiceRack ? practiceRack : undefined;
    pinsetter.start(setterMode, () => afterPinsetter(setterMode), rack);
  }

  /** After a throw's result: reset the pins, or if that was the last ball, show the final score. */
  function nextAfterResult() {
    if (outcome?.gameOver) {
      outcome = null;
      speech.hide();
      phase = 'aiming';
      physics.holdBall(aimX);
      showGameOver();
    } else {
      runPinsetter(nextSetter);
    }
  }

  /** Once the pins are set: the next ball, or the next player's turn. */
  function afterPinsetter(setterMode: PinsetterMode) {
    if (rushing) setFastForward(false);
    aim = 0; // each ball starts aimed straight down the lane
    phase = 'aiming';
    if (mode === 'practice') {
      practiceBall = setterMode === 'clear' ? 2 : 1;
      setStatus(practiceRack ? 'Pick up the spare!' : practiceBall === 1 ? 'Line up and throw!' : 'Second ball — pick up the spare!');
      updateSpinLabel();
      return;
    }
    if (!match) return;
    const done = outcome;
    outcome = null;
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
    // Career: save at each frame boundary (a fresh rack), so the match can be resumed
    if (careerRung && pos.ball === 0 && !match.gameOver) {
      career = { ...career, inProgress: { rival: careerRung.rival, frames: match.frames, log: [...matchLog] } };
      storage.saveCareer(career);
      // A new frame on the Rooftop brings a new breeze
      if (careerLadder?.rule?.breeze) applyLane(laneFor(careerLadder, STANDARD_LANE));
    }
    if (mode === 'cpu' && rival) {
      // The rival bowls in Dave's body, wearing its own head and suit
      dave.setOutfit(cpuTurn() ? rival.outfit : equipped.suit);
      dave.setHead(cpuTurn() ? rival.head : 'tomato');
      if (!cpuTurn()) rushing = false;
      if (cpuTurn()) {
        cpuTimer = rushing ? 0.15 : CPU_THINK;
        cpuThrow = null;
        setStatus(`${rival.name} is up…`);
        renderScorecard(scorecardEl, match);
        scoreboard.showScores(match.players, 1, match.frames);
        return;
      }
    }
    const who = mode === 'pass' ? `${match.player.name}, ` : '';
    const say = (text: string) => setStatus(who ? who + text : text.charAt(0).toUpperCase() + text.slice(1));
    const last = match.frames - 1;
    if (pos.frame === last && pos.ball === 2) say('bonus ball!');
    else if (pos.ball === 0) say(pos.frame === last ? 'final frame!' : 'line up and throw!');
    else say(pos.standing === 10 ? 'bonus ball!' : 'pick up the spare!');
    updateSpinLabel();
    renderScorecard(scorecardEl, match);
    scoreboard.showScores(match.players, match.players.indexOf(match.player), match.frames);
  }

  // ---- Replay ----
  function startReplay() {
    if (!lastReplay || phase !== 'result' || openScreen !== null) return;
    phase = 'replay';
    replayT = 0;
    speech.hide();
    dave.idle();
    juice.clear();
    replayBadge.hidden = false;
    document.body.classList.add('replaying');
  }

  function endReplay() {
    if (phase !== 'replay') return;
    phase = 'result';
    replayBadge.hidden = true;
    document.body.classList.remove('replaying');
    sound.setRoll(0, false);
    // Back to Dave for his reaction, then on to the next ball as usual
    autoReplay = false;
    daveComments = true;
    resultTime = REACTION_AT;
    reactionShown = false;
  }

  function playReplayEvent(e: ReplayEvent) {
    if (e.kind === 'hit') {
      juice.splash(splashAt.set(e.at.x, e.at.y, e.at.z), e.strength, splashDir.set(e.dir.x, e.dir.y, e.dir.z));
      sound.ballHit(e.strength);
      rig.bump(0.025 * e.strength);
    } else if (e.kind === 'clack') sound.clack(e.strength);
    else if (e.kind === 'gutter') sound.gutter();
    else sound.bump();
  }

  const replayBall = new THREE.Vector3();
  const replayQuat = new THREE.Quaternion();
  /** Moves the replay on by `dt` seconds of real time. Returns the playback rate. */
  function updateReplay(dt: number) {
    const r = lastReplay;
    if (!r) return endReplay();
    const rate = r.rateAt(replayT);
    const next = Math.min(replayT + dt * rate, r.end);
    for (const e of r.eventsBetween(replayT, next)) playReplayEvent(e);
    replayT = next;
    r.sample(replayT, 0, replayBall, replayQuat);
    const gutter = Math.abs(replayBall.x) > LANE_HALF + 0.02 && replayBall.y < 0.05;
    sound.setRoll(replayBall.y > -0.25 ? r.ballSpeed(replayT) * rate : 0, gutter);
    if (replayT >= r.end) endReplay();
  }

  // ---- Screens ----
  function showScreen(id: ScreenId | null) {
    openScreen = id;
    sound.setMusicMood(id === null || id === 'pass' || id === 'tutorial' ? 'game' : 'menu');
    for (const s of SCREENS) $(s).hidden = s !== id;
    $('hud').hidden = !IN_GAME_SCREENS.includes(id);
    $('pause-btn').hidden = id !== null;
    hint.hidden = id !== null;
    $('spin').hidden = id !== null;
    $('practice-panel').hidden = !(id === null && mode === 'practice');
    legend.hidden = !(id === null && mode === 'practice');
    if (id === 'menu') {
      if (venues.current.id !== preferredVenue) selectVenue(preferredVenue, false);
      if (lane !== STANDARD_LANE) applyLane(STANDARD_LANE);
      scoreboard.showIdle();
      // Dave hosts the menu as himself, even if a rival was mid-turn
      dave.setHead('tomato');
      dave.setOutfit(equipped.suit);
      if (phase === 'replay') endReplay();
      dave.wave();
      speech.hide();
      const best = storage.bestScore();
      $('menu-best').textContent = best > 0 ? `Your best: ${best}` : '';
    }
  }

  // ---- Lane conditions (career venues change how the lane plays) ----
  let lane: LaneConditions = STANDARD_LANE;
  const windEl = $('wind');
  function applyLane(c: LaneConditions) {
    lane = c;
    physics.setConditions(c);
    predictor?.setConditions(c);
    // The breeze: which way, and how hard
    windEl.hidden = c.wind === 0;
    if (c.wind !== 0) {
      const strength = Math.abs(c.wind) < 0.025 ? 'light' : Math.abs(c.wind) < 0.05 ? 'steady' : 'strong';
      const arrows = (c.wind < 0 ? '←' : '→').repeat(strength === 'light' ? 1 : strength === 'steady' ? 2 : 3);
      windEl.textContent = `🌬️ ${strength[0].toUpperCase() + strength.slice(1)} breeze ${arrows} blowing ${c.wind < 0 ? 'left' : 'right'}`;
    }
  }

  /**
   * Clears the lane and starts a new game in the chosen mode. `frames` is the match length;
   * `rung` makes it a career match. `log` replays balls already bowled (resuming a match).
   */
  function startGame(newMode: Mode, names: string[] = ['You'], frames = FRAMES, rung: Rung | null = null, log: number[] = []) {
    endReplay();
    mode = newMode;
    rushing = false;
    careerRung = rung;
    careerLadder = rung ? ladderOf(rung.rival) : null;
    // Career matches are played at their ladder's venue, under its lane rule
    selectVenue(careerLadder ? (careerLadder.id as VenueId) : preferredVenue, false);
    applyLane(careerLadder ? laneFor(careerLadder, STANDARD_LANE) : STANDARD_LANE);
    cpuThrow = null;
    dave.setOutfit(equipped.suit);
    dave.setHead('tomato');
    match = newMode === 'practice' ? null : new Match(names, frames);
    matchLog = [];
    if (match) {
      for (const pins of log) {
        if (match.gameOver) break;
        match.recordRoll(pins);
        matchLog.push(pins);
      }
    }
    trackers = names.map(() => new GameTracker());
    gameUnlocks = [];
    outcome = null;
    practiceBall = 1;
    practiceRack = null;
    spin = 0;
    aim = 0;
    aimX = 0;
    recorder.stop();
    lastReplay = null;
    autoReplay = false;
    pendingAnim = null;
    monitorGlance = false;
    practiceStreak = 0;
    scoreboard.stopAnimation();
    replayBadge.hidden = true;
    document.body.classList.remove('replaying');
    physics.resetPins();
    physics.holdBall(aimX);
    pinsetter.cancel();
    setFastForward(false);
    phase = 'aiming';
    dave.idle();
    speech.hide();
    renderScorecard(scorecardEl, match);
    updatePracticeButtons();
    showScreen(null);
    if (!storage.flag('tutorial-seen')) showScreen('tutorial');
    if (match) setTurnStatus();
    else {
      setStatus('Practice: throw as much as you like');
      scoreboard.showPractice('Lane 7 is yours');
      updateSpinLabel();
    }
  }

  // ---- vs CPU: pick a rival ----
  function openRivals() {
    const list = $('rival-list');
    const record = storage.vsRecord();
    list.innerHTML = '';
    // Everyone at the venues you've reached in career mode
    const met = metRivals(career);
    for (const r of RIVALS.filter((x) => met.includes(x.id))) {
      const b = document.createElement('button');
      b.className = 'rival';
      const rec = record[r.id];
      b.innerHTML = `<span class="rname">${r.emoji} ${escapeHtml(r.name)}</span><span class="rstars" aria-label="${r.stars} of 5 stars">${'★'.repeat(r.stars)}<span class="off">${'★'.repeat(5 - r.stars)}</span></span><span class="rblurb">${escapeHtml(r.blurb)}</span>${
        rec ? `<span class="rrecord">You: won ${rec.w} · lost ${rec.l}${rec.t ? ` · tied ${rec.t}` : ''}</span>` : ''
      }`;
      b.addEventListener('click', () => startCpu(r.id));
      list.append(b);
    }
    if (met.length < RIVALS.length) {
      const more = document.createElement('p');
      more.className = 'small';
      more.textContent = `🔒 ${RIVALS.length - met.length} more rivals to meet in 🪜 Career.`;
      list.append(more);
    }
    showScreen('rivals');
  }

  function startCpu(id: string) {
    const r = rivalById(id);
    if (!r) return;
    rival = r;
    startGame('cpu', ['You', r.name]);
  }

  // ---- Career: the ladders, the match intro, the result card and the credits ----
  const stars = (n: number) => `${'⭐'.repeat(n)}<span class="off">${'⭐'.repeat(3 - n)}</span>`;
  const ruleText = (r: LaneRule | null) => (r ? `${r.emoji} ${r.name}: ${r.blurb}` : '🍅 The home lane: no surprises.');

  /** The ladder to show first: the furthest one you've reached. */
  function currentLadder() {
    let i = 0;
    while (i + 1 < LADDERS.length && isLadderOpen(career, i + 1)) i++;
    return i;
  }

  let viewLadder = 0;
  function openCareer(index = currentLadder()) {
    viewLadder = index;
    const l = LADDERS[index];
    const open = isLadderOpen(career, index);
    $('ladder-title').textContent = `${l.emoji} ${l.name}`;
    $('ladder-rule').textContent = open ? ruleText(l.rule) : `🔒 Become champion of ${LADDERS[index - 1].name} to open.`;
    ($('ladder-prev') as HTMLButtonElement).disabled = index === 0;
    ($('ladder-next') as HTMLButtonElement).disabled = index === LADDERS.length - 1;
    const ladder = $('ladder');
    ladder.innerHTML = '';
    const next = nextRung(career, l.rungs);
    // Top rung (the champion) first, like a poster
    for (let i = l.rungs.length - 1; i >= 0; i--) {
      const rung = l.rungs[i];
      const r = rivalById(rung.rival)!;
      const rec = career.results[rung.rival];
      const unlocked = open && isUnlocked(career, i, l.rungs);
      const li = document.createElement('li');
      const b = document.createElement('button');
      b.className = `rung${unlocked ? '' : ' locked'}${open && i === next ? ' next' : ''}`;
      b.disabled = !unlocked;
      const record = rec ? ` · ${rec.wins}–${rec.losses}` : '';
      const lockedWhy = () => (!open ? 'Venue locked' : `Beat ${escapeHtml(rivalById(l.rungs[i - 1].rival)!.name)} to unlock`);
      b.innerHTML = `<span class="remoji">${unlocked ? r.emoji : '🔒'}</span><span class="rname">${unlocked ? escapeHtml(r.name) : '???'}${
        rung.champion ? '<span class="tag">CHAMPION</span>' : ''
      }</span><span class="rgot" aria-label="${rec?.stars ?? 0} of 3 stars">${stars(rec?.stars ?? 0)}</span><span class="rmeta">${
        unlocked ? `${rung.frames}-frame match${record}` : lockedWhy()
      }</span>`;
      if (unlocked) b.addEventListener('click', () => openIntro(index, i));
      li.append(b);
      ladder.append(li);
    }
    const total = totalStars(career, l.rungs);
    const max = l.rungs.length * 3;
    $('career-stars').textContent = isChampion(career, l.rungs)
      ? `🏆 ${l.name} champion! ${total} of ${max} stars.`
      : total > 0
        ? `${total} of ${max} stars collected here.`
        : '';
    // A match left part-way through can be picked up again
    const saved = career.inProgress;
    $('career-resume').hidden = !saved;
    if (saved) {
      const r = rivalById(saved.rival)!;
      const replay = new Match(['You', r.name], saved.frames);
      for (const pins of saved.log) replay.recordRoll(pins);
      $('career-resume-btn').textContent = `▶ Resume vs ${r.emoji} ${r.name} (frame ${Math.min(replay.position.frame + 1, saved.frames)})`;
    }
    showScreen('career');
  }
  $('ladder-prev').addEventListener('click', () => openCareer(Math.max(0, viewLadder - 1)));
  $('ladder-next').addEventListener('click', () => openCareer(Math.min(LADDERS.length - 1, viewLadder + 1)));

  $('career-resume-btn').addEventListener('click', () => {
    const saved = career.inProgress;
    if (!saved) return;
    const li = LADDERS.indexOf(ladderOf(saved.rival));
    const ri = LADDERS[li].rungs.findIndex((r) => r.rival === saved.rival);
    startCareerMatch(li, ri, saved.log);
  });

  let intro = { ladder: 0, rung: 0 };
  function openIntro(li: number, ri: number) {
    intro = { ladder: li, rung: ri };
    const l = LADDERS[li];
    const rung = l.rungs[ri];
    const r = rivalById(rung.rival)!;
    $('mi-emoji').textContent = r.emoji;
    $('mi-name').textContent = r.name;
    $('mi-stars').innerHTML = `${'★'.repeat(r.stars)}<span class="off">${'★'.repeat(5 - r.stars)}</span>`;
    $('mi-quote').textContent = r.intro[Math.floor(Math.random() * r.intro.length)];
    $('mi-format').textContent = `${rung.frames}-frame match${rung.champion ? ` for the ${l.name} crown` : ''} at ${l.name} · you bowl first${
      l.rule ? ` · ${l.rule.emoji} ${l.rule.name}` : ''
    }`;
    showScreen('matchintro');
  }
  $('mi-go').addEventListener('click', () => startCareerMatch(intro.ladder, intro.rung));

  function startCareerMatch(li: number, ri: number, log: number[] = []) {
    const rung = LADDERS[li].rungs[ri];
    const r = rivalById(rung.rival)!;
    rival = r;
    startGame('cpu', ['You', r.name], rung.frames, rung, log);
  }

  /** The result card at the end of a career match. */
  function careerResult(rung: Rung) {
    if (!match || !rival) return;
    const ladder = ladderOf(rung.rival);
    const li = LADDERS.indexOf(ladder);
    const i = ladder.rungs.indexOf(rung);
    const [you, them] = match.totals();
    const result = starsFor(match.players[0].rolls, match.players[1].rolls, match.frames);
    dave.react(result.won ? 'strike' : 'meh');
    const wasChampion = isChampion(career, ladder.rungs);
    career = recordResult(career, rung.rival, you, them, result.stars);
    career = addMatchStats(career, match.players[0].rolls, match.frames, result.won, trackers[0]?.splitsConverted ?? 0);
    storage.saveCareer(career);
    const crowned = !!rung.champion && result.won && !wasChampion;
    const fresh = crowned ? gainProgress({ crowns: [ladder.id], homeChampion: ladder.id === 'classic' }, false) : [];
    const unlocked = [...gameUnlocks, ...fresh];
    const nextLadder = LADDERS[li + 1];
    const final = ladder.id === 'golden';

    $('go-title').textContent = result.won
      ? crowned
        ? `🏆 Champion of ${ladder.name}!`
        : `You beat ${rival.name}!`
      : you === them
        ? "It's a tie!"
        : `${rival.name} wins`;
    const reasons = [
      ['Win the match', result.won],
      [`Win by ${3 * match.frames}+ pins`, result.bigWin],
      ['Bowl a turkey, or no open frames', result.flair],
    ] as const;
    const next = nextRung(career, ladder.rungs);
    let note = '';
    if (result.won && next > i && next !== -1) {
      const n = rivalById(ladder.rungs[next].rival)!;
      note = `<p class="small">${n.emoji} ${escapeHtml(n.name)} is ready for you.</p>`;
    }
    if (crowned && nextLadder) note = `<p class="small">${nextLadder.emoji} <b>${escapeHtml(nextLadder.name)}</b> is open!</p>`;
    if (crowned && final) note = `<p class="small">You've beaten them all. Tomato Dave is the greatest bowler in the land! 🍅👑</p>`;
    $('go-body').innerHTML = `<ul class="results"><li class="${result.won ? 'win' : ''}"><span>You</span><span>${you}</span></li><li class="${!result.won && you !== them ? 'win' : ''}"><span>${rival.emoji} ${escapeHtml(rival.name)}</span><span>${them}</span></li></ul>
      ${rivalQuote(rival, result.won, you === them)}
      <div class="career-stars" aria-label="${result.stars} of 3 stars">${stars(result.stars)}</div>
      <ul class="star-reasons">${reasons.map(([what, got]) => `<li class="${got ? '' : 'miss'}">${got ? '⭐' : '☆'} ${what}</li>`).join('')}</ul>${note}${
        unlocked.length
          ? `<div class="unlocks">🎁 Unlocked: <b>${unlocked.map((u) => escapeHtml(u.name)).join(', ')}</b><br />Try it on in the Wardrobe!</div>`
          : ''
      }`;
    // What next: the next rival up; on to the next venue once you're its champion; or, after
    // the final, the credits
    const nextBtn = $('gc-next') as HTMLButtonElement;
    nextBtn.hidden = true;
    if (result.won && i + 1 < ladder.rungs.length) {
      nextBtn.hidden = false;
      nextBtn.textContent = 'Next rival';
      nextBtn.onclick = () => openIntro(li, i + 1);
    } else if (result.won && rung.champion && nextLadder) {
      nextBtn.hidden = false;
      nextBtn.textContent = `On to ${nextLadder.name} ${nextLadder.emoji}`;
      nextBtn.onclick = () => openCareer(li + 1);
    }
    ($('gc-credits') as HTMLButtonElement).hidden = !(result.won && final);
    ($('gc-rematch') as HTMLButtonElement).onclick = () => startCareerMatch(li, i);
  }

  /** The rival's parting words on the result card. */
  function rivalQuote(r: Rival, youWon: boolean, tied: boolean) {
    if (tied) return '';
    const pool = youWon ? r.lose : r.win;
    return `<p class="quote rival-quote">${r.emoji} ${escapeHtml(pool[Math.floor(Math.random() * pool.length)])}</p>`;
  }

  /** Your career numbers, and your record against every rival you've played. */
  function openStats() {
    const s = { ...NO_STATS, ...career.stats };
    const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');
    const allStars = LADDERS.reduce((n, l) => n + totalStars(career, l.rungs), 0);
    const maxStars = LADDERS.reduce((n, l) => n + l.rungs.length * 3, 0);
    const crowns = LADDERS.filter((l) => isChampion(career, l.rungs)).length;
    const tiles: [string, string][] = [
      [String(s.matches), 'matches'],
      [s.matches ? `${s.wins}–${s.matches - s.wins}` : '–', 'won–lost'],
      [s.games10 ? String(Math.round(s.pins10 / s.games10)) : '–', 'average (10 frames)'],
      [s.best10 ? String(s.best10) : '–', 'best game'],
      [pct(s.strikes, s.strikeChances), 'strikes'],
      [pct(s.spares, s.spareChances), 'spares'],
      [String(s.splitsConverted), 'splits picked up'],
      [`${allStars}/${maxStars}`, 'stars'],
      [`${crowns}/${LADDERS.length}`, 'crowns'],
    ];
    $('stats-tiles').innerHTML = tiles.map(([v, label]) => `<div class="tile"><b>${v}</b><span>${label}</span></div>`).join('');
    const rows = LADDERS.flatMap((l) => l.rungs).flatMap(({ rival: id }) => {
      const rec = career.results[id];
      const r = rivalById(id)!;
      if (!rec) return [];
      return [`<tr><td>${r.emoji} ${escapeHtml(r.name)}</td><td>${rec.wins}–${rec.losses}${rec.ties ? `–${rec.ties}` : ''}</td><td>${stars(rec.stars)}</td></tr>`];
    });
    $('stats-h2h').innerHTML = rows.length ? rows.join('') : '<tr><td>Play a career match to start your record.</td></tr>';
    showScreen('careerstats');
  }

  /** The end credits, after winning the Golden Pin. */
  function openCredits() {
    const cast = RIVALS.map((r) => `<p>${r.emoji} ${escapeHtml(r.name)}</p>`).join('');
    $('credits-roll').innerHTML = `
      <h3>Starring</h3><p>🍅 Tomato Dave</p>
      <h3>With</h3>${cast}
      <h3>Venues</h3>${LADDERS.map((l) => `<p>${l.emoji} ${escapeHtml(l.name)}</p>`).join('')}
      <h3>Music</h3><p>Tomato Lounge · Packet Loss · Disco Dave · Bossa Marinara · Golden Glory</p><p class="small">all composed in code</p>
      <h3>Built with</h3><p>Three.js · Rapier physics · Vite</p>
      <h3>And you</h3><p>Thanks for playing! 🎳</p>`;
    // Restart the roll each time it's opened
    const roll = $('credits-roll');
    roll.style.animation = 'none';
    void roll.offsetWidth;
    roll.style.animation = '';
    showScreen('credits');
  }
  $('gc-credits').addEventListener('click', openCredits);

  // ---- Online leaderboard ----
  const leaderboard = new LeaderboardScreen(() => showScreen('leaderboard'));

  function showGameOver() {
    if (!match) return;
    const totals = match.totals();
    // Against the computer, only your own score counts towards unlocks; and only full
    // 10-frame games count towards score unlocks (a 5-frame score isn't comparable)
    const top = match.frames < FRAMES ? 0 : mode === 'cpu' ? totals[0] : Math.max(...totals);
    const inCareer = careerRung !== null;
    $('go-buttons').hidden = inCareer;
    $('go-career').hidden = !inCareer;
    dave.setOutfit(equipped.suit);
    dave.setHead('tomato');
    const won = mode === 'cpu' ? totals[0] > totals[1] : true;
    dave.react(!won ? 'meh' : top >= 150 ? 'strike' : top >= 90 ? 'good' : 'meh');
    const fresh = gainProgress({ gamesPlayed: progress.gamesPlayed + 1, bestScore: top }, false);
    if (careerRung) {
      gameUnlocks.push(...fresh);
      leaderboard.hide(); // career scores stay out of the main leaderboard
      careerResult(careerRung);
      showScreen('gameover');
      return;
    }
    const unlocked = [...gameUnlocks, ...fresh];
    const unlockNote = unlocked.length
      ? `<div class="unlocks">🎁 Unlocked: <b>${unlocked.map((i) => escapeHtml(i.name)).join(', ')}</b><br />Try it on in the Wardrobe!</div>`
      : '';
    const body = $('go-body');
    if (match.players.length === 1) {
      const score = totals[0];
      const best = storage.bestScore();
      const isBest = storage.submitScore(score);
      $('go-title').textContent = score === 300 ? 'PERFECT GAME!' : 'Game over';
      body.innerHTML = `<div class="big-score">${score}</div><p class="small">${
        isBest ? (best > 0 ? '🍅 New personal best!' : '🍅 First game in the books!') : `Your best: ${best}`
      }</p>${unlockNote}`;
      leaderboard.offer([{ score, rolls: [...match.players[0].rolls] }]);
    } else {
      const leaders = match.leaders();
      const order = match.players.map((p, i) => ({ name: p.name, score: totals[i], i })).sort((a, b) => b.score - a.score);
      if (mode === 'cpu' && rival) {
        // Only your own score goes on the leaderboard, never the computer's
        leaderboard.offer([{ score: totals[0], rolls: [...match.players[0].rolls] }]);
        const result = totals[0] > totals[1] ? 'w' : totals[0] < totals[1] ? 'l' : 't';
        const record = storage.vsRecord();
        const r = (record[rival.id] ??= { w: 0, l: 0, t: 0 });
        r[result]++;
        storage.saveVsRecord(record);
      } else {
        leaderboard.offer(order.map((r) => ({ name: match!.players[r.i].name, score: r.score, rolls: [...match!.players[r.i].rolls] })));
      }
      $('go-title').textContent =
        leaders.length > 1 ? "It's a tie!" : mode === 'cpu' && leaders[0] === 0 ? 'You win! 🍅' : `${match.players[leaders[0]].name} wins!`;
      body.innerHTML = `<ul class="results">${order
        .map((r) => `<li class="${leaders.includes(r.i) ? 'win' : ''}"><span>${escapeHtml(r.name)}</span><span>${r.score}</span></li>`)
        .join('')}</ul>${mode === 'cpu' && rival ? rivalQuote(rival, totals[0] > totals[1], totals[0] === totals[1]) : ''}${unlockNote}`;
    }
    showScreen('gameover');
  }

  // ---- Progress, unlock toasts and the Wardrobe ----
  let trackers: GameTracker[] = [];
  let gameUnlocks: Item[] = []; // unlocked during the current game, listed on the game-over screen
  /** Records progress; returns anything newly unlocked (and toasts it unless `toast` is false). */
  function gainProgress(change: Partial<Progress>, toast = true): Item[] {
    const before = progress;
    progress = mergeProgress(progress, change);
    storage.saveProgress(progress);
    const fresh = newlyUnlocked(before, progress);
    if (fresh.length && toast) {
      gameUnlocks.push(...fresh);
      showToast(`🎁 Unlocked: ${fresh.map((i) => i.name).join(', ')}!`);
    }
    return fresh;
  }

  const toastEl = $('toast');
  let toastTimer: number | undefined;
  function showToast(text: string) {
    toastEl.textContent = text;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => (toastEl.hidden = true), 3500);
  }

  /** A short phone buzz on big moments (only where supported, and only with sounds on). */
  function buzz(pattern: number | number[]) {
    if (sound.sfxOn && 'vibrate' in navigator) navigator.vibrate(pattern);
  }

  function openWardrobe() {
    showScreen('wardrobe');
    renderWardrobe(progress, equipped, equip);
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
      scoreboard.showPractice(practiceRack ? `Spare: ${b.textContent}` : 'Full rack');
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
    canAim: () => openScreen === null && (phase === 'aiming' || phase === 'charging') && !cpuTurn(),
    isCharging: () => phase === 'charging',
    moveBy(delta) {
      if (cpuTurn()) return; // the rival's turn
      if (phase !== 'aiming') return;
      aimX = clamp(aimX + delta * MAX_X, -MAX_X, MAX_X);
      physics.holdBall(aimX);
    },
    setPosition(v) {
      if (cpuTurn()) return; // the rival's turn
      if (phase !== 'aiming') return;
      aimX = clamp(v, -1, 1) * MAX_X;
      physics.holdBall(aimX);
    },
    nudgeAim(delta) {
      if (cpuTurn()) return; // the rival's turn
      if (phase !== 'aiming' && phase !== 'charging') return;
      aim = clamp(aim + delta, -1, 1);
    },
    nudgeSpin(delta) {
      if (cpuTurn()) return; // the rival's turn
      if (phase !== 'aiming' && phase !== 'charging') return;
      spin = clamp(Math.round((spin + delta) * 10) / 10, -1, 1);
      updateSpinLabel();
    },
    startCharge() {
      if (cpuTurn()) return; // the rival's turn
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
      if (cpuTurn()) return; // the rival's turn
      if (phase !== 'aiming') return;
      showPower(t.power, true);
      setTimeout(() => showPower(t.power, false), 700);
      aim = swipeDirectionToAim(t.direction);
      phase = 'swinging';
      dave.swing(() => launch(t.power, aim, t.spin));
    },
    swipePreview(direction) {
      if (openScreen === null && phase === 'aiming' && !cpuTurn()) aim = swipeDirectionToAim(direction);
    },
    advance() {
      if (openScreen === 'pass') showScreen(null);
      else if (openScreen === null && phase === 'replay') endReplay();
      else if (openScreen === null && phase === 'result') {
        autoReplay = false; // tapping skips the automatic strike replay too
        if (daveComments && resultTime < REACTION_AT) resultTime = REACTION_AT;
        else nextAfterResult();
      }
    },
    rerack() {
      // Only in practice: in a real game the pinsetter follows the rules
      if (mode === 'practice' && openScreen === null && (phase === 'aiming' || phase === 'result')) runPinsetter('rerack');
    },
    fastForward() {
      if (openScreen === null && (phase === 'rolling' || phase === 'settling')) setFastForward(timeScale === 1);
    },
    replay() {
      if (phase === 'replay') endReplay();
      else startReplay();
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
      if (b.dataset.toggle === 'quality') {
        b.setAttribute('aria-pressed', String(quality === 'high'));
        b.querySelector('b')!.textContent = quality === 'high' ? 'High' : 'Low';
        continue;
      }
      const on = b.dataset.toggle === 'music' ? sound.musicOn : sound.sfxOn;
      b.setAttribute('aria-pressed', String(on));
      b.querySelector('b')!.textContent = on ? 'On' : 'Off';
    }
  }
  for (const b of toggleButtons) {
    b.addEventListener('click', () => {
      sound.unlock();
      if (b.dataset.toggle === 'music') sound.toggleMusic();
      else if (b.dataset.toggle === 'sfx') sound.toggleSfx();
      else {
        quality = quality === 'high' ? 'low' : 'high';
        storage.saveText('quality', quality);
        applyQuality();
      }
      refreshToggles();
    });
  }
  refreshToggles();
  // A soft click for every menu button
  document.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.card button, #practice-panel button, #spin button, #pause-btn, #replay-btn')) sound.click();
  });

  // ---- Screen buttons ----
  const playerSetup = new PlayerSetup((names) => startGame('pass', names));
  document.querySelectorAll<HTMLButtonElement>('[data-go]').forEach((b) =>
    b.addEventListener('click', () => {
      const go = b.dataset.go!;
      if (go === 'single') startGame('single');
      else if (go === 'practice') startGame('practice');
      else if (go === 'rivals') openRivals();
      else if (go === 'career') openCareer();
      else if (go === 'careerstats') openStats();
      else if (go === 'setup') {
        playerSetup.load();
        showScreen('setup');
      } else if (go === 'menu') showScreen('menu');
      else if (go === 'leaderboard') void leaderboard.open();
      else if (go === 'wardrobe') openWardrobe();
    }),
  );
  $('pause-btn').addEventListener('click', () => controls.pause());
  $('resume').addEventListener('click', () => showScreen(null));
  $('how-to').addEventListener('click', () => showScreen('tutorial'));
  $('tutorial-ok').addEventListener('click', () => {
    storage.setFlag('tutorial-seen');
    showScreen(null);
  });
  // Restarting keeps the same match: players, length, and career rung
  const restart = () => startGame(mode, match?.players.map((p) => p.name), match?.frames, careerRung);
  $('restart').addEventListener('click', restart);
  $('play-again').addEventListener('click', restart);
  $('pass-ready').addEventListener('click', () => showScreen(null));

  // ---- Resize ----
  function resize() {
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    rig.resize(window.innerWidth, window.innerHeight);
  }
  window.addEventListener('resize', resize);
  resize();

  // ---- Camera ----
  function currentShot(): Shot {
    if (MENU_SHOT_SCREENS.includes(openScreen)) return 'menu';
    if (phase === 'replay') return 'replay';
    if (phase === 'result' && daveComments && resultTime >= REACTION_AT) return 'dave';
    if (monitorGlance && (phase === 'sweeping' || phase === 'aiming') && scoreboard.animating) return 'monitor';
    monitorGlance = false;
    if (phase === 'aiming' || phase === 'charging' || phase === 'swinging' || phase === 'sweeping') return 'aim';
    if (phase === 'rolling' || phase === 'settling') return 'follow';
    return 'pins';
  }

  // ---- Per-frame updates ----
  const tmp = new THREE.Vector3();
  // ---- Practice aim helper ----
  // In practice the yellow line shows where the throw will really go: the throw is run on a
  // second, pin-less physics world at the speed of your last practice throw. A blue
  // line shows where your last throw actually went.
  let predictor: BowlingPhysics | null = null;
  let predictorLoading = false;
  let predicted: { x: number; z: number }[] = [];
  let predictedKey = '';
  let lastPredict = 0;
  const DEFAULT_PRACTICE_POWER = 0.55;
  const legend = $('aim-legend');
  const ghostLine = new PathRibbon(AIM_POINTS, '#5fd0ff', 0.026, 0.8, 0.15);
  const ghostPoints = Array.from({ length: AIM_POINTS }, () => ({ x: 0, z: 0 }));
  ghostLine.visible = false;
  scene.add(ghostLine.mesh);

  function practiceSpeed() {
    return lastThrow.speed > 0 ? lastThrow.speed : (MIN_SPEED + DEFAULT_PRACTICE_POWER * (MAX_SPEED - MIN_SPEED)) * speedBonus;
  }

  /** The pin-less practice world, shared with the computer bowlers. Loads on first use. */
  function ensurePredictor(): BowlingPhysics | null {
    if (!predictor) {
      if (!predictorLoading) {
        predictorLoading = true;
        void BowlingPhysics.create().then((p) => {
          for (const i of p.pins.keys()) p.removePin(i);
          p.setConditions(lane);
          predictor = p;
        });
      }
      return null;
    }
    if (predictor.ballRadius !== physics.ballRadius) predictor.setBallRadius(physics.ballRadius);
    return predictor;
  }

  function updatePrediction(now: number) {
    if (!ensurePredictor() || !predictor) return false;
    const speed = practiceSpeed();
    const key = [aimX, aim, spin, speed, physics.ballRadius].map((v) => v.toFixed(3)).join('|');
    // At most ten times a second, and only when something changed
    if (key !== predictedKey && now - lastPredict > 100) {
      predictedKey = key;
      lastPredict = now;
      predicted = predictor.tracePath({ x: aimX, angle: aim * MAX_ANGLE, speed, spin }, HEAD_PIN_Z);
      legend.textContent = `Yellow: where it'll go at ${speed.toFixed(1)} m/s` + (lastReplay ? ' · Blue: your last throw' : '');
    }
    return predicted.length > 1;
  }

  /** The last throw's path, from the replay recording, up to the pins. */
  function updateGhost() {
    const r = lastReplay;
    ghostLine.visible = mode === 'practice' && (phase === 'aiming' || phase === 'charging') && r !== null;
    if (!ghostLine.visible || !r) return;
    const until = r.hitTime ?? r.end;
    for (let i = 0; i < AIM_POINTS; i++) {
      r.sample((i / (AIM_POINTS - 1)) * until, 0, tmp, replayQuat);
      ghostPoints[i].x = tmp.x;
      ghostPoints[i].z = tmp.z;
    }
    ghostLine.set(ghostPoints, 0.003);
  }

  function updateAimLine() {
    aimLine.visible = (phase === 'aiming' || phase === 'charging') && !cpuTurn();
    updateGhost();
    if (!aimLine.visible) return;
    if (mode === 'practice' && updatePrediction(performance.now())) {
      // Spread the line's points evenly along the predicted path
      for (let i = 0; i < AIM_POINTS; i++) {
        const k = (i / (AIM_POINTS - 1)) * (predicted.length - 1);
        const a = predicted[Math.floor(k)];
        const b = predicted[Math.min(Math.ceil(k), predicted.length - 1)];
        const f = k - Math.floor(k);
        aimPoints[i].x = a.x + (b.x - a.x) * f;
        aimPoints[i].z = a.z + (b.z - a.z) * f;
      }
      aimLine.set(aimPoints, 0.005);
      return;
    }
    const p = physics.ball.translation();
    const angle = aim * MAX_ANGLE;
    const length = -HEAD_PIN_Z;
    for (let i = 0; i < AIM_POINTS; i++) {
      const d = (i / (AIM_POINTS - 1)) * length;
      // Rough hook preview at a medium throw: almost nothing in the oil, then it bends late
      const hook = spin * 0.37 * Math.pow(d / length, 3);
      aimPoints[i].x = p.x + Math.sin(angle) * d + hook;
      aimPoints[i].z = p.z - BALL_RADIUS - Math.cos(angle) * d;
    }
    aimLine.set(aimPoints, 0.005);
  }

  const pinPos = new THREE.Vector3();
  const pinQuat = new THREE.Quaternion();
  function syncMeshes() {
    if (phase === 'replay' && lastReplay) {
      // Everything comes from the recording
      const r = lastReplay;
      ballMesh.visible = r.sample(replayT, 0, ballMesh.position, ballMesh.quaternion);
      for (let i = 0; i < pinSet.count; i++) pinSet.set(i, pinPos, pinQuat, r.sample(replayT, i + 1, pinPos, pinQuat));
      pinSet.commit();
      return;
    }
    physics.pins.forEach((pin, i) => pinSet.set(i, pin.translation(), pin.rotation(), !physics.isPinRemoved(i)));
    pinSet.commit();
    const held = phase === 'aiming' || phase === 'charging' || phase === 'swinging';
    ballMesh.visible = true;
    if (phase === 'sweeping') {
      // The tomato rolls home along the return chute while the pinsetter works
      ballMesh.visible = chute.ballAt(pinsetter.elapsed, physics.ballRadius, ballMesh);
    } else if (held) {
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
  function updateSounds(frozen: boolean) {
    if (phase === 'replay') return; // the replay plays its own recorded sounds
    const live = !frozen && (phase === 'rolling' || phase === 'settling');
    const b = physics.ball.translation();
    const v = physics.ball.linvel();
    const onLane = live && b.y > -0.25 && b.z > HEAD_PIN_Z - 1.2;
    const nowInGutter = Math.abs(b.x) > LANE_HALF + 0.02 && b.y < 0.05;
    if (onLane && nowInGutter && !inGutter) {
      sound.gutter();
      recorder.event({ kind: 'gutter' });
    }
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
        recorder.event({ kind: 'clack', strength: jolt / 3 });
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
      recorder.event({ kind: 'hit', at: splashAt.clone(), dir: splashDir.clone(), strength });
      sound.ballHit(strength);
      if (splashed.size === 1) buzz(25);
    }
  }

  /** The computer rival's turn: size up the pins, step into place, then bowl. */
  function updateCpu(dt: number) {
    if (!rival || !match) return;
    if (rushing) cpuTimer = Math.min(cpuTimer, 0.15);
    cpuTimer -= dt;
    if (cpuTimer > 0) return;
    if (!cpuThrow) {
      const tracer = ensurePredictor();
      if (!tracer) return; // still loading; try again next frame
      // Whoever's on the approach now, it's the rival who bowls
      dave.setHead(rival.head);
      dave.setOutfit(rival.outfit);
      const standing = physics.pins.flatMap((pin, i) => (physics.isPinDown(i) ? [] : [pin.translation()]));
      const target = chooseTarget(standing, rival);
      const [you, them] = match.totals();
      const plan = planThrow(rival, target, tracer);
      cpuThrow = humanise(rival, plan, pressureFor(match.position.frame, them, you, match.frames), undefined, !target.fullRack);
      aimX = cpuThrow.x;
      physics.holdBall(aimX);
      cpuTimer = CPU_LINE_UP;
      return;
    }
    const t = cpuThrow;
    cpuThrow = null;
    phase = 'swinging';
    dave.swing(() => launch(0, t.angle / MAX_ANGLE, t.spin ?? 0, t.speed));
  }

  function updatePhase(dt: number) {
    if (phase === 'aiming' && cpuTurn()) {
      updateCpu(dt);
    } else if (phase === 'charging') {
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
    } else if (phase === 'replay') {
      updateReplay(dt);
    } else if (phase === 'result') {
      resultTime += dt;
      if (autoReplay && resultTime >= autoReplayAt) {
        autoReplay = false;
        startReplay();
        return;
      }
      if (!daveComments) {
        // A quiet ball: a look at the pins, then straight on
        if (resultTime > (rushing ? 0.35 : QUIET_PAUSE)) nextAfterResult();
        return;
      }
      if (resultTime >= REACTION_AT && !reactionShown) {
        reactionShown = true;
        dave.react(reaction);
        speech.show(
          speaker
            ? pickLine(reaction, Math.random, speaker.lines, speaker.id)
            : ((mode === 'cpu' && rival ? pickVsLine(reaction, rival.name) : null) ?? pickLine(reaction)),
        );
      }
      if (resultTime > RESULT_PAUSE) nextAfterResult();
    }
  }

  // ---- Main loop (fixed physics step) ----
  let acc = 0;
  let last = performance.now();
  function frame(now: number) {
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    // While any screen is open (pause, menus, pass the device...) the game itself stands still
    const frozen = openScreen !== null;
    const gameDt = frozen ? 0 : dt * timeScale;
    acc += gameDt;
    let steps = 0;
    const maxSteps = 12 * timeScale;
    while (acc >= PHYSICS_DT && steps < maxSteps) {
      pinsetter.update(PHYSICS_DT);
      physics.step();
      recorder.capture(bodies);
      acc -= PHYSICS_DT;
      steps++;
    }
    if (steps === maxSteps) acc = 0;

    updatePhase(gameDt);
    ffBtn.hidden = !(openScreen === null && (phase === 'rolling' || phase === 'settling'));
    replayBtn.hidden = !(openScreen === null && phase === 'result' && lastReplay !== null);
    skipBtn.hidden = !(openScreen === null && cpuTurn() && !rushing);
    if (phase === 'aiming' || phase === 'charging' || phase === 'sweeping') dave.setStance(aimX - DAVE_OFFSET_X, DAVE_Z);
    // Dave keeps moving in the menus (he waves), but freezes mid-move on the pause screen
    dave.update(openScreen === 'pause' ? 0 : dt);
    releaseBlend = Math.max(0, releaseBlend - gameDt / 0.15);
    syncMeshes();
    if (!frozen) updateJuice();
    juice.update(phase === 'replay' && lastReplay ? gameDt * lastReplay.rateAt(replayT) : gameDt);
    updateSounds(frozen);
    venues.update(dt);
    scoreboard.update(dt);
    if (physics.bumped) {
      physics.bumped = false;
      sound.bump();
      recorder.event({ kind: 'bump' });
    }
    updateAimLine();
    const b = phase === 'replay' ? ballMesh.position : physics.ball.translation();
    rig.update(dt, { shot: currentShot(), standX: aimX - DAVE_OFFSET_X, aimX, daveZ: DAVE_Z, dave: dave.root.position, ball: b });
    input.update(dt);
    renderer.render(scene, camera);
    speech.update(dave, camera);
    requestAnimationFrame(frame);
  }

  // Small hook for automated testing in the browser console
  (window as unknown as { __game: unknown }).__game = {
    physics,
    controls,
    renderer,
    scene,
    throwBall: (x = 0, aimValue = 0, p = 0.5, s = 0) => {
      aimX = x;
      physics.holdBall(aimX);
      launch(p, aimValue, s);
    },
    get phase() {
      return phase;
    },
    sound,
    get aim() {
      return aim;
    },
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
    startCpu,
    startCareerMatch,
    openCredits,
    get lane() {
      return lane;
    },
    get career() {
      return career;
    },
    showScreen,
    get lastThrow() {
      return lastThrow;
    },
    get replay() {
      return lastReplay;
    },
    scoreboard,
    /** Play a scoreboard animation as if a ball had just been thrown, for checking how it looks. */
    celebrate(kind: ReactionKind, streak = 1) {
      celebrate(kind, streak);
      runPinsetter('rerack');
    },
    /** Jump the replay to a moment (seconds into the throw), for checking camera shots. */
    seekReplay(t: number) {
      replayT = t;
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

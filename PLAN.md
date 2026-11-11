# Tomato Dave's Ten-pin: Game Plan

A browser 3D ten-pin bowling game starring **Tomato Dave**, a man in a suit with a tomato for a head. He bowls tomato-styled bowling balls. Hosted on Vercel. Plays on phone and desktop.

---

## 1. Decisions so far

| Area | Choice |
|---|---|
| Visual style | Simple low-poly cartoon 3D |
| Camera | Over-the-shoulder, behind Dave. Follows the ball down the lane, then shows the pins |
| Controls | **Swipe/flick** on touch screens, **aim + hold-to-charge** with the mouse. Both work on any device |
| Ball | Red bowling ball made to look like a tomato (green stalk and leaves on top) |
| Impact | Ball stays whole. Red juice particles spray when it hits pins |
| Modes | Single player (10 frames), local pass-and-play (2–4 players), quick practice, online leaderboard |
| Leaderboard name | Free-text nickname (max 12 characters) with a bad-word filter |
| Audio | Sound effects and a looping music track, with mute toggles |
| Extras | Spin/hook, Dave reactions, unlockable balls and suits |

---

## 2. Tech stack

| Piece | Tool | Why |
|---|---|---|
| Build | **Vite + TypeScript** | Fast, outputs a static site. Vercel detects it with no setup |
| 3D | **Three.js** | Standard browser 3D library |
| Physics | **Rapier** (`@dimforge/rapier3d-compat`) | Stable rigid-body physics, so pins don't jitter or pass through each other |
| UI (menus, scorecard) | Plain HTML/CSS on top of the canvas | Simple, sharp text, easy to make responsive |
| Audio | **Howler.js** | Handles mobile audio unlock and looping |
| Leaderboard API | **Vercel Functions** (`/api/scores`) | Lives in the same repo and deploys with it |
| Leaderboard storage | **Upstash Redis** (from the Vercel Marketplace, free tier) | A sorted set suits a top-N score table |
| Profanity filter | `obscenity` npm package (run on the server) | Covers common evasions like `b4dw0rd` |
| Local saves | `localStorage` | Unlocks, settings, best scores |

There is no framework like React. The game is mostly canvas, so a framework adds weight without much benefit.

---

## 3. Gameplay

### Lane and physics
- Regulation proportions: 18.3 m lane, 1.05 m wide, gutters, standard pin triangle.
- Pins: a simple collider shape (cylinders stacked into a pin profile), with weight and friction tuned for satisfying scatter.
- The ball slides at first and then starts rolling. Spin adds a sideways force that grows as the ball slows, which gives a realistic late hook.
- A pin counts as knocked down when it tilts past about 30° or leaves the deck.
- Between throws, a sweep animation clears fallen pins and the remaining pins are put back in place.

### Controls

**Touch (swipe):**
1. Drag Dave left or right along the foul line to set where he stands.
2. Swipe up the screen to throw. Swipe speed sets power, swipe direction sets aim, and a curve in the swipe adds spin.

**Mouse (aim + hold):**
1. Move the mouse to slide Dave left or right, and use the mouse wheel or A/D keys to angle the aim arrow.
2. Hold the button to charge the power meter, which rises and falls. Release to throw.
3. Spin: a small dial (or the Q/E keys) set before throwing.

Both schemes are always active, so a touchscreen laptop works either way. A short "how to throw" card appears the first time.

### Scoring
- Standard ten-pin rules: strikes, spares, and bonus balls in the 10th frame.
- Classic scorecard strip at the top, with X, /, and – marks.
- The scoring logic is kept separate from the 3D code and covered by unit tests (perfect game 300, all spares, gutter game, 10th-frame edge cases).

### Modes
- **Single player:** 10 frames. At the end, the player is offered a leaderboard submission.
- **Pass-and-play:** 2–4 players enter names, take turns, and see one scorecard row each. A "Pass to NAME" screen appears between turns. No leaderboard submission.
- **Quick practice:** Unlimited throws with no scorecard. Buttons to reset pins and set up common spares like the 7-10 split.
- **Leaderboard:** All-time top 50, plus the player's own best score on this device.

---

## 4. Tomato Dave and art

All models are built in code from simple shapes, in a low-poly, flat-shaded style. That means no 3D modelling software is needed. Any piece can later be swapped for a `.glb` model if you want a custom-made Dave.

- **Dave:** Navy suit, white shirt, red tie, and a big tomato head with a leafy stalk, simple cartoon eyes, and a moustache. Head features are textures drawn on a canvas, so expressions are easy to swap.
- **Animations** (done in code, no rigging): idle sway, approach steps, arm swing, release, and follow-through.
- **Reactions** after each throw (camera cuts back to Dave):
  - Strike: fist pump, plus a speech bubble like "Ketchup with THAT!"
  - Spare: nod and thumbs up
  - Gutter ball: slumps and turns a deeper red, "...I'm sauce."
  - Split: scratches head
  - A pool of 5–8 lines per event so it doesn't repeat too often.
- **Juice splash:** Red/orange particles and a brief lane decal on ball–pin impact. Bigger on strikes.
- **Alley setting:** Wooden lane texture, arrow markers, retro back wall with a "Tomato Dave's" neon sign, and a ball return.

### Unlockables (saved in the browser)

| Unlock | How to earn it |
|---|---|
| Cherry tomato ball (smaller, faster) | Score 100+ |
| Green tomato ball | Get 3 strikes in one game |
| Heirloom (stripy) tomato ball | Score 150+ |
| Golden tomato ball | Bowl a perfect frame run (turkey: 3 strikes in a row) |
| Tuxedo suit | Score 200+ |
| Pinstripe suit | Convert a split |
| Tracksuit | Play 10 games |

There is a "Wardrobe" screen to choose ball and suit. Unlocks are cosmetic only, apart from the cherry ball's small handling difference.

---

## 5. Audio

- **Sound effects:** ball roll (loops and gets louder with speed), pin crash (different sounds for a few or many pins), gutter clunk, juicy squelch on impact, crowd cheer on a strike, groan on a gutter ball, UI clicks.
- **Music:** one looping lounge/swing track on menus and a quieter version during play.
- **Sources:** CC0 (free, no attribution) sounds and music from Freesound / OpenGameArt, or tracks you supply. A credits list will be included either way.
- Separate mute toggles for music and sound effects, remembered between visits. Audio starts on the first tap, because browsers require it.

---

## 6. Online leaderboard

- `POST /api/scores` with `{ name, score }`:
  - Name: trimmed, 1–12 characters, letters/numbers/spaces only, checked by the profanity filter.
  - Score: whole number 0–300.
  - Rate limit: about 5 submissions per IP address per hour (using Upstash's rate limiter).
- `GET /api/scores` returns the top 50.
- **Cheating caveat:** In a browser game, anyone determined can fake a score. To make that harder, the client sends the frame-by-frame throw record, and the server re-checks that the score adds up and follows bowling rules. That stops casual tampering, not dedicated cheaters. That's normal and fine for a fun game.
- If the leaderboard can't be reached, the game still works and just shows "leaderboard offline".

### Vercel setup (one-time, done by you)
1. Import the GitHub repo into Vercel (it detects Vite automatically).
2. In the project, go to **Storage → Marketplace → Upstash Redis** and create a free database. Vercel adds the connection environment variables for you.
3. Redeploy. That's it.

---

## 7. Screens

1. **Title:** Dave posing, "Tomato Dave's Ten-pin" logo, and Play / Pass & Play / Practice / Leaderboard / Wardrobe / Settings.
2. **Player setup** (pass-and-play): add 2–4 names.
3. **Game:** 3D view, scorecard at the top, power/aim controls, pause button.
4. **Game over:** final score, any new unlocks, submit to leaderboard (single player only), play again.
5. **Leaderboard, Wardrobe, Settings** (audio, controls help, quality setting low/high for older phones).

Layout works in portrait and landscape on phones. Portrait is the main mobile design.

---

## 8. Performance targets

- 60 fps on a mid-range phone with "low" quality: no shadows, fewer particles, lower resolution.
- First load under about 3 MB (the 3D models are made in code, so most of the size is audio).
- Physics runs at a fixed 60 steps per second regardless of screen refresh rate, so throws behave the same on every device.

---

## 9. Project structure

```
/index.html
/src
  main.ts              entry: boots the game and the UI
  game/
    GameState.ts       mode, players, frames, turn flow
    scoring.ts         pure scoring rules (unit tested)
    physics.ts         Rapier world, lane, pins, ball
    throw.ts           turns input into ball speed/aim/spin
  scene/
    lane.ts  pins.ts  ball.ts  dave.ts  alley.ts  particles.ts  camera.ts
  input/
    touch.ts  mouse.ts
  ui/
    screens/ (title, setup, hud, gameover, leaderboard, wardrobe, settings)
    scorecard.ts  speech.ts
  audio/sound.ts
  save/storage.ts      unlocks + settings in localStorage
/api
  scores.ts            Vercel function: GET top 50, POST new score
/public/audio/         sound effects + music
/tests/scoring.test.ts
```

---

## 10. Build order (milestones)

Each milestone ends with something playable that can be deployed to Vercel.

1. **Bare lane:** Vite + Three.js + Rapier setup. A lane, 10 pins, a ball pushed by a key press. Deployed to Vercel to confirm the pipeline works.
2. **Throwing:** Both control schemes, spin/hook, camera following the ball, pin knockdown detection and pin reset.
3. **Scoring and modes:** Scoring logic with tests, scorecard display, single player, pass-and-play, and practice.
4. **Tomato Dave:** Dave model, throw animation, reactions and speech bubbles, tomato ball, juice splash, alley decoration.
5. **Audio:** Sound effects, music, and mute settings.
6. **Leaderboard:** API function, Upstash Redis, name filter, rate limiting, score checking, leaderboard screen.
7. **Unlockables and polish:** Wardrobe, unlock rules, title screen, first-time tutorial, quality settings, tuning on real phones.

---

## 11. Open items for later

- A custom-made Dave `.glb` model instead of the code-built one (optional).
- Music choice: use a CC0 track, or supply your own.
- Custom domain on Vercel (optional).
- Ideas for later versions: online multiplayer, daily challenge, more alleys, haptic buzz on mobile strikes.

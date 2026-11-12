# Tomato Dave's Ten-pin

A 3D browser bowling game starring Tomato Dave. See [PLAN.md](PLAN.md) for the full plan, and [CAREER.md](CAREER.md) for the planned career mode.

**Current state: Stage 4.** Tomato Dave is in! He holds the ball, swings and slides into each throw, then reacts to every result with a speech bubble (strikes, spares, splits, gutters...). Tomato juice splashes when the ball hits the pins, and the alley has a neon sign, a ball return and neighbouring lanes.

**Sound (stage 5):** an original lounge tune, "Tomato Lounge", composed in code (walking bass, electric piano, brushed drums, vibraphone), plus sound effects for the rolling ball, pin crashes, juicy squelches, the gutter, the pinsetter, and a crowd that cheers, claps or groans. Nothing is downloaded, so there are no licences to worry about. Music and Sounds can each be switched off from the menu or pause screen, and the choice is remembered.

To use your own music instead, add an MP3 at `public/audio/music.mp3` and it will loop in place of the built-in tune.

**Online leaderboard (stage 6):** after a single-player game you can add your score to an all-time top 50 (🏆 Leaderboard on the menu). The server re-checks every game ball by ball, filters rude names, and limits each IP to 5 submissions an hour. If the leaderboard isn't reachable, the game carries on and says "Leaderboard offline".

**Unlockables (stage 7):** earn new tomato balls and suits for Dave, then pick them in the 👔 Wardrobe:

| Unlock | How |
|---|---|
| Cherry Tomato ball (smaller, a bit faster) | Score 100+ |
| Green Tomato ball | 3 strikes in one game |
| Heirloom ball | Score 150+ |
| Golden Tomato ball | A turkey (3 strikes in a row) |
| Tuxedo | Score 200+ |
| Pinstripe suit | Pick up a split |
| Tracksuit | Play 10 games |

Also: a "How to bowl" card on your first game (and in the pause menu), a Graphics High/Low setting for older phones (picked automatically at first), and a phone buzz on strikes where supported.

**Venues:** pick where Dave bowls from the 📍 button on the menu. Each has its own look and its own original music track:

| Venue | Look | Music |
|---|---|---|
| Tomato Dave's | Retro alley with wall murals, glowing lane edges and overhead screens | "Tomato Lounge" (swing) |
| Server Room Lanes | Racks of blinking servers, cable trays, a terminal screen | "Packet Loss" (chiptune) |
| Disco Inferno | Mirror ball, sweeping spotlights, flashing dance floor | "Disco Dave" (disco) |
| Rooftop at Sunset | Open sky, city skyline, string lights | "Bossa Marinara" (bossa nova) |

**Replay:** after any throw, tap **🎥 Replay** (or press V) to watch it again from a camera inside the pinsetter, peeking out from under the masking unit. Every pin is in view as the ball rolls down the lane towards them; the camera tilts down as it arrives and drops into slow motion for the impact, juice and all. Strikes replay automatically. Tap to skip.

**Overhead scoreboard:** the monitor above the lane shows the live scorecard (every player in Pass & Play), themed to each venue, and plays a little animation after a strike, spare or gutter ball, with the camera glancing up at it while the pinsetter works. Three strikes in a row get a TURKEY! banner (then HAMBONE!, 5-BAGGER! and so on).

**Pace:** Dave always has something to say about strikes, spares, splits and gutter balls, but only sometimes about an ordinary count, so the game keeps moving. The controls hint fades away after your first few throws.

After each throw the tomato rolls home along a ball return chute between the lanes. And the tomato isn't perfectly round: when its stem rolls under, it can give the ball a small hop at a random point down the lane.

There are three modes:

- **Play:** a full 10-frame game with standard scoring (strikes, spares, 10th-frame bonus balls). Your best score is saved on this device.
- **Pass & Play:** 2–4 players take turns on one device. A "pass the device" screen appears between turns.
- **🪜 Career:** climb five venues, one ladder at a time. Each has three rivals and a champion, and its own lane twist that affects everyone:
  - 🍅 **Tomato Dave's:** 🥒 Pickle Pete, 🍩 Donut Dana and 🥪 Sandy Wich in quick 5-frame matches, then 🥕 Carrot Carl. Standard lane.
  - 🖥️ **Server Room Lanes:** 💾 Micro Chip, 🍪 Cookie Kate, 🧇 Wafer Walt and 🧀 Byte-sized Brie. *Long oil:* the hook comes late and small.
  - 🪩 **Disco Inferno:** 🍮 Jelly Jive, 🥭 Mango Tango, 🍋 Lemon Twist and 🍆 Aubergine Annie. *Bouncy pins.*
  - 🌇 **Rooftop at Sunset:** 🍳 Sunny Side, 🍭 Ice Lolly Lou, 🥝 Kiwi Kai and 🥔 Big Russet. *Breezy:* a new breeze each frame, shown on screen.
  - 🏆 **The Golden Pin:** a gold-and-velvet hall with its own music, and 🎃 the Pumpkin King. *Dry lanes:* the hook comes early and hard. Win, and roll the credits.

  Earn up to three ⭐ a match (win; win big; a turkey or no open frames). Each champion's crown opens the next venue and unlocks a reward (Champion's Blazer, Circuit Board ball, Glitter Suit, Sunset Tomato ball, Golden Dave suit). Matches can be resumed where you left off, and the Golden Pin joins the venue picker once you reach it.
- **🆚 vs CPU:** take turns frame by frame against any rival you've met in Career. Each bowls in Dave's body with a head of their own, and has plenty to say about their own balls. Rivals bowl real balls through the same physics as you (they pick a target, work out the throw, then miss by as much as their skill says), so they leave splits and miss spares honestly. Your record against each is kept on the device. This is the first step of the career mode in [CAREER.md](CAREER.md).
- **Practice:** unlimited throws, plus one-tap setups for common spares (10 pin, 7 pin, 7-10 split, bucket, big four). The yellow aim line shows exactly where the ball will go (it's worked out with the real physics, at the speed of your last throw), and a blue line shows where your last throw actually went.

You throw by swiping on touch screens, or by holding and releasing with a mouse or keyboard. Spin makes the ball hook late in the lane.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm test               # unit tests
npm run check:physics  # simulate test throws without a browser
npm run check:api      # run the leaderboard API against a stand-in database
npm run check:rivals   # play each computer rival through simulated games; checks they average near their target
npm run check:browser  # play a few throws of the production build in headless Chromium (run `npm run build` first)
```

Every push runs all of these on GitHub (`.github/workflows/checks.yml`).

### Where things live

| Folder | What's in it |
|---|---|
| `src/game/` | Rules and simulation, no graphics: scoring, match flow, physics, pinsetter, replay recording, unlocks, Dave's reactions |
| `src/scene/` | Three.js: the alley, venues, Dave, models, juice, the camera rig |
| `src/ui/` | Overlay screens: scorecard, leaderboard, Wardrobe, player setup |
| `src/input/`, `src/audio/`, `src/net/`, `src/save/` | Controls, sound and music, the leaderboard client, saved settings |
| `src/main.ts` | Wires it all together and runs the throw-by-throw game loop |
| `api/`, `server/` | The leaderboard Vercel function and its rules |

The browser build loads the physics engine's WebAssembly as its own file (`vite.config.ts` swaps `@dimforge/rapier3d-compat` for `src/game/rapierWeb.ts`), so it downloads and compiles while the scene is being built. Node scripts keep using the compat package.

Dev only: open `/debug-dave.html` on the dev server to see Dave in every pose (`?view=side` for a side view).

## Controls

**Touch screens**
- Drag sideways to move along the foul line.
- Swipe up to throw. A faster flick gives more power.
- Aim by tilting the start of your swipe left or right. The yellow line shows where you're aiming while you swipe.
- Bend the end of your swipe to add spin. The ball curves the same way, late in the lane.
- Tap ⏩ while the ball rolls to speed it up 3×.

**Mouse and keyboard**

| Action | Mouse | Keyboard |
|---|---|---|
| Move left/right | Move the mouse | ← / → |
| Aim | Scroll wheel | A / D |
| Spin | Spin ◀ ▶ buttons | Q / E |
| Throw | Hold the button, release to throw | Hold Space, release to throw |
| Fast forward a rolling ball (3×) | ⏩ button | F |
| Replay the last throw | 🎥 Replay button | V |
| Skip the wait after a throw | Click | Space |
| Fresh rack (practice) | | R |
| Pause | ❚❚ button | Esc or P |

The power meter rises and falls while you hold, so time your release.

## Deploy to Vercel

1. Import this repo in Vercel. It detects Vite automatically (`vercel.json` sets the build command and `dist/` output), and `api/scores.ts` becomes the leaderboard function.
2. For the leaderboard: in the Vercel project, open **Storage**, choose **Upstash for Redis** (free plan) from the Marketplace and connect it to the project. Vercel adds the connection settings (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) for you.
3. Redeploy. Without step 2 the game still works and the leaderboard shows "offline".

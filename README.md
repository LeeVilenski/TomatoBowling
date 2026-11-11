# Tomato Dave's Ten-pin

A 3D browser bowling game starring Tomato Dave. See [PLAN.md](PLAN.md) for the full plan.

**Current state: Stage 3.** It's a playable bowling game with three modes:

- **Play:** a full 10-frame game with standard scoring (strikes, spares, 10th-frame bonus balls). Your best score is saved on this device.
- **Pass & Play:** 2–4 players take turns on one device. A "pass the device" screen appears between turns.
- **Practice:** unlimited throws, plus one-tap setups for common spares (10 pin, 7 pin, 7-10 split, bucket, big four).

You throw by swiping on touch screens, or by holding and releasing with a mouse or keyboard. Spin makes the ball hook late in the lane.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm test               # unit tests
npm run check:physics  # simulate test throws without a browser
```

## Controls

**Touch screens**
- Drag sideways to move along the foul line.
- Swipe up to throw. A faster flick gives more power.
- Aim by tilting the start of your swipe left or right. The yellow line shows where you're aiming while you swipe.
- Bend the end of your swipe to add spin. The ball curves the same way, late in the lane.

**Mouse and keyboard**

| Action | Mouse | Keyboard |
|---|---|---|
| Move left/right | Move the mouse | ← / → |
| Aim | Scroll wheel | A / D |
| Spin | Spin ◀ ▶ buttons | Q / E |
| Throw | Hold the button, release to throw | Hold Space, release to throw |
| Skip the wait after a throw | Click | Space |
| Fresh rack (practice) | | R |
| Pause | ❚❚ button | Esc or P |

The power meter rises and falls while you hold, so time your release.

## Deploy to Vercel

Import this repo in Vercel. It detects Vite automatically (`vercel.json` sets the build command and `dist/` output). No environment variables are needed yet.

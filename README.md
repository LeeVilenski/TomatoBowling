# Tomato Dave's Ten-pin

A 3D browser bowling game starring Tomato Dave. See [PLAN.md](PLAN.md) for the full plan.

**Current state: Stage 2 prototype.** It has a 3D lane and physics pins. You can throw by swiping or by holding to charge, and spin makes the ball hook late in the lane. Each rack is two balls, with a pinsetter that sweeps the fallen pins.

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
- Swipe up to throw. A faster swipe gives more power, the swipe's angle sets your aim, and curving the swipe adds spin.

**Mouse and keyboard**

| Action | Mouse | Keyboard |
|---|---|---|
| Move left/right | Move the mouse | ← / → |
| Aim | Scroll wheel | A / D |
| Spin | Spin ◀ ▶ buttons | Q / E |
| Throw | Hold the button, release to throw | Hold Space, release to throw |
| Skip the wait after a throw | Click | Space |
| Fresh rack | | R |

The power meter rises and falls while you hold, so time your release.

## Deploy to Vercel

Import this repo in Vercel. It detects Vite automatically (`vercel.json` sets the build command and `dist/` output). No environment variables are needed yet.

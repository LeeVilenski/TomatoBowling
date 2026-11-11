# Tomato Dave's Ten-pin

A 3D browser bowling game starring Tomato Dave. See [PLAN.md](PLAN.md) for the full plan.

**Current state: Stage 1 prototype.** It has a 3D lane, 10 physics pins, and a tomato ball you can aim and throw.

## Run locally

```bash
npm install
npm run dev            # http://localhost:5173
npm run build          # type-check + production build into dist/
npm run check:physics  # simulate test throws without a browser
```

## Controls (stage 1)

| Action | Keyboard | Touch / mouse |
|---|---|---|
| Move left/right | ← / → | Move ◀ ▶ |
| Aim | A / D | Aim ↖ ↗ |
| Speed | ↑ / ↓ | Speed − + |
| Throw | Space | Throw |
| Reset pins | R | Reset |

## Deploy to Vercel

Import this repo in Vercel. It detects Vite automatically (`vercel.json` sets the build command and `dist/` output). No environment variables are needed yet.

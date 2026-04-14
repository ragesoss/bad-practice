# CLAUDE.md

## Development

```bash
npm run dev        # start Vite dev server with hot reload
npm run build      # production build (tsc && vite build) to dist/
npm run preview    # preview production build locally
```

Always start the dev server and test changes in a browser before reporting work as done. The metronome is at `/metronome/`, the drone at `/drone/`, and the band at `/band/`.

## Project context

This is a vibe-coded project. All code was written by Claude Code; the human provides direction, design taste, and feedback. No code is written or edited by hand.

- [DEVELOPMENT.md](DEVELOPMENT.md) — code structure, architecture, development history, build/deploy
- [RESEARCH.md](RESEARCH.md) — audio synthesis research that informed the implementation (Karplus-Strong, jawari bridge simulation from Mutable Instruments Rings, lookahead scheduling, click synthesis recipes)

Read the research doc before making changes to audio synthesis code. The tanpura jawari implementation is adapted from Mutable Instruments Rings and the research doc explains the design rationale.

## Architecture

Multi-page Vite app with vanilla TypeScript, no frameworks. Four entry points: landing (`index.html`), metronome (`metronome/index.html`), drone (`drone/index.html`), band (`band/index.html`). Shared CSS theme, no shared runtime code.

The tanpura DSP runs in an `AudioWorkletProcessor` off the main thread (`src/drone/tanpura-worklet.js`). Communication is via `port.postMessage`. The main thread (`src/drone/drone.ts`) handles pluck scheduling, drift, and parameter updates.

The band scheduler (`src/band/scheduler.ts`) ticks at eighth-note resolution with cut-time BPM convention. Guitar voicings are computed from open chord shapes transposed via capo (`src/band/chords.ts`). Audio envelopes are tempo-adaptive, receiving the quarter-note duration to scale sustain.

## Deploy

Automatic via GitHub Actions on push to `main`. Deploys `dist/` to GitHub Pages.

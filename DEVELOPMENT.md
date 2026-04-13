# Development

## Code Structure

```
index.html                    Landing page
metronome/index.html          Metronome app
drone/index.html              Drone app

src/
  shared/
    style.css                 Shared theme: CSS variables, base layout, sliders,
                              buttons, select dropdowns (Warhol-inspired palette)
  landing/
    main.ts                   Landing page entry — just imports styles
    style.css                 Tool card grid
  metronome/
    main.ts                   Entry point
    audio.ts                  Web Audio click synthesis (4 recipes: clave,
                              woodblock, noise-wood, sine)
    scheduler.ts              Lookahead scheduler, BPM drift random walk,
                              per-beat jitter
    ui.ts                     DOM wiring, sliders, tap tempo, beat dots,
                              live BPM display
    style.css                 Beat dots, BPM display
  drone/
    main.ts                   Entry point
    tanpura-worklet.js        AudioWorkletProcessor — Karplus-Strong synthesis
                              with jawari bridge simulation, 4 string voices
    drone.ts                  Main-thread engine: pluck scheduling, tonic drift
                              random walk, per-string jitter, cents offset
    ui.ts                     DOM wiring, tonic/tuning selectors, cents display,
                              jawari slider, string visualization
    worklet-env.d.ts          TypeScript ambient declarations for AudioWorklet globals
    style.css                 String visualization, cents controls

vite.config.ts                Multi-page build config (landing, metronome, drone)
tsconfig.json                 TypeScript config
```

## Architecture

Each app is a separate Vite entry point. They share a CSS theme but no runtime code. The build produces static files in `dist/` with relative paths, suitable for GitHub Pages or any static host.

### Metronome audio pipeline

The metronome uses a [**lookahead scheduler**](RESEARCH.md#metronome-web-audio-scheduling) — a `setTimeout` loop running every 25ms that schedules audio events 100ms ahead using the Web Audio API clock. This compensates for JavaScript timer jitter and gives sample-accurate beat placement.

Each click is synthesized on the fly: an `OscillatorNode` connected through a `GainNode` with a fast attack/decay envelope. Four recipes offer different timbres (triangle wave clave, layered woodblock, noise-transient woodblock, sine beep).

Badness operates in two layers:
- **Per-beat jitter**: uniform random offset on each beat's interval, ±50% of ideal interval at max badness.
- **BPM drift**: a random walk that shifts the effective tempo over time. No mean-reversion — it wanders freely.

### Drone audio pipeline

The drone runs a [**Karplus-Strong**](RESEARCH.md#drone-karplus-strong-string-synthesis) plucked string algorithm inside an `AudioWorkletProcessor` (off the main thread). Four string voices share a single processor. Each string is a circular delay buffer initialized with filtered noise on pluck, with a per-sample feedback loop:

1. Read from delay buffer
2. Allpass interpolation for fractional-sample tuning accuracy
3. Jawari bridge modulation — amplitude-dependent delay modulation that creates the tanpura's characteristic harmonic buzz (asymmetric: the bridge only affects one direction of vibration, generating both even and odd harmonics)
4. One-zero lowpass averaging filter (the core Karplus-Strong decay mechanism)
5. Decay coefficient for sustain control
6. Write back to buffer

The main thread cycles plucks across the four strings (~800ms apart with jitter) and runs the drift engine every 50ms.

Badness operates in two layers:
- **Per-string jitter**: each string's pitch wobbles independently (fast mean-reverting random walk in cents).
- **Tonic drift**: a single random walk in cents that shifts all strings together. No mean-reversion — the tonic migrates over time. When drift crosses a semitone boundary (±50 cents), the UI snaps the tonic display to the nearest note name.

## Development History

This project is vibe-coded. All code was written by [Claude Code](https://claude.ai/code) (Claude Opus), starting from an empty directory. The human provided direction, design taste, and feedback ("no sound is coming out," "too harsh," "not so garish as that red on blue"). Claude did the research, implementation, and debugging. No code was written or edited by hand.

See [RESEARCH.md](RESEARCH.md) for details on the audio synthesis research that informed the implementation.

The conversational development process shaped the architecture in ways that a spec-first approach wouldn't have. The tanpura synthesis parameters were tuned by ear through a describe-listen-adjust loop. The two-component badness model (short-term jitter + long-term drift) emerged from a request to make badness "more badly behaved." The decision to let drift wander without mean-reversion — so the drone can migrate to a completely different key — came from the human asking "can it drift all the way to a new tonic?"

**Initial build**: Scaffolded with Vite + vanilla TypeScript. Built the metronome first — lookahead scheduler, Web Audio click synthesis, dark theme mobile-friendly UI with BPM slider, badness slider, tap tempo, and beat indicator dots. Started with pure sine wave clicks, then added four switchable sound recipes (clave, woodblock, noise-wood, sine) based on research into TR-808 clave synthesis and Web Audio percussion techniques.

**Drone addition**: Restructured the repo from a single app into a multi-page suite. Added the landing page and built Bad Drone. The tanpura synthesis required research into Karplus-Strong string algorithms and jawari bridge simulation techniques (drawing from Mutable Instruments Rings and academic tanpura modeling papers). The AudioWorklet approach keeps DSP off the main thread. Initial version had bugs — the circular buffer read index was wrong after pluck (reading zeros instead of noise), and the decay was too aggressive. Fixed the buffer indexing and tuned decay/amplitude parameters.

**Enhanced badness**: Evolved badness from a single per-beat jitter into a two-component system with short-term inaccuracy and long-term drift. The drift is a pure random walk (no mean-reversion) so the tools genuinely wander away from their starting point over time. Added live UI feedback: the metronome's BPM display updates each beat to show effective tempo, and the drone's tonic display shows the nearest note name + cents offset, snapping to a new note when drift crosses a semitone boundary. Added cents fine-tuning controls for the drone.

**Visual design**: Color palette inspired by Andy Warhol — hot pink, electric yellow, turquoise on a near-black background with warm cream text.

## Build & Deploy

```bash
npm install
npm run dev        # dev server with hot reload
npm run build      # production build to dist/
npm run preview    # preview production build locally
```

Deployment is automatic via GitHub Actions on push to `main`. The workflow runs `npm ci && npm run build` and deploys `dist/` to GitHub Pages.

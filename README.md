# Bad Practice

A suite of music practice tools that are bad on purpose.

**Live:** https://ragesoss.github.io/bad-metronome/

## Tools

### Bad Metronome

A metronome with a badness slider. At zero badness, it keeps perfect time. As you increase badness, two things happen:

- **Short-term inaccuracy**: each beat lands slightly early or late relative to where it should be, like a drummer with imprecise timing.
- **Long-term drift**: the underlying tempo itself wanders away from the set BPM via a random walk. The BPM display updates live to show where the tempo has actually drifted to.

The combination means the metronome isn't just sloppy — it's unreliable. It might settle into a faster groove for a while, then gradually slow down past where it started.

Also includes four switchable click sounds (clave, woodblock, noise wood, sine) and tap tempo.

### Bad Drone

A tanpura-style drone synthesized in the browser using the Karplus-Strong plucked string algorithm, with a jawari bridge simulation that creates the characteristic buzzing shimmer of a real tanpura.

Four strings cycle in a traditional pattern (Pa-Sa-Sa-Sa, Ma-Sa-Sa-Sa, or Ni-Sa-Sa-Sa). You can select the tonic and fine-tune it in cents.

The badness slider introduces:

- **Short-term jitter**: each string wobbles slightly off-pitch from where it should be, independently.
- **Long-term drift**: the tonic itself wanders via a random walk, measured in cents. When the drift crosses a semitone boundary, the tonic display snaps to the new nearest note name. The drone doesn't stay in tune — it migrates.

## Design Ideas

These tools are built around a simple question: what if your practice tools had the same kinds of imperfections that real musicians have?

A real accompanist doesn't keep metronomic time — they rush, drag, and drift. A real tanpura doesn't hold a mathematically perfect pitch — it wanders with temperature, string stretch, and the player's touch. Practicing with perfect tools trains you to depend on perfection. Practicing with imperfect tools trains you to listen and adapt.

The badness slider is a single control that scales both short-term inaccuracy (beat-to-beat or pluck-to-pluck randomness) and long-term drift (the baseline tempo or pitch wandering away over time). At zero, the tools are perfectly accurate. At one, they're chaotic. Somewhere in the middle is a useful challenge.

The long-term drift is a pure random walk — there's no rubber-band pulling it back to where it started. If you leave the drone running long enough at high badness, it will eventually drift to an entirely different key. This is intentional: the world doesn't correct itself, and neither does this.

## Vibe-Coded

This project was vibe-coded with [Claude Code](https://claude.ai/code) (Claude Opus). No code was written by hand. The human provided direction, design intent, and feedback; Claude did the implementation, research (Web Audio scheduling patterns, Karplus-Strong synthesis, jawari bridge simulation from Mutable Instruments Rings), and debugging.

The architecture, synthesis algorithms, and parameter tuning all emerged from a conversational process — describing what we wanted, hearing what came out, and iterating. The tanpura worklet had a circular buffer bug on its first try (reading zeros instead of noise). The decay was too aggressive. The color palette started too garish. Each problem was described in plain language and fixed in the next iteration.

See [DEVELOPMENT.md](DEVELOPMENT.md) for code structure and development history, and [RESEARCH.md](RESEARCH.md) for the audio synthesis research that informed the implementation.

## Technical Notes

- All audio synthesis happens in the browser using the Web Audio API — no audio files, no server.
- The metronome uses a lookahead scheduler for sample-accurate beat timing.
- The drone runs Karplus-Strong string synthesis in an AudioWorklet (off the main thread) with jawari bridge simulation adapted from the approach used in Mutable Instruments Rings.
- Built with Vite + vanilla TypeScript. No frameworks.
- Deployed to GitHub Pages via GitHub Actions.

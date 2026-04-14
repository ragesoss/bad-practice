# Bad Practice

> STAN: You around Tuesday to host the hen? I have bad practice so I'll come after but will miss the first part

> SAGE: bad practice sounds counterproductive, but you do you

> STAN: I just purposely sit down with a metronome and try to fight against the beat

> SAGE: gonna vibe code a metronome app that uses rng to change the tempo every bar

> STAN: Wonderful and microtonal drone tones too plz

[3 hours later] 

**Live:** https://ragesoss.github.io/bad-practice/

## Tools

### Bad Metronome

A metronome with a badness slider. At zero badness, it keeps perfect time. As you increase badness, two things happen:

- **Short-term inaccuracy**: each beat lands slightly early or late relative to where it should be, like a drummer with imprecise timing.
- **Long-term drift**: the underlying tempo itself wanders away from the set BPM via a random walk. The BPM display updates live to show where the tempo has actually drifted to.

The combination means the metronome isn't just sloppy — it's unreliable. It might settle into a faster groove for a while, then gradually slow down past where it started.

Also includes four switchable click sounds (clave, woodblock, noise wood, sine) and tap tempo.

### Bad Drone

A drone synthesized in the browser, with two instrument options:

**Tanpura**: Karplus-Strong plucked string synthesis with a jawari bridge simulation that creates the characteristic buzzing shimmer of a real tanpura. Four strings cycle in a traditional pattern (Pa-Sa-Sa-Sa, Ma-Sa-Sa-Sa, or Ni-Sa-Sa-Sa). You can select the tonic, fine-tune it in cents, and adjust the jawari (buzz) amount.

**Cello**: Two detuned sawtooth oscillators through a lowpass filter, producing a warm sustained drone. Simpler but effective for a continuous pitch reference.

The badness slider introduces:

- **Short-term jitter**: each string (tanpura) or the voice (cello) wobbles slightly off-pitch, independently.
- **Long-term drift**: the tonic itself wanders via a random walk, measured in cents. When the drift crosses a semitone boundary, the tonic display snaps to the new nearest note name. The drone doesn't stay in tune — it migrates.

### Bad-in-a-Box

Temu bluegrass backing tracks, with bad bass, bad guitar and bad mandolin sounds!

Per-instrument badness introduces:

- **Timing jitter**: notes land early or late.
- **Wrong notes**: occasional semitone errors in pitch.
- **Detuning**: random cents offset on each note.
- **BPM drift**: the ensemble tempo wanders via a shared random walk driven by the average badness.

## Development

Vibe-coded with [Claude Code](https://claude.ai/code) (Claude Opus). Author has no idea how it works.

For sloppy details, see [DEVELOPMENT.md](DEVELOPMENT.md) for code structure and development history, and [RESEARCH.md](RESEARCH.md) for the audio synthesis research that informed the implementation.

## Technical Notes

- All audio synthesis happens in the browser using the Web Audio API — no audio files, no server.
- The metronome uses a lookahead scheduler for sample-accurate beat timing.
- The drone runs Karplus-Strong string synthesis in an AudioWorklet (off the main thread) with jawari bridge simulation adapted from the approach used in Mutable Instruments Rings.
- The band uses a lookahead scheduler with eighth-note ticks, open guitar chord shapes transposed via capo, and per-instrument gain nodes for volume control.
- Built with Vite + vanilla TypeScript. No frameworks.
- Deployed to GitHub Pages via GitHub Actions.

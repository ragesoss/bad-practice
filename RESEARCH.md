# Research Notes

An overview of what informed the audio synthesis and scheduling approaches in this project.

## Metronome: Web Audio Scheduling

The core challenge of a browser metronome is timing precision. JavaScript's `setTimeout` has jitter of 4–10ms or more, which is audible at musical tempos. The solution is a **lookahead scheduler**: a `setTimeout` loop fires frequently (~25ms) and schedules audio events slightly ahead (~100ms) using the Web Audio API's high-resolution clock (`AudioContext.currentTime`). The audio events themselves — oscillator start/stop — are sample-accurate.

This pattern comes from Chris Wilson's foundational article on web audio scheduling, which established the approach used by essentially every browser-based metronome and sequencer since.

- [A Tale of Two Clocks](https://web.dev/articles/audio-scheduling) — Chris Wilson, web.dev. The canonical reference for the lookahead scheduler pattern. Directly informed our `scheduler.ts` implementation.
- [cwilso/metronome](https://github.com/cwilso/metronome) — Chris Wilson's reference implementation. Uses a Web Worker for the timer to avoid background-tab throttling; we opted for plain `setTimeout` since a metronome is useless in a background tab (and thematically, timer jitter fits a "bad" metronome).

## Metronome: Click Sound Synthesis

We wanted a woodblock-like click rather than a plain sine beep. Research into percussion synthesis led to four recipes, all using Web Audio API oscillators and filters with no audio samples:

**Recipe A (Clave)**: A triangle wave at 2500 Hz with instant attack and 25ms exponential decay. This is essentially how the TR-808 drum machine produces its clave sound — a single bridged-T oscillator at a high frequency with a fast decay. The triangle waveform gives a woodier timbre than a sine wave due to its odd harmonics.

**Recipe B (Woodblock)**: Two layered triangle oscillators (587 Hz body resonance + 845 Hz attack transient) routed through a bandpass filter at 2640 Hz. Inspired by the synth-kit/oramics approach to cowbell and woodblock synthesis, adapted for the Web Audio API node graph.

**Recipe C (Noise Wood)**: A short bandpass-filtered noise burst (the initial "click" transient) layered with a resonant triangle tone. The noise provides the sharp attack that makes it sound like a physical strike.

**Recipe D (Sine)**: Plain sine wave at 880/440 Hz — included as a baseline for comparison.

- [Creating a Simple Metronome Using JavaScript and the Web Audio API](https://grantjames.github.io/creating-a-simple-metronome-using-javascript-and-the-web-audio-api/) — Grant James. Practical walkthrough of oscillator-based click synthesis with gain envelopes.
- [TR-808 circuit analysis](https://www.soundonsound.com/techniques/practical-percussion-synthesis) — Sound on Sound. Background on how classic drum machine percussion sounds are synthesized from simple oscillator circuits.

## Drone: Karplus-Strong String Synthesis

The tanpura drone is synthesized using the **Karplus-Strong algorithm** — a physically-inspired model where a short delay line filled with noise, fed back through a lowpass filter, naturally evolves into a pitched tone that sounds like a plucked string.

The algorithm:
1. Fill a circular buffer of length `sampleRate / frequency` with noise (the "pluck excitation")
2. On each sample: read from the buffer, apply a one-zero averaging filter (`y = 0.5 * (x[n] + x[n-1])`), multiply by a decay coefficient, write back
3. The averaging filter selectively attenuates high frequencies each time the signal circulates through the delay line, simulating the way real string vibrations lose energy to air resistance and internal damping

The **allpass interpolation** filter handles fractional-sample tuning accuracy. Without it, pitch is quantized to `sampleRate / N` for integer N, which produces audible detuning at low frequencies. The first-order allpass filter with coefficient `(1 - frac) / (1 + frac)` provides sub-sample delay adjustment.

- [Karplus-Strong Algorithm](https://ccrma.stanford.edu/~jos/pasp/Karplus_Strong_Algorithm.html) — Julius O. Smith, CCRMA Stanford. The authoritative academic reference on the algorithm and its extensions (extended KS adds pick position, string stiffness, and dynamic level filters).
- [JavaScript Karplus-Strong](https://amid.fish/javascript-karplus-strong) — Matthew Rahtz. A JavaScript implementation with interactive parameter controls. Helped inform our approach to buffer management and decay tuning, though it uses the older ScriptProcessorNode rather than AudioWorklet.
- [Karplus-Strong with AudioWorklet](https://github.com/ubuntor/karplus_strong_web_audio) — A modern AudioWorklet-based implementation that confirmed the viability of running KS synthesis in the worklet thread.

## Drone: Jawari Bridge Simulation

The tanpura's distinctive sound comes from its **jawari** — a curved bridge that the vibrating string periodically contacts, creating amplitude-dependent pitch modulation and a shimmering, harmonically rich sustain. This is what distinguishes a tanpura from a guitar or sitar.

Our implementation adapts the approach from **Mutable Instruments Rings**, an open-source Eurorack module whose string synthesis engine includes a curved-bridge model. The key insight from the Rings source code:

```
// When string amplitude exceeds a threshold, modulate the effective delay length
bridgeContact = max(0, |sample| - threshold)
sign = sample > 0 ? 1.0 : -1.5   // asymmetric — bridge only affects one direction
sample *= 1.0 - bridgeContact * sign * curvingAmount
```

The asymmetry (`1.0` vs `-1.5`) is critical — a real bridge only contacts the string from one side, so the nonlinearity is asymmetric, generating both even and odd harmonics. This creates the tanpura's characteristic "alive" quality where the harmonic content evolves over the sustain period.

- [Mutable Instruments Rings source code](https://github.com/pichenettes/eurorack/blob/master/rings/dsp/string.cc) — Emilie Gillet (MIT license). The `string.cc` file contains the curved-bridge delay modulation that directly informed our jawari implementation. The `curved_bridge_` variable and its interaction with the delay line length was translated into our AudioWorklet's per-sample processing loop.
- [Rings documentation](https://pichenettes.github.io/mutable-instruments-documentation/modules/rings/manual/) — Explains the physical modeling concepts behind the module's string synthesis.
- [A Real-Time Synthesis Oriented Tanpura Model](https://www.dafx.de/paper-archive/2016/dafxpapers/20-DAFx-16_paper_19-PN.pdf) — Maarten van Walstijn & Sandor Mehes, DAFx-16. Academic paper on physics-based tanpura modeling with bridge contact simulation. Provided theoretical grounding for the jawari approach, though our implementation is simplified compared to their 2D string model.

## Drone: Tuning and Tanpura Practice

The standard tanpura tuning patterns and string arrangements were informed by general knowledge of Indian classical music practice. A tanpura typically has four strings tuned to a repeating pattern relative to the tonic (Sa):

- **Pa-Sa-Sa-Sa**: The most common tuning, with the first string on the fifth (Pa). Used for most ragas.
- **Ma-Sa-Sa-Sa**: First string on the fourth (Ma). Used for ragas that emphasize Ma or avoid Pa.
- **Ni-Sa-Sa-Sa**: First string on the minor seventh (Ni). Less common, used for specific ragas.

The first string typically sounds in a lower octave than the Sa strings. Our implementation places it an octave below Sa, with the last string also an octave below for the bass drone.

## Band: Bluegrass Rhythm Section Synthesis

Bad-in-a-Box synthesizes a three-piece bluegrass rhythm section (upright bass, flatpicking guitar, mandolin) using Web Audio API oscillators and filters. No audio samples are used.

### Rhythm and tempo convention

Bluegrass is typically felt in **cut time** (2/2), where the "beat" musicians count is the half note. The BPM display reflects this convention: 120 BPM means 120 half-note beats per minute, or 240 quarter-note pulses. Each measure has 4 quarter-note beats and 8 eighth-note subdivisions. The scheduler ticks at the eighth-note level.

The standard bluegrass accompaniment pattern per measure:
- **Bass**: root–fifth–root–fifth on the four quarter-note downbeats
- **Guitar**: boom (bass note) on downbeats, chuck (chord strum) on upbeats — 4 boom-chuck pairs per measure
- **Mandolin**: percussive chop on each upbeat — 4 chops per measure

### Upright bass synthesis

A plucked upright bass has a strong fundamental with gentle upper harmonics and a short "thump" transient at the onset. We synthesize this with:
- A **sine wave** at the fundamental frequency (octave 2, ~65–130 Hz)
- A quieter **2nd harmonic** (sine at 2× fundamental) for warmth, decaying faster than the fundamental
- A **lowpass-filtered noise burst** (cutoff 600 Hz) for the pluck transient

The gain envelope is tempo-adaptive: the note rings for ~92% of the quarter-note duration, then fades quickly, leaving a small gap before the next note.

### Guitar synthesis

The guitar uses two distinct voices for the boom-chuck pattern:

**Boom** (bass note on downbeat): A sawtooth oscillator through a lowpass filter (1200 Hz, Q 0.7), preceded by a short noise transient for the pick attack. Sawtooth provides all harmonics (unlike triangle which has only odd harmonics), giving a fuller, more guitar-like timbre. Rings for ~88% of the quarter note.

**Chuck** (chord strum on upbeat): Multiple triangle oscillators at the chord voicing frequencies, each through a lowpass filter, with start times staggered by ~15ms total to simulate the sweep of a pick across strings. A bandpass-filtered noise burst (center 2500 Hz) provides the strum attack. Rings for ~75% of the eighth note.

### Guitar chord voicings and capo system

Rather than computing abstract triads at a fixed octave, the guitar uses **standard open chord shapes** — the same fingerings a real guitarist would play. Each shape is defined as fret positions on the 6 strings of a standard-tuning guitar (E2–A2–D3–G3–B3–E4):

- **G shape**: [3, 2, 0, 0, 0, 3] — produces G2, B2, D3, G3, B3, G4
- **C shape**: [×, 3, 2, 0, 1, 0] — produces C3, E3, G3, C4, E4
- **D shape**: [×, ×, 0, 2, 3, 2] — produces D3, A3, D4, F#4

...and so on for D minor, E, E minor, A, A minor, and 7th chord variants.

For keys other than G, a **capo** is applied. The capo position is calculated as the semitone distance from G to the target key. All fret positions are offset by the capo amount when computing frequencies via MIDI-to-frequency conversion (`440 × 2^((midi - 69) / 12)`). This means an A chord in the key of A uses the G shape with capo 2 — exactly as a real bluegrass guitarist would play it.

The voicing frequencies are split into **bass notes** (lowest 2 sounding strings, used for boom) and **treble notes** (remaining strings, used for chuck), with alternating bass on beats 1/3 vs 2/4.

### Mandolin chop synthesis

The mandolin chop is the defining percussive backbeat of bluegrass rhythm. It's mostly attack with minimal sustain — more "chick" than pitched chord. We synthesize it with:
- A **bandpass-filtered noise burst** (center 3000 Hz, Q 1.5) for the percussive attack, decaying in ~25ms
- Very short **triangle oscillators** at the chord tones (octave 4), decaying in ~50ms

The chop duration is fixed regardless of tempo — it's a percussive hit, not a sustained note.

### Tempo-adaptive envelopes

All sustained voices (bass, guitar boom, guitar chuck) receive the current quarter-note duration from the scheduler and scale their envelopes accordingly. This ensures notes ring naturally and fill the beat at any tempo, from slow practice tempos (~60 BPM) to fast bluegrass (~140+ BPM), with just enough gap between notes for rhythmic clarity.

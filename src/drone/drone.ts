const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// Note frequencies for Sa (tonic) in octave 3
const TONIC_FREQUENCIES: Record<string, number> = {
  C: 130.81,
  "C#": 138.59,
  D: 146.83,
  "D#": 155.56,
  E: 164.81,
  F: 174.61,
  "F#": 185.0,
  G: 196.0,
  "G#": 207.65,
  A: 220.0,
  "A#": 233.08,
  B: 246.94,
};

// Semitone offsets from Sa for the first string
const TUNING_OFFSETS: Record<string, number> = {
  pa: 7, // perfect fifth
  ma: 5, // perfect fourth
  ni: 10, // minor seventh
};

type PluckCallback = (stringIndex: number) => void;
type DriftCallback = (effectiveCents: number) => void;

let ctx: AudioContext | null = null;
let workletNode: AudioWorkletNode | null = null;
let pluckTimerID: ReturnType<typeof setTimeout> | null = null;
let driftTimerID: ReturnType<typeof setInterval> | null = null;
let currentString = 0;
let playing = false;

let tonic = "C";
let tuning = "pa";
let badness = 0.5;
let jawari = 0.5;
let centsOffset = 0; // manual fine-tune in cents
let tonicDriftCents = 0; // long-term tonic drift in cents
let onPluckCb: PluckCallback | null = null;
let onDriftCb: DriftCallback | null = null;

const baseFrequencies = [0, 0, 0, 0];
const stringJitter = [0, 0, 0, 0]; // short-term per-string cents jitter

const PLUCK_INTERVAL_MS = 800;
const PLUCK_JITTER_MS = 50;
const DRIFT_INTERVAL_MS = 50;

// Long-term tonic drift parameters — pure random walk, no pull-back
const TONIC_DRIFT_STEP = 20; // max cents per tick at full badness

// Short-term per-string jitter parameters
const STRING_JITTER_STEP = 0.8; // max cents per tick at full badness
const STRING_JITTER_REVERSION = 0.95;

function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

function computeFrequencies(): void {
  const saFreq = TONIC_FREQUENCIES[tonic] ?? 130.81;
  const offset = TUNING_OFFSETS[tuning] ?? 7;

  // String 0: first note of tuning pattern (Pa/Ma/Ni), one octave below Sa
  baseFrequencies[0] = (saFreq / 2) * Math.pow(2, offset / 12);
  // String 1: Sa
  baseFrequencies[1] = saFreq;
  // String 2: Sa
  baseFrequencies[2] = saFreq;
  // String 3: Sa low (one octave below)
  baseFrequencies[3] = saFreq / 2;
}

function sendFrequencies(): void {
  if (!workletNode) return;
  for (let i = 0; i < 4; i++) {
    const totalCents = centsOffset + tonicDriftCents + stringJitter[i];
    const freq = baseFrequencies[i] * Math.pow(2, totalCents / 1200);
    workletNode.port.postMessage({
      type: "setFrequency",
      string: i,
      value: freq,
    });
  }
}

function schedulePluck(): void {
  if (!playing || !workletNode) return;

  workletNode.port.postMessage({ type: "pluck", string: currentString });
  if (onPluckCb) onPluckCb(currentString);

  currentString = (currentString + 1) % 4;

  const jitter = (Math.random() - 0.5) * 2 * PLUCK_JITTER_MS;
  pluckTimerID = setTimeout(schedulePluck, PLUCK_INTERVAL_MS + jitter);
}

function updateDrift(): void {
  if (!playing) return;

  if (badness > 0) {
    // Long-term: tonic drifts (all strings together) — pure random walk
    tonicDriftCents += (Math.random() - 0.5) * TONIC_DRIFT_STEP * badness;

    // Short-term: per-string jitter (independent wobble)
    for (let i = 0; i < 4; i++) {
      stringJitter[i] += (Math.random() - 0.5) * STRING_JITTER_STEP * badness;
      stringJitter[i] *= STRING_JITTER_REVERSION;
    }
  }

  sendFrequencies();
  if (onDriftCb) onDriftCb(centsOffset + tonicDriftCents);
}

export async function initDrone(): Promise<void> {
  const ac = getAudioContext();
  const workletUrl = new URL("./tanpura-worklet.js", import.meta.url).href;
  await ac.audioWorklet.addModule(workletUrl);
}

export async function start(): Promise<void> {
  if (playing) return;

  const ac = getAudioContext();
  if (ac.state === "suspended") {
    await ac.resume();
  }

  workletNode = new AudioWorkletNode(ac, "tanpura-processor");
  workletNode.connect(ac.destination);

  workletNode.port.postMessage({ type: "setJawari", value: jawari });
  workletNode.port.postMessage({ type: "setDecay", value: 0.9997 });

  computeFrequencies();
  tonicDriftCents = 0;
  stringJitter.fill(0);
  sendFrequencies();

  playing = true;
  currentString = 0;
  schedulePluck();
  driftTimerID = setInterval(updateDrift, DRIFT_INTERVAL_MS);
}

export function stop(): void {
  if (!playing) return;
  playing = false;

  if (pluckTimerID !== null) {
    clearTimeout(pluckTimerID);
    pluckTimerID = null;
  }
  if (driftTimerID !== null) {
    clearInterval(driftTimerID);
    driftTimerID = null;
  }

  if (workletNode) {
    workletNode.port.postMessage({ type: "stop" });
    workletNode.disconnect();
    workletNode = null;
  }
}

export function setTonic(note: string): void {
  tonic = note;
  if (playing) {
    computeFrequencies();
    tonicDriftCents = 0;
    stringJitter.fill(0);
    sendFrequencies();
  }
}

export function setTuning(pattern: string): void {
  tuning = pattern;
  if (playing) {
    computeFrequencies();
    tonicDriftCents = 0;
    stringJitter.fill(0);
    sendFrequencies();
  }
}

export function setBadness(value: number): void {
  badness = Math.max(0, Math.min(1, value));
  if (badness === 0) {
    tonicDriftCents = 0;
    stringJitter.fill(0);
    if (playing) sendFrequencies();
  }
}

export function setCentsOffset(cents: number): void {
  centsOffset = cents;
  if (playing) sendFrequencies();
  if (onDriftCb) onDriftCb(centsOffset + tonicDriftCents);
}

export function getCentsOffset(): number {
  return centsOffset;
}

export function getEffectiveCents(): number {
  return centsOffset + tonicDriftCents;
}

/** Decompose total cents offset from the set tonic into nearest note name + remainder cents */
export function getEffectiveNote(): { note: string; cents: number } {
  const totalCents = centsOffset + tonicDriftCents;
  const tonicIndex = NOTE_NAMES.indexOf(tonic);
  const semitoneOffset = Math.round(totalCents / 100);
  const remainder = totalCents - semitoneOffset * 100;
  const noteIndex = ((tonicIndex + semitoneOffset) % 12 + 12) % 12;
  return { note: NOTE_NAMES[noteIndex], cents: remainder };
}

export function onDriftUpdate(cb: DriftCallback): void {
  onDriftCb = cb;
}

export function setJawari(value: number): void {
  jawari = Math.max(0, Math.min(1, value));
  if (workletNode) {
    workletNode.port.postMessage({ type: "setJawari", value: jawari });
  }
}

export function isPlaying(): boolean {
  return playing;
}

export function onPluck(cb: PluckCallback): void {
  onPluckCb = cb;
}

export function getTuningLabels(): string[] {
  const offset = TUNING_OFFSETS[tuning] ?? 7;
  const labels: Record<number, string> = {
    7: "Pa",
    5: "Ma",
    10: "Ni",
  };
  const firstLabel = labels[offset] ?? "?";
  return [firstLabel, "Sa", "Sa", "Sa"];
}

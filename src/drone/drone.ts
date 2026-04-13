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
let onPluckCb: PluckCallback | null = null;

const baseFrequencies = [0, 0, 0, 0];
const drifts = [0, 0, 0, 0];

const PLUCK_INTERVAL_MS = 800;
const PLUCK_JITTER_MS = 50;
const DRIFT_INTERVAL_MS = 50;
const DRIFT_STEP_SIZE = 0.05; // max semitones per step at full badness
const DRIFT_MEAN_REVERSION = 0.995;

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
    const driftedFreq =
      baseFrequencies[i] * Math.pow(2, drifts[i] / 12);
    workletNode.port.postMessage({
      type: "setFrequency",
      string: i,
      value: driftedFreq,
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
  if (!playing || badness === 0) return;

  for (let i = 0; i < 4; i++) {
    drifts[i] += (Math.random() - 0.5) * DRIFT_STEP_SIZE * badness;
    drifts[i] *= DRIFT_MEAN_REVERSION;
  }
  sendFrequencies();
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
  drifts.fill(0);
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
    drifts.fill(0);
    sendFrequencies();
  }
}

export function setTuning(pattern: string): void {
  tuning = pattern;
  if (playing) {
    computeFrequencies();
    drifts.fill(0);
    sendFrequencies();
  }
}

export function setBadness(value: number): void {
  badness = Math.max(0, Math.min(1, value));
  if (badness === 0) {
    drifts.fill(0);
    if (playing) sendFrequencies();
  }
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

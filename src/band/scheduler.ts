import {
  getAudioContext,
  ensureAudioResumed,
  initAudioRouting,
  scheduleBassNote,
  scheduleGuitarBoom,
  scheduleGuitarChuck,
  scheduleMandolinChop,
} from "./audio";
import {
  parseChord,
  getChordFreqs,
  getRootFreq,
  getFifthFreq,
  getGuitarVoicing,
  PRESETS,
  type ParsedChord,
} from "./chords";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const TICKS_PER_MEASURE = 8; // eighth notes: 4 downbeats + 4 upbeats
const BPM_DRIFT_STEP = 2;

type BeatCallback = (measure: number, beat: number) => void;
type DriftCallback = (effectiveBpm: number) => void;

let timerID: ReturnType<typeof setTimeout> | null = null;
let nextTickTime = 0;
let currentTick = 0; // 0–7 within measure
let currentMeasure = 0;
let bpm = 80;
let bpmDrift = 0;
let key = "G";

let bassBadness = 0.5;
let guitarBadness = 0.5;
let mandolinBadness = 0.5;

let chart: string[] = PRESETS[0].measures;
let parsedChart: ParsedChord[] = chart.map(parseChord);

let onBeatCb: BeatCallback | null = null;
let onDriftCb: DriftCallback | null = null;

export function setBpm(value: number): void {
  bpm = Math.max(40, Math.min(240, value));
}

export function getBpm(): number {
  return bpm;
}

export function getEffectiveBpm(): number {
  return Math.max(20, bpm + bpmDrift);
}

export function setKey(k: string): void {
  key = k;
}

export function getKey(): string {
  return key;
}

export function setChart(measures: string[]): void {
  chart = measures;
  parsedChart = measures.map(parseChord);
}

export function getChart(): string[] {
  return chart;
}

export function setBassBadness(v: number): void {
  bassBadness = Math.max(0, Math.min(1, v));
}
export function setGuitarBadness(v: number): void {
  guitarBadness = Math.max(0, Math.min(1, v));
}
export function setMandolinBadness(v: number): void {
  mandolinBadness = Math.max(0, Math.min(1, v));
}

export function setOnBeat(cb: BeatCallback): void {
  onBeatCb = cb;
}
export function setOnDrift(cb: DriftCallback): void {
  onDriftCb = cb;
}

export function isPlaying(): boolean {
  return timerID !== null;
}

function tickInterval(): number {
  // BPM = half-note beats per minute (bluegrass cut time convention)
  // quarter note = 30 / BPM, eighth note = 15 / BPM
  return 15 / getEffectiveBpm();
}

function applyJitter(badness: number): number {
  if (badness === 0) return 0;
  const interval = tickInterval();
  return (Math.random() - 0.5) * interval * 0.5 * badness;
}

function wrongNoteChance(badness: number): boolean {
  return Math.random() < badness * 0.25;
}

function detune(freq: number, badness: number): number {
  if (badness === 0) return freq;
  const cents = (Math.random() - 0.5) * 30 * badness;
  return freq * Math.pow(2, cents / 1200);
}

function wrongNote(freq: number): number {
  const shift = Math.random() < 0.5 ? -1 : 1;
  return freq * Math.pow(2, shift / 12);
}

function clampTime(time: number): number {
  return Math.max(getAudioContext().currentTime, time);
}

function scheduleTick(time: number, tick: number, measure: number): void {
  const chord = parsedChart[measure % parsedChart.length];
  const voicing = getGuitarVoicing(chord, key);
  const isDownbeat = tick % 2 === 0;
  const beat = Math.floor(tick / 2); // 0–3, the quarter-note beat
  const qn = 30 / getEffectiveBpm(); // quarter-note duration

  // Bass: on every downbeat, alternating root–fifth–root–fifth
  if (isDownbeat) {
    const t = clampTime(time + applyJitter(bassBadness));
    let freq: number;
    if (beat % 2 === 0) {
      freq = getRootFreq(chord, 2);
    } else {
      freq = getFifthFreq(chord, 2);
    }
    if (wrongNoteChance(bassBadness)) freq = wrongNote(freq);
    scheduleBassNote(t, detune(freq, bassBadness), qn);
  }

  // Guitar: boom on downbeats, chuck on upbeats
  if (isDownbeat) {
    const t = clampTime(time + applyJitter(guitarBadness));
    let freq = beat % 2 === 0 ? voicing.bass1 : voicing.bass2;
    if (wrongNoteChance(guitarBadness)) freq = wrongNote(freq);
    scheduleGuitarBoom(t, detune(freq, guitarBadness), qn);
  } else {
    const t = clampTime(time + applyJitter(guitarBadness));
    const freqs = [...voicing.chuck];
    if (wrongNoteChance(guitarBadness)) {
      const idx = Math.floor(Math.random() * freqs.length);
      freqs[idx] = wrongNote(freqs[idx]);
    }
    scheduleGuitarChuck(
      t,
      freqs.map((f) => detune(f, guitarBadness)),
      qn,
    );
  }

  // Mandolin: chop on every upbeat
  if (!isDownbeat) {
    const t = clampTime(time + applyJitter(mandolinBadness));
    const freqs = getChordFreqs(chord, 4);
    if (wrongNoteChance(mandolinBadness)) {
      const idx = Math.floor(Math.random() * freqs.length);
      freqs[idx] = wrongNote(freqs[idx]);
    }
    scheduleMandolinChop(
      t,
      freqs.map((f) => detune(f, mandolinBadness)),
    );
  }

  // Visual callback on downbeats only (4 per measure)
  if (isDownbeat && onBeatCb) {
    const ac = getAudioContext();
    const delayMs = Math.max(0, (time - ac.currentTime) * 1000);
    const cb = onBeatCb;
    const m = measure;
    const b = beat;
    setTimeout(() => cb(m, b), delayMs);
  }
}

function advanceTick(): void {
  const avgBadness = (bassBadness + guitarBadness + mandolinBadness) / 3;
  if (avgBadness > 0 && currentTick % 4 === 0) {
    bpmDrift += (Math.random() - 0.5) * BPM_DRIFT_STEP * avgBadness;
  }

  nextTickTime += tickInterval();

  currentTick++;
  if (currentTick >= TICKS_PER_MEASURE) {
    currentTick = 0;
    currentMeasure++;
    if (currentMeasure >= parsedChart.length) {
      currentMeasure = 0;
    }
  }

  if (currentTick % 2 === 0 && onDriftCb) {
    onDriftCb(getEffectiveBpm());
  }
}

function scheduler(): void {
  const ac = getAudioContext();
  while (nextTickTime < ac.currentTime + SCHEDULE_AHEAD_S) {
    scheduleTick(nextTickTime, currentTick, currentMeasure);
    advanceTick();
  }
  timerID = setTimeout(scheduler, LOOKAHEAD_MS);
}

export async function start(): Promise<void> {
  if (timerID !== null) return;
  await ensureAudioResumed();
  initAudioRouting();

  const ac = getAudioContext();
  currentTick = 0;
  currentMeasure = 0;
  bpmDrift = 0;
  nextTickTime = ac.currentTime + 0.05;

  scheduler();
}

export function stop(): void {
  if (timerID !== null) {
    clearTimeout(timerID);
    timerID = null;
  }
}

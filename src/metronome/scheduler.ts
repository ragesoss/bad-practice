import { getAudioContext, scheduleClick, ensureAudioResumed } from "./audio";

const LOOKAHEAD_MS = 25;
const SCHEDULE_AHEAD_S = 0.1;
const MIN_INTERVAL_S = 0.03;
const BEATS_PER_MEASURE = 4;

type BeatCallback = (beat: number, time: number) => void;

let timerID: ReturnType<typeof setTimeout> | null = null;
let nextBeatTime = 0;
let currentBeat = 0;
let bpm = 120;
let badness = 0.5; // 0.0 – 1.0
let onBeat: BeatCallback | null = null;

export function setBpm(value: number): void {
  bpm = Math.max(40, Math.min(240, value));
}

export function getBpm(): number {
  return bpm;
}

export function setBadness(value: number): void {
  badness = Math.max(0, Math.min(1, value));
}

export function setOnBeat(cb: BeatCallback): void {
  onBeat = cb;
}

export function isPlaying(): boolean {
  return timerID !== null;
}

function calculateJitter(idealInterval: number): number {
  if (badness === 0) return 0;
  const maxJitterRatio = 0.5;
  const jitterRange = idealInterval * maxJitterRatio * badness;
  return (Math.random() * 2 - 1) * jitterRange;
}

function advanceBeat(): void {
  const idealInterval = 60.0 / bpm;
  const jitter = calculateJitter(idealInterval);
  nextBeatTime += Math.max(MIN_INTERVAL_S, idealInterval + jitter);
  currentBeat = (currentBeat + 1) % BEATS_PER_MEASURE;
}

function scheduleBeat(time: number, beat: number): void {
  const isDownbeat = beat === 0;
  scheduleClick(time, isDownbeat);

  // Fire the visual callback synced to the audio event
  if (onBeat) {
    const ac = getAudioContext();
    const delayMs = Math.max(0, (time - ac.currentTime) * 1000);
    const cb = onBeat;
    setTimeout(() => cb(beat, time), delayMs);
  }
}

function scheduler(): void {
  const ac = getAudioContext();
  while (nextBeatTime < ac.currentTime + SCHEDULE_AHEAD_S) {
    scheduleBeat(nextBeatTime, currentBeat);
    advanceBeat();
  }
  timerID = setTimeout(scheduler, LOOKAHEAD_MS);
}

export async function start(): Promise<void> {
  if (timerID !== null) return;
  await ensureAudioResumed();
  const ac = getAudioContext();
  currentBeat = 0;
  nextBeatTime = ac.currentTime + 0.05; // small buffer before first beat
  scheduler();
}

export function stop(): void {
  if (timerID !== null) {
    clearTimeout(timerID);
    timerID = null;
  }
}

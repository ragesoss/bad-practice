import {
  setBpm,
  getBpm,
  setBadness,
  setOnBeat,
  isPlaying,
  start,
  stop,
} from "./scheduler";
import { setRecipe, type SoundRecipe } from "./audio";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

function formatBadness(value: number): string {
  return (value / 100).toFixed(2);
}

// Tap tempo state
const tapTimes: number[] = [];
const TAP_TIMEOUT_MS = 2000;
const TAP_BUFFER_SIZE = 8;

function handleTapTempo(): void {
  const now = performance.now();

  // Reset if too much time passed since last tap
  if (tapTimes.length > 0 && now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT_MS) {
    tapTimes.length = 0;
  }

  tapTimes.push(now);
  if (tapTimes.length > TAP_BUFFER_SIZE) {
    tapTimes.shift();
  }

  if (tapTimes.length < 2) return;

  // Average interval between taps
  const totalInterval = tapTimes[tapTimes.length - 1] - tapTimes[0];
  const avgInterval = totalInterval / (tapTimes.length - 1);
  const tappedBpm = Math.round(60000 / avgInterval);
  const clampedBpm = Math.max(40, Math.min(240, tappedBpm));

  setBpm(clampedBpm);
  bpmSlider.value = String(clampedBpm);
  bpmValue.textContent = String(clampedBpm);
}

// Elements
let bpmSlider: HTMLInputElement;
let bpmValue: HTMLElement;
let bpmDown: HTMLButtonElement;
let bpmUp: HTMLButtonElement;
let badnessSlider: HTMLInputElement;
let badnessDescriptor: HTMLElement;
let soundSelect: HTMLSelectElement;
let startStopBtn: HTMLButtonElement;
let tapTempoBtn: HTMLButtonElement;
let beatDots: HTMLElement[];

function flashBeat(beat: number): void {
  const dot = beatDots[beat];
  if (!dot) return;

  dot.classList.add(beat === 0 ? "active-downbeat" : "active");
  setTimeout(() => {
    dot.classList.remove("active", "active-downbeat");
  }, 100);
}

function updateStartStopUI(): void {
  if (isPlaying()) {
    startStopBtn.textContent = "Stop";
    startStopBtn.classList.add("playing");
  } else {
    startStopBtn.textContent = "Start";
    startStopBtn.classList.remove("playing");
  }
}

function updateBpm(value: number): void {
  const clamped = Math.max(40, Math.min(240, value));
  setBpm(clamped);
  bpmSlider.value = String(clamped);
  bpmValue.textContent = String(clamped);
}

export function initUI(): void {
  bpmSlider = $<HTMLInputElement>("bpm-slider");
  bpmValue = $("bpm-value");
  bpmDown = $<HTMLButtonElement>("bpm-down");
  bpmUp = $<HTMLButtonElement>("bpm-up");
  badnessSlider = $<HTMLInputElement>("badness-slider");
  badnessDescriptor = $("badness-descriptor");
  soundSelect = $<HTMLSelectElement>("sound-select");
  startStopBtn = $<HTMLButtonElement>("start-stop");
  tapTempoBtn = $<HTMLButtonElement>("tap-tempo");
  beatDots = [0, 1, 2, 3].map((i) => $(`beat-${i}`));

  // BPM slider
  bpmSlider.addEventListener("input", () => {
    updateBpm(Number(bpmSlider.value));
  });

  // BPM +/- buttons
  bpmDown.addEventListener("click", () => updateBpm(getBpm() - 1));
  bpmUp.addEventListener("click", () => updateBpm(getBpm() + 1));

  // Badness slider
  badnessSlider.addEventListener("input", () => {
    const val = Number(badnessSlider.value);
    setBadness(val / 100);
    badnessDescriptor.textContent = formatBadness(val);
  });

  // Sound picker
  soundSelect.addEventListener("change", () => {
    setRecipe(soundSelect.value as SoundRecipe);
  });

  // Start/Stop
  startStopBtn.addEventListener("click", async () => {
    if (isPlaying()) {
      stop();
    } else {
      await start();
    }
    updateStartStopUI();
  });

  // Tap tempo
  tapTempoBtn.addEventListener("click", handleTapTempo);

  // Beat visual callback
  setOnBeat((beat) => flashBeat(beat));
}

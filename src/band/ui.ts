import {
  setBpm,
  getBpm,
  setBassBadness,
  setGuitarBadness,
  setMandolinBadness,
  setChart,
  setKey,
  getChart,
  setOnBeat,
  setOnDrift,
  isPlaying,
  start,
  stop,
} from "./scheduler";
import { PRESETS, transposeChart } from "./chords";
import { setBassVolume, setGuitarVolume, setMandolinVolume } from "./audio";

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
  if (
    tapTimes.length > 0 &&
    now - tapTimes[tapTimes.length - 1] > TAP_TIMEOUT_MS
  ) {
    tapTimes.length = 0;
  }
  tapTimes.push(now);
  if (tapTimes.length > TAP_BUFFER_SIZE) tapTimes.shift();
  if (tapTimes.length < 2) return;

  const totalInterval = tapTimes[tapTimes.length - 1] - tapTimes[0];
  const avgInterval = totalInterval / (tapTimes.length - 1);
  const tappedBpm = Math.round(60000 / avgInterval);
  const clamped = Math.max(40, Math.min(240, tappedBpm));

  setBpm(clamped);
  bpmSlider.value = String(clamped);
  bpmValue.textContent = String(clamped);
}

let bpmSlider: HTMLInputElement;
let bpmValue: HTMLElement;
let bpmDown: HTMLButtonElement;
let bpmUp: HTMLButtonElement;
let presetSelect: HTMLSelectElement;
let keySelect: HTMLSelectElement;
let bassBadnessSlider: HTMLInputElement;
let bassBadnessValue: HTMLElement;
let bassVolumeSlider: HTMLInputElement;
let bassVolumeValue: HTMLElement;
let guitarBadnessSlider: HTMLInputElement;
let guitarBadnessValue: HTMLElement;
let guitarVolumeSlider: HTMLInputElement;
let guitarVolumeValue: HTMLElement;
let mandolinBadnessSlider: HTMLInputElement;
let mandolinBadnessValue: HTMLElement;
let mandolinVolumeSlider: HTMLInputElement;
let mandolinVolumeValue: HTMLElement;
let startStopBtn: HTMLButtonElement;
let tapTempoBtn: HTMLButtonElement;
let chartDisplay: HTMLElement;
let beatDots: HTMLElement[];

let chartCells: HTMLElement[] = [];
let currentKey = "G";

function getCurrentPreset() {
  return PRESETS[Number(presetSelect.value)];
}

function updateChart(): void {
  const preset = getCurrentPreset();
  const transposed = transposeChart(preset.measures, preset.key, currentKey);
  setChart(transposed);
  setKey(currentKey);
  buildChartDisplay();
}

function buildChartDisplay(): void {
  const measures = getChart();
  chartDisplay.innerHTML = "";
  chartCells = [];
  measures.forEach((chord) => {
    const cell = document.createElement("div");
    cell.className = "chart-cell";
    cell.textContent = chord;
    chartDisplay.appendChild(cell);
    chartCells.push(cell);
  });
}

function highlightMeasure(measure: number): void {
  chartCells.forEach((cell, i) => {
    cell.classList.toggle("active", i === measure);
  });
}

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
    bpmValue.textContent = String(getBpm());
    chartCells.forEach((c) => c.classList.remove("active"));
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
  presetSelect = $<HTMLSelectElement>("preset-select");
  keySelect = $<HTMLSelectElement>("key-select");
  bassBadnessSlider = $<HTMLInputElement>("bass-badness");
  bassBadnessValue = $("bass-badness-value");
  bassVolumeSlider = $<HTMLInputElement>("bass-volume");
  bassVolumeValue = $("bass-volume-value");
  guitarBadnessSlider = $<HTMLInputElement>("guitar-badness");
  guitarBadnessValue = $("guitar-badness-value");
  guitarVolumeSlider = $<HTMLInputElement>("guitar-volume");
  guitarVolumeValue = $("guitar-volume-value");
  mandolinBadnessSlider = $<HTMLInputElement>("mandolin-badness");
  mandolinBadnessValue = $("mandolin-badness-value");
  mandolinVolumeSlider = $<HTMLInputElement>("mandolin-volume");
  mandolinVolumeValue = $("mandolin-volume-value");
  startStopBtn = $<HTMLButtonElement>("start-stop");
  tapTempoBtn = $<HTMLButtonElement>("tap-tempo");
  chartDisplay = $("chart-display");
  beatDots = [0, 1, 2, 3].map((i) => $(`beat-${i}`));

  // Populate preset dropdown
  PRESETS.forEach((preset, i) => {
    const opt = document.createElement("option");
    opt.value = String(i);
    opt.textContent = preset.name;
    presetSelect.appendChild(opt);
  });

  // Set initial key from first preset
  currentKey = PRESETS[0].key;
  keySelect.value = currentKey;

  // Build initial chart
  updateChart();

  // Preset selector
  presetSelect.addEventListener("change", () => {
    const preset = getCurrentPreset();
    currentKey = preset.key;
    keySelect.value = currentKey;
    updateChart();
  });

  // Key selector
  keySelect.addEventListener("change", () => {
    currentKey = keySelect.value;
    updateChart();
  });

  // BPM controls
  bpmSlider.addEventListener("input", () => updateBpm(Number(bpmSlider.value)));
  bpmDown.addEventListener("click", () => updateBpm(getBpm() - 1));
  bpmUp.addEventListener("click", () => updateBpm(getBpm() + 1));

  // Bass
  bassBadnessSlider.addEventListener("input", () => {
    const val = Number(bassBadnessSlider.value);
    setBassBadness(val / 100);
    bassBadnessValue.textContent = formatBadness(val);
  });
  bassVolumeSlider.addEventListener("input", () => {
    const val = Number(bassVolumeSlider.value);
    setBassVolume(val / 100);
    bassVolumeValue.textContent = `${val}%`;
  });

  // Guitar
  guitarBadnessSlider.addEventListener("input", () => {
    const val = Number(guitarBadnessSlider.value);
    setGuitarBadness(val / 100);
    guitarBadnessValue.textContent = formatBadness(val);
  });
  guitarVolumeSlider.addEventListener("input", () => {
    const val = Number(guitarVolumeSlider.value);
    setGuitarVolume(val / 100);
    guitarVolumeValue.textContent = `${val}%`;
  });

  // Mandolin
  mandolinBadnessSlider.addEventListener("input", () => {
    const val = Number(mandolinBadnessSlider.value);
    setMandolinBadness(val / 100);
    mandolinBadnessValue.textContent = formatBadness(val);
  });
  mandolinVolumeSlider.addEventListener("input", () => {
    const val = Number(mandolinVolumeSlider.value);
    setMandolinVolume(val / 100);
    mandolinVolumeValue.textContent = `${val}%`;
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

  // Beat callback
  setOnBeat((measure, beat) => {
    highlightMeasure(measure);
    flashBeat(beat);
  });

  // Drift callback
  setOnDrift((effectiveBpm) => {
    if (isPlaying()) {
      bpmValue.textContent = String(Math.round(effectiveBpm));
    }
  });
}

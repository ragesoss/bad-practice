import {
  initDrone,
  start,
  stop,
  setTonic,
  setTuning,
  setBadness,
  setJawari,
  isPlaying,
  onPluck,
  getTuningLabels,
} from "./drone";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

function formatBadness(value: number): string {
  return (value / 100).toFixed(2);
}

let tonicSelect: HTMLSelectElement;
let tuningSelect: HTMLSelectElement;
let badnessSlider: HTMLInputElement;
let badnessDescriptor: HTMLElement;
let jawariSlider: HTMLInputElement;
let jawariValue: HTMLElement;
let startStopBtn: HTMLButtonElement;
let stringVizEls: HTMLElement[];

function flashString(index: number): void {
  const el = stringVizEls[index];
  if (!el) return;
  el.classList.add("plucked");
  setTimeout(() => el.classList.remove("plucked"), 400);
}

function updateStringLabels(): void {
  const labels = getTuningLabels();
  for (let i = 0; i < 4; i++) {
    const labelEl = stringVizEls[i]?.querySelector(".string-label");
    if (labelEl) labelEl.textContent = labels[i];
  }
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

export async function initUI(): Promise<void> {
  tonicSelect = $<HTMLSelectElement>("tonic-select");
  tuningSelect = $<HTMLSelectElement>("tuning-select");
  badnessSlider = $<HTMLInputElement>("badness-slider");
  badnessDescriptor = $("badness-descriptor");
  jawariSlider = $<HTMLInputElement>("jawari-slider");
  jawariValue = $("jawari-value");
  startStopBtn = $<HTMLButtonElement>("start-stop");
  stringVizEls = [0, 1, 2, 3].map((i) => $(`string-${i}`));

  // Pre-load the worklet
  await initDrone();

  // Tonic
  tonicSelect.addEventListener("change", () => {
    setTonic(tonicSelect.value);
  });

  // Tuning
  tuningSelect.addEventListener("change", () => {
    setTuning(tuningSelect.value);
    updateStringLabels();
  });

  // Badness
  badnessSlider.addEventListener("input", () => {
    const val = Number(badnessSlider.value);
    setBadness(val / 100);
    badnessDescriptor.textContent = formatBadness(val);
  });

  // Jawari
  jawariSlider.addEventListener("input", () => {
    const val = Number(jawariSlider.value);
    setJawari(val / 100);
    jawariValue.textContent = `${val}%`;
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

  // Visual feedback
  onPluck((index) => flashString(index));
}

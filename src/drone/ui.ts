import {
  initDrone,
  start,
  stop,
  setTonic,
  setTuning,
  setBadness,
  setJawari,
  setCentsOffset,
  getCentsOffset,
  getEffectiveNote,
  isPlaying,
  onPluck,
  onDriftUpdate,
  getTuningLabels,
} from "./drone";

const $ = <T extends HTMLElement>(id: string): T =>
  document.getElementById(id) as T;

function formatBadness(value: number): string {
  return (value / 100).toFixed(2);
}

let tonicSelect: HTMLSelectElement;
let centsDisplay: HTMLElement;
let centsDownBtn: HTMLButtonElement;
let centsUpBtn: HTMLButtonElement;
let tuningSelect: HTMLSelectElement;
let badnessSlider: HTMLInputElement;
let badnessDescriptor: HTMLElement;
let jawariSlider: HTMLInputElement;
let jawariValue: HTMLElement;
let startStopBtn: HTMLButtonElement;
let stringVizEls: HTMLElement[];

function formatCents(cents: number): string {
  const rounded = Math.round(cents);
  return `${rounded >= 0 ? "+" : ""}${rounded}¢`;
}

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
  centsDisplay = $("cents-display");
  centsDownBtn = $<HTMLButtonElement>("cents-down");
  centsUpBtn = $<HTMLButtonElement>("cents-up");
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

  // Cents fine-tune
  centsDownBtn.addEventListener("click", () => {
    setCentsOffset(getCentsOffset() - 1);
    centsDisplay.textContent = formatCents(getCentsOffset());
  });
  centsUpBtn.addEventListener("click", () => {
    setCentsOffset(getCentsOffset() + 1);
    centsDisplay.textContent = formatCents(getCentsOffset());
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

  // Drift callback — update note display with effective pitch
  onDriftUpdate(() => {
    const { note, cents } = getEffectiveNote();
    centsDisplay.textContent = formatCents(cents);
    // Update tonic selector if drift has crossed into a new note
    if (tonicSelect.value !== note) {
      tonicSelect.value = note;
    }
  });
}

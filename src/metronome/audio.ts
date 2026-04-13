let ctx: AudioContext | null = null;
let noiseBuffer: AudioBuffer | null = null;

export type SoundRecipe = "clave" | "woodblock" | "noise-wood" | "sine";

export const SOUND_LABELS: Record<SoundRecipe, string> = {
  clave: "Clave",
  woodblock: "Woodblock",
  "noise-wood": "Noise Wood",
  sine: "Sine",
};

let currentRecipe: SoundRecipe = "clave";

export function setRecipe(recipe: SoundRecipe): void {
  currentRecipe = recipe;
}

export function getRecipe(): SoundRecipe {
  return currentRecipe;
}

export function getAudioContext(): AudioContext {
  if (!ctx) {
    ctx = new AudioContext();
  }
  return ctx;
}

export function ensureAudioResumed(): Promise<void> {
  const ac = getAudioContext();
  if (ac.state === "suspended") {
    return ac.resume();
  }
  return Promise.resolve();
}

function getNoiseBuffer(): AudioBuffer {
  if (!noiseBuffer) {
    const ac = getAudioContext();
    noiseBuffer = ac.createBuffer(1, 4096, ac.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  }
  return noiseBuffer;
}

/** Recipe A: TR-808 clave — triangle wave, fast decay */
function scheduleClave(ac: AudioContext, time: number, isDownbeat: boolean): void {
  const freq = isDownbeat ? 3000 : 2500;
  const volume = isDownbeat ? 0.6 : 0.4;
  const duration = 0.03;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "triangle";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.001);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(time);
  osc.stop(time + duration);
}

/** Recipe B: Layered woodblock — two triangle oscillators through a bandpass */
function scheduleWoodblock(ac: AudioContext, time: number, isDownbeat: boolean): void {
  const volume = isDownbeat ? 0.5 : 0.3;
  const duration = 0.06;

  const filter = ac.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = isDownbeat ? 3000 : 2640;
  filter.Q.value = 3.5;
  filter.connect(ac.destination);

  // Body resonance
  const osc1 = ac.createOscillator();
  const gain1 = ac.createGain();
  osc1.type = "triangle";
  osc1.frequency.value = isDownbeat ? 650 : 587;
  gain1.gain.setValueAtTime(0.001, time);
  gain1.gain.linearRampToValueAtTime(volume, time + 0.001);
  gain1.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
  osc1.connect(gain1);
  gain1.connect(filter);
  osc1.start(time);
  osc1.stop(time + duration);

  // Attack transient
  const osc2 = ac.createOscillator();
  const gain2 = ac.createGain();
  osc2.type = "triangle";
  osc2.frequency.value = isDownbeat ? 950 : 845;
  gain2.gain.setValueAtTime(0.001, time);
  gain2.gain.linearRampToValueAtTime(volume * 0.8, time + 0.001);
  gain2.gain.exponentialRampToValueAtTime(0.001, time + 0.02);
  osc2.connect(gain2);
  gain2.connect(filter);
  osc2.start(time);
  osc2.stop(time + duration);
}

/** Recipe C: Noise-transient woodblock — noise burst + resonant tone */
function scheduleNoiseWood(ac: AudioContext, time: number, isDownbeat: boolean): void {
  const volume = isDownbeat ? 0.6 : 0.4;
  const duration = 0.04;

  // Noise burst for the transient "click"
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer();
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = isDownbeat ? 3000 : 2500;
  noiseFilter.Q.value = 2;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.001, time);
  noiseGain.gain.linearRampToValueAtTime(volume * 0.4, time + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.008);
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(ac.destination);
  noiseSrc.start(time);
  noiseSrc.stop(time + duration);

  // Resonant tone body
  const osc = ac.createOscillator();
  const oscGain = ac.createGain();
  osc.type = "triangle";
  osc.frequency.value = isDownbeat ? 3000 : 2500;
  oscGain.gain.setValueAtTime(0.001, time);
  oscGain.gain.linearRampToValueAtTime(volume * 0.7, time + 0.001);
  oscGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
  osc.connect(oscGain);
  oscGain.connect(ac.destination);
  osc.start(time);
  osc.stop(time + duration);
}

/** Plain sine — the classic boring metronome beep */
function scheduleSine(ac: AudioContext, time: number, isDownbeat: boolean): void {
  const freq = isDownbeat ? 880 : 440;
  const volume = isDownbeat ? 0.5 : 0.3;
  const duration = 0.03;

  const osc = ac.createOscillator();
  const gain = ac.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(volume, time + 0.002);
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration);

  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(time);
  osc.stop(time + duration);
}

export function scheduleClick(time: number, isDownbeat: boolean): void {
  const ac = getAudioContext();
  switch (currentRecipe) {
    case "clave":
      scheduleClave(ac, time, isDownbeat);
      break;
    case "woodblock":
      scheduleWoodblock(ac, time, isDownbeat);
      break;
    case "noise-wood":
      scheduleNoiseWood(ac, time, isDownbeat);
      break;
    case "sine":
      scheduleSine(ac, time, isDownbeat);
      break;
  }
}

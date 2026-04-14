let ctx: AudioContext | null = null;
let bassNode: GainNode | null = null;
let guitarNode: GainNode | null = null;
let mandolinNode: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;

let bassVolume = 0.8;
let guitarVolume = 0.6;
let mandolinVolume = 0.5;

export function getAudioContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

export function ensureAudioResumed(): Promise<void> {
  const ac = getAudioContext();
  if (ac.state === "suspended") return ac.resume();
  return Promise.resolve();
}

export function initAudioRouting(): void {
  const ac = getAudioContext();
  if (bassNode) return;

  bassNode = ac.createGain();
  bassNode.gain.value = bassVolume;
  bassNode.connect(ac.destination);

  guitarNode = ac.createGain();
  guitarNode.gain.value = guitarVolume;
  guitarNode.connect(ac.destination);

  mandolinNode = ac.createGain();
  mandolinNode.gain.value = mandolinVolume;
  mandolinNode.connect(ac.destination);
}

export function setBassVolume(v: number): void {
  bassVolume = v;
  if (bassNode) bassNode.gain.value = v;
}
export function setGuitarVolume(v: number): void {
  guitarVolume = v;
  if (guitarNode) guitarNode.gain.value = v;
}
export function setMandolinVolume(v: number): void {
  mandolinVolume = v;
  if (mandolinNode) mandolinNode.gain.value = v;
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

/**
 * Upright bass: pluck transient + sine fundamental + 2nd harmonic.
 * Rings for ~92% of the quarter-note duration.
 */
export function scheduleBassNote(
  time: number,
  freq: number,
  qn: number,
): void {
  const ac = getAudioContext();
  if (!bassNode) return;
  const dest = bassNode;

  const ring = qn * 0.92;
  const end = ring + 0.02;

  // Pluck transient
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer();
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "lowpass";
  noiseFilter.frequency.value = 600;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.001, time);
  noiseGain.gain.linearRampToValueAtTime(0.2, time + 0.002);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.03);
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSrc.start(time);
  noiseSrc.stop(time + 0.05);

  // Fundamental — rings almost to next beat
  const osc = ac.createOscillator();
  osc.type = "sine";
  osc.frequency.value = freq;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.5, time + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.06, time + ring);
  gain.gain.exponentialRampToValueAtTime(0.001, time + end);

  osc.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + end + 0.01);

  // 2nd harmonic for warmth — decays faster than fundamental
  const osc2 = ac.createOscillator();
  osc2.type = "sine";
  osc2.frequency.value = freq * 2;

  const gain2 = ac.createGain();
  gain2.gain.setValueAtTime(0.001, time);
  gain2.gain.linearRampToValueAtTime(0.12, time + 0.003);
  gain2.gain.exponentialRampToValueAtTime(0.001, time + ring * 0.5);

  osc2.connect(gain2);
  gain2.connect(dest);
  osc2.start(time);
  osc2.stop(time + ring * 0.5 + 0.01);
}

/**
 * Guitar boom: pick transient + sawtooth through lowpass.
 * Rings for ~88% of the quarter-note duration.
 */
export function scheduleGuitarBoom(
  time: number,
  freq: number,
  qn: number,
): void {
  const ac = getAudioContext();
  if (!guitarNode) return;
  const dest = guitarNode;

  const ring = qn * 0.88;
  const end = ring + 0.02;

  // Pick transient
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer();
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.001, time);
  noiseGain.gain.linearRampToValueAtTime(0.12, time + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.012);
  noiseSrc.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSrc.start(time);
  noiseSrc.stop(time + 0.03);

  // Pitched body: sawtooth through lowpass — rings out
  const osc = ac.createOscillator();
  osc.type = "sawtooth";
  osc.frequency.value = freq;

  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = 1200;
  filter.Q.value = 0.7;

  const gain = ac.createGain();
  gain.gain.setValueAtTime(0.001, time);
  gain.gain.linearRampToValueAtTime(0.25, time + 0.003);
  gain.gain.exponentialRampToValueAtTime(0.04, time + ring);
  gain.gain.exponentialRampToValueAtTime(0.001, time + end);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(dest);
  osc.start(time);
  osc.stop(time + end + 0.01);
}

/**
 * Guitar chuck: strum noise + staggered chord tones through lowpass.
 * Rings for ~75% of the eighth-note duration (qn/2).
 */
export function scheduleGuitarChuck(
  time: number,
  freqs: number[],
  qn: number,
): void {
  const ac = getAudioContext();
  if (!guitarNode) return;
  const dest = guitarNode;

  const en = qn / 2; // eighth note
  const ring = en * 0.75;
  const end = ring + 0.015;

  // Strum noise (pick sound)
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer();
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 2500;
  noiseFilter.Q.value = 1;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.001, time);
  noiseGain.gain.linearRampToValueAtTime(0.1, time + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSrc.start(time);
  noiseSrc.stop(time + 0.06);

  // Chord tones with strum stagger — ring out
  const strumSpread = 0.015;
  const strumStep = freqs.length > 1 ? strumSpread / (freqs.length - 1) : 0;

  freqs.forEach((freq, i) => {
    const t = time + i * strumStep;

    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const oscFilter = ac.createBiquadFilter();
    oscFilter.type = "lowpass";
    oscFilter.frequency.value = 3000;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(0.12, t + 0.003);
    gain.gain.exponentialRampToValueAtTime(0.02, t + ring);
    gain.gain.exponentialRampToValueAtTime(0.001, t + end);

    osc.connect(oscFilter);
    oscFilter.connect(gain);
    gain.connect(dest);
    osc.start(t);
    osc.stop(t + end + 0.01);
  });
}

/** Mandolin chop: percussive noise burst + short chord tones (stays short) */
export function scheduleMandolinChop(time: number, freqs: number[]): void {
  const ac = getAudioContext();
  if (!mandolinNode) return;
  const dest = mandolinNode;

  // Noise burst for percussive attack
  const noiseSrc = ac.createBufferSource();
  noiseSrc.buffer = getNoiseBuffer();
  const noiseFilter = ac.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 3000;
  noiseFilter.Q.value = 1.5;
  const noiseGain = ac.createGain();
  noiseGain.gain.setValueAtTime(0.001, time);
  noiseGain.gain.linearRampToValueAtTime(0.1, time + 0.001);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
  noiseSrc.connect(noiseFilter);
  noiseFilter.connect(noiseGain);
  noiseGain.connect(dest);
  noiseSrc.start(time);
  noiseSrc.stop(time + 0.04);

  // Chord tones — very short, percussive
  freqs.forEach((freq) => {
    const osc = ac.createOscillator();
    osc.type = "triangle";
    osc.frequency.value = freq;

    const gain = ac.createGain();
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.1, time + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.07);
  });
}

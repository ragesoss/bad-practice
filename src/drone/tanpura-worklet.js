const MAX_BUFFER_SIZE = 2048;
const NUM_STRINGS = 4;

class TanpuraProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.jawariAmount = 0.5;
    this.decayCoeff = 0.9997;
    this.strings = [];

    for (let i = 0; i < NUM_STRINGS; i++) {
      this.strings.push({
        buffer: new Float32Array(MAX_BUFFER_SIZE),
        bufferLength: 0,
        writeIndex: 0,
        prevSample: 0,
        isActive: false,
        allpassCoeff: 0,
        allpassPrev: 0,
        frequency: 0,
      });
    }

    this.port.onmessage = (e) => {
      const msg = e.data;
      switch (msg.type) {
        case "pluck":
          this.pluckString(msg.string);
          break;
        case "setFrequency":
          this.setStringFrequency(msg.string, msg.value);
          break;
        case "setJawari":
          this.jawariAmount = msg.value;
          break;
        case "setDecay":
          this.decayCoeff = msg.value;
          break;
        case "stop":
          for (const s of this.strings) {
            s.isActive = false;
          }
          break;
      }
    };
  }

  setStringFrequency(index, freq) {
    if (index < 0 || index >= NUM_STRINGS || freq <= 0) return;
    const s = this.strings[index];
    s.frequency = freq;
    const idealDelay = sampleRate / freq;
    const intDelay = Math.floor(idealDelay);
    const frac = idealDelay - intDelay;
    // Only resize the buffer on pluck — changing bufferLength mid-ring
    // causes the read index to jump, producing glitches. Update the
    // allpass coefficient for smooth fractional tuning adjustment.
    if (!s.isActive) {
      s.bufferLength = Math.min(intDelay, MAX_BUFFER_SIZE - 1);
    }
    s.allpassCoeff = (1 - frac) / (1 + frac);
  }

  pluckString(index) {
    if (index < 0 || index >= NUM_STRINGS) return;
    const s = this.strings[index];
    if (s.frequency <= 0) return;

    // Update buffer length from current frequency on each pluck
    const idealDelay = sampleRate / s.frequency;
    s.bufferLength = Math.min(Math.floor(idealDelay), MAX_BUFFER_SIZE - 1);

    // Fill buffer with noise, scaled down and filtered for softer attack
    for (let i = 0; i < s.bufferLength; i++) {
      s.buffer[i] = (Math.random() * 2 - 1) * 0.4;
    }
    // Several passes of lowpass to soften the excitation (more = mellower pluck)
    for (let pass = 0; pass < 4; pass++) {
      for (let i = 1; i < s.bufferLength; i++) {
        s.buffer[i] = 0.5 * (s.buffer[i] + s.buffer[i - 1]);
      }
    }

    s.writeIndex = s.bufferLength;
    s.prevSample = 0;
    s.allpassPrev = 0;
    s.isActive = true;
  }

  process(_inputs, outputs, _parameters) {
    const output = outputs[0]?.[0];
    if (!output) return true;

    const jawariThreshold = 0.5 * (1.0 - this.jawariAmount);
    const jawariCurving = 0.03 * this.jawariAmount;

    for (let i = 0; i < output.length; i++) {
      let mix = 0;

      for (const s of this.strings) {
        if (!s.isActive || s.bufferLength === 0) continue;

        // Read from delay line
        const readIndex =
          (s.writeIndex - s.bufferLength + MAX_BUFFER_SIZE) % MAX_BUFFER_SIZE;
        let sample = s.buffer[readIndex];

        // Allpass interpolation for fractional delay
        const prevReadIndex =
          (readIndex - 1 + MAX_BUFFER_SIZE) % MAX_BUFFER_SIZE;
        const allpassOut =
          s.allpassCoeff * (sample - s.allpassPrev) +
          s.buffer[prevReadIndex];
        s.allpassPrev = allpassOut;
        sample = allpassOut;

        // Jawari bridge modulation
        const amplitude = Math.abs(sample);
        if (amplitude > jawariThreshold && jawariCurving > 0) {
          const bridgeContact = amplitude - jawariThreshold;
          const sign = sample > 0 ? 1.0 : -1.5;
          sample *= 1.0 - bridgeContact * sign * jawariCurving;
        }

        // One-zero lowpass (Karplus-Strong averaging)
        const filtered = 0.5 * (sample + s.prevSample);
        s.prevSample = sample;

        // Decay
        const decayed = filtered * this.decayCoeff;

        // Soft-limit feedback to prevent jawari asymmetry from causing
        // runaway growth — tanh is transparent at normal amplitudes but
        // provides a ceiling that blocks exponential energy buildup.
        const clamped = Math.tanh(decayed);

        // Write back to buffer (NaN guard prevents permanent string death)
        s.buffer[s.writeIndex] = clamped === clamped ? clamped : 0;
        s.writeIndex = (s.writeIndex + 1) % MAX_BUFFER_SIZE;

        mix += clamped;
      }

      // Mix down and soft clip
      output[i] = Math.tanh(mix * 0.3);
    }

    return true;
  }
}

registerProcessor("tanpura-processor", TanpuraProcessor);

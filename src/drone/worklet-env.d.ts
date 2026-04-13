// Ambient declarations for AudioWorklet scope globals
declare const sampleRate: number;
declare function registerProcessor(
  name: string,
  ctor: new () => AudioWorkletProcessor,
): void;

declare class AudioWorkletProcessor {
  readonly port: MessagePort;
  constructor();
  process(
    inputs: Float32Array[][],
    outputs: Float32Array[][],
    parameters: Record<string, Float32Array>,
  ): boolean;
}

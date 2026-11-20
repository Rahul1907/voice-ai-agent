/**
 * Audio conversion utilities for 24000 Hz, 16-bit signed PCM mono audio.
 */

/**
 * Converts Float32Array audio samples (-1.0 to 1.0) into Int16Array (-32768 to 32767)
 * with strict clamping for out-of-range values.
 */
export function float32ToInt16(input: Float32Array): Int16Array {
  const output = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const val = input[i] ?? 0;
    // Strict clamp between -1.0 and 1.0
    const clamped = Math.max(-1.0, Math.min(1.0, val));
    output[i] = clamped < 0 ? Math.round(clamped * 0x8000) : Math.round(clamped * 0x7fff);
  }
  return output;
}

/**
 * Converts an Int16Array into a raw Node Buffer (little-endian 16-bit PCM).
 */
export function int16ToBuffer(int16Array: Int16Array): Buffer {
  return Buffer.from(int16Array.buffer, int16Array.byteOffset, int16Array.byteLength);
}

/**
 * Generates a deterministic 440 Hz sine wave tone in 16-bit PCM at 24000 Hz.
 * Used for mock TTS mode where duration grows with input text length.
 */
export function generateMockSineWave(
  textLength: number,
  frequency: number = 440,
  sampleRate: number = 24000,
): Int16Array {
  // Duration: base 0.2s + 0.02s per character (e.g. 50 chars = 1.2s tone)
  const durationSec = Math.max(0.2, Math.min(5.0, 0.2 + textLength * 0.02));
  const totalSamples = Math.floor(sampleRate * durationSec);
  const samples = new Int16Array(totalSamples);
  const amplitude = 16000; // Comfortable listening level

  for (let i = 0; i < totalSamples; i++) {
    const t = i / sampleRate;
    samples[i] = Math.round(amplitude * Math.sin(2 * Math.PI * frequency * t));
  }

  return samples;
}

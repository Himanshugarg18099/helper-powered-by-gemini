/**
 * Decodes a base64 string into a Uint8Array.
 */
export function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Decodes raw PCM data from Gemini into an AudioBuffer.
 * Gemini TTS typically uses 24000Hz sample rate.
 */
export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      // Convert Int16 to Float32 [-1.0, 1.0]
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function playAudioBuffer(
  buffer: AudioBuffer,
  ctx: AudioContext,
  speed: number = 1.0
): Promise<void> {
  return new Promise((resolve) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = speed; // Apply speed setting
    source.connect(ctx.destination);
    source.onended = () => resolve();
    source.start();
  });
}
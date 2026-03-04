/** Convert Float32 audio samples to Int16 PCM */
export function float32ToPcm16(float32: Float32Array): Int16Array {
  const int16 = new Int16Array(float32.length)
  for (let i = 0; i < float32.length; i++) {
    const s = Math.max(-1, Math.min(1, float32[i]))
    int16[i] = s < 0 ? s * 0x8000 : s * 0x7fff
  }
  return int16
}

/** Convert Int16 PCM to Float32 audio samples */
export function pcm16ToFloat32(int16: Int16Array): Float32Array {
  const float32 = new Float32Array(int16.length)
  for (let i = 0; i < int16.length; i++) {
    float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7fff)
  }
  return float32
}

/** Downsample audio from source rate to target rate (simple linear interpolation) */
export function downsample(
  buffer: Float32Array,
  fromRate: number,
  toRate: number,
): Float32Array {
  if (fromRate === toRate) return buffer
  const ratio = fromRate / toRate
  const newLength = Math.round(buffer.length / ratio)
  const result = new Float32Array(newLength)
  for (let i = 0; i < newLength; i++) {
    const srcIndex = i * ratio
    const low = Math.floor(srcIndex)
    const high = Math.min(low + 1, buffer.length - 1)
    const frac = srcIndex - low
    result[i] = buffer[low] * (1 - frac) + buffer[high] * frac
  }
  return result
}

/** Encode ArrayBuffer to base64 string */
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/** Decode base64 string to ArrayBuffer */
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer
}

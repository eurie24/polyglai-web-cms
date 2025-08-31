/**
 * Helper function to create a valid WAV audio blob for testing
 * This creates a minimal WAV file header with silence
 */
export function createTestWavBlob(durationMs: number = 1000): Blob {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const numSamples = Math.floor((sampleRate * durationMs) / 1000);
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  const fileSize = 44 + dataSize;

  // Create WAV header
  const buffer = new ArrayBuffer(fileSize);
  const view = new DataView(buffer);

  // "RIFF" chunk descriptor
  const encoder = new TextEncoder();
  view.setUint8(0, encoder.encode('R')[0]);
  view.setUint8(1, encoder.encode('I')[0]);
  view.setUint8(2, encoder.encode('F')[0]);
  view.setUint8(3, encoder.encode('F')[0]);
  view.setUint32(4, fileSize - 8, true); // File size - 8
  view.setUint8(8, encoder.encode('W')[0]);
  view.setUint8(9, encoder.encode('A')[0]);
  view.setUint8(10, encoder.encode('V')[0]);
  view.setUint8(11, encoder.encode('E')[0]);

  // "fmt " sub-chunk
  view.setUint8(12, encoder.encode('f')[0]);
  view.setUint8(13, encoder.encode('m')[0]);
  view.setUint8(14, encoder.encode('t')[0]);
  view.setUint8(15, encoder.encode(' ')[0]);
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, 1, true); // AudioFormat (1 for PCM)
  view.setUint16(22, numChannels, true); // NumChannels
  view.setUint32(24, sampleRate, true); // SampleRate
  view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true); // ByteRate
  view.setUint16(32, numChannels * (bitsPerSample / 8), true); // BlockAlign
  view.setUint16(34, bitsPerSample, true); // BitsPerSample

  // "data" sub-chunk
  view.setUint8(36, encoder.encode('d')[0]);
  view.setUint8(37, encoder.encode('a')[0]);
  view.setUint8(38, encoder.encode('t')[0]);
  view.setUint8(39, encoder.encode('a')[0]);
  view.setUint32(40, dataSize, true); // Subchunk2Size

  // Fill with silence (zeros)
  // Audio data starts at byte 44

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Convert MediaRecorder mimeType to Azure-compatible format
 */
export function getAzureCompatibleMimeType(): string {
  // Check supported types in order of preference
  const types = [
    'audio/wav',
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg'
  ];

  for (const type of types) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }

  // Default to webm if nothing else is supported
  return 'audio/webm';
}

/**
 * Convert webm/ogg audio blob to WAV format
 * This is a simplified version - for production use, consider using a library
 */
export async function convertToWav(blob: Blob): Promise<Blob> {
  // For now, just return the original blob
  // In production, you would use a library like lamejs or recorder.js
  // to properly convert the audio format
  return blob;
}


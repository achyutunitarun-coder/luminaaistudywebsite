export interface PreparedAudioChunk {
  blob: Blob;
  filename: string;
  offsetSeconds: number;
  durationSeconds: number;
}

const TARGET_SAMPLE_RATE = 16_000;
const DEFAULT_CHUNK_SECONDS = 90;
const MIN_CHUNK_SECONDS = 75;
const MAX_CHUNK_SECONDS = 150;
const TARGET_CHUNK_BYTES = Math.floor(4.8 * 1024 * 1024);
const MAX_SINGLE_CHUNK_BYTES = 4 * 1024 * 1024;
const MAX_CHUNKS = 240;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const getAdaptiveChunkSeconds = (durationSeconds: number, requestedChunkSeconds?: number) => {
  const maxChunkByBytes = Math.floor(TARGET_CHUNK_BYTES / (TARGET_SAMPLE_RATE * 2));
  const safeMaxChunkSeconds = Math.min(MAX_CHUNK_SECONDS, maxChunkByBytes);

  if (typeof requestedChunkSeconds === 'number' && Number.isFinite(requestedChunkSeconds) && requestedChunkSeconds > 0) {
    return clamp(requestedChunkSeconds, MIN_CHUNK_SECONDS, safeMaxChunkSeconds);
  }

  if (durationSeconds > 2 * 60 * 60) return safeMaxChunkSeconds;
  if (durationSeconds > 45 * 60) return Math.min(130, safeMaxChunkSeconds);
  if (durationSeconds > 15 * 60) return Math.min(110, safeMaxChunkSeconds);

  return Math.min(DEFAULT_CHUNK_SECONDS, safeMaxChunkSeconds);
};

export const getPreferredRecordingMimeType = (): string => {
  if (typeof MediaRecorder === 'undefined') return '';

  const candidates = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) ?? '';
};

const decodeAudioBlob = async (blob: Blob): Promise<AudioBuffer> => {
  const audioContext = new AudioContext();
  try {
    const arrayBuffer = await blob.arrayBuffer();
    return await audioContext.decodeAudioData(arrayBuffer);
  } finally {
    await audioContext.close();
  }
};

const renderMonoAt16k = async (input: AudioBuffer): Promise<AudioBuffer> => {
  const frameCount = Math.ceil(input.duration * TARGET_SAMPLE_RATE);
  const offline = new OfflineAudioContext(1, Math.max(1, frameCount), TARGET_SAMPLE_RATE);

  const source = offline.createBufferSource();
  source.buffer = input;

  const gain = offline.createGain();
  gain.gain.value = 1.15;

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -28;
  compressor.knee.value = 24;
  compressor.ratio.value = 8;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;

  source.connect(gain);
  gain.connect(compressor);
  compressor.connect(offline.destination);

  source.start();
  return await offline.startRendering();
};

const encodeMonoPcm16ToWav = (samples: Float32Array, sampleRate: number): Blob => {
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) {
      view.setUint8(offset + i, value.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const clamped = Math.max(-1, Math.min(1, samples[i]));
    const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
    view.setInt16(offset, pcm, true);
    offset += 2;
  }

  return new Blob([buffer], { type: 'audio/wav' });
};

export const prepareAudioChunksForTranscription = async (
  audioBlob: Blob,
  filename: string,
  chunkSeconds?: number
): Promise<PreparedAudioChunk[]> => {
  const baseName = filename.replace(/\.[^/.]+$/, '') || 'lecture-audio';

  try {
    const decoded = await decodeAudioBlob(audioBlob);
    const normalized = await renderMonoAt16k(decoded);
    const monoSamples = normalized.getChannelData(0);

    const samplesPerChunk = Math.max(1, Math.floor(chunkSeconds * TARGET_SAMPLE_RATE));
    const chunks: PreparedAudioChunk[] = [];

    for (let start = 0; start < monoSamples.length; start += samplesPerChunk) {
      const end = Math.min(start + samplesPerChunk, monoSamples.length);
      const chunkSamples = monoSamples.slice(start, end);
      chunks.push({
        blob: encodeMonoPcm16ToWav(chunkSamples, TARGET_SAMPLE_RATE),
        filename: `${baseName}-part-${chunks.length + 1}.wav`,
        offsetSeconds: start / TARGET_SAMPLE_RATE,
        durationSeconds: (end - start) / TARGET_SAMPLE_RATE,
      });
    }

    if (chunks.length > MAX_CHUNKS) {
      throw new Error('This audio is extremely long. Please split into smaller recordings (under 5 hours each).');
    }

    return chunks.length
      ? chunks
      : [
          {
            blob: encodeMonoPcm16ToWav(monoSamples, TARGET_SAMPLE_RATE),
            filename: `${baseName}.wav`,
            offsetSeconds: 0,
            durationSeconds: normalized.duration,
          },
        ];
  } catch {
    if (audioBlob.size > MAX_SINGLE_CHUNK_BYTES) {
      throw new Error('Unsupported codec for long-file chunking. Export as MP3 or WAV and retry.');
    }

    return [
      {
        blob: audioBlob,
        filename,
        offsetSeconds: 0,
        durationSeconds: 0,
      },
    ];
  }
};

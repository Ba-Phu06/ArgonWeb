import type { AudioConfig, AudioNoteId } from '../types/studio-types';

export const AUDIO_NOTE_IDS: readonly AudioNoteId[] = ['C4', 'E4', 'G4', 'B4', 'D5'];

export const NOTE_FREQUENCIES: Record<AudioNoteId, number> = {
  C4: 261.63,
  E4: 329.63,
  G4: 392.0,
  B4: 493.88,
  D5: 587.33,
};

export interface AudioActionResult {
  ok: boolean;
  errorMessage: string | null;
}

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface AmbientPadNodes {
  oscs: OscillatorNode[];
  padGain: GainNode;
  filter: BiquadFilterNode;
}

const AMBIENT_FREQUENCIES = [130.81, 196.0, 246.94, 293.66] as const;
const AMBIENT_DETUNE_CENTS = [-4, 3, -2, 5] as const;

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : 0.5));
}

function resolveAudioContextCtor(): typeof AudioContext | null {
  if (typeof globalThis.AudioContext === 'function') return globalThis.AudioContext;
  if (typeof window === 'undefined') return null;
  return (window as WindowWithWebkitAudio).webkitAudioContext ?? null;
}

function triggerVoice(
  ctx: AudioContext,
  destination: AudioNode,
  frequency: number,
  durationSec: number,
  peakGain: number,
  waveform: OscillatorType,
): void {
  const now = ctx.currentTime;
  const osc = ctx.createOscillator();
  const filter = ctx.createBiquadFilter();
  const env = ctx.createGain();
  osc.type = waveform;
  osc.frequency.setValueAtTime(frequency, now);
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(Math.min(4800, frequency * 4.2), now);
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(Math.max(0.001, peakGain), now + 0.018);
  env.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);
  osc.connect(filter);
  filter.connect(env);
  env.connect(destination);
  osc.onended = (): void => {
    osc.disconnect();
    filter.disconnect();
    env.disconnect();
  };
  osc.start(now);
  osc.stop(now + durationSec + 0.03);
}

function createAmbientPad(ctx: AudioContext, destination: AudioNode): AmbientPadNodes {
  const now = ctx.currentTime;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(640, now);
  const padGain = ctx.createGain();
  padGain.gain.setValueAtTime(0.0001, now);
  padGain.gain.setTargetAtTime(0.14, now, 0.25);
  filter.connect(padGain);
  padGain.connect(destination);
  const oscs = AMBIENT_FREQUENCIES.map((freq, index) => {
    const osc = ctx.createOscillator();
    osc.type = index % 2 === 0 ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, now);
    osc.detune.setValueAtTime(AMBIENT_DETUNE_CENTS[index] ?? 0, now);
    osc.connect(filter);
    osc.start(now);
    return osc;
  });
  return { oscs, padGain, filter };
}

function releaseAmbientPad(ctx: AudioContext, pad: AmbientPadNodes): void {
  const now = ctx.currentTime;
  pad.padGain.gain.cancelScheduledValues(now);
  pad.padGain.gain.setTargetAtTime(0.0001, now, 0.06);
  const stopAt = now + 0.28;
  pad.oscs.forEach((osc, index) => {
    osc.onended = (): void => {
      osc.disconnect();
      if (index === pad.oscs.length - 1) {
        pad.filter.disconnect();
        pad.padGain.disconnect();
      }
    };
    osc.stop(stopAt);
  });
}

/** Procedural Web Audio API synthesizer for harmonic notes, ambient pad, and shockwave chimes. */
export class AudioSynthesizer {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private ambientPad: AmbientPadNodes | null = null;
  private config: AudioConfig = { isEnabled: false, volume: 0.55, ambientActive: false };
  private pulseIndex = 0;
  private lastError: string | null = null;
  private disposed = false;

  getLastError(): string | null { return this.lastError; }

  async ensureContext(): Promise<AudioActionResult> {
    if (this.disposed) return { ok: false, errorMessage: 'Bộ tổng hợp âm thanh đã ngừng hoạt động.' };
    try {
      if (!this.ctx) {
        const AudioCtor = resolveAudioContextCtor();
        if (!AudioCtor) {
          this.lastError = 'Trình duyệt không hỗ trợ Web Audio API.';
          return { ok: false, errorMessage: this.lastError };
        }
        this.ctx = new AudioCtor();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') {
        await this.ctx.resume();
      }
      this.lastError = null;
      return { ok: true, errorMessage: null };
    } catch {
      this.lastError = 'Không thể khởi tạo Web Audio API. Vui lòng tương tác lại với trang.';
      return { ok: false, errorMessage: this.lastError };
    }
  }

  async updateConfig(next: AudioConfig): Promise<AudioActionResult> {
    this.config = { ...next, volume: clampVolume(next.volume) };
    if (!this.config.isEnabled && !this.config.ambientActive && !this.ctx) {
      return { ok: true, errorMessage: null };
    }
    const status = await this.ensureContext();
    if (!status.ok || !this.ctx || !this.masterGain) return status;
    const targetGain = this.config.isEnabled ? this.config.volume * 0.45 : 0;
    this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.03);
    const shouldRunPad = this.config.isEnabled && this.config.ambientActive;
    if (shouldRunPad && !this.ambientPad) {
      this.ambientPad = createAmbientPad(this.ctx, this.masterGain);
    } else if (!shouldRunPad && this.ambientPad) {
      releaseAmbientPad(this.ctx, this.ambientPad);
      this.ambientPad = null;
    }
    return { ok: true, errorMessage: null };
  }

  async playNote(noteId: AudioNoteId): Promise<AudioActionResult> {
    const status = await this.ensureContext();
    if (!status.ok || !this.ctx || !this.masterGain) return status;
    if (!this.config.isEnabled) return { ok: true, errorMessage: null };
    const freq = NOTE_FREQUENCIES[noteId];
    triggerVoice(this.ctx, this.masterGain, freq, 0.85, 0.24, 'triangle');
    triggerVoice(this.ctx, this.masterGain, freq * 2, 0.55, 0.08, 'sine');
    return { ok: true, errorMessage: null };
  }

  async playPulseChime(xRatio?: number): Promise<AudioActionResult> {
    if (!this.config.isEnabled) return { ok: true, errorMessage: null };
    const status = await this.ensureContext();
    if (!status.ok || !this.ctx || !this.masterGain) return status;
    const index =
      typeof xRatio === 'number' && Number.isFinite(xRatio)
        ? Math.min(AUDIO_NOTE_IDS.length - 1, Math.max(0, Math.floor(xRatio * AUDIO_NOTE_IDS.length)))
        : this.pulseIndex++ % AUDIO_NOTE_IDS.length;
    const baseFreq = NOTE_FREQUENCIES[AUDIO_NOTE_IDS[index]];
    triggerVoice(this.ctx, this.masterGain, baseFreq * 2, 0.42, 0.12, 'sine');
    return { ok: true, errorMessage: null };
  }

  dispose(): void {
    this.disposed = true;
    if (this.ctx && this.ambientPad) {
      releaseAmbientPad(this.ctx, this.ambientPad);
      this.ambientPad = null;
    }
    if (this.ctx && this.ctx.state !== 'closed') {
      void this.ctx.close().catch((error: unknown) => {
        this.lastError = error instanceof Error ? error.message : 'Lỗi đóng AudioContext.';
      });
    }
    this.ctx = null;
    this.masterGain = null;
  }
}

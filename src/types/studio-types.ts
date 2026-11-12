/**
 * Shared domain types for NEXUS STUDIO showcase, simulation, audio, and notes.
 */

export type AsyncStatus = 'loading' | 'error' | 'success';

export interface AsyncState<T> {
  status: AsyncStatus;
  data: T | null;
  errorMessage: string | null;
}

export type CapabilityCategory = 'all' | 'ai-agents' | 'visuals' | 'canvas' | 'audio';

export type CapabilityItemCategory = Exclude<CapabilityCategory, 'all'>;

export interface ShowcaseItem {
  id: string;
  title: string;
  subtitle: string;
  category: CapabilityItemCategory;
  badge: string;
  imagePath: string;
  summary: string;
  metrics: string[];
  accentColor: string;
}

export type SimulationPaletteId = 'cosmic' | 'emerald' | 'solar';

export interface SimulationConfig {
  particleCount: number;
  flowSpeed: number;
  linkRadius: number;
  paletteId: SimulationPaletteId;
  isPaused: boolean;
}

export interface TelemetrySnapshot {
  fps: number;
  activeParticles: number;
  activeLinks: number;
  interactionCount: number;
  fpsHistory: number[];
  audioActive: boolean;
}

export type AudioNoteId = 'C4' | 'E4' | 'G4' | 'B4' | 'D5';

export interface AudioConfig {
  isEnabled: boolean;
  volume: number;
  ambientActive: boolean;
}

export interface StudioNote {
  id: string;
  title: string;
  category: Exclude<CapabilityCategory, 'all'>;
  content: string;
  createdAt: string;
}

export type StudioNoteInput = Pick<StudioNote, 'title' | 'category' | 'content'>;

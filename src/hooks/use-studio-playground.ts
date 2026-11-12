import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, RefObject } from 'react';
import { formatErrorMessage } from '../data/http-client';
import { addStudioNote, deleteStudioNote, loadStudioNotes } from '../data/studio-repository';
import { AudioSynthesizer } from '../services/audio-synthesizer';
import { CanvasSimulation, type PointerMode } from '../services/canvas-simulation';
import type {
  AsyncState, AudioConfig, AudioNoteId, SimulationConfig, StudioNote, StudioNoteInput, TelemetrySnapshot,
} from '../types/studio-types';

export const DEFAULT_SIMULATION_CONFIG: SimulationConfig = {
  particleCount: 44, flowSpeed: 1.0, linkRadius: 130, paletteId: 'cosmic', isPaused: false,
};

export const DEFAULT_AUDIO_CONFIG: AudioConfig = { isEnabled: false, volume: 0.55, ambientActive: false };

export type NoteSubmitStatus = 'idle' | 'loading' | 'error' | 'success';
export type NoteFieldErrors = Partial<Record<'title' | 'content', string>>;
interface NoteFeedbackState { status: NoteSubmitStatus; fieldErrors: NoteFieldErrors; message: string | null; }

export interface UseStudioPlaygroundResult {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  simulationConfig: SimulationConfig;
  pointerMode: PointerMode;
  telemetry: TelemetrySnapshot;
  audioConfig: AudioConfig;
  activeNote: AudioNoteId | null;
  audioError: string | null;
  notesState: AsyncState<StudioNote[]>;
  noteSubmitStatus: NoteSubmitStatus;
  noteFieldErrors: NoteFieldErrors;
  noteFeedbackMessage: string | null;
  updateSimulationConfig: (partial: Partial<SimulationConfig>) => void;
  setPointerMode: (mode: PointerMode) => void;
  resetSimulation: () => void;
  handleCanvasPointerMove: (event: ReactPointerEvent<HTMLCanvasElement>) => void;
  handleCanvasPointerLeave: () => void;
  handleCanvasClick: (event: ReactMouseEvent<HTMLCanvasElement>) => void;
  toggleAudio: () => void;
  toggleAmbient: () => void;
  setAudioVolume: (volume: number) => void;
  playNote: (noteId: AudioNoteId) => void;
  createNote: (input: StudioNoteInput) => Promise<boolean>;
  removeNote: (noteId: string) => void;
  clearNoteFeedback: () => void;
}

const IDLE_FEEDBACK: NoteFeedbackState = { status: 'idle', fieldErrors: {}, message: null };

function validateNoteInput(input: StudioNoteInput): NoteFieldErrors {
  const errors: NoteFieldErrors = {};
  const titleLen = input.title.trim().length;
  const contentLen = input.content.trim().length;
  if (titleLen < 2) errors.title = 'Tiêu đề cần ít nhất 2 ký tự.';
  else if (titleLen > 80) errors.title = 'Tiêu đề tối đa 80 ký tự.';
  if (contentLen < 4) errors.content = 'Nội dung cần ít nhất 4 ký tự.';
  else if (contentLen > 500) errors.content = 'Nội dung tối đa 500 ký tự.';
  return errors;
}

function useSimulationCanvas(config: SimulationConfig, pointerMode: PointerMode, onPulseChime: (xRatio: number) => void) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const simRef = useRef<CanvasSimulation | null>(null);
  const initialConfigRef = useRef(config);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const sim = new CanvasSimulation(canvas, initialConfigRef.current);
    simRef.current = sim;
    sim.start();
    const onResize = (): void => sim.resize();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
    observer?.observe(canvas);
    window.addEventListener('resize', onResize);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', onResize);
      sim.stop();
      simRef.current = null;
    };
  }, []);

  useEffect(() => { simRef.current?.updateConfig(config); }, [config]);

  const handleCanvasPointerMove = useCallback((event: ReactPointerEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    simRef.current?.setPointer(event.clientX - rect.left, event.clientY - rect.top, event.shiftKey ? 'repel' : pointerMode);
  }, [pointerMode]);
  const handleCanvasPointerLeave = useCallback((): void => { simRef.current?.clearPointer(); }, []);
  const handleCanvasClick = useCallback((event: ReactMouseEvent<HTMLCanvasElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    simRef.current?.triggerShockwave(x, event.clientY - rect.top);
    onPulseChime(rect.width > 0 ? x / rect.width : 0.5);
  }, [onPulseChime]);
  const resetCanvas = useCallback((): void => { simRef.current?.reset(); }, []);

  return { canvasRef, simRef, handleCanvasPointerMove, handleCanvasPointerLeave, handleCanvasClick, resetCanvas };
}

function useTelemetryTicker(simRef: RefObject<CanvasSimulation | null>, audioActive: boolean): TelemetrySnapshot {
  const [telemetry, setTelemetry] = useState<TelemetrySnapshot>({
    fps: 60, activeParticles: DEFAULT_SIMULATION_CONFIG.particleCount, activeLinks: 0, interactionCount: 0, fpsHistory: [60], audioActive: false,
  });

  useEffect(() => {
    const timer = window.setInterval(() => {
      const metrics = simRef.current?.getMetrics();
      if (!metrics) return;
      setTelemetry((prev) => ({ ...metrics, fpsHistory: [...prev.fpsHistory, metrics.fps].slice(-24), audioActive }));
    }, 250);
    return () => { window.clearInterval(timer); };
  }, [simRef, audioActive]);

  return telemetry;
}

function useAudioControls() {
  const [audioConfig, setAudioConfig] = useState<AudioConfig>(DEFAULT_AUDIO_CONFIG);
  const [activeNote, setActiveNote] = useState<AudioNoteId | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const synthRef = useRef<AudioSynthesizer | null>(null);
  const noteTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const synth = new AudioSynthesizer();
    synthRef.current = synth;
    return () => {
      synth.dispose();
      synthRef.current = null;
      if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current);
    };
  }, []);

  const applyConfig = useCallback((next: AudioConfig): void => {
    setAudioConfig(next);
    void synthRef.current?.updateConfig(next).then((res) => setAudioError(res.ok ? null : res.errorMessage));
  }, []);

  const toggleAudio = useCallback((): void => applyConfig({ ...audioConfig, isEnabled: !audioConfig.isEnabled }), [audioConfig, applyConfig]);
  const toggleAmbient = useCallback((): void => {
    const nextAmbient = !audioConfig.ambientActive;
    applyConfig({ ...audioConfig, isEnabled: nextAmbient ? true : audioConfig.isEnabled, ambientActive: nextAmbient });
  }, [audioConfig, applyConfig]);
  const setAudioVolume = useCallback((volume: number): void => applyConfig({ ...audioConfig, volume }), [audioConfig, applyConfig]);
  const playNote = useCallback((noteId: AudioNoteId): void => {
    const ensured = audioConfig.isEnabled ? audioConfig : { ...audioConfig, isEnabled: true };
    if (!audioConfig.isEnabled) setAudioConfig(ensured);
    setActiveNote(noteId);
    if (noteTimerRef.current !== null) window.clearTimeout(noteTimerRef.current);
    noteTimerRef.current = window.setTimeout(() => setActiveNote(null), 260);
    void synthRef.current?.updateConfig(ensured).then((cfg) => {
      if (!cfg.ok) setAudioError(cfg.errorMessage);
      else void synthRef.current?.playNote(noteId).then((res) => setAudioError(res.ok ? null : res.errorMessage));
    });
  }, [audioConfig]);
  const playPulseChime = useCallback((xRatio: number): void => {
    if (audioConfig.isEnabled) void synthRef.current?.playPulseChime(xRatio).then((res) => { if (!res.ok) setAudioError(res.errorMessage); });
  }, [audioConfig.isEnabled]);
  return { audioConfig, activeNote, audioError, toggleAudio, toggleAmbient, setAudioVolume, playNote, playPulseChime };
}

function useStudioNotes() {
  const [notesState, setNotesState] = useState<AsyncState<StudioNote[]>>({ status: 'loading', data: null, errorMessage: null });
  const [feedback, setFeedback] = useState<NoteFeedbackState>(IDLE_FEEDBACK);

  useEffect(() => {
    try {
      setNotesState({ status: 'success', data: loadStudioNotes(), errorMessage: null });
    } catch (error: unknown) {
      setNotesState({ status: 'error', data: null, errorMessage: formatErrorMessage(error) });
    }
  }, []);

  const createNote = useCallback(async (input: StudioNoteInput): Promise<boolean> => {
    const errors = validateNoteInput(input);
    if (errors.title || errors.content) {
      setFeedback({ status: 'error', fieldErrors: errors, message: 'Vui lòng kiểm tra lại các trường thông tin ghi chú.' });
      return false;
    }
    setFeedback({ status: 'loading', fieldErrors: {}, message: null });
    await new Promise<void>((resolve) => { window.setTimeout(resolve, 120); });
    try {
      setNotesState({ status: 'success', data: addStudioNote(input), errorMessage: null });
      setFeedback({ status: 'success', fieldErrors: {}, message: 'Đã lưu ghi chú sáng tạo vào bộ nhớ cục bộ.' });
      return true;
    } catch (error: unknown) {
      setFeedback({ status: 'error', fieldErrors: {}, message: formatErrorMessage(error) });
      return false;
    }
  }, []);

  const removeNote = useCallback((noteId: string): void => {
    try {
      setNotesState({ status: 'success', data: deleteStudioNote(noteId), errorMessage: null });
      setFeedback({ status: 'success', fieldErrors: {}, message: 'Đã xóa ghi chú.' });
    } catch (error: unknown) {
      setFeedback({ status: 'error', fieldErrors: {}, message: formatErrorMessage(error) });
    }
  }, []);

  const clearNoteFeedback = useCallback((): void => { setFeedback(IDLE_FEEDBACK); }, []);
  return { notesState, noteSubmitStatus: feedback.status, noteFieldErrors: feedback.fieldErrors, noteFeedbackMessage: feedback.message, createNote, removeNote, clearNoteFeedback };
}

/** Coordinates interactive canvas physics, live telemetry, Web Audio synthesis, and studio notes CRUD. */
export function useStudioPlayground(): UseStudioPlaygroundResult {
  const [simulationConfig, setSimulationConfig] = useState<SimulationConfig>(DEFAULT_SIMULATION_CONFIG);
  const [pointerMode, setPointerMode] = useState<PointerMode>('attract');
  const audio = useAudioControls();
  const sim = useSimulationCanvas(simulationConfig, pointerMode, audio.playPulseChime);
  const telemetry = useTelemetryTicker(sim.simRef, audio.audioConfig.isEnabled && (audio.audioConfig.ambientActive || audio.activeNote !== null));
  const notes = useStudioNotes();

  const updateSimulationConfig = useCallback((partial: Partial<SimulationConfig>): void => {
    setSimulationConfig((prev) => ({ ...prev, ...partial }));
  }, []);

  const resetSimulation = useCallback((): void => {
    setSimulationConfig(DEFAULT_SIMULATION_CONFIG);
    setPointerMode('attract');
    sim.resetCanvas();
  }, [sim]);

  return {
    canvasRef: sim.canvasRef,
    simulationConfig,
    pointerMode,
    telemetry,
    ...audio,
    ...notes,
    updateSimulationConfig,
    setPointerMode,
    resetSimulation,
    handleCanvasPointerMove: sim.handleCanvasPointerMove,
    handleCanvasPointerLeave: sim.handleCanvasPointerLeave,
    handleCanvasClick: sim.handleCanvasClick,
  };
}

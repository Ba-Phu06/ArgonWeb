import type { ReactElement } from 'react';
import type { UseStudioPlaygroundResult } from '../hooks/use-studio-playground';
import { AUDIO_NOTE_IDS } from '../services/audio-synthesizer';
import type { SimulationPaletteId } from '../types/studio-types';
import { MusicWaveIcon, PauseIcon, PlayIcon, RefreshIcon, VolumeOffIcon, VolumeOnIcon } from './studio-icons';

export interface PlaygroundCanvasProps {
  playground: UseStudioPlaygroundResult;
}

const PALETTE_OPTIONS: ReadonlyArray<{ id: SimulationPaletteId; label: string }> = [
  { id: 'cosmic', label: 'Vũ trụ' },
  { id: 'emerald', label: 'Ngọc lục' },
  { id: 'solar', label: 'Thái dương' },
];

const NOTE_LABELS = {
  C4: 'Đô 4',
  E4: 'Mi 4',
  G4: 'Sol 4',
  B4: 'Si 4',
  D5: 'Rê 5',
} as const;

interface RangeControlProps {
  id: string;
  label: string;
  valueText: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (next: number) => void;
}

function RangeControl({ id, label, valueText, min, max, step, value, onChange }: RangeControlProps): ReactElement {
  return (
    <div className="field-group">
      <div className="showcase-meta">
        <label htmlFor={id} className="field-label">{label}</label>
        <span className="mono-value" style={{ fontSize: '0.8rem', color: 'var(--accent-cyan)' }}>{valueText}</span>
      </div>
      <input id={id} type="range" className="range-slider" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function CanvasStageViewport({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { simulationConfig, pointerMode, canvasRef, handleCanvasPointerMove, handleCanvasPointerLeave, handleCanvasClick } = playground;

  return (
    <div className="canvas-viewport">
      <canvas
        ref={canvasRef}
        aria-label="Sân khấu mô phỏng chòm sao 2D tương tác theo con trỏ và sóng xung kích"
        onPointerMove={handleCanvasPointerMove}
        onPointerLeave={handleCanvasPointerLeave}
        onClick={handleCanvasClick}
      />
      <div className="canvas-overlay-bar">
        <span className="canvas-hint">
          Di chuột để {pointerMode === 'attract' ? 'hút hạt' : 'đẩy hạt'} • Giữ Shift để đảo chiều • Nhấp để phát sóng xung kích
        </span>
        <span className="pill-badge mono-value">
          {simulationConfig.isPaused ? 'Tạm dừng' : 'Đang chạy'}
        </span>
      </div>
    </div>
  );
}

function SimulationActionsRow({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { simulationConfig, pointerMode, setPointerMode, updateSimulationConfig, resetSimulation } = playground;

  return (
    <div className="showcase-meta" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
      <div className="palette-swatches" role="group" aria-label="Bảng màu mô phỏng">
        {PALETTE_OPTIONS.map((palette) => (
          <button
            key={palette.id}
            type="button"
            className={simulationConfig.paletteId === palette.id ? 'swatch-btn is-active' : 'swatch-btn'}
            aria-pressed={simulationConfig.paletteId === palette.id}
            onClick={() => updateSimulationConfig({ paletteId: palette.id })}
          >
            {palette.label}
          </button>
        ))}
      </div>

      <div className="note-card-actions" style={{ flexWrap: 'wrap' }}>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          aria-pressed={pointerMode === 'repel'}
          onClick={() => setPointerMode(pointerMode === 'attract' ? 'repel' : 'attract')}
        >
          {pointerMode === 'attract' ? 'Chế độ: Hút hạt' : 'Chế độ: Đẩy hạt'}
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          aria-pressed={simulationConfig.isPaused}
          onClick={() => updateSimulationConfig({ isPaused: !simulationConfig.isPaused })}
        >
          {simulationConfig.isPaused ? <PlayIcon size={14} /> : <PauseIcon size={14} />}
          <span>{simulationConfig.isPaused ? 'Tiếp tục' : 'Tạm dừng'}</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={resetSimulation} aria-label="Đặt lại mô phỏng">
          <RefreshIcon size={14} />
          <span>Đặt lại</span>
        </button>
      </div>
    </div>
  );
}

function SimulationControls({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { simulationConfig, updateSimulationConfig } = playground;

  return (
    <div className="control-panel">
      <div className="control-row">
        <RangeControl
          id="sim-particle-count"
          label="Số lượng hạt"
          valueText={`${simulationConfig.particleCount}`}
          min={12}
          max={120}
          step={4}
          value={simulationConfig.particleCount}
          onChange={(particleCount) => updateSimulationConfig({ particleCount })}
        />
        <RangeControl
          id="sim-flow-speed"
          label="Tốc độ dòng chảy"
          valueText={`${simulationConfig.flowSpeed.toFixed(1)}x`}
          min={0.2}
          max={3.0}
          step={0.1}
          value={simulationConfig.flowSpeed}
          onChange={(flowSpeed) => updateSimulationConfig({ flowSpeed })}
        />
      </div>

      <RangeControl
        id="sim-link-radius"
        label="Bán kính liên kết chòm sao"
        valueText={`${simulationConfig.linkRadius} px`}
        min={60}
        max={200}
        step={5}
        value={simulationConfig.linkRadius}
        onChange={(linkRadius) => updateSimulationConfig({ linkRadius })}
      />

      <SimulationActionsRow playground={playground} />
    </div>
  );
}

function AudioHeaderRow({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { audioConfig, toggleAudio, toggleAmbient } = playground;
  return (
    <div className="showcase-meta" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
      <div>
        <span className="section-eyebrow" style={{ marginBottom: '0.15rem' }}>Web Audio API</span>
        <h3 style={{ fontSize: '1.08rem' }}>Bàn phím hòa âm &amp; Âm nền vũ trụ</h3>
      </div>
      <div className="note-card-actions">
        <button type="button" className={audioConfig.ambientActive ? 'btn btn-primary btn-sm' : 'btn btn-secondary btn-sm'} aria-pressed={audioConfig.ambientActive} onClick={toggleAmbient}>
          <MusicWaveIcon size={15} />
          <span>{audioConfig.ambientActive ? 'Hòa âm nền: Bật' : 'Hòa âm nền'}</span>
        </button>
        <button type="button" className="btn btn-ghost btn-sm" aria-pressed={audioConfig.isEnabled} onClick={toggleAudio}>
          {audioConfig.isEnabled ? <VolumeOnIcon size={15} /> : <VolumeOffIcon size={15} />}
          <span>{audioConfig.isEnabled ? 'Đang bật tiếng' : 'Đang tắt tiếng'}</span>
        </button>
      </div>
    </div>
  );
}

function AudioHarmonicControls({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { audioConfig, activeNote, audioError, setAudioVolume, playNote } = playground;

  return (
    <div className="glass-panel control-panel" aria-label="Bảng tổng hợp âm thanh Web Audio">
      <AudioHeaderRow playground={playground} />
      <div className="audio-pad-grid" role="group" aria-label="Các nốt hòa âm">
        {AUDIO_NOTE_IDS.map((noteId) => (
          <button
            key={noteId}
            type="button"
            className={activeNote === noteId ? 'note-pad-btn is-active' : 'note-pad-btn'}
            aria-label={`Phát nốt ${noteId} (${NOTE_LABELS[noteId]})`}
            onClick={() => playNote(noteId)}
          >
            <div>{noteId}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{NOTE_LABELS[noteId]}</div>
          </button>
        ))}
      </div>
      <RangeControl id="audio-volume-slider" label="Âm lượng tổng hợp" valueText={`${Math.round(audioConfig.volume * 100)}%`} min={0} max={1} step={0.05} value={audioConfig.volume} onChange={setAudioVolume} />
      {audioError ? (
        <div className="alert-error" style={{ padding: '0.7rem 0.9rem', borderRadius: 'var(--radius-md)', fontSize: '0.84rem' }} role="alert">
          {audioError}
        </div>
      ) : null}
    </div>
  );
}

export function PlaygroundCanvas({ playground }: PlaygroundCanvasProps): ReactElement {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div className="glass-panel canvas-stage">
        <CanvasStageViewport playground={playground} />
        <SimulationControls playground={playground} />
      </div>
      <AudioHarmonicControls playground={playground} />
    </div>
  );
}

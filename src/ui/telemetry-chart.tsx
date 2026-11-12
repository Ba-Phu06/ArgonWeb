import { useState, type ReactElement } from 'react';
import type { TelemetrySnapshot } from '../types/studio-types';

export interface TelemetryChartProps {
  telemetry: TelemetrySnapshot;
  maxParticles?: number;
}

interface SparkPoint {
  x: number;
  y: number;
  value: number;
  index: number;
}

interface SparklineGeometry {
  linePath: string;
  areaPath: string;
  points: SparkPoint[];
}

function buildSparklineGeometry(history: readonly number[], width: number, height: number): SparklineGeometry {
  const safeValues = history.length > 0 ? history : [0];
  const padX = 6;
  const padY = 8;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;
  const maxVal = Math.max(60, ...safeValues);

  const points: SparkPoint[] = safeValues.map((value, index) => {
    const ratioX = safeValues.length > 1 ? index / (safeValues.length - 1) : 0.5;
    const clamped = Math.max(0, Math.min(maxVal, value));
    return {
      x: Number((padX + ratioX * innerW).toFixed(1)),
      y: Number((padY + (1 - clamped / maxVal) * innerH).toFixed(1)),
      value: Math.round(value),
      index,
    };
  });

  const linePath = points.map((pt, idx) => `${idx === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
  const first = points[0];
  const last = points[points.length - 1];
  const areaPath = `${linePath} L ${last.x} ${height - padY} L ${first.x} ${height - padY} Z`;
  return { linePath, areaPath, points };
}

function clampPercent(value: number, max: number): number {
  if (max <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, Math.round((value / max) * 100)));
}

function FpsSparkline({ fps, fpsHistory }: { fps: number; fpsHistory: readonly number[] }): ReactElement {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const svgWidth = 320;
  const svgHeight = 88;
  const { linePath, areaPath, points } = buildSparklineGeometry(fpsHistory, svgWidth, svgHeight);
  const inspected = hoveredIndex !== null && hoveredIndex < points.length ? points[hoveredIndex] : points[points.length - 1];

  return (
    <div className="sparkline-box">
      <div className="showcase-meta" style={{ marginBottom: '0.4rem', fontSize: '0.78rem' }}>
        <span style={{ color: 'var(--text-muted)' }}>Biểu đồ SVG FPS (di chuột lên điểm)</span>
        <span className="mono-value" style={{ color: 'var(--accent-cyan)' }}>Mẫu #{inspected.index + 1}: {inspected.value} FPS</span>
      </div>
      <svg className="sparkline-svg" viewBox={`0 0 ${svgWidth} ${svgHeight}`} role="img" aria-label={`Biểu đồ đường FPS trực tiếp, hiện tại ${fps} khung hình trên giây`} onMouseLeave={() => setHoveredIndex(null)}>
        <defs>
          <linearGradient id="nexus-fps-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.38" />
            <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <line x1="6" y1="22" x2={svgWidth - 6} y2="22" stroke="rgba(148,163,184,0.14)" strokeDasharray="3 3" />
        <line x1="6" y1="50" x2={svgWidth - 6} y2="50" stroke="rgba(148,163,184,0.14)" strokeDasharray="3 3" />
        <path d={areaPath} fill="url(#nexus-fps-area)" />
        <path d={linePath} fill="none" stroke="#22d3ee" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((pt) => (
          <circle
            key={pt.index}
            cx={pt.x}
            cy={pt.y}
            r={inspected.index === pt.index ? 4.5 : 2.5}
            fill={inspected.index === pt.index ? '#fbbf24' : '#a78bfa'}
            stroke="#050814"
            strokeWidth="1.2"
            tabIndex={0}
            aria-label={`Mẫu ${pt.index + 1}: ${pt.value} FPS`}
            onMouseEnter={() => setHoveredIndex(pt.index)}
            onFocus={() => setHoveredIndex(pt.index)}
          />
        ))}
      </svg>
    </div>
  );
}

function TelemetryMetricBars({
  telemetry,
  maxParticles,
}: {
  telemetry: TelemetrySnapshot;
  maxParticles: number;
}): ReactElement {
  const metricRows = [
    { label: 'Hiệu suất khung hình', valueText: `${telemetry.fps} / 60 FPS`, percent: clampPercent(telemetry.fps, 60) },
    { label: 'Mật độ hạt mô phỏng', valueText: `${telemetry.activeParticles} / ${maxParticles}`, percent: clampPercent(telemetry.activeParticles, maxParticles) },
    { label: 'Liên kết chòm sao', valueText: `${telemetry.activeLinks} kết nối`, percent: clampPercent(telemetry.activeLinks, Math.max(40, telemetry.activeParticles * 3)) },
  ];

  return (
    <div className="metric-bars">
      {metricRows.map((row) => (
        <div key={row.label}>
          <div className="showcase-meta" style={{ fontSize: '0.8rem', marginBottom: '0.28rem' }}>
            <span style={{ color: 'var(--text-secondary)' }}>{row.label}</span>
            <span className="mono-value" style={{ color: 'var(--text-muted)' }}>{row.valueText}</span>
          </div>
          <div className="metric-bar-track" role="progressbar" aria-valuenow={row.percent} aria-valuemin={0} aria-valuemax={100} aria-label={row.label}>
            <div className="metric-bar-fill" style={{ width: `${row.percent}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TelemetryChart({ telemetry, maxParticles = 140 }: TelemetryChartProps): ReactElement {
  return (
    <aside className="glass-panel telemetry-card" aria-label="Bảng đo lường hiệu năng trực tiếp">
      <div className="showcase-meta">
        <div>
          <span className="section-eyebrow" style={{ marginBottom: '0.15rem' }}>Telemetry trực tiếp</span>
          <h3 style={{ fontSize: '1.08rem' }}>Nhịp khung hình &amp; Mật độ mô phỏng</h3>
        </div>
        <span className="pill-badge mono-value">{telemetry.audioActive ? 'Audio: Hoạt động' : 'Audio: Chờ'}</span>
      </div>

      <div className="telemetry-kpi-grid">
        <div className="telemetry-kpi">
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Khung hình</div>
          <div className="mono-value" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>{telemetry.fps} FPS</div>
        </div>
        <div className="telemetry-kpi">
          <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>Lượt xung lực</div>
          <div className="mono-value" style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--accent-violet)' }}>{telemetry.interactionCount}</div>
        </div>
      </div>

      <FpsSparkline fps={telemetry.fps} fpsHistory={telemetry.fpsHistory} />
      <TelemetryMetricBars telemetry={telemetry} maxParticles={maxParticles} />
    </aside>
  );
}

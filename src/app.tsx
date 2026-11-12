import type { ReactElement } from 'react';
import { useShowcaseData } from './hooks/use-showcase-data';
import { useStudioPlayground, type UseStudioPlaygroundResult } from './hooks/use-studio-playground';
import { CapabilitiesSection } from './ui/capabilities-section';
import { HeaderNav } from './ui/header-nav';
import { HeroSection } from './ui/hero-section';
import { NotesComposer } from './ui/notes-composer';
import { PlaygroundCanvas } from './ui/playground-canvas';
import { TelemetryChart } from './ui/telemetry-chart';

function PlaygroundSection({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  return (
    <section id="playground" className="studio-section" aria-labelledby="playground-heading">
      <div className="container">
        <div className="section-header">
          <div>
            <span className="section-eyebrow">Phòng thí nghiệm tương tác</span>
            <h2 id="playground-heading" className="section-title">
              Chòm sao Canvas 2D &amp; Hòa âm Web Audio
            </h2>
            <p className="section-subtitle">
              Di chuyển con trỏ để tạo lực hút/đẩy hạt, nhấp để phát sóng xung kích đồng bộ âm thanh và theo dõi thông số FPS theo thời gian thực.
            </p>
          </div>
        </div>

        <div className="playground-grid">
          <PlaygroundCanvas playground={playground} />
          <div className="playground-sidebar">
            <TelemetryChart telemetry={playground.telemetry} maxParticles={120} />
          </div>
        </div>
      </div>
    </section>
  );
}

function StudioFooter(): ReactElement {
  return (
    <footer className="studio-footer">
      <div className="container showcase-meta" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
        <span>NEXUS STUDIO — Trạm Sáng Tạo Đa Năng • React 19, TypeScript, Canvas 2D &amp; Web Audio API</span>
        <div className="note-card-actions">
          <a href="#top" className="nav-link">Đầu trang</a>
          <a href="#capabilities" className="nav-link">Năng lực</a>
          <a href="#playground" className="nav-link">Phòng thí nghiệm</a>
          <a href="#notes" className="nav-link">Ghi chú</a>
        </div>
      </div>
    </footer>
  );
}

export function App(): ReactElement {
  const showcase = useShowcaseData();
  const playground = useStudioPlayground();

  return (
    <div className="studio-shell">
      <HeaderNav
        isAudioEnabled={playground.audioConfig.isEnabled}
        isAmbientActive={playground.audioConfig.ambientActive}
        onToggleAudio={playground.toggleAudio}
      />

      <main className="studio-main">
        <HeroSection />
        <CapabilitiesSection showcase={showcase} />
        <PlaygroundSection playground={playground} />
        <NotesComposer playground={playground} />
      </main>

      <StudioFooter />
    </div>
  );
}

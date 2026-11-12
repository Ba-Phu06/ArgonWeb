import type { ReactElement } from 'react';
import { PlayIcon, SparklesIcon } from './studio-icons';

const HERO_BADGES: readonly string[] = [
  'Điều phối đa tác tử AI',
  'Canvas 2D 60 FPS',
  'Tổng hợp Web Audio',
  'Biểu đồ SVG trực tiếp',
];

function HeroVisualCard(): ReactElement {
  return (
    <div className="hero-visual">
      <div className="hero-image-frame">
        <img
          src="./images/hero-studio.png"
          alt="Trung tâm sáng tạo tương lai NEXUS STUDIO với luồng ánh sáng dữ liệu và giao diện điều phối đa tác tử"
          loading="eager"
        />
        <div className="hero-floating-badges" aria-label="Công nghệ tích hợp">
          {HERO_BADGES.map((badgeLabel) => (
            <span key={badgeLabel} className="metric-pill">{badgeLabel}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function HeroSection(): ReactElement {
  return (
    <section id="top" className="hero-section studio-section" aria-labelledby="hero-heading">
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="pill-badge">
            <SparklesIcon size={14} />
            <span>Trạm trình diễn đa tác tử &amp; tương tác thời gian thực</span>
          </span>
          <h1 id="hero-heading" className="hero-title">
            NEXUS STUDIO — <span className="text-gradient">Trạm Sáng Tạo Đa Năng</span>
          </h1>
          <p className="hero-description">
            Khám phá sự kết hợp giữa kiến trúc cộng tác đa tác tử, đồ họa AI thế hệ mới, trường hạt chòm sao
            Canvas 2D và bộ tổng hợp âm thanh Web Audio nguyên bản ngay trên trình duyệt.
          </p>
          <div className="hero-actions">
            <a href="#playground" className="btn btn-primary">
              <PlayIcon size={15} />
              <span>Thử nghiệm ngay</span>
            </a>
            <a href="#capabilities" className="btn btn-secondary">
              <span>Khám phá năng lực</span>
            </a>
          </div>
        </div>
        <HeroVisualCard />
      </div>
    </section>
  );
}

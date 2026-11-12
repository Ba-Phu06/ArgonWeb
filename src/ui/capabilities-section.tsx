import type { ReactElement } from 'react';
import type { UseShowcaseDataResult } from '../hooks/use-showcase-data';
import type { CapabilityCategory, CapabilityItemCategory, ShowcaseItem } from '../types/studio-types';
import { AsyncStatusPanel } from './async-status-panel';
import { SearchIcon } from './studio-icons';

export interface CapabilitiesSectionProps {
  showcase: UseShowcaseDataResult;
}

const CATEGORY_LABELS: Record<CapabilityCategory, string> = {
  all: 'Tất cả',
  'ai-agents': 'Đa tác tử AI',
  visuals: 'Mỹ thuật AI',
  canvas: 'Canvas 2D',
  audio: 'Web Audio',
};

const ITEM_CATEGORY_LABELS: Record<CapabilityItemCategory, string> = {
  'ai-agents': 'Đa tác tử AI',
  visuals: 'Mỹ thuật AI',
  canvas: 'Canvas 2D',
  audio: 'Web Audio',
};

const CATEGORY_ORDER: readonly CapabilityCategory[] = ['all', 'ai-agents', 'visuals', 'canvas', 'audio'];

function CapabilityCard({ item }: { item: ShowcaseItem }): ReactElement {
  return (
    <article className="glass-panel showcase-card">
      <div className="showcase-media">
        <img src={item.imagePath} alt={`${item.title} — ${item.subtitle}`} loading="lazy" />
      </div>
      <div className="showcase-body">
        <div className="showcase-meta">
          <span className="pill-badge" style={{ borderColor: item.accentColor, color: item.accentColor }}>
            {item.badge}
          </span>
          <span className="mono-value" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {ITEM_CATEGORY_LABELS[item.category]}
          </span>
        </div>
        <h3 style={{ fontSize: '1.15rem' }}>{item.title}</h3>
        <p style={{ fontSize: '0.86rem', color: 'var(--accent-cyan)', fontWeight: 500 }}>{item.subtitle}</p>
        <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>{item.summary}</p>
        <div className="metrics-row">
          {item.metrics.map((metric) => (
            <span key={metric} className="metric-pill">
              {metric}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function CapabilitiesToolbar({ showcase }: { showcase: UseShowcaseDataResult }): ReactElement {
  const { selectedCategory, setSelectedCategory, searchQuery, setSearchQuery, categoryCounts } = showcase;
  const searchIconStyle = { position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none', display: 'grid' } as const;

  return (
    <div className="capabilities-toolbar">
      <div className="filter-tabs" role="group" aria-label="Lọc theo nhóm năng lực">
        {CATEGORY_ORDER.map((category) => (
          <button
            key={category}
            type="button"
            className={selectedCategory === category ? 'filter-tab is-active' : 'filter-tab'}
            aria-pressed={selectedCategory === category}
            onClick={() => setSelectedCategory(category)}
          >
            {CATEGORY_LABELS[category]} ({categoryCounts[category]})
          </button>
        ))}
      </div>

      <div className="search-box">
        <label htmlFor="capabilities-search" className="sr-only">Tìm kiếm năng lực</label>
        <span aria-hidden="true" style={searchIconStyle}><SearchIcon size={16} /></span>
        <input
          id="capabilities-search"
          type="search"
          className="input-field"
          style={{ paddingLeft: '2.4rem' }}
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Tìm năng lực, công nghệ, chỉ số..."
        />
      </div>
    </div>
  );
}

function renderCatalogContent(showcase: UseShowcaseDataResult): ReactElement {
  const { state, filteredItems, retry, resetFilters } = showcase;

  if (state.status === 'loading') {
    return (
      <AsyncStatusPanel
        variant="loading"
        title="Đang tải danh mục năng lực..."
        description="Hệ thống đang đọc dữ liệu từ showcase.json."
        showSkeletonCards
      />
    );
  }

  if (state.status === 'error') {
    return (
      <AsyncStatusPanel
        variant="error"
        title="Không thể tải danh mục năng lực"
        description={state.errorMessage ?? 'Đã xảy ra lỗi kết nối khi tải dữ liệu.'}
        actionLabel="Thử lại"
        onAction={retry}
      />
    );
  }

  if (filteredItems.length === 0) {
    return (
      <AsyncStatusPanel
        variant="empty"
        title="Không tìm thấy năng lực phù hợp"
        description="Không có mục nào khớp với bộ lọc hoặc từ khóa hiện tại."
        actionLabel="Đặt lại bộ lọc"
        onAction={resetFilters}
      />
    );
  }

  return (
    <div className="capabilities-grid">
      {filteredItems.map((item) => (
        <CapabilityCard key={item.id} item={item} />
      ))}
    </div>
  );
}

export function CapabilitiesSection({ showcase }: CapabilitiesSectionProps): ReactElement {
  return (
    <section id="capabilities" className="studio-section" aria-labelledby="capabilities-heading">
      <div className="container">
        <div className="section-header">
          <div>
            <span className="section-eyebrow">Danh mục năng lực</span>
            <h2 id="capabilities-heading" className="section-title">
              Kiến trúc mô-đun &amp; trình diễn công nghệ
            </h2>
            <p className="section-subtitle">
              Dữ liệu năng lực được nạp bất đồng bộ từ JSON tĩnh kèm lọc đa danh mục, tìm kiếm tiếng Việt và xử lý đầy đủ 3 trạng thái tải.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={showcase.toggleSimulateError}
            aria-pressed={showcase.isErrorSimulated}
          >
            {showcase.isErrorSimulated ? 'Tắt giả lập lỗi' : 'Thử trạng thái lỗi'}
          </button>
        </div>

        <CapabilitiesToolbar showcase={showcase} />
        {renderCatalogContent(showcase)}
      </div>
    </section>
  );
}

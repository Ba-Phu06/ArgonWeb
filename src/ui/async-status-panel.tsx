import type { ReactElement } from 'react';
import { AlertIcon, InboxEmptyIcon, RefreshIcon } from './studio-icons';

export interface AsyncStatusPanelProps {
  variant: 'loading' | 'error' | 'empty';
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  showSkeletonCards?: boolean;
}

function LoadingStatusView({
  title,
  description,
  showSkeletonCards,
}: Pick<AsyncStatusPanelProps, 'title' | 'description' | 'showSkeletonCards'>): ReactElement {
  return (
    <div role="status" aria-live="polite" aria-busy="true">
      <div className="glass-panel status-panel">
        <div className="loading-spinner" aria-hidden="true" />
        <h3>{title}</h3>
        <p className="section-subtitle">{description}</p>
      </div>
      {showSkeletonCards ? (
        <div className="skeleton-grid" aria-hidden="true" style={{ marginTop: '1.25rem' }}>
          <div className="skeleton-card" />
          <div className="skeleton-card" />
          <div className="skeleton-card" />
        </div>
      ) : null}
    </div>
  );
}

export function AsyncStatusPanel({
  variant,
  title,
  description,
  actionLabel,
  onAction,
  showSkeletonCards = false,
}: AsyncStatusPanelProps): ReactElement {
  if (variant === 'loading') {
    return <LoadingStatusView title={title} description={description} showSkeletonCards={showSkeletonCards} />;
  }

  const isError = variant === 'error';
  const panelClass = isError ? 'glass-panel status-panel alert-error' : 'glass-panel status-panel empty-state';

  return (
    <div className={panelClass} role={isError ? 'alert' : 'status'} aria-live={isError ? 'assertive' : 'polite'}>
      <div className="status-icon" style={{ color: isError ? 'var(--accent-rose)' : 'var(--accent-cyan)' }}>
        {isError ? <AlertIcon size={22} /> : <InboxEmptyIcon size={22} />}
      </div>
      <h3>{title}</h3>
      <p className="section-subtitle">{description}</p>
      {onAction && actionLabel ? (
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAction}>
          <RefreshIcon size={15} />
          <span>{actionLabel}</span>
        </button>
      ) : null}
    </div>
  );
}

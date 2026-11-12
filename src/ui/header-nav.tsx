import type { ReactElement } from 'react';
import { NexusLogoIcon, VolumeOffIcon, VolumeOnIcon } from './studio-icons';

export interface HeaderNavProps {
  isAudioEnabled: boolean;
  isAmbientActive: boolean;
  onToggleAudio: () => void;
}

function resolveAudioLabel(isAudioEnabled: boolean, isAmbientActive: boolean): string {
  if (!isAudioEnabled) {
    return 'Âm thanh: Tắt';
  }
  return isAmbientActive ? 'Âm thanh: Đang hòa âm' : 'Âm thanh: Bật';
}

export function HeaderNav({ isAudioEnabled, isAmbientActive, onToggleAudio }: HeaderNavProps): ReactElement {
  const audioLabel = resolveAudioLabel(isAudioEnabled, isAmbientActive);

  return (
    <header className="site-header">
      <div className="container nav-inner">
        <a href="#top" className="brand-mark" aria-label="NEXUS STUDIO — Về đầu trang">
          <span className="brand-orb"><NexusLogoIcon size={18} /></span>
          <span>NEXUS <span className="text-gradient">STUDIO</span></span>
        </a>

        <nav className="nav-links" aria-label="Điều hướng chính">
          <a className="nav-link" href="#capabilities">Năng lực</a>
          <a className="nav-link" href="#playground">Phòng thí nghiệm</a>
          <a className="nav-link" href="#notes">Ghi chú Studio</a>
        </nav>

        <div className="nav-actions">
          <button
            type="button"
            className={isAudioEnabled ? 'btn btn-secondary btn-sm' : 'btn btn-ghost btn-sm'}
            onClick={onToggleAudio}
            aria-pressed={isAudioEnabled}
            aria-label={isAudioEnabled ? 'Tắt tổng hợp âm thanh Web Audio' : 'Bật tổng hợp âm thanh Web Audio'}
          >
            {isAudioEnabled ? <VolumeOnIcon size={15} /> : <VolumeOffIcon size={15} />}
            <span>{audioLabel}</span>
          </button>
        </div>
      </div>
    </header>
  );
}

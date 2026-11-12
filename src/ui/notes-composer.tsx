import { useState, type FormEvent, type ReactElement } from 'react';
import type { UseStudioPlaygroundResult } from '../hooks/use-studio-playground';
import type { CapabilityItemCategory, StudioNote } from '../types/studio-types';
import { AsyncStatusPanel } from './async-status-panel';
import { PlusIcon, TrashIcon } from './studio-icons';

export interface NotesComposerProps {
  playground: UseStudioPlaygroundResult;
}

const NOTE_CATEGORY_LABELS: Record<CapabilityItemCategory, string> = {
  'ai-agents': 'Đa tác tử AI',
  visuals: 'Mỹ thuật AI',
  canvas: 'Canvas 2D',
  audio: 'Web Audio',
};

function formatNoteDate(isoDate: string): string {
  const parsed = new Date(isoDate);
  if (Number.isNaN(parsed.getTime())) {
    return 'Vừa xong';
  }
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(parsed);
}

function NoteFeedbackBanner({
  status,
  message,
}: {
  status: UseStudioPlaygroundResult['noteSubmitStatus'];
  message: string | null;
}): ReactElement | null {
  if (!message || (status !== 'success' && status !== 'error')) {
    return null;
  }
  if (status === 'success') {
    return <div className="alert-success" role="status">{message}</div>;
  }
  return (
    <div className="alert-error" style={{ padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.88rem' }} role="alert">
      {message}
    </div>
  );
}

function NoteFormPanel({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { noteSubmitStatus, noteFieldErrors, noteFeedbackMessage, createNote, clearNoteFeedback } = playground;
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<CapabilityItemCategory>('ai-agents');
  const [content, setContent] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const ok = await createNote({ title, category, content });
    if (ok) {
      setTitle('');
      setContent('');
    }
  };

  return (
    <form className="glass-panel control-panel" onSubmit={(e) => void handleSubmit(e)} noValidate aria-label="Biểu mẫu tạo ghi chú Studio">
      <div className="field-group">
        <label htmlFor="note-title" className="field-label">Tiêu đề ý tưởng / Studio Brief</label>
        <input id="note-title" type="text" className="input-field" value={title} maxLength={80} placeholder="Ví dụ: Tinh chỉnh mật độ chòm sao ban đêm" aria-invalid={Boolean(noteFieldErrors.title)} aria-describedby={noteFieldErrors.title ? 'note-title-error' : undefined} onChange={(e) => { setTitle(e.target.value); clearNoteFeedback(); }} />
        {noteFieldErrors.title ? <span id="note-title-error" className="field-error">{noteFieldErrors.title}</span> : null}
      </div>

      <div className="field-group">
        <label htmlFor="note-category" className="field-label">Phân nhóm mô-đun</label>
        <select id="note-category" className="select-field" value={category} onChange={(e) => setCategory(e.target.value as CapabilityItemCategory)}>
          {(Object.keys(NOTE_CATEGORY_LABELS) as CapabilityItemCategory[]).map((key) => (
            <option key={key} value={key}>{NOTE_CATEGORY_LABELS[key]}</option>
          ))}
        </select>
      </div>

      <div className="field-group">
        <label htmlFor="note-content" className="field-label">Nội dung chi tiết</label>
        <textarea id="note-content" className="textarea-field" value={content} maxLength={500} placeholder="Ghi lại thông số, kịch bản kiểm thử hoặc định hướng sáng tạo..." aria-invalid={Boolean(noteFieldErrors.content)} aria-describedby={noteFieldErrors.content ? 'note-content-error' : undefined} onChange={(e) => { setContent(e.target.value); clearNoteFeedback(); }} />
        {noteFieldErrors.content ? <span id="note-content-error" className="field-error">{noteFieldErrors.content}</span> : null}
      </div>

      <NoteFeedbackBanner status={noteSubmitStatus} message={noteFeedbackMessage} />

      <button type="submit" className="btn btn-primary" disabled={noteSubmitStatus === 'loading'}>
        <PlusIcon size={16} />
        <span>{noteSubmitStatus === 'loading' ? 'Đang lưu ghi chú...' : 'Lưu ghi chú Studio'}</span>
      </button>
    </form>
  );
}

function NoteCard({ note, onRemove }: { note: StudioNote; onRemove: (id: string) => void }): ReactElement {
  return (
    <article className="glass-panel note-card">
      <div className="note-card-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
          <span className="pill-badge" style={{ alignSelf: 'flex-start' }}>{NOTE_CATEGORY_LABELS[note.category]}</span>
          <h3 style={{ fontSize: '1.05rem' }}>{note.title}</h3>
          <span className="mono-value" style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            {formatNoteDate(note.createdAt)}
          </span>
        </div>
        <button type="button" className="btn btn-danger btn-sm" onClick={() => onRemove(note.id)} aria-label={`Xóa ghi chú ${note.title}`}>
          <TrashIcon size={14} />
          <span>Xóa</span>
        </button>
      </div>
      <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', whiteSpace: 'pre-line' }}>{note.content}</p>
    </article>
  );
}

function NotesListPanel({ playground }: { playground: UseStudioPlaygroundResult }): ReactElement {
  const { notesState, removeNote } = playground;

  if (notesState.status === 'loading') {
    return <AsyncStatusPanel variant="loading" title="Đang tải ghi chú..." description="Đang đọc danh sách ghi chú từ localStorage." />;
  }
  if (notesState.status === 'error') {
    return <AsyncStatusPanel variant="error" title="Lỗi truy xuất ghi chú" description={notesState.errorMessage ?? 'Không thể đọc dữ liệu ghi chú cục bộ.'} />;
  }

  const notes = notesState.data ?? [];
  if (notes.length === 0) {
    return (
      <AsyncStatusPanel
        variant="empty"
        title="Chưa có ghi chú Studio nào"
        description="Hãy điền biểu mẫu bên cạnh để lưu bản tóm tắt ý tưởng hoặc thông số thử nghiệm vào bộ nhớ trình duyệt."
      />
    );
  }

  return (
    <div className="notes-list" aria-label="Danh sách ghi chú đã lưu">
      {notes.map((note) => (
        <NoteCard key={note.id} note={note} onRemove={removeNote} />
      ))}
    </div>
  );
}

export function NotesComposer({ playground }: NotesComposerProps): ReactElement {
  return (
    <section id="notes" className="studio-section" aria-labelledby="notes-heading">
      <div className="container">
        <div className="section-header">
          <div>
            <span className="section-eyebrow">Studio Brief &amp; Ghi chú</span>
            <h2 id="notes-heading" className="section-title">Lưu ý tưởng sáng tạo tức thì</h2>
            <p className="section-subtitle">
              Biểu mẫu kiểm tra hợp lệ phía client, phản hồi trạng thái bất đồng bộ và lưu trữ bền vững trên localStorage.
            </p>
          </div>
        </div>
        <div className="notes-grid">
          <NoteFormPanel playground={playground} />
          <NotesListPanel playground={playground} />
        </div>
      </div>
    </section>
  );
}

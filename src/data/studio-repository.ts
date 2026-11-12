import type {
  CapabilityItemCategory,
  ShowcaseItem,
  StudioNote,
  StudioNoteInput,
} from '../types/studio-types';
import { HttpClientError, fetchJson } from './http-client';

/** Relative path to the static JSON catalog served from public/data. */
export const SHOWCASE_DATA_URL = './data/showcase.json';

/** Storage key used to persist user StudioNotes in localStorage. */
export const STUDIO_NOTES_STORAGE_KEY = 'nexus-studio-notes-v1';

/** Options controlling showcase catalog loading. */
export interface FetchShowcaseOptions {
  signal?: AbortSignal;
  simulateError?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string');
}

function isCapabilityItemCategory(value: unknown): value is CapabilityItemCategory {
  return (
    value === 'ai-agents' ||
    value === 'visuals' ||
    value === 'canvas' ||
    value === 'audio'
  );
}

function isShowcaseItem(value: unknown): value is ShowcaseItem {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isNonEmptyString(value.subtitle) &&
    isCapabilityItemCategory(value.category) &&
    isNonEmptyString(value.badge) &&
    isNonEmptyString(value.imagePath) &&
    isNonEmptyString(value.summary) &&
    isStringArray(value.metrics) &&
    isNonEmptyString(value.accentColor)
  );
}

function isStudioNote(value: unknown): value is StudioNote {
  if (!isRecord(value)) {
    return false;
  }
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.title) &&
    isCapabilityItemCategory(value.category) &&
    isNonEmptyString(value.content) &&
    isNonEmptyString(value.createdAt)
  );
}

function validateShowcasePayload(payload: unknown): ShowcaseItem[] {
  if (!Array.isArray(payload)) {
    throw new HttpClientError('Dữ liệu showcase không phải danh sách JSON hợp lệ.', 'PARSE');
  }
  const validated: ShowcaseItem[] = [];
  for (const entry of payload) {
    if (!isShowcaseItem(entry)) {
      throw new HttpClientError('Một mục trong showcase.json thiếu trường dữ liệu bắt buộc.', 'PARSE');
    }
    validated.push(entry);
  }
  return validated;
}

function getSafeStorage(): Storage | null {
  try {
    if (typeof globalThis.localStorage === 'undefined') {
      return null;
    }
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function generateNoteId(): string {
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `note-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Fetches and validates the showcase capability items from static JSON over HTTP. */
export async function fetchShowcaseItems(
  options: FetchShowcaseOptions = {},
): Promise<ShowcaseItem[]> {
  if (options.signal?.aborted) {
    throw new HttpClientError('Yêu cầu tải danh mục năng lực đã bị hủy.', 'ABORTED');
  }
  if (options.simulateError) {
    throw new HttpClientError(
      'Lỗi mô phỏng kết nối dữ liệu: không thể tải danh mục từ máy chủ.',
      'NETWORK',
    );
  }
  const payload = await fetchJson<unknown>(SHOWCASE_DATA_URL, {
    signal: options.signal,
  });
  return validateShowcasePayload(payload);
}

/** Safely reads and validates persisted studio notes from localStorage. */
export function loadStudioNotes(): StudioNote[] {
  const storage = getSafeStorage();
  if (!storage) {
    return [];
  }
  try {
    const raw = storage.getItem(STUDIO_NOTES_STORAGE_KEY);
    if (!raw || raw.trim().length === 0) {
      return [];
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(isStudioNote);
  } catch {
    return [];
  }
}

/** Validates and saves the complete list of studio notes to localStorage. */
export function saveStudioNotes(notes: readonly StudioNote[]): StudioNote[] {
  const storage = getSafeStorage();
  if (!storage) {
    throw new Error('Trình duyệt hiện không hỗ trợ hoặc đã chặn bộ nhớ cục bộ (localStorage).');
  }
  if (!notes.every(isStudioNote)) {
    throw new Error('Dữ liệu ghi chú không hợp lệ, không thể lưu trữ.');
  }
  const copy = [...notes];
  try {
    storage.setItem(STUDIO_NOTES_STORAGE_KEY, JSON.stringify(copy));
    return copy;
  } catch {
    throw new Error('Không thể lưu ghi chú vào bộ nhớ cục bộ. Vui lòng kiểm tra dung lượng trình duyệt.');
  }
}

/** Validates input, creates a new StudioNote, persists it, and returns the updated list. */
export function addStudioNote(input: StudioNoteInput): StudioNote[] {
  const title = input.title.trim();
  const content = input.content.trim();
  if (title.length === 0) {
    throw new Error('Vui lòng nhập tiêu đề cho ghi chú.');
  }
  if (content.length === 0) {
    throw new Error('Vui lòng nhập nội dung chi tiết cho ghi chú.');
  }
  if (!isCapabilityItemCategory(input.category)) {
    throw new Error('Danh mục ghi chú không hợp lệ.');
  }
  const nextNote: StudioNote = {
    id: generateNoteId(),
    title,
    category: input.category,
    content,
    createdAt: new Date().toISOString(),
  };
  const current = loadStudioNotes();
  return saveStudioNotes([nextNote, ...current]);
}

/** Removes a studio note by id from localStorage and returns the updated list. */
export function deleteStudioNote(noteId: string): StudioNote[] {
  const trimmedId = noteId.trim();
  const current = loadStudioNotes();
  if (trimmedId.length === 0) {
    return current;
  }
  const remaining = current.filter((note) => note.id !== trimmedId);
  return saveStudioNotes(remaining);
}

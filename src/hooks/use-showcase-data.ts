import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { HttpClientError, formatErrorMessage } from '../data/http-client';
import { fetchShowcaseItems } from '../data/studio-repository';
import type { AsyncState, CapabilityCategory, ShowcaseItem } from '../types/studio-types';

export interface UseShowcaseDataResult {
  state: AsyncState<ShowcaseItem[]>;
  filteredItems: ShowcaseItem[];
  selectedCategory: CapabilityCategory;
  setSelectedCategory: (category: CapabilityCategory) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  categoryCounts: Record<CapabilityCategory, number>;
  isErrorSimulated: boolean;
  toggleSimulateError: () => void;
  retry: () => void;
  resetFilters: () => void;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
}

function filterShowcaseItems(
  items: readonly ShowcaseItem[],
  category: CapabilityCategory,
  query: string,
): ShowcaseItem[] {
  const normalizedQuery = normalizeText(query);
  return items.filter((item) => {
    if (category !== 'all' && item.category !== category) return false;
    if (normalizedQuery.length === 0) return true;
    const haystack = normalizeText(
      `${item.title} ${item.subtitle} ${item.summary} ${item.badge} ${item.metrics.join(' ')}`,
    );
    return haystack.includes(normalizedQuery);
  });
}

function computeCategoryCounts(items: readonly ShowcaseItem[]): Record<CapabilityCategory, number> {
  const counts: Record<CapabilityCategory, number> = {
    all: items.length,
    'ai-agents': 0,
    visuals: 0,
    canvas: 0,
    audio: 0,
  };
  for (const item of items) {
    counts[item.category] += 1;
  }
  return counts;
}

function useCatalogLoader() {
  const [state, setState] = useState<AsyncState<ShowcaseItem[]>>({ status: 'loading', data: null, errorMessage: null });
  const [isErrorSimulated, setIsErrorSimulated] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const loadCatalog = useCallback(async (simulateError: boolean): Promise<void> => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setState({ status: 'loading', data: null, errorMessage: null });
    try {
      const items = await fetchShowcaseItems({ signal: controller.signal, simulateError });
      if (!controller.signal.aborted) setState({ status: 'success', data: items, errorMessage: null });
    } catch (error: unknown) {
      if (error instanceof HttpClientError && error.code === 'ABORTED') return;
      if (!controller.signal.aborted) setState({ status: 'error', data: null, errorMessage: formatErrorMessage(error) });
    }
  }, []);

  useEffect(() => {
    void loadCatalog(false);
    return () => { abortRef.current?.abort(); };
  }, [loadCatalog]);

  const retry = useCallback((): void => { setIsErrorSimulated(false); void loadCatalog(false); }, [loadCatalog]);
  const toggleSimulateError = useCallback((): void => {
    const next = !isErrorSimulated;
    setIsErrorSimulated(next);
    void loadCatalog(next);
  }, [isErrorSimulated, loadCatalog]);

  return { state, isErrorSimulated, retry, toggleSimulateError };
}

/** Manages showcase catalog fetching, category filtering, search, and error/retry states. */
export function useShowcaseData(): UseShowcaseDataResult {
  const { state, isErrorSimulated, retry, toggleSimulateError } = useCatalogLoader();
  const [selectedCategory, setSelectedCategory] = useState<CapabilityCategory>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const items = useMemo(() => state.data ?? [], [state.data]);
  const filteredItems = useMemo(
    () => filterShowcaseItems(items, selectedCategory, searchQuery),
    [items, selectedCategory, searchQuery],
  );
  const categoryCounts = useMemo(() => computeCategoryCounts(items), [items]);

  const resetFilters = useCallback((): void => {
    setSelectedCategory('all');
    setSearchQuery('');
  }, []);

  return {
    state,
    filteredItems,
    selectedCategory,
    setSelectedCategory,
    searchQuery,
    setSearchQuery,
    categoryCounts,
    isErrorSimulated,
    toggleSimulateError,
    retry,
    resetFilters,
  };
}

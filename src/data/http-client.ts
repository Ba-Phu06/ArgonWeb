/** Options configuring HTTP JSON requests with timeout and retries. */
export interface FetchJsonOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  signal?: AbortSignal;
  headers?: Record<string, string>;
}

/** Category of failure produced by the HTTP client. */
export type HttpClientErrorCode = 'TIMEOUT' | 'NETWORK' | 'HTTP' | 'PARSE' | 'ABORTED';

/** Typed error thrown when fetching or parsing JSON fails. */
export class HttpClientError extends Error {
  readonly code: HttpClientErrorCode;
  readonly statusCode: number | null;

  constructor(message: string, code: HttpClientErrorCode, statusCode: number | null = null) {
    super(message);
    this.name = 'HttpClientError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

interface ResolvedFetchOptions {
  timeoutMs: number;
  retries: number;
  retryDelayMs: number;
  signal?: AbortSignal;
  headers: Record<string, string>;
}

interface AttemptSignalHandle {
  signal: AbortSignal;
  didTimeout: () => boolean;
  wasAbortedExternally: () => boolean;
  cleanup: () => void;
}

const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_RETRIES = 2;
const DEFAULT_RETRY_DELAY_MS = 300;
const MIN_TIMEOUT_MS = 100;

function resolveFetchOptions(options: FetchJsonOptions): ResolvedFetchOptions {
  const timeoutMs = Math.max(MIN_TIMEOUT_MS, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const retries = Math.max(0, Math.floor(options.retries ?? DEFAULT_RETRIES));
  const retryDelayMs = Math.max(0, options.retryDelayMs ?? DEFAULT_RETRY_DELAY_MS);
  return {
    timeoutMs,
    retries,
    retryDelayMs,
    signal: options.signal,
    headers: options.headers ?? {},
  };
}

function createAttemptSignal(timeoutMs: number, externalSignal?: AbortSignal): AttemptSignalHandle {
  const controller = new AbortController();
  let timedOut = false;
  let abortedExternally = false;

  const onExternalAbort = (): void => {
    abortedExternally = true;
    controller.abort();
  };

  const timeoutId = globalThis.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (externalSignal) {
    if (externalSignal.aborted) {
      onExternalAbort();
    } else {
      externalSignal.addEventListener('abort', onExternalAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    didTimeout: (): boolean => timedOut,
    wasAbortedExternally: (): boolean => abortedExternally,
    cleanup: (): void => {
      globalThis.clearTimeout(timeoutId);
      externalSignal?.removeEventListener('abort', onExternalAbort);
    },
  };
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof HttpClientError) {
    if (error.code === 'TIMEOUT' || error.code === 'NETWORK') {
      return true;
    }
    if (error.code === 'HTTP' && error.statusCode !== null) {
      return error.statusCode === 408 || error.statusCode === 429 || error.statusCode >= 500;
    }
    return false;
  }
  return error instanceof TypeError;
}

function delayWithSignal(delayMs: number, signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) {
    return Promise.reject(new HttpClientError('Yêu cầu tải dữ liệu đã bị hủy.', 'ABORTED'));
  }

  return new Promise<void>((resolve, reject) => {
    const onAbort = (): void => {
      globalThis.clearTimeout(timerId);
      reject(new HttpClientError('Yêu cầu tải dữ liệu đã bị hủy.', 'ABORTED'));
    };

    const timerId = globalThis.setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, delayMs);

    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new HttpClientError('Dữ liệu phản hồi không đúng định dạng JSON.', 'PARSE', response.status);
  }
}

function mapAttemptError(error: unknown, signalHandle: AttemptSignalHandle): HttpClientError {
  if (signalHandle.wasAbortedExternally()) {
    return new HttpClientError('Yêu cầu tải dữ liệu đã bị hủy.', 'ABORTED');
  }
  if (signalHandle.didTimeout()) {
    return new HttpClientError('Kết nối quá thời gian chờ. Vui lòng thử lại.', 'TIMEOUT');
  }
  if (error instanceof HttpClientError) {
    return error;
  }
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new HttpClientError('Yêu cầu tải dữ liệu đã bị hủy.', 'ABORTED');
  }
  if (error instanceof TypeError) {
    return new HttpClientError('Không thể kết nối tới nguồn dữ liệu. Vui lòng kiểm tra lại mạng.', 'NETWORK');
  }
  return new HttpClientError(formatErrorMessage(error), 'NETWORK');
}

async function executeSingleFetch<T>(url: string, options: ResolvedFetchOptions): Promise<T> {
  if (options.signal?.aborted) {
    throw new HttpClientError('Yêu cầu tải dữ liệu đã bị hủy.', 'ABORTED');
  }

  const signalHandle = createAttemptSignal(options.timeoutMs, options.signal);
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...options.headers,
      },
      signal: signalHandle.signal,
    });

    if (!response.ok) {
      throw new HttpClientError(
        `Không thể tải dữ liệu (mã HTTP ${response.status}).`,
        'HTTP',
        response.status,
      );
    }

    return await parseJsonResponse<T>(response);
  } catch (error: unknown) {
    throw mapAttemptError(error, signalHandle);
  } finally {
    signalHandle.cleanup();
  }
}

/** Fetches JSON from a URL with AbortController timeout and exponential backoff retries. */
export async function fetchJson<T = unknown>(url: string, options: FetchJsonOptions = {}): Promise<T> {
  const resolved = resolveFetchOptions(options);

  for (let attempt = 0; attempt <= resolved.retries; attempt += 1) {
    try {
      return await executeSingleFetch<T>(url, resolved);
    } catch (error: unknown) {
      const hasMoreAttempts = attempt < resolved.retries;
      if (!hasMoreAttempts || !isRetryableError(error)) {
        throw error;
      }
      const backoffMs = resolved.retryDelayMs * 2 ** attempt;
      await delayWithSignal(backoffMs, resolved.signal);
    }
  }

  throw new HttpClientError('Không thể hoàn tất yêu cầu tải dữ liệu.', 'NETWORK');
}

/** Converts an unknown error value into a clear Vietnamese user-facing message. */
export function formatErrorMessage(error: unknown): string {
  if (error instanceof HttpClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return 'Yêu cầu tải dữ liệu đã bị hủy hoặc quá thời gian chờ.';
    }
    const trimmed = error.message.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return error.trim();
  }

  return 'Đã xảy ra lỗi không xác định. Vui lòng thử lại sau.';
}

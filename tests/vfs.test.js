/**
 * Tests for VFS.request() retry/fetch behaviour via the shared
 * fetchWithRetry helper. Mocks global fetch to exercise:
 *  - success paths (JSON + plain text bodies)
 *  - 502/503 retry-then-succeed (Render free-tier wake-up)
 *  - retry exhaustion then final throw
 *  - AbortError rewrite into "Request timed out"
 *  - skipAuth header handling
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VFS } from '../frontend/js/vfs.js';
import { fetchWithRetry } from '../frontend/js/fetchWithRetry.js';

/* ---- Stub Config so tests never touch localStorage ---- */
function makeConfig() {
  return {
    apiKey: 'test-key-123',
    basePath: '/harold_os',
    data: { timeout: 50, maxRetries: 3, retryDelay: 1 },
    url: (service) => (service === 'files' ? 'https://files.example' : ''),
    headers: () => ({ 'Content-Type': 'application/json' }),
  };
}

function jsonRes(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Status',
    headers: { get: () => 'application/json' },
    text: async () => JSON.stringify(body),
  };
}

function textRes(status, body, contentType = 'text/plain') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Status',
    headers: { get: () => contentType },
    text: async () => body,
  };
}

let originalFetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('fetchWithRetry', () => {
  it('returns parsed JSON when content-type is application/json', async () => {
    globalThis.fetch = vi.fn(async () => jsonRes(200, { hello: 'world' }));
    const result = await fetchWithRetry('https://x.test/a');
    expect(result).toEqual({ hello: 'world' });
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it('returns raw text for non-JSON responses', async () => {
    globalThis.fetch = vi.fn(async () => textRes(200, 'plain body'));
    const result = await fetchWithRetry('https://x.test/a');
    expect(result).toBe('plain body');
  });

  it('retries on 502 then succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(textRes(502, 'waking up'))
      .mockResolvedValueOnce(textRes(200, 'ok now'));
    globalThis.fetch = fetchMock;

    const result = await fetchWithRetry('https://x.test/a', {}, { retryDelay: 1 });
    expect(result).toBe('ok now');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws after exhausting retries when every attempt is 503', async () => {
    const fetchMock = vi.fn(async () => textRes(503, 'still sleeping'));
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithRetry('https://x.test/a', {}, { maxRetries: 3, retryDelay: 1 })
    ).rejects.toThrow(/HTTP 503/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('throws a non-OK error immediately without retrying 4xx', async () => {
    const fetchMock = vi.fn(async () => textRes(404, 'nope'));
    globalThis.fetch = fetchMock;

    await expect(
      fetchWithRetry('https://x.test/a', {}, { maxRetries: 3, retryDelay: 1 })
    ).rejects.toThrow(/HTTP 404/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rewrites AbortError into "Request timed out"', async () => {
    const abortErr = new Error('The operation was aborted');
    abortErr.name = 'AbortError';
    globalThis.fetch = vi.fn(async () => { throw abortErr; });

    await expect(
      fetchWithRetry('https://x.test/a', {}, { maxRetries: 2, retryDelay: 1 })
    ).rejects.toThrow('Request timed out');
  });
});

describe('VFS.request', () => {
  it('throws when no files service URL is configured', async () => {
    const vfs = new VFS({ ...makeConfig(), url: () => '' });
    await expect(vfs.list()).rejects.toThrow('No files service URL configured');
  });

  it('builds the correct FTP-bridge URL and sends X-API-Key', async () => {
    const fetchMock = vi.fn(async () => jsonRes(200, { path: '/', entries: [] }));
    globalThis.fetch = fetchMock;
    const vfs = new VFS(makeConfig());

    await vfs.list('');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://files.example/files/harold_os/');
    expect(init.headers['X-API-Key']).toBe('test-key-123');
  });

  it('omits X-API-Key when skipAuth is true', async () => {
    const fetchMock = vi.fn(async () => textRes(200, 'ok'));
    globalThis.fetch = fetchMock;
    const vfs = new VFS(makeConfig());

    await vfs.request('/ping', { skipAuth: true });
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBeUndefined();
    expect(fetchMock.mock.calls[0][1].headers['Content-Type']).toBe('application/json');
  });

  it('still sends X-API-Key when no skipAuth option is given', async () => {
    const fetchMock = vi.fn(async () => textRes(200, 'ok'));
    globalThis.fetch = fetchMock;
    const vfs = new VFS(makeConfig());

    await vfs.request('/ping', { method: 'GET' });
    expect(fetchMock.mock.calls[0][1].headers['X-API-Key']).toBe('test-key-123');
  });

  it('does not leak the skipAuth flag into fetch options', async () => {
    const fetchMock = vi.fn(async () => textRes(200, 'ok'));
    globalThis.fetch = fetchMock;
    const vfs = new VFS(makeConfig());

    await vfs.request('/ping', { skipAuth: true });
    expect(fetchMock.mock.calls[0][1].skipAuth).toBeUndefined();
  });
});

/* ========================================
   GeoOS - API Bridge to Render Backend
   Provides fetch wrappers with CORS awareness,
   retry logic for free-tier spin-up, and graceful fallbacks.
   ======================================== */

import { fetchWithRetry } from '../frontend/js/fetchWithRetry.js';

export class GeoOSApi {
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl || window.RENDER_API_URL || 'https://your-render-service.onrender.com').replace(/\/$/, '') + '/harold_os';
    this.timeout = options.timeout || 10000;
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 2000; // ms, for Render free-tier wake-up
    this.token = options.token || null;
  }

  setToken(token) {
    this.token = token;
  }

  /* ------------------------------------------------------------------ */
  /* Core request with retry + timeout                                  */
  /* ------------------------------------------------------------------ */

  async request(path, options = {}) {
    const url = this.baseUrl + path;
    const headers = {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      ...options.headers,
    };

    try {
      return await fetchWithRetry(url, {
        method: options.method || 'GET',
        headers,
        ...(options.body && { body: JSON.stringify(options.body) }),
        mode: 'cors', // Required for cross-origin to Render
        credentials: 'omit',
      }, {
        timeout: this.timeout,
        maxRetries: this.maxRetries,
        retryDelay: this.retryDelay,
      });
    } catch (err) {
      // Preserve the legacy "API <status>:" error prefix callers rely on.
      if (/^HTTP \d+/.test(err.message)) {
        err.message = err.message.replace(/^HTTP/, 'API');
      }
      throw err;
    }
  }

  /* ------------------------------------------------------------------ */
  /* Convenience endpoints                                              */
  /* ------------------------------------------------------------------ */

  async ping() {
    try {
      const result = await this.request('/api/ping');
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async getNotes() {
    try {
      const result = await this.request('/api/notes');
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message, data: [] };
    }
  }

  async saveNote(note) {
    try {
      const result = await this.request('/api/notes', {
        method: 'POST',
        body: note,
      });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  async uploadFile(filename, content) {
    try {
      const result = await this.request('/api/upload', {
        method: 'POST',
        body: { filename, content },
      });
      return { ok: true, data: result };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }
}

/* Expose globally so kernel.js and apps can use it without import */
window.geoosApi = new GeoOSApi();
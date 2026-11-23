/* ========================================
   GeoOS - Notepad App Module
   Exports: { title, create, destroy, onFocus }
   ======================================== */

export const title = 'Notepad';

const STORAGE_KEY = 'geoos_notepad_content';

export function create(container, options) {
  const kernel = options.kernel;
  const api = options.api; // GeoOSApi instance

  // Build notepad UI
  container.innerHTML = `
    <div style="display: flex; gap: 8px; margin-bottom: 8px; flex-wrap: wrap;">
      <button id="notepad-save-local" class="btn">Save Local</button>
      <button id="notepad-sync-render" class="btn secondary">Sync to Render</button>
      <button id="notepad-load-render" class="btn secondary">Load from Render</button>
      <button id="notepad-clear" class="btn secondary">Clear</button>
    </div>
    <div style="font-size: 11px; color: #666; margin-bottom: 4px;">
      Notes auto-save to browser localStorage.
    </div>
    <textarea id="notepad-editor" placeholder="Type your notes here..."></textarea>
    <div id="notepad-status" style="margin-top: 6px; font-size: 11px; color: #008000;"></div>
  `;

  const editorEl = container.querySelector('#notepad-editor');
  const saveLocalBtn = container.querySelector('#notepad-save-local');
  const syncRenderBtn = container.querySelector('#notepad-sync-render');
  const loadRenderBtn = container.querySelector('#notepad-load-render');
  const clearBtn = container.querySelector('#notepad-clear');
  const statusEl = container.querySelector('#notepad-status');

  // Load existing content from localStorage
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    editorEl.value = saved;
  }

  const showStatus = (msg, type = 'info') => {
    statusEl.textContent = msg;
    statusEl.style.color = type === 'success' ? '#008000' : type === 'error' ? '#ff0000' : '#008000';
    setTimeout(() => { statusEl.textContent = ''; }, 3000);
  };

  // Auto-save to localStorage on input (debounced)
  let saveTimeout;
  const autoSave = () => {
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, editorEl.value);
    }, 1000);
  };
  editorEl.addEventListener('input', autoSave);

  // Manual save local
  saveLocalBtn.addEventListener('click', () => {
    localStorage.setItem(STORAGE_KEY, editorEl.value);
    showStatus('Saved to localStorage.');
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all notes?')) {
      editorEl.value = '';
      localStorage.removeItem(STORAGE_KEY);
      showStatus('Notes cleared.');
    }
  });

  // Sync to Render backend
  syncRenderBtn.addEventListener('click', async () => {
    const content = editorEl.value;
    if (!content.trim()) {
      showStatus('Nothing to sync.', 'error');
      return;
    }
    const result = await api.saveNote({ content, updatedAt: new Date().toISOString() });
    if (result.ok) {
      showStatus('Synced to Render backend.');
    } else {
      showStatus('Sync failed: ' + result.error, 'error');
    }
  });

  // Load from Render backend
  loadRenderBtn.addEventListener('click', async () => {
    const result = await api.getNotes();
    if (result.ok && result.data && result.data.content) {
      editorEl.value = result.data.content;
      localStorage.setItem(STORAGE_KEY, result.data.content);
      showStatus('Loaded from Render backend.');
    } else {
      showStatus('Load failed: ' + (result.error || 'no data'), 'error');
    }
  });

  // Return instance object
  return {
    onFocus() {
      editorEl.focus();
    },
    destroy() {
      clearTimeout(saveTimeout);
      // Final auto-save before close
      localStorage.setItem(STORAGE_KEY, editorEl.value);
    },
  };
}

export function destroy() {
  // Module-level cleanup
}
/* ========================================
   GeoOS - Terminal App Module
   Exports: { title, create, destroy, onFocus }
   ======================================== */

export const title = 'Terminal';

const commands = {
  help: () => `
Available commands:
  help            - Show this help message
  clear           - Clear the terminal screen
  ls              - List available apps
  open <app>      - Open an app (terminal, notepad)
  ping            - Test connection to Render backend
  whoami          - Show current user
  date            - Show current date/time
  ver             - Show GeoOS version
  shutdown        - Shut down GeoOS
`,
  clear: () => null, // special: handled by caller
  ls: () => 'Available apps: terminal, notepad',
  open: (args, kernel) => {
    const appName = args[1];
    if (!appName) return 'Usage: open <app>';
    kernel.openApp(appName);
    return `Opening ${appName}...`;
  },
  ping: async (args, kernel) => {
    const result = await kernel.api.ping();
    if (result.ok) return `Ping OK: ${JSON.stringify(result.data)}`;
    return `Ping failed: ${result.error}`;
  },
  whoami: () => 'user@geoos',
  date: () => new Date().toString(),
  ver: () => 'GeoOS v1.0.0 (Front-End Only)',
  shutdown: (args, kernel) => {
    kernel.shutdown();
    return 'Shutting down...';
  },
};

export function create(container, options) {
  const kernel = options.kernel;

  // Build terminal UI
  container.innerHTML = `
    <div id="terminal-content"></div>
    <div id="terminal-input-line">
      <span class="terminal-prompt">user@geoos:~$ </span>
      <input type="text" id="terminal-command-input" autofocus autocomplete="off" spellcheck="false">
    </div>
  `;

  const contentEl = container.querySelector('#terminal-content');
  const inputEl = container.querySelector('#terminal-command-input');

  let history = [];
  let historyIndex = -1;

  const print = (text, className = '') => {
    const line = document.createElement('div');
    line.className = 'terminal-line ' + className;
    line.textContent = text;
    contentEl.appendChild(line);
    contentEl.scrollTop = contentEl.scrollHeight;
  };

  const printHtml = (html, className = '') => {
    const line = document.createElement('div');
    line.className = 'terminal-line ' + className;
    line.innerHTML = html;
    contentEl.appendChild(line);
    contentEl.scrollTop = contentEl.scrollHeight;
  };

  const execute = async (cmd) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    history.push(trimmed);
    historyIndex = history.length;

    print(`user@geoos:~$ ${trimmed}`, 'terminal-input');

    const parts = trimmed.split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts;

    // Special handling for clear (synchronous DOM mutation)
    if (cmdName === 'clear') {
      contentEl.innerHTML = '';
      return;
    }

    const handler = commands[cmdName];
    if (!handler) {
      print(`Command not found: ${cmdName}`, 'terminal-error');
      return;
    }

    try {
      const result = handler(args, kernel);
      if (result instanceof Promise) {
        const resolved = await result;
        if (resolved !== undefined && resolved !== null) print(resolved, 'terminal-output');
      } else if (result !== undefined && result !== null) {
        print(result, 'terminal-output');
      }
    } catch (err) {
      print(`Error: ${err.message}`, 'terminal-error');
    }

    print('', 'terminal-output'); // spacing
  };

  inputEl.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter') {
      await execute(inputEl.value);
      inputEl.value = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) historyIndex--;
      inputEl.value = history[historyIndex] || '';
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < history.length - 1) historyIndex++;
      inputEl.value = history[historyIndex] || '';
    }
  });

  // Boot message
  print(`GeoOS Terminal v1.0.0`);
  print(`Type 'help' for available commands.`);
  print('');

  // Return instance object for kernel lifecycle management
  return {
    onFocus() {
      inputEl.focus();
    },
    destroy() {
      // No cleanup needed for terminal
    },
  };
}

export function destroy() {
  // Module-level cleanup (if any)
}
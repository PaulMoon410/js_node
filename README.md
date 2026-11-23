# GeoOS — Multi-Service Web OS

A modular, zero-dependency vanilla HTML/CSS/JS web operating system designed to run
statically on [GeoCities.ws](https://geocities.ws) while communicating directly with
three backend microservices hosted on [Render](https://render.com).

## Directory Structure

```
/frontend/              # Deploy this folder to GeoCities.ws via FTP
  index.html            # Desktop shell, taskbar, start menu, service status tray
  css/os.css            # Retro-modern window manager styling
  js/config.js          # Central config: Render URLs, API key from localStorage
  js/boot.js            # Parallel cold-start wake-up (Promise.allSettled)
  js/windowManager.js   # Window creation, drag, resize, focus, lazy app loading
  js/vfs.js             # Virtual File System client -> Python Render FTP bridge
  js/apps/
    fileExplorer.js     # GUI file manager browsing GeoCities via vfs.js
    notepad.js          # Text editor saving to GeoCities via vfs.js
    aiAssistant.js      # Chat calling g4f-go directly; save output to GeoCities
    systemMonitor.js    # Live latency/status + runtime URL edits
/backends/              # Reference templates for Render services (do not upload to GeoCities)
  python-ftp/           # FastAPI + ftplib bridge to GeoCities.ws
    main.py
    requirements.txt
  node-service/         # Express utility service
    index.js
    package.json
README.md
```

## Key Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Zero build step** | Pure ES6 modules (`type="module"`). No npm, Webpack, or Vite. Upload as-is. |
| **Direct-to-service** | Each frontend app `fetch()`es its target Render service directly — no Node.js middleman. |
| **Resilient cold starts** | `boot.js` pings all 3 services in parallel via `Promise.allSettled()`. Retry/timeout handling for Render free-tier spin-up. |
| **No hardcoded secrets** | API key and service URLs are prompted at runtime and stored in `localStorage` only. Sent via `X-API-Key` header. |

## The Three Render Backends

| Service | Render Service | Source | Key Endpoints |
|---------|---------------|--------|---------------|
| **`SERVICES.node`** | `https://js-node.onrender.com` | `PaulMoon410/js_node` | `/health`, `/echo`, `/webhook` |
| **`SERVICES.ai`** | `https://g4f-go.onrender.com` (verify in Render) | - | `/v1/chat/completions` | **Primary AI endpoint (OpenAI-compatible). Falls back to harthon sessions if unavailable.** |
| **`SERVICES.files`** | *(deploy separately)* | `backends/python-ftp/` | `/health`, `/files`, `/file` (GET/POST/DELETE) |

### 1. SERVICES.node — `js-node.onrender.com` (Node.js / Express)

This is Harold's dedicated Node service (repo: `PaulMoon410/js_node`). It already runs on Render at
`https://js-node.onrender.com` and hosts static dashboards plus API endpoints.

**Add these routes to `js_node/server.js`** (see `backends/node-service/js-node-additions.js`):

```js
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'node-service', timestamp: new Date().toISOString() });
});

app.get('/echo', requireNodeApiKey, (req, res) => {
  res.json({ echo: req.query.message || '', timestamp: new Date().toISOString() });
});

app.post('/webhook', requireNodeApiKey, (req, res) => {
  console.log('GeoOS webhook received:', JSON.stringify(req.body, null, 2));
  res.json({ status: 'received', receivedAt: new Date().toISOString() });
});
```

Set the `API_KEY` environment variable on the Render service to match the key you enter in the GeoOS System Monitor.

### 2. SERVICES.ai — `harthon` (Python Flask)

The `harthon` repo (`PaulMoon410/harthon`) is a Python Flask app on Render with:
- `GET /health` — health check (used by boot.js cold-start wake-up)
- `GET /api/status` — app status JSON
- `POST /api/sessions` / `POST /api/sessions/<id>/execute` / `DELETE /api/sessions/<id>` — Python session execution (requires `PYTHON_API_KEY`)
- `g4f` included in `requirements.txt` for AI capability

**Set these environment variables on the Render service:**
- `PYTHON_API_KEY` — a long random ASCII secret (32+ chars). Send as `Authorization: Bearer <key>` header. Used for harthon session fallback.
- `API_KEY` — optional API key (default: `Slithery_Snake`). Match this key against `X-API-Key` header or `Authorization: Bearer` token for FTP bridge endpoint protection. If left as default `Slithery_Snake`, no Render env var change needed.

> **Frontend integration:** The GeoOS AI Assistant sends `Authorization: Bearer <geoos_api_key>` from `localStorage` (set via System Monitor) to the harthon session fallback. Ensure the key you enter in GeoOS System Monitor matches the `API_KEY` value on your Render service (default: `Slithery_Snake`).

> ⚠️ Verify the actual Render URL for harthon in your Render dashboard. The default in `config.js` is `https://harthon.onrender.com` but your deployment may use a different subdomain (e.g., `harthon-web.onrender.com`). Override it at runtime via **System Monitor** if needed.

### 3. SERVICES.files — Python FTP Bridge (deploy separately)

Deploys `backends/python-ftp/main.py` (FastAPI + `ftplib`) to a Render Web Service. Exposes GeoCities.ws FTP via HTTP:

- `GET /health` — health check
- `GET /files?path=...` — list directory
- `GET /file?path=...` — read file
- `POST /file` — write file (`{ path, content }`)
- `DELETE /file?path=...` — delete file

**Set these environment variables:**
- `FTP_HOST` — `ftp.geocities.ws`
- `FTP_USER` — GeoCities FTP username
- `FTP_PASS` — GeoCities FTP password
- `FTP_HOME_DIR` — `/harold_os` (default)
- `API_KEY` — must match the key in GeoOS System Monitor

### 4. Upload `/frontend` to GeoCities.ws

Upload the entire `frontend/` folder to your GeoCities.ws account via FTP into the `/harold_os` directory:

```
frontend/
  index.html       -> /harold_os/index.html
  css/os.css       -> /harold_os/css/os.css
  js/config.js     -> /harold_os/js/config.js
  js/boot.js       -> /harold_os/js/boot.js
  js/windowManager.js -> /harold_os/js/windowManager.js
  js/vfs.js        -> /harold_os/js/vfs.js
  js/apps/*.js     -> /harold_os/js/apps/*.js
```

The OS will be accessible at:
**https://www.geocities.ws/paulmoon410/harold_os/index.html**

## Architecture Notes

- **VFS client** (`js/vfs.js`) talks only to the Python FTP Render service. It never touches the AI or Node services.
- **AI Assistant** (`js/apps/aiAssistant.js`) calls `SERVICES.ai` directly via `fetch()` — not proxied through Node.js.
- **Notepad** opens/saves files to GeoCities via `vfs.js` (Python FTP bridge).
- **File Explorer** browses directories on the GeoCities FTP via `vfs.js`.
- **System Monitor** lets you edit Render URLs and API key at runtime, persisted to `localStorage`.

## Security

- API key is stored in `localStorage` (browser-only, never transmitted to GeoCities).
- All backend requests include `X-API-Key` header when a key is configured.
- CORS is enabled on all backend services to allow cross-origin requests from your GeoCities domain.

## License

MIT
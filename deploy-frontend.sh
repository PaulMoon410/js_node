#!/usr/bin/env bash
#
# GeoOS Frontend Deploy — curl-based FTP upload to GeoCities.ws.
# (Used because lftp is not installed; curl handles FTP PUT fine.)
# Credentials come from env (FTP_USER / FTP_PASS / FTP_DIR).
#
set -euo pipefail

LOCAL_DIR="$(cd "$(dirname "$0")/harold_os" && pwd)"
cd "$LOCAL_DIR"
REMOTE_HOST="ftp.geocities.ws"
REMOTE_DIR="${FTP_DIR:-/htdocs}"
REMOTE_USER="${FTP_USER:?FTP_USER environment variable is required}"
REMOTE_PASS="${FTP_PASS:?FTP_PASS environment variable is required}"

echo "========================================"
echo " GeoOS Frontend Deploy to GeoCities.ws"
echo "========================================"
echo " Local dir  : ${LOCAL_DIR}"
echo " Remote dir : ${REMOTE_DIR}"
echo ""

upload() {
  local file="$1"
  local name
  name="$(basename "$file")"
  echo "  -> ${REMOTE_DIR}/${file#${LOCAL_DIR}/}"
  for attempt in 1 2 3; do
    if curl -sS --ftp-pasv --connect-timeout 20 --max-time 120 \
         -T "$file" \
         "ftp://${REMOTE_USER}:${REMOTE_PASS}@${REMOTE_HOST}${REMOTE_DIR}/${file#${LOCAL_DIR}/}"; then
      return 0
    fi
    echo "     attempt ${attempt} failed, retrying..."
    sleep 3
  done
  echo "     FAILED: ${name}"
  return 1
}

FAILED=0

# Root-level files
for f in index.html; do
  upload "$f" || FAILED=1
done

# js/ files
for f in config.js boot.js vfs.js fetchWithRetry.js windowManager.js; do
  upload "$LOCAL_DIR/js/$f" || FAILED=1
done

# js/apps/ files
for f in fileExplorer.js notepad.js aiAssistant.js systemMonitor.js; do
  upload "$LOCAL_DIR/js/apps/$f" || FAILED=1
done

# css/ files
for f in os.css; do
  upload "$LOCAL_DIR/css/$f" || FAILED=1
done

echo ""
if [ "$FAILED" -eq 0 ]; then
  echo "All files synced successfully."
else
  echo "Some uploads FAILED — see above."
  exit 1
fi

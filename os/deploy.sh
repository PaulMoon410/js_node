#!/usr/bin/env bash
#
# GeoOS Deploy Script
# Uploads files to GeoCities.ws via passive-mode FTP using lftp.
# Credentials are read from environment variables — never hardcoded:
#   export FTP_USER="your_geocities_user"
#   export FTP_PASS="your_geocities_pass"
#   export FTP_DIR="/htdocs"   # remote directory (default: /htdocs)
#

set -euo pipefail

# --- Configuration ---
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"
REMOTE_HOST="ftp.geocities.ws"
REMOTE_DIR="${FTP_DIR:-/htdocs}"
REMOTE_USER="${FTP_USER:?FTP_USER environment variable is required}"
REMOTE_PASS="${FTP_PASS:?FTP_PASS environment variable is required}"
LFTPOUT="${LOCAL_DIR}/.lftp-deploy.log"

# --- Validate lftp ---
if ! command -v lftp &>/dev/null; then
  echo "ERROR: lftp is not installed. Install it: sudo apt install lftp"
  exit 1
fi

echo "========================================"
echo " GeoOS Deploy to GeoCities.ws (passive FTP)"
echo "========================================"
echo " Local dir  : ${LOCAL_DIR}"
echo " Remote host: ${REMOTE_HOST}"
echo " Remote dir : ${REMOTE_DIR}"
echo ""

# Build the lftp command script with passive mode and explicit puts
LFTP_COMMANDS="
set ftp:ssl-allow no
set ftp:passive-mode on
set net:max-retries 5
set net:timeout 30
set xfer:max-retries 5
open ftp://${REMOTE_USER}:${REMOTE_PASS}@${REMOTE_HOST}
cd ${REMOTE_DIR}
mkdir -p apps
cd apps
put ${LOCAL_DIR}/apps/terminal.js
put ${LOCAL_DIR}/apps/notepad.js
cd ..
put ${LOCAL_DIR}/index.html
put ${LOCAL_DIR}/style.css
put ${LOCAL_DIR}/kernel.js
put ${LOCAL_DIR}/api.js
bye
"

echo "Starting lftp upload..."
echo "${LFTP_COMMANDS}" | lftp > "${LFTPOUT}" 2>&1 || true

echo ""
echo "Deploy log written to: ${LFTPOUT}"
echo "Deploy complete."

# Show summary
if grep -qi "error\|failed" "${LFTPOUT}" 2>/dev/null; then
  echo ""
  echo "WARNING: Possible errors detected. Check ${LFTPOUT}"
else
  echo ""
  echo "All files synced successfully."
fi

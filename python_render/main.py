"""
GeoOS - Python FTP Bridge (Render + FastAPI + ftplib)
Exposes GeoCities.ws FTP via HTTP with CORS and API key validation.

Endpoints:
  GET  /health          - Health check
  GET  /files?path=...  - List directory contents
  GET  /file?path=...   - Read a file
  POST /file            - Write a file (body: { path, content })
  DELETE /file?path=... - Delete a file

Environment variables:
  FTP_HOST       - ftp.geocities.ws
  FTP_USER       - GeoCities FTP username
  FTP_PASS       - GeoCities FTP password
  FTP_HOME_DIR   - FTP home directory (default: /harold_os)
  API_KEY        - Required X-API-Key header value (optional; if set, enforced)
"""
import os
import io
from ftplib import FTP
from fastapi import FastAPI, HTTPException, Header, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

app = FastAPI(title="GeoOS FTP Bridge", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://www.geocities.ws/paulmoon410/harold_os", "https://www.geocities.ws", "http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FTP_HOST = os.getenv("FTP_HOST", "ftp.geocities.ws")
FTP_USER = os.getenv("FTP_USER", "")
FTP_PASS = os.getenv("FTP_PASS", "")
FTP_HOME_DIR = os.getenv("FTP_HOME_DIR", "/harold_os").rstrip("/")
API_KEY = os.getenv("API_KEY", "Slithery_Snake")


def get_ftp() -> FTP:
    ftp = FTP(FTP_HOST, timeout=30)
    ftp.login(FTP_USER, FTP_PASS)
    # Change into the configured FTP home directory (default: /harold_os)
    if FTP_HOME_DIR:
        ftp.cwd(FTP_HOME_DIR)
    return ftp


def resolve_path(path: str) -> str:
    """Resolve a client-relative path against the FTP home directory."""
    path = path or "/"
    if not path.startswith("/"):
        path = "/" + path
    # If already under the home directory, use as-is; otherwise prefix it
    if path == "/" or path.startswith(FTP_HOME_DIR + "/") or path == FTP_HOME_DIR:
        return path if path != "/" else FTP_HOME_DIR
    return FTP_HOME_DIR + path


def _get_api_key(authorization: Optional[str] = Header(None), x_api_key: Optional[str] = Header(None)) -> Optional[str]:
    """Extract API key from Authorization: Bearer token or X-API-Key header."""
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    return x_api_key

def verify_api_key(authorization: Optional[str] = Header(None), x_api_key: Optional[str] = Header(None)):
    key = _get_api_key(authorization, x_api_key)
    if API_KEY and key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid or missing API key")


class FileWrite(BaseModel):
    path: str
    content: str


@app.get("/health")
async def health():
    return {"status": "ok", "service": "python-ftp", "ftp_host": FTP_HOST}


@app.get("/files")
async def list_files(path: str = Query("/", description="Directory path on FTP")):
    verify_api_key()
    ftp = get_ftp()
    try:
        ftp_path = resolve_path(path)
        ftp.cwd(ftp_path)
        entries: List[dict] = []
        lines = []
        ftp.dir(lines.append)
        for line in lines:
            parts = line.split(None, 8)
            if len(parts) < 9:
                continue
            perms = parts[0]
            name = parts[8]
            if name in ('.', '..'):
                continue
            is_dir = perms.startswith('d')
            entries.append({
                "name": name,
                "path": ftp_path.rstrip('/') + '/' + name,
                "type": "directory" if is_dir else "file",
                "size": 0,
            })
        return {"path": path, "entries": entries}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ftp.quit()


@app.get("/file")
async def read_file(path: str = Query(..., description="Remote file path")):
    verify_api_key()
    ftp = get_ftp()
    try:
        ftp_path = resolve_path(path)
        buf = io.BytesIO()
        ftp.retrbinary(f"RETR {ftp_path}", buf.write)
        content = buf.get().decode("utf-8", errors="replace")
        return {"path": ftp_path, "content": content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ftp.quit()


@app.post("/file")
async def write_file(payload: FileWrite):  # type: ignore
    verify_api_key()
    ftp = get_ftp()
    try:
        ftp_path = resolve_path(payload.path)
        data = payload.content.encode("utf-8")
        ftp.storbinary(f"STOR {ftp_path}", io.BytesIO(data))
        return {"status": "ok", "path": ftp_path, "bytes": len(data)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ftp.quit()


@app.delete("/file")
async def delete_file(path: str = Query(..., description="Remote file path")):
    verify_api_key()
    ftp = get_ftp()
    try:
        ftp_path = resolve_path(path)
        ftp.delete(ftp_path)
        return {"status": "ok", "path": ftp_path, "deleted": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        ftp.quit()
# Tauri 2 Desktop Packaging & Sovereign Sidecar Architecture

## Overview
MedScribeAI is packaged as a sovereign, self-contained desktop kiosk application using **Tauri v2** with a native Rust wrapper and a bundled Python sidecar binary (`medscribe-backend`).

This architecture guarantees 100% offline, air-gapped sovereign deployment across rural PHCs, district hospitals, and community clinics with zero external internet dependencies.

---

## 1. Architecture Topology

```
+-------------------------------------------------------------------------+
|                         MedScribeAI Desktop Host                        |
|                                                                         |
|  +---------------------------+         +-----------------------------+  |
|  |       Tauri 2 Shell       |  IPC /  |   Python Sovereign Sidecar  |  |
|  |    (Rust 1.97 / WebView)  |<------->|    (FastAPI + ONNX Runtime  |  |
|  |                           |  HTTP   |     + OpenCV + Tesseract)   |  |
|  | - React 19 Frontend       | 127.0.0.1| - ClinicalFact NLP Core     |  |
|  | - ClinicalFactStore       |  :8000  | - Indic ASR & Mel Ingestion |  |
|  | - Deterministic Safety    |         | - Physical Document OCR     |  |
|  | - Physician Approval Gate |         | - SQLite Encrypted DB       |  |
|  +---------------------------+         +-----------------------------+  |
|               |                                       |                 |
|               v                                       v                 |
|    Local System WebView                   %APPDATA%/MedScribeAI/        |
|    (Windows WebView2)                     medscribe_local.db            |
+-------------------------------------------------------------------------+
```

---

## 2. Sidecar Packaging & Lifecycle Management

### 2.1 Backend Freezing with PyInstaller
The Python backend (`backend/app/main.py`) is compiled into a standalone, single-executable binary targeting the host OS architecture:

```bash
# Windows Target (x86_64)
pyinstaller --clean --noconfirm --onedir \
  --name medscribe-backend-x86_64-pc-windows-msvc \
  --add-data "backend/app/dictionaries;app/dictionaries" \
  --hidden-import onnxruntime \
  --hidden-import cv2 \
  --hidden-import pytesseract \
  backend/app/main.py
```

The resulting executable is placed into `src-tauri/binaries/` following Tauri's target triple naming convention:
`src-tauri/binaries/medscribe-backend-<target-triple>.exe`.

### 2.2 Process Supervision
- **Startup**: On application launch, Tauri's Rust lifecycle spawns the sidecar process bound strictly to loopback interface `127.0.0.1:8000`.
- **Healthcheck Gate**: The frontend probes `GET http://127.0.0.1:8000/health` with exponential backoff before allowing kiosk transitions.
- **Graceful Termination**: On Tauri window close (`tauri::RunEvent::ExitRequested`), Tauri issues a `SIGTERM` / `WM_CLOSE` to the child process, flushing open SQLite WAL checkpoints.

---

## 3. Storage & Security Invariants
- **Localhost Isolation**: All inter-process communication is strictly restricted to `127.0.0.1` and `localhost`. External inbound connections are rejected.
- **Content Security Policy**:
  ```
  default-src 'self' http://127.0.0.1:8000 'unsafe-inline' 'unsafe-eval' data: blob:
  ```
- **Local Data Directory**:
  - Windows: `%APPDATA%/MedScribeAI/data/medscribe_local.db`
  - Linux: `~/.local/share/medscribe-ai/data/medscribe_local.db`
- **Zero Cloud Leakage**: No telemetry, analytics, or external API pings exist in the desktop runtime.

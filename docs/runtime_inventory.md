# Hardware & Runtime Inventory (Phase 8.5-A)

## Target Host Specifications
- **Operating System**: Windows 11 Enterprise / Pro (64-bit, build 26100)
- **Host Processor (CPU)**:
  - Name: Intel(R) Core(TM) Ultra 5 125H
  - Architecture: x86_64 (hybrid P-cores + E-cores + LP E-cores)
  - Physical Cores: 14
  - Logical Processors: 18
  - Instruction Extensions: AVX2, AVX-VNNI, FMA3, SSE4.2
  - Target Role: Primary host for low-latency ONNX Runtime CPU inference, Tesseract OCR, and FastAPI sidecar.
- **Graphics Processing Unit (GPU)**:
  - Name: Intel(R) Arc(TM) Graphics
  - Driver Version: 32.0.101.5542
  - Dedicated / Assigned RAM: 2,147,479,552 bytes (~2.0 GB)
  - Acceleration Interfaces: DirectML, OpenVINO, Intel oneAPI Level Zero
- **System Memory (RAM)**:
  - Total Physical Visible: 16,179,820 KB (~16.18 GB)
  - Free Physical: ~1.4 GB to 2.2 GB dynamic
  - Allocation Limit for AI Pipeline: Max 1.2 GB resident RAM across ASR, OCR, and NLP models.

## Runtime Environments
- **Python**:
  - Primary: Python 3.14.3 (64-bit)
  - Secondary / Fallback: Python 3.12.10 (64-bit, accessible via `py -3.12`)
- **Node.js**:
  - Version: v24.15.0
  - NPM: 12.0.1
- **Rust Toolchain**:
  - rustc: 1.97.1 (8bab26f4f 2026-07-14)
  - cargo: 1.97.1 (c980f4866 2026-06-30)
- **Inference Runtimes**:
  - ONNX Runtime: 1.30.0 (MIT License) — Installed in Python, CPU provider available
  - OpenCV: 5.0.0 (Apache 2.0 License) — Installed and verified active (preprocessing tested)
  - Tesseract OCR: NOT INSTALLED on host PATH (`where.exe tesseract` fails). Pytesseract is installed, but executable is UNAVAILABLE.

## Models, Sizes, Licenses, and Expected Latencies

| Subsystem | Model / Framework | Provider / Origin | License | Size on Disk | Real Status | Target Latency |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ASR (Primary)** | IndicConformer / ONNX CTC | AI4Bharat / IndicSpeech | MIT | 0 MB (Weights absent) | **UNAVAILABLE / NOT VALIDATED** | 250 - 450 ms |
| **ASR (Secondary)** | whisper.cpp (small / base) | Georgi Gerganov / OpenAI | MIT | 0 MB (Weights absent) | **UNAVAILABLE / NOT VALIDATED** | 400 - 800 ms |
| **LID (Language)** | Script & Lexical Detection | MedScribeAI Sovereign Core | Apache 2.0 | < 1 MB | **VALIDATED** | < 2 ms |
| **OCR Preprocessing**| OpenCV (CLAHE, Otsu, Deskew)| OpenCV Foundation | Apache 2.0 | Native Lib | **VALIDATED** (35-41 ms) | 15 - 45 ms |
| **OCR Extraction** | Tesseract 5.x | HP / Google / UB-Mannheim | Apache 2.0 | 0 MB (Binary absent) | **UNAVAILABLE** | 350 - 750 ms |
| **Clinical NLP** | Sovereign Fact & Negation Engine | MedScribeAI Sovereign Core | Apache 2.0 | < 10 MB | **VALIDATED** (1.7-30 ms) | < 30 ms |
| **Storage** | SQLite / Local Storage | SQLite Consortium | Public Domain | Zero binary | **VALIDATED** | < 3 ms |

## Non-Negotiable Constraint Compliance
1. **Zero Cloud Telemetry in Offline Mode**: All inference paths strictly resolve to local Python/ONNX/C++ runtimes on `127.0.0.1`.
2. **Honest Readiness Verification**: Missing model weights or binary missing from PATH report explicit `UNAVAILABLE` status. Synthetic fallback is strictly forbidden.

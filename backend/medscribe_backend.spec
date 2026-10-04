# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller specification for MedScribeAI Sovereign Backend Sidecar."""

import sys
import os

block_cipher = None
backend_dir = os.path.abspath(SPECPATH)

datas = [
    (os.path.join(backend_dir, 'app', 'asr', 'manifest.json'), os.path.join('app', 'asr')),
]

hidden_imports = [
    # Uvicorn internals
    'uvicorn',
    'uvicorn.logging',
    'uvicorn.loops',
    'uvicorn.loops.auto',
    'uvicorn.protocols',
    'uvicorn.protocols.http',
    'uvicorn.protocols.http.auto',
    'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.websockets',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan',
    'uvicorn.lifespan.on',
    'uvicorn.lifespan.off',
    # FastAPI & Starlette
    'fastapi',
    'fastapi.middleware.cors',
    'starlette',
    'starlette.routing',
    'starlette.responses',
    'starlette.middleware',
    'starlette.middleware.cors',
    'starlette.types',
    'pydantic',
    'pydantic_core',
    # Scientific & ML libraries
    'onnxruntime',
    'sherpa_onnx',
    'scipy',
    'scipy.signal',
    'numpy',
    'cv2',
    # Application subpackages
    'app',
    'app.main',
    'app.core',
    'app.core.config',
    'app.core.logging',
    'app.api',
    'app.api.routes',
    'app.api.routes.health',
    'app.api.routes.clinical',
    'app.api.routes.ocr',
    'app.api.routes.asr',
    'app.asr',
    'app.asr.engine',
    'app.asr.evaluation',
    'app.clinical',
    'app.clinical.models',
    'app.clinical.ingestion',
    'app.clinical.provenance',
    'app.clinical.evidence_gate',
    'app.clinical.benchmark_dataset',
    'app.nlp',
    'app.nlp.extractor',
    'app.nlp.language_id',
    'app.ocr',
    'app.ocr.pipeline',
    'app.safety',
    'app.safety.rules',
    'app.storage',
    'app.storage.repository',
    'app.storage.sync_engine',
]

a = Analysis(
    ['run_server.py'],
    pathex=[backend_dir],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=['pytest', 'tests', 'tkinter', 'matplotlib'],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name='medscribe-backend-x86_64-pc-windows-msvc',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

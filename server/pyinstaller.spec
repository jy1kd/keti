# -*- mode: python ; coding: utf-8 -*-
"""
PyInstaller spec file for SimNow Trading Terminal Backend

Usage:
    cd server
    pyinstaller pyinstaller.spec

Output:
    dist/simnow-backend/  (directory mode)
    dist/simnow-backend.exe  (onefile mode)
"""

import sys
from pathlib import Path

block_cipher = None

# Project root
ROOT = Path(SPECPATH)

a = Analysis(
    ['start.py'],
    pathex=[str(ROOT)],
    binaries=[],
    datas=[
        # Include .env file if exists
        (str(ROOT / '.env'), '.') if (ROOT / '.env').exists() else None,
        # Include data directory
        (str(ROOT / 'data'), 'data') if (ROOT / 'data').is_dir() else None,
    ],
    hiddenimports=[
        'ctp',
        'fastapi',
        'uvicorn',
        'websockets',
        'pydantic',
        'dotenv',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[
        'tkinter',
        'matplotlib',
        'numpy',
        'pandas',
        'scipy',
        'PIL',
        'cv2',
    ],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

# Filter None values from datas
a.datas = [d for d in a.datas if d is not None]

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

# Directory mode (recommended for debugging)
exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='simnow-backend',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='simnow-backend',
)

#!/usr/bin/env python3
"""
Build script for SimNow Trading Terminal Backend

Usage:
    python scripts/build-backend.py [options]

Options:
    --clean     Clean build directory before building
    --onefile   Build as single executable (default: directory mode)
    --debug     Build with debug symbols

Output:
    server/dist/simnow-backend/  (directory mode)
    server/dist/simnow-backend   (onefile mode)
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path


def run_command(cmd: list[str], cwd: str = None) -> int:
    """Run a command and return exit code."""
    print(f"[build] Running: {' '.join(cmd)}")
    result = subprocess.run(cmd, cwd=cwd, capture_output=False)
    return result.returncode


def clean_build(server_dir: Path) -> None:
    """Clean build artifacts."""
    dirs_to_clean = ['build', 'dist', '__pycache__']
    for dir_name in dirs_to_clean:
        dir_path = server_dir / dir_name
        if dir_path.exists():
            print(f"[build] Cleaning {dir_path}")
            shutil.rmtree(dir_path)


def build_backend(server_dir: Path, onefile: bool = False, debug: bool = False) -> int:
    """Build backend using PyInstaller."""
    # Check if pyinstaller.spec exists
    spec_file = server_dir / 'pyinstaller.spec'
    if not spec_file.exists():
        print(f"[error] pyinstaller.spec not found at {spec_file}")
        return 1

    # Build PyInstaller command
    cmd = [sys.executable, '-m', 'PyInstaller']

    if onefile:
        cmd.append('--onefile')
    else:
        cmd.append('--onedir')

    if debug:
        cmd.append('--debug=all')

    cmd.append(str(spec_file))

    # Run build
    return run_command(cmd, cwd=str(server_dir))


def main():
    parser = argparse.ArgumentParser(description='Build SimNow backend')
    parser.add_argument('--clean', action='store_true', help='Clean build directory')
    parser.add_argument('--onefile', action='store_true', help='Build as single executable')
    parser.add_argument('--debug', action='store_true', help='Build with debug symbols')
    args = parser.parse_args()

    # Get server directory
    script_dir = Path(__file__).parent
    project_dir = script_dir.parent
    server_dir = project_dir / 'server'

    if not server_dir.exists():
        print(f"[error] Server directory not found: {server_dir}")
        return 1

    print(f"[build] Server directory: {server_dir}")

    # Clean if requested
    if args.clean:
        clean_build(server_dir)

    # Check if PyInstaller is installed
    try:
        import PyInstaller
        print(f"[build] PyInstaller version: {PyInstaller.__version__}")
    except ImportError:
        print("[error] PyInstaller not installed. Run: pip install pyinstaller")
        return 1

    # Build
    exit_code = build_backend(server_dir, onefile=args.onefile, debug=args.debug)

    if exit_code == 0:
        print("[build] Build completed successfully!")
        if args.onefile:
            print(f"[build] Output: {server_dir}/dist/simnow-backend")
        else:
            print(f"[build] Output: {server_dir}/dist/simnow-backend/")
    else:
        print(f"[build] Build failed with exit code {exit_code}")

    return exit_code


if __name__ == '__main__':
    sys.exit(main())

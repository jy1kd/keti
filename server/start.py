"""Smart startup — auto-select CTP address based on time, then launch uvicorn.

Logic:
  Weekday (Mon-Fri) 09:00-16:00 → Primary addresses (real trading)
  All other times               → Secondary addresses (extended hours)

Address defaults are hardcoded; .env can override individual keys via:
  CTP_MD_FRONT_PRIMARY   CTP_TD_FRONT_PRIMARY
  CTP_MD_FRONT_SECONDARY CTP_TD_FRONT_SECONDARY

Usage:
  cd server && python start.py
  cd server && python start.py --port 8000
  cd server && python start.py --reload
"""

import os
import sys
from datetime import datetime
from pathlib import Path

# ── Hardcoded defaults (SimNow) ─────────────────────────────────────────
_DEFAULT_MD_PRIMARY = "tcp://182.254.243.31:30011"
_DEFAULT_TD_PRIMARY = "tcp://182.254.243.31:30001"
_DEFAULT_MD_SECONDARY = "tcp://182.254.243.31:40011"
_DEFAULT_TD_SECONDARY = "tcp://182.254.243.31:40001"


def _load_env_file(env_path: Path) -> dict:
    """Parse .env file into a dict. Does NOT set os.environ."""
    result = {}
    if not env_path.exists():
        return result
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                key, _, value = line.partition("=")
                result[key.strip()] = value.strip()
    return result


def select_addresses(env: dict) -> tuple:
    """Pick primary or secondary CTP addresses based on current time.

    Hardcoded defaults are used unless .env overrides a specific key.

    Returns:
        (md_front, td_front) tuple.
    """
    now = datetime.now()
    is_weekday = now.weekday() < 5  # Mon=0 .. Fri=4
    hour = now.hour

    # Primary: weekday 09:00-16:00 (exclusive 16:00, so 09:00-15:59)
    use_primary = is_weekday and 9 <= hour < 16

    if use_primary:
        md = env.get("CTP_MD_FRONT_PRIMARY") or _DEFAULT_MD_PRIMARY
        td = env.get("CTP_TD_FRONT_PRIMARY") or _DEFAULT_TD_PRIMARY
        label = "PRIMARY (real trading)"
    else:
        md = env.get("CTP_MD_FRONT_SECONDARY") or _DEFAULT_MD_SECONDARY
        td = env.get("CTP_TD_FRONT_SECONDARY") or _DEFAULT_TD_SECONDARY
        label = "SECONDARY (extended hours)"

    print(f"[start.py] {now.strftime('%Y-%m-%d %H:%M:%S')} ({now.strftime('%A')})")
    print(f"[start.py] Selected: {label}")
    print(f"[start.py]   MD_FRONT = {md}")
    print(f"[start.py]   TD_FRONT = {td}")

    return md, td


def main():
    # Load .env
    env_path = Path(__file__).parent / ".env"
    env = _load_env_file(env_path)

    # Select addresses
    md_front, td_front = select_addresses(env)

    # Set env vars (Config reads these via os.getenv)
    os.environ["CTP_MD_FRONT"] = md_front
    os.environ["CTP_TD_FRONT"] = td_front

    # Build uvicorn args (pass through any CLI args)
    uvicorn_args = ["uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"]

    # Parse extra args
    extra_args = sys.argv[1:]
    if extra_args:
        uvicorn_args.extend(extra_args)

    print(f"[start.py] Starting: {' '.join(uvicorn_args)}")
    print()

    # Run uvicorn
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, **_parse_uvicorn_kwargs(extra_args))


def _parse_uvicorn_kwargs(args: list) -> dict:
    """Parse extra CLI args into uvicorn.run() kwargs."""
    kwargs = {}
    i = 0
    while i < len(args):
        arg = args[i]
        if arg == "--reload":
            kwargs["reload"] = True
        elif arg == "--port" and i + 1 < len(args):
            i += 1
            kwargs["port"] = int(args[i])
        elif arg == "--host" and i + 1 < len(args):
            i += 1
            kwargs["host"] = args[i]
        i += 1
    return kwargs


if __name__ == "__main__":
    main()

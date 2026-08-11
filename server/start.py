"""Smart startup — auto-select CTP address based on time, then launch uvicorn.

Logic (SimNow 环境识别经 openctp 环境监控核实):
  PRIMARY   = 标准仿真环境 (tcp://182.254.243.31:30011/30001)
              —— 与实盘交易时段一致，含日盘 + 夜盘，均有行情推送。
  SECONDARY = 7x24 环境 (tcp://182.254.243.31:40011/40001)
              —— 仅在夜盘推行情；白天/周末连接成功但无行情推送。

选择规则（按真实交易时段）:
  交易时段（工作日商品日盘 + 商品/中金所夜盘）→ PRIMARY（标准仿真）
  其余时间（非交易时段/周末白天）              → SECONDARY（7x24，仅供连接调试）

商品期货日盘:  09:00-10:15 / 10:30-11:30 / 13:30-15:00（10:15-10:30 休市）
商品期货夜盘:  21:00 起，至 23:00 / 01:00 / 02:30（因品种而异）
中金所 IF/IO:  09:30-11:30 / 13:00-15:00（无夜盘）

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
from datetime import datetime, time as dtime
from pathlib import Path

# ── Hardcoded defaults (SimNow) ─────────────────────────────────────────
# PRIMARY = 标准仿真环境（与实盘时段一致，含夜盘）
_DEFAULT_MD_PRIMARY = "tcp://182.254.243.31:30011"
_DEFAULT_TD_PRIMARY = "tcp://182.254.243.31:30001"
# SECONDARY = 7x24 环境（仅夜盘推行情，白天静默）
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


def _is_commodity_trading_time(now: datetime) -> bool:
    """商品期货是否处于交易时段（日盘 + 夜盘）。

    日盘: 09:00-10:15 / 10:30-11:30 / 13:30-15:00
    夜盘: 21:00 起，至次日 02:30（最晚收盘，覆盖贵金属；多数品种更早收）
    """
    t = now.time()
    # 夜盘 21:00 之后 → 次日 02:30 之前（跨日，用 hour 判断）
    if t >= dtime(21, 0) or t < dtime(2, 30):
        return True
    # 日盘
    if dtime(9, 0) <= t < dtime(10, 15):
        return True
    if dtime(10, 30) <= t < dtime(11, 30):
        return True
    if dtime(13, 30) <= t < dtime(15, 0):
        return True
    return False


def select_addresses(env: dict) -> tuple:
    """Pick primary or secondary CTP addresses based on current time.

    PRIMARY = 标准仿真环境（与实盘一致，含夜盘，可靠推行情）
    SECONDARY = 7x24 环境（仅夜盘推行情，白天静默，仅供连接调试）

    交易时段（商品日盘 + 商品/中金所夜盘）→ PRIMARY；
    非交易时段 → SECONDARY（此时连接成功但无行情推送属正常）。

    Hardcoded defaults are used unless .env overrides a specific key.

    Returns:
        (md_front, td_front) tuple.
    """
    now = datetime.now()
    is_weekday = now.weekday() < 5  # Mon=0 .. Fri=4
    # 周末：商品日盘无交易；夜盘（周一至周五晚 21:00 后）按交易时段处理。
    # 周末白天/凌晨一律 7x24（无行情属正常）。
    use_primary = is_weekday and _is_commodity_trading_time(now)

    if use_primary:
        md = env.get("CTP_MD_FRONT_PRIMARY") or _DEFAULT_MD_PRIMARY
        td = env.get("CTP_TD_FRONT_PRIMARY") or _DEFAULT_TD_PRIMARY
        label = "PRIMARY (标准仿真环境，与实盘一致)"
    else:
        md = env.get("CTP_MD_FRONT_SECONDARY") or _DEFAULT_MD_SECONDARY
        td = env.get("CTP_TD_FRONT_SECONDARY") or _DEFAULT_TD_SECONDARY
        label = "SECONDARY (7x24 环境，非交易时段无行情属正常)"

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

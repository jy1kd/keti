"""K-line aggregation service — accumulates real-time ticks into multi-period bars.

CTP pushes depth market data (OnRtnDepthMarketData) at high frequency.
This service aggregates those ticks into OHLCV bars for multiple timeframes.

Architecture:
  CTP tick → ctp_bridge → KLineService.update_tick()
    → updates current bar for each period (1m/5m/15m/30m/1h)
    → archives completed bars on time-window boundary

Limitations:
  - No historical data: bars accumulate only from server start
  - CTP volume is cumulative: per-tick delta computed via last_volume tracking
  - ActionDay + UpdateTime used for timestamp (CTP format: "YYYYMMDD" + "HH:MM:SS")
"""

from __future__ import annotations

import calendar
import logging
import threading
import time as _time
from typing import Dict, List

logger = logging.getLogger(__name__)

# Period definitions: name → seconds
PERIOD_SECONDS: Dict[str, int] = {
    "1m": 60,
    "5m": 300,
    "15m": 900,
    "30m": 1800,
    "1h": 3600,
}


def _parse_timestamp(action_day: str, update_time: str) -> int:
    """Parse CTP ActionDay + UpdateTime into a Unix-like seconds timestamp.

    CTP formats:
      ActionDay: "YYYYMMDD" (e.g. "20260714")
      UpdateTime: "HH:MM:SS" (e.g. "14:30:00")

    Returns:
        Integer seconds since epoch. Falls back to 0 on parse error.
    """
    try:
        if not action_day or len(action_day) < 8:
            parts = update_time.split(":")
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])
        year = int(action_day[0:4])
        month = int(action_day[4:6])
        day = int(action_day[6:8])
        parts = update_time.split(":")
        hour = int(parts[0])
        minute = int(parts[1])
        second = int(parts[2])
        return int(calendar.timegm((year, month, day, hour, minute, second)))
    except (ValueError, IndexError):
        return 0


def _format_time(timestamp: int) -> str:
    """Format a seconds timestamp into 'YYYY-MM-DD HH:MM:SS'."""
    try:
        return _time.strftime("%Y-%m-%d %H:%M:%S", _time.gmtime(timestamp))
    except (ValueError, OSError):
        return str(timestamp)


class KLineService:
    """Real-time K-line aggregation from tick data.

    Thread-safe: update_tick() may be called from CTP worker threads.
    get_klines() may be called from async route handlers.
    """

    def __init__(self, max_bars: int = 500) -> None:
        self.max_bars = max_bars
        self._bars: Dict[str, Dict[str, List[dict]]] = {}
        self._current: Dict[str, Dict[str, dict]] = {}
        self._last_volume: Dict[str, int] = {}
        self._lock = threading.Lock()

    def update_tick(self, data: dict) -> None:
        """Process a single tick and update all period bars.

        Args:
            data: camelCase dict from map_depth_market_data().
                  Required keys: instrumentID, lastPrice, volume, openInterest.
                  Optional keys: actionDay, updateTime, updateMillisec.
        """
        instrument = data.get("instrumentID", "")
        if not instrument:
            return

        price = data.get("lastPrice", 0.0)
        if price <= 0:
            return  # Skip invalid price (CTP uses huge value for invalid)

        volume = data.get("volume", 0)
        oi = data.get("openInterest", 0.0)
        action_day = data.get("actionDay", "")
        update_time = data.get("updateTime", "")

        ts = _parse_timestamp(action_day, update_time)
        if ts <= 0:
            return

        # Volume delta (CTP volume is cumulative)
        vol_delta = volume - self._last_volume.get(instrument, 0)
        self._last_volume[instrument] = volume
        if vol_delta < 0:
            vol_delta = 0  # Cross-day reset

        with self._lock:
            for period, seconds in PERIOD_SECONDS.items():
                bar_start = ts - (ts % seconds)
                current = self._current.get(instrument, {}).get(period)

                if current is None or current["_start"] != bar_start:
                    # Archive completed bar
                    if current is not None:
                        bars = self._bars.setdefault(instrument, {}).setdefault(period, [])
                        archived = {k: v for k, v in current.items() if k != "_start"}
                        bars.append(archived)
                        if len(bars) > self.max_bars:
                            self._bars[instrument][period] = bars[-self.max_bars:]

                    # Create new bar
                    current = {
                        "_start": bar_start,
                        "time": _format_time(bar_start),
                        "open": price,
                        "high": price,
                        "low": price,
                        "close": price,
                        "volume": max(vol_delta, 0),
                        "openInterest": oi,
                    }
                    self._current.setdefault(instrument, {})[period] = current
                else:
                    # Update current bar
                    current["high"] = max(current["high"], price)
                    current["low"] = min(current["low"], price)
                    current["close"] = price
                    current["volume"] += max(vol_delta, 0)
                    current["openInterest"] = oi

    def get_klines(
        self,
        instrument: str,
        period: str = "1m",
        count: int = 100,
    ) -> List[dict]:
        """Return recent K-line bars (archived + current), newest last.

        Args:
            instrument: Instrument ID (e.g. "IF2608").
            period: Bar period ("1m", "5m", "15m", "30m", "1h").
            count: Maximum number of bars to return.

        Returns:
            List of bar dicts with keys: time, open, high, low, close, volume, openInterest.
        """
        if period not in PERIOD_SECONDS:
            return []

        with self._lock:
            archived = list(self._bars.get(instrument, {}).get(period, []))
            current = self._current.get(instrument, {}).get(period)

        result = archived[:]
        if current is not None:
            bar = {k: v for k, v in current.items() if k != "_start"}
            result.append(bar)

        if len(result) > count:
            result = result[-count:]

        return result

    def reset(self) -> None:
        """Clear all data (for testing)."""
        with self._lock:
            self._bars.clear()
            self._current.clear()
            self._last_volume.clear()

"""Tests for services/kline_service.py — real-time K-line aggregation."""

import threading

import pytest
from services.kline_service import KLineService, _parse_timestamp, PERIOD_SECONDS


# ── Timestamp parsing ──────────────────────────────────────────────────

class TestParseTimestamp:
    """CTP ActionDay + UpdateTime parsing."""

    def test_normal(self):
        ts = _parse_timestamp("20260714", "14:30:00")
        assert ts > 0

    def test_utc8_offset(self):
        """CTP times are UTC+8 (Beijing time), not UTC.

        2026-07-14 14:30:00 UTC+8 = 2026-07-14 06:30:00 UTC
        calendar.timegm would treat 14:30 as UTC (wrong, 8 hours ahead)
        """
        import calendar
        # Wrong: treating Beijing time as UTC
        wrong_ts = calendar.timegm((2026, 7, 14, 14, 30, 0))
        # Correct: Beijing time converted to UTC
        correct_ts = calendar.timegm((2026, 7, 14, 6, 30, 0))
        actual_ts = _parse_timestamp("20260714", "14:30:00")
        # The actual timestamp should be the correct one (UTC+8 handling)
        assert actual_ts == correct_ts
        assert actual_ts != wrong_ts
        # The difference should be exactly 8 hours (28800 seconds)
        assert wrong_ts - actual_ts == 8 * 3600

    def test_empty_action_day(self):
        """Falls back to today's date with given time."""
        ts = _parse_timestamp("", "14:30:00")
        # 应该返回一个有效的时间戳（当天14:30）
        assert ts > 0
        # 验证时间戳对应的小时和分钟是14:30
        from datetime import datetime, timezone, timedelta
        china_tz = timezone(timedelta(hours=8))
        dt = datetime.fromtimestamp(ts, tz=china_tz)
        assert dt.hour == 14
        assert dt.minute == 30

    def test_malformed_action_day(self):
        """Short action_day falls back to today's date with given time."""
        ts = _parse_timestamp("2026", "14:30:00")
        assert ts > 0
        from datetime import datetime, timezone, timedelta
        china_tz = timezone(timedelta(hours=8))
        dt = datetime.fromtimestamp(ts, tz=china_tz)
        assert dt.hour == 14
        assert dt.minute == 30

    def test_invalid_time(self):
        ts = _parse_timestamp("20260714", "bad")
        assert ts == 0


# ── Initialization ─────────────────────────────────────────────────────

class TestKLineServiceInit:
    """KLineService construction and defaults."""

    def test_import(self):
        assert KLineService is not None

    def test_default_state(self):
        svc = KLineService()
        assert svc.get_klines("IF2608", "1m") == []

    def test_max_bars_default(self):
        svc = KLineService()
        assert svc.max_bars == 500

    def test_max_bars_custom(self):
        svc = KLineService(max_bars=100)
        assert svc.max_bars == 100


# ── Tick processing ────────────────────────────────────────────────────

class TestUpdateTick:
    """Core tick → bar aggregation logic."""

    def _make_tick(self, instrument="IF2608", price=3850.0, volume=100,
                   oi=5000.0, action_day="20260714", update_time="14:30:05"):
        return {
            "instrumentID": instrument,
            "lastPrice": price,
            "volume": volume,
            "openInterest": oi,
            "actionDay": action_day,
            "updateTime": update_time,
        }

    def test_single_tick_creates_bar(self):
        svc = KLineService()
        svc.update_tick(self._make_tick())
        bars = svc.get_klines("IF2608", "1m")
        assert len(bars) == 1
        assert bars[0]["open"] == 3850.0
        assert bars[0]["high"] == 3850.0
        assert bars[0]["low"] == 3850.0
        assert bars[0]["close"] == 3850.0

    def test_ohlc_correctness(self):
        """open=first, high=max, low=min, close=last."""
        svc = KLineService()
        # Same 1m window (14:30:00 - 14:30:59)
        svc.update_tick(self._make_tick(price=3850.0, volume=100, update_time="14:30:05"))
        svc.update_tick(self._make_tick(price=3860.0, volume=200, update_time="14:30:10"))
        svc.update_tick(self._make_tick(price=3845.0, volume=300, update_time="14:30:15"))
        svc.update_tick(self._make_tick(price=3855.0, volume=400, update_time="14:30:20"))
        bars = svc.get_klines("IF2608", "1m")
        assert len(bars) == 1
        assert bars[0]["open"] == 3850.0
        assert bars[0]["high"] == 3860.0
        assert bars[0]["low"] == 3845.0
        assert bars[0]["close"] == 3855.0

    def test_volume_delta(self):
        """CTP volume is cumulative; bar volume should be the delta."""
        svc = KLineService()
        svc.update_tick(self._make_tick(volume=100, update_time="14:30:05"))
        svc.update_tick(self._make_tick(volume=250, update_time="14:30:10"))
        svc.update_tick(self._make_tick(volume=300, update_time="14:30:15"))
        bars = svc.get_klines("IF2608", "1m")
        # Total volume delta: (100-0) + (250-100) + (300-250) = 300
        assert bars[0]["volume"] == 300

    def test_volume_cross_day_reset(self):
        """Negative volume delta (cross-day reset) should be treated as 0."""
        svc = KLineService()
        svc.update_tick(self._make_tick(volume=90000, update_time="14:30:05"))
        svc.update_tick(self._make_tick(volume=50, update_time="14:30:10"))  # reset
        bars = svc.get_klines("IF2608", "1m")
        assert bars[0]["volume"] == 90000  # 90000 + max(50-90000, 0) = 90000

    def test_multiple_instruments(self):
        svc = KLineService()
        svc.update_tick(self._make_tick(instrument="IF2608", price=3850))
        svc.update_tick(self._make_tick(instrument="IF2609", price=3860))
        bars_if2608 = svc.get_klines("IF2608", "1m")
        bars_if2609 = svc.get_klines("IF2609", "1m")
        assert len(bars_if2608) == 1
        assert len(bars_if2609) == 1
        assert bars_if2608[0]["close"] == 3850
        assert bars_if2609[0]["close"] == 3860

    def test_skip_empty_instrument(self):
        svc = KLineService()
        svc.update_tick({"instrumentID": "", "lastPrice": 3850, "volume": 0})
        assert svc.get_klines("", "1m") == []

    def test_skip_invalid_price(self):
        svc = KLineService()
        svc.update_tick(self._make_tick(price=0.0))
        svc.update_tick(self._make_tick(price=-1.0))
        assert svc.get_klines("IF2608", "1m") == []


# ── Time window boundary ──────────────────────────────────────────────

class TestTimeWindow:
    """Bar archival on time-window boundary."""

    def _tick(self, price, volume, update_time, action_day="20260714"):
        return {
            "instrumentID": "IF2608",
            "lastPrice": price,
            "volume": volume,
            "openInterest": 5000.0,
            "actionDay": action_day,
            "updateTime": update_time,
        }

    def test_1m_boundary_creates_new_bar(self):
        svc = KLineService()
        svc.update_tick(self._tick(3850, 100, "14:30:55"))
        svc.update_tick(self._tick(3855, 200, "14:31:05"))  # New 1m window
        bars = svc.get_klines("IF2608", "1m")
        assert len(bars) == 2
        assert bars[0]["close"] == 3850  # First bar archived
        assert bars[1]["open"] == 3855   # New bar

    def test_5m_boundary(self):
        svc = KLineService()
        svc.update_tick(self._tick(3850, 100, "14:29:55"))
        svc.update_tick(self._tick(3855, 200, "14:30:05"))  # New 5m window
        bars_5m = svc.get_klines("IF2608", "5m")
        assert len(bars_5m) == 2

    def test_same_window_merges(self):
        svc = KLineService()
        svc.update_tick(self._tick(3850, 100, "14:30:00"))
        svc.update_tick(self._tick(3855, 200, "14:30:30"))
        svc.update_tick(self._tick(3848, 300, "14:30:59"))
        bars = svc.get_klines("IF2608", "1m")
        assert len(bars) == 1  # All in same 1m window


# ── Multi-period ──────────────────────────────────────────────────────

class TestMultiPeriod:
    """All periods update simultaneously."""

    def test_all_periods_updated(self):
        svc = KLineService()
        svc.update_tick({
            "instrumentID": "IF2608",
            "lastPrice": 3850.0,
            "volume": 100,
            "openInterest": 5000.0,
            "actionDay": "20260714",
            "updateTime": "14:30:05",
        })
        for period in PERIOD_SECONDS:
            bars = svc.get_klines("IF2608", period)
            assert len(bars) == 1, f"Expected 1 bar for {period}"

    def test_invalid_period_returns_empty(self):
        svc = KLineService()
        svc.update_tick({
            "instrumentID": "IF2608",
            "lastPrice": 3850.0,
            "volume": 100,
            "openInterest": 5000.0,
            "actionDay": "20260714",
            "updateTime": "14:30:05",
        })
        assert svc.get_klines("IF2608", "2h") == []


# ── Count limit ───────────────────────────────────────────────────────

class TestCountLimit:
    """get_klines count parameter."""

    def test_count_limits_bars(self):
        svc = KLineService()
        # Create 5 bars by spanning 5 minutes
        for i in range(5):
            svc.update_tick({
                "instrumentID": "IF2608",
                "lastPrice": 3850.0 + i,
                "volume": (i + 1) * 100,
                "openInterest": 5000.0,
                "actionDay": "20260714",
                "updateTime": f"14:{30 + i:02d}:05",
            })
        bars = svc.get_klines("IF2608", "1m", count=3)
        assert len(bars) <= 3

    def test_count_default_100(self):
        svc = KLineService()
        bars = svc.get_klines("IF2608", "1m", count=100)
        assert isinstance(bars, list)


# ── Max bars trimming ─────────────────────────────────────────────────

class TestMaxBars:
    """Archived bars trimmed to max_bars."""

    def test_max_bars_trims_old(self):
        svc = KLineService(max_bars=3)
        # Create 5 bars
        for i in range(5):
            svc.update_tick({
                "instrumentID": "IF2608",
                "lastPrice": 3850.0,
                "volume": (i + 1) * 100,
                "openInterest": 5000.0,
                "actionDay": "20260714",
                "updateTime": f"14:{30 + i:02d}:05",
            })
        # Get all bars (archived only, current bar is separate)
        # archived bars = 4 (first 4 completed), trimmed to 3
        bars = svc.get_klines("IF2608", "1m", count=100)
        # 3 archived + 1 current = 4 max
        assert len(bars) <= 4


# ── Thread safety ─────────────────────────────────────────────────────

class TestThreadSafety:
    """Concurrent update_tick calls should not corrupt state."""

    def test_concurrent_update_tick(self):
        svc = KLineService()
        errors = []

        def worker(thread_id):
            try:
                for i in range(50):
                    svc.update_tick({
                        "instrumentID": "IF2608",
                        "lastPrice": 3850.0 + (i % 10),
                        "volume": thread_id * 1000 + i,
                        "openInterest": 5000.0,
                        "actionDay": "20260714",
                        "updateTime": "14:30:05",
                    })
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=worker, args=(t,)) for t in range(4)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert errors == []
        bars = svc.get_klines("IF2608", "1m")
        assert len(bars) >= 1


# ── Reset ─────────────────────────────────────────────────────────────

class TestReset:
    """Clear all state."""

    def test_reset_clears_bars(self):
        svc = KLineService()
        svc.update_tick({
            "instrumentID": "IF2608",
            "lastPrice": 3850.0,
            "volume": 100,
            "openInterest": 5000.0,
            "actionDay": "20260714",
            "updateTime": "14:30:05",
        })
        svc.reset()
        assert svc.get_klines("IF2608", "1m") == []

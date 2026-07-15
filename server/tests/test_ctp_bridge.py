"""Tests for services/ctp_bridge.py — CTP callback → MarketService → WebSocket."""

import pytest

from services.market_service import MarketService
from ctp_wrapper.callback import MdSpi


# ── Fake CTP data object ──────────────────────────────────────────────────

class _FakeCtpDepthData:
    """Fake CTP CThostFtdcDepthMarketDataField — duck-types the attributes
    expected by map_depth_market_data(). Only sets what the test cares about;
    missing attributes get defaults from the field mapping table."""

    def __init__(self, instrument_id: str = "IF2608", last_price: float = 3850.0):
        self.InstrumentID = instrument_id
        self.LastPrice = last_price
        self.OpenPrice = 3845.0
        self.HighestPrice = 3855.0
        self.LowestPrice = 3840.0
        self.Volume = 12345
        self.Turnover = 47500000.0
        self.OpenInterest = 67890.0
        self.BidPrice1 = 3849.8
        self.BidVolume1 = 10
        self.AskPrice1 = 3850.2
        self.AskVolume1 = 5
        self.UpdateTime = "14:30:00"
        self.UpdateMillisec = 500
        # All other fields use getattr() default from field_mapping


# ── Broadcast spy ─────────────────────────────────────────────────────────

class _BroadcastSpy:
    """Records calls to the broadcast function for test assertions."""

    def __init__(self):
        self.calls: list = []

    def __call__(self, data: dict) -> None:
        self.calls.append(data)


# ── Tests ─────────────────────────────────────────────────────────────────

class TestWireMarketDataCallback:
    """Integration: wire CTP callback → MarketService → broadcast."""

    def test_import(self):
        """ctp_bridge module should be importable."""
        from services import ctp_bridge  # noqa: F401
        assert ctp_bridge is not None

    def test_wire_registers_handler_on_spi(self):
        """wire_market_data_callback registers an OnRtnDepthMarketData handler."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()

        wire_market_data_callback(spi, svc)

        # After wiring, the handler should be registered
        assert "OnRtnDepthMarketData" in spi._handlers

    def test_ctp_callback_updates_snapshot(self):
        """When CTP OnRtnDepthMarketData fires, snapshot cache is updated."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()
        wire_market_data_callback(spi, svc)

        # Simulate CTP callback
        fake_data = _FakeCtpDepthData("IF2608", 3850.0)
        spi.OnRtnDepthMarketData(fake_data)

        # Snapshot should now contain the instrument
        snap = svc.get_snapshot("IF2608")
        assert snap is not None
        assert snap["instrumentID"] == "IF2608"
        assert snap["lastPrice"] == 3850.0

    def test_ctp_callback_preserves_field_mapping(self):
        """Mapped snapshot uses camelCase keys, not PascalCase."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()
        wire_market_data_callback(spi, svc)

        fake_data = _FakeCtpDepthData("IF2608", 3850.0)
        spi.OnRtnDepthMarketData(fake_data)

        snap = svc.get_snapshot("IF2608")

        # Verify camelCase keys (mapped)
        assert "instrumentID" in snap
        assert "lastPrice" in snap
        assert "openPrice" in snap
        assert "bidPrice1" in snap
        assert "askPrice1" in snap

        # Verify PascalCase keys are NOT present (fully mapped)
        assert "InstrumentID" not in snap
        assert "LastPrice" not in snap

    def test_ctp_callback_broadcasts_data(self):
        """When CTP callback fires, the broadcast function is called."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()
        spy = _BroadcastSpy()

        wire_market_data_callback(spi, svc, broadcast_fn=spy)

        fake_data = _FakeCtpDepthData("IF2608", 3850.0)
        spi.OnRtnDepthMarketData(fake_data)

        # Broadcast should have been called exactly once
        assert len(spy.calls) == 1
        broadcasted = spy.calls[0]
        assert broadcasted["instrumentID"] == "IF2608"
        assert broadcasted["lastPrice"] == 3850.0

    def test_ctp_callback_missing_instrument_id(self):
        """CTP data with empty instrumentID should not crash."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()
        spy = _BroadcastSpy()

        wire_market_data_callback(spi, svc, broadcast_fn=spy)

        # Create data with empty InstrumentID
        fake_data = _FakeCtpDepthData("", 0.0)
        fake_data.InstrumentID = ""
        spi.OnRtnDepthMarketData(fake_data)

        # Should not crash, snapshot should not be added
        assert svc.snapshot_count == 0
        # Broadcast should still fire (data includes instrumentID="")
        assert len(spy.calls) == 1

    def test_ctp_callback_merges_snapshots(self):
        """Repeated callbacks for the same instrument merge data."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()
        wire_market_data_callback(spi, svc)

        # First callback sets initial data
        data1 = _FakeCtpDepthData("IF2608", 3850.0)
        spi.OnRtnDepthMarketData(data1)

        # Second callback updates the price
        data2 = _FakeCtpDepthData("IF2608", 3900.0)
        data2.OpenPrice = 3855.0  # Changed open
        spi.OnRtnDepthMarketData(data2)

        snap = svc.get_snapshot("IF2608")
        assert snap["lastPrice"] == 3900.0  # Updated
        assert snap["openPrice"] == 3855.0  # Updated
        assert snap["highestPrice"] == 3855.0  # Preserved from first
        assert snap["volume"] == 12345  # Preserved from first

    def test_wire_without_broadcast_fn(self):
        """Wiring without broadcast_fn should not crash on callback."""
        from services.ctp_bridge import wire_market_data_callback

        spi = MdSpi()
        svc = MarketService()

        # No broadcast_fn — should not fail
        wire_market_data_callback(spi, svc)

        fake_data = _FakeCtpDepthData("IF2608", 3850.0)
        spi.OnRtnDepthMarketData(fake_data)

        # Snapshot still updated
        assert svc.get_snapshot("IF2608") is not None

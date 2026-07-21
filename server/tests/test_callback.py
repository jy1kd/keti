"""Tests for ctp/callback.py — callback handling framework."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ctp_wrapper.callback import MdSpi, TraderSpi


class TestMdSpi:
    """Market data SPI callback tests."""

    def test_instantiation(self):
        """MdSpi should be instantiable with an api reference."""
        spi = MdSpi(api=None)
        assert spi is not None

    def test_stores_api_reference(self):
        mock_api = object()
        spi = MdSpi(api=mock_api)
        assert spi.api is mock_api

    def test_on_front_connected_exists(self):
        """OnFrontConnected should be a callable method."""
        spi = MdSpi(api=None)
        assert hasattr(spi, "OnFrontConnected")
        assert callable(spi.OnFrontConnected)

    def test_on_front_disconnected_exists(self):
        """OnFrontDisconnected should exist."""
        spi = MdSpi(api=None)
        assert hasattr(spi, "OnFrontDisconnected")
        assert callable(spi.OnFrontDisconnected)

    def test_on_rsp_user_login_exists(self):
        """OnRspUserLogin should exist."""
        spi = MdSpi(api=None)
        assert hasattr(spi, "OnRspUserLogin")
        assert callable(spi.OnRspUserLogin)

    def test_on_rsp_sub_market_data_exists(self):
        """OnRspSubMarketData should exist."""
        spi = MdSpi(api=None)
        assert hasattr(spi, "OnRspSubMarketData")
        assert callable(spi.OnRspSubMarketData)

    def test_on_rtn_depth_market_data_exists(self):
        """OnRtnDepthMarketData should exist."""
        spi = MdSpi(api=None)
        assert hasattr(spi, "OnRtnDepthMarketData")
        assert callable(spi.OnRtnDepthMarketData)

    def test_on_rsp_error_exists(self):
        """OnRspError should exist."""
        spi = MdSpi(api=None)
        assert hasattr(spi, "OnRspError")
        assert callable(spi.OnRspError)

    def test_on_front_connected_default_behavior(self):
        """Default OnFrontConnected should be safe to call (no crash)."""
        spi = MdSpi(api=None)
        # Should not raise when called with no arguments
        try:
            spi.OnFrontConnected()
            called = True
        except Exception:
            called = False
        assert called, "OnFrontConnected() should not raise"


class TestTraderSpi:
    """Trading SPI callback tests."""

    def test_instantiation(self):
        spi = TraderSpi(api=None)
        assert spi is not None

    def test_stores_api_reference(self):
        mock_api = object()
        spi = TraderSpi(api=mock_api)
        assert spi.api is mock_api

    def test_on_front_connected_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnFrontConnected")
        assert callable(spi.OnFrontConnected)

    def test_on_front_disconnected_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnFrontDisconnected")
        assert callable(spi.OnFrontDisconnected)

    def test_on_rsp_user_login_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspUserLogin")
        assert callable(spi.OnRspUserLogin)

    def test_on_rtn_order_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRtnOrder")
        assert callable(spi.OnRtnOrder)

    def test_on_rtn_trade_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRtnTrade")
        assert callable(spi.OnRtnTrade)

    def test_on_rsp_order_insert_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspOrderInsert")
        assert callable(spi.OnRspOrderInsert)

    def test_on_rsp_order_action_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspOrderAction")
        assert callable(spi.OnRspOrderAction)

    def test_on_rsp_error_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspError")
        assert callable(spi.OnRspError)

    def test_callback_defaults_do_not_crash(self):
        """Default callback implementations should not raise."""
        spi = TraderSpi(api=None)
        # (method_name, args_tuple)
        call_map = [
            ("OnFrontConnected", ()),
            ("OnFrontDisconnected", (0,)),
            ("OnRspUserLogin", (None, None, 0, True)),
            ("OnRtnOrder", (None,)),
            ("OnRtnTrade", (None,)),
            ("OnRspOrderInsert", (None, None, 0, True)),
            ("OnRspOrderAction", (None, None, 0, True)),
            ("OnRspError", (None, 0, True)),
            ("OnRspQryInstrument", (None, None, 0, True)),
        ]
        for method_name, args in call_map:
            method = getattr(spi, method_name)
            try:
                method(*args)
                ok = True
            except Exception:
                ok = False
            assert ok, f"{method_name}{args} should not raise"


class TestCallbackLogging:
    """Test that callbacks record events for debugging."""

    def test_md_spi_has_log_events(self):
        spi = MdSpi(api=None)
        # Callbacks should record what happened for debugging
        assert hasattr(spi, "events")
        assert isinstance(spi.events, list)

    def test_trader_spi_has_log_events(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "events")
        assert isinstance(spi.events, list)

    def test_callback_logs_event(self):
        spi = MdSpi(api=None)
        spi.OnFrontConnected()
        assert len(spi.events) > 0
        assert spi.events[-1]["type"] == "OnFrontConnected"

    def test_callback_event_has_timestamp(self):
        spi = MdSpi(api=None)
        spi.OnFrontConnected()
        assert "timestamp" in spi.events[-1]


# ── OnRspQryInstrument callback tests (PR-19) ──────────────────────────

class TestTraderSpiQryInstrument:
    """Test OnRspQryInstrument callback on TraderSpi."""

    def test_on_rsp_qry_instrument_exists(self):
        """OnRspQryInstrument should be a callable method."""
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspQryInstrument")
        assert callable(spi.OnRspQryInstrument)

    def test_on_rsp_qry_instrument_logs_event(self):
        """OnRspQryInstrument should log the event."""
        spi = TraderSpi(api=None)
        spi.OnRspQryInstrument(None, None, 0, True)
        assert len(spi.events) > 0
        assert spi.events[-1]["type"] == "OnRspQryInstrument"

    def test_on_rsp_qry_instrument_dispatches_handler(self):
        """OnRspQryInstrument should dispatch to registered handler."""
        spi = TraderSpi(api=None)
        received = []
        spi.on("OnRspQryInstrument", lambda *args: received.append(args))
        mock_instrument = {"InstrumentID": "IF2608"}
        spi.OnRspQryInstrument(mock_instrument, None, 1, True)
        assert len(received) == 1
        assert received[0] == (mock_instrument, None, 1, True)

    def test_on_rsp_qry_instrument_default_does_not_crash(self):
        """Default OnRspQryInstrument should not raise."""
        spi = TraderSpi(api=None)
        try:
            spi.OnRspQryInstrument(None, None, 0, True)
            ok = True
        except Exception:
            ok = False
        assert ok


# ── Query callback tests (PR-11) ────────────────────────────────────────


class TestTraderSpiQueryCallbacks:
    """Test OnRspQryOrder, OnRspQryTrade, OnRspQryInvestorPosition,
    OnRspQryTradingAccount callbacks on TraderSpi."""

    def test_on_rsp_qry_order_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspQryOrder")
        assert callable(spi.OnRspQryOrder)

    def test_on_rsp_qry_trade_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspQryTrade")
        assert callable(spi.OnRspQryTrade)

    def test_on_rsp_qry_position_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspQryInvestorPosition")
        assert callable(spi.OnRspQryInvestorPosition)

    def test_on_rsp_qry_account_exists(self):
        spi = TraderSpi(api=None)
        assert hasattr(spi, "OnRspQryTradingAccount")
        assert callable(spi.OnRspQryTradingAccount)

    def test_on_rsp_qry_order_logs_event(self):
        spi = TraderSpi(api=None)
        spi.OnRspQryOrder(None, None, 0, True)
        assert any(e["type"] == "OnRspQryOrder" for e in spi.events)

    def test_on_rsp_qry_trade_logs_event(self):
        spi = TraderSpi(api=None)
        spi.OnRspQryTrade(None, None, 0, True)
        assert any(e["type"] == "OnRspQryTrade" for e in spi.events)

    def test_on_rsp_qry_position_logs_event(self):
        spi = TraderSpi(api=None)
        spi.OnRspQryInvestorPosition(None, None, 0, True)
        assert any(e["type"] == "OnRspQryInvestorPosition" for e in spi.events)

    def test_on_rsp_qry_account_logs_event(self):
        spi = TraderSpi(api=None)
        spi.OnRspQryTradingAccount(None, None, 0, True)
        assert any(e["type"] == "OnRspQryTradingAccount" for e in spi.events)

    def test_on_rsp_qry_order_dispatches_handler(self):
        spi = TraderSpi(api=None)
        received = []
        spi.on("OnRspQryOrder", lambda *args: received.append(args))
        mock_order = {"OrderRef": "1"}
        spi.OnRspQryOrder(mock_order, None, 1, True)
        assert len(received) == 1
        assert received[0] == (mock_order, None, 1, True)

    def test_on_rsp_qry_trade_dispatches_handler(self):
        spi = TraderSpi(api=None)
        received = []
        spi.on("OnRspQryTrade", lambda *args: received.append(args))
        mock_trade = {"TradeID": "T1"}
        spi.OnRspQryTrade(mock_trade, None, 1, True)
        assert len(received) == 1
        assert received[0] == (mock_trade, None, 1, True)

    def test_on_rsp_qry_position_dispatches_handler(self):
        spi = TraderSpi(api=None)
        received = []
        spi.on("OnRspQryInvestorPosition", lambda *args: received.append(args))
        mock_pos = {"InstrumentID": "IF2608"}
        spi.OnRspQryInvestorPosition(mock_pos, None, 1, True)
        assert len(received) == 1
        assert received[0] == (mock_pos, None, 1, True)

    def test_on_rsp_qry_account_dispatches_handler(self):
        spi = TraderSpi(api=None)
        received = []
        spi.on("OnRspQryTradingAccount", lambda *args: received.append(args))
        mock_acc = {"AccountID": "user001"}
        spi.OnRspQryTradingAccount(mock_acc, None, 1, True)
        assert len(received) == 1
        assert received[0] == (mock_acc, None, 1, True)

    def test_query_callbacks_in_defaults_do_not_crash(self):
        """All query callbacks should be safe to call with defaults."""
        spi = TraderSpi(api=None)
        call_map = [
            ("OnRspQryOrder", (None, None, 0, True)),
            ("OnRspQryTrade", (None, None, 0, True)),
            ("OnRspQryInvestorPosition", (None, None, 0, True)),
            ("OnRspQryTradingAccount", (None, None, 0, True)),
        ]
        for method_name, args in call_map:
            method = getattr(spi, method_name)
            try:
                method(*args)
                ok = True
            except Exception:
                ok = False
            assert ok, f"{method_name}{args} should not raise"

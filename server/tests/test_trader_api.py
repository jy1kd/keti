"""Tests for ctp/trader_api.py — Trading API wrapper."""

import re
import sys
import os
from unittest.mock import Mock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import Config
from ctp_wrapper.trader_api import TraderApi
from ctp_wrapper.types import (
    Direction,
    OffsetFlag,
    OrderPriceType,
    TimeCondition,
    VolumeCondition,
    CombHedgeFlag,
    ContingentCondition,
    ForceCloseReason,
)


# ── Mock ctp module helpers ────────────────────────────────────────────

def _mock_ctp_module():
    """Create a mock ctp module and inject into sys.modules."""
    ctp_mock = MagicMock()
    # Provide the classes that trader_api.py instantiates
    ctp_mock.CThostFtdcTraderApi.CreateFtdcTraderApi.return_value = Mock()
    ctp_mock.CThostFtdcReqUserLoginField.return_value = Mock()
    ctp_mock.CThostFtdcInputOrderField.return_value = Mock()
    ctp_mock.CThostFtdcInputOrderActionField.return_value = Mock()
    sys.modules["ctp"] = ctp_mock
    return ctp_mock


def _unmock_ctp():
    """Remove mock ctp from sys.modules."""
    sys.modules.pop("ctp", None)


# ── Construction tests ─────────────────────────────────────────────────

class TestTraderApiConstruction:
    """Test TraderApi instantiation and defaults."""

    def test_import_trader_api(self):
        assert TraderApi is not None

    def test_instantiation_stores_config(self):
        cfg = Config()
        api = TraderApi(cfg)
        assert api.config is cfg

    def test_instantiation_creates_spi(self):
        api = TraderApi(Config())
        assert api.spi is not None

    def test_connection_status_defaults(self):
        api = TraderApi(Config())
        assert api.connection_status == "disconnected"

    def test_login_status_defaults(self):
        api = TraderApi(Config())
        assert api.login_status == "not_logged_in"

    def test_order_ref_defaults_to_zero(self):
        api = TraderApi(Config())
        assert api.order_ref == 0

    def test_callback_event_recording(self):
        api = TraderApi(Config())
        api.spi.OnFrontConnected()
        assert len(api.spi.events) > 0
        assert api.spi.events[-1]["type"] == "OnFrontConnected"


# ── Insert order tests ─────────────────────────────────────────────────

class TestInsertOrder:
    """Test insert_order with mocked ctp module."""

    @staticmethod
    def _make_api(req_order_return=0):
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderInsert.return_value = req_order_return
        return api

    def teardown_method(self):
        _unmock_ctp()

    def test_insert_order_returns_ref_on_success(self):
        api = self._make_api(req_order_return=0)
        with patch("time.strftime", return_value="000000"):
            order_ref = api.insert_order(
                instrument_id="au2506",
                direction=Direction.BUY,
                offset_flag=OffsetFlag.OPEN,
            )
        assert order_ref == "000000-1"
        assert api.order_ref == 1

    def test_insert_order_returns_empty_on_failure(self):
        api = self._make_api(req_order_return=-1)
        order_ref = api.insert_order(
            instrument_id="au2506",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
        )
        assert order_ref == ""

    def test_insert_order_increments_order_ref(self):
        api = self._make_api(req_order_return=0)
        api.insert_order(instrument_id="au2506", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)
        assert api.order_ref == 1
        api.insert_order(instrument_id="ag2506", direction=Direction.SELL,
                         offset_flag=OffsetFlag.CLOSE)
        assert api.order_ref == 2

    def test_next_order_ref_sequence(self):
        api = self._make_api(req_order_return=0)
        refs = []
        with patch("time.strftime", return_value="000000"):
            for _ in range(3):
                refs.append(api.insert_order(
                    instrument_id="au2506",
                    direction=Direction.BUY,
                    offset_flag=OffsetFlag.OPEN,
                ))
        assert refs == ["000000-1", "000000-2", "000000-3"]

    def test_market_order_uses_any_price_type(self):
        api = self._make_api(req_order_return=0)
        api.insert_order(
            instrument_id="au2506",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            price_type=OrderPriceType.ANY,
            limit_price=0.0,
        )
        api._api.ReqOrderInsert.assert_called_once()

    def test_insert_order_passes_broker_id(self):
        cfg = Config()
        cfg.broker_id = "8888"
        _mock_ctp_module()
        api = TraderApi(cfg)
        api._api = Mock()
        api._api.ReqOrderInsert.return_value = 0
        api.insert_order(instrument_id="au2506", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)
        call_args = api._api.ReqOrderInsert.call_args[0]
        order_field = call_args[0]
        assert order_field.BrokerID == "8888"

    def test_insert_order_with_explicit_ref(self):
        """Explicit order_ref param is used as-is; counter not incremented."""
        api = self._make_api(req_order_return=0)
        order_ref = api.insert_order(
            instrument_id="au2506",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            order_ref="custom-9",
        )
        assert order_ref == "custom-9"
        assert api.order_ref == 0


# ── Cancel order tests ─────────────────────────────────────────────────

class TestCancelOrder:
    """Test cancel_order with mocked ctp module."""

    def teardown_method(self):
        _unmock_ctp()

    def test_cancel_order_by_ref(self):
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        result = api.cancel_order(order_ref="5")
        assert result == 0
        api._api.ReqOrderAction.assert_called_once()

    def test_cancel_order_by_sys_id(self):
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        result = api.cancel_order(order_sys_id="SYS123")
        assert result == 0
        api._api.ReqOrderAction.assert_called_once()


# ── Release tests ───────────────────────────────────────────────────────

class TestTraderApiRelease:
    """Test release() cleanup."""

    def test_release_clears_connection_status(self):
        api = TraderApi(Config())
        api._api = Mock()
        api.connection_status = "connected"
        api.release()
        assert api.connection_status == "disconnected"

    def test_release_clears_login_status(self):
        api = TraderApi(Config())
        api._api = Mock()
        api.login_status = "logged_in"
        api.release()
        assert api.login_status == "not_logged_in"

    def test_release_resets_order_ref(self):
        api = TraderApi(Config())
        api._api = Mock()
        api.order_ref = 42
        api.release()
        assert api.order_ref == 0

    def test_release_calls_api_release(self):
        api = TraderApi(Config())
        mock_api = Mock()
        api._api = mock_api
        api.release()
        mock_api.Release.assert_called_once()

    def test_release_handles_none_api(self):
        api = TraderApi(Config())
        api._api = None
        api.release()  # Should not raise


# ── Enhanced insert_order tests (PR-9: enum params) ──────────────────────

class TestInsertOrderEnhanced:
    """Test insert_order with additional parameters (PR-9)."""

    @staticmethod
    def _make_api():
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderInsert.return_value = 0
        return api

    def teardown_method(self):
        _unmock_ctp()

    def test_default_time_condition_is_gfd(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.TimeCondition == TimeCondition.GFD

    def test_fok_time_condition(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         time_condition=TimeCondition.FOK)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.TimeCondition == TimeCondition.FOK

    def test_fak_time_condition(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         time_condition=TimeCondition.FAK)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.TimeCondition == TimeCondition.FAK

    def test_hedge_flag_param(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         hedge_flag=CombHedgeFlag.HEDGE)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.CombHedgeFlag == CombHedgeFlag.HEDGE

    def test_default_hedge_flag_is_speculation(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.CombHedgeFlag == CombHedgeFlag.SPECULATION

    def test_contingent_condition_param(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         contingent_condition=ContingentCondition.STOP)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.ContingentCondition == ContingentCondition.STOP

    def test_force_close_reason_param(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         force_close_reason=ForceCloseReason.LACK_DEPOSIT)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.ForceCloseReason == ForceCloseReason.LACK_DEPOSIT

    def test_stop_price_param(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         stop_price=3850.0)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.StopPrice == 3850.0

    def test_various_volume_conditions(self):
        api = self._make_api()
        api.insert_order(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN,
                         volume_condition=VolumeCondition.CV)
        order = api._api.ReqOrderInsert.call_args[0][0]
        assert order.VolumeCondition == VolumeCondition.CV


class TestCancelOrderEnhanced:
    """Test cancel_order with additional parameters (PR-9)."""

    def teardown_method(self):
        _unmock_ctp()

    def test_cancel_with_exchange_id(self):
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        result = api.cancel_order(order_ref="5", exchange_id="CFFEX")
        assert result == 0
        action = api._api.ReqOrderAction.call_args[0][0]
        assert action.ExchangeID == "CFFEX"

    def test_cancel_with_instrument_id(self):
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        result = api.cancel_order(order_ref="5", instrument_id="IF2608")
        assert result == 0
        action = api._api.ReqOrderAction.call_args[0][0]
        assert action.InstrumentID == "IF2608"

    def test_cancel_passes_front_and_session_id(self):
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        result = api.cancel_order(
            order_ref="5", front_id=123, session_id=456,
        )
        assert result == 0
        action = api._api.ReqOrderAction.call_args[0][0]
        assert action.FrontID == 123
        assert action.SessionID == 456

    def test_cancel_pads_ordersysid_right_aligned(self):
        """OrderSysID is rjust(20) for CTP's right-aligned char[21] field."""
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        api.cancel_order(order_sys_id="121")
        action = api._api.ReqOrderAction.call_args[0][0]
        # "121" → 17 spaces + "121" = 20 chars
        assert action.OrderSysID == " " * 17 + "121"

    def test_cancel_ordersysid_empty_stays_empty(self):
        """Empty OrderSysID is not padded."""
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqOrderAction.return_value = 0
        api.cancel_order(order_sys_id="")
        action = api._api.ReqOrderAction.call_args[0][0]
        assert action.OrderSysID == ""


# ── Query instruments tests (PR-19) ────────────────────────────────────

class TestQueryInstruments:
    """Test query_instruments with mocked ctp module."""

    def teardown_method(self):
        _unmock_ctp()

    def test_query_instruments_calls_ReqQryInstrument(self):
        """query_instruments() should call CTP ReqQryInstrument."""
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqQryInstrument.return_value = 0
        result = api.query_instruments()
        assert result == 0
        api._api.ReqQryInstrument.assert_called_once()

    def test_query_instruments_returns_negative_on_failure(self):
        """query_instruments() returns negative when CTP call fails."""
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqQryInstrument.return_value = -1
        result = api.query_instruments()
        assert result == -1

    def test_query_instruments_sets_broker_id(self):
        """query_instruments() sets BrokerID on the query field."""
        cfg = Config()
        cfg.broker_id = "8888"
        _mock_ctp_module()
        api = TraderApi(cfg)
        api._api = Mock()
        api._api.ReqQryInstrument.return_value = 0
        api.query_instruments()
        call_args = api._api.ReqQryInstrument.call_args[0]
        field = call_args[0]
        assert field.BrokerID == "8888"

    def test_query_instruments_sets_investor_id(self):
        """query_instruments() sets InvestorID on the query field."""
        cfg = Config()
        cfg.user_id = "test_user"
        _mock_ctp_module()
        api = TraderApi(cfg)
        api._api = Mock()
        api._api.ReqQryInstrument.return_value = 0
        api.query_instruments()
        call_args = api._api.ReqQryInstrument.call_args[0]
        field = call_args[0]
        assert field.InvestorID == "test_user"

    def test_query_instruments_increments_request_id(self):
        """query_instruments() increments request ID."""
        _mock_ctp_module()
        api = TraderApi(Config())
        api._api = Mock()
        api._api.ReqQryInstrument.return_value = 0
        initial_id = api._request_id
        api.query_instruments()
        assert api._request_id == initial_id + 1

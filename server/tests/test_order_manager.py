"""Tests for services/order_manager.py — order state tracking and operations."""

import sys
import os
from unittest.mock import Mock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import Config
from ctp_wrapper.types import Direction, OffsetFlag
from ctp_wrapper.trader_api import TraderApi


# ── Helpers ──────────────────────────────────────────────────────────────

def _mock_ctp_module():
    """Create a mock ctp module and inject into sys.modules."""
    ctp_mock = MagicMock()
    ctp_mock.CThostFtdcTraderApi.CreateFtdcTraderApi.return_value = Mock()
    ctp_mock.CThostFtdcReqUserLoginField.return_value = Mock()
    ctp_mock.CThostFtdcInputOrderField.return_value = Mock()
    ctp_mock.CThostFtdcInputOrderActionField.return_value = Mock()
    sys.modules["ctp"] = ctp_mock
    return ctp_mock


def _unmock_ctp():
    sys.modules.pop("ctp", None)


# ── Construction ─────────────────────────────────────────────────────────

class TestOrderManagerConstruction:
    """OrderManager instantiation and defaults."""

    def test_import(self):
        from services.order_manager import OrderManager
        assert OrderManager is not None

    def test_instantiation(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        assert om is not None
        _unmock_ctp()

    def test_starts_with_empty_orders(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        assert len(om.active_orders) == 0
        _unmock_ctp()


# ── Insert ───────────────────────────────────────────────────────────────

class TestOrderManagerInsert:
    """insert() — submit order + track in pending state."""

    def test_insert_returns_order_ref(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        ref = om.insert(
            instrument_id="IF2608",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
        )
        assert ref == "1"
        _unmock_ctp()

    def test_insert_creates_pending_record(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        ref = om.insert(
            instrument_id="IF2608",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
        )
        order = om.get_order(ref)
        assert order is not None
        assert order["orderStatus"] == "pending"
        assert order["instrumentID"] == "IF2608"
        _unmock_ctp()

    def test_get_nonexistent_order_returns_none(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        assert om.get_order("nonexistent") is None
        _unmock_ctp()

    def test_get_all_orders_returns_list(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        om.insert(instrument_id="IF2608", direction=Direction.BUY,
                   offset_flag=OffsetFlag.OPEN)
        om.insert(instrument_id="IF2609", direction=Direction.SELL,
                   offset_flag=OffsetFlag.OPEN)
        all_orders = om.get_all_orders()
        assert len(all_orders) == 2
        _unmock_ctp()


# ── Cancel ───────────────────────────────────────────────────────────────

class TestOrderManagerCancel:
    """cancel() — cancel order via TraderApi."""

    def test_cancel_calls_trader_api(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        ref = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)
        result = om.cancel(ref)
        assert result == 0
        trader._api.ReqOrderAction.assert_called_once()
        _unmock_ctp()

    def test_cancel_nonexistent_returns_negative(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        assert om.cancel("nonexistent") == -1
        _unmock_ctp()


# ── OnRtnOrder callback ──────────────────────────────────────────────────

class TestOrderManagerOnRtnOrder:
    """on_rtn_order() — update order state from CTP callback."""

    def test_updates_pending_to_submitted(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        ref = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)

        order_data = {
            "orderRef": ref,
            "orderSysID": "SYS999",
            "orderStatus": "2",
            "instrumentID": "IF2608",
            "statusMsg": "",
        }
        om.on_rtn_order(order_data)
        updated = om.get_order(ref)
        assert updated["orderStatus"] == "2"
        assert updated["orderSysID"] == "SYS999"
        _unmock_ctp()

    def test_ignores_unknown_order_ref(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        om.on_rtn_order({"orderRef": "unknown", "orderStatus": "2"})
        _unmock_ctp()


# ── OnRtnTrade callback ──────────────────────────────────────────────────

class TestOrderManagerOnRtnTrade:
    """on_rtn_trade() — record trades from CTP callback."""

    def test_records_trade(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        ref = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN)
        om.on_rtn_order({
            "orderRef": ref,
            "orderSysID": "SYS999",
            "orderStatus": "2",
        })

        trade_data = {
            "tradeID": "T001",
            "orderRef": ref,
            "instrumentID": "IF2608",
            "price": 3850.0,
            "volume": 1,
        }
        om.on_rtn_trade(trade_data)
        trades = om.get_trades(ref)
        assert len(trades) == 1
        assert trades[0]["price"] == 3850.0
        _unmock_ctp()

    def test_get_trades_default_empty(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        assert om.get_trades("unknown") == []
        _unmock_ctp()


# ── Cancel all ───────────────────────────────────────────────────────────

class TestOrderManagerCancelAll:
    """cancel_all() — cancel all active orders."""

    def test_cancel_all_calls_cancel_for_each(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        om.insert(instrument_id="IF2608", direction=Direction.BUY,
                   offset_flag=OffsetFlag.OPEN)
        om.insert(instrument_id="IF2609", direction=Direction.SELL,
                   offset_flag=OffsetFlag.OPEN)

        count = om.cancel_all()
        assert count == 2
        assert trader._api.ReqOrderAction.call_count == 2
        _unmock_ctp()

    def test_cancel_all_empty_returns_zero(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        assert om.cancel_all() == 0
        _unmock_ctp()


# ── Broadcast callback ───────────────────────────────────────────────────

class TestOrderManagerBroadcast:
    """set_broadcast_fn — WebSocket broadcast hook."""

    def test_broadcast_called_on_rtn_order(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        calls = []
        om.set_broadcast_fn(lambda msg_type, data: calls.append((msg_type, data)))

        om.insert(instrument_id="IF2608", direction=Direction.BUY,
                   offset_flag=OffsetFlag.OPEN)
        om.on_rtn_order({
            "orderRef": "1",
            "orderSysID": "SYS999",
            "orderStatus": "2",
        })
        assert len(calls) == 1
        assert calls[0][0] == "order_return"
        assert calls[0][1]["orderSysID"] == "SYS999"
        _unmock_ctp()

    def test_broadcast_called_on_rtn_trade(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        calls = []
        om.set_broadcast_fn(lambda msg_type, data: calls.append((msg_type, data)))

        om.insert(instrument_id="IF2608", direction=Direction.BUY,
                   offset_flag=OffsetFlag.OPEN)
        om.on_rtn_order({"orderRef": "1", "orderSysID": "SYS999", "orderStatus": "2"})

        om.on_rtn_trade({
            "tradeID": "T001",
            "orderRef": "1",
            "price": 3850.0,
            "volume": 1,
        })
        assert len(calls) == 2
        assert calls[1][0] == "trade_return"
        assert calls[1][1]["price"] == 3850.0
        _unmock_ctp()

    def test_broadcast_not_called_when_not_set(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        om.on_rtn_order({"orderRef": "99", "orderStatus": "2"})
        _unmock_ctp()


# ── Thread safety ────────────────────────────────────────────────────────

class TestOrderManagerThreadSafety:
    """Thread-safe access to order map."""

    def test_concurrent_insert_and_read(self):
        """Insert from one thread, read from another — no corruptions."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        refs = []
        errors = []

        def insert_many():
            try:
                for _ in range(50):
                    ref = om.insert(
                        instrument_id="IF2608",
                        direction=Direction.BUY,
                        offset_flag=OffsetFlag.OPEN,
                    )
                    refs.append(ref)
            except Exception as e:
                errors.append(str(e))

        reader_errors = []

        def reader():
            try:
                for _ in range(100):
                    _ = om.get_all_orders()
            except Exception as e:
                reader_errors.append(str(e))

        t1 = threading.Thread(target=insert_many)
        t2 = threading.Thread(target=reader)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

        assert len(errors) == 0
        assert len(reader_errors) == 0
        assert len(refs) == 50
        _unmock_ctp()

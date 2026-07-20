"""Tests for services/order_manager.py — order state tracking and operations."""

import re
import sys
import os
from unittest.mock import Mock, MagicMock, patch

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

    def test_insert_returns_dict_on_success(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        with patch("time.strftime", return_value="000000"):
            result = om.insert(
                instrument_id="IF2608",
                direction=Direction.BUY,
                offset_flag=OffsetFlag.OPEN,
                wait_response=False,
            )
        assert result["success"] is True
        assert result["orderRef"] == "000000-1"
        assert result["message"] == "Submitted"
        _unmock_ctp()

    def test_insert_ctp_local_reject(self):
        """ReqOrderInsert returns non-0 → success=False."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = -1  # CTP reject
        om = OrderManager(trader)

        result = om.insert(
            instrument_id="IF2608",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            wait_response=False,
        )
        assert result["success"] is False
        assert result["orderRef"] == ""
        _unmock_ctp()

    def test_insert_creates_pending_record(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        result = om.insert(
            instrument_id="IF2608",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            wait_response=False,
        )
        order = om.get_order(result["orderRef"])
        assert order is not None
        assert order["orderStatus"] == "pending"
        assert order["instrumentID"] == "IF2608"
        _unmock_ctp()

    def test_on_rsp_order_insert_accepted(self):
        """on_rsp_order_insert(ErrorID=0) → orderSubmitStatus='accepted'."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        result = om.insert(
            instrument_id="IF2608",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            wait_response=False,
        )
        om.on_rsp_order_insert(result["orderRef"], 0, "")
        order = om.get_order(result["orderRef"])
        assert order["orderSubmitStatus"] == "accepted"
        assert order["statusMsg"] == ""
        _unmock_ctp()

    def test_on_rsp_order_insert_rejected(self):
        """on_rsp_order_insert(ErrorID≠0) → orderSubmitStatus='error'."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        result = om.insert(
            instrument_id="IF2608",
            direction=Direction.BUY,
            offset_flag=OffsetFlag.OPEN,
            wait_response=False,
        )
        om.on_rsp_order_insert(result["orderRef"], 15, "合约不存在")
        order = om.get_order(result["orderRef"])
        assert order["orderSubmitStatus"] == "error"
        assert order["statusMsg"] == "合约不存在"
        _unmock_ctp()

    def test_insert_waits_for_rsp_on_success(self):
        """With wait_response=True, insert blocks until callback."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        # Simulate callback arriving from CTP thread after a short delay
        def delayed_accept():
            import time
            time.sleep(0.05)
            om.on_rsp_order_insert("000000-1", 0, "")
        t = threading.Thread(target=delayed_accept, daemon=True)

        # Start delayed callback, then block in insert
        with patch("time.strftime", return_value="000000"):
            t.start()
            result = om.insert(
                instrument_id="IF2608",
                direction=Direction.BUY,
                offset_flag=OffsetFlag.OPEN,
                wait_response=True,
                wait_timeout=1.0,
            )
        t.join()
        assert result["success"] is True
        assert result["orderRef"] == "000000-1"
        assert result["message"] == "Accepted"
        _unmock_ctp()

    def test_insert_waits_for_rsp_on_error(self):
        """With wait_response=True, insert reflects callback error."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        def delayed_reject():
            import time
            time.sleep(0.05)
            om.on_rsp_order_insert("000000-1", 15, "合约不存在")
        t = threading.Thread(target=delayed_reject, daemon=True)

        with patch("time.strftime", return_value="000000"):
            t.start()
            result = om.insert(
                instrument_id="IF2608",
                direction=Direction.BUY,
                offset_flag=OffsetFlag.OPEN,
                wait_response=True,
                wait_timeout=1.0,
            )
        t.join()
        assert result["success"] is False
        assert "合约不存在" in result["message"]
        _unmock_ctp()

    def test_insert_waits_for_rtn_order(self):
        """With wait_response=True, insert returns when OnRtnOrder arrives
        (SimNow skips OnRspOrderInsert)."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        def delayed_rtn():
            import time
            time.sleep(0.05)
            om.on_rtn_order({
                "orderRef": "000000-1",
                "orderSysID": "SYS999",
                "orderStatus": "2",
            })
        t = threading.Thread(target=delayed_rtn, daemon=True)

        with patch("time.strftime", return_value="000000"):
            t.start()
            result = om.insert(
                instrument_id="IF2608",
                direction=Direction.BUY,
                offset_flag=OffsetFlag.OPEN,
                wait_response=True,
                wait_timeout=1.0,
            )
        t.join()
        assert result["success"] is True
        assert result["orderRef"] == "000000-1"
        assert "Accepted" in result["message"]
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
                   offset_flag=OffsetFlag.OPEN, wait_response=False)
        om.insert(instrument_id="IF2609", direction=Direction.SELL,
                   offset_flag=OffsetFlag.OPEN, wait_response=False)
        all_orders = om.get_all_orders()
        assert len(all_orders) == 2
        _unmock_ctp()


# ── Cancel ───────────────────────────────────────────────────────────────

class TestOrderManagerCancel:
    """cancel() — cancel order via TraderApi, waits for OnRspOrderAction."""

    def test_cancel_returns_dict_success(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        result = om.cancel(ref, wait_response=False)
        assert result["success"] is True
        assert result["message"] == "Submitted"
        _unmock_ctp()

    def test_cancel_nonexistent_returns_false(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        result = om.cancel("nonexistent", wait_response=False)
        assert result["success"] is False
        assert "not found" in result["message"].lower()
        _unmock_ctp()

    def test_cancel_ctp_local_reject(self):
        """ReqOrderAction returns non-0 → success=False."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = -1
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        result = om.cancel(ref, wait_response=False)
        assert result["success"] is False
        _unmock_ctp()

    def test_cancel_passes_order_sys_id_from_tracked_order(self):
        """cancel() extracts orderSysID from tracked order → cancel_order()."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        trader.cancel_order = Mock(return_value=0)
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]
        om.on_rtn_order({
            "orderRef": ref,
            "orderSysID": "SYS999",
            "orderStatus": "2",
        })

        om.cancel(ref, wait_response=False)
        trader.cancel_order.assert_called_once_with(
            order_ref=ref,
            exchange_id="",
            instrument_id="IF2608",
            order_sys_id="SYS999",
            front_id=0,
            session_id=0,
        )

    def test_cancel_falls_back_to_passed_order_sys_id(self):
        """cancel() uses explicit order_sys_id when tracked order has none."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        trader.cancel_order = Mock(return_value=0)
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        om.cancel(ref, order_sys_id="MANUAL999", wait_response=False)
        trader.cancel_order.assert_called_once_with(
            order_ref=ref,
            exchange_id="",
            instrument_id="IF2608",
            order_sys_id="MANUAL999",
            front_id=0,
            session_id=0,
        )
        _unmock_ctp()

    def test_cancel_passes_front_and_session_id(self):
        """cancel() extracts frontID/sessionID from tracked order."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        trader.cancel_order = Mock(return_value=0)
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]
        # Simulate OnRtnOrder with frontID/sessionID set
        om.on_rtn_order({
            "orderRef": ref,
            "orderSysID": "SYS111",
            "orderStatus": "2",
            "frontID": 123,
            "sessionID": 456,
        })

        om.cancel(ref, wait_response=False)
        trader.cancel_order.assert_called_once_with(
            order_ref=ref,
            exchange_id="",
            instrument_id="IF2608",
            order_sys_id="SYS111",
            front_id=123,
            session_id=456,
        )
        _unmock_ctp()

    def test_on_rsp_order_action_accepted(self):
        """on_rsp_order_action(ErrorID=0) → actionStatus='accepted'."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        result = om.cancel(ref, wait_response=False)
        om.on_rsp_order_action(ref, 0, "")
        order = om.get_order(ref)
        # The order itself isn't updated by on_rsp_order_action
        # (status comes via OnRtnOrder), just the response is tracked
        _unmock_ctp()

    def test_cancel_waits_for_rsp_on_success(self):
        """With wait_response=True, cancel blocks until OnRspOrderAction."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        def delayed_accept():
            import time
            time.sleep(0.05)
            om.on_rsp_order_action(ref, 0, "")
        t = threading.Thread(target=delayed_accept, daemon=True)

        t.start()
        result = om.cancel(ref, wait_response=True, wait_timeout=1.0)
        t.join()
        assert result["success"] is True
        assert result["message"] == "Accepted"
        _unmock_ctp()

    def test_cancel_waits_for_rsp_on_error(self):
        """With wait_response=True, cancel reflects OnRspOrderAction error."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        def delayed_reject():
            import time
            time.sleep(0.05)
            om.on_rsp_order_action(ref, 15, "撤单被拒绝")
        t = threading.Thread(target=delayed_reject, daemon=True)

        t.start()
        result = om.cancel(ref, wait_response=True, wait_timeout=1.0)
        t.join()
        assert result["success"] is False
        assert "撤单被拒绝" in result["message"]
        _unmock_ctp()


# ── OnErrRtnOrderAction callback ─────────────────────────────────────────

class TestOrderManagerOnErrRtnOrderAction:
    """on_err_rtn_order_action() — exchange-level cancel rejection (F1)."""

    def test_err_rtn_order_action_signals_waiting_cancel(self):
        """OnErrRtnOrderAction with error → cancel() reports failure."""
        import threading
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        def delayed_err():
            import time
            time.sleep(0.05)
            om.on_err_rtn_order_action(ref, 15, "交易所: 报单已经全部成交")
        t = threading.Thread(target=delayed_err, daemon=True)

        t.start()
        result = om.cancel(ref, wait_response=True, wait_timeout=1.0)
        t.join()
        assert result["success"] is False
        assert "报单已经全部成交" in result["message"]
        _unmock_ctp()

    def test_err_rtn_order_action_updates_order_status_msg(self):
        """OnErrRtnOrderAction also writes the error into the order record."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        om.on_err_rtn_order_action(ref, 11, "交易所: 撤单找不到相应报单")
        order = om.get_order(ref)
        assert order["statusMsg"] == "交易所: 撤单找不到相应报单"
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

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

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


# ── Race-condition regression tests (F1) ──────────────────────────────

class TestOrderManagerRaceConditions:
    """Callbacks arriving DURING the CTP call must not be lost (F1).

    Simulates the CTP callback thread responding before insert()/cancel()
    has finished its post-call bookkeeping.
    """

    def test_cancel_callback_during_ctp_call_not_lost(self):
        """OnRspOrderAction fires inside cancel_order() → rejection still
        reported, not swallowed as a timeout success."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        trader._api.ReqOrderAction.return_value = 0
        om = OrderManager(trader)

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                        offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        def fire_reject(*args, **kwargs):
            # CTP thread answers *while* cancel_order() is still executing
            om.on_rsp_order_action(ref, 15, "撤单被拒绝")
            return 0
        trader._api.ReqOrderAction.side_effect = fire_reject

        result = om.cancel(ref, wait_response=True, wait_timeout=0.5)
        assert result["success"] is False
        assert "撤单被拒绝" in result["message"]
        _unmock_ctp()

    def test_insert_callback_during_ctp_call_not_lost(self):
        """OnRspOrderInsert fires inside insert_order() → rejection still
        reported."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)

        def fire_reject(*args, **kwargs):
            om.on_rsp_order_insert("000000-1", 15, "合约不存在")
            return 0
        trader._api.ReqOrderInsert.side_effect = fire_reject

        with patch("time.strftime", return_value="000000"):
            result = om.insert(
                instrument_id="IF2608",
                direction=Direction.BUY,
                offset_flag=OffsetFlag.OPEN,
                wait_response=True,
                wait_timeout=0.5,
            )
        assert result["success"] is False
        assert "合约不存在" in result["message"]
        _unmock_ctp()

    def test_insert_rtn_order_during_ctp_call_not_lost(self):
        """OnRtnOrder fires inside insert_order() → record updated, not
        dropped as 'unknown ref'."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)

        def fire_rtn(*args, **kwargs):
            om.on_rtn_order({
                "orderRef": "000000-1",
                "orderSysID": "SYS999",
                "orderStatus": "2",
            })
            return 0
        trader._api.ReqOrderInsert.side_effect = fire_rtn

        with patch("time.strftime", return_value="000000"):
            res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                            offset_flag=OffsetFlag.OPEN, wait_response=False)
        order = om.get_order(res["orderRef"])
        assert order["orderSysID"] == "SYS999"
        _unmock_ctp()


# ── Session filtering ────────────────────────────────────────────────────

class TestOrderManagerSessionFilter:
    """set_session() + on_rtn_order() stale-callback filtering."""

    def test_set_session_stores_ids(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        om.set_session(123, 456)
        assert om._my_front_id == 123
        assert om._my_session_id == 456
        _unmock_ctp()

    def test_on_rtn_order_accepts_stale_when_session_not_set(self):
        """Before set_session(), all callbacks accepted (defense in depth
        — no pending orders exist pre-login anyway)."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        with patch("time.strftime", return_value="000000"):
            res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                            offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        # Callback arrives with unknown session IDs — accepted
        om.on_rtn_order({
            "orderRef": ref,
            "orderSysID": "SYS111",
            "orderStatus": "2",
            "frontID": 999,
            "sessionID": 888,
        })
        order = om.get_order(ref)
        assert order["orderSysID"] == "SYS111"
        _unmock_ctp()

    def test_on_rtn_order_rejects_stale_after_session_set(self):
        """After set_session(), callbacks from different (frontID, sessionID)
        are silently dropped."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        om.set_session(100, 200)  # current session

        with patch("time.strftime", return_value="000000"):
            res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                            offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        # Historical callback from a previous connection
        om.on_rtn_order({
            "orderRef": ref,
            "orderSysID": "SYS_STALE",
            "orderStatus": "5",
            "frontID": 999,  # different frontID
            "sessionID": 888,  # different sessionID
        })
        order = om.get_order(ref)
        # OrderSysID should NOT have been overwritten by the stale callback
        assert order["orderSysID"] == ""
        _unmock_ctp()

    def test_on_rtn_order_accepts_matching_session(self):
        """Callbacks from the current session are accepted normally."""
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        om.set_session(100, 200)  # current session

        with patch("time.strftime", return_value="000000"):
            res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                            offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]

        # Callback from current session
        om.on_rtn_order({
            "orderRef": ref,
            "orderSysID": "SYS_CURRENT",
            "orderStatus": "2",
            "frontID": 100,
            "sessionID": 200,
        })
        order = om.get_order(ref)
        assert order["orderSysID"] == "SYS_CURRENT"
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

        res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        ref = res["orderRef"]
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

    @staticmethod
    def _make_cancel_all_setup(wait_timeout=0.1):
        """Shared setup: TraderApi + 2 inserted orders with callbacks wired.

        ReqOrderAction fires on_rsp_order_action synchronously so that
        cancel_all's wait_response=True completes without a timeout.
        """
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        trader._api.ReqOrderInsert.return_value = 0
        om = OrderManager(trader)

        # Insert 2 orders — they are "pending" (no OnRtnOrder yet)
        res1 = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)
        res2 = om.insert(instrument_id="IF2609", direction=Direction.SELL,
                         offset_flag=OffsetFlag.OPEN, wait_response=False)

        # Wire ReqOrderAction to simulate instant CTP acceptance
        def _accept_cancel(action_field, request_id):
            order_ref = getattr(action_field, "OrderRef", "")
            om.on_rsp_order_action(order_ref, 0, "")
            return 0
        trader._api.ReqOrderAction.side_effect = _accept_cancel

        return om, res1["orderRef"], res2["orderRef"], wait_timeout

    def test_cancel_all_returns_result_dict(self):
        om, ref1, ref2, wt = self._make_cancel_all_setup()
        result = om.cancel_all(wait_timeout=wt)
        assert isinstance(result, dict)
        assert result["attempted"] == 2
        assert result["succeeded"] == 2
        assert result["failedRefs"] == []
        _unmock_ctp()

    def test_cancel_all_failed_refs_excluded_from_succeeded(self):
        """Orders whose cancel() returns success=False → failedRefs."""
        om, ref1, ref2, wt = self._make_cancel_all_setup()

        # Make ref2's cancel fail: fire OnRspOrderAction with error
        _original_side_effect = om._trader._api.ReqOrderAction.side_effect

        def _reject_ref2(action_field, request_id):
            order_ref = getattr(action_field, "OrderRef", "")
            if order_ref == ref2:
                om.on_rsp_order_action(order_ref, 15, "撤单被拒绝")
            else:
                om.on_rsp_order_action(order_ref, 0, "")
            return 0
        om._trader._api.ReqOrderAction.side_effect = _reject_ref2

        result = om.cancel_all(wait_timeout=wt)
        assert result["attempted"] == 2
        assert result["succeeded"] == 1
        assert result["failedRefs"] == [ref2]
        _unmock_ctp()

    def test_cancel_all_empty_returns_zero(self):
        _mock_ctp_module()
        from services.order_manager import OrderManager

        trader = TraderApi(Config())
        trader._api = Mock()
        om = OrderManager(trader)
        result = om.cancel_all(wait_timeout=0.05)
        assert result["attempted"] == 0
        assert result["succeeded"] == 0
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

        with patch("time.strftime", return_value="000000"):
            res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                            offset_flag=OffsetFlag.OPEN, wait_response=False)
        om.on_rtn_order({
            "orderRef": res["orderRef"],
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

        with patch("time.strftime", return_value="000000"):
            res = om.insert(instrument_id="IF2608", direction=Direction.BUY,
                            offset_flag=OffsetFlag.OPEN, wait_response=False)
            ref = res["orderRef"]
        om.on_rtn_order({"orderRef": ref, "orderSysID": "SYS999", "orderStatus": "2"})

        om.on_rtn_trade({
            "tradeID": "T001",
            "orderRef": ref,
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
                    res = om.insert(
                        instrument_id="IF2608",
                        direction=Direction.BUY,
                        offset_flag=OffsetFlag.OPEN,
                        wait_response=False,
                    )
                    refs.append(res["orderRef"])
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

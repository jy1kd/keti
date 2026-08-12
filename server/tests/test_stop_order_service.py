"""Tests for StopOrderService — stop order lifecycle and trigger logic."""

import json
import os
import tempfile
import threading
from datetime import datetime
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

from services.stop_order import StopOrderService, StopOrder, StopOrderStatus


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def tmp_data_dir(tmp_path):
    """Provide a temporary data directory for persistence."""
    return str(tmp_path / "data")


@pytest.fixture
def mock_market_service():
    """Mock MarketService with snapshot data."""
    ms = MagicMock()
    ms.get_snapshot = MagicMock(return_value=None)
    return ms


@pytest.fixture
def mock_order_manager():
    """Mock OrderManager."""
    om = MagicMock()
    om.insert = MagicMock(return_value={"success": True, "orderRef": "ref-001", "message": "Accepted"})
    return om


@pytest.fixture
def service(tmp_data_dir, mock_order_manager):
    """Create a StopOrderService with mocked dependencies."""
    svc = StopOrderService(
        data_dir=tmp_data_dir,
        order_manager=mock_order_manager,
    )
    return svc


# ── StopOrder model ─────────────────────────────────────────────────────────

class TestStopOrderModel:
    """Test StopOrder data model."""

    def test_create_stop_order(self):
        """StopOrder can be created with required fields."""
        order = StopOrder(
            stop_order_id="so-001",
            instrument_id="IF2608",
            direction="0",
            offset_flag="0",
            limit_price=4800.0,
            volume=1,
            stop_price=4790.0,
        )
        assert order.stop_order_id == "so-001"
        assert order.instrument_id == "IF2608"
        assert order.direction == "0"
        assert order.offset_flag == "0"
        assert order.limit_price == 4800.0
        assert order.volume == 1
        assert order.stop_price == 4790.0
        assert order.status == StopOrderStatus.PENDING

    def test_stop_order_to_dict(self):
        """StopOrder can be serialized to dict."""
        order = StopOrder(
            stop_order_id="so-001",
            instrument_id="IF2608",
            direction="0",
            offset_flag="0",
            limit_price=4800.0,
            volume=1,
            stop_price=4790.0,
        )
        d = order.to_dict()
        assert d["stopOrderID"] == "so-001"
        assert d["instrumentID"] == "IF2608"
        assert d["direction"] == "0"
        assert d["stopPrice"] == 4790.0
        assert d["status"] == "pending"

    def test_stop_order_from_dict(self):
        """StopOrder can be deserialized from dict."""
        d = {
            "stopOrderID": "so-001",
            "instrumentID": "IF2608",
            "direction": "0",
            "offsetFlag": "0",
            "limitPrice": 4800.0,
            "volume": 1,
            "stopPrice": 4790.0,
            "status": "pending",
            "createdAt": "2026-07-21 10:00:00",
            "triggeredAt": None,
            "orderRef": None,
        }
        order = StopOrder.from_dict(d)
        assert order.stop_order_id == "so-001"
        assert order.status == StopOrderStatus.PENDING


# ── StopOrderService: submit ────────────────────────────────────────────────

class TestStopOrderSubmit:
    """Test stop order submission."""

    def test_submit_stop_order(self, service):
        """submit() creates a new stop order and returns success."""
        result = service.submit(
            instrument_id="IF2608",
            direction="0",
            offset_flag="0",
            limit_price=4800.0,
            volume=1,
            stop_price=4790.0,
        )
        assert result["success"] is True
        assert "stopOrderID" in result

    def test_submit_returns_stop_order_id(self, service):
        """submit() returns a unique stop order ID."""
        r1 = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        r2 = service.submit(
            instrument_id="IF2608", direction="1", offset_flag="1",
            limit_price=4900.0, volume=2, stop_price=4910.0,
        )
        assert r1["stopOrderID"] != r2["stopOrderID"]

    def test_submit_adds_to_list(self, service):
        """submit() adds the stop order to the internal list."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        orders = service.list_orders()
        assert len(orders) == 1
        assert orders[0]["instrumentID"] == "IF2608"

    def test_submit_persists_to_file(self, service, tmp_data_dir):
        """submit() persists stop orders to disk."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        file_path = os.path.join(tmp_data_dir, "stop_orders.json")
        assert os.path.exists(file_path)
        with open(file_path, "r") as f:
            data = json.load(f)
        assert len(data) == 1
        assert data[0]["instrumentID"] == "IF2608"


# ── StopOrderService: cancel ────────────────────────────────────────────────

class TestStopOrderCancel:
    """Test stop order cancellation."""

    def test_cancel_stop_order(self, service):
        """cancel() changes status to canceled."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        stop_id = r["stopOrderID"]
        result = service.cancel(stop_id)
        assert result["success"] is True

        orders = service.list_orders()
        assert orders[0]["status"] == "canceled"

    def test_cancel_nonexistent_order(self, service):
        """cancel() returns error for nonexistent ID."""
        result = service.cancel("nonexistent")
        assert result["success"] is False
        assert "not found" in result["message"].lower()

    def test_cancel_already_canceled(self, service):
        """cancel() returns error for already canceled order."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        stop_id = r["stopOrderID"]
        service.cancel(stop_id)
        result = service.cancel(stop_id)
        assert result["success"] is False

    def test_cancel_already_triggered(self, service):
        """cancel() returns error for already triggered order."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        stop_id = r["stopOrderID"]
        # Manually set status to triggered
        with service._lock:
            for o in service._orders:
                if o.stop_order_id == stop_id:
                    o.status = StopOrderStatus.TRIGGERED
        result = service.cancel(stop_id)
        assert result["success"] is False


# ── StopOrderService: list ──────────────────────────────────────────────────

class TestStopOrderList:
    """Test stop order listing."""

    def test_list_empty(self, service):
        """list_orders() returns empty list when no stop orders."""
        assert service.list_orders() == []

    def test_list_returns_all_orders(self, service):
        """list_orders() returns all stop orders."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.submit(
            instrument_id="IF2609", direction="1", offset_flag="1",
            limit_price=4900.0, volume=2, stop_price=4910.0,
        )
        orders = service.list_orders()
        assert len(orders) == 2

    def test_list_includes_canceled(self, service):
        """list_orders() includes canceled orders."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.cancel(r["stopOrderID"])
        orders = service.list_orders()
        assert len(orders) == 1
        assert orders[0]["status"] == "canceled"


# ── StopOrderService: trigger logic ─────────────────────────────────────────

class TestStopOrderTrigger:
    """Test stop order trigger logic."""

    def test_long_stop_triggers_when_price_below_stop(self, service, mock_market_service):
        """Long stop (direction=buy) triggers when lastPrice <= stopPrice."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        # Simulate market data: lastPrice = 4789.0 (below stop price 4790.0)
        mock_market_service.get_snapshot.return_value = {
            "instrumentID": "IF2608",
            "lastPrice": 4789.0,
        }
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"

    def test_long_stop_does_not_trigger_when_price_above_stop(self, service, mock_market_service):
        """Long stop (direction=buy) does not trigger when lastPrice > stopPrice."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.on_market_data("IF2608", 4791.0)
        orders = service.list_orders()
        assert orders[0]["status"] == "pending"

    def test_short_stop_triggers_when_price_above_stop(self, service, mock_market_service):
        """Short stop (direction=sell) triggers when lastPrice >= stopPrice."""
        service.submit(
            instrument_id="IF2608", direction="1", offset_flag="1",
            limit_price=4780.0, volume=1, stop_price=4790.0,
        )
        service.on_market_data("IF2608", 4791.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"

    def test_short_stop_does_not_trigger_when_price_below_stop(self, service, mock_market_service):
        """Short stop (direction=sell) does not trigger when lastPrice < stopPrice."""
        service.submit(
            instrument_id="IF2608", direction="1", offset_flag="1",
            limit_price=4780.0, volume=1, stop_price=4790.0,
        )
        service.on_market_data("IF2608", 4789.0)
        orders = service.list_orders()
        assert orders[0]["status"] == "pending"

    def test_trigger_calls_order_manager_insert(self, service, mock_order_manager):
        """Triggered stop order calls OrderManager.insert()."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        mock_order_manager.insert.assert_called_once()

    def test_trigger_records_order_ref(self, service, mock_order_manager):
        """Triggered stop order records the orderRef from insert result."""
        mock_order_manager.insert.return_value = {
            "success": True, "orderRef": "ref-123", "message": "Accepted"
        }
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["orderRef"] == "ref-123"

    def test_trigger_failed_when_order_rejected(self, service, mock_order_manager):
        """Trigger sets status to trigger_failed when insert rejects."""
        mock_order_manager.insert.return_value = {
            "success": False, "orderRef": "", "message": "Rejected"
        }
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["status"] == "trigger_failed"

    def test_price_gap_still_triggers(self, service):
        """Price gap (large jump past stop) still triggers."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        # Price gaps down to 4700 (well below stop 4790)
        service.on_market_data("IF2608", 4700.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"

    def test_canceled_order_not_triggered(self, service):
        """Canceled stop order should not be triggered even if price condition is met."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        stop_id = r["stopOrderID"]

        # Cancel the order
        service.cancel(stop_id)

        # Price drops below stop - should NOT trigger
        service.on_market_data("IF2608", 4789.0)
        orders = service.list_orders()
        assert orders[0]["status"] == "canceled"

    def test_triggered_order_not_triggered_again(self, service):
        """Already triggered stop order should not be triggered again."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )

        # First trigger
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"

        # Second market data - should NOT trigger again
        service.on_market_data("IF2608", 4780.0)
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"

    def test_concurrent_triggers_only_once(self, service, mock_order_manager):
        """Concurrent on_market_data calls should only trigger the stop order once."""
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )

        # Simulate concurrent market data updates
        threads = []
        for _ in range(10):
            t = threading.Thread(target=service.on_market_data, args=("IF2608", 4789.0))
            threads.append(t)
            t.start()

        for t in threads:
            t.join()

        service.wait_for_pending_triggers()

        # Should only have triggered once
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"
        # OrderManager.insert should have been called only once
        assert mock_order_manager.insert.call_count == 1

    def test_on_market_data_does_not_block_on_slow_insert(self, service, mock_order_manager):
        """触发报单不在 MD 回调线程执行 — insert 阻塞时 on_market_data 也快速返回。

        回归测试：修复前 _trigger_order 在回调线程内 insert(wait_response=True)
        阻塞最长 3s，全品种行情停摆。修复后触发只入队，由工作线程执行。
        """
        import time as _time

        def slow_insert(**kwargs):
            _time.sleep(0.5)  # 模拟 insert 等待 CTP 回报阻塞
            return {"success": True, "orderRef": "ref-slow", "message": "Accepted"}

        mock_order_manager.insert.side_effect = slow_insert

        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )

        start = _time.monotonic()
        service.on_market_data("IF2608", 4789.0)
        elapsed = _time.monotonic() - start
        # on_market_data 只入队，应立即返回（远小于 insert 的 0.5s 阻塞时间）
        assert elapsed < 0.2

        # 工作线程随后完成触发，状态正确
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        assert orders[0]["status"] == "triggered"
        assert orders[0]["orderRef"] == "ref-slow"


# ── StopOrderService: WebSocket broadcast ───────────────────────────────────

class TestStopOrderBroadcast:
    """Test WebSocket broadcast on stop order events."""

    def test_broadcast_on_submit(self, service):
        """submit() calls broadcast function."""
        broadcast_fn = MagicMock()
        service.set_broadcast_fn(broadcast_fn)
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        broadcast_fn.assert_called_once()
        call_args = broadcast_fn.call_args
        assert call_args[0][0] == "stop_order_update"

    def test_broadcast_on_cancel(self, service):
        """cancel() calls broadcast function."""
        broadcast_fn = MagicMock()
        service.set_broadcast_fn(broadcast_fn)
        r = service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        broadcast_fn.reset_mock()
        service.cancel(r["stopOrderID"])
        broadcast_fn.assert_called_once()

    def test_broadcast_on_trigger(self, service):
        """Trigger calls broadcast function."""
        broadcast_fn = MagicMock()
        service.set_broadcast_fn(broadcast_fn)
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        broadcast_fn.reset_mock()
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        # Should broadcast at least once (trigger + order result)
        assert broadcast_fn.call_count >= 1


# ── StopOrderService: persistence ───────────────────────────────────────────

class TestStopOrderPersistence:
    """Test stop order persistence across service restarts."""

    def test_load_on_startup(self, tmp_data_dir, mock_order_manager):
        """Service loads pending stop orders from file on startup."""
        # Create initial service and submit an order
        svc1 = StopOrderService(
            data_dir=tmp_data_dir,
            order_manager=mock_order_manager,
        )
        svc1.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )

        # Create new service (simulating restart)
        svc2 = StopOrderService(
            data_dir=tmp_data_dir,
            order_manager=mock_order_manager,
        )
        orders = svc2.list_orders()
        assert len(orders) == 1
        assert orders[0]["instrumentID"] == "IF2608"
        assert orders[0]["status"] == "pending"

    def test_does_not_load_canceled_orders(self, tmp_data_dir, mock_market_service, mock_order_manager):
        """Service does not load canceled stop orders on restart."""
        svc1 = StopOrderService(
            data_dir=tmp_data_dir,
            market_service=mock_market_service,
            order_manager=mock_order_manager,
        )
        r = svc1.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        svc1.cancel(r["stopOrderID"])

        svc2 = StopOrderService(
            data_dir=tmp_data_dir,
            market_service=mock_market_service,
            order_manager=mock_order_manager,
        )
        orders = svc2.list_orders()
        assert len(orders) == 0

    def test_does_not_load_triggered_orders(self, tmp_data_dir, mock_market_service, mock_order_manager):
        """Service does not load triggered stop orders on restart."""
        svc1 = StopOrderService(
            data_dir=tmp_data_dir,
            market_service=mock_market_service,
            order_manager=mock_order_manager,
        )
        svc1.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        # Trigger it
        svc1.on_market_data("IF2608", 4789.0)
        svc1.wait_for_pending_triggers()

        svc2 = StopOrderService(
            data_dir=tmp_data_dir,
            market_service=mock_market_service,
            order_manager=mock_order_manager,
        )
        orders = svc2.list_orders()
        assert len(orders) == 0


# ── StopOrderService: multiple instruments ──────────────────────────────────

class TestStopOrderMultipleInstruments:
    """Test stop orders across multiple instruments."""

    def test_trigger_only_affects_matching_instrument(self, service):
        """on_market_data() only checks stop orders for the given instrument."""
        service.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        service.submit(
            instrument_id="IF2609", direction="0", offset_flag="0",
            limit_price=4900.0, volume=1, stop_price=4890.0,
        )
        # Only IF2608 drops below its stop
        service.on_market_data("IF2608", 4789.0)
        service.wait_for_pending_triggers()
        orders = service.list_orders()
        if2608 = [o for o in orders if o["instrumentID"] == "IF2608"][0]
        if2609 = [o for o in orders if o["instrumentID"] == "IF2609"][0]
        assert if2608["status"] == "triggered"
        assert if2609["status"] == "pending"


# ── StopOrderService: GFD (Good For Day) ────────────────────────────────────

class TestStopOrderGFD:
    """Test GFD (Good For Day) stop order expiry."""

    def test_does_not_load_orders_from_previous_day(self, tmp_data_dir, mock_order_manager):
        """Service does not load stop orders from previous days on startup."""
        # Create a stop order file with yesterday's date
        from datetime import timedelta
        yesterday = (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d %H:%M:%S")
        old_order = {
            "stopOrderID": "so-old",
            "instrumentID": "IF2608",
            "direction": "0",
            "offsetFlag": "0",
            "limitPrice": 4800.0,
            "volume": 1,
            "stopPrice": 4790.0,
            "status": "pending",
            "createdAt": yesterday,
            "triggeredAt": None,
            "orderRef": None,
        }
        os.makedirs(tmp_data_dir, exist_ok=True)
        with open(os.path.join(tmp_data_dir, "stop_orders.json"), "w") as f:
            json.dump([old_order], f)

        svc = StopOrderService(
            data_dir=tmp_data_dir,
            order_manager=mock_order_manager,
        )
        assert len(svc.list_orders()) == 0

    def test_loads_orders_from_today(self, tmp_data_dir, mock_market_service, mock_order_manager):
        """Service loads stop orders from today on startup."""
        today = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        today_order = {
            "stopOrderID": "so-today",
            "instrumentID": "IF2608",
            "direction": "0",
            "offsetFlag": "0",
            "limitPrice": 4800.0,
            "volume": 1,
            "stopPrice": 4790.0,
            "status": "pending",
            "createdAt": today,
            "triggeredAt": None,
            "orderRef": None,
        }
        os.makedirs(tmp_data_dir, exist_ok=True)
        with open(os.path.join(tmp_data_dir, "stop_orders.json"), "w") as f:
            json.dump([today_order], f)

        svc = StopOrderService(
            data_dir=tmp_data_dir,
            order_manager=mock_order_manager,
        )
        assert len(svc.list_orders()) == 1
        assert svc.list_orders()[0]["stopOrderID"] == "so-today"

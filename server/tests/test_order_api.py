"""Tests for api/order.py — order API endpoints (PR-9)."""

import sys
import os
from unittest.mock import Mock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# Import at module level BEFORE any mock — uses real CTP or fallback
from ctp_wrapper.trader_api import TraderApi
from services.order_manager import OrderManager
from services.query_service import QueryService
from ws.manager import WebSocketManager
from config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.order import router as order_router


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_app_with_order_manager(positions=None):
    """Create a FastAPI test app with OrderManager wired in.

    Args:
        positions: Optional list of position dicts to inject into QueryService.
    """
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(order_router, prefix="/api/order")
    app.state.ws_manager = WebSocketManager()

    trader = TraderApi(Config())
    trader._api = Mock()
    trader._api.ReqOrderInsert.return_value = 0
    trader._api.ReqOrderAction.return_value = 0
    trader.login_status = "logged_in"  # mock TD as connected
    om = OrderManager(trader)
    app.state.order_manager = om
    app.state.trader_api = trader

    # Wire QueryService with optional positions
    qs = QueryService()
    if positions is not None:
        qs._positions = positions
    app.state.query_service = qs

    return app


# ── Insert ───────────────────────────────────────────────────────────────

class TestOrderInsertApi:
    """POST /api/order/insert."""

    @pytest.mark.anyio
    async def test_insert_returns_order_ref(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "orderRef" in data

    @pytest.mark.anyio
    async def test_insert_missing_instrument(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "direction": "0",
                "offsetFlag": "0",
            })
        assert resp.status_code == 422

    @pytest.mark.anyio
    async def test_insert_invalid_price(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": -1.0,
                "volumeTotalOriginal": 1,
            })
        assert resp.status_code == 422

    @pytest.mark.anyio
    async def test_insert_invalid_volume(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 0,
            })
        assert resp.status_code == 422


# ── Insert validation: FOK/FAK volume condition ─────────────────────────

class TestOrderInsertFokFakValidation:
    """FOK/FAK volume condition constraints (PR-9 bugfix)."""

    @pytest.mark.anyio
    async def test_ioc_with_cv_is_fok(self):
        """FOK = IOC(timeCondition=1) + CV(volumeCondition=3) → 200."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "1",
                "volumeCondition": "3",  # CV — valid FOK
            })
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_ioc_with_av_is_fak(self):
        """FAK = IOC(timeCondition=1) + AV(volumeCondition=1) → 200."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "1",
                "volumeCondition": "1",  # AV — valid FAK
            })
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_fok_with_cv_accepted(self):
        """FOK = IOC(timeCondition=1) + CV(volumeCondition=3) → 200."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "1",
                "volumeCondition": "3",
            })
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_fak_with_av_accepted(self):
        """FAK = IOC(timeCondition=1) + AV(volumeCondition=1) → 200."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "1",
                "volumeCondition": "1",
            })
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_gfd_any_volume_condition_accepted(self):
        """GFD (timeCondition=3) accepts any volumeCondition."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "3",
                "volumeCondition": "2",  # MV — unusual but valid for GFD
            })
        assert resp.status_code == 200


# ── Cancel ───────────────────────────────────────────────────────────────

class TestOrderCancelApi:
    """POST /api/order/cancel."""

    @pytest.mark.anyio
    async def test_cancel_returns_success(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # First insert
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
            })
            order_ref = resp.json()["orderRef"]

            # Then cancel — insert with wait_response=True blocks,
            # cancel with wait_response=True also blocks, but in tests
            # there's no real CTP, so we rely on the test mock returning 0
            resp = await client.post("/api/order/cancel", json={
                "orderRef": order_ref,
            })
        assert resp.status_code == 200
        data = resp.json()
        # With wait_response default and no real callback, returns timeout message
        assert "orderRef" in data

    @pytest.mark.anyio
    async def test_cancel_missing_ref(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/cancel", json={})
        assert resp.status_code == 422


# ── Status ───────────────────────────────────────────────────────────────

class TestOrderStatusApi:
    """GET /api/order/status/{order_ref}."""

    @pytest.mark.anyio
    async def test_status_returns_order(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            # Insert first
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
            })
            order_ref = resp.json()["orderRef"]

            # Query status
            resp = await client.get(f"/api/order/status/{order_ref}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["order"]["orderStatus"] == "pending"

    @pytest.mark.anyio
    async def test_status_not_found(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/order/status/nonexistent")
        assert resp.status_code == 404


# ── Cancel all ───────────────────────────────────────────────────────────

class TestOrderCancelAllApi:
    """POST /api/order/cancel_all."""

    @pytest.mark.anyio
    async def test_cancel_all_returns_result_dict(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/cancel_all")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "attempted" in data
        assert "succeeded" in data
        assert "failedRefs" in data


# ── Reverse ──────────────────────────────────────────────────────────────

class TestOrderReverseApi:
    """POST /api/order/reverse — close position then open opposite."""

    @pytest.mark.anyio
    async def test_reverse_with_long_position(self):
        """Reverse a long position: close long + open short."""
        positions = [{
            "instrumentID": "IF2608",
            "posiDirection": "2",  # 多头
            "position": 1,
            "exchangeID": "CFFEX",
        }]
        app = _make_app_with_order_manager(positions=positions)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/reverse", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["orders"]) == 2
        # First order: close long (direction=1, offset=1)
        assert data["orders"][0]["action"] == "close"
        # Second order: open short (direction=1, offset=0)
        assert data["orders"][1]["action"] == "open"

    @pytest.mark.anyio
    async def test_reverse_with_short_position(self):
        """Reverse a short position: close short + open long."""
        positions = [{
            "instrumentID": "IF2608",
            "posiDirection": "3",  # 空头
            "position": 2,
            "exchangeID": "CFFEX",
        }]
        app = _make_app_with_order_manager(positions=positions)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/reverse", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["orders"]) == 2
        # First order: close short (direction=0, offset=1)
        assert data["orders"][0]["action"] == "close"
        # Second order: open long (direction=0, offset=0)
        assert data["orders"][1]["action"] == "open"

    @pytest.mark.anyio
    async def test_reverse_no_position(self):
        """Reverse with no position returns error."""
        app = _make_app_with_order_manager(positions=[])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/reverse", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "No position" in data["message"]

    @pytest.mark.anyio
    async def test_reverse_td_not_connected(self):
        """Reverse with TD not connected returns error."""
        app = _make_app_with_order_manager()
        app.state.trader_api.login_status = "not_logged_in"
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/reverse", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "TD not connected" in data["message"]

    @pytest.mark.anyio
    async def test_reverse_close_failed_no_open(self):
        """When close order fails, open order should not be submitted."""
        positions = [{
            "instrumentID": "IF2608",
            "posiDirection": "2",  # 多头
            "position": 1,
            "exchangeID": "CFFEX",
        }]
        app = _make_app_with_order_manager(positions=positions)
        # Mock insert to fail on first call (close), succeed on second (open)
        call_count = [0]
        original_insert = app.state.order_manager.insert

        def mock_insert(*args, **kwargs):
            call_count[0] += 1
            if call_count[0] == 1:
                # First call (close) fails
                return {"success": False, "orderRef": "", "message": "Rejected"}
            # Second call (open) succeeds
            return {"success": True, "orderRef": "ref-002", "message": "Accepted"}

        app.state.order_manager.insert = mock_insert
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/reverse", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        # Should have only 1 order (close failed, open not attempted)
        assert len(data["orders"]) == 1
        assert data["orders"][0]["action"] == "close"
        assert data["orders"][0]["success"] is False


# ── Lock ─────────────────────────────────────────────────────────────────

class TestOrderLockApi:
    """POST /api/order/lock — open opposite position without closing."""

    @pytest.mark.anyio
    async def test_lock_with_long_position(self):
        """Lock a long position: open short (no close)."""
        positions = [{
            "instrumentID": "IF2608",
            "posiDirection": "2",  # 多头
            "position": 1,
            "exchangeID": "CFFEX",
        }]
        app = _make_app_with_order_manager(positions=positions)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/lock", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["orders"]) == 1
        assert data["orders"][0]["action"] == "lock_open"

    @pytest.mark.anyio
    async def test_lock_with_short_position(self):
        """Lock a short position: open long (no close)."""
        positions = [{
            "instrumentID": "IF2608",
            "posiDirection": "3",  # 空头
            "position": 2,
            "exchangeID": "CFFEX",
        }]
        app = _make_app_with_order_manager(positions=positions)
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/lock", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert len(data["orders"]) == 1
        assert data["orders"][0]["action"] == "lock_open"

    @pytest.mark.anyio
    async def test_lock_no_position(self):
        """Lock with no position returns error."""
        app = _make_app_with_order_manager(positions=[])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/lock", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "No position" in data["message"]

    @pytest.mark.anyio
    async def test_lock_td_not_connected(self):
        """Lock with TD not connected returns error."""
        app = _make_app_with_order_manager()
        app.state.trader_api.login_status = "not_logged_in"
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/lock", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "TD not connected" in data["message"]

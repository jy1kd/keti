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
from ws.manager import WebSocketManager
from config import Config
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.order import router as order_router


# ── Helpers ──────────────────────────────────────────────────────────────

def _make_app_with_order_manager():
    """Create a FastAPI test app with OrderManager wired in."""
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
    om = OrderManager(trader)
    app.state.order_manager = om
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
    async def test_fok_requires_cv(self):
        """FOK (timeCondition=2) + AV (volumeCondition=1) → 422."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "2",
                "volumeCondition": "1",  # AV — should be CV
            })
        assert resp.status_code == 422

    @pytest.mark.anyio
    async def test_fak_requires_av(self):
        """FAK (timeCondition=3) + CV (volumeCondition=3) → 422."""
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
                "volumeCondition": "3",  # CV — should be AV
            })
        assert resp.status_code == 422

    @pytest.mark.anyio
    async def test_fok_with_cv_accepted(self):
        """FOK (timeCondition=2) + CV (volumeCondition=3) → 200."""
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/insert", json={
                "instrumentID": "IF2608",
                "direction": "0",
                "offsetFlag": "0",
                "limitPrice": 3850.0,
                "volumeTotalOriginal": 1,
                "timeCondition": "2",
                "volumeCondition": "3",
            })
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_fak_with_av_accepted(self):
        """FAK (timeCondition=3) + AV (volumeCondition=1) → 200."""
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
                "volumeCondition": "1",
            })
        assert resp.status_code == 200

    @pytest.mark.anyio
    async def test_gfd_any_volume_condition_accepted(self):
        """GFD (timeCondition=1) accepts any volumeCondition."""
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

            # Then cancel
            resp = await client.post("/api/order/cancel", json={
                "orderRef": order_ref,
            })
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True

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
    async def test_cancel_all_returns_count(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/cancel_all")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert "count" in data


# ── Reverse (placeholder) ────────────────────────────────────────────────

class TestOrderReverseApi:
    """POST /api/order/reverse — placeholder for PR-11."""

    @pytest.mark.anyio
    async def test_reverse_returns_not_implemented(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/reverse", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 501


# ── Lock (placeholder) ───────────────────────────────────────────────────

class TestOrderLockApi:
    """POST /api/order/lock — placeholder for PR-11."""

    @pytest.mark.anyio
    async def test_lock_returns_not_implemented(self):
        app = _make_app_with_order_manager()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/order/lock", json={
                "instrumentID": "IF2608",
            })
        assert resp.status_code == 501

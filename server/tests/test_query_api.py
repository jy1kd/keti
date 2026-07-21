"""Tests for api/query.py — query API endpoints (PR-11)."""

import sys
import os
from unittest.mock import Mock, MagicMock, patch

import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import Config
from ctp_wrapper.trader_api import TraderApi
from services.query_service import QueryService
from services.market_service import MarketService
from ws.manager import WebSocketManager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api.query import router as query_router


def _make_app():
    """Create a FastAPI test app with QueryService wired in."""
    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(query_router, prefix="/api/query")

    trader = TraderApi(Config())
    trader._api = Mock()
    trader.login_status = "logged_in"

    app.state.trader_api = trader
    app.state.query_service = QueryService()
    app.state.market_service = MarketService()
    app.state.ws_manager = WebSocketManager()
    return app


# ── GET /api/query/positions ────────────────────────────────────────────


class TestGetPositions:
    """GET /api/query/positions."""

    @pytest.mark.anyio
    async def test_returns_empty_when_no_positions(self):
        app = _make_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/positions")
        assert resp.status_code == 200
        data = resp.json()
        assert "positions" in data
        assert data["count"] == 0

    @pytest.mark.anyio
    async def test_returns_positions_from_service(self):
        app = _make_app()
        qs = app.state.query_service
        qs._positions = [
            {"instrumentID": "IF2608", "position": 5},
            {"instrumentID": "au2506", "position": 10},
        ]
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/positions")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        assert data["positions"][0]["instrumentID"] == "IF2608"


# ── GET /api/query/account ──────────────────────────────────────────────


class TestGetAccount:
    """GET /api/query/account."""

    @pytest.mark.anyio
    async def test_returns_default_when_no_account(self):
        app = _make_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/account")
        assert resp.status_code == 200
        data = resp.json()
        assert data["balance"] == 0.0
        assert data["available"] == 0.0

    @pytest.mark.anyio
    async def test_returns_account_from_service(self):
        app = _make_app()
        qs = app.state.query_service
        qs._account = {
            "accountID": "user001",
            "balance": 1000000.0,
            "available": 500000.0,
        }
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/account")
        assert resp.status_code == 200
        data = resp.json()
        assert data["balance"] == 1000000.0
        assert data["available"] == 500000.0


# ── GET /api/query/orders ───────────────────────────────────────────────


class TestGetOrders:
    """GET /api/query/orders."""

    @pytest.mark.anyio
    async def test_returns_empty_when_no_orders(self):
        app = _make_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/orders")
        assert resp.status_code == 200
        data = resp.json()
        assert "orders" in data
        assert data["count"] == 0


# ── GET /api/query/trades ───────────────────────────────────────────────


class TestGetTrades:
    """GET /api/query/trades."""

    @pytest.mark.anyio
    async def test_returns_empty_when_no_trades(self):
        app = _make_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/trades")
        assert resp.status_code == 200
        data = resp.json()
        assert "trades" in data
        assert data["count"] == 0


# ── GET /api/query/contracts ────────────────────────────────────────────


class TestGetContracts:
    """GET /api/query/contracts."""

    @pytest.mark.anyio
    async def test_returns_empty_when_no_contracts(self):
        app = _make_app()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/contracts")
        assert resp.status_code == 200
        data = resp.json()
        assert "contracts" in data
        assert data["count"] == 0

    @pytest.mark.anyio
    async def test_returns_contracts_from_market_service(self):
        app = _make_app()
        ms = app.state.market_service
        ms.load_instruments([
            {"instrumentID": "IF2608", "instrumentName": "IF2608"},
            {"instrumentID": "au2506", "instrumentName": "au2506"},
        ])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/contracts")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2

    @pytest.mark.anyio
    async def test_contracts_supports_keyword_search(self):
        app = _make_app()
        ms = app.state.market_service
        ms.load_instruments([
            {"instrumentID": "IF2608", "instrumentName": "IF2608"},
            {"instrumentID": "au2506", "instrumentName": "au2506"},
        ])
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/query/contracts?keyword=IF")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["contracts"][0]["instrumentID"] == "IF2608"


# ── POST refresh endpoints ──────────────────────────────────────────────


class TestRefreshPositions:
    """POST /api/query/positions/refresh."""

    @pytest.mark.anyio
    async def test_refresh_returns_success(self):
        app = _make_app()
        # Simulate CTP callback: on_position_result sets event
        qs = app.state.query_service
        trader = app.state.trader_api

        def simulate_query():
            qs.on_position_result({"instrumentID": "IF2608", "position": 5}, None, 1, True)
            return 0

        trader.query_positions = simulate_query
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/positions/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["positions"][0]["instrumentID"] == "IF2608"

    @pytest.mark.anyio
    async def test_refresh_fails_when_not_logged_in(self):
        app = _make_app()
        app.state.trader_api.login_status = "not_logged_in"
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/positions/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "not logged in" in data["message"]

    @pytest.mark.anyio
    async def test_refresh_fails_when_no_trader(self):
        app = _make_app()
        app.state.trader_api = None
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/positions/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False


class TestRefreshAccount:
    """POST /api/query/account/refresh."""

    @pytest.mark.anyio
    async def test_refresh_returns_account(self):
        app = _make_app()
        qs = app.state.query_service
        trader = app.state.trader_api

        def simulate_query():
            qs.on_account_result({"accountID": "user001", "balance": 1000000.0}, None, 1, True)
            return 0

        trader.query_account = simulate_query
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/account/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["balance"] == 1000000.0

    @pytest.mark.anyio
    async def test_refresh_fails_when_not_logged_in(self):
        app = _make_app()
        app.state.trader_api.login_status = "not_logged_in"
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/account/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False


class TestRefreshOrders:
    """POST /api/query/orders/refresh."""

    @pytest.mark.anyio
    async def test_refresh_returns_orders(self):
        app = _make_app()
        qs = app.state.query_service
        trader = app.state.trader_api

        def simulate_query():
            qs.on_order_result({"orderRef": "1", "instrumentID": "IF2608"}, None, 1, True)
            return 0

        trader.query_orders = simulate_query
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/orders/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1

    @pytest.mark.anyio
    async def test_refresh_fails_when_not_logged_in(self):
        app = _make_app()
        app.state.trader_api.login_status = "not_logged_in"
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/orders/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False


class TestRefreshTrades:
    """POST /api/query/trades/refresh."""

    @pytest.mark.anyio
    async def test_refresh_returns_trades(self):
        app = _make_app()
        qs = app.state.query_service
        trader = app.state.trader_api

        def simulate_query():
            qs.on_trade_result({"tradeID": "T1", "instrumentID": "IF2608"}, None, 1, True)
            return 0

        trader.query_trades = simulate_query
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/trades/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1

    @pytest.mark.anyio
    async def test_refresh_fails_when_not_logged_in(self):
        app = _make_app()
        app.state.trader_api.login_status = "not_logged_in"
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/query/trades/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False

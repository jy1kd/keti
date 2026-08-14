"""Integration tests for api/market.py — market data REST API."""

import tempfile
import os
from unittest.mock import patch

import pytest
from httpx import AsyncClient, ASGITransport
from fastapi import FastAPI

from api.market import router as market_router
from services.market_service import MarketService


# ── Test fixtures ───────────────────────────────────────────────────────

SAMPLE_INSTRUMENTS = [
    {
        "instrumentID": "IF2608",
        "instrumentName": "沪深300指数期货2608",
        "exchangeID": "CFFEX",
        "productID": "IF",
        "productClass": "1",
        "volumeMultiple": 300,
        "priceTick": 0.2,
        "expireDate": "20260821",
        "isTrading": 1,
    },
    {
        "instrumentID": "IF2609",
        "instrumentName": "沪深300指数期货2609",
        "exchangeID": "CFFEX",
        "productID": "IF",
        "productClass": "1",
        "volumeMultiple": 300,
        "priceTick": 0.2,
        "expireDate": "20260918",
        "isTrading": 1,
    },
    {
        "instrumentID": "au2608",
        "instrumentName": "黄金2608",
        "exchangeID": "SHFE",
        "productID": "au",
        "productClass": "1",
        "volumeMultiple": 1000,
        "priceTick": 0.02,
        "expireDate": "20260815",
        "isTrading": 1,
    },
]


def _make_test_app() -> FastAPI:
    """Build a test FastAPI app with market router and MarketService state."""
    app = FastAPI()
    app.include_router(market_router, prefix="/api/market")
    market_service = MarketService()
    market_service.load_instruments(SAMPLE_INSTRUMENTS)
    app.state.market_service = market_service
    return app


@pytest.fixture
def app():
    return _make_test_app()


# ── Instruments endpoint ────────────────────────────────────────────────

class TestGetInstruments:
    """GET /api/market/instruments"""

    @pytest.mark.asyncio
    async def test_returns_all_instruments(self, app):
        """Without keyword, returns all instruments."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 3
        assert len(data["instruments"]) == 3

    @pytest.mark.asyncio
    async def test_search_by_keyword(self, app):
        """With keyword, returns filtered results."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments", params={"keyword": "IF"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        ids = {inst["instrumentID"] for inst in data["instruments"]}
        assert ids == {"IF2608", "IF2609"}

    @pytest.mark.asyncio
    async def test_search_no_match(self, app):
        """No-match keyword returns empty list."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments", params={"keyword": "ZZZZZ"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0
        assert data["instruments"] == []

    @pytest.mark.asyncio
    async def test_returns_camelcase_fields(self, app):
        """Response uses camelCase field names."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments", params={"keyword": "IF2608"})
        assert resp.status_code == 200
        inst = resp.json()["instruments"][0]
        assert "instrumentID" in inst
        assert "instrumentName" in inst
        assert "volumeMultiple" in inst
        assert "priceTick" in inst


# ── Subscribe endpoint ──────────────────────────────────────────────────

class TestSubscribe:
    """POST /api/market/subscribe"""

    @pytest.mark.asyncio
    async def test_subscribe_success(self, app):
        """Subscribing valid instruments succeeds."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/market/subscribe",
                json={"instruments": ["IF2608", "IF2609"]},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["added"] == 2

    @pytest.mark.asyncio
    async def test_subscribe_returns_already_subscribed(self, app):
        """Re-subscribing reports already subscribed."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post("/api/market/subscribe", json={"instruments": ["IF2608"]})
            resp = await client.post(
                "/api/market/subscribe",
                json={"instruments": ["IF2608", "IF2609"]},
            )
        data = resp.json()
        assert data["added"] == 1
        assert data["alreadySubscribed"] == ["IF2608"]

    @pytest.mark.asyncio
    async def test_subscribe_missing_instruments_field(self, app):
        """Missing 'instruments' in body returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/subscribe", json={})
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_subscribe_empty_list_rejected(self, app):
        """Empty instruments list is rejected (min_length=1)."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/market/subscribe",
                json={"instruments": []},
            )
        assert resp.status_code == 422

    @pytest.mark.asyncio
    async def test_subscribe_limit_exceeded(self, app):
        """Exceeding 500 limit returns error."""
        transport = ASGITransport(app=app)
        many = [f"IF{2600 + i:04d}" for i in range(500)]
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post("/api/market/subscribe", json={"instruments": many})
            resp = await client.post(
                "/api/market/subscribe",
                json={"instruments": ["IF9999"]},
            )
        data = resp.json()
        assert data["success"] is False
        assert "limit" in data.get("message", "").lower()


# ── Unsubscribe endpoint ────────────────────────────────────────────────

class TestUnsubscribe:
    """POST /api/market/unsubscribe"""

    @pytest.mark.asyncio
    async def test_unsubscribe_success(self, app):
        """Unsubscribing subscribed instruments succeeds."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            await client.post("/api/market/subscribe", json={"instruments": ["IF2608", "IF2609"]})
            resp = await client.post(
                "/api/market/unsubscribe",
                json={"instruments": ["IF2608"]},
            )
        data = resp.json()
        assert data["success"] is True
        assert data["removed"] == 1

    @pytest.mark.asyncio
    async def test_unsubscribe_not_subscribed(self, app):
        """Unsubscribing untracked instruments is safe."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post(
                "/api/market/unsubscribe",
                json={"instruments": ["ZZZZZ"]},
            )
        data = resp.json()
        assert data["removed"] == 0

    @pytest.mark.asyncio
    async def test_unsubscribe_missing_instruments_field(self, app):
        """Missing 'instruments' in body returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/unsubscribe", json={})
        assert resp.status_code == 422


# ── Snapshots endpoint ──────────────────────────────────────────────────

class TestGetSnapshots:
    """GET /api/market/snapshots"""

    @pytest.mark.asyncio
    async def test_snapshots_empty_by_default(self, app):
        """No snapshots yet returns empty object."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/snapshots")
        assert resp.status_code == 200
        data = resp.json()
        assert data["snapshots"] == {}

    @pytest.mark.asyncio
    async def test_snapshots_filter_by_instruments(self, app):
        """Can filter snapshots by instrument IDs."""
        svc: MarketService = app.state.market_service
        svc.update_snapshot({"instrumentID": "IF2608", "lastPrice": 3850.0})
        svc.update_snapshot({"instrumentID": "IF2609", "lastPrice": 3860.0})

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/market/snapshots",
                params={"instruments": "IF2608"},
            )
        assert resp.status_code == 200
        data = resp.json()
        snaps = data["snapshots"]
        assert "IF2608" in snaps
        assert "IF2609" not in snaps
        assert snaps["IF2608"]["lastPrice"] == 3850.0

    @pytest.mark.asyncio
    async def test_snapshots_all(self, app):
        """Without filter, returns all snapshots."""
        svc: MarketService = app.state.market_service
        svc.update_snapshot({"instrumentID": "IF2608", "lastPrice": 3850.0})
        svc.update_snapshot({"instrumentID": "IF2609", "lastPrice": 3860.0})

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/snapshots")
        assert resp.status_code == 200
        snaps = resp.json()["snapshots"]
        assert len(snaps) == 2


# ── K-line endpoint ─────────────────────────────────────────────────────

class TestGetKline:
    """GET /api/market/kline"""

    @pytest.mark.asyncio
    async def test_kline_returns_empty_list_initially(self, app):
        """K-line endpoint returns empty data (placeholder until CTP K-line)."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/market/kline",
                params={"instrument": "IF2608", "period": "1m"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert "instrumentID" in data
        assert data["instrumentID"] == "IF2608"
        assert data["period"] == "1m"
        assert isinstance(data["bars"], list)

    @pytest.mark.asyncio
    async def test_kline_missing_params_returns_422(self, app):
        """Missing required params returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/kline")
        assert resp.status_code == 422


# ── Depth endpoint ──────────────────────────────────────────────────────

class TestGetDepth:
    """GET /api/market/depth"""

    @pytest.mark.asyncio
    async def test_depth_returns_snapshot_depth(self, app):
        """Depth endpoint returns bid/ask depth from snapshot."""
        svc: MarketService = app.state.market_service
        svc.update_snapshot({
            "instrumentID": "IF2608",
            "lastPrice": 3850.0,
            "bidPrice1": 3849.8, "bidVolume1": 10,
            "bidPrice2": 3849.6, "bidVolume2": 5,
            "askPrice1": 3850.2, "askVolume1": 3,
            "askPrice2": 3850.4, "askVolume2": 2,
        })

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/market/depth",
                params={"instrument": "IF2608"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["instrumentID"] == "IF2608"
        # depth 返回快照中实际存在的档位（播种 2 档，非固定 5 档）
        assert len(data["bids"]) == 2
        assert len(data["asks"]) == 2
        assert data["bids"][0]["price"] == 3849.8
        assert data["bids"][0]["volume"] == 10
        assert data["asks"][0]["price"] == 3850.2
        assert data["asks"][0]["volume"] == 3

    @pytest.mark.asyncio
    async def test_depth_unknown_instrument(self, app):
        """Depth for unknown instrument returns empty arrays."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get(
                "/api/market/depth",
                params={"instrument": "ZZZZZ"},
            )
        assert resp.status_code == 200
        data = resp.json()
        assert data["instrumentID"] == "ZZZZZ"
        assert data["bids"] == []
        assert data["asks"] == []

    @pytest.mark.asyncio
    async def test_depth_missing_instrument_returns_422(self, app):
        """Missing required instrument param returns 422."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/depth")
        assert resp.status_code == 422


# ── Instruments refresh endpoint (PR-19) ───────────────────────────────

def _make_app_with_trader(trader_api=None) -> FastAPI:
    """Build a test FastAPI app with market router and optional trader_api."""
    app = FastAPI()
    app.include_router(market_router, prefix="/api/market")
    market_service = MarketService()
    market_service.load_instruments(SAMPLE_INSTRUMENTS)
    app.state.market_service = market_service
    if trader_api is not None:
        app.state.trader_api = trader_api
    return app


class TestInstrumentsRefresh:
    """POST /api/market/instruments/refresh"""

    @pytest.mark.asyncio
    async def test_refresh_returns_started(self):
        """Refresh returns {status: 'started'} when trader is logged in."""
        class MockTraderApi:
            login_status = "logged_in"
            connection_status = "connected"
            def query_instruments(self):
                return 0

        app = _make_app_with_trader(MockTraderApi())
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/instruments/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "started"

    @pytest.mark.asyncio
    async def test_refresh_fails_without_trader(self):
        """Refresh fails when trader_api is not available."""
        app = _make_app_with_trader()
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/instruments/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False

    @pytest.mark.asyncio
    async def test_refresh_fails_when_not_logged_in(self):
        """Refresh fails when trader is not logged in."""
        class MockTraderApi:
            login_status = "not_logged_in"
            connection_status = "connected"

        app = _make_app_with_trader(MockTraderApi())
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/instruments/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "not logged in" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_refresh_fails_when_query_fails(self):
        """Refresh fails when query_instruments returns negative."""
        class MockTraderApi:
            login_status = "logged_in"
            connection_status = "connected"
            def query_instruments(self):
                return -1

        app = _make_app_with_trader(MockTraderApi())
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/instruments/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is False
        assert "query failed" in data["message"].lower()


# ── Instrument search endpoints ──────────────────────────────────────

class TestGetExchanges:
    """GET /api/market/instruments/exchanges"""

    @pytest.mark.asyncio
    async def test_returns_exchanges(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/exchanges")
        assert resp.status_code == 200
        data = resp.json()
        assert set(data["exchanges"]) == {"CFFEX", "SHFE"}


class TestGetProducts:
    """GET /api/market/instruments/products"""

    @pytest.mark.asyncio
    async def test_returns_products_for_exchange(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/products", params={"exchange": "CFFEX"})
        assert resp.status_code == 200
        data = resp.json()
        assert "IF" in data["products"]

    @pytest.mark.asyncio
    async def test_missing_exchange_returns_422(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/products")
        assert resp.status_code == 422


class TestSearchInstruments:
    """GET /api/market/instruments/search"""

    @pytest.mark.asyncio
    async def test_search_by_exchange_and_product(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/search", params={"exchange": "CFFEX", "product": "IF"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2

    @pytest.mark.asyncio
    async def test_search_with_keyword(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/search", params={"exchange": "CFFEX", "product": "IF", "keyword": "2608"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 1
        assert data["instruments"][0]["instrumentID"] == "IF2608"

    @pytest.mark.asyncio
    async def test_missing_params_returns_422(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments/search")
        assert resp.status_code == 422


class TestGetInstrumentsByIds:
    """GET /api/market/instruments?ids=X,Y,Z"""

    @pytest.mark.asyncio
    async def test_returns_matching_instruments(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments", params={"ids": "IF2608,au2608"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2
        ids = {inst["instrumentID"] for inst in data["instruments"]}
        assert ids == {"IF2608", "au2608"}

    @pytest.mark.asyncio
    async def test_ids_empty_string_returns_all(self, app):
        """Without ids param, returns all instruments (existing behavior)."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/instruments")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 3


# ── Preset endpoints ─────────────────────────────────────────────────

class TestPreset:
    """GET /api/market/preset and POST /api/market/preset/refresh"""

    @pytest.fixture(autouse=True)
    def _isolate_preset_file(self):
        """Redirect preset_instruments.json writes to a temp directory."""
        from pathlib import Path as RealPath

        tmp_dir = tempfile.mkdtemp()
        tmp_data = os.path.join(tmp_dir, "server", "data")
        os.makedirs(tmp_data, exist_ok=True)

        _PathType = type(RealPath("."))

        class _FakePath(_PathType):
            """Path subclass that redirects preset_instruments.json to temp dir."""

            def __new__(cls, *args, **kwargs):
                return _PathType.__new__(cls, *args, **kwargs)

            def __init__(self, *args, **kwargs):
                pass  # skip Path.__init__ signature check

            @property
            def parent(self):
                return self  # no-op; all .parent chains return self

            def __truediv__(self, key):
                if key == "preset_instruments.json":
                    return RealPath(tmp_data) / key
                return super().__truediv__(key)

        def _make_path(*args, **kwargs):
            return _FakePath(*args, **kwargs)

        p = patch("services.market_service.Path", side_effect=_make_path)
        p.start()
        yield
        p.stop()

    @pytest.mark.asyncio
    async def test_get_preset_returns_empty_initially(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.get("/api/market/preset")
        assert resp.status_code == 200
        data = resp.json()
        assert "instruments" in data

    @pytest.mark.asyncio
    async def test_refresh_preset(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.post("/api/market/preset/refresh")
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert isinstance(data["instruments"], list)
        assert len(data["instruments"]) == 2
        # IF2608 (front-month for IF, nearest expireDate) and au2608 (only au)
        assert set(data["instruments"]) == {"IF2608", "au2608"}

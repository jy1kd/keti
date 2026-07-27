"""Tests for options API endpoints — /api/market/options, /option_chain, /volatility."""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from unittest.mock import MagicMock
from api.market import router
from services.options_service import OptionsService
from services.market_service import MarketService


def _make_instrument(
    instrument_id: str,
    product_class: str = "1",
    options_type: str = "",
    strike_price: float = 0.0,
    underlying_id: str = "",
    expire_date: str = "20261016",
) -> dict:
    return {
        "instrumentID": instrument_id,
        "instrumentName": instrument_id,
        "exchangeID": "CFFEX",
        "productID": "IF",
        "productClass": product_class,
        "volumeMultiple": 300,
        "priceTick": 0.2,
        "expireDate": expire_date,
        "isTrading": 1,
        "optionsType": options_type,
        "strikePrice": strike_price,
        "underlyingInstrID": underlying_id,
        "underlyingMultiple": 1.0,
    }


def _create_app():
    """Create test app with market router and mocked services."""
    app = FastAPI()
    app.include_router(router, prefix="/api/market")

    # Mock MarketService
    market_svc = MagicMock(spec=MarketService)
    instruments = [
        _make_instrument("IF2610", product_class="1"),
        _make_instrument("c2610-C-3900", product_class="2", options_type="1", strike_price=3900.0, underlying_id="IF2610"),
        _make_instrument("c2610-P-3900", product_class="2", options_type="2", strike_price=3900.0, underlying_id="IF2610"),
    ]
    market_svc.get_instruments.return_value = instruments
    market_svc.get_all_snapshots.return_value = [
        {"instrumentID": "c2610-C-3900", "lastPrice": 120.5},
        {"instrumentID": "IF2610", "lastPrice": 3950.0},
    ]

    # Real OptionsService
    options_svc = OptionsService()

    app.state.market_service = market_svc
    app.state.options_service = options_svc

    return app


class TestOptionsListAPI:
    """GET /api/market/options 测试。"""

    def test_get_options(self):
        """获取期权合约列表。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/options")
        assert resp.status_code == 200
        data = resp.json()
        assert "options" in data
        assert data["count"] == 2

    def test_get_options_by_underlying(self):
        """按标的合约筛选。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/options?underlying=IF2610")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 2

    def test_get_options_empty(self):
        """无期权合约时返回空列表。"""
        app = _create_app()
        client = TestClient(app)
        app.state.market_service.get_instruments.return_value = [
            _make_instrument("IF2610", product_class="1"),
        ]
        resp = client.get("/api/market/options")
        assert resp.status_code == 200
        data = resp.json()
        assert data["count"] == 0


class TestOptionUnderlyingsAPI:
    """GET /api/market/options/underlyings 测试。"""

    def test_get_option_underlyings(self):
        """获取期权标的列表。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/options/underlyings")
        assert resp.status_code == 200
        data = resp.json()
        assert "underlyings" in data
        assert "IF2610" in data["underlyings"]

    def test_get_option_underlyings_empty(self):
        """无期权合约时返回空列表。"""
        app = _create_app()
        client = TestClient(app)
        app.state.market_service.get_instruments.return_value = [
            _make_instrument("IF2610", product_class="1"),
        ]
        resp = client.get("/api/market/options/underlyings")
        assert resp.status_code == 200
        data = resp.json()
        assert data["underlyings"] == []

    def test_get_option_underlyings_sorted(self):
        """返回的标的列表已排序。"""
        app = _create_app()
        client = TestClient(app)
        # Add more instruments with different underlyings
        app.state.market_service.get_instruments.return_value = [
            _make_instrument("IC2610", product_class="1"),
            _make_instrument("IF2610", product_class="1"),
            _make_instrument("opt1", product_class="2", options_type="1", underlying_id="IC2610"),
            _make_instrument("opt2", product_class="2", options_type="1", underlying_id="IF2610"),
            _make_instrument("opt3", product_class="2", options_type="1", underlying_id="IH2610"),
        ]
        resp = client.get("/api/market/options/underlyings")
        data = resp.json()
        assert data["underlyings"] == ["IC2610", "IF2610", "IH2610"]


class TestOptionChainAPI:
    """GET /api/market/option_chain 测试。"""

    def test_get_option_chain(self):
        """获取期权链。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/option_chain")
        assert resp.status_code == 200
        data = resp.json()
        assert "chains" in data
        assert len(data["chains"]) == 1
        assert data["chains"][0]["underlying"] == "IF2610"

    def test_get_option_chain_by_underlying(self):
        """按标的合约筛选期权链。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/option_chain?underlying=IF2610")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["chains"]) == 1

    def test_get_option_chain_by_expire_date(self):
        """按到期日筛选期权链。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/option_chain?expire_date=20261016")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["chains"]) == 1

    def test_get_option_chain_calls_puts_separated(self):
        """calls 和 puts 正确分离。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/option_chain")
        data = resp.json()
        chain = data["chains"][0]
        assert len(chain["calls"]) == 1
        assert len(chain["puts"]) == 1
        assert chain["calls"][0]["optionType"] == "1"
        assert chain["puts"][0]["optionType"] == "2"


class TestVolatilityAPI:
    """GET /api/market/volatility 测试。"""

    def test_get_volatility(self):
        """获取隐含波动率数据。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/volatility")
        assert resp.status_code == 200
        data = resp.json()
        assert "volatility" in data
        assert len(data["volatility"]) == 1
        assert data["volatility"][0]["instrumentID"] == "c2610-C-3900"
        assert "impliedVolatility" in data["volatility"][0]

    def test_get_volatility_by_underlying(self):
        """按标的合约筛选。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/volatility?underlying=IF2610")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["volatility"]) == 1

    def test_get_volatility_missing_snapshot(self):
        """缺少快照数据时返回空列表。"""
        app = _create_app()
        client = TestClient(app)
        app.state.market_service.get_all_snapshots.return_value = []
        resp = client.get("/api/market/volatility")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["volatility"]) == 0

    def test_get_volatility_custom_risk_free_rate(self):
        """自定义无风险利率。"""
        app = _create_app()
        client = TestClient(app)
        resp = client.get("/api/market/volatility?risk_free_rate=0.05")
        assert resp.status_code == 200
        data = resp.json()
        assert data["volatility"][0]["riskFreeRate"] == 0.05

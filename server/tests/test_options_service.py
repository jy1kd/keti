"""Tests for OptionsService — option filtering, chain aggregation, Black-Scholes IV."""

import pytest
import sys
import os
import math

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.options_service import OptionsService
from models.contract import InstrumentInfo


def _make_instrument(
    instrument_id: str,
    product_class: str = "1",  # "1"=futures, "2"=options
    options_type: str = "",  # "1"=call, "2"=put
    strike_price: float = 0.0,
    underlying_id: str = "",
    expire_date: str = "20261016",
) -> dict:
    """Create a minimal instrument dict."""
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


def _make_futures(instrument_id: str, expire_date: str = "20261016") -> dict:
    return _make_instrument(instrument_id, product_class="1", expire_date=expire_date)


def _make_call(instrument_id: str, strike: float, underlying: str, expire_date: str = "20261016") -> dict:
    return _make_instrument(
        instrument_id, product_class="2", options_type="1",
        strike_price=strike, underlying_id=underlying, expire_date=expire_date,
    )


def _make_put(instrument_id: str, strike: float, underlying: str, expire_date: str = "20261016") -> dict:
    return _make_instrument(
        instrument_id, product_class="2", options_type="2",
        strike_price=strike, underlying_id=underlying, expire_date=expire_date,
    )


class TestOptionsServiceFilter:
    """期权合约筛选。"""

    def test_filter_options_only(self):
        """只返回 productClass='2' 的期权合约。"""
        svc = OptionsService()
        instruments = [
            _make_futures("IF2610"),
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
            _make_put("c2610-P-3900", 3900.0, "IF2610"),
        ]
        result = svc.get_options(instruments)
        assert len(result) == 2
        assert all(r["productClass"] == "2" for r in result)

    def test_filter_empty_list(self):
        """空列表返回空结果。"""
        svc = OptionsService()
        assert svc.get_options([]) == []

    def test_filter_no_options(self):
        """没有期权合约时返回空列表。"""
        svc = OptionsService()
        instruments = [_make_futures("IF2610"), _make_futures("IF2612")]
        assert svc.get_options(instruments) == []

    def test_filter_with_underlying(self):
        """按标的合约筛选。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
            _make_call("c2612-C-4000", 4000.0, "IF2612"),
        ]
        result = svc.get_options(instruments, underlying="IF2610")
        assert len(result) == 1
        assert result[0]["instrumentID"] == "c2610-C-3900"


class TestOptionsServiceChainAggregation:
    """期权链聚合。"""

    def test_aggregate_single_chain(self):
        """按标的+到期日聚合为单个期权链。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610", "20261016"),
            _make_call("c2610-C-4000", 4000.0, "IF2610", "20261016"),
            _make_put("c2610-P-3900", 3900.0, "IF2610", "20261016"),
        ]
        chains = svc.get_option_chains(instruments)
        assert len(chains) == 1
        assert chains[0]["underlying"] == "IF2610"
        assert chains[0]["expireDate"] == "20261016"
        assert len(chains[0]["calls"]) == 2
        assert len(chains[0]["puts"]) == 1

    def test_aggregate_multiple_chains(self):
        """不同到期日期产生多个期权链。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610", "20261016"),
            _make_call("c2612-C-4000", 4000.0, "IF2612", "20261219"),
        ]
        chains = svc.get_option_chains(instruments)
        assert len(chains) == 2

    def test_calls_and_puts_separated(self):
        """看涨/看跌正确分类。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
            _make_call("c2610-C-4000", 4000.0, "IF2610"),
            _make_put("c2610-P-3900", 3900.0, "IF2610"),
            _make_put("c2610-P-4000", 4000.0, "IF2610"),
        ]
        chains = svc.get_option_chains(instruments)
        assert len(chains[0]["calls"]) == 2
        assert len(chains[0]["puts"]) == 2

    def test_calls_sorted_by_strike(self):
        """calls 按行权价升序排列。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-4000", 4000.0, "IF2610"),
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
            _make_call("c2610-C-3800", 3800.0, "IF2610"),
        ]
        chains = svc.get_option_chains(instruments)
        strikes = [c["strikePrice"] for c in chains[0]["calls"]]
        assert strikes == [3800.0, 3900.0, 4000.0]

    def test_puts_sorted_by_strike(self):
        """puts 按行权价升序排列。"""
        svc = OptionsService()
        instruments = [
            _make_put("c2610-P-4000", 4000.0, "IF2610"),
            _make_put("c2610-P-3900", 3900.0, "IF2610"),
            _make_put("c2610-P-3800", 3800.0, "IF2610"),
        ]
        chains = svc.get_option_chains(instruments)
        strikes = [p["strikePrice"] for p in chains[0]["puts"]]
        assert strikes == [3800.0, 3900.0, 4000.0]

    def test_chain_by_underlying_filter(self):
        """按标的合约筛选期权链。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
            _make_call("c2612-C-4000", 4000.0, "IF2612"),
        ]
        chains = svc.get_option_chains(instruments, underlying="IF2610")
        assert len(chains) == 1
        assert chains[0]["underlying"] == "IF2610"

    def test_chain_by_expire_date_filter(self):
        """按到期日筛选期权链。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610", "20261016"),
            _make_call("c2610-C-3900-12", 3900.0, "IF2610", "20261219"),
        ]
        chains = svc.get_option_chains(instruments, expire_date="20261016")
        assert len(chains) == 1
        assert chains[0]["expireDate"] == "20261016"


class TestBlackScholes:
    """Black-Scholes 隐含波动率计算。"""

    def test_call_implied_volatility(self):
        """计算看涨期权隐含波动率。"""
        svc = OptionsService()
        # S=3950, K=3900, T=0.5, r=0.03, call_price=120.5
        iv = svc.calculate_implied_volatility(
            option_price=120.5,
            underlying_price=3950.0,
            strike_price=3900.0,
            time_to_expiry=0.5,
            risk_free_rate=0.03,
            option_type="1",
        )
        # IV should be positive and reasonable
        assert iv > 0.0
        assert isinstance(iv, float)

    def test_put_implied_volatility(self):
        """计算看跌期权隐含波动率。"""
        svc = OptionsService()
        iv = svc.calculate_implied_volatility(
            option_price=80.0,
            underlying_price=3950.0,
            strike_price=3900.0,
            time_to_expiry=0.5,
            risk_free_rate=0.03,
            option_type="2",
        )
        assert 0.1 < iv < 0.5

    def test_implied_volatility_returns_float(self):
        """返回值为浮点数。"""
        svc = OptionsService()
        iv = svc.calculate_implied_volatility(
            option_price=100.0,
            underlying_price=3950.0,
            strike_price=3900.0,
            time_to_expiry=0.5,
            risk_free_rate=0.03,
            option_type="1",
        )
        assert isinstance(iv, float)

    def test_implied_volatility_no_solution(self):
        """价格为0时返回 0。"""
        svc = OptionsService()
        # Price = 0 should return 0
        iv = svc.calculate_implied_volatility(
            option_price=0.0,
            underlying_price=3950.0,
            strike_price=3900.0,
            time_to_expiry=0.5,
            risk_free_rate=0.03,
            option_type="1",
        )
        assert iv == 0.0

    def test_black_scholes_call_price(self):
        """Black-Scholes 看涨期权定价验证。"""
        svc = OptionsService()
        # S=100, K=100, T=1, r=0.05, sigma=0.2
        # Known result: C ≈ 10.45
        price = svc._black_scholes_price(
            s=100, k=100, t=1.0, r=0.05, sigma=0.2, option_type="1"
        )
        assert abs(price - 10.45) < 0.5

    def test_black_scholes_put_price(self):
        """Black-Scholes 看跌期权定价验证。"""
        svc = OptionsService()
        # S=100, K=100, T=1, r=0.05, sigma=0.2
        # Known result: P ≈ 5.57
        price = svc._black_scholes_price(
            s=100, k=100, t=1.0, r=0.05, sigma=0.2, option_type="2"
        )
        assert abs(price - 5.57) < 0.5


class TestOptionsServiceGetVolatility:
    """get_volatility 集成测试。"""

    def test_get_volatility_returns_data(self):
        """返回 VolatilityData 列表。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
        ]
        snapshots = {
            "c2610-C-3900": {"lastPrice": 120.5},
            "IF2610": {"lastPrice": 3950.0},
        }
        result = svc.get_volatility(instruments, snapshots, risk_free_rate=0.03)
        assert len(result) == 1
        assert result[0]["instrumentID"] == "c2610-C-3900"
        assert "impliedVolatility" in result[0]

    def test_get_volatility_missing_snapshot(self):
        """缺少快照数据时跳过该期权。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
        ]
        snapshots = {}  # No snapshot
        result = svc.get_volatility(instruments, snapshots)
        assert len(result) == 0

    def test_get_volatility_by_underlying(self):
        """按标的合约筛选。"""
        svc = OptionsService()
        instruments = [
            _make_call("c2610-C-3900", 3900.0, "IF2610"),
            _make_call("c2612-C-4000", 4000.0, "IF2612"),
        ]
        snapshots = {
            "c2610-C-3900": {"lastPrice": 120.5},
            "c2612-C-4000": {"lastPrice": 100.0},
            "IF2610": {"lastPrice": 3950.0},
            "IF2612": {"lastPrice": 4050.0},
        }
        result = svc.get_volatility(instruments, snapshots, underlying="IF2610")
        assert len(result) == 1
        assert result[0]["instrumentID"] == "c2610-C-3900"

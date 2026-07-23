"""Tests for options data models (OptionChain, OptionQuote, VolatilityData)."""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.options import OptionChain, OptionQuote, VolatilityData


class TestOptionQuote:
    """OptionQuote 单个期权报价模型。"""

    def test_create_call_quote(self):
        """创建看涨期权报价。"""
        quote = OptionQuote(
            instrumentID="c2610-C-3900",
            strikePrice=3900.0,
            optionType="1",  # 看涨
            lastPrice=120.5,
            bidPrice=118.0,
            askPrice=123.0,
            volume=500,
            openInterest=2000,
            impliedVolatility=0.25,
        )
        assert quote.instrumentID == "c2610-C-3900"
        assert quote.strikePrice == 3900.0
        assert quote.optionType == "1"
        assert quote.lastPrice == 120.5

    def test_create_put_quote(self):
        """创建看跌期权报价。"""
        quote = OptionQuote(
            instrumentID="c2610-P-3900",
            strikePrice=3900.0,
            optionType="2",  # 看跌
            lastPrice=80.0,
            bidPrice=78.0,
            askPrice=82.0,
            volume=300,
            openInterest=1500,
            impliedVolatility=0.22,
        )
        assert quote.optionType == "2"

    def test_to_dict(self):
        """序列化为字典。"""
        quote = OptionQuote(
            instrumentID="c2610-C-3900",
            strikePrice=3900.0,
            optionType="1",
            lastPrice=120.5,
            bidPrice=118.0,
            askPrice=123.0,
            volume=500,
            openInterest=2000,
            impliedVolatility=0.25,
        )
        d = quote.to_dict()
        assert d["instrumentID"] == "c2610-C-3900"
        assert d["strikePrice"] == 3900.0
        assert d["optionType"] == "1"
        assert d["impliedVolatility"] == 0.25

    def test_from_dict(self):
        """从字典反序列化。"""
        d = {
            "instrumentID": "c2610-C-3900",
            "strikePrice": 3900.0,
            "optionType": "1",
            "lastPrice": 120.5,
            "bidPrice": 118.0,
            "askPrice": 123.0,
            "volume": 500,
            "openInterest": 2000,
            "impliedVolatility": 0.25,
        }
        quote = OptionQuote.from_dict(d)
        assert quote.instrumentID == "c2610-C-3900"
        assert quote.impliedVolatility == 0.25


class TestOptionChain:
    """OptionChain 期权链模型。"""

    def test_create_option_chain(self):
        """创建期权链。"""
        chain = OptionChain(
            underlying="IF2610",
            expireDate="20261016",
            calls=[
                OptionQuote("c2610-C-3900", 3900.0, "1", 120.5, 118.0, 123.0, 500, 2000, 0.25),
            ],
            puts=[
                OptionQuote("c2610-P-3900", 3900.0, "2", 80.0, 78.0, 82.0, 300, 1500, 0.22),
            ],
        )
        assert chain.underlying == "IF2610"
        assert chain.expireDate == "20261016"
        assert len(chain.calls) == 1
        assert len(chain.puts) == 1

    def test_to_dict(self):
        """序列化为字典。"""
        chain = OptionChain(
            underlying="IF2610",
            expireDate="20261016",
            calls=[OptionQuote("c2610-C-3900", 3900.0, "1", 120.5, 118.0, 123.0, 500, 2000, 0.25)],
            puts=[OptionQuote("c2610-P-3900", 3900.0, "2", 80.0, 78.0, 82.0, 300, 1500, 0.22)],
        )
        d = chain.to_dict()
        assert d["underlying"] == "IF2610"
        assert d["expireDate"] == "20261016"
        assert len(d["calls"]) == 1
        assert len(d["puts"]) == 1

    def test_from_dict(self):
        """从字典反序列化。"""
        d = {
            "underlying": "IF2610",
            "expireDate": "20261016",
            "calls": [
                {"instrumentID": "c2610-C-3900", "strikePrice": 3900.0, "optionType": "1",
                 "lastPrice": 120.5, "bidPrice": 118.0, "askPrice": 123.0,
                 "volume": 500, "openInterest": 2000, "impliedVolatility": 0.25},
            ],
            "puts": [
                {"instrumentID": "c2610-P-3900", "strikePrice": 3900.0, "optionType": "2",
                 "lastPrice": 80.0, "bidPrice": 78.0, "askPrice": 82.0,
                 "volume": 300, "openInterest": 1500, "impliedVolatility": 0.22},
            ],
        }
        chain = OptionChain.from_dict(d)
        assert chain.underlying == "IF2610"
        assert len(chain.calls) == 1
        assert len(chain.puts) == 1

    def test_empty_chain(self):
        """空期权链。"""
        chain = OptionChain(underlying="IF2610", expireDate="20261016", calls=[], puts=[])
        d = chain.to_dict()
        assert d["calls"] == []
        assert d["puts"] == []


class TestVolatilityData:
    """VolatilityData 波动率数据模型。"""

    def test_create_volatility_data(self):
        """创建波动率数据。"""
        vol = VolatilityData(
            instrumentID="c2610-C-3900",
            impliedVolatility=0.25,
            underlyingPrice=3950.0,
            strikePrice=3900.0,
            timeToExpiry=0.5,  # 半年
            riskFreeRate=0.03,
            optionType="1",
        )
        assert vol.impliedVolatility == 0.25
        assert vol.underlyingPrice == 3950.0

    def test_to_dict(self):
        """序列化为字典。"""
        vol = VolatilityData(
            instrumentID="c2610-C-3900",
            impliedVolatility=0.25,
            underlyingPrice=3950.0,
            strikePrice=3900.0,
            timeToExpiry=0.5,
            riskFreeRate=0.03,
            optionType="1",
        )
        d = vol.to_dict()
        assert d["instrumentID"] == "c2610-C-3900"
        assert d["impliedVolatility"] == 0.25
        assert d["optionType"] == "1"

    def test_from_dict(self):
        """从字典反序列化。"""
        d = {
            "instrumentID": "c2610-C-3900",
            "impliedVolatility": 0.25,
            "underlyingPrice": 3950.0,
            "strikePrice": 3900.0,
            "timeToExpiry": 0.5,
            "riskFreeRate": 0.03,
            "optionType": "1",
        }
        vol = VolatilityData.from_dict(d)
        assert vol.impliedVolatility == 0.25
        assert vol.underlyingPrice == 3950.0

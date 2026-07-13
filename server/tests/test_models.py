"""Tests for models/ — Pydantic data models."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


# ── Market Models ─────────────────────────────────────────────────────

class TestMarketSnapshot:
    """MarketSnapshot — CTP depth market data."""

    def test_import(self):
        from models.market import MarketSnapshot
        assert MarketSnapshot is not None

    def test_minimal_creation(self):
        from models.market import MarketSnapshot
        snap = MarketSnapshot(instrumentID="au2506", lastPrice=480.5)
        assert snap.instrumentID == "au2506"
        assert snap.lastPrice == 480.5

    def test_defaults(self):
        from models.market import MarketSnapshot
        snap = MarketSnapshot(instrumentID="au2506", lastPrice=0.0)
        assert snap.bidPrice1 == 0.0
        assert snap.volume == 0
        assert snap.openInterest == 0.0

    def test_full_depth_fields(self):
        from models.market import MarketSnapshot
        snap = MarketSnapshot(
            instrumentID="IF2607",
            lastPrice=3950.0,
            bidPrice1=3949.8, bidVolume1=10,
            bidPrice2=3949.6, bidVolume2=5,
            bidPrice3=3949.4, bidVolume3=3,
            bidPrice4=3949.2, bidVolume4=2,
            bidPrice5=3949.0, bidVolume5=1,
            askPrice1=3950.2, askVolume1=8,
            askPrice2=3950.4, askVolume2=4,
            askPrice3=3950.6, askVolume3=2,
            askPrice4=3950.8, askVolume4=1,
            askPrice5=3951.0, askVolume5=1,
            volume=1000, openInterest=50000,
        )
        assert snap.bidPrice3 == 3949.4
        assert snap.askPrice5 == 3951.0
        assert snap.bidVolume1 == 10
        assert snap.openInterest == 50000

    def test_serializes_to_dict(self):
        from models.market import MarketSnapshot
        snap = MarketSnapshot(instrumentID="au2506", lastPrice=480.0)
        d = snap.model_dump()
        assert d["instrumentID"] == "au2506"
        assert d["lastPrice"] == 480.0


class TestKLineData:
    """KLineData — candlestick bar."""

    def test_import(self):
        from models.market import KLineData
        assert KLineData is not None

    def test_creation(self):
        from models.market import KLineData
        bar = KLineData(
            instrumentID="au2506",
            period="1m",
            time="10:30:00",
            open=480.0, high=481.0, low=479.5, close=480.8,
            volume=500,
        )
        assert bar.period == "1m"
        assert bar.close == 480.8


# ── Order Models ──────────────────────────────────────────────────────

class TestOrderRequest:
    """OrderRequest — submit order input."""

    def test_import(self):
        from models.order import OrderRequest
        assert OrderRequest is not None

    def test_limit_order(self):
        from models.order import OrderRequest
        req = OrderRequest(
            instrumentID="au2506",
            direction="0",
            offsetFlag="0",
            priceType="2",
            limitPrice=480.0,
            volumeTotalOriginal=1,
        )
        assert req.direction == "0"
        assert req.priceType == "2"

    def test_market_order(self):
        from models.order import OrderRequest
        req = OrderRequest(
            instrumentID="IF2607",
            direction="1",
            offsetFlag="1",
            priceType="1",
            limitPrice=0.0,
            volumeTotalOriginal=2,
        )
        assert req.priceType == "1"
        assert req.limitPrice == 0.0


class TestOrderReturn:
    """OrderReturn — CTP order status."""

    def test_import(self):
        from models.order import OrderReturn
        assert OrderReturn is not None

    def test_creation(self):
        from models.order import OrderReturn
        ret = OrderReturn(
            instrumentID="au2506",
            orderRef="1",
            orderStatus="0",
            direction="0",
            volumeTotalOriginal=1,
            volumeTraded=0,
        )
        assert ret.orderRef == "1"
        assert ret.orderStatus == "0"


# ── Account Models ────────────────────────────────────────────────────

class TestAccountInfo:
    """AccountInfo — trading account funds."""

    def test_import(self):
        from models.account import AccountInfo
        assert AccountInfo is not None

    def test_creation(self):
        from models.account import AccountInfo
        acct = AccountInfo(
            balance=1000000.0,
            available=800000.0,
            frozenMargin=200000.0,
            currMargin=150000.0,
            closeProfit=5000.0,
            positionProfit=-2000.0,
        )
        assert acct.balance == 1000000.0
        assert acct.available == 800000.0

    def test_defaults(self):
        from models.account import AccountInfo
        acct = AccountInfo(
            balance=0.0, available=0.0, frozenMargin=0.0,
            currMargin=0.0, closeProfit=0.0, positionProfit=0.0,
        )
        assert acct.balance == 0.0


class TestPositionInfo:
    """PositionInfo — investor position."""

    def test_import(self):
        from models.account import PositionInfo
        assert PositionInfo is not None

    def test_creation(self):
        from models.account import PositionInfo
        pos = PositionInfo(
            instrumentID="au2506",
            position=2,
            posiDirection="2",
            openCost=475.0,
            positionProfit=3000.0,
        )
        assert pos.instrumentID == "au2506"
        assert pos.position == 2
        assert pos.positionProfit == 3000.0


# ── Contract Models ────────────────────────────────────────────────────

class TestInstrumentInfo:
    """InstrumentInfo — contract details."""

    def test_import(self):
        from models.contract import InstrumentInfo
        assert InstrumentInfo is not None

    def test_futures_contract(self):
        from models.contract import InstrumentInfo
        inst = InstrumentInfo(
            instrumentID="au2506",
            instrumentName="黄金2506",
            exchangeID="SHFE",
            productClass="1",
            volumeMultiple=1000,
            priceTick=0.02,
            isTrading=1,
        )
        assert inst.volumeMultiple == 1000
        assert inst.priceTick == 0.02

    def test_options_contract(self):
        from models.contract import InstrumentInfo
        inst = InstrumentInfo(
            instrumentID="au2506-C-480",
            instrumentName="黄金2506购480",
            exchangeID="SHFE",
            productClass="2",
            volumeMultiple=1000,
            priceTick=0.02,
            isTrading=1,
            optionsType="1",
            strikePrice=480.0,
            underlyingInstrID="au2506",
        )
        assert inst.optionsType == "1"
        assert inst.strikePrice == 480.0

"""Tests for services/field_mapping.py — CTP PascalCase to camelCase mapping."""

import pytest
from services.field_mapping import map_depth_market_data


# ── Mock CTP depth market data object ──────────────────────────────────

class _MockDepthMarketData:
    """Duck-type of CThostFtdcDepthMarketDataField for testing."""

    # Instrument
    InstrumentID = "IF2608"
    ExchangeID = "CFFEX"
    TradingDay = "20260713"

    # Price
    LastPrice = 3850.0
    OpenPrice = 3845.0
    HighestPrice = 3855.0
    LowestPrice = 3840.0
    ClosePrice = 3848.0
    PreClosePrice = 3840.0
    PreSettlementPrice = 3842.0
    SettlementPrice = 3842.0
    UpperLimitPrice = 4226.2
    LowerLimitPrice = 3457.8
    AveragePrice = 3847.5

    # Bid depth 1-5
    BidPrice1 = 3849.8
    BidPrice2 = 3849.6
    BidPrice3 = 3849.4
    BidPrice4 = 3849.2
    BidPrice5 = 3849.0
    BidVolume1 = 10
    BidVolume2 = 5
    BidVolume3 = 3
    BidVolume4 = 2
    BidVolume5 = 1

    # Ask depth 1-5
    AskPrice1 = 3850.2
    AskPrice2 = 3850.4
    AskPrice3 = 3850.6
    AskPrice4 = 3850.8
    AskPrice5 = 3851.0
    AskVolume1 = 5
    AskVolume2 = 3
    AskVolume3 = 2
    AskVolume4 = 1
    AskVolume5 = 1

    # Volume
    Volume = 12345
    Turnover = 47500000.0
    OpenInterest = 67890.0

    # Time
    UpdateTime = "14:30:00"
    UpdateMillisec = 500
    ActionDay = "20260713"


class TestMapDepthMarketData:
    """CTP depth market data field → camelCase dict."""

    def test_import(self):
        """map_depth_market_data should be importable."""
        assert map_depth_market_data is not None

    def test_returns_dict(self):
        """Should return a dictionary."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert isinstance(result, dict)

    def test_maps_instrument_id(self):
        """InstrumentID → instrumentID."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["instrumentID"] == "IF2608"

    def test_maps_exchange_id(self):
        """ExchangeID → exchangeID."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["exchangeID"] == "CFFEX"

    def test_maps_last_price(self):
        """LastPrice → lastPrice."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["lastPrice"] == 3850.0

    def test_maps_open_high_low_close(self):
        """OpenPrice/HighPrice/LowPrice/ClosePrice mapped correctly."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["openPrice"] == 3845.0
        assert result["highestPrice"] == 3855.0
        assert result["lowestPrice"] == 3840.0
        assert result["closePrice"] == 3848.0

    def test_maps_pre_prices(self):
        """PreClose/PreSettlement/Settlement mapped correctly."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["preClosePrice"] == 3840.0
        assert result["preSettlementPrice"] == 3842.0
        assert result["settlementPrice"] == 3842.0

    def test_maps_limit_prices(self):
        """UpperLimitPrice/LowerLimitPrice mapped correctly."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["upperLimitPrice"] == 4226.2
        assert result["lowerLimitPrice"] == 3457.8

    def test_maps_average_price(self):
        """AveragePrice → averagePrice."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["averagePrice"] == 3847.5

    def test_maps_bid_prices(self):
        """BidPrice1-5 → bidPrice1-5."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        for i in range(1, 6):
            assert result[f"bidPrice{i}"] == getattr(obj, f"BidPrice{i}")

    def test_maps_bid_volumes(self):
        """BidVolume1-5 → bidVolume1-5."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        for i in range(1, 6):
            assert result[f"bidVolume{i}"] == getattr(obj, f"BidVolume{i}")

    def test_maps_ask_prices(self):
        """AskPrice1-5 → askPrice1-5."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        for i in range(1, 6):
            assert result[f"askPrice{i}"] == getattr(obj, f"AskPrice{i}")

    def test_maps_ask_volumes(self):
        """AskVolume1-5 → askVolume1-5."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        for i in range(1, 6):
            assert result[f"askVolume{i}"] == getattr(obj, f"AskVolume{i}")

    def test_maps_volume(self):
        """Volume → volume."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["volume"] == 12345

    def test_maps_turnover(self):
        """Turnover → turnover."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["turnover"] == 47500000.0

    def test_maps_open_interest(self):
        """OpenInterest → openInterest."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["openInterest"] == 67890.0

    def test_maps_update_time(self):
        """UpdateTime → updateTime."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["updateTime"] == "14:30:00"

    def test_maps_update_millisec(self):
        """UpdateMillisec → updateMillisec."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["updateMillisec"] == 500

    def test_maps_action_day(self):
        """ActionDay → actionDay."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["actionDay"] == "20260713"

    def test_maps_trading_day(self):
        """TradingDay → tradingDay."""
        obj = _MockDepthMarketData()
        result = map_depth_market_data(obj)
        assert result["tradingDay"] == "20260713"


class TestMapDepthMarketDataEdgeCases:
    """Edge case handling in field mapping."""

    def test_zero_prices(self):
        """Zero prices map as 0.0 (not missing)."""

        class ZeroData:
            InstrumentID = "TEST"
            LastPrice = 0.0
            OpenPrice = 0.0
            HighestPrice = 0.0
            LowestPrice = 0.0
            ClosePrice = 0.0
            PreClosePrice = 0.0
            PreSettlementPrice = 0.0
            SettlementPrice = 0.0
            UpperLimitPrice = 0.0
            LowerLimitPrice = 0.0
            AveragePrice = 0.0
            BidPrice1 = 0.0
            BidPrice2 = 0.0
            BidPrice3 = 0.0
            BidPrice4 = 0.0
            BidPrice5 = 0.0
            BidVolume1 = 0
            BidVolume2 = 0
            BidVolume3 = 0
            BidVolume4 = 0
            BidVolume5 = 0
            AskPrice1 = 0.0
            AskPrice2 = 0.0
            AskPrice3 = 0.0
            AskPrice4 = 0.0
            AskPrice5 = 0.0
            AskVolume1 = 0
            AskVolume2 = 0
            AskVolume3 = 0
            AskVolume4 = 0
            AskVolume5 = 0
            Volume = 0
            Turnover = 0.0
            OpenInterest = 0.0
            UpdateTime = ""
            UpdateMillisec = 0
            ActionDay = ""
            ExchangeID = ""
            TradingDay = ""

        result = map_depth_market_data(ZeroData())
        assert result["lastPrice"] == 0.0
        assert result["bidPrice1"] == 0.0
        assert result["askPrice1"] == 0.0
        assert result["volume"] == 0

    def test_missing_attribute_defaults(self):
        """Missing CTP attributes get default values (0, 0.0, or "")."""

        class MinimalData:
            InstrumentID = "IF2608"
            LastPrice = 3850.0

        result = map_depth_market_data(MinimalData())
        assert result["instrumentID"] == "IF2608"
        assert result["lastPrice"] == 3850.0
        # Defaults
        assert result["openPrice"] == 0.0
        assert result["volume"] == 0
        assert result["updateTime"] == ""

"""CTP field mapping — PascalCase CTP objects to camelCase Python dicts.

All mapping functions use getattr() with sensible defaults so they work
with both real CTP objects (when DLL is available) and mock objects (tests).
"""

from typing import Any


# ── Depth market data (OnRtnDepthMarketData) ───────────────────────────

# Mapping table: (PascalCase attr, camelCase key, default)
_DEPTH_MARKET_DATA_FIELDS: list = [
    # Instrument
    ("InstrumentID", "instrumentID", ""),
    ("ExchangeID", "exchangeID", ""),
    ("TradingDay", "tradingDay", ""),
    # Price
    ("LastPrice", "lastPrice", 0.0),
    ("OpenPrice", "openPrice", 0.0),
    ("HighestPrice", "highestPrice", 0.0),
    ("LowestPrice", "lowestPrice", 0.0),
    ("ClosePrice", "closePrice", 0.0),
    ("PreClosePrice", "preClosePrice", 0.0),
    ("PreSettlementPrice", "preSettlementPrice", 0.0),
    ("SettlementPrice", "settlementPrice", 0.0),
    ("UpperLimitPrice", "upperLimitPrice", 0.0),
    ("LowerLimitPrice", "lowerLimitPrice", 0.0),
    ("AveragePrice", "averagePrice", 0.0),
    # Bid depth 1-5
    ("BidPrice1", "bidPrice1", 0.0),
    ("BidPrice2", "bidPrice2", 0.0),
    ("BidPrice3", "bidPrice3", 0.0),
    ("BidPrice4", "bidPrice4", 0.0),
    ("BidPrice5", "bidPrice5", 0.0),
    ("BidVolume1", "bidVolume1", 0),
    ("BidVolume2", "bidVolume2", 0),
    ("BidVolume3", "bidVolume3", 0),
    ("BidVolume4", "bidVolume4", 0),
    ("BidVolume5", "bidVolume5", 0),
    # Ask depth 1-5
    ("AskPrice1", "askPrice1", 0.0),
    ("AskPrice2", "askPrice2", 0.0),
    ("AskPrice3", "askPrice3", 0.0),
    ("AskPrice4", "askPrice4", 0.0),
    ("AskPrice5", "askPrice5", 0.0),
    ("AskVolume1", "askVolume1", 0),
    ("AskVolume2", "askVolume2", 0),
    ("AskVolume3", "askVolume3", 0),
    ("AskVolume4", "askVolume4", 0),
    ("AskVolume5", "askVolume5", 0),
    # Volume
    ("Volume", "volume", 0),
    ("Turnover", "turnover", 0.0),
    ("OpenInterest", "openInterest", 0.0),
    # Time
    ("UpdateTime", "updateTime", ""),
    ("UpdateMillisec", "updateMillisec", 0),
    ("ActionDay", "actionDay", ""),
]


def map_depth_market_data(ctp_obj: Any) -> dict:
    """Map a CTP CThostFtdcDepthMarketDataField to a camelCase dict.

    Args:
        ctp_obj: A CTP depth market data object (or any duck-typed object
                 with the expected PascalCase attributes).

    Returns:
        dict with camelCase keys matching the MarketSnapshot model.
    """
    result: dict = {}
    for ctp_attr, json_key, default in _DEPTH_MARKET_DATA_FIELDS:
        result[json_key] = getattr(ctp_obj, ctp_attr, default)
    return result

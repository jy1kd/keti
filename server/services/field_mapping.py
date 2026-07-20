"""CTP field mapping — PascalCase CTP objects to camelCase Python dicts.

All mapping functions use getattr() with sensible defaults so they work
with both real CTP objects (when DLL is available) and mock objects (tests).
"""

import math
from typing import Any, List, Tuple

# CTP uses DBL_MAX (~1.8e308) as a sentinel for "no data available".
# Fields like closePrice (mid-day), settlementPrice (before settlement),
# and bid/ask depth levels 2-5 (when fewer than 5 levels exist) carry
# this value.  We replace it with a reasonable default so the frontend
# never sees raw sentinel values.
_DBL_MAX = 1.7976931348623157e308


def _sanitize_price(value: float, default: float = 0.0) -> float:
    """Return default if value is CTP's DBL_MAX sentinel."""
    return default if (math.isinf(value) or value >= _DBL_MAX * 0.99) else value


# ── Depth market data (OnRtnDepthMarketData) ───────────────────────────

# Mapping table: (PascalCase attr, camelCase key, default)
_DEPTH_MARKET_DATA_FIELDS: List[Tuple[str, str, object]] = [
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

    # Sanitize: replace CTP DBL_MAX sentinel values with 0.0.
    # All price-like fields participate; volumes are never DBL_MAX.
    # Use "Price" in key (not endswith) — bidPrice1-5 / askPrice1-5 have
    # digit suffixes and would be missed by endswith.
    for key in list(result):
        if "Price" in key and isinstance(result[key], float):
            result[key] = _sanitize_price(result[key], 0.0)

    return result


# ── Input order (CThostFtdcInputOrderField) ─────────────────────────────

_INPUT_ORDER_FIELDS: List[Tuple[str, str, object]] = [
    ("InstrumentID", "instrumentID", ""),
    ("ExchangeID", "exchangeID", ""),
    ("BrokerID", "brokerID", ""),
    ("InvestorID", "investorID", ""),
    ("UserID", "userID", ""),
    ("OrderRef", "orderRef", ""),
    ("Direction", "direction", "0"),
    ("CombOffsetFlag", "combOffsetFlag", "0"),
    ("CombHedgeFlag", "combHedgeFlag", "1"),
    ("OrderPriceType", "orderPriceType", "2"),
    ("LimitPrice", "limitPrice", 0.0),
    ("VolumeTotalOriginal", "volumeTotalOriginal", 0),
    ("TimeCondition", "timeCondition", "1"),
    ("VolumeCondition", "volumeCondition", "1"),
    ("MinVolume", "minVolume", 1),
    ("ContingentCondition", "contingentCondition", "1"),
    ("ForceCloseReason", "forceCloseReason", "0"),
    ("StopPrice", "stopPrice", 0.0),
    ("IsAutoSuspend", "isAutoSuspend", 0),
    ("RequestID", "requestID", 0),
]


def map_input_order(ctp_obj: Any) -> dict:
    """Map a CTP CThostFtdcInputOrderField to a camelCase dict.

    Args:
        ctp_obj: A CTP input order object (or duck-typed mock).

    Returns:
        dict with camelCase keys matching the OrderRequest model.
    """
    result: dict = {}
    for ctp_attr, json_key, default in _INPUT_ORDER_FIELDS:
        result[json_key] = getattr(ctp_obj, ctp_attr, default)
    return result


# ── Order return (CThostFtdcOrderField) ──────────────────────────────────

_ORDER_FIELDS: List[Tuple[str, str, object]] = [
    ("InstrumentID", "instrumentID", ""),
    ("ExchangeID", "exchangeID", ""),
    ("BrokerID", "brokerID", ""),
    ("InvestorID", "investorID", ""),
    ("UserID", "userID", ""),
    ("OrderRef", "orderRef", ""),
    ("OrderSysID", "orderSysID", ""),
    ("OrderLocalID", "orderLocalID", ""),
    ("OrderStatus", "orderStatus", ""),
    ("OrderSubmitStatus", "orderSubmitStatus", ""),
    ("OrderPriceType", "orderPriceType", "2"),
    ("Direction", "direction", "0"),
    ("CombOffsetFlag", "combOffsetFlag", "0"),
    ("CombHedgeFlag", "combHedgeFlag", "1"),
    ("LimitPrice", "limitPrice", 0.0),
    ("VolumeTotalOriginal", "volumeTotalOriginal", 0),
    ("VolumeTraded", "volumeTraded", 0),
    ("VolumeTotal", "volumeTotal", 0),
    ("TimeCondition", "timeCondition", "1"),
    ("VolumeCondition", "volumeCondition", "1"),
    ("StatusMsg", "statusMsg", ""),
    ("InsertDate", "insertDate", ""),
    ("InsertTime", "insertTime", ""),
    ("CancelTime", "cancelTime", ""),
    ("UpdateTime", "updateTime", ""),
    ("TradingDay", "tradingDay", ""),
    ("FrontID", "frontID", 0),
    ("SessionID", "sessionID", 0),
    ("OrderType", "orderType", ""),
    ("StopPrice", "stopPrice", 0.0),
    ("BusinessUnit", "businessUnit", ""),
    ("TraderID", "traderID", ""),
]


def map_order(ctp_obj: Any) -> dict:
    """Map a CTP CThostFtdcOrderField to a camelCase dict.

    Args:
        ctp_obj: A CTP order return object (or duck-typed mock).

    Returns:
        dict with camelCase keys matching the OrderReturn model.
    """
    result: dict = {}
    for ctp_attr, json_key, default in _ORDER_FIELDS:
        result[json_key] = getattr(ctp_obj, ctp_attr, default)
    return result


# ── Trade return (CThostFtdcTradeField) ──────────────────────────────────

_TRADE_FIELDS: List[Tuple[str, str, object]] = [
    ("InstrumentID", "instrumentID", ""),
    ("ExchangeID", "exchangeID", ""),
    ("BrokerID", "brokerID", ""),
    ("InvestorID", "investorID", ""),
    ("UserID", "userID", ""),
    ("TradeID", "tradeID", ""),
    ("OrderRef", "orderRef", ""),
    ("OrderSysID", "orderSysID", ""),
    ("Direction", "direction", "0"),
    ("OffsetFlag", "offsetFlag", "0"),
    ("HedgeFlag", "hedgeFlag", "1"),
    ("Price", "price", 0.0),
    ("Volume", "volume", 0),
    ("TradeDate", "tradeDate", ""),
    ("TradeTime", "tradeTime", ""),
    ("TradingDay", "tradingDay", ""),
    ("TradeType", "tradeType", ""),
    ("TradeSource", "tradeSource", ""),
    ("TraderID", "traderID", ""),
    ("OrderLocalID", "orderLocalID", ""),
    ("ParticipantID", "participantID", ""),
    ("SequenceNo", "sequenceNo", 0),
    ("BusinessUnit", "businessUnit", ""),
]


def map_trade(ctp_obj: Any) -> dict:
    """Map a CTP CThostFtdcTradeField to a camelCase dict.

    Args:
        ctp_obj: A CTP trade return object (or duck-typed mock).

    Returns:
        dict with camelCase keys matching the TradeReturn model.
    """
    result: dict = {}
    for ctp_attr, json_key, default in _TRADE_FIELDS:
        result[json_key] = getattr(ctp_obj, ctp_attr, default)
    return result


# ── Instrument (CThostFtdcInstrumentField) ──────────────────────────────

_INSTRUMENT_FIELDS: List[Tuple[str, str, object]] = [
    ("InstrumentID", "instrumentID", ""),
    ("InstrumentName", "instrumentName", ""),
    ("ExchangeID", "exchangeID", ""),
    ("ProductID", "productID", ""),
    ("ProductClass", "productClass", ""),
    ("VolumeMultiple", "volumeMultiple", 0),
    ("PriceTick", "priceTick", 0.0),
    ("ExpireDate", "expireDate", ""),
    ("OptionsType", "optionsType", ""),
    ("StrikePrice", "strikePrice", 0.0),
    ("UnderlyingInstrID", "underlyingInstrID", ""),
    ("IsTrading", "isTrading", 0),
]


def map_instrument(ctp_obj: Any) -> dict:
    """Map a CTP CThostFtdcInstrumentField to a camelCase dict.

    Args:
        ctp_obj: A CTP instrument object (or duck-typed mock).

    Returns:
        dict with camelCase keys matching the InstrumentInfo model.
    """
    result: dict = {}
    for ctp_attr, json_key, default in _INSTRUMENT_FIELDS:
        result[json_key] = getattr(ctp_obj, ctp_attr, default)
    return result

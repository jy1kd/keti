"""Market data models — MarketSnapshot, KLineData, DepthData."""

from typing import Optional
from pydantic import BaseModel, Field


class MarketSnapshot(BaseModel):
    """CTP depth market data snapshot (camelCase)."""

    # Instrument
    instrumentID: str
    exchangeID: str = ""
    tradingDay: str = ""

    # Price
    lastPrice: float
    openPrice: float = 0.0
    highestPrice: float = 0.0
    lowestPrice: float = 0.0
    closePrice: float = 0.0
    preClosePrice: float = 0.0
    preSettlementPrice: float = 0.0
    settlementPrice: float = 0.0
    upperLimitPrice: float = 0.0
    lowerLimitPrice: float = 0.0
    averagePrice: float = 0.0

    # Bid depth 1-5
    bidPrice1: float = 0.0
    bidPrice2: float = 0.0
    bidPrice3: float = 0.0
    bidPrice4: float = 0.0
    bidPrice5: float = 0.0
    bidVolume1: int = 0
    bidVolume2: int = 0
    bidVolume3: int = 0
    bidVolume4: int = 0
    bidVolume5: int = 0

    # Ask depth 1-5
    askPrice1: float = 0.0
    askPrice2: float = 0.0
    askPrice3: float = 0.0
    askPrice4: float = 0.0
    askPrice5: float = 0.0
    askVolume1: int = 0
    askVolume2: int = 0
    askVolume3: int = 0
    askVolume4: int = 0
    askVolume5: int = 0

    # Volume
    volume: int = 0
    turnover: float = 0.0
    openInterest: float = 0.0

    # Time
    updateTime: str = ""
    updateMillisec: int = 0
    actionDay: str = ""


class KLineData(BaseModel):
    """Single candlestick bar (camelCase)."""

    instrumentID: str
    period: str  # "1m", "5m", "15m", "30m", "1h"
    time: str  # "HH:MM:SS" or "YYYY-MM-DD"
    open: float
    high: float
    low: float
    close: float
    volume: int = 0
    turnover: float = 0.0
    openInterest: float = 0.0

"""Account and position models."""

from typing import Optional
from pydantic import BaseModel, Field


class AccountInfo(BaseModel):
    """Trading account funds (camelCase)."""

    accountID: str = ""
    brokerID: str = ""
    balance: float = 0.0
    available: float = 0.0
    frozenMargin: float = 0.0
    currMargin: float = 0.0
    closeProfit: float = 0.0
    positionProfit: float = 0.0
    commission: float = 0.0
    deposit: float = 0.0
    withdraw: float = 0.0
    preBalance: float = 0.0
    tradingDay: str = ""


class PositionInfo(BaseModel):
    """Investor position (camelCase)."""

    instrumentID: str
    position: int = 0
    posiDirection: str = "2"  # "1"=net, "2"=long, "3"=short
    hedgeFlag: str = "1"
    positionDate: str = ""
    ydPosition: int = 0
    todayPosition: int = 0
    openCost: float = 0.0
    positionCost: float = 0.0
    positionProfit: float = 0.0
    closeProfit: float = 0.0
    useMargin: float = 0.0
    exchangeMargin: float = 0.0
    brokerID: str = ""
    investorID: str = ""
    tradingDay: str = ""

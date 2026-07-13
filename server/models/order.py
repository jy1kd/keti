"""Order models — OrderRequest, OrderReturn."""

from typing import Optional
from pydantic import BaseModel, Field


class OrderRequest(BaseModel):
    """Submit order input (camelCase, CTP char values)."""

    instrumentID: str
    direction: str = "0"  # Direction: "0"=buy, "1"=sell
    offsetFlag: str = "0"  # OffsetFlag: "0"=open, "1"=close, "3"=close_today
    priceType: str = "2"  # OrderPriceType: "1"=any, "2"=limit
    limitPrice: float = 0.0
    volumeTotalOriginal: int = 1
    timeCondition: str = "1"  # "1"=GFD, "2"=FOK, "3"=FAK
    volumeCondition: str = "1"  # "1"=AV, "2"=MV, "3"=CV
    hedgeFlag: str = "1"  # "1"=speculation


class OrderReturn(BaseModel):
    """CTP order status return (camelCase)."""

    instrumentID: str
    orderRef: str
    orderSysID: str = ""
    orderStatus: str  # "0"=all_traded, "1"=part_traded, "2"=no_traded, "5"=canceled
    direction: str
    offsetFlag: str = ""
    priceType: str = ""
    limitPrice: float = 0.0
    volumeTotalOriginal: int = 0
    volumeTraded: int = 0
    volumeTotal: int = 0
    statusMsg: str = ""
    insertDate: str = ""
    insertTime: str = ""
    exchangeID: str = ""
    tradingDay: str = ""
    frontID: int = 0
    sessionID: int = 0

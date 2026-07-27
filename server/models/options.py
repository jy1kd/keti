"""期权数据模型。

OptionQuote: 单个期权报价
OptionChain: 期权链（按标的+到期日分组，calls/puts 分列）
VolatilityData: 隐含波动率数据（Black-Scholes 参数）
"""

from dataclasses import dataclass, field
from typing import List, Dict, Any


@dataclass
class OptionQuote:
    """单个期权报价。

    注意：lastPrice/bidPrice/askPrice/volume/openInterest 字段在期权链 API 中
    默认为 0.0，需要通过行情快照（/api/market/snapshots）获取实时数据。
    这些字段主要用于 VolatilityData 计算和前端展示。
    """

    instrumentID: str
    strikePrice: float
    optionType: str  # '1'=看涨, '2'=看跌
    lastPrice: float = 0.0
    bidPrice: float = 0.0
    askPrice: float = 0.0
    volume: int = 0
    openInterest: int = 0
    impliedVolatility: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "instrumentID": self.instrumentID,
            "strikePrice": self.strikePrice,
            "optionType": self.optionType,
            "lastPrice": self.lastPrice,
            "bidPrice": self.bidPrice,
            "askPrice": self.askPrice,
            "volume": self.volume,
            "openInterest": self.openInterest,
            "impliedVolatility": self.impliedVolatility,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "OptionQuote":
        return cls(
            instrumentID=d["instrumentID"],
            strikePrice=d["strikePrice"],
            optionType=d["optionType"],
            lastPrice=d.get("lastPrice", 0.0),
            bidPrice=d.get("bidPrice", 0.0),
            askPrice=d.get("askPrice", 0.0),
            volume=d.get("volume", 0),
            openInterest=d.get("openInterest", 0),
            impliedVolatility=d.get("impliedVolatility", 0.0),
        )


@dataclass
class OptionChain:
    """期权链（按标的合约+到期日分组）。"""

    underlying: str
    expireDate: str
    calls: List[OptionQuote] = field(default_factory=list)
    puts: List[OptionQuote] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "underlying": self.underlying,
            "expireDate": self.expireDate,
            "calls": [q.to_dict() for q in self.calls],
            "puts": [q.to_dict() for q in self.puts],
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "OptionChain":
        return cls(
            underlying=d["underlying"],
            expireDate=d["expireDate"],
            calls=[OptionQuote.from_dict(q) for q in d.get("calls", [])],
            puts=[OptionQuote.from_dict(q) for q in d.get("puts", [])],
        )


@dataclass
class VolatilityData:
    """隐含波动率数据（Black-Scholes 参数）。"""

    instrumentID: str
    impliedVolatility: float
    underlyingPrice: float
    strikePrice: float
    timeToExpiry: float  # 年化（如 0.5 = 半年）
    riskFreeRate: float
    optionType: str  # '1'=看涨, '2'=看跌
    updateTime: str = ""  # 数据计算时间 (HH:MM:SS)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "instrumentID": self.instrumentID,
            "impliedVolatility": self.impliedVolatility,
            "underlyingPrice": self.underlyingPrice,
            "strikePrice": self.strikePrice,
            "timeToExpiry": self.timeToExpiry,
            "riskFreeRate": self.riskFreeRate,
            "optionType": self.optionType,
            "updateTime": self.updateTime,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "VolatilityData":
        return cls(
            instrumentID=d["instrumentID"],
            impliedVolatility=d["impliedVolatility"],
            underlyingPrice=d["underlyingPrice"],
            strikePrice=d["strikePrice"],
            timeToExpiry=d["timeToExpiry"],
            riskFreeRate=d["riskFreeRate"],
            optionType=d["optionType"],
            updateTime=d.get("updateTime", ""),
        )

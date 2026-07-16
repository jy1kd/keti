"""CTP type definitions — enumerations and constants.

These constants match the CTP API's char-based field values.
All values are strings as required by ctp-python SWIG bindings.
"""


class Direction:
    """买卖方向."""
    BUY: str = "0"   # 买
    SELL: str = "1"  # 卖


class OffsetFlag:
    """开平标志."""
    OPEN: str = "0"        # 开仓
    CLOSE: str = "1"       # 平仓
    CLOSE_TODAY: str = "3"  # 平今


class OrderPriceType:
    """报单价格类型."""
    ANY: str = "1"    # 市价（任意价）
    LIMIT: str = "2"  # 限价


class TimeCondition:
    """有效期类型."""
    GFD: str = "1"  # 当日有效
    FOK: str = "2"  # 全部成交或全部撤销（Fill or Kill）
    FAK: str = "3"  # 部分成交，剩余撤销（Fill and Kill）


class VolumeCondition:
    """成交量类型."""
    AV: str = "1"  # 任何数量
    MV: str = "2"  # 最小数量
    CV: str = "3"  # 全部数量


class OrderStatus:
    """报单状态."""
    ALL_TRADED: str = "0"   # 全部成交
    PART_TRADED: str = "1"  # 部分成交
    NO_TRADED: str = "2"    # 未成交
    CANCELED: str = "5"     # 已撤销


class PosiDirection:
    """持仓方向."""
    NET: str = "1"    # 净
    LONG: str = "2"   # 多
    SHORT: str = "3"  # 空


class ProductClass:
    """产品类型."""
    FUTURES: str = "1"     # 期货
    OPTIONS: str = "2"     # 期权
    COMBINATION: str = "3"  # 组合


class CombHedgeFlag:
    """组合投机套保标志."""
    SPECULATION: str = "1"  # 投机
    ARBITRAGE: str = "2"    # 套利
    HEDGE: str = "3"        # 套保


class ContingentCondition:
    """触发条件."""
    IMMEDIATELY: str = "1"     # 立即
    STOP: str = "2"            # 止损
    STOP_PROFIT: str = "3"     # 止盈
    PARKED: str = "4"          # 预埋单


class ForceCloseReason:
    """强平原因."""
    NOT_FORCE_CLOSE: str = "0"            # 非强平
    LACK_DEPOSIT: str = "1"               # 资金不足
    CLIENT_OVER_POSITION: str = "2"        # 客户超仓
    MEMBER_OVER_POSITION: str = "3"        # 会员超仓

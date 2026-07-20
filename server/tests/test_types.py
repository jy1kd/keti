"""Tests for ctp/types.py — CTP type definitions and constants."""

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ctp_wrapper.types import (
    Direction,
    OffsetFlag,
    OrderPriceType,
    TimeCondition,
    VolumeCondition,
    OrderStatus,
    PosiDirection,
    ProductClass,
    CombHedgeFlag,
    ContingentCondition,
    ForceCloseReason,
)


class TestDirection:
    """Direction enumeration — buy/sell."""

    def test_buy_value(self):
        assert Direction.BUY == "0"

    def test_sell_value(self):
        assert Direction.SELL == "1"

    def test_values_are_strings(self):
        assert isinstance(Direction.BUY, str)
        assert isinstance(Direction.SELL, str)


class TestOffsetFlag:
    """OffsetFlag enumeration — open/close/close_today."""

    def test_open_value(self):
        assert OffsetFlag.OPEN == "0"

    def test_close_value(self):
        assert OffsetFlag.CLOSE == "1"

    def test_close_today_value(self):
        assert OffsetFlag.CLOSE_TODAY == "3"

    def test_values_are_strings(self):
        for v in [OffsetFlag.OPEN, OffsetFlag.CLOSE, OffsetFlag.CLOSE_TODAY]:
            assert isinstance(v, str)


class TestOrderPriceType:
    """Order price type — limit/any."""

    def test_limit_price_value(self):
        assert OrderPriceType.LIMIT == "2"

    def test_any_price_value(self):
        assert OrderPriceType.ANY == "1"


class TestTimeCondition:
    """Time condition for orders."""

    def test_gfd_value(self):
        assert TimeCondition.GFD == "1"

    def test_fok_value(self):
        assert TimeCondition.FOK == "2"

    def test_fak_value(self):
        assert TimeCondition.FAK == "3"


class TestVolumeCondition:
    """Volume condition for orders."""

    def test_av_value(self):
        assert VolumeCondition.AV == "1"

    def test_mv_value(self):
        assert VolumeCondition.MV == "2"

    def test_cv_value(self):
        assert VolumeCondition.CV == "3"


class TestOrderStatus:
    """Order status constants."""

    def test_all_traded_value(self):
        assert OrderStatus.ALL_TRADED == "0"

    def test_part_traded_value(self):
        assert OrderStatus.PART_TRADED == "1"

    def test_no_traded_value(self):
        assert OrderStatus.NO_TRADED == "2"

    def test_canceled_value(self):
        assert OrderStatus.CANCELED == "5"


class TestPosiDirection:
    """Position direction."""

    def test_net_value(self):
        assert PosiDirection.NET == "1"

    def test_long_value(self):
        assert PosiDirection.LONG == "2"

    def test_short_value(self):
        assert PosiDirection.SHORT == "3"


class TestProductClass:
    """Product class."""

    def test_futures_value(self):
        assert ProductClass.FUTURES == "1"

    def test_options_value(self):
        assert ProductClass.OPTIONS == "2"

    def test_combination_value(self):
        assert ProductClass.COMBINATION == "3"


class TestCombHedgeFlag:
    """Combination hedge flag — speculation/arbitrage/hedge."""

    def test_speculation_value(self):
        assert CombHedgeFlag.SPECULATION == "1"

    def test_arbitrage_value(self):
        assert CombHedgeFlag.ARBITRAGE == "2"

    def test_hedge_value(self):
        assert CombHedgeFlag.HEDGE == "3"

    def test_values_are_strings(self):
        for v in [CombHedgeFlag.SPECULATION, CombHedgeFlag.ARBITRAGE, CombHedgeFlag.HEDGE]:
            assert isinstance(v, str)


class TestContingentCondition:
    """Contingent condition — immediately/stop/stop_profit/parked."""

    def test_immediately_value(self):
        assert ContingentCondition.IMMEDIATELY == "1"

    def test_stop_value(self):
        assert ContingentCondition.STOP == "2"

    def test_stop_profit_value(self):
        assert ContingentCondition.STOP_PROFIT == "3"

    def test_parked_value(self):
        assert ContingentCondition.PARKED == "4"

    def test_values_are_strings(self):
        for v in [ContingentCondition.IMMEDIATELY, ContingentCondition.STOP,
                   ContingentCondition.STOP_PROFIT, ContingentCondition.PARKED]:
            assert isinstance(v, str)


class TestForceCloseReason:
    """Force close reason — not_force_close/lack_deposit/client_over_position etc."""

    def test_not_force_close_value(self):
        assert ForceCloseReason.NOT_FORCE_CLOSE == "0"

    def test_lack_deposit_value(self):
        assert ForceCloseReason.LACK_DEPOSIT == "1"

    def test_client_over_position_value(self):
        assert ForceCloseReason.CLIENT_OVER_POSITION == "2"

    def test_member_over_position_value(self):
        assert ForceCloseReason.MEMBER_OVER_POSITION == "3"

    def test_values_are_strings(self):
        for v in [ForceCloseReason.NOT_FORCE_CLOSE, ForceCloseReason.LACK_DEPOSIT,
                   ForceCloseReason.CLIENT_OVER_POSITION, ForceCloseReason.MEMBER_OVER_POSITION]:
            assert isinstance(v, str)

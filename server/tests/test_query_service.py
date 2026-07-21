"""Tests for services/query_service.py — query service layer."""

import sys
import os
import threading
from unittest.mock import Mock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from services.query_service import QueryService


class TestQueryServiceConstruction:
    """Test QueryService instantiation."""

    def test_import(self):
        assert QueryService is not None

    def test_instantiation(self):
        svc = QueryService()
        assert svc is not None

    def test_initial_state_empty(self):
        svc = QueryService()
        assert svc.order_count == 0
        assert svc.trade_count == 0
        assert svc.position_count == 0
        assert svc.account_info is None


class TestOnOrderResult:
    """Test on_order_result callback handler."""

    def test_accumulates_orders(self):
        svc = QueryService()
        svc.on_order_result({"orderRef": "1"}, None, 1, False)
        svc.on_order_result({"orderRef": "2"}, None, 1, True)
        # After is_last, pending is cleared and results stored in _orders
        assert len(svc._orders) == 2

    def test_sets_event_on_last(self):
        svc = QueryService()
        event = threading.Event()
        svc._orders_event = event
        svc.on_order_result({"orderRef": "1"}, None, 1, True)
        assert event.is_set()

    def test_does_not_set_event_before_last(self):
        svc = QueryService()
        event = threading.Event()
        svc._orders_event = event
        svc.on_order_result({"orderRef": "1"}, None, 1, False)
        assert not event.is_set()

    def test_maps_ctp_order_object(self):
        """Should use map_order for non-dict objects."""
        svc = QueryService()
        mock_order = Mock()
        mock_order.OrderRef = "1"
        mock_order.InstrumentID = "IF2608"
        mock_order.OrderSysID = ""
        mock_order.OrderStatus = "0"
        mock_order.Direction = "0"
        mock_order.LimitPrice = 3850.0
        mock_order.VolumeTotalOriginal = 5
        mock_order.VolumeTraded = 5
        mock_order.VolumeTotal = 0
        mock_order.StatusMsg = ""
        mock_order.InsertDate = ""
        mock_order.InsertTime = ""
        mock_order.CombOffsetFlag = ""
        mock_order.CombHedgeFlag = "1"
        mock_order.OrderPriceType = "2"
        mock_order.ExchangeID = "CFFEX"
        mock_order.BrokerID = "9999"
        mock_order.InvestorID = "user001"
        mock_order.UserID = "user001"
        mock_order.TimeCondition = "1"
        mock_order.VolumeCondition = "1"
        mock_order.CancelTime = ""
        mock_order.UpdateTime = ""
        mock_order.TradingDay = ""
        mock_order.FrontID = 0
        mock_order.SessionID = 0
        mock_order.OrderLocalID = ""
        mock_order.OrderType = ""
        mock_order.StopPrice = 0.0
        mock_order.BusinessUnit = ""
        mock_order.TraderID = ""

        svc.on_order_result(mock_order, None, 1, True)
        assert len(svc._orders) == 1
        assert svc._orders[0]["instrumentID"] == "IF2608"

    def test_skips_none_instruments(self):
        """None from CTP callback should be skipped."""
        svc = QueryService()
        svc.on_order_result(None, None, 1, True)
        assert len(svc._orders) == 0


class TestOnTradeResult:
    """Test on_trade_result callback handler."""

    def test_accumulates_trades(self):
        svc = QueryService()
        svc.on_trade_result({"tradeID": "T1"}, None, 1, False)
        svc.on_trade_result({"tradeID": "T2"}, None, 1, True)
        assert len(svc._trades) == 2

    def test_sets_event_on_last(self):
        svc = QueryService()
        event = threading.Event()
        svc._trades_event = event
        svc.on_trade_result({"tradeID": "T1"}, None, 1, True)
        assert event.is_set()


class TestOnPositionResult:
    """Test on_position_result callback handler."""

    def test_accumulates_positions(self):
        svc = QueryService()
        svc.on_position_result({"instrumentID": "IF2608"}, None, 1, False)
        svc.on_position_result({"instrumentID": "au2506"}, None, 1, True)
        assert len(svc._positions) == 2

    def test_sets_event_on_last(self):
        svc = QueryService()
        event = threading.Event()
        svc._positions_event = event
        svc.on_position_result({"instrumentID": "IF2608"}, None, 1, True)
        assert event.is_set()

    def test_skips_none_positions(self):
        svc = QueryService()
        svc.on_position_result(None, None, 1, True)
        assert len(svc._positions) == 0


class TestOnAccountResult:
    """Test on_account_result callback handler."""

    def test_stores_account(self):
        svc = QueryService()
        svc.on_account_result({"accountID": "user001"}, None, 1, True)
        assert svc.account_info is not None
        assert svc.account_info["accountID"] == "user001"

    def test_sets_event_on_last(self):
        svc = QueryService()
        event = threading.Event()
        svc._account_event = event
        svc.on_account_result({"accountID": "user001"}, None, 1, True)
        assert event.is_set()

    def test_skips_none_account(self):
        svc = QueryService()
        svc.on_account_result(None, None, 1, True)
        assert svc.account_info is None


class TestQueryOrders:
    """Test query_orders method."""

    def test_returns_empty_when_not_logged_in(self):
        svc = QueryService()
        trader = Mock()
        trader.login_status = "not_logged_in"
        result = svc.query_orders(trader)
        assert result == []

    def test_calls_trader_query_orders(self):
        svc = QueryService()
        trader = Mock()
        trader.login_status = "logged_in"
        trader.query_orders.return_value = 0
        # Simulate immediate callback
        def simulate_query(*args):
            svc.on_order_result({"orderRef": "1"}, None, 1, True)
            return 0
        trader.query_orders.side_effect = simulate_query
        result = svc.query_orders(trader)
        assert len(result) == 1

    def test_returns_empty_on_ctp_failure(self):
        svc = QueryService()
        trader = Mock()
        trader.login_status = "logged_in"
        trader.query_orders.return_value = -1
        result = svc.query_orders(trader)
        assert result == []


class TestQueryTrades:
    """Test query_trades method."""

    def test_returns_empty_when_not_logged_in(self):
        svc = QueryService()
        trader = Mock()
        trader.login_status = "not_logged_in"
        result = svc.query_trades(trader)
        assert result == []


class TestQueryPositions:
    """Test query_positions method."""

    def test_returns_empty_when_not_logged_in(self):
        svc = QueryService()
        trader = Mock()
        trader.login_status = "not_logged_in"
        result = svc.query_positions(trader)
        assert result == []


class TestQueryAccount:
    """Test query_account method."""

    def test_returns_none_when_not_logged_in(self):
        svc = QueryService()
        trader = Mock()
        trader.login_status = "not_logged_in"
        result = svc.query_account(trader)
        assert result is None

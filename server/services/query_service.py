"""Query service — CTP query orchestration and result caching.

Sits between API routes and CTP TraderApi. Handles the CTP callback
accumulation pattern (multiple OnRspQryXxx callbacks with bIsLast)
and provides clean accessors for the API layer.

Designed for testability: all CTP-dependent operations accept the
TraderApi as a parameter rather than storing it as state.
"""

import logging
import threading
from typing import Any, Dict, List, Optional

from services.field_mapping import map_order, map_trade, map_position, map_account

logger = logging.getLogger(__name__)

# Default timeout for CTP query responses (seconds)
_QUERY_TIMEOUT: float = 10.0


class QueryService:
    """Query service for CTP order/trade/position/account queries.

    Manages:
    - Result accumulation from CTP callbacks (bIsLast pattern)
    - Thread-safe synchronization (CTP callbacks run in CTP thread)
    - Result caching (latest query results)
    """

    def __init__(self) -> None:
        # Pending accumulation buffers
        self._pending_orders: List[dict] = []
        self._pending_trades: List[dict] = []
        self._pending_positions: List[dict] = []

        # Synchronization events
        self._orders_event = threading.Event()
        self._trades_event = threading.Event()
        self._positions_event = threading.Event()
        self._account_event = threading.Event()

        # Cached results (latest query)
        self._orders: List[dict] = []
        self._trades: List[dict] = []
        self._positions: List[dict] = []
        self._account: Optional[dict] = None

    # ── Properties ──────────────────────────────────────────────────────

    @property
    def order_count(self) -> int:
        return len(self._pending_orders)

    @property
    def trade_count(self) -> int:
        return len(self._pending_trades)

    @property
    def position_count(self) -> int:
        return len(self._pending_positions)

    @property
    def account_info(self) -> Optional[dict]:
        return self._account

    # ── Callback handlers (called from CTP thread) ──────────────────────

    def on_order_result(self, pOrder: Any, pRspInfo: Any,
                        nRequestID: int, bIsLast: bool) -> None:
        """Handle OnRspQryOrder callback data."""
        if pOrder is not None:
            if isinstance(pOrder, dict):
                self._pending_orders.append(pOrder)
            else:
                self._pending_orders.append(map_order(pOrder))

        if bIsLast:
            self._orders = list(self._pending_orders)
            self._pending_orders = []
            self._orders_event.set()

    def on_trade_result(self, pTrade: Any, pRspInfo: Any,
                        nRequestID: int, bIsLast: bool) -> None:
        """Handle OnRspQryTrade callback data."""
        if pTrade is not None:
            if isinstance(pTrade, dict):
                self._pending_trades.append(pTrade)
            else:
                self._pending_trades.append(map_trade(pTrade))

        if bIsLast:
            self._trades = list(self._pending_trades)
            self._pending_trades = []
            self._trades_event.set()

    def on_position_result(self, pPosition: Any, pRspInfo: Any,
                           nRequestID: int, bIsLast: bool) -> None:
        """Handle OnRspQryInvestorPosition callback data."""
        if pPosition is not None:
            if isinstance(pPosition, dict):
                self._pending_positions.append(pPosition)
            else:
                self._pending_positions.append(map_position(pPosition))

        if bIsLast:
            self._positions = list(self._pending_positions)
            self._pending_positions = []
            self._positions_event.set()

    def on_account_result(self, pAccount: Any, pRspInfo: Any,
                          nRequestID: int, bIsLast: bool) -> None:
        """Handle OnRspQryTradingAccount callback data."""
        if pAccount is not None:
            if isinstance(pAccount, dict):
                self._account = pAccount
            else:
                self._account = map_account(pAccount)

        if bIsLast:
            self._account_event.set()

    # ── Query methods (called from API layer) ───────────────────────────

    def query_orders(self, trader_api: Any,
                     timeout: float = _QUERY_TIMEOUT) -> List[dict]:
        """Query orders from CTP and wait for results.

        Args:
            trader_api: TraderApi instance (must be logged in).
            timeout: Max seconds to wait for CTP response.

        Returns:
            List of order dicts. Empty on failure or timeout.
        """
        if trader_api.login_status != "logged_in":
            return []

        self._pending_orders = []
        self._orders_event.clear()

        result = trader_api.query_orders()
        if result < 0:
            return []

        self._orders_event.wait(timeout=timeout)
        return list(self._orders)

    def query_trades(self, trader_api: Any,
                     timeout: float = _QUERY_TIMEOUT) -> List[dict]:
        """Query trades from CTP and wait for results.

        Args:
            trader_api: TraderApi instance (must be logged in).
            timeout: Max seconds to wait for CTP response.

        Returns:
            List of trade dicts. Empty on failure or timeout.
        """
        if trader_api.login_status != "logged_in":
            return []

        self._pending_trades = []
        self._trades_event.clear()

        result = trader_api.query_trades()
        if result < 0:
            return []

        self._trades_event.wait(timeout=timeout)
        return list(self._trades)

    def query_positions(self, trader_api: Any,
                        timeout: float = _QUERY_TIMEOUT) -> List[dict]:
        """Query positions from CTP and wait for results.

        Args:
            trader_api: TraderApi instance (must be logged in).
            timeout: Max seconds to wait for CTP response.

        Returns:
            List of position dicts. Empty on failure or timeout.
        """
        if trader_api.login_status != "logged_in":
            return []

        self._pending_positions = []
        self._positions_event.clear()

        result = trader_api.query_positions()
        if result < 0:
            return []

        self._positions_event.wait(timeout=timeout)
        return list(self._positions)

    def query_account(self, trader_api: Any,
                      timeout: float = _QUERY_TIMEOUT) -> Optional[dict]:
        """Query account funds from CTP and wait for results.

        Args:
            trader_api: TraderApi instance (must be logged in).
            timeout: Max seconds to wait for CTP response.

        Returns:
            Account dict. None on failure or timeout.
        """
        if trader_api.login_status != "logged_in":
            return None

        self._account = None
        self._account_event.clear()

        result = trader_api.query_account()
        if result < 0:
            return None

        self._account_event.wait(timeout=timeout)
        return self._account

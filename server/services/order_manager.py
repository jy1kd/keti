"""OrderManager — unified entry point for order operations and state tracking.

方案 B: OrderManager wraps TraderApi as the single entry point for all
order operations. It maintains an in-memory state map updated by CTP
callbacks and provides insert/cancel/cancel_all/reverse/lock operations.

Architecture:
  OrderManager.insert()         → create pending record → TraderApi.insert_order()
  OrderManager.on_rtn_order()   ← CTP callback    → update state
  OrderManager.on_rtn_trade()   ← CTP callback    → record trade
  OrderManager.get_order(ref)   → read from memory
"""

from __future__ import annotations

import logging
import threading
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ctp_wrapper.trader_api import TraderApi
from ctp_wrapper.types import OrderStatus

logger = logging.getLogger(__name__)


class OrderManager:
    """Order state tracking and operations hub.

    Wraps TraderApi to provide:
    - Pending-order creation before CTP response
    - Callback-driven state updates (OnRtnOrder, OnRtnTrade)
    - cancel_all with knowledge of active orders
    - Thread-safe access via RLock
    """

    def __init__(self, trader_api: "TraderApi") -> None:
        """Initialize with a TraderApi instance.

        Args:
            trader_api: A TraderApi instance (already constructed, may not be
                        connected yet).
        """
        self._trader = trader_api
        self._orders: Dict[str, dict] = {}
        self._trades: Dict[str, List[dict]] = {}
        self._lock = threading.RLock()
        self._broadcast_fn: Optional[Callable[[str, dict], None]] = None

    # ── Properties ───────────────────────────────────────────────────────

    @property
    def active_orders(self) -> Dict[str, dict]:
        """Return a snapshot of all tracked orders (thread-safe copy)."""
        with self._lock:
            return dict(self._orders)

    # ── Broadcast hook ────────────────────────────────────────────────────

    def set_broadcast_fn(self, fn: Callable[[str, dict], None]) -> None:
        """Set a callback for WebSocket broadcast on order/trade events.

        Args:
            fn: Callable(msg_type: str, data: dict) — called in CTP thread.
        """
        self._broadcast_fn = fn

    # ── Insert ────────────────────────────────────────────────────────────

    def insert(
        self,
        instrument_id: str,
        direction: str,
        offset_flag: str,
        price_type: str = "2",
        limit_price: float = 0.0,
        volume: int = 1,
        time_condition: str = "1",
        hedge_flag: str = "1",
        stop_price: float = 0.0,
    ) -> str:
        """Submit an order via TraderApi and track it as 'pending'.

        Creates a pending record BEFORE calling CTP so that
        get_order(ref) returns immediately.

        Returns:
            str: Order reference. Empty string on failure.
        """
        # Call CTP first to get the real order_ref
        result = self._trader.insert_order(
            instrument_id=instrument_id,
            direction=direction,
            offset_flag=offset_flag,
            price_type=price_type,
            limit_price=limit_price,
            volume=volume,
            time_condition=time_condition,
            hedge_flag=hedge_flag,
            stop_price=stop_price,
        )
        if not result:
            return ""

        # Create pending record with the real order_ref
        pending = {
            "orderRef": result,
            "orderSysID": "",
            "orderStatus": "pending",
            "orderSubmitStatus": "",
            "instrumentID": instrument_id,
            "direction": direction,
            "combOffsetFlag": offset_flag,
            "orderPriceType": price_type,
            "limitPrice": limit_price,
            "volumeTotalOriginal": volume,
            "volumeTraded": 0,
            "volumeTotal": volume,
            "timeCondition": time_condition,
            "statusMsg": "",
            "insertDate": "",
            "insertTime": "",
            "tradingDay": "",
            "frontID": 0,
            "sessionID": 0,
            "brokerID": self._trader.config.broker_id,
            "investorID": self._trader.config.user_id,
        }
        with self._lock:
            self._orders[result] = pending
        return result

    # ── Cancel ────────────────────────────────────────────────────────────

    def cancel(self, order_ref: str, order_sys_id: str = "") -> int:
        """Cancel an active order by its orderRef.

        Extracts exchange_id, instrument_id, and orderSysID from the
        tracked order. The tracked order's orderSysID (set by CTP's
        OnRtnOrder callback) takes priority; the explicit parameter
        serves as fallback when the callback hasn't arrived yet.

        Args:
            order_ref: Order reference from insert().
            order_sys_id: Fallback order system ID (from frontend).

        Returns:
            int: 0 on success, -1 if order not found, or CTP error code.
        """
        with self._lock:
            order = self._orders.get(order_ref)
        if order is None:
            return -1
        # Tracked order's orderSysID (from CTP) takes priority
        sys_id = order.get("orderSysID", "") or order_sys_id
        return self._trader.cancel_order(
            order_ref=order_ref,
            order_sys_id=sys_id,
            exchange_id=order.get("exchangeID", ""),
            instrument_id=order.get("instrumentID", ""),
        )

    # ── Cancel all ────────────────────────────────────────────────────────

    def cancel_all(self) -> int:
        """Cancel all active (non-final) orders.

        Returns:
            int: Number of orders cancelled.
        """
        with self._lock:
            active_refs = [
                ref for ref, o in self._orders.items()
                if o["orderStatus"] in ("pending", OrderStatus.NO_TRADED, OrderStatus.PART_TRADED)
            ]
        count = 0
        for ref in active_refs:
            result = self.cancel(ref)
            if result == 0:
                count += 1
        return count

    # ── Reverse (placeholder — needs PR-11 position data) ────────────────

    def reverse(self, instrument_id: str) -> dict:
        """Reverse position — placeholder for PR-11.

        Returns:
            dict: {"success": bool, "message": str}
        """
        return {
            "success": False,
            "message": "Not implemented — position data needed (PR-11)",
        }

    # ── Lock (placeholder — needs PR-11 position data) ───────────────────

    def lock(self, instrument_id: str) -> dict:
        """Lock position — placeholder for PR-11.

        Returns:
            dict: {"success": bool, "message": str}
        """
        return {
            "success": False,
            "message": "Not implemented — position data needed (PR-11)",
        }

    # ── Query ─────────────────────────────────────────────────────────────

    def get_order(self, order_ref: str) -> Optional[dict]:
        """Get a tracked order by its orderRef.

        Args:
            order_ref: Order reference string.

        Returns:
            dict or None: The order state dict, or None if not found.
        """
        with self._lock:
            return self._orders.get(order_ref)

    def get_all_orders(self) -> List[dict]:
        """Return all tracked orders (thread-safe snapshot)."""
        with self._lock:
            return list(self._orders.values())

    def get_trades(self, order_ref: str) -> List[dict]:
        """Return all trades for a given orderRef."""
        with self._lock:
            return list(self._trades.get(order_ref, []))

    # ── Callback handlers ─────────────────────────────────────────────────

    def on_rtn_order(self, order_data: dict) -> None:
        """Handle OnRtnOrder callback from CTP.

        Updates the in-memory order record with the latest CTP state.

        Args:
            order_data: CamelCase dict from map_order().
        """
        ref = order_data.get("orderRef", "")
        if not ref:
            return
        with self._lock:
            existing = self._orders.get(ref)
            if existing is None:
                # Order from another session — ignore
                return
            existing.update(order_data)

        # Broadcast via WebSocket if configured
        if self._broadcast_fn is not None:
            try:
                self._broadcast_fn("order_return", order_data)
            except Exception:
                logger.warning("Broadcast on_rtn_order failed", exc_info=True)

    def on_rtn_trade(self, trade_data: dict) -> None:
        """Handle OnRtnTrade callback from CTP.

        Records the trade and appends to the per-order trade list.

        Args:
            trade_data: CamelCase dict from map_trade().
        """
        ref = trade_data.get("orderRef", "")
        with self._lock:
            if ref not in self._trades:
                self._trades[ref] = []
            self._trades[ref].append(trade_data)

        # Broadcast via WebSocket if configured
        if self._broadcast_fn is not None:
            try:
                self._broadcast_fn("trade_return", trade_data)
            except Exception:
                logger.warning("Broadcast on_rtn_trade failed", exc_info=True)

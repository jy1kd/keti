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

    # Statuses that represent an active (cancel-able) order.
    # "0" (AllTraded) and "5" (Canceled) are terminal — excluded.
    _ACTIVE_STATUSES: tuple = (
        "pending",
        OrderStatus.UNKNOWN,              # "a" — CTP initial state
        OrderStatus.NO_TRADED,            # "2"
        OrderStatus.NO_TRADED_QUEUING,     # "3"
        OrderStatus.NO_TRADED_NOT_QUEUING, # "4"
        OrderStatus.PART_TRADED,           # "1"
    )

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
        self._rsp_events: Dict[str, threading.Event] = {}
        self._rsp_action_results: Dict[str, tuple] = {}
        # Session identity for filtering historical callbacks after restart.
        # Set via set_session() from OnRspUserLogin.  -1 = not yet set.
        self._my_front_id: int = -1
        self._my_session_id: int = -1

    # ── Properties ───────────────────────────────────────────────────────

    @property
    def active_orders(self) -> Dict[str, dict]:
        """Return a snapshot of all tracked orders (thread-safe copy)."""
        with self._lock:
            return dict(self._orders)

    # ── Session identity ──────────────────────────────────────────────────

    def set_session(self, front_id: int, session_id: int) -> None:
        """Record current CTP session identity for filtering stale callbacks.

        Must be called from OnRspUserLogin with the FrontID / SessionID
        returned by CTP.  Once set, on_rtn_order() will ignore callbacks
        whose (frontID, sessionID) do not match — preventing historical
        orders from a previous connection from overwriting current orders.

        Args:
            front_id: CTP FrontID from CThostFtdcRspUserLoginField.
            session_id: CTP SessionID from CThostFtdcRspUserLoginField.
        """
        self._my_front_id = front_id
        self._my_session_id = session_id
        logger.info("OrderManager session set: frontID=%s sessionID=%s",
                    front_id, session_id)

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
        volume_condition: str = "1",
        hedge_flag: str = "1",
        stop_price: float = 0.0,
        exchange_id: str = "",
        wait_response: bool = True,
        wait_timeout: float = 3.0,
    ) -> dict:
        """Submit an order via TraderApi and track it as 'pending'.

        When wait_response=True (default), blocks until OnRspOrderInsert
        arrives from CTP and returns the actual callback result.

        Returns:
            dict: {"success": bool, "orderRef": str, "message": str}
        """
        # Generate ref and register the pending record + response event
        # BEFORE the CTP call.  The CTP callback thread can answer while
        # insert_order() is still executing (F1 race).
        ref = self._trader.next_order_ref()

        # Create pending record
        pending = {
            "orderRef": ref,
            "orderSysID": "",
            "orderStatus": "pending",
            "orderSubmitStatus": "",
            "instrumentID": instrument_id,
            "exchangeID": exchange_id,
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

        event = threading.Event()
        with self._lock:
            self._orders[ref] = pending
            if wait_response:
                self._rsp_events[ref] = event

        # Call CTP — callbacks may fire during this call
        try:
            ok = self._trader.insert_order(
                instrument_id=instrument_id,
                exchange_id=exchange_id,
                direction=direction,
                offset_flag=offset_flag,
                price_type=price_type,
                limit_price=limit_price,
                volume=volume,
                time_condition=time_condition,
                volume_condition=volume_condition,
                hedge_flag=hedge_flag,
                stop_price=stop_price,
                order_ref=ref,
            )
        except Exception:
            with self._lock:
                self._orders.pop(ref, None)
                self._rsp_events.pop(ref, None)
            raise
        if not ok:
            with self._lock:
                self._orders.pop(ref, None)
                self._rsp_events.pop(ref, None)
            return {"success": False, "orderRef": "", "message": "CTP local reject"}

        if not wait_response:
            return {"success": True, "orderRef": ref, "message": "Submitted"}

        # Wait for OnRspOrderInsert callback (fires in CTP thread)
        received = event.wait(timeout=wait_timeout)

        with self._lock:
            self._rsp_events.pop(ref, None)
            order = self._orders.get(ref, {})

        if not received:
            return {"success": True, "orderRef": ref, "message": "Submitted (confirmation timeout)"}

        submit_status = order.get("orderSubmitStatus", "")
        order_status = order.get("orderStatus", "")
        status_msg = order.get("statusMsg", "")

        logger.info("INSERT result ref=%s submitStatus=%s orderStatus=%s statusMsg=%s",
                    ref, submit_status, order_status, status_msg)

        # OnRspOrderInsert error (our internal value)
        if submit_status == "error":
            return {"success": False, "orderRef": ref, "message": status_msg or "Order rejected"}
        # OnRtnOrder: CTP OrderSubmitStatus
        #   '4' = InsertRejected  (exchange rejected the order)
        #   '5' = CancelRejected
        #   '6' = ModifyRejected
        if submit_status in ("4", "5", "6"):
            return {"success": False, "orderRef": ref, "message": f"CTP:{status_msg}" if status_msg else "Order rejected by exchange"}
        # OnRspOrderInsert accepted (our internal value)
        if submit_status == "accepted":
            return {"success": True, "orderRef": ref, "message": "Accepted"}
        # OnRtnOrder arrived (SimNow may skip OnRspOrderInsert)
        # OrderStatus '5' = cancelled
        if order_status == OrderStatus.CANCELED:
            return {"success": False, "orderRef": ref, "message": status_msg or "Order cancelled"}
        # Any other orderStatus ('0'/'1'/'2'/'a') means the order is alive.
        # 'a' = CTP initial state (Unknown), transitions to '0'/'1'/'2'/'5'
        # on subsequent OnRtnOrder callbacks.
        if order_status:
            return {"success": True, "orderRef": ref, "message": "Accepted"}

        return {"success": True, "orderRef": ref, "message": "Accepted"}

    # ── Response callbacks ──────────────────────────────────────────────────

    def on_rsp_order_insert(self, order_ref: str, error_id: int, error_msg: str) -> None:
        """Handle OnRspOrderInsert from CTP — update order and signal waiter.

        Called from the CTP callback thread. Updates the pending order's
        orderSubmitStatus and statusMsg, then signals any thread waiting
        in insert().
        """
        with self._lock:
            order = self._orders.get(order_ref)
            if order is not None:
                order["orderSubmitStatus"] = "error" if error_id != 0 else "accepted"
                order["statusMsg"] = error_msg
        # Signal the waiting insert() thread
        event = self._rsp_events.get(order_ref)
        if event is not None:
            event.set()

    def on_rsp_order_action(self, order_ref: str, error_id: int, error_msg: str) -> None:
        """Handle OnRspOrderAction from CTP — signal waiting cancel() thread.

        Called from the CTP callback thread.
        """
        # Signal the waiting cancel() thread
        event = self._rsp_events.get(order_ref)
        if event is not None:
            # Store result for cancel() to read
            if error_id != 0:
                self._rsp_action_results[order_ref] = ("error", error_msg)
            else:
                self._rsp_action_results[order_ref] = ("accepted", "")
            event.set()

    # ── Cancel ────────────────────────────────────────────────────────────

    def cancel(
        self,
        order_ref: str,
        order_sys_id: str = "",
        wait_response: bool = True,
        wait_timeout: float = 3.0,
    ) -> dict:
        """Cancel an active order by its orderRef.

        Extracts exchange_id, instrument_id, and orderSysID from the
        tracked order. The tracked order's orderSysID (set by CTP's
        OnRtnOrder callback) takes priority; the explicit parameter
        serves as fallback.

        When wait_response=True (default), blocks until OnRspOrderAction
        arrives from CTP and returns the actual callback result.

        Returns:
            dict: {"success": bool, "orderRef": str, "message": str}
        """
        with self._lock:
            order = self._orders.get(order_ref)
        if order is None:
            return {"success": False, "orderRef": order_ref, "message": "Order not found"}

        # Tracked order's orderSysID (from CTP) takes priority
        sys_id = order.get("orderSysID", "") or order_sys_id
        logger.info("CANCEL orderRef=%s sysID=%s exchangeID=%s instrumentID=%s",
                    order_ref, sys_id, order.get("exchangeID", ""), order.get("instrumentID", ""))

        # Register the response event BEFORE the CTP call — the callback
        # thread can answer while cancel_order() is still executing (F1).
        event = threading.Event()
        if wait_response:
            with self._lock:
                self._rsp_events[order_ref] = event

        rc = self._trader.cancel_order(
            order_ref=order_ref,
            order_sys_id=sys_id,
            exchange_id=order.get("exchangeID", ""),
            instrument_id=order.get("instrumentID", ""),
        )
        if rc != 0:
            if wait_response:
                with self._lock:
                    self._rsp_events.pop(order_ref, None)
            return {"success": False, "orderRef": order_ref, "message": "CTP local reject"}

        if not wait_response:
            return {"success": True, "orderRef": order_ref, "message": "Submitted"}

        # Wait for OnRspOrderAction callback
        received = event.wait(timeout=wait_timeout)

        with self._lock:
            self._rsp_events.pop(order_ref, None)
            result = self._rsp_action_results.pop(order_ref, None)

        if not received or result is None:
            return {"success": True, "orderRef": order_ref, "message": "Submitted (confirmation timeout)"}

        status, msg = result
        if status == "error":
            return {"success": False, "orderRef": order_ref, "message": msg or "Cancel rejected"}

        return {"success": True, "orderRef": order_ref, "message": "Accepted"}

    # ── Cancel all ────────────────────────────────────────────────────────

    def cancel_all(self) -> dict:
        """Cancel all active (non-final) orders.

        Returns:
            dict: {"attempted": int, "succeeded": int, "failedRefs": [str]}
        """
        with self._lock:
            active_refs = [
                ref for ref, o in self._orders.items()
                if o["orderStatus"] in self._ACTIVE_STATUSES
            ]
        logger.info("CANCEL_ALL active_refs=%s", active_refs)
        succeeded = 0
        failed = []
        for ref in active_refs:
            result = self.cancel(ref, wait_response=False)
            if result["success"]:
                succeeded += 1
            else:
                failed.append(ref)
        return {
            "attempted": len(active_refs),
            "succeeded": succeeded,
            "failedRefs": failed,
        }

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

        After set_session() has been called, callbacks whose
        (frontID, sessionID) do not match the current session are
        silently dropped — these are historical orders pushed by CTP
        after reconnection that would otherwise overwrite active orders.

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

            # Once we know our session identity, filter stale callbacks.
            # Before set_session() is called (_my_front_id == -1), accept
            # all callbacks — no pending orders exist at that point anyway
            # because login hasn't completed yet.
            if self._my_front_id != -1:
                in_front = order_data.get("frontID", 0)
                in_session = order_data.get("sessionID", 0)
                if (in_front, in_session) != (self._my_front_id, self._my_session_id):
                    logger.warning(
                        "Stale OnRtnOrder ignored: ref=%s frontID=%s/%s sessionID=%s/%s",
                        ref, in_front, self._my_front_id,
                        in_session, self._my_session_id,
                    )
                    return

            existing.update(order_data)

        # Signal any thread waiting in insert() — OnRtnOrder may arrive
        # without a prior OnRspOrderInsert (SimNow behaviour)
        event = self._rsp_events.get(ref)
        if event is not None:
            event.set()

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

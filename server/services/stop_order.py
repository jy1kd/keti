"""StopOrderService — stop order lifecycle, trigger monitoring, and persistence.

Monitors market data and automatically submits orders when stop conditions are met.

Architecture:
  StopOrderService.submit()      → create stop order + persist
  StopOrderService.cancel()      → cancel pending stop order
  StopOrderService.list_orders() → return all stop orders
  StopOrderService.on_market_data() → check triggers → OrderManager.insert()
"""

from __future__ import annotations

import json
import logging
import os
import threading
import uuid
from datetime import datetime
from enum import Enum
from pathlib import Path
from queue import Queue
from typing import Any, Callable, Dict, List, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from services.market_service import MarketService
    from services.order_manager import OrderManager

logger = logging.getLogger(__name__)


class StopOrderStatus(str, Enum):
    """Stop order status values."""
    PENDING = "pending"
    TRIGGERING = "triggering"  # 中间状态，防止重复触发
    TRIGGERED = "triggered"
    CANCELED = "canceled"
    TRIGGER_FAILED = "trigger_failed"


class StopOrder:
    """Stop order data model."""

    def __init__(
        self,
        stop_order_id: str,
        instrument_id: str,
        direction: str,
        offset_flag: str,
        limit_price: float,
        volume: int,
        stop_price: float,
        exchange_id: str = "CFFEX",
        trigger_price_type: str = "2",  # "1"=市价, "2"=限价
        status: StopOrderStatus = StopOrderStatus.PENDING,
        created_at: Optional[str] = None,
        triggered_at: Optional[str] = None,
        order_ref: Optional[str] = None,
    ) -> None:
        self.stop_order_id = stop_order_id
        self.instrument_id = instrument_id
        self.exchange_id = exchange_id
        self.direction = direction
        self.offset_flag = offset_flag
        self.limit_price = limit_price
        self.volume = volume
        self.stop_price = stop_price
        self.trigger_price_type = trigger_price_type
        self.status = status
        self.created_at = created_at or datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.triggered_at = triggered_at
        self.order_ref = order_ref

    def to_dict(self) -> dict:
        """Serialize to camelCase dict for JSON/API."""
        return {
            "stopOrderID": self.stop_order_id,
            "instrumentID": self.instrument_id,
            "exchangeID": self.exchange_id,
            "direction": self.direction,
            "offsetFlag": self.offset_flag,
            "limitPrice": self.limit_price,
            "volume": self.volume,
            "stopPrice": self.stop_price,
            "triggerPriceType": self.trigger_price_type,
            "status": self.status.value,
            "createdAt": self.created_at,
            "triggeredAt": self.triggered_at,
            "orderRef": self.order_ref,
        }

    @classmethod
    def from_dict(cls, d: dict) -> "StopOrder":
        """Deserialize from camelCase dict."""
        return cls(
            stop_order_id=d["stopOrderID"],
            instrument_id=d["instrumentID"],
            exchange_id=d.get("exchangeID", "CFFEX"),
            direction=d["direction"],
            offset_flag=d["offsetFlag"],
            limit_price=d["limitPrice"],
            volume=d["volume"],
            stop_price=d["stopPrice"],
            trigger_price_type=d.get("triggerPriceType", "2"),
            status=StopOrderStatus(d["status"]),
            created_at=d.get("createdAt"),
            triggered_at=d.get("triggeredAt"),
            order_ref=d.get("orderRef"),
        )


class StopOrderService:
    """Stop order lifecycle management and trigger monitoring.

    Thread-safety: all public methods are protected by _lock.
    Persistence: stop orders are saved to data/stop_orders.json on every
    state change. On startup, only pending orders are loaded.
    """

    def __init__(
        self,
        data_dir: str,
        order_manager: "OrderManager",
        market_service: Optional["MarketService"] = None,
    ) -> None:
        self._data_dir = data_dir
        self._order_manager = order_manager
        self._market_service = market_service  # Reserved for future use (e.g., snapshot lookup)
        self._orders: List[StopOrder] = []
        self._lock = threading.Lock()
        self._broadcast_fn: Optional[Callable[[str, dict], None]] = None

        # 触发报单执行队列：止损触发在 MD 行情回调线程上判定，但 insert() 默认
        # wait_response=True 会阻塞最长 3s（event.wait）——若在回调线程内执行，
        # 期间所有合约的行情 tick 均无法处理。因此触发只入队，由单一 daemon
        # 工作线程串行执行（同时避免并发 ReqOrderInsert 的 CTP 非线程安全）。
        self._trigger_queue: "Queue[tuple]" = Queue()
        self._trigger_inflight = 0  # 进行中的触发数（wait_for_pending_triggers 用）
        self._start_trigger_worker()

        # Load pending orders from disk
        self._load_from_disk()

    # ── Trigger execution worker ───────────────────────────────────────────

    def _start_trigger_worker(self) -> None:
        """Start the single daemon worker that executes triggered stop orders."""

        def _run() -> None:
            while True:
                order, last_price = self._trigger_queue.get()
                with self._lock:
                    self._trigger_inflight += 1
                try:
                    self._execute_trigger(order, last_price)
                except Exception:
                    logger.error("Stop order trigger execution failed: id=%s",
                                 order.stop_order_id, exc_info=True)
                finally:
                    with self._lock:
                        self._trigger_inflight -= 1

        threading.Thread(target=_run, name="stop-order-trigger", daemon=True).start()

    def wait_for_pending_triggers(self, timeout: float = 5.0) -> None:
        """Block until all currently-queued trigger executions finish.

        Used by tests to make async trigger execution deterministic, and by
        shutdown paths to ensure pending triggers are drained before exit.
        """
        import time
        deadline = time.monotonic() + timeout
        while time.monotonic() < deadline:
            with self._lock:
                if self._trigger_queue.empty() and self._trigger_inflight == 0:
                    return
            time.sleep(0.005)

    # ── Broadcast hook ──────────────────────────────────────────────────────

    def set_broadcast_fn(self, fn: Callable[[str, dict], None]) -> None:
        """Set callback for WebSocket broadcast on stop order events."""
        self._broadcast_fn = fn

    # ── Submit ──────────────────────────────────────────────────────────────

    def submit(
        self,
        instrument_id: str,
        direction: str,
        offset_flag: str,
        limit_price: float,
        volume: int,
        stop_price: float,
        exchange_id: str = "CFFEX",
        trigger_price_type: str = "2",
    ) -> dict:
        """Submit a new stop order.

        Returns:
            dict: {"success": bool, "stopOrderID": str, "message": str}
        """
        stop_id = f"so-{uuid.uuid4().hex[:8]}"
        order = StopOrder(
            stop_order_id=stop_id,
            instrument_id=instrument_id,
            exchange_id=exchange_id,
            direction=direction,
            offset_flag=offset_flag,
            limit_price=limit_price,
            volume=volume,
            stop_price=stop_price,
            trigger_price_type=trigger_price_type,
        )

        with self._lock:
            self._orders.append(order)
            self._save_to_disk()

        logger.info("Stop order submitted: id=%s instrument=%s direction=%s stop=%s",
                     stop_id, instrument_id, direction, stop_price)

        # Broadcast
        if self._broadcast_fn is not None:
            try:
                self._broadcast_fn("stop_order_update", order.to_dict())
            except Exception:
                logger.warning("Broadcast on submit failed", exc_info=True)

        return {"success": True, "stopOrderID": stop_id, "message": "Stop order created"}

    # ── Cancel ──────────────────────────────────────────────────────────────

    def cancel(self, stop_order_id: str) -> dict:
        """Cancel a pending stop order.

        Returns:
            dict: {"success": bool, "message": str}
        """
        with self._lock:
            for order in self._orders:
                if order.stop_order_id == stop_order_id:
                    if order.status != StopOrderStatus.PENDING:
                        return {
                            "success": False,
                            "message": f"Cannot cancel: status is {order.status.value}",
                        }
                    order.status = StopOrderStatus.CANCELED
                    self._save_to_disk()

                    logger.info("Stop order canceled: id=%s", stop_order_id)

                    # Broadcast
                    if self._broadcast_fn is not None:
                        try:
                            self._broadcast_fn("stop_order_update", order.to_dict())
                        except Exception:
                            logger.warning("Broadcast on cancel failed", exc_info=True)

                    return {"success": True, "message": "Stop order canceled"}

        return {"success": False, "message": "Stop order not found"}

    # ── List ────────────────────────────────────────────────────────────────

    def list_orders(self) -> List[dict]:
        """Return all stop orders (including canceled/triggered)."""
        with self._lock:
            return [o.to_dict() for o in self._orders]

    # ── Market data handler ─────────────────────────────────────────────────

    def on_market_data(self, instrument_id: str, last_price: float) -> None:
        """Check stop orders for the given instrument against the latest price.

        Trigger conditions:
        - Long stop (direction=buy "0"): triggers when lastPrice <= stopPrice
        - Short stop (direction=sell "1"): triggers when lastPrice >= stopPrice

        On trigger, submits an order via OrderManager.insert().
        """
        with self._lock:
            candidates = [
                o for o in self._orders
                if o.instrument_id == instrument_id and o.status == StopOrderStatus.PENDING
            ]

        for order in candidates:
            should_trigger = False
            if order.direction == "0":  # Long stop
                should_trigger = last_price <= order.stop_price
            else:  # Short stop
                should_trigger = last_price >= order.stop_price

            if should_trigger:
                self._trigger_order(order, last_price)

    def _trigger_order(self, order: StopOrder, last_price: float) -> None:
        """Execute the triggered stop order."""
        # Check status and set to TRIGGERING atomically to prevent duplicate triggers
        with self._lock:
            if order.status != StopOrderStatus.PENDING:
                logger.debug("Stop order %s already in status %s, skipping trigger",
                             order.stop_order_id, order.status.value)
                return
            # Set intermediate state to prevent concurrent triggers
            order.status = StopOrderStatus.TRIGGERING

        logger.info("Stop order triggered: id=%s instrument=%s price=%s stop=%s",
                     order.stop_order_id, order.instrument_id, last_price, order.stop_price)

        # 只入队：实际报单在 daemon 工作线程串行执行，MD 回调线程立即返回，
        # 不再阻塞行情分发（insert 默认 wait_response=True 会等回报最长 3s）。
        self._trigger_queue.put((order, last_price))

    def _execute_trigger(self, order: StopOrder, last_price: float) -> None:
        """Execute a triggered stop order (runs on the trigger worker thread).

        与 _trigger_order 分离：阻塞式 insert 与状态更新不在 MD 行情回调线程执行，
        避免全品种行情因单笔止损触发而停摆。
        """
        # Submit the actual order
        # 市价触发：limitPrice 作为保护价传给 stop_price（CTP 市价单忽略 LimitPrice）
        # 限价触发：limitPrice 作为委托价传给 limit_price
        is_market = order.trigger_price_type == "1"
        result = self._order_manager.insert(
            instrument_id=order.instrument_id,
            exchange_id=order.exchange_id,
            direction=order.direction,
            offset_flag=order.offset_flag,
            price_type=order.trigger_price_type,  # "1"=市价, "2"=限价
            limit_price=0.0 if is_market else order.limit_price,
            volume=order.volume,
            stop_price=order.limit_price if is_market else 0.0,
        )

        with self._lock:
            if result.get("success"):
                order.status = StopOrderStatus.TRIGGERED
                order.order_ref = result.get("orderRef", "")
                order.triggered_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            else:
                order.status = StopOrderStatus.TRIGGER_FAILED
                order.triggered_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                logger.warning("Stop order trigger failed: id=%s reason=%s",
                               order.stop_order_id, result.get("message", "Unknown"))

            self._save_to_disk()

        # Broadcast
        if self._broadcast_fn is not None:
            try:
                self._broadcast_fn("stop_order_update", order.to_dict())
            except Exception:
                logger.warning("Broadcast on trigger failed", exc_info=True)

    # ── Persistence ─────────────────────────────────────────────────────────

    def _get_file_path(self) -> str:
        """Get the path to the stop orders JSON file."""
        return os.path.join(self._data_dir, "stop_orders.json")

    def _save_to_disk(self) -> None:
        """Save all stop orders to disk (must hold _lock).

        Uses atomic write (write to temp file then rename) to prevent
        data loss if the process crashes during write.
        """
        file_path = self._get_file_path()
        tmp_path = file_path + ".tmp"
        try:
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(tmp_path, "w", encoding="utf-8") as f:
                json.dump([o.to_dict() for o in self._orders], f, ensure_ascii=False, indent=2)
            os.replace(tmp_path, file_path)  # Atomic on POSIX/Windows
        except OSError as exc:
            logger.error("Failed to save stop orders: %s", exc)
            # Clean up temp file if it exists
            try:
                os.remove(tmp_path)
            except OSError:
                pass

    def _load_from_disk(self) -> None:
        """Load pending stop orders from disk on startup.

        GFD (Good For Day): only loads orders created today.
        Stop orders from previous days are discarded.
        """
        file_path = self._get_file_path()
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (FileNotFoundError, json.JSONDecodeError, OSError):
            return

        today = datetime.now().strftime("%Y-%m-%d")
        loaded = 0
        skipped_old = 0

        for d in data:
            try:
                order = StopOrder.from_dict(d)
                # Only load pending orders
                if order.status != StopOrderStatus.PENDING:
                    continue
                # GFD: skip orders from previous days
                if order.created_at and not order.created_at.startswith(today):
                    skipped_old += 1
                    continue
                self._orders.append(order)
                loaded += 1
            except (KeyError, ValueError) as exc:
                logger.warning("Skipping invalid stop order: %s", exc)

        if loaded > 0 or skipped_old > 0:
            logger.info("Loaded %d stop orders from disk (%d expired GFD skipped)",
                        loaded, skipped_old)

"""CTP connection management — auto-startup and explicit login.

Two entry points:
  - start_ctp_market_connection(app, config): called at startup (blocks)
  - connect_ctp(app, broker_id, user_id, password, wait): called from /login

Both share the same internal _connect_ctp() implementation.
"""

from __future__ import annotations

import asyncio
import logging
import threading
from typing import Any, List, Optional, TYPE_CHECKING

from services.ctp_bridge import wire_market_data_callback

if TYPE_CHECKING:
    from fastapi import FastAPI
    from config import Config

logger = logging.getLogger(__name__)

LOGIN_TIMEOUT: float = 30.0  # seconds to wait for CTP callbacks


def connect_ctp(
    app: "FastAPI",
    broker_id: str,
    user_id: str,
    password: str,
    wait: bool = False,
) -> dict:
    """Start CTP connection with explicit credentials.

    Args:
        app: The FastAPI application instance.
        broker_id: CTP broker ID (e.g. "9999").
        user_id: CTP user ID.
        password: CTP password.
        wait: If True, block until connection result is known (up to LOGIN_TIMEOUT).
              If False, return immediately with success=True.

    Returns:
        dict with keys: success, message, userID.
    """
    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()

    # Shared result dict — _connect_ctp writes the outcome here
    result: dict = {"success": False, "message": "Connection not started", "userID": user_id}
    login_done = threading.Event() if wait else None

    thread = threading.Thread(
        target=_connect_ctp,
        args=(app, broker_id, user_id, password, loop, result, login_done),
        daemon=True,
        name="ctp-connect",
    )
    thread.start()
    app.state.ctp_thread = thread
    logger.info("CTP connection thread started (user=%s)", user_id)

    if wait and login_done is not None:
        login_done.wait(timeout=LOGIN_TIMEOUT)
        return result

    return {"success": True, "message": "Connection initiated", "userID": user_id}


def start_ctp_market_connection(
    app: "FastAPI",
    config: "Config",
) -> dict:
    """Start CTP connection at app startup using .env credentials.

    Calls connect_ctp() with wait=True to block until result is known.

    Args:
        app: The FastAPI application instance.
        config: The Config instance with CTP connection parameters.

    Returns:
        dict with connection result.
    """
    return connect_ctp(
        app, config.broker_id, config.user_id, config.password,
        wait=True,
    )


def _connect_ctp(
    app: "FastAPI",
    broker_id: str,
    user_id: str,
    password: str,
    loop: asyncio.AbstractEventLoop,
    result: dict,
    login_done_signal: Optional[threading.Event] = None,
) -> None:
    """Internal: run the full CTP connection flow in the current thread.

    Args:
        result: Mutable dict to write the outcome into.
        login_done_signal: Optional Event to signal when login succeeds/fails.
    """
    from ctp_wrapper.md_user_api import MdUserApi
    from config import Config

    config = Config(broker_id=broker_id, user_id=user_id, password=password)
    md_api = MdUserApi(config)
    app.state.md_api = md_api

    front_connected = threading.Event()
    login_done = threading.Event()
    error_message = ""

    def _on_front_connected() -> None:
        md_api.connection_status = "connected"
        front_connected.set()
        try:
            md_api.login()
            logger.info("CTP front connected, login sent (user=%s)", user_id)
        except Exception:
            logger.warning("CTP login request failed", exc_info=True)
            login_done.set()

    def _on_rsp_user_login(
        pRspUserLogin: Any, pRspInfo: Any,
        nRequestID: int, bIsLast: bool,
    ) -> None:
        nonlocal error_message
        if not bIsLast:
            return

        # pRspInfo=None or ErrorID=0 means success; anything else is failure
        if pRspInfo is None or getattr(pRspInfo, "ErrorID", -1) == 0:
            md_api.login_status = "logged_in"
            logger.info("CTP login successful (user=%s)", user_id)
            _wire_bridge(app, md_api, loop)
            login_done.set()
            return

        error_message = getattr(pRspInfo, "ErrorMsg", "unknown error")
        logger.warning("CTP login failed: %s", error_message)
        login_done.set()

    md_api.spi.on("OnFrontConnected", _on_front_connected)
    md_api.spi.on("OnRspUserLogin", _on_rsp_user_login)

    try:
        md_api.create()
        logger.info("CTP connection initiated (front=%s)", config.md_front)
    except Exception as exc:
        logger.warning("CTP MdUserApi.create() failed", exc_info=True)
        result["message"] = f"CTP create failed: {exc}"
        if login_done_signal:
            login_done_signal.set()
        return

    # Wait for OnFrontConnected
    if not front_connected.wait(timeout=LOGIN_TIMEOUT):
        msg = "CTP front connection timeout"
        logger.warning(msg)
        result["message"] = msg
        if login_done_signal:
            login_done_signal.set()
        return

    # Wait for OnRspUserLogin
    if not login_done.wait(timeout=LOGIN_TIMEOUT):
        msg = "CTP login timeout"
        logger.warning(msg)
        result["message"] = msg
        if login_done_signal:
            login_done_signal.set()
        return

    # Check result
    if md_api.login_status == "logged_in":
        result["success"] = True
        result["message"] = "Login successful"
    else:
        result["message"] = f"Login failed: {error_message}" if error_message else "Login failed"

    if login_done_signal:
        login_done_signal.set()


def _wire_bridge(
    app: "FastAPI",
    md_api: Any,
    loop: asyncio.AbstractEventLoop,
) -> None:
    """Wire the market data bridge: CTP → MarketService → WebSocket.

    Uses the provided event loop (from the asyncio main thread) to schedule
    WebSocket broadcasts via asyncio.run_coroutine_threadsafe().

    Args:
        app: The FastAPI application instance.
        md_api: The MdUserApi instance.
        loop: The asyncio event loop captured during startup.
    """
    ws_manager = app.state.ws_manager

    def _broadcast_to_ws(data: dict) -> None:
        asyncio.run_coroutine_threadsafe(
            ws_manager.broadcast("market", "market_data", data),
            loop,
        )

    def _broadcast_system(msg_type: str, data: dict) -> None:
        asyncio.run_coroutine_threadsafe(
            ws_manager.broadcast("system", msg_type, data),
            loop,
        )

    # Create K-line aggregation service
    from services.kline_service import KLineService
    kline_service = KLineService()
    app.state.kline_service = kline_service

    wire_market_data_callback(
        md_api.spi,
        app.state.market_service,
        broadcast_fn=_broadcast_to_ws,
        kline_service=kline_service,
    )

    # Wire OnFrontDisconnected → system broadcast + reconnect
    from services.reconnect import ReconnectService

    reconnect_svc = ReconnectService(
        connect_fn=lambda: _attempt_reconnect(app, md_api, loop),
        subscribe_fn=md_api.subscribe,
    )
    app.state.reconnect_service = reconnect_svc

    # Wire subscribe/unsubscribe: MarketService → CTP MdUserApi
    # Wrap subscribe to also update ReconnectService subscription tracking
    _original_subscribe = md_api.subscribe

    def _subscribe_with_tracking(instruments: List[str]) -> None:
        _original_subscribe(instruments)
        # Sync full subscription list to ReconnectService after each subscribe
        reconnect_svc.update_subscriptions(app.state.market_service.get_subscriptions())

    app.state.market_service.set_ctp_hooks(
        subscribe_fn=_subscribe_with_tracking,
        unsubscribe_fn=md_api.unsubscribe,
    )

    def _on_front_disconnected(nReason: int) -> None:
        logger.warning("CTP front disconnected (reason=%s)", nReason)
        _broadcast_system("connection_status", {
            "status": "disconnected",
            "reason": nReason,
        })
        reconnect_svc.on_disconnect()
        if reconnect_svc.should_retry():
            delay = reconnect_svc.get_current_delay()
            logger.info("reconnect: will attempt in %.1fs", delay)
            # Schedule reconnect after delay
            def _do_reconnect():
                import time
                time.sleep(delay)
                success = reconnect_svc.try_reconnect()
                if success:
                    _broadcast_system("connection_status", {
                        "status": "connected",
                    })
                else:
                    _broadcast_system("connection_status", {
                        "status": "reconnect_failed",
                    })

            threading.Thread(target=_do_reconnect, daemon=True).start()

    md_api.spi.on("OnFrontDisconnected", _on_front_disconnected)

    logger.info("CTP market data bridge wired — snapshots + WebSocket + K-line + subscribe + disconnect handling active")


def _attempt_reconnect(app: "FastAPI", md_api: Any, loop: asyncio.AbstractEventLoop) -> bool:
    """Attempt to reconnect CTP. Returns True on success.

    Steps:
    1. Release old CTP API instance (cleanup DLL handles + threads)
    2. Create new instance and wait for OnFrontConnected
    3. Login and wait for OnRspUserLogin
    4. On success, re-wire the market data bridge
    """
    try:
        # Release old instance to avoid resource leaks
        try:
            md_api.release()
        except Exception:
            logger.debug("reconnect: release old instance failed (may already be released)")

        # Reset login status
        md_api.login_status = "not_logged_in"

        # Events for synchronization
        front_connected = threading.Event()
        login_done = threading.Event()

        def _on_front_connected():
            front_connected.set()
            try:
                md_api.login()
            except Exception:
                logger.warning("reconnect: login request failed", exc_info=True)
                login_done.set()

        def _on_rsp_user_login(pRspUserLogin, pRspInfo, nRequestID, bIsLast):
            if not bIsLast:
                return
            if pRspInfo is None or getattr(pRspInfo, "ErrorID", -1) == 0:
                md_api.login_status = "logged_in"
            login_done.set()

        # Register temporary handlers for reconnect
        md_api.spi.on("OnFrontConnected", _on_front_connected)
        md_api.spi.on("OnRspUserLogin", _on_rsp_user_login)

        md_api.create()

        # Wait for front connection (up to 15s)
        if not front_connected.wait(timeout=15.0):
            logger.warning("reconnect: front connection timeout")
            return False

        # Wait for login result (up to 15s)
        if not login_done.wait(timeout=15.0):
            logger.warning("reconnect: login timeout")
            return False

        if md_api.login_status != "logged_in":
            return False

        # Re-wire the market data bridge after successful reconnect
        _wire_bridge(app, md_api, loop)
        return True
    except Exception as e:
        logger.error("reconnect attempt failed: %s", e)
        return False


# ── Trading (TD) connection (PR-9) ────────────────────────────────────────
# Mirror of the MD connection flow but for the trading API.

def start_ctp_trading_connection(
    app: "FastAPI",
    config: "Config",
) -> None:
    """Start CTP trading connection in a background thread.

    Creates TraderApi + OrderManager, connects to TD front, logs in,
    and wires OnRtnOrder/OnRtnTrade callbacks to OrderManager + WebSocket.

    Unlike MD connection, this function returns immediately (fire-and-forget).
    The /api/connection/status endpoint reflects the actual TD connection state.

    Args:
        app: The FastAPI application instance.
        config: The Config instance with CTP connection parameters.
    """
    from ctp_wrapper.trader_api import TraderApi
    from services.order_manager import OrderManager
    from services.field_mapping import map_order, map_trade

    loop = asyncio.get_running_loop()

    trader = TraderApi(config)
    app.state.trader_api = trader
    app.state.order_manager = OrderManager(trader)

    # Set up broadcast hook for OrderManager
    ws_manager = app.state.ws_manager

    def _broadcast_order(msg_type: str, data: dict) -> None:
        asyncio.run_coroutine_threadsafe(
            ws_manager.broadcast("order", msg_type, data),
            loop,
        )

    app.state.order_manager.set_broadcast_fn(_broadcast_order)

    # Wire CTP callbacks → field mapping → OrderManager
    def _on_rtn_order(pOrder):
        data = map_order(pOrder)
        app.state.order_manager.on_rtn_order(data)

    def _on_rtn_trade(pTrade):
        data = map_trade(pTrade)
        app.state.order_manager.on_rtn_trade(data)

    # Wire login flow callbacks (mirrors _connect_ctp MD pattern)
    login_done = threading.Event()

    def _on_front_connected():
        trader.connection_status = "connected"
        try:
            trader.login()
            logger.info("CTP TD front connected, login sent (user=%s)", config.user_id)
        except Exception:
            logger.warning("CTP TD login request failed", exc_info=True)
            login_done.set()

    def _on_rsp_user_login(pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        if not bIsLast:
            return
        if pRspInfo is None or getattr(pRspInfo, "ErrorID", -1) == 0:
            trader.login_status = "logged_in"
            logger.info("CTP TD login successful (user=%s)", config.user_id)
        else:
            err_msg = getattr(pRspInfo, "ErrorMsg", "unknown error")
            logger.warning("CTP TD login failed: %s", err_msg)
        login_done.set()

    # Wire order response callbacks — forward errors to OrderManager for logging
    def _on_rsp_order_insert(pInputOrder, pRspInfo, nRequestID, bIsLast):
        if not bIsLast:
            return
        if pRspInfo is not None and getattr(pRspInfo, "ErrorID", -1) != 0:
            err_msg = getattr(pRspInfo, "ErrorMsg", "unknown error")
            logger.warning("CTP order insert rejected: %s", err_msg)

    def _on_rsp_order_action(pInputOrderAction, pRspInfo, nRequestID, bIsLast):
        if not bIsLast:
            return
        if pRspInfo is not None and getattr(pRspInfo, "ErrorID", -1) != 0:
            err_msg = getattr(pRspInfo, "ErrorMsg", "unknown error")
            logger.warning("CTP order action rejected: %s", err_msg)

    trader.spi.on("OnFrontConnected", _on_front_connected)
    trader.spi.on("OnRspUserLogin", _on_rsp_user_login)
    trader.spi.on("OnRtnOrder", _on_rtn_order)
    trader.spi.on("OnRtnTrade", _on_rtn_trade)
    trader.spi.on("OnRspOrderInsert", _on_rsp_order_insert)
    trader.spi.on("OnRspOrderAction", _on_rsp_order_action)

    def _run():
        try:
            trader.create()
            logger.info("CTP trading connection initiated (front=%s)", config.td_front)
            # Wait for login result with timeout
            if not login_done.wait(timeout=LOGIN_TIMEOUT):
                logger.warning("CTP TD login timeout after %.0fs", LOGIN_TIMEOUT)
        except Exception:
            logger.warning("CTP TraderApi.create() failed", exc_info=True)

    thread = threading.Thread(target=_run, daemon=True, name="ctp-td-connect")
    thread.start()
    app.state.td_thread = thread
    logger.info("CTP trading connection thread started")

    # TODO(PR-17): Add TD reconnect logic.  Currently only MD has
    # reconnect (via ReconnectService + OnFrontDisconnected handler).
    # TD is a separate CTP connection — if it drops, orders/trades
    # stop flowing.  PR-17 should add a similar TD ReconnectService
    # or extend the existing one to handle both connections.

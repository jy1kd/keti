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
from typing import Any, Optional, TYPE_CHECKING

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
    def _broadcast_to_ws(data: dict) -> None:
        asyncio.run_coroutine_threadsafe(
            app.state.ws_manager.broadcast("market", "market_data", data),
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

    # Wire subscribe/unsubscribe: MarketService → CTP MdUserApi
    app.state.market_service.set_ctp_hooks(
        subscribe_fn=md_api.subscribe,
        unsubscribe_fn=md_api.unsubscribe,
    )

    logger.info("CTP market data bridge wired — snapshots + WebSocket + K-line + subscribe active")

"""CTP auto-startup — connect to CTP market data on FastAPI startup.

Runs the CTP connection flow in a background daemon thread so it does not
block the asyncio event loop. On success, wires the market-data callback
chain (CTP → field_mapping → MarketService → WebSocket broadcast).

Usage (in create_app):
    @app.on_event("startup")
    async def startup():
        start_ctp_market_connection(app, config)
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


def start_ctp_market_connection(
    app: "FastAPI",
    config: "Config",
) -> threading.Thread:
    """Start CTP market data connection in a background daemon thread.

    The thread:
    1. Creates MdUserApi(config) and stores it on app.state.md_api
    2. Registers OnFrontConnected → auto-login
    3. Registers OnRspUserLogin → auto-wire market data bridge
    4. Calls md_api.create() to initiate the CTP connection
    5. Waits for the callback chain to complete (with timeout)

    Connection failure does not prevent the HTTP server from starting.
    Failures are logged at WARNING level.

    Args:
        app: The FastAPI application instance.
        config: The Config instance with CTP connection parameters.

    Returns:
        The background thread (daemon=True). Caller may ignore it.
    """
    def _connect() -> None:
        # Lazy import — only when we actually need CTP
        from ctp_wrapper.md_user_api import MdUserApi

        md_api = MdUserApi(config)
        app.state.md_api = md_api

        # Synchronization primitives for the callback chain
        front_connected = threading.Event()
        login_done = threading.Event()

        def _on_front_connected() -> None:
            """Callback: CTP front connected → send login request."""
            try:
                md_api.login()
                logger.info("CTP front connected, login sent (user=%s)",
                            config.user_id)
            except Exception:
                logger.warning("CTP login request failed", exc_info=True)
                login_done.set()  # Unblock the waiter

        def _on_rsp_user_login(
            pRspUserLogin: Any, pRspInfo: Any,
            nRequestID: int, bIsLast: bool,
        ) -> None:
            """Callback: login response → wire market data bridge on success."""
            if not bIsLast:
                return  # Wait for the final response

            if pRspInfo is not None and getattr(pRspInfo, "ErrorID", -1) != 0:
                error_msg = getattr(pRspInfo, "ErrorMsg", "unknown error")
                logger.warning("CTP login failed: %s", error_msg)
                login_done.set()
                return

            md_api.login_status = "logged_in"
            logger.info("CTP login successful (user=%s)", config.user_id)

            # Wire the market data bridge
            _wire_bridge(app, md_api)
            login_done.set()

        # Register callbacks
        md_api.spi.on("OnFrontConnected", _on_front_connected)
        md_api.spi.on("OnRspUserLogin", _on_rsp_user_login)

        # Initiate connection
        try:
            md_api.create()
            logger.info("CTP connection initiated (front=%s)", config.md_front)
        except Exception:
            logger.warning("CTP MdUserApi.create() failed", exc_info=True)
            return

        # Wait for OnFrontConnected
        if not front_connected.wait(timeout=LOGIN_TIMEOUT):
            logger.warning(
                "CTP OnFrontConnected timeout after %.0fs — "
                "market data will not be available", LOGIN_TIMEOUT,
            )
            return

        # Wait for OnRspUserLogin
        if not login_done.wait(timeout=LOGIN_TIMEOUT):
            logger.warning(
                "CTP login timeout after %.0fs — "
                "market data will not be available", LOGIN_TIMEOUT,
            )

    thread = threading.Thread(target=_connect, daemon=True, name="ctp-md-startup")
    thread.start()
    logger.info("CTP startup thread launched")
    return thread


def _wire_bridge(app: "FastAPI", md_api: Any) -> None:
    """Wire the market data bridge: CTP → MarketService → WebSocket.

    Uses asyncio.run_coroutine_threadsafe() to cross from the CTP worker
    thread into the asyncio event loop for WebSocket broadcasts.
    """
    loop = asyncio.get_event_loop()

    def _broadcast_to_ws(data: dict) -> None:
        asyncio.run_coroutine_threadsafe(
            app.state.ws_manager.broadcast("market", "market_data", data),
            loop,
        )

    wire_market_data_callback(
        md_api.spi,
        app.state.market_service,
        broadcast_fn=_broadcast_to_ws,
    )
    logger.info("CTP market data bridge wired — snapshots + WebSocket active")

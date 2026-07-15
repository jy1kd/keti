"""WebSocket message handlers.

Routes incoming client messages and dispatches to appropriate handlers.
All handlers integrate with WebSocketManager for connection lifecycle.
"""

import json
import logging
from typing import Any, Callable, Coroutine, List, Optional

from fastapi import WebSocket

from ws.manager import WebSocketManager

logger = logging.getLogger(__name__)


async def handle_ws(
    endpoint: str,
    ws_manager: WebSocketManager,
    websocket: WebSocket,
    subscribe_fn: Optional[Callable[[List[str]], Coroutine]] = None,
    unsubscribe_fn: Optional[Callable[[List[str]], Coroutine]] = None,
) -> None:
    """Generic WebSocket handler — lifecycle + message routing.

    Manages:
    1. Accept and register in ws_manager connection pool
    2. Route incoming messages (subscribe/unsubscribe/ping)
    3. Unregister on disconnect
    """
    await ws_manager.connect(endpoint, websocket)
    try:
        while True:
            try:
                raw = await websocket.receive_text()
            except Exception:
                break

            # Parse JSON
            try:
                msg = json.loads(raw)
            except (json.JSONDecodeError, TypeError):
                continue  # ignore invalid JSON

            action = msg.get("action")

            if action == "ping":
                await websocket.send_json({"type": "pong"})

            elif action == "subscribe" and subscribe_fn is not None:
                instruments = msg.get("instruments", [])
                if isinstance(instruments, list):
                    await subscribe_fn(instruments)
                    await websocket.send_json({
                        "type": "subscribed",
                        "instruments": instruments,
                    })

            elif action == "unsubscribe" and unsubscribe_fn is not None:
                instruments = msg.get("instruments", [])
                if isinstance(instruments, list):
                    await unsubscribe_fn(instruments)
                    await websocket.send_json({
                        "type": "unsubscribed",
                        "instruments": instruments,
                    })
    finally:
        ws_manager.disconnect(endpoint, websocket)


# ── Legacy per-endpoint handlers (kept for backward compatibility) ──


async def handle_market_ws(websocket: WebSocket):
    """Handle ws/market endpoint connections — placeholder."""
    await websocket.accept()
    while True:
        try:
            _ = await websocket.receive_text()
        except Exception:
            break


async def handle_order_ws(websocket: WebSocket):
    """Handle ws/order endpoint connections — placeholder."""
    await websocket.accept()
    while True:
        try:
            _ = await websocket.receive_text()
        except Exception:
            break


async def handle_position_ws(websocket: WebSocket):
    """Handle ws/position endpoint connections — placeholder."""
    await websocket.accept()
    while True:
        try:
            _ = await websocket.receive_text()
        except Exception:
            break


async def handle_stop_ws(websocket: WebSocket):
    """Handle ws/stop endpoint connections — placeholder."""
    await websocket.accept()
    while True:
        try:
            _ = await websocket.receive_text()
        except Exception:
            break


async def handle_system_ws(websocket: WebSocket):
    """Handle ws/system endpoint connections — placeholder."""
    await websocket.accept()
    while True:
        try:
            _ = await websocket.receive_text()
        except Exception:
            break

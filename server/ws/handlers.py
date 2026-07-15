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
            msg_type = msg.get("type")

            if action == "ping" or msg_type == "ping":
                await websocket.send_json({"type": "pong"})

            elif action == "subscribe" and subscribe_fn is not None:
                instruments = msg.get("instruments", [])
                if isinstance(instruments, list):
                    try:
                        await subscribe_fn(instruments)
                        await websocket.send_json({
                            "type": "subscribed",
                            "instruments": instruments,
                        })
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "action": "subscribe",
                            "message": str(e),
                        })

            elif action == "unsubscribe" and unsubscribe_fn is not None:
                instruments = msg.get("instruments", [])
                if isinstance(instruments, list):
                    try:
                        await unsubscribe_fn(instruments)
                        await websocket.send_json({
                            "type": "unsubscribed",
                            "instruments": instruments,
                        })
                    except Exception as e:
                        await websocket.send_json({
                            "type": "error",
                            "action": "unsubscribe",
                            "message": str(e),
                        })
    finally:
        ws_manager.disconnect(endpoint, websocket)

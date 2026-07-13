"""WebSocket message handlers — placeholder (full implementation in PR-7).

Routes incoming client messages and dispatches to appropriate handlers.
"""

from fastapi import WebSocket


async def handle_market_ws(websocket: WebSocket):
    """Handle ws/market endpoint connections — placeholder."""
    await websocket.accept()
    while True:
        # PR-7: will read client messages and dispatch
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

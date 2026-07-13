"""WebSocket message handlers — placeholder (full implementation in PR-7).

Routes incoming client messages and dispatches to appropriate handlers.

PR-7 TODO: 当前 handler 直接调用 websocket.accept()/receive_text()，
未经过 WebSocketManager（ws/manager.py）的 connect()/disconnect() 跟踪。
PR-7 需要：
  - 将 handler 接入 ws_manager 连接池（connect on accept, disconnect on break）
  - 实现消息路由（subscribe/unsubscribe/ping）
  - 连接断开时自动从 ws_manager 移除
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

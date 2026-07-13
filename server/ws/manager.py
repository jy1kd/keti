"""WebSocket connection manager — multi-endpoint connection pool and broadcast.

Endpoints: market, order, position, stop, system
"""

from typing import Any, Dict, List

from fastapi import WebSocket


class WebSocketManager:
    """Manages WebSocket connections grouped by endpoint.

    Supports:
    - connect / disconnect per endpoint
    - broadcast to all connections in an endpoint
    - automatic removal of disconnected clients
    """

    ENDPOINTS = ("market", "order", "position", "stop", "system")

    def __init__(self) -> None:
        self.connections: Dict[str, List[WebSocket]] = {
            ep: [] for ep in self.ENDPOINTS
        }

    async def connect(self, endpoint: str, websocket: WebSocket) -> None:
        """Accept and register a WebSocket connection."""
        if endpoint not in self.connections:
            return
        await websocket.accept()
        self.connections[endpoint].append(websocket)

    def disconnect(self, endpoint: str, websocket: WebSocket) -> None:
        """Remove a WebSocket from its endpoint."""
        if endpoint in self.connections:
            try:
                self.connections[endpoint].remove(websocket)
            except ValueError:
                pass  # Already removed

    async def broadcast(
        self, endpoint: str, msg_type: str, data: Any
    ) -> None:
        """Broadcast a typed message to all connections in an endpoint.

        Automatically removes any connection that raises during send.
        """
        if endpoint not in self.connections:
            return

        message = {"type": msg_type, "data": data}
        dead: List[WebSocket] = []

        for ws in self.connections[endpoint]:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(endpoint, ws)


# Global singleton instance
ws_manager = WebSocketManager()

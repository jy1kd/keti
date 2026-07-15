"""WebSocket connection manager — multi-endpoint connection pool and broadcast.

Endpoints: market, order, position, stop, system
"""

import asyncio
import logging
from typing import Any, Dict, List, Optional

from fastapi import WebSocket

logger = logging.getLogger(__name__)


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
        self._heartbeat_task: Optional[asyncio.Task] = None

    async def start_heartbeat(self, interval: float = 15.0) -> None:
        """Start background heartbeat task that pings all connections."""
        if self._heartbeat_task is not None and not self._heartbeat_task.done():
            return  # already running
        self._heartbeat_task = asyncio.create_task(self._heartbeat_loop(interval))

    async def stop_heartbeat(self) -> None:
        """Stop the background heartbeat task."""
        if self._heartbeat_task is not None:
            self._heartbeat_task.cancel()
            try:
                await self._heartbeat_task
            except asyncio.CancelledError:
                pass
            self._heartbeat_task = None

    async def _heartbeat_loop(self, interval: float) -> None:
        """Background loop: run heartbeat tick every interval seconds."""
        while True:
            await asyncio.sleep(interval)
            await self._heartbeat_tick()

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

        for ws in list(self.connections[endpoint]):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)

        for ws in dead:
            self.disconnect(endpoint, ws)

    async def _heartbeat_tick(self) -> None:
        """Send a ping to all connections; remove those that fail.

        Called periodically by the heartbeat task to detect dead connections.
        """
        for endpoint in self.ENDPOINTS:
            dead: List[WebSocket] = []
            for ws in list(self.connections[endpoint]):
                try:
                    await ws.send_json({"type": "ping"})
                except Exception:
                    dead.append(ws)
            for ws in dead:
                self.disconnect(endpoint, ws)
                logger.debug("heartbeat: removed dead connection from %s", endpoint)

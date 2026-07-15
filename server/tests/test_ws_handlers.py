"""Tests for WebSocket handlers — ws/handlers.py.

Covers:
- Handler integration with WebSocketManager (connect/disconnect lifecycle)
- Message routing (subscribe, unsubscribe, ping)

Uses asyncio.run() instead of pytest.mark.asyncio (pytest-asyncio not available).
"""

import sys
import os
import asyncio
import json
import pytest
from unittest.mock import AsyncMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ws.manager import WebSocketManager


class FakeWebSocket:
    """Minimal async mock for WebSocket."""

    def __init__(self):
        self.accepted = False
        self.sent: list = []
        self._receive_queue: asyncio.Queue = asyncio.Queue()
        self.closed = False

    async def accept(self):
        self.accepted = True

    async def send_json(self, data):
        self.sent.append(data)

    async def receive_text(self):
        val = await self._receive_queue.get()
        if val is None:
            raise Exception("connection closed")
        return val

    def queue_message(self, text: str):
        self._receive_queue.put_nowait(text)

    def close_client(self):
        """Signal client disconnect."""
        self._receive_queue.put_nowait(None)

    async def close(self):
        self.closed = True


# ── Cycle 1: Handler lifecycle with ws_manager ──


def test_handler_registers_connection_in_ws_manager():
    """After handler starts, websocket is in ws_manager connection pool."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        task = asyncio.create_task(handle_ws("market", ws_manager, ws))
        await asyncio.sleep(0.05)
        assert ws.accepted
        assert ws in ws_manager.connections["market"]
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_removes_connection_on_disconnect():
    """When receive_text raises, handler removes websocket from pool."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        task = asyncio.create_task(handle_ws("market", ws_manager, ws))
        await asyncio.sleep(0.05)
        assert ws in ws_manager.connections["market"]
        ws.close_client()
        await asyncio.sleep(0.1)
        assert ws not in ws_manager.connections["market"]
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_accepts_and_registers():
    """Handler calls accept then registers in ws_manager."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        task = asyncio.create_task(handle_ws("order", ws_manager, ws))
        await asyncio.sleep(0.05)
        assert ws.accepted
        assert ws in ws_manager.connections["order"]
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_works_for_all_endpoints():
    """All 5 endpoints register correctly."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        for endpoint in ("market", "order", "position", "stop", "system"):
            ws = FakeWebSocket()
            task = asyncio.create_task(handle_ws(endpoint, ws_manager, ws))
            await asyncio.sleep(0.05)
            assert ws in ws_manager.connections[endpoint]
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass

    asyncio.run(_run())


# ── Cycle 2: Message routing ──


def test_handler_routes_subscribe_message():
    """Client sends subscribe → handler calls subscribe_fn."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        mock_subscribe = AsyncMock()
        task = asyncio.create_task(
            handle_ws("market", ws_manager, ws, subscribe_fn=mock_subscribe)
        )
        await asyncio.sleep(0.05)
        ws.queue_message(json.dumps({"action": "subscribe", "instruments": ["IF2608"]}))
        await asyncio.sleep(0.1)
        mock_subscribe.assert_called_once_with(["IF2608"])
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_routes_unsubscribe_message():
    """Client sends unsubscribe → handler calls unsubscribe_fn."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        mock_unsubscribe = AsyncMock()
        task = asyncio.create_task(
            handle_ws("market", ws_manager, ws, unsubscribe_fn=mock_unsubscribe)
        )
        await asyncio.sleep(0.05)
        ws.queue_message(json.dumps({"action": "unsubscribe", "instruments": ["IF2608"]}))
        await asyncio.sleep(0.1)
        mock_unsubscribe.assert_called_once_with(["IF2608"])
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_routes_ping_message():
    """Client sends ping → handler responds with pong."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        task = asyncio.create_task(handle_ws("system", ws_manager, ws))
        await asyncio.sleep(0.05)
        ws.queue_message(json.dumps({"action": "ping"}))
        await asyncio.sleep(0.1)
        assert any(msg.get("type") == "pong" for msg in ws.sent)
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_ignores_invalid_json():
    """Client sends invalid JSON → handler continues without crashing."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        task = asyncio.create_task(handle_ws("market", ws_manager, ws))
        await asyncio.sleep(0.05)
        ws.queue_message("not json")
        await asyncio.sleep(0.1)
        assert ws in ws_manager.connections["market"]
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())


def test_handler_sends_ack_on_subscribe():
    """After subscribe, handler sends subscribed ack."""
    from ws.handlers import handle_ws

    async def _run():
        ws_manager = WebSocketManager()
        ws = FakeWebSocket()
        mock_subscribe = AsyncMock()
        task = asyncio.create_task(
            handle_ws("market", ws_manager, ws, subscribe_fn=mock_subscribe)
        )
        await asyncio.sleep(0.05)
        ws.queue_message(json.dumps({"action": "subscribe", "instruments": ["IF2608"]}))
        await asyncio.sleep(0.1)
        assert any(
            msg.get("type") == "subscribed" and "IF2608" in msg.get("instruments", [])
            for msg in ws.sent
        )
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass

    asyncio.run(_run())

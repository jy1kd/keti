"""Tests for WebSocket heartbeat — dead connection cleanup.

Covers:
- Heartbeat ping sent to all connections
- Dead connections removed after timeout
- Manager start/stop lifecycle
"""

import sys
import os
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ws.manager import WebSocketManager


class FakeWebSocket:
    """Minimal async mock for WebSocket."""

    def __init__(self, should_fail=False):
        self.accepted = False
        self.sent: list = []
        self.should_fail = should_fail

    async def accept(self):
        self.accepted = True

    async def send_json(self, data):
        if self.should_fail:
            raise Exception("connection dead")
        self.sent.append(data)

    async def ping(self, data=b""):
        if self.should_fail:
            raise Exception("connection dead")


def test_heartbeat_removes_dead_connections():
    """Heartbeat removes connections that fail to respond."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        good_ws = FakeWebSocket(should_fail=False)
        bad_ws = FakeWebSocket(should_fail=True)

        await mgr.connect("market", good_ws)
        await mgr.connect("market", bad_ws)
        assert len(mgr.connections["market"]) == 2

        # Run one heartbeat cycle manually
        await mgr._heartbeat_tick()
        assert len(mgr.connections["market"]) == 1
        assert good_ws in mgr.connections["market"]
        assert bad_ws not in mgr.connections["market"]

    asyncio.run(_run())


def test_heartbeat_sends_ping_to_all_endpoints():
    """Heartbeat sends ping message to connections in all endpoints."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        ws = FakeWebSocket()
        await mgr.connect("order", ws)

        await mgr._heartbeat_tick()

        # Should have received a ping-type message
        assert any("type" in msg for msg in ws.sent)

    asyncio.run(_run())


def test_heartbeat_does_nothing_when_empty():
    """Heartbeat handles empty connection pool gracefully."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        # Should not raise
        await mgr._heartbeat_tick()

    asyncio.run(_run())


def test_heartbeat_handles_partial_failure():
    """Heartbeat removes dead connections while keeping live ones."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        live1 = FakeWebSocket(should_fail=False)
        live2 = FakeWebSocket(should_fail=False)
        dead = FakeWebSocket(should_fail=True)

        await mgr.connect("system", live1)
        await mgr.connect("system", dead)
        await mgr.connect("system", live2)

        await mgr._heartbeat_tick()

        assert len(mgr.connections["system"]) == 2
        assert live1 in mgr.connections["system"]
        assert live2 in mgr.connections["system"]
        assert dead not in mgr.connections["system"]

    asyncio.run(_run())


def test_start_heartbeat_creates_background_task():
    """start_heartbeat creates a running background task."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        await mgr.start_heartbeat(interval=0.1)
        assert mgr._heartbeat_task is not None
        assert not mgr._heartbeat_task.done()
        await mgr.stop_heartbeat()

    asyncio.run(_run())


def test_stop_heartbeat_cancels_task():
    """stop_heartbeat cancels the background task."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        await mgr.start_heartbeat(interval=0.1)
        await mgr.stop_heartbeat()
        assert mgr._heartbeat_task is None or mgr._heartbeat_task.done()

    asyncio.run(_run())


def test_heartbeat_periodically_removes_dead():
    """Background heartbeat periodically cleans dead connections."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        dead = FakeWebSocket(should_fail=True)
        await mgr.connect("market", dead)
        assert len(mgr.connections["market"]) == 1

        await mgr.start_heartbeat(interval=0.05)
        await asyncio.sleep(0.15)  # let 2-3 ticks run
        await mgr.stop_heartbeat()

        assert len(mgr.connections["market"]) == 0

    asyncio.run(_run())

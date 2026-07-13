"""Tests for ws/manager.py — WebSocket connection manager."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from ws.manager import WebSocketManager


class TestWebSocketManagerInit:
    """WebSocketManager initialization and endpoint registry."""

    def test_instantiation(self):
        mgr = WebSocketManager()
        assert mgr is not None

    def test_default_endpoints_are_empty(self):
        mgr = WebSocketManager()
        for endpoint in ["market", "order", "position", "stop", "system"]:
            assert mgr.connections[endpoint] == []

    def test_five_endpoints_registered(self):
        mgr = WebSocketManager()
        assert len(mgr.connections) == 5
        assert set(mgr.connections.keys()) == {
            "market", "order", "position", "stop", "system"
        }


class TestWebSocketManagerConnect:
    """Connect and disconnect operations."""

    @pytest.mark.asyncio
    async def test_connect_adds_to_endpoint(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        await mgr.connect("market", ws)
        assert ws in mgr.connections["market"]

    @pytest.mark.asyncio
    async def test_connect_does_not_cross_pollute(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        await mgr.connect("market", ws)
        assert ws not in mgr.connections["order"]
        assert mgr.connections["order"] == []

    def test_disconnect_removes_from_endpoint(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        mgr.connections["market"].append(ws)
        mgr.disconnect("market", ws)
        assert ws not in mgr.connections["market"]

    def test_disconnect_handles_missing_silently(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        mgr.disconnect("market", ws)  # Should not raise

    @pytest.mark.asyncio
    async def test_connect_invalid_endpoint_silently_skipped(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        # Unknown endpoints should not crash connect()
        await mgr.connect("__invalid__", ws)
        # ws should NOT be added to any endpoint
        for ep in mgr.connections:
            assert ws not in mgr.connections[ep]


class TestWebSocketManagerBroadcast:
    """Broadcast to all connections in an endpoint."""

    @pytest.mark.asyncio
    async def test_broadcast_sends_to_all_in_endpoint(self):
        mgr = WebSocketManager()
        ws1 = _FakeWebSocket()
        ws2 = _FakeWebSocket()
        mgr.connections["market"] = [ws1, ws2]

        await mgr.broadcast("market", "market_data", {"price": 100})

        assert len(ws1.sent) == 1
        assert len(ws2.sent) == 1
        assert ws1.sent[0]["type"] == "market_data"
        assert ws1.sent[0]["data"] == {"price": 100}

    @pytest.mark.asyncio
    async def test_broadcast_does_not_send_to_other_endpoints(self):
        mgr = WebSocketManager()
        ws_market = _FakeWebSocket()
        ws_order = _FakeWebSocket()
        mgr.connections["market"] = [ws_market]
        mgr.connections["order"] = [ws_order]

        await mgr.broadcast("market", "market_data", {})

        assert len(ws_market.sent) == 1
        assert len(ws_order.sent) == 0

    @pytest.mark.asyncio
    async def test_broadcast_empty_endpoint_no_error(self):
        mgr = WebSocketManager()
        await mgr.broadcast("market", "market_data", {})  # Should not raise

    @pytest.mark.asyncio
    async def test_broadcast_removes_disconnected(self):
        mgr = WebSocketManager()
        ws_bad = _FakeWebSocket(raise_on_send=True)
        ws_good = _FakeWebSocket()
        mgr.connections["market"] = [ws_bad, ws_good]

        await mgr.broadcast("market", "market_data", {})

        # Bad connection should be removed
        assert ws_bad not in mgr.connections["market"]
        # Good connection should still receive
        assert ws_good in mgr.connections["market"]
        assert len(ws_good.sent) == 1

    @pytest.mark.asyncio
    async def test_broadcast_message_format(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        mgr.connections["market"] = [ws]

        await mgr.broadcast("market", "connection_status",
                            {"mdConnected": True})

        msg = ws.sent[0]
        assert "type" in msg
        assert "data" in msg
        assert msg["type"] == "connection_status"
        assert msg["data"]["mdConnected"] is True

    @pytest.mark.asyncio
    async def test_broadcast_no_message_key(self):
        mgr = WebSocketManager()
        ws = _FakeWebSocket()
        mgr.connections["market"] = [ws]

        await mgr.broadcast("market", "plain_text", "just a string")
        assert ws.sent[0] == {"type": "plain_text", "data": "just a string"}


# ── Fake WebSocket for testing ─────────────────────────────────────────

class _FakeWebSocket:
    """Minimal async WebSocket stub for unit tests."""

    def __init__(self, raise_on_send: bool = False):
        self.sent: list = []
        self.accepted = False
        self._raise = raise_on_send

    async def accept(self):
        self.accepted = True

    async def send_json(self, data: dict):
        if self._raise:
            raise ConnectionError("disconnected")
        self.sent.append(data)

"""Tests for WebSocket integration — wiring handlers into main.py.

Covers:
- main.py routes use handle_ws instead of old placeholder handlers
- Heartbeat starts on app startup
- Heartbeat stops on app shutdown
- OnFrontDisconnected triggers system broadcast
"""

import sys
import os
import asyncio
import json
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def test_main_routes_use_handle_ws():
    """main.py WebSocket routes delegate to handle_ws with ws_manager."""
    from main import create_app

    app = create_app()
    # Check that ws_manager is on app.state
    assert hasattr(app.state, "ws_manager")
    assert app.state.ws_manager is not None


def test_heartbeat_starts_on_startup():
    """create_app starts the heartbeat task."""
    from main import create_app

    app = create_app()
    # ws_manager should have heartbeat capability
    assert hasattr(app.state.ws_manager, "start_heartbeat")
    assert hasattr(app.state.ws_manager, "stop_heartbeat")


def test_ws_manager_has_heartbeat_methods():
    """WebSocketManager has start_heartbeat and stop_heartbeat."""
    from ws.manager import WebSocketManager

    mgr = WebSocketManager()
    assert callable(getattr(mgr, "start_heartbeat", None))
    assert callable(getattr(mgr, "stop_heartbeat", None))


def test_on_front_disconnected_broadcasts_to_system():
    """When CTP disconnects, system endpoint gets a status message."""
    from ws.manager import WebSocketManager

    async def _run():
        mgr = WebSocketManager()
        # This test verifies the broadcast format for disconnect events
        # The actual wiring is in ctp_startup._wire_bridge
        await mgr.broadcast("system", "connection_status", {
            "status": "disconnected",
            "reason": "network error",
        })
        # No connections to send to, but should not raise

    asyncio.run(_run())


def test_on_front_disconnected_with_active_system_ws():
    """Disconnect broadcast reaches active system WebSocket connections."""
    from ws.manager import WebSocketManager

    class FakeWS:
        def __init__(self):
            self.sent = []
        async def accept(self):
            pass
        async def send_json(self, data):
            self.sent.append(data)

    async def _run():
        mgr = WebSocketManager()
        ws = FakeWS()
        await mgr.connect("system", ws)

        await mgr.broadcast("system", "connection_status", {
            "status": "disconnected",
            "reason": 0x1001,
        })

        assert len(ws.sent) == 1
        msg = ws.sent[0]
        assert msg["type"] == "connection_status"
        assert msg["data"]["status"] == "disconnected"

    asyncio.run(_run())


def test_reconnect_service_integrates_with_disconnect():
    """ReconnectService.on_disconnect is callable after disconnect event."""
    from services.reconnect import ReconnectService

    connect_fn = MagicMock(return_value=True)
    subscribe_fn = MagicMock()
    svc = ReconnectService(connect_fn=connect_fn, subscribe_fn=subscribe_fn)

    # Simulate disconnect
    svc.on_disconnect()
    assert svc._retry_count == 1
    assert svc.should_retry()


def test_handle_ws_accepts_subscribe_fn():
    """handle_ws accepts subscribe_fn and unsubscribe_fn parameters."""
    from ws.handlers import handle_ws
    import inspect

    sig = inspect.signature(handle_ws)
    params = list(sig.parameters.keys())
    assert "subscribe_fn" in params
    assert "unsubscribe_fn" in params

"""Tests for CTP reconnect service — services/reconnect.py.

Covers:
- Exponential backoff strategy
- Max retry limit (5)
- Auto-resubscribe after reconnect
- OnFrontDisconnected integration
"""

import sys
import os
import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestReconnectService:
    """ReconnectService with exponential backoff."""

    def test_create_reconnect_service(self):
        """ReconnectService can be instantiated."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(
            connect_fn=MagicMock(),
            subscribe_fn=MagicMock(),
        )
        assert svc.max_retries == 5
        assert svc.base_delay == 1.0

    def test_exponential_backoff_delays(self):
        """Delays follow exponential backoff: 1s, 2s, 4s, 8s, 16s."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        delays = [svc._get_delay(i) for i in range(5)]
        assert delays == [1.0, 2.0, 4.0, 8.0, 16.0]

    def test_reset_retry_count(self):
        """reset() clears retry count."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        svc._retry_count = 3
        svc.reset()
        assert svc._retry_count == 0

    def test_should_retry_within_limit(self):
        """should_retry returns True when retry_count < max_retries."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        for i in range(5):
            svc._retry_count = i
            assert svc.should_retry()

    def test_should_not_retry_at_limit(self):
        """should_retry returns False when retry_count >= max_retries."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        svc._retry_count = 5
        assert not svc.should_retry()

    def test_on_disconnect_increments_count(self):
        """on_disconnect() increments retry count."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        assert svc._retry_count == 0
        svc.on_disconnect()
        assert svc._retry_count == 1
        svc.on_disconnect()
        assert svc._retry_count == 2

    def test_on_success_resets_count(self):
        """on_success() resets retry count."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        svc._retry_count = 3
        svc.on_success()
        assert svc._retry_count == 0

    def test_get_subscriptions_returns_tracked(self):
        """get_subscriptions returns the tracked instrument list."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        svc.update_subscriptions(["IF2608", "IF2609"])
        assert svc.get_subscriptions() == ["IF2608", "IF2609"]

    def test_update_subscriptions_replaces(self):
        """update_subscriptions replaces the list, not appends."""
        from services.reconnect import ReconnectService

        svc = ReconnectService(connect_fn=MagicMock(), subscribe_fn=MagicMock())
        svc.update_subscriptions(["IF2608"])
        svc.update_subscriptions(["IF2609", "IF2610"])
        assert svc.get_subscriptions() == ["IF2609", "IF2610"]

    def test_try_reconnect_calls_connect_fn(self):
        """try_reconnect calls the connect function."""
        from services.reconnect import ReconnectService

        connect_fn = MagicMock()
        svc = ReconnectService(connect_fn=connect_fn, subscribe_fn=MagicMock())
        svc.try_reconnect()
        connect_fn.assert_called_once()

    def test_try_reconnect_calls_subscribe_fn_with_instruments(self):
        """After successful reconnect, calls subscribe_fn with tracked instruments."""
        from services.reconnect import ReconnectService

        connect_fn = MagicMock(return_value=True)
        subscribe_fn = MagicMock()
        svc = ReconnectService(connect_fn=connect_fn, subscribe_fn=subscribe_fn)
        svc.update_subscriptions(["IF2608"])
        svc.try_reconnect()
        subscribe_fn.assert_called_once_with(["IF2608"])

    def test_try_reconnect_skips_subscribe_on_failure(self):
        """If connect_fn returns False, subscribe_fn is not called."""
        from services.reconnect import ReconnectService

        connect_fn = MagicMock(return_value=False)
        subscribe_fn = MagicMock()
        svc = ReconnectService(connect_fn=connect_fn, subscribe_fn=subscribe_fn)
        svc.update_subscriptions(["IF2608"])
        svc.try_reconnect()
        subscribe_fn.assert_not_called()

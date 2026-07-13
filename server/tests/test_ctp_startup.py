"""Tests for services/ctp_startup.py — CTP auto-connect on application startup."""

import pytest
from unittest.mock import patch, MagicMock

from services.ctp_startup import start_ctp_market_connection


# ── Fake CTP data ──────────────────────────────────────────────────────────

class _FakeSpi:
    """Fake MdSpi with on() handler registration."""

    def __init__(self):
        self._handlers = {}

    def on(self, event_type, handler):
        self._handlers[event_type] = handler


class _FakeMdApi:
    """Fake MdUserApi — records calls without touching CTP DLL."""

    def __init__(self, config):
        self.config = config
        self.spi = _FakeSpi()
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"
        self._created = False

    def create(self):
        self._created = True
        self.connection_status = "connecting"

    def login(self):
        self.login_status = "logging_in"
        return 0

    def release(self):
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"


class _FakeApp:
    """Minimal fake FastAPI app with state."""

    class state:
        ws_manager = MagicMock()
        market_service = MagicMock()
        ws_manager.broadcast = MagicMock()


# ── Tests ──────────────────────────────────────────────────────────────────

class TestStartCtpMarketConnection:
    """Auto-start CTP connection on app startup."""

    def test_import(self):
        """Module should be importable."""
        from services import ctp_startup  # noqa: F401
        assert ctp_startup is not None

    def test_function_exists(self):
        """start_ctp_market_connection should be a callable."""
        assert callable(start_ctp_market_connection)

    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_creates_md_api_with_config(self, MockMdApi):
        """Should create MdUserApi with the given config."""
        MockMdApi.return_value = _FakeMdApi(config=None)
        app = _FakeApp()

        # Use a very short timeout so the test doesn't hang
        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            start_ctp_market_connection(app, config=None)

        MockMdApi.assert_called_once()

    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_spawns_daemon_thread(self, MockMdApi):
        """Should spawn a daemon background thread."""
        MockMdApi.return_value = _FakeMdApi(config=None)
        app = _FakeApp()

        import threading
        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            thread = start_ctp_market_connection(app, config=None)

        assert isinstance(thread, threading.Thread)
        assert thread.daemon is True
        thread.join(timeout=2)

    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_stores_md_api_on_app_state(self, MockMdApi):
        """Should store MdApi instance on app.state.md_api."""
        fake_api = _FakeMdApi(config=None)
        MockMdApi.return_value = fake_api
        app = _FakeApp()

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            thread = start_ctp_market_connection(app, config=None)
        thread.join(timeout=2)

        assert app.state.md_api is fake_api

    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_sets_connection_status_on_create(self, MockMdApi):
        """Should call md_api.create() in the background thread."""
        fake_api = _FakeMdApi(config=None)
        MockMdApi.return_value = fake_api
        app = _FakeApp()

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            thread = start_ctp_market_connection(app, config=None)
        thread.join(timeout=2)

        assert fake_api._created is True

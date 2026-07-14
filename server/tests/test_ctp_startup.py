"""Tests for services/ctp_startup.py — CTP connection management."""

import pytest
import threading
from unittest.mock import patch, MagicMock

from services.ctp_startup import connect_ctp, start_ctp_market_connection


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

class TestConnectCtp:
    """connect_ctp() — non-blocking CTP connection."""

    def test_import(self):
        from services import ctp_startup
        assert ctp_startup is not None

    def test_function_exists(self):
        assert callable(connect_ctp)
        assert callable(start_ctp_market_connection)

    @patch("services.ctp_startup._connect_ctp")
    def test_returns_daemon_thread(self, mock_connect):
        """connect_ctp returns a daemon thread immediately."""
        app = _FakeApp()
        thread = connect_ctp(app, "9999", "test_user", "test_pass")
        assert isinstance(thread, threading.Thread)
        assert thread.daemon is True
        assert thread.name == "ctp-connect"
        mock_connect.assert_called_once()

    @patch("services.ctp_startup._connect_ctp")
    def test_stores_thread_on_app_state(self, mock_connect):
        """Thread is stored on app.state.ctp_thread."""
        app = _FakeApp()
        thread = connect_ctp(app, "9999", "test_user", "test_pass")
        assert app.state.ctp_thread is thread

    @patch("services.ctp_startup._connect_ctp")
    def test_passes_credentials(self, mock_connect):
        """connect_ctp passes broker_id, user_id, password to _connect_ctp."""
        app = _FakeApp()
        connect_ctp(app, "9999", "my_user", "my_pass")
        call_args = mock_connect.call_args
        assert call_args[0][1] == "9999"
        assert call_args[0][2] == "my_user"
        assert call_args[0][3] == "my_pass"


class TestConnectCtpInternal:
    """_connect_ctp() — actual connection flow (with mocked CTP)."""

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_creates_md_api_with_config(self, MockMdApi, MockConfig):
        """Should create MdUserApi with a Config built from credentials."""
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test_user", "test_pass", MagicMock())

        MockConfig.assert_called_once_with(
            broker_id="9999", user_id="test_user", password="test_pass",
        )
        MockMdApi.assert_called_once()

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_stores_md_api_on_app_state(self, MockMdApi, MockConfig):
        """Should store MdApi instance on app.state.md_api."""
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock())

        assert app.state.md_api is fake_api

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_calls_create(self, MockMdApi, MockConfig):
        """Should call md_api.create() in the thread."""
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock())

        assert fake_api._created is True

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_registers_callbacks(self, MockMdApi, MockConfig):
        """Should register OnFrontConnected and OnRspUserLogin callbacks."""
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock())

        assert "OnFrontConnected" in fake_api.spi._handlers
        assert "OnRspUserLogin" in fake_api.spi._handlers

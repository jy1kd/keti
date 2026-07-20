"""Tests for services/ctp_startup.py — CTP connection management."""

import pytest
import threading
from unittest.mock import patch, MagicMock

from services.ctp_startup import connect_ctp, start_ctp_market_connection


# ── Fake CTP data ──────────────────────────────────────────────────────────

class _FakeSpi:
    def __init__(self):
        self._handlers = {}

    def on(self, event_type, handler):
        self._handlers[event_type] = handler


class _FakeMdApi:
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
    class state:
        ws_manager = MagicMock()
        market_service = MagicMock()
        ws_manager.broadcast = MagicMock()


# ── Tests ──────────────────────────────────────────────────────────────────

class TestConnectCtp:
    """connect_ctp() — CTP connection entry point."""

    def test_import(self):
        from services import ctp_startup
        assert ctp_startup is not None

    def test_function_exists(self):
        assert callable(connect_ctp)
        assert callable(start_ctp_market_connection)

    @patch("services.ctp_startup._connect_ctp")
    def test_returns_dict(self, mock_connect):
        """connect_ctp returns a result dict."""
        app = _FakeApp()
        result = connect_ctp(app, "9999", "test_user", "test_pass")
        assert isinstance(result, dict)
        assert "success" in result
        assert "message" in result

    @patch("services.ctp_startup._connect_ctp")
    def test_stores_thread_on_app_state(self, mock_connect):
        """Thread is stored on app.state.ctp_thread."""
        app = _FakeApp()
        connect_ctp(app, "9999", "test_user", "test_pass")
        assert isinstance(app.state.ctp_thread, threading.Thread)

    @patch("services.ctp_startup._connect_ctp")
    def test_passes_credentials(self, mock_connect):
        """connect_ctp passes broker_id, user_id, password to _connect_ctp."""
        app = _FakeApp()
        connect_ctp(app, "9999", "my_user", "my_pass")
        call_args = mock_connect.call_args
        assert call_args[0][1] == "9999"
        assert call_args[0][2] == "my_user"
        assert call_args[0][3] == "my_pass"

    @patch("services.ctp_startup._connect_ctp")
    def test_wait_blocks_for_result(self, mock_connect):
        """With wait=True, returns the result dict from _connect_ctp."""
        def fake_connect(app, broker_id, user_id, password, loop, result, login_done):
            result["success"] = True
            result["message"] = "Login successful"
            if login_done:
                login_done.set()
        mock_connect.side_effect = fake_connect

        app = _FakeApp()
        result = connect_ctp(app, "9999", "test", "pwd", wait=True)
        assert result["success"] is True
        assert result["message"] == "Login successful"


class TestConnectCtpInternal:
    """_connect_ctp() — actual connection flow (with mocked CTP)."""

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_creates_md_api_with_config(self, MockMdApi, MockConfig):
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()
        result = {}

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test_user", "test_pass", MagicMock(), result)

        MockConfig.assert_called_once_with(
            broker_id="9999", user_id="test_user", password="test_pass",
        )

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_stores_md_api_on_app_state(self, MockMdApi, MockConfig):
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()
        result = {}

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock(), result)

        assert app.state.md_api is fake_api

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_calls_create(self, MockMdApi, MockConfig):
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()
        result = {}

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock(), result)

        assert fake_api._created is True

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_registers_callbacks(self, MockMdApi, MockConfig):
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()
        result = {}

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.1):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock(), result)

        assert "OnFrontConnected" in fake_api.spi._handlers
        assert "OnRspUserLogin" in fake_api.spi._handlers

    @patch("config.Config")
    @patch("ctp_wrapper.md_user_api.MdUserApi")
    def test_result_written_on_timeout(self, MockMdApi, MockConfig):
        """result dict is populated when connection times out."""
        from services.ctp_startup import _connect_ctp

        MockConfig.return_value = MagicMock()
        fake_api = _FakeMdApi(config=MockConfig.return_value)
        MockMdApi.return_value = fake_api
        app = _FakeApp()
        result = {"success": False, "message": "Connection not started", "userID": "test"}

        with patch("services.ctp_startup.LOGIN_TIMEOUT", 0.01):
            _connect_ctp(app, "9999", "test", "pwd", MagicMock(), result)

        assert result["success"] is False
        assert "timeout" in result["message"].lower()


# ── TD connection tests (PR-9) ───────────────────────────────────────────

class _FakeTraderApi:
    """Duck-type of TraderApi for testing TD startup."""

    def __init__(self, config):
        self.config = config
        self.spi = _FakeSpi()
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"
        self._created = False
        self.order_ref = 0

    def create(self):
        self._created = True
        self.connection_status = "connecting"

    def login(self):
        self.login_status = "logging_in"
        return 0

    def release(self):
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"


class TestStartCtpTradingConnection:
    """TD connection startup (PR-9)."""

    @patch("config.Config")
    @patch("ctp_wrapper.trader_api.TraderApi")
    def test_creates_trader_api(self, MockTrader, MockConfig):
        """TD startup creates a TraderApi instance."""
        from services.ctp_startup import start_ctp_trading_connection

        cfg = MagicMock()
        cfg.broker_id = "9999"
        cfg.user_id = "test"
        cfg.password = "pass"
        cfg.td_front = "tcp://..."  # needed for log line
        MockConfig.return_value = cfg
        fake_trader = _FakeTraderApi(config=cfg)
        MockTrader.return_value = fake_trader
        app = _FakeApp()

        with patch("services.ctp_startup.asyncio.get_running_loop", return_value=MagicMock()):
            start_ctp_trading_connection(app, cfg)

        MockTrader.assert_called_once()

    @patch("config.Config")
    @patch("ctp_wrapper.trader_api.TraderApi")
    def test_stores_on_app_state(self, MockTrader, MockConfig):
        """TD startup stores trader_api and order_manager on app.state."""
        from services.ctp_startup import start_ctp_trading_connection

        cfg = MagicMock()
        cfg.broker_id = "9999"
        cfg.user_id = "test"
        cfg.password = "pass"
        cfg.td_front = "tcp://..."
        MockConfig.return_value = cfg
        fake_trader = _FakeTraderApi(config=cfg)
        MockTrader.return_value = fake_trader
        app = _FakeApp()

        with patch("services.ctp_startup.asyncio.get_running_loop", return_value=MagicMock()):
            start_ctp_trading_connection(app, cfg)

        assert app.state.trader_api is not None
        assert app.state.order_manager is not None

    @patch("config.Config")
    @patch("ctp_wrapper.trader_api.TraderApi")
    def test_td_startup_runs_in_thread(self, MockTrader, MockConfig):
        """TD startup runs in a daemon thread."""
        from services.ctp_startup import start_ctp_trading_connection

        cfg = MagicMock()
        cfg.broker_id = "9999"
        cfg.user_id = "test"
        cfg.password = "pass"
        cfg.td_front = "tcp://..."
        MockConfig.return_value = cfg
        fake_trader = _FakeTraderApi(config=cfg)
        MockTrader.return_value = fake_trader
        app = _FakeApp()

        with patch("services.ctp_startup.asyncio.get_running_loop", return_value=MagicMock()):
            start_ctp_trading_connection(app, cfg)

        td_thread = app.state.td_thread
        assert td_thread is not None
        assert td_thread.daemon is True

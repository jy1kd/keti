"""Tests for ctp/md_user_api.py — Market data API wrapper."""

import sys
import os
from unittest.mock import Mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import Config
from ctp_wrapper.md_user_api import MdUserApi


class TestMdUserApiConstruction:
    """Test MdUserApi instantiation and defaults."""

    def test_import_md_user_api(self):
        assert MdUserApi is not None

    def test_instantiation_stores_config(self):
        cfg = Config()
        api = MdUserApi(cfg)
        assert api.config is cfg

    def test_instantiation_creates_spi(self):
        api = MdUserApi(Config())
        assert api.spi is not None

    def test_connection_status_defaults(self):
        api = MdUserApi(Config())
        assert api.connection_status == "disconnected"

    def test_login_status_defaults(self):
        api = MdUserApi(Config())
        assert api.login_status == "not_logged_in"

    def test_subscribed_instruments_defaults(self):
        api = MdUserApi(Config())
        assert api.subscribed_instruments == []

    def test_callback_event_recording(self):
        api = MdUserApi(Config())
        api.spi.OnFrontConnected()
        assert len(api.spi.events) > 0
        assert api.spi.events[-1]["type"] == "OnFrontConnected"


class TestMdUserApiSubscribe:
    """Test subscribe/unsubscribe state management with mocked CTP API."""

    @staticmethod
    def _make_api(md_return=0):
        """Create MdUserApi with a mocked CTP API."""
        api = MdUserApi(Config())
        api._api = Mock()
        api._api.SubscribeMarketData.return_value = md_return
        api._api.UnSubscribeMarketData.return_value = md_return
        return api

    def test_subscribe_adds_to_list_on_success(self):
        api = self._make_api(md_return=0)
        result = api.subscribe(["au2506"])
        assert result == 0
        assert "au2506" in api.subscribed_instruments

    def test_subscribe_does_not_add_duplicates(self):
        api = self._make_api(md_return=0)
        api.subscribe(["au2506"])
        api.subscribe(["au2506"])
        assert api.subscribed_instruments == ["au2506"]

    def test_subscribe_does_not_add_on_failure(self):
        api = self._make_api(md_return=-1)
        result = api.subscribe(["au2506"])
        assert result == -1
        assert "au2506" not in api.subscribed_instruments

    def test_subscribe_empty_list_returns_minus_one(self):
        api = self._make_api()
        result = api.subscribe([])
        assert result == -1

    def test_subscribe_forces_str_conversion(self):
        """Bytes must be decoded to str (SWIG heap corruption bug)."""
        api = self._make_api(md_return=0)
        api.subscribe([b"au2506"])
        # Verify the call was made with a string, not bytes
        call_list = api._api.SubscribeMarketData.call_args[0][0]
        assert isinstance(call_list[0], str)
        assert call_list[0] == "au2506"

    def test_subscribe_forces_str_from_int(self):
        """int instrument IDs should also be converted to str."""
        api = self._make_api(md_return=0)
        api.subscribe([123456])
        call_list = api._api.SubscribeMarketData.call_args[0][0]
        assert call_list[0] == "123456"

    def test_subscribe_multiple_instruments(self):
        api = self._make_api(md_return=0)
        api.subscribe(["au2506", "ag2506", "cu2506"])
        assert api.subscribed_instruments == ["au2506", "ag2506", "cu2506"]

    def test_unsubscribe_removes_from_list(self):
        api = self._make_api(md_return=0)
        api.subscribe(["au2506", "ag2506"])
        result = api.unsubscribe(["au2506"])
        assert result == 0
        assert api.subscribed_instruments == ["ag2506"]

    def test_unsubscribe_does_not_error_on_missing(self):
        api = self._make_api(md_return=0)
        api.unsubscribe(["nonexistent"])
        assert api.subscribed_instruments == []

    def test_unsubscribe_empty_list_returns_minus_one(self):
        api = self._make_api()
        result = api.unsubscribe([])
        assert result == -1


class TestMdUserApiRelease:
    """Test release() cleanup."""

    def test_release_clears_connection_status(self):
        api = MdUserApi(Config())
        api._api = Mock()
        api.connection_status = "connected"
        api.release()
        assert api.connection_status == "disconnected"

    def test_release_clears_login_status(self):
        api = MdUserApi(Config())
        api._api = Mock()
        api.login_status = "logged_in"
        api.release()
        assert api.login_status == "not_logged_in"

    def test_release_clears_subscribed_instruments(self):
        api = MdUserApi(Config())
        api._api = Mock()
        api.subscribed_instruments = ["au2506", "ag2506"]
        api.release()
        assert api.subscribed_instruments == []

    def test_release_calls_api_release(self):
        api = MdUserApi(Config())
        mock_api = Mock()
        api._api = mock_api
        api.release()
        mock_api.Release.assert_called_once()

    def test_release_handles_none_api(self):
        api = MdUserApi(Config())
        api._api = None
        api.release()  # Should not raise

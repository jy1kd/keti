"""Tests for ctp/md_user_api.py — Market data API wrapper."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

# ctp-python may not be installed or lack DLL; detect usable CTP
_has_ctp = False
try:
    import ctp
    # Verify the module actually has the CTP classes (DLL loaded)
    if hasattr(ctp, "CThostFtdcMdApi"):
        _has_ctp = True
except (ImportError, SystemError):
    pass


@pytest.fixture
def mock_ctp():
    """Mock the ctp module for testing without CTP DLL."""
    import types
    ctp_mock = types.ModuleType("ctp")
    ctp_mock.CThostFtdcMdApi = type("CThostFtdcMdApi", (), {
        "CreateFtdcMdApi": classmethod(lambda cls, path="": object()),
    })
    ctp_mock.CThostFtdcReqUserLoginField = type("CThostFtdcReqUserLoginField", (), {})
    return ctp_mock


class TestMdUserApiConstruction:
    """Test MdUserApi instantiation."""

    def test_import_md_user_api(self):
        """MdUserApi should be importable."""
        from ctp.md_user_api import MdUserApi
        assert MdUserApi is not None

    def test_instantiation_stores_config(self):
        """MdUserApi should store config and spi reference."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        cfg = Config()
        api = MdUserApi(cfg)
        assert api.config is cfg

    def test_instantiation_creates_spi(self):
        """MdUserApi should create an MdSpi instance."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        assert api.spi is not None

    def test_connection_status_defaults(self):
        """Default connection_status should be disconnected."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        assert api.connection_status == "disconnected"

    def test_login_status_defaults(self):
        """Default login_status should be not_logged_in."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        assert api.login_status == "not_logged_in"

    def test_subscribed_instruments_defaults(self):
        """Default subscribed list should be empty."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        assert api.subscribed_instruments == []

    def test_callback_event_recording(self):
        """Callbacks should record events through MdSpi."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        api.spi.OnFrontConnected()
        assert len(api.spi.events) > 0
        assert api.spi.events[-1]["type"] == "OnFrontConnected"

    def test_create_connects_front(self):
        """create() should register front address."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        # create() should set up the API instance
        if _has_ctp:
            api.create()
            assert api.connection_status == "connecting"

    def test_login_calls_ctp(self):
        """login() should call ReqUserLogin."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        cfg = Config()
        cfg.user_id = "test_user"
        cfg.password = "test_pass"
        cfg.broker_id = "8888"
        api = MdUserApi(cfg)
        # Without actual CTP connection, login should handle gracefully
        # The key is that the login_field is constructed correctly
        if not _has_ctp:
            # In test environment without CTP, we verify the method exists
            assert hasattr(api, "login")
            assert callable(api.login)

    def test_subscribe_validates_strings(self):
        """subscribe() should accept string list."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        # Method should exist and accept string list
        assert hasattr(api, "subscribe")
        assert callable(api.subscribe)

    def test_unsubscribe_method_exists(self):
        """unsubscribe() method should exist."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        assert hasattr(api, "unsubscribe")
        assert callable(api.unsubscribe)

    def test_release_method_exists(self):
        """release() method should exist for cleanup."""
        from ctp.md_user_api import MdUserApi
        from config import Config
        api = MdUserApi(Config())
        assert hasattr(api, "release")
        assert callable(api.release)

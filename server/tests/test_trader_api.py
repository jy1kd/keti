"""Tests for ctp/trader_api.py — Trading API wrapper."""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

_has_ctp = False
try:
    import ctp
    if hasattr(ctp, "CThostFtdcTraderApi"):
        _has_ctp = True
except (ImportError, SystemError):
    pass


class TestTraderApiConstruction:
    """Test TraderApi instantiation."""

    def test_import_trader_api(self):
        from ctp.trader_api import TraderApi
        assert TraderApi is not None

    def test_instantiation_stores_config(self):
        from ctp.trader_api import TraderApi
        from config import Config
        cfg = Config()
        api = TraderApi(cfg)
        assert api.config is cfg

    def test_instantiation_creates_spi(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert api.spi is not None

    def test_connection_status_defaults(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert api.connection_status == "disconnected"

    def test_login_status_defaults(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert api.login_status == "not_logged_in"

    def test_order_ref_defaults_to_zero(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert api.order_ref == 0

    def test_create_method_exists(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert hasattr(api, "create")
        assert callable(api.create)

    def test_login_method_exists(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert hasattr(api, "login")
        assert callable(api.login)

    def test_insert_order_method_exists(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert hasattr(api, "insert_order")
        assert callable(api.insert_order)

    def test_cancel_order_method_exists(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert hasattr(api, "cancel_order")
        assert callable(api.cancel_order)

    def test_release_method_exists(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        assert hasattr(api, "release")
        assert callable(api.release)

    def test_callback_event_recording(self):
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        api.spi.OnFrontConnected()
        assert len(api.spi.events) > 0
        assert api.spi.events[-1]["type"] == "OnFrontConnected"


class TestOrderRequestConstruction:
    """Test that order request fields are properly constructed."""

    def test_insert_order_requires_instrument(self):
        """insert_order should require instrument ID."""
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        # Method signature should accept instrument and order params
        import inspect
        sig = inspect.signature(api.insert_order)
        params = list(sig.parameters.keys())
        assert "instrument_id" in params

    def test_cancel_order_requires_ref(self):
        """cancel_order should require an order reference."""
        from ctp.trader_api import TraderApi
        from config import Config
        api = TraderApi(Config())
        import inspect
        sig = inspect.signature(api.cancel_order)
        params = list(sig.parameters.keys())
        assert "order_ref" in params or "order_sys_id" in params

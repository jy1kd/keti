"""Tests for StopOrderService integration with main.py and ctp_startup."""

import asyncio
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI

from services.stop_order import StopOrderService


@pytest.fixture
def mock_market_service():
    ms = MagicMock()
    return ms


@pytest.fixture
def mock_order_manager():
    om = MagicMock()
    om.insert.return_value = {"success": True, "orderRef": "ref-001", "message": "Accepted"}
    return om


@pytest.fixture
def app_with_stop_service(tmp_path, mock_market_service, mock_order_manager):
    """Create app with StopOrderService wired."""
    app = FastAPI()
    app.state.market_service = mock_market_service
    app.state.order_manager = mock_order_manager

    stop_service = StopOrderService(
        data_dir=str(tmp_path / "data"),
        order_manager=mock_order_manager,
    )
    app.state.stop_service = stop_service
    return app


class TestStopOrderIntegration:
    """Test StopOrderService integration with app state."""

    def test_stop_service_stored_on_app_state(self, app_with_stop_service):
        """StopOrderService is accessible via app.state.stop_service."""
        assert hasattr(app_with_stop_service.state, "stop_service")
        assert isinstance(app_with_stop_service.state.stop_service, StopOrderService)

    def test_stop_service_receives_market_data(self, app_with_stop_service, mock_order_manager):
        """StopOrderService.on_market_data triggers stop orders."""
        svc = app_with_stop_service.state.stop_service
        svc.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        svc.on_market_data("IF2608", 4789.0)
        svc.wait_for_pending_triggers()
        mock_order_manager.insert.assert_called_once()

    def test_stop_service_broadcast_wired(self, app_with_stop_service):
        """StopOrderService broadcast function can be set."""
        svc = app_with_stop_service.state.stop_service
        broadcast_fn = MagicMock()
        svc.set_broadcast_fn(broadcast_fn)
        svc.submit(
            instrument_id="IF2608", direction="0", offset_flag="0",
            limit_price=4800.0, volume=1, stop_price=4790.0,
        )
        broadcast_fn.assert_called_once()

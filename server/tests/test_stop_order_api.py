"""Tests for stop order API endpoints — POST /stop, POST /stop/cancel, GET /stop/list."""

import json
from unittest.mock import MagicMock, patch

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.order import router as order_router


# ── Fixtures ────────────────────────────────────────────────────────────────

@pytest.fixture
def mock_stop_service():
    """Mock StopOrderService."""
    svc = MagicMock()
    svc.submit.return_value = {
        "success": True,
        "stopOrderID": "so-abc123",
        "message": "Stop order created",
    }
    svc.cancel.return_value = {"success": True, "message": "Stop order canceled"}
    svc.list_orders.return_value = [
        {
            "stopOrderID": "so-abc123",
            "instrumentID": "IF2608",
            "direction": "0",
            "offsetFlag": "0",
            "limitPrice": 4800.0,
            "volume": 1,
            "stopPrice": 4790.0,
            "status": "pending",
            "createdAt": "2026-07-21 10:00:00",
            "triggeredAt": None,
            "orderRef": None,
        }
    ]
    return svc


@pytest.fixture
def app(mock_stop_service):
    """Create test app with stop order endpoints."""
    app = FastAPI()
    app.include_router(order_router, prefix="/api/order")
    app.state.stop_service = mock_stop_service
    return app


@pytest.fixture
def client(app):
    """Create test client."""
    return TestClient(app)


# ── POST /api/order/stop ────────────────────────────────────────────────────

class TestStopOrderSubmitAPI:
    """Test POST /api/order/stop endpoint."""

    def test_submit_stop_order(self, client, mock_stop_service):
        """submit stop order returns success."""
        response = client.post("/api/order/stop", json={
            "instrumentID": "IF2608",
            "direction": "0",
            "offsetFlag": "0",
            "limitPrice": 4800.0,
            "volume": 1,
            "stopPrice": 4790.0,
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["stopOrderID"] == "so-abc123"

    def test_submit_calls_service(self, client, mock_stop_service):
        """submit endpoint calls StopOrderService.submit()."""
        client.post("/api/order/stop", json={
            "instrumentID": "IF2608",
            "direction": "0",
            "offsetFlag": "0",
            "limitPrice": 4800.0,
            "volume": 1,
            "stopPrice": 4790.0,
        })
        mock_stop_service.submit.assert_called_once()

    def test_submit_missing_instrument(self, client):
        """submit returns 422 when instrumentID is missing."""
        response = client.post("/api/order/stop", json={
            "direction": "0",
            "stopPrice": 4790.0,
        })
        assert response.status_code == 422

    def test_submit_missing_stop_price(self, client):
        """submit returns 422 when stopPrice is missing."""
        response = client.post("/api/order/stop", json={
            "instrumentID": "IF2608",
            "direction": "0",
        })
        assert response.status_code == 422

    def test_submit_default_direction(self, client, mock_stop_service):
        """submit uses default direction=0 when not specified."""
        client.post("/api/order/stop", json={
            "instrumentID": "IF2608",
            "stopPrice": 4790.0,
        })
        call_kwargs = mock_stop_service.submit.call_args[1]
        assert call_kwargs["direction"] == "0"


# ── POST /api/order/stop/cancel ─────────────────────────────────────────────

class TestStopOrderCancelAPI:
    """Test POST /api/order/stop/cancel endpoint."""

    def test_cancel_stop_order(self, client, mock_stop_service):
        """cancel stop order returns success."""
        response = client.post("/api/order/stop/cancel", json={
            "stopOrderID": "so-abc123",
        })
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True

    def test_cancel_calls_service(self, client, mock_stop_service):
        """cancel endpoint calls StopOrderService.cancel()."""
        client.post("/api/order/stop/cancel", json={
            "stopOrderID": "so-abc123",
        })
        mock_stop_service.cancel.assert_called_once_with("so-abc123")

    def test_cancel_missing_id(self, client):
        """cancel returns 422 when stopOrderID is missing."""
        response = client.post("/api/order/stop/cancel", json={})
        assert response.status_code == 422


# ── GET /api/order/stop/list ────────────────────────────────────────────────

class TestStopOrderListAPI:
    """Test GET /api/order/stop/list endpoint."""

    def test_list_stop_orders(self, client, mock_stop_service):
        """list returns stop orders."""
        response = client.get("/api/order/stop/list")
        assert response.status_code == 200
        data = response.json()
        assert "stopOrders" in data
        assert data["count"] == 1

    def test_list_calls_service(self, client, mock_stop_service):
        """list endpoint calls StopOrderService.list_orders()."""
        client.get("/api/order/stop/list")
        mock_stop_service.list_orders.assert_called_once()

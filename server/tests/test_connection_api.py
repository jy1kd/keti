"""Tests for api/connection.py — connection management API."""

import sys
import os
from unittest.mock import patch, MagicMock

import pytest
from httpx import AsyncClient, ASGITransport

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


def _make_app():
    """Create a fresh FastAPI test app."""
    from fastapi import FastAPI
    from fastapi.middleware.cors import CORSMiddleware
    from api.connection import router as connection_router
    from ws.manager import WebSocketManager

    app = FastAPI()
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers="*",
    )
    app.include_router(connection_router, prefix="/api/connection")
    app.state.ws_manager = WebSocketManager()
    return app


@pytest.fixture
def app():
    return _make_app()


# ── Login tests ────────────────────────────────────────────────────────

class TestLogin:
    @pytest.mark.asyncio
    async def test_login_returns_success(self, app):
        """Login returns success and starts background connection."""
        payload = {"brokerID": "9999", "userID": "test_user", "password": "test_pass"}
        transport = ASGITransport(app=app)
        with patch("api.connection.connect_ctp") as mock_connect:
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                response = await c.post("/api/connection/login", json=payload)
                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["userID"] == "test_user"
                mock_connect.assert_called_once_with(app, "9999", "test_user", "test_pass")

    @pytest.mark.asyncio
    async def test_login_missing_fields_returns_422(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json={})
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_empty_broker_id_422(self, app):
        """Pydantic Field(min_length=1) rejects empty brokerID with 422."""
        payload = {"brokerID": "", "userID": "test", "password": "pwd"}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json=payload)
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_already_connected_same_user(self, app):
        """Login returns success if already connected with same user."""
        md_api = MagicMock()
        md_api.login_status = "logged_in"
        md_api.config = MagicMock()
        md_api.config.user_id = "test_user"
        app.state.md_api = md_api

        payload = {"brokerID": "9999", "userID": "test_user", "password": "pwd"}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json=payload)
            data = response.json()
            assert data["success"] is True
            assert "Already connected" in data["message"]

    @pytest.mark.asyncio
    async def test_login_already_connected_different_user(self, app):
        """Login returns error if connected with different user."""
        md_api = MagicMock()
        md_api.login_status = "logged_in"
        md_api.config = MagicMock()
        md_api.config.user_id = "other_user"
        app.state.md_api = md_api

        payload = {"brokerID": "9999", "userID": "test_user", "password": "pwd"}
        transport = ASGITransport(app=app)
        with patch("api.connection.connect_ctp"):
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                response = await c.post("/api/connection/login", json=payload)
                data = response.json()
                assert data["success"] is False
                assert "different user" in data["message"]


# ── Logout tests ───────────────────────────────────────────────────────

class TestLogout:
    @pytest.mark.asyncio
    async def test_logout_returns_success(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/logout")
            assert response.status_code == 200
            assert response.json()["success"] is True

    @pytest.mark.asyncio
    async def test_logout_without_login(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/logout")
            assert response.status_code == 200
            assert response.json()["success"] is True


# ── Status tests ───────────────────────────────────────────────────────

class TestStatus:
    @pytest.mark.asyncio
    async def test_status_returns_fields(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            assert response.status_code == 200
            data = response.json()
            assert "loggedIn" in data
            assert "mdConnected" in data
            assert "tdConnected" in data

    @pytest.mark.asyncio
    async def test_status_initial_state(self, app):
        """Without CTP connection, status returns all False."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is False
            assert data["mdConnected"] is False
            assert data["tdConnected"] is False

    @pytest.mark.asyncio
    async def test_status_with_ctp_connected(self, app):
        """Status reads real state from app.state.md_api."""
        md_api = MagicMock()
        md_api.login_status = "logged_in"
        md_api.connection_status = "connected"
        app.state.md_api = md_api

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is True
            assert data["mdConnected"] is True
            assert data["tdConnected"] is False  # TD not started until PR-9

    @pytest.mark.asyncio
    async def test_status_with_ctp_disconnected(self, app):
        """Status returns False when md_api exists but not logged in."""
        md_api = MagicMock()
        md_api.login_status = "not_logged_in"
        md_api.connection_status = "disconnected"
        app.state.md_api = md_api

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is False
            assert data["mdConnected"] is False

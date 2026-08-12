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
        """Login returns success from connect_ctp result."""
        payload = {"brokerID": "9999", "userID": "test_user", "password": "test_pass"}
        transport = ASGITransport(app=app)
        with patch("api.connection.connect_ctp") as mock_connect:
            mock_connect.return_value = {"success": True, "message": "Login successful", "userID": "test_user"}
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                response = await c.post("/api/connection/login", json=payload)
                assert response.status_code == 200
                data = response.json()
                assert data["success"] is True
                assert data["userID"] == "test_user"
                mock_connect.assert_called_once_with(app, "9999", "test_user", "test_pass", wait=True)

    @pytest.mark.asyncio
    async def test_login_missing_fields_returns_422(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json={})
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_empty_broker_id_422(self, app):
        payload = {"brokerID": "", "userID": "test", "password": "pwd"}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json=payload)
            assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_login_already_connected_same_user(self, app):
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
        md_api = MagicMock()
        md_api.login_status = "logged_in"
        md_api.config = MagicMock()
        md_api.config.user_id = "other_user"
        app.state.md_api = md_api

        payload = {"brokerID": "9999", "userID": "test_user", "password": "pwd"}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json=payload)
            data = response.json()
            assert data["success"] is False
            assert "different user" in data["message"]

    @pytest.mark.asyncio
    async def test_login_rejects_when_thread_running(self, app):
        """Login rejects if a connection thread is already alive."""
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = True
        app.state.ctp_thread = mock_thread

        payload = {"brokerID": "9999", "userID": "test_user", "password": "pwd"}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json=payload)
            data = response.json()
            assert data["success"] is False
            assert "in progress" in data["message"]

    @pytest.mark.asyncio
    async def test_login_allows_when_thread_dead(self, app):
        """Login proceeds if previous thread has finished."""
        mock_thread = MagicMock()
        mock_thread.is_alive.return_value = False
        app.state.ctp_thread = mock_thread

        payload = {"brokerID": "9999", "userID": "test_user", "password": "pwd"}
        transport = ASGITransport(app=app)
        with patch("api.connection.connect_ctp") as mock_connect:
            mock_connect.return_value = {"success": True, "message": "Login successful", "userID": "test_user"}
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                response = await c.post("/api/connection/login", json=payload)
                data = response.json()
                assert data["success"] is True

    @pytest.mark.asyncio
    async def test_login_returns_failure_on_wrong_password(self, app):
        """Login returns failure when connect_ctp reports failure."""
        payload = {"brokerID": "9999", "userID": "test_user", "password": "wrong"}
        transport = ASGITransport(app=app)
        with patch("api.connection.connect_ctp") as mock_connect:
            mock_connect.return_value = {"success": False, "message": "Login failed: invalid password", "userID": "test_user"}
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                response = await c.post("/api/connection/login", json=payload)
                data = response.json()
                assert data["success"] is False
                assert "failed" in data["message"].lower()

    @pytest.mark.asyncio
    async def test_login_disconnected_md_api_allows_retry(self, app):
        """Login proceeds if md_api exists but not logged in (timeout/disconnect)."""
        md_api = MagicMock()
        md_api.login_status = "not_logged_in"
        app.state.md_api = md_api

        payload = {"brokerID": "9999", "userID": "test_user", "password": "pwd"}
        transport = ASGITransport(app=app)
        with patch("api.connection.connect_ctp") as mock_connect:
            mock_connect.return_value = {"success": True, "message": "Login successful", "userID": "test_user"}
            async with AsyncClient(transport=transport, base_url="http://test") as c:
                response = await c.post("/api/connection/login", json=payload)
                data = response.json()
                assert data["success"] is True


# ── Logout tests ───────────────────────────────────────────────────────

class TestLogout:
    @pytest.mark.asyncio
    async def test_logout_clears_md_api(self, app):
        md_api = MagicMock()
        app.state.md_api = md_api

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/logout")
            data = response.json()
            assert data["success"] is True
            md_api.release.assert_called_once()
            assert app.state.md_api is None

    @pytest.mark.asyncio
    async def test_logout_clears_thread(self, app):
        app.state.ctp_thread = MagicMock()

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            await c.post("/api/connection/logout")
            assert app.state.ctp_thread is None

    @pytest.mark.asyncio
    async def test_logout_without_login(self, app):
        """Logout is safe when no CTP connection exists."""
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/logout")
            assert response.status_code == 200
            assert response.json()["success"] is True

    @pytest.mark.asyncio
    async def test_logout_handles_release_error(self, app):
        """Logout succeeds even if md_api.release() throws."""
        md_api = MagicMock()
        md_api.release.side_effect = RuntimeError("already released")
        app.state.md_api = md_api

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/logout")
            assert response.json()["success"] is True
            assert app.state.md_api is None


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
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is False
            assert data["mdConnected"] is False
            assert data["tdConnected"] is False

    @pytest.mark.asyncio
    async def test_status_with_ctp_connected(self, app):
        # loggedIn/tdConnected 由 trader_api 提供（task-09 重构后），
        # mdConnected/mdFront 由 md_api 提供；两者都设置才能覆盖完整状态。
        md_api = MagicMock()
        md_api.connection_status = "connected"
        md_api.front = "tcp://182.254.243.31:30011"
        trader_api = MagicMock()
        trader_api.login_status = "logged_in"
        trader_api.connection_status = "connected"
        trader_api.front = "tcp://182.254.243.31:30001"
        app.state.md_api = md_api
        app.state.trader_api = trader_api

        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is True
            assert data["mdConnected"] is True
            assert data["tdConnected"] is True
            assert data["mdFront"] == "tcp://182.254.243.31:30011"
            assert data["tdFront"] == "tcp://182.254.243.31:30001"

    @pytest.mark.asyncio
    async def test_status_with_ctp_disconnected(self, app):
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

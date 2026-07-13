"""Tests for api/connection.py — connection management API."""

import sys
import os
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
        allow_headers=["*"],
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
        payload = {"brokerID": "9999", "userID": "test_user", "password": "test_pass"}
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.post("/api/connection/login", json=payload)
            assert response.status_code == 200
            assert response.json()["success"] is True

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


# ── Logout tests ───────────────────────────────────────────────────────

class TestLogout:
    @pytest.mark.asyncio
    async def test_logout_after_login(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            await c.post("/api/connection/login", json={
                "brokerID": "9999", "userID": "test", "password": "pwd",
            })
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
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is False

    @pytest.mark.asyncio
    async def test_status_after_login(self, app):
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as c:
            await c.post("/api/connection/login", json={
                "brokerID": "9999", "userID": "test", "password": "pwd",
            })
            response = await c.get("/api/connection/status")
            data = response.json()
            assert data["loggedIn"] is True

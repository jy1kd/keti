"""FastAPI Application Entry Point.

Usage:
    uvicorn main:app --reload --port 8000
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

logger = logging.getLogger(__name__)

from fastapi import FastAPI, Request, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import load_config
from api.connection import router as connection_router
from api.market import router as market_router
from api.order import router as order_router
from api.query import router as query_router
from ws.manager import WebSocketManager
from services.market_service import MarketService
from services.ctp_bridge import wire_market_data_callback
from services.ctp_startup import connect_ctp
from ws.handlers import handle_ws


def create_app() -> FastAPI:
    """Factory: build and configure the FastAPI application."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Startup / shutdown lifecycle."""
        # Start WebSocket heartbeat
        await app.state.ws_manager.start_heartbeat(interval=15.0)
        logger.info("WebSocket heartbeat started (interval=15s)")

        cfg = load_config()
        result = connect_ctp(app, cfg.broker_id, cfg.user_id, cfg.password, wait=True)
        if not result.get("success"):
            logger.warning("CTP startup login failed: %s", result.get("message"))

        yield

        # Shutdown: stop heartbeat
        await app.state.ws_manager.stop_heartbeat()
        logger.info("WebSocket heartbeat stopped")

    app = FastAPI(title="Simnow Trader API", version="1.0.0", lifespan=lifespan)

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # REST routes
    app.include_router(connection_router, prefix="/api/connection", tags=["connection"])
    app.include_router(market_router, prefix="/api/market", tags=["market"])
    app.include_router(order_router, prefix="/api/order", tags=["order"])
    app.include_router(query_router, prefix="/api/query", tags=["query"])

    # WebSocket endpoints — all routes use unified handle_ws with ws_manager
    @app.websocket("/ws/market")
    async def ws_market(websocket: WebSocket):
        market_svc = app.state.market_service
        await handle_ws(
            "market", app.state.ws_manager, websocket,
            subscribe_fn=market_svc.subscribe,
            unsubscribe_fn=market_svc.unsubscribe,
        )

    @app.websocket("/ws/order")
    async def ws_order(websocket: WebSocket):
        await handle_ws("order", app.state.ws_manager, websocket)

    @app.websocket("/ws/position")
    async def ws_position(websocket: WebSocket):
        await handle_ws("position", app.state.ws_manager, websocket)

    @app.websocket("/ws/stop")
    async def ws_stop(websocket: WebSocket):
        await handle_ws("stop", app.state.ws_manager, websocket)

    @app.websocket("/ws/system")
    async def ws_system(websocket: WebSocket):
        await handle_ws("system", app.state.ws_manager, websocket)

    # Create and store ws_manager and market_service on app state
    ws_manager = WebSocketManager()
    app.state.ws_manager = ws_manager

    market_service = MarketService()
    # Load instrument cache from file (if available)
    _instruments_path = Path(__file__).parent / "data" / "instruments.json"
    market_service.load_instruments_from_file(str(_instruments_path))
    app.state.market_service = market_service

    # Global exception handler
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": {
                    "code": "INTERNAL_ERROR",
                    "message": str(exc),
                },
            },
        )

    return app


def wire_ctp_market_bridge(md_api, app: FastAPI) -> None:
    """Wire CTP market-data callbacks → MarketService → WebSocket broadcast.

    Call this AFTER MdUserApi has been created and connected. The bridge
    ensures every CTP OnRtnDepthMarketData tick is:
    1. Mapped (PascalCase → camelCase) via field_mapping
    2. Cached in MarketService (thread-safe, in-memory snapshot store)
    3. Pushed to all /ws/market clients via WebSocketManager.broadcast()

    Because CTP callbacks run in the CTP worker thread (not the asyncio event
    loop), the broadcast uses asyncio.run_coroutine_threadsafe() to safely
    cross the thread boundary.

    NOTE: Must be called from the asyncio main thread (where get_event_loop()
    is valid). For automatic startup, use ctp_startup.start_ctp_market_connection()
    instead — it handles the event-loop capture internally.

    Example usage:
        app = create_app()
        md_api = MdUserApi(config)
        md_api.create()
        # ... wait for OnFrontConnected → login → OnRspUserLogin ...
        wire_ctp_market_bridge(md_api, app)
    """
    loop = asyncio.get_event_loop()

    def _broadcast_to_ws(data: dict) -> None:
        """Bridge: CTP thread → asyncio event loop for WebSocket send."""
        asyncio.run_coroutine_threadsafe(
            app.state.ws_manager.broadcast("market", "market_data", data),
            loop,
        )

    wire_market_data_callback(
        md_api.spi,
        app.state.market_service,
        broadcast_fn=_broadcast_to_ws,
    )


# ── Application instance ──────────────────────────────────────────────

app = create_app()
config = load_config()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)

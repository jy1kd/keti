"""FastAPI Application Entry Point.

Usage:
    uvicorn main:app --reload --port 8000
"""

import asyncio
from contextlib import asynccontextmanager
from pathlib import Path

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
from services.ctp_startup import start_ctp_market_connection
from ws.handlers import (
    handle_market_ws,
    handle_order_ws,
    handle_position_ws,
    handle_stop_ws,
    handle_system_ws,
)


def create_app() -> FastAPI:
    """Factory: build and configure the FastAPI application."""

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        """Startup / shutdown lifecycle."""
        cfg = load_config()
        start_ctp_market_connection(app, cfg)
        yield
        # Shutdown: nothing to clean up — daemon threads die with the process

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

    # WebSocket endpoints
    @app.websocket("/ws/market")
    async def ws_market(websocket: WebSocket):
        await handle_market_ws(websocket)

    @app.websocket("/ws/order")
    async def ws_order(websocket: WebSocket):
        await handle_order_ws(websocket)

    @app.websocket("/ws/position")
    async def ws_position(websocket: WebSocket):
        await handle_position_ws(websocket)

    @app.websocket("/ws/stop")
    async def ws_stop(websocket: WebSocket):
        await handle_stop_ws(websocket)

    @app.websocket("/ws/system")
    async def ws_system(websocket: WebSocket):
        await handle_system_ws(websocket)

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

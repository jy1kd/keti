"""FastAPI Application Entry Point.

Usage:
    uvicorn main:app --reload --port 8000
"""

import asyncio
import logging
from contextlib import asynccontextmanager
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(name)s] %(levelname)s: %(message)s",
    datefmt="%H:%M:%S",
)

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
from services.query_service import QueryService
from services.stop_order import StopOrderService
from services.options_service import OptionsService
from services.ctp_bridge import wire_market_data_callback
from services.ctp_startup import connect_ctp, start_ctp_trading_connection
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

        # Start MD connection (fire-and-forget — MD does not need validated credentials)
        logger.info("starting CTP market data connection")
        connect_ctp(app, cfg.broker_id, cfg.user_id, cfg.password, wait=False)

        # Start TD connection with credentials (fire-and-forget;
        # /api/connection/status reflects the actual state)
        logger.info("starting CTP trading connection (user=%s)", cfg.user_id)
        start_ctp_trading_connection(app, cfg)

        # Refresh preset instruments (auto-detect front-month per product)
        app.state.market_service.refresh_preset_instruments()
        logger.info("preset instruments refreshed")

        # Startup summary
        instruments = app.state.market_service.instrument_count
        logger.info("startup complete — instruments=%d", instruments)

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
        async def _push_initial_status():
            """Push current CTP connection state to late-joining clients.

            Without this, a client that connects after TD/MD is already
            connected would never receive a connection_status broadcast
            and would remain stuck in 'connecting' state.
            """
            md_api = getattr(app.state, "md_api", None)
            trader_api = getattr(app.state, "trader_api", None)
            await websocket.send_json({
                "type": "connection_status",
                "data": {
                    "mdConnected": md_api is not None and md_api.connection_status == "connected",
                    "tdConnected": trader_api is not None and trader_api.connection_status == "connected",
                },
            })

        await handle_ws("system", app.state.ws_manager, websocket,
                        on_connect=_push_initial_status)

    # Create and store ws_manager and market_service on app state
    ws_manager = WebSocketManager()
    app.state.ws_manager = ws_manager

    market_service = MarketService()
    # Load instrument cache from file (if available)
    _instruments_path = Path(__file__).parent / "data" / "instruments.json"
    market_service.load_instruments_from_file(str(_instruments_path))
    app.state.market_service = market_service

    query_service = QueryService()
    app.state.query_service = query_service

    # Options service (PR-18) — stateless, depends on market_service instruments
    options_service = OptionsService()
    app.state.options_service = options_service

    # Stop order service (PR-13) — initialized lazily after OrderManager is available
    # Will be properly wired in ctp_startup after TD connects
    app.state.stop_service = None

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

"""CTP callback bridge — connects MdSpi callbacks to MarketService + WebSocket.

The bridge is the glue between the CTP thread (where callbacks fire) and the
async web layer (where WebSocket broadcasts happen).

Architecture:
  CTP worker thread: OnRtnDepthMarketData(ctp_obj)
    → map_depth_market_data(ctp_obj)  →  dict
    → market_service.update_snapshot(dict)  [thread-safe via lock]
    → broadcast_fn(dict)  →  ws_manager.broadcast("market", …)  [async bridge]

Usage:
    from services.ctp_bridge import wire_market_data_callback
    wire_market_data_callback(md_api.spi, market_service, broadcast_fn)
"""

from __future__ import annotations

import logging
from typing import Any, Callable, Optional

from services.field_mapping import map_depth_market_data
from ctp_wrapper.callback import MdSpi
from services.market_service import MarketService
from services.kline_service import KLineService

logger = logging.getLogger(__name__)


def wire_market_data_callback(
    md_spi: MdSpi,
    market_service: MarketService,
    broadcast_fn: Optional[Callable[[dict], None]] = None,
    kline_service: Optional[KLineService] = None,
    stop_order_callback: Optional[Callable[[str, float], None]] = None,
) -> None:
    """Wire the CTP OnRtnDepthMarketData callback to the service layer.

    After calling this function, every CTP depth market data tick will:
    1. Be mapped from PascalCase CTP fields → camelCase dict
    2. Update the MarketService snapshot cache (thread-safe)
    3. Call broadcast_fn(data) if provided (for WebSocket push)
    4. Update KLineService bars if provided (K-line aggregation)
    5. Check stop orders if stop_order_callback is provided

    Args:
        md_spi: The MdSpi instance from MdUserApi (ctp_wrapper.callback.MdSpi).
        market_service: The MarketService instance to update with snapshots.
        broadcast_fn: Optional callback(dict) for WebSocket broadcast.
                      Called in the CTP worker thread.
        kline_service: Optional KLineService for K-line aggregation.
        stop_order_callback: Optional callback(instrument_id, last_price) for
                             stop order trigger checking.
    """
    def _on_depth_market_data(pDepthMarketData: Any) -> None:
        # Step 1: Map CTP PascalCase → camelCase dict
        data = map_depth_market_data(pDepthMarketData)

        # Step 2: Update snapshot cache (thread-safe)
        market_service.update_snapshot(data)

        # Step 3: Broadcast via WebSocket (if a bridge function is provided)
        if broadcast_fn is not None:
            try:
                broadcast_fn(data)
            except Exception:
                logger.warning(
                    "Broadcast handler raised an exception",
                    exc_info=True,
                )

        # Step 4: Update K-line bars (if provided)
        if kline_service is not None:
            try:
                kline_service.update_tick(data)
            except Exception:
                logger.warning(
                    "KLineService.update_tick raised an exception",
                    exc_info=True,
                )

        # Step 5: Check stop orders (if callback provided)
        if stop_order_callback is not None:
            try:
                instrument_id = data.get("instrumentID", "")
                last_price = data.get("lastPrice", 0.0)
                if instrument_id and last_price > 0:
                    stop_order_callback(instrument_id, last_price)
            except Exception:
                logger.warning(
                    "Stop order callback raised an exception",
                    exc_info=True,
                )

    md_spi.on("OnRtnDepthMarketData", _on_depth_market_data)
    logger.info("Wired OnRtnDepthMarketData → MarketService + broadcast + stop orders")

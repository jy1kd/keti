"""CTP callback (SPI) framework for market data and trading.

MdSpi  — market data callbacks (OnRtnDepthMarketData, etc.)
TraderSpi — trading callbacks (OnRtnOrder, OnRtnTrade, etc.)

Each SPI logs events for debugging and supports attaching custom handlers.
"""

import time
from typing import Any, Callable, List, Optional


class MdSpi:
    """行情回调 SPI.

    Receives callbacks from CTP MdUserApi:
    - OnFrontConnected / OnFrontDisconnected
    - OnRspUserLogin
    - OnRspSubMarketData / OnRspUnSubMarketData
    - OnRtnDepthMarketData
    - OnRspError
    """

    def __init__(self, api: Optional[Any] = None) -> None:
        self.api = api
        self.events: List[dict] = []
        self._handlers: dict = {}

    def _log(self, event_type: str, data: Optional[dict] = None) -> None:
        """Record an event with timestamp for debugging."""
        self.events.append({
            "type": event_type,
            "timestamp": time.time(),
            "data": data or {},
        })

    def on(self, event_type: str, handler: Callable) -> None:
        """Register a custom handler for a callback event."""
        self._handlers[event_type] = handler

    def _dispatch(self, event_type: str, *args: Any) -> None:
        """Dispatch to registered handler if any."""
        if event_type in self._handlers:
            try:
                self._handlers[event_type](*args)
            except Exception:
                pass

    def OnFrontConnected(self) -> None:
        """前置机连接成功."""
        self._log("OnFrontConnected")

    def OnFrontDisconnected(self, reason: int) -> None:
        """前置机断开连接."""
        self._log("OnFrontDisconnected", {"reason": reason})

    def OnRspUserLogin(self, p_rsp_user_login: Any, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """登录响应."""
        self._log("OnRspUserLogin", {"request_id": request_id, "is_last": is_last})

    def OnRspSubMarketData(self, p_specific_instrument: Any, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """订阅行情响应."""
        self._log("OnRspSubMarketData", {"request_id": request_id, "is_last": is_last})

    def OnRspUnSubMarketData(self, p_specific_instrument: Any, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """退订行情响应."""
        self._log("OnRspUnSubMarketData", {"request_id": request_id, "is_last": is_last})

    def OnRtnDepthMarketData(self, p_depth_market_data: Any) -> None:
        """行情深度数据推送."""
        self._log("OnRtnDepthMarketData")

    def OnRspError(self, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """错误响应."""
        self._log("OnRspError", {"request_id": request_id, "is_last": is_last})


class TraderSpi:
    """交易回调 SPI.

    Receives callbacks from CTP TraderApi:
    - OnFrontConnected / OnFrontDisconnected
    - OnRspUserLogin
    - OnRtnOrder / OnRtnTrade
    - OnRspOrderInsert / OnRspOrderAction
    - OnRspError
    """

    def __init__(self, api: Optional[Any] = None) -> None:
        self.api = api
        self.events: List[dict] = []
        self._handlers: dict = {}

    def _log(self, event_type: str, data: Optional[dict] = None) -> None:
        """Record an event with timestamp for debugging."""
        self.events.append({
            "type": event_type,
            "timestamp": time.time(),
            "data": data or {},
        })

    def on(self, event_type: str, handler: Callable) -> None:
        """Register a custom handler for a callback event."""
        self._handlers[event_type] = handler

    def OnFrontConnected(self) -> None:
        """前置机连接成功."""
        self._log("OnFrontConnected")

    def OnFrontDisconnected(self, reason: int) -> None:
        """前置机断开连接."""
        self._log("OnFrontDisconnected", {"reason": reason})

    def OnRspUserLogin(self, p_rsp_user_login: Any, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """登录响应."""
        self._log("OnRspUserLogin", {"request_id": request_id, "is_last": is_last})

    def OnRtnOrder(self, p_order: Any) -> None:
        """报单回报."""
        self._log("OnRtnOrder")

    def OnRtnTrade(self, p_trade: Any) -> None:
        """成交回报."""
        self._log("OnRtnTrade")

    def OnRspOrderInsert(self, p_input_order: Any, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """报单录入响应."""
        self._log("OnRspOrderInsert", {"request_id": request_id, "is_last": is_last})

    def OnRspOrderAction(self, p_input_order_action: Any, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """报单操作响应（撤单）."""
        self._log("OnRspOrderAction", {"request_id": request_id, "is_last": is_last})

    def OnRspError(self, p_rinfo: Any, request_id: int, is_last: bool) -> None:
        """错误响应."""
        self._log("OnRspError", {"request_id": request_id, "is_last": is_last})

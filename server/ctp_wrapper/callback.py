"""CTP callback (SPI) framework for market data and trading.

MdSpi    — inherits ctp.CThostFtdcMdSpi at runtime; falls back to plain
           Python base when CTP DLL is unavailable (tests).
TraderSpi — same pattern with ctp.CThostFtdcTraderSpi.

Each SPI logs events for debugging and supports attaching custom handlers.
CRITICAL: RegisterSpi() requires CTP SWIG base class — without it, calls fail.
"""

import logging
import time
from typing import Any, Callable, List, Optional

logger = logging.getLogger(__name__)

# ── Detect CTP availability at import time ────────────────────────────

_CTP_BASE_CLASSES = {}
try:
    import ctp as _ctp_module
    _CTP_BASE_CLASSES["md"] = _ctp_module.CThostFtdcMdSpi
    _CTP_BASE_CLASSES["td"] = _ctp_module.CThostFtdcTraderSpi
except (ImportError, AttributeError):
    # CTP DLL not available — tests will use plain Python base
    # MD and TD API wrappers will NOT work with RegisterSpi() in this mode
    pass


# ── Infrastructure mixin ──────────────────────────────────────────────

class _SpiInfrastructure:
    """Mixin providing event logging and custom handler registration."""

    def _init_spi(self, api: Optional[Any] = None) -> None:
        self.api = api
        self.events: List[dict] = []
        self._handlers: dict = {}

    def _log(self, event_type: str, data: Optional[dict] = None) -> None:
        self.events.append({
            "type": event_type,
            "timestamp": time.time(),
            "data": data or {},
        })

    def on(self, event_type: str, handler: Callable) -> None:
        self._handlers[event_type] = handler

    def _dispatch(self, event_type: str, *args: Any) -> None:
        if event_type in self._handlers:
            try:
                self._handlers[event_type](*args)
            except Exception:
                logger.warning(
                    "Handler for %s raised an exception",
                    event_type, exc_info=True,
                )


# ── MdSpi ─────────────────────────────────────────────────────────────

def _make_md_spi_class():
    """Build MdSpi class — uses CTP base if available, else plain object."""
    ctp_base = _CTP_BASE_CLASSES.get("md")
    bases = (ctp_base, _SpiInfrastructure) if ctp_base else (_SpiInfrastructure, object)
    return type("MdSpi", bases, {})


MdSpi = _make_md_spi_class()


# Manually define MdSpi's methods so they are discoverable by IDEs and pytest
# (The dynamic type() above sets up the MRO; these are set as class attributes below)

def _md_init(self, api: Optional[Any] = None) -> None:
    ctp_base = _CTP_BASE_CLASSES.get("md")
    if ctp_base:
        ctp_base.__init__(self)
    self._init_spi(api)


def _md_on_front_connected(self) -> None:
    self._log("OnFrontConnected")
    self._dispatch("OnFrontConnected")


def _md_on_front_disconnected(self, nReason: int) -> None:
    self._log("OnFrontDisconnected", {"reason": nReason})
    self._dispatch("OnFrontDisconnected", nReason)


def _md_on_rsp_user_login(self, pRspUserLogin: Any, pRspInfo: Any,
                          nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspUserLogin",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspUserLogin", pRspUserLogin, pRspInfo,
                   nRequestID, bIsLast)


def _md_on_rsp_sub_market_data(self, pSpecificInstrument: Any, pRspInfo: Any,
                               nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspSubMarketData",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspSubMarketData", pSpecificInstrument,
                   pRspInfo, nRequestID, bIsLast)


def _md_on_rsp_unsub_market_data(self, pSpecificInstrument: Any, pRspInfo: Any,
                                 nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspUnSubMarketData",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspUnSubMarketData", pSpecificInstrument,
                   pRspInfo, nRequestID, bIsLast)


def _md_on_rtn_depth_market_data(self, pDepthMarketData: Any) -> None:
    self._log("OnRtnDepthMarketData")
    self._dispatch("OnRtnDepthMarketData", pDepthMarketData)


def _md_on_rsp_error(self, pRspInfo: Any, nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspError",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspError", pRspInfo, nRequestID, bIsLast)


MdSpi.__init__ = _md_init  # type: ignore
MdSpi.OnFrontConnected = _md_on_front_connected  # type: ignore
MdSpi.OnFrontDisconnected = _md_on_front_disconnected  # type: ignore
MdSpi.OnRspUserLogin = _md_on_rsp_user_login  # type: ignore
MdSpi.OnRspSubMarketData = _md_on_rsp_sub_market_data  # type: ignore
MdSpi.OnRspUnSubMarketData = _md_on_rsp_unsub_market_data  # type: ignore
MdSpi.OnRtnDepthMarketData = _md_on_rtn_depth_market_data  # type: ignore
MdSpi.OnRspError = _md_on_rsp_error  # type: ignore


# ── TraderSpi ─────────────────────────────────────────────────────────

def _make_td_spi_class():
    ctp_base = _CTP_BASE_CLASSES.get("td")
    bases = (ctp_base, _SpiInfrastructure) if ctp_base else (_SpiInfrastructure, object)
    return type("TraderSpi", bases, {})


TraderSpi = _make_td_spi_class()


def _td_init(self, api: Optional[Any] = None) -> None:
    ctp_base = _CTP_BASE_CLASSES.get("td")
    if ctp_base:
        ctp_base.__init__(self)
    self._init_spi(api)


def _td_on_front_connected(self) -> None:
    self._log("OnFrontConnected")
    self._dispatch("OnFrontConnected")


def _td_on_front_disconnected(self, nReason: int) -> None:
    self._log("OnFrontDisconnected", {"reason": nReason})
    self._dispatch("OnFrontDisconnected", nReason)


def _td_on_rsp_user_login(self, pRspUserLogin: Any, pRspInfo: Any,
                          nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspUserLogin",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspUserLogin", pRspUserLogin, pRspInfo,
                   nRequestID, bIsLast)


def _td_on_rtn_order(self, pOrder: Any) -> None:
    self._log("OnRtnOrder")
    self._dispatch("OnRtnOrder", pOrder)


def _td_on_rtn_trade(self, pTrade: Any) -> None:
    self._log("OnRtnTrade")
    self._dispatch("OnRtnTrade", pTrade)


def _td_on_rsp_order_insert(self, pInputOrder: Any, pRspInfo: Any,
                            nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspOrderInsert",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspOrderInsert", pInputOrder, pRspInfo,
                   nRequestID, bIsLast)


def _td_on_rsp_order_action(self, pInputOrderAction: Any, pRspInfo: Any,
                            nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspOrderAction",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspOrderAction", pInputOrderAction, pRspInfo,
                   nRequestID, bIsLast)


def _td_on_err_rtn_order_action(self, pOrderAction: Any, pRspInfo: Any,
                              nRequestID: int, bIsLast: bool) -> None:
    self._log("OnErrRtnOrderAction",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnErrRtnOrderAction", pOrderAction, pRspInfo,
                   nRequestID, bIsLast)


def _td_on_rsp_error(self, pRspInfo: Any, nRequestID: int, bIsLast: bool) -> None:
    self._log("OnRspError",
              {"request_id": nRequestID, "is_last": bIsLast})
    self._dispatch("OnRspError", pRspInfo, nRequestID, bIsLast)


TraderSpi.__init__ = _td_init  # type: ignore
TraderSpi.OnFrontConnected = _td_on_front_connected  # type: ignore
TraderSpi.OnFrontDisconnected = _td_on_front_disconnected  # type: ignore
TraderSpi.OnRspUserLogin = _td_on_rsp_user_login  # type: ignore
TraderSpi.OnRtnOrder = _td_on_rtn_order  # type: ignore
TraderSpi.OnRtnTrade = _td_on_rtn_trade  # type: ignore
TraderSpi.OnRspOrderInsert = _td_on_rsp_order_insert  # type: ignore
TraderSpi.OnRspOrderAction = _td_on_rsp_order_action  # type: ignore
TraderSpi.OnErrRtnOrderAction = _td_on_err_rtn_order_action  # type: ignore
TraderSpi.OnRspError = _td_on_rsp_error  # type: ignore


def _td_on_rsp_qry_instrument(self, pInstrument: Any, pRspInfo: Any,
                              nRequestID: int, bIsLast: bool) -> None:
    error_id = getattr(pRspInfo, "ErrorID", 0) if pRspInfo else 0
    self._log("OnRspQryInstrument",
              {"request_id": nRequestID, "is_last": bIsLast,
               "error_id": error_id})
    if error_id != 0:
        error_msg = getattr(pRspInfo, "ErrorMsg", "")
        self._log("OnRspQryInstrument_error",
                  {"error_id": error_id, "error_msg": error_msg})
    self._dispatch("OnRspQryInstrument", pInstrument, pRspInfo,
                   nRequestID, bIsLast)


TraderSpi.OnRspQryInstrument = _td_on_rsp_qry_instrument  # type: ignore


# ── Query callbacks (PR-11) ─────────────────────────────────────────────

def _td_on_rsp_qry_order(self, pOrder: Any, pRspInfo: Any,
                         nRequestID: int, bIsLast: bool) -> None:
    error_id = getattr(pRspInfo, "ErrorID", 0) if pRspInfo else 0
    self._log("OnRspQryOrder",
              {"request_id": nRequestID, "is_last": bIsLast,
               "error_id": error_id})
    if error_id != 0:
        error_msg = getattr(pRspInfo, "ErrorMsg", "")
        self._log("OnRspQryOrder_error",
                  {"error_id": error_id, "error_msg": error_msg})
    self._dispatch("OnRspQryOrder", pOrder, pRspInfo, nRequestID, bIsLast)


def _td_on_rsp_qry_trade(self, pTrade: Any, pRspInfo: Any,
                         nRequestID: int, bIsLast: bool) -> None:
    error_id = getattr(pRspInfo, "ErrorID", 0) if pRspInfo else 0
    self._log("OnRspQryTrade",
              {"request_id": nRequestID, "is_last": bIsLast,
               "error_id": error_id})
    if error_id != 0:
        error_msg = getattr(pRspInfo, "ErrorMsg", "")
        self._log("OnRspQryTrade_error",
                  {"error_id": error_id, "error_msg": error_msg})
    self._dispatch("OnRspQryTrade", pTrade, pRspInfo, nRequestID, bIsLast)


def _td_on_rsp_qry_investor_position(self, pInvestorPosition: Any,
                                     pRspInfo: Any, nRequestID: int,
                                     bIsLast: bool) -> None:
    error_id = getattr(pRspInfo, "ErrorID", 0) if pRspInfo else 0
    self._log("OnRspQryInvestorPosition",
              {"request_id": nRequestID, "is_last": bIsLast,
               "error_id": error_id})
    if error_id != 0:
        error_msg = getattr(pRspInfo, "ErrorMsg", "")
        self._log("OnRspQryInvestorPosition_error",
                  {"error_id": error_id, "error_msg": error_msg})
    self._dispatch("OnRspQryInvestorPosition", pInvestorPosition,
                   pRspInfo, nRequestID, bIsLast)


def _td_on_rsp_qry_trading_account(self, pTradingAccount: Any,
                                   pRspInfo: Any, nRequestID: int,
                                   bIsLast: bool) -> None:
    error_id = getattr(pRspInfo, "ErrorID", 0) if pRspInfo else 0
    self._log("OnRspQryTradingAccount",
              {"request_id": nRequestID, "is_last": bIsLast,
               "error_id": error_id})
    if error_id != 0:
        error_msg = getattr(pRspInfo, "ErrorMsg", "")
        self._log("OnRspQryTradingAccount_error",
                  {"error_id": error_id, "error_msg": error_msg})
    self._dispatch("OnRspQryTradingAccount", pTradingAccount,
                   pRspInfo, nRequestID, bIsLast)


TraderSpi.OnRspQryOrder = _td_on_rsp_qry_order  # type: ignore
TraderSpi.OnRspQryTrade = _td_on_rsp_qry_trade  # type: ignore
TraderSpi.OnRspQryInvestorPosition = _td_on_rsp_qry_investor_position  # type: ignore
TraderSpi.OnRspQryTradingAccount = _td_on_rsp_qry_trading_account  # type: ignore

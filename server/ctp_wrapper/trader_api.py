"""CTP Trading API Wrapper (TraderApi).

Wraps CThostFtdcTraderApi for SimNow order management:
- create: load CTP library, register SPI, register front
- login: ReqUserLogin with authentication
- insert_order: ReqOrderInsert
- cancel_order: ReqOrderAction
- release: cleanup
"""

from typing import Optional

from .callback import TraderSpi
from .types import (
    Direction,
    OffsetFlag,
    OrderPriceType,
    TimeCondition,
    VolumeCondition,
    CombHedgeFlag,
    ContingentCondition,
    ForceCloseReason,
)


class TraderApi:
    """交易API封装 — 连接、登录、报单、撤单."""

    def __init__(self, config) -> None:
        """Initialize with a Config instance.

        Args:
            config: Config object with broker_id, user_id, password, td_front.
        """
        self.config = config
        self.spi: TraderSpi = TraderSpi(api=self)
        self._api = None
        self._request_id: int = 0
        self.order_ref: int = 0
        self.connection_status: str = "disconnected"
        self.login_status: str = "not_logged_in"

    def create(self) -> None:
        """Create CTP API instance, register SPI, register front, and init."""
        import ctp

        self._api = ctp.CThostFtdcTraderApi.CreateFtdcTraderApi()
        self._api.RegisterSpi(self.spi)
        self._api.RegisterFront(self.config.td_front)
        self._api.Init()
        self.connection_status = "connecting"

    def login(self) -> int:
        """Send login request after OnFrontConnected."""
        import ctp

        self._request_id += 1
        login_field = ctp.CThostFtdcReqUserLoginField()
        login_field.BrokerID = self.config.broker_id
        login_field.UserID = self.config.user_id
        login_field.Password = self.config.password
        self.login_status = "logging_in"
        return self._api.ReqUserLogin(login_field, self._request_id)

    def confirm_settlement(self) -> int:
        """Confirm settlement info — required before placing orders."""
        import ctp

        self._request_id += 1
        field = ctp.CThostFtdcSettlementInfoConfirmField()
        field.BrokerID = self.config.broker_id
        field.InvestorID = self.config.user_id
        return self._api.ReqSettlementInfoConfirm(field, self._request_id)

    def _next_order_ref(self) -> str:
        """Generate next order reference string."""
        self.order_ref += 1
        return str(self.order_ref)

    def insert_order(
        self,
        instrument_id: str,
        direction: str,
        offset_flag: str,
        price_type: str = OrderPriceType.LIMIT,
        limit_price: float = 0.0,
        volume: int = 1,
        time_condition: str = TimeCondition.GFD,
        volume_condition: str = VolumeCondition.AV,
        hedge_flag: str = CombHedgeFlag.SPECULATION,
        contingent_condition: str = ContingentCondition.IMMEDIATELY,
        force_close_reason: str = ForceCloseReason.NOT_FORCE_CLOSE,
        stop_price: float = 0.0,
    ) -> str:
        """Submit a new order to CTP.

        Args:
            instrument_id: Contract code (e.g. "IF2608").
            direction: Direction.BUY ("0") or Direction.SELL ("1").
            offset_flag: OffsetFlag.OPEN ("0"), CLOSE ("1"), or CLOSE_TODAY ("3").
            price_type: OrderPriceType.LIMIT ("2") or ANY ("1").
            limit_price: Limit price (0 for market orders).
            volume: Order quantity.
            time_condition: TimeCondition.GFD ("1"), FOK ("2"), or FAK ("3").
            volume_condition: VolumeCondition.AV ("1"), MV ("2"), or CV ("3").
            hedge_flag: CombHedgeFlag.SPECULATION ("1"), ARBITRAGE ("2"), or HEDGE ("3").
            contingent_condition: ContingentCondition.IMMEDIATELY ("1"), STOP ("2"),
                                   STOP_PROFIT ("3"), or PARKED ("4").
            force_close_reason: ForceCloseReason enum value.
            stop_price: Stop price for stop orders (0 = not a stop order).

        Returns:
            str: Order reference string. Empty on failure.
        """
        import ctp

        self._request_id += 1
        order_ref = self._next_order_ref()

        order = ctp.CThostFtdcInputOrderField()
        order.BrokerID = self.config.broker_id
        order.InvestorID = self.config.user_id
        order.UserID = self.config.user_id
        order.InstrumentID = instrument_id
        order.OrderRef = order_ref
        order.Direction = direction
        order.CombOffsetFlag = offset_flag
        order.CombHedgeFlag = hedge_flag
        order.OrderPriceType = price_type
        order.LimitPrice = limit_price
        order.VolumeTotalOriginal = volume
        order.TimeCondition = time_condition
        order.VolumeCondition = volume_condition
        order.MinVolume = 1
        order.ContingentCondition = contingent_condition
        order.ForceCloseReason = force_close_reason
        order.StopPrice = stop_price
        order.IsAutoSuspend = 0
        order.RequestID = self._request_id

        result = self._api.ReqOrderInsert(order, self._request_id)
        return order_ref if result == 0 else ""

    def cancel_order(
        self,
        order_ref: str = "",
        order_sys_id: str = "",
        exchange_id: str = "",
        instrument_id: str = "",
    ) -> int:
        """Cancel an existing order.

        Args:
            order_ref: Order reference (from insert_order).
            order_sys_id: Exchange order system ID (alternative to order_ref).
            exchange_id: Exchange ID (e.g. "CFFEX") — recommended for CTP accuracy.
            instrument_id: Instrument code — recommended for CTP accuracy.

        Returns:
            int: 0 on success, negative on error.
        """
        import ctp

        self._request_id += 1

        action = ctp.CThostFtdcInputOrderActionField()
        action.BrokerID = self.config.broker_id
        action.InvestorID = self.config.user_id
        action.UserID = self.config.user_id
        action.OrderRef = order_ref
        action.OrderSysID = order_sys_id
        action.ExchangeID = exchange_id
        action.InstrumentID = instrument_id
        action.ActionFlag = "0"  # 0=撤单
        action.RequestID = self._request_id

        return self._api.ReqOrderAction(action, self._request_id)

    def release(self) -> None:
        """Release the CTP API instance and cleanup."""
        if self._api is not None:
            self._api.Release()
            self._api = None
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"
        self.order_ref = 0

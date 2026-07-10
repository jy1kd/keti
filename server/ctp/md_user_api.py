"""CTP Market Data API Wrapper (MdUserApi).

Wraps CThostFtdcMdApi for SimNow connection:
- create: load CTP library, register SPI, register front
- login: ReqUserLogin
- subscribe / unsubscribe: SubscribeMarketData / UnSubscribeMarketData
- release: cleanup

Key findings from CTP verification (see docs/task.md PR-1):
- SubscribeMarketData MUST receive str list, NOT bytes list
  (bytes causes heap corruption crash 0xC0000374 in SWIG bindings)
"""

from typing import List, Optional

from .callback import MdSpi


class MdUserApi:
    """行情API封装 — 连接、登录、订阅/退订行情."""

    def __init__(self, config) -> None:
        """Initialize with a Config instance.

        Args:
            config: Config object with broker_id, user_id, password, md_front.
        """
        self.config = config
        self.spi: MdSpi = MdSpi(api=self)
        self._api = None
        self._request_id: int = 0
        self.connection_status: str = "disconnected"  # disconnected | connecting | connected | error
        self.login_status: str = "not_logged_in"  # not_logged_in | logging_in | logged_in | error
        self.subscribed_instruments: List[str] = []

    def create(self) -> None:
        """Create CTP API instance, register SPI, register front, and init.

        After calling create(), the API will attempt to connect.
        OnFrontConnected callback fires on success.
        """
        import ctp

        # 1. Create API instance (load DLL)
        self._api = ctp.CThostFtdcMdApi.CreateFtdcMdApi()

        # 2. Register SPI callback
        self._api.RegisterSpi(self.spi)

        # 3. Register front address
        self._api.RegisterFront(self.config.md_front)

        # 4. Init — triggers OnFrontConnected on success
        self._api.Init()
        self.connection_status = "connecting"

    def login(self) -> int:
        """Send login request to CTP.

        Must be called after OnFrontConnected callback.

        Returns:
            int: 0 on success, negative on error.
        """
        import ctp

        self._request_id += 1
        login_field = ctp.CThostFtdcReqUserLoginField()
        login_field.BrokerID = self.config.broker_id
        login_field.UserID = self.config.user_id
        login_field.Password = self.config.password
        self.login_status = "logging_in"
        return self._api.ReqUserLogin(login_field, self._request_id)

    def subscribe(self, instruments: List[str]) -> int:
        """Subscribe to market data for given instrument IDs.

        ⚠️ CRITICAL: instruments MUST be a list of str, NOT bytes.
        Passing bytes causes heap corruption (0xC0000374) due to SWIG binding bug.

        Args:
            instruments: List of instrument IDs (e.g. ["au2506", "ag2506"]).

        Returns:
            int: 0 on success, negative on error.
        """
        if not instruments:
            return -1
        # Ensure all items are strings (not bytes)
        str_instruments = [str(i) for i in instruments]
        result = self._api.SubscribeMarketData(str_instruments)
        if result == 0:
            for inst in str_instruments:
                if inst not in self.subscribed_instruments:
                    self.subscribed_instruments.append(inst)
        return result

    def unsubscribe(self, instruments: List[str]) -> int:
        """Unsubscribe from market data for given instrument IDs.

        Args:
            instruments: List of instrument IDs to unsubscribe.

        Returns:
            int: 0 on success, negative on error.
        """
        if not instruments:
            return -1
        str_instruments = [str(i) for i in instruments]
        result = self._api.UnSubscribeMarketData(str_instruments)
        if result == 0:
            for inst in str_instruments:
                if inst in self.subscribed_instruments:
                    self.subscribed_instruments.remove(inst)
        return result

    def release(self) -> None:
        """Release the CTP API instance and cleanup."""
        if self._api is not None:
            self._api.Release()
            self._api = None
        self.connection_status = "disconnected"
        self.login_status = "not_logged_in"
        self.subscribed_instruments.clear()

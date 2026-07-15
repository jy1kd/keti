"""CTP reconnect service — exponential backoff + auto-resubscribe.

On FrontDisconnected, attempts to reconnect with exponential backoff.
After successful reconnect, re-subscribes previously tracked instruments.
"""

import logging
from typing import Callable, List

logger = logging.getLogger(__name__)


class ReconnectService:
    """Manages CTP reconnection with exponential backoff.

    Args:
        connect_fn: Callable that re-establishes CTP connection. Returns True on success.
        subscribe_fn: Callable that re-subscribes instruments after reconnect.
        max_retries: Maximum number of reconnect attempts (default 5).
        base_delay: Base delay in seconds for exponential backoff (default 1.0).
    """

    def __init__(
        self,
        connect_fn: Callable[[], bool],
        subscribe_fn: Callable[[List[str]], None],
        max_retries: int = 5,
        base_delay: float = 1.0,
    ) -> None:
        self._connect_fn = connect_fn
        self._subscribe_fn = subscribe_fn
        self.max_retries = max_retries
        self.base_delay = base_delay
        self._retry_count = 0
        self._subscriptions: List[str] = []

    def _get_delay(self, attempt: int) -> float:
        """Calculate exponential backoff delay: base_delay * 2^attempt."""
        return self.base_delay * (2 ** attempt)

    def get_current_delay(self) -> float:
        """Return the backoff delay for the current retry attempt."""
        if self._retry_count <= 0:
            return 0.0
        return self._get_delay(self._retry_count - 1)

    def should_retry(self) -> bool:
        """Return True if retry count is within limit."""
        return self._retry_count < self.max_retries

    def on_disconnect(self) -> None:
        """Called when CTP front disconnected. Increments retry count."""
        self._retry_count += 1
        logger.info("reconnect: disconnected, retry count = %d", self._retry_count)

    def on_success(self) -> None:
        """Called when reconnect succeeds. Resets retry count."""
        self._retry_count = 0
        logger.info("reconnect: success, retry count reset")

    def reset(self) -> None:
        """Reset retry count to 0."""
        self._retry_count = 0

    def update_subscriptions(self, instruments: List[str]) -> None:
        """Update tracked subscription list (replaces, not appends)."""
        self._subscriptions = list(instruments)

    def get_subscriptions(self) -> List[str]:
        """Return current tracked subscriptions."""
        return list(self._subscriptions)

    def try_reconnect(self) -> bool:
        """Attempt to reconnect. Returns True on success.

        On success, re-subscribes tracked instruments.
        """
        logger.info("reconnect: attempting (attempt %d)", self._retry_count + 1)
        try:
            success = self._connect_fn()
        except Exception as e:
            logger.error("reconnect: connect_fn raised: %s", e)
            return False

        if success:
            self.on_success()
            if self._subscriptions:
                logger.info("reconnect: re-subscribing %d instruments", len(self._subscriptions))
                try:
                    self._subscribe_fn(self._subscriptions)
                except Exception as e:
                    logger.error("reconnect: subscribe_fn raised: %s", e)
            return True
        return False

"""Configuration management — reads from environment variables and .env file."""

import os
from pathlib import Path

# Try to load .env file if python-dotenv is available
try:
    from dotenv import load_dotenv

    _env_file = Path(__file__).parent / ".env"
    if _env_file.exists():
        load_dotenv(_env_file)
except ImportError:
    pass


class Config:
    """Application configuration loaded from environment variables.

    Provides sensible defaults for SimNow 7x24 test environment.
    """

    def __init__(
        self,
        broker_id: str = None,
        user_id: str = None,
        password: str = None,
    ) -> None:
        self.broker_id: str = broker_id if broker_id is not None else os.getenv("CTP_BROKER_ID", "9999")
        self.user_id: str = user_id if user_id is not None else os.getenv("CTP_USER_ID", "")
        self.password: str = password if password is not None else os.getenv("CTP_PASSWORD", "")
        self.app_id: str = os.getenv("CTP_APP_ID", "simnow_client")
        self.auth_code: str = os.getenv("CTP_AUTH_CODE", "0000000000000000")
        self.md_front: str = os.getenv(
            "CTP_MD_FRONT", "tcp://182.254.243.31:40011"
        )
        self.td_front: str = os.getenv(
            "CTP_TD_FRONT", "tcp://182.254.243.31:40001"
        )

    def __repr__(self) -> str:
        return (
            f"Config(broker_id={self.broker_id!r}, "
            f"user_id={self.user_id!r}, "
            f"md_front={self.md_front!r}, "
            f"td_front={self.td_front!r})"
        )


def load_config() -> Config:
    """Factory function to create a Config instance from environment."""
    return Config()

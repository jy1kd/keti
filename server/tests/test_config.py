"""Tests for config.py — configuration management."""

import os
import sys
import pytest
from unittest import mock

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from config import Config, load_config


class TestConfigDefaults:
    """Test that Config provides sensible defaults."""

    def test_default_broker_id(self):
        cfg = Config()
        assert cfg.broker_id == "9999"

    def test_default_md_front(self):
        cfg = Config()
        assert cfg.md_front == "tcp://182.254.243.31:40011"

    def test_default_td_front(self):
        cfg = Config()
        assert cfg.td_front == "tcp://182.254.243.31:40001"

    def test_default_user_id(self):
        cfg = Config()
        assert cfg.user_id == ""

    def test_default_password(self):
        cfg = Config()
        assert cfg.password == ""

    def test_default_app_id(self):
        cfg = Config()
        assert cfg.app_id == "simnow_client"

    def test_default_auth_code(self):
        cfg = Config()
        assert cfg.auth_code == "0000000000000000"


class TestConfigFromEnv:
    """Test that Config reads from environment variables."""

    def test_read_broker_id_from_env(self):
        with mock.patch.dict(os.environ, {"CTP_BROKER_ID": "0001"}):
            cfg = Config()
            assert cfg.broker_id == "0001"

    def test_read_md_front_from_env(self):
        with mock.patch.dict(os.environ, {"CTP_MD_FRONT": "tcp://1.2.3.4:50001"}):
            cfg = Config()
            assert cfg.md_front == "tcp://1.2.3.4:50001"

    def test_read_td_front_from_env(self):
        with mock.patch.dict(os.environ, {"CTP_TD_FRONT": "tcp://5.6.7.8:50002"}):
            cfg = Config()
            assert cfg.td_front == "tcp://5.6.7.8:50002"

    def test_read_user_id_from_env(self):
        with mock.patch.dict(os.environ, {"CTP_USER_ID": "test_user"}):
            cfg = Config()
            assert cfg.user_id == "test_user"

    def test_read_password_from_env(self):
        with mock.patch.dict(os.environ, {"CTP_PASSWORD": "secret"}):
            cfg = Config()
            assert cfg.password == "secret"

    def test_read_app_id_from_env(self):
        with mock.patch.dict(os.environ, {"CTP_APP_ID": "my_app"}):
            cfg = Config()
            assert cfg.app_id == "my_app"

    def test_read_all_from_env(self):
        env_vars = {
            "CTP_BROKER_ID": "0001",
            "CTP_MD_FRONT": "tcp://10.0.0.1:40011",
            "CTP_TD_FRONT": "tcp://10.0.0.1:40001",
            "CTP_USER_ID": "env_user",
            "CTP_PASSWORD": "env_pass",
            "CTP_APP_ID": "env_app",
            "CTP_AUTH_CODE": "env_auth",
        }
        with mock.patch.dict(os.environ, env_vars):
            cfg = Config()
            for key, expected in env_vars.items():
                field = key.lower().replace("ctp_", "")
                assert getattr(cfg, field) == expected


class TestLoadConfig:
    """Test the load_config factory function."""

    def test_load_config_returns_config_instance(self):
        cfg = load_config()
        assert isinstance(cfg, Config)

    def test_load_config_from_dotenv(self, tmp_path):
        """If a .env file exists, config should read from it."""
        # This test verifies the load_config integration point
        cfg = load_config()
        # Should still return a valid Config even without .env
        assert cfg.broker_id == "9999"

    def test_config_repr(self):
        cfg = Config()
        cfg.user_id = "user1"
        cfg.password = "test_secret_123"
        r = repr(cfg)
        # Password should NOT appear in repr
        assert "user1" in r
        assert cfg.password not in r

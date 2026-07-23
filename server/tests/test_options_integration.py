"""Integration test — OptionsService wired into app state."""

import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from main import create_app


class TestOptionsServiceOnAppState:
    """验证 OptionsService 已挂载到 app.state。"""

    def test_options_service_exists(self):
        """app.state.options_service 应该存在。"""
        app = create_app()
        assert hasattr(app.state, "options_service")
        assert app.state.options_service is not None

    def test_options_service_type(self):
        """应该是 OptionsService 实例。"""
        from services.options_service import OptionsService
        app = create_app()
        assert isinstance(app.state.options_service, OptionsService)

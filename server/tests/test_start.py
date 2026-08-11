"""Tests for start.py — CTP address selection by trading hours.

SimNow 环境识别（经 openctp 环境监控核实）:
  PRIMARY   = 标准仿真环境 (30011/30001) —— 与实盘时段一致，含夜盘，可靠推行情
  SECONDARY = 7x24 环境 (40011/40001)     —— 仅夜盘推行情，白天/周末静默

交易时段（工作日）→ PRIMARY；非交易时段 → SECONDARY。
"""

import os
import sys
import unittest
from unittest import mock
from datetime import datetime

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import start


class TestSelectAddresses(unittest.TestCase):
    def _select(self, dt: datetime) -> str:
        env = {}
        with mock.patch("start.datetime") as m:
            m.now.return_value = dt
            md, td = start.select_addresses(env)
        return md

    # ── 工作日交易时段 → PRIMARY（标准仿真）──
    def test_weekday_commodity_day_morning(self):
        # 周一 09:30（商品日盘）
        self.assertEqual(self._select(datetime(2026, 8, 10, 9, 30)), start._DEFAULT_MD_PRIMARY)

    def test_weekday_commodity_day_afternoon(self):
        # 周二 13:30（商品日盘下午）
        self.assertEqual(self._select(datetime(2026, 8, 11, 13, 30)), start._DEFAULT_MD_PRIMARY)

    def test_weekday_night_session(self):
        # 周一 21:30（商品夜盘）
        self.assertEqual(self._select(datetime(2026, 8, 10, 21, 30)), start._DEFAULT_MD_PRIMARY)

    def test_weekday_early_morning_night_tail(self):
        # 周二 01:30（夜盘尾段，贵金属 02:30 收盘）
        self.assertEqual(self._select(datetime(2026, 8, 11, 1, 30)), start._DEFAULT_MD_PRIMARY)

    # ── 工作日非交易时段 → SECONDARY（7x24）──
    def test_weekday_lunch_break(self):
        # 周二 10:15-10:30 商品日盘休市
        self.assertEqual(self._select(datetime(2026, 8, 11, 10, 20)), start._DEFAULT_MD_SECONDARY)

    def test_weekday_afternoon_close(self):
        # 周二 16:00（商品/中金所已收盘，非交易时段）
        self.assertEqual(self._select(datetime(2026, 8, 11, 16, 0)), start._DEFAULT_MD_SECONDARY)

    def test_weekday_evening_gap(self):
        # 周二 18:00（收盘后夜盘前）
        self.assertEqual(self._select(datetime(2026, 8, 11, 18, 0)), start._DEFAULT_MD_SECONDARY)

    def test_weekday_before_open(self):
        # 周二 08:00（开盘前）
        self.assertEqual(self._select(datetime(2026, 8, 11, 8, 0)), start._DEFAULT_MD_SECONDARY)

    # ── 周末 → SECONDARY（7x24；周末白天无行情属正常）──
    def test_weekend_day(self):
        # 周六 12:00
        self.assertEqual(self._select(datetime(2026, 8, 15, 12, 0)), start._DEFAULT_MD_SECONDARY)

    def test_weekend_night(self):
        # 周六 22:00（周末夜盘无行情）
        self.assertEqual(self._select(datetime(2026, 8, 15, 22, 0)), start._DEFAULT_MD_SECONDARY)

    # ── 夜盘边界：21:00 起、02:30 止 ──
    def test_night_session_start_boundary(self):
        # 周一 20:59 → 未开盘，SECONDARY
        self.assertEqual(self._select(datetime(2026, 8, 10, 20, 59)), start._DEFAULT_MD_SECONDARY)

    def test_night_session_end_boundary(self):
        # 周二 02:30 → 收盘，SECONDARY；02:29 → 仍交易，PRIMARY
        self.assertEqual(self._select(datetime(2026, 8, 11, 2, 29)), start._DEFAULT_MD_PRIMARY)
        self.assertEqual(self._select(datetime(2026, 8, 11, 2, 30)), start._DEFAULT_MD_SECONDARY)

    # ── .env 覆盖 ──
    def test_env_override_primary(self):
        env = {"CTP_MD_FRONT_PRIMARY": "tcp://1.1.1.1:11111", "CTP_TD_FRONT_PRIMARY": "tcp://1.1.1.1:11112"}
        with mock.patch("start.datetime") as m:
            m.now.return_value = datetime(2026, 8, 10, 9, 30)
            md, td = start.select_addresses(env)
        self.assertEqual(md, "tcp://1.1.1.1:11111")
        self.assertEqual(td, "tcp://1.1.1.1:11112")

    def test_env_override_secondary(self):
        env = {"CTP_MD_FRONT_SECONDARY": "tcp://2.2.2.2:22221", "CTP_TD_FRONT_SECONDARY": "tcp://2.2.2.2:22222"}
        with mock.patch("start.datetime") as m:
            m.now.return_value = datetime(2026, 8, 11, 16, 0)
            md, td = start.select_addresses(env)
        self.assertEqual(md, "tcp://2.2.2.2:22221")
        self.assertEqual(td, "tcp://2.2.2.2:22222")


if __name__ == "__main__":
    unittest.main()

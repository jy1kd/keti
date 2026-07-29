"""期权服务层 — 期权合约筛选、期权链聚合、隐含波动率计算。"""

import math
import logging
from datetime import datetime
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class OptionsService:
    """期权数据服务。

    提供：
    - 期权合约筛选（productClass='2'）
    - 期权链聚合（按标的+到期日分组，calls/puts 分列）
    - 隐含波动率计算（Black-Scholes 模型）
    """

    def get_options(
        self, instruments: List[dict], underlying: str = ""
    ) -> List[dict]:
        """筛选期权合约。

        Args:
            instruments: 全部合约列表。
            underlying: 可选，按标的合约筛选。

        Returns:
            期权合约列表。
        """
        result = [
            inst for inst in instruments
            if inst.get("productClass") == "2"
        ]
        if underlying:
            result = [
                inst for inst in result
                if inst.get("underlyingInstrID") == underlying
            ]
        return result

    def get_option_chains(
        self,
        instruments: List[dict],
        underlying: str = "",
        expire_date: str = "",
    ) -> List[dict]:
        """聚合期权链（按标的+到期日分组）。

        Args:
            instruments: 全部合约列表。
            underlying: 可选，按标的合约筛选。
            expire_date: 可选，按到期日筛选。

        Returns:
            OptionChain 字典列表。
        """
        options = self.get_options(instruments, underlying=underlying)

        # Group by (underlyingInstrID, expireDate)
        groups: Dict[tuple, dict] = {}
        for inst in options:
            key = (inst.get("underlyingInstrID", ""), inst.get("expireDate", ""))
            if key not in groups:
                groups[key] = {
                    "underlying": key[0],
                    "expireDate": key[1],
                    "calls": [],
                    "puts": [],
                }

            quote = {
                "instrumentID": inst.get("instrumentID", ""),
                "strikePrice": inst.get("strikePrice", 0.0),
                "optionType": inst.get("optionsType", ""),
                "lastPrice": 0.0,
                "bidPrice": 0.0,
                "askPrice": 0.0,
                "volume": 0,
                "openInterest": 0,
                "impliedVolatility": 0.0,
            }

            if inst.get("optionsType") == "1":
                groups[key]["calls"].append(quote)
            else:
                groups[key]["puts"].append(quote)

        # Sort by strike price
        for chain in groups.values():
            chain["calls"].sort(key=lambda q: q["strikePrice"])
            chain["puts"].sort(key=lambda q: q["strikePrice"])

        # Convert to list, optionally filter by expire_date
        chains = list(groups.values())
        if expire_date:
            chains = [c for c in chains if c["expireDate"] == expire_date]

        chains.sort(key=lambda c: (c["underlying"], c["expireDate"]))
        return chains

    def get_volatility(
        self,
        instruments: List[dict],
        snapshots: Dict[str, dict],
        risk_free_rate: float = 0.03,
        underlying: str = "",
    ) -> List[dict]:
        """计算隐含波动率。

        Args:
            instruments: 全部合约列表。
            snapshots: 行情快照字典 {instrumentID: snapshot_dict}。
            risk_free_rate: 无风险利率（年化）。
            underlying: 可选，按标的合约筛选。

        Returns:
            VolatilityData 字典列表。
        """
        options = self.get_options(instruments, underlying=underlying)
        result = []

        for inst in options:
            option_id = inst.get("instrumentID", "")
            underlying_id = inst.get("underlyingInstrID", "")

            # Get snapshots
            option_snap = snapshots.get(option_id, {})
            underlying_snap = snapshots.get(underlying_id, {})

            option_price = option_snap.get("lastPrice", 0.0)
            underlying_price = underlying_snap.get("lastPrice", 0.0)

            if option_price <= 0 or underlying_price <= 0:
                continue

            strike_price = inst.get("strikePrice", 0.0)
            option_type = inst.get("optionsType", "")

            # Calculate time to expiry
            expire_date = inst.get("expireDate", "")
            time_to_expiry = self._calc_time_to_expiry(expire_date)

            if time_to_expiry <= 0:
                continue

            iv = self.calculate_implied_volatility(
                option_price=option_price,
                underlying_price=underlying_price,
                strike_price=strike_price,
                time_to_expiry=time_to_expiry,
                risk_free_rate=risk_free_rate,
                option_type=option_type,
            )

            result.append({
                "instrumentID": option_id,
                "impliedVolatility": iv,
                "underlyingPrice": underlying_price,
                "strikePrice": strike_price,
                "timeToExpiry": time_to_expiry,
                "riskFreeRate": risk_free_rate,
                "optionType": option_type,
                "updateTime": datetime.now().strftime("%H:%M:%S"),
            })

        return result

    # 隐含波动率上限（500%），超过此值认为是非物理的异常数据
    MAX_IV = 5.0

    def calculate_implied_volatility(
        self,
        option_price: float,
        underlying_price: float,
        strike_price: float,
        time_to_expiry: float,
        risk_free_rate: float,
        option_type: str,
    ) -> float:
        """Newton-Raphson 法计算隐含波动率。

        Args:
            option_price: 期权市场价格。
            underlying_price: 标的价格 S。
            strike_price: 行权价 K。
            time_to_expiry: 到期时间（年化）T。
            risk_free_rate: 无风险利率 r。
            option_type: '1'=看涨, '2'=看跌。

        Returns:
            隐含波动率（如 0.25）。异常价格或迭代不收敛返回 0.0。
        """
        if option_price <= 0 or underlying_price <= 0 or strike_price <= 0:
            return 0.0
        if time_to_expiry <= 0:
            return 0.0

        # Layer 1: 套利边界检查 — 期权价格必须在理论上下界之内
        intrinsic = self._intrinsic_value(
            underlying_price, strike_price, option_type
        )
        if option_price < intrinsic - 1e-6:
            # 价格低于内在价值（违反套利）
            logger.debug(
                "Option price %.4f < intrinsic %.4f, skip IV", option_price, intrinsic
            )
            return 0.0

        # 期权价格上限：Call ≤ S，Put ≤ K·e^(-rT)
        if option_type == "1":
            upper_bound = underlying_price
        else:
            upper_bound = strike_price * math.exp(-risk_free_rate * time_to_expiry)
        if option_price > upper_bound + 1e-6:
            logger.debug(
                "Option price %.4f > upper bound %.4f, skip IV", option_price, upper_bound
            )
            return 0.0

        # Layer 2: Newton-Raphson 迭代（含步长限制 + IV 上限）
        sigma = 0.3  # Initial guess
        max_iterations = 100
        tolerance = 1e-6
        made_progress = False  # 是否成功完成过至少一次迭代

        for _ in range(max_iterations):
            price = self._black_scholes_price(
                s=underlying_price,
                k=strike_price,
                t=time_to_expiry,
                r=risk_free_rate,
                sigma=sigma,
                option_type=option_type,
            )
            diff = price - option_price

            if abs(diff) < tolerance:
                return min(sigma, self.MAX_IV)

            vega = self._vega(
                s=underlying_price,
                k=strike_price,
                t=time_to_expiry,
                r=risk_free_rate,
                sigma=sigma,
            )

            if vega < 1e-10:
                # vega 塌缩（临近到期 + 深度虚值/实值），Newton-Raphson 无法工作
                break

            made_progress = True
            step = diff / vega

            # 步长限制：单步 sigma 变化不超过当前值的 4 倍
            max_step = max(sigma * 4.0, 1.0)
            if abs(step) > max_step:
                step = max_step if step > 0 else -max_step

            sigma -= step

            # Keep sigma positive
            if sigma <= 0:
                sigma = 0.01

            # IV 上限保护：sigma 超过上限直接返回 0（非物理值）
            if sigma > self.MAX_IV:
                logger.debug("IV exceeded %.0f%%, treating as non-physical", self.MAX_IV * 100)
                return 0.0

        if not made_progress:
            # 第一次迭代 vega 就塌缩了，返回初始猜测无意义
            return 0.0

        return min(sigma, self.MAX_IV) if sigma > 0 else 0.0

    @staticmethod
    def _intrinsic_value(s: float, k: float, option_type: str) -> float:
        """期权内在价值（不折现）。"""
        if option_type == "1":  # Call
            return max(s - k, 0.0)
        else:  # Put
            return max(k - s, 0.0)

    def _black_scholes_price(
        self, s: float, k: float, t: float, r: float, sigma: float, option_type: str
    ) -> float:
        """Black-Scholes 期权定价公式。

        Args:
            s: 标的价格。
            k: 行权价。
            t: 到期时间（年化）。
            r: 无风险利率。
            sigma: 波动率。
            option_type: '1'=看涨, '2'=看跌。

        Returns:
            理论期权价格。
        """
        d1 = (math.log(s / k) + (r + 0.5 * sigma ** 2) * t) / (sigma * math.sqrt(t))
        d2 = d1 - sigma * math.sqrt(t)

        if option_type == "1":  # Call
            return s * self._norm_cdf(d1) - k * math.exp(-r * t) * self._norm_cdf(d2)
        else:  # Put
            return k * math.exp(-r * t) * self._norm_cdf(-d2) - s * self._norm_cdf(-d1)

    def _vega(self, s: float, k: float, t: float, r: float, sigma: float) -> float:
        """Vega = dC/dsigma。"""
        d1 = (math.log(s / k) + (r + 0.5 * sigma ** 2) * t) / (sigma * math.sqrt(t))
        return s * math.sqrt(t) * self._norm_pdf(d1)

    @staticmethod
    def _norm_cdf(x: float) -> float:
        """标准正态分布累积分布函数。"""
        return 0.5 * (1 + math.erf(x / math.sqrt(2)))

    @staticmethod
    def _norm_pdf(x: float) -> float:
        """标准正态分布概率密度函数。"""
        return math.exp(-0.5 * x * x) / math.sqrt(2 * math.pi)

    @staticmethod
    def _calc_time_to_expiry(expire_date: str) -> float:
        """计算到期时间（年化）。

        Args:
            expire_date: 到期日，格式 YYYYMMDD。

        Returns:
            年化时间（如 0.5 = 半年），已过期返回 0.0。
        """
        if not expire_date or len(expire_date) != 8:
            return 0.0

        try:
            expiry = datetime.strptime(expire_date, "%Y%m%d")
            now = datetime.now()
            delta = (expiry - now).total_seconds() / (365.25 * 24 * 3600)
            return max(0.0, delta)
        except ValueError:
            return 0.0

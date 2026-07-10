# ctp_realtime_demo.py - CTP实时行情显示
# 用于查看真实API数据，角色A开发参考
# 运行时间：交易时段（09:00-15:00 或 21:00-02:30）

import ctp
import time
import warnings
from datetime import datetime


# ============ 配置 ============
CONFIG = {
    "broker_id": "9999",
    "user_id": "268326",
    "password": "703495jy!!!",
    "md_front": "tcp://182.254.243.31:40011",  # 7x24环境
    # "md_front": "tcp://180.168.146.187:10131",  # 第一套（仅交易时段）
    "instruments": ["IF2507", "IC2507", "IH2507"],  # 中金所股指期货（活跃合约）
}


class MarketDataSpi(ctp.CThostFtdcMdSpi):
    """行情回调处理"""

    def __init__(self, api):
        super().__init__()
        self.api = api
        self.request_id = 0
        self.connected = False
        self.logged_in = False
        self.data_count = 0

    def OnFrontConnected(self):
        """连接成功"""
        self.connected = True
        print(f"[{now()}] ✅ 行情前置机连接成功")
        print(f"[{now()}] 🔐 开始登录...")

        login_field = ctp.CThostFtdcReqUserLoginField()
        login_field.BrokerID = CONFIG["broker_id"]
        login_field.UserID = CONFIG["user_id"]
        login_field.Password = CONFIG["password"]
        ret = self.api.ReqUserLogin(login_field, self.request_id)
        self.request_id += 1

    def OnFrontDisconnected(self, nReason):
        """断开连接"""
        self.connected = False
        print(f"[{now()}] ❌ 连接断开，原因码: {nReason}")

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            print(f"[{now()}] ❌ 登录失败: {pRspInfo.ErrorID} - {pRspInfo.ErrorMsg}")
            return

        self.logged_in = True
        print(f"[{now()}] ✅ 登录成功！")
        print(f"[{now()}] 📊 交易日: {pRspUserLogin.TradingDay}")
        print(f"[{now()}] 📡 订阅合约: {CONFIG['instruments']}")

        # 订阅行情（必须传字符串列表！）
        ret = self.api.SubscribeMarketData(CONFIG["instruments"])
        print(f"[{now()}] 📨 订阅请求已发送")

    def OnRspSubMarketData(self, pSpecificInstrument, pRspInfo, nRequestID, bIsLast):
        """订阅响应"""
        if pRspInfo and pRspInfo.ErrorID != 0:
            print(f"[{now()}] ❌ 订阅失败 {pSpecificInstrument.InstrumentID}: {pRspInfo.ErrorMsg}")
        else:
            print(f"[{now()}] ✅ 订阅成功: {pSpecificInstrument.InstrumentID}")

    def OnRtnDepthMarketData(self, pDepthMarketData):
        """行情推送 - 核心回调"""
        self.data_count += 1
        d = pDepthMarketData

        # 格式化输出
        print(f"\n{'='*70}")
        print(f"[{now()}] 📈 行情推送 #{self.data_count}")
        print(f"{'='*70}")
        print(f"  合约代码:     {d.InstrumentID}")
        print(f"  交易日:       {d.TradingDay}")
        print(f"  更新时间:     {d.UpdateTime}.{d.UpdateMillisec}")
        print(f"{'─'*70}")
        print(f"  最新价:       {d.LastPrice}")
        print(f"  开盘价:       {d.OpenPrice}")
        print(f"  最高价:       {d.HighestPrice}")
        print(f"  最低价:       {d.LowestPrice}")
        print(f"  昨收盘:       {d.PreClosePrice}")
        print(f"  昨结算:       {d.PreSettlementPrice}")
        print(f"{'─'*70}")
        print(f"  涨停价:       {d.UpperLimitPrice}")
        print(f"  跌停价:       {d.LowerLimitPrice}")
        print(f"{'─'*70}")
        print(f"  买一:         {d.BidPrice1} × {d.BidVolume1}")
        print(f"  买二:         {d.BidPrice2} × {d.BidVolume2}")
        print(f"  买三:         {d.BidPrice3} × {d.BidVolume3}")
        print(f"  买四:         {d.BidPrice4} × {d.BidVolume4}")
        print(f"  买五:         {d.BidPrice5} × {d.BidVolume5}")
        print(f"{'─'*70}")
        print(f"  卖一:         {d.AskPrice1} × {d.AskVolume1}")
        print(f"  卖二:         {d.AskPrice2} × {d.AskVolume2}")
        print(f"  卖三:         {d.AskPrice3} × {d.AskVolume3}")
        print(f"  卖四:         {d.AskPrice4} × {d.AskVolume4}")
        print(f"  卖五:         {d.AskPrice5} × {d.AskVolume5}")
        print(f"{'─'*70}")
        print(f"  成交量:       {d.Volume}")
        print(f"  成交额:       {d.Turnover}")
        print(f"  持仓量:       {d.OpenInterest}")
        print(f"  当日均价:     {d.AveragePrice}")
        print(f"{'─'*70}")
        print(f"  交易所:       {d.ExchangeID}")
        print(f"  今收盘:       {d.ClosePrice}")
        print(f"  今结算:       {d.SettlementPrice}")
        print(f"  业务日期:     {d.ActionDay}")
        print(f"{'='*70}")


def now():
    """当前时间"""
    return datetime.now().strftime("%H:%M:%S")


def main():
    print("=" * 50)
    print("CTP 实时行情显示程序")
    print("=" * 50)
    print(f"行情前置: {CONFIG['md_front']}")
    print(f"订阅合约: {CONFIG['instruments']}")
    print(f"当前时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()
    print("交易时段:")
    print("  日盘: 09:00 - 15:00")
    print("  夜盘: 21:00 - 次日02:30")
    print()
    print("提示: 非交易时段连接正常但无行情推送")
    print("=" * 50)
    print()

    md_api = None
    try:
        # 创建API
        md_api = ctp.CThostFtdcMdApi.CreateFtdcMdApi()

        # 注册SPI
        spi = MarketDataSpi(md_api)
        md_api.RegisterSpi(spi)

        # 注册前置机
        md_api.RegisterFront(CONFIG["md_front"])

        # 初始化
        md_api.Init()
        print(f"[{now()}] 🚀 正在连接...")

        # 主循环
        start_time = time.time()
        while True:
            time.sleep(1)
            elapsed = time.time() - start_time

            # 超时检测
            if elapsed > 60 and not spi.connected:
                print(f"\n[{now()}] ⏰ 60秒未连接成功，请检查网络")
                break

            # 状态提示
            if spi.connected and spi.logged_in:
                if spi.data_count == 0 and int(elapsed) % 30 == 0:
                    print(f"[{now()}] ⏳ 已连接 {int(elapsed)} 秒，等待行情数据...")
                    print(f"         （非交易时段无行情推送，请在交易时段运行）")

    except KeyboardInterrupt:
        print(f"\n[{now()}] 👋 用户中断")
    except Exception as e:
        print(f"\n[{now()}] ❌ 异常: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if md_api:
            try:
                md_api.Release()
                print(f"[{now()}] 🔓 API已释放")
            except:
                pass


if __name__ == "__main__":
    main()

import ctp
import os
import time
from pathlib import Path

# 从环境变量读取配置
from dotenv import load_dotenv
load_dotenv(Path(__file__).parent / "server" / ".env")

BROKER_ID = os.getenv("CTP_BROKER_ID", "9999")
USER_ID = os.getenv("CTP_USER_ID", "")
PASSWORD = os.getenv("CTP_PASSWORD", "")
MD_FRONT = os.getenv("CTP_MD_FRONT", "tcp://182.254.243.31:40011")
INSTRUMENTS = [s.strip() for s in os.getenv("CTP_TEST_INSTRUMENT", "au2506").split(",")]


# 1. 创建自定义的SPI类，用于处理服务器回调
class MyMdSpi(ctp.CThostFtdcMdSpi):
    def __init__(self, api):
        super().__init__()
        self.api = api
        self.request_id = 0

    def OnFrontConnected(self):
        """成功连接到行情前置机时触发"""
        print("行情前置机连接成功，开始登录")
        # 构造登录请求字段
        login_field = ctp.CThostFtdcReqUserLoginField()
        login_field.BrokerID = BROKER_ID
        login_field.UserID = USER_ID
        login_field.Password = PASSWORD
        # 发送登录请求
        self.api.ReqUserLogin(login_field, self.request_id)
        self.request_id += 1

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录请求的响应"""
        if pRspInfo is not None and pRspInfo.ErrorID != 0:
            print(f"行情登录失败，错误代码: {pRspInfo.ErrorID}, 错误信息: {pRspInfo.ErrorMsg}")
            return
        print("行情服务器登录成功")
        # 登录成功后，订阅合约行情
        self.api.SubscribeMarketData(INSTRUMENTS)

    def OnRtnDepthMarketData(self, pDepthMarketData):
        """接收到深度行情数据推送"""
        # CTP-Python已自动将GBK编码的字符串转换为UTF-8[^8]
        print(f"合约: {pDepthMarketData.InstrumentID}, "
              f"最新价: {pDepthMarketData.LastPrice}, "
              f"成交量: {pDepthMarketData.Volume}")


# 2. 主程序流程
if __name__ == "__main__":
    # 创建行情API实例
    md_api = ctp.CThostFtdcMdApi.CreateFtdcMdApi()
    # 创建我们的SPI实例并注册
    md_spi = MyMdSpi(md_api)
    md_api.RegisterSpi(md_spi)

    # 注册行情前置机地址
    md_api.RegisterFront(MD_FRONT)

    # 初始化API，开始连接
    md_api.Init()
    print(f"行情API初始化完成，前置地址: {MD_FRONT}，等待连接事件...")

    # 保持程序运行，等待回调事件
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n用户中断，释放API资源...")
        md_api.Release()
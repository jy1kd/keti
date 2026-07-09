# md_demo.py
import ctp
import time


# 1. 创建自定义的SPI类，用于处理服务器回调
class MyMdSpi(ctp.CThostFtdcMdSpi):
    def __init__(self, api):
        super().__init__()
        self.api = api
        self.request_id = 0
        self.connected = False
        self.logged_in = False

    def OnFrontConnected(self):
        """成功连接到行情前置机时触发"""
        self.connected = True
        print("[回调] 行情前置机连接成功，开始登录...")
        # 构造登录请求字段
        login_field = ctp.CThostFtdcReqUserLoginField()
        login_field.BrokerID = "9999"  # 你的经纪商代码
        login_field.UserID = "268326"  # 替换为你的用户ID
        login_field.Password = "703495jy!!!"  # 替换为你的密码
        # 发送登录请求
        ret = self.api.ReqUserLogin(login_field, self.request_id)
        print(f"[请求] 登录请求已发送，返回值: {ret}")
        self.request_id += 1

    def OnFrontDisconnected(self, nReason):
        """断开连接时触发"""
        print(f"[回调] 行情前置机断开连接，原因码: {nReason}")

    def OnRspUserLogin(self, pRspUserLogin, pRspInfo, nRequestID, bIsLast):
        """登录请求的响应"""
        if pRspInfo is not None and pRspInfo.ErrorID != 0:
            print(f"[错误] 行情登录失败，错误代码: {pRspInfo.ErrorID}, 错误信息: {pRspInfo.ErrorMsg}")
            return
        self.logged_in = True
        print("[回调] 行情服务器登录成功！")
        # 登录成功后，订阅合约行情
        instruments = ["rb2410", "IF2412"]  # 订阅的合约列表，例如螺纹钢和沪深300股指期货
        # 注意：合约代码需要转换为字节串
        print(f"[请求] 订阅合约: {instruments}")
        ret = self.api.SubscribeMarketData([i.encode('utf-8') for i in instruments])
        print(f"[请求] 订阅请求已发送，返回值: {ret}")

    def OnRspSubMarketData(self, pSpecificInstrument, pRspInfo, nRequestID, bIsLast):
        """订阅行情数据的响应"""
        if pRspInfo is not None and pRspInfo.ErrorID != 0:
            print(f"[错误] 订阅失败，合约: {pSpecificInstrument.InstrumentID}, 错误: {pRspInfo.ErrorMsg}")
        else:
            print(f"[回调] 订阅成功，合约: {pSpecificInstrument.InstrumentID}")

    def OnRtnDepthMarketData(self, pDepthMarketData):
        """接收到深度行情数据推送"""
        # CTP-Python已自动将GBK编码的字符串转换为UTF-8
        print(f"[行情] 合约: {pDepthMarketData.InstrumentID}, "
              f"最新价: {pDepthMarketData.LastPrice}, "
              f"成交量: {pDepthMarketData.Volume}")


# 2. 主程序流程
if __name__ == "__main__":
    print("=" * 50)
    print("CTP 行情API验证程序")
    print("=" * 50)

    # 创建行情API实例
    md_api = ctp.CThostFtdcMdApi.CreateFtdcMdApi()
    print("[初始化] API实例创建成功")

    # 创建我们的SPI实例并注册
    md_spi = MyMdSpi(md_api)
    md_api.RegisterSpi(md_spi)
    print("[初始化] SPI回调注册成功")

    # 注册行情前置机地址（使用SimNow第二套7x24环境）
    front_address = "tcp://182.254.243.31:40011"
    md_api.RegisterFront(front_address)
    print(f"[初始化] 前置机地址: {front_address}")

    # 初始化API，开始连接
    md_api.Init()
    print("[初始化] API初始化完成，等待连接事件...")
    print("-" * 50)

    # 保持程序运行，等待回调事件
    start_time = time.time()
    timeout = 120  # 30秒超时
    try:
        while True:
            time.sleep(1)
            elapsed = time.time() - start_time

            # 超时检测
            if elapsed > timeout and not md_spi.connected:
                print(f"\n[超时] {timeout}秒内未收到连接回调，可能原因：")
                print("  1. 网络无法访问前置机地址")
                print("  2. 防火墙阻止了TCP连接")
                print("  3. 前置机地址不可用")
                print("\n建议：")
                print("  - 检查网络: ping 182.254.243.31")
                print("  - 检查端口: telnet 182.254.243.31 40011")
                print("  - 尝试第一套地址（仅交易时段）: tcp://180.168.146.187:10131")
                break

            # 连接成功后每10秒打印一次状态
            if md_spi.connected and md_spi.logged_in and int(elapsed) % 10 == 0:
                print(f"[状态] 已连接 {int(elapsed)} 秒，等待行情数据...")

    except KeyboardInterrupt:
        print("\n[退出] 用户中断，释放API资源...")
    finally:
        md_api.Release()
        print("[退出] API资源已释放")
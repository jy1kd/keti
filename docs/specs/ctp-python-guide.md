# CTP-Python 新手教程：从安装到连接SimNow

CTP-Python 是一个使用SWIG工具将官方C++版CTP接口封装为Python API的项目，它允许Python开发者直接调用CTP接口进行期货交易和行情获取[^5][^8]。本教程将引导新手完成从环境配置到实际连接SimNow模拟环境的全过程。

## 一、 环境准备与安装

### 1.1 系统与Python要求
CTP-Python支持主流操作系统，包括Linux、macOS和Windows[^8]。它对Python版本有明确要求：**仅支持CPython解释器，版本范围为3.7至3.13**[^6]。在安装前，请确认你的Python环境符合此要求。

### 1.2 快速安装（推荐新手）
对于大多数用户，最简单的方式是通过PyPI（Python包索引）直接安装预编译的二进制包。这避免了复杂的编译过程，只需在命令行中执行以下命令[^6][^8]：
```bash
pip install ctp-python
```
此命令会自动安装与你的操作系统和Python版本兼容的CTP-Python库。预编译包支持Windows amd64、Linux amd64、macOS arm64/amd64平台[^6][^8]。

### 1.3 从源码安装（可选）
如果你需要特定版本的CTP API，或者预编译包不兼容你的环境，可以选择从源码编译安装。这需要提前准备编译环境：
*   **Windows**：需要安装Visual Studio Build Tools和Miniconda，并通过conda安装SWIG和libiconv库[^6][^8]。
*   **macOS**：需要安装Xcode命令行工具和Homebrew（用于安装SWIG）[^6]。
*   **Linux**：使用系统包管理器安装SWIG和g++编译器即可[^6]。

准备好环境后，克隆代码仓库并安装[^8]：
```bash
git clone https://github.com/cloudQuant/ctp-python.git
cd ctp-python
# 默认安装API版本6.7.7，可通过环境变量指定其他版本，例如6.6.9
export API_VER=6.6.9
pip install .
```

## 二、 获取并配置SimNow账户信息

SimNow是中国金融期货交易所提供的官方模拟交易环境，用于测试CTP接口[^6]。

1.  **注册账户**：访问SimNow官网 (`https://www.simnow.com.cn`) 注册一个模拟交易账户[^6]。
2.  **获取连接信息**：成功注册后，你会获得以下关键信息，用于程序连接[^6]：
    *   **投资者代码 (User ID)**：你的模拟账户用户名。
    *   **密码 (Password)**：你的账户密码。
    *   **经纪商代码 (Broker ID)**：对于SimNow，固定为 `9999`[^6]。
    *   **产品名称 (App ID)**：固定为 `simnow_client_test`[^6]。
    *   **授权编码 (Auth Code)**：固定为 `0000000000000000`（16个0）[^6]。
3.  **选择服务器**：SimNow提供两套服务器环境，地址不同[^6]：
    *   **第一套（交易时段仿真）**：仅在真实交易时段提供服务。
    *   **第二套（7x24测试环境）**：支持全天候测试，**新注册用户可能需要等待约两个交易日才能使用**。其前置地址示例如下：
        *   交易前置：`tcp://182.254.243.31:40001`
        *   行情前置：`tcp://182.254.243.31:40011`

为了方便管理，建议将上述信息配置为环境变量。你可以在项目根目录复制 `.env.example` 文件为 `.env`，并填入你的账户信息[^6]。

## 三、 编写第一个连接程序：获取行情

以下是一个简单的行情订阅示例，演示如何使用CTP-Python连接SimNow行情服务器。

```python
# md_demo.py
import ctp
import time

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
        login_field.BrokerID = "9999"  # 你的经纪商代码
        login_field.UserID = "你的SimNow投资者代码"  # 替换为你的用户ID
        login_field.Password = "你的密码"  # 替换为你的密码
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
        instruments = ["rb2410", "IF2412"]  # 订阅的合约列表，例如螺纹钢和沪深300股指期货
        # 注意：合约代码需要转换为字节串
        self.api.SubscribeMarketData([i.encode('utf-8') for i in instruments])

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
    
    # 注册行情前置机地址（使用SimNow第二套7x24环境）
    front_address = "tcp://182.254.243.31:40011"
    md_api.RegisterFront(front_address)
    
    # 初始化API，开始连接
    md_api.Init()
    print("行情API初始化完成，等待连接事件...")
    
    # 保持程序运行，等待回调事件
    try:
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        print("\n用户中断，释放API资源...")
        md_api.Release()
```

**代码关键点解析**：
*   **SPI与API**：CTP接口采用异步回调模式。你需要创建一个SPI类（如 `MyMdSpi`）来重写回调方法（如 `OnFrontConnected`），以响应服务器事件。通过API对象（`md_api`）主动发起请求（如 `ReqUserLogin`）[^9]。
*   **字符串编码**：CTP-Python库已内部处理编码转换，将CTP返回的GBK编码字符串自动转换为UTF-8，方便在Python 3中处理[^7][^8]。但在调用某些API（如 `SubscribeMarketData`）时，传入的合约代码可能需要转换为字节串。
*   **运行**：运行此脚本，如果网络和账户信息正确，你将看到连接、登录成功的信息，并开始接收指定合约的行情数据。

## 四、 进阶：连接交易接口

交易接口的流程比行情接口稍复杂，因为涉及客户端认证（穿透式监管要求）。以下是核心步骤框架：

1.  **创建交易SPI类**：类似行情SPI，但需要处理更多回调，如 `OnRspAuthenticate`（认证响应）、`OnRspOrderInsert`（订单录入响应）、`OnRtnTrade`（成交回报）等[^9]。
2.  **连接与认证流程**：
    *   在 `OnFrontConnected` 回调中，首先调用 `ReqAuthenticate` 进行客户端认证，需要提供 `AppID` 和 `AuthCode`[^6]。
    *   在 `OnRspAuthenticate` 回调中，认证成功后再调用 `ReqUserLogin` 进行用户登录[^6]。
3.  **下单示例**：登录成功后，可以构造 `CThostFtdcInputOrderField` 结构体，填写合约、价格、数量、买卖方向等信息，然后调用 `ReqOrderInsert` 发送订单[^4]。

## 五、 测试与常见问题

### 5.1 验证安装
安装完成后，可以在Python交互环境中验证是否成功[^8]：
```python
>>> import ctp
>>> ctp.CThostFtdcMdApi.GetApiVersion()
'v6.7.7_xxx'  # 将显示具体的API版本号
```

### 5.2 运行库提供的测试
CTP-Python项目自带测试脚本，可用于验证连接[^6][^8]：
```bash
# 运行交易接口测试（需要替换为你的真实信息）
pytest -s tests/test_trader.py --front=tcp://182.254.243.31:40001 --broker=9999 --user=<你的用户ID> --password=<你的密码> --app=simnow_client_test --auth=0000000000000000
```

### 5.3 常见问题与解决
*   **导入错误 `No module named 'ctp._ctp'`**：这表示C扩展未正确编译。请确保是通过 `pip install ctp-python` 安装的预编译包，或者从源码编译安装成功[^6]。
*   **连接后无任何回调（程序卡住）**：确保使用的是正确的SimNow服务器地址，并且网络通畅。新注册的SimNow账户如使用7x24环境，需等待激活[^5]。
*   **`Decrypt handshake data failed` 错误**：这通常意味着你使用的CTP API版本与服务器端不匹配。SimNow通常使用较新的生产版本，请确保安装的 `ctp-python` 版本与之兼容[^6][^8]。首次进行穿透式采集需使用“评测版本”，后续用“生产版本”[^8]。
*   **Linux权限问题**：在Linux下运行交易接口可能因采集系统信息失败而报错（如 `dmidecode not found` 或 `permission denied`）。解决方法包括将 `/usr/sbin` 加入PATH、给 `dmidecode` 命令加权限或将自己加入 `disk` 用户组[^6][^8]。

通过以上步骤，你应该能够成功搭建CTP-Python开发环境，并连接到SimNow模拟服务器开始你的量化交易开发之旅。建议先从行情接口开始熟悉回调机制，再逐步尝试交易功能。


### 六、 相关链接

上期所
https://edu.shfe.com.cn/home/simulate/simnow.html

官网
https://www.simnow.com.cn/static/register.action
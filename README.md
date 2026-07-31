# 上期所 SimNow 模拟交易终端

基于 CTP 协议的期货期权模拟交易终端，支持**浏览器 Web 应用**和 **Electron 桌面应用**两种运行模式，对接 SimNow 7×24 测试环境，实现行情接入、交易接入、手动报单等完整功能。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 | UI 框架、构建 |
| 桌面端 | Electron 43 | 桌面应用、系统托盘、全局快捷键 |
| 表格 | @visactor/vtable | 高性能虚拟滚动，支持 1000+ 合约 |
| 图表 | ECharts 5 | K 线图、技术指标 |
| 状态管理 | Zustand | 轻量级状态管理，localStorage 持久化 |
| 后端 | Python FastAPI 0.100+ + websockets 11.x | REST API、WebSocket |
| CTP 绑定 | ctp-python 6.7.7.post1 | Python CTP 封装 |

## 架构

### 运行模式

项目支持两种运行模式，共享同一套前端代码和后端服务：

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  模式一：Web 浏览器                                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  浏览器 (Chrome/Edge/Firefox)                                       │    │
│  │  └─ React + TypeScript + vtable + ECharts                          │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                          ↕ HTTP/WS (localhost:5173)                         │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  模式二：Electron 桌面应用                                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Electron 主进程                                                     │    │
│  │  ├─ WindowManager (多窗口管理)                                       │    │
│  │  ├─ TrayManager (系统托盘)                                           │    │
│  │  ├─ ShortcutManager (全局快捷键)                                     │    │
│  │  ├─ NotificationManager (原生通知)                                   │    │
│  │  ├─ BackendManager (后端进程管理)                                    │    │
│  │  └─ AutoUpdater (自动更新)                                           │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                          ↕ IPC                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Electron 渲染进程 (React 应用)                                       │    │
│  │  └─ 与 Web 模式共享同一套代码                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                          ↕ HTTP/WS                                          │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  共享后端服务                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Python 中间层 (FastAPI)                                             │    │
│  │  ├─ REST API (/api/*)                                               │    │
│  │  ├─ WebSocket (/ws/*)                                               │    │
│  │  └─ CTP 封装层 (ctp-python SWIG)                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                          ↕ CTP 协议                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  CTP DLL (行情/交易前置)                                              │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                          ↕                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  SimNow 柜台 (7×24 测试环境)                                         │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 数据流

```
行情数据流：CTP → Python → WebSocket → React → 表格/图表
报单数据流：React → REST API → Python → CTP → 回报 → WebSocket → React
查询数据流：React → REST API → Python → CTP → 缓存 → React
```

## 核心功能

- **行情模块**：实时行情表格、五档深度、K 线图（含技术指标）、期权 T 型报价
- **技术指标**：MA、BOLL、成交量、MACD、KDJ、RSI（主图/副图切换）
- **报单模块**：限价/市价/止损单、套利指令、点价报单、一键反向/锁仓
- **查询模块**：报单流水、成交、持仓、资金、合约信息
- **系统连接**：SimNow 登录、连接状态监控、断线重连
- **桌面应用**：Electron 桌面端、系统托盘、全局快捷键、原生通知、自动更新

## 技术亮点

### 1. 高性能行情渲染

- **vtable 虚拟滚动**：仅渲染可见行，支持 1000+ 合约无卡顿
- **WebSocket 实时推送**：行情数据通过 `/ws/market` 端点推送，延迟 ≤100ms
- **Zustand 状态管理**：轻量级 store + Map 结构，O(1) 快照更新

### 2. K 线图与技术指标

- **K 线聚合**：后端实时聚合 tick 数据为 OHLCV K 线，支持 1m/5m/15m/30m/1h/日线
- **技术指标**：主图（MA5/10/20、BOLL 布林带）、副图（成交量、MACD、KDJ、RSI）
- **指标切换**：下拉菜单切换主图/副图指标，不堆砌按钮，保持界面简洁
- **动态计算**：前端实时计算指标值，支持空数据和数据不足时的优雅降级（显示null）

### 3. CTP 协议封装

- **ctp-python SWIG 绑定**：封装 CTP 行情/交易 API，处理回调 SPI 设计
- **字段映射层**：CTP PascalCase → 前端 camelCase 自动转换（50+ 字段）
- **回调穿透**：组合模式 SPI 基类，支持事件日志 + 自定义 handler 注册

### 4. 交易指令合规性

对齐上期所交易规则，前后端双重校验：

| 指令类型 | 数量上限（期货） | 数量上限（期权） | 特殊规则 |
|----------|------------------|------------------|----------|
| 限价指令 | ≤500 手 | ≤100 手 | GFD/FOK/FAK 三种有效期 |
| 市价指令 | ≤60 手 | ≤30 手 | 必须填写保护价 |
| 止损单 | ≤500 手 | ≤100 手 | 支持限价/市价触发 |
| 套利指令 | ≤500 手 | — | CTP 原生套利合约（SP 格式） |

- **保护价校验**：市价指令必须填写保护价，在涨跌停板范围内，priceTick 整数倍对齐
- **后端权威校验**：Pydantic field_validator 兜底，防止前端绕过

### 5. Electron 桌面应用

基于 Electron 构建桌面应用，提供原生桌面体验：

- **多窗口管理**：主窗口、报单窗口、K 线窗口独立显示，支持拖拽和调整大小
- **系统托盘**：最小化到托盘，托盘菜单快速切换面板
- **全局快捷键**：`Ctrl+B` 快速报单、`Ctrl+K` 打开 K 线图、`Ctrl+Q` 退出
- **原生通知**：报单成交、止损触发、连接断开等事件通知
- **自动更新**：集成 electron-updater，支持检查更新、下载、安装
- **多平台打包**：支持 Windows（NSIS）、macOS（DMG）、Linux（AppImage）

### 6. 双窗口协作开发

项目采用角色 A（后端）/ 角色 B（前端）双窗口协作模式：

- **开发模式**：写代码、TDD 测试、提交
- **审查模式**：只读 diff、写审查反馈
- **TDD 驱动**：红（写测试）→ 绿（写实现）→ 重构 → 提交
- **9 步流程**：启动诊断 → 创建分支 → TDD 开发 → 自验证 → 代码审查 → 处理反馈 → 二次审查 → 人工验证 → 收尾合并

详细流程见 [开发流程指南](docs/tasks/task-dev-flow.md)。

## 快速开始

### 1. 后端配置

```bash
cd server
cp .env.sample .env          # 复制配置模板
# 编辑 .env，填入 SimNow 账号密码：
#   CTP_USER_ID=你的账号
#   CTP_PASSWORD=你的密码
```

`.env` 配置说明：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `CTP_BROKER_ID` | 经纪商代码（SimNow 固定） | `9999` |
| `CTP_USER_ID` | SimNow 账号 | 需填写 |
| `CTP_PASSWORD` | SimNow 密码 | 需填写 |
| `CTP_MD_FRONT` | 行情前置地址 | 7×24 测试环境 |
| `CTP_TD_FRONT` | 交易前置地址 | 7×24 测试环境 |

> 账号注册：https://www.simnow.com.cn

### 2. 安装依赖

```bash
# 后端（Python 依赖，在 server/ 目录下）
cd server
pip install -r requirements.txt

# 前端（Node.js 依赖，在 frontend/ 目录下）
cd frontend
npm install
```

### 3. 启动服务

#### 方式一：Web 浏览器模式

```bash
# 启动后端（在 server/ 目录下）
cd server
python start.py              # 自动选择 CTP 地址（交易时段/7×24）
python start.py --reload     # 开发模式（代码变更自动重启）
python start.py --port 8001  # 指定端口

# 启动前端（在 frontend/ 目录下，另开一个终端）
cd frontend
npm run dev                  # 开发服务器 → http://localhost:5173
```

#### 方式二：Electron 桌面应用模式

```bash
# 启动 Electron 应用（自动启动后端）
cd frontend
npm run electron:dev         # 开发模式（支持热重载）

# 打包生产版本
npm run electron:build       # 打包当前平台
npm run electron:build -- --win    # 打包 Windows
npm run electron:build -- --mac    # 打包 macOS
npm run electron:build -- --linux  # 打包 Linux
```

`start.py` 会根据当前时间自动选择 CTP 地址：
- 工作日 09:00-16:00 → 真实交易时段地址（`tcp://182.254.243.31:30011/30001`）
- 其他时间 → 7×24 测试环境地址（`tcp://182.254.243.31:40011/40001`）

### 4. 运行测试

```bash
# 后端测试（108 个单元测试）
cd server && python -m pytest tests/ -v

# 前端测试（469 个单元测试）
cd frontend && npm test
```

## 项目结构

```
keti/
├── docs/                     # 项目文档
│   ├── specs/                # 需求与设计（prd/design/dev/trading-instructions/ctp-*/）
│   ├── tasks/                # 任务与流程（task/task-dev-flow/修复记录）
│   ├── reviews/              # 审查报告（compliance-review/testing-guide/check*）
│   └── dev-records/          # 开发记录（role-a/role-b 双窗口协作快照）
├── examples/                 # CTP 示例脚本
│   ├── ctp_connection_demo.py    # CTP 连接验证
│   ├── field_structure_demo.py   # CTP 字段结构探测
│   └── realtime_market_demo.py   # 实时行情显示
├── frontend/                 # 前端代码
│   ├── src/
│   │   ├── modules/          # 业务模块（market/order/query/options）
│   │   │   └── market/       # 行情模块（KLineChart/indicators/MarketTable）
│   │   ├── components/       # 通用组件（ContractSearch/Toast/...）
│   │   ├── services/         # API 层 + 类型定义
│   │   ├── stores/           # Zustand 状态管理
│   │   ├── hooks/            # 自定义 Hooks（useMarketWs/useReconnect/...）
│   │   ├── pages/            # 独立页面（OrderPage/KLinePage，用于 Electron 窗口）
│   │   └── utils/            # 工具函数（validators/orderMapping）
│   ├── electron/             # Electron 主进程代码
│   │   ├── main.ts           # 主进程入口
│   │   ├── preload.ts        # 预加载脚本（IPC 桥接）
│   │   ├── windowManager.ts  # 窗口管理器
│   │   ├── trayManager.ts    # 系统托盘管理器
│   │   ├── shortcuts.ts      # 全局快捷键管理器
│   │   ├── notificationManager.ts  # 通知管理器
│   │   ├── backendManager.ts # 后端进程管理器
│   │   ├── autoUpdater.ts    # 自动更新管理器
│   │   └── ipc/              # IPC 通道定义和处理器
│   ├── scripts/              # 构建脚本
│   │   ├── compile-electron.cjs  # Electron 编译脚本
│   │   ├── build-electron.cjs    # 多平台打包脚本
│   │   └── generate-icons.cjs    # 图标生成脚本
│   ├── build/                # 打包资源（图标文件）
│   ├── electron-builder.json # Electron 打包配置
│   └── package.json
├── server/                   # 后端代码
│   ├── api/                  # REST API 路由（connection/market/order/query）
│   ├── services/             # 业务服务（order_manager/stop_order/market_service/kline_service）
│   ├── ctp_wrapper/          # CTP API 封装层（md_user_api/trader_api/callback/types）
│   ├── models/               # 数据模型（market/order/account/contract）
│   ├── ws/                   # WebSocket 管理（manager/handlers）
│   ├── config.py             # 配置管理（环境变量读取）
│   ├── main.py               # FastAPI 应用入口
│   ├── start.py              # 智能启动脚本（自动选择 CTP 地址）
│   ├── pyinstaller.spec      # PyInstaller 打包配置
│   └── tests/                # 108 个单元测试（pytest）
├── scripts/                  # 项目脚本
│   ├── prepare-electron.sh   # Electron 环境检查脚本
│   └── build-backend.py      # 后端打包脚本
├── .claude/                  # Claude Code 配置
│   └── skills/               # 自定义技能（双窗口协作开发流程）
│       ├── role-a-dev-flow/  # 角色A（后端）开发流程
│       ├── role-b-dev-flow/  # 角色B（前端）开发流程
│       ├── simnow-bug-fix/   # Bug 修复流程
│       └── simnow-consistency-check/  # 一致性检查流程
└── .ua/                      # Understand Anything 知识图谱
    ├── knowledge-graph.json  # 代码实体关系图谱
    ├── domain-graph.json     # 业务领域知识图谱
    └── config.json           # UA 配置
```

## Claude Code 技能链

项目使用 Claude Code 自定义技能实现标准化开发流程：

| 技能 | 用途 | 触发方式 |
|------|------|----------|
| `role-a-dev-flow` | 角色A（后端）完整开发流程 | 9 步：诊断→TDD→自验证→审查→合并 |
| `role-b-dev-flow` | 角色B（前端）完整开发流程 | 同上，针对 frontend/ 目录 |
| `simnow-bug-fix` | Bug 修复流程 | 根因分析→TDD 修复→验证 |
| `simnow-consistency-check` | 前后端一致性检查 | 自动扫描类型/字段/API 不一致 |

技能文件位于 `.claude/skills/`，通过 Claude Code 的 `/skill-name` 命令触发。

## Understand Anything 知识图谱

项目使用 [Understand Anything (UA)](https://github.com/Egonex-AI/Understand-Anything) Claude Code 插件维护代码和业务知识图谱。UA 会自动分析项目代码，生成实体关系图谱，帮助 Claude Code 理解项目结构和业务逻辑。

### 安装

UA 是 Claude Code 插件，通过 Claude Code 插件市场安装：

```bash
# 在 Claude Code 中运行
/plugin marketplace add Egonex-AI/Understand-Anything
/plugin install understand-anything
```

### 知识图谱文件

| 文件 | 内容 |
|------|------|
| `knowledge-graph.json` | 代码实体（函数/类/模块）之间的调用和依赖关系 |
| `domain-graph.json` | 业务领域概念（合约/报单/持仓/行情）之间的关系 |
| `config.json` | UA 配置（自动更新、输出语言） |
| `fingerprints.json` | 文件指纹（增量更新用） |
| `.understandignore` | 忽略规则（排除 node_modules、__pycache__ 等） |

### 使用方式

UA 提供以下指令：

| 指令 | 用途 |
|------|------|
| `/understand` | 分析项目代码，生成/更新知识图谱 |
| `/understand-chat` | 基于知识图谱进行对话，回答项目相关问题 |
| `/understand-onboard` | 新人引导，生成项目概览和上手指南 |


### 克隆项目后快速上手

```bash
# 1. 克隆项目
git clone <repo-url> && cd keti

# 2. 安装 Claude Code 插件
/plugin install understand-anything

# 3. 生成知识图谱（增量更新）
/understand

# 4. 提取业务领域知识（领域、流程、步骤）
/understand-domain

# 4. 打开UA面板
/understand-onboard

# 5. 询问任意代码库的问题
/understand-chat How does the payment flow work?
```

## Electron 桌面应用

### 功能特性

| 功能 | 说明 |
|------|------|
| **多窗口** | 主窗口、报单窗口、K 线窗口独立显示 |
| **系统托盘** | 最小化到托盘，托盘菜单快速切换 |
| **全局快捷键** | `Ctrl+B` 报单、`Ctrl+K` K 线、`Ctrl+Q` 退出 |
| **原生通知** | 报单成交、止损触发、连接断开通知 |
| **自动更新** | electron-updater 检查更新、下载、安装 |
| **多平台** | Windows/macOS/Linux 三平台打包 |

### 快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+B` | 快速报单 |
| `Ctrl+K` | 打开 K 线图 |
| `Ctrl+Q` | 退出应用 |
| `Ctrl+Shift+M` | 切换性能监控 |

### 系统托盘

- **点击托盘图标**：显示/隐藏主窗口
- **右键菜单**：行情面板、报单面板、查询面板、设置、退出
- **关闭窗口**：最小化到托盘（不退出应用）

### 打包命令

```bash
cd frontend

# 生成占位图标（首次运行）
npm run generate-icons

# 打包当前平台
npm run electron:build

# 打包指定平台
npm run electron:build -- --win     # Windows (NSIS)
npm run electron:build -- --mac     # macOS (DMG)
npm run electron:build -- --linux   # Linux (AppImage)
```

打包产物在 `frontend/release/` 目录。

## 文档

- [产品需求文档](docs/specs/prd.md) — 功能需求、非目标、用户画像
- [技术架构设计](docs/specs/design.md) — 接口设计、数据模型、WebSocket 端点
- [项目设计稿](docs/specs/dev.md) — 代码结构、技术规范、CTP 连接流程
- [任务拆分](docs/tasks/task.md) — 21 个 PR，5 个阶段
- [Electron 迁移任务](docs/tasks/task-electron-migration.md) — 10 个 PR，桌面应用迁移
- [一致性检查修复](docs/tasks/consistency-check-records.md) — 13 个 PR，前后端类型对齐
- [交易指令合规性修复](docs/tasks/compliance-fix-records.md) — 保护价/数量上限/套利指令
- [交易指令合规审查](docs/reviews/compliance-review.md) — 11 个合规性问题清单
- [测试说明报告](docs/reviews/testing-guide.md) — 零基础使用测试说明

## 技术指标说明

项目实现了常用的技术分析指标，用于 K 线图分析：

### 主图指标

| 指标 | 说明 | 参数 |
|------|------|------|
| MA | 移动平均线 | MA5（黄）、MA10（蓝）、MA20（粉） |
| BOLL | 布林带 | 20日均线 ± 2倍标准差（上轨/中轨/下轨） |

### 副图指标

| 指标 | 说明 | 参数 |
|------|------|------|
| 成交量 | 柱状图 + VOL-MA5 均线 | 红涨绿跌 |
| MACD | 指数平滑异同移动平均线 | DIF/DEA 线 + MACD 柱 |
| KDJ | 随机指标 | 9日RSV，K/D/J 三线 |
| RSI | 相对强弱指数 | 14日 Wilder 指数平滑 |

### 实现细节

- **计算位置**：前端 `frontend/src/modules/market/indicators.ts`
- **数据要求**：MA5 需 5 个点，KDJ 需 9 个点，RSI 需 15 个点，BOLL/MACD 需 20/26 个点
- **数据来源**：后端 `kline_service.py` 实时聚合 CTP tick 数据，无历史数据接口
- **测试覆盖**：`indicators.test.ts` 包含 12 个单元测试，覆盖空数据/不足/正常场景

## 注意事项

- 用户偏好使用 localStorage 持久化；业务数据不落库，仅内存展示
- 止损单由后端监控服务实现，复用行情订阅数据流，持久化到本地文件
- GFD 报单依赖 SimNow 柜台收盘自动撤销
- 项目依赖 `docs/specs/ctp-api-structure.txt` 做前后端类型对齐
- K 线数据由后端 `kline_service` 实时聚合 tick 数据生成，无历史数据接口
- CTP 的 `highestPrice`/`lowestPrice` 是当日最高最低价，非周期内值，前端需动态计算
- Electron 桌面应用会自动检测并连接已有后端，避免重复启动
- 托盘图标文件（`build/icon.png`、`icon.ico`、`icon.icns`）需替换为实际图标

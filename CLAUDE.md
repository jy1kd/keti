# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

上期所 SimNow 模拟交易终端 — 浏览器 Web 应用，对接 SimNow 7×24 测试环境，实现行情接入、交易接入、手动报单等功能。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 | UI 框架、构建 |
| 表格 | @visactor/vtable | 高性能虚拟滚动，支持 1000+ 合约 |
| 图表 | ECharts 5 | K 线图、技术指标 |
| 状态管理 | Zustand | 轻量级状态管理，localStorage 持久化 |
| 后端 | Python FastAPI 0.100+ + websockets 11.x | REST API、WebSocket |
| CTP 绑定 | ctp-python 6.7.7.post1 | Python CTP 封装 |

## 项目结构

```
keti/
├── docs/                     # 项目文档
│   ├── specs/                # 需求与设计（prd/design/dev/trading-instructions/ctp-*/）
│   ├── tasks/                # 任务与流程（task/task-dev-flow/修复记录）
│   ├── reviews/              # 审查报告（compliance-review/testing-guide/check*）
│   └── dev-records/          # 开发记录（role-a/role-b 双窗口协作快照）
├── frontend/                 # 前端代码
│   ├── src/
│   │   ├── modules/          # 业务模块（market/order/query/options）
│   │   │   └── market/       # 行情模块（KLineChart/indicators/MarketTable）
│   │   ├── components/       # 通用组件（ContractSearch/Toast/...）
│   │   ├── services/         # API 层 + 类型定义
│   │   ├── stores/           # Zustand 状态管理
│   │   └── utils/            # 工具函数（validators/orderMapping）
│   └── package.json
├── server/                   # 后端代码
│   ├── api/                  # REST API 路由（connection/market/order/query）
│   ├── services/             # 业务服务（order_manager/stop_order/market_service/kline_service）
│   ├── ctp_wrapper/          # CTP API 封装层（md_user_api/trader_api/callback/types）
│   ├── config.py             # 配置管理（环境变量读取）
│   ├── main.py               # CTP 验证脚本
│   └── tests/                # 108 个单元测试（pytest）
└── .claude/                  # Claude Code 配置
    └── skills/               # 自定义技能（双窗口协作开发流程）
```

## 常用命令

### 后端

```bash
# 安装依赖
cd server && pip install -r requirements.txt

# 运行测试（108 个单元测试）
cd server && python -m pytest tests/ -v

# 运行单个测试文件
python -m pytest tests/test_config.py -v

# 启动后端服务
cd server && python start.py              # 自动选择 CTP 地址
python start.py --reload     # 开发模式（代码变更自动重启）
python start.py --port 8001  # 指定端口

# CTP 连接验证（需交易时段 09:00-15:00 / 21:00-02:30）
python server/main.py

# 字段结构探测（无需连接，直接反射 CTP 字段定义）
python examples/field_structure_demo.py
```

### 前端

```bash
# 安装依赖
cd frontend && npm install

# 运行测试（469 个单元测试）
cd frontend && npm test

# 启动开发服务器
cd frontend && npm run dev                  # → http://localhost:5173

# 构建
cd frontend && npm run build
```

## 架构关键点

### CTP 协议封装

- **ctp-python SWIG 绑定**：封装 CTP 行情/交易 API，处理回调 SPI 设计
- **字段映射层**：CTP PascalCase → 前端 camelCase 自动转换（50+ 字段）
- **回调穿透**：组合模式 SPI 基类，支持事件日志 + 自定义 handler 注册

### 状态管理

- **Zustand stores**：连接状态、行情数据、交易状态分离管理
- **持久化**：用户偏好 localStorage 持久化；业务数据不落库，仅内存展示

### REST API 路由（`server/api/`）

- `/api/connection` — 登录、登出、状态
- `/api/market` — 合约列表、订阅、快照、K 线、五档深度、期权链、波动率
- `/api/order` — 报单、撤单、批量撤单、一键反向/锁仓、止损单
- `/api/query` — 报单流水、成交、持仓、资金、合约

### WebSocket 端点

- `/ws/market` — 行情数据推送
- `/ws/order` — 报单回报、成交回报
- `/ws/position` — 持仓更新
- `/ws/stop` — 止损单更新
- `/ws/system` — 连接状态、错误

## ⚠️ 关键陷阱

### SubscribeMarketData 必须传字符串列表

```python
# ✅ 正确
api.SubscribeMarketData(["IF2608"])

# ❌ 崩溃！（堆损坏 0xC0000374）
api.SubscribeMarketData([b"IF2608"])
```

ctp-python 的 SWIG 绑定处理 bytes 时内存越界。所有 Subscribe/Unsubscribe 方法都受影响。

### CTP 字段参考

项目依赖 `docs/specs/ctp-api-structure.txt` 做前后端类型对齐。修改 CTP 字段时需同步更新。

### K 线数据

- 后端 `kline_service` 实时聚合 tick 数据生成，无历史数据接口
- CTP 的 `highestPrice`/`lowestPrice` 是当日最高最低价，非周期内值，前端需动态计算

## 双窗口协作开发

项目采用角色 A（后端）/ 角色 B（前端）双窗口协作模式：

- **开发模式**：写代码、TDD 测试、提交
- **审查模式**：只读 diff、写审查反馈
- **TDD 驱动**：红（写测试）→ 绿（写实现）→ 重构 → 提交
- **9 步流程**：启动诊断 → 创建分支 → TDD 开发 → 自验证 → 代码审查 → 处理反馈 → 二次审查 → 人工验证 → 收尾合并

详细流程见 [开发流程指南](docs/tasks/task-dev-flow.md)。

## 技术指标

### 主图指标
- MA：移动平均线（MA5/MA10/MA20）
- BOLL：布林带（20日均线 ± 2倍标准差）

### 副图指标
- 成交量：柱状图 + VOL-MA5 均线
- MACD：指数平滑异同移动平均线
- KDJ：随机指标（9日RSV）
- RSI：相对强弱指数（14日 Wilder 指数平滑）

计算位置：`frontend/src/modules/market/indicators.ts`

## 交易指令合规性

对齐上期所交易规则，前后端双重校验：

| 指令类型 | 数量上限（期货） | 数量上限（期权） | 特殊规则 |
|----------|------------------|------------------|----------|
| 限价指令 | ≤500 手 | ≤100 手 | GFD/FOK/FAK 三种有效期 |
| 市价指令 | ≤60 手 | ≤30 手 | 必须填写保护价 |
| 止损单 | ≤500 手 | ≤100 手 | 支持限价/市价触发 |
| 套利指令 | ≤500 手 | — | CTP 原生套利合约（SP 格式） |

- **保护价校验**：市价指令必须填写保护价，在涨跌停板范围内，priceTick 整数倍对齐
- **后端权威校验**：Pydantic field_validator 兜底，防止前端绕过

## 文档索引

- [产品需求文档](docs/specs/prd.md) — 功能需求、非目标、用户画像
- [技术架构设计](docs/specs/design.md) — 接口设计、数据模型、WebSocket 端点
- [项目设计稿](docs/specs/dev.md) — 代码结构、技术规范、CTP 连接流程
- [交易指令规范](docs/specs/trading-instructions.md) — 合规性要求
- [任务拆分](docs/tasks/task.md) — 21 个 PR，5 个阶段
- [一致性检查修复](docs/tasks/consistency-check-records.md) — 13 个 PR，前后端类型对齐
- [交易指令合规性修复](docs/tasks/compliance-fix-records.md) — 保护价/数量上限/套利指令

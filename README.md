# 上期所 SimNow 模拟交易终端

基于 CTP 协议的期货期权模拟交易终端，浏览器 Web 应用，对接 SimNow 7×24 测试环境，实现行情接入、交易接入、手动报单等完整功能。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 | UI 框架、构建 |
| 表格 | @visactor/vtable | 高性能虚拟滚动，支持 1000+ 合约 |
| 图表 | ECharts 5 | K 线图、技术指标 |
| 状态管理 | Zustand | 轻量级状态管理，localStorage 持久化 |
| 后端 | Python FastAPI 0.100+ + websockets 11.x | REST API、WebSocket |
| CTP 绑定 | ctp-python 6.7.7.post1 | Python CTP 封装 |

## 架构

```
前端 (React + TypeScript + vtable)
    ↕ WebSocket (行情推送/报单回报) + REST API
Python 中间层 (FastAPI)
    ↕ ctp-python SWIG 绑定
CTP DLL (行情/交易前置)
    ↕
SimNow 柜台 (7×24 测试环境)
```

## 核心功能

- **行情模块**：实时行情表格、五档深度、K 线图、期权 T 型报价
- **报单模块**：限价/市价/止损单、套利指令、点价报单、一键反向/锁仓
- **查询模块**：报单流水、成交、持仓、资金、合约信息
- **系统连接**：SimNow 登录、连接状态监控、断线重连

## 技术亮点

### 1. 高性能行情渲染

- **vtable 虚拟滚动**：仅渲染可见行，支持 1000+ 合约无卡顿
- **WebSocket 实时推送**：行情数据通过 `/ws/market` 端点推送，延迟 ≤100ms
- **Zustand 状态管理**：轻量级 store + Map 结构，O(1) 快照更新

### 2. CTP 协议封装

- **ctp-python SWIG 绑定**：封装 CTP 行情/交易 API，处理回调 SPI 设计
- **字段映射层**：CTP PascalCase → 前端 camelCase 自动转换（50+ 字段）
- **回调穿透**：组合模式 SPI 基类，支持事件日志 + 自定义 handler 注册

### 3. 交易指令合规性

对齐上期所交易规则，前后端双重校验：

| 指令类型 | 数量上限（期货） | 数量上限（期权） | 特殊规则 |
|----------|------------------|------------------|----------|
| 限价指令 | ≤500 手 | ≤100 手 | GFD/FOK/FAK 三种有效期 |
| 市价指令 | ≤60 手 | ≤30 手 | 必须填写保护价 |
| 止损单 | ≤500 手 | ≤100 手 | 支持限价/市价触发 |
| 套利指令 | ≤500 手 | — | CTP 原生套利合约（SP 格式） |

- **保护价校验**：市价指令必须填写保护价，在涨跌停板范围内，priceTick 整数倍对齐
- **后端权威校验**：Pydantic field_validator 兜底，防止前端绕过

### 4. 双窗口协作开发

项目采用角色 A（后端）/ 角色 B（前端）双窗口协作模式：

- **开发模式**：写代码、TDD 测试、提交
- **审查模式**：只读 diff、写审查反馈
- **TDD 驱动**：红（写测试）→ 绿（写实现）→ 重构 → 提交
- **9 步流程**：启动诊断 → 创建分支 → TDD 开发 → 自验证 → 代码审查 → 处理反馈 → 二次审查 → 人工验证 → 收尾合并

详细流程见 [开发流程指南](docs/tasks/task-dev-flow.md)。

## 快速开始

### 后端

```bash
cd server
pip install -r requirements.txt
cp .env.sample .env          # 填入 SimNow 账号密码
python -m pytest tests/ -v   # 运行测试（108 个单元测试）
python main.py               # CTP 连接验证（需交易时段 09:00-15:00 / 21:00-02:30）
```

### 前端

```bash
cd frontend
npm install
npm run dev       # 开发服务器 → http://localhost:5173
npm run build     # 生产构建
npm run lint      # ESLint 检查
```

### SimNow 7×24 测试环境

| 项目 | 地址 |
|------|------|
| 行情前置 | `tcp://182.254.243.31:40011` |
| 交易前置 | `tcp://182.254.243.31:40001` |
| BrokerID | `9999` |

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
│   │   ├── components/       # 通用组件（ContractSearch/Toast/...）
│   │   ├── services/         # API 层 + 类型定义
│   │   ├── stores/           # Zustand 状态管理
│   │   └── utils/            # 工具函数（validators/orderMapping）
│   └── package.json
├── server/                   # 后端代码
│   ├── api/                  # REST API 路由（connection/market/order/query）
│   ├── services/             # 业务服务（order_manager/stop_order/market_service）
│   ├── ctp_wrapper/          # CTP API 封装层（md_user_api/trader_api/callback/types）
│   ├── config.py             # 配置管理（环境变量读取）
│   ├── main.py               # CTP 验证脚本
│   └── tests/                # 108 个单元测试（pytest）
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

项目使用 Understand Anything (UA) 工具维护代码和业务知识图谱：

| 文件 | 内容 |
|------|------|
| `knowledge-graph.json` | 代码实体（函数/类/模块）之间的调用和依赖关系 |
| `domain-graph.json` | 业务领域概念（合约/报单/持仓/行情）之间的关系 |

知识图谱帮助 AI 工具理解项目结构和业务逻辑，提升代码生成和审查的准确性。

## 文档

- [产品需求文档](docs/specs/prd.md) — 功能需求、非目标、用户画像
- [技术架构设计](docs/specs/design.md) — 接口设计、数据模型、WebSocket 端点
- [项目设计稿](docs/specs/dev.md) — 代码结构、技术规范、CTP 连接流程
- [任务拆分](docs/tasks/task.md) — 21 个 PR，5 个阶段
- [一致性检查修复](docs/tasks/consistency-check-records.md) — 13 个 PR，前后端类型对齐
- [交易指令合规性修复](docs/tasks/compliance-fix-records.md) — 保护价/数量上限/套利指令
- [交易指令合规审查](docs/reviews/compliance-review.md) — 11 个合规性问题清单
- [测试说明报告](docs/reviews/testing-guide.md) — 零基础使用测试说明

## 注意事项

- 用户偏好使用 localStorage 持久化；业务数据不落库，仅内存展示
- 止损单由后端监控服务实现，复用行情订阅数据流，持久化到本地文件
- GFD 报单依赖 SimNow 柜台收盘自动撤销
- 项目依赖 `docs/specs/ctp-api-structure.txt` 做前后端类型对齐

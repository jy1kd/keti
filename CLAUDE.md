# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

上期所Simnow模拟交易终端 — 浏览器Web应用，对接simnow模拟柜台，实现行情接入、交易接入、手动报单等功能。

## 技术栈

| 层级 | 技术 | 用途 |
|------|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 | UI框架、构建 |
| 表格 | @visactor/vtable | 高性能虚拟滚动，支持1000+合约 |
| 图表 | ECharts 5 | K线图、技术指标 |
| 状态管理 | Zustand | 轻量级状态管理，localStorage持久化 |
| 后端 | Python FastAPI 0.100+ + websockets 11.x | REST API、WebSocket |
| CTP绑定 | ctp-python (`pip install ctp-python`) | Python CTP封装（SWIG封装，开箱即用） |

## 项目结构

```
keti/
├── docs/                   # 项目文档
│   ├── prd.md              # 产品需求文档（功能需求、验收标准）
│   ├── design.md           # 技术架构设计（系统架构、接口、数据模型）
│   ├── dev.md              # 项目设计稿（代码结构、技术规范）
│   ├── task.md             # PR任务拆分（17个PR，5个阶段）
│   └── task-dev-flow.md    # 开发流程指南（流程图、角色分工、提交规范）
├── snapshots/              # PR完成记录
│   ├── role-a/progress.md  # 角色A（后端）PR完成状态
│   └── role-b/progress.md  # 角色B（前端）PR完成状态
├── frontend/               # 前端代码（角色B负责）
├── server/                 # 后端代码（角色A负责）
├── trader/                 # simnow API文件（.gitignore）
├── templates/              # 文档模板（.gitignore）
├── ai-log.md               # AI协作记录（.gitignore）
├── mis.md                  # 项目开发流程规范（.gitignore）
└── README.md               # 项目说明
```

## 开发流程

文档编写顺序（已完成）：
1. prd.md → 2. design.md → 3. dev.md → 4. task.md → 5. 任务实现

**当前阶段**：阶段1 - 基础框架（PR-1 ~ PR-4 待开始）

详细流程见 `docs/task-dev-flow.md`，包含：
- 开发流程图（并行关系、依赖关系、角色标注）
- 提交时机规范
- 分支合并顺序
- 角色A/B任务清单
- 交接规范

## 常用命令

### 后端（server/）

```bash
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install ctp-python fastapi uvicorn websockets
uvicorn main:app --reload --port 8000
```

### 前端（frontend/）

```bash
cd frontend
pnpm install
pnpm dev          # 开发服务器
pnpm build        # 构建
pnpm lint         # ESLint检查
```

## 角色分工

| 角色 | 职责 | 目录 |
|------|------|------|
| **角色A** | 后端开发、API接口、CTP对接、系统架构 | server/ |
| **角色B** | 前端开发、UI组件、交互逻辑、性能优化 | frontend/ |

## Git分支策略

- 分支命名：`feature/pr-{编号}-{简短描述}`
- 示例：`feature/pr-1-ctp-verify`
- 合并顺序：按PR编号，依赖关系满足后合并

## 核心模块

### F1: 行情模块
- 实时行情表格（vtable，虚拟滚动、增量渲染）
- 五档行情展示
- K线图（多周期、技术指标）
- 期权T型报价（含波动率）

### F2: 报单模块
- 报单类型：限价、市价、止损、FOK、FAK、GFD
- 点价报单：单击/双击行情表格直接报单
- 快捷操作：一键反向、一键锁仓、点击持仓平仓
- 快捷键：B=买，S=卖，C=撤单（仅报单面板焦点时生效）

### F3: 查询模块
- 报单流水、成交流水、持仓、资金、报价（五档深度）、合约查询

## API设计

详见 `docs/design.md`，主要接口：

- 行情：`/api/market/*`（instruments, subscribe, snapshots, kline, depth）
- 报单：`/api/order/*`（insert, cancel, cancel_all, reverse, lock, stop）
- 查询：`/api/query/*`（orders, trades, positions, quotes）

## WebSocket设计

5个独立端点，按消息类型分流：
- `ws/market` — 行情推送
- `ws/order` — 报单回报、成交回报
- `ws/position` — 持仓更新
- `ws/stop` — 止损单状态
- `ws/system` — 连接状态、错误消息

## 性能要求

- 行情推送延迟：≤100ms
- 表格渲染FPS：≥60
- 支持合约数量：1000+

## 注意事项

- 用户偏好（自选合约、快捷键配置）使用localStorage持久化
- 业务数据（行情、报单、成交）不落库，仅内存展示
- 止损单由后端监控服务实现，复用行情订阅数据流
- GFD报单依赖simnow柜台收盘自动撤销
- CTP绑定使用ctp-python库（SWIG封装），无需手动调用DLL

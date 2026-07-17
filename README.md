# 上期所 SimNow 模拟交易终端

浏览器 Web 应用，对接 SimNow 模拟柜台，实现行情接入、交易接入、手动报单等功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| 表格 | @visactor/vtable（虚拟滚动，支持 1000+ 合约） |
| 图表 | ECharts 5（K 线、技术指标） |
| 状态管理 | Zustand + localStorage 持久化 |
| 后端 | Python FastAPI 0.100+ + websockets 11.x |
| CTP 绑定 | ctp-python 6.7.7.post1 |

## 快速开始

### 后端

```bash
cd server
pip install -r requirements.txt
cp .env.sample .env          # 填入 SimNow 账号密码
python -m pytest tests/ -v   # 运行测试
python main.py               # CTP 连接验证（需交易时段）
```

### 前端

```bash
cd frontend
npm install
npm run dev       # 开发服务器 → http://localhost:5173
npm run build     # 生产构建
```

### 首次配置

```bash
# 启用 Git hooks（知识图谱自动更新）
git config core.hooksPath .githooks
```

## 项目结构

```
keti/
├── docs/                     # 项目文档（PRD、设计、任务拆分）
├── snapshots/                # 双窗口协作快照
│   ├── role-a/               # 后端（角色A）
│   └── role-b/               # 前端（角色B）
├── frontend/                 # 前端代码
├── server/                   # 后端代码
│   ├── ctp_wrapper/          # CTP API 封装层
│   ├── config.py             # 配置管理
│   ├── main.py               # CTP 验证脚本
│   └── tests/                # 单元测试
├── md_demo.py                # CTP 字段结构探测
└── ctp_realtime_demo.py      # 实时行情显示
```

## 文档

- [产品需求文档](docs/prd.md)
- [技术架构设计](docs/design.md)
- [项目设计稿](docs/dev.md)
- [任务拆分](docs/task.md)（17 个 PR，5 个阶段）
- [开发流程指南](docs/task-dev-flow.md)

## 核心功能

- **行情模块**：实时行情表格、五档深度、K 线图、期权 T 型报价
- **报单模块**：限价/市价/止损单、点价报单、一键反向/锁仓
- **查询模块**：报单流水、成交、持仓、资金、合约信息
- **系统连接**：SimNow 登录、连接状态监控、断线重连

## 架构

```
前端 (React + TS + vtable)
    ↕ WebSocket / REST
Python 中间层 (FastAPI)
    ↕ CTP DLL
SimNow 柜台
```

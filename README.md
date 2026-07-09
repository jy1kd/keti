# 上期所Simnow模拟交易终端

简易桌面交易终端（浏览器Web应用），对接上期所simnow模拟柜台，实现行情接入、交易接入、手动报单等核心功能。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 |
| 表格 | @visactor/vtable（高性能虚拟滚动） |
| 图表 | ECharts 5（K线图、技术指标） |
| 状态管理 | Zustand |
| 后端 | Python FastAPI + WebSocket |
| CTP绑定 | SWIG（自动生成C++ DLL的Python绑定） |
| 对接平台 | simnow模拟柜台（mduserapi + traderapi v6.7.13） |

## 文档索引

| 文档 | 说明 |
|------|------|
| [prd.md](./prd.md) | 产品需求文档（功能需求、验收标准、里程碑） |
| [design.md](./design.md) | 技术架构设计（系统架构、接口设计、数据模型、环境搭建） |

## 开发状态

- **当前阶段**：规划完成，待进入技术Spike
- **下一步**：SWIG绑定技术验证（DLL加载、登录、行情回调、报单回调）

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+
- pnpm（前端包管理）
- SWIG（CTP绑定生成）

### 安装与运行

```bash
# 后端
cd server
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install ctp-python fastapi uvicorn websockets
uvicorn main:app --reload --port 8000

# 前端
cd frontend
npm install
npm run dev
```

### simnow环境配置

```bash
# .env 文件
SIMNOW_BROKER_ID=9999
SIMNOW_USER_ID=your_user_id
SIMNOW_PASSWORD=your_password
SIMNOW_MD_FRONT=tcp://180.168.146.187:10131
SIMNOW_TD_FRONT=tcp://180.168.146.187:10130
```

## 核心功能

- **行情模块**：实时行情表格（1000+合约）、五档深度、K线图、期权T型报价
- **报单模块**：限价/市价/止损/FOK/FAK/GFD、点价报单、快捷键、一键反向/锁仓
- **查询模块**：报单流水、成交流水、持仓、资金、报价深度、合约信息
- **系统连接**：simnow登录、连接状态监控、断线重连

## 架构概览

```
前端 (React+TS+vtable) ←→ Python中间层 (FastAPI+WebSocket) ←→ simnow柜台 (CTP DLL)
```

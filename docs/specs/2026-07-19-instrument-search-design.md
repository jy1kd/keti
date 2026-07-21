# 合约搜索与订阅功能设计

> **日期**: 2026-07-19
> **状态**: 待实现
> **作者**: 角色A

## 概述

仿照无限易的合约管理方案，实现"预设合约 + 用户自定义订阅 + 全局合约搜索"的功能。解决当前 `instruments.json` 17,742 条合约无法全部显示的问题。

## 核心设计

### 数据流

```
instruments.json（后端内存缓存，~20MB）
  ├─ GET /api/market/instruments/exchanges → 交易所列表（6个）
  ├─ GET /api/market/instruments/products?exchange=X → 品种列表（~50-200个）
  └─ GET /api/market/instruments/search?exchange=X&product=Y → 合约列表（~10-50个）

preset_instruments.json（后端配置文件）
  └─ GET /api/market/preset → 预设合约列表（~50-80个主力合约）

localStorage（前端持久化）
  └─ 用户自定义订阅的合约列表

前端 MarketTable
  └─ 展示：预设合约 ∪ 用户订阅合约（合并去重）
```

### 架构分层

```
┌─────────────────────────────────────────────────┐
│  MarketPanel（行情面板）                          │
│  ┌───────────────────────────────────────────┐  │
│  │  工具栏: [搜索合约] [退订]                  │  │
│  ├───────────────────────────────────────────┤  │
│  │  MarketTable（已订阅合约的行情表格）          │  │
│  │  - 预设合约 + 用户订阅合约                   │  │
│  │  - 右键/按钮 → 退订                         │  │
│  └───────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
         │ 点击[搜索合约]
         ▼
┌─────────────────────────────────────────────────┐
│  InstrumentSearchModal（模态框）                  │
│  ┌─────────────┬─────────────┬──────────────┐  │
│  │ 交易所 ▼    │ 品种 ▼      │ [搜索关键词]  │  │
│  ├─────────────┴─────────────┴──────────────┤  │
│  │  合约列表                                 │  │
│  │  合约ID | 名称 | 到期日 | 状态 | [订阅]   │  │
│  ├──────────────────────────────────────────┤  │
│  │  [刷新合约列表]              共 N 个合约   │  │
│  └──────────────────────────────────────────┘  │
└─────────────────────────────────────────────────┘
```

## 后端设计

### 新增端点（`server/api/market.py`）

#### 1. `GET /api/market/instruments/exchanges`

返回交易所列表（从 `_instruments` 中去重提取）。

**响应**:
```json
{ "exchanges": ["CFFEX", "SHFE", "CZCE", "DCE", "INE", "GFEX"] }
```

#### 2. `GET /api/market/instruments/products?exchange=X`

返回指定交易所下的品种列表。

**参数**: `exchange` (必填) — 交易所代码
**响应**:
```json
{ "products": ["IF", "IC", "IH", "IM", "T", "TF", "TS"] }
```

#### 3. `GET /api/market/instruments/search?exchange=X&product=Y&keyword?`

返回指定交易所+品种下的合约列表。

**参数**:
- `exchange` (必填) — 交易所代码
- `product` (必填) — 品种代码
- `keyword` (可选) — 模糊匹配 `instrumentID` 或 `instrumentName`

**响应**:
```json
{
  "instruments": [
    {
      "instrumentID": "IF2608",
      "instrumentName": "沪深300股指期货2608",
      "exchangeID": "CFFEX",
      "productID": "IF",
      "expireDate": "2026-08-21",
      "isTrading": 1,
      "volumeMultiple": 300,
      "priceTick": 0.2
    }
  ],
  "count": 3
}
```

#### 4. `GET /api/market/preset`

返回预设合约列表。

**响应**:
```json
{
  "instruments": ["IF2608", "IC2608", "au2608", "cu2608"],
  "updatedAt": "2026-07-19T15:30:00"
}
```

#### 5. `POST /api/market/preset/refresh`

自动检测主力合约并更新预设列表。

**逻辑**:
1. 遍历 `_instruments`，按 `productID` 分组
2. 每个品种筛选 `isTrading == 1` 的合约
3. 取 `expireDate` 最近的合约作为主力合约
4. 写入 `data/preset_instruments.json`
5. 通过 WebSocket 广播 `preset_updated` 事件

**响应**:
```json
{
  "added": ["IF2609", "au2609"],
  "removed": ["IF2608", "au2608"]
}
```

#### 6. `GET /api/market/instruments?ids=X,Y,Z`（扩展现有端点）

扩展现有 `GET /api/market/instruments` 端点，支持 `ids` 参数批量获取指定合约详情。用于前端启动时获取预设合约 + 用户订阅合约的详情。

**参数**: `ids` (可选) — 逗号分隔的合约ID列表
**响应**: 同现有格式

### MarketService 新增方法

```python
# server/services/market_service.py

def get_exchanges(self) -> List[str]:
    """返回去重的交易所列表。"""

def get_products(self, exchange: str) -> List[str]:
    """返回指定交易所下的品种列表。"""

def search_instruments(self, exchange: str, product: str, keyword: str = None) -> List[dict]:
    """按交易所+品种筛选合约，可选关键词过滤。"""

def get_preset_instruments(self) -> dict:
    """读取 preset_instruments.json，返回预设合约列表。"""

def refresh_preset_instruments(self) -> dict:
    """自动检测主力合约，更新 preset_instruments.json。"""

def get_instruments_by_ids(self, ids: List[str]) -> List[dict]:
    """按 ID 列表批量获取合约详情。"""
```

### 配置文件 `data/preset_instruments.json`

```json
{
  "instruments": ["IF2608", "IC2608", "IH2608", "IM2608", "au2608", "cu2608", "rb2608"],
  "updatedAt": "2026-07-19T15:30:00"
}
```

## 前端设计

### 新增组件 `InstrumentSearchModal`

**文件**: `src/components/InstrumentSearchModal/index.tsx`

**状态**:
- `exchanges: string[]` — 交易所列表
- `products: string[]` — 品种列表（联动筛选）
- `instruments: ContractInfo[]` — 合约列表（联动筛选）
- `selectedExchange: string` — 当前选中交易所
- `selectedProduct: string` — 当前选中品种
- `keyword: string` — 搜索关键词
- `loading: boolean` — 加载状态

**交互流程**:
1. 打开模态框 → 加载交易所列表
2. 选择交易所 → 加载品种列表（清空品种选择和合约列表）
3. 选择品种 → 加载合约列表
4. 输入关键词 → **后端过滤**（重新请求 `search?exchange=X&product=Y&keyword=Z`）
5. 点击"订阅" → 调用 `addContract()` → 更新表格 + localStorage
6. 点击"刷新合约列表" → 触发 `POST /api/market/instruments/refresh` → 等待完成后重新加载

### 改造 `useContractsStore`

**文件**: `src/stores/contracts.ts`

**当前**:
```typescript
contracts: ContractInfo[]        // 全部合约
selectedContracts: string[]      // 未使用
```

**改造后**:
```typescript
contracts: ContractInfo[]        // 已订阅的合约（预设 ∪ 用户自定义）
selectedContracts: string[]      // 多选状态
```

**新增方法**:
```typescript
addContract(contract: ContractInfo): void
  // 1. 加入 contracts 列表（去重）
  // 2. 调用 POST /api/market/subscribe
  // 3. 更新 useUserPrefsStore
  // 4. 保存到 localStorage

removeContract(instrumentID: string): void
  // 1. 从 contracts 列表移除
  // 2. 调用 POST /api/market/unsubscribe
  // 3. 更新 useUserPrefsStore
  // 4. 保存到 localStorage

loadSubscribedContracts(): Promise<void>
  // 1. 从 localStorage 恢复用户订阅列表
  // 2. GET /api/market/preset 获取预设合约
  // 3. 合并去重
  // 4. GET /api/market/instruments?ids=... 获取合约详情
  // 5. POST /api/market/subscribe 批量订阅
```

### 接入 `useUserPrefsStore`

**文件**: `src/stores/userPrefs.ts`

已有方法（无需修改）:
- `addSelectedContract(id)` — 添加到 selectedContracts
- `removeSelectedContract(id)` — 从 selectedContracts 移除
- `saveToLocalStorage()` — 持久化到 localStorage
- `loadFromLocalStorage()` — 从 localStorage 恢复

**接入点**:
- `MarketPanel` 启动时调用 `loadFromLocalStorage()`
- `addContract` / `removeContract` 时同步调用 `addSelectedContract` / `removeSelectedContract` + `saveToLocalStorage()`

### MarketPanel 改造

**启动流程**（替换现有的 `fetchInstruments()`）:

```typescript
useEffect(() => {
  // 1. 从 localStorage 恢复
  loadFromLocalStorage();

  // 2. 加载预设合约 + 用户订阅合约
  loadSubscribedContracts();
}, []);
```

**工具栏变更**:
- 移除现有"刷新"按钮
- 添加"搜索合约"按钮 → 打开 InstrumentSearchModal
- 添加"退订"按钮 → 退订当前选中的合约

### API 新增（`src/services/api.ts`）

```typescript
export async function getExchanges(): Promise<string[]>
export async function getProducts(exchange: string): Promise<string[]>
export async function searchInstruments(exchange: string, product: string, keyword?: string): Promise<ContractInfo[]>
export async function getPresetInstruments(): Promise<string[]>
export async function getInstrumentsByIds(ids: string[]): Promise<ContractInfo[]>
```

## 订阅流程

### 订阅

```
用户点击[订阅]按钮
  ├─ 1. 检查是否已订阅（去重）
  ├─ 2. 检查 500 合约上限
  ├─ 3. POST /api/market/subscribe
  │     ├─ 成功 → 加入 contracts store + 更新 localStorage + 提示成功
  │     └─ 失败 → 提示错误信息（如超过上限）
  └─ 4. WebSocket 自动推送该合约的行情数据
```

### 退订

```
用户点击[退订]按钮（或右键菜单）
  ├─ 1. POST /api/market/unsubscribe
  │     ├─ 成功 → 从 contracts store 移除 + 更新 localStorage + 提示成功
  │     └─ 失败 → 提示错误信息
  └─ 2. 从 MarketTable 中移除该行
```

## 错误处理

| 场景 | 处理 |
|------|------|
| 超过 500 合约上限 | 提示"订阅数量已达上限（500），请先退订其他合约" |
| 网络请求失败 | Toast 提示"操作失败，请重试" |
| 重复订阅 | 静默忽略（后端返回 `alreadySubscribed`） |
| 退订未订阅的合约 | 静默忽略 |
| 交易所/品种列表加载失败 | 模态框显示"加载失败，请重试"按钮 |
| 预设合约加载失败 | 仅用用户订阅列表启动，不阻塞 |

## 500 合约上限处理

当前 `MarketService` 硬编码 500 合约上限。预设合约（~50-80）+ 用户订阅合约不应超过此限制。如果用户订阅过多，前端在订阅前检查并提示。

## 文件变更清单

### 新增文件
| 文件 | 用途 |
|------|------|
| `server/data/preset_instruments.json` | 预设合约配置文件 |
| `frontend/src/components/InstrumentSearchModal/index.tsx` | 合约搜索模态框组件 |
| `frontend/src/components/InstrumentSearchModal/index.css` | 模态框样式 |

### 修改文件
| 文件 | 变更 |
|------|------|
| `server/api/market.py` | 新增 5 个端点 |
| `server/services/market_service.py` | 新增 6 个方法 |
| `server/tests/test_market_service.py` | 新增测试用例 |
| `frontend/src/stores/contracts.ts` | 改造 contracts store |
| `frontend/src/modules/market/store.ts` | 改造 fetchInstruments 流程 |
| `frontend/src/modules/market/MarketPanel.tsx` | 工具栏变更 + 启动流程改造 |
| `frontend/src/services/api.ts` | 新增 API 函数 |

## 测试策略

### 后端测试
- `test_get_exchanges` — 返回去重的交易所列表
- `test_get_products` — 返回指定交易所下的品种列表
- `test_search_instruments` — 按交易所+品种筛选
- `test_search_instruments_with_keyword` — 关键词过滤
- `test_get_preset` — 返回预设合约列表
- `test_refresh_preset` — 自动检测主力合约
- `test_get_instruments_by_ids` — 批量获取

### 前端测试
- `InstrumentSearchModal` 组件测试
- `useContractsStore` 改造后的测试
- 订阅/退订流程测试

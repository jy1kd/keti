# Design: 行情表拆分期货/期权双标签 + 排序 / 多选筛选 / 搜索栏重构

**日期**: 2026-08-12
**状态**: 已批准

---

## 1. 背景

当前行情主页（`MarketPanel`）的行情表**混合展示期货与期权全部合约**，通过工具栏 `行情` / `T型期权` 按钮在「市场表格」与「T型报价」之间切换。问题：

1. 期货/期权混在一个表里，无区分、无排序，17000+ 合约顺序无规律
2. 期货与期权靠按钮切换，不符合「独立标签页」的心智模型
3. 没有按交易所/品种多选筛选的能力（放大镜弹窗只能单选交易所+品种）
4. 期权合约没有标底归属的可视化
5. 搜索栏排在中间，操作不顺手

**目标**：将行情页拆为「期货」「期权」两个固定标签页，各自只展示对应合约；两页表格统一排序；新增交易所+品种多选筛选；期权页按标底分组并标出标底行；搜索栏重构为「功能靠左、搜索贴右」。

---

## 2. 数据前提（已验证）

- 合约数据来自 `/api/market/instruments`，每条约含 `productClass`（`1`=期货、`2`=期权、`6`=期权类[指数期权]）与 `underlyingInstrID`
- 实际数据规模：850 期货 / ~16000 期权（含 `6` 类）/ 720 组合；期权合约均带 `underlyingInstrID`（如 `p2609`）
- 230 个去重标底，全部可推导标底品种（如 `FG609`→`FG`，对 `underlyingInstrID` 去尾数字）；其中 212 个在期货列表中，18 个（HO/IO 指数期权）不在——标底行仍可显示（仅缺期货详情字段）
- **分组无需后端改动**，前端可直接消费 `underlyingInstrID`

---

## 3. 架构决策

**决策 1 — 期货/期权拆为两个固定标签。** 标签栏初始为两个不可关闭的固定标签并排最左：
- `📊 期货`（复用现有 `type:'market'`，仅改标题；渲染只含期货的行情表）
- `📈 期权`（复用现有 `type:'options'`；渲染新期权面板）

TabBar 固定标签判断从 `type === 'market'` 泛化为「`closable:false`」；`closeOthers`/`closeAll` 现有逻辑已跳过不可关闭标签，无需改。

**决策 2 — 行情表泛化为通用 `QuoteTable`（spec 驱动）。** 把 `MarketTable` 抽成由 `QuoteTableSpec` 驱动的通用虚拟滚动表，期货/期权各配一份 spec，选中/右键/收藏/订阅/局部刷新机制全部复用（方案 A）。

**决策 3 — 排序是数据管道第一步。** 排序在加载后最先执行，过滤（全部/自选、筛选、仅交易中、搜索）都作用在有序数据之上，结果天然保持排序。

**决策 4 — 期权页保留 T型报价为二级视图。** 期权标签内 `[列表 | T型报价]` 切换：`列表` = 新分组表（默认），`T型报价` = 现有 `OptionPanel` 原样保留。切到 T型报价时，列表页左侧功能与搜索框隐藏，只保留 T型报价自身工具行。

---

## 4. 设计细节

### 4.1 标签页改造

- **`stores/tabs.ts`**：`DEFAULT_TAB` 改标题 `📊 期货`；初始 `tabs` 增加期权固定标签 `{ id:'tab-options', type:'options', title:'📈 期权', closable:false }`；初始激活期货。`TabType` 已有 `'options'`，无需新增类型。
- **`components/TabBar/index.tsx`**：固定标签渲染区从单 `marketTab` 改为「所有 `closable:false` 的标签」；仍不进滚动区、无右键关闭、无拖拽脱离。
- **`components/TabContent/index.tsx`**：`case 'options'` 从占位符改为渲染期权面板；`case 'market'` 渲染期货面板。
- **顶部菜单（白框/托盘）`electron/menuTemplate.ts`**：`📊 全部行情`→`📊 期货`，`📉 T型期权`→`📉 期权`；`⭐ 自选行情`、`🪟 在新窗口打开` 保留。
- **IPC `market-view` 语义**（`electron.ts`/`preload.ts`/`MarketPanel` 处理器）：`all`/`favorites` → 激活期货标签并切内部全部/自选；`options` → 激活期权标签。`menuActions` 打开 `market` 窗口时标题同步 `📊 期货`。

### 4.2 表格泛化 `QuoteTable`

**spec 类型**（新文件，放 `modules/market/quoteTable.ts` 或 `components/`）：

```ts
interface QuoteTableSpec {
  buildRecords: (contracts, snapshots, favoritedIds) => QuoteRecord[]
  columns: ColumnDef[]            // field/title/width/样式回调
  rowStyle?: (record) => CellStyle | undefined
}
interface QuoteRecord {
  instrumentID: string
  kind: 'normal' | 'underlying' | 'option'
  // …显示字段（最新价/涨跌/买一…；期权另有 optionsType/strikePrice/underlying）
}
```

**通用机制迁入**（从现 `MarketTable` 原样搬移，行为不变）：vtable 虚拟滚动、按行快照引用的局部刷新、可见区通知+预加载、单击/双击/Shift范围/Ctrl增减/拖选/Ctrl+A、金色锚点守卫 `shouldRenderAnchor`、右键菜单（单选/多选）、收藏列、滚动松手 `markScrollEnd`。

- **期货 spec**：`contracts.filter(productClass==='1')` → 排序 → 扁平记录，列结构沿用现状（合约/品种/交易所/乘数/最小变动价位/到期日/状态/最新价/涨跌/涨跌%/买一/卖一/成交量/持仓量/⭐）。
- **期权 spec**：`productClass in ('2','6')` → 按 `underlyingInstrID` 分组展平：
  - 每标底一条 `kind:'underlying'` 行（深色底+上方分隔线，「类型」列显示弱化「标」标签）+ 其后若干 `kind:'option'` 行（缩进一格）
  - 标底行从期货列表匹配真实合约显示行情（需订阅该期货）；期权行列 = 合约/类型/行权价/到期日/交易所/状态/最新价/涨跌/涨跌%/买一/卖一/成交量/持仓量/⭐
  - 标底行与期权行都可交互：选中、右键开报单/K线/查询/收藏、复制代码

### 4.3 多选筛选 `ContractFilter`

- 入口：工具栏左侧集群「筛选 🔽」按钮（全部/自选之后、仅交易中之前），显示已生效筛选数徽标
- 面板（新组件）：交易所多选 + 品种多选（checkbox）；选项行内模糊搜索辅助；「清空」；点击外部/Esc 关闭
- **品种列表按当前表格派生**：期货页 = 期货 `productID`；期权页 = 标底品种（由 `underlyingInstrID` 去尾数字推导），均配 `getProductName` 中文名
- 筛选逻辑：`exchanges`/`products` 各自多选，**空集=不限**；命中 = `exchange ∈ exchanges(或空)` **且** `product ∈ products(或空)`；期权页按合约 `exchangeID` + 标底品种判定
- **状态**：期货/期权两页独立；持久化到 `userPrefs`（localStorage）；自选视图也应用筛选

### 4.4 排序

数据管道第一步（过滤之前）：

```
排序（基础，最先做） → 全部/自选 → 筛选(交易所/品种) → 仅交易中 → 搜索 → 进表格
```

- **期货**：一级 `exchangeID` 固定顺序（SHFE→DCE→CZCE→CFFEX→INE→GFEX）；二级 `productID` 字典序；三级合约月份数字自然升序（`FG609<FG610<FG701`）
- **期权**：一级按标底 `underlyingInstrID` 自然升序；组内按到期日→类型(C 前 P 后)→行权价升序
- 抽纯函数 `sortContracts`（期货）、`groupOptionsByUnderlying`（期权分组+组内排序），独立可单测；在 `contracts`/`favorites` 加载后及每次变更时经 useMemo 执行一次（不随快照重算）
- 过滤后某标底组只剩部分期权行：有可见期权行则标底行保留；整组被滤掉则整组隐藏

### 4.5 搜索栏重构 + 期权二级视图

统一工具行（两页从左到右）：

```
[全部|自选] [筛选🔽] [仅交易中] [收藏]   ……弹性空闲……   [搜索框…] [🔍]
```

期权页在「全部/自选」前再加 `[列表 | T型报价]` segment：

```
[列表|T型] [全部|自选] [筛选🔽] [仅交易中] [收藏]   …空闲…   [搜索框…] [🔍]
```

- 搜索框+放大镜用 `margin-left:auto` 贴最右
- T型报价视图：隐藏列表页左侧功能与搜索框，仅保留 `OptionPanel` 自身工具行（标底搜索+到期日+刷新）
- 搜索行为：期货页作用域=当前期货列表（沿用现状）；期权页（列表视图）作用域=当前期权列表（含标底代码/中文品种名匹配），选中期权合约时定位到其标底分组，选中标底行定位到该行

### 4.6 顶部菜单改名

`menuTemplate.ts` 改两处 label（`📊 期货` / `📉 期权`）；`menuActions`/`preload`/`electron.ts` 类型与注释同步；`trayManager` 从同一 def 构建，自动同步。

---

## 5. 测试计划

| 范围 | 新增/更新用例 |
|------|---------------|
| `stores/tabs.test.ts` | 初始双固定标签（期货+期权）、不可关闭、closeOthers/closeAll 跳过 |
| `TabBar/index.test.tsx` | 双固定标签渲染在左固定区、不进滚动区、无右键关闭 |
| `TabContent/index.test.tsx` | `options` 渲染期权面板（不再是占位符） |
| `MarketPanel.test.tsx` | 移除行情/T型期权按钮切换；期货页只渲染期货 spec |
| `QuoteTable`（新） | 单/多选、右键菜单、收藏、可见区订阅上报、标底+期权行都交互 |
| 期权面板测试 | 分组展平（标底行在前+期权行在后）、列表/T型切换、排序、过滤、自选 |
| 排序纯函数 | 期货排序、期权分组排序、月份数字比较边界（FG609/FG610/FG701） |
| `ContractFilter`（新） | 多选逻辑、空集=不限、两页状态独立、持久化、自选视图生效 |
| `InstrumentSearchModal` | 标签改名后按钮文案联动（回归） |
| `menuTemplate.test.ts` | label 断言 `📊 期货` / `📉 期权` |
| 既有 469 前端测试 + 108 后端测试 | 全量回归，不得回归 |

---

## 6. 验收标准（人工）

1. 进应用：标签栏左侧两个固定标签「📊 期货」「📈 期权」，均不可关闭
2. 期货页只看到期货合约；期权页看到按标底分组的期权列表，标底行带行情、可交互
3. 排序正确：期货按交易所→品种→月份，期权按标底→组内类型/行权价
4. 筛选多选生效、切页独立、自选视图下也生效、刷新/重启保留
5. 搜索框+放大镜贴最右；期权页 `[列表|T型报价]` 切换正常，T型报价原样可用
6. 顶部菜单「期货」「期权」点击直达对应页
7. 全量测试通过，无回归

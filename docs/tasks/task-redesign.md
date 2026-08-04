# Task: 多页面架构 + 虚拟滚动按需订阅重构 - PR任务拆分

## 1. 概述

本文档按照PR进行任务拆分，将现有单页面三栏布局重构为标签页系统，同时重构行情表格支持全量合约显示 + 虚拟滚动按需订阅。

**拆分原则**：
- 每个PR 2-4小时工作量
- 功能独立，可单独测试验证
- PR依赖关系清晰

**角色分工**：
- **角色B**：前端开发（frontend/目录）

---

## 2. PR列表

### 阶段1：行情表格重构

---

#### PR-R1: 合约数据源重构

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R1 |
| **PR标题** | 合约数据源重构：移除预设合约，加载全量合约 |
| **PR分支名** | `feature/redesign-r1-contracts` |
| **负责角色** | 角色B |
| **依赖PR** | 无 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/stores/
├── contracts.ts             # 重构：移除预设合约，添加全量合约加载
└── contracts.test.ts        # 更新测试
```

**PR描述**：
重构 contracts store，移除预设合约概念，改为从 instruments.json 加载全量合约列表。

**实现方式**：
1. 移除 `presetContracts`、`presetIds` 相关代码
2. 添加 `allContracts` 字段存储全量合约
3. 添加 `loadAllContracts()` 方法从 instruments.json 加载
4. 保留 `userContracts`（自选合约）
5. 更新 `contracts` 计算属性（合并 allContracts + userContracts）

**验收标准**：
- [x] 能从 API 加载全量合约
- [x] 自选合约功能正常（自动订阅/取消订阅）
- [x] 合约搜索功能正常
- [x] 所有测试通过（590 tests passed）

---

#### PR-R2: MarketTable 虚拟滚动 + 可见行检测

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R2 |
| **PR标题** | MarketTable 虚拟滚动 + 可见行检测 |
| **PR分支名** | `feature/redesign-r2-vtable` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R1 |
| **工作量** | 4小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/modules/market/
├── MarketTable.tsx          # 重构：添加可见行检测回调
└── MarketTable.test.tsx     # 更新测试
```

**PR描述**：
重构 MarketTable 组件，添加可见行检测功能，支持虚拟滚动按需订阅。

**实现方式**：
1. 使用 vtable 的 `onScroll` 事件检测可见行范围
2. 添加 `onVisibleRangeChange` 回调
3. 计算可见行的合约 ID 列表
4. 300ms 防抖避免频繁触发

**验收标准**：
- [x] 能检测当前可见行范围
- [x] 滚动时触发 onVisibleRangeChange 回调
- [x] 300ms 防抖正常工作
- [x] 所有测试通过（609 tests passed）

---

#### PR-R3: 按需订阅逻辑

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R3 |
| **PR标题** | 按需订阅逻辑：可见区域 + 自选合约 + 锁定合约 |
| **PR分支名** | `feature/redesign-r3-subscription` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R2 |
| **工作量** | 4小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/hooks/
├── useSubscriptionManager.ts    # 新增：按需订阅管理器
frontend/src/modules/market/
├── MarketPanel.tsx              # 更新：集成订阅管理器
└── store.ts                     # 更新：添加锁定合约管理
```

**PR描述**：
实现按需订阅逻辑，支持可见区域订阅、自选合约始终订阅、锁定合约永不退订。

**实现方式**：
1. 添加 `lockedContracts` Set 管理锁定合约
2. 实现 `calculateSubscriptions()` 计算订阅/退订列表
3. 订阅公式：`应该订阅 = 可见区域 + 自选合约 + 锁定合约`
4. 退订公式：`需要退订 = 已订阅 - 应该订阅`
5. 批量订阅/退订 + 300ms 防抖

**验收标准**：
- [x] 可见区域合约自动订阅
- [x] 自选合约始终订阅
- [x] 锁定合约永不退订
- [x] 滚动出视野的合约自动退订
- [x] 所有测试通过（638 tests passed）

---

#### PR-R4: 收藏功能（替代订阅/退订）

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R4 |
| **PR标题** | 收藏功能：替代订阅/退订，支持批量收藏 |
| **PR分支名** | `feature/redesign-r4-favorites` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R3 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/modules/market/
├── MarketTable.tsx           # 更新：添加收藏按钮列
├── MarketPanel.tsx           # 更新：集成收藏功能
```

**PR描述**：
实现收藏功能，替代原有的订阅/退订逻辑，支持批量收藏。

**实现方式**：
1. 在表格最后一列添加收藏按钮（⭐/☆）
2. 点击切换收藏状态
3. 收藏合约添加到 `userPrefs.selectedContracts`
4. 收藏合约始终订阅（锁定）
5. 支持批量收藏（多选 + 右键菜单）

**验收标准**：
- [x] 点击收藏按钮能切换收藏状态
- [x] 收藏合约始终订阅
- [x] 取消收藏后如果不在可见区域则退订
- [x] 批量收藏功能正常
- [x] 所有测试通过（656 tests passed）

---

#### PR-R5: 表格内搜索功能

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R5 |
| **PR标题** | 表格内搜索：支持中文搜索，300ms 防抖 |
| **PR分支名** | `feature/redesign-r5-search` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R1 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/modules/market/
├── MarketPanel.tsx           # 更新：添加搜索框
├── useContractSearch.ts      # 新增：搜索 Hook
└── useContractSearch.test.ts # 新增：测试
```

**PR描述**：
实现表格内搜索功能，支持中文搜索，300ms 防抖。

**实现方式**：
1. 在表格顶部添加搜索框
2. 支持合约代码、合约名称、品种名称搜索
3. 300ms 防抖避免频繁搜索
4. 清空按钮（✕）
5. 快捷键 `Ctrl+F` 聚焦搜索框

**验收标准**：
- [x] 输入关键词能过滤合约列表
- [x] 支持中文搜索
- [x] 300ms 防抖正常工作
- [x] 清空按钮能清空搜索
- [x] 快捷键 `Ctrl+F` 能聚焦搜索框
- [x] 所有测试通过（666 tests passed）

---

#### PR-R6: 多选功能

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R6 |
| **PR标题** | 多选功能：Ctrl+点击、Shift+点击、Ctrl+A |
| **PR分支名** | `feature/redesign-r6-multiselect` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R2 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/modules/market/
├── MarketTable.tsx           # 更新：支持多选
├── MarketPanel.tsx           # 更新：集成多选功能
└── store.ts                  # 更新：添加选中状态管理
```

**PR描述**：
实现多选功能，支持 Ctrl+点击、Shift+点击、Ctrl+A。

**实现方式**：
1. 添加 `selectedContracts` Set 管理选中状态
2. `Ctrl+点击`：逐个选择/取消选择
3. `Shift+点击`：范围选择
4. `Ctrl+A`：全选当前搜索结果
5. 选中行高亮显示

**验收标准**：
- [x] Ctrl+点击能逐个选择/取消选择
- [x] Shift+点击能范围选择
- [x] Ctrl+A 能全选当前搜索结果
- [x] 选中行高亮显示
- [x] 所有测试通过（682 tests passed）

---

#### PR-R7: 右键菜单（单选/多选）

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R7 |
| **PR标题** | 右键菜单：单选/多选操作 |
| **PR分支名** | `feature/redesign-r7-context-menu` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R4, PR-R6 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/components/
├── ContextMenu/index.tsx    # 新增：右键菜单组件
├── ContextMenu/index.test.tsx # 新增：测试
└── ContextMenu/styles.css   # 新增：样式
frontend/src/hooks/
└── useContractContextMenu.ts # 更新：支持多选操作
frontend/src/modules/market/
├── MarketPanel.tsx           # 更新：集成右键菜单
└── MarketTable.tsx           # 更新：支持多选右键菜单
```

**PR描述**：
实现右键菜单，支持单选/多选操作。

**实现方式**：
1. 创建 ContextMenu 组件
2. 单选菜单：打开报单、打开K线、收藏、取消收藏、复制合约代码
3. 多选菜单：批量打开报单、批量打开K线、批量收藏、批量取消收藏
4. 菜单项显示操作数量（如 "收藏 (3个)"）

**验收标准**：
- [x] 右键点击显示菜单
- [x] 单选菜单功能正常
- [x] 多选菜单功能正常
- [x] 菜单项显示操作数量
- [x] 所有测试通过（701 tests passed）

---

### 阶段2：标签页系统

---

#### PR-R8: TabStore 标签页状态管理

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R8 |
| **PR标题** | TabStore 标签页状态管理 |
| **PR分支名** | `feature/redesign-r8-tabstore` |
| **负责角色** | 角色B |
| **依赖PR** | 无 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/stores/
├── tabs.ts                  # 新增：标签页状态管理
└── tabs.test.ts             # 新增：测试
```

**PR描述**：
创建 TabStore 标签页状态管理，支持标签页的增删改查。

**实现方式**：
1. 定义 TabType 类型（market, favorites, order, query, kline, options, ipc-monitor, settings）
2. 定义 Tab 接口（id, type, title, props, closable）
3. 实现 openTab、closeTab、setActiveTab 方法
4. 实现标签页限制（最多 15 个）
5. 实现固定标签（market 始终存在）

**验收标准**：
- [x] 能创建新标签页
- [x] 能关闭标签页
- [x] 能切换标签页
- [x] 标签页限制正常工作
- [x] 固定标签不能关闭
- [x] 所有测试通过（20 个测试）

---

#### PR-R9: TabBar 标签栏组件

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R9 |
| **PR标题** | TabBar 标签栏组件 |
| **PR分支名** | `feature/redesign-r9-tabbar` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R8 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/components/
├── TabBar/index.tsx         # 新增：标签栏组件
├── TabBar/styles.css        # 新增：样式
└── TabBar/index.test.tsx    # 新增：测试
```

**PR描述**：
创建 TabBar 标签栏组件，支持标签页切换、关闭、新增。

**实现方式**：
1. 显示所有打开的标签页
2. 点击切换标签页
3. 点击关闭按钮关闭标签页
4. 点击 "+" 按钮打开新标签页
5. 显示标签页图标和标题
6. 支持拖拽排序（可选）

**验收标准**：
- [x] 显示所有打开的标签页
- [x] 点击能切换标签页
- [x] 关闭按钮能关闭标签页
- [x] "+" 按钮能打开新标签页
- [x] 标签页图标和标题显示正确
- [x] 所有测试通过（13 tests）

---

#### PR-R10: TabContent 标签内容组件

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R10 |
| **PR标题** | TabContent 标签内容组件 |
| **PR分支名** | `feature/redesign-r10-tabcontent` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R9 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/components/
├── TabContent/index.tsx     # 新增：标签内容组件
├── TabContent/index.test.tsx # 新增：测试
└── TabContent/styles.css    # 新增：样式
```

**PR描述**：
创建 TabContent 标签内容组件，根据标签类型渲染对应内容。

**实现方式**：
1. 根据 activeTabId 渲染对应内容
2. 支持标签页类型：market, favorites, order, query, kline, options, ipc-monitor, settings
3. 标签页切换时保持状态（不销毁组件）
4. 支持标签页懒加载（可选）

**验收标准**：
- [x] 能根据标签类型渲染对应内容
- [x] 标签页切换时保持状态
- [x] 所有测试通过

---

#### PR-R11: App.tsx 重构：标签页布局

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R11 |
| **PR标题** | App.tsx 重构：标签页布局 |
| **PR分支名** | `feature/redesign-r11-app-layout` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R10 |
| **工作量** | 4小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/
├── App.tsx                  # 重构：使用标签页布局
└── App.test.tsx             # 更新测试
frontend/src/assets/styles/
└── global.css               # 添加 .tab-main 样式
```

**PR描述**：
重构 App.tsx，使用标签页布局替代原有的三栏布局。

**实现方式**：
1. ✅ 移除原有的三栏布局（react-resizable-panels）
2. ✅ 添加 TabBar 组件
3. ✅ 添加 TabContent 组件
4. ✅ 保留状态栏（ConnectionStatus、余额、持仓）
5. ✅ 保留设置面板

**验收标准**：
- [x] 标签页布局正常显示
- [x] 标签页切换功能正常
- [x] 状态栏显示正常
- [x] 所有测试通过（652 tests passed）

---

#### PR-R12: 自选标签页

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R12 |
| **PR标题** | 自选标签页：独立标签页，显示收藏合约 |
| **PR分支名** | `feature/redesign-r12-favorites-tab` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/pages/
├── FavoritesPage.tsx        # 新增：自选标签页
└── FavoritesPage.test.tsx   # 新增：测试
frontend/src/components/
└── TabContent/index.tsx     # 更新：集成 FavoritesPage
```

**PR描述**：
实现自选标签页，显示收藏的合约列表。

**实现方式**：
1. 创建 FavoritesPage 组件
2. 只显示收藏的合约
3. 全部订阅（数量少，通常 < 50）
4. 支持取消收藏操作
5. 状态栏显示 "自选: X"

**验收标准**：
- [x] 点击 [⭐ 自选] 按钮能打开自选标签页
- [x] 只显示收藏的合约
- [x] 全部订阅功能正常
- [x] 取消收藏功能正常
- [x] 状态栏显示正确
- [x] 所有测试通过（664 tests passed）

---

#### PR-R13: 标签页打开方式

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R13 |
| **PR标题** | 标签页打开方式：双击、右键、快捷键 |
| **PR分支名** | `feature/redesign-r13-tab-open` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/modules/market/
├── MarketTable.tsx           # 更新：双击打开报单标签
└── MarketPanel.tsx           # 更新：右键菜单打开标签
frontend/src/pages/
├── FavoritesPage.tsx         # 更新：自选合约双击/右键打开标签
└── FavoritesPage.test.tsx    # 新增：测试
frontend/src/modules/query/
└── Position.tsx              # 更新：平仓按钮打开报单标签（⏸️ PR-R20 实现）
```

**PR描述**：
实现标签页打开方式，支持双击、右键、快捷键。

**实现方式**：
1. 行情表格双击：打开该合约的报单标签
2. 行情表格右键：菜单打开报单/K线标签
3. 自选合约双击：打开该合约的报单标签
4. 自选合约右键：菜单打开报单/K线标签
5. 持仓列表"平仓"按钮：打开新报单标签 + 填充平仓参数（⏸️ 推迟到 PR-R20）

**验收标准**：
- [x] 双击能打开报单标签
- [x] 右键菜单能打开报单/K线标签
- [ ] ~~持仓平仓按钮能打开报单标签~~（⏸️ 推迟到 PR-R20，理由见下方注记）
- [x] 所有测试通过（679 tests passed）

> **推迟注记（PR-R13 自验证）**：「持仓平仓按钮能打开报单标签」推迟到 PR-R20。
> **理由**：
> 1. 依赖关系：PR-R20 依赖 PR-R14（报单标签页）而非 PR-R13，平仓按钮打开报单标签需以 PR-R14 的报单标签页为目标
> 2. 任务重复：PR-R13 第 5 条与 PR-R20 全部实现方式文本重复，实际归属 PR-R20（`Position.tsx` 平仓逻辑）
> 3. 当前 PR-R14 未开发，无报单标签页可供平仓按钮打开

---

### 阶段3：页面组件拆分

---

#### PR-R14: 报单标签页

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R14 |
| **PR标题** | 报单标签页：独立报单页面 |
| **PR分支名** | `feature/redesign-r14-order-page` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/pages/
├── OrderPage.tsx            # 重构：添加合约名称显示
├── __tests__/
│   └── OrderPage.test.tsx   # 更新测试：instrumentName/latestPrice
frontend/src/components/TabContent/
├── index.tsx                # 集成 OrderPage，替换占位符
└── index.test.tsx           # 更新测试：mock OrderPage
```

**PR描述**：
重构 OrderPage 为独立报单标签页。

**实现方式**：
1. 显示合约信息（代码、名称、最新价）
2. 集成 OrderForm 组件
3. 支持从标签页 props 获取 instrumentID
4. 标签页标题显示 "📝 报单-{instrumentID}"

**验收标准**：
- [x] 报单标签页正常显示
- [x] 合约信息显示正确
- [x] 报单功能正常
- [x] 标签页标题显示正确
- [x] 所有测试通过

---

#### PR-R15: 查询弹窗（重构）

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R15 |
| **PR标题** | 查询弹窗：悬浮查询面板（替代查询标签页） |
| **PR分支名** | `feature/redesign-r15-query-page` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 2小时 |
| **状态** | 开发完成，待审查 |

**提交文件**：
```
frontend/src/modules/query/
├── QueryPopup.tsx           # 新增：悬浮查询弹窗（非模态/可拖拽/×/ESC 关闭）
├── QueryPopup.css           # 新增：弹窗样式
├── QueryPopup.test.tsx      # 新增：测试
├── popupStore.ts            # 新增：弹窗开关 + open 传入合约同步选中
└── popupStore.test.ts       # 新增：测试
frontend/src/stores/
├── tabs.ts                  # 更新：移除 query 标签类型
└── tabs.test.ts             # 更新：替换 query 用例
frontend/src/components/TabContent/
├── index.tsx                # 更新：移除 query case
└── index.test.tsx           # 更新：移除 query mock/用例
frontend/src/components/TabBar/
├── index.tsx                # 更新：📋 按钮改为打开查询弹窗
└── index.test.tsx           # 更新：快捷按钮测试
frontend/src/hooks/
└── useContractContextMenu.ts # 更新：添加 openQueryPopup
frontend/src/modules/market/
└── MarketPanel.tsx          # 更新：右键菜单添加「📋 查询」
frontend/src/pages/
└── FavoritesPage.tsx        # 更新：右键菜单添加「📋 查询」
frontend/src/App.tsx         # 更新：渲染 QueryPopup；托盘导航打开弹窗
frontend/src/pages/QueryPage.tsx / QueryPage.css / __tests__/QueryPage.test.tsx  # 删除：查询标签页形态废弃
```

**PR描述**：
将查询面板重构为悬浮弹窗（QueryPopup），移除查询标签页形态（查询面板过大）。右键合约菜单添加「📋 查询」入口，打开弹窗并选中该合约。

**实现方式**：
1. 创建 QueryPopup 悬浮弹窗（参照 OrderPopup：非模态、可拖拽、×/ESC 关闭）
2. 创建 popupStore 管理弹窗开关；open 可传入合约并同步全局选中（合约/K线子页显示该合约）
3. 移除 query 标签类型（tabs.ts/TabContent/TabBar），查询不再作为标签页
4. TabBar 📋 按钮 → 打开查询弹窗
5. 右键合约菜单添加「📋 查询」→ 打开弹窗并选中该合约
6. Electron 托盘导航 query → 打开弹窗

**验收标准**：
- [x] 查询弹窗正常显示（浮于标签页之上，行情可见可交互）
- [x] QueryPanel 内部 Tab 切换功能正常（报单/成交/持仓/资金/止损单/合约/K线）
- [x] 数据查询功能正常
- [x] 右键合约菜单「📋 查询」打开弹窗并选中该合约
- [x] 所有测试通过

---

#### PR-R16: K线标签页

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R16 |
| **PR标题** | K线标签页：独立K线页面 |
| **PR分支名** | `feature/redesign-r16-kline-page` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/pages/
├── KLinePage.tsx            # 重构：独立K线页面
└── KLinePage.test.tsx       # 更新测试
```

**PR描述**：
重构 KLinePage 为独立K线标签页。

**实现方式**：
1. 显示合约信息（代码、名称、最新价）
2. 集成 KLineChart 组件
3. 支持多周期切换
4. 支持技术指标切换
5. 标签页标题显示 "📈 K线-{instrumentID}"

**验收标准**：
- [ ] K线标签页正常显示
- [ ] 合约信息显示正确
- [ ] K线图功能正常
- [ ] 标签页标题显示正确
- [ ] 所有测试通过

---

#### PR-R17: 设置标签页

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R17 |
| **PR标题** | 设置标签页：快捷键和快捷交易设置 |
| **PR分支名** | `feature/redesign-r17-settings-page` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成 |

**提交文件**：
```
frontend/src/pages/
├── SettingsPage.tsx         # 新增：设置标签页
└── SettingsPage.test.tsx    # 新增：测试
frontend/src/components/
├── TabContent/index.tsx     # 更新：渲染 SettingsPage
└── SettingsPanel/styles.css # 更新：添加 SettingsPage 样式
```

**PR描述**：
实现设置标签页，支持快捷键和快捷交易设置。

**实现方式**：
1. 集成现有的 SettingsPanel 组件
2. 添加标签页切换（快捷键/快捷交易/显示/连接）
3. 保存设置到 localStorage
4. 标签页标题显示 "⚙ 设置"

**验收标准**：
- [x] 设置标签页正常显示
- [x] 快捷键设置功能正常
- [x] 快捷交易设置功能正常
- [x] 设置保存功能正常
- [x] 所有测试通过（707 tests passed）

---

#### PR-R18: IPC 监控标签页

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R18 |
| **PR标题** | IPC 监控标签页：调试工具 |
| **PR分支名** | `feature/redesign-r18-ipc-monitor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/pages/
├── IPCMonitorPage.tsx       # 新增：IPC监控标签页
└── IPCMonitorPage.test.tsx  # 新增：测试
frontend/electron/
├── ipcMonitor.ts            # 新增：IPC监控主进程模块
└── ipc/index.ts             # 更新：添加IPC监控通道
```

**PR描述**：
实现IPC监控标签页，用于调试IPC通信。

**实现方式**：
1. 创建 IPCMonitor 主进程模块
2. 创建 IPCMonitorPage 渲染进程页面
3. 支持消息过滤（全部/行情/报单/系统/导航）
4. 支持暂停/清空/导出操作
5. 支持消息详情展示

**验收标准**：
- [ ] IPC监控标签页正常显示
- [ ] 消息过滤功能正常
- [ ] 暂停/清空/导出功能正常
- [ ] 消息详情展示正常
- [ ] 所有测试通过

---

### 阶段4：快捷键和设置

---

#### PR-R19: 快捷键系统重构

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R19 |
| **PR标题** | 快捷键系统重构：支持自定义快捷键 |
| **PR分支名** | `feature/redesign-r19-shortcuts` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R17 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/stores/
├── userPrefs.ts             # 更新：添加快捷键配置
└── userPrefs.test.ts        # 更新测试
frontend/src/hooks/
├── useHotKeys.ts            # 重构：支持自定义快捷键
└── useHotKeys.test.ts       # 更新测试
frontend/src/components/
└── SettingsPanel/HotKeyTab.tsx # 更新：添加新的快捷键配置
```

**PR描述**：
重构快捷键系统，支持自定义快捷键配置。

**实现方式**：
1. 更新 HotKeyConfig 接口，添加新的快捷键
2. 更新 useHotKeys Hook，支持自定义快捷键
3. 更新 HotKeyTab 组件，显示所有可配置快捷键
4. 支持恢复默认快捷键
5. 快捷键冲突检测

**验收标准**：
- [ ] 所有快捷键能正常工作
- [ ] 快捷键能自定义配置
- [ ] 快捷键配置能持久化
- [ ] 快捷键冲突检测正常
- [ ] 所有测试通过

---

#### PR-R20: 持仓平仓打开报单标签

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R20 |
| **PR标题** | 持仓平仓打开报单标签 |
| **PR分支名** | `feature/redesign-r20-position-close` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R13, PR-R14 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/src/modules/query/
└── Position.tsx              # 更新：平仓按钮打开新报单标签
```

**PR描述**：
实现持仓平仓按钮打开新报单标签并填充平仓参数。

**实现方式**：
1. 点击"平仓"按钮打开新报单标签
2. 自动填充平仓参数（合约、方向、开平、数量）
3. 从行情快照获取对手价
4. 标签页标题显示 "📝 报单-{instrumentID}"

**验收标准**：
- [ ] 点击平仓按钮能打开新报单标签
- [ ] 平仓参数填充正确
- [ ] 对手价获取正确
- [ ] 标签页标题显示正确
- [ ] 所有测试通过

---

### 阶段5：Electron 集成

---

#### PR-R21: Electron 独立窗口支持

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R21 |
| **PR标题** | Electron 独立窗口支持 |
| **PR分支名** | `feature/redesign-r21-electron-windows` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R11 |
| **工作量** | 3小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/electron/
├── windowManager.ts         # 更新：支持从标签页分离
└── ipc/window.ts            # 更新：添加窗口分离IPC
frontend/src/components/
└── TabBar/index.tsx         # 更新：添加"在新窗口打开"右键菜单
```

**PR描述**：
实现Electron独立窗口支持，标签页可分离为独立窗口。

**实现方式**：
1. 更新 WindowManager，支持从标签页分离
2. 添加"在新窗口打开"右键菜单
3. 独立窗口与主窗口数据同步
4. 独立窗口关闭不影响主窗口

**验收标准**：
- [ ] 标签页能分离为独立窗口
- [ ] 独立窗口功能正常
- [ ] 独立窗口与主窗口数据同步
- [ ] 独立窗口关闭不影响主窗口
- [ ] 所有测试通过

---

#### PR-R22: Electron 托盘菜单更新

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-R22 |
| **PR标题** | Electron 托盘菜单更新 |
| **PR分支名** | `feature/redesign-r22-tray-menu` |
| **负责角色** | 角色B |
| **依赖PR** | PR-R21 |
| **工作量** | 2小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/electron/
└── trayManager.ts           # 更新：更新托盘菜单
```

**PR描述**：
更新Electron托盘菜单，支持新的标签页系统。

**实现方式**：
1. 更新托盘菜单项
2. 添加"自选合约"菜单项
3. 添加"设置"菜单项
4. 更新菜单项点击事件

**验收标准**：
- [ ] 托盘菜单显示正确
- [ ] 菜单项功能正常
- [ ] 所有测试通过

---

## 3. PR依赖关系

```
PR-R1 (合约数据源)
  ├── PR-R2 (虚拟滚动)
  │     ├── PR-R3 (按需订阅)
  │     │     └── PR-R4 (收藏功能)
  │     └── PR-R6 (多选功能)
  │           └── PR-R7 (右键菜单) ← depends on PR-R4
  └── PR-R5 (搜索功能)

PR-R8 (TabStore)
  └── PR-R9 (TabBar)
        └── PR-R10 (TabContent)
              └── PR-R11 (App.tsx 重构)
                    ├── PR-R12 (自选标签页)
                    ├── PR-R13 (标签页打开方式) ← depends on PR-R11
                    │     └── PR-R20 (持仓平仓) ← depends on PR-R14
                    ├── PR-R14 (报单标签页)
                    ├── PR-R15 (查询标签页)
                    ├── PR-R16 (K线标签页)
                    ├── PR-R17 (设置标签页)
                    │     └── PR-R19 (快捷键重构)
                    ├── PR-R18 (IPC监控标签页)
                    └── PR-R21 (Electron独立窗口)
                          └── PR-R22 (Electron托盘菜单)
```

---

## 4. 工作量统计

| 阶段 | PR数量 | 工时 | 说明 |
|------|--------|------|------|
| 行情表格重构 | 7 | 22小时 | PR-R1 ~ PR-R7 |
| 标签页系统 | 6 | 18小时 | PR-R8 ~ PR-R13 |
| 页面组件拆分 | 5 | 11小时 | PR-R14 ~ PR-R18 |
| 快捷键和设置 | 2 | 5小时 | PR-R19 ~ PR-R20 |
| Electron 集成 | 2 | 5小时 | PR-R21 ~ PR-R22 |
| **总计** | **22** | **61小时** | |

---

## 5. 验收标准汇总

### 5.1 行情表格重构

- [ ] 全量合约显示（~6000+）
- [ ] 虚拟滚动按需订阅
- [ ] 自选合约始终订阅
- [ ] 锁定合约永不退订
- [ ] 收藏功能正常
- [ ] 批量收藏正常
- [ ] 搜索功能正常
- [ ] 多选功能正常
- [ ] 右键菜单正常

### 5.2 标签页系统

- [ ] 标签页切换正常
- [ ] 标签页关闭正常
- [ ] 标签页限制（15个）
- [ ] 固定标签（行情）
- [ ] 自选标签页正常
- [ ] 标签页打开方式正常

### 5.3 页面组件

- [ ] 报单标签页正常
- [ ] 查询标签页正常
- [ ] K线标签页正常
- [ ] 设置标签页正常
- [ ] IPC监控标签页正常

### 5.4 快捷键和设置

- [ ] 快捷键自定义正常
- [ ] 快捷交易设置正常
- [ ] 设置持久化正常

### 5.5 Electron 集成

- [ ] 独立窗口正常
- [ ] 托盘菜单正常
- [ ] 数据同步正常

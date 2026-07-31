# Task: Electron 桌面应用迁移 - PR任务拆分

## 1. 概述

本文档规划将现有 Web 应用迁移为 Electron 桌面应用的任务拆分，实现浏览器式多窗口体验、系统托盘集成、原生桌面功能。

**拆分原则**：
- 每个PR 2-4小时工作量
- 渐进式迁移，保持现有功能可用
- 每个PR可独立测试验证

**角色分工**：
- **角色B**：前端开发（frontend/目录，Electron 主进程 + 渲染进程）

---

## 2. 最终效果预览

### 2.1 功能对比

| 功能 | 现有 Web 版 | Electron 桌面版 |
|------|------------|-----------------|
| **访问方式** | 浏览器访问 localhost:5173 | 桌面应用双击启动 |
| **多窗口** | 单页面，内部 Tab 切换 | 原生多窗口，可拖拽、调整大小 |
| **系统托盘** | ❌ 不支持 | ✅ 最小化到托盘，托盘菜单 |
| **全局快捷键** | ❌ 仅页面内有效 | ✅ 全局生效（如 Ctrl+B 快速报单） |
| **通知** | 浏览器通知 | 原生系统通知 |
| **启动方式** | 手动启动浏览器 + 输入地址 | 双击图标直接启动 |
| **离线使用** | ❌ 需要后端运行 | ✅ 可打包后端，一键启动 |
| **窗口记忆** | ❌ 刷新后丢失 | ✅ 记住窗口位置和大小 |
| **多显示器** | 受浏览器限制 | ✅ 原生多显示器支持 |
| **文件拖拽** | 受浏览器限制 | ✅ 原生文件拖拽 |

### 2.2 界面布局

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 SimNow 交易终端                              ─  □  ✕       │
├─────────────────────────────────────────────────────────────────┤
│  [行情] [报单 IF2608] [报单 IF2609] [查询] [K线]        [+]    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   ┌─────────────────────────────────────────────────────────┐   │
│   │                    行情面板                              │   │
│   │   ┌─────────────────────────────────────────────────┐   │   │
│   │   │  合约    最新价   涨跌    买一    卖一   成交量  │   │   │
│   │   │  IF2608  4800.0  +12.0  4799.8  4800.2  12345   │   │   │
│   │   │  IF2609  4780.0  +8.0   4779.6  4780.4  8901    │   │   │
│   │   └─────────────────────────────────────────────────┘   │   │
│   └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│   ┌──────────────────────┐  ┌──────────────────────┐           │
│   │     五档行情         │  │      K线图           │           │
│   │  卖5  4805.0  100    │  │  ┌───────────────┐   │           │
│   │  卖4  4804.0  150    │  │  │   /\    /\    │   │           │
│   │  卖3  4803.0  200    │  │  │  /  \  /  \   │   │           │
│   │  卖2  4802.0  250    │  │  │ /    \/    \  │   │           │
│   │  卖1  4801.0  300    │  │  └───────────────┘   │           │
│   │  ─────────────────── │  │  MA5  MA10  MA20     │           │
│   │  买1  4799.8  350    │  └──────────────────────┘           │
│   │  买2  4798.8  400    │                                     │
│   │  买3  4797.8  450    │                                     │
│   │  买4  4796.8  500    │                                     │
│   │  买5  4795.8  550    │                                     │
│   └──────────────────────┘                                     │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  [报单] [成交] [持仓] [资金] [止损单] [合约]                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    查询面板                              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 多窗口效果

```
┌─────────────────────────────────────────────────────────────────┐
│  主窗口 - 行情面板                                  ─  □  ✕    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  IF2608  4800.0  +12.0  [报单] [K线] [详情]            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  报单窗口 - IF2608                                  ─  □  ✕    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  合约: IF2608    最新价: 4800.0                         │   │
│  │                                                         │   │
│  │  方向: [买入] [卖出]                                    │   │
│  │  开平: [开仓] [平仓] [平今]                             │   │
│  │  价格: [4800.0] [-] [+]                                │   │
│  │  数量: [1]     [-] [+]                                  │   │
│  │                                                         │   │
│  │  有效期: [GFD] [FOK] [FAK]                              │   │
│  │                                                         │   │
│  │  [确认报单]                                             │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  K线窗口 - IF2608                                   ─  □  ✕    │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  [1m] [5m] [15m] [30m] [1h]                            │   │
│  │  ┌─────────────────────────────────────────────────┐   │   │
│  │  │            K线图 + 技术指标                      │   │   │
│  │  └─────────────────────────────────────────────────┘   │   │
│  │  [MA] [BOLL] [MACD] [KDJ] [RSI] [成交量]              │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

### 2.4 系统托盘菜单

```
┌─────────────────────────────┐
│  SimNow 交易终端            │
├─────────────────────────────┤
│  📊 显示主窗口              │
│  ─────────────────────────  │
│  📈 行情面板                │
│  📝 报单窗口                │
│  📋 查询窗口                │
│  📉 K线窗口                 │
│  ─────────────────────────  │
│  ⚙️ 设置                    │
│  ─────────────────────────  │
│  🚪 退出                    │
└─────────────────────────────┘
```

---

## 3. PR列表

### 阶段1：基础 Electron 集成

---

#### PR-E1: Electron 基础框架搭建

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E1 |
| **PR标题** | Electron 基础框架搭建 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | 无 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成（2026-07-28，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   ├── main.ts              # 主进程入口
│   ├── preload.ts           # 预加载脚本（IPC 桥接）
│   └── tsconfig.json        # Electron TypeScript 配置
├── electron-builder.json    # 打包配置
├── vite.config.ts           # 更新：添加 Electron 支持
└── package.json             # 更新：添加 Electron 脚本
```

**PR描述**：
搭建 Electron 基础框架，实现应用启动、主窗口创建、开发环境热重载。

**实现方式**：
1. 创建 `electron/main.ts` 主进程入口
2. 创建 `electron/preload.ts` 预加载脚本
3. 配置 Vite 支持 Electron 开发模式
4. 添加 npm scripts：`electron:dev`、`electron:build`
5. 配置 electron-builder 打包选项

**验收标准**：
- [x] `npm run electron:dev` 能启动 Electron 应用
- [x] 主窗口正确加载 React 应用
- [x] 开发模式支持热重载
- [x] 应用能正常关闭

**相关测试**：
- [x] 手动测试启动和关闭
- [x] 验证开发模式热重载

---

#### PR-E2: IPC 通信基础设施

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E2 |
| **PR标题** | IPC 通信基础设施 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E1 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成（2026-07-28，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   ├── ipc/
│   │   ├── index.ts         # IPC 接口定义
│   │   ├── window.ts        # 窗口相关 IPC
│   │   └── app.ts           # 应用相关 IPC
│   └── preload.ts           # 更新：暴露 IPC 接口
└── src/
    └── services/
        └── electron.ts      # 新增：Electron API 封装
```

**PR描述**：
建立 Electron 主进程与渲染进程之间的 IPC 通信基础设施，为后续多窗口功能做准备。

**实现方式**：
1. 定义 IPC 消息类型（TypeScript 接口）
2. 在 preload.ts 中暴露安全的 IPC 接口
3. 创建前端 Electron API 封装层
4. 实现基本的窗口控制 IPC（最小化、最大化、关闭）

**验收标准**：
- [x] 前端能通过 IPC 调用主进程功能
- [x] 类型安全的 IPC 接口
- [x] 窗口控制功能正常

**相关测试**：
- [x] IPC 消息发送和接收测试
- [x] 窗口控制功能测试

---

### 阶段2：多窗口管理

---

#### PR-E3: 窗口管理器实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E3 |
| **PR标题** | 窗口管理器实现 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E2 |
| **工作量** | 4小时 |
| **状态** | ✅ 已完成（2026-07-28，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   ├── windowManager.ts     # 窗口管理器
│   └── ipc/
│       └── window.ts        # 更新：窗口管理 IPC
└── src/
    ├── components/
    │   └── WindowManager/   # 新增：窗口管理 UI 组件
    │       └── index.tsx
    └── services/
        └── electron.ts      # 更新：窗口管理 API
```

**PR描述**：
实现窗口管理器，支持创建、关闭、切换多个窗口，每个窗口独立显示不同功能模块。

**实现方式**：
1. 创建 `WindowManager` 类管理所有窗口
2. 实现窗口创建（主窗口、报单窗口、查询窗口、K线窗口）
3. 实现窗口间通信（通过主进程中转）
4. 添加窗口状态持久化（位置、大小）
5. 前端添加窗口管理 UI（标签页、窗口切换）

**验收标准**：
- [x] 能创建多个独立窗口
- [x] 窗口间能正常通信
- [x] 窗口状态能持久化
- [x] 窗口关闭不影响其他窗口

**相关测试**：
- [x] 多窗口创建和关闭测试
- [x] 窗口间通信测试
- [ ] 窗口状态持久化测试

---

#### PR-E4: 报单窗口实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E4 |
| **PR标题** | 报单窗口实现 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E3 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成（2026-07-28，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   └── windows/
│       └── orderWindow.ts   # 报单窗口配置
└── src/
    ├── pages/
    │   └── OrderPage.tsx    # 报单页面（独立窗口版本）
    └── components/
        └── OrderWindow/     # 报单窗口组件
            └── index.tsx
```

**PR描述**：
实现独立的报单窗口，支持在新窗口中打开报单功能，与主窗口实时同步数据。

**实现方式**：
1. 创建报单窗口配置（窗口大小、位置）
2. 实现报单页面（独立窗口版本）
3. 添加窗口间数据同步（行情数据、持仓数据）
4. 支持从行情表格右键打开报单窗口
5. 支持从持仓列表点击打开报单窗口

**验收标准**：
- [x] 点击"报单"按钮能打开独立报单窗口
- [x] 报单窗口能实时显示行情数据
- [x] 报单窗口能正常提交报单
- [x] 报单结果能同步回主窗口

**相关测试**：
- [x] 报单窗口打开和关闭测试
- [x] 报单功能测试
- [ ] 窗口间数据同步测试

---

#### PR-E5: K线窗口实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E5 |
| **PR标题** | K线窗口实现 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E3 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成（2026-07-28，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   └── windows/
│       └── klineWindow.ts   # K线窗口配置
└── src/
    ├── pages/
    │   └── KLinePage.tsx    # K线页面（独立窗口版本）
    └── components/
        └── KLineWindow/     # K线窗口组件
            └── index.tsx
```

**PR描述**：
实现独立的 K 线窗口，支持在新窗口中打开 K 线图，支持多周期切换和技术指标。

**实现方式**：
1. 创建 K 线窗口配置（窗口大小、位置）
2. 实现 K 线页面（独立窗口版本）
3. 支持多周期切换（1m、5m、15m、30m、1h）
4. 支持技术指标切换（MA、BOLL、MACD、KDJ、RSI）
5. 支持从行情表格双击打开 K 线窗口

**验收标准**：
- [x] 双击合约能打开独立 K 线窗口
- [x] K 线图能正常显示
- [x] 周期切换正常工作
- [x] 技术指标切换正常工作

**相关测试**：
- [x] K 线窗口打开和关闭测试
- [x] K 线图显示测试
- [ ] 周期和指标切换测试

---

### 阶段3：系统集成

---

#### PR-E6: 系统托盘实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E6 |
| **PR标题** | 系统托盘实现 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E3 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成（2026-07-31，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   ├── trayManager.ts       # 系统托盘管理器
│   └── assets/
│       └── tray-icon.png    # 托盘图标
└── electron-builder.json    # 更新：添加图标资源
```

**PR描述**：
实现系统托盘功能，支持最小化到托盘、托盘菜单、托盘通知。

**实现方式**：
1. 创建 `TrayManager` 类管理托盘
2. 添加托盘图标（16x16、32x32）
3. 实现托盘菜单（显示主窗口、退出等）
4. 实现最小化到托盘功能
5. 添加托盘通知（报单成交、止损触发等）

**验收标准**：
- [x] 应用启动后显示托盘图标
- [x] 关闭窗口时最小化到托盘
- [x] 托盘菜单功能正常
- [x] 托盘通知能正常显示

**相关测试**：
- [x] 托盘图标显示测试
- [x] 最小化到托盘测试
- [x] 托盘菜单功能测试

---

#### PR-E7: 全局快捷键实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E7 |
| **PR标题** | 全局快捷键实现 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E6 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成（2026-07-28，2 commits） |

**提交文件**：
```
frontend/
├── electron/
│   └── shortcuts.ts         # 全局快捷键管理
└── src/
    └── services/
        └── electron.ts      # 更新：快捷键 API
```

**PR描述**：
实现全局快捷键功能，支持在应用外使用快捷键快速操作。

**实现方式**：
1. 注册全局快捷键（Ctrl+B 快速报单、Ctrl+K 打开K线等）
2. 快捷键配置持久化
3. 快捷键冲突检测
4. 前端快捷键设置界面

**验收标准**：
- [x] 全局快捷键能正常工作
- [x] 快捷键配置能持久化
- [x] 快捷键冲突能正确处理

**相关测试**：
- [x] 全局快捷键功能测试
- [x] 快捷键配置测试

---

#### PR-E8: 原生通知实现

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E8 |
| **PR标题** | 原生通知实现 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E6 |
| **工作量** | 2小时 |
| **状态** | ✅ 已完成（2026-07-31，4 commits） |

**提交文件**：
```
frontend/
├── electron/
│   └── notificationManager.ts  # 通知管理器
└── src/
    └── services/
        └── notification.ts     # 通知 API 封装
```

**PR描述**：
实现原生系统通知，支持报单成交、止损触发、连接断开等事件通知。

**实现方式**：
1. 创建 `NotificationManager` 类
2. 实现通知类型（信息、警告、错误）
3. 添加通知点击处理（打开对应窗口）
4. 通知历史记录
5. 通知设置（开启/关闭、声音）

**验收标准**：
- [ ] 报单成交时显示通知
- [ ] 止损触发时显示通知
- [ ] 连接断开时显示通知
- [ ] 点击通知能打开对应窗口

**相关测试**：
- [ ] 通知显示测试
- [ ] 通知点击处理测试

---

### 阶段4：打包发布

---

#### PR-E9: 应用打包配置

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E9 |
| **PR标题** | 应用打包配置 |
| **PR分支名** | `feature/electron-refactor` |
| **负责角色** | 角色B |
| **依赖PR** | PR-E8 |
| **工作量** | 3小时 |
| **状态** | ✅ 已完成（2026-07-31，4 commits） |

**提交文件**：
```
frontend/
├── electron-builder.json    # 完整打包配置
├── build/
│   ├── icon.ico             # Windows 图标
│   ├── icon.icns            # macOS 图标
│   └── icon.png             # Linux 图标
└── scripts/
    └── build-electron.js    # 打包脚本
```

**PR描述**：
配置应用打包，支持 Windows、macOS、Linux 三平台打包。

**实现方式**：
1. 配置 electron-builder 打包选项
2. 添加应用图标（ico、icns、png）
3. 配置安装程序（NSIS、DMG、AppImage）
4. 添加自动更新支持
5. 配置代码签名（可选）

**验收标准**：
- [ ] `npm run electron:build` 能生成安装包
- [ ] Windows 安装包能正常安装和运行
- [ ] macOS 安装包能正常安装和运行
- [ ] Linux 安装包能正常安装和运行

**相关测试**：
- [ ] 三平台打包测试
- [ ] 安装和卸载测试

---

#### PR-E10: Python 后端打包集成

| 项目 | 内容 |
|------|------|
| **PR编号** | PR-E10 |
| **PR标题** | Python 后端打包集成 |
| **PR分支名** | `feature/electron-python-packaging` |
| **负责角色** | 角色A + 角色B |
| **依赖PR** | PR-E9 |
| **工作量** | 4小时 |
| **状态** | ⏳ 待开始 |

**提交文件**：
```
frontend/
├── electron/
│   └── backendManager.ts    # 后端进程管理器
└── scripts/
    └── build-backend.py     # 后端打包脚本

server/
└── pyinstaller.spec         # PyInstaller 打包配置
```

**PR描述**：
将 Python 后端打包为独立可执行文件，集成到 Electron 应用中。

**实现方式**：
1. 使用 PyInstaller 打包 Python 后端
2. 创建后端进程管理器（启动、停止、重启）
3. 配置后端日志输出
4. 实现后端健康检查
5. 添加后端自动启动

**验收标准**：
- [ ] 应用启动时自动启动后端
- [ ] 后端能正常运行
- [ ] 应用关闭时自动停止后端
- [ ] 后端日志能正常查看

**相关测试**：
- [ ] 后端启动和停止测试
- [ ] 后端健康检查测试
- [ ] 应用完整性测试

---

## 4. 技术实现细节

### 4.1 Electron 主进程架构

```typescript
// electron/main.ts
import { app, BrowserWindow, Tray, Menu, globalShortcut } from 'electron';
import { WindowManager } from './windowManager';
import { TrayManager } from './trayManager';
import { BackendManager } from './backendManager';

class SimNowApp {
  private mainWindow: BrowserWindow | null = null;
  private windowManager: WindowManager;
  private trayManager: TrayManager;
  private backendManager: BackendManager;

  constructor() {
    this.windowManager = new WindowManager();
    this.trayManager = new TrayManager();
    this.backendManager = new BackendManager();
  }

  async initialize() {
    // 1. 启动 Python 后端
    await this.backendManager.start();

    // 2. 创建主窗口
    this.mainWindow = this.windowManager.createMainWindow();

    // 3. 初始化系统托盘
    this.trayManager.initialize(this.mainWindow);

    // 4. 注册全局快捷键
    this.registerGlobalShortcuts();
  }

  private registerGlobalShortcuts() {
    globalShortcut.register('CommandOrControl+B', () => {
      this.windowManager.openOrderWindow();
    });
  }
}

app.whenReady().then(() => {
  const simNowApp = new SimNowApp();
  simNowApp.initialize();
});
```

### 4.2 窗口管理器架构

```typescript
// electron/windowManager.ts
import { BrowserWindow, screen } from 'electron';
import path from 'path';

interface WindowConfig {
  id: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  parent?: BrowserWindow;
  modal?: boolean;
}

export class WindowManager {
  private windows: Map<string, BrowserWindow> = new Map();

  createMainWindow(): BrowserWindow {
    const { width, height } = screen.getPrimaryDisplay().workAreaSize;

    const mainWindow = new BrowserWindow({
      width: Math.min(1600, width),
      height: Math.min(1000, height),
      minWidth: 1200,
      minHeight: 800,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    mainWindow.loadURL(this.getLoadURL());
    this.windows.set('main', mainWindow);

    return mainWindow;
  }

  openOrderWindow(instrumentID?: string): BrowserWindow {
    const parent = this.windows.get('main');
    const orderWindow = this.createWindow({
      id: `order-${instrumentID || 'new'}`,
      title: `报单${instrumentID ? ` - ${instrumentID}` : ''}`,
      width: 500,
      height: 600,
      parent,
      modal: false,
    });

    orderWindow.loadURL(`${this.getLoadURL()}#/order/${instrumentID || ''}`);
    return orderWindow;
  }

  openKLineWindow(instrumentID: string): BrowserWindow {
    const klineWindow = this.createWindow({
      id: `kline-${instrumentID}`,
      title: `K线 - ${instrumentID}`,
      width: 1000,
      height: 700,
    });

    klineWindow.loadURL(`${this.getLoadURL()}#/kline/${instrumentID}`);
    return klineWindow;
  }

  private createWindow(config: WindowConfig): BrowserWindow {
    const window = new BrowserWindow({
      width: config.width,
      height: config.height,
      minWidth: config.minWidth,
      minHeight: config.minHeight,
      title: config.title,
      parent: config.parent,
      modal: config.modal,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        contextIsolation: true,
        nodeIntegration: false,
      },
    });

    this.windows.set(config.id, window);

    window.on('closed', () => {
      this.windows.delete(config.id);
    });

    return window;
  }

  private getLoadURL(): string {
    return process.env.NODE_ENV === 'development'
      ? 'http://localhost:5173'
      : `file://${path.join(__dirname, '../dist/index.html')}`;
  }
}
```

### 4.3 IPC 通信接口

```typescript
// electron/preload.ts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window:minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window:maximize'),
  closeWindow: () => ipcRenderer.invoke('window:close'),

  // 窗口管理
  openOrderWindow: (instrumentID?: string) =>
    ipcRenderer.invoke('window:open-order', instrumentID),
  openKLineWindow: (instrumentID: string) =>
    ipcRenderer.invoke('window:open-kline', instrumentID),

  // 应用信息
  getAppVersion: () => ipcRenderer.invoke('app:version'),
  getPlatform: () => ipcRenderer.invoke('app:platform'),

  // 后端管理
  restartBackend: () => ipcRenderer.invoke('backend:restart'),
  getBackendStatus: () => ipcRenderer.invoke('backend:status'),

  // 事件监听
  onOrderUpdate: (callback: Function) => {
    ipcRenderer.on('order:update', (_, data) => callback(data));
  },
  onNotification: (callback: Function) => {
    ipcRenderer.on('notification', (_, data) => callback(data));
  },
});
```

---

## 5. 依赖关系图

```
PR-E1 (基础框架)
  ↓
PR-E2 (IPC 通信)
  ↓
PR-E3 (窗口管理器)
  ↓
├── PR-E4 (报单窗口)
├── PR-E5 (K线窗口)
├── PR-E6 (系统托盘)
│     ↓
│   ├── PR-E7 (全局快捷键)
│   └── PR-E8 (原生通知)
└── PR-E9 (打包配置)
      ↓
    PR-E10 (Python 后端打包)
```

---

## 6. 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| Node.js 版本不兼容 | 高 | 升级到 Node.js 22+ |
| Python 后端打包失败 | 中 | 保持后端独立进程作为备选 |
| 跨平台兼容性 | 中 | 分平台测试，使用 electron-builder |
| 性能问题 | 低 | Electron 性能通常足够 |
| 安全风险 | 中 | 使用 contextIsolation，禁用 nodeIntegration |

---

## 7. 工作量估算

| 阶段 | PR数量 | 工时 | 复杂度 |
|------|--------|------|--------|
| 基础 Electron 集成 | 2 | 5小时 | ⭐⭐ |
| 多窗口管理 | 3 | 10小时 | ⭐⭐⭐ |
| 系统集成 | 3 | 6小时 | ⭐⭐ |
| 打包发布 | 2 | 7小时 | ⭐⭐⭐ |
| **总计** | **10** | **28小时** | |

---

## 8. 验收标准

### 8.1 功能验收

- [ ] 应用能正常启动和关闭
- [ ] 多窗口功能正常工作
- [ ] 系统托盘功能正常
- [ ] 全局快捷键功能正常
- [ ] 原生通知功能正常
- [ ] 应用能正常打包和安装

### 8.2 性能验收

- [ ] 应用启动时间 < 3秒
- [ ] 窗口切换流畅
- [ ] 内存占用 < 500MB
- [ ] CPU 占用正常

### 8.3 兼容性验收

- [ ] Windows 10/11 正常运行
- [ ] macOS 12+ 正常运行
- [ ] Linux (Ubuntu 20.04+) 正常运行

---

## 9. 后续优化

完成基础迁移后，可考虑以下优化：

1. **自动更新** — 使用 electron-updater 实现应用自动更新
2. **崩溃报告** — 集成 Sentry 或类似服务
3. **性能监控** — 添加性能监控和分析
4. **插件系统** — 支持用户自定义插件
5. **主题系统** — 支持深色/浅色主题切换
6. **多语言** — 支持中英文切换

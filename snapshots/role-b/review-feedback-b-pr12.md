# PR-12 Code Review 反馈

## 第 1 轮审查（初审）

**审查分支**：`feature/pr-12-kline-chart`
**审查 commit**：`2423a6c` ~ `e58cb3b`（10 commits）
**审查时间**：2026-07-16

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

1. **【KLineChart.tsx:71-72】日期格式化可能产生重复标签**
   - 现状：`new Date(d.timestamp).toLocaleString()` 使用本地时间格式化
   - 问题：当 K 线数据量大时，x 轴标签可能过于密集或重复
   - 建议：考虑根据周期（1m/5m/1d）调整日期格式：
     ```typescript
     const formatMap: Record<string, Intl.DateTimeFormatOptions> = {
       '1m': { hour: '2-digit', minute: '2-digit' },
       '5m': { hour: '2-digit', minute: '2-digit' },
       '1d': { month: '2-digit', day: '2-digit' },
     }
     const fmt = formatMap[period] ?? { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }
     const dates = klineData.map((d) => new Date(d.timestamp).toLocaleString(undefined, fmt))
     ```
   - 注意：需要将 `period` 参数传入 `buildOption` 函数

2. **【KLineChart.tsx:186-190】setOption 第二参数为 true 导致全量替换**
   - 现状：`instanceRef.current.setOption(buildOption(klineData), true)`
   - 问题：`true` 表示不合并选项，每次都是全量替换，可能导致图表闪烁
   - 建议：首次使用 `true`，后续更新使用 `false`（默认合并模式）：
     ```typescript
     const isInit = prevDataLenRef.current === 0
     instanceRef.current.setOption(buildOption(klineData), isInit)
     prevDataLenRef.current = klineData.length
     ```

3. **【MarketPanel.tsx:55-63】K 线数据获取缺少 loading 状态**
   - 现状：`getKlineData` 调用失败时静默忽略
   - 问题：用户无法感知数据加载状态
   - 建议：添加 loading 状态或错误提示（可选，不阻塞合入）

4. **【store.ts:63-75】appendKline 直接修改 existing 数组**
   - 现状：`existing[existing.length - 1] = candle` 直接修改了原数组
   - 问题：虽然 `next.set` 创建了新 Map，但内部数组引用未变，可能导致 React 不触发重渲染
   - 建议：创建新数组副本：
     ```typescript
     const updated = [...existing]
     updated[updated.length - 1] = candle
     next.set(instrument, updated)
     ```
   - 验证：当前代码 `next.set(instrument, [...existing])` 已创建新数组，实际无问题

---

### 🔵 疑问确认

1. **【KLineChart.tsx:61-68】MACD 计算公式确认**
   - 现状：`macd = (DIF - DEA) * 2`
   - 疑问：标准 MACD 柱状图公式为 `(DIF - DEA) * 2`，确认是否需要乘以 2？
   - 参考：通达信/同花顺等软件通常使用 `MACD = (DIF - DEA) * 2`

2. **【KLineChart.tsx:84-88】grid 布局百分比**
   - 现状：三个 grid 高度分别为 `50%`, `12%`, `12%`，总计 74%
   - 疑问：剩余 26% 空间用于什么？是否需要调整为更紧凑的布局？

3. **【MarketPanel.tsx:84-91】KLineChart 渲染条件**
   - 现状：`{selectedInstrument && <KLineChart ... />}`
   - 疑问：选中合约后立即渲染 K 线图，但数据可能尚未加载，会显示"暂无K线数据"
   - 确认：这是预期行为吗？是否需要等待数据加载完成再渲染？

---

### 审查结论

**✅ 通过**

**理由**：
1. 无阻断性问题，TypeScript 编译通过（0 errors）
2. 162 个测试全部通过（23 文件），覆盖：
   - KLineChart 组件渲染、周期切换、ECharts 初始化、MA/MACD 指标
   - store 的 klineData/setKlineData/appendKline
   - API 的 getKlineData
3. 功能完整性：K 线图、多周期、MA5/MA10/MA20、MACD（DIF/DEA/histogram）— 均已实现
4. TDD 开发流程完整：6 个循环，红→绿→重构
5. 代码质量：命名清晰、结构合理、ECharts 配置完整

**改进建议**：
- 上述 🟡 改进建议可在后续 PR 中逐步完善
- 特别是日期格式化和 setOption 合并模式优化

**下一步**：
请完成人工验证后切回开发窗口生成 PR 描述，执行合并操作。

**人工验证内容**：
```bash
# 1. 启动后端
cd server && python -m uvicorn main:app --reload --port 8000

# 2. 启动前端
cd frontend && npm run dev

# 3. 浏览器访问 http://localhost:5173

# 4. 验证以下内容：
#    - 选中合约后，下方显示 K 线图
#    - K 线图显示蜡烛图 + 成交量
#    - MA5/MA10/MA20 移动平均线正确显示
#    - MACD 指标（DIF/DEA/柱状图）正确显示
#    - 点击周期按钮（1m/5m/15m/30m/1h/日线）切换正常
#    - 当前周期按钮高亮
#    - 图表响应窗口大小变化
#    - 无合约选中时显示"暂无K线数据"
#    - 控制台无报错
```

---

## 第 2 轮审查（复审）

**审查分支**：`feature/pr-12-kline-chart`
**审查 commit**：`dc64da4`, `2f50134`（2 commits 修复）
**审查时间**：2026-07-16

---

### 🔴 阻断性问题（必须修改）

无

---

### 🟡 改进建议

无

**改进采纳确认**：

| 建议 | 状态 | 说明 |
|------|------|------|
| #1 日期格式化根据周期调整 | ✅ 已采纳 | 新增 `DATE_FORMAT_MAP`，1m/5m→`HH:mm`，1h→`MM-DD HH:mm`，1d→`MM-DD` |
| #2 setOption 合并模式优化 | ✅ 已采纳 | 新增 `prevDataLenRef`，首次全量替换，后续合并更新 |
| #3 K线 loading 状态 | 🟡 保留 | 审查已标注"可选"，建议在 PR-10 统一实现 |
| #4 appendKline 数组不可变 | ✅ 无需修改 | 已确认 `next.set(instrument, [...existing])` 创建新数组 |

---

### 🔵 疑问确认

无

**疑问回复确认**：

| 疑问 | 回复 |
|------|------|
| #1 MACD 公式 | `(DIF - DEA) * 2` 是国内期货软件标准公式（通达信/同花顺），保留 |
| #2 grid 布局 | 50%+12%+12%=74%，剩余用于间距、x轴标签、tooltip 空间 |
| #3 KLineChart 渲染条件 | 选中后立即渲染，"暂无K线数据"提供视觉反馈，数据加载后自动替换 |

---

### 测试验证

```
Test Files  23 passed (23)
     Tests  162 passed (162)
TypeScript  0 errors
```

---

### 审查结论

**✅ 通过**

**理由**：
1. 初审 4 个改进建议：2 个采纳并修复，1 个合理保留，1 个无需修改
2. 初审 3 个疑问全部回复，技术理由充分
3. TypeScript 编译通过，162 个测试全部通过
4. 修复内容：日期格式化优化、setOption 合并模式 — 代码质量提升

**下一步**：
请完成人工验证后切回开发窗口生成 PR 描述，执行合并操作。

**人工验证重点**：
- 切换不同周期（1m/5m/1d），确认 x 轴标签格式变化
- 多次切换周期，确认图表无闪烁（合并模式生效）

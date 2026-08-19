# SDD ledger — plan: docs/superpowers/plans/2026-08-07-query-panel-market-table-redesign.md

Task 1: 查询面板移除「合约」「K线」Tab
Task 2: 行情表格新增 合约乘数/最小变动价位 列 + 固定列宽

Branch: feature/table-refactor (baseline main @ 51c86b8, plan commits 7336dd4 + 2d049bb)

Task 1: minor (deferred): KLinePage.style.test.tsx:10 注释仍引用已删除的 .kline-query（prose-only，最终 review 前可选改写）
Task 1: complete (commits 2d049bb..b097c2f, review clean)

Task 2: minor (deferred): MarketTable.test.tsx:161 状态列 style 调用硬编码 col:4（现列序 index 6），inert，最终 review 前可选更新
Task 2: minor (deferred): MarketTable.tsx 新列 volumeMultiple/priceTick 无 PLACEHOLDER 回退（ContractInfo 必填 number，brief 规定，语义正确）
Task 2: complete (commits b097c2f..02ee649, review clean)

Iteration (user feedback after final review): 调大列宽 1175→1460px；scrollStyle width:12 + scrollSliderColor #4a9eff 高亮；新增 scrollStyle 断言测试；同步设计文档
Iteration complete: 9ef0133 (commit), full suite 1049 pass, tsc clean
Bug (user feedback): 拖拽底部进度条被误判为选择邻近合约 → 根因 getRowFromEvent 未排除滚动条条带（横向进度条覆盖末行 / 纵向滚动条 y 恒命中某行）。修复：getRowFromEvent 排除 bottom/right SCROLLBAR_SIZE(12) 条带；新增 2 条回归测试（红→绿）。注：列宽已被外部调整为 110/85/75/85/110/100/80/110/100/100/110/110/110/110/60（用户改，未回退）
Consistency (user feedback): 自选合约复用 MarketTable 自动生效；T型期权 TQuoteTable 改 standard + 明显滚动条（选项 A，保持期权列宽 70-90 不变）；滚动条主题抽为共享 vtableTheme.ts（SCROLLBAR_SIZE/PROMINENT_SCROLL_STYLE）两表共用；设计文档列宽表同步为用户手工值（≈1455px）
Final review (fable, 51c86b8..02ee649): Ready to merge: Yes — 无 Critical/Important。
Final review parked (minor, 均不 block merge):
- KLinePage.style.test.tsx:10 注释仍引用已删除的 .kline-query（prose-only）— ruling: 无害，仅误导未来读者，可留
- MarketTable.test.tsx:143,161 styleArg 硬编码 col:4（状态列现 index 6）— ruling: inert（statusStyle 只读 args.row），可留或顺手改
- MarketTable.tsx 新列无 PLACEHOLDER 回退 — ruling: brief 规定，ContractInfo 必填 number，后端恒序列化，无回归
- docs/superpowers/specs/2026-08-07-query-panel-market-table-redesign-design.md:3 分支字段写 fix/vtable_enc 实为 feature/table-refactor — ruling: docs 溯源笔误，收尾可一并改
Final review: clean（4 parked minors，无 load-bearing）
Task 2: complete (commits 51c86b8..02ee649, final review yes)

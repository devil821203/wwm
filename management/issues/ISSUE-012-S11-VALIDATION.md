# ISSUE-012 S11 驗收修正

狀態：CLOSED；日期：2026-11-18

- 初步型別檢查：測試使用錯誤欄位 equippedItems；已改 equipmentIds，待集中回歸。
- 集中 format:check 失敗：新增 simulation.spec.ts 格式未穩定；再次 Prettier 後重跑。
- 日誌：management/tests/logs/S11-typecheck.log、S11-format-check.log；後續重跑日誌另存。
- 集中 typecheck 失敗：App union 尚缺 simulation，已修正；補強含裝備面板也獨立驗證裝備合法性。
- 完整E2E：32通過、2失敗；output 隱含 status 角色與進度角色衝突，模擬已完成但 locator 不唯一。替進度加可存取名稱並精確定位，未放寬時間門檻。增加含裝備面板合法性與四種互斥結果邊界測試。
- 補強測試型別修正：slotId 為 optional 而非 nullable，改用 delete 模擬未知部位；型別失敗後未進後續驗收。
- 視覺語義修正：累積傷害改階梯線避免暗示命中前持續傷害；每個預估依賴明示「預估值」，補來源標示與未知時隱藏圖表的UI測試。完整306項及34項E2E已先通過，顯示修改後執行受影響驗收。
- 顯示修正後format:check提示新增README段落格式；先格式化README後再驗，未進後續命令。
- 數值邊界檢查：完整傷害有限不代表除以毫秒時間窗後DPS有限；補DPS與Welford統計溢位阻擋及合成極值測試，避免Infinity經JSON變null卻保留可計算標記。

結案：最後 format:check/lint/typecheck/test/build/test:e2e 全PASS；308項單元/整合、34項E2E。日誌S11-acceptance-*，無未解功能阻塞。
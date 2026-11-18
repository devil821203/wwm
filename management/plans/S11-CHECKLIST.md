# S11 準備與驗收清單

- 前置 S10 DONE；已閱讀完整 PRD、架構、資料治理、模型、驗收、任務、V1.3、fixtures 與來源更新政策。
- 程式：命中分布、共用事件引擎抽樣、版本化 PRNG、DPS 統計、Worker、進度/取消、圖表與可重現快照。
- 測試：固定 seed/不同 seed、期望與抽樣、零值、未知/推估、Buff/DOT 共用規則、Worker 與 UI、桌面/手機 E2E。
- 集中命令：format:check、lint、typecheck、test、build、test:e2e；實際結果後填 TEST-RUNS。
- 真實係數與實測仍缺，合成資料不得發布為遊戲 DPS。

## S11 最終結果：DONE
- format:check、lint、typecheck、test、build、test:e2e 全PASS，日誌S11-acceptance-*。
- 資料161、數值45、戰鬥35、Web67，共308項；桌面/手機各17，共34項E2E。
- 固定seed/JSON重播、四種命中結果與邊界、解析期望、Buff/DOT一致、零值/未知/推估/合法性/溢位、進度/取消/重啟/卸載及舊訊息隔離已覆蓋。
- 來源與估計依賴、階梯圖、備份來源不變、完整模擬快照及雙版面無溢出已驗。
- ISSUE-012 CLOSED；外部真實係數與實測缺失明示，非本步合成機制驗收阻塞。下一步S12，尚未開始。

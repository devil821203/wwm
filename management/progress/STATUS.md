# 開發進度

> 2026-11-18：S01–S13 已通過本機集中驗收；S14 部分完成並因流派機制資料缺失 BLOCKED。此狀態不代表完整模擬器已完成。

| 步驟 | 功能 | 狀態 | 最近測試 | 備註 |
|---|---|---|---|---|
| S01 | F01 | DONE | 2026-11-17：Lint/型別/單元/建置/E2E 通過 | 初始化 pnpm monorepo、React Vite TS、格式化、Lint、Vitest、Playwright、CI |
| S02 | F02 | DONE | 2026-11-17：契約 51 項、首頁 2 項、E2E 2 項及建置通過 | 建立流派/版本/等級/屬性/裝備/技能 Zod schema 與資料契約 |
| S03 | F02 | DONE | 2026-11-17：資料套件100項、首頁2項、E2E2項及建置通過 | 建資料來源、明確值/推估/未知、覆寫、資料匯入與審核機制 |
| S04 | F03 | DONE | 2026-11-17：資料115項、Web13項、E2E8項與建置通過 | 角色、Build、IndexedDB 儲存、JSON 匯入匯出 |
| S05 | F04 | DONE | 2026-11-17：資料120項、Web30項、E2E12項及建置通過 | 統一裝備資料模型與手動編輯、截圖上傳及人工校對 UI |
| S06 | F04 | DONE | 2026-11-17：資料123項、Web48項、E2E16項及建置通過 | 同源本機OCR／文字adapter、信心與原文證據、人工修正保護 |
| S07 | F05 | DONE | 2026-11-17：資料158項、Web52項、E2E18項及建置通過 | 品質基礎值、承音實值優先/模型回退、當階MAX與合法性、原值保留及推估標示 |
| S08 | F06 | DONE | 2026-11-17：資料161項、數值32項、Web54項、E2E22項及建置通過 | 獨立stat-engine、來源屬性合成、單技能版本化期望值與快照；DPS仍待循環模擬 |
| S09 | F06 | DONE | 2026-11-17：資料161項、數值45項、Web60項、E2E26項；最終受影響4項通過 | 技能變體/事件契約、鳴金·虹實測快照與誤差比較；真實係數/三組實測仍缺 |
| S10 | F07 | DONE | 2026-11-18：資料161項、數值45項、戰鬥26項、Web64項、E2E32項及建置通過 | 事件佇列、固定/優先序循環、冷卻/資源/切換/Buff/DOT與來源；DPS留S11 |
| S11 | F07 | DONE | 2026-11-18：資料161項、數值45項、戰鬥35項、Web67項、E2E34項及建置通過 | 期望DPS/逐命中Monte Carlo、seed、Worker進度取消、圖表/來源快照；僅合成驗收 |
| S12 | F05 | DONE | 2026-11-18：資料170項、數值45項、戰鬥35項、Web70項、E2E38項及建置通過 | 四模式生成/詞條合法性、MAX/承音、統一入庫/配裝送模擬；滿值候選未排名，見ADR-013 |
| S13 | F08 | DONE | 2026-11-18：資料170項、數值47項、戰鬥35項、最佳化9項、Web74項、E2E42項及建置通過 | 小型枚舉/Beam+局部搜尋、Top-K完整重算、部位/成本/屬性/套裝約束、Worker取消與另存配置；證明限候選範圍 |
| S14 | F09 | BLOCKED | 2026-11-18：部分功能 339 項單元整合、42 項 E2E 通過 | 通用必要 handler 防護與合成回歸完成；真實流派機制缺失，見 ISSUE-016 |
| S15 | F10 | NOT_STARTED | 未執行 | 逐合法等級、三裝備情境、三敵人情境推估與圖表 |
| S16 | F11 | NOT_STARTED | 未執行 | 資料版本 diff、全站 E2E、效能、授權、文件與發布 |
| S17 | F12 | NOT_STARTED | 未執行；U01–U10 NOT_RUN | 來源更新、快照/hash、差異/審核、manifest 與回滾；依賴見 DEPENDENCIES.md |

允許狀態：NOT_STARTED、READY、IN_PROGRESS、TESTING、FIXING、BLOCKED、DONE。

## SPEC-V1.1 — 規格整合
- 狀態：DONE（僅規格整合；來源更新功能尚未實作）
- 範圍：整合來源更新政策、來源註冊表、F12/S17 與驗收對照，不實作來源更新器。
- 前置：S01、S02 已 DONE；已完整閱讀新來源政策與登錄表。
- S01/S02 保留既有驗收結論；S03–S16 不重設或提前完成，S17 待開發。

- 驗收：來源包／匯入／既有檔案雜湊、歷史前綴、JSON／狀態／連結及 format:check 通過；見 TEST-RUNS 的 SPEC-V1.1。







## 2026-11-19：G: 專案損壞還原（未完成）

使用者將專案移至 G:\git\wwm\WWM_Codex_Managed_Project。七個損壞檔已原樣備份至 management/recovery/2026-11-19-originals，逐一以 SHA-256 比對備份與來源一致。G:、D: 副本及 wwm.zip 中可找到的三個資料模型皆含無效 UTF-8，沒有找到四份受損測試的完整原始備份。

packages/game-data/src/{equipment-rules,player-entities,rotation-schemas}.ts 已由現存 dist JavaScript 與型別宣告重建，並補回型別；不是逐字還原。此程序不能證明編譯成果本身完全無損或重建的來源與原文一致。

原有 pnpm-store-s13 的資料損壞，且搬移後套件連結失效；依 pnpm-lock.yaml 使用 .tools/pnpm-store-recovery 全新快取重建套件連結（--frozen-lockfile --ignore-scripts）。原本離線安裝失敗，原快取線上補缺仍遇損壞 JSON。

pnpm --filter @wwm/game-data typecheck：通過；pnpm --filter @wwm/game-data test：10 個測試檔、172 項通過。pnpm typecheck：失敗，combat-engine/src/engine.test.ts 為二進位／無效字元。其餘損壞測試為 apps/web/src/rotation/rotation-storage.test.ts、apps/web/src/rotation/RotationWorkspace.test.tsx、tests/e2e/measurement.spec.ts；保留原狀，尚未驗收全專案。ISSUE-018 維持 OPEN；S14 狀態不變。
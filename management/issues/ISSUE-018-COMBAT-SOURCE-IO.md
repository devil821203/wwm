# ISSUE-018：戰鬥引擎來源目錄無法讀取

狀態：OPEN；發現日期 2026-11-19。查詢專案資料時 rg 回報 packages/combat-engine/src「檔案或目錄損毀而且無法讀取」（OS error 1392）。目前尚未確認受影響範圍、原因或修復方式；不刪除、覆寫或重建目錄。需先檢查檔案系統狀態及可用備份，修復後執行受影響回歸。使用者截圖辨識紀錄仍可讀取；不要宣稱本次計算引擎測試通過。

2026-11-19 調查：combat-engine/src 目錄項目存在，但列舉時 Windows 回報「The file or directory is corrupted and unreadable」，HRESULT -2147023504（Win32 1392）；不是已證實使用者刪檔。combat-engine/dist 可列舉，含 engine.js、queue.js、simulation.js 與型別宣告，但不能視為完整 TypeScript 原始碼及測試備份。
同次 rg 掃描也回報 apps/web、tests/e2e、management/tests/artifacts、management/tests/logs 無法讀取，影響不只 combat-engine。工作目錄沒有可讀取的 .git 項目，未找到可用的本機 Git 歷史。Get-PhysicalDisk 回報所有列出的實體磁碟 Healthy／OK，但這不證明 NTFS 資料完整，也無法判斷實際損毀成因。
fsutil dirty query D: 回報 Access is denied；唯讀 chkdsk D: 回報權限不足或磁碟鎖定，未完成檢查，亦未執行 /f 或任何修復。建議先備份仍可讀的資料，尤其原始截圖與專案，再由 Windows 管理員檢查磁碟及確認修復方案；修復前不覆寫、搬移或重建受影響目錄。ISSUE-018 維持 OPEN。

## 2026-11-19：G: 專案損壞還原（未完成）

使用者將專案移至 G:\git\wwm\WWM_Codex_Managed_Project。七個損壞檔已原樣備份至 management/recovery/2026-11-19-originals，逐一以 SHA-256 比對備份與來源一致。G:、D: 副本及 wwm.zip 中可找到的三個資料模型皆含無效 UTF-8，沒有找到四份受損測試的完整原始備份。

packages/game-data/src/{equipment-rules,player-entities,rotation-schemas}.ts 已由現存 dist JavaScript 與型別宣告重建，並補回型別；不是逐字還原。此程序不能證明編譯成果本身完全無損或重建的來源與原文一致。

原有 pnpm-store-s13 的資料損壞，且搬移後套件連結失效；依 pnpm-lock.yaml 使用 .tools/pnpm-store-recovery 全新快取重建套件連結（--frozen-lockfile --ignore-scripts）。原本離線安裝失敗，原快取線上補缺仍遇損壞 JSON。

pnpm --filter @wwm/game-data typecheck：通過；pnpm --filter @wwm/game-data test：10 個測試檔、172 項通過。pnpm typecheck：失敗，combat-engine/src/engine.test.ts 為二進位／無效字元。其餘損壞測試為 apps/web/src/rotation/rotation-storage.test.ts、apps/web/src/rotation/RotationWorkspace.test.tsx、tests/e2e/measurement.spec.ts；保留原狀，尚未驗收全專案。ISSUE-018 維持 OPEN；S14 狀態不變。
## 2026-11-19 損壞測試重建：S09 暫時阻塞，S10 進行中

S09 受損 measurement.spec.ts 已按方案重寫：單技能實測與備份還原、60 秒觀察；均使用合成資料。`pnpm --filter @wwm/optimizer... build` 與 `pnpm --filter @wwm/web exec vite build` 通過；`pnpm exec playwright test tests/e2e/measurement.spec.ts`：桌面及手機共 4 項通過。正式完整驗收受 S10 的損壞測試阻塞，不宣稱 S09 重建結案。恢復條件：S10 測試重建後重跑全專案集中驗收。可繼續：修復依賴 S10 的受損測試。

S10 測試重建狀態 IN_PROGRESS：重建 combat-engine/src/engine.test.ts、apps/web/src/rotation/rotation-storage.test.ts、RotationWorkspace.test.tsx；涵蓋事件順序、冷卻資源、窗口、Buff/DOT、優先序、保存與還原，沿用合成 fixture，原檔已有備份。完成後集中測試並記錄實際結果。
## 2026-11-19：S09／S10 損壞測試重建驗證

已重寫四個損壞測試：S09 measurement.spec.ts；S10 engine.test.ts、rotation-storage.test.ts、RotationWorkspace.test.tsx。戰鬥測試保留損壞檔開頭可讀部分，並補寫時間窗、版本／未知值、武器切換、Buff／DOT、快照／動態及優先序等合成案例。原始七個損壞檔仍保存在 management/recovery/2026-11-19-originals；無完整備份，不能聲稱重寫測試逐字還原或已恢復原有全部 26 項 S10 戰鬥測試覆蓋，ISSUE-018 保持 OPEN，需逐項稽核其餘原驗收邊界。

環境：Windows、G: 專案、Node.js 22.14.0、pnpm 10.6.5、Chromium 桌面／手機。實際結果：`pnpm format:check` 通過；`pnpm lint` 通過；`pnpm typecheck` 通過；`pnpm test` 332 項通過（資料 172、數值 48、戰鬥 29、最佳化 9、Web 74）；`pnpm build` 通過；`pnpm test:e2e` 42 項通過。日誌在 management/tests/logs/recovery-2026-11-19/。最初格式檢查因原始快照及辨識紀錄、Lint 因備份損壞檔與未用參數失敗；修正檢查範圍與測試後重跑通過。首次 DOT 測試事件名稱與型別檢查失敗，修正後通過。重寫測試不等於正式遊戲資料驗證，S14 維持 BLOCKED，S15–S17 狀態不變。
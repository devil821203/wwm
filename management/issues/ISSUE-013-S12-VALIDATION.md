# ISSUE-013 S12 驗收修正

狀態：CLOSED；日期：2026-11-18

- 初步型別檢查：版本欄位應為label、valueStatusLabel應接收完整ResolvedValue，已修正；日誌S12-preliminary-typecheck.log。
- PowerShell修正指令字串解析失敗，整段未執行；改正引號後重送成功，未繞過審查。
- 集中format:check：新增E2E需再次Prettier，失敗後未進後續測試；S12-format-check.log。
- 微調原件的onlyExplicit保留；補E2E另存微調後原件及derivedFromId檢查。
- 集中資料單元測試170項中3失敗：手動模擬設定缺少confirmation.evidenceIds必填項。新增可對回generation.requestJson的scenario稽核ID，並留在裝備evidenceIds，未放寬契約。指令引號失敗未執行，已用PowerShell原生雙引號修正。

結案：S12-retest2-*中format:check/lint/typecheck/test/build/test:e2e全部PASS；320項單元/整合、38項E2E。無未解功能阻塞，真實資料仍缺，未宣稱DPS最優。
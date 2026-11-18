# ISSUE-004：S04 測試 API 與格式檢查
日期：2026-11-17；步驟：S04；狀態：CLOSED（格式/型別/建置/Web13項與E2E8項重驗通過）。
分類：測試程式型別／格式。
實際結果：format:check 回報 characters.spec.ts 格式；typecheck/build 因 Testing Library getByRole 不支援 exact 選項而失敗。資料套件115項及Web13項實際執行通過。
修正：Testing Library 改用精確字串 name（預設即精確），保留 Playwright 支援的 exact 選項；重新格式化。
首輪建置失敗後的 E2E 使用舊產物，不採為 S04 驗收，已停止；先建置通過再重跑全部 E2E。
重驗：格式、Lint、typecheck、Web測試、build及E2E；實際結果見TEST-RUNS。

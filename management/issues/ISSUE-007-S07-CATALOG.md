# ISSUE-007：S07 驗收前既有流派名冊不可解析
狀態：CLOSED
發現：2026-11-17，實作完成後pnpm.cmd format失敗；packages/game-data/src/data/path-candidates.json含二進位內容，非合法JSON。本輪S07未修改此檔，原因未確認。
原檔SHA256：93877f8659eef8d6ef42020810a11d74ce7e67130041ff8c15aa5d637ab72554，3471bytes；原始位元組保存tests/artifacts/S07-path-candidates-invalid.bin。
修復依據：上次成功建置dist/data/path-candidates.json可解析，且node assert.deepEqual確認與requirements/schemas/paths.json完全相同；需求原件與V1.1原始輸入包hash亦一致。
修正：從經比對的dist副本還原；無新增或推估流派/遊戲資料。
驗證：待集中重驗，實際結果見TEST-RUNS及S07日誌。
重驗：format:check及lint通過；typecheck發現node_modules內Vitest的benchmark/config兩份宣告檔也為二進位。屬同輪環境檔案完整性問題；以既有鎖檔重建依賴後再驗，尚未執行單元/建置/E2E。

結案：格式/Lint/型別/資料158項/Web52項/建置/桌面手機E2E18項通過，見S07-*-complete.log。名冊異常成因未確認，修復及回歸結果不代表已找到成因。

# ISSUE-003：S03 測試資料的 discriminated union 型別
日期：2026-11-17；步驟：S03；狀態：CLOSED（型別、資料套件100項、Lint/格式重驗通過）。
實際失敗：pnpm.cmd typecheck exit 2，value-resolution.test.ts 將回傳 ResolvedValue union 的 fixture 展開後另加 sourceIds，TS2322 指出 UNKNOWN 分支不接受來源欄位。
分類：測試程式型別錯誤；執行時 100 項資料套件測試已通過，不代表型別驗收通過。
修正：以明確 RECORDED literal 建立該筆同值官方來源 fixture，不改變產品解析邏輯。
重驗：typecheck、game-data test、lint/format:check。實際結果見 TEST-RUNS 與 S03 retry 日誌。

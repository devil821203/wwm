# ISSUE-002：CSS 字元編碼造成格式檢查失敗
日期：2026-11-17；步驟：S01；狀態：CLOSED（修正後格式、建置與 E2E 通過）。
實際結果：format/format:check 回報 styles.css 第 38 行 Unclosed string；Lint、TypeScript 與 2 個 Vitest 測試通過。
原因：Windows PowerShell 未指定 UTF8 讀回 CSS，圓點字元造成錯誤編碼。
修正：改用 UTF8 讀寫與 CSS Unicode escape。
重驗：format:check、build 與桌面/手機 production E2E；日誌見 TEST-RUNS。

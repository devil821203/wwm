# ISSUE-001：Windows 工具鏈不可直接啟動
日期：2026-11-17；步驟：S01；狀態：CLOSED（集中驗收通過）。
實際失敗：where.exe 找不到 node/npm/pnpm；初次安裝指令呼叫 pnpm.ps1 遭 PowerShell ExecutionPolicy 拒絕。
修正：專案內下載官方 Node 可攜版本並核對 SHA256，安裝本機 pnpm；Windows 指令改用 pnpm.cmd，不更改系統執行政策。
影響：僅本機開發啟動方式；Linux CI 繼續使用 pnpm。
驗收：重新執行依賴安裝與全部 S01 檢查，結果見 TEST-RUNS。

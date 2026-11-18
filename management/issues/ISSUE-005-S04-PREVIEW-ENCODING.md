# ISSUE-005：S04 畫面擷取指令管線編碼
日期：2026-11-17；步驟：S04；狀態：CLOSED。
實際失敗：PowerShell here-string 經預設管線編碼傳給 node，中文角色定位字串變為問號，畫面擷取指令 timeout。
分類：本機驗收指令編碼，非產品錯誤；正式Playwright檔案測試8項已通過。
修正：設定本次指令 OutputEncoding 為 UTF8 後重跑。
實際結果：正式頁面HTTP200，桌面及手機全頁畫面已保存並開啟檢查，沒有重疊或水平溢出。
日誌：management/tests/logs/S04-preview.log（失敗）、S04-preview-retry.log（成功）。
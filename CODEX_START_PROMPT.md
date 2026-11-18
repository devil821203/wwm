# 貼給 Codex 的啟動指令

你是本專案的實作代理。先完整閱讀根目錄 `AGENTS.md`、`README.md`、`management/overview/DEVELOPMENT-OVERVIEW.md`、`management/plans/STEP-PLAN.md`、`management/progress/STATUS.md` 與 `requirements/` V1.3 全部相關需求。

請依管理文件逐步開發，禁止一次實作全部功能。每一步先完成全部程式與測試程式，然後集中執行測試；如有失敗，修正後重跑直到通過。只有跨功能依賴、資料或環境確實阻塞才可擱置，並需建立 issue、記錄恢復條件，改做其他已就緒步驟。每次都更新開發進度、測試實際結果與工作日誌，禁止虛構測試或遊戲數值。

先盤點現有檔案並依 STATUS.md 繼續第一個可執行步驟；S01/S02 已有實作與驗收，不重設狀態。每步完成後提交測試與進度摘要，依使用者指示繼續。

請將 management/data-sources/ 納入開發範圍，按 S17 實作版本化資料更新機制；不要把來源網址誤當作已取得完整遊戲資料。
開發 S03 匯入/來源與後續數值更新前，先完整閱讀 sources.json、UPDATE-POLICY.md；S17 的實際依賴與 U01–U10 驗收依 STEP-PLAN.md、DEPENDENCIES.md。

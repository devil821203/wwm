# 燕雲十六聲國際服 DPS 模擬器 — Codex 管理式開發專案

此為**開發管理骨架，不是已完成的遊戲模擬器**。完整需求在 `requirements/`（V1.3），開發管理與紀錄在 `management/`。

## 開始
1. Codex 先讀 `AGENTS.md`、`management/overview/DEVELOPMENT-OVERVIEW.md`、`management/plans/STEP-PLAN.md` 與 `requirements/README.md`。
2. 依 `management/progress/STATUS.md` 找第一個可執行步驟；同時只處理一個步驟。
3. **先完成該步驟全部程式修改，然後集中測試**。失敗時修正並重跑該步驟相關測試，直至通過或因明確跨功能依賴而擱置。
4. 每輪更新進度、測試報告、問題單與決策紀錄；不得把未執行測試記為通過。
5. 所有遊戲數值：資料庫明確值優先；缺值可推估但 UI 明示預估；未知且無可用模型不得輸出 DPS。

## 管理目錄
- `management/overview/`：開發總覽、功能清單、里程碑、依賴
- `management/plans/`：逐步開發明細、每步完成條件
- `management/progress/`：狀態與執行日誌
- `management/tests/`：測試計畫與逐次實際結果
- `management/issues/`：缺陷與依賴阻塞
- `management/decisions/`：架構決策與需求衝突處理
- `management/templates/`：可複製的工作紀錄範本

需求優先序：`requirements/docs/09` > `08` > `07` > 其餘 V1.3 文件；管理流程以 `AGENTS.md` 為準。

## V1.1 資料來源更新
`management/data-sources/` 新增來源註冊表、更新政策、來源審核表、測試案例與更新日誌。這些是**開發規格**，不是已完成的自動抓取器，也未包含第三方受授權限制的資料集。

# ADR-003：管理規格 V1.1 整合
日期：2026-11-17；狀態：採用；範圍：SPEC-V1.1。
來源包位於 WWM_Codex_Managed_Project_V1.1/，逐檔比較結果與原始 SHA-256 見 V11-INTEGRATION-MANIFEST.json。

## 基線與保留
新包 V1.1 是管理規格版本；遊戲需求仍 V1.3，所有 requirements 檔案與現有相同。不是退回遊戲需求 V1.1。
僅匯入 5 個新來源管理檔案，合併 AGENTS/README/啟動指令/F12/S17；不覆蓋初始化版 STATUS、CHANGELOG、TEST-RUNS、ADR-INDEX、BLOCKERS。
既有 S01/S02 完成證據有效；S03–S16 與新增 S17 均未開始。原始來源包維持不動，format 忽略該目錄。

## 依賴補全
新包未在 STATUS/DEPENDENCIES 增列 S17，且前置僅寫功能描述。以既有步驟對應為 S01/S02/S03（資料與匯入），加上正式回歸所需 S07/S09/S11/S14。
這是對新規格的實作對照，非來源包原文；不假設 S17 一定要等 S16，不製造循環。S16 原依賴維持不變。

## 衝突與邊界
UPDATE-POLICY 對下游結果概稱「預估值」，docs/09 明定欄位「預估值」、衍生 DPS「包含預估資料」；依既有優先序採 docs/09。保留原政策文字並由此決策說明。
來源登錄 sources.json 的 access/license_status 是未審核候選資訊，不是 S02 SourceSchema 或 RECORDED 證據。S03 才實作轉換/證據/版本映射，不能自動提升授權與可信狀態。
4 個登錄來源並非排除 requirements/docs/03 的其他參考來源；新增候選仍須先登錄及審核。
啟動指令舊有「從 S01 開始」與實際狀態不符，改以 STATUS 續作。
本次只整合規格，不實作 S03/S17、不連線第三方、不建立快照、不發布資料、不把 U01–U10 標為 PASS。
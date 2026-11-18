# ADR-002：版本化資料契約與需求衝突
日期：2026-11-17；狀態：採用；步驟：S02。
- packages/game-data 是 Zod 與推導型別的單一入口，嚴格拒絕未定義欄位，不將拼錯的來源欄位靜默丟棄。
- 遊戲版本使用資料中的 gameVersionId，與契約 schemaVersion 分開；合法等級可為空或非連續，不硬編最高等級。
- UNKNOWN 使用 null，RECORDED 需來源，MANUAL_CONFIRMED 需確認紀錄，ESTIMATED 需模型版本/公式/輸入/依據/日期；0 與小數原值均保留。這些是結構證據，不等同來源已審核或實值已驗證。
- 裝備一個 EquipmentInstance schema，來源僅 creationMethod；原始 observation、當前 current、模擬 effective、理論 maximum 各自保存；品質/階級/調律狀態獨立，不預設承音倍率。
- requirements/examples/build.example.json 的 ownedEquipment/virtualEquipment 與 docs/08、09 衝突，依優先序拒絕舊分型。歷史範例保留，避免誤認為可匯入的新契約；Build 與遷移在 S04 實作。
- requirements/schemas/game-data.schema.json 是概念範例，舊 version 欄位由新的 gameVersionId 明確取代；不宣稱能直接匯入舊資料。
- requirements/schemas/paths.json 僅候選名冊：保留原文與待核標籤，無遊戲版本、等級或係數，不包裝成正式版本資料。
- 發行資料包驗證唯一性、外鍵、內嵌數值版本與來源引用；僅保證結構一致，來源授權/審核/覆寫留給 S03，完整合法詞條檢查留給 S07。
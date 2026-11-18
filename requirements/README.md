# Where Winds Meet 國際服 DPS / 配裝最佳化 — Codex 開發包

目標：完整支援國際服各流派、所有可用角色等級的**有標示可信度的 DPS 推估**、實際裝備庫存、理想裝備生成、技能循環與裝備最佳化。第一個可驗證流派為「鳴金·虹」。

## Codex 開始方式
1. 先閱讀 `docs/01-PRD.md`、`docs/02-ARCHITECTURE.md`、`docs/03-DATA.md`、`docs/04-MODEL.md`、`docs/05-ACCEPTANCE.md`、`docs/06-CODEX-TASKS.md`。
2. 依 `docs/06-CODEX-TASKS.md` 的工作順序實作；每階段先跑測試再提交。
3. 不可編造遊戲傷害係數、等級上限、裝備詞條或宣稱推測值為實測值。缺失資料必須標示 `UNKNOWN` / `ESTIMATED`。
4. 先完成鳴金·虹端到端，再以同一資料契約覆蓋其餘流派；未驗證流派也須可建立角色、配裝、選級與查看「尚無可信 DPS」狀態。
5. 不自動抓取需登入、受限制或未授權的遊戲資料；僅使用合法取得且標示出處的資料。

## 目錄
- `docs/01-PRD.md`：完整需求及畫面
- `docs/02-ARCHITECTURE.md`：技術與模組
- `docs/03-DATA.md`：匯入、覆寫、資料品質
- `docs/04-MODEL.md`：等級 DPS 預測及理想裝備
- `docs/05-ACCEPTANCE.md`：驗收與測試
- `docs/06-CODEX-TASKS.md`：分階段 Codex 工作指令
- `schemas/paths.json`：11 條已整理流派（中文未核實者明示）
- `schemas/game-data.schema.json`：資料契約範例
- `examples/build.example.json`：非真實數值的角色樣本
- `tests/fixtures.md`：測試情境

## V1.1 裝備輸入需求變更
裝備建立採**截圖匯入或手動輸入，不要求玩家先分類**。新增 `docs/07-EQUIPMENT-INPUT.md`：截圖辨識與人工確認、紫裝／承音／調律條件下的版本化合法數值、滿值套用、實際與理想裝備分離。Codex 必須同時執行 Task 2A 與 Task 5A。

## V1.2 優先修正（覆蓋 V1.1 衝突條文）
閱讀 `docs/08-EQUIPMENT-RULES-V1.2.md`。所有裝備採統一資料模型與裝備庫，不以虛擬／玩家持有分型；紫裝是影響基礎屬性的品質特徵；承音使用既有詞條的當階滿值約 94% 自動推導；調律滿值是當階詞條上限。V1.1 與本文件衝突時，以 V1.2 為準。

## V1.3 最高優先修正（覆蓋先前衝突條文）
先讀 `docs/09-VALUE-PROVENANCE-V1.3.md`：優先採用明確記錄的數值，缺值才推估，並在欄位與所有依賴結果標示「預估值／包含預估資料」。缺少必要數值且無可用模型時不得輸出 DPS。對應測試在 `tests/value-provenance-v1.3.md`。

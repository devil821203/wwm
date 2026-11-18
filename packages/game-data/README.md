# @wwm/game-data

S02 的執行期 Zod 資料契約與 TypeScript 型別。build 後經套件根入口使用 validateGameData、各個 Schema 及 pathCatalog；ESM 匯入不依賴前端框架。

- 發行資料包 schemaVersion 為契約版本；version.id 為任意遊戲版本 slug。所有動態實體與數值需有一致 gameVersionId。
- availableLevels 是可用等級的唯一清單，可為空或非連續；levelCap 為資料提供的上限或 null，不從 UI 補值。
- 數值需明示 UNKNOWN/null/reason、RECORDED/sourceIds、MANUAL_CONFIRMED/confirmation 或 ESTIMATED/公式/版本/日期/來源/參數。拒絕字串轉數字與非有限值，保留 0 與原始小數精度。
- EquipmentInstance 統一保存所有來源，允許沒有 definitionId/slotId 的未驗證草稿；current/effective/maximum 分離，observation 保存原始輸入。結構成功不等同裝備合法或數值已驗證。
- 技能冷卻、施放與命中 offset 以非負安全整數毫秒或 null 表示；不使用 frame 混算。公式僅實作 ID 與結構化參數，不執行資料中的程式碼。
- 發行包驗證唯一 ID、版本與實體/來源外鍵；對未知技能或空陣列不自動填係數。
- pathCatalog 只保留需求中 11 條候選名冊，不是正式發行資料。沒有合法等級、真實係數或可信 DPS；新增流派不修改 schema。
- SYNTHETIC_TEST fixtures 僅存在 src/test，production build 排除所有測試程式與合成數值。不得將此 purpose 改為 GAME_DATA 充作真實資料。
- 舊 requirements/schemas 範例不保證可直接匯入；版本遷移、來源審核與 UI 匯入將於後續步驟實作，參見 ADR-002。

套件測試：pnpm --filter @wwm/game-data test。根目錄 typecheck/test/build 已涵蓋所有 workspace 套件。

## S03 匯入與數值解析核心

- `prepareDataImport(input, registry, baseline)` 接收標準化 JSON 或物件，建立獨立 staging、舊新差異、SHA-256 digest 與來源問題清單，不修改既有資料。
- `reviewDataImport(proposal, expectedDigest, decision, registry, currentBaseline)` 檢查明確人工決策、來源授權證據、提案內容及目前基準；通過後回傳 `ReviewedDataset`，不寫檔或發布。
- `resolveValue(request)` 僅讀取已審核資料，依精確 scope 解析：實例手動確認 > 明確記錄 > 適用模型 > UNKNOWN。source registry 只作候選對照，授權證據另行審核。
- 可信來源的實值相異時回 UNKNOWN 並列衝突；同值才依官方、交叉驗證、社群排序。`ConflictSelection` 需人工決策綁定完整候選值，候選變更即失效。
- `InstanceOverride` 保存實例 ID、scope、old/new、作者、時間、理由與確認證據；更新主資料不移除玩家覆寫，會標示差異。持久化由 S04 負責。
- 推估僅執行已登錄 `scale`，倍率由模型給定，無通用 94% 預設；`onlyExplicit` 禁止模型與資料中的估算紀錄。
- `valueStatusLabel` 提供手動輸入／資料庫數值／預估值／未知標籤；`summarizeProvenance` 僅檢查實際依賴，必要 UNKNOWN 阻擋計算，估算衍生結果標示「包含預估資料」。它不產生 DPS。
- 目前匯入 envelope 與 S02 的 `GameDataRelease` 分開，前者用於來源/數值 staging。未執行來源抓取、raw 快照儲存、自動更新或版本發布；S17 門檻未完成。
- 所有審核皆為單機使用者明確提供的結構化紀錄，不是身分或遠端權限驗證；呼叫端必須提供實際當前 baseline。候選登錄仍保持 unverified，不能憑 URL 補造授權。

## S04 玩家備份契約

`CharacterSchema`、`BuildSchema`、`PlayerArchiveSchema` 與 `parsePlayerArchive` 提供角色/Build及完整玩家備份驗證。
草稿版本與等級為 null；版本存在時檢查合法等級、流派、武學、面板與裝備引用的版本。Build 分別保存來源面板值、武學等級、心法/奇術/天賦引用、單一裝備庫引用及面板是否含裝備。
備份只做結構與引用驗證，不代表匯入的遊戲數據已審核或可發布；合成測試資料仍須保留 SYNTHETIC_TEST 標記。

## S05 未知裝備草稿與圖片證據

EquipmentInstance 的 gameVersionId/tierId/quality 可為 null；UNKNOWN 與 MANUAL_CONFIRMED 值允許未知版本，RECORDED/ESTIMATED 仍需已知版本。已知版本發行資料包拒絕 null 內嵌值。
可選名稱、時間、imageIds、baseObservations 保存人工輸入；備份新增可選 equipmentImages/equipmentHistory，舊 1.0.0 備份相容。
未知版本裝備不能加入 Build；所有 S05 手動編輯保存 UNVERIFIED，結構成功不代表遊戲合法。原圖以本機 data URL 備份，需使用者在畫面明確同意保存。

## S06 辨識證據

可選 OcrTraceSchema 保存 adapter/run/image ID、原文、辨識信心、原候選名稱/值/單位、bbox及裁切/方向/倍率。此信心不是遊戲資料真實性或合法性。
只有使用者確認才產生手動值，未確認仍UNKNOWN；保存時保留原始OCRtrace，修正值和原辨識值分開。舊備份無ocr欄位仍相容。

## S07 裝備規則

resolveEquipment(instance, release?, { onlyExplicit?, estimatedAt }) 回傳重算後裝備、warnings、provenance及canApplyLegalMaximum；不修改輸入或主資料。

- EquipmentDefinition.legality 可選：ruleVersion、verified、sourceIds、minAffixes/maxAffixes、tuningStages、完整exclusionGroups；舊資料缺規則仍可讀但不宣稱合法。
- AffixCapRule新增可選minimum、precisionVerified、chengYinModel（formulaId/modelVersion/registeredAt/ratio/sourceIds/precision/precisionVerified）。作用域由cap的精確版本/階級/品質/詞條/階段限定，null階段不是萬用。多條同條件cap拒絕靜默擇一。
- 未確認值保留UNKNOWN；承音依人工確認>明確承音值>版本模型，MAX是明確模擬選擇且保留current。估算maximum亦維持ESTIMATED，不可一鍵宣稱已驗證合法。
- 模型只在cap及模型精度已驗證時依步進/ROUND、FLOOR、TRUNCATE正規化；已記錄minimum作步進起點，缺精度保留推估原始結果。不借用其他品質基礎值、不把承音倍率套在基礎值。
- 新增可選effectiveBaseStats與onlyExplicit；affix.maxOnChengYinConfirmed記錄MAX明確選擇。儲存交易不信任舊validation/effective，重新解析。
  此步不實作傷害公式或理想生成；provenance供S08使用，合成fixture不能視為遊戲真實規則。

## S08 公式證據與技能適用範圍

Formula新增可選statBindings（輸入鍵→屬性外鍵）與evidence（status、sourceIds、modelVersion、reviewedAt）；來源與屬性引用均驗證。
Skill新增可選applicability.characterLevels/martialArtLevels；角色等級必須屬本版本合法等級。
舊資料無新欄位仍可匯入，但stat-engine遇到缺公式證據或等級適用範圍時拒絕計算，不能將契約相容誤當數值可用。

## S09 技能變體與實測快照

Skill.variants為可選擴充，包含id/name、applicability、chargeMs、requiredStateIds、swordEnergy、hits與events。事件種類為SWORD_ENERGY、WEAPON_SWITCH、STATE_APPLY、STATE_REMOVE；毫秒時間可未知，數值沿用ResolvedValue。切換目標與來源/公式/版本引用均檢查，拒絕重複變體及命中/事件ID。這是契約，不執行事件。
新增MeasurementSnapshotSchema與MeasurementSchema：固定Character/Build/Equipment/GameDataRelease及onlyExplicit/evaluatedAt；單技能觀察綁skillId/variantId，60秒觀察固定60000ms。樣本非負有限，可含0；來源與人工核對必填，合成/真實標籤必須符合快照資料包。
player-entities抽出共用Character/Build契約，原匯出位置相容；PlayerArchive.measurements可選，舊備份可讀。快照獨立驗證，不依賴外部原角色仍存在，不將觀察改成主資料數值。

## S10 戰鬥規則與循環

GameDataRelease.combat可選：規則版本/evidence、切換時間、劍氣資源對應、資源初值/上限、Buff與DOT定義；沿用來源與版本驗證。缺combat的舊資料仍可讀，但不能執行循環。
Skill/SkillVariant.combat可選：總施放時間、冷卻及群組/起點、資源變化、效果、快照模式與切換後命中保留規則。重複資源/效果、未知引用拒絕；必要時間可null以保留缺失。
RotationPlanSchema定義固定與優先序循環；Build.rotation可選，舊備份與實測快照相容。循環版本需符合角色版本；保存的草稿仍須交combat-engine驗證，不代表合法或可計算。

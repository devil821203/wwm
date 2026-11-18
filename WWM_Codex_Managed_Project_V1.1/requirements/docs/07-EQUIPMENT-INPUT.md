# 07 裝備輸入、截圖辨識與合法滿值帶入（V1.1）

## 產品決策
- 玩家建立裝備時**不必預先分類**，主要入口為「匯入截圖」、「手動輸入」、「由既有裝備複製／理想化」。
- 內部仍需以 `slotId`、`equipmentDefinitionId`、版本、品質與強化狀態驗證裝備能否裝備、詞條是否互斥。分類由辨識／資料庫比對自動推導；無法確認時允許保存草稿，但不可宣稱合法。
- 紫裝是裝備品質特徵，必須使用紫裝較低的基礎屬性；承音是升階後詞條固定的特徵，對既有詞條自動推導約 94% 當階段滿值；調律滿值是當階段詞條理論最大值。三者不是互斥裝備類別，且不與裝備建立方式相關。

## 使用者流程
1. 選擇圖片（PNG/JPEG/WebP）或手動新增；允許多張圖作為同一件裝備的證據。
2. 本機裁切／旋轉／放大圖片，辨識裝備名稱、品質、等級、裝備部位、套裝、承音、調律、詞條名及值；每欄保留原始文字、候選對應與信心值。
3. 呈現「原圖／辨識欄位／合法值範圍」對照，低信心或衝突欄位要求使用者確認；不自動覆蓋人工修改。
4. 以版本化規則查詢：紫裝適用數值、承音條件、調律階段／滿值上限、詞條池及互斥規則。若查無已驗證規則，顯示未知且允許保留原值。
5. 提供按鈕：「套用截圖數值」、「填入已驗證合法滿值」、「生成理想版本」、「還原原始輸入」。滿值只修改可調整欄位，保留裝備身份與固定屬性；變更前預覽差異。
6. 儲存至統一裝備庫；截圖、手動與生成的裝備共用同一資料模型、同一編輯器及同一 DPS 計算路徑。不得依「玩家持有／虛擬」分庫、分型別或分開驗證。可立即送入 Build／DPS 模擬。

## 辨識架構
- `ImageImportService`: MIME、檔案大小、尺寸檢查；不預設上傳第三方服務；預設瀏覽器本機處理，圖片留存需使用者同意。
- `ImagePreprocessor`: 裁切、旋轉、對比度、放大；支援手動框選裝備說明區。
- `EquipmentRecognizer`: 可替換的 OCR／影像辨識 adapter，輸出文字與 bounding boxes；不綁定特定雲端模型。
- `EquipmentParser`: 國際服繁中／英文名稱字典、數字／百分比／全半形正規化、欄位對應。
- `EquipmentMatcher`: 多候選裝備比對、重名處理、版本匹配、信心分數。
- `EquipmentReviewUI`: 所有欄位可手動修正，顯示辨識不確定性及來源。
- OCR 失敗必須能完整改走手動流程；不得憑圖片不清楚的部分補造數值。

## 主要資料契約
```ts
type EvidenceStatus = 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
type EquipmentOrigin = 'SCREENSHOT' | 'MANUAL' | 'GENERATED';
interface ExtractedField<T> { rawText?: string; value?: T; confidence?: number; manuallyConfirmed: boolean; }
interface EquipmentDraft {
  id: string;
  gameVersionId: string;
  origin: EquipmentOrigin;
  imageIds: string[];
  name: ExtractedField<string>;
  quality: ExtractedField<string>;
  slotId?: string; // 自動推導，使用者可修正
  equipmentDefinitionId?: string;
  level?: number;
  chengyinState?: string; // 正式值與術語待國際服資料驗證
  tuningStage?: number;
  affixes: Array<{ affixId?: string; rawName: string; value?: number; unit?: string; status: EvidenceStatus }>;
  validation: { status: 'VALID' | 'INVALID' | 'UNVERIFIED'; reasons: string[]; ruleVersion?: string };
}
interface EquipmentRule {
  gameVersionId: string;
  equipmentDefinitionId?: string;
  quality?: string;
  chengyinState?: string;
  tuningStage?: number;
  affixId: string;
  minValue?: number;
  maxValue?: number;
  allowedValues?: number[];
  mutualExclusionGroup?: string;
  status: EvidenceStatus;
  sourceIds: string[];
}
```
以上 `chengyinState` 與 `tuningStage` 是待核實的資料欄位名稱，不代表已證實國際服規則。

## 合法滿值邏輯
- `resolveApplicableRules(draft, gameVersion)`：依裝備身份、品質、承音、調律階段與詞條查詢最具體且已驗證的規則；衝突時要求人工選擇。
- `validateAffixCombination`：檢查詞條數量、可用池、互斥、階級、階段與數值步進。
- `applyLegalMaximum`：只有在匹配的上限規則 VERIFIED 且整體組合合法時才填入；否則禁用並解釋缺失資料。
- 手動超出範圍允許儲存為未驗證草稿，但不能列入「合法理想裝備」最佳化候選。
- 可複製裝備生成理想版本，兩者都是同一 EquipmentInstance 型別；透過 derivedFromId 關聯、creationMethod 記錄建立方式，沒有 actual/ideal 分類欄位。

## 驗收案例
1. 清晰截圖可辨識欄位並讓使用者逐項確認；模糊圖片顯示未知、不捏造數值。
2. 完全不提供截圖也可手動建立並保存裝備。
3. 紫裝且同時有承音／調律狀態時，按正確版本及條件選擇對應規則，而不是把狀態當互斥類別。
4. 已驗證上限可一鍵填入合法滿值；未知上限不可聲稱滿值。
5. 不合法詞條組合可保存為草稿，但不能進入合法裝備最佳化。
6. 截圖辨識結果經人工修正後，重新辨識不得覆蓋人工修正。
7. 截圖、手動、生成裝備均保存於統一裝備庫，可互相替換與比較 DPS；creationMethod 不影響傷害。
8. 測試用虛構 fixture 必須標示為示例，不當成真實遊戲數據。

## Codex 執行順序
先做手動輸入與合法值引擎，再做可替換 OCR adapter 和截圖審核 UI；最後才做理想滿值與最佳化整合。每個階段先提供測試結果。

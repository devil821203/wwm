# 08 裝備資料與詞條規則 V1.2（最高優先級）

## 產品定義
1. **統一裝備**：所有裝備（截圖辨識、手動輸入、理想生成）使用同一 `EquipmentInstance`、同一裝備庫、同一計算及合法性檢查。不得依「虛擬裝備」和「玩家持有裝備」分庫、分型別、分配裝流程。`creationMethod` 僅為來源稽核，不改變 DPS。
2. **紫裝**：是裝備品質特徵；與其他品質相比可能有較低的**基礎屬性**。必須從版本化品質/階級/裝備定義查詢或使用截圖確認的實際基礎屬性，不得套用高品質基礎值。沒有資料則標 UNKNOWN，不自行估值。
3. **承音**：是升階後詞條固定的裝備特徵。對裝備**既有詞條**自動帶入該詞條於當前階段的滿值 × 0.94（約數，預設可設定），不新增、移除或重新抽選詞條；不用逐條輸入數值。實際數值必須按已驗證的單位、步進、四捨五入／截斷規則處理。未驗證精度時結果標 ESTIMATED，不宣稱精確合法值；若缺上限則顯示 UNKNOWN 且保留原值。
4. **調律滿值**：指**當前階段**、對應詞條的理論最大值（100%）；不是額外傷害加成，也不是獨立裝備類型。只填入裝備既有詞條；若生成理想裝備，可先依合法詞條池選詞條再套用當階上限。
5. 紫裝、承音、調律滿值可以共同描述同一件裝備；品質影響基礎值，承音／滿值模式影響詞條有效值。若承音與 MAX 同時指定同一詞條，必須提示衝突並要求明確選擇，不能重複套倍率。

## 計算流程
1. 取得遊戲版本、裝備階級、品質、基礎屬性與既有詞條 ID。
2. 查詢每條詞條的 `maxValue`、單位、精度、步進與版本規則。
3. `MANUAL`: 使用手動／截圖確認的值；`CHENG_YIN`: `maxValue * chengYinRatio` 並依已驗證精度規則正規化；`MAX`: `maxValue`。
4. 基礎屬性與詞條有效值分別加總至角色數值；不得將品質折減重複作用在詞條上，也不得將承音係數作用在基礎屬性上。
5. 每一項有效值保留來源、規則版本、驗證狀態；缺關鍵資料時不提供虛假的精確 DPS。

## TypeScript 資料契約（示意）
```ts
type ValueMode = 'MANUAL' | 'CHENG_YIN' | 'MAX';
type DataStatus = 'VERIFIED' | 'ESTIMATED' | 'UNKNOWN';
type CreationMethod = 'SCREENSHOT' | 'MANUAL' | 'GENERATED';
interface EquipmentAffix {
  affixId: string;
  valueMode: ValueMode;
  manualValue?: number;
  effectiveValue?: number;
  maxValue?: number;
  status: DataStatus;
}
interface EquipmentInstance {
  id: string;
  definitionId?: string;
  gameVersionId: string;
  tierId: string;
  slotId?: string;
  quality: string;
  isChengYin: boolean;
  baseStats: Record<string, number>;
  affixes: EquipmentAffix[];
  creationMethod: CreationMethod;
  derivedFromId?: string;
  evidenceIds?: string[];
}
interface AffixCapRule {
  gameVersionId: string;
  tierId: string;
  affixId: string;
  maxValue: number;
  unit: string;
  step?: number;
  roundingRule?: string;
  chengYinRatio?: number; // 暫以 0.94 作推估預設
  status: DataStatus;
  sourceIds: string[];
}
```

## UI 行為
- 單一裝備庫：建立來源可作篩選標籤，但不能造成配裝或 DPS 計算差異。
- 截圖辨識與手動輸入的詞條都能按「承音」一鍵依現有詞條推導；若已標承音，預設自動推導。
- 每個詞條可選手動、承音、當階滿值，並顯示原值、推導值、上限、可信度與計算依據。
- 紫裝顯示品質與基礎屬性，並允許依截圖覆寫錯誤的基礎值。
- 理想裝備生成與最佳化使用相同資料結構；不得把生成來源當成不合法條件。

## 驗收案例（數值皆為合成 fixture，非遊戲真實數值）
1. 當階詞條滿值 100、承音比率 0.94、整數步進且規則已驗證，承音有效值為 94；MAX 為 100。
2. 裝備有 A、B 兩條詞條，切換承音後仍只有 A、B，兩者各自依其當階上限計算，不新增詞條。
3. 紫裝基礎攻擊 80、其他品質同階 100，且詞條相同，角色屬性與 DPS 使用 80 而不是 100；不將 0.94 再乘到基礎攻擊。
4. 同一件裝備經 SCREENSHOT、MANUAL、GENERATED 三種方式建立，若有效數值相同，輸出 DPS 完全相同。
5. 缺少上限、版本、步進／精度規則時不捏造精確值；可保存草稿並顯示 UNKNOWN/ESTIMATED。
6. 承音與 MAX 對同一詞條衝突時顯示明確提示；切換模式後不重複乘算。
7. 更換裝備階級後重新查詢當階上限，並使承音與 MAX 的有效值失效重算。
8. 原始截圖或人工輸入不被自動帶值永久覆蓋，可還原並保留審核軌跡。

## Codex 優先級
此文件覆蓋 V1.1 中「玩家持有／虛擬分離」以及承音、紫裝、調律滿值含義的所有衝突文字。先更新 schemas、資料遷移與測試，再更新 UI、生成器與最佳化器。

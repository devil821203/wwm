# 04 全等級 DPS 推估與理想裝備生成

## 等級 DPS
1. 從國際服版本資料讀取 `minLevel/maxLevel/availableLevels`；不存在時顯示無可用等級，不得自訂最高級。
2. 每個流派 × 每個可用等級 × 3 個裝備情境（低配、一般、理想）× 3 種敵人情境（木樁、同級一般敵、同級首領）產生結果；預設選定一個標準循環與時間窗，所有比較條件一致。
3. 優先使用已校準技能與該等級裝備的戰鬥事件模擬，標示 `CALIBRATED`。有實測錨點時使用 `MEASURED` 作校準資料，不把實測單次傷害直接等同 DPS。
4. 若等級成長表缺失但有相鄰等級錨點，可選用保守插值並標示 `ESTIMATED`；超出錨點的外插必須顯示高不確定性。不可假設 DPS 線性成長或套用單一倍率。
5. 每個點保留 `buildSnapshot, enemySnapshot, rotationId, formulaVersion, dataVersion, modelVersion, assumptions, sampleCount, errorMetrics, seed`。
6. 若關鍵技能係數、裝備合法性或等級成長缺失，回傳 `meanDps:null, method:'UNKNOWN'`；圖表斷線並顯示缺失欄位。
7. 以已知實測點進行留一驗證/回測；顯示 MAPE 或 MAE（零值注意），隨機模擬使用信賴區間，推估模型區間另行標示不可混淆。

## 鳴金·虹第一版
- 預設武學：無名劍法 + 無名槍法；先建立技能/命中時間/蓄力/劍氣/切換/狀態事件契約，所有未知係數保持 null。
- 建立 3 組可重現的遊戲內實測：固定角色面板、固定敵人、單技能多次命中、技能循環 60s；記錄版本、畫面/文字來源。
- 先做單次技能計算，再做 60s 循環與最佳化；每次修公式跑 regression fixtures。

## 理想裝備生成
- `PERFECT_LEGAL`：在合法裝備、詞條數量、互斥群、品質、等級、強化/調律限制下搜尋最高理論 DPS；未有完整詞條池不得聲稱合法完美。
- `TARGET_AFFIX`：使用者選擇詞條及數值，系統驗證範圍/互斥/可用部位。
- `RANDOM_LEGAL`：以 seed 重現隨機合法裝備；若機率分布未知則使用明示的「均勻示範分布」，不聲稱真實掉落率。
- `MODIFY_OWNED`：以玩家裝備為基礎，僅修改使用者允許的詞條與強化項。
- 理想裝備與截圖／手動裝備使用相同 EquipmentInstance 模型及統一裝備庫；僅以 creationMethod=GENERATED 追蹤來源，禁止使用 virtual/owned 互斥分類；生成後可送至 DPS 模擬或最佳化。
- 最佳化可鎖部位、限定成本、限定套裝、指定最低屬性；輸出合法性證據與收益差。

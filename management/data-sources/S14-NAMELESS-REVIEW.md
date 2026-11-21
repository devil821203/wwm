# S14 鳴金·虹來源對照（待審核）

日期：2026-11-21；用途：以既有快照準備人工審核，不是正式數值發布或 DPS 公式。

## 證據與版本

- 原始快照：`data/raw/where-datas-mine/b021a2cac8c1a723e0c2b5c06b8ca29197415010/martial-arts.json`；來源 commit 為 `b021a2cac8c1a723e0c2b5c06b8ca29197415010`，SHA-256 為 `73f75d198c74154de4cf10ed32fde3ace02a00562c8bbefb2be2296ef7c521db`。
- 使用者指定國際版 `1.0.334.64785`、角色 100 級、角色上限 100 級、單人世界等級 18；快照本身不提供可獨立核對的版本或地區標籤。
- 專案候選名冊將鳴金·虹列為「無名劍法／無名槍法」。快照 `martialArts[1]` 為 `Nameless Sword`，`martialArts[3]` 為 `Nameless Spear`；名稱對照為候選推測，尚需來源或遊戲畫面證實。候選清單的正式武學與流派 ID 仍為待審核。
- 來源權利尚未核實；使用者已指定將此內容視為國際版並先用於計算，但此不代表來源檔已自行證明精確版本或權利。保留原始快照與候選狀態。

## 可審核內容

| 候選 | tier | 來源天賦類別 | 尚待處理 |
|---|---:|---|---|
| Nameless Sword | 13 | Qi Struggle Enhancement、Physical Attack UP、Sword Qi Affinity Enhancement、Bellstrike Attribute UP、Attr. Attack DMG UP | 核對名稱及武學等級、效果是否啟用、面板是否已包含、術語與目標條件。 |
| Nameless Sword | 14 | 同 tier 13，加上 Increases Additional Attack | tier 14 的加成與上限不能套用至 tier 13；不得用角色等級推定武學 tier。 |
| Nameless Spear | 13 | Max Endurance UP、Affinity Rate UP、Affinity DMG UP、Bellstrike Attribute UP、Attr. Attack DMG UP | 核對耐力及增益條件、比率計算語意、重複描述是否同義。 |
| Nameless Spear | 14 | 同 tier 13，加上 Increases Additional Attack | 必須確認武學 tier 及額外攻擊的適用技能與疊加方式。 |

原文及各項數值以來源 JSON 的 `martialArts[index].tiers[*].effects[*].talents[*].descriptions[*].text` 為準；這些描述屬天賦效果，不能直接當成技能倍率、命中時間或完整傷害公式。tier 13 與 14 的上限和部分數值不同，不可跨 tier 套用。

## 角色輸入與計算缺口

`equiement-recognition.md` 記載使用者確認的實算精準率 93.8%、會心率 25.8%、會意率 39.5%，以及玉斗 3/4；截圖辨識仍待人工複核。面板是否已含武學天賦、裝備與二件套效果尚未確認，不能再次加總。

要對這兩筆來源做角色適用的計算，至少仍需：確認兩筆名稱對應的遊戲武學、各自武學 tier 和啟用的天賦、來源文字中的屬性對照與面板包含範圍。要計算可信 DPS，另外需要同版本技能係數、命中／施放時序、循環、敵人條件與完整公式。沒有這些資料時，計算結果應保持未知，不能以合成測試係數替代。

此文件是單份來源的初次對照，不是與舊版本的差異報告；原始來源、staging 候選和正式資料均未覆蓋。
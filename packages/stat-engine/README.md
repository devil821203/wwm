# @wwm/stat-engine

S08可追蹤數值核心；依賴@wwm/game-data，無內建正式遊戲公式或係數。

## aggregateStats(request)

request包含build、character、equipment、可選release、onlyExplicit與固定evaluatedAt。BASE_ONLY合成面板/裝備有效基礎值/既有詞條；EQUIPMENT_INCLUDED只使用面板；UNKNOWN阻擋。必要面板缺值不是0。
每項屬性回傳value、EXPLICIT/ESTIMATED/UNKNOWN、provenance、dependencies及contributions。EXPLICIT是衍生值狀態，不冒充單一RECORDED來源。完整原始來源保留於contributions；明確資料模式禁止估算。
裝備透過S07重算，保留每件onlyExplicit限制。跨版、重複部位、缺身份/等級門檻或非法裝備阻擋；其他尚未驗證裝備只提供數值預覽警告。未建模心法/奇術/天賦不靜默省略。

## calculateDamage(request)

在上述request加入skillId，回傳expectedDamage、逐段結果、完整依賴、公式/版本/假設、context與aggregation。只評估實際使用的依賴，未使用的UNKNOWN或ESTIMATED不污染結果。
首個固定實作ID為weighted-hit-v1：
(attack × coefficient + flatDamage) × damage-multiplier × enemy-multiplier ×
(normal-probability × normal-multiplier + critical-probability × critical-multiplier + insight-probability × insight-multiplier)。

- attack必須由Formula.statBindings明確綁定points屬性。
- normal/critical/insight/miss-probability必填，範圍0–1且總和1；代表互斥命中類別，miss造成0傷害。這是實作假設，不宣稱為遊戲真實機制。
- normal/critical/insight/damage/enemy-multiplier必填且非負。每個輸入可在parameters或statBindings擇一；綁定比例屬性單位必須ratio，不做未驗證百分數換算。
- 每段coefficient與flatDamage必須明確；不因其他倍率為0而略過未知必要輸入。
- 公式須由角色流派明確引用、技能屬於此流派武學，且角色/武學等級在技能applicability內。
- Formula.evidence必須非UNKNOWN；ESTIMATED證據本身會傳播預估，即使所有數字參數均RECORDED。
- 拒絕未知實作ID、來源字串程式、必要未知/跨版/非法機率/溢位，不替代公式、不補倍率1或數值0。

核心不讀時鐘、不用亂數、不修改輸入；evaluatedAt為輸入的一部分，同輸入及JSON往返後結果一致。輸出可序列化。
meanDps永遠null；冷卻、施放時間、事件、Buff、特殊流派效果及戰鬥循環由S09–S11接續，不以單技能期望值冒充DPS。

## 驗收

pnpm.cmd --filter @wwm/stat-engine test
合成fixture只位於src/test，不納入正式build；示例任意數值不是遊戲資料。詳見management/tests/TEST-RUNS.md的S08。

## S09 變體與觀察比較

calculateDamage新增可選variantId；技能存在variants時必須明確指定，不回退父hits或其他變體。輸出context.variantId及變體條件/事件；只計算所選固定係數，沒有執行蓄力、劍氣或切換事件。
bellstrikeCoverage(release?)列版本內鳴金·虹技能及係數/命中時間/事件量/蓄力/劍氣等缺失；無版本時回報未知，不創建技能ID。
compareMeasurement(measurement)從保存快照重播單技能期望值，回傳觀察平均、MAE、MAPE百分比、bias與zeroExcluded。不對篩選/部分樣本、未確認條件或60秒觀察產生可比較誤差；未知係數保留null。沒有合格門檻，不自動校準或寫回。
MAPE排除觀察值為0的分母；MAE保留0樣本，全部0時MAPE為null。超出有限範圍時不輸出Infinity統計。顯示可格式化或用科學記號，但原始統計與樣本不取整。

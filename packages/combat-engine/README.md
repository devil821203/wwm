# @wwm/combat-engine

S10版本化循環事件核心，依賴game-data與stat-engine；沒有內建正式遊戲資料。

## 介面

runRotation(request) 接收EngineRequest及RotationPlan；回傳VALID/INVALID/UNKNOWN、totalExpectedDamage、trace、bySkill、finalState、provenance、dependencies與context。meanDps保持null。
同輸入與JSON重播結果一致，不讀時鐘、不使用亂數、不修改輸入。UI可保存Build.rotation及下載完整request/result。

## 時間與狀態

- EventQueue使用安全整數毫秒與FIFO序號二元堆。固定動作預先按輸入順序入列，衍生同毫秒事件排在已有事件後；優先序依明確decisionIntervalMs輪詢。
- 視窗[0,duration)，Buff/DOT於到期毫秒先失效。初始Buff/DOT為空；武學由plan指定，所有宣告資源的初值/上限必須可解析。
- profile.castDurationMs含蓄力，cooldownStart及cooldownGroupId明確宣告；不由父欄位推測。資源變化於施放開始整批檢查，不能先扣一部分再拒絕。
- 武學切換立即變更並套switchDurationMs鎖定。hitsPersistAfterSwitch=false時以切換世代取消排隊命中，即使已切回原武器仍取消。
- Buff僅支援明確傷害倍率與REFRESH/REJECT；沒有默認屬性轉換或堆疊。SNAPSHOT取施放前現有Buff，DYNAMIC取命中時Buff。
- DOT payload使用指定技能/變體完整傷害，不執行其施放/資源/附加事件。firstTick/interval/duration必須明確；終點不tick。快照於套用固定，動態於tick取值；REPLACE以token作廢舊tick。
- S09事件中的劍氣透過swordEnergyResourceId對應資源，STATE_APPLY/REMOVE對應Buff；未使用的其他amount不當作隱含傷害。
- 固定動作違規立即中止並回傳null總傷害；優先序的冷卻/資源不足只等待。缺必要規則不跳過。每次最多10000事件，超出不回傳部分總傷害。
- 依賴以技能/變體/命中來源命名，避免估算值被其他變體的明確值掩蓋。僅明確模式禁止推估，其他模式傳播「包含預估資料」。

這是明確範圍的合成驗收模型，不宣稱所有遊戲Buff/資源/特殊技能都已支援。S11接續DPS/Monte Carlo/Worker與圖表。
測試：pnpm.cmd --filter @wwm/combat-engine test。src/test內數值不是遊戲數據，不納入正式build。

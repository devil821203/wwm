# @wwm/optimizer

純資料最佳化核心：optimize(request, { progress?, isCancelled? })。

輸入為CombatRequest與部位、鎖定、排除、成本、最低屬性、套裝件數、Beam寬度/Top-K/上限。裝備全部使用EquipmentInstance，生成來源不改公式。只支援BASE_ONLY面板。

AUTO在十件以下完整枚舉；其餘Beam＋兩輪局部搜尋。每個排名以完整期望循環重算。optimalityProven僅對本次有限合法候選與約束成立，Beam永遠false；取消不保留部分排名。

套件測試：pnpm.cmd --filter @wwm/optimizer test。案例與src/test中的所有數值均為合成資料，不是遊戲實測。設計與限制見management/decisions/ADR-014-OPTIMIZATION.md。

# 02 架構與技術決策

- Monorepo：pnpm workspace；`apps/web` React+TypeScript+Vite+Tailwind+Zustand+ECharts；`packages/shared`、`game-data`、`stat-engine`、`combat-engine`、`optimizer`、`progression-model`；`tools/importer` Python；`tests`。
- 瀏覽器 IndexedDB（Dexie）儲存玩家 Build、庫存、覆寫；版本化 JSON 資料包由 Python 匯入 SQLite staging 再發行，前端不直接依賴 SQLite。
- 資料引擎介面：`aggregateStats(build, dataVersion)` → 來源可追蹤屬性；`simulate(request)` → DPS/技能/事件/警告；`optimize(request)` → TopN、探索數、是否證明最優；`estimateLevelDps(request)` → 等級曲線及信心區間；`generateIdealGear(request)` → 合法裝備實例。
- 時間模型：整數毫秒或整數 frame，**不可混用**；技能事件 queue 按 timestamp + sequence 排序；避免浮點時間漂移。
- 傷害公式使用可版本化的實作 ID + 參數資料，不能執行任意 JSON 程式碼。
- 期望值引擎與隨機引擎共享事件/效果規則；Monte Carlo 以可注入 PRNG seed 運行。
- 最佳化兩階段：合法候選剪枝 + 近似快速評分，Beam Search/局部搜尋，再以完整 DPS 重評 Top K；小規模枚舉作為正確性基準；不能把啟發式最佳稱作全域最優。
- 資料缺漏的狀態使用 `UNAVAILABLE`、`PARTIAL`、`ESTIMATED`、`VERIFIED`；公式缺失不可靜默用 1 或 0 代替。
- 優先支持 Chrome/Edge 桌面；PWA 可後續啟用。

## 建議核心 TypeScript 型別
```ts
type Confidence = 'VERIFIED'|'ESTIMATED'|'PARTIAL'|'UNAVAILABLE';
type DpsResult = { meanDps: number|null; lowerDps: number|null; upperDps: number|null; confidence: Confidence; version: string; assumptions: string[]; warnings: string[] };
type LevelDpsPoint = { level:number; pathId:string; scenarioId:string; result:DpsResult; method:'MEASURED'|'CALIBRATED'|'EXTRAPOLATED'|'UNKNOWN' };
type GearGenerationMode = 'PERFECT_LEGAL'|'TARGET_AFFIX'|'RANDOM_LEGAL'|'MODIFY_OWNED';
```

# 開發進度

> 2026-11-18：S01–S13 已通過本機集中驗收；S14 部分完成並因流派機制資料缺失 BLOCKED。此狀態不代表完整模擬器已完成。

| 步驟 | 功能 | 狀態 | 最近測試 | 備註 |
|---|---|---|---|---|
| S01 | F01 | DONE | 2026-11-17：Lint/型別/單元/建置/E2E 通過 | 初始化 pnpm monorepo、React Vite TS、格式化、Lint、Vitest、Playwright、CI |
| S02 | F02 | DONE | 2026-11-17：契約 51 項、首頁 2 項、E2E 2 項及建置通過 | 建立流派/版本/等級/屬性/裝備/技能 Zod schema 與資料契約 |
| S03 | F02 | DONE | 2026-11-17：資料套件100項、首頁2項、E2E2項及建置通過 | 建資料來源、明確值/推估/未知、覆寫、資料匯入與審核機制 |
| S04 | F03 | DONE | 2026-11-17：資料115項、Web13項、E2E8項與建置通過 | 角色、Build、IndexedDB 儲存、JSON 匯入匯出 |
| S05 | F04 | DONE | 2026-11-17：資料120項、Web30項、E2E12項及建置通過 | 統一裝備資料模型與手動編輯、截圖上傳及人工校對 UI |
| S06 | F04 | DONE | 2026-11-17：資料123項、Web48項、E2E16項及建置通過 | 同源本機OCR／文字adapter、信心與原文證據、人工修正保護 |
| S07 | F05 | DONE | 2026-11-17：資料158項、Web52項、E2E18項及建置通過 | 品質基礎值、承音實值優先/模型回退、當階MAX與合法性、原值保留及推估標示 |
| S08 | F06 | DONE | 2026-11-17：資料161項、數值32項、Web54項、E2E22項及建置通過 | 獨立stat-engine、來源屬性合成、單技能版本化期望值與快照；DPS仍待循環模擬 |
| S09 | F06 | DONE | 2026-11-17：資料161項、數值45項、Web60項、E2E26項；最終受影響4項通過 | 技能變體/事件契約、鳴金·虹實測快照與誤差比較；真實係數/三組實測仍缺 |
| S10 | F07 | DONE | 2026-11-18：資料161項、數值45項、戰鬥26項、Web64項、E2E32項及建置通過 | 事件佇列、固定/優先序循環、冷卻/資源/切換/Buff/DOT與來源；DPS留S11 |
| S11 | F07 | DONE | 2026-11-18：資料161項、數值45項、戰鬥35項、Web67項、E2E34項及建置通過 | 期望DPS/逐命中Monte Carlo、seed、Worker進度取消、圖表/來源快照；僅合成驗收 |
| S12 | F05 | DONE | 2026-11-18：資料170項、數值45項、戰鬥35項、Web70項、E2E38項及建置通過 | 四模式生成/詞條合法性、MAX/承音、統一入庫/配裝送模擬；滿值候選未排名，見ADR-013 |
| S13 | F08 | DONE | 2026-11-18：資料170項、數值47項、戰鬥35項、最佳化9項、Web74項、E2E42項及建置通過 | 小型枚舉/Beam+局部搜尋、Top-K完整重算、部位/成本/屬性/套裝約束、Worker取消與另存配置；證明限候選範圍 |
| S14 | F09 | BLOCKED | 2026-11-18：部分功能 339 項單元整合、42 項 E2E 通過 | 通用必要 handler 防護與合成回歸完成；真實流派機制缺失，見 ISSUE-016 |
| S15 | F10 | NOT_STARTED | 未執行 | 逐合法等級、三裝備情境、三敵人情境推估與圖表 |
| S16 | F11 | NOT_STARTED | 未執行 | 資料版本 diff、全站 E2E、效能、授權、文件與發布 |
| S17 | F12 | NOT_STARTED | 未執行；U01–U10 NOT_RUN | 來源更新、快照/hash、差異/審核、manifest 與回滾；依賴見 DEPENDENCIES.md |

允許狀態：NOT_STARTED、READY、IN_PROGRESS、TESTING、FIXING、BLOCKED、DONE。

## SPEC-V1.1 — 規格整合
- 狀態：DONE（僅規格整合；來源更新功能尚未實作）
- 範圍：整合來源更新政策、來源註冊表、F12/S17 與驗收對照，不實作來源更新器。
- 前置：S01、S02 已 DONE；已完整閱讀新來源政策與登錄表。
- S01/S02 保留既有驗收結論；S03–S16 不重設或提前完成，S17 待開發。

- 驗收：來源包／匯入／既有檔案雜湊、歷史前綴、JSON／狀態／連結及 format:check 通過；見 TEST-RUNS 的 SPEC-V1.1。







## 2026-11-19：G: 專案損壞還原（未完成）

使用者將專案移至 G:\git\wwm\WWM_Codex_Managed_Project。七個損壞檔已原樣備份至 management/recovery/2026-11-19-originals，逐一以 SHA-256 比對備份與來源一致。G:、D: 副本及 wwm.zip 中可找到的三個資料模型皆含無效 UTF-8，沒有找到四份受損測試的完整原始備份。

packages/game-data/src/{equipment-rules,player-entities,rotation-schemas}.ts 已由現存 dist JavaScript 與型別宣告重建，並補回型別；不是逐字還原。此程序不能證明編譯成果本身完全無損或重建的來源與原文一致。

原有 pnpm-store-s13 的資料損壞，且搬移後套件連結失效；依 pnpm-lock.yaml 使用 .tools/pnpm-store-recovery 全新快取重建套件連結（--frozen-lockfile --ignore-scripts）。原本離線安裝失敗，原快取線上補缺仍遇損壞 JSON。

pnpm --filter @wwm/game-data typecheck：通過；pnpm --filter @wwm/game-data test：10 個測試檔、172 項通過。pnpm typecheck：失敗，combat-engine/src/engine.test.ts 為二進位／無效字元。其餘損壞測試為 apps/web/src/rotation/rotation-storage.test.ts、apps/web/src/rotation/RotationWorkspace.test.tsx、tests/e2e/measurement.spec.ts；保留原狀，尚未驗收全專案。ISSUE-018 維持 OPEN；S14 狀態不變。
## 損壞測試重建 — S09

狀態：IN_PROGRESS（2026-11-19）。前置：S08 歷史驗收 DONE，S09 功能與現有單元測試仍在；依 S09 驗收重建 tests/e2e/measurement.spec.ts。測試：實測保存、比較、備份還原與 60 秒觀察，桌面與手機；集中驗證並如實記錄。後續 S10 受損測試尚未處理。原始損壞檔保存在 management/recovery/2026-11-19-originals。

## 2026-11-19 損壞測試重建：S09 暫時阻塞，S10 進行中

S09 受損 measurement.spec.ts 已按方案重寫：單技能實測與備份還原、60 秒觀察；均使用合成資料。`pnpm --filter @wwm/optimizer... build` 與 `pnpm --filter @wwm/web exec vite build` 通過；`pnpm exec playwright test tests/e2e/measurement.spec.ts`：桌面及手機共 4 項通過。正式完整驗收受 S10 的損壞測試阻塞，不宣稱 S09 重建結案。恢復條件：S10 測試重建後重跑全專案集中驗收。可繼續：修復依賴 S10 的受損測試。

S10 測試重建狀態 IN_PROGRESS：重建 combat-engine/src/engine.test.ts、apps/web/src/rotation/rotation-storage.test.ts、RotationWorkspace.test.tsx；涵蓋事件順序、冷卻資源、窗口、Buff/DOT、優先序、保存與還原，沿用合成 fixture，原檔已有備份。完成後集中測試並記錄實際結果。
## 2026-11-19：S09／S10 損壞測試重建驗證

已重寫四個損壞測試：S09 measurement.spec.ts；S10 engine.test.ts、rotation-storage.test.ts、RotationWorkspace.test.tsx。戰鬥測試保留損壞檔開頭可讀部分，並補寫時間窗、版本／未知值、武器切換、Buff／DOT、快照／動態及優先序等合成案例。原始七個損壞檔仍保存在 management/recovery/2026-11-19-originals；無完整備份，不能聲稱重寫測試逐字還原或已恢復原有全部 26 項 S10 戰鬥測試覆蓋，ISSUE-018 保持 OPEN，需逐項稽核其餘原驗收邊界。

環境：Windows、G: 專案、Node.js 22.14.0、pnpm 10.6.5、Chromium 桌面／手機。實際結果：`pnpm format:check` 通過；`pnpm lint` 通過；`pnpm typecheck` 通過；`pnpm test` 332 項通過（資料 172、數值 48、戰鬥 29、最佳化 9、Web 74）；`pnpm build` 通過；`pnpm test:e2e` 42 項通過。日誌在 management/tests/logs/recovery-2026-11-19/。最初格式檢查因原始快照及辨識紀錄、Lint 因備份損壞檔與未用參數失敗；修正檢查範圍與測試後重跑通過。首次 DOT 測試事件名稱與型別檢查失敗，修正後通過。重寫測試不等於正式遊戲資料驗證，S14 維持 BLOCKED，S15–S17 狀態不變。
## 2026-11-19 08:07：dev 完整測試

測試基準提交 9bf4894；Windows，Node.js 22.14.0、pnpm 10.6.5，桌面及手機 Chromium。`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 均通過；`pnpm test` 332 項通過（game-data 172、stat-engine 48、combat-engine 29、optimizer 9、web 74）；`pnpm test:e2e` 42 項通過。各命令完整結果保存於 management/tests/logs/verification-2026-11-19-0807/。本輪為既有功能回歸，沒有證明已完整恢復原 S10 測試覆蓋或驗證真實遊戲數值；ISSUE-018 維持 OPEN，S14 維持 BLOCKED。
## S10 損壞後驗收補強（本輪 DONE）

依 ISSUE-018 與 S10 驗收清單，補測推估資料傳播及明確資料限制、Buff 到期邊界、優先序狀態、事件數上限。全部使用合成資料；完成後執行相關單元測試與型別／格式／Lint 檢查並記錄結果，不宣稱找回原始測試。

## S10 損壞後驗收補強：2026-11-19

依 S10 清單增加四項合成測試：Buff 到期瞬間、預估戰鬥規則與明確資料限制、跨版本資源、10000 事件上限與不輸出部分傷害。Windows、Node 22.14.0、pnpm 10.6.5；`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 通過；`pnpm test` 336 項通過（game-data 172、stat-engine 48、combat-engine 33、optimizer 9、web 74）；`pnpm test:e2e` 42 項通過。日誌：management/tests/logs/s10-recovery-2026-11-19-222313/。本輪補強完成；原始損壞測試沒有完整備份，無法證明重建覆蓋與原始案例一致，ISSUE-018 維持 OPEN。S14 依 ISSUE-016 維持 BLOCKED。
## S10 技能變體驗收（本輪 DONE）

依 S10 清單補測合成蓄力時間、必要狀態與劍氣門檻；執行戰鬥單元、型別、Lint 與格式驗證，失敗修正後重測。

## S10 技能變體驗收：2026-11-19

補充三項合成測試：蓄力時間不得超過施放時間、變體必要狀態、劍氣門檻與資源扣除原子性。第一次必要狀態案例因合成輔助技能意外繼承變體而失敗，修正 fixture 後戰鬥檔 26 項通過。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、build 通過；test 339 項通過（172/48/36/9/74）。首次完整 E2E 41 通過、1 失敗，手機最佳化取消實際為搜尋完成；單檔手機重複五次共 10 項通過，完整 E2E 重跑 42 項通過。偶發問題另見 ISSUE-019，尚未證實已解決。日誌位於 management/tests/logs/s10-variant-2026-11-19-2238/。本輪三個測試驗收完成；原 S10 檔案無完整備份，ISSUE-018 保持 OPEN，S14 仍 BLOCKED。
## ISSUE-019 最佳化取消驗收（本輪 DONE）

依 S13 清單補強取消及舊結果隔離測試，使用可控制的進行中 Worker，不更動遊戲數值；完成後驗證相關單元、桌面／手機 E2E 及完整回歸。

## 2026-11-19：ISSUE-019 取消測試補強

針對 E2E 極小工作可能在取消前完成的時序，測試中攔住一次 Worker 請求，確認取消時工作仍在執行，並在下一次啟動前恢復原方法；此案例不驗證長時間真實搜尋的性能。單元測試另外驗證取消後遲到的 RESULT 不產生排名且狀態維持取消。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 339 項、完整 E2E 42 項；最佳化 E2E 桌面和手機各重複五次共 20 項通過。日誌 management/tests/logs/issue-019-2026-11-19-2244/。原始偶發失敗的根因未經證實，ISSUE-019 保持 OPEN，需後續觀察真實長工作取消；ISSUE-018 與 S14 狀態不變。
## ISSUE-019 真實 Worker 取消測試（本輪 DONE）

以版本化合成裝備擴大搜尋，在收到實際 Worker 進度後取消，驗證沒有部分排名或配置寫入並能重新啟動；完成後執行桌面、手機及完整回歸。

## 2026-11-19：真實 Worker 執行中取消驗證

新增桌面及手機 E2E，以 304 件合成裝備組成大範圍搜尋，等待真實 Worker 發出搜尋進度後取消；驗證無部分排名、鎖定後可重新搜尋，以及匯出備份的原配置與裝備數量不變。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build 均通過；單元及整合 339 項，完整 E2E 44 項通過；真實 Worker 取消案例桌面／手機各重複五次共 10 項通過。日誌：management/tests/logs/issue-019-real-2026-11-19-225508/。此案例證實受測條件下取消，並不能證明先前偶發「搜尋完成」的根因；ISSUE-019 保持 OPEN，ISSUE-018 及 S14 狀態不變。
## S10 技能變體事件驗收（本輪 DONE，2026-11-21）

補測合成技能變體的劍氣、狀態套用與移除、武學切換順序，以及未知事件時間阻擋；驗收以 S10 測試清單為準。

## 2026-11-21：S10 技能變體事件驗收

新增兩項合成測試：驗證劍氣、狀態套用／移除、命中及切換武學的事件時間順序與結果；事件時間未知時阻擋並不輸出部分傷害。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 全部通過；單元與整合 341 項（172／48／38／9／74），桌面及手機 E2E 44 項。日誌位於 management/tests/logs/s10-events-2026-11-21-154058/。本輪測試通過，不代表已找到原始受損測試或驗證真實遊戲數值；ISSUE-018、ISSUE-019 保持 OPEN，S14 保持 BLOCKED。
## S10 同時刻與 Buff 重套用驗收（本輪 DONE，2026-11-21）

補測同毫秒事件先後與命中快照／動態狀態，以及 Buff REFRESH 重設到期時間；合成資料、完成後集中驗收。

## 2026-11-21：S10 同時刻與 Buff 重套用驗收

新增兩項合成測試：同毫秒事件 FIFO 順序及施放快照／動態命中的差異；Buff REFRESH 後重新計算到期時間及後續傷害。首次測試因篩選技能命中紀錄漏掉命中 ID 而失敗，修正測試後戰鬥檔 30 項通過。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 343 項（172／48／40／9／74），E2E 44 項；日誌 management/tests/logs/s10-buff-2026-11-21-155237/。原始損壞測試無完整備份，ISSUE-018 保持 OPEN；ISSUE-019 與 S14 狀態不變。
## S14 鳴金·虹來源對照（本輪 DONE，2026-11-21）

前置：S11 DONE；S14 仍因真實機制資料缺失 BLOCKED。本輪僅檢查已取得的來源快照，產出無名劍／槍的候選與缺口報告；驗證 SHA-256、來源索引與候選數量，不發布正式數值。

## 2026-11-21：鳴金·虹來源候選對照

完成 management/data-sources/S14-NAMELESS-REVIEW.md，對照專案候選無名劍／槍與快照 Nameless Sword／Spear，記錄兩個 tier 的天賦類別、使用者提供版本與角色條件、面板是否包含加成及 DPS 所需資料。名稱映射為候選，未標為已驗證；未發布正式資料。

Windows Node 22.14.0：以 node 讀取本地 JSON，驗證 SHA-256 73f75d198c74154de4cf10ed32fde3ace02a00562c8bbefb2be2296ef7c521db、原始與 staging 各 22 筆、來源 index 1／3 名稱、tier 13／14 與映射待審核；結果 PASS，兩武學各 tier 有 5／6 項天賦。`git diff --name-only -- data/raw data/staging` 無變更。僅文件與來源對照，未執行應用程式測試或發布。完整 DPS 仍缺版本化係數、時間、公式及面板語意；S14 維持 BLOCKED，ISSUE-016、ISSUE-018、ISSUE-019 維持 OPEN。
## 鳴金·虹試算結果顯示（本輪 DONE，2026-11-22）

依使用者要求先完成 Web 結果顯示，數值正確性後續處理；新增固定試算紀錄畫面並明確標示包含預估資料、輸入與限制。驗收導覽、結果、可存取性、桌面手機與既有回歸；S14 實際係數驗證仍 BLOCKED。

## 2026-11-22：鳴金·虹試算結果顯示

依使用者要求先完成 Web 結果顯示；新增主選單「鳴金·虹試算」，呈現使用者確認的面板、心法、版本、玉斗 3/4，以及先前 55 秒社群參考軸的固定試算紀錄。畫面標示「包含預估資料／預估值」，說明數值未校準、四件套未啟用、結果不隨配置更新；不將結果寫入計算引擎或正式遊戲資料。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 344 項（172／48／40／9／75），桌面及手機 E2E 46 項。日誌 management/tests/logs/splendor-web-2026-11-22-025137/。本輪畫面完成；實際運算、社群模型的適用性與遊戲數值正確性仍待後續確認，S14 不標為完成。
## 裝備詞條下拉選擇（本輪 DONE，2026-11-22）

依使用者要求修改 S05 裝備編輯器：詞條以版本資料及已辨識常用名稱下拉選擇，未知名稱保留手動輸入；修改名稱時需重新確認，確保截圖草稿不遺失。驗收版本映射、未知草稿與桌面手機。

## 2026-11-22：裝備詞條下拉選擇

既有詞條名稱改為下拉選擇；選項包含已辨識的常用名稱及目前資料版本的詞條，未收錄或未映射名稱可透過其他選項保留／輸入。修改名稱會清除人工確認，不把既有數值自動確認；原始截圖資料不改寫。基礎屬性輸入保留原方式。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 344 項（172／48／40／9／75），桌面及手機 E2E 48 項。另在獨立 Playwright 瀏覽器匯入本機 10 件裝備草稿，確認原有數值 73.1 與詞條「最大外功攻擊」顯示並自動選中；未操作使用者的瀏覽器資料。日誌 management/tests/logs/affix-select-2026-11-22-105358/。詞條候選名稱不是版本化合法詞條的認證，S14 仍 BLOCKED。
## 裝備系統重構（IN_PROGRESS，2026-11-22）

使用者指定裝備與版本解耦、等級預設100、生成與編輯共用規則、紫裝獨立、滿值與承音互斥；數據不足顯示未知並保留手動輸入。現有版本欄位、備份、配裝與計算引擎相互依賴，依 ADR-014 分階段處理並集中驗收；在全部必要項目完成前不得標記整體 DONE。

## 2026-11-22：裝備等級與重構準備

依使用者新規格建立 ADR-014；新增向後相容的裝備等級欄位，新裝備與舊資料編輯預設並儲存 100。使用者確認缺滿值／承音資料時顯示未知並保留手動輸入。此階段尚未解除版本耦合、完成依裝備詞條池的生成表單或紫裝／滿值／承音的互斥自動帶值；整體重構保持 IN_PROGRESS，不能視為完成。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 344 項（172／48／40／9／75），E2E 48 項；日誌 management/tests/logs/equipment-level-2026-11-22-115101/。含新裝備預設100及備份寫入檢查。
## 2026-11-22：裝備版本解耦第一階段

使用者補充不必相容舊版裝備模型，以新規格重構。移除裝備編輯器版本選擇，以及配裝與玩家備份對裝備版本相同的限制；無版本裝備可加入配置。現有傷害引擎仍檢查資料版本，尚未完成以角色版本解析無版本裝備，因此暫不能宣稱無版本裝備已可計算；生成表單及紫裝／滿值／承音互斥自動帶值亦待完成。整體重構維持 IN_PROGRESS。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 343 項（171／48／40／9／75），E2E 48 項；日誌 management/tests/logs/equipment-unversioned-2026-11-22-121558/。
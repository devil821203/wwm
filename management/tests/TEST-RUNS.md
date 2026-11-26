# 測試執行紀錄

## 2026-11-17 — S01 本機集中驗收：PASS
環境：Windows PowerShell、Node v22.14.0（官方 ZIP SHA256 比對通過）、pnpm 10.6.5、React 19、Vite 6.4.6、Vitest 3.2.7、Playwright 1.65.1 Chromium。
日期依使用者 Asia/Taipei 工作日期；原始工具日誌包含執行主機的時間。

| 命令 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd install | PASS，271 個套件；已生成 lockfile | logs/S01-install.log |
| pnpm.cmd install --frozen-lockfile | PASS，lockfile up to date | logs/S01-frozen-install.log |
| pnpm.cmd format:check（第一次） | FAIL，CSS Unclosed string | logs/S01-format-check.log |
| pnpm.cmd lint | PASS，exit 0 | logs/S01-lint.log |
| pnpm.cmd typecheck | PASS，exit 0 | logs/S01-typecheck.log |
| pnpm.cmd test | PASS，1 檔／2 測試 | logs/S01-test.log |
| pnpm.cmd build（第一次） | exit 0 但有 CSS 語法警告，不採作最終驗收 | logs/S01-build.log |
| pnpm.cmd format:check（修正後） | PASS，All matched files use Prettier code style | logs/S01-format-check-retry.log |
| pnpm.cmd build（修正後） | PASS，29 modules，無 CSS 語法警告 | logs/S01-build-retry.log |
| pnpm.cmd exec playwright install chromium | PASS，瀏覽器下載完成 | logs/S01-browser-install.log |
| pnpm.cmd test:e2e | PASS，桌面與手機各 1 測試，共 2 passed；無 pageerror 或水平溢出 | logs/S01-e2e.log |
| pnpm.cmd dev --port 5173 --strictPort | PASS，Vite ready 235ms；HTTP GET 200 | logs/S01-dev-http.log |

人工視覺檢查：已開啟 artifacts/S01-desktop.png（1440×1100）及 artifacts/S01-mobile.png（390px 全頁），確認標題、配置表單、缺資料提示與手機單欄排列正常。
範圍：僅 S01 基礎首頁、啟動與工具鏈；沒有驗證真實遊戲 DPS、未實作功能或遠端 CI 執行。
非失敗訊息：安裝出現 ESLint 9、jest-dom 等套件維護警告；E2E 有終端色彩環境警告。未隱藏此訊息，後續維護時評估升版。
缺陷：ISSUE-001（Windows 工具鏈）、ISSUE-002（CSS 編碼）已修正並驗收。
## 2026-11-17 — S02 本機集中驗收：PASS
環境：Windows PowerShell、Node v22.14.0、pnpm 10.6.5、Zod 4（精確版見 pnpm-lock.yaml）、Vitest 3.2.7、TypeScript、Chromium。
日期依使用者 Asia/Taipei 工作日期；原始日誌為執行主機時鐘。

| 命令 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd install | PASS，3 workspace、新增 1 套件 | logs/S02-install.log |
| pnpm.cmd format:check | PASS | logs/S02-format-check.log |
| pnpm.cmd lint | PASS，exit 0 | logs/S02-lint.log |
| pnpm.cmd typecheck | PASS，web 與 game-data | logs/S02-typecheck.log |
| pnpm.cmd test | PASS，game-data 51 項 + 首頁 2 項 | logs/S02-test.log |
| pnpm.cmd build | PASS，資料套件 ESM/型別/JSON 與 Web | logs/S02-build.log |
| pnpm.cmd test:e2e | PASS，桌面/手機 Chromium 各 1 項 | logs/S02-test-e2e.log |
| pnpm.cmd install --frozen-lockfile | PASS，lockfile up to date | logs/S02-frozen-install.log |
| node --input-type=module（stdin 編譯產物 smoke assertions） | PASS，dist/index.js 匯入、11 候選、UNKNOWN null、名冊不可當 release、測試 fixtures 不在 dist | logs/S02-package-smoke.log |

契約覆蓋：有效與無效版本、非連續/空合法等級、無硬編上限、重複 ID、跨版本/外鍵/來源缺失、錯配武學與技能、未知值與零值、非有限值/字串拒絕、推估與人工確認證據、裝備來源共用契約、current/effective/maximum 分離、未確認 OCR 不可標確認值、整數毫秒、11 候選與第 12 流派擴充。
本輪無測試失敗；安裝沿用既有套件維護警告，E2E 有終端色彩警告，命令皆 exit 0。
限制：僅結構驗證，不代表資料來源真實、裝備合法、公式可信或有可用 DPS；S03 審核/匯入、S07 合法值引擎尚未實作。CI 設定涵蓋遞迴命令，但未宣稱遠端 CI 已執行。
需求衝突已記 ADR-002：舊 Build 範例分庫與新統一裝備規格不符，遵守 docs/09 > 08 > 舊範例。

## 2026-11-17 — SPEC-V1.1 規格整合驗收：PASS
環境：Windows PowerShell、Node 22.14.0、pnpm 10.6.5；本機檔案驗證，無外部來源存取。
來源：根目錄 WWM_Codex_Managed_Project_V1.1；對照證據：management/decisions/V11-INTEGRATION-MANIFEST.json。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| PowerShell Get-ChildItem/Get-FileHash -Algorithm SHA256，對照整合 manifest | PASS，40 個原始輸入檔案均未改動；全部 requirements 一致；5 個新政策檔案逐位元相同 | logs/SPEC-V11-integrity.log |
| PowerShell Get-FileHash 與歷史內容 StartsWith 檢查 | PASS，55 個受保護應用/鎖檔/ADR/舊日誌/畫面檔案無變更，2 份歷史索引前綴保留 | logs/SPEC-V11-integrity.log |
| PowerShell ConvertFrom-Json、唯一 ID／狀態檢查 | PASS，4 個候選來源 ID 唯一，license_status 全為 unverified；U01–U10 規格存在且仍 NOT_RUN | logs/SPEC-V11-integrity.log |
| PowerShell 狀態表/依賴/UTF8/Markdown 相對連結檢查 | PASS，17 步狀態有效，S01/S02 DONE、S03–S17 NOT_STARTED；F12/S17 與必讀政策已整合；受檢文件連結可解析 | logs/SPEC-V11-integrity.log |
| pnpm.cmd exec prettier --write README.md | PASS，僅格式化 README | logs/SPEC-V11-format.log |
| pnpm.cmd format:check | PASS，All matched files use Prettier code style | logs/SPEC-V11-format-check.log |

本輪未變更產品程式或依賴，不重跑單元、建置與 E2E；先前 S01/S02 結果僅作保留證據，不作本輪執行宣稱。
未執行 S17 的 U01–U10，未下載資料/建立遊戲快照/確認授權/發布資料包。UPDATE-LOG.md 保留「尚未執行來源更新」。
驗收無失敗；規格優先序與補全依賴的決策見 ADR-003。

## 2026-11-17 — S03 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、Node v22.14.0、pnpm 10.6.5、Zod 4、Vitest 3.2.7、TypeScript、Playwright Chromium。
日期依使用者 Asia/Taipei 工作日期；日誌中的執行時鐘依主機。未新增依賴或修改 lockfile。

| 命令 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd format:check | PASS | logs/S03-format-check.log |
| pnpm.cmd lint | PASS | logs/S03-lint.log |
| pnpm.cmd typecheck（第一次） | FAIL，TS2322，測試 fixture 展開 union 後加 sourceIds | logs/S03-typecheck.log |
| pnpm.cmd test | PASS，game-data 100 項、首頁2項；其中 S03 新增49項（解析33、匯入審核16），原契約51項 | logs/S03-test.log |
| pnpm.cmd build | PASS，資料套件與Web產物；測試檔不在建置範圍 | logs/S03-build.log |
| pnpm.cmd test:e2e | PASS，desktop/mobile 各1項，共2項 | logs/S03-test-e2e.log |
| pnpm.cmd typecheck（測試 fixture 修正後） | PASS，exit 0 | logs/S03-typecheck-retry.log |
| pnpm.cmd --filter @wwm/game-data test | PASS，3檔100項 | logs/S03-game-data-test-retry.log |
| pnpm.cmd lint／format:check（修正後） | PASS，exit 0 | logs/S03-lint-retry.log、logs/S03-format-check-retry.log |
| node --input-type=module（stdin 編譯產物整合 assertions） | PASS，registry→staging→review→UNKNOWN→計算阻擋；合成 fixture 不在產物 | logs/S03-package-smoke.log |

驗收範圍：實例覆寫/實值/適用模型/UNKNOWN 優先序；0與小數；明確資料模式；精確版本/實體/欄位/階級/品質/培養/調律/單位/精度；同值來源排名與異值衝突；人工選擇綁定候選值；覆寫歷史與主資料更新差異；必需未知阻擋且未使用未知不污染；預估文字標籤與依賴報告；無效/跨服/跨版/失效來源 JSON；SHA-256與舊新差異；人工審核、過期baseline與修改提案拒絕。
失敗修正：ISSUE-003，僅修正測試 fixture 型別，產品程式未因該修正變更；因此重驗 typecheck、資料套件測試及Lint/格式，不重跑未受影響的既有Web/E2E。
非失敗訊息：E2E 的 NO_COLOR/FORCE_COLOR 終端色彩警告，命令 exit 0。
限制：本輪僅合成資料驗證核心機制，不代表真實遊戲係數、來源授權或DPS已驗證；未抓取第三方來源、未執行來源更新/發布，UPDATE-LOG 保持尚未執行，S17 U01–U10 仍 NOT_RUN。

## 2026-11-17 — S04 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、Node 22.14.0、pnpm 10.6.5、Dexie 4、dexie-react-hooks、fake-indexeddb、Zod 4、Vitest 3.2.7、Playwright Chromium。
日期依使用者Asia/Taipei工作日期；精確相依版本見lockfile，日誌時鐘依執行主機。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd install | PASS，3 workspace，新增Dexie等3個套件 | logs/S04-install.log |
| pnpm.cmd format:check（第一次） | FAIL，characters.spec.ts格式 | logs/S04-format-check.log |
| pnpm.cmd lint | PASS | logs/S04-lint.log |
| pnpm.cmd typecheck／build（第一次） | FAIL，Testing Library ByRoleOptions不接受exact | logs/S04-typecheck.log、logs/S04-build.log |
| pnpm.cmd test | PASS，資料套件115項、Web13項，共128項；S04新增26項 | logs/S04-test.log |
| pnpm.cmd test:e2e（第一次） | 停止，不採作S04驗收；當次建置失敗，尚為舊產物 | logs/S04-test-e2e.log |
| pnpm.cmd format:check（修正後） | PASS | logs/S04-format-check-retry.log |
| pnpm.cmd typecheck（修正後） | PASS | logs/S04-typecheck-retry.log |
| pnpm.cmd build（修正後） | PASS，139 modules，JS465.50kB/gzip143.73kB | logs/S04-build-retry.log |
| pnpm.cmd test:e2e（最新正式建置） | PASS，8項，桌面/手機各4項 | logs/S04-test-e2e-retry.log |
| pnpm.cmd --filter @wwm/web test（修正後） | PASS，3檔13項 | logs/S04-web-test-retry.log |
| pnpm.cmd lint（修正後） | PASS | logs/S04-lint-retry.log |
| pnpm.cmd install --frozen-lockfile | PASS，lockfile up to date | logs/S04-frozen-install.log |
| pnpm.cmd preview --port 5174 --strictPort + node/Playwright畫面檢查 | 初次指令中文管線編碼timeout；UTF8重試PASS，HTTP200，兩份全頁畫面已保存 | logs/S04-preview.log、logs/S04-preview-retry.log |

實際覆蓋：版本/合法等級/流派與屬性/武學外鍵、跨版拒絕；角色與多Build CRUD/複製、刪角級聯、IndexedDB關閉重開還原、寫入失敗交易回滾、過期編輯拒絕、JSON跨DB往返/重複匯入/ID衝突整批拒絕；畫面儲存失敗不報成功且保留輸入。
E2E：首頁未知DPS回歸；角色建檔/改名、配置編輯/複製、重整後還原、下載JSON、刪除後匯入還原；無效備份不破壞角色；合成版本只列[2,9]等級、手動面板0與武學等級儲存重整後保留。
視覺：已實際開啟artifacts/S04-desktop.png（1440px全頁）與S04-mobile.png（390px全頁），確認列表、表單、備份操作與配置按鈕正常，手機單欄無水平溢出。
失敗修正：ISSUE-004測試API/格式，ISSUE-005驗收指令編碼，均CLOSED。
非失敗訊息：Vite移除Zod第三方註解中位置不合的PURE annotation；Playwright有終端色彩警告。保留原日誌，build/E2E皆exit 0。
範圍限制：未取得/驗證真實遊戲數值；角色版本空白時不提供任意等級。心法/奇術/天賦資料引用可保存備份，但缺版本定義時不產生選項。S05裝備編輯、S08傷害合成及S17發布未實作；沒有執行U01–U10或宣稱遠端CI通過。

## 2026-11-17 — S05 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、Node22.14.0、pnpm10.6.5、Dexie4、fake-indexeddb、Zod4、Vitest3.2.7、Playwright Chromium。未新增套件相依。
日期依使用者Asia/Taipei工作日期，日誌時鐘依主機。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd format:check（第一次） | FAIL，兩份新增測試檔格式；後續命令停止 | logs/S05-format-check.log |
| pnpm.cmd format:check／lint／typecheck（第一次重驗） | PASS | logs/S05-format-check-retry.log、logs/S05-lint-retry.log、logs/S05-typecheck-retry.log |
| pnpm.cmd test（第一次重驗） | 資料120項通過；Web28項中1項遷移測試DatabaseClosedError | logs/S05-test-retry.log |
| pnpm.cmd format:check／lint／typecheck（第二次重驗） | PASS | logs/S05-format-check-retry2.log、logs/S05-lint-retry2.log、logs/S05-typecheck-retry2.log |
| pnpm.cmd test（第二次重驗） | PASS，資料120項、Web29項 | logs/S05-test-retry2.log |
| pnpm.cmd build／test:e2e（第二次重驗） | PASS，正式建置及12個E2E | logs/S05-build-retry2.log、logs/S05-test-e2e.log |
| pnpm.cmd format:check／lint／typecheck（補強重新確認後） | PASS | logs/S05-format-check-final.log、logs/S05-lint-final.log、logs/S05-typecheck-final.log |
| pnpm.cmd --filter @wwm/web test（最終） | PASS，Web30項；連同未變更的資料120項，最終單元/整合總計150項，S05新增22項 | logs/S05-web-test-final.log |
| pnpm.cmd build（最終） | PASS，143modules，JS489.46kB/gzip150.16kB | logs/S05-build-final.log |
| pnpm.cmd test:e2e（最終） | PASS，12項，桌面/手機各6項 | logs/S05-test-e2e-final.log |
| pnpm.cmd preview --port 5175 --strictPort + node/Playwright視覺檢查 | PASS，HTTP200，截圖校對/確認0值/圖片保存，兩版面無水平溢出 | logs/S05-preview.log |

覆蓋：未知版本/品質/階級裝備草稿、未確認數字UNKNOWN與原文保留、0與原始小數、資料庫provenance不被未修改編輯洗成手動、裝備上下文變更後重確認、PNG/JPEG/WebP檔頭與大小限制、圖片格式契約、舊備份相容與圖片外鍵、v1→v2保留舊角色、裝備/圖片/歷史交易與回滾、備份還原及重開、過期編輯拒絕、未知版禁止配裝、已知版同部位替換/刪除解除引用。
E2E：新增無圖人工建檔/逐欄確認/重整/複製；錯誤圖片拒絕、未同意不存原圖、明確同意保存原圖、刪除後JSON匯入還原原圖。連同S01/S04既有8項回歸共12項。
視覺：已開啟artifacts/S05-desktop.png（1440px）及S05-mobile.png（390px）全頁，確認原圖/數值/狀態正常；圖面明示TEST FIXTURE非遊戲資料，未偽造遊戲截圖。
失敗修正：ISSUE-006；格式重驗及遷移測試重建實例後通過。依賴檢查未過前未執行建置/E2E，不採舊產物結果。
非失敗訊息：Vite處理第三方Zod的PURE註解警告、Playwright終端色彩警告；實際build/E2E皆exit0。
限制：S05為人工校對，OCR adapter（S06）、合法詞條/承音/MAX計算（S07）及DPS（S08+）尚未實作；沒有授權新來源、取得遊戲真實值、執行S17或U01–U10。

## 2026-11-17 — S06 本機集中驗收：PASS
環境：Windows PowerShell、Node22.14.0、pnpm10.6.5、Tesseract.js7.0.0、Vitest3.2.7、Playwright Chromium。日期依使用者Asia/Taipei工作日期，日誌時鐘依主機。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd install | PASS，鎖定OCR套件與eng/chi_tra模型 | logs/S06-install.log |
| pnpm.cmd format | PASS，實作完成後統一格式 | logs/S06-format.log |
| pnpm.cmd format:check／lint／typecheck | PASS，首次集中驗收全通過 | logs/S06-format-check.log、logs/S06-lint.log、logs/S06-typecheck.log |
| pnpm.cmd test | PASS，資料123項、Web48項，合計171項；S06新增21項 | logs/S06-test.log |
| pnpm.cmd build／test:e2e | PASS，16項E2E；初始主bundle出現大小提示，後續改善延遲載入 | logs/S06-build.log、logs/S06-test-e2e.log |
| pnpm.cmd format:check／lint／typecheck（延遲載入後） | PASS | logs/S06-format-check-final.log、logs/S06-lint-final.log、logs/S06-typecheck-final.log |
| pnpm.cmd --filter @wwm/web test（最終） | PASS，48項 | logs/S06-web-test-final.log |
| pnpm.cmd build（最終） | PASS，176modules；主JS496.18kB/gzip152.86kB；OCR面板10.57kB、API15.83kB獨立載入，無主bundle超500kB提示 | logs/S06-build-final.log |
| pnpm.cmd test:e2e（最終） | PASS，16項，桌面/手機各8項 | logs/S06-test-e2e-final.log |
| pnpm.cmd install --frozen-lockfile | PASS | logs/S06-frozen-install.log |
| node資產完整性檢查 | PASS，public及dist的18份資產SHA256一致，總25,027,083bytes，含兩種模型與授權資料 | logs/S06-assets-integrity.log |
| pnpm.cmd preview --port 5176 --strictPort + node/Playwright | PASS，真實本機辨識/手動更正與雙版面無水平溢出 | logs/S06-preview.log |

覆蓋：adapter替換/取消/錯誤、全半形與百分比/0/小數/歧義/低信心、版本字典匹配、候選不自動確認、同名人工值保護、metadata保護、原文/信心/座標/變換參數JSON往返。
E2E：實際Worker分別載入eng及chi_tra+eng，辨識明示TEST FIXTURE的合成英文圖片；監控無第三方HTTP(S)請求。人工改99後重辨識不覆蓋；故障回退文字候選，未確認數值仍UNKNOWN且信心null。既有12項回歸與新增4項皆通過。
視覺：已實際開啟artifacts/S06-desktop.png（1440px）及S06-mobile.png（390px），確認候選原文/信心、人工13.5更正、未確認狀態與按鈕排版。
非失敗訊息：繼承的Zod PURE annotation及Playwright終端色彩警告；pnpm略過Tesseract donation postinstall，已檢查其僅opencollective-postinstall，未啟用腳本，真實Worker正常。首次正式驗收未失敗；初始bundle提示已改善並重驗受影響流程。
限制：這是合成圖片功能驗收，不代表真實遊戲截圖或繁中文字準確率達標；未取得真實遊戲數值、未執行S07/S17或U01–U10，未宣稱遠端CI或發布成功。

## 2026-11-17 — S07 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、專案可攜Node22.14.0/pnpm10.6.5、Zod4、Vitest3.2.7、Playwright1.65.1 Chromium；日期依使用者Asia/Taipei工作日期，日誌時鐘依主機。
前置：S03/S05 DONE；已讀docs/03/04/07/08/09、來源政策與sources.json。本輪未新增套件版本或正式遊戲資料。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd format（首次） | FAIL，既有path-candidates.json含二進位，未進後續驗收 | logs/S07-format.log |
| node名冊內容比對／保留異常／還原 | PASS，dist副本與requirements JSON深度相同；原位元組保存artifacts/S07-path-candidates-invalid.bin | logs/S07-catalog-recovery.log |
| pnpm.cmd format／format:check／lint（還原後） | PASS | logs/S07-format-retry.log、logs/S07-format-check.log、logs/S07-lint.log |
| pnpm.cmd typecheck（還原後） | FAIL，node_modules兩份Vitest宣告檔為二進位；未執行單元/建置/E2E | logs/S07-typecheck.log |
| pnpm.cmd install --force --offline --frozen-lockfile | FAIL，共用pnpm-store的stat UNKNOWN | logs/S07-reinstall.log |
| pnpm.cmd install --force --frozen-lockfile --store-dir .tools/pnpm-store-s07（第一次） | FAIL，原node_modules的scandir UNKNOWN | logs/S07-reinstall-isolated.log |
| 將node_modules保留移至.tools/node-modules-s07-damaged後，同上隔離安裝命令 | PASS，依鎖檔重新取得340份依賴 | logs/S07-reinstall-clean.log |
| pnpm.cmd format:check／lint／typecheck／test／build（隔離重建後） | PASS，資料155項/Web52項；主JS508.62kB有大小提示 | logs/S07-*-retry.log |
| pnpm.cmd test:e2e（第一次功能驗收） | FAIL，新增2項精確文字定位失敗，既有16項通過；實際畫面已顯示94預估值 | logs/S07-test-e2e-retry.log |
| pnpm.cmd format:check／lint／typecheck／test／build／test:e2e（文字元件/延遲載入修正後） | PASS，資料155項/Web52項、E2E18項；主bundle低於500kB | logs/S07-*-final.log |
| pnpm.cmd format:check／lint／typecheck（非零步進起點與完整性補強後） | PASS | logs/S07-format-check-complete.log、logs/S07-lint-complete.log、logs/S07-typecheck-complete.log |
| pnpm.cmd test（最終） | PASS，資料158項/Web52項，合計210項；S07新增39項 | logs/S07-test-complete.log |
| pnpm.cmd build（最終） | PASS，178modules；主JS480.98kB/gzip148.52kB；裝備頁27.96kB按需載入 | logs/S07-build-complete.log |
| pnpm.cmd test:e2e（最終） | PASS，18項，桌面/手機各9項，含新S07流程及既有OCR實際Worker回歸 | logs/S07-test-e2e-complete.log |

覆蓋：紫裝80與其他品質100不混用、承音94模型與明確0優先、實例人工覆寫與差異提示、估算/明確資料篩選/無模型未知、品質/版本/階級/階段隔離、MAX衝突選擇與原值不變、版本化模型日期/公式/來源/輸入、0與小數及非零起點步進、數量/可用池/互斥/上下限/精度、相同條件規則衝突、缺完整規則禁止合法MAX、三種creationMethod數值一致、JSON及交易歷史。
新E2E：匯入明示非遊戲資料的合成備份，預覽80基礎值/94預估值/100上限，禁止推估後UNKNOWN，明確套用合法MAX，保存/重整及備份仍保留原current UNKNOWN、effective RECORDED100與VALID。
視覺：已實際開啟artifacts/S07-desktop.png及S07-mobile.png全頁，確認模式、原值/有效值/上限與預估標示、按鈕可用；E2E斷言兩版面無水平溢出。截圖使用Playwright專案設定含裝置倍率。
失敗修正：ISSUE-007名冊/依賴檔案完整性、ISSUE-008文字定位；異常檔及舊依賴保留備查，成因未知，不宣稱已定位損壞原因。額外補強MAX完整性與非零步進後再跑全部受影響驗收。
非失敗訊息：繼承的Zod PURE註解與Playwright色彩警告；Tesseract donation postinstall仍略過，實際OCR E2E通過。初始主bundle大小提示已因裝備頁延遲載入消除。
限制：只有本機合成規則驗收；沒有正式遊戲數值或真實規則完整度證明。尚未執行S08傷害、S12生成、S17/U01–U10、遠端CI或發布。

## 2026-11-17 — S08 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、專案可攜Node22.14.0/pnpm10.6.5、TypeScript5、Zod4、Vitest3.2.7、Playwright1.65.1 Chromium。日期依使用者Asia/Taipei工作日期，日誌時鐘依主機。
前置：S03/S07 DONE；已讀起點文件與docs/01–06/09、來源政策/登錄表。本輪新增workspace套件與鎖檔連結，無新增外部套件。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd install --offline --store-dir .tools/pnpm-store-s07 | PASS，連結stat-engine及更新workspace鎖檔，未下載新外部套件 | logs/S08-install.log |
| pnpm.cmd format（首次） | FAIL，新增E2E型別斷言語法；未進後續驗收 | logs/S08-format.log |
| pnpm.cmd format／format:check（第一次修正） | 格式化成功；format:check仍提示E2E檔，針對檔案再格式化後通過 | logs/S08-format-retry.log、logs/S08-format-check-retry.log |
| pnpm.cmd format:check／lint／typecheck／test／build／test:e2e（第二次修正） | PASS，資料161項/數值31項/Web54項，E2E22項 | logs/S08-*-retry2.log |
| pnpm.cmd format:check／lint／typecheck（顯示/裝備限制補強後） | PASS | logs/S08-format-check-final.log、logs/S08-lint-final.log、logs/S08-typecheck-final.log |
| pnpm.cmd test（補強後） | 資料161項/數值32項通過；Web54項中1項顯示regex雙重跳脫失敗，實際393.39正確；停止建置/E2E | logs/S08-test-final.log |
| pnpm.cmd format:check／lint／typecheck（最終） | PASS | logs/S08-format-check-complete.log、logs/S08-lint-complete.log、logs/S08-typecheck-complete.log |
| pnpm.cmd test（最終） | PASS，資料161項/數值32項/Web54項，合計247項；S08新增37項 | logs/S08-test-complete.log |
| pnpm.cmd build（最終） | PASS，三套件建置；Web182modules，主JS481.94kB/gzip148.72kB；傷害頁15.84kB按需載入 | logs/S08-build-complete.log |
| pnpm.cmd test:e2e（最終） | PASS，22項，桌面/手機各11項；新傷害4項及既有18項回歸 | logs/S08-test-e2e-complete.log |
| pnpm.cmd install --offline --frozen-lockfile --store-dir .tools/pnpm-store-s07 | PASS，lockfile up to date | logs/S08-frozen-install.log |

覆蓋：面板語意/裝備不重加、逐項來源、0/小數/未知必要面板、承音實值/估算傳播、未使用UNKNOWN/ESTIMATED隔離、裝備自身與全域明確資料限制、跨版/流派/等級/部位/缺引用/未知效果、固定公式ID與證據/等級適用範圍、完整機率/單位/倍率、多段期望值、非有限溢位、同輸入穩定及JSON輸入重播、來源不被修改。
E2E：明示合成備份匯入，預估承音→攻擊274→單技能期望傷害約393.39，欄位與結果標示預估；明確資料篩選後阻擋並清空舊結果；下載request/result含來源/版本/裝備/固定時間且meanDps null；重整後相同數值。已含裝備面板274不重加；面板語意未知時明確阻擋。
視覺：已實際開啟artifacts/S08-desktop.png及S08-mobile.png最終全頁，確認393.39顯示、預估標示、來源拆解與下載按鈕；兩版面E2E均斷言無水平溢出。JSON保留原始浮點精度，不在運算前取整。
失敗修正：ISSUE-009；新增測試語法、格式及顯示regex修正，所有最終必要驗收通過。
非失敗訊息：離線install顯示既有eslint/testing-library/whatwg-encoding棄用提示，未升版；繼承Zod PURE annotation及Playwright色彩警告，實際build/E2E exit0。
限制：weighted-hit-v1只是明確參數的固定實作，不宣稱遊戲真實公式。沒有正式係數/實測、未做S09特殊技能契約或S10–S11循環DPS，meanDps仍null；未執行S17/U01–U10、遠端CI或發布。

## 2026-11-17 — S09 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、專案可攜Node22.14.0/pnpm10.6.5、Dexie4/fake-indexeddb、Zod4、Vitest3.2.7、Playwright1.65.1 Chromium。日期依使用者Asia/Taipei工作日期，日誌時鐘依主機。
前置S08 DONE；已完整閱讀起點文件、docs/02–06/09、fixtures與來源政策/登錄表。無新增套件或擷取來源。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd format／format:check（首次） | format成功；check提示兩份新增測試，未進後續驗收 | logs/S09-format.log、logs/S09-format-check.log |
| pnpm.cmd exec prettier --write apps/web/src/measurement/measurement-storage.test.ts tests/e2e/measurement.spec.ts | PASS，隨後format:check通過 | logs/S09-format-check-retry.log |
| pnpm.cmd lint／typecheck（第一次重驗） | PASS | logs/S09-lint-retry.log、logs/S09-typecheck-retry.log |
| pnpm.cmd test（第一次重驗） | 資料161項/數值45項通過；Web60項中新增實測表單及既有S08 UI各一項5000ms逾時，其餘58項通過，未進建置/E2E | logs/S09-test-retry.log |
| pnpm.cmd --filter @wwm/web exec vitest run src/measurement/MeasurementWorkspace.test.tsx src/calculation/DamageWorkspace.test.tsx（maxWorkers=2） | PASS，5項；未改逾時門檻，表單1566ms，S08主要互動321ms | logs/S09-ui-timeout-retry.log |
| pnpm.cmd format:check／lint／typecheck（完整重驗） | PASS | logs/S09-format-check-final.log、logs/S09-lint-final.log、logs/S09-typecheck-final.log |
| pnpm.cmd test（完整重驗） | PASS，資料161項/數值45項/Web60項，合計266項；S09新增19項 | logs/S09-test-final.log |
| pnpm.cmd build／test:e2e（完整重驗） | PASS，全站26項E2E，桌面/手機各13項 | logs/S09-build-final.log、logs/S09-test-e2e-final.log |
| pnpm.cmd format:check／lint／typecheck（顯示修正後） | PASS | logs/S09-format-check-complete.log、logs/S09-lint-complete.log、logs/S09-typecheck-complete.log |
| pnpm.cmd --filter @wwm/web test（最終） | PASS，60項；未改資料及數值核心，連同前述161+45項共266項 | logs/S09-web-test-complete.log |
| pnpm.cmd build（最終） | PASS，187modules；主JS487.42kB/gzip150.29kB，實測頁14.49kB按需載入 | logs/S09-build-complete.log |
| pnpm.cmd exec playwright test tests/e2e/measurement.spec.ts（最終受影響驗收） | PASS，4項，兩版面保存/備份/變體/60秒流程 | logs/S09-measurement-e2e-complete.log |

覆蓋：變體明確選擇與父/其他變體隔離、等級適用範圍、未知係數不補、毫秒時間/事件量/劍氣缺失、重複ID/事件目標/版本來源契約；固定快照不回寫、JSON重播、MAE/MAPE零分母與0樣本、篩選/未確認條件拒絕比較、60秒不造預測、合成/真實標籤、缺來源/錯引用、v2→v3保留舊角色裝備、不可變快照/備份/衝突原子拒絕。
新E2E：合成普通變體393.39/蓄力586.56，未選變體則無法計算；保存原始0與393.39觀察，重整及刪除後備份還原，係數資料仍未改；60秒觀察只有總傷害紀錄，不提供循環預測或DPS。既有OCR真實Worker、裝備及傷害回歸全通過。
視覺：已實際開啟artifacts/S09-desktop.png及S09-mobile.png最終全頁，確認表單、未校準標記、MAPE百分號/極小誤差科學記號、紀錄操作；E2E斷言無水平溢出。畫面格式化，原始樣本與統計不取整。
失敗修正：ISSUE-010；12個jsdom檔並行時出現兩項逾時，environment合計63.17秒，限制workers為2後完整Web約12秒且全通過，支持資源競爭判斷；未放寬5000ms門檻。非失敗訊息為既有Zod PURE註解與Playwright終端色彩警告。
限制：只有明示合成fixture，沒有真實係數/三組遊戲實測或準確率/校準達標證明。事件契約尚未執行，S10/S11及S17/U01–U10、遠端CI、發布均未執行。

## 2026-11-18 — S10 本機集中驗收：PASS（修正後）
環境：Windows PowerShell、專案可攜Node22.14.0/pnpm10.6.5、TypeScript5、Zod4、Vitest3.2.7、Playwright1.65.1 Chromium；Web沿用maxWorkers=2。日期依Asia/Taipei使用者工作日期，日誌時間依主機。
前置S09 DONE；已讀工作起點、docs/01–06/09、fixtures及來源政策/登錄表。無遊戲來源擷取或新增外部套件；新增combat-engine workspace。

| 命令／檢查 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd install --offline --store-dir .tools/pnpm-store-s07 | PASS，新增workspace連結，下載0 | logs/S10-install.log |
| pnpm.cmd format／format:check（首次） | format完成，check提示新增E2E檔；停止後續驗收 | logs/S10-format.log、logs/S10-format-check.log |
| pnpm.cmd exec prettier --write tests/e2e/rotation.spec.ts；format:check／lint（第一次重驗） | PASS | logs/S10-format-check-retry.log、logs/S10-lint-retry.log |
| pnpm.cmd typecheck（第一次重驗） | FAIL，合成recorded建構回傳整個ResolvedValue聯集，ESTIMATED展開無法保證sourceIds與非null值；未進單元/建置/E2E | logs/S10-typecheck-retry.log |
| 修正recorded回傳RECORDED分支及UNKNOWN獨立欄位，format:check／lint／typecheck（第二次重驗） | PASS | logs/S10-format-check-retry2.log、logs/S10-lint-retry2.log、logs/S10-typecheck-retry2.log |
| pnpm.cmd test（首次實際執行） | PASS，資料161項/數值45項/戰鬥26項/Web64項，合計296項；S10新增30項 | logs/S10-test-retry2.log |
| pnpm.cmd build | PASS，4套件；Web192modules，主JS491.58kB/gzip151.43kB，循環頁22.73kB按需載入 | logs/S10-build-retry2.log |
| pnpm.cmd test:e2e | PASS，32項，桌面/手機各16項；S10新增6項，既有26項回歸 | logs/S10-test-e2e-retry2.log |
| pnpm.cmd install --offline --frozen-lockfile --store-dir .tools/pnpm-store-s07 | PASS，lockfile up to date | logs/S10-frozen-install.log |

核心覆蓋：時間+FIFO排序、0與安全整數、同輸入/JSON重播及輸入不變、固定/優先序、冷卻起點/群組與施放鎖定、資源整批檢查/上限/0、武學切換與切回仍取消、時間窗終點排除、Buff到期/刷新/拒絕、施放快照與動態、DOT區間/快照/動態/替換token/拒絕、劍氣與必要狀態/S09事件、未知必要值與明確資料限制、跨版/來源/規則缺失、未使用未知Buff隔離、多變體預估來源不互相覆蓋、10000事件上限不回傳部分結果。
UI/交易：變更條件清空舊結果、冷卻錯誤、多項優先序狀態保存不遺漏、循環隨Build保存/複製/備份還原，拒絕過期或跨版更新。
新E2E：明示合成循環3次各558傷害總1674，事件50/1050/2050ms與資源10→4；下載完整JSON且meanDps null；保存/重整及另一隔離瀏覽器備份還原。冷卻違規不輸出部分值、切換優先序後重新驗證；Buff+DOT案例總3906並有到期事件。
視覺：已實際開啟artifacts/S10-desktop.png及S10-mobile.png，確認動作、時間、結果、事件及下載按鈕；兩版面E2E斷言無水平溢出。只顯示合成資料標籤，沒有偽裝遊戲實測畫面。
失敗修正：ISSUE-011。上次工具修改因自動核准用量限制未執行，本輪確認檔案後以同核准流程重試成功，與上述程式驗收失敗分開記錄。
非失敗訊息：既有Zod PURE註解及Playwright終端色彩警告，build/E2E exit0；未調高逾時門檻或削弱斷言。
限制：S10只驗證明確範圍事件與期望總傷害，沒有DPS/Monte Carlo/Worker/圖表或真實遊戲校準。S11及S17/U01–U10、遠端CI和發布均未執行。

## 2026-11-18 — S11 集中驗收（進行中）

環境：Windows PowerShell、可攜Node22.14.0/pnpm10.6.5、Vitest3.2.7、Playwright1.65.1 Chromium；Web maxWorkers=2，未放寬既有測試時間門檻。未新增外部套件或擷取遊戲來源。

- 初步 pnpm.cmd typecheck：FAIL，合成測試誤用equippedItems，修正equipmentIds；logs/S11-typecheck.log。
- 首次 pnpm.cmd format:check：FAIL，新增E2E格式需再次Prettier；logs/S11-format-check.log。
- 第一次重驗 format:check/lint PASS，typecheck FAIL：App union缺simulation；logs/S11-retest-*.log。
- 第二次完整 format:check/lint/typecheck/test/build PASS：資料161、數值45、戰鬥32、Web66，共304項；logs/S11-final-*.log。
- 第二次完整 test:e2e：32 PASS、2 FAIL；新模擬測試的status locator與output隱含角色衝突，已命名進度並精確定位。logs/S11-final-test-e2e.log，Playwright保留失敗trace。
- 增加裝備合法性及四種命中結果邊界驗證後，typecheck FAIL：測試將optional slotId設null；已改delete。logs/S11-complete-typecheck.log。
- 最終重驗 logs/S11-verified-*.log 尚待完整結果，暫不宣稱S11 DONE。

問題追蹤：ISSUE-012。以上失敗與後續成功分別保存，不以預期結果替代實際結果。

S11 驗收續記：
- pnpm.cmd format:check/lint/typecheck/test/build/test:e2e 最終重驗（顯示修正前）全部PASS：資料161、數值45、戰鬥34、Web66，共306項；全站34項E2E（桌面/手機各17）。logs/S11-verified-*.log。
- 顯示修正後format:check因README新增段落格式FAIL，格式化後format:check/lint/typecheck、pnpm.cmd --filter @wwm/web test、pnpm.cmd build、pnpm.cmd exec playwright test tests/e2e/simulation.spec.ts全部PASS：Web67項，受影響E2E2項。logs/S11-display-format-check.log及S11-delivery-*.log。
- 已實際開啟artifacts/S11-desktop-chromium.png及S11-mobile-chromium.png：階梯線、抽樣平均/區間、合成資料標籤、來源明細與下載按鈕可見；E2E無水平溢出。
- 合成隨機案例：面板含裝備但未穿裝備，attack100、每擊210、三擊/3秒，普通/失誤各0.5，期望DPS105；seed0/100樣本平均109.9，標準差65.436，顯示抽樣平均區間97.075–122.725。兩次Worker下載的樣本陣列一致。此數值僅測試機制，不是遊戲實測。
- 最後補DPS除法/統計溢位阻擋及測試，正在跑logs/S11-acceptance-*.log，待完成才結案。

## S11 最終集中驗收：PASS，2026-11-18

| 實際命令 | 結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd format:check | PASS | logs/S11-acceptance-format-check.log |
| pnpm.cmd lint | PASS | logs/S11-acceptance-lint.log |
| pnpm.cmd typecheck | PASS，四套件 | logs/S11-acceptance-typecheck.log |
| pnpm.cmd test | PASS，資料161/數值45/戰鬥35/Web67，共308項 | logs/S11-acceptance-test.log |
| pnpm.cmd build | PASS，194 modules；主JS491.88kB/gzip151.49kB，模擬頁6.84kB，獨立Worker155.88kB | logs/S11-acceptance-build.log |
| pnpm.cmd test:e2e | PASS，全站34項，桌面/手機各17；19.2秒 | logs/S11-acceptance-test-e2e.log |

新增S11核心9項、Web3項，連同既有296項共308項；新增2項E2E，連同既有32項共34項。全部必要驗收通過才將STATUS S11改DONE；ISSUE-012關閉。無新增外部依賴，因此未重跑安裝或修改lockfile。

涵蓋：seed0及uint32範圍、固定輸入重播/不變性、不同seed、各互斥命中邊界/非法PRNG、分析期望對照、0/單樣本區間、Buff/DOT共用事件/最終狀態、未知/非法循環、即使面板含裝備仍重驗合法性、推估與僅明確資料、DPS除法/方差溢位阻擋；Worker真實執行、進度/取消/重啟、舊訊息/卸載隔離、完整下載與兩次樣本重播。預估值逐項文字標示，阻塞不畫曲線。

非失敗訊息：既有Zod PURE註解及Playwright終端色彩警告。無遠端CI/來源擷取/正式發布；S12–S17未執行。真實係數/戰鬥規則/三組實測與遊戲準確率仍缺，不把合成機制驗收冒充真實校準。

## 2026-11-18 — S12 本機集中驗收：PASS（修正後）

環境：Windows PowerShell、可攜Node22.14.0/pnpm10.6.5、Vitest3.2.7、Playwright1.65.1 Chromium；Web maxWorkers=2。未新增外部依賴或擷取遊戲來源，無lockfile變更，未重跑安裝。前置S07/S08 DONE，使用既有S11模擬中心。

| 命令／階段 | 實際結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd typecheck（初步編譯） | FAIL，版本應為label與valueStatusLabel應接ResolvedValue；實作期修正 | logs/S12-preliminary-typecheck.log |
| pnpm.cmd format:check（首次集中） | FAIL，新增E2E需再次Prettier；未執行後續驗收 | logs/S12-format-check.log |
| pnpm.cmd format:check/lint/typecheck（第一次重驗） | PASS | logs/S12-retest-format-check.log、S12-retest-lint.log、S12-retest-typecheck.log |
| pnpm.cmd test（第一次重驗） | FAIL，資料170項中167通過/3失敗；模擬手動值缺confirmation evidenceIds，未進建置/E2E | logs/S12-retest-test.log |
| pnpm.cmd format:check/lint/typecheck（最終重驗） | PASS | logs/S12-retest2-format-check.log、S12-retest2-lint.log、S12-retest2-typecheck.log |
| pnpm.cmd test（最終重驗） | PASS，資料170/數值45/戰鬥35/Web70，共320項 | logs/S12-retest2-test.log |
| pnpm.cmd build（最終重驗） | PASS，主JS498.91kB/gzip153.84kB，裝備頁35.66kB按需載入 | logs/S12-retest2-build.log |
| pnpm.cmd test:e2e（最終重驗） | PASS，全站38項，桌面/手機各19，26.5秒 | logs/S12-retest2-test-e2e.log |

新增核心9項、Web UI2項/儲存1項，與既有308項共320項；新增E2E4項，與既有34項共38項。
核心：MAX使用品質基礎80與當階100，未造目前實測值；完整合法組合/互斥、optimalityProven=false；版本等級/最低等級/階段/完整池拒絕；重複/超量/非法詞條；0、上下限與小數步進；承音93實值優先、94模型估計與明確資料阻擋；seed0同輸入完整重播、不同seed改變及未知網格拒絕；微調原件/白名單/未授權詞條不變；未知值保留null。
UI/儲存：未確認用途不能生成、無版本不造選項、逐項預估值/變更清空舊預覽；同庫GENERATED與generation稽核JSON備份還原；保存時重算最新規則，舊預覽100改依當前90。
E2E：滿值候選→共用編輯器→入庫→加入配置→帶選定配置到模擬中心；缺循環仍阻擋，不造DPS。承音預估/明確篩選、seed重播，另存微調，備份原件未覆寫且derivedFromId正確。
視覺：實際開啟artifacts/S12-desktop-chromium.png、S12-mobile-chromium.png，確認生成設定/合成標籤、候選、來源展開與共用編輯入口；兩版面E2E確認無水平溢出。
問題：ISSUE-013 CLOSED；PowerShell引號解析失敗的指令整段未執行，修正後以相同核准流程完成。沒有放寬schema、測試門檻或省略失敗記錄。
非失敗訊息：既有Zod PURE註解及Playwright色彩警告，最終exit0。
限制：只有合成fixture，無正式遊戲裝備/係數/規則與準確率證明；滿值候選尚未DPS排名，最高DPS與最優性留S13依S11/S12整合，見ADR-013。遠端CI/發布、S13–S17均未執行。

## 2026-11-18 — S13 驗收紀錄（進行中）

環境：Windows PowerShell、可攜Node22.14.0/pnpm10.6.5、Vitest3.2.7、Playwright1.65.1 Chromium；Web maxWorkers=2。新增optimizer workspace與內部link，外部套件版本保持現有鎖定值；未擷取遊戲來源。

- pnpm.cmd install --offline --store-dir .tools/pnpm-store-s07：FAIL，既有快取中繼資料非JSON；logs/S13-install.log。
- 延伸workspace importer後 pnpm.cmd install --offline --frozen-lockfile --store-dir .tools/pnpm-store-s07：PASS，未解析新版；logs/S13-frozen-install.log。
- 初步 pnpm.cmd typecheck：FAIL，@types/node多份d.ts為二進位，非S13型別錯誤；logs/S13-preliminary-typecheck.log。node_modules保存在.tools/node-modules-s13-damaged，舊store不刪除。
- pnpm.cmd install --frozen-lockfile --force --store-dir .tools/pnpm-store-s13：PASS，依原鎖檔重建340套件，18.1秒；logs/S13-clean-install.log。鎖檔外部packages/snapshots已實際比對不變，logs/S13-lock-integrity.log；首次比較命令型別錯誤後以Stop模式重新驗證，舊失敗輸出不作通過證據。
- 重建後初步typecheck：PASS；logs/S13-typecheck-precheck.log。
- 首次集中 pnpm.cmd format:check/lint/typecheck/test/build：PASS。資料170/數值47/戰鬥35/最佳化9/Web74，共335項；logs/S13-format-check.log、S13-lint.log、S13-typecheck.log、S13-test.log、S13-build.log。
- 首次集中 pnpm.cmd test:e2e：FAIL於載入fixture，新增package.json BOM造成Playwright判斷為CommonJS，未執行案例；logs/S13-test-e2e.log。
- 移除BOM後補強套裝身份推導，重驗typecheck：FAIL，格式化換行導致byId舊引用未完全更新；未進後續測試；logs/S13-retest-typecheck.log。修正後進行第二次重驗，結果待記。
- pnpm.cmd exec playwright test --list：PASS，發現42項/11檔，僅探索非實際E2E通過；logs/S13-e2e-discovery.log。

ISSUE-014追蹤中；未將預期結果或案例探索當成實際通過。套裝僅支援版本化靜態屬性門檻，未驗證完整效果維持未知。

## S13 最終集中驗收：PASS，2026-11-18

| 實際命令 | 結果 | 日誌（相對本目錄） |
|---|---|---|
| pnpm.cmd format:check | PASS | logs/S13-retest2-format-check.log |
| pnpm.cmd lint | PASS | logs/S13-retest2-lint.log |
| pnpm.cmd typecheck | PASS，五套件 | logs/S13-retest2-typecheck.log |
| pnpm.cmd test | PASS，資料170/數值47/戰鬥35/最佳化9/Web74，共335項 | logs/S13-retest2-test.log |
| pnpm.cmd build | PASS，主JS501.61kB/gzip154.64kB，最佳化頁10.23kB按需載入 | logs/S13-retest2-build.log |
| pnpm.cmd test:e2e | PASS，42項，桌面/手機各21；20.9秒 | logs/S13-retest2-test-e2e.log |

S13新增最佳化核心9項、套裝數值2項、Web UI3/交易1項，共15項；連同既有320項合計335項。新增E2E4項，連同既有38項共42項。先前進度訊息總數誤寫334，依實際日誌核對為335，非新增或刪減測試。

核心覆蓋：四件兩部位的全部4組與獨立枚舉排序相同，基準DPS530，Top930/730/730；JSON重播與輸入不變。鎖定/排除、0成本與總預算、最低屬性、套裝門檻/來源、未填definitionId仍可唯一推導套裝；未知/超等級/非法裝備不排名、已含裝備面板拒絕、引用與重複身份拒絕；公式估計傳播及僅明確資料阻擋；0DPS百分比不除0；代理分數平手時局部完整重算改善，Beam不宣稱最優；上限與核心取消回呼。
套裝回歸：每個達標門檻只加一次，來源保留；已含裝備面板不重複加套裝；未知效果、錯引用、重複門檻拒絕。
UI/交易：取消/重啟/卸載/舊訊息隔離、逐項預估值、條件範圍與完整DPS、BASE_ONLY限制。另存候選保留原Build及四件裝備；成本約束或快照過期時整筆拒絕，備份有新Build。
E2E：Worker完整排名與JSON下載、變更鎖定清空結果、鎖定head-0後Top730，另存並帶配置到模擬中心重算仍730；備份原配置裝備引用不變。Beam明示未證明全域最優、啟用0預算但缺成本不排名、取消後可重啟。
視覺：已實際開啟artifacts/S13-desktop-chromium.png與S13-mobile-chromium.png，確認合成資料標籤、約束、完整範圍/覆蓋率、候選與來源/下載/另存入口；E2E無水平溢出。
非失敗訊息：既有Zod PURE註解、Playwright色彩警告與主JS略超500kB的Vite chunk提示，build exit0；未提高chunk警告門檻，效能與進一步拆包留S16驗收。
限制：目前只有合成資料；最優證明限本次有限合法候選與約束，沒有遊戲全裝備或連續詞條全域最優聲明。只支援已驗證靜態套裝屬性，特殊未建模效果不可忽略。沒有實測準確率證明、遠端CI或正式發布；S14–S17未執行。

S13 結案文件更新後：pnpm.cmd format:check PASS（logs/S13-docs-format-check.log）；pnpm.cmd install --offline --frozen-lockfile --store-dir .tools/pnpm-store-s13 PASS，lockfile up to date、9.9秒（logs/S13-final-frozen-install.log）。Tesseract套件安裝腳本仍按既有設定未執行，本站prepare-ocr-assets與真實本機OCR E2E已通過，沒有為此放寬腳本核准設定。

## 2026-11-18 — S14 初步檢查（未完成）
- 前置 S11/S13 DONE；STATUS 已標 IN_PROGRESS，準備清單見 S14-CHECKLIST。
- pnpm.cmd --filter @wwm/stat-engine exec vitest run src/paths.test.ts：首次 FAIL，合成 fixture 改名破壞既有公式引用；logs/S14-preliminary-paths.log。
- 保留原引用並另建每個流派專用合成公式後重測 PASS：1 項，迭代 11 個候選流派；logs/S14-preliminary-paths-retry.log。此結果不代表已接入真實流派數值或特殊機制。
- ISSUE-015 尚 OPEN；功能實作、集中回歸與 E2E 尚未完成。

S14 續記：新增戰鬥引擎逐流派合成回歸，固定循環使用各自獨立公式，移除流派綁定時不輸出總傷害。pnpm.cmd --filter @wwm/combat-engine exec vitest run src/paths.test.ts PASS（1 項，迭代 11 個候選流派），日誌 logs/S14-combat-paths.log。特殊機制、完整流程與集中驗收仍待完成，ISSUE-015 維持 OPEN。

## 2026-11-18 — S14 部分範圍集中測試
環境：Windows PowerShell、專案可攜 Node 22.14.0、pnpm 10.6.5、Vitest、Playwright Chromium。無正式遊戲資料擷取。
- pnpm.cmd format:check、lint、typecheck、test、build、test:e2e 全部 PASS，日誌 logs/S14-final-format-check.log、S14-final-lint.log、S14-final-typecheck.log、S14-final-test.log、S14-final-build.log、S14-final-test-e2e.log。
- 單元整合：資料172/數值48/戰鬥36/最佳化9/Web74，共339項；E2E42項，17.4秒。
- 涵蓋選定流派資料缺口、11流派獨立合成公式／循環、未知係數、跨流派公式與未支援 handler 阻擋；舊資料與既有流程回歸通過。
- 以上只證明已實作部分，未完成各流派真實特殊 handler 或真實數值驗證。ISSUE-015 CLOSED，S14 因 ISSUE-016 缺外部可靠資料 BLOCKED。

2026-11-18 S14：人工檢查既有候選來源首頁及其上游，發現其餘流派資料明示未驗證；未下載/匯入/修改正式數值。詳細來源連結和待核事項見 ISSUE-016。S14 維持 BLOCKED；本輪未變更程式，未執行測試。

2026-11-18 S14 來源單檔人工檢視：GitHub 武學資料頁可見部分內容，raw 與 LICENSE 原文連結工具回報 cache miss，未取得完整檔案/hash/fixed commit；沒有建立原始快照或發布資料。見 ISSUE-016；本輪未修改程式，未執行測試。

2026-11-18 S14 單檔檢查：固定 commit 公開 JSON 取得成功，重新計算 Git blob 與 API 相符、SHA-256 已記錄、PowerShell JSON 解析成功；人工審核基準見 management/data-sources/S14-MARTIAL-ARTS-REVIEW.md。尚無前版可比較、資料權利及國際服版本未確認，沒有發佈或程式變更；未執行程式測試。

2026-11-18：以本地快照進行 PowerShell JSON 結構檢查，22 個不同名稱、階級13/14；首次陣列屬性檢查誤讀系統鍵，逐項展開後修正為 talents。未執行程式測試或發佈資料；見 S14-MARTIAL-ARTS-REVIEW.md。

2026-11-18：使用者確認國際版後，以 SHA-256 重驗來源快照並產生22項 staging 候選清單；JSON 解析與所有條目待審核／版本未知斷言通過。未執行程式測試、未發布正式遊戲資料；詳見 S14-MARTIAL-ARTS-REVIEW.md。

2026-11-18：依使用者設定暫用版本 1.0.334.64785、等級上限18，重新解析 staging JSON 並驗證22項版本一致、待審核、availableLevels空陣列與上限18，PASS。未執行程式測試或發布；原始來源未改。

2026-11-18：更正 staging 等級語意，JSON 重新解析與角色100、單人世界18、22條候選、可用等級清單未知的檢查 PASS。沒有執行程式測試或發布。

補充：前一次暫把100寫入 levelCap 並不符合使用者只提供角色當前等級的內容；已撤回，改為 characterLevel=100、soloWorldLevel=18、levelCap=null，JSON 及欄位斷言 PASS。

2026-11-18：使用者確認角色等級上限100，staging JSON 解析及版本、角色等級100、角色上限100、單人世界18、22項候選及未知可用等級清單檢查 PASS；未執行程式測試或發布。

2026-11-18：讀取原始武學快照時 JSON 解析失敗，SHA-256 已與原紀錄比較確認不符；損壞副本按實際 hash 保留。從相同固定 commit 重取單檔，SHA-256 回復先前值，JSON 解析及22項數量通過；異常原因未確認。ISSUE-017 OPEN。尚未執行程式測試，未發布資料。

2026-11-19：使用者確認鳴金·虹100級、玉斗，以及精準率/會心率/會意率括號內為實際計算值；記錄於 equiement-recognition.md。截圖顯示玉斗3/4、二件套+91，面板是否已包含套裝不得假定。查詢時 packages/combat-engine/src 回報 OS error 1392，已開 ISSUE-018；未執行程式測試。

## 2026-11-19：G: 專案損壞還原（未完成）

使用者將專案移至 G:\git\wwm\WWM_Codex_Managed_Project。七個損壞檔已原樣備份至 management/recovery/2026-11-19-originals，逐一以 SHA-256 比對備份與來源一致。G:、D: 副本及 wwm.zip 中可找到的三個資料模型皆含無效 UTF-8，沒有找到四份受損測試的完整原始備份。

packages/game-data/src/{equipment-rules,player-entities,rotation-schemas}.ts 已由現存 dist JavaScript 與型別宣告重建，並補回型別；不是逐字還原。此程序不能證明編譯成果本身完全無損或重建的來源與原文一致。

原有 pnpm-store-s13 的資料損壞，且搬移後套件連結失效；依 pnpm-lock.yaml 使用 .tools/pnpm-store-recovery 全新快取重建套件連結（--frozen-lockfile --ignore-scripts）。原本離線安裝失敗，原快取線上補缺仍遇損壞 JSON。

pnpm --filter @wwm/game-data typecheck：通過；pnpm --filter @wwm/game-data test：10 個測試檔、172 項通過。pnpm typecheck：失敗，combat-engine/src/engine.test.ts 為二進位／無效字元。其餘損壞測試為 apps/web/src/rotation/rotation-storage.test.ts、apps/web/src/rotation/RotationWorkspace.test.tsx、tests/e2e/measurement.spec.ts；保留原狀，尚未驗收全專案。ISSUE-018 維持 OPEN；S14 狀態不變。
## 2026-11-19 損壞測試重建：S09 暫時阻塞，S10 進行中

S09 受損 measurement.spec.ts 已按方案重寫：單技能實測與備份還原、60 秒觀察；均使用合成資料。`pnpm --filter @wwm/optimizer... build` 與 `pnpm --filter @wwm/web exec vite build` 通過；`pnpm exec playwright test tests/e2e/measurement.spec.ts`：桌面及手機共 4 項通過。正式完整驗收受 S10 的損壞測試阻塞，不宣稱 S09 重建結案。恢復條件：S10 測試重建後重跑全專案集中驗收。可繼續：修復依賴 S10 的受損測試。

S10 測試重建狀態 IN_PROGRESS：重建 combat-engine/src/engine.test.ts、apps/web/src/rotation/rotation-storage.test.ts、RotationWorkspace.test.tsx；涵蓋事件順序、冷卻資源、窗口、Buff/DOT、優先序、保存與還原，沿用合成 fixture，原檔已有備份。完成後集中測試並記錄實際結果。
## 2026-11-19：S09／S10 損壞測試重建驗證

已重寫四個損壞測試：S09 measurement.spec.ts；S10 engine.test.ts、rotation-storage.test.ts、RotationWorkspace.test.tsx。戰鬥測試保留損壞檔開頭可讀部分，並補寫時間窗、版本／未知值、武器切換、Buff／DOT、快照／動態及優先序等合成案例。原始七個損壞檔仍保存在 management/recovery/2026-11-19-originals；無完整備份，不能聲稱重寫測試逐字還原或已恢復原有全部 26 項 S10 戰鬥測試覆蓋，ISSUE-018 保持 OPEN，需逐項稽核其餘原驗收邊界。

環境：Windows、G: 專案、Node.js 22.14.0、pnpm 10.6.5、Chromium 桌面／手機。實際結果：`pnpm format:check` 通過；`pnpm lint` 通過；`pnpm typecheck` 通過；`pnpm test` 332 項通過（資料 172、數值 48、戰鬥 29、最佳化 9、Web 74）；`pnpm build` 通過；`pnpm test:e2e` 42 項通過。日誌在 management/tests/logs/recovery-2026-11-19/。最初格式檢查因原始快照及辨識紀錄、Lint 因備份損壞檔與未用參數失敗；修正檢查範圍與測試後重跑通過。首次 DOT 測試事件名稱與型別檢查失敗，修正後通過。重寫測試不等於正式遊戲資料驗證，S14 維持 BLOCKED，S15–S17 狀態不變。
## 2026-11-19 08:07：dev 完整測試

測試基準提交 9bf4894；Windows，Node.js 22.14.0、pnpm 10.6.5，桌面及手機 Chromium。`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 均通過；`pnpm test` 332 項通過（game-data 172、stat-engine 48、combat-engine 29、optimizer 9、web 74）；`pnpm test:e2e` 42 項通過。各命令完整結果保存於 management/tests/logs/verification-2026-11-19-0807/。本輪為既有功能回歸，沒有證明已完整恢復原 S10 測試覆蓋或驗證真實遊戲數值；ISSUE-018 維持 OPEN，S14 維持 BLOCKED。
## S10 損壞後驗收補強：2026-11-19

依 S10 清單增加四項合成測試：Buff 到期瞬間、預估戰鬥規則與明確資料限制、跨版本資源、10000 事件上限與不輸出部分傷害。Windows、Node 22.14.0、pnpm 10.6.5；`pnpm format:check`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 通過；`pnpm test` 336 項通過（game-data 172、stat-engine 48、combat-engine 33、optimizer 9、web 74）；`pnpm test:e2e` 42 項通過。日誌：management/tests/logs/s10-recovery-2026-11-19-222313/。本輪補強完成；原始損壞測試沒有完整備份，無法證明重建覆蓋與原始案例一致，ISSUE-018 維持 OPEN。S14 依 ISSUE-016 維持 BLOCKED。
## S10 技能變體驗收：2026-11-19

補充三項合成測試：蓄力時間不得超過施放時間、變體必要狀態、劍氣門檻與資源扣除原子性。第一次必要狀態案例因合成輔助技能意外繼承變體而失敗，修正 fixture 後戰鬥檔 26 項通過。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、build 通過；test 339 項通過（172/48/36/9/74）。首次完整 E2E 41 通過、1 失敗，手機最佳化取消實際為搜尋完成；單檔手機重複五次共 10 項通過，完整 E2E 重跑 42 項通過。偶發問題另見 ISSUE-019，尚未證實已解決。日誌位於 management/tests/logs/s10-variant-2026-11-19-2238/。本輪三個測試驗收完成；原 S10 檔案無完整備份，ISSUE-018 保持 OPEN，S14 仍 BLOCKED。
## 2026-11-19：ISSUE-019 取消測試補強

針對 E2E 極小工作可能在取消前完成的時序，測試中攔住一次 Worker 請求，確認取消時工作仍在執行，並在下一次啟動前恢復原方法；此案例不驗證長時間真實搜尋的性能。單元測試另外驗證取消後遲到的 RESULT 不產生排名且狀態維持取消。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 339 項、完整 E2E 42 項；最佳化 E2E 桌面和手機各重複五次共 20 項通過。日誌 management/tests/logs/issue-019-2026-11-19-2244/。原始偶發失敗的根因未經證實，ISSUE-019 保持 OPEN，需後續觀察真實長工作取消；ISSUE-018 與 S14 狀態不變。
## 2026-11-19：真實 Worker 執行中取消驗證

新增桌面及手機 E2E，以 304 件合成裝備組成大範圍搜尋，等待真實 Worker 發出搜尋進度後取消；驗證無部分排名、鎖定後可重新搜尋，以及匯出備份的原配置與裝備數量不變。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build 均通過；單元及整合 339 項，完整 E2E 44 項通過；真實 Worker 取消案例桌面／手機各重複五次共 10 項通過。日誌：management/tests/logs/issue-019-real-2026-11-19-225508/。此案例證實受測條件下取消，並不能證明先前偶發「搜尋完成」的根因；ISSUE-019 保持 OPEN，ISSUE-018 及 S14 狀態不變。
## 2026-11-21：S10 技能變體事件驗收

新增兩項合成測試：驗證劍氣、狀態套用／移除、命中及切換武學的事件時間順序與結果；事件時間未知時阻擋並不輸出部分傷害。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 全部通過；單元與整合 341 項（172／48／38／9／74），桌面及手機 E2E 44 項。日誌位於 management/tests/logs/s10-events-2026-11-21-154058/。本輪測試通過，不代表已找到原始受損測試或驗證真實遊戲數值；ISSUE-018、ISSUE-019 保持 OPEN，S14 保持 BLOCKED。
## 2026-11-21：S10 同時刻與 Buff 重套用驗收

新增兩項合成測試：同毫秒事件 FIFO 順序及施放快照／動態命中的差異；Buff REFRESH 後重新計算到期時間及後續傷害。首次測試因篩選技能命中紀錄漏掉命中 ID 而失敗，修正測試後戰鬥檔 30 項通過。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 343 項（172／48／40／9／74），E2E 44 項；日誌 management/tests/logs/s10-buff-2026-11-21-155237/。原始損壞測試無完整備份，ISSUE-018 保持 OPEN；ISSUE-019 與 S14 狀態不變。
## 2026-11-21：鳴金·虹來源候選對照

完成 management/data-sources/S14-NAMELESS-REVIEW.md，對照專案候選無名劍／槍與快照 Nameless Sword／Spear，記錄兩個 tier 的天賦類別、使用者提供版本與角色條件、面板是否包含加成及 DPS 所需資料。名稱映射為候選，未標為已驗證；未發布正式資料。

Windows Node 22.14.0：以 node 讀取本地 JSON，驗證 SHA-256 73f75d198c74154de4cf10ed32fde3ace02a00562c8bbefb2be2296ef7c521db、原始與 staging 各 22 筆、來源 index 1／3 名稱、tier 13／14 與映射待審核；結果 PASS，兩武學各 tier 有 5／6 項天賦。`git diff --name-only -- data/raw data/staging` 無變更。僅文件與來源對照，未執行應用程式測試或發布。完整 DPS 仍缺版本化係數、時間、公式及面板語意；S14 維持 BLOCKED，ISSUE-016、ISSUE-018、ISSUE-019 維持 OPEN。
## 2026-11-22：鳴金·虹試算結果顯示

依使用者要求先完成 Web 結果顯示；新增主選單「鳴金·虹試算」，呈現使用者確認的面板、心法、版本、玉斗 3/4，以及先前 55 秒社群參考軸的固定試算紀錄。畫面標示「包含預估資料／預估值」，說明數值未校準、四件套未啟用、結果不隨配置更新；不將結果寫入計算引擎或正式遊戲資料。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 344 項（172／48／40／9／75），桌面及手機 E2E 46 項。日誌 management/tests/logs/splendor-web-2026-11-22-025137/。本輪畫面完成；實際運算、社群模型的適用性與遊戲數值正確性仍待後續確認，S14 不標為完成。
## 2026-11-22：裝備詞條下拉選擇

既有詞條名稱改為下拉選擇；選項包含已辨識的常用名稱及目前資料版本的詞條，未收錄或未映射名稱可透過其他選項保留／輸入。修改名稱會清除人工確認，不把既有數值自動確認；原始截圖資料不改寫。基礎屬性輸入保留原方式。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 344 項（172／48／40／9／75），桌面及手機 E2E 48 項。另在獨立 Playwright 瀏覽器匯入本機 10 件裝備草稿，確認原有數值 73.1 與詞條「最大外功攻擊」顯示並自動選中；未操作使用者的瀏覽器資料。日誌 management/tests/logs/affix-select-2026-11-22-105358/。詞條候選名稱不是版本化合法詞條的認證，S14 仍 BLOCKED。
## 2026-11-22：裝備等級與重構準備

依使用者新規格建立 ADR-014；新增向後相容的裝備等級欄位，新裝備與舊資料編輯預設並儲存 100。使用者確認缺滿值／承音資料時顯示未知並保留手動輸入。此階段尚未解除版本耦合、完成依裝備詞條池的生成表單或紫裝／滿值／承音的互斥自動帶值；整體重構保持 IN_PROGRESS，不能視為完成。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 344 項（172／48／40／9／75），E2E 48 項；日誌 management/tests/logs/equipment-level-2026-11-22-115101/。含新裝備預設100及備份寫入檢查。
## 2026-11-22：裝備版本解耦第一階段

使用者補充不必相容舊版裝備模型，以新規格重構。移除裝備編輯器版本選擇，以及配裝與玩家備份對裝備版本相同的限制；無版本裝備可加入配置。現有傷害引擎仍檢查資料版本，尚未完成以角色版本解析無版本裝備，因此暫不能宣稱無版本裝備已可計算；生成表單及紫裝／滿值／承音互斥自動帶值亦待完成。整體重構維持 IN_PROGRESS。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 343 項（171／48／40／9／75），E2E 48 項；日誌 management/tests/logs/equipment-unversioned-2026-11-22-121558/。
## 2026-11-26：裝備庫卡片顯示

依使用者參考圖將裝備庫改為可響應式排列的卡片，顯示已保存圖片、名稱、部位、配裝／驗證狀態與詞條數值；支援全部、已配裝、各部位篩選及點擊開啟原編輯器。辨識候選顯示待核對，未虛構畢業率。同步修正此前版本解耦後配裝按鈕仍要求裝備版本的 UI 限制。

Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 最終通過；單元與整合 345 項（171／48／40／9／77），桌面及手機 E2E 48 項。首次型別檢查因測試查詢選項不支援而失敗，修正後重跑通過；首次 E2E 46 通過、2 失敗，原因為測試仍使用舊「同版本配置」標籤，更新後 48 項通過；格式經重跑通過。日誌 management/tests/logs/equipment-cards-2026-11-26-203308/。另以獨立瀏覽器匯入 10 件草稿並檢視卡片，不修改使用者瀏覽器資料。裝備生成、狀態互斥、自動帶值與傷害版本解析仍依 ADR-014 待完成。
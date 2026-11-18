# V1.1 規格整合與影響對照
日期：2026-11-17；來源：根目錄 WWM_Codex_Managed_Project_V1.1；狀態以 STATUS.md 的 SPEC-V1.1 為準。

## 準備與變更清單
1. 逐檔 SHA-256 比較；相同 requirements、依賴清單、範本不複製覆蓋。
2. 新增 management/data-sources 的 5 份原始規格，原檔逐位元保留。
3. 合併 AGENTS、README、啟動指令、F12 與 S17，補入 STATUS、DEPENDENCIES 與 TEST-PLAN。
4. 保留 apps/packages、鎖檔、歷史 ADR/問題/測試日誌與既有完成狀態。
5. 依賴與標示衝突決策見 ADR-003；不抓取來源、不宣稱授權已確認、不執行 U01–U10。

## 需求與實作步驟對照
| 新要求 | 開發步驟／結案條件 |
|---|---|
| 候選來源註冊、授權、版本與原始位置證據 | S03 先建立匯入與審核契約；S17 接入更新檢查與快照 |
| 實值優先、適用版本推估、來源衝突 | S03；承音/調律合法值由 S07 驗證 |
| 玩家實例覆寫不回寫主資料，更新後保留覆寫 | S03/S04；S17 的 U08 回歸 |
| 預估資料傳播至屬性、技能、DPS/排名 | S08/S11/S13；S17 的 U10 回歸 |
| 鳴金·虹及所有已支援流派的基準回歸 | S09/S11/S14；S17 發布前檢查 |
| 更新偵測、SHA-256、差異/衝突審核、不可變 manifest、回滾 | S17；U01–U10 全部必要案例通過後才 DONE |
| U01–U10 | 原始規格保留於 management/data-sources/UPDATE-TESTS.md，現均 NOT_RUN |

## S01/S02 影響
不新增 UI、計算或套件依賴。S02 已有來源與數值證據 schema；新 sources.json 為候選來源登錄，不是 GameDataRelease.sources，也不能轉為 RECORDED。
S03 須建立登錄表到版本化來源證據的明確映射；取得檢查時間、來源發布時間與快照時間分別記錄，不能憑候選 URL 補造。
S02 維持 DONE；新更新機制尚未實作，不因文件合併宣稱完成。

## 集中驗收
- 比較 manifest 中全部輸入雜湊，確認來源包未變動。
- 5 個新增檔案與來源包雜湊相同，登錄 JSON 可解析、ID 唯一且授權皆 unverified，U01–U10 仍 NOT_RUN。
- requirements 全部與來源包相同；受保護應用程式/鎖檔/日誌檔案雜湊不變，舊 CHANGELOG/TEST-RUNS 內容為新檔前綴。
- S01/S02 維持 DONE，S03–S17 為 NOT_STARTED；S17 與 F12 存在於計畫、依賴、進度。
- Markdown 相對連結與 UTF8/JSON 基本檢查；pnpm.cmd format:check。
- 僅文件規格整合，不重跑應用單元/建置/E2E，不把歷史測試當作本輪執行結果。
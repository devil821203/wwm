# ISSUE-014 S13 驗收與工具鏈

狀態：CLOSED；日期：2026-11-18

新增workspace離線install失敗：既有pnpm-store-s07的套件中繼資料非JSON，ERR_PNPM_READ_FROM_STORE；未下載任何資料。既有鎖檔仍完整。
處理：只延伸本機workspace importer/link，外部套件版本/完整性沿用現有鎖檔，執行offline frozen install驗證，避免重新解析損壞的登錄快取。
日誌：S13-install.log；後續結果依實際執行補記。
- frozen link install通過，但初步typecheck發現@types/node多份d.ts為二進位（已讀取實際位元組）；隔離整個node_modules至.tools/node-modules-s13-damaged，原快取不刪除，按現有鎖檔使用全新store重建。未修改外部套件版本。
- 鎖檔比較指令首次因PowerShell Replace字元型別失敗，未完成檢查；其後使用Stop模式與字串正規化重新實際比較成功，只有workspace importers變更，外部套件解析/完整性/snapshots未改。依賴340套件按鎖檔重建成功，日誌S13-clean-install.log。
- 初次集中format/lint/typecheck/test/build PASS；E2E案例載入失敗：新package.json UTF8 BOM使Playwright未識別type=module。移除BOM後重驗，未放寬ESM設定。另修正未填definitionId但可唯一匹配裝備的套裝件數，補測試；收益百分比溢位時不輸出Infinity。
- 套裝匹配修正後typecheck抓到格式化換行使文字替換未完整更新byId引用；改為setByItem查詢，型別失敗後未進單元/建置/E2E。

結案：S13-retest2-*的format/lint/typecheck/test/build/test:e2e全部PASS，共335項單元整合與42項E2E。套裝身份推導修正及BOM載入已通過。最後offline frozen安裝也已PASS，S13-final-frozen-install.log；不將340個套件重建當功能驗收。
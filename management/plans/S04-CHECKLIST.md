# S04 準備與驗收
日期：2026-11-17；依賴 S02/S03 DONE，相關完整需求與來源更新政策已讀。
程式：game-data 角色/Build/備份 schemas；Web Dexie IndexedDB repository；角色與配置頁（候選流派11條、未知版本草稿、合法等級、CRUD與Build複製）；完整玩家備份JSON預覽/匯入/下載。
資料：角色名稱/流派/版本/等級/境界；Build 面板模式/來源值/武學/心法/奇術/天賦/配裝引用；統一裝備庫與實例覆寫備份，不分虛擬/持有。
測試：角色/配置外鍵與跨版本拒絕、CRUD/複製/刪角級聯、IndexedDB關閉重開還原、JSON往返/無效或ID衝突拒絕/交易回滾、已含裝備面板模式保存；Web未知資料與錯誤提示；production桌面與手機建角/改名/配置/重整/匯出/刪除/匯入還原。
集中驗收：install/frozen-lockfile、format:check、lint、typecheck、test、build、test:e2e；保存日誌與桌面/手機畫面。
範圍：不實作S05裝備編輯/OCR，S07裝備合法值，S08傷害公式或S17資料發布。
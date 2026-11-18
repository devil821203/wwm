# ADR-005：角色與 Build 的本機資料
日期：2026-11-17；狀態：採用；S04。
- 使用 Dexie 管理 IndexedDB 的 characters/builds/equipment/overrides/dataReleases 五表。來源主資料與玩家實例分開；後續 S05 使用相同裝備庫。
- 角色 gameVersionId/level 允許 null，代表草稿，不以虛構遊戲版本取代。11候選流派名稱可建草稿；有匯入版本時只列其合法等級與流派。匯入版本僅結構驗證，UI標示未審核/合成測試。
- 建角後版本與流派身份固定，以免把舊配置無聲套到另一版本；改名、境界與合法等級可編輯。其他版本/流派請新增角色。
- 每角色多 Build，面板是否包含裝備必須明確標 BASE_ONLY/EQUIPMENT_INCLUDED/UNKNOWN；未知維持UNKNOWN，S08再消費。
- 裝備引用、覆寫與數值皆保存來源及版本。資料schema驗證外鍵、唯一性、合法等級與跨版引用，不宣稱遊戲內容已驗證。
- 所有讀寫驗證schema，多表操作使用交易；異常不吞掉、不回退假成功。使用live query同步同源頁面變更。
- 備份使用獨立 format/schemaVersion 與 exportedAt；JSON匯入先預覽，再於交易內合併。相同ID同值可重複匯入，ID異值拒絕整批而不覆蓋；非法舊分庫範例不自動猜測遷移。
- 刪除角色會刪除其Build，不刪除共用裝備/覆寫/版本資料；UI顯示此範圍並確認。沒有大範圍重設資料庫入口。
- IndexedDB為本瀏覽器同源資料，不代表跨網址/裝置同步或備份保證；提供可下載JSON，離線能力限本機資料與已載入應用，未加入PWA。
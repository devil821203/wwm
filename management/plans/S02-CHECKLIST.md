# S02 準備清單
日期：2026-11-17；前置 S01 DONE，集中驗收紀錄存在。
變更：新增 packages/game-data 套件，Zod schemas、推導 TypeScript 型別、結構驗證入口、候選流派名冊、合成 fixtures 與測試；根 workspace 遞迴 typecheck/test/build；README 契約說明。
驗收：有效與無效樣本、未知/零值/推估證據、任意版本與合法等級、重複 ID、跨版本與失效引用、統一裝備、技能時間整數毫秒、11 候選流派及新增第 12 流派不改 schema。
集中命令：pnpm.cmd install；format:check；lint；typecheck；test；build；test:e2e；鎖檔安裝。
範圍：僅資料契約，不執行來源解析/覆寫審核（S03）、裝備合法性引擎（S07）、技能公式運算（S08+）。
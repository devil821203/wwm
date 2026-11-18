# S03 準備與驗收清單
日期：2026-11-17。前置 S02 DONE；已讀 sources.json、UPDATE-POLICY、docs/03、08、09。
變更：game-data 的來源候選/證據、精確數值 scope、紀錄/模型/實例覆寫契約；純函式 resolver、來源狀態報告、JSON staging/diff/review；單元與整合測試。
驗收：手動確認 > 明確紀錄 > 適用模型 > UNKNOWN；承音實值優先、不硬編 0.94；明確資料模式禁止估算；同值來源優先級、衝突待審；版本/階級/品質/培養/單位/精度不混用；未知必要值阻擋、未使用未知不污染、估算標示傳播。
匯入驗收：無效 JSON/來源/跨服/跨版拒絕，原始位置/hash/授權證據與檢查/取得/發布時間分開；差異保留舊新值，不更動 baseline；內容審核後可成為已審核資料集；變造或陳舊 digest 不通過。
集中命令：format:check、lint、typecheck、test、build、test:e2e；編譯產物匯入 smoke。
邊界：不實作 S04 持久化/UI，S07 合法值，S08 真實傷害計算，S17 自動更新/快照儲存/資料包發布與 U01–U10 全面驗收。
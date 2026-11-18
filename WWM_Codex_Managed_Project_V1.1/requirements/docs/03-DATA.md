# 03 國際服資料來源與資料治理

## 參考來源（需確認授權、更新日期與伺服器版本）
- 官方公告：https://www.wherewindsmeetgame.com/news/
- 國際服資料工具：https://wherewindsmeet.th.gl/
- 社群資料：https://github.com/greydust/where-datas-mine
- 開源模擬器：https://github.com/youaresodalgona/wwm-dps
- 國際服流派對照：https://www.wherewindsmeetgame.org/database
- Steam 官方公告繁中：https://steamcommunity.com/app/3564740/announcements/?l=tchinese

## ETL
`source adapter -> raw snapshot -> normalize IDs/translations/units -> schema validation -> source attribution -> diff review -> SQLite staging -> signed/versioned JSON export -> browser import`。
- 來源記錄：URL、擷取時間、國際服版本、原始檔 hash、授權狀態、來源信心、欄位來源。
- 手動覆寫：`scope(version, entity, field)`、old/new、理由、作者、時間、證據；覆寫不得刪除原始來源值。
- 優先級：已審核手動修正 > 同版官方可驗證資料 > 多來源一致資料 > 單一社群資料；衝突必須提示。
- 必填資料完整性：每條流派的兩門武學、技能清單、係數、施放/命中時間、Buff/心法、合法裝備/詞條、等級門檻、敵人基準、公式版本。缺項須列 coverage report。
- 禁止將陸服數值無標示地混入國際服；所有未確認中文名稱保留英文原名和 `translationVerified:false`。
- 遵守網站 ToS、robots、授權與速率限制；未獲許可時使用手動匯入，不實作繞過存取限制。

## 每版資料表（概念）
`game_version, path, martial_art, skill, skill_hit, skill_timing, stat_definition, equipment_definition, equipment_slot, affix, affix_pool, affix_roll_range, set_bonus, inner_way, mystic_skill, effect, enemy, progression, formula, source, override, measurement, calibration_model`。
所有動態表須含版本外鍵；ID 使用穩定 slug，不以名稱當主鍵。

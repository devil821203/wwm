# 外部資料候選 JSON（2026-11-27）

本資料夾將已整理的外部參考依模組分為 `equipment.json`（裝備及詞條）、`character.json`（社群人物基本面板）、`inner-ways.json`（心法）、`other.json`（社群套裝與武學索引）。四檔均為 `DRAFT_REVIEW` 候選，尚未發布為正式遊戲資料，亦未匯入瀏覽器或接入傷害計算。

所有檔案保存來源 URL、固定 commit、授權狀態、來源是否聲稱遊戲 build、使用者指定的暫定 build；來源未聲明 build 時用 `null`，不將暫定設定當來源證實。`GLOBAL_USER_CONFIRMED` 表示使用者指定採國際版，並非來源自行證明。心法中文翻譯只填已初步對照的三筆，並保留候選狀態。

- `equipment.json`：固定來源的 135 個裝備項目，含品質、部位、來源基礎欄位、初始／調律詞條、承音原始數值與定音結構；也保留社群計算器詞條表。國際服來源率值保留原始比例（例如 `0.052` 代表 5.2%）；社群表百分率則保留來源的百分數。長於 100 字元的定音名稱／描述以 null 和 `longDescriptionOmitted` 標明，應回原檔查閱。
- `character.json`：社群來源的 `BASE_STATS` 與其百分比欄位清單，為來源模型裸面板，不是玩家面板，也不是已證實的各級基礎曲線。
- `inner-ways.json`：國際服來源的 60 本名稱、突破階層索引及所有單人等級數值條目；另列易水歌、無名心法、千山法已對照的條件數值，以及社群心法靜態表。完整心法敘述不複製，使用來源 URL、`sourceIndex`、`sourceEffectIndex` 查閱；凝神章國際服映射仍未知。
- `other.json`：社群套裝靜態表，以及 22 個國際服武學名稱／階層索引；不包含完整武學效果、技能係數或套裝機制。

來源 `where-datas-mine` 的武學原始快照已保存在專案 `data/raw/where-datas-mine/`；本次裝備和心法原檔於整理時手動取得至系統暫存，SHA-256 與 Git blob 記於 JSON，且不直接覆蓋正式資料。來源版權仍待核實，完整描述保留指向原始來源。參考對照及各項條件見 `management/data-sources/comparison-2026-11-27/`。

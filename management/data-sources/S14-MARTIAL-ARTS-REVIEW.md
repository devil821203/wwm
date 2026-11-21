# S14 單檔來源快照與初始差異審核

檢查日期：2026-11-18（Asia/Taipei）。來源 https://github.com/greydust/where-datas-mine/blob/b021a2cac8c1a723e0c2b5c06b8ca29197415010/data/martial-arts.json

- 固定 commit：b021a2cac8c1a723e0c2b5c06b8ca29197415010；Git blob：cf109a610be82b0f53fc70a69ce42a72fa51d449，按 Git blob 規則重新計算吻合。
- 原始檔 354774 bytes；SHA-256：73f75d198c74154de4cf10ed32fde3ace02a00562c8bbefb2be2296ef7c521db；JSON 解析成功。原始檔與 metadata 在 data/raw/where-datas-mine/該 commit/，用途限人工審核。
- 結構：schemaVersion 1、kind wwm-martial-arts、22 項 martialArts；首項具有 name、descriptions、tiers；tiers 包含 tier 與 effects。階級不是可推定的國際服遊戲版本。
- 首次取得單一檔案，無先前同來源已審核快照；差異基準不存在，不能聲稱有新增／改動遊戲數值或做完整版本差異。此為待審核初始候選，不是發布資料。
- GitHub 授權 API 回傳 NOASSERTION，所回傳的授權內容是字型的 SIL OFL，不能據此判斷武學資料或遊戲原始內容的再利用權限。國際服版本、來源證據、資料權利與各欄位映射尚未確認。
- 不能直接匯入或覆蓋正式資料。下一步須完成資料權利與遊戲版本核實，逐項建立受支持的技能／特效／時間／等級對照，產生版本差異並人工審核，再執行必要回歸。

## 結構對照續查（2026-11-18）

使用本地已驗證快照解析整個 JSON：頂層只有 schemaVersion、kind、martialArts；共 22 個不同 name，tiers 中出現 13、14。頂層沒有明確國際服版本、地區、來源或授權欄位，不能以階級推定遊戲版本。逐項 tier 結構為 tier、effects；逐個 effects 項目的鍵為 talents；查看首筆 talents 可見 name、descriptions。第一次 PowerShell 檢查誤將 effects 陣列本身的系統屬性視為內容鍵，已以逐項展開修正；未將錯誤結果用於映射。

| 候選來源 | 專案契約 | 缺口／處置 |
|---|---|---|
| martialArts[].name | MartialArt.name / id | 名稱需人工對照版本武學 ID，不能只憑字串自動合併。 |
| tiers[].tier | 技能 applicability | 武學階級與角色合法等級不同；須有版本化等級映射證據，保持未知。 |
| effects[].talents[].descriptions | CombatSkill / Buff / DOT / 狀態事件 | 自然語言須人工拆解觸發、目標、條件、數值與時間；部分效果超出現有通用 handler。不能把文字直接執行或推成已驗證數值。 |
| 缺乏明確版本與授權中繼資料 | gameVersionId、sourceIds | 需追查來源及權利，先維持 UNKNOWN；未建立正式發布資料。 |

這份候選快照只作來源審核，不表示 22 個武學均可計算；也無法單靠頂層欄位缺失判斷其他配套檔或上游是否有版本說明。實際遊戲版本及資料權利仍待核實。

## 使用者確認與候選清單（2026-11-18）

使用者確認此份資料為國際版並指示直接使用。已將地區判定記為 USER_CONFIRMED；此確認不是具體遊戲版本號或第三方資料授權證據，故 gameVersionId 和資料權利仍保留未知。依更新政策建立 data/staging/where-datas-mine/b021a2cac8c1a723e0c2b5c06b8ca29197415010/martial-art-candidates.json，記錄22個名稱、來源索引與階級供審核；每項武學 ID、流派 ID 與效果均維持待對照／未知，不自動填入係數。

快照 SHA-256 重新驗證符合已記錄值，候選 JSON 可解析且22項皆為待審核。首次快照仍無前版，這份是候選清單而非正式數值差異；沒有覆蓋正式資料或發布。下一步逐項核對武學與流派映射、適用遊戲版本及可使用權限，並以來源支持的效果建模。

## 使用者指定版本及等級上限（2026-11-18）

使用者指示暫以國際服 1.0.334.64785、人物最高18級處理。已將 staging 候選清單的版本標籤設為 1.0.334.64785，內部合法 slug 為 global-1-0-334-64785，並記錄 USER_ASSUMED／USER_PROVIDED 證據；這是本輪使用者設定，並非資料檔自行證實的發布版本。22筆候選一致套用此暫定版本，武學與流派 ID 映射仍待核對。

18 是最高等級，不能單憑此推定全部實際可用等級為1至18：availableLevels 維持空陣列及 UNKNOWN，未捏造等級列表。快照及正式資料不被覆蓋；遊戲資料再利用權限與逐項效果仍待核。候選清單已重新解析並核對22筆版本與狀態。

## 等級定義修正（2026-11-18）

使用者更正：18 是單人世界等級；角色等級為 100。先前把18記為角色最高等級是錯誤解讀，已在 staging 修正角色 levelCap 為100，另以 soloWorldLevel=18 表示單人世界等級，兩者均標示使用者提供。先前紀錄保留作歷史，以上更正為準。

使用者提供的是目前角色等級100，暫以原候選 levelCap 欄位記錄為100；是否為該版本的官方等級上限尚未另行驗證。完整合法角色等級清單仍為 UNKNOWN，武學 tier 13/14 也不等同這兩種等級。22筆候選與原始來源快照未變更內容，未發布正式資料。

進一步修正：使用者說明的是「角色等級為100」，並未指定角色等級上限。因此 staging 最終採 characterLevel=100、soloWorldLevel=18、levelCap=null（UNKNOWN），不把100推定為官方上限；前述暫填 levelCap=100 已撤回。重新解析及三欄語意檢查 PASS。

## 使用者確認版本角色等級上限（2026-11-18）

使用者進一步確認目前版本角色等級上限為100。staging 最終狀態為 gameVersionLabel=1.0.334.64785、characterLevel=100、levelCap=100、soloWorldLevel=18，分別保留使用者提供的來源標記；撤銷前述「上限未知」狀態。完整可用等級清單仍未提供，availableLevels 保持 UNKNOWN，不能僅由上限推定。重新解析並驗證所有欄位與22項候選 PASS，沒有修改來源快照或發布資料。

2026-11-18：使用者要求先以此來源計算。快照中的 Strategic Sword「Affinity Rate UP」是明確的條件例子：tier 13、14 的 Power 比例相同但上限條件不同，可作單項屬性加成計算；來源是天賦文字，不能直接當成技能傷害或 DPS。缺少使用者所選武學、tier、Power 和完整循環輸入，不能確定其實際結果。來源快照遭損壞並依固定 commit 及原 SHA-256 還原，ISSUE-017 OPEN，原因未確認。

## 2026-11-21：鳴金·虹來源候選對照

完成 management/data-sources/S14-NAMELESS-REVIEW.md，對照專案候選無名劍／槍與快照 Nameless Sword／Spear，記錄兩個 tier 的天賦類別、使用者提供版本與角色條件、面板是否包含加成及 DPS 所需資料。名稱映射為候選，未標為已驗證；未發布正式資料。

Windows Node 22.14.0：以 node 讀取本地 JSON，驗證 SHA-256 73f75d198c74154de4cf10ed32fde3ace02a00562c8bbefb2be2296ef7c521db、原始與 staging 各 22 筆、來源 index 1／3 名稱、tier 13／14 與映射待審核；結果 PASS，兩武學各 tier 有 5／6 項天賦。`git diff --name-only -- data/raw data/staging` 無變更。僅文件與來源對照，未執行應用程式測試或發布。完整 DPS 仍缺版本化係數、時間、公式及面板語意；S14 維持 BLOCKED，ISSUE-016、ISSUE-018、ISSUE-019 維持 OPEN。
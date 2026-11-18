# ISSUE-006：S05 集中驗收修正紀錄
日期：2026-11-17；步驟S05；狀態：CLOSED（格式、遷移及相關回歸全部通過）。
第一次 format:check 回報 equipment-storage.test.ts 與 equipment.spec.ts 格式未符合（exit1）。雖先執行過 format，仍依實際檢查結果修正，不宣稱通過；尚未執行後續命令。
修正：對兩個檔案重新執行formatter並集中重驗。其他失敗如有發生會追加於本單，日誌保留。

## 重驗紀錄
資料套件120項通過；Web28項中1項失敗：v1→v2測試對已呼叫close()的Dexie實例繼續使用，回報DatabaseClosedError。修正測試為重建PlayerDatabase/Repository後驗證升版；不將此誤報為產品遷移失敗。
檢視同時補強裝備definition/slot變動時的既有數值失效處理，以及確認checkbox重新確認來源值的行為；新增已知版本配裝替換/刪除回歸。

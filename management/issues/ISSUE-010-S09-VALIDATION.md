# ISSUE-010：S09 集中驗收修正
狀態：CLOSED
首次：整體format完成後format:check仍提示measurement-storage.test.ts與measurement.spec.ts；尚未執行Lint/型別/單元/建置/E2E。
修正：針對兩檔重新格式化並重驗，日誌見S09-format-check.log及後續retry。
重驗：格式/Lint/型別/資料161項/數值45項通過；Web60項中新增實測表單及既有S08 UI各一項5000ms逾時，其他58項通過。觀察到12個jsdom檔案並行、environment合計63.17秒；先限制Web maxWorkers=2，保留原斷言與逾時門檻驗證資源競爭假設。未執行建置/E2E。

完整重驗：266項單元/整合、26項E2E及建置通過。視覺檢查後修正MAPE百分號與極小誤差顯示（科學記號），原始統計不取整；重驗受影響UI/建置/實測E2E。

結案：限制maxWorkers=2後，兩份原逾時UI共5項通過（表單約1.6秒）；全Web60項、資料161項/數值45項、全站E2E26項及建置通過。視覺修正後再跑格式/Lint/型別、Web60項/建置/受影響E2E4項亦通過，見S09-*-complete.log。未調高5000ms逾時或削弱原斷言。

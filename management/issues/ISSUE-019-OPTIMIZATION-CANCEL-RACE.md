# ISSUE-019：最佳化取消 E2E 偶發競態

狀態：OPEN；2026-11-19。S10 驗收完整 E2E 首次執行時，mobile-chromium 的 `tests/e2e/optimization.spec.ts` 取消案例期待「已取消」，實際收到「搜尋完成」，41 通過、1 失敗。此小型搜尋可能在取消操作前完成；尚未確認根因，不排除產品競態。初次日誌：management/tests/logs/s10-variant-2026-11-19-2238/test-e2e.log。

同一手機檔案 repeat-each=5 共 10 項通過；完整 E2E 重跑 42 項通過。此結果不證明偶發問題已修復。恢復條件：建立可重現的取消執行中工作案例，確認是否為操作時序或 Worker 狀態缺陷並修復，重跑受影響及完整回歸。S10 蓄力測試可獨立進行；未修改 S13 產品行為。
## 2026-11-19：ISSUE-019 取消測試補強

針對 E2E 極小工作可能在取消前完成的時序，測試中攔住一次 Worker 請求，確認取消時工作仍在執行，並在下一次啟動前恢復原方法；此案例不驗證長時間真實搜尋的性能。單元測試另外驗證取消後遲到的 RESULT 不產生排名且狀態維持取消。Windows、Node 22.14.0、pnpm 10.6.5：format:check、lint、typecheck、test、build、test:e2e 均通過；單元與整合 339 項、完整 E2E 42 項；最佳化 E2E 桌面和手機各重複五次共 20 項通過。日誌 management/tests/logs/issue-019-2026-11-19-2244/。原始偶發失敗的根因未經證實，ISSUE-019 保持 OPEN，需後續觀察真實長工作取消；ISSUE-018 與 S14 狀態不變。
# ADR-001：Web 基礎與工具鏈
日期：2026-11-17；狀態：採用；對應 S01。
依 requirements/docs/02 與 06，使用 pnpm workspace、React、Vite、TypeScript，ESLint、Prettier、Vitest 與 Playwright。
apps/web 為前端；packages/* 保留給後續步驟的獨立資料與引擎模組。後續依依賴順序加入 Tailwind、Zustand、ECharts、Dexie，S01 不先加入尚未使用的功能相依。
時間與遊戲資料契約留待對應步驟；基礎頁面不含任何遊戲數值、等級上限或可計算 DPS 的宣稱。
本次為既有本機專案開發與驗收，不註冊或部署遠端 Sites；發布依 S16 驗收。
環境未找到 node/npm/pnpm，使用專案 .tools 中的官方 Node 22.14.0 可攜版本，下載後對照官方 SHA256；不變更系統 PATH。
驗收：依賴安裝、format:check、lint、typecheck、Vitest、production build、Playwright 桌面與手機首頁及資料狀態互動。日誌記入 management/tests/logs。
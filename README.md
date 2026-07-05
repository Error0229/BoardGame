# Kindred — 桌遊線上版

多人即時桌遊。前端 React + Vite，後端 [Convex](https://convex.dev)（資料庫 + 即時訂閱 + 遊戲邏輯），
部署於 Vercel（前端靜態）+ Convex Cloud（後端）。

- **正式站**：https://kindred-boardgame.vercel.app
- **Convex prod**：https://kindly-beagle-205.convex.cloud

## 開發

```bash
npm install
npm run dev        # convex dev（後端熱更新）+ vite dev（前端 :5173）
```

首次執行 `npx convex dev` 會要求登入或建立匿名本地部署；
`client/.env.local` 的 `VITE_CONVEX_URL` 需指向該部署（本地匿名為 `http://127.0.0.1:3210`）。

卡圖資產：`unzip assets.zip -d client/public`（`client/public/assets/` 不進版控）。

## 測試

```bash
npm test -w server                              # 遊戲引擎測試（4300+）
npm test -w client                              # 前端元件測試
npx vitest run --config convex/vitest.config.ts # Convex 函式測試
```

## 架構

```
shared/   共用型別（GameStateFull / GameStateClient / 卡牌…）
server/   GameEngine 純狀態機 + 引擎測試（express server.ts 為遺留，已不再使用）
convex/   Convex 後端：schema、rooms/game/chat 函式、結算演出排程
client/   React 前端，convexGame.ts 封裝 Convex hooks（取代舊 socket.ts）
```

遊戲狀態整包存於 `kindred_rooms.state`，mutation 內 `GameEngine.fromState()` 載入 → 執行 → 寫回；
`game.state` reactive query 依 token 做每位玩家的隱藏資訊投影。詳見 `docs/convex-migration-plan.md`。

## 部署

推 Vercel：`vercel deploy --prod`。build 流程（`vercel.json`）：

1. 解壓 `assets.zip` → `client/public`
2. 若有 `CONVEX_DEPLOY_KEY`：`npx convex deploy --cmd 'npm run build -w client'`
   （同時推 Convex 函式並自動注入 `VITE_CONVEX_URL`）
3. 否則：純前端 build，使用 Vercel 環境變數 `VITE_CONVEX_URL`；
   Convex 函式需手動 `npx convex deploy`

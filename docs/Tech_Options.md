# 技術選型文件 — Kindred: Blood & Betrayal

> 本文件分析數位版《避世血族：血海深仇》的開發語言、框架與架構選項，供技術選型決策使用。

---

## 核心需求分析

在選型前，先確認遊戲的技術需求：

| 需求 | 說明 | 技術影響 |
|---|---|---|
| **多人連線** | 2–4 人，同時出牌 | 需要 Server；隱藏資訊不能全部在 Client |
| **隱藏資訊** | 面朝下的牌對手不可見 | Server 為權威端（Authoritative Server） |
| **同步揭牌** | 所有玩家同時看到結果 | 需要事件廣播機制 |
| **卡牌動畫** | 翻牌、血液流動、爆裂效果 | 需要 2D 動畫能力 |
| **平台** | PC/Mac 優先，未來可擴展 | 跨平台構建能力 |
| **開發效率** | 原型 → 測試 → 迭代 | 需要快速迭代的工具鏈 |

---

## 方案比較

---

### 方案 A：Unity（C#）

**推薦程度：⭐⭐⭐⭐⭐ 首選**

#### 語言與框架
- 語言：**C#**
- 引擎：**Unity 2022 LTS** 或 **Unity 6**
- 多人：**Netcode for GameObjects（NGO）** + **Unity Relay Service**（官方方案，免費額度夠用）

#### 架構概覽

```
┌─────────────────────────────────────────────────────┐
│                    Unity Client                      │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────┐  │
│  │  UI Layer   │  │ Game State   │  │ Animation  │  │
│  │ (UIToolkit/ │  │   Manager    │  │  Controller│  │
│  │  uGUI)      │  │              │  │            │  │
│  └──────┬──────┘  └──────┬───────┘  └─────┬──────┘  │
│         └────────────────┴────────────────┘         │
│                          │                           │
│              ┌───────────▼──────────┐                │
│              │   Network Manager    │                │
│              │  (NGO / Mirror)      │                │
│              └───────────┬──────────┘                │
└──────────────────────────┼──────────────────────────┘
                           │
              ┌────────────▼────────────┐
              │    Dedicated Server     │
              │  (Unity Headless Build) │
              │                         │
              │  GameRoomManager        │
              │  PlayerStateManager     │
              │  PlanningValidator      │ ← 隱藏資訊在此
              │  ConflictResolver       │
              └─────────────────────────┘
```

#### 優點
- 卡牌遊戲生態成熟（Slay the Spire、Hearthstone 都用 Unity）
- 官方 Unity Relay：點對點 + 中繼，免費額度每月 200 人同時在線
- 動畫系統（Animator、DOTween）豐富
- Asset Store 有大量 UI 元件（卡牌框架、血液特效）

#### 缺點
- C# 學習曲線比腳本語言陡
- Unity 授權費（個人版免費，月收入超過 $10 萬才需付費）
- 構建大小較大（50–200MB）

#### 推薦多人套件比較

| 套件 | 優點 | 缺點 | 建議用途 |
|---|---|---|---|
| **Netcode for GameObjects** | 官方維護，整合 Unity Services | 功能較基礎 | 原型 + 小規模 |
| **Mirror** | 免費開源，功能完整 | 需自己架 Server | 進階開發 |
| **Photon Fusion 2** | 高效能，付費但有免費額度 | 複雜度高 | 商業發行 |

**建議**：原型用 NGO，正式版考慮 Mirror 或 Photon。

---

### 方案 B：Web Stack（TypeScript + Phaser.js + Node.js）

**推薦程度：⭐⭐⭐⭐ 快速原型首選**

#### 語言與框架
- 前端語言：**TypeScript**
- 遊戲渲染：**Phaser.js 3**（2D 遊戲框架）
- 後端語言：**Node.js + TypeScript**
- 多人框架：**Colyseus**（專為回合制遊戲設計的多人框架）
- 部署：**任意 VPS**（Railway、Render、Fly.io 都有免費方案）

#### 架構概覽

```
瀏覽器 / Electron App
┌──────────────────────────────────┐
│           Phaser.js Client        │
│  ┌────────────┐  ┌─────────────┐ │
│  │  Scene     │  │  UI Manager │ │
│  │  Manager   │  │  (HTML/CSS) │ │
│  └────────┬───┘  └──────┬──────┘ │
│           └──────────────┘        │
│              Colyseus Client SDK  │
└──────────────┬───────────────────┘
               │ WebSocket
┌──────────────▼───────────────────┐
│         Colyseus Server           │
│  (Node.js + TypeScript)           │
│                                   │
│  ┌──────────────────────────┐     │
│  │   GameRoom (State)        │     │
│  │   - players[]             │     │
│  │   - locations[]           │     │
│  │   - round / phase         │     │
│  │   - hiddenDeployments{}   │ ← 隱藏資訊 │
│  └──────────────────────────┘     │
│                                   │
│  GameEngine（純 TypeScript）       │
│  - PlanningSystem                 │
│  - ConflictResolver               │
│  - PowerScoreCalculator           │
└───────────────────────────────────┘
```

#### 優點
- **最快的原型速度**：在瀏覽器直接測試，無需構建
- Colyseus 天生適合「回合制 + 隱藏狀態」遊戲（有 partial state sync）
- 前後端共用 TypeScript 類型定義（卡牌數據結構）
- 免費部署方案多
- Electron 包裝後可發布為桌面應用

#### 缺點
- Phaser.js 不如 Unity 適合複雜動畫（血液流動、玻璃破裂）
- 多人框架 Colyseus 的社群比 Unity 小
- JavaScript 運行時效能不如 C#

#### Colyseus 的隱藏資訊機制

```typescript
// Colyseus 支援 "filtered state"
// 每個玩家只收到自己看得到的狀態

class GameRoom extends Room<GameState> {
  onJoin(client: Client) {
    // 每個玩家的隱藏部署只發給他自己
    this.setSimulationInterval(() => {
      this.broadcast("state", this.getFilteredState(client));
    });
  }
}
```

---

### 方案 C：Godot（GDScript / C#）

**推薦程度：⭐⭐⭐ 開源免費替代方案**

#### 語言與框架
- 語言：**GDScript**（Python-like，Godot 原生）或 **C#**
- 引擎：**Godot 4.x**
- 多人：**Godot 內建 MultiplayerAPI**（ENet/WebSocket）

#### 優點
- 完全免費，無授權費
- Godot 4 的動畫系統大幅改善
- 輕量，構建小

#### 缺點
- 多人生態不如 Unity/Web Stack 成熟
- C# 在 Godot 4 中仍有些限制
- Asset 資源比 Unity 少很多
- 卡牌遊戲範例稀少

---

### 方案 D：Python（Pygame / Arcade）

**推薦程度：⭐⭐ 僅適合本地桌機原型**

- 語言：Python
- 適合快速做出「能跑的邏輯原型」，不適合最終產品
- 沒有成熟的多人方案
- UI 能力弱

---

## 推薦方案

### 若目標是「盡快可以玩到遊戲」

**→ 方案 B（Web Stack）**

```
TypeScript + Phaser.js 3（前端）
TypeScript + Colyseus（後端）
```

- 2 週內可以有能跑的多人原型
- 在瀏覽器開 4 個分頁就能測試 4 人遊戲
- 不需要安裝引擎

### 若目標是「做出完整的視覺效果和商業品質遊戲」

**→ 方案 A（Unity）**

```
Unity 2022 LTS + C#（Client）
Unity Dedicated Server Build + Mirror（Server）
```

- 卡牌動畫、血液 UI、哥德視覺效果更容易實現
- 長期維護性更好
- PC/Mac 跨平台一鍵構建

---

## 建議架構（以 Unity 為例的完整設計）

### 目錄結構

```
Assets/
├── _Game/
│   ├── Cards/
│   │   ├── Data/          # ScriptableObject — 卡牌數據
│   │   │   ├── CardSO.cs
│   │   │   ├── KindredCardSO.cs
│   │   │   └── ActionCardSO.cs
│   │   ├── Logic/         # 純 C# — 卡牌效果邏輯
│   │   └── View/          # MonoBehaviour — 卡牌視覺
│   │
│   ├── GameSystems/
│   │   ├── PlanningSystem.cs      # Planning 階段邏輯
│   │   ├── ConflictResolver.cs    # Power Score 計算
│   │   ├── MasqueradeTracker.cs   # 避世計量器
│   │   └── InfluenceCounter.cs   # Influence 計分
│   │
│   ├── Network/
│   │   ├── GameNetworkManager.cs  # NGO NetworkManager
│   │   ├── PlayerNetworkState.cs  # 玩家網路狀態（同步）
│   │   └── HiddenDeployment.cs   # 服務端隱藏資訊
│   │
│   ├── UI/
│   │   ├── HandUI.cs              # 手牌顯示
│   │   ├── LocationUI.cs          # 地點牌顯示
│   │   ├── BloodPoolUI.cs         # 血液計量器動畫
│   │   └── MasqueradeWindowUI.cs  # 彩繪玻璃窗動畫
│   │
│   └── Clans/
│       ├── ClanBrujah.cs          # 各氏族特殊邏輯
│       ├── ClanNosferatu.cs
│       └── ...
│
├── StreamingAssets/
│   └── CardDatabase.json          # 所有卡牌數據（JSON）
│
└── Plugins/
    └── DOTween/                   # 動畫套件
```

### 核心數據模型

```csharp
// 卡牌基礎數據（ScriptableObject）
[CreateAssetMenu]
public class CardSO : ScriptableObject
{
    public string cardId;
    public string cardName;
    public ClanType clan;
    public CardType type;
    public int bloodCost;
    public int combatValue;
    public string flavorText;
}

// Kindred 牌擴展
public class KindredCardSO : CardSO
{
    public int generation;      // I-V
    public int vitality;        // 生命值
    public DisciplineType[] disciplines;
}

// 地點部署狀態（Server 端，不同步給其他玩家）
public class HiddenDeployment
{
    public ulong playerId;
    public string locationId;
    public string cardId;        // 面朝下時其他玩家看到 null
    public bool isFaceDown;
    public int bloodTokens;
}
```

### 遊戲狀態機

```
GameState（Server 端）
│
├── LOBBY              → 等待玩家加入，選擇氏族
├── ROUND_START        → Night Begins：發牌、血液收入
├── PLANNING           → 所有玩家提交部署（Client → Server）
├── RESOLUTION_LOOP    → 逐地點執行 5 步驟
│   ├── WITHDRAW
│   ├── REVELATION     → Server 廣播所有牌給所有玩家
│   ├── PREPARATION    → 等待 Trap/Discipline 使用
│   ├── CONFLICT       → Server 計算 Power Score
│   └── AFTERMATH      → 廣播結果，更新 Influence
├── ROUND_END          → Dawn：清場、傳遞 Ambition Token
└── GAME_OVER          → 計分，顯示勝利者
```

### 隱藏資訊同步策略

**核心原則**：Server 是唯一知道所有資訊的端。

```
Client A 看到的狀態：
  Location[0]:
    - 自己的部署：Kindred "Marcus" (face down)，2 血液
    - 對手 B 的部署：??? (face down)，? 血液（只知道「有部署」）
    - 對手 C 的部署：Kindred "Cain" (face up)，1 血液

Server 知道的狀態：
  Location[0]:
    - Player A：Kindred "Marcus"，2 血液，face down
    - Player B：Action "暗巷伏擊"，1 血液，face down
    - Player C：Kindred "Cain"，1 血液，face up

REVELATION 時：Server 廣播完整狀態給所有人
```

---

## 開發里程碑建議

### Phase 1：規則原型（4–6 週）

目標：能跑的邏輯，不需要美術

| 週次 | 工作 |
|---|---|
| 1–2 | 建立卡牌數據結構、基礎 GameState、Planning 邏輯 |
| 3–4 | 實現 Resolution 5 步驟、Power Score 計算 |
| 5–6 | 多人連線、隱藏資訊同步、3 回合計分 |

**輸出**：可以 2–4 人連線測試完整流程的版本（無美術）

### Phase 2：氏族實作（6–8 週）

目標：所有 7 個氏族的特殊機制都能跑

| 週次 | 工作 |
|---|---|
| 7–8 | Brujah、Nosferatu 機制 |
| 9–10 | Toreador、Tremere 機制 |
| 11–12 | Malkavian、Gangrel、Ventrue 機制 |
| 13–14 | 卡牌設計（每氏族 9 張，共 63 張） |

### Phase 3：視覺實作（4–6 週）

目標：符合哥德龐克美術方向的完整 UI

| 週次 | 工作 |
|---|---|
| 15–16 | 卡牌美術框架、地點 UI |
| 17–18 | 血液計量器動畫、Masquerade 彩繪玻璃 |
| 19–20 | 音效整合、特效（翻牌、攻擊、Frenzy） |

### Phase 4：測試與平衡（持續）

- 氏族間 Influence 勝率平衡
- 卡牌強度測試
- 網路延遲下的體驗優化

---

## 快速開始（Web Stack 方案）

若選擇 Web Stack，以下是最小可行環境：

```bash
# 建立專案
mkdir kindred-game
cd kindred-game

# 後端（Colyseus）
npx create-colyseus-app@latest server
cd server
npm install

# 前端（Phaser + Vite）
cd ..
npm create vite@latest client -- --template vanilla-ts
cd client
npm install phaser
npm install colyseus.js
```

**第一個可跑的多人測試**：約 2 天可完成「2 人連線 + 看到對方部署 + 揭牌」的最小原型。

---

## 最終建議

| 情況 | 建議 |
|---|---|
| 想快速驗證設計是否好玩 | **Web Stack（Colyseus + Phaser）**，2 週原型 |
| 想做出完整商業品質遊戲 | **Unity + Mirror**，更好的視覺效果 |
| 想控制成本，完全開源 | **Godot 4 + C#**，但社群資源較少 |
| 只想測試規則邏輯 | **Python + 命令列**，最快，不需要 UI |

> **個人推薦路徑**：先用 **Web Stack** 做 4–6 週的規則原型，驗證遊戲設計後，再決定是否遷移到 Unity 做最終版本。兩者的遊戲邏輯可以 1:1 移植（都是物件導向）。

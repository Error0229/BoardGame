// ─────────────────────────────────────────────
//  共用型別（前後端共用）
// ─────────────────────────────────────────────

export type ClanId = 'brujah' | 'nosferatu' | 'toreador' | 'tremere' | 'malkavian' | 'gangrel' | 'ventrue';
export type CardType = 'conflict' | 'preparation' | 'aftermath' | 'passive';

export type GamePhase =
  | 'LOBBY'
  | 'CLAN_SELECT'
  | 'HAND_BUILD'
  | 'PLANNING'
  | 'WITHDRAW'
  | 'REVELATION'
  | 'CONFLICT'
  | 'ROUND_END'
  | 'GAME_OVER';

// ─── 卡牌 ───────────────────────────────────

export interface CardDef {
  id: string;
  name_en: string;
  name_zh: string;
  clan: ClanId | 'neutral';
  type: CardType;
  power: number;
  effect_en: string | null;
  effect_zh: string | null;
  is_starter: boolean;
}

// ─── 地點 ───────────────────────────────────

export interface LocationDef {
  id: string;
  name: string;
  // influence[round-1][rank-1]: round=1..3, rank=1..2
  influence: number[][];
  isPrinces: boolean;
}

// ─── 盟友牌 ──────────────────────────────────

export interface AllyCard {
  id: string;
  name: string;
  type: 'human' | 'vampire';
  influence: number;
  feedBlood: number;
  drainBlood: number;
  drainInfluence: number;
  effect_zh?: string | null;
  drained?: boolean;
}

// ─── 部署 ────────────────────────────────────

export interface Deployment {
  locationId: string;
  cardId: string;
  faceDown: boolean;
  bloodTokens: number;
}

export interface SlotFull {
  playerId: string;
  cardId: string;
  faceDown: boolean;
  bloodTokens: number;
  withdrawn: boolean;
  effectivePower: number;
  skipEffects?: boolean;  // VE03: rival chose to skip prep/aftermath
}

export interface PendingChoice {
  id: string;
  playerId: string;
  prompt_zh: string;
  options: { key: string; label_zh: string }[];
  context: { cardId: string; locationId: string; sourcePlayerId: string; sourceName: string };
  choiceKey: string; // 用於 resolvedChoices 查詢：`${cardId}:${locationId}:${playerId}`
}

export interface SlotVisible {
  playerId: string;
  cardId: string | null;
  faceDown: boolean;
  bloodTokensHidden: boolean;
  bloodTokens: number;
  withdrawn: boolean;
  effectivePower: number | null;
}

// ─── 玩家狀態 ────────────────────────────────

export interface PlayerPublic {
  id: string;
  name: string;
  clan: ClanId | null;
  blood: number;
  influence: number;
  handCount: number;
  allianceCount: number;
  diablerie: number;
  deploymentsLeft: number;
  isReady: boolean;
}

export interface PlayerPrivate extends PlayerPublic {
  hand: CardDef[];
  deck: CardDef[];
  alliance: AllyCard[];
  // 手牌建造：等待選擇的兩張牌
  handBuildDraft: CardDef[];
}

// ─── 結算結果 ────────────────────────────────

export interface ConflictResult {
  locationId: string;
  winner: string | null;
  second: string | null;
  scores: Record<string, number>;
  influenceGained: Record<string, number>;
  bloodEvents: string[];
  /** 分步驟的效果紀錄，供 UI 逐步顯示用 */
  stepEvents: {
    prepare: string[];
    conflict: string[];
    aftermath: string[];
  };
  tie: boolean;
}

// ─── Server 完整狀態 ──────────────────────────

export interface GameStateFull {
  roomCode: string;
  phase: GamePhase;
  round: number;
  ambitionHolder: string;
  playerOrder: string[];        // 出牌順序（從 ambitionHolder 開始）
  currentTurnPlayerId: string;  // 當前輪到出牌的玩家
  locations: LocationDef[];
  players: Record<string, PlayerPrivate>;
  deployments: Record<string, SlotFull[]>;
  withdrawChoices: Record<string, Record<string, boolean>>;
  locationAllies: Record<string, AllyCard | null>;
  allyDeck: AllyCard[];
  victimDeck: AllyCard[];
  lastConflictResults: ConflictResult[];
  winner: string | null;
  log: string[];
  pendingChoices: PendingChoice[];
  resolvedChoices: Record<string, string>; // choiceKey → option
}

// ─── Client 收到的狀態 ────────────────────────

export interface GameStateClient {
  roomCode: string;
  phase: GamePhase;
  round: number;
  ambitionHolder: string;
  playerOrder: string[];        // 出牌順序（從 ambitionHolder 開始）
  currentTurnPlayerId: string;  // 當前輪到出牌的玩家
  locations: LocationDef[];
  players: Record<string, PlayerPublic>;
  myHand: CardDef[];
  myHandBuildDraft: CardDef[];   // HAND_BUILD phase 用
  myBlood: number;
  myAlliance: AllyCard[];
  myDiablerieTokens: number;
  deployments: Record<string, SlotVisible[]>;
  locationAllies: Record<string, AllyCard | null>;
  waitingFor: string[];
  lastConflictResults: ConflictResult[];
  winner: string | null;
  log: string[];
  myPendingChoice: PendingChoice | null;
}

// ─── Socket 事件 ──────────────────────────────

export interface ClientToServer {
  createRoom: (payload: { name: string }) => void;
  joinRoom: (payload: { code: string; name: string }) => void;
  readyStart: () => void;
  selectClan: (clan: ClanId) => void;
  selectHandCard: (cardId: string) => void;          // HAND_BUILD: 選擇保留哪張
  submitDeployment: (deployment: Deployment | { skip: true }) => void;
  submitWithdraw: (payload: { locationId: string; withdraw: boolean }) => void;
  drainAlly: (allyId: string) => void;               // 汲取同盟牌
  readyAdvance: () => void;                          // REVELATION/ROUND_END 確認繼續
  respondChoice: (payload: { choiceId: string; option: string }) => void;
  chat: (msg: string) => void;
}

export interface ServerToClient {
  roomCreated: (code: string) => void;
  gameState: (state: GameStateClient) => void;
  notification: (msg: string) => void;
  chat: (payload: { name: string; msg: string }) => void;
  error: (msg: string) => void;
}

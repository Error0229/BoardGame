export const MY_ID = 'test-p1'

const LOC = [
  { id: 'rack', name: 'The Rack', influence: [[1, 0], [1, 1], [2, 1]], isPrinces: false },
  { id: 'asylum', name: 'The Asylum', influence: [[1, 0], [1, 1], [2, 1]], isPrinces: false },
  { id: 'club_zombie', name: 'Club Zombie', influence: [[1, 0], [1, 1], [2, 1]], isPrinces: false },
  { id: 'haven', name: "Prince's Haven", influence: [[2, 0], [2, 1], [3, 1]], isPrinces: true },
]

const P1 = { id: MY_ID, name: 'Alice', clan: 'brujah', blood: 6, influence: 3, handCount: 1, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false }
const P2 = { id: 'test-p2', name: 'Bob', clan: 'ventrue', blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false }

const EMPTY_DEPLOYS = { rack: [], asylum: [], club_zombie: [], haven: [] }

const KINE = { id: 'kine', name: 'Kine', type: 'human', influence: 1, feedBlood: 1, drainBlood: 2, drainInfluence: 0 }

const BASE = {
  roomCode: 'TEST',
  round: 0,
  ambitionHolder: MY_ID,
  playerOrder: [MY_ID, 'test-p2'],
  currentTurnPlayerId: MY_ID,
  currentLocIndex: 0,
  locations: LOC,
  players: { [MY_ID]: P1, 'test-p2': P2 },
  myHand: [],
  myHandBuildDraft: [],
  myBlood: 6,
  myAlliance: [KINE],
  myDiablerieTokens: 0,
  deployments: EMPTY_DEPLOYS,
  locationAllies: { rack: null, asylum: null, club_zombie: null, haven: null },
  waitingFor: [MY_ID, 'test-p2'],
  lastConflictResults: [],
  winner: null,
  log: [],
  myPendingChoice: null,
  activeEffect: null,
  hasPendingChoices: false,
  activeChoosers: [],
  skipVotes: [],
}

const BR01 = { id: 'BR01', name_en: 'Bloody Fury', name_zh: 'Bloody Fury', clan: 'brujah', type: 'conflict', power: 6, effect_en: null, effect_zh: null, is_starter: false }
const BR02 = { id: 'BR02', name_en: "Punk's Posse", name_zh: "Punk's Posse", clan: 'brujah', type: 'conflict', power: 4, effect_en: null, effect_zh: null, is_starter: false }
const BR09 = { id: 'BR09', name_en: 'Hunt', name_zh: 'Hunt', clan: 'brujah', type: 'conflict', power: 3, effect_en: null, effect_zh: null, is_starter: true }

type S = Record<string, unknown>

function player(id: string, name: string, clan: string | null = null): S {
  return { id, name, clan, blood: 6, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 1, isReady: false }
}

export function lobbyState(players?: Record<string, S>): S {
  return {
    ...BASE,
    phase: 'LOBBY',
    players: players ?? BASE.players,
    playerOrder: players ? Object.keys(players) : BASE.playerOrder,
  }
}

export function clanSelectState(myClan: string | null = null, takenBy: Array<{ id: string; name: string; clan: string }> = []): S {
  const players: Record<string, S> = { [MY_ID]: { ...P1, clan: myClan } }
  takenBy.forEach((p) => { players[p.id] = player(p.id, p.name, p.clan) })
  return {
    ...BASE,
    phase: 'CLAN_SELECT',
    players,
    playerOrder: [MY_ID, ...takenBy.map((p) => p.id)],
    waitingFor: myClan ? [] : [MY_ID],
  }
}

export function handBuildState(draftCards: S[] = [BR02]): S {
  return {
    ...BASE,
    phase: 'HAND_BUILD',
    myHand: [BR09],
    myHandBuildDraft: draftCards,
    waitingFor: [MY_ID],
  }
}

export function planningState(opts: {
  myBlood?: number
  handCards?: S[]
  deploymentsLeft?: number
  isMyTurn?: boolean
  clan?: string
  myAlliance?: S[]
  deployments?: S
} = {}): S {
  const {
    myBlood = 8,
    handCards = [BR01],
    deploymentsLeft = 1,
    isMyTurn = true,
    clan = 'brujah',
    myAlliance = [KINE],
    deployments = EMPTY_DEPLOYS,
  } = opts
  return {
    ...BASE,
    phase: 'PLANNING',
    myBlood,
    myAlliance,
    myHand: handCards,
    deployments,
    waitingFor: [MY_ID, 'test-p2'],
    currentTurnPlayerId: isMyTurn ? MY_ID : 'test-p2',
    players: {
      [MY_ID]: { ...P1, clan, deploymentsLeft, blood: myBlood },
      'test-p2': { ...P2 },
    },
  }
}

export function withdrawState(opts: {
  locationId?: string
  locIndex?: number
  bloodTokens?: number
} = {}): S {
  const { locationId = 'rack', locIndex = 0, bloodTokens = 0 } = opts
  return {
    ...BASE,
    phase: 'WITHDRAW',
    currentLocIndex: locIndex,
    deployments: {
      ...EMPTY_DEPLOYS,
      [locationId]: [{ playerId: MY_ID, cardId: 'BR01', faceDown: false, bloodTokensHidden: false, bloodTokens, withdrawn: false, effectivePower: null }],
    },
    waitingFor: [MY_ID],
  }
}

export function revelationState(opts: {
  pendingChoice?: S | null
  waitingForSelf?: boolean
  round?: number
} = {}): S {
  const { pendingChoice = null, waitingForSelf = true, round = 0 } = opts
  return {
    ...BASE,
    phase: 'REVELATION',
    round,
    waitingFor: waitingForSelf ? [MY_ID] : ['test-p2'],
    myPendingChoice: pendingChoice,
    hasPendingChoices: pendingChoice !== null,
    lastConflictResults: [{
      locationId: 'rack',
      winner: MY_ID,
      second: 'test-p2',
      scores: { [MY_ID]: 6, 'test-p2': 2 },
      influenceGained: { [MY_ID]: 1 },
      bloodEvents: [],
      stepEvents: { prepare: [], conflict: [], aftermath: [] },
      tie: false,
    }],
    deployments: {
      ...EMPTY_DEPLOYS,
      rack: [{ playerId: MY_ID, cardId: 'BR01', faceDown: false, bloodTokensHidden: false, bloodTokens: 0, withdrawn: false, effectivePower: 6 }],
    },
  }
}

export function roundEndState(round = 0): S {
  return { ...revelationState({ round }), phase: 'ROUND_END', waitingFor: [MY_ID] }
}

export function gameOverState(): S {
  return {
    ...BASE,
    phase: 'GAME_OVER',
    winner: MY_ID,
    players: {
      [MY_ID]: { ...P1, name: 'Alice', influence: 8, blood: 4 },
      'test-p2': { ...P2, name: 'Bob', influence: 5, blood: 6 },
      'test-p3': { id: 'test-p3', name: 'Casey', clan: 'toreador', blood: 3, influence: 3, handCount: 0, allianceCount: 0, diablerie: 0, deploymentsLeft: 0, isReady: true },
    },
  }
}

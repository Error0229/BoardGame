import { GameStateFull, PlayerPrivate, SlotFull } from '@kindred/shared';
import { LOCATIONS, ALLY_POOL, VICTIM_POOL, shuffle } from '../cardData';

export function makePlayer(id: string, overrides: Partial<PlayerPrivate> = {}): PlayerPrivate {
  return {
    id,
    name: id,
    clan: 'malkavian',
    blood: 10,
    influence: 0,
    handCount: 0,
    allianceCount: 0,
    diablerie: 0,
    deploymentsLeft: 1,
    isReady: true,
    hand: [],
    deck: [],
    alliance: [],
    handBuildDraft: [],
    ...overrides,
  };
}

export function makeSlot(playerId: string, cardId: string, overrides: Partial<SlotFull> = {}): SlotFull {
  return {
    playerId,
    cardId,
    faceDown: false,
    bloodTokens: 0,
    withdrawn: false,
    effectivePower: 0,
    ...overrides,
  };
}

export function makeState(overrides: Partial<GameStateFull> = {}): GameStateFull {
  return {
    roomCode: 'TEST',
    phase: 'REVELATION',
    round: 1,
    ambitionHolder: '',
    playerOrder: [],
    currentTurnPlayerId: '',
    currentLocIndex: 0,
    currentLocResolved: false,
    locations: LOCATIONS,
    players: {},
    deployments: Object.fromEntries(LOCATIONS.map(l => [l.id, []])),
    withdrawChoices: Object.fromEntries(LOCATIONS.map(l => [l.id, {}])),
    locationAllies: Object.fromEntries(LOCATIONS.map(l => [l.id, null])),
    allyDeck: shuffle([...ALLY_POOL]),
    victimDeck: shuffle([...VICTIM_POOL]),
    lastConflictResults: [],
    winner: null,
    log: [],
    pendingChoices: [],
    resolvedChoices: {},
    activeEffect: null,
    forestallImmune: {},
    ...overrides,
  };
}

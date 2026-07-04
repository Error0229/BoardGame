import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { CardDef, ClanId, PendingChoice } from '@kindred/shared';
import { CLAN_DECKS, CLAN_STARTERS, LOCATIONS } from '../../cardData';
import { GameEngine } from '../../gameEngine';

const CLANS: ClanId[] = [
  'brujah',
  'nosferatu',
  'toreador',
  'tremere',
  'malkavian',
  'gangrel',
  'ventrue',
];

const DEPLOYMENT_OPTIONS = [
  { faceDown: false, bloodTokens: 0 },
  { faceDown: false, bloodTokens: 1 },
  { faceDown: false, bloodTokens: 2 },
  { faceDown: false, bloodTokens: 3 },
  { faceDown: true, bloodTokens: 0 },
  { faceDown: true, bloodTokens: 1 },
  { faceDown: true, bloodTokens: 2 },
  { faceDown: true, bloodTokens: 3 },
];

const NO_OP_CHOICE_KEYS = [
  'stay',
  'no_swap',
  'no_pay',
  '0',
  'keep_down',
  'skip_effects',
  'give_influence',
  'lose_influence',
];

type RegressionCase = {
  clan: ClanId;
  card: CardDef;
  locationId: string;
  faceDown: boolean;
  bloodTokens: number;
};

let consoleLogSpy: ReturnType<typeof vi.spyOn>;

function cardsForClan(clan: ClanId): CardDef[] {
  return [...CLAN_STARTERS[clan], ...CLAN_DECKS[clan]].sort((a, b) => a.id.localeCompare(b.id));
}

function allRegressionCases(): RegressionCase[] {
  return CLANS.flatMap(clan =>
    cardsForClan(clan).flatMap(card =>
      LOCATIONS.flatMap(location =>
        DEPLOYMENT_OPTIONS.map(option => ({
          clan,
          card,
          locationId: location.id,
          ...option,
        }))
      )
    )
  );
}

function otherClans(firstClan: ClanId, count: number): ClanId[] {
  return CLANS.filter(clan => clan !== firstClan).slice(0, count);
}

function setupIntegratedRound(clan: ClanId, card: CardDef) {
  const engine = new GameEngine('DEPLOY_REGRESSION');
  const playerClans = [clan, ...otherClans(clan, 4)];

  playerClans.forEach((_, index) => {
    engine.addPlayer(`p${index + 1}`, `Player ${index + 1}`);
  });

  engine.startClanSelect();
  playerClans.forEach((playerClan, index) => {
    expect(engine.selectClan(`p${index + 1}`, playerClan)).toBe(true);
  });

  engine.startHandBuild();
  playerClans.forEach((_, index) => {
    const player = engine.state.players[`p${index + 1}`];
    engine.selectHandCard(player.id, player.handBuildDraft[0].id);
  });

  engine.startRound();

  const actor = engine.state.players['p1'];
  actor.hand = [card];
  actor.handCount = 1;
  actor.blood = 13;
  actor.deploymentsLeft = 1;
  actor.isReady = false;

  for (const player of Object.values(engine.state.players)) {
    if (player.id === 'p1') continue;
    player.hand = [];
    player.handCount = 0;
    player.blood = 13;
    player.deploymentsLeft = 1;
    player.isReady = false;
  }

  engine.state.currentTurnPlayerId = 'p1';
  return engine;
}

function chooseRegressionOption(choice: PendingChoice): string | null {
  for (const key of NO_OP_CHOICE_KEYS) {
    if (choice.options.some(option => option.key === key)) return key;
  }
  return choice.options[0]?.key ?? null;
}

function settlePendingChoices(engine: GameEngine) {
  let safety = 0;
  while (engine.state.pendingChoices.length > 0 && safety++ < 50) {
    const choice = engine.state.pendingChoices[0];
    const option = chooseRegressionOption(choice);
    if (!option) {
      engine.state.pendingChoices.shift();
      continue;
    }
    engine.applyPendingChoice(choice.id, option);
  }
  expect(engine.state.pendingChoices).toHaveLength(0);
}

function skipRemainingPlanningTurns(engine: GameEngine) {
  let safety = 0;
  while (engine.state.currentTurnPlayerId && safety++ < 20) {
    const pid = engine.state.currentTurnPlayerId;
    expect(engine.submitDeployment(pid, { skip: true })).toBe(true);
  }
}

function resolveCurrentRound(engine: GameEngine, locationId: string) {
  engine.startResolutionPhase();

  expect(engine.state.phase).toBe('WITHDRAW');
  expect(engine.state.locations[engine.state.currentLocIndex]?.id).toBe(locationId);

  for (const pid of Object.keys(engine.state.players)) {
    engine.submitWithdraw(pid, locationId, false);
  }

  expect(engine.allWithdrawSubmitted()).toBe(true);

  engine.applyWithdrawals();
  engine.setupPendingChoices();
  settlePendingChoices(engine);
  const result = engine.resolveCurrentLocation();
  engine.setupPostResolutionChoices();
  settlePendingChoices(engine);
  engine.advanceToNextLocation();

  expect(result.locationId).toBe(locationId);
  expect(engine.state.lastConflictResults.some(entry => entry.locationId === locationId)).toBe(true);
}

beforeAll(() => {
  consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
});

afterAll(() => {
  consoleLogSpy.mockRestore();
});

describe('integration deployment regression matrix', () => {
  it.each(allRegressionCases())(
    '$clan $card.id survives full planning/resolution/endRound at $locationId faceDown=$faceDown bloodTokens=$bloodTokens',
    ({ clan, card, locationId, faceDown, bloodTokens }) => {
      const engine = setupIntegratedRound(clan, card);
      const startingBlood = engine.state.players['p1'].blood;

      expect(engine.state.phase).toBe('PLANNING');
      expect(engine.state.locations.map(location => location.id)).toContain(locationId);

      expect(engine.submitDeployment('p1', {
        locationId,
        cardId: card.id,
        faceDown,
        bloodTokens,
      })).toBe(true);

      skipRemainingPlanningTurns(engine);
      expect(engine.allDeployed()).toBe(true);

      const faceDownCost = clan === 'nosferatu' ? 0 : faceDown ? 1 : 0;
      const deployed = engine.state.deployments[locationId].find(
        slot => slot.playerId === 'p1' && slot.cardId === card.id
      );

      expect(deployed).toMatchObject({
        playerId: 'p1',
        cardId: card.id,
        faceDown,
        bloodTokens,
      });
      expect(engine.state.players['p1'].blood).toBe(startingBlood - faceDownCost - bloodTokens);

      resolveCurrentRound(engine, locationId);
      engine.endRound();

      expect(engine.state.phase).toBe('ROUND_END');
      expect(engine.state.players['p1'].hand.some(handCard => handCard.id === card.id)).toBe(true);
    }
  );
});

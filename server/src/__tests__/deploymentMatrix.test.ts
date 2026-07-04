import { describe, expect, it } from 'vitest';
import { CardDef, ClanId } from '@kindred/shared';
import { CLAN_DECKS, CLAN_STARTERS, LOCATIONS } from '../cardData';
import { GameEngine } from '../gameEngine';
import { makePlayer } from './helpers';

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

type DeploymentCase = {
  clan: ClanId;
  card: CardDef;
  locationId: string;
  faceDown: boolean;
  bloodTokens: number;
};

function cardsForClan(clan: ClanId): CardDef[] {
  return [...CLAN_STARTERS[clan], ...CLAN_DECKS[clan]].sort((a, b) => a.id.localeCompare(b.id));
}

function allDeploymentCases(): DeploymentCase[] {
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

function setupDeploymentCase(clan: ClanId, card: CardDef) {
  const engine = new GameEngine('DEPLOY_MATRIX');
  engine.state.phase = 'PLANNING';
  engine.state.players['p1'] = makePlayer('p1', {
    clan,
    blood: 10,
    hand: [card],
    handCount: 1,
    deploymentsLeft: 1,
    isReady: false,
  });
  engine.state.players['p2'] = makePlayer('p2', {
    clan: 'ventrue',
    blood: 10,
    deploymentsLeft: 1,
    isReady: false,
  });
  engine.state.playerOrder = ['p1', 'p2'];
  engine.state.currentTurnPlayerId = 'p1';
  return engine;
}

describe('deployment matrix', () => {
  it('covers every clan card in the deployment matrix', () => {
    for (const clan of CLANS) {
      expect(cardsForClan(clan).map(card => card.id)).toEqual([
        `${clan.slice(0, 2).toUpperCase()}01`,
        `${clan.slice(0, 2).toUpperCase()}02`,
        `${clan.slice(0, 2).toUpperCase()}03`,
        `${clan.slice(0, 2).toUpperCase()}04`,
        `${clan.slice(0, 2).toUpperCase()}05`,
        `${clan.slice(0, 2).toUpperCase()}06`,
        `${clan.slice(0, 2).toUpperCase()}07`,
        `${clan.slice(0, 2).toUpperCase()}08`,
        `${clan.slice(0, 2).toUpperCase()}09`,
      ]);
    }
  });

  it.each(allDeploymentCases())(
    '$clan $card.id can be played at $locationId faceDown=$faceDown bloodTokens=$bloodTokens',
    ({ clan, card, locationId, faceDown, bloodTokens }) => {
      const engine = setupDeploymentCase(clan, card);
      const startingBlood = engine.state.players['p1'].blood;

      const accepted = engine.submitDeployment('p1', {
        locationId,
        cardId: card.id,
        faceDown,
        bloodTokens,
      });

      const faceDownCost = clan === 'nosferatu' ? 0 : faceDown ? 1 : 0;
      const slot = engine.state.deployments[locationId].find(
        deployed => deployed.playerId === 'p1' && deployed.cardId === card.id
      );

      expect(accepted).toBe(true);
      expect(slot).toMatchObject({
        playerId: 'p1',
        cardId: card.id,
        faceDown,
        bloodTokens,
        withdrawn: false,
      });
      expect(engine.state.players['p1'].hand).toHaveLength(0);
      expect(engine.state.players['p1'].handCount).toBe(0);
      expect(engine.state.players['p1'].blood).toBe(startingBlood - faceDownCost - bloodTokens);
      expect(engine.state.players['p1'].isReady).toBe(true);
      expect(engine.state.players['p1'].deploymentsLeft).toBe(0);
      expect(engine.state.currentTurnPlayerId).toBe('p2');
    }
  );
});

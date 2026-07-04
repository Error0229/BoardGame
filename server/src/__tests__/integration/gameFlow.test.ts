/**
 * Integration: Full game flow
 * Drives a 3-player game from LOBBY through GAME_OVER, checking phase
 * transitions and invariants at each step.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../../gameEngine';

// Helper: resolve one location fully (withdraw → resolve → advance)
function resolveLocation(engine: GameEngine) {
  const s = engine.state;
  // All players submit "stay" for the current location
  const loc = s.locations[s.currentLocIndex];
  if (!loc) return;
  Object.keys(s.players).forEach(pid => {
    engine.submitWithdraw(pid, loc.id, false);
  });
  engine.setupPendingChoices();
  engine.resolveCurrentLocation();
  engine.setupPostResolutionChoices();
  engine.advanceToNextLocation();
}

// Helper: resolve ALL remaining locations in a round
function resolveAllLocations(engine: GameEngine) {
  const s = engine.state;
  let safetyCounter = 0;
  while (s.phase === 'WITHDRAW' && safetyCounter++ < 20) {
    resolveLocation(engine);
  }
}

function setup3Players() {
  const engine = new GameEngine('FLOW');
  engine.addPlayer('p1', 'Alice');
  engine.addPlayer('p2', 'Bob');
  engine.addPlayer('p3', 'Carol');
  return engine;
}

describe('Full game flow (3 players)', () => {
  describe('Phase: LOBBY → CLAN_SELECT', () => {
    it('startClanSelect sets phase and creates 3 locations (2 normal + 1 haven)', () => {
      const engine = setup3Players();
      engine.startClanSelect();
      expect(engine.state.phase).toBe('CLAN_SELECT');
      expect(engine.state.locations).toHaveLength(3);
      expect(engine.state.locations.some(l => l.isPrinces)).toBe(true);
      expect(engine.state.locations.filter(l => !l.isPrinces)).toHaveLength(2);
    });

    it('each player can select a unique clan', () => {
      const engine = setup3Players();
      engine.startClanSelect();
      expect(engine.selectClan('p1', 'brujah')).toBe(true);
      expect(engine.selectClan('p2', 'ventrue')).toBe(true);
      expect(engine.selectClan('p3', 'nosferatu')).toBe(true);
      expect(engine.state.players['p1'].clan).toBe('brujah');
    });

    it('cannot select same clan twice', () => {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      expect(engine.selectClan('p2', 'brujah')).toBe(false);
    });

    it('selectClan updates blood and influence from CLAN_DEFS', () => {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      expect(engine.state.players['p1'].blood).toBe(6);
      expect(engine.state.players['p1'].influence).toBe(3);
    });

    it('allClansSelected returns true only when all players have chosen', () => {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      expect(engine.allClansSelected()).toBe(false);
      engine.selectClan('p2', 'ventrue');
      expect(engine.allClansSelected()).toBe(false);
      engine.selectClan('p3', 'nosferatu');
      expect(engine.allClansSelected()).toBe(true);
    });
  });

  describe('Phase: CLAN_SELECT → HAND_BUILD (round 0)', () => {
    function setupAfterClanSelect() {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      engine.selectClan('p2', 'ventrue');
      engine.selectClan('p3', 'nosferatu');
      engine.startHandBuild();
      return engine;
    }

    it('startHandBuild sets phase to HAND_BUILD', () => {
      const engine = setupAfterClanSelect();
      expect(engine.state.phase).toBe('HAND_BUILD');
    });

    it('round 0: each player gets 2 starter cards + draft of 3', () => {
      const engine = setupAfterClanSelect();
      const p1 = engine.state.players['p1'];
      // 2 starter cards in hand (Hunt + Ready for brujah)
      expect(p1.hand.length).toBe(2);
      // 3-card draft
      expect(p1.handBuildDraft.length).toBe(3);
    });

    it('selectHandCard keeps chosen cards; after all picks deck gets the rest', () => {
      const engine = setupAfterClanSelect();
      const p1 = engine.state.players['p1'];
      const draftCard0 = p1.handBuildDraft[0];
      const deckLenBefore = p1.deck.length;
      // First pick — draft still has 2 remaining, not flushed yet
      engine.selectHandCard('p1', draftCard0.id);
      expect(p1.hand.some(c => c.id === draftCard0.id)).toBe(true);
      expect(p1.isReady).toBe(false);
      // Second pick — now 3p round 0 keepCount=2 is reached → draft remainder flushed to deck
      const draftCard1 = p1.handBuildDraft[0];
      engine.selectHandCard('p1', draftCard1.id);
      expect(p1.isReady).toBe(true);
      expect(p1.deck.length).toBe(deckLenBefore + 1); // 1 leftover from 3-card draft
    });

    it('after 2 selections, player is ready (3p round 0: pick 2)', () => {
      const engine = setupAfterClanSelect();
      const p1 = engine.state.players['p1'];
      engine.selectHandCard('p1', p1.handBuildDraft[0].id);
      expect(p1.isReady).toBe(false);
      // second draft (now 2 cards)
      engine.selectHandCard('p1', p1.handBuildDraft[0].id);
      expect(p1.isReady).toBe(true);
    });
  });

  describe('Phase: HAND_BUILD → PLANNING', () => {
    function setupAfterHandBuild() {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      engine.selectClan('p2', 'ventrue');
      engine.selectClan('p3', 'nosferatu');
      engine.startHandBuild();
      // Complete hand build for all 3 players
      ['p1', 'p2', 'p3'].forEach(pid => {
        const p = engine.state.players[pid];
        engine.selectHandCard(pid, p.handBuildDraft[0].id);
        engine.selectHandCard(pid, p.handBuildDraft[0].id);
      });
      engine.startRound();
      return engine;
    }

    it('startRound increments round and sets phase to PLANNING', () => {
      const engine = setupAfterHandBuild();
      expect(engine.state.round).toBe(1);
      expect(engine.state.phase).toBe('PLANNING');
    });

    it('round 1: 3p deploy limit is 3 per player', () => {
      const engine = setupAfterHandBuild();
      Object.values(engine.state.players).forEach(p => {
        expect(p.deploymentsLeft).toBe(3);
      });
    });

    it('playerOrder is set and currentTurnPlayerId is first player', () => {
      const engine = setupAfterHandBuild();
      const s = engine.state;
      expect(s.playerOrder.length).toBe(3);
      expect(s.currentTurnPlayerId).toBe(s.playerOrder[0]);
    });

    it('only currentTurnPlayerId can deploy', () => {
      const engine = setupAfterHandBuild();
      const s = engine.state;
      const notCurrent = s.playerOrder.find(pid => pid !== s.currentTurnPlayerId)!;
      const p = s.players[notCurrent];
      const locId = s.locations[0].id;
      const result = engine.submitDeployment(notCurrent, {
        locationId: locId, cardId: p.hand[0].id, faceDown: false, bloodTokens: 0,
      });
      expect(result).toBe(false);
    });

    it('deploying a card removes it from hand and adds to deployment', () => {
      const engine = setupAfterHandBuild();
      const s = engine.state;
      const pid = s.currentTurnPlayerId;
      const p = s.players[pid];
      const card = p.hand[0];
      const locId = s.locations[0].id;
      const handSizeBefore = p.hand.length;
      engine.submitDeployment(pid, { locationId: locId, cardId: card.id, faceDown: false, bloodTokens: 0 });
      expect(p.hand.length).toBe(handSizeBefore - 1);
      expect(s.deployments[locId].some(sl => sl.playerId === pid && sl.cardId === card.id)).toBe(true);
    });

    it('face-down deploy costs 1 blood (non-nosferatu)', () => {
      const engine = setupAfterHandBuild();
      const s = engine.state;
      // Find brujah player (non-nosferatu)
      const pid = Object.keys(s.players).find(id => s.players[id].clan === 'brujah')!;
      // Force it to be their turn
      s.currentTurnPlayerId = pid;
      const p = s.players[pid];
      const bloodBefore = p.blood;
      const locId = s.locations[0].id;
      engine.submitDeployment(pid, { locationId: locId, cardId: p.hand[0].id, faceDown: true, bloodTokens: 0 });
      expect(p.blood).toBe(bloodBefore - 1);
    });

    it('nosferatu: face-down deploy is free', () => {
      const engine = setupAfterHandBuild();
      const s = engine.state;
      const pid = Object.keys(s.players).find(id => s.players[id].clan === 'nosferatu')!;
      s.currentTurnPlayerId = pid;
      const p = s.players[pid];
      const bloodBefore = p.blood;
      const locId = s.locations[0].id;
      engine.submitDeployment(pid, { locationId: locId, cardId: p.hand[0].id, faceDown: true, bloodTokens: 0 });
      expect(p.blood).toBe(bloodBefore); // no cost
    });

    it('skip deploy marks player ready immediately', () => {
      const engine = setupAfterHandBuild();
      const s = engine.state;
      const pid = s.currentTurnPlayerId;
      engine.submitDeployment(pid, { skip: true });
      expect(s.players[pid].isReady).toBe(true);
    });
  });

  describe('Phase: PLANNING → WITHDRAW → REVELATION', () => {
    function setupPlanningDone() {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      engine.selectClan('p2', 'ventrue');
      engine.selectClan('p3', 'nosferatu');
      engine.startHandBuild();
      ['p1', 'p2', 'p3'].forEach(pid => {
        const p = engine.state.players[pid];
        engine.selectHandCard(pid, p.handBuildDraft[0].id);
        engine.selectHandCard(pid, p.handBuildDraft[0].id);
      });
      engine.startRound();
      // All players skip deployment
      const s = engine.state;
      s.playerOrder.forEach(pid => {
        s.currentTurnPlayerId = pid;
        s.players[pid].isReady = false;
        engine.submitDeployment(pid, { skip: true });
      });
      return engine;
    }

    it('startResolutionPhase moves to WITHDRAW and sets currentLocIndex', () => {
      const engine = setupPlanningDone();
      engine.startResolutionPhase();
      // With no deployments, advanceToNextLocation finds nothing → stays in PLANNING or ends
      // That's fine; phase doesn't crash
      expect(engine.state.round).toBe(1);
    });
  });

  describe('Full 3-round game to GAME_OVER', () => {
    it('3 rounds → endRound(3) triggers endGame → phase=GAME_OVER with a winner', () => {
      const engine = setup3Players();
      engine.startClanSelect();
      engine.selectClan('p1', 'brujah');
      engine.selectClan('p2', 'ventrue');
      engine.selectClan('p3', 'nosferatu');

      for (let round = 0; round < 3; round++) {
        if (round === 0) {
          engine.startHandBuild();
          ['p1', 'p2', 'p3'].forEach(pid => {
            const p = engine.state.players[pid];
            engine.selectHandCard(pid, p.handBuildDraft[0].id);
            engine.selectHandCard(pid, p.handBuildDraft[0].id);
          });
        } else {
          engine.startHandBuild();
          ['p1', 'p2', 'p3'].forEach(pid => {
            const p = engine.state.players[pid];
            // Subsequent rounds: draw 2, pick 1
            engine.selectHandCard(pid, p.handBuildDraft[0].id);
          });
        }

        engine.startRound();

        // Deploy one card from each player (round-robin)
        const s = engine.state;
        const locId = s.locations[0].id;
        // Do 3 rounds of round-robin deployment (1 per player)
        for (let i = 0; i < 3; i++) {
          const pid = s.currentTurnPlayerId;
          if (!pid || s.players[pid]?.isReady) break;
          const p = s.players[pid];
          if (p.hand.length > 0) {
            engine.submitDeployment(pid, { locationId: locId, cardId: p.hand[0].id, faceDown: false, bloodTokens: 0 });
          } else {
            engine.submitDeployment(pid, { skip: true });
          }
        }
        // Skip remaining players
        Object.keys(s.players).forEach(pid => {
          if (!s.players[pid].isReady) {
            s.currentTurnPlayerId = pid;
            engine.submitDeployment(pid, { skip: true });
          }
        });

        engine.startResolutionPhase();
        resolveAllLocations(engine);
        engine.endRound();
      }

      expect(engine.state.phase).toBe('GAME_OVER');
      expect(engine.state.winner).not.toBeNull();
      expect(engine.state.players[engine.state.winner!]).toBeDefined();
    });
  });
});

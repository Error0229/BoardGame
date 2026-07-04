/**
 * Integration: endGame / final scoring
 * Tests alliance influence, diablerie deduction, and winner determination.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../gameEngine';
import { makePlayer } from '../helpers';

function setupEngine() {
  const engine = new GameEngine('END');
  engine.state.round = 3; // already at round 3
  return engine;
}

describe('endGame — final scoring', () => {
  it('sets phase to GAME_OVER', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', { influence: 5, diablerie: 0, alliance: [] });
    engine.endGame();
    expect(engine.state.phase).toBe('GAME_OVER');
  });

  it('winner is the player with highest influence', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', { influence: 5, diablerie: 0, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 3, diablerie: 0, alliance: [] });
    engine.endGame();
    expect(engine.state.winner).toBe('p1');
  });

  it('undrained alliance cards add their influence value', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', {
      influence: 3, diablerie: 0,
      alliance: [
        { id: 'a1', name: 'A1', type: 'human', drainBlood: 1, influence: 2, feedBlood: 1, drainInfluence: 0, drained: false },
        { id: 'a2', name: 'A2', type: 'human', drainBlood: 1, influence: 1, feedBlood: 1, drainInfluence: 0, drained: false },
      ],
    });
    engine.state.players['p2'] = makePlayer('p2', { influence: 10, diablerie: 0, alliance: [] });
    engine.endGame();
    // p1: 3 + 2 + 1 = 6
    expect(engine.state.players['p1'].influence).toBe(6);
  });

  it('drained alliance cards add their drainInfluence value (not influence)', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', {
      influence: 4, diablerie: 0,
      alliance: [
        { id: 'a1', name: 'A1', type: 'human', drainBlood: 1, influence: 3, feedBlood: 1, drainInfluence: 1, drained: true },
      ],
    });
    engine.state.players['p2'] = makePlayer('p2', { influence: 10, diablerie: 0, alliance: [] });
    engine.endGame();
    // p1: 4 + 1 (drainInfluence, not 3)
    expect(engine.state.players['p1'].influence).toBe(5);
  });

  it('diablerie tokens reduce final influence', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', { influence: 8, diablerie: 2, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 5, diablerie: 0, alliance: [] });
    engine.endGame();
    // p1: 8 - 2 = 6, p2: 5 → p1 wins
    expect(engine.state.players['p1'].influence).toBe(6);
    expect(engine.state.winner).toBe('p1');
  });

  it('influence cannot go below 0 from diablerie', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', { influence: 2, diablerie: 5, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 0, diablerie: 0, alliance: [] });
    engine.endGame();
    expect(engine.state.players['p1'].influence).toBe(0);
  });

  it('tiebreaker: higher blood wins when influence is tied', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', { influence: 5, blood: 3, diablerie: 0, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 5, blood: 7, diablerie: 0, alliance: [] });
    engine.endGame();
    expect(engine.state.winner).toBe('p2');
  });

  it('winner is set in state.winner', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', { influence: 10, diablerie: 0, alliance: [] });
    engine.endGame();
    expect(engine.state.winner).toBe('p1');
  });

  it('mixed scenario: alliance + diablerie + tiebreaker', () => {
    const engine = setupEngine();
    engine.state.players['p1'] = makePlayer('p1', {
      influence: 4, blood: 6, diablerie: 1,
      alliance: [
        { id: 'a1', name: 'Ally', type: 'vampire', drainBlood: 3, influence: 2, feedBlood: 0, drainInfluence: 0, drained: false },
      ],
    });
    engine.state.players['p2'] = makePlayer('p2', {
      influence: 5, blood: 8, diablerie: 0,
      alliance: [],
    });
    engine.endGame();
    // p1: 4 + 2 (alliance) - 1 (diablerie) = 5
    // p2: 5
    // tie on influence → p2 wins by blood (8 > 6)
    expect(engine.state.players['p1'].influence).toBe(5);
    expect(engine.state.winner).toBe('p2');
  });
});

describe('endRound → endGame at round 3', () => {
  it('endRound after round 3 triggers endGame automatically', () => {
    const engine = new GameEngine('ROUND3');
    engine.state.round = 3;
    engine.state.players['p1'] = makePlayer('p1', { influence: 5, diablerie: 0, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 3, diablerie: 0, alliance: [] });
    // Add some deployed cards for endRound to return to hand
    engine.endRound();
    expect(engine.state.phase).toBe('GAME_OVER');
    expect(engine.state.winner).not.toBeNull();
  });

  it('endRound at round < 3 does NOT trigger endGame', () => {
    const engine = new GameEngine('ROUND2');
    engine.state.round = 2;
    engine.state.players['p1'] = makePlayer('p1', { influence: 5, diablerie: 0, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 3, diablerie: 0, alliance: [] });
    engine.endRound();
    expect(engine.state.phase).toBe('ROUND_END');
    expect(engine.state.winner).toBeNull();
  });

  it('endRound returns deployed cards to players\' hands', () => {
    const engine = new GameEngine('RTRN');
    engine.state.round = 2;
    engine.state.players['p1'] = makePlayer('p1', { influence: 3, diablerie: 0, alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { influence: 3, diablerie: 0, alliance: [] });
    // Manually put a deployment in a location
    const loc = engine.state.locations[0];
    engine.state.deployments[loc.id] = [{
      playerId: 'p1', cardId: 'VE08', faceDown: false, bloodTokens: 0, withdrawn: false, effectivePower: 0,
    }];
    const p1 = engine.state.players['p1'];
    const handBefore = p1.hand.length;
    engine.endRound();
    // VE08 returned to hand
    expect(p1.hand.length).toBe(handBefore + 1);
    expect(p1.hand.some(c => c.id === 'VE08')).toBe(true);
  });
});

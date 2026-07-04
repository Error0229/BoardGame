/**
 * Integration: Multi-location resolution
 * Tests location sequencing, advanceToNextLocation, frenzy elimination.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../gameEngine';
import { makePlayer, makeSlot } from '../helpers';

function setup2() {
  const engine = new GameEngine('MULTI');
  engine.state.round = 1;
  engine.state.players['p1'] = makePlayer('p1', { blood: 10, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10, alliance: [] });
  engine.state.playerOrder = ['p1', 'p2'];
  return engine;
}

function resolveCurrentLoc(engine: GameEngine) {
  const s = engine.state;
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

describe('Multi-location resolution order', () => {
  it('advanceToNextLocation skips locations with no deployments', () => {
    const engine = setup2();
    const s = engine.state;
    // Deploy only at the third location (haven), skip first two
    const havenLoc = s.locations.find(l => l.isPrinces)!;
    s.deployments[havenLoc.id] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR01')];
    s.currentLocIndex = -1;
    engine.advanceToNextLocation();
    const currentLoc = s.locations[s.currentLocIndex];
    expect(currentLoc?.id).toBe(havenLoc.id);
  });

  it('startResolutionPhase starts WITHDRAW at first non-empty location', () => {
    const engine = setup2();
    const s = engine.state;
    const firstLoc = s.locations[0];
    s.deployments[firstLoc.id] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR01')];
    // Mark all players as ready (as if planning done)
    Object.values(s.players).forEach(p => (p.isReady = true));
    s.currentTurnPlayerId = '';
    engine.startResolutionPhase();
    expect(s.phase).toBe('WITHDRAW');
    expect(s.locations[s.currentLocIndex].id).toBe(firstLoc.id);
  });

  it('resolves 2 locations in order, accumulates results in lastConflictResults', () => {
    const engine = setup2();
    const s = engine.state;
    const [loc0, loc1] = s.locations;
    s.deployments[loc0.id] = [makeSlot('p1', 'VE08')];
    s.deployments[loc1.id] = [makeSlot('p2', 'BR01')];
    s.currentLocIndex = -1;
    engine.advanceToNextLocation();
    resolveCurrentLoc(engine);
    expect(s.lastConflictResults.length).toBe(1);
    expect(s.lastConflictResults[0].locationId).toBe(loc0.id);

    // Now at loc1
    resolveCurrentLoc(engine);
    expect(s.lastConflictResults.length).toBe(2);
    expect(s.lastConflictResults[1].locationId).toBe(loc1.id);
  });

  it('after all locations resolved, phase stays not PLANNING (no more WITHDRAW)', () => {
    const engine = setup2();
    const s = engine.state;
    const firstLoc = s.locations[0];
    s.deployments[firstLoc.id] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR01')];
    s.currentLocIndex = -1;
    engine.advanceToNextLocation();
    resolveCurrentLoc(engine);
    // No more deployments → advanceToNextLocation does nothing
    expect(s.phase).not.toBe('PLANNING');
  });

  it('hasMoreLocations returns false when only empty locations remain', () => {
    const engine = setup2();
    const s = engine.state;
    s.currentLocIndex = s.locations.length - 1; // at last
    // no deployments anywhere
    expect(engine.hasMoreLocations()).toBe(false);
  });

  it('hasMoreLocations returns true when a later location has deployments', () => {
    const engine = setup2();
    const s = engine.state;
    const lastLoc = s.locations[s.locations.length - 1];
    s.deployments[lastLoc.id] = [makeSlot('p1', 'VE08')];
    s.currentLocIndex = 0;
    expect(engine.hasMoreLocations()).toBe(true);
  });
});

describe('Frenzy and elimination', () => {
  it('player reaching blood=0 with no alliance triggers frenzy (bank blood, lose influence)', () => {
    const engine = setup2();
    engine.state.players['p1'].blood = 1;
    engine.state.players['p1'].alliance = [];
    engine.state.players['p1'].influence = 3;
    // Empty victimDeck so 2nd-place prize doesn't add a drainable ally
    engine.state.victimDeck = [];
    const s = engine.state;
    const firstLoc = s.locations[0];
    // BR07 steals 1 blood from p1 → p1 hits 0
    s.deployments[firstLoc.id] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR07')];
    s.currentLocIndex = -1;
    engine.advanceToNextLocation();
    // submit stay
    Object.keys(s.players).forEach(pid => engine.submitWithdraw(pid, firstLoc.id, false));
    engine.setupPendingChoices();
    engine.resolveCurrentLocation();
    // After resolution, p1 lost 1 blood to BR07, now 0 → checkFrenzy triggers
    // frenzy: no alliance → bank=1 blood, -1 influence
    expect(engine.state.players['p1'].blood).toBe(1);    // got bank blood
    expect(engine.state.players['p1'].influence).toBe(2); // lost 1
  });

  it('player with diablerie=3 gets eliminated', () => {
    const engine = setup2();
    const s = engine.state;
    // Empty prizes so no victim ally is added before checkFrenzy
    s.victimDeck = [];
    s.locationAllies = Object.fromEntries(s.locations.map(l => [l.id, null]));
    s.players['p1'].blood = 1;
    s.players['p1'].diablerie = 2; // one more frenzy drain → diablerie=3 → eliminated
    s.players['p1'].alliance = [
      { id: 'v1', name: 'Vamp', type: 'vampire', drainBlood: 2, influence: 1, feedBlood: 0, drainInfluence: 0, drained: false },
    ];
    const firstLoc = s.locations[0];
    // BR07 steals p1's 1 blood → p1=0 → frenzy → drains vampire → diablerie=3 → eliminated
    s.deployments[firstLoc.id] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR07')];
    s.currentLocIndex = -1;
    engine.advanceToNextLocation();
    Object.keys(s.players).forEach(pid => engine.submitWithdraw(pid, firstLoc.id, false));
    engine.setupPendingChoices();
    engine.resolveCurrentLocation();
    expect(s.players['p1']).toBeUndefined();
  });

  it('only 1 player left after elimination → phase=GAME_OVER', () => {
    const engine = setup2();
    const s = engine.state;
    s.victimDeck = [];
    s.locationAllies = Object.fromEntries(s.locations.map(l => [l.id, null]));
    s.players['p1'].blood = 1;
    s.players['p1'].diablerie = 2;
    s.players['p1'].alliance = [
      { id: 'v1', name: 'Vamp', type: 'vampire', drainBlood: 2, influence: 1, feedBlood: 0, drainInfluence: 0, drained: false },
    ];
    const firstLoc = s.locations[0];
    s.deployments[firstLoc.id] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR07')];
    s.currentLocIndex = -1;
    engine.advanceToNextLocation();
    Object.keys(s.players).forEach(pid => engine.submitWithdraw(pid, firstLoc.id, false));
    engine.setupPendingChoices();
    engine.resolveCurrentLocation();
    expect(s.phase).toBe('GAME_OVER');
  });
});

describe('Withdraw mechanics', () => {
  it('withdrawing player gets blood tokens back', () => {
    const engine = setup2();
    const s = engine.state;
    const firstLoc = s.locations.find(l => !l.isPrinces)!;
    const slot = makeSlot('p1', 'VE08', { bloodTokens: 3 });
    s.deployments[firstLoc.id] = [slot, makeSlot('p2', 'BR01')];
    s.currentLocIndex = s.locations.indexOf(firstLoc);
    s.phase = 'WITHDRAW';
    Object.values(s.players).forEach(p => (p.isReady = false));
    s.deployments[firstLoc.id].forEach(sl => { if (!sl.playerId) return; });
    // Auto-ready players without deployment
    engine.submitWithdraw('p1', firstLoc.id, true);
    engine.submitWithdraw('p2', firstLoc.id, false);
    const bloodBefore = s.players['p1'].blood;
    engine.applyWithdrawals();
    expect(s.players['p1'].blood).toBe(bloodBefore + 3);
    expect(slot.withdrawn).toBe(true);
  });

  it('withdrawn slots do not participate in conflict', () => {
    const engine = setup2();
    const s = engine.state;
    const firstLoc = s.locations.find(l => !l.isPrinces)!;
    // p1 has BR01 (power=6) but withdraws; p2 has VE08 (power=2)
    s.deployments[firstLoc.id] = [
      makeSlot('p1', 'BR01', { bloodTokens: 0 }),
      makeSlot('p2', 'VE08'),
    ];
    s.currentLocIndex = s.locations.indexOf(firstLoc);
    s.phase = 'WITHDRAW';
    Object.values(s.players).forEach(p => (p.isReady = false));
    engine.submitWithdraw('p1', firstLoc.id, true);
    engine.submitWithdraw('p2', firstLoc.id, false);
    engine.applyWithdrawals();
    engine.setupPendingChoices();
    const result = engine.resolveCurrentLocation();
    // p1 withdrew → p2 should win unopposed
    expect(result.winner).toBe('p2');
  });
});

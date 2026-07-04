/**
 * Tests for planning-phase passive triggers inside submitDeployment:
 * GA06 (On the Prowl), NO03 (Eyes in the Dark), BR03 (Challenge).
 * Also tests TR04 Dark Pact blood-redirect during planning cost.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

const LOC = 'rack';
const OTHER_LOC = 'asylum';

function setup2() {
  const engine = new GameEngine('PLAN');
  engine.state.phase = 'PLANNING';
  engine.state.players['p1'] = makePlayer('p1', { blood: 10, alliance: [], deploymentsLeft: 3, isReady: false });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10, alliance: [], deploymentsLeft: 3, isReady: false });
  engine.state.playerOrder = ['p1', 'p2'];
  engine.state.currentTurnPlayerId = 'p1';
  // Give p1 a card in hand
  engine.state.players['p1'].hand = [
    { id: 'VE08', name_en: 'Ready', name_zh: '備戰', clan: 'ventrue', type: 'conflict', power: 2, is_starter: true },
    { id: 'BR01', name_en: 'Bloody Fury', name_zh: '血腥狂怒', clan: 'brujah', type: 'conflict', power: 6, is_starter: false },
    { id: 'BR09', name_en: 'Hunt', name_zh: '狩獵', clan: 'brujah', type: 'aftermath', power: 0, is_starter: true },
  ];
  engine.state.players['p2'].hand = [
    { id: 'VE08', name_en: 'Ready', name_zh: '備戰', clan: 'ventrue', type: 'conflict', power: 2, is_starter: true },
  ];
  return engine;
}

describe('GA06 徘徊狩獵 — 對手在此地點出牌時 +1 血液代幣', () => {
  it('對手在 GA06 所在地點出牌：+1 代幣', () => {
    const engine = setup2();
    const ga06Slot = makeSlot('p2', 'GA06', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[LOC] = [ga06Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(ga06Slot.bloodTokens).toBe(1);
  });

  it('GA06 面朝下：不觸發', () => {
    const engine = setup2();
    const ga06Slot = makeSlot('p2', 'GA06', { bloodTokens: 0, faceDown: true });
    engine.state.deployments[LOC] = [ga06Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(ga06Slot.bloodTokens).toBe(0);
  });

  it('自己在自己的 GA06 所在地點出牌：不觸發', () => {
    const engine = setup2();
    const ga06Slot = makeSlot('p1', 'GA06', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[LOC] = [ga06Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(ga06Slot.bloodTokens).toBe(0); // own card, no trigger
  });

  it('對手在不同地點出牌：GA06 不觸發', () => {
    const engine = setup2();
    const ga06Slot = makeSlot('p2', 'GA06', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[OTHER_LOC] = [ga06Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(ga06Slot.bloodTokens).toBe(0);
  });

  it('每次出牌各觸發一次', () => {
    const engine = setup2();
    const ga06Slot = makeSlot('p2', 'GA06', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[LOC] = [ga06Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(ga06Slot.bloodTokens).toBe(1);
    // p2 turn now; switch back to p1 artificially for a second deploy
    engine.state.currentTurnPlayerId = 'p1';
    engine.state.players['p1'].isReady = false;
    engine.state.players['p1'].deploymentsLeft = 1;
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'BR01', faceDown: false, bloodTokens: 0 });
    expect(ga06Slot.bloodTokens).toBe(2);
  });
});

describe('NO03 暗中眼目 — 對手在此地點出牌強制面朝下 +1 代幣', () => {
  it('對手出牌：強制面朝下，NO03 得 +1 代幣', () => {
    const engine = setup2();
    const no03Slot = makeSlot('p2', 'NO03', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[LOC] = [no03Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    const newSlot = engine.state.deployments[LOC].find(sl => sl.cardId === 'VE08' && sl.playerId === 'p1');
    expect(newSlot?.faceDown).toBe(true);
    expect(no03Slot.bloodTokens).toBe(1);
  });

  it('NO03 面朝下：不觸發', () => {
    const engine = setup2();
    const no03Slot = makeSlot('p2', 'NO03', { bloodTokens: 0, faceDown: true });
    engine.state.deployments[LOC] = [no03Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    const newSlot = engine.state.deployments[LOC].find(sl => sl.cardId === 'VE08' && sl.playerId === 'p1');
    expect(newSlot?.faceDown).toBe(false); // not forced
    expect(no03Slot.bloodTokens).toBe(0);
  });

  it('自己在 NO03 地點出牌：不觸發', () => {
    const engine = setup2();
    // p1 owns NO03
    engine.state.players['p1'].hand.push({ id: 'NO03', name_en: 'Eyes', name_zh: '暗中眼目', clan: 'nosferatu', type: 'passive', power: 2, is_starter: false });
    const no03Slot = makeSlot('p1', 'NO03', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[LOC] = [no03Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(no03Slot.bloodTokens).toBe(0);
  });
});

describe('BR03 挑戰宣言 — 對手在不同地點出牌時失去 1 血', () => {
  it('對手在不同地點出牌：失去 1 血', () => {
    const engine = setup2();
    const br03Slot = makeSlot('p2', 'BR03', { faceDown: false });
    engine.state.deployments[OTHER_LOC] = [br03Slot];
    const bloodBefore = engine.state.players['p1'].blood;
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(engine.state.players['p1'].blood).toBe(bloodBefore - 1);
  });

  it('對手在相同地點出牌：不觸發', () => {
    const engine = setup2();
    const br03Slot = makeSlot('p2', 'BR03', { faceDown: false });
    engine.state.deployments[LOC] = [br03Slot];
    const bloodBefore = engine.state.players['p1'].blood;
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(engine.state.players['p1'].blood).toBe(bloodBefore);
  });

  it('BR03 面朝下：不觸發', () => {
    const engine = setup2();
    const br03Slot = makeSlot('p2', 'BR03', { faceDown: true });
    engine.state.deployments[OTHER_LOC] = [br03Slot];
    const bloodBefore = engine.state.players['p1'].blood;
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(engine.state.players['p1'].blood).toBe(bloodBefore);
  });

  it('出牌者血量為 0：不扣（不低於 0）', () => {
    const engine = setup2();
    engine.state.players['p1'].blood = 0;
    const br03Slot = makeSlot('p2', 'BR03', { faceDown: false });
    engine.state.deployments[OTHER_LOC] = [br03Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 0 });
    expect(engine.state.players['p1'].blood).toBe(0);
  });
});

describe('TR04 黑暗契約 — 出牌費用重導向至 TR04 所在地點', () => {
  it('面朝下出牌費用（1 血）重導向至 TR04 slot', () => {
    const engine = setup2();
    engine.state.players['p1'].clan = 'tremere'; // non-nosferatu clan
    const tr04Slot = makeSlot('p1', 'TR04', { bloodTokens: 0, faceDown: false });
    // TR04 is at OTHER_LOC; player deploys at LOC face-down
    engine.state.deployments[OTHER_LOC] = [tr04Slot];
    const bloodBefore = engine.state.players['p1'].blood;
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: true, bloodTokens: 0 });
    // Blood is deducted normally, TR04 slot gets the tokens
    expect(engine.state.players['p1'].blood).toBe(bloodBefore - 1);
    expect(tr04Slot.bloodTokens).toBe(1);
  });

  it('血液代幣費用也重導向', () => {
    const engine = setup2();
    const tr04Slot = makeSlot('p1', 'TR04', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[OTHER_LOC] = [tr04Slot];
    const bloodBefore = engine.state.players['p1'].blood;
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 2 });
    expect(engine.state.players['p1'].blood).toBe(bloodBefore - 2);
    expect(tr04Slot.bloodTokens).toBe(2);
  });

  it('TR04 在同一地點：不觸發（只轉移到其他地點的 TR04）', () => {
    const engine = setup2();
    const tr04Slot = makeSlot('p1', 'TR04', { bloodTokens: 0, faceDown: false });
    engine.state.deployments[LOC] = [tr04Slot];
    engine.submitDeployment('p1', { locationId: LOC, cardId: 'VE08', faceDown: false, bloodTokens: 2 });
    // TR04 is at same location as deployment → no redirect
    expect(tr04Slot.bloodTokens).toBe(0);
  });
});

/**
 * Tests for NO02 (Cloak of Shadows) and NO04 (Feral Whispers)
 * passive effects during applyWithdrawals, plus edge cases for
 * submitWithdraw and applyWithdrawals core behaviour.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

const LOC = 'rack';
const OTHER_LOC = 'asylum';

function setup2(locIndex = 0) {
  const engine = new GameEngine('WD');
  engine.state.round = 1;
  engine.state.players['p1'] = makePlayer('p1', { blood: 10, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10, alliance: [] });
  engine.state.playerOrder = ['p1', 'p2'];
  // Start at locIndex (pointing to LOC = rack = index 0)
  engine.state.currentLocIndex = locIndex;
  engine.state.phase = 'WITHDRAW';
  Object.values(engine.state.players).forEach(p => (p.isReady = false));
  return engine;
}

// Helper: run submitWithdraw for all players then applyWithdrawals
function doWithdraw(engine: GameEngine, locId: string, choices: Record<string, boolean>) {
  Object.entries(choices).forEach(([pid, withdraw]) => {
    engine.submitWithdraw(pid, locId, withdraw);
  });
  engine.applyWithdrawals();
}

describe('submitWithdraw', () => {
  it('只接受當前結算地點的選擇', () => {
    const engine = setup2();
    // currentLocIndex=0 → LOC=rack; 嘗試提交 OTHER_LOC 的選擇
    const s = engine.state;
    const locId = s.locations[s.currentLocIndex].id;
    const wrongLoc = s.locations.find(l => l.id !== locId)!.id;
    s.deployments[locId] = [makeSlot('p1', 'VE08')];
    const result = engine.submitWithdraw('p1', wrongLoc, true);
    expect(result).toBe(false);
  });

  it('無部署的玩家：submitWithdraw 回傳 true，自動 ready', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    s.deployments[locId] = []; // p1 has nothing here
    const result = engine.submitWithdraw('p1', locId, false);
    expect(result).toBe(true);
  });

  it('正常提交：玩家 isReady 變 true', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    s.deployments[locId] = [makeSlot('p1', 'VE08')];
    engine.submitWithdraw('p1', locId, false);
    expect(s.players['p1'].isReady).toBe(true);
  });

  it('allWithdrawSubmitted：全員 ready 才回傳 true', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    s.deployments[locId] = [makeSlot('p1', 'VE08'), makeSlot('p2', 'BR01')];
    engine.submitWithdraw('p1', locId, false);
    expect(engine.allWithdrawSubmitted()).toBe(false);
    engine.submitWithdraw('p2', locId, false);
    expect(engine.allWithdrawSubmitted()).toBe(true);
  });
});

describe('applyWithdrawals — 基本撤退', () => {
  it('撤退：血液代幣歸還，slot 標記 withdrawn', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const slot = makeSlot('p1', 'VE08', { bloodTokens: 3 });
    s.deployments[locId] = [slot, makeSlot('p2', 'BR01')];
    doWithdraw(engine, locId, { p1: true, p2: false });
    expect(slot.withdrawn).toBe(true);
    expect(s.players['p1'].blood).toBe(13); // 10 + 3
  });

  it('留守：slot 不標記 withdrawn', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const slot = makeSlot('p1', 'VE08', { bloodTokens: 2 });
    s.deployments[locId] = [slot];
    doWithdraw(engine, locId, { p1: false, p2: false });
    expect(slot.withdrawn).toBe(false);
    expect(s.players['p1'].blood).toBe(10); // no change
  });

  it('王子之地撤退：牌與血液全部取回', () => {
    const engine = setup2();
    const s = engine.state;
    const havenLoc = s.locations.find(l => l.isPrinces)!;
    const havenIdx = s.locations.indexOf(havenLoc);
    engine.state.currentLocIndex = havenIdx;
    engine.state.phase = 'WITHDRAW';
    Object.values(s.players).forEach(p => (p.isReady = false));
    const slot = makeSlot('p1', 'VE08', { bloodTokens: 5 });
    s.deployments[havenLoc.id] = [slot];
    doWithdraw(engine, havenLoc.id, { p1: true, p2: false });
    expect(slot.withdrawn).toBe(true);
    expect(s.players['p1'].blood).toBe(15); // 10 + 5
  });
});

describe('NO02 陰影斗篷 — 撤退時移至 NO02 所在地點', () => {
  it('有 NO02 在另一地點面朝上：撤退牌移至 NO02 地點', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const otherLocId = s.locations[1].id;
    // p1 has NO02 at otherLoc, and VE08 at locId
    const no02Slot = makeSlot('p1', 'NO02', { faceDown: false });
    const ve08Slot = makeSlot('p1', 'VE08', { bloodTokens: 2 });
    s.deployments[locId] = [ve08Slot, makeSlot('p2', 'BR01')];
    s.deployments[otherLocId] = [no02Slot];
    doWithdraw(engine, locId, { p1: true, p2: false });
    // VE08 should now be at otherLoc (moved, not gone to haven)
    expect(ve08Slot.withdrawn).toBe(true);
    const movedSlot = s.deployments[otherLocId].find(sl => sl.cardId === 'VE08' && sl.playerId === 'p1');
    expect(movedSlot).toBeDefined();
    expect(movedSlot?.bloodTokens).toBe(2);
  });

  it('NO02 面朝下：不觸發，走正常撤退', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const otherLocId = s.locations[1].id;
    const no02Slot = makeSlot('p1', 'NO02', { faceDown: true }); // face-down, inactive
    const ve08Slot = makeSlot('p1', 'VE08', { bloodTokens: 1 });
    s.deployments[locId] = [ve08Slot, makeSlot('p2', 'BR01')];
    s.deployments[otherLocId] = [no02Slot];
    const bloodBefore = s.players['p1'].blood;
    doWithdraw(engine, locId, { p1: true, p2: false });
    // Normal withdraw: goes to haven, blood tokens returned
    expect(s.players['p1'].blood).toBe(bloodBefore + 1);
    const notAtOther = s.deployments[otherLocId].find(sl => sl.cardId === 'VE08' && sl.playerId === 'p1');
    expect(notAtOther).toBeUndefined();
  });

  it('NO02 在同一地點：不重複移動（只有其他地點才觸發）', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const no02Slot = makeSlot('p1', 'NO02', { faceDown: false });
    const ve08Slot = makeSlot('p1', 'VE08', { bloodTokens: 1 });
    s.deployments[locId] = [ve08Slot, no02Slot, makeSlot('p2', 'BR01')];
    const bloodBefore = s.players['p1'].blood;
    doWithdraw(engine, locId, { p1: true, p2: false });
    // NO02 is at same loc as withdrawal → normal withdraw
    expect(s.players['p1'].blood).toBe(bloodBefore + 1);
  });
});

describe('NO04 野性耳語 — 撤退時 +2 血液代幣至 NO04 地點（每張牌）', () => {
  it('撤退 1 張牌：NO04 地點 +2 代幣，血液代幣歸還資源池', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const otherLocId = s.locations[1].id;
    const no04Slot = makeSlot('p1', 'NO04', { faceDown: false, bloodTokens: 0 });
    const ve08Slot = makeSlot('p1', 'VE08', { bloodTokens: 3 });
    s.deployments[locId] = [ve08Slot, makeSlot('p2', 'BR01')];
    s.deployments[otherLocId] = [no04Slot];
    doWithdraw(engine, locId, { p1: true, p2: false });
    // Blood tokens from VE08 returned to pool
    expect(s.players['p1'].blood).toBe(13); // 10 + 3
    expect(ve08Slot.withdrawn).toBe(true);
    // NO04 slot gets +2 per withdrawn card (1 card → +2)
    expect(no04Slot.bloodTokens).toBe(2);
  });

  it('撤退多張牌：NO04 地點仍只 +2（固定獎勵，非按牌數）', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const otherLocId = s.locations[1].id;
    const no04Slot = makeSlot('p1', 'NO04', { faceDown: false, bloodTokens: 0 });
    const ve08Slot = makeSlot('p1', 'VE08', { bloodTokens: 0 });
    const br01Slot = makeSlot('p1', 'BR01', { bloodTokens: 0 });
    s.deployments[locId] = [ve08Slot, br01Slot, makeSlot('p2', 'MA04')];
    s.deployments[otherLocId] = [no04Slot];
    doWithdraw(engine, locId, { p1: true, p2: false });
    expect(no04Slot.bloodTokens).toBe(2); // flat +2 per withdrawal action, not per card
  });

  it('NO04 面朝下：不觸發，走正常撤退', () => {
    const engine = setup2();
    const s = engine.state;
    const locId = s.locations[0].id;
    const otherLocId = s.locations[1].id;
    const no04Slot = makeSlot('p1', 'NO04', { faceDown: true, bloodTokens: 0 });
    const ve08Slot = makeSlot('p1', 'VE08', { bloodTokens: 1 });
    s.deployments[locId] = [ve08Slot, makeSlot('p2', 'BR01')];
    s.deployments[otherLocId] = [no04Slot];
    doWithdraw(engine, locId, { p1: true, p2: false });
    expect(no04Slot.bloodTokens).toBe(0); // no trigger
  });
});

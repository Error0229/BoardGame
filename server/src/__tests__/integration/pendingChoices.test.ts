/**
 * Integration: Pending choices mechanism
 * Tests VE03 (Curfew), VE05 (Mass Manipulation), VE06 (Tyrant's Gaze)
 * which require rivals to make choices before resolution.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../../gameEngine';
import { makePlayer, makeSlot } from '../helpers';

const LOC = 'rack';

function setup2() {
  const engine = new GameEngine('CHOICE');
  engine.state.round = 1;
  engine.state.players['p1'] = makePlayer('p1', { blood: 10, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10, alliance: [] });
  engine.state.currentLocIndex = 0;
  engine.state.locations[0] = engine.state.locations.find(l => l.id === LOC) ?? engine.state.locations[0];
  // Ensure currentLocIndex points to LOC
  const locIdx = engine.state.locations.findIndex(l => l.id === LOC);
  if (locIdx !== -1) engine.state.currentLocIndex = locIdx;
  return engine;
}

function setupAndScan(engine: GameEngine) {
  engine.setupPendingChoices();
  return engine.state.pendingChoices;
}

describe('VE03 宵禁令 — setupPendingChoices', () => {
  it('face-down cards are revealed before pending choices are scanned', () => {
    const engine = setup2();
    const ve03 = makeSlot('p1', 'VE03', { faceDown: true });
    engine.state.deployments[LOC] = [
      ve03,
      makeSlot('p2', 'BR01'),
    ];

    expect(engine.revealLocation(LOC)).toBe(1);
    const choices = setupAndScan(engine);

    expect(ve03.faceDown).toBe(false);
    expect(choices.length).toBe(1);
    expect(choices[0].context.cardId).toBe('VE03');
    expect(choices[0].playerId).toBe('p2');
  });

  it('掃描後為每個對手建立一個 pending choice', () => {
    const engine = setup2();
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE03'),
      makeSlot('p2', 'BR01'),
    ];
    const choices = setupAndScan(engine);
    expect(choices.length).toBe(1);
    expect(choices[0].playerId).toBe('p2');
    expect(choices[0].context.cardId).toBe('VE03');
  });

  it('選擇 lose_blood：對手扣 3 血（在 applyPreparation 結算時讀取）', () => {
    const engine = setup2();
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE03'),
      makeSlot('p2', 'BR01'),
    ];
    setupAndScan(engine);
    // Resolve choice: lose_blood
    engine.applyPendingChoice('choice_0', 'lose_blood');
    // After applyPendingChoice, p2 should have lost 3 blood
    expect(engine.state.players['p2'].blood).toBe(7);
  });

  it('選擇 skip_effects：對手牌的效果被標記跳過', () => {
    const engine = setup2();
    const p2Slot = makeSlot('p2', 'BR01');
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE03'),
      p2Slot,
    ];
    setupAndScan(engine);
    engine.applyPendingChoice('choice_0', 'skip_effects');
    // skipEffects is set on the slot
    const affected = engine.state.deployments[LOC].filter(sl => sl.playerId === 'p2');
    expect(affected.some(sl => sl.skipEffects)).toBe(true);
  });

  it('3 名玩家：為 2 個對手各建立一個 choice', () => {
    const engine = new GameEngine('3P');
    engine.state.round = 1;
    engine.state.players['p1'] = makePlayer('p1', { alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { alliance: [] });
    engine.state.players['p3'] = makePlayer('p3', { alliance: [] });
    const locIdx = engine.state.locations.findIndex(l => l.id === LOC);
    engine.state.currentLocIndex = locIdx;
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE03'),
      makeSlot('p2', 'BR01'),
      makeSlot('p3', 'VE08'),
    ];
    const choices = setupAndScan(engine);
    expect(choices.filter(c => c.context.cardId === 'VE03').length).toBe(2);
  });
});

describe('VE05 大規模操控 — setupPendingChoices', () => {
  it('在此地點有部署的對手各建立一個 choice', () => {
    const engine = setup2();
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE05'),
      makeSlot('p2', 'BR01'),
    ];
    const choices = setupAndScan(engine);
    expect(choices.length).toBe(1);
    expect(choices[0].playerId).toBe('p2');
    expect(choices[0].context.cardId).toBe('VE05');
  });

  it('選擇 lose_blood：對手扣 2 血，持牌者得 2 血', () => {
    const engine = setup2();
    engine.state.players['p1'].blood = 5;
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE05'),
      makeSlot('p2', 'BR01'),
    ];
    setupAndScan(engine);
    engine.applyPendingChoice('choice_0', 'lose_blood');
    expect(engine.state.players['p2'].blood).toBe(8);
    expect(engine.state.players['p1'].blood).toBe(7); // gained 2
  });

  it('選擇 withdraw：對手牌撤退', () => {
    const engine = setup2();
    const p2Slot = makeSlot('p2', 'BR01');
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE05'),
      p2Slot,
    ];
    setupAndScan(engine);
    engine.applyPendingChoice('choice_0', 'withdraw');
    expect(p2Slot.withdrawn).toBe(true);
  });

  it('不在此地點的對手不建立 choice', () => {
    const engine = new GameEngine('3P');
    engine.state.round = 1;
    engine.state.players['p1'] = makePlayer('p1', { alliance: [] });
    engine.state.players['p2'] = makePlayer('p2', { alliance: [] });
    engine.state.players['p3'] = makePlayer('p3', { alliance: [] });
    const locIdx = engine.state.locations.findIndex(l => l.id === LOC);
    engine.state.currentLocIndex = locIdx;
    // p3 does NOT deploy at LOC
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE05'),
      makeSlot('p2', 'BR01'),
    ];
    const choices = setupAndScan(engine);
    const ve05Choices = choices.filter(c => c.context.cardId === 'VE05');
    expect(ve05Choices.every(c => c.playerId !== 'p3')).toBe(true);
  });
});

describe('VE06 暴君凝視 — setupPendingChoices', () => {
  it('對手在此地點有部署：建立 choice', () => {
    const engine = setup2();
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE06'),
      makeSlot('p2', 'BR01', { bloodTokens: 4 }),
    ];
    const choices = setupAndScan(engine);
    expect(choices.length).toBe(1);
    expect(choices[0].context.cardId).toBe('VE06');
  });

  it('選擇 lose_influence：對手失去 1 影響力', () => {
    const engine = setup2();
    engine.state.players['p2'].influence = 3;
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE06'),
      makeSlot('p2', 'BR01', { bloodTokens: 2 }),
    ];
    setupAndScan(engine);
    engine.applyPendingChoice('choice_0', 'lose_influence');
    expect(engine.state.players['p2'].influence).toBe(2);
  });

  it('選擇 move_blood：對手部署血液的一半移至持牌者的 slot', () => {
    const engine = setup2();
    const p1Slot = makeSlot('p1', 'VE06', { bloodTokens: 0 });
    const p2Slot = makeSlot('p2', 'BR01', { bloodTokens: 4 });
    engine.state.deployments[LOC] = [p1Slot, p2Slot];
    setupAndScan(engine);
    engine.applyPendingChoice('choice_0', 'move_blood');
    // ceil(4/2) = 2 moves from p2's bloodTokens to p1's slot
    expect(p2Slot.bloodTokens).toBe(2);
    expect(p1Slot.bloodTokens).toBe(2);
  });

  it('對手無部署血液：choice prompt 顯示 0💧', () => {
    const engine = setup2();
    engine.state.deployments[LOC] = [
      makeSlot('p1', 'VE06'),
      makeSlot('p2', 'BR01', { bloodTokens: 0 }),
    ];
    const choices = setupAndScan(engine);
    // Choice should exist but move amount should be 0
    const choice = choices[0];
    expect(choice.options[0].label_zh).toContain('0💧');
  });
});

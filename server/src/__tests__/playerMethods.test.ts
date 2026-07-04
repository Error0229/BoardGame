/**
 * Tests for public player-management and utility methods:
 * addPlayer, removePlayer, setReady, allDeployed, allHandBuilt,
 * allWithdrawSubmitted, drainAlly, handlePlayerLeft.
 */
import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

describe('addPlayer / removePlayer', () => {
  it('addPlayer: 玩家初始化 blood=6, influence=3, 1 Kine 同盟', () => {
    const engine = new GameEngine('TEST');
    engine.addPlayer('p1', 'Alice');
    const p = engine.state.players['p1'];
    expect(p).toBeDefined();
    expect(p.blood).toBe(6);
    expect(p.influence).toBe(3);
    expect(p.alliance.length).toBe(1);
    expect(p.alliance[0].name).toBe('Kine');
  });

  it('addPlayer: 多次呼叫加入多個玩家', () => {
    const engine = new GameEngine('TEST');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    expect(Object.keys(engine.state.players).length).toBe(2);
  });

  it('removePlayer: 玩家從狀態移除', () => {
    const engine = new GameEngine('TEST');
    engine.addPlayer('p1', 'Alice');
    engine.removePlayer('p1');
    expect(engine.state.players['p1']).toBeUndefined();
  });

  it('removePlayer: 移除不存在的玩家不崩潰', () => {
    const engine = new GameEngine('TEST');
    expect(() => engine.removePlayer('nobody')).not.toThrow();
  });
});

describe('setReady', () => {
  it('setReady 將玩家標記為 isReady=true', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: false });
    engine.setReady('p1');
    expect(engine.state.players['p1'].isReady).toBe(true);
  });

  it('不存在的玩家不崩潰', () => {
    const engine = new GameEngine('TEST');
    expect(() => engine.setReady('nobody')).not.toThrow();
  });
});

describe('allDeployed', () => {
  it('全員 isReady：回傳 true', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: true });
    engine.state.players['p2'] = makePlayer('p2', { isReady: true });
    expect(engine.allDeployed()).toBe(true);
  });

  it('有人未 ready：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: true });
    engine.state.players['p2'] = makePlayer('p2', { isReady: false });
    expect(engine.allDeployed()).toBe(false);
  });

  it('無玩家：回傳 true（vacuous truth）', () => {
    const engine = new GameEngine('TEST');
    expect(engine.allDeployed()).toBe(true);
  });
});

describe('allHandBuilt', () => {
  it('全員 isReady：回傳 true', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: true });
    engine.state.players['p2'] = makePlayer('p2', { isReady: true });
    expect(engine.allHandBuilt()).toBe(true);
  });

  it('有人未 ready：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: false });
    expect(engine.allHandBuilt()).toBe(false);
  });
});

describe('allClansSelected', () => {
  it('少於 2 人：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { clan: 'brujah' } as any);
    expect(engine.allClansSelected()).toBe(false);
  });

  it('有人未選氏族：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { clan: 'brujah' } as any);
    engine.state.players['p2'] = makePlayer('p2', { clan: null } as any);
    expect(engine.allClansSelected()).toBe(false);
  });

  it('全員選好：回傳 true', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { clan: 'brujah' } as any);
    engine.state.players['p2'] = makePlayer('p2', { clan: 'ventrue' } as any);
    expect(engine.allClansSelected()).toBe(true);
  });
});

describe('drainAlly', () => {
  it('PLANNING 階段：成功汲取人類同盟，獲得血液', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', {
      blood: 5,
      alliance: [{ id: 'a1', name: 'Human', type: 'human', drainBlood: 3, influence: 1, feedBlood: 1, drainInfluence: 0, drained: false }],
    });
    const result = engine.drainAlly('p1', 'a1');
    expect(result).toBe(true);
    expect(engine.state.players['p1'].blood).toBe(8);
    expect(engine.state.players['p1'].alliance[0].drained).toBe(true);
  });

  it('汲取人類同盟：不加弒親代幣', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', {
      blood: 5,
      alliance: [{ id: 'a1', name: 'Human', type: 'human', drainBlood: 2, influence: 1, feedBlood: 1, drainInfluence: 0, drained: false }],
    });
    engine.drainAlly('p1', 'a1');
    expect(engine.state.players['p1'].diablerie).toBe(0);
  });

  it('汲取吸血鬼同盟：+1 弒親代幣', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', {
      blood: 5,
      diablerie: 0,
      alliance: [{ id: 'v1', name: 'Vamp', type: 'vampire', drainBlood: 2, influence: 1, feedBlood: 0, drainInfluence: 0, drained: false }],
    });
    engine.drainAlly('p1', 'v1');
    expect(engine.state.players['p1'].diablerie).toBe(1);
  });

  it('汲取吸血鬼且弒親達 3：玩家淘汰', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', {
      blood: 5, diablerie: 2,
      alliance: [{ id: 'v1', name: 'Vamp', type: 'vampire', drainBlood: 2, influence: 1, feedBlood: 0, drainInfluence: 0, drained: false }],
    });
    engine.state.players['p2'] = makePlayer('p2', { blood: 10 });
    engine.state.playerOrder = ['p1', 'p2'];
    engine.drainAlly('p1', 'v1');
    expect(engine.state.players['p1']).toBeUndefined();
  });

  it('非 PLANNING 階段：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'REVELATION';
    engine.state.players['p1'] = makePlayer('p1', {
      alliance: [{ id: 'a1', name: 'Human', type: 'human', drainBlood: 2, influence: 1, feedBlood: 1, drainInfluence: 0, drained: false }],
    });
    expect(engine.drainAlly('p1', 'a1')).toBe(false);
  });

  it('已汲取的同盟：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', {
      alliance: [{ id: 'a1', name: 'Human', type: 'human', drainBlood: 2, influence: 1, feedBlood: 1, drainInfluence: 0, drained: true }],
    });
    expect(engine.drainAlly('p1', 'a1')).toBe(false);
  });

  it('不存在的同盟 ID：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', { alliance: [] });
    expect(engine.drainAlly('p1', 'nonexistent')).toBe(false);
  });
});

describe('handlePlayerLeft', () => {
  it('離線玩家從 playerOrder 移除', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1');
    engine.state.players['p2'] = makePlayer('p2');
    engine.state.playerOrder = ['p1', 'p2'];
    engine.handlePlayerLeft('p1');
    expect(engine.state.playerOrder).not.toContain('p1');
    expect(engine.state.playerOrder).toContain('p2');
  });

  it('野心代幣持有者離線：轉讓給下一位', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1');
    engine.state.players['p2'] = makePlayer('p2');
    engine.state.playerOrder = ['p1', 'p2'];
    engine.state.ambitionHolder = 'p1';
    engine.handlePlayerLeft('p1');
    expect(engine.state.ambitionHolder).toBe('p2');
  });

  it('非野心持有者離線：野心代幣不轉讓', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1');
    engine.state.players['p2'] = makePlayer('p2');
    engine.state.playerOrder = ['p1', 'p2'];
    engine.state.ambitionHolder = 'p2';
    engine.handlePlayerLeft('p1');
    expect(engine.state.ambitionHolder).toBe('p2');
  });

  it('輪到離線玩家時 PLANNING 推進下一位', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', { isReady: false, deploymentsLeft: 1 });
    engine.state.players['p2'] = makePlayer('p2', { isReady: false, deploymentsLeft: 1 });
    engine.state.playerOrder = ['p1', 'p2'];
    engine.state.currentTurnPlayerId = 'p1';
    engine.handlePlayerLeft('p1');
    // After p1 leaves, turn should advance to p2
    expect(engine.state.currentTurnPlayerId).toBe('p2');
  });

  it('不是輪到離線玩家：當前回合不變', () => {
    const engine = new GameEngine('TEST');
    engine.state.phase = 'PLANNING';
    engine.state.players['p1'] = makePlayer('p1', { isReady: false, deploymentsLeft: 1 });
    engine.state.players['p2'] = makePlayer('p2', { isReady: false, deploymentsLeft: 1 });
    engine.state.playerOrder = ['p1', 'p2'];
    engine.state.currentTurnPlayerId = 'p1';
    engine.handlePlayerLeft('p2'); // p2 leaves, not current
    expect(engine.state.currentTurnPlayerId).toBe('p1');
  });
});

describe('allWithdrawSubmitted', () => {
  it('全員 isReady：回傳 true', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: true });
    engine.state.players['p2'] = makePlayer('p2', { isReady: true });
    expect(engine.allWithdrawSubmitted()).toBe(true);
  });

  it('有人未 ready：回傳 false', () => {
    const engine = new GameEngine('TEST');
    engine.state.players['p1'] = makePlayer('p1', { isReady: true });
    engine.state.players['p2'] = makePlayer('p2', { isReady: false });
    expect(engine.allWithdrawSubmitted()).toBe(false);
  });
});

describe('getClientState', () => {
  it('面朝下的牌對非擁有者隱藏 cardId', () => {
    const engine = new GameEngine('TEST');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startClanSelect();
    engine.selectClan('p1', 'brujah');
    engine.selectClan('p2', 'ventrue');
    // Manually inject a face-down deployment
    engine.state.deployments[engine.state.locations[0].id] = [
      { playerId: 'p1', cardId: 'BR01', faceDown: true, bloodTokens: 0, withdrawn: false, effectivePower: 0 },
    ];
    const state = engine.getClientState('p2'); // p2 views
    const hiddenSlot = state.deployments[engine.state.locations[0].id]?.[0];
    expect(hiddenSlot?.cardId).toBeNull(); // hidden from p2
  });

  it('擁有者可以看到自己的面朝下牌', () => {
    const engine = new GameEngine('TEST');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startClanSelect();
    engine.selectClan('p1', 'brujah');
    engine.selectClan('p2', 'ventrue');
    engine.state.deployments[engine.state.locations[0].id] = [
      { playerId: 'p1', cardId: 'BR01', faceDown: true, bloodTokens: 0, withdrawn: false, effectivePower: 0 },
    ];
    const state = engine.getClientState('p1'); // p1 views own card
    const ownSlot = state.deployments[engine.state.locations[0].id]?.[0];
    expect(ownSlot?.cardId).toBe('BR01');
  });

  it('REVELATION 後所有牌公開', () => {
    const engine = new GameEngine('TEST');
    engine.addPlayer('p1', 'Alice');
    engine.addPlayer('p2', 'Bob');
    engine.startClanSelect();
    engine.selectClan('p1', 'brujah');
    engine.selectClan('p2', 'ventrue');
    engine.state.phase = 'REVELATION';
    engine.state.deployments[engine.state.locations[0].id] = [
      { playerId: 'p1', cardId: 'BR01', faceDown: true, bloodTokens: 0, withdrawn: false, effectivePower: 0 },
    ];
    const state = engine.getClientState('p2');
    const slot = state.deployments[engine.state.locations[0].id]?.[0];
    expect(slot?.cardId).toBe('BR01'); // revealed
  });
});

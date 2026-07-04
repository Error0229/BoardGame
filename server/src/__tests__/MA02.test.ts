import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

const LOC_ID = 'rack'; // 使用第一個地點

function setupEngine(players: { id: string; blood: number }[], bids: Record<string, number>, holderPlayerId: string) {
  const engine = new GameEngine('TEST');
  const s = engine.state;

  // 注入玩家
  for (const { id, blood } of players) {
    s.players[id] = makePlayer(id, { blood, name: id });
    s.playerOrder.push(id);
  }

  // 持牌者部署 MA02（面朝上）
  s.deployments[LOC_ID] = [
    makeSlot(holderPlayerId, 'MA02'),
    // 其他玩家各部署一張普通牌（用 MA01 代替）
    ...players.filter(p => p.id !== holderPlayerId).map(p => makeSlot(p.id, 'MA01')),
  ];

  // 注入出價
  for (const [pid, bid] of Object.entries(bids)) {
    s.resolvedChoices[`MA02:${LOC_ID}:${pid}`] = `bid_${bid}`;
  }

  s.currentLocIndex = s.locations.findIndex(l => l.id === LOC_ID);
  s.forestallImmune = {};

  return engine;
}

function resolveLocation(engine: GameEngine) {
  const s = engine.state;
  const loc = s.locations.find(l => l.id === LOC_ID)!;
  return (engine as any).resolveLocation(loc);
}

describe('MA02 血液拍賣', () => {
  describe('三人出價：1出2、2出3、3出4', () => {
    let engine: GameEngine;

    beforeEach(() => {
      engine = setupEngine(
        [{ id: '1', blood: 10 }, { id: '2', blood: 10 }, { id: '3', blood: 10 }],
        { '1': 2, '2': 3, '3': 4 },
        '2', // 玩家2 持牌
      );
    });

    it('最低出價者（玩家1）出價退回，不扣出價金額', () => {
      resolveLocation(engine);
      expect(engine.state.players['1'].blood).toBe(10 - 1); // 只扣翻牌費 1
    });

    it('最低出價者（玩家1）的牌被翻至面朝下', () => {
      resolveLocation(engine);
      const slot = engine.state.deployments[LOC_ID].find(sl => sl.playerId === '1');
      expect(slot?.faceDown).toBe(true);
    });

    it('持牌者（玩家2）出價血液部署至地點', () => {
      resolveLocation(engine);
      const slot = engine.state.deployments[LOC_ID].find(sl => sl.playerId === '2' && sl.cardId === 'MA02');
      expect(slot?.bloodTokens).toBe(3);
      expect(engine.state.players['2'].blood).toBe(10 - 3);
    });

    it('對手（玩家3）出價血液消耗', () => {
      resolveLocation(engine);
      expect(engine.state.players['3'].blood).toBe(10 - 4);
    });
  });

  describe('最低出價者無牌可翻', () => {
    it('無牌可翻時不扣血', () => {
      const engine = setupEngine(
        [{ id: '1', blood: 10 }, { id: '2', blood: 10 }],
        { '1': 1, '2': 3 },
        '2',
      );
      // 把玩家1的牌設為面朝下，讓他沒有面朝上的牌可翻
      engine.state.deployments[LOC_ID].find(sl => sl.playerId === '1')!.faceDown = true;

      resolveLocation(engine);
      expect(engine.state.players['1'].blood).toBe(10); // 出價退回且無牌可翻，不扣血
    });
  });

  describe('平手最低出價', () => {
    it('兩人同時出價最低，兩人都被翻牌扣血', () => {
      const engine = setupEngine(
        [{ id: '1', blood: 10 }, { id: '2', blood: 10 }, { id: '3', blood: 10 }],
        { '1': 2, '2': 2, '3': 5 },
        '3',
      );
      resolveLocation(engine);
      expect(engine.state.players['1'].blood).toBe(10 - 1);
      expect(engine.state.players['2'].blood).toBe(10 - 1);
    });
  });

  describe('血量邊界', () => {
    it('血量不足時不會低於 0', () => {
      const engine = setupEngine(
        [{ id: '1', blood: 0 }, { id: '2', blood: 10 }],
        { '1': 2, '2': 5 },
        '2',
      );
      resolveLocation(engine);
      expect(engine.state.players['1'].blood).toBe(0);
    });
  });
});

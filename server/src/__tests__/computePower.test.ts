import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { SlotFull } from '@kindred/shared';
import { makePlayer, makeSlot } from './helpers';

const LOC = 'rack';

function cp(engine: GameEngine, slot: SlotFull, allActive: SlotFull[], locId = LOC) {
  const player = engine.state.players[slot.playerId];
  return (engine as any).computePower(slot, allActive, player, locId);
}

function setup(playerBlood = 10) {
  const engine = new GameEngine('TEST');
  engine.state.players['p1'] = makePlayer('p1', { blood: playerBlood, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10 });
  return engine;
}

describe('computePower', () => {
  describe('基礎', () => {
    it('無血液代幣：回傳卡牌印刷戰力', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE08'); // power=2, no special logic
      expect(cp(engine, slot, [slot])).toBe(2);
    });

    it('血液代幣加算入戰力', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE08', { bloodTokens: 3 }); // power=2 + 3 tokens
      expect(cp(engine, slot, [slot])).toBe(5);
    });

    it('被動牌面朝下只計血液代幣', () => {
      const engine = setup();
      // VE01 is passive, power=3
      const slot = makeSlot('p1', 'VE01', { faceDown: true, bloodTokens: 2 });
      expect(cp(engine, slot, [slot])).toBe(2); // only bloodTokens when face-down passive
    });
  });

  describe('BR01 血腥狂怒 — 有血液代幣時 -2', () => {
    // power=6
    it('無血液代幣：不扣', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'BR01', { bloodTokens: 0 });
      expect(cp(engine, slot, [slot])).toBe(6);
    });

    it('有血液代幣：-2（power 6-2=4 + tokens）', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'BR01', { bloodTokens: 1 });
      expect(cp(engine, slot, [slot])).toBe(5); // 6-2+1=5
    });

    it('blood token 多：-2 但 token 補回', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'BR01', { bloodTokens: 3 });
      expect(cp(engine, slot, [slot])).toBe(7); // 6-2+3=7
    });
  });

  describe('BR02 龐克幫眾 — +2 per 自己部署牌', () => {
    // power=0
    it('只有自己一張牌：+2', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'BR02');
      expect(cp(engine, slot, [slot])).toBe(2); // 0 + 2*1
    });

    it('自己有兩張牌：+4', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'BR02');
      const slot2 = makeSlot('p1', 'VE08');
      expect(cp(engine, slot, [slot, slot2])).toBe(4); // 0 + 2*2
    });

    it('對手牌不算', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'BR02');
      const rival = makeSlot('p2', 'VE08');
      expect(cp(engine, slot, [slot, rival])).toBe(2); // only p1's 1 slot
    });
  });

  describe('GA03 野性武器 — 同陣營血液代幣 ×2', () => {
    // GA03 power=1
    it('有 GA03 在同陣營：其他牌血液代幣翻倍', () => {
      const engine = setup();
      const gaSlot = makeSlot('p1', 'GA03', { bloodTokens: 0 });
      const slot = makeSlot('p1', 'VE08', { bloodTokens: 3 }); // power=2 + 3*2=8
      expect(cp(engine, slot, [gaSlot, slot])).toBe(8);
    });

    it('GA03 本身也翻倍自己的血液代幣', () => {
      const engine = setup();
      const gaSlot = makeSlot('p1', 'GA03', { bloodTokens: 2 }); // power=1 + 2*2=5
      expect(cp(engine, gaSlot, [gaSlot])).toBe(5);
    });

    it('無 GA03：血液代幣 ×1', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE08', { bloodTokens: 3 }); // power=2 + 3=5
      expect(cp(engine, slot, [slot])).toBe(5);
    });
  });

  describe('MA04 暗影突擊 — 面朝上牌最少時 +2', () => {
    // power=3
    it('自己面朝上牌數少於對手：+2', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA04', { faceDown: false }); // p1: 1
      const r1 = makeSlot('p2', 'VE08', { faceDown: false });   // p2: 1
      const r2 = makeSlot('p2', 'BR01', { faceDown: false });   // p2: 2 → p1 is min
      expect(cp(engine, slot, [slot, r1, r2])).toBe(5); // 3+2
    });

    it('兩邊相等：+2（<=min）', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA04', { faceDown: false }); // p1: 1
      const rival = makeSlot('p2', 'VE08', { faceDown: false }); // p2: 1
      expect(cp(engine, slot, [slot, rival])).toBe(5); // 3+2, tied = still gets bonus
    });

    it('自己面朝上牌多於對手：不加', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA04', { faceDown: false });
      const s2 = makeSlot('p1', 'BR01', { faceDown: false }); // p1: 2
      const rival = makeSlot('p2', 'VE08', { faceDown: false }); // p2: 1
      expect(cp(engine, slot, [slot, s2, rival])).toBe(3); // no bonus
    });
  });

  describe('MA07 無腦衝擊 — 面朝下時戰力固定 4', () => {
    // power=3
    it('面朝下：戰力 = 4', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA07', { faceDown: true, bloodTokens: 0 });
      expect(cp(engine, slot, [slot])).toBe(4);
    });

    it('面朝下有血液代幣：固定 4 + 血液代幣', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA07', { faceDown: true, bloodTokens: 2 });
      expect(cp(engine, slot, [slot])).toBe(6); // 4 + 2 tokens
    });

    it('面朝上：正常計算 power=3', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA07', { faceDown: false, bloodTokens: 0 });
      expect(cp(engine, slot, [slot])).toBe(3);
    });
  });

  describe('MA08 備戰 — +1 per 自己部署牌', () => {
    // power=0
    it('自己一張牌：+1', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA08');
      expect(cp(engine, slot, [slot])).toBe(1); // 0+1
    });

    it('自己兩張牌：+2', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA08');
      const slot2 = makeSlot('p1', 'VE08');
      expect(cp(engine, slot, [slot, slot2])).toBe(2); // 0+2
    });

    it('對手牌不算', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'MA08');
      const rival = makeSlot('p2', 'VE08');
      expect(cp(engine, slot, [slot, rival])).toBe(1);
    });
  });

  describe('NO08 備戰 — 在王子避難所 +2', () => {
    // power=1
    it('在 haven：+2', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'NO08');
      expect(cp(engine, slot, [slot], 'haven')).toBe(3); // 1+2
    });

    it('不在 haven：無加成', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'NO08');
      expect(cp(engine, slot, [slot], 'rack')).toBe(1);
    });
  });

  describe('TO02 隨從群 — +1 per 同盟牌（最多 7）', () => {
    // power=0
    it('3 張同盟：+3', () => {
      const engine = setup();
      engine.state.players['p1'].alliance = Array.from({ length: 3 }, (_, i) => ({
        id: `a${i}`, name: `A${i}`, type: 'human' as const, drainBlood: 1, influence: 1, drained: false,
      }));
      const slot = makeSlot('p1', 'TO02');
      expect(cp(engine, slot, [slot])).toBe(3);
    });

    it('8 張同盟：上限 7', () => {
      const engine = setup();
      engine.state.players['p1'].alliance = Array.from({ length: 8 }, (_, i) => ({
        id: `a${i}`, name: `A${i}`, type: 'human' as const, drainBlood: 1, influence: 1, drained: false,
      }));
      const slot = makeSlot('p1', 'TO02');
      expect(cp(engine, slot, [slot])).toBe(7);
    });

    it('無同盟：戰力 0', () => {
      const engine = setup();
      engine.state.players['p1'].alliance = [];
      const slot = makeSlot('p1', 'TO02');
      expect(cp(engine, slot, [slot])).toBe(0);
    });
  });

  describe('TO05 魅惑 — +1 per 所有部署牌', () => {
    // power=0
    it('場上 3 張牌：+3', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'TO05');
      const s2 = makeSlot('p2', 'VE08');
      const s3 = makeSlot('p2', 'BR01');
      expect(cp(engine, slot, [slot, s2, s3])).toBe(3); // 0+3
    });

    it('只有自己：+1', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'TO05');
      expect(cp(engine, slot, [slot])).toBe(1);
    });
  });

  describe('TR01 飢餓中的專注 — 戰力 = 9 - 資源池血液', () => {
    // base power=9, overridden to max(0, 9 - blood)
    it('血液 3：戰力 = 6', () => {
      const engine = setup(3);
      const slot = makeSlot('p1', 'TR01');
      expect(cp(engine, slot, [slot])).toBe(6);
    });

    it('血液 9：戰力 = 0', () => {
      const engine = setup(9);
      const slot = makeSlot('p1', 'TR01');
      expect(cp(engine, slot, [slot])).toBe(0);
    });

    it('血液超過 9：戰力不低於 0', () => {
      const engine = setup(15);
      const slot = makeSlot('p1', 'TR01');
      expect(cp(engine, slot, [slot])).toBe(0);
    });

    it('血液 0：戰力最大 9', () => {
      const engine = setup(0);
      const slot = makeSlot('p1', 'TR01');
      expect(cp(engine, slot, [slot])).toBe(9);
    });
  });

  describe('VE04 威嚴 — 等於場上最高印刷戰力', () => {
    // power=0
    it('場上最高印刷戰力為 6 (BR01)：戰力 = 6', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE04');
      const rival = makeSlot('p2', 'BR01'); // power=6
      expect(cp(engine, slot, [slot, rival])).toBe(6);
    });

    it('只有自己 VE04：戰力 = 0', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE04');
      expect(cp(engine, slot, [slot])).toBe(0);
    });
  });

  describe('VE01 主謀計劃 — +1 per 對手在此地點', () => {
    // power=3
    it('1 個對手：+1', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE01');
      const rival = makeSlot('p2', 'VE08');
      expect(cp(engine, slot, [slot, rival])).toBe(4); // 3+1
    });

    it('2 個對手（不同玩家）：+2', () => {
      const engine = setup();
      engine.state.players['p3'] = makePlayer('p3', { blood: 10 });
      const slot = makeSlot('p1', 'VE01');
      const r1 = makeSlot('p2', 'VE08');
      const r2 = makeSlot('p3', 'BR01');
      expect(cp(engine, slot, [slot, r1, r2])).toBe(5); // 3+2
    });

    it('無對手：不加', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE01');
      expect(cp(engine, slot, [slot])).toBe(3);
    });

    it('同個對手多張牌只算一次', () => {
      const engine = setup();
      const slot = makeSlot('p1', 'VE01');
      const r1 = makeSlot('p2', 'VE08');
      const r2 = makeSlot('p2', 'BR01'); // same p2
      expect(cp(engine, slot, [slot, r1, r2])).toBe(4); // only +1, not +2
    });
  });
});

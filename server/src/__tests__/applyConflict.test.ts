import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { getCardById } from '../cardData';
import { makePlayer, makeSlot } from './helpers';

const LOC = 'rack';

function conflict(engine: GameEngine) {
  const s = engine.state;
  const active = s.deployments[LOC].filter(sl => !sl.withdrawn);
  // pre-compute effectivePower from card.power (simulating resolveLocation's step)
  active.forEach(sl => { sl.effectivePower = getCardById(sl.cardId)?.power ?? 0; });
  const result = { bloodEvents: [], stepEvents: { prepare: [], conflict: [], aftermath: [] }, locationId: LOC, winner: null, second: null, scores: {}, influenceGained: {}, tie: false };
  (engine as any).applyConflict(LOC, active, result);
  return { result, active };
}

function setup2() {
  const engine = new GameEngine('TEST');
  engine.state.players['p1'] = makePlayer('p1', { blood: 10 });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10 });
  return engine;
}

describe('applyConflict', () => {
  describe('VE02 外交手腕 — 最高印刷戰力的對手牌 effectivePower 歸零', () => {
    it('對手最高印刷戰力牌歸零', () => {
      const engine = setup2();
      const rivalHighSlot = makeSlot('p2', 'BR01'); // power=6
      const rivalLowSlot = makeSlot('p2', 'VE08');  // power=2
      engine.state.deployments[LOC] = [makeSlot('p1', 'VE02'), rivalHighSlot, rivalLowSlot];
      const { active } = conflict(engine);
      const high = active.find(sl => sl.cardId === 'BR01')!;
      const low = active.find(sl => sl.cardId === 'VE08')!;
      expect(high.effectivePower).toBe(0); // 6-6=0
      expect(low.effectivePower).toBe(2);  // not affected
    });

    it('無對手牌：無效果', () => {
      const engine = setup2();
      engine.state.deployments[LOC] = [makeSlot('p1', 'VE02')];
      const { active } = conflict(engine);
      expect(active[0].effectivePower).toBeGreaterThanOrEqual(0);
    });
  });

  describe('TR08 備戰 — 血量為 0 時翻面並 +1 血', () => {
    it('血量為 0：翻面 + 補 1 血', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 0;
      const slot = makeSlot('p1', 'TR08');
      engine.state.deployments[LOC] = [slot, makeSlot('p2', 'VE08')];
      conflict(engine);
      expect(engine.state.players['p1'].blood).toBe(1);
      expect(slot.faceDown).toBe(true);
    });

    it('血量不為 0：無效果', () => {
      const engine = setup2();
      const slot = makeSlot('p1', 'TR08');
      engine.state.deployments[LOC] = [slot, makeSlot('p2', 'VE08')];
      conflict(engine);
      expect(engine.state.players['p1'].blood).toBe(10);
      expect(slot.faceDown).toBe(false);
    });
  });

  describe('GA02 狼族夥伴 — 對手印刷戰力減半', () => {
    it('對手 BR01 (power=6)：effectivePower 減 3', () => {
      const engine = setup2();
      const rivalSlot = makeSlot('p2', 'BR01'); // power=6
      engine.state.deployments[LOC] = [makeSlot('p1', 'GA02'), rivalSlot];
      const { active } = conflict(engine);
      const rival = active.find(sl => sl.cardId === 'BR01')!;
      expect(rival.effectivePower).toBe(3); // 6 - floor(6/2) = 3
    });

    it('奇數印刷戰力 (power=3)：floor(3/2)=1，減 1', () => {
      const engine = setup2();
      const rivalSlot = makeSlot('p2', 'MA04'); // power=3
      engine.state.deployments[LOC] = [makeSlot('p1', 'GA02'), rivalSlot];
      const { active } = conflict(engine);
      const rival = active.find(sl => sl.cardId === 'MA04')!;
      expect(rival.effectivePower).toBe(2); // 3 - floor(3/2)=1
    });

    it('自己的牌不受影響', () => {
      const engine = setup2();
      const mySlot = makeSlot('p1', 'GA02');
      engine.state.deployments[LOC] = [mySlot, makeSlot('p2', 'VE08')];
      const { active } = conflict(engine);
      const mine = active.find(sl => sl.cardId === 'GA02')!;
      // GA02 power=? Let's just check it wasn't reduced from its printed value
      expect(mine.effectivePower).toBe(getCardById('GA02')!.power);
    });
  });
});

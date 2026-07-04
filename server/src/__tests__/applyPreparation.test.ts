import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

const LOC = 'rack';

function prep(engine: GameEngine) {
  const s = engine.state;
  const active = s.deployments[LOC].filter(sl => !sl.withdrawn);
  const result = { bloodEvents: [], stepEvents: { prepare: [], conflict: [], aftermath: [] }, locationId: LOC, winner: null, second: null, scores: {}, influenceGained: {}, tie: false };
  (engine as any).applyPreparation(LOC, active, result);
  return { result, active };
}

function setup2() {
  const engine = new GameEngine('TEST');
  engine.state.players['p1'] = makePlayer('p1', { blood: 10, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10, alliance: [] });
  return engine;
}

describe('applyPreparation', () => {
  describe('BR07 展示武力 — 從每個對手偷 1 血', () => {
    it('2 個對手各扣 1，持牌者 +2', () => {
      const engine = setup2();
      engine.state.players['p3'] = makePlayer('p3', { blood: 10 });
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'BR07'),
        makeSlot('p2', 'VE08'),
        makeSlot('p3', 'VE08'),
      ];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(12);
      expect(engine.state.players['p2'].blood).toBe(9);
      expect(engine.state.players['p3'].blood).toBe(9);
    });

    it('對手血液為 0 時不偷', () => {
      const engine = setup2();
      engine.state.players['p2'].blood = 0;
      engine.state.deployments[LOC] = [makeSlot('p1', 'BR07'), makeSlot('p2', 'VE08')];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(10); // nothing to steal
      expect(engine.state.players['p2'].blood).toBe(0);
    });
  });

  describe('GA04 狼群之力 — 奪取對手部署血液的一半（無條件進位）', () => {
    it('對手 3 個部署血液：奪走 2（ceil(3/2)）', () => {
      const engine = setup2();
      const rival = makeSlot('p2', 'VE08', { bloodTokens: 3 });
      engine.state.deployments[LOC] = [makeSlot('p1', 'GA04'), rival];
      prep(engine);
      expect(rival.bloodTokens).toBe(1);
      expect(engine.state.players['p1'].blood).toBe(12);
    });

    it('對手 0 部署血液：不奪', () => {
      const engine = setup2();
      engine.state.deployments[LOC] = [makeSlot('p1', 'GA04'), makeSlot('p2', 'VE08', { bloodTokens: 0 })];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(10);
    });
  });

  describe('GA05 無懼 — 交換部署血液與資源池', () => {
    it('選擇交換：資源池變舊部署值，部署血液變舊資源池，+2', () => {
      const engine = setup2();
      const slot = makeSlot('p1', 'GA05', { bloodTokens: 3 });
      engine.state.deployments[LOC] = [slot];
      // no resolvedChoice → defaults to 'swap'
      prep(engine);
      expect(slot.bloodTokens).toBe(10); // was p1.blood
      expect(engine.state.players['p1'].blood).toBe(5); // was 3 + 2
    });

    it('選擇不交換：維持原狀', () => {
      const engine = setup2();
      engine.state.resolvedChoices[`GA05:${LOC}:p1`] = 'no_swap';
      const slot = makeSlot('p1', 'GA05', { bloodTokens: 3 });
      engine.state.deployments[LOC] = [slot];
      prep(engine);
      expect(slot.bloodTokens).toBe(3);
      expect(engine.state.players['p1'].blood).toBe(10);
    });
  });

  describe('GA08 備戰 — 部署地點 +2 血液代幣', () => {
    it('+2 至部署代幣', () => {
      const engine = setup2();
      const slot = makeSlot('p1', 'GA08', { bloodTokens: 0 });
      engine.state.deployments[LOC] = [slot];
      prep(engine);
      expect(slot.bloodTokens).toBe(2);
    });
  });

  describe('TO03 魅力 — 對手棄置部署血液 = floor(同盟數/2)', () => {
    it('2 個同盟：對手棄置 1', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [
        { id: 'a1', name: 'A1', type: 'human', drainBlood: 1, influence: 1, drained: false },
        { id: 'a2', name: 'A2', type: 'human', drainBlood: 1, influence: 1, drained: false },
      ];
      const rivalSlot = makeSlot('p2', 'VE08', { bloodTokens: 3 });
      engine.state.deployments[LOC] = [makeSlot('p1', 'TO03'), rivalSlot];
      prep(engine);
      expect(rivalSlot.bloodTokens).toBe(2);
    });

    it('1 個同盟：floor(1/2)=0，不棄置', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [{ id: 'a1', name: 'A1', type: 'human', drainBlood: 1, influence: 1, drained: false }];
      const rivalSlot = makeSlot('p2', 'VE08', { bloodTokens: 3 });
      engine.state.deployments[LOC] = [makeSlot('p1', 'TO03'), rivalSlot];
      prep(engine);
      expect(rivalSlot.bloodTokens).toBe(3);
    });
  });

  describe('TR02 古老文物 — 消耗資源池一半（blood >= 2）；否則翻面', () => {
    it('血液 8：消耗 4', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 8;
      engine.state.deployments[LOC] = [makeSlot('p1', 'TR02')];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(4);
    });

    it('血液 1：翻至面朝下', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 1;
      const slot = makeSlot('p1', 'TR02');
      engine.state.deployments[LOC] = [slot];
      prep(engine);
      expect(slot.faceDown).toBe(true);
    });
  });

  describe('TR03 竊取生命力 — 血液補至 7（或 +1 若已 >= 7）', () => {
    it('血液 3：補至 7（+4）', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 3;
      engine.state.deployments[LOC] = [makeSlot('p1', 'TR03')];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(7);
    });

    it('血液 7：+1（= 8）', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 7;
      engine.state.deployments[LOC] = [makeSlot('p1', 'TR03')];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(8);
    });

    it('血液 9：+1（= 10）', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 9;
      engine.state.deployments[LOC] = [makeSlot('p1', 'TR03')];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(10);
    });
  });

  describe('TR07 奧術汲取 — 選擇付一半血，奪取對手部署血液一半', () => {
    it('選擇啟動：付一半血，奪取對手部署一半', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 8;
      engine.state.resolvedChoices[`TR07:${LOC}:p1`] = 'pay';
      const rivalSlot = makeSlot('p2', 'VE08', { bloodTokens: 4 });
      engine.state.deployments[LOC] = [makeSlot('p1', 'TR07'), rivalSlot];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(8 - 4 + 2); // paid 4, gained ceil(4/2)=2
      expect(rivalSlot.bloodTokens).toBe(2);
    });

    it('選擇不啟動：無效果', () => {
      const engine = setup2();
      engine.state.resolvedChoices[`TR07:${LOC}:p1`] = 'skip';
      const rivalSlot = makeSlot('p2', 'VE08', { bloodTokens: 4 });
      engine.state.deployments[LOC] = [makeSlot('p1', 'TR07'), rivalSlot];
      prep(engine);
      expect(engine.state.players['p1'].blood).toBe(10);
      expect(rivalSlot.bloodTokens).toBe(4);
    });
  });

  describe('NO07 消失於影 — 選擇撤退並從每個對手偷 1 血', () => {
    it('選擇撤退：slot.withdrawn=true，偷血', () => {
      const engine = setup2();
      engine.state.resolvedChoices[`NO07:${LOC}:p1`] = 'withdraw_steal';
      const slot = makeSlot('p1', 'NO07');
      engine.state.deployments[LOC] = [slot, makeSlot('p2', 'VE08')];
      prep(engine);
      expect(slot.withdrawn).toBe(true);
      expect(engine.state.players['p1'].blood).toBe(11);
      expect(engine.state.players['p2'].blood).toBe(9);
    });

    it('選擇留守：無效果', () => {
      const engine = setup2();
      engine.state.resolvedChoices[`NO07:${LOC}:p1`] = 'stay';
      const slot = makeSlot('p1', 'NO07');
      engine.state.deployments[LOC] = [slot, makeSlot('p2', 'VE08')];
      prep(engine);
      expect(slot.withdrawn).toBe(false);
      expect(engine.state.players['p1'].blood).toBe(10);
    });
  });

  describe('MA01 催眠操控 — 選擇目標對手，其手牌全部打至此地點', () => {
    it('目標有手牌：全部部署到地點，持牌者持牌者獲得，對手清空', () => {
      const engine = setup2();
      engine.state.players['p2'].hand = [{ id: 'VE08', name_en: 'Ready', name_zh: '備戰', clan: 'ventrue', type: 'conflict', power: 2, is_starter: true }];
      engine.state.players['p2'].handCount = 1;
      engine.state.resolvedChoices[`MA01:${LOC}:p1`] = 'p2';
      engine.state.deployments[LOC] = [makeSlot('p1', 'MA01'), makeSlot('p2', 'VE08')];
      prep(engine);
      expect(engine.state.players['p2'].hand.length).toBe(0);
      expect(engine.state.deployments[LOC].some(sl => sl.cardId === 'VE08' && sl.playerId === 'p1')).toBe(true);
    });

    it('未選擇目標：無效果', () => {
      const engine = setup2();
      engine.state.deployments[LOC] = [makeSlot('p1', 'MA01'), makeSlot('p2', 'VE08')];
      prep(engine);
      expect(engine.state.players['p2'].hand.length).toBe(0); // already 0, no change
    });
  });

  describe('MA03 瘋狂網絡 — 手牌全部打至此地點', () => {
    it('手牌 2 張：全部部署到地點', () => {
      const engine = setup2();
      engine.state.players['p1'].hand = [
        { id: 'VE08', name_en: 'Ready', name_zh: '備戰', clan: 'ventrue', type: 'conflict', power: 2, is_starter: true },
        { id: 'BR01', name_en: 'Bloody Fury', name_zh: '血腥狂怒', clan: 'brujah', type: 'conflict', power: 6, is_starter: true },
      ];
      engine.state.players['p1'].handCount = 2;
      engine.state.deployments[LOC] = [makeSlot('p1', 'MA03')];
      prep(engine);
      expect(engine.state.players['p1'].hand.length).toBe(0);
      expect(engine.state.deployments[LOC].filter(sl => sl.playerId === 'p1').length).toBe(3); // MA03 + 2 cards
    });
  });

  describe('NO05 背刺 — 部署地點 +3 血液代幣', () => {
    it('+3 至部署代幣', () => {
      const engine = setup2();
      const slot = makeSlot('p1', 'NO05', { bloodTokens: 1 });
      engine.state.deployments[LOC] = [slot];
      prep(engine);
      expect(slot.bloodTokens).toBe(4);
    });
  });

  describe('TO07 上層友人 — +1 血液代幣 per 同盟牌', () => {
    it('3 個同盟：+3', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = Array.from({ length: 3 }, (_, i) => ({
        id: `a${i}`, name: `A${i}`, type: 'human' as const, drainBlood: 1, influence: 1, drained: false,
      }));
      const slot = makeSlot('p1', 'TO07', { bloodTokens: 0 });
      engine.state.deployments[LOC] = [slot];
      prep(engine);
      expect(slot.bloodTokens).toBe(3);
    });

    it('無同盟：不加', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [];
      const slot = makeSlot('p1', 'TO07', { bloodTokens: 0 });
      engine.state.deployments[LOC] = [slot];
      prep(engine);
      expect(slot.bloodTokens).toBe(0);
    });
  });

  describe('TO08 備戰 — 抽一張受害者牌入同盟', () => {
    it('受害者牌組有牌：抽入同盟', () => {
      const engine = setup2();
      const origDeckLen = engine.state.victimDeck.length;
      engine.state.deployments[LOC] = [makeSlot('p1', 'TO08')];
      prep(engine);
      expect(engine.state.players['p1'].alliance.length).toBe(1);
      expect(engine.state.victimDeck.length).toBe(origDeckLen - 1);
    });

    it('受害者牌組空：無效果', () => {
      const engine = setup2();
      engine.state.victimDeck = [];
      engine.state.deployments[LOC] = [makeSlot('p1', 'TO08')];
      prep(engine);
      expect(engine.state.players['p1'].alliance.length).toBe(0);
    });
  });

  describe('MA05 混沌 — 選擇收回 N 張部署牌，每張對手各失去 1 血', () => {
    it('收回 1 張：對手失去 1 血，持牌者 +1 血（收回 MA05 本身）', () => {
      const engine = setup2();
      engine.state.resolvedChoices[`MA05:${LOC}:p1`] = '1';
      const ma05Slot = makeSlot('p1', 'MA05');
      engine.state.deployments[LOC] = [ma05Slot, makeSlot('p1', 'VE08'), makeSlot('p2', 'BR01')];
      prep(engine);
      expect(engine.state.players['p2'].blood).toBe(9);
      expect(engine.state.players['p1'].blood).toBe(11);
      expect(ma05Slot.withdrawn).toBe(true); // MA05 itself is the first mySlot
    });

    it('選擇收回 0：無效果', () => {
      const engine = setup2();
      engine.state.resolvedChoices[`MA05:${LOC}:p1`] = '0';
      engine.state.deployments[LOC] = [makeSlot('p1', 'MA05'), makeSlot('p1', 'VE08'), makeSlot('p2', 'BR01')];
      prep(engine);
      expect(engine.state.players['p2'].blood).toBe(10);
    });
  });
});

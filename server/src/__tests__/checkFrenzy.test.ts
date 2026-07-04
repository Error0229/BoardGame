import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

function frenzy(engine: GameEngine, playerId: string) {
  const player = engine.state.players[playerId];
  (engine as any).checkFrenzy(player);
}

function setup2() {
  const engine = new GameEngine('TEST');
  engine.state.players['p1'] = makePlayer('p1', { blood: 0, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: 10 });
  return engine;
}

describe('checkFrenzy', () => {
  describe('血量 > 0：不觸發', () => {
    it('血量 5：無效果', () => {
      const engine = setup2();
      engine.state.players['p1'].blood = 5;
      frenzy(engine, 'p1');
      expect(engine.state.players['p1'].blood).toBe(5);
      expect(engine.state.players['p2'].influence).toBe(0);
    });
  });

  describe('血量 = 0，有人類同盟：汲取回血，對手 +1 影響力', () => {
    it('汲取人類同盟：回收 drainBlood，不增加弒親代幣', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [
        { id: 'h1', name: 'Human', type: 'human', drainBlood: 3, influence: 1, drained: false },
      ];
      frenzy(engine, 'p1');
      expect(engine.state.players['p1'].blood).toBe(3);
      expect(engine.state.players['p1'].diablerie).toBe(0);
      expect(engine.state.players['p2'].influence).toBe(1);
    });

    it('優先汲取未汲取的同盟', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [
        { id: 'h1', name: 'Drained', type: 'human', drainBlood: 5, influence: 1, drained: true },
        { id: 'h2', name: 'Fresh', type: 'human', drainBlood: 2, influence: 1, drained: false },
      ];
      frenzy(engine, 'p1');
      expect(engine.state.players['p1'].blood).toBe(2); // h2 drained
    });
  });

  describe('血量 = 0，有吸血鬼同盟：汲取增加弒親代幣', () => {
    it('汲取吸血鬼：+1 弒親代幣', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [
        { id: 'v1', name: 'Vampire', type: 'vampire', drainBlood: 2, influence: 1, drained: false },
      ];
      frenzy(engine, 'p1');
      expect(engine.state.players['p1'].diablerie).toBe(1);
      expect(engine.state.players['p1'].blood).toBe(2);
    });
  });

  describe('血量 = 0，無同盟：從銀行取 1 血，失去 1 影響力', () => {
    it('無同盟：blood=1，influence-1', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [];
      engine.state.players['p1'].influence = 3;
      frenzy(engine, 'p1');
      expect(engine.state.players['p1'].blood).toBe(1);
      expect(engine.state.players['p1'].influence).toBe(2);
    });

    it('影響力為 0：不低於 0', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [];
      engine.state.players['p1'].influence = 0;
      frenzy(engine, 'p1');
      expect(engine.state.players['p1'].influence).toBe(0);
    });
  });

  describe('BR08 備戰 — 觸發狂暴時，對手額外 +1 影響力', () => {
    it('對手有面朝上的 BR08：+2 影響力', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [
        { id: 'h1', name: 'Human', type: 'human', drainBlood: 1, influence: 1, drained: false },
      ];
      // p2 has BR08 face-up deployed
      engine.state.deployments['rack'] = [makeSlot('p2', 'BR08', { faceDown: false })];
      frenzy(engine, 'p1');
      expect(engine.state.players['p2'].influence).toBe(2); // 1 from frenzy + 1 from BR08
    });

    it('對手 BR08 面朝下：不觸發額外影響力', () => {
      const engine = setup2();
      engine.state.players['p1'].alliance = [
        { id: 'h1', name: 'Human', type: 'human', drainBlood: 1, influence: 1, drained: false },
      ];
      engine.state.deployments['rack'] = [makeSlot('p2', 'BR08', { faceDown: true })];
      frenzy(engine, 'p1');
      expect(engine.state.players['p2'].influence).toBe(1); // only base frenzy influence
    });
  });
});

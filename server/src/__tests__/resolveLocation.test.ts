import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer, makeSlot } from './helpers';

const LOC = 'rack';

function resolve(engine: GameEngine) {
  const loc = engine.state.locations.find(l => l.id === LOC)!;
  return (engine as any).resolveLocation(loc);
}

function setup2(p1Blood = 10, p2Blood = 10) {
  const engine = new GameEngine('TEST');
  engine.state.round = 1;
  engine.state.players['p1'] = makePlayer('p1', { blood: p1Blood, alliance: [] });
  engine.state.players['p2'] = makePlayer('p2', { blood: p2Blood, alliance: [] });
  return engine;
}

describe('resolveLocation', () => {
  describe('勝者判定', () => {
    it('戰力高者獲勝', () => {
      const engine = setup2();
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'BR01'), // power=6
        makeSlot('p2', 'VE08'), // power=2
      ];
      const result = resolve(engine);
      expect(result.winner).toBe('p1');
    });

    it('完全平局：無勝者', () => {
      const engine = setup2();
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'VE08'), // power=2
        makeSlot('p2', 'VE08'), // power=2
      ];
      const result = resolve(engine);
      expect(result.tie).toBe(true);
      expect(result.winner).toBeNull();
    });

    it('野心代幣持有者平局時落敗', () => {
      const engine = setup2();
      engine.state.ambitionHolder = 'p1';
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'VE08'), // power=2
        makeSlot('p2', 'VE08'), // power=2
      ];
      const result = resolve(engine);
      expect(result.winner).toBe('p2'); // p1 has ambition → loses tie
    });

    it('無人部署：回傳空結果', () => {
      const engine = setup2();
      engine.state.deployments[LOC] = [];
      const result = resolve(engine);
      expect(result.winner).toBeNull();
      expect(result.tie).toBe(false);
    });
  });

  describe('影響力獎勵', () => {
    it('第 1 回合勝者獲得正確影響力（依地點 infTable）', () => {
      const engine = setup2();
      const loc = engine.state.locations.find(l => l.id === LOC)!;
      const expectedInf = loc.influence[0]?.[0] ?? 0;
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'BR01'), // wins
        makeSlot('p2', 'VE08'),
      ];
      resolve(engine);
      expect(engine.state.players['p1'].influence).toBe(expectedInf);
    });
  });

  describe('快照機制 — TO06 服從免疫', () => {
    it('TO06 持有者被 BR07 偷血：效果結束後血量恢復', () => {
      const engine = setup2();
      // p2 has BR07 (steals 1 from each rival in prep)
      // p1 has TO06 (submission: immune to blood loss)
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'TO06'), // passive, face-up
        makeSlot('p2', 'BR07'),
      ];
      const before = engine.state.players['p1'].blood;
      resolve(engine);
      // BR07 steals from p1 in prep, but TO06 snapshot restores it
      expect(engine.state.players['p1'].blood).toBe(before);
    });
  });

  describe('快照機制 — TR06 報復', () => {
    it('TR06 持有者被 BR04 扣血：報復觸發，對手扣等量血', () => {
      const engine = setup2();
      engine.state.round = 2;
      // p2 has BR04 (aftermath: rivals lose `round` blood = 2)
      // p1 has TR06 (retaliation: rivals lose what p1 lost)
      engine.state.deployments[LOC] = [
        makeSlot('p1', 'TR06'), // passive, face-up
        makeSlot('p2', 'BR04'), // aftermath
      ];
      const p2Before = engine.state.players['p2'].blood;
      resolve(engine);
      // BR04 in aftermath: p1 loses 2 → TR06 snapshot triggers → p2 also loses 2
      expect(engine.state.players['p2'].blood).toBeLessThan(p2Before);
    });
  });

  describe('快照機制 — TR04 黑暗契約', () => {
    it('TR04 持有者被偷血：失血重導向為部署血液代幣', () => {
      const engine = setup2();
      // p2 has BR07 (steals 1 from p1 in prep)
      // p1 has TR04 (dark pact: blood loss redirected to slot as tokens)
      const tr04Slot = makeSlot('p1', 'TR04', { bloodTokens: 0 });
      engine.state.deployments[LOC] = [
        tr04Slot,
        makeSlot('p2', 'BR07'),
      ];
      const p1Before = engine.state.players['p1'].blood;
      resolve(engine);
      // p1 net blood should be same (lost then re-gained via token redirect)
      expect(engine.state.players['p1'].blood).toBe(p1Before);
      // tokens should have increased
      expect(tr04Slot.bloodTokens).toBeGreaterThan(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import { GameEngine } from '../gameEngine';
import { makePlayer } from './helpers';

function setup() {
  const engine = new GameEngine('TEST');
  const s = engine.state;
  s.players['p1'] = makePlayer('p1', { name: 'Alice' });
  s.players['p2'] = makePlayer('p2', { name: 'Bob' });
  s.playerOrder.push('p1', 'p2');
  return engine;
}

describe('getClientState — activeChoosers / skipVotes（座位狀態公開資訊）', () => {
  it('無 pendingChoices 時 activeChoosers 為空陣列', () => {
    const engine = setup();
    const state = engine.getClientState('p1');
    expect(state.activeChoosers).toEqual([]);
    expect(state.skipVotes).toEqual([]);
  });

  it('pendingChoices 公開「誰在為哪張牌選擇」但不含選項內容', () => {
    const engine = setup();
    engine.state.pendingChoices.push({
      id: 'ch1',
      playerId: 'p2',
      prompt_zh: '祕密提示',
      options: [{ key: 'A', label_zh: '祕密選項' }],
      context: { cardId: 'VE03', locationId: 'rack', sourcePlayerId: 'p1', sourceName: 'Alice' },
      choiceKey: 'VE03:rack:p2',
    });

    // 非選擇者視角
    const state = engine.getClientState('p1');
    expect(state.activeChoosers).toEqual([
      { playerId: 'p2', cardId: 'VE03', locationId: 'rack' },
    ]);
    // 不洩漏選項與提示
    expect(JSON.stringify(state.activeChoosers)).not.toContain('祕密');
    // 非選擇者拿不到 myPendingChoice
    expect(state.myPendingChoice).toBeNull();
  });

  it('觀戰者狀態同樣帶出 activeChoosers', () => {
    const engine = setup();
    engine.state.pendingChoices.push({
      id: 'ch1',
      playerId: 'p1',
      prompt_zh: '提示',
      options: [{ key: 'A', label_zh: '甲' }],
      context: { cardId: 'MA01', locationId: 'asylum', sourcePlayerId: 'p2', sourceName: 'Bob' },
      choiceKey: 'MA01:asylum:p1',
    });
    const state = engine.getSpectatorState();
    expect(state.activeChoosers).toEqual([
      { playerId: 'p1', cardId: 'MA01', locationId: 'asylum' },
    ]);
  });
});

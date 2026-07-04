import { describe, expect, it } from 'vitest';
import { CardDef, ClanId } from '@kindred/shared';
import { CLAN_DECKS, CLAN_STARTERS } from '../../cardData';
import { GameEngine } from '../../gameEngine';

const CLANS: ClanId[] = [
  'brujah',
  'nosferatu',
  'toreador',
  'tremere',
  'malkavian',
  'gangrel',
  'ventrue',
];

type CardSelectionCase = {
  clan: ClanId;
  card: CardDef;
};

function cardsForClan(clan: ClanId): CardDef[] {
  return [...CLAN_STARTERS[clan], ...CLAN_DECKS[clan]].sort((a, b) => a.id.localeCompare(b.id));
}

function allCardSelectionCases(): CardSelectionCase[] {
  return CLANS.flatMap(clan =>
    cardsForClan(clan).map(card => ({
      clan,
      card,
    }))
  );
}

function addTwoPlayers(engine: GameEngine) {
  engine.addPlayer('p1', 'Player 1');
  engine.addPlayer('p2', 'Player 2');
}

describe('integration clan selection regression', () => {
  it.each(CLANS)('%s can be selected from the clan-select phase', clan => {
    const engine = new GameEngine('CLAN_SELECT_REGRESSION');
    addTwoPlayers(engine);

    engine.startClanSelect();

    expect(engine.selectClan('p1', clan)).toBe(true);
    expect(engine.state.players['p1'].clan).toBe(clan);
    expect(engine.state.players['p1'].blood).toBe(6);
    expect(engine.state.players['p1'].influence).toBe(3);
  });

  it('all seven clans can be selected by different players in one lobby', () => {
    const engine = new GameEngine('ALL_CLANS_REGRESSION');
    CLANS.forEach((_, index) => {
      engine.addPlayer(`p${index + 1}`, `Player ${index + 1}`);
    });

    engine.startClanSelect();

    CLANS.forEach((clan, index) => {
      const pid = `p${index + 1}`;
      expect(engine.selectClan(pid, clan)).toBe(true);
      expect(engine.state.players[pid].clan).toBe(clan);
    });

    expect(engine.allClansSelected()).toBe(true);
  });
});

describe('integration hand-build card selection regression', () => {
  it.each(allCardSelectionCases())('$clan $card.id can be selected during hand build', ({ clan, card }) => {
    const engine = new GameEngine('CARD_SELECT_REGRESSION');
    addTwoPlayers(engine);

    engine.startClanSelect();
    expect(engine.selectClan('p1', clan)).toBe(true);
    expect(engine.selectClan('p2', CLANS.find(otherClan => otherClan !== clan)!)).toBe(true);

    engine.startHandBuild();

    const player = engine.state.players['p1'];
    const handBefore = player.hand.length;
    const deckBefore = player.deck.length;
    const unpickedCard = cardsForClan(clan).find(candidate => candidate.id !== card.id)!;
    player.handBuildDraft = [card, unpickedCard];

    expect(engine.selectHandCard('p1', card.id)).toBe(true);

    expect(player.hand.map(handCard => handCard.id)).toContain(card.id);
    expect(player.hand.length).toBe(handBefore + 1);
    expect(player.handBuildDraft).toHaveLength(0);
    expect(player.deck.length).toBe(deckBefore + 1);
    expect(player.deck.map(deckCard => deckCard.id)).toContain(unpickedCard.id);
    expect(player.isReady).toBe(true);
    expect(player.handCount).toBe(player.hand.length);
  });
});

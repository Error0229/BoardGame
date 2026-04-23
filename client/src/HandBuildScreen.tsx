import type { CardDef, GameStateClient } from '@kindred/shared'
import socket from './socket'
import CardImage from './CardImage'
import './HandBuildScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

const TYPE_LABEL: Record<string, string> = {
  conflict:    '衝突',
  preparation: '準備',
  aftermath:   '後果',
  passive:     '持續',
}

function CardTile({ card, onPick, disabled }: { card: CardDef; onPick?: () => void; disabled?: boolean }) {
  return (
    <button
      className={`card-tile ${onPick ? 'card-tile--pickable' : ''}`}
      onClick={onPick}
      disabled={disabled}
    >
      <CardImage cardId={card.id} clan={card.clan} />
      <div className="card-tile__body">
        <div className="card-tile__type">{TYPE_LABEL[card.type] ?? card.type}</div>
        <div className="card-tile__power">{card.power}</div>
        <div className="card-tile__name">{card.name_zh}</div>
        <div className="card-tile__name-en">{card.name_en}</div>
        {card.effect_zh && <div className="card-tile__effect">{card.effect_zh}</div>}
      </div>
    </button>
  )
}

function TypeDistribution({ cards, label }: { cards: { type: string }[]; label: string }) {
  const counts: Record<string, number> = { conflict: 0, preparation: 0, aftermath: 0, passive: 0 }
  cards.forEach(c => { if (c.type in counts) counts[c.type]++ })
  return (
    <div className="handbuild__dist">
      <span className="handbuild__dist-label">{label}：</span>
      {(['conflict','preparation','aftermath','passive'] as const).map(t => (
        <span key={t} className={`handbuild__dist-tag handbuild__dist-tag--${t} ${counts[t] === 0 ? 'handbuild__dist-tag--zero' : ''}`}>
          {TYPE_LABEL[t]} {counts[t]}
        </span>
      ))}
    </div>
  )
}

export default function HandBuildScreen({ myId, gameState }: Props) {
  const draft = gameState.myHandBuildDraft
  const hand  = gameState.myHand
  const waiting = gameState.waitingFor
  const alreadyPicked = draft.length === 0

  function pick(cardId: string) {
    socket.emit('selectHandCard', cardId)
  }

  return (
    <div className="handbuild">
      <div className="handbuild__round">第 {gameState.round + 1} 回合 — 手牌建造</div>

      {/* Draft section */}
      <section className="handbuild__section">
        <div className="handbuild__section-title">
          {alreadyPicked ? '已選擇，等待其他玩家…' : `選擇一張加入手牌（${draft.length} 選 1）`}
        </div>
        {!alreadyPicked && (
          <>
            <div className="handbuild__draft">
              {draft.map(card => (
                <CardTile key={card.id} card={card} onPick={() => pick(card.id)} />
              ))}
            </div>
            {hand.length > 0 && <TypeDistribution cards={[...hand, ...draft]} label="加入後手牌分布（預覽）" />}
          </>
        )}
      </section>

      {/* Current hand */}
      {hand.length > 0 && (
        <section className="handbuild__section">
          <div className="handbuild__section-title">目前手牌（{hand.length} 張）</div>
          <TypeDistribution cards={hand} label="現有分布" />
          <div className="handbuild__hand">
            {hand.map(card => (
              <CardTile key={card.id} card={card} />
            ))}
          </div>
        </section>
      )}

      {/* Waiting indicator */}
      {alreadyPicked && waiting.length > 0 && (
        <div className="handbuild__waiting">
          等待：{waiting.map(id => gameState.players[id]?.name ?? id).join('、')}
        </div>
      )}
    </div>
  )
}

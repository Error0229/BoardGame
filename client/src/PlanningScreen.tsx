import { useState } from 'react'
import type { CardDef, GameStateClient, AllyCard, ClanId } from '@kindred/shared'
import socket from './socket'
import CardImage from './CardImage'
import { locationImageSrc } from './cardImages'
import { CARD_DEFS, TYPE_LABEL_ZH } from './cardDefs'
import './PlanningScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

const TYPE_LABEL: Record<string, string> = {
  conflict: '衝突', preparation: '準備', aftermath: '後果', passive: '持續',
}

// ── Deploy Dialog ──────────────────────────────────────────────

interface DeployDialogProps {
  card: CardDef
  locId: string
  locName: string
  myBlood: number
  isMine: boolean // is Nosferatu (faceDown free)
  onConfirm: (faceDown: boolean, bloodTokens: number) => void
  onCancel: () => void
}

function DeployDialog({ card, locName, myBlood, isMine, onConfirm, onCancel }: DeployDialogProps) {
  const [faceDown, setFaceDown] = useState(false)
  const [tokens, setTokens] = useState(0)

  const faceDownCost = isMine ? 0 : (faceDown ? 1 : 0)
  const totalCost = faceDownCost + tokens
  const canAfford = myBlood >= totalCost

  return (
    <div className="deploy-dialog-overlay" onClick={onCancel}>
      <div className="deploy-dialog" onClick={e => e.stopPropagation()}>
        <div className="deploy-dialog__header">
          部署至 <strong>{locName}</strong>
        </div>
        <div className="deploy-dialog__card-preview">
          <CardImage cardId={card.id} clan={card.clan} className="deploy-dialog__card-img" />
          <div className="deploy-dialog__card-info">
            <div className="deploy-dialog__card-name">{card.name_zh}</div>
            <div className="deploy-dialog__card-name-en">{card.name_en}</div>
            <div className="deploy-dialog__card-power">戰力 {card.power}</div>
            {card.effect_zh && <div className="deploy-dialog__card-effect">{card.effect_zh}</div>}
          </div>
        </div>

        <label className="deploy-dialog__row">
          <input type="checkbox" checked={faceDown} onChange={e => setFaceDown(e.target.checked)} />
          <span>
            秘密部署（正面朝下）
            {!isMine && <span className="deploy-dialog__cost"> −1 血</span>}
            {isMine && <span className="deploy-dialog__free"> 免費</span>}
          </span>
        </label>

        <div className="deploy-dialog__row">
          <span>追加血液代幣：</span>
          <div className="deploy-dialog__token-ctrl">
            <button onClick={() => setTokens(t => Math.max(0, t - 1))} disabled={tokens === 0}>−</button>
            <span className="deploy-dialog__token-val">{tokens}</span>
            <button onClick={() => setTokens(t => Math.min(3, t + 1))} disabled={tokens >= 3 || myBlood < totalCost + 1}>+</button>
          </div>
          {tokens > 0 && <span className="deploy-dialog__cost">−{tokens} 血</span>}
        </div>

        <div className="deploy-dialog__total">
          消耗：<span className={canAfford ? '' : 'deploy-dialog__insufficient'}>{totalCost} 血</span>
          　剩餘：{myBlood - totalCost}
        </div>

        <div className="deploy-dialog__actions">
          <button className="btn-primary" onClick={() => onConfirm(faceDown, tokens)} disabled={!canAfford}>
            確認部署
          </button>
          <button className="btn-ghost" onClick={onCancel}>取消</button>
        </div>
      </div>
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────

export default function PlanningScreen({ myId, gameState }: Props) {
  const me = gameState.players[myId]
  const hand = gameState.myHand
  const alliance = gameState.myAlliance
  const waiting = gameState.waitingFor
  const alreadyDone = !waiting.includes(myId)
  const isMyTurn = gameState.currentTurnPlayerId === myId
  const canDeploy = !alreadyDone && isMyTurn

  const [selectedCard, setSelectedCard] = useState<CardDef | null>(null)
  const [dialog, setDialog] = useState<{ card: CardDef; locId: string; locName: string } | null>(null)
  const [expandedAllies, setExpandedAllies] = useState<Set<string>>(new Set())
  const [slotPopup, setSlotPopup] = useState<{ cardId: string; ownerName: string } | null>(null)
  const [flashLocId, setFlashLocId] = useState<string | null>(null)

  function selectCard(card: CardDef) {
    setSelectedCard(prev => prev?.id === card.id ? null : card)
  }

  function clickLocation(locId: string, locName: string) {
    if (!selectedCard || !canDeploy) return
    setDialog({ card: selectedCard, locId, locName })
  }

  function confirmDeploy(faceDown: boolean, bloodTokens: number) {
    if (!dialog) return
    socket.emit('submitDeployment', {
      locationId: dialog.locId,
      cardId: dialog.card.id,
      faceDown,
      bloodTokens,
    })
    const locId = dialog.locId
    setDialog(null)
    setSelectedCard(null)
    setFlashLocId(locId)
    setTimeout(() => setFlashLocId(null), 900)
  }

  function skip() {
    socket.emit('submitDeployment', { skip: true })
  }

  function drainAlly(ally: AllyCard) {
    socket.emit('drainAlly', ally.id)
  }

  return (
    <div className="planning">
      {/* Status bar */}
      <div className="planning__bar">
        <div className="planning__bar-item">
          <span className="planning__bar-label">血液</span>
          <span className="planning__bar-val planning__bar-val--blood">{gameState.myBlood}</span>
        </div>
        <div className="planning__bar-item">
          <span className="planning__bar-label">剩餘部署</span>
          <span className="planning__bar-val">{me?.deploymentsLeft ?? 0}</span>
        </div>
        <div className="planning__bar-item">
          <span className="planning__bar-label">手牌</span>
          <span className="planning__bar-val">{hand.length} 張</span>
        </div>
        <div className="planning__bar-item">
          <span className="planning__bar-label">當前出牌</span>
          <span className={`planning__bar-val ${isMyTurn && !alreadyDone ? 'planning__bar-val--myturn' : ''}`}>
            {gameState.players[gameState.currentTurnPlayerId]?.name ?? '—'}
          </span>
        </div>
        {canDeploy && (
          <button className="btn-ghost planning__skip-btn" onClick={skip}>
            結束部署
          </button>
        )}
      </div>

      {/* 出牌順序 */}
      {gameState.playerOrder.length > 0 && (
        <div className="planning__turn-order">
          {gameState.playerOrder.map((pid, i) => {
            const player = gameState.players[pid]
            const isCurrentTurn = pid === gameState.currentTurnPlayerId
            const isDone = !waiting.includes(pid)
            return (
              <span
                key={pid}
                className={[
                  'turn-order__player',
                  isCurrentTurn ? 'turn-order__player--active' : '',
                  isDone ? 'turn-order__player--done' : '',
                ].filter(Boolean).join(' ')}
              >
                {i > 0 && <span className="turn-order__arrow">→</span>}
                {player?.name ?? pid}
              </span>
            )
          })}
        </div>
      )}

      {alreadyDone ? (
        <div className="planning__waiting">
          已完成部署，等待：{waiting.map(id => gameState.players[id]?.name ?? id).join('、')}
        </div>
      ) : !isMyTurn ? (
        <div className="planning__waiting">
          等待 <strong>{gameState.players[gameState.currentTurnPlayerId]?.name ?? '...'}</strong> 出牌
        </div>
      ) : selectedCard ? (
        <div className="planning__hint">選擇部署地點 ↓　（再次點擊手牌取消選擇）</div>
      ) : (
        <div className="planning__hint">你的回合！點擊手牌選擇，再選擇地點部署</div>
      )}

      {/* Board */}
      <div className="planning__board">
        {gameState.locations.map(loc => {
          const slots = gameState.deployments[loc.id] ?? []
          const mySlots = slots.filter(s => s.playerId === myId)
          const otherSlots = slots.filter(s => s.playerId !== myId)
          const ally = gameState.locationAllies[loc.id]
          const clickable = !!selectedCard && canDeploy

          return (
            <div
              key={loc.id}
              className={[
                'loc-card',
                clickable             ? 'loc-card--clickable'  : '',
                clickable             ? 'loc-card--targetable' : '',
                loc.isPrinces         ? 'loc-card--princes'    : '',
                flashLocId === loc.id ? 'loc-card--flash'      : '',
              ].filter(Boolean).join(' ')}
              onClick={() => clickLocation(loc.id, loc.name)}
            >
              <div className="loc-card__image">
                <img src={locationImageSrc(loc.id) ?? ''} alt={loc.name} />
              </div>
              <div className="loc-card__header">
                <span className="loc-card__name">{loc.name}</span>
                {loc.isPrinces && <span className="loc-card__princes-badge">王子之地</span>}
              </div>

              <div className="loc-card__influence">
                影響力 {loc.influence[gameState.round]?.[0] ?? '?'} / {loc.influence[gameState.round]?.[1] ?? '?'}
              </div>

              {ally && (
                <div
                  className="loc-card__ally"
                  onClick={e => { e.stopPropagation(); setExpandedAllies(prev => { const s = new Set(prev); s.has(loc.id) ? s.delete(loc.id) : s.add(loc.id); return s; }) }}
                >
                  <div className="loc-card__ally-header">
                    <span className="loc-card__ally-type">{ally.type === 'vampire' ? '吸血鬼' : '人類'}</span>
                    <span className="loc-card__ally-name">{ally.name}</span>
                    <span className="loc-card__ally-chevron">{expandedAllies.has(loc.id) ? '▲' : '▼'}</span>
                  </div>
                  {expandedAllies.has(loc.id) && (
                    <>
                      <div className="loc-card__ally-stats">
                        <span title="影響力">🏛 {ally.influence}</span>
                        <span title="每回合獲得血液">🩸 +{ally.feedBlood}</span>
                        {ally.drainBlood > 0 && <span title="汲取獲得血液">⚡ +{ally.drainBlood}血</span>}
                        {ally.drainInfluence > 0 && <span title="汲取獲得影響力">⚡ +{ally.drainInfluence}影</span>}
                      </div>
                      {ally.effect_zh && <div className="loc-card__ally-effect">{ally.effect_zh}</div>}
                    </>
                  )}
                </div>
              )}

              <div className="loc-card__slots">
                {mySlots.map((sl, i) => {
                  const clan = me?.clan
                  const canPeek = !sl.faceDown && sl.cardId
                  return (
                    <div
                      key={i}
                      className={`loc-slot loc-slot--mine ${canPeek ? 'loc-slot--peekable' : ''}`}
                      onClick={e => { e.stopPropagation(); if (canPeek) setSlotPopup({ cardId: sl.cardId!, ownerName: me?.name ?? '我' }) }}
                    >
                      <CardImage cardId={sl.cardId ?? null} clan={clan} faceDown={sl.faceDown} className="loc-slot__img" />
                      {sl.bloodTokens > 0 && <span className="loc-slot__tokens">+{sl.bloodTokens}💧</span>}
                    </div>
                  )
                })}
                {otherSlots.map((sl, i) => {
                  const ownerClan = gameState.players[sl.playerId]?.clan as ClanId | null
                  const canPeek = !sl.faceDown && !!sl.cardId
                  return (
                    <div
                      key={i}
                      className={`loc-slot loc-slot--other ${canPeek ? 'loc-slot--peekable' : ''}`}
                      onClick={e => { e.stopPropagation(); if (canPeek) setSlotPopup({ cardId: sl.cardId!, ownerName: gameState.players[sl.playerId]?.name ?? '對手' }) }}
                    >
                      <CardImage cardId={sl.cardId ?? null} clan={ownerClan} faceDown={sl.faceDown || !sl.cardId} className="loc-slot__img" />
                      {sl.bloodTokens > 0 && !sl.bloodTokensHidden && <span className="loc-slot__tokens">+{sl.bloodTokens}💧</span>}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Hand */}
      {!alreadyDone && hand.length > 0 && (
        <section className="planning__hand-section">
          <div className="planning__section-title">手牌</div>
          <div className="planning__hand">
            {hand.map(card => (
              <button
                key={card.id}
                className={`card-tile ${canDeploy ? 'card-tile--pickable' : 'card-tile--waiting'} ${selectedCard?.id === card.id ? 'card-tile--selected' : ''}`}
                onClick={() => canDeploy && selectCard(card)}
                disabled={!canDeploy}
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
            ))}
          </div>
        </section>
      )}

      {/* Alliance */}
      {alliance.length > 0 && (
        <section className="planning__hand-section">
          <div className="planning__section-title">同盟牌</div>
          <div className="planning__hand">
            {alliance.map(ally => (
              <div key={ally.id} className={`ally-tile ${ally.drained ? 'ally-tile--drained' : ''}`}>
                <div className="ally-tile__type">{ally.type === 'vampire' ? '吸血鬼' : '人類'}</div>
                <div className="ally-tile__name">{ally.name}</div>
                <div className="ally-tile__stats">
                  影響 {ally.influence}　餵食 +{ally.feedBlood}
                  {ally.drainBlood > 0 && `　汲取 +${ally.drainBlood}血`}
                </div>
                {ally.effect_zh && <div className="ally-tile__effect">{ally.effect_zh}</div>}
                {!ally.drained && !alreadyDone && (
                  <button className="btn-ghost ally-tile__drain-btn" onClick={() => drainAlly(ally)}>
                    汲取
                  </button>
                )}
                {ally.drained && <div className="ally-tile__drained-label">已汲取</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {slotPopup && (() => {
        const def = CARD_DEFS[slotPopup.cardId]
        return (
          <div className="slot-popup-overlay" onClick={() => setSlotPopup(null)}>
            <div className="slot-popup" onClick={e => e.stopPropagation()}>
              <div className="slot-popup__owner">{slotPopup.ownerName} 的牌</div>
              <CardImage cardId={slotPopup.cardId} className="slot-popup__img" />
              {def ? (
                <div className="slot-popup__info">
                  <div className="slot-popup__type">{TYPE_LABEL_ZH[def.type] ?? def.type}</div>
                  <div className="slot-popup__name">{def.name_zh}</div>
                  <div className="slot-popup__power">戰力 {def.power}</div>
                  {def.effect_zh && <div className="slot-popup__effect">{def.effect_zh}</div>}
                </div>
              ) : (
                <div className="slot-popup__info">
                  <div className="slot-popup__name">{slotPopup.cardId}</div>
                </div>
              )}
              <button className="btn-ghost slot-popup__close" onClick={() => setSlotPopup(null)}>關閉</button>
            </div>
          </div>
        )
      })()}

      {dialog && (
        <DeployDialog
          card={dialog.card}
          locId={dialog.locId}
          locName={dialog.locName}
          myBlood={gameState.myBlood}
          isMine={me?.clan === 'nosferatu'}
          onConfirm={confirmDeploy}
          onCancel={() => setDialog(null)}
        />
      )}
    </div>
  )
}

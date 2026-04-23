import { useState } from 'react'
import type { GameStateClient, ClanId } from '@kindred/shared'
import socket from './socket'
import CardImage from './CardImage'
import { CARD_DEFS, TYPE_LABEL_ZH } from './cardDefs'
import { cardName } from './cardNames'
import './WithdrawScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

export default function WithdrawScreen({ myId, gameState }: Props) {
  const me = gameState.players[myId]
  const waiting = gameState.waitingFor
  const alreadySubmitted = !waiting.includes(myId)

  // Locations where I have a deployment (used to show decision buttons)
  const myDeployedLocIds = new Set(
    gameState.locations
      .filter(loc => (gameState.deployments[loc.id] ?? []).some(sl => sl.playerId === myId && !sl.withdrawn))
      .map(loc => loc.id)
  )

  // All locations that have any deployment at all
  const activeLocs = gameState.locations.filter(loc =>
    (gameState.deployments[loc.id] ?? []).length > 0
  )

  const [choices, setChoices] = useState<Record<string, boolean>>({})
  const [popup, setPopup] = useState<{ cardId: string } | null>(null)

  const allMyLocsAnswered = [...myDeployedLocIds].every(id => id in choices)

  function toggle(locId: string, withdraw: boolean) {
    setChoices(prev => ({ ...prev, [locId]: withdraw }))
  }

  function submit() {
    if (!allMyLocsAnswered) return
    Object.entries(choices).forEach(([locationId, withdraw]) => {
      socket.emit('submitWithdraw', { locationId, withdraw })
    })
  }

  return (
    <div className="withdraw">

      {/* 卡牌效果 popup */}
      {popup && (() => {
        const def = CARD_DEFS[popup.cardId]
        return (
          <div className="wd-popup-overlay" onClick={() => setPopup(null)}>
            <div className="wd-popup" onClick={e => e.stopPropagation()}>
              <CardImage cardId={popup.cardId} className="wd-popup__img" />
              {def && (
                <div className="wd-popup__info">
                  <div className="wd-popup__type">{TYPE_LABEL_ZH[def.type] ?? def.type}</div>
                  <div className="wd-popup__name">{def.name_zh}</div>
                  <div className="wd-popup__power">基礎戰力 {def.power}</div>
                  {def.effect_zh && <div className="wd-popup__effect">{def.effect_zh}</div>}
                </div>
              )}
              <button className="btn-ghost wd-popup__close" onClick={() => setPopup(null)}>關閉</button>
            </div>
          </div>
        )
      })()}

      {/* 標題 + 狀態列 */}
      <div className="withdraw__header">
        <div className="withdraw__title">撤退階段</div>
        <div className="withdraw__subtitle">選擇是否從各地點撤退（撤退可保留卡牌上的血液，但失去該地點得分機會）</div>
        {waiting.length === 0 ? (
          <div className="withdraw__status withdraw__status--reveal">
            ✦ 所有人已決定，撤退結果揭曉中…
          </div>
        ) : alreadySubmitted ? (
          <div className="withdraw__status withdraw__status--done">
            ✓ 已提交，等待：{waiting.map(id => gameState.players[id]?.name ?? id).join('、')}
          </div>
        ) : myDeployedLocIds.size === 0 ? (
          <div className="withdraw__status withdraw__status--done">
            你沒有部署任何牌，自動通過。等待：{waiting.map(id => gameState.players[id]?.name ?? id).join('、')}
          </div>
        ) : (
          <div className="withdraw__status">
            請為每個地點做出決定（{Object.keys(choices).length} / {myDeployedLocIds.size} 已選）
          </div>
        )}
      </div>

      {/* 全戰場一覽 */}
      {activeLocs.length === 0 ? (
        <div className="withdraw__empty">目前無任何部署</div>
      ) : (
        <div className="withdraw__board">
          {activeLocs.map(loc => {
            const slots = gameState.deployments[loc.id] ?? []
            const mySlots = slots.filter(sl => sl.playerId === myId)
            const otherSlots = slots.filter(sl => sl.playerId !== myId)
            const isMine = myDeployedLocIds.has(loc.id)
            const choice = choices[loc.id]

            return (
              <div
                key={loc.id}
                className={[
                  'wd-loc',
                  isMine ? 'wd-loc--mine' : '',
                  isMine && choice === false ? 'wd-loc--stay' : '',
                  isMine && choice === true  ? 'wd-loc--out'  : '',
                ].filter(Boolean).join(' ')}
              >
                {/* 地點標題 */}
                <div className="wd-loc__header">
                  <span className="wd-loc__name">{loc.name}</span>
                  {loc.isPrinces && <span className="wd-loc__princes">王子之地</span>}
                  <span className="wd-loc__influence">
                    {loc.influence[gameState.round]?.[0] ?? '?'} / {loc.influence[gameState.round]?.[1] ?? '?'} 影
                  </span>
                </div>

                {/* 所有部署槽 */}
                <div className="wd-loc__slots">
                  {/* 我的槽 */}
                  {mySlots.map((sl, i) => {
                    const clan = me?.clan as ClanId | null
                    const canPeek = !!sl.cardId && !sl.faceDown
                    return (
                      <div
                        key={`mine-${i}`}
                        className={`wd-slot wd-slot--mine ${canPeek ? 'wd-slot--peekable' : ''} ${sl.withdrawn ? 'wd-slot--withdrawn' : ''}`}
                        onClick={() => canPeek && !sl.withdrawn && setPopup({ cardId: sl.cardId! })}
                        title={canPeek && !sl.withdrawn ? '點擊查看效果' : undefined}
                      >
                        <CardImage cardId={sl.cardId} clan={clan} faceDown={sl.faceDown} className="wd-slot__img" />
                        <div className="wd-slot__info">
                          <span className="wd-slot__label">我</span>
                          <span className="wd-slot__name">
                            {sl.faceDown ? '面朝下' : (sl.cardId ? cardName(sl.cardId) : '?')}
                          </span>
                          {sl.withdrawn
                            ? <span className="wd-slot__wd-badge">撤退</span>
                            : sl.bloodTokens > 0 && <span className="wd-slot__tokens">💧{sl.bloodTokens}</span>
                          }
                        </div>
                      </div>
                    )
                  })}

                  {/* 對手槽 */}
                  {otherSlots.map((sl, i) => {
                    const owner = gameState.players[sl.playerId]
                    const ownerClan = owner?.clan as ClanId | null
                    const isHidden = sl.faceDown || !sl.cardId
                    const canPeek = !isHidden && !!sl.cardId
                    return (
                      <div
                        key={`other-${i}`}
                        className={`wd-slot wd-slot--other ${canPeek && !sl.withdrawn ? 'wd-slot--peekable' : ''} ${sl.withdrawn ? 'wd-slot--withdrawn' : ''}`}
                        onClick={() => canPeek && !sl.withdrawn && setPopup({ cardId: sl.cardId! })}
                        title={canPeek && !sl.withdrawn ? '點擊查看效果' : undefined}
                      >
                        <CardImage cardId={sl.cardId} clan={ownerClan} faceDown={isHidden} className="wd-slot__img" />
                        <div className="wd-slot__info">
                          <span className="wd-slot__label">{owner?.name ?? '?'}</span>
                          <span className="wd-slot__name">
                            {isHidden ? '???' : (sl.cardId ? cardName(sl.cardId) : '?')}
                          </span>
                          {sl.withdrawn
                            ? <span className="wd-slot__wd-badge">撤退</span>
                            : sl.bloodTokens > 0 && !sl.bloodTokensHidden && (
                              <span className="wd-slot__tokens">💧{sl.bloodTokens}</span>
                            )
                          }
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* 決策按鈕（只在我有部署的地點 & 尚未提交時顯示） */}
                {isMine && !alreadySubmitted && (
                  <div className="wd-loc__btns">
                    <button
                      className={`wd-btn ${choice === false ? 'wd-btn--stay' : ''}`}
                      onClick={() => toggle(loc.id, false)}
                    >
                      留守
                    </button>
                    <button
                      className={`wd-btn ${choice === true ? 'wd-btn--out' : ''}`}
                      onClick={() => toggle(loc.id, true)}
                    >
                      撤退
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* 確認按鈕 */}
      {!alreadySubmitted && myDeployedLocIds.size > 0 && (
        <button className="btn-primary withdraw__submit" onClick={submit} disabled={!allMyLocsAnswered}>
          確認撤退決定
        </button>
      )}
    </div>
  )
}

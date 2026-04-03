import { useState } from 'react'
import type { GameStateClient } from '@kindred/shared'
import socket from './socket'
import './WithdrawScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

export default function WithdrawScreen({ myId, gameState }: Props) {
  const me = gameState.players[myId]
  const waiting = gameState.waitingFor
  const alreadySubmitted = !waiting.includes(myId)

  // Locations where I have a deployment (not withdrawn)
  const myLocations = gameState.locations.filter(loc => {
    const slots = gameState.deployments[loc.id] ?? []
    return slots.some(sl => sl.playerId === myId && !sl.withdrawn)
  })

  const [choices, setChoices] = useState<Record<string, boolean>>({})
  const allAnswered = myLocations.every(loc => loc.id in choices)

  function toggle(locId: string, withdraw: boolean) {
    setChoices(prev => ({ ...prev, [locId]: withdraw }))
  }

  function submit() {
    if (!allAnswered) return
    Object.entries(choices).forEach(([locationId, withdraw]) => {
      socket.emit('submitWithdraw', { locationId, withdraw })
    })
  }

  if (myLocations.length === 0 || alreadySubmitted) {
    return (
      <div className="withdraw withdraw--waiting">
        <div className="withdraw__waiting-text">
          {myLocations.length === 0 ? '你沒有部署任何牌，自動通過。' : '已提交，等待其他玩家…'}
        </div>
        {waiting.length > 0 && (
          <div className="withdraw__waiting-names">
            等待：{waiting.map(id => gameState.players[id]?.name ?? id).join('、')}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="withdraw">
      <div className="withdraw__title">撤退階段</div>
      <div className="withdraw__subtitle">選擇是否從各地點撤退（撤退可保留卡牌，但失去該地點得分）</div>

      <div className="withdraw__locations">
        {myLocations.map(loc => {
          const slots = gameState.deployments[loc.id].filter(sl => sl.playerId === myId)
          const choice = choices[loc.id]

          return (
            <div key={loc.id} className={`withdraw__loc ${choice !== undefined ? (choice ? 'withdraw__loc--out' : 'withdraw__loc--stay') : ''}`}>
              <div className="withdraw__loc-name">{loc.name}</div>
              <div className="withdraw__loc-cards">
                {slots.map((sl, i) => (
                  <span key={i} className="withdraw__card-badge">
                    {sl.cardId ?? '?'} {sl.bloodTokens > 0 && `+${sl.bloodTokens}血`}
                  </span>
                ))}
              </div>
              <div className="withdraw__loc-btns">
                <button
                  className={`withdraw__btn ${choice === false ? 'withdraw__btn--active-stay' : ''}`}
                  onClick={() => toggle(loc.id, false)}
                >留守</button>
                <button
                  className={`withdraw__btn ${choice === true ? 'withdraw__btn--active-out' : ''}`}
                  onClick={() => toggle(loc.id, true)}
                >撤退</button>
              </div>
            </div>
          )
        })}
      </div>

      <button className="btn-primary" onClick={submit} disabled={!allAnswered}>
        確認
      </button>
    </div>
  )
}

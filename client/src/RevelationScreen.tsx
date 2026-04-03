import type { GameStateClient, ConflictResult, ClanId } from '@kindred/shared'
import socket from './socket'
import { cardName } from './cardNames'
import CardImage from './CardImage'
import './RevelationScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

function ResultCard({ result, gameState, myId }: {
  result: ConflictResult
  gameState: GameStateClient
  myId: string
}) {
  const loc = gameState.locations.find(l => l.id === result.locationId)
  const slots = gameState.deployments[result.locationId] ?? []
  const sortedPlayers = Object.entries(result.scores).sort((a, b) => b[1] - a[1])

  return (
    <div className={`result-card ${result.winner === myId ? 'result-card--winner' : ''}`}>
      <div className="result-card__loc">
        {loc?.name ?? result.locationId}
        {loc?.isPrinces && <span className="result-card__princes">王子之地</span>}
      </div>

      {result.tie && <div className="result-card__tie">平局，無人得分</div>}

      {/* 部署牌一覽 */}
      <div className="result-card__slots">
        {slots.map((sl, i) => {
          const owner = gameState.players[sl.playerId]
          const clan = owner?.clan as ClanId | null
          return (
            <div key={i} className={[
              'result-slot',
              sl.playerId === myId ? 'result-slot--mine' : '',
              sl.withdrawn ? 'result-slot--withdrawn' : '',
            ].join(' ')}>
              <CardImage cardId={sl.cardId} clan={clan} faceDown={sl.faceDown && !sl.cardId} className="result-slot__img" />
              <div className="result-slot__info">
                <span className="result-slot__owner">{owner?.name ?? '?'}</span>
                <span className="result-slot__card">{cardName(sl.cardId)}</span>
                <div className="result-slot__badges">
                  {sl.bloodTokens > 0 && <span className="result-slot__tokens">+{sl.bloodTokens}💧</span>}
                  {sl.withdrawn && <span className="result-slot__wd">撤退</span>}
                  {sl.effectivePower !== null && (
                    <span className="result-slot__power">⚔ {sl.effectivePower}</span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* 分數與影響力 */}
      <div className="result-card__scores">
        {sortedPlayers.map(([pid, score], rank) => {
          const player = gameState.players[pid]
          const inf = result.influenceGained[pid] ?? 0
          const isWinner = result.winner === pid
          return (
            <div key={pid} className={[
              'result-card__row',
              isWinner ? 'result-card__row--first' : '',
              pid === myId ? 'result-card__row--me' : '',
            ].join(' ')}>
              <span className="result-card__rank">#{rank + 1}</span>
              <span className="result-card__pname">
                {player?.name ?? pid}{pid === myId && ' (你)'}
              </span>
              <span className="result-card__score">{score} 戰力</span>
              {inf > 0 && <span className="result-card__inf">+{inf} 影響</span>}
            </div>
          )
        })}
      </div>

      {/* 效果觸發日誌 */}
      {result.bloodEvents.length > 0 && (
        <div className="result-card__events">
          <div className="result-card__events-title">效果觸發</div>
          {result.bloodEvents.map((e, i) => (
            <div key={i} className="result-card__event-line">▸ {e}</div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RevelationScreen({ myId, gameState }: Props) {
  const results = gameState.lastConflictResults
  const phase = gameState.phase
  const waiting = gameState.waitingFor
  const iHaveConfirmed = !waiting.includes(myId)
  const players = Object.values(gameState.players).sort((a, b) => b.influence - a.influence)
  const pendingChoice = gameState.myPendingChoice

  function confirm() {
    socket.emit('readyAdvance')
  }

  function respondChoice(option: string) {
    if (!pendingChoice) return
    socket.emit('respondChoice', { choiceId: pendingChoice.id, option })
  }

  const isReveal = phase === 'REVELATION'
  const isRoundEnd = phase === 'ROUND_END'

  return (
    <div className="revelation">

      {/* ── 待選擇強制 Modal ── */}
      {pendingChoice && (
        <div className="choice-overlay">
          <div className="choice-modal">
            <div className="choice-modal__prompt">{pendingChoice.prompt_zh}</div>
            <div className="choice-modal__options">
              {pendingChoice.options.map(opt => (
                <button
                  key={opt.key}
                  className="btn-primary choice-modal__btn"
                  onClick={() => respondChoice(opt.key)}
                >
                  {opt.label_zh}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
      <div className="revelation__header">
        <div className="revelation__title">
          {isReveal ? '翻牌結算' : `第 ${gameState.round} 回合結束`}
        </div>
        <div className="revelation__subtitle">
          {isReveal ? `第 ${gameState.round} 回合` : gameState.round < 3 ? `第 ${gameState.round + 1} 回合即將開始` : '最終回合'}
        </div>
      </div>

      <div className="revelation__body">
        {/* 地點結算卡片 */}
        <div className="revelation__results">
          {results.length > 0
            ? results.map(r => (
                <ResultCard key={r.locationId} result={r} gameState={gameState} myId={myId} />
              ))
            : <div className="revelation__empty">本回合無人部署</div>
          }
        </div>

        <div className="revelation__sidebar">
          {/* 目前積分 */}
          <div className="revelation__standings">
            <div className="revelation__standings-title">目前積分</div>
            {players.map((p, i) => (
              <div key={p.id} className={`revelation__standing-row ${p.id === myId ? 'revelation__standing-row--me' : ''}`}>
                <span className="revelation__standing-rank">#{i + 1}</span>
                <span className="revelation__standing-name">{p.name}{p.id === myId && ' (你)'}</span>
                <span className="revelation__standing-inf">{p.influence} 影</span>
                <span className="revelation__standing-blood">{p.blood} 血</span>
              </div>
            ))}
          </div>

          {/* 確認按鈕 */}
          <div className="revelation__confirm-area">
            {!iHaveConfirmed ? (
              <button className="btn-primary revelation__confirm-btn" onClick={confirm}>
                {isRoundEnd ? '繼續下一回合' : '確認，繼續'}
              </button>
            ) : (
              <div className="revelation__confirmed">✓ 已確認</div>
            )}

            {waiting.length > 0 && (
              <div className="revelation__waiting">
                等待：{waiting.map(id => gameState.players[id]?.name ?? '...').join('、')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

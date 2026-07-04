import type { GameStateClient } from '@kindred/shared'
import './LocationStrip.css'

interface Props {
  gameState: GameStateClient
  myId: string
  /** 目前進行中(撤退/結算)的地點 */
  currentLocId?: string | null
}

/**
 * 常駐戰場地圖:四個地點固定排列,貫穿撤退/結算階段,
 * 一眼看出結算進度 — 每格顯示 已結算(勝者)/進行中/待結算。
 */
export default function LocationStrip({ gameState, myId, currentLocId }: Props) {
  const resolvedBy = new Map(
    gameState.lastConflictResults.map(r => [r.locationId, r])
  )

  return (
    <div className="loc-strip">
      {gameState.locations.map(loc => {
        const slots = (gameState.deployments[loc.id] ?? []).filter(sl => !sl.withdrawn)
        const result = resolvedBy.get(loc.id)
        const isCurrent = loc.id === currentLocId
        // 當前地點的結果尚在演出中,不算「已結算」
        const isDone = !!result && !isCurrent
        const isEmpty = slots.length === 0 && !result
        const winner = result?.winner ? gameState.players[result.winner] : null

        return (
          <div
            key={loc.id}
            className={[
              'loc-strip__item',
              isCurrent ? 'loc-strip__item--current' : '',
              isDone ? 'loc-strip__item--done' : '',
              isEmpty && !isCurrent ? 'loc-strip__item--empty' : '',
            ].filter(Boolean).join(' ')}
          >
            <span className="loc-strip__name">
              {loc.name}
              {loc.isPrinces && <span className="loc-strip__princes">♛</span>}
            </span>
            <span className="loc-strip__status">
              {isCurrent ? '⚔ 進行中'
                : isDone
                  ? result!.tie
                    ? '平手'
                    : winner
                      ? `${result!.winner === myId ? '✓ 你' : winner.name} 勝`
                      : '已結算'
                  : isEmpty ? '無部署' : `${slots.length} 張牌`}
            </span>
          </div>
        )
      })}
    </div>
  )
}

import type { GameStateClient } from '@kindred/shared'
import './PlayerHUD.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

export default function PlayerHUD({ myId, gameState }: Props) {
  const me = gameState.players[myId]
  if (!me) return null

  const phase = gameState.phase

  return (
    <div className="player-hud">
      <span className="player-hud__name">{me.name}</span>
      <div className="player-hud__divider" />
      <div className="player-hud__stats">
        <span className="player-hud__stat player-hud__stat--blood">
          <span className="player-hud__label">血</span>
          <span className="player-hud__val">{gameState.myBlood}</span>
        </span>
        <span className="player-hud__stat player-hud__stat--influence">
          <span className="player-hud__label">影響力</span>
          <span className="player-hud__val">{me.influence}</span>
        </span>
        {me.handCount > 0 && (
          <span className="player-hud__stat">
            <span className="player-hud__label">手牌</span>
            <span className="player-hud__val">{me.handCount}</span>
          </span>
        )}
        {me.allianceCount > 0 && (
          <span className="player-hud__stat player-hud__stat--alliance">
            <span className="player-hud__label">同盟</span>
            <span className="player-hud__val">{me.allianceCount}</span>
          </span>
        )}
        {me.diablerie > 0 && (
          <span className="player-hud__stat player-hud__stat--diablerie">
            <span className="player-hud__label">弒親</span>
            <span className="player-hud__val">{me.diablerie}</span>
          </span>
        )}
        {phase === 'PLANNING' && (
          <span className="player-hud__stat player-hud__stat--deploys">
            <span className="player-hud__label">部署</span>
            <span className="player-hud__val">{me.deploymentsLeft}</span>
          </span>
        )}
      </div>
    </div>
  )
}

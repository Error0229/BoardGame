import type { GameStateClient } from '@kindred/shared'
import { clanOf } from './clans'
import { useDeltaFlash } from './useDeltaFlash'
import './PlayerHUD.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

function StatWithDelta({ label, value, type, className }: {
  label: string
  value: number
  type: 'blood' | 'influence'
  className: string
}) {
  const flashes = useDeltaFlash(value)
  return (
    <span className={`player-hud__stat ${className}`}>
      <span className="player-hud__label">{label}</span>
      <span className="player-hud__val-wrap">
        <span className="player-hud__val">{value}</span>
        {flashes.map(f => (
          <span
            key={f.id}
            className={`player-hud__delta player-hud__delta--${type} ${f.value > 0 ? 'player-hud__delta--up' : 'player-hud__delta--down'}`}
          >
            {f.value > 0 ? '+' : ''}{f.value}
          </span>
        ))}
      </span>
    </span>
  )
}

export default function PlayerHUD({ myId, gameState }: Props) {
  const me = gameState.players[myId]
  if (!me) return null

  const phase = gameState.phase
  const clan = clanOf(me.clan)

  return (
    <div className="player-hud" style={clan ? { '--hud-clan': clan.color } as React.CSSProperties : undefined}>
      <span className="player-hud__name">
        {clan && <span className="player-hud__clan" title={clan.en}>{clan.zh}</span>}
        {me.name}
      </span>
      <div className="player-hud__divider" />
      <div className="player-hud__stats">
        <StatWithDelta label="血" value={gameState.myBlood} type="blood" className="player-hud__stat--blood" />
        <StatWithDelta label="影響力" value={me.influence} type="influence" className="player-hud__stat--influence" />
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
          <span className={`player-hud__stat player-hud__stat--diablerie ${me.diablerie >= 2 ? 'player-hud__stat--diab-warn' : ''}`}
            title={me.diablerie >= 2 ? '再汲取一次吸血鬼同盟牌將被淘汰！' : `弒親代幣 ${me.diablerie}/3`}
          >
            <span className="player-hud__label">{me.diablerie >= 2 ? '⚠ 弒親' : '弒親'}</span>
            <span className="player-hud__val">{me.diablerie}/3</span>
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

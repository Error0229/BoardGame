import type { GameStateClient } from '@kindred/shared'
import './GameOverScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

export default function GameOverScreen({ myId, gameState }: Props) {
  const sorted = Object.values(gameState.players).sort((a, b) => {
    if (b.influence !== a.influence) return b.influence - a.influence
    return b.blood - a.blood
  })

  const winner = gameState.winner ? gameState.players[gameState.winner] : null
  const isWinner = gameState.winner === myId

  return (
    <div className="gameover">
      <div className="gameover__crown">♛</div>
      <div className="gameover__title">
        {isWinner ? '你成為了芝加哥的新王子！' : `${winner?.name ?? '???'} 成為了芝加哥的新王子！`}
      </div>

      <div className="gameover__board">
        {sorted.map((p, i) => (
          <div key={p.id} className={`gameover__row ${p.id === myId ? 'gameover__row--me' : ''} ${i === 0 ? 'gameover__row--first' : ''}`}>
            <span className="gameover__rank">#{i + 1}</span>
            <span className="gameover__name">
              {p.name}
              {p.id === myId && ' (你)'}
            </span>
            <span className="gameover__clan">{p.clan}</span>
            <span className="gameover__score">{p.influence} 影響力</span>
            <span className="gameover__blood">{p.blood} 血</span>
          </div>
        ))}
      </div>

      <div className="gameover__log">
        {gameState.log.slice(-10).map((entry, i) => (
          <div key={i} className="gameover__log-entry">{entry}</div>
        ))}
      </div>
    </div>
  )
}

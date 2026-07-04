import type { GameStateClient } from '@kindred/shared'
import { clanOf } from './clans'
import './GameOverScreen.css'

interface Props {
  myId: string
  gameState: GameStateClient
}

const RANK_MEDAL = ['🏆', '🥈', '🥉']

export default function GameOverScreen({ myId, gameState }: Props) {
  const sorted = Object.values(gameState.players).sort((a, b) => {
    if (b.influence !== a.influence) return b.influence - a.influence
    return b.blood - a.blood
  })

  const winner = gameState.winner ? gameState.players[gameState.winner] : null
  const isWinner = gameState.winner === myId
  const topInfluence = sorted[0]?.influence ?? 0
  const myInfluence  = gameState.players[myId]?.influence ?? 0
  const myRank       = sorted.findIndex(p => p.id === myId)

  return (
    <div className="gameover">
      {/* 勝負大標題 */}
      <div className={`gameover__hero ${isWinner ? 'gameover__hero--win' : 'gameover__hero--lose'}`}>
        <div className="gameover__crown">{isWinner ? '♛' : '💀'}</div>
        <div className="gameover__title">
          {isWinner ? '你成為了芝加哥的新王子！' : `${winner?.name ?? '???'} 成為了芝加哥的新王子`}
        </div>
        {!isWinner && myRank > 0 && (
          <div className="gameover__gap">
            你差 {topInfluence - myInfluence} 影響力 · 第 {myRank + 1} 名
          </div>
        )}
      </div>

      {/* 排名榜 */}
      <div className="gameover__board">
        {sorted.map((p, i) => (
          <div key={p.id} className={[
            'gameover__row',
            p.id === myId ? 'gameover__row--me'    : '',
            i === 0       ? 'gameover__row--first'  : '',
          ].filter(Boolean).join(' ')}
            style={{ animationDelay: `${i * 0.15}s` }}
          >
            <span className="gameover__rank">{RANK_MEDAL[i] ?? `#${i+1}`}</span>
            <span className="gameover__name">{p.name}{p.id === myId && ' (你)'}</span>
            <span className="gameover__clan" style={clanOf(p.clan) ? { color: clanOf(p.clan)!.color } : undefined}>
              {clanOf(p.clan)?.zh ?? p.clan}
            </span>
            <span className="gameover__score">{p.influence} 影</span>
            <span className="gameover__blood">{p.blood} 血</span>
            {p.diablerie > 0 && (
              <span className="gameover__diablerie" title={`弒親代幣 ${p.diablerie} 枚（每枚扣 1 影響力）`}>
                👁 {p.diablerie}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* 遊戲記錄 */}
      <div className="gameover__log">
        {gameState.log.slice(-10).map((entry, i) => (
          <div key={i} className="gameover__log-entry">{entry}</div>
        ))}
      </div>

      {/* 返回大廳:清掉席位憑證,重整後回到入口而非嘗試歸位 */}
      <button
        className="btn-primary gameover__restart"
        onClick={() => {
          try { sessionStorage.removeItem('kindred_session') } catch { /* ignore */ }
          window.location.reload()
        }}
      >
        返回大廳
      </button>
    </div>
  )
}

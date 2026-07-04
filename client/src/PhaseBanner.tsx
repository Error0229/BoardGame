import { useEffect, useRef, useState } from 'react'
import type { GamePhase } from '@kindred/shared'
import './PhaseBanner.css'

export const PHASE_INFO: Partial<Record<GamePhase, { title: string; sub: string }>> = {
  CLAN_SELECT: { title: '氏族選擇', sub: '選擇你的血脈' },
  HAND_BUILD:  { title: '手牌建造', sub: '挑選你的武器' },
  PLANNING:    { title: '密謀階段', sub: '秘密部署你的行動' },
  WITHDRAW:    { title: '撤退階段', sub: '去留之間,權衡代價' },
  REVELATION:  { title: '結算階段', sub: '揭示真相' },
  ROUND_END:   { title: '回合結束', sub: '塵埃落定' },
  GAME_OVER:   { title: '遊戲結束', sub: '芝加哥迎來新王子' },
}

interface Props {
  phase: GamePhase | null
  round: number
}

/**
 * 階段切換時的全螢幕章節式宣告,約 1.6 秒後自動淡出。
 * 讓所有玩家同步意識到「進入新階段」,而非畫面默默換掉。
 */
export default function PhaseBanner({ phase, round }: Props) {
  const prevPhase = useRef<GamePhase | null>(null)
  const [show, setShow] = useState<{ title: string; sub: string; round: number } | null>(null)

  useEffect(() => {
    const prev = prevPhase.current
    prevPhase.current = phase
    if (!phase || phase === prev) return
    // 首次載入(重連)或回到大廳不宣告
    if (prev === null || phase === 'LOBBY') return
    const info = PHASE_INFO[phase]
    if (!info) return
    setShow({ ...info, round })
    const t = setTimeout(() => setShow(null), 1600)
    return () => clearTimeout(t)
  }, [phase, round])

  if (!show) return null

  return (
    <div className="phase-banner" onClick={() => setShow(null)}>
      <div className="phase-banner__inner">
        <div className="phase-banner__round">第 {show.round + 1} 回合</div>
        <div className="phase-banner__rule phase-banner__rule--top" />
        <div className="phase-banner__title">{show.title}</div>
        <div className="phase-banner__rule phase-banner__rule--bottom" />
        <div className="phase-banner__sub">{show.sub}</div>
      </div>
    </div>
  )
}

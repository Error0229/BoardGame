import type { ClanId, GameStateClient } from '@kindred/shared'
import socket from './socket'
import './ClanSelectScreen.css'

const CLAN_INFO: Record<ClanId, {
  name_zh: string
  archetype: string
  desc: string
  color: string
}> = {
  brujah:    { name_zh: '布魯哈',      archetype: '全攻快攻',   color: '#8b0000', desc: '怒火與力量。以最快速度擊倒對手，血液即是武器。' },
  nosferatu: { name_zh: '諾斯費拉圖', archetype: '情報控制',   color: '#1a3d1a', desc: '潛伏於黑暗，掌握所有情報。讓敵人的計畫永遠失敗。' },
  toreador:  { name_zh: '托瑞爾多',   archetype: '同盟操控',   color: '#6b2d6b', desc: '美麗是一種武器。操控人心，讓盟友為你拚命戰鬥。' },
  tremere:   { name_zh: '翠梅爾',     archetype: '血液魔法爆發', color: '#1a1a5e', desc: '血是魔法的根源。以神秘儀式將一滴血化為毀滅之力。' },
  malkavian: { name_zh: '馬爾卡維安', archetype: '混亂干擾',   color: '#4a2d6b', desc: '瘋狂本身就是力量。讓敵人的計畫在混沌中崩潰。' },
  gangrel:   { name_zh: '甘格瑞爾',   archetype: '耐久消耗',   color: '#3d2200', desc: '野獸的血液流淌其中。在長期消耗戰中，永不倒下。' },
  ventrue:   { name_zh: '梵崔',       archetype: '棋盤控制',   color: '#1a2d4a', desc: '統治是天生的權利。控制每一個地點，讓敵人無處立足。' },
}

const CLAN_ORDER: ClanId[] = ['brujah', 'nosferatu', 'toreador', 'tremere', 'malkavian', 'gangrel', 'ventrue']

interface Props {
  myId: string
  gameState: GameStateClient
}

export default function ClanSelectScreen({ myId, gameState }: Props) {
  const me = gameState.players[myId]
  const takenClans = new Set(
    Object.values(gameState.players)
      .filter(p => p.clan !== null)
      .map(p => p.clan as ClanId)
  )

  const waiting = gameState.waitingFor

  function pickClan(clan: ClanId) {
    if (me?.clan) return
    if (takenClans.has(clan)) return
    socket.emit('selectClan', clan)
  }

  return (
    <div className="clan-select">
      <div className="clan-select__status">
        {me?.clan
          ? <span>你選擇了 <strong>{CLAN_INFO[me.clan].name_zh}</strong>，等待其他玩家…</span>
          : <span>選擇你的氏族</span>
        }
      </div>

      <div className="clan-grid">
        {CLAN_ORDER.map(clanId => {
          const info = CLAN_INFO[clanId]
          const isTaken = takenClans.has(clanId)
          const isMine = me?.clan === clanId
          const takenBy = isTaken && !isMine
            ? Object.values(gameState.players).find(p => p.clan === clanId)?.name
            : null

          return (
            <button
              key={clanId}
              className={`clan-card ${isMine ? 'clan-card--mine' : ''} ${isTaken && !isMine ? 'clan-card--taken' : ''}`}
              style={{ '--clan-color': info.color } as React.CSSProperties}
              onClick={() => pickClan(clanId)}
              disabled={isTaken || !!me?.clan}
            >
              <div className="clan-card__color-bar" />
              <div className="clan-card__body">
                <div className="clan-card__name">{info.name_zh}</div>
                <div className="clan-card__name-en">{clanId.charAt(0).toUpperCase() + clanId.slice(1)}</div>
                <div className="clan-card__archetype">{info.archetype}</div>
                <div className="clan-card__desc">{info.desc}</div>
                {takenBy && (
                  <div className="clan-card__taken-by">{takenBy} 已選擇</div>
                )}
                {isMine && (
                  <div className="clan-card__chosen">✓ 你的選擇</div>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {waiting.length > 0 && (
        <div className="clan-select__waiting">
          等待：{waiting.map(id => gameState.players[id]?.name ?? id).join('、')}
        </div>
      )}
    </div>
  )
}

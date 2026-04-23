import { useState, useEffect } from 'react'
import { CARD_DEFS, TYPE_LABEL_ZH } from './cardDefs'
import CardImage from './CardImage'
import './CardLibrary.css'

interface Props {
  onClose: () => void
}

const CLANS = [
  { id: 'BR', label: '布魯哈',    sub: 'Brujah' },
  { id: 'NO', label: '諾斯費拉圖', sub: 'Nosferatu' },
  { id: 'TO', label: '托雷亞多爾', sub: 'Toreador' },
  { id: 'TR', label: '特雷梅爾',  sub: 'Tremere' },
  { id: 'MA', label: '馬爾卡維安', sub: 'Malkavian' },
  { id: 'GA', label: '剛格烈',    sub: 'Gangrel' },
  { id: 'VE', label: '凡崔',      sub: 'Ventrue' },
] as const

const TYPE_FILTERS = [
  { id: 'all',         label: '全部' },
  { id: 'conflict',    label: '衝突' },
  { id: 'preparation', label: '準備' },
  { id: 'aftermath',   label: '後果' },
  { id: 'passive',     label: '持續' },
] as const

type ClanId = typeof CLANS[number]['id']
type FilterType = typeof TYPE_FILTERS[number]['id']

export default function CardLibrary({ onClose }: Props) {
  const [activeClan, setActiveClan] = useState<ClanId>('BR')
  const [filterType, setFilterType] = useState<FilterType>('all')

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const clanCards = Object.entries(CARD_DEFS)
    .filter(([id]) => id.startsWith(activeClan))
    .filter(([, def]) => filterType === 'all' || def.type === filterType)
    .sort(([a], [b]) => parseInt(a.slice(2)) - parseInt(b.slice(2)))

  const typeCounts = Object.entries(CARD_DEFS)
    .filter(([id]) => id.startsWith(activeClan))
    .reduce<Record<string, number>>((acc, [, def]) => {
      acc[def.type] = (acc[def.type] ?? 0) + 1
      return acc
    }, {})

  return (
    <div className="cl-overlay" onClick={onClose}>
      <div className="cl-modal" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="cl-header">
          <div className="cl-header__title">卡牌圖鑑</div>
          <button className="cl-close" onClick={onClose} title="關閉（ESC）">✕</button>
        </div>

        {/* Clan tabs */}
        <div className="cl-clan-tabs">
          {CLANS.map(clan => (
            <button
              key={clan.id}
              className={[
                'cl-clan-tab',
                `cl-clan-tab--${clan.id.toLowerCase()}`,
                activeClan === clan.id ? 'cl-clan-tab--active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => { setActiveClan(clan.id); setFilterType('all') }}
            >
              <span className="cl-clan-tab__name">{clan.label}</span>
              <span className="cl-clan-tab__sub">{clan.sub}</span>
            </button>
          ))}
        </div>

        {/* Type filters */}
        <div className="cl-filter-row">
          {TYPE_FILTERS.map(f => (
            <button
              key={f.id}
              className={[
                'cl-filter-chip',
                `cl-filter-chip--${f.id}`,
                filterType === f.id ? 'cl-filter-chip--active' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => setFilterType(f.id)}
            >
              {f.label}
              {f.id !== 'all' && typeCounts[f.id] != null && (
                <span className="cl-filter-chip__count">{typeCounts[f.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* Card grid */}
        <div className="cl-grid">
          {clanCards.length === 0 && (
            <div className="cl-empty">此氏族無此類型卡牌</div>
          )}
          {clanCards.map(([id, def]) => (
            <div key={id} className={`cl-card cl-card--${def.type}`}>
              <CardImage cardId={id} className="cl-card__img" />
              <div className="cl-card__body">
                <div className="cl-card__meta">
                  <span className={`cl-type-badge cl-type-badge--${def.type}`}>
                    {TYPE_LABEL_ZH[def.type]}
                  </span>
                  <span className="cl-card__id">{id}</span>
                </div>
                <div className="cl-card__power-row">
                  <span className="cl-card__power">{def.power}</span>
                  <span className="cl-card__name">{def.name_zh}</span>
                </div>
                {def.effect_zh
                  ? <div className="cl-card__effect">{def.effect_zh}</div>
                  : <div className="cl-card__effect cl-card__effect--none">無效果文字</div>
                }
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  )
}

import type { ClanId } from '@kindred/shared'

/**
 * 七大氏族的識別系統(唯一來源)。
 * color: 深色底上可讀的識別色,用於文字/邊框/色條。
 * symbol: 單字元符號,用於小尺寸識別(HUD、chip)。
 */
export const CLANS: Record<ClanId, {
  zh: string
  en: string
  color: string
  symbol: string
}> = {
  brujah:    { zh: '布魯哈',     en: 'Brujah',    color: '#d05050', symbol: '✊' },
  nosferatu: { zh: '諾斯費拉圖', en: 'Nosferatu', color: '#5aa05a', symbol: '👁' },
  toreador:  { zh: '托瑞爾多',   en: 'Toreador',  color: '#3ab0b0', symbol: '🌹' },
  tremere:   { zh: '翠梅爾',     en: 'Tremere',   color: '#a070e0', symbol: '🜏' },
  malkavian: { zh: '馬爾卡維安', en: 'Malkavian', color: '#d050b0', symbol: '🌀' },
  gangrel:   { zh: '甘格瑞爾',   en: 'Gangrel',   color: '#c09030', symbol: '🐺' },
  ventrue:   { zh: '梵崔',       en: 'Ventrue',   color: '#5878d0', symbol: '♛' },
}

export const CLAN_ORDER: ClanId[] = [
  'brujah', 'nosferatu', 'toreador', 'tremere', 'malkavian', 'gangrel', 'ventrue',
]

export function clanOf(clan: string | null | undefined) {
  return clan ? CLANS[clan as ClanId] ?? null : null
}

/**
 * cardId → 圖片路徑對應表
 * 由實際掃描圖片 ID 建立，card_00 為封面不使用
 */
export const CARD_IMAGES: Record<string, string> = {
  // Brujah
  BR09: '/assets/brujah/card_01.webp',
  BR08: '/assets/brujah/card_02.webp',
  BR07: '/assets/brujah/card_03.webp',
  BR03: '/assets/brujah/card_04.webp',
  BR06: '/assets/brujah/card_05.webp',
  BR05: '/assets/brujah/card_06.webp',
  BR04: '/assets/brujah/card_07.webp',
  BR02: '/assets/brujah/card_08.webp',
  BR01: '/assets/brujah/card_09.webp',

  // Nosferatu
  NO09: '/assets/nosferatu/card_01.webp',
  NO08: '/assets/nosferatu/card_02.webp',
  NO07: '/assets/nosferatu/card_03.webp',
  NO03: '/assets/nosferatu/card_04.webp',
  NO02: '/assets/nosferatu/card_05.webp',
  NO01: '/assets/nosferatu/card_06.webp',
  NO06: '/assets/nosferatu/card_07.webp',
  NO05: '/assets/nosferatu/card_08.webp',
  NO04: '/assets/nosferatu/card_09.webp',

  // Toreador
  TO09: '/assets/toreador/card_01.webp',
  TO08: '/assets/toreador/card_02.webp',
  TO01: '/assets/toreador/card_03.webp',
  TO04: '/assets/toreador/card_04.webp',
  TO03: '/assets/toreador/card_05.webp',
  TO06: '/assets/toreador/card_06.webp',
  TO02: '/assets/toreador/card_07.webp',
  TO07: '/assets/toreador/card_08.webp',
  TO05: '/assets/toreador/card_09.webp',

  // Tremere
  TR09: '/assets/tremere/card_01.webp',
  TR08: '/assets/tremere/card_02.webp',
  TR04: '/assets/tremere/card_03.webp',
  TR02: '/assets/tremere/card_04.webp',
  TR07: '/assets/tremere/card_05.webp',
  TR05: '/assets/tremere/card_06.webp',
  TR01: '/assets/tremere/card_07.webp',
  TR06: '/assets/tremere/card_08.webp',
  TR03: '/assets/tremere/card_09.webp',

  // Malkavian
  MA09: '/assets/malkavian/card_01.webp',
  MA08: '/assets/malkavian/card_02.webp',
  MA03: '/assets/malkavian/card_03.webp',
  MA02: '/assets/malkavian/card_04.webp',
  MA04: '/assets/malkavian/card_05.webp',
  MA05: '/assets/malkavian/card_06.webp',
  MA06: '/assets/malkavian/card_07.webp',
  MA07: '/assets/malkavian/card_08.webp',
  MA01: '/assets/malkavian/card_09.webp',

  // Gangrel
  GA08: '/assets/gangrel/card_01.webp',
  GA09: '/assets/gangrel/card_02.webp',
  GA03: '/assets/gangrel/card_03.webp',
  GA06: '/assets/gangrel/card_04.webp',
  GA02: '/assets/gangrel/card_05.webp',
  GA01: '/assets/gangrel/card_06.webp',
  GA07: '/assets/gangrel/card_07.webp',
  GA04: '/assets/gangrel/card_08.webp',
  GA05: '/assets/gangrel/card_09.webp',

  // Ventrue
  VE09: '/assets/ventrue/card_01.webp',
  VE08: '/assets/ventrue/card_02.webp',
  VE05: '/assets/ventrue/card_03.webp',
  VE04: '/assets/ventrue/card_04.webp',
  VE06: '/assets/ventrue/card_05.webp',
  VE01: '/assets/ventrue/card_06.webp',
  VE02: '/assets/ventrue/card_07.webp',
  VE03: '/assets/ventrue/card_08.webp',
  VE07: '/assets/ventrue/card_09.webp',

  // Locations
  rack: '/assets/locations/card_00.webp',
  asylum: '/assets/locations/card_01.webp',
  club_zombie: '/assets/locations/card_02.webp',
  haven: '/assets/locations/card_03.webp',
}

export function cardImageSrc(cardId: string | null | undefined): string | null {
  if (!cardId) return null
  return CARD_IMAGES[cardId] ?? null
}

export function locationImageSrc(locationId: string): string | null {
  return CARD_IMAGES[locationId] ?? null
}

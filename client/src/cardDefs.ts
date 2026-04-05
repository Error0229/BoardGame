export interface CardDefClient {
  name_zh: string
  type: 'conflict' | 'preparation' | 'aftermath' | 'passive'
  power: number
  effect_zh: string | null
}

export const CARD_DEFS: Record<string, CardDefClient> = {
  // Brujah
  BR09: { name_zh: '狩獵',     type: 'aftermath',    power: 0, effect_zh: '從每個對手各偷取 1 點血液。' },
  BR08: { name_zh: '備戰',     type: 'passive',      power: 1, effect_zh: '若你使一個對手進入狂暴，你額外獲得 +1 影響力。' },
  BR01: { name_zh: '血腥狂怒', type: 'conflict',     power: 6, effect_zh: '若你在此地點有任何部署血液，此牌的戰力值 -2。' },
  BR02: { name_zh: '龐克幫眾', type: 'conflict',     power: 0, effect_zh: '此牌獲得 +2 戰力值，等同你在此地點的每張部署牌數量（包含此牌本身）。' },
  BR03: { name_zh: '挑戰宣言', type: 'passive',      power: 4, effect_zh: '每當對手在與此牌不同的地點出牌時，該對手失去 1 點血液。' },
  BR04: { name_zh: '該隱之拳', type: 'aftermath',    power: 4, effect_zh: '每個對手失去血液：第 1 回合 1 點，第 2 回合 2 點，第 3 回合 3 點。' },
  BR05: { name_zh: '打倒體制', type: 'aftermath',    power: 3, effect_zh: '若你贏得此地點，每個對手失去 4 點血液；若你未贏，他們失去 2 點血液。' },
  BR06: { name_zh: '地震衝擊', type: 'aftermath',    power: 2, effect_zh: '計算此地點所有玩家的部署血液總量，每 2 點血液使每個對手失去 1 點血液。' },
  BR07: { name_zh: '展示武力', type: 'preparation',  power: 3, effect_zh: '從每個對手各偷取 1 點血液。' },
  // Nosferatu
  NO09: { name_zh: '狩獵',     type: 'aftermath',    power: 0, effect_zh: '從每個對手各偷取 1 點血液，然後你可以將此牌移至王子的避難所。' },
  NO08: { name_zh: '備戰',     type: 'passive',      power: 1, effect_zh: '當此牌部署在王子的避難所時，獲得 +2 戰力值。' },
  NO01: { name_zh: '隱形通道', type: 'aftermath',    power: 2, effect_zh: '將此牌移至王子的避難所。' },
  NO02: { name_zh: '陰影斗篷', type: 'passive',      power: 3, effect_zh: '每當你從其他地點撤退時，你可以將你在那裡的部署牌和血液移至此地點。' },
  NO03: { name_zh: '暗中之眼', type: 'passive',      power: 2, effect_zh: '在規劃階段，對手在此地點出牌時必須面朝下。你可以隨時查看這些牌。每當一張牌在此地點面朝下出牌時，從銀行取 1 點血液部署至此地點。' },
  NO04: { name_zh: '野性耳語', type: 'passive',      power: 1, effect_zh: '當你從任何其他地點撤退時，從銀行取 2 點血液（每張移走的牌各取 2 點），部署至此地點。' },
  NO05: { name_zh: '背刺',     type: 'preparation',  power: 2, effect_zh: '在此地點部署最多 3 點血液，然後你可以將此牌移至王子的避難所。' },
  NO06: { name_zh: '領先一步', type: 'passive',      power: 3, effect_zh: '揭牌時，此地點每張對手面朝下的部署牌，每個對手必須選擇：失去 2 點血液將其翻面，或讓它保持面朝下。' },
  NO07: { name_zh: '消失於影', type: 'preparation',  power: 4, effect_zh: '你可以選擇撤退。若如此，從每個對手各偷取 1 點血液。' },
  // Toreador
  TO09: { name_zh: '狩獵',     type: 'aftermath',    power: 0, effect_zh: '從每個對手各偷取 1 點血液。' },
  TO08: { name_zh: '備戰',     type: 'preparation',  power: 0, effect_zh: '從牌堆抽取一張受害者牌，加入你的同盟。' },
  TO01: { name_zh: '敬畏',     type: 'aftermath',    power: 2, effect_zh: '你同盟中每 2 張牌，從每個對手各偷取 1 點血液。' },
  TO02: { name_zh: '隨從群',   type: 'conflict',     power: 0, effect_zh: '此牌獲得 +1 戰力值，等同你同盟中的牌數（最多 +7）。' },
  TO03: { name_zh: '魅力',     type: 'preparation',  power: 2, effect_zh: '每個對手必須從此地點棄置部署血液，你同盟中每 2 張牌迫使每位對手棄置 1 點。' },
  TO04: { name_zh: '召喚',     type: 'aftermath',    power: 3, effect_zh: '若你在此地點贏得盟友牌或受害者牌，再從牌堆額外抽一張受害者牌加入你的同盟。' },
  TO05: { name_zh: '魅惑',     type: 'conflict',     power: 0, effect_zh: '此牌獲得 +1 戰力值，等同此地點所有位置的部署牌數量。' },
  TO06: { name_zh: '臣服',     type: 'passive',      power: 3, effect_zh: '你免疫此地點觸發的失去血液和偷取血液效果。若失去血液是觸發條件，視為你已失去。' },
  TO07: { name_zh: '高層人脈', type: 'passive',      power: 3, effect_zh: '揭牌前，你可以為你同盟中的每張牌在此地點部署 1 點血液。' },
  // Tremere
  TR09: { name_zh: '狩獵',       type: 'aftermath',   power: 1, effect_zh: '你可以消耗 1 點血液，從每個對手各偷取 1 點血液。' },
  TR08: { name_zh: '備戰',       type: 'conflict',    power: 1, effect_zh: '若你在此地點進入狂暴，你可以將此牌翻至面朝下代替從同盟汲取牌。若如此，從銀行獲得 1 點血液。' },
  TR01: { name_zh: '飢餓中的專注', type: 'conflict',  power: 9, effect_zh: '此牌的戰力值 -1，等同你資源池中的每點血液數。' },
  TR02: { name_zh: '古老文物',   type: 'preparation', power: 6, effect_zh: '你必須消耗資源池中一半的血液（向下取整），否則將此牌翻至面朝下。' },
  TR03: { name_zh: '竊取生命力', type: 'preparation', power: 3, effect_zh: '獲得血液直到你的資源池達 7 點。若你的資源池已有 7 點或以上，改為獲得 1 點血液。' },
  TR04: { name_zh: '黑暗契約',   type: 'passive',     power: 1, effect_zh: '每當你在任何地點失去或消耗血液時，將該血液部署至此地點，而非歸還銀行。' },
  TR05: { name_zh: '血液坩堝',   type: 'aftermath',   power: 3, effect_zh: '你可以消耗資源池中一半的血液（向下取整）；若如此，每個對手失去 4 點血液。' },
  TR06: { name_zh: '反制報復',   type: 'passive',     power: 2, effect_zh: '在此地點，每當你消耗血液或成為失去血液／偷取血液效果的目標時，每個對手失去等量的血液。' },
  TR07: { name_zh: '奧術汲取',   type: 'preparation', power: 2, effect_zh: '你可以消耗資源池中一半的血液（向下取整）；若如此，取走每個對手在此地點部署血液的一半（向上取整），加入你的資源池。' },
  // Malkavian
  MA09: { name_zh: '狩獵',       type: 'aftermath',   power: 0, effect_zh: '從每個對手各偷取 1 點血液。' },
  MA08: { name_zh: '備戰',       type: 'conflict',    power: 0, effect_zh: '此牌獲得 +1 戰力值，等同你在此地點的每張部署牌數量（包含此牌本身）。' },
  MA01: { name_zh: '催眠操控',   type: 'preparation', power: 3, effect_zh: '選擇一個對手，將他們手中剩餘的所有牌面朝上部署至你在此地點的位置。' },
  MA02: { name_zh: '血液拍賣',   type: 'passive',     power: 2, effect_zh: '揭牌後立即，你和所有對手必須秘密以血液出價。出價最低者必須將他們在此地點的一張部署牌翻至面朝下。然後，你出價的血液部署至此地點；你的對手失去他們的出價。' },
  MA03: { name_zh: '瘋狂網絡',   type: 'preparation', power: 2, effect_zh: '將你手中剩餘的所有牌面朝上部署至此地點。' },
  MA04: { name_zh: '暗影突襲',   type: 'conflict',    power: 3, effect_zh: '若你在此地點面朝上的部署牌數量最少（即使平手），此牌獲得 +2 戰力值。' },
  MA05: { name_zh: '混沌',       type: 'preparation', power: 2, effect_zh: '你可以將你在此地點的 1 張或多張部署牌（包含此牌）收回手中。每收回一張牌，從每個對手各偷取 1 點血液。' },
  MA06: { name_zh: '馬爾卡夫之禍', type: 'passive',   power: 2, effect_zh: '揭牌後立即，從你的氏族牌堆頂端抽一張牌並部署至此地點。回合結束取回氏族牌時，從手中洗回 1 張你選擇的牌至牌堆。' },
  MA07: { name_zh: '無腦衝擊',   type: 'preparation', power: 3, effect_zh: '你可以將你在此地點位置上的 1 張或多張部署牌翻至面朝下；你在此地點位置上的每張面朝下部署牌的戰力值為 4。' },
  // Gangrel
  GA09: { name_zh: '狩獵',     type: 'aftermath',   power: 0, effect_zh: '從每個對手各偷取 1 點血液。' },
  GA08: { name_zh: '備戰',     type: 'preparation', power: 0, effect_zh: '從銀行取 2 點血液，部署至此地點。' },
  GA01: { name_zh: '融入大地', type: 'aftermath',   power: 1, effect_zh: '將你在此地點所有部署血液移回你的資源池。' },
  GA02: { name_zh: '狼族夥伴', type: 'conflict',    power: 2, effect_zh: '此地點每個對手的部署牌的印刷戰力值減半（向下取整）。' },
  GA03: { name_zh: '野性武器', type: 'conflict',    power: 1, effect_zh: '你在此地點的每點部署血液提供 2 點戰力值（而非 1 點）。' },
  GA04: { name_zh: '狼群之力', type: 'preparation', power: 2, effect_zh: '從每個對手在此地點的部署血液中取走一半（向上取整），加入你的資源池。' },
  GA05: { name_zh: '無懼',     type: 'preparation', power: 3, effect_zh: '你可以將你在此地點的部署血液與資源池中的血液互換。若如此，從銀行額外取 2 點血液部署至此地點。' },
  GA06: { name_zh: '徘徊狩獵', type: 'passive',     power: 3, effect_zh: '每當對手在此地點出牌時，從銀行取 1 點血液並部署至此地點。' },
  GA07: { name_zh: '迷霧型態', type: 'aftermath',   power: 2, effect_zh: '你可以將此地點部署血液的一半（向上取整）移至任意其他地點。' },
  // Ventrue
  VE09: { name_zh: '狩獵',       type: 'aftermath',   power: 0, effect_zh: '此地點的勝者必須選擇：讓你從他們那裡偷取 2 點血液，或給予你 1 點影響力。' },
  VE08: { name_zh: '備戰',       type: 'conflict',    power: 2, effect_zh: null },
  VE01: { name_zh: '主謀計劃',   type: 'passive',     power: 3, effect_zh: '規劃階段結束時，每個在此地點沒有部署牌的對手失去 1 點影響力。此牌獲得 +1 戰力值，等同此地點的對手數。' },
  VE02: { name_zh: '外交手腕',   type: 'conflict',    power: 3, effect_zh: '套用任何其他效果之前，此地點印刷戰力值最高的部署牌（忽略你位置上的）戰力值降至 0。若有平手，所有平手的牌均受影響。' },
  VE03: { name_zh: '宵禁令',     type: 'conflict',    power: 2, effect_zh: '揭牌後立即，你的每個對手必須選擇：跳過準備和後果步驟，或讓你從他們那裡偷取 3 點血液。' },
  VE04: { name_zh: '威嚴',       type: 'conflict',    power: 0, effect_zh: '此牌的戰力值等同此地點印刷戰力值最高的部署牌。' },
  VE05: { name_zh: '大規模操控', type: 'passive',     power: 3, effect_zh: '在此地點的撤退步驟中，每個對手必須選擇撤退，或讓你從他們那裡偷取 2 點血液才能留守。' },
  VE06: { name_zh: '暴君凝視',   type: 'preparation', power: 2, effect_zh: '每個對手必須選擇：將他們在此地點部署血液的一半（向上取整）移至你的位置，或失去 1 點影響力。' },
  VE07: { name_zh: '先發制人',   type: 'passive',     power: 3, effect_zh: '揭牌後立即，選擇對手位置上的 1 張部署牌。你免疫該牌的任何失去血液或偷取血液效果，並獲得等同其印刷戰力值的血液。' },
}

export const TYPE_LABEL_ZH: Record<string, string> = {
  conflict: '衝突', preparation: '準備', aftermath: '後果', passive: '持續',
}

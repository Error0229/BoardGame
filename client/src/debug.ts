/**
 * Client 端 debug log 工具。
 * dev mode 預設開啟;production 可在 console 執行
 * `localStorage.kindred_debug = '1'` 後重整開啟。
 */
const enabled: boolean = (() => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('kindred_debug') === '0') return false
    if (typeof localStorage !== 'undefined' && localStorage.getItem('kindred_debug') === '1') return true
    return import.meta.env.DEV === true
  } catch { return false }
})()

function ts(): string {
  return new Date().toISOString().slice(11, 23)
}

const TAG_COLORS: Record<string, string> = {
  emit:  'color:#e8a030;font-weight:bold',   // 送出 → 橘
  recv:  'color:#7cb8ff;font-weight:bold',   // 收到 ← 藍
  phase: 'color:#cc2222;font-weight:bold',   // 階段轉換 → 紅
  conn:  'color:#6dbf6d;font-weight:bold',   // 連線 → 綠
  ui:    'color:#c9a227;font-weight:bold',   // 使用者操作 → 金
}

/**
 * 攤平成單行純文字:物件變成 key=value 一層列出(深層值壓成 JSON 字串),
 * console 裡不會出現可收合的物件,「Save as」一定抓得到完整內容。
 */
function serialize(arg: unknown): unknown {
  if (arg === null || typeof arg !== 'object') return arg
  try {
    if (Array.isArray(arg)) return JSON.stringify(arg)
    return Object.entries(arg as Record<string, unknown>)
      .map(([k, v]) => `${k}=${v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' ')
  } catch { return String(arg) }
}

export function dlog(tag: string, ...args: unknown[]): void {
  if (!enabled) return
  console.log(`%c[${ts()}][${tag}]`, TAG_COLORS[tag] ?? 'color:#888', ...args.map(serialize))
}

export const debugEnabled = enabled

/**
 * Server 端 debug log 工具。
 * 預設開啟;設環境變數 DEBUG_GAME=0 關閉。
 */
const enabled = process.env.DEBUG_GAME !== '0';

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

/** 攤平成單行純文字:物件變成 key=value 一層列出,深層值壓成 JSON 字串 */
function serialize(arg: unknown): unknown {
  if (arg === null || typeof arg !== 'object') return arg;
  try {
    if (Array.isArray(arg)) return JSON.stringify(arg);
    return Object.entries(arg as Record<string, unknown>)
      .map(([k, v]) => `${k}=${v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v)}`)
      .join(' ');
  } catch { return String(arg); }
}

export function dlog(...args: unknown[]): void {
  if (!enabled) return;
  console.log(`[${ts()}]`, ...args.map(serialize));
}

export const debugEnabled = enabled;

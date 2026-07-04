import { useEffect, useRef, useState } from 'react'

export interface DeltaFlash {
  id: number
  value: number
}

let flashId = 0

/**
 * 監看數值變化,產生短暫的 +N/-N 飄字資料(1.4 秒後自動消失)。
 * PlayerHUD 與 PlayerSeats 共用。
 */
export function useDeltaFlash(value: number): DeltaFlash[] {
  const prev = useRef(value)
  const [flashes, setFlashes] = useState<DeltaFlash[]>([])

  useEffect(() => {
    const diff = value - prev.current
    prev.current = value
    if (diff === 0) return
    const id = ++flashId
    setFlashes(f => [...f, { id, value: diff }])
    const t = setTimeout(() => setFlashes(f => f.filter(x => x.id !== id)), 1400)
    return () => clearTimeout(t)
  }, [value])

  return flashes
}

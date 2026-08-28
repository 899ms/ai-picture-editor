import { useEffect, useRef, useState } from 'react'

const CAP = 92

/** 服务端进度是几个台阶，展示上往 92% 慢慢爬，完成时再收束到 100。 */
export function useSmoothedProgress(reported: number, running: boolean, token: string | null) {
  const [shown, setShown] = useState(0)
  const current = useRef(0)

  useEffect(() => {
    current.current = 0
    setShown(0)
  }, [token])

  useEffect(() => {
    if (!token) return
    if (!running && reported < 100) {
      current.current = 0
      setShown(0)
      return
    }

    let frame = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(0.2, (now - last) / 1000)
      last = now
      let next = current.current

      if (!running || reported >= 100) {
        next += (100 - next) * Math.min(1, dt / 0.2)
        if (next > 99.4) next = 100
      } else {
        if (reported > next) next = reported
        next += (CAP - next) * (1 - Math.exp(-dt / 9))
        next = Math.min(CAP, next)
      }

      if (Math.abs(next - current.current) >= 0.2 || next === 100) {
        current.current = next
        setShown(next)
      } else {
        current.current = next
      }

      if (next < 100) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [reported, running, token])

  return Math.round(shown)
}

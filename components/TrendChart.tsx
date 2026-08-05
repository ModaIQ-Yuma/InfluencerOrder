'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

type Series = { label: string; color: string; values: number[]; dash?: number[] }

export default function TrendChart({ dates, series }: { dates: string[]; series: Series[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; idx: number } | null>(null)

  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const parent = canvas.parentElement!
    const dpr = window.devicePixelRatio || 1
    const W = parent.clientWidth - 4, H = 240
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px'
    canvas.width = W * dpr; canvas.height = H * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, W, H)

    if (!dates.length) {
      ctx.fillStyle = '#444870'; ctx.font = '13px -apple-system,sans-serif'
      ctx.textAlign = 'center'; ctx.fillText('该时间段内无数据', W / 2, H / 2); return
    }

    const maxVal = Math.max(...series.flatMap(s => s.values), 1)
    const padL = 56, padR = 16, padT = 24, padB = 40
    const chartW = W - padL - padR, chartH = H - padT - padB

    ctx.strokeStyle = '#2a2d45'; ctx.lineWidth = 1
    for (let i = 0; i <= 4; i++) {
      const y = padT + (chartH / 4) * i
      ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
      ctx.fillStyle = '#444870'; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'right'
      ctx.fillText(String(Math.round(maxVal * (1 - i / 4))), padL - 6, y + 4)
    }
    const step = Math.max(1, Math.floor(dates.length / 8))
    ctx.fillStyle = '#444870'; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'center'
    dates.forEach((d, i) => {
      if (i % step === 0 || i === dates.length - 1)
        ctx.fillText(d.substring(5), padL + (i / (dates.length - 1 || 1)) * chartW, H - padB + 18)
    })

    const xPos = (i: number) => padL + (i / (dates.length - 1 || 1)) * chartW
    const yPos = (v: number) => padT + chartH - (v / maxVal) * chartH

    for (const s of series) {
      // Area fill
      ctx.beginPath()
      s.values.forEach((v, i) => i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)))
      ctx.lineTo(xPos(s.values.length - 1), padT + chartH)
      ctx.lineTo(xPos(0), padT + chartH); ctx.closePath()
      const g = ctx.createLinearGradient(0, padT, 0, padT + chartH)
      g.addColorStop(0, s.color + '28'); g.addColorStop(1, s.color + '00')
      ctx.fillStyle = g; ctx.fill()
      // Line
      ctx.beginPath(); ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'
      ctx.setLineDash(s.dash || [])
      s.values.forEach((v, i) => i === 0 ? ctx.moveTo(xPos(i), yPos(v)) : ctx.lineTo(xPos(i), yPos(v)))
      ctx.stroke(); ctx.setLineDash([])
    }

    // Legend
    let lx = padL
    for (const s of series) {
      ctx.fillStyle = s.color; ctx.fillRect(lx, 8, 14, 2.5)
      ctx.fillStyle = '#7e849e'; ctx.font = '10px -apple-system,sans-serif'; ctx.textAlign = 'left'
      ctx.fillText(s.label, lx + 18, 13)
      lx += ctx.measureText(s.label).width + 38
    }

    canvas.dataset.padL = String(padL); canvas.dataset.padR = String(padR)
    canvas.dataset.chartW = String(chartW); canvas.dataset.W = String(W); canvas.dataset.len = String(dates.length)
  }, [dates, series])

  useEffect(() => { draw() }, [draw])
  useEffect(() => { window.addEventListener('resize', draw); return () => window.removeEventListener('resize', draw) }, [draw])

  function handleMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const padL = parseFloat(canvas.dataset.padL || '56'), padR = parseFloat(canvas.dataset.padR || '16')
    const chartW = parseFloat(canvas.dataset.chartW || '0'), W = parseFloat(canvas.dataset.W || '0')
    const len = parseInt(canvas.dataset.len || '0')
    if (mx < padL || mx > W - padR || len === 0) { setTooltip(null); return }
    setTooltip({ x: e.clientX, y: e.clientY, idx: Math.min(len - 1, Math.max(0, Math.round((mx - padL) / chartW * (len - 1)))) })
  }

  return (
    <div className="relative">
      <canvas ref={canvasRef} height={240} onMouseMove={handleMove} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'crosshair' }} />
      {tooltip && (
        <div className="fixed z-50 pointer-events-none bg-[#242840] border border-[#363a58] rounded-xl p-3 shadow-2xl min-w-[160px]"
          style={{ left: tooltip.x + 12, top: tooltip.y - 60 }}>
          <div className="text-xs font-bold text-[#dde1f0] mb-2 pb-1.5 border-b border-[#2a2d45]">{dates[tooltip.idx]}</div>
          {series.map(s => (
            <div key={s.label} className="flex justify-between gap-4 text-xs mb-1">
              <span className="text-[#7e849e] flex items-center gap-1.5">
                <span className="inline-block w-2 h-2 rounded-full" style={{ background: s.color }} />{s.label}
              </span>
              <span className="font-semibold text-[#dde1f0]">{s.values[tooltip.idx]?.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

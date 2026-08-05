'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import type { Product, DailyEntry } from '@/lib/types'
import { displayName, pct, medalEmoji, medalLabel } from '@/lib/utils'
import TrendChart from './TrendChart'

const PIE_COLORS = ['#6c63ff','#3ecf8e','#f5a623','#e85d75','#38bdf8','#a78bfa','#fb923c','#34d399','#f472b6','#60a5fa','#facc15','#94a3b8']

function PieChart({ data }: { data: { label: string; value: number; color: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const draw = useCallback(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const size = Math.min(canvas.parentElement!.clientWidth, 240)
    canvas.style.width = size + 'px'; canvas.style.height = size + 'px'
    canvas.width = size * dpr; canvas.height = size * dpr
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr); ctx.clearRect(0, 0, size, size)
    const total = data.reduce((s, d) => s + d.value, 0)
    if (!total) { ctx.fillStyle = '#444870'; ctx.font = '13px -apple-system,sans-serif'; ctx.textAlign = 'center'; ctx.fillText('暂无数据', size / 2, size / 2); return }
    const cx = size / 2, cy = size / 2, r = size * 0.38, inner = r * 0.55
    let start = -Math.PI / 2
    for (const d of data) {
      const slice = (d.value / total) * Math.PI * 2
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, r, start, start + slice); ctx.closePath(); ctx.fillStyle = d.color; ctx.fill()
      start += slice
    }
    ctx.beginPath(); ctx.arc(cx, cy, inner, 0, Math.PI * 2); ctx.fillStyle = '#13151f'; ctx.fill()
    ctx.fillStyle = '#dde1f0'; ctx.font = `bold ${Math.round(size * 0.11)}px -apple-system,sans-serif`
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
    ctx.fillText(total.toLocaleString(), cx, cy - 8)
    ctx.fillStyle = '#444870'; ctx.font = `${Math.round(size * 0.065)}px -apple-system,sans-serif`
    ctx.fillText('总订单', cx, cy + 14)
  }, [data])
  useEffect(() => { draw() }, [draw])
  useEffect(() => { window.addEventListener('resize', draw); return () => window.removeEventListener('resize', draw) }, [draw])
  return <canvas ref={canvasRef} />
}

export default function OverviewPage({ products, daily }: { products: Product[]; daily: DailyEntry[] }) {
  const [mode, setMode] = useState<'single' | 'range'>('range')
  const [singleDate, setSingleDate] = useState('')
  const [rangeStart, setRangeStart] = useState('')
  const [rangeEnd, setRangeEnd] = useState('')

  useEffect(() => {
    const dates = [...new Set(daily.map(e => e.date))].sort()
    if (dates.length) {
      const last = dates[dates.length - 1]
      setRangeStart(dates[Math.max(0, dates.length - 30)]); setRangeEnd(last); setSingleDate(last)
    }
  }, [daily])

  const allDates = [...new Set(daily.map(d => d.date))].sort()
  const minDate = allDates[0] || '', maxDate = allDates[allDates.length - 1] || ''

  function quickRange(t: string) {
    const last = allDates[allDates.length - 1]; if (!last) return
    const n = { '7d': 7, '14d': 14, '30d': 30 }[t]
    if (n) { setRangeStart(allDates[Math.max(0, allDates.length - n)]); setRangeEnd(last) }
    else   { setRangeStart(allDates[0]); setRangeEnd(last) }
  }

  const activeEntries = mode === 'single' ? daily.filter(d => d.date === singleDate) : daily.filter(d => d.date >= rangeStart && d.date <= rangeEnd)

  function buildProductTotals(entries: DailyEntry[]) {
    const map: Record<string, { orders: number; organic: number; paid: number; refund: number }> = {}
    for (const e of entries) {
      if (!map[e.product_id]) map[e.product_id] = { orders: 0, organic: 0, paid: 0, refund: 0 }
      map[e.product_id].orders += e.total_orders; map[e.product_id].organic += e.organic_orders
      map[e.product_id].paid += e.paid_orders; map[e.product_id].refund += e.refund_orders ?? 0
    }
    return Object.entries(map).map(([pid, v]) => ({ pid, ...v, product: products.find(p => p.id === pid) })).sort((a, b) => b.orders - a.orders)
  }

  function buildTrend(entries: DailyEntry[]) {
    const tDates = allDates.filter(d => d >= rangeStart && d <= rangeEnd)
    const byDate: Record<string, { total: number; organic: number; paid: number; refund: number }> = {}
    for (const d of tDates) byDate[d] = { total: 0, organic: 0, paid: 0, refund: 0 }
    for (const e of entries) if (byDate[e.date]) { byDate[e.date].total += e.total_orders; byDate[e.date].organic += e.organic_orders; byDate[e.date].paid += e.paid_orders; byDate[e.date].refund += e.refund_orders ?? 0 }
    return { dates: tDates, total: tDates.map(d => byDate[d]?.total || 0), organic: tDates.map(d => byDate[d]?.organic || 0), paid: tDates.map(d => byDate[d]?.paid || 0), refund: tDates.map(d => byDate[d]?.refund || 0) }
  }

  const productTotals = buildProductTotals(activeEntries)
  const totalOrders = productTotals.reduce((s, p) => s + p.orders, 0)
  const totalOrganic = productTotals.reduce((s, p) => s + p.organic, 0)
  const totalPaid = productTotals.reduce((s, p) => s + p.paid, 0)
  const totalRefund = productTotals.reduce((s, p) => s + p.refund, 0)
  const pieData = productTotals.map((p, i) => ({ label: displayName(p.product), value: p.orders, color: PIE_COLORS[i % PIE_COLORS.length] }))
  const trend = buildTrend(daily.filter(d => d.date >= rangeStart && d.date <= rangeEnd))

  if (!daily.length) return (
    <div className="flex flex-col items-center justify-center h-[calc(100vh-52px)] text-[#444870] gap-2">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" opacity={0.3}><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
      <span className="text-sm">暂无订单数据，请先上传 xlsx</span>
    </div>
  )

  return (
    <div className="p-6 max-w-screen-xl mx-auto overflow-y-auto" style={{ minHeight: 'calc(100vh - 52px)' }}>
      <div className="mb-6"><h1 className="text-xl font-bold tracking-tight">全产品看板</h1><p className="text-xs text-[#7e849e] mt-1">跨 SKU 的订单汇总、趋势与占比</p></div>

      <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex rounded-lg overflow-hidden border border-[#2a2d45]">
            {(['single','range'] as const).map(m => <button key={m} onClick={() => setMode(m)} className={`px-3 py-1.5 text-xs font-medium transition-all ${mode===m?'bg-[#6c63ff] text-white':'text-[#7e849e] hover:text-white bg-[#1c1f2e]'}`}>{m==='single'?'单日':'时间段'}</button>)}
          </div>
          {mode === 'single' ? (
            <input type="date" value={singleDate} min={minDate} max={maxDate} onChange={e=>setSingleDate(e.target.value)} className="bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-3 py-1.5 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
          ) : (<>
            {['7d','14d','30d','all'].map(t => <button key={t} onClick={() => quickRange(t)} className="px-2.5 py-1.5 text-xs rounded-lg border border-[#2a2d45] text-[#7e849e] bg-[#1c1f2e] hover:border-[#6c63ff] hover:text-white transition-all">{t==='all'?'全部':`近${t.replace('d','天')}`}</button>)}
            <div className="flex items-center gap-2 text-xs text-[#444870]">
              <span>从</span><input type="date" value={rangeStart} min={minDate} max={maxDate} onChange={e=>setRangeStart(e.target.value)} className="bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-2 py-1.5 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
              <span>至</span><input type="date" value={rangeEnd} min={minDate} max={maxDate} onChange={e=>setRangeEnd(e.target.value)} className="bg-[#1c1f2e] border border-[#2a2d45] rounded-lg px-2 py-1.5 text-xs text-[#dde1f0] outline-none focus:border-[#6c63ff]" style={{colorScheme:'dark'}} />
            </div>
          </>)}
          <div className="ml-auto text-xs text-[#444870]">{mode==='single'?singleDate||'—':`${trend.dates.length} 天`}</div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { label:'总订单', value:totalOrders,  color:'text-[#dde1f0]', sub:'成交+退货' },
          { label:'自然流', value:totalOrganic, color:'text-[#3ecf8e]', sub:`${pct(totalOrganic,totalOrders)}% 占总单` },
          { label:'广告流', value:totalPaid,    color:'text-[#f5a623]', sub:`${pct(totalPaid,totalOrders)}% 占总单` },
          { label:'退货',   value:totalRefund,  color:'text-[#e85d75]', sub:`${pct(totalRefund,totalOrders)}% 退货率` },
          { label:'在售SKU',value:productTotals.filter(p=>p.orders>0).length, color:'text-[#38bdf8]', sub:`/ ${products.length} 个` },
        ].map(c => (
          <div key={c.label} className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-4">
            <div className="text-[11px] text-[#444870] uppercase tracking-wider mb-2">{c.label}</div>
            <div className={`text-2xl font-bold tracking-tight ${c.color}`}>{c.value.toLocaleString()}</div>
            <div className="text-xs text-[#444870] mt-1">{c.sub}</div>
          </div>
        ))}
      </div>

      {mode === 'range' && (
        <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-5 mb-6">
          <div className="flex items-center gap-3 mb-4"><span className="text-[11px] font-semibold text-[#444870] uppercase tracking-widest">全产品订单趋势</span><div className="flex-1 h-px bg-[#2a2d45]" /></div>
          <TrendChart dates={trend.dates} series={[{label:'总订单',color:'#6c63ff',values:trend.total},{label:'自然流',color:'#3ecf8e',values:trend.organic},{label:'广告流',color:'#f5a623',values:trend.paid},{label:'退货',color:'#e85d75',values:trend.refund,dash:[4,3]}]} />
        </div>
      )}

      <div className="grid grid-cols-[auto_1fr] gap-6 items-start">
        <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl p-5 w-[280px]">
          <div className="text-[11px] font-semibold text-[#444870] uppercase tracking-widest mb-4">订单占比</div>
          <div className="flex justify-center mb-5"><PieChart data={pieData} /></div>
          <div className="space-y-2">
            {pieData.slice(0,10).map((d,i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{background:d.color}} />
                <span className="text-[#7e849e] flex-1 truncate">{d.label}</span>
                <span className="font-semibold text-[#dde1f0]">{d.value.toLocaleString()}</span>
                <span className="text-[#444870] min-w-[32px] text-right">{pct(d.value,totalOrders)}%</span>
              </div>
            ))}
            {pieData.length > 10 && <div className="text-xs text-[#444870]">...及其他 {pieData.length-10} 个 SKU</div>}
          </div>
        </div>

        <div className="bg-[#13151f] border border-[#2a2d45] rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-[#1c1f2e] text-[11px] font-semibold text-[#444870] uppercase tracking-wider">SKU 订单排行</div>
          <table className="w-full text-sm">
            <thead><tr className="bg-[#1c1f2e] border-t border-[#2a2d45]">{['#','商品名称','总订单','自然流','广告流','退货','退货率','占比','份额条'].map(h=><th key={h} className="px-3 py-2 text-left text-[11px] text-[#444870] font-semibold uppercase tracking-wider whitespace-nowrap">{h}</th>)}</tr></thead>
            <tbody>
              {productTotals.length === 0 ? <tr><td colSpan={9} className="px-4 py-8 text-center text-xs text-[#444870]">该时间段内无数据</td></tr>
              : productTotals.map((p,i) => {
                const color = PIE_COLORS[i % PIE_COLORS.length]
                return (
                  <tr key={p.pid} className="border-t border-[#2a2d45] hover:bg-[rgba(255,255,255,0.02)]">
                    <td className="px-3 py-2.5 text-sm" title={medalLabel(i)}>{medalEmoji(i)}</td>
                    <td className="px-3 py-2.5"><div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full flex-shrink-0" style={{background:color}}/><div><div className="text-[13px] font-semibold text-[#dde1f0] leading-snug">{displayName(p.product)}</div><div className="text-[10px] font-mono text-[#444870]">{p.pid}</div></div></div></td>
                    <td className="px-3 py-2.5 tabular-nums font-semibold">{p.orders.toLocaleString()}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[#3ecf8e]">{p.organic.toLocaleString()} <span className="text-[11px] text-[#444870]">{pct(p.organic,p.orders)}%</span></td>
                    <td className="px-3 py-2.5 tabular-nums text-[#f5a623]">{p.paid.toLocaleString()} <span className="text-[11px] text-[#444870]">{pct(p.paid,p.orders)}%</span></td>
                    <td className="px-3 py-2.5 tabular-nums text-[#e85d75]">{p.refund.toLocaleString()}</td>
                    <td className="px-3 py-2.5 tabular-nums text-[11px] text-[#e85d75]">{pct(p.refund,p.orders)}%</td>
                    <td className="px-3 py-2.5 tabular-nums text-xs text-[#7e849e]">{pct(p.orders,totalOrders)}%</td>
                    <td className="px-3 py-2.5 w-24"><div className="h-1.5 bg-[#2a2d45] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${pct(p.orders,totalOrders)}%`,background:color}}/></div></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {productTotals.length > 0 && <div className="px-4 py-2.5 border-t border-[#2a2d45] bg-[#1c1f2e] flex justify-between text-xs text-[#444870]"><span>共 {productTotals.length} 个 SKU</span><span>合计 {totalOrders.toLocaleString()} 单 · 退货 {totalRefund.toLocaleString()} 单</span></div>}
        </div>
      </div>
    </div>
  )
}
